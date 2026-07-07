---
title: Basic CRUD
description: Create, read, update, and delete rows through generated Object Model and Query classes.
---

This page walks through basic C.R.U.D. (create, retrieve, update, delete) operations against the generated Object Model classes from [Building your schema](/propulsion/getting-started/schema-and-build-time/), using the bookstore example's `Author` and `Book` classes.

## Creating rows

Instantiate a generated model object, set its properties with the generated `setXXX()` methods, and call `save()`:

```php
<?php

$author = new Author();
$author->setFirstName('Jane');
$author->setLastName('Austen');
$author->save();
```

The setter names come from each column's `phpName` (or a CamelCase version of the column name, if `phpName` isn't set in the schema). `save()` issues the appropriate `INSERT`:

```sql
INSERT INTO author (first_name, last_name) VALUES ('Jane', 'Austen');
```

## Reading object properties

Each column has a matching generated getter:

```php
<?php
echo $author->getId();        // 1
echo $author->getFirstName(); // 'Jane'
echo $author->getLastName();  // 'Austen'
```

`id` was assigned by the database, since the schema marks it `autoIncrement` — it's populated on the object as soon as `save()` returns. None of these getter calls hit the database; the object is already loaded in memory.

You can also export an object's properties in bulk with `toArray()`, `toXML()`, `toYAML()`, `toJSON()`, `toCSV()`, and `__toString()` — each has a matching `fromXXX()` import counterpart:

```php
<?php
echo $author->toJSON();
// {"Id":1,"FirstName":"Jane","LastName":"Austen"}
```

## Retrieving rows

Retrieving — "hydrating" — objects means running a `SELECT` and populating instances of the matching model class from the result. Propulsion generates a `Query` class per table for exactly this.

### By primary key

`findPk()` retrieves a single row by its primary key, returning `null` if there's no match:

```php
<?php
$firstAuthor = AuthorQuery::create()->findPk(1);
```

This issues a simple `SELECT`:

```sql
SELECT author.id, author.first_name, author.last_name
FROM author
WHERE author.id = 1
LIMIT 1;
```

Every generated Query class has a static `create()` factory, so you can chain straight off it without a separate `new` statement. When a table's primary key spans multiple columns, `findPk()` takes one argument per column.

To fetch several rows by their primary keys at once, use `findPks()` with an array:

```php
<?php
$selectedAuthors = AuthorQuery::create()->findPks([1, 2, 3, 4, 5, 6, 7]);
// a collection of Author objects
```

### General queries

An empty query carries no condition and returns every row:

```php
<?php
$authors = AuthorQuery::create()->find();
foreach ($authors as $author) {
    echo $author->getFirstName();
}
```

Filter with a generated `filterByXXX()` method, named after a column's `phpName`. These return the query object itself, so they chain:

```php
<?php
$authors = AuthorQuery::create()
    ->filterByFirstName('Jane')
    ->find();
```

Values passed to `filterByXXX()` are escaped according to the column's type via PDO parameter binding — this is the preferred way to build conditions, both for safety and because it accepts wildcards and arrays for more advanced matching. `orderByXXX()` and `limit()` chain the same way:

```php
<?php
$authors = AuthorQuery::create()
    ->orderByLastName()
    ->limit(10)
    ->find();
```

`find()` always returns a collection, even for a single result. Use `findOne()` when you only want (at most) one object back:

```php
<?php
$author = AuthorQuery::create()
    ->filterByFirstName('Jane')
    ->findOne();
```

A shorthand magic method combines the two for the simplest case:

```php
<?php
$author = AuthorQuery::create()->findOneByFirstName('Jane');
```

### Custom SQL

For a query too complex to express fluently — a correlated sub-select, for example — you can still drop to raw SQL over the underlying `PropulsionPDO` connection:

```php
<?php
use Propulsion\Propulsion;

$con = Propulsion::getWriteConnection(\Map\BookTableMap::DATABASE_NAME);
$sql = 'SELECT * FROM book WHERE id NOT IN '
     . '(SELECT book_review.book_id FROM book_review '
     . 'INNER JOIN author ON (book_review.author_id = author.id) '
     . 'WHERE author.last_name = :name)';
$stmt = $con->prepare($sql);
$stmt->execute([':name' => 'Austen']);
```

To hydrate `Book` objects from the resulting statement, use `ObjectFormatter`:

```php
<?php
use Propulsion\Formatter\ObjectFormatter;

$formatter = new ObjectFormatter();
$formatter->setClass(Book::class);
$books = $formatter->format($con->getDataFetcher($stmt));
```

The result set must be numerically indexed, must contain every column of the table (except lazy-loaded ones), and must list columns in the same order they're defined in `schema.xml`.

## Updating objects

Update a retrieved object, then save it:

```php
<?php
$author = AuthorQuery::create()->findOneByFirstName('Jane');
$author->setLastName('Austen');
$author->save();
```

To update several rows at once — or when you never needed to load them into objects — call `update()` directly on a query:

```php
<?php
AuthorQuery::create()
    ->filterByFirstName('Jane')
    ->update(['LastName' => 'Austen']);
```

## Deleting objects

Delete an object you already have:

```php
<?php
$author = AuthorQuery::create()->findOneByFirstName('Jane');
$author->delete();
```

Or delete directly from a query, without loading the objects first:

```php
<?php
AuthorQuery::create()
    ->filterByFirstName('Jane')
    ->delete();
```

A deleted object still exists in PHP — `isDeleted()` returns `true`, and its properties remain readable, but it can no longer be saved.

## Query termination methods

`find()`, `findOne()`, `update()`, and `delete()` are all "termination methods" — they end a query chain rather than returning the query object for further chaining. Two more worth knowing:

`count()` returns the number of matching rows without hydrating any objects — cheaper than counting a `find()` result:

```php
<?php
$nbAuthors = AuthorQuery::create()->count();
```

`paginate()` returns a pager over a slice of results:

```php
<?php
$authorPager = AuthorQuery::create()->paginate(page: 1, maxPerPage: 10);
foreach ($authorPager as $author) {
    echo $author->getFirstName();
}

echo $authorPager->getNbResults();   // total results across all pages
echo $authorPager->haveToPaginate(); // true if results exceed maxPerPage
```

## Collections and on-demand hydration

`find()` returns a `PropulsionCollection` — iterate it, index into it, or count it like an array of model objects. For large result sets, `setFormatter()` switches to hydrating rows one at a time instead of loading everything into memory up front:

```php
<?php
use Propulsion\Formatter\ModelCriteria;

$authors = AuthorQuery::create()
    ->limit(50000)
    ->setFormatter(ModelCriteria::FORMAT_ON_DEMAND)
    ->find();

foreach ($authors as $author) {
    echo $author->getFirstName();
}
```

With `FORMAT_ON_DEMAND`, memory use stays flat regardless of how many rows the query returns. `ModelCriteria::FORMAT_ARRAY` is another built-in formatter, returning associative arrays instead of model objects when you don't need any of the model's own logic.

## The instance pool

Propulsion keeps recently-retrieved objects in memory — the instance pool — to avoid re-querying the database for something already fetched in the same request:

```php
<?php
$author1 = AuthorQuery::create()->findPk(1); // issues a SELECT
$author2 = AuthorQuery::create()->findPk(1); // returns the existing $author1, no query
```

Pooling is on by default and keyed per generated class by primary key (a single PK's string value, or a serialized composite-PK tuple). Disable it globally with `Propulsion::disableInstancePooling()` (and re-enable with `Propulsion::enableInstancePooling()`) if you need every `findPk()`/`find()` to hit the database — `on-demand` iteration (see above) already disables and restores pooling around itself automatically, since streaming a large result set through the pool would just recreate the memory problem `FORMAT_ON_DEMAND` exists to avoid.

### Worker-safety: pools are per-request, not per-process

In Propel 1, each generated Peer class held its own instance pool in a `private static $instances` array — process-global state. That's fine under classic PHP (one process per request), but wrong under a persistent worker (FrankenPHP, RoadRunner, Swoole): a static array survives across requests in the same process, so one request's pooled objects — and stale data — would leak into the next.

Propulsion fixes this by splitting process-wide state from request-wide state into two objects, both reachable off the `Propulsion` facade:

- **`Propulsion::getServiceContainer()`** — process-scoped. Owns things that are genuinely safe, even desirable, to share across requests in the same worker: database connections, adapters, table maps.
- **`Propulsion::getSession()`** — request-scoped. Owns everything that must *not* leak from one request into the next: every generated class's instance pool, the [replication](/propulsion/cookbook/replication/) `forceMasterConnection` flag, and cleanup of any transaction a request left dangling.

Generated `getInstanceFromPool()`/`addInstanceToPool()`/`removeInstanceFromPool()`/`clearInstancePool()`/`getInstancePool()` methods on Peer classes are thin wrappers delegating to the current `Session` — there's no per-class static storage left to leak.

**If you're running Propulsion under a persistent worker, call `Propulsion::getSession()->reset()` at the end of every request** (a request-boundary hook, middleware `finally`, or your worker loop's per-iteration cleanup — whichever your runtime exposes). `reset()`, in order: force-rolls-back any connection left in an open transaction, clears every instance pool, and resets `forceMasterConnection` to `false`. Skip this under classic per-request PHP processes — the process exits and takes all of this state with it anyway, so calling `reset()` is harmless but unnecessary. A framework-level Propulsion integration (Quiote's own adapter, for instance — see [Databases: Propulsion](/basics/databases/#propulsion)) calls `reset()` for you at its own request boundary, so application code using such an integration doesn't need to call it directly.

This is exercised end-to-end by a real FrankenPHP worker test harness in Propulsion's own test suite (`test/worker/`, run via `composer test:worker`), not just unit tests — it makes real sequential HTTP requests against a live worker process and asserts that no pooled object, open transaction, or `forceMasterConnection` setting survives from one request into the next, and that memory stays flat under sustained load.

See [Relationships](/propulsion/basics/relationships/) for querying and filtering across foreign keys, which builds directly on the Query API introduced here.
