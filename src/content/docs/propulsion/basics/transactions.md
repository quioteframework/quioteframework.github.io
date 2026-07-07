---
title: Transactions
description: Wrapping queries in a transaction, save()'s implicit transactions, and Propulsion's emulated nested transactions.
---

Database transactions protect data integrity and, used well, query performance. Propulsion uses transactions internally for every `save()`/`delete()` call, and exposes a plain PDO-flavored API for wrapping your own code in one.

:::note
If the [ACID](https://en.wikipedia.org/wiki/ACID) acronym doesn't ring a bell, it's worth reading up on [database transactions](https://en.wikipedia.org/wiki/Database_transaction) before this page.
:::

## Wrapping queries in a transaction

Propulsion connections are `PropulsionPDO` instances, so transactions use [PDO's built-in transaction support](https://www.php.net/manual/en/pdo.transactions.php) verbatim — `beginTransaction()`, `commit()`, and `rollback()`:

```php
<?php
use Propulsion\Propulsion;

public function transferMoney($fromAccountNumber, $toAccountNumber, $amount)
{
    $con = Propulsion::getWriteConnection(\Map\AccountTableMap::DATABASE_NAME);

    $fromAccount = AccountQuery::create()->findPk($fromAccountNumber, $con);
    $toAccount   = AccountQuery::create()->findPk($toAccountNumber, $con);

    $con->beginTransaction();

    try {
        $fromAccount->setValue($fromAccount->getValue() - $amount);
        $fromAccount->save($con);

        $toAccount->setValue($toAccount->getValue() + $amount);
        $toAccount->save($con);

        $con->commit();
    } catch (\Exception $e) {
        $con->rollback();
        throw $e;
    }
}
```

If saving either account throws, the whole transfer rolls back — the money never "vanishes" partway through (Atomicity). If both saves succeed, the transaction commits and both changes persist together.

:::tip
A connection object is always available through `Propulsion::getReadConnection([Model]TableMap::DATABASE_NAME)` and `Propulsion::getWriteConnection([Model]TableMap::DATABASE_NAME)`.
:::

## `save()`/`delete()` already run in a transaction

`BaseXXX::save()` wraps its own `INSERT`/`UPDATE` in a transaction together with anything registered in a `preSave()`/`postSave()` hook, so denormalized counters, audit rows, or related-object saves triggered from those hooks commit or roll back atomically with the row itself:

```php
<?php
class Book extends BaseBook
{
    public function postSave(ConnectionInterface $con): void
    {
        $author = $this->getAuthor();
        $author->setNbBooks($author->countBooks($con));
        $author->save($con);
    }
}
```

If anything in `postSave()` throws, the book's own insert/update rolls back too — the hook runs inside the same transaction `save()` already opened.

## Nested transactions

PDO itself has no concept of nested transactions, but Propulsion emulates them across every supported database: calling `beginTransaction()`/`commit()`/`rollback()` while an outer transaction is already open is a no-op as far as the database is concerned — only the outermost pair actually starts/ends a real database transaction.

```php
<?php
function deleteBooksWithNoPrice(ConnectionInterface $con): void
{
    $con->beginTransaction();
    try {
        $c = new Criteria();
        $c->add(\Map\BookTableMap::PRICE, null, Criteria::ISNULL);
        \Map\BookTableMap::doDelete($c, $con);
        $con->commit();
    } catch (\Exception $e) {
        $con->rollback();
        throw $e;
    }
}

function cleanup(ConnectionInterface $con): void
{
    $con->beginTransaction();
    try {
        deleteBooksWithNoPrice($con); // nested: no real commit here
        $con->commit();               // this one actually commits
    } catch (\Exception $e) {
        $con->rollback();
        throw $e;
    }
}
```

If an exception surfaces from a nested transaction, it propagates up to the outermost `catch`, so the entire outer transaction rolls back — as long as every nested `catch` rethrows. This lets you compose transactional functions freely without worrying about nesting depth; whether the underlying RDBMS supports real nested transactions or not, Propulsion always resolves to one all-or-nothing outer transaction.

## Using transactions to boost performance

Each transaction has its own overhead, which for many small writes can dominate the cost of the queries themselves. Wrapping a batch of otherwise-independent `save()` calls in one outer transaction collapses their implicit inner transactions into a single commit:

```php
<?php
$con = Propulsion::getWriteConnection(\Map\BookTableMap::DATABASE_NAME);
$con->beginTransaction();
for ($i = 0; $i < 2002; $i++) {
    $book = new Book();
    $book->setTitle($i . ': A Space Odyssey');
    $book->save($con); // nested — no per-row commit
}
$con->commit();
```

:::caution
Most database engines lock affected rows (or tables) until the outermost `commit()` runs, so a large transaction queues out every other query touching the same rows for its duration. Use large transactions only where you can tolerate the reduced concurrency.
:::

## Always pass the connection explicitly

Every example on this page passes `$con` explicitly to `findPk()`/`save()`. Propulsion can resolve a connection on its own if you omit it, but passing it explicitly is worth doing anyway:

- Propulsion skips looking the connection up, a small performance win.
- It lets you target a specific connection — required in master/replica setups, to keep reads and writes apart.
- Most importantly, a transaction is tied to one connection. Two queries against different connections can never share a transaction, so Propulsion throws if you mix them.

## Limitations

- No built-in row locking (`SELECT ... FOR UPDATE`).
- A nested transaction's `catch` block must always rethrow — swallowing the exception risks the outer transaction never rolling back.
- True nested transactions with partial rollback (via savepoints) aren't implemented; only the outermost transaction is ever a real database transaction.
- If you roll back and then ignore the thrown exception anyway, some objects can end up out of sync with the database. Let a transaction exception propagate until it stops execution rather than catching and discarding it.
