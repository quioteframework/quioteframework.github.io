---
title: Replication
description: Split read and write traffic across master and slave connections.
---

Propulsion can be used in a master-slave replication environment. These setups improve web application performance by spreading database load across multiple database servers: a single master database handles all write queries, while one or more slave databases handle read queries. Slaves are kept in sync with the master through the database engine's own replication mechanism (a binary log, in MySQL's case).

## Configuring Propulsion for replication

* Set up a replication environment at the database level (see [Databases](#databases) below).
* Add a `slaves` section to the relevant datasource in your runtime configuration file (the `<project>-conf.php` file Propulsion loads at startup), next to its `connection` section.
* Verify the setup by checking the master's query log — it should stop receiving `SELECT ...` statements once reads are routed to slaves.

The `slaves` section lives inside a datasource, alongside its master `connection` section, and holds a nested `connection` entry — or, for several slaves, an array of them. The following example configures "localhost" as the master, with "slave-server1" and "slave-server2" as slaves:

```php
<?php
// bookstore-conf.php
return [
    'datasources' => [
        'default'   => 'bookstore',
        'bookstore' => [
            'adapter' => 'mysql',
            'connection' => [
                'dsn'      => 'mysql:host=localhost;dbname=bookstore',
                'user'     => 'my_db_user',
                'password' => 's3cr3t',
            ],
            'slaves' => [
                'connection' => [
                    ['dsn' => 'mysql:host=slave-server1;dbname=bookstore', 'user' => 'my_db_user', 'password' => 's3cr3t'],
                    ['dsn' => 'mysql:host=slave-server2;dbname=bookstore', 'user' => 'my_db_user', 'password' => 's3cr3t'],
                ],
            ],
        ],
    ],
];
```

The optional `classname` connection setting lets you swap in your own PDO subclass; when omitted, Propulsion defaults to its own `PropulsionPDO` class.

## Implementation

Replication is implemented in Propulsion's connection configuration/initialization code, and in the generated Query (`ModelCriteria`) and Peer classes that call into it.

### `Propulsion::getReadConnection()` and `Propulsion::getWriteConnection()`

When you request a connection through Propulsion, you can ask for a READ connection (a slave) or a WRITE connection (the master). Methods designed to read data, like `ModelCriteria::find()`, always request a READ connection:

```php
<?php
$con = Propulsion::getReadConnection(MyTableMap::DATABASE_NAME);
$books = BookQuery::create()->find($con);
```

Methods designed to write data, like `ModelCriteria::update()` or `ModelCriteria::delete()`, explicitly request a WRITE connection:

```php
<?php
$con = Propulsion::getWriteConnection(MyTableMap::DATABASE_NAME);
BookQuery::create()->deleteAll($con);
```

If you've configured slave connections, Propulsion picks a single random slave per request for READ-mode connections.

Both READ (slave) and WRITE (master) connections are opened only on demand — if every SQL statement in a request is a `SELECT`, Propulsion never opens a connection to the master (unless you've forced master usage; see below).

:::caution
If you execute custom SQL against Propulsion-managed connections and want it to respect your replication setup, request the correct connection explicitly:

```php
<?php
$con = Propulsion::getReadConnection(MyTableMap::DATABASE_NAME);
$stmt = $con->query('SELECT * FROM my');
/* ... */
```
:::

### Forcing the master connection

You can force Propulsion to always return a WRITE (master) connection from `getReadConnection()`, even with slaves configured, by calling `setForceMasterConnection()`:

```php
<?php
Propulsion::setForceMasterConnection(true);
$con = Propulsion::getReadConnection(MyTableMap::DATABASE_NAME);
// $con is a WRITE connection
```

This is useful when you need guaranteed up-to-date data — for example, immediately after a write, before replication has caught up — though the only fully safe way to guarantee data integrity across reads and writes is a transaction.

As of Propulsion's worker-safety rework, this flag actually lives on the per-request `Session` object rather than on the process-wide `ConnectionManager` the way it did in Propel 1 — `Propulsion::setForceMasterConnection()`/`getForceMasterConnection()` are kept as thin proxies to `Propulsion::getSession()->setForceMasterConnection()`/`getForceMasterConnection()` for backwards compatibility, but the important behavioral difference is that the setting is now request-scoped: it's cleared automatically at the worker request boundary and never leaks from one request into the next, which matters once Propulsion is running inside a long-lived FrankenPHP worker rather than a traditional request-per-process setup. Code written against the old `ConnectionManager::setForceMasterConnection()` API from Propel 1 needs updating to call `Propulsion::setForceMasterConnection()` (or `Propulsion::getSession()->setForceMasterConnection()`) instead.

## Databases

Replication itself is a database-server feature Propulsion routes traffic around, not something Propulsion sets up for you. Consult your database's own replication documentation to build the underlying master/slave topology — for example, [MySQL's replication how-to](https://dev.mysql.com/doc/refman/8.0/en/replication-howto.html) or [PostgreSQL's streaming replication documentation](https://www.postgresql.org/docs/current/warm-standby.html#STREAMING-REPLICATION), which is particularly relevant since PostgreSQL is Propulsion's default and best-supported database.
