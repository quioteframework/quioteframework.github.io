---
title: Migrations
description: Generating and running schema migrations with bin/propulsion sql:diff, migration:status, migration:up, and migration:down.
---

A schema rarely stays still over a project's lifetime — new tables, new columns, new indexes. Propulsion's migration tools let you evolve the database structure in place, preserving existing data, instead of dropping and recreating it every time `schema.xml` changes.

:::note
Migrations are supported for MySQL, SQLite, and PostgreSQL.
:::

## Workflow

1. Edit `schema.xml` to change the model.
2. Run `sql:diff` to compare a live database against the schema and generate a migration class with the SQL needed to go from one to the other.
3. Review the generated class, adding data-migration code if needed.
4. Run `migration:up` (or `migration:down` to reverse) to apply it.

### A first migration

Start with a single `book` table:

```xml title="schema.xml"
<database name="bookstore" defaultIdMethod="native">
  <table name="book" description="Book Table">
    <column name="id" type="integer" primaryKey="true" autoIncrement="true"/>
    <column name="title" type="varchar" required="true" primaryString="true"/>
    <column name="isbn" required="true" type="varchar" size="24" phpName="ISBN"/>
  </table>
</database>
```

`sql:diff` connects to a live database (via a `buildtime-conf.php`/`buildtime-conf.xml` connection file) and compares it against the schema:

```bash
vendor/bin/propulsion sql:diff schema.xml --buildtime-conf=buildtime-conf.php --database=pgsql --migration-dir=./migrations
```

`buildtime-conf.php` is a plain PHP file returning the datasource(s) to connect to:

```php title="buildtime-conf.php"
<?php

return [
    'default' => 'bookstore',
    'datasources' => [
        'bookstore' => [
            'adapter'  => 'pgsql',
            'dsn'      => 'pgsql:host=localhost;dbname=bookstore',
            'user'     => 'me',
            'password' => 'secret',
        ],
    ],
];
```

A legacy `buildtime-conf.xml` file (Propel 1's original format) is also still accepted, for projects migrating an existing setup.

Against an empty database, `sql:diff` reports one added table and writes a migration class named after the current timestamp, `PropulsionMigration_<timestamp>.php`, into `--migration-dir` (default `./migrations`):

```php title="migrations/PropulsionMigration_1751500000.php"
<?php
class PropulsionMigration_1751500000
{
    public function getUpSQL()
    {
        return ['bookstore' => '
CREATE TABLE "book"
(
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "isbn" VARCHAR(24) NOT NULL,
    PRIMARY KEY ("id")
);
'];
    }

    public function getDownSQL()
    {
        return ['bookstore' => 'DROP TABLE IF EXISTS "book";'];
    }
}
```

Review it, then apply it:

```bash
vendor/bin/propulsion migration:up --buildtime-conf=buildtime-conf.php --migration-dir=./migrations
```

```
Executing migration PropulsionMigration_1751500000 up
1 of 1 SQL statements executed successfully on datasource "bookstore"
Migration complete. No further migration to execute.
```

:::tip
Commit migration classes to version control — other developers (and CI) just run the same migrations to reach the same database state.
:::

Adding an `author` table and a foreign key from `book` later is the same two-step process: edit the schema, `sql:diff`, review, `migration:up`. `sql:diff` diffs the *live database* against the schema each time, so it always produces exactly the SQL needed to close the gap — including `ALTER TABLE`, new indexes, and new foreign key constraints, without touching existing data.

## Command reference

All three migration commands (`migration:status`, `migration:up`, `migration:down`) share the same options:

| Option | Default | Meaning |
|---|---|---|
| `--migration-dir`, `-o` | `./migrations` | Directory containing `PropulsionMigration_<timestamp>.php` classes |
| `--migration-table` | `propulsion_migration` | Name of the append-only ledger table Propulsion uses to track migration runs — see [How it works](#how-it-works) |
| `--buildtime-conf` | — | Path to the connection config (`buildtime-conf.php`, or legacy `buildtime-conf.xml`) |
| `--config`, `-c` | — | Build-properties file(s) overriding `generator/default.php` (repeatable) |
| `--database`, `-d` | — | Target database adapter, if not set via config |

### `migration:up` / `migration:down`

`migration:up` executes exactly the next pending migration's `getUpSQL()`; `migration:down` executes the most recently applied migration's `getDownSQL()`, one at a time:

```bash
vendor/bin/propulsion migration:down --buildtime-conf=buildtime-conf.php --migration-dir=./migrations
vendor/bin/propulsion migration:up   --buildtime-conf=buildtime-conf.php --migration-dir=./migrations
```

A migration that fails partway leaves a statement log in the error output and the command exits non-zero — it never reports success on a half-applied migration.

### `migration:status`

Lists which migrations have already run against the configured datasource(s), and which are still pending:

```bash
vendor/bin/propulsion migration:status --buildtime-conf=buildtime-conf.php --migration-dir=./migrations
```

```
Checking Database Versions
Migration Files
2 migration classes found in "./migrations"
  > PropulsionMigration_1751500000 (executed)
    PropulsionMigration_1751586400
Run "migration:up" to execute it.
```

Add `-v`/`-vv` for more detail, including the DSN Propulsion connected with and the timestamp of the most recently applied migration.

## How it works

Migration class names embed the timestamp they were generated at, which both sorts them chronologically in a directory listing and avoids collisions between two developers generating migrations at the same time.

Propulsion tracks migration state in a ledger table (`propulsion_migration` by default, `--migration-table` to rename it) — it's not used at runtime by your application, so don't be surprised to see it appear in your database. This is an **append-only audit log, not a single-row version marker**: every `migration:up`/`migration:down` attempt against a datasource — successful or not — gets its own new row, never updated or deleted.

| Column | Holds |
|---|---|
| `id` | Auto-increment primary key; insertion order is the source of truth for "most recent". |
| `migration_timestamp` | The migration's timestamp identifier (from its class name). |
| `migration_name` | The migration class name, e.g. `PropulsionMigration_1751500000`. |
| `direction` | `up` or `down`. |
| `checksum` | SHA-256 of the exact SQL executed for this attempt — lets a future `status`/validate check detect a migration file edited after it already ran. |
| `applied_at` | Timestamp of the attempt. |
| `success` | Whether this attempt fully succeeded. |
| `statement_log` | JSON array of `{sql, status: success\|failed\|not_attempted, error?}`, one entry per SQL statement in this direction — a per-statement trace of exactly how far a failed migration got. |

"Currently applied" state is *derived* from this log, not read off a single column: for each distinct `migration_timestamp`, only its most recent **successful** row decides anything, and that timestamp counts as applied only if that row's direction is `up`. Failed attempts, in either direction, never move the applied-state pointer — they're purely an audit entry. This matters most for a failed `down`: on a platform with transactional DDL, a failed rollback leaves the real schema still migrated *up*, and the ledger has to agree, rather than reporting the migration as reverted just because a `down` row happens to be the newest one.

The ledger insert always goes through its own dedicated connection, separate from whatever connection ran the migration's DDL. On a transactional-DDL platform the DDL runs in a transaction that rolls back as a whole on failure — if the ledger write shared that transaction, a failed attempt's own audit row would vanish along with the rollback, defeating the point of recording it. A fresh connection commits the ledger row immediately regardless of what happens to the DDL transaction.

## Data migrations

`getUpSQL()`/`getDownSQL()` cover structural changes. For data that needs to move alongside a structure change, a migration class also gets `preUp()`/`postUp()` and `preDown()`/`postDown()` hooks, each receiving a `PropulsionMigrationManager` instance you can pull a raw PDO connection from:

```php
<?php
class PropulsionMigration_1751586400
{
    public function preUp($manager)
    {
        // return false here to abort the migration before it runs
    }

    public function getUpSQL()
    {
        return ['bookstore' => 'ALTER TABLE "book" ADD COLUMN "author_id" INTEGER;'];
    }

    public function postUp($manager)
    {
        $pdo = $manager->getAdapterConnection('bookstore');
        $stmt = $pdo->prepare("INSERT INTO author (first_name, last_name) VALUES ('Leo', 'Tolstoy')");
        $stmt->execute();
    }
}
```

To use generated Object Model/Query classes instead of raw SQL inside a migration, boot Propulsion the same way your application does — the migration class itself doesn't know where your runtime classes are:

```php
<?php
require '/path/to/vendor/autoload.php';

use Propulsion\Propulsion;

Propulsion::init('/path/to/generated-conf/bookstore-conf.php');

class PropulsionMigration_1751586400
{
    public function postUp($manager)
    {
        $author = new Author();
        $author->setFirstName('Leo');
        $author->setLastName('Tolstoy');
        $author->save();
    }

    public function getUpSQL()
    {
        // ...
    }
}
```

See [Configuration](/propulsion/basics/configuration/) for the runtime config file `Propulsion::init()` expects.
