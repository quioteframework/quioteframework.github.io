---
title: Building your schema
description: Describing a data model in XML and generating Object Model and Query classes with bin/propulsion.
---

The first step in every Propulsion project is the "build". You describe the structure of your data model in an XML file called the schema, and Propulsion generates PHP classes — "model classes" — from it. These generated classes are the primary interface for finding and manipulating data; you don't hand-write SQL for everyday queries.

The same schema can also generate the SQL DDL to set up your database, or be generated in reverse from an existing database with `schema:reverse`.

To illustrate this, this page uses the classic Propel bookstore example: a `book` table with foreign keys to `author` and `publisher`.

## Describing your database as an XML schema

### The `<database>` root tag

Create a `schema.xml` file in your project. Its root tag is `<database>`:

```xml title="schema.xml"
<?xml version="1.0" encoding="UTF-8"?>
<database name="bookstore" defaultIdMethod="native">
  <!-- table definitions go here -->
</database>
```

The `name` attribute names the connection Propulsion uses for the tables in this schema — it doesn't have to match the real database name; `propulsion.database`/connection settings in your build config map a connection name to the actual DSN. `defaultIdMethod="native"` tells Propulsion that tables in this schema use the database's own auto-increment/sequence mechanism for columns marked `autoIncrement`.

:::note
You can split a project across several schema files — just make sure each filename ends in `schema.xml`. `model:build` and `sql:build` both accept a directory and pick up every matching file in it.
:::

### Tables and columns

Each `<table>` tag describes one real table:

```xml title="schema.xml"
<?xml version="1.0" encoding="UTF-8"?>
<database name="bookstore" defaultIdMethod="native">
  <table name="book" phpName="Book">
    <column name="id" type="integer" required="true" primaryKey="true" autoIncrement="true"/>
    <column name="title" type="varchar" size="255" required="true"/>
    <column name="isbn" type="varchar" size="24" required="true" phpName="ISBN"/>
    <column name="publisher_id" type="integer" required="true"/>
    <column name="author_id" type="integer" required="true"/>
  </table>
  <table name="author" phpName="Author">
    <column name="id" type="integer" required="true" primaryKey="true" autoIncrement="true"/>
    <column name="first_name" type="varchar" size="128" required="true"/>
    <column name="last_name" type="varchar" size="128" required="true"/>
  </table>
  <table name="publisher" phpName="Publisher">
    <column name="id" type="integer" required="true" primaryKey="true" autoIncrement="true"/>
    <column name="name" type="varchar" size="128" required="true"/>
  </table>
</database>
```

`name` is the real column/table name; `phpName` is the name used for the generated PHP class or property. By default Propulsion CamelCases `name` to derive `phpName`, so you can omit it when the default is already what you want — `book` becomes `Book`, `first_name` becomes `FirstName`, and so on.

Every column needs a `type`. The schema's type system is database-agnostic — Propulsion maps each type onto the equivalent SQL type for whichever platform you target with `--database`/`propulsion.database`. `required`, `primaryKey`, and `autoIncrement` mean exactly what they say.

:::tip
A `namespace` attribute on a `<table>` puts that table's generated classes in the given PHP namespace.
:::

### Foreign keys

A `<foreign-key>` tag describes a relationship to another table, with one or more `<reference>` mappings between local and foreign columns:

```xml title="schema.xml"
<table name="book" phpName="Book">
  <column name="id" type="integer" required="true" primaryKey="true" autoIncrement="true"/>
  <column name="title" type="varchar" size="255" required="true"/>
  <column name="isbn" type="varchar" size="24" required="true" phpName="ISBN"/>
  <column name="publisher_id" type="integer" required="true"/>
  <column name="author_id" type="integer" required="true"/>
  <foreign-key foreignTable="publisher" phpName="Publisher" refPhpName="Book">
    <reference local="publisher_id" foreign="id"/>
  </foreign-key>
  <foreign-key foreignTable="author">
    <reference local="author_id" foreign="id"/>
  </foreign-key>
</table>
```

A relationship has its own `phpName`, defaulting to the foreign table's `phpName` (so `Book::getPublisher()`); `refPhpName` names the reverse relation as seen from the foreign table (so `Publisher::getBook()`/a `BookQuery` accessible from `Publisher`). See [Relationships](/propulsion/basics/relationships/) for how these surface on the generated classes.

This is only the core of the schema syntax — there's much more available (behaviors, inheritance, indexes, validators, and so on) that this getting-started section doesn't cover.

## Configuring the build

The build needs to know which database platform to target. Propulsion reads a flat `propulsion.*` property space, merged from `generator/default.php` (Propulsion's own shipped defaults) and your own overrides.

The modern way to override it is a `build.php` file — a plain PHP file returning an array — passed with `--config` (repeatable):

```php title="build.php"
<?php

return [
    'propulsion.database' => 'pgsql',
];
```

```bash
vendor/bin/propulsion model:build --config=build.php
```

A legacy `build.properties` text file (Propel 1's original format) still works exactly the same way, if you're bringing one over from an existing project. Either format resolves `${propulsion.some.key}` placeholders against the same fully-merged flat array.

You don't need a config file at all for a quick, one-off build — `--database` overrides `propulsion.database` directly on the command line:

```bash
vendor/bin/propulsion model:build --database=pgsql
```

`propulsion.database` defaults to `pgsql` — PostgreSQL is Propulsion's recommended and best-supported target. `mysql`, `sqlite`, `oracle`, and `mssql` are all also supported, selected the same way.

## Generating the model classes

With `schema.xml` and (optionally) a config file in place, generate the PHP classes:

```bash
vendor/bin/propulsion model:build schema.xml --output-dir=src/Model --database=pgsql
```

By default, `model:build` looks for schema files in `./schema` and writes into `./generated-classes`; both are overridable via the `schema` argument and `--output-dir`. For every table, Propulsion generates:

- a **model** class (e.g. `Book`), representing a single row — this is where you add your own methods;
- a **query** class (e.g. `BookQuery`), used to retrieve and update rows;
- a **base** class for each of the above (`BaseBook`, `BaseBookQuery`), holding all the generated logic.

The model and query classes are empty *stub* classes that extend their `Base` counterparts:

```php
<?php

/**
 * Skeleton subclass for representing a row from the 'book' table.
 */
class Book extends BaseBook
{
}
```

Stub classes are generated only once and are yours to edit freely. The `Base` classes are regenerated — and overwritten — every time you run `model:build`, so never add your own code there; it will be lost the next time the schema changes.

After generating, autoload the classes — with Composer's classmap, for example:

```json
{
    "autoload": {
        "classmap": ["src/Model/"]
    }
}
```

```bash
composer dump-autoload
```

## Building and running the SQL

Generate the SQL DDL for your schema:

```bash
vendor/bin/propulsion sql:build schema.xml --database=pgsql
```

This writes `.sql` files into `generated-sql/` by default (`--output-dir` to change it) — useful to keep under version control so you can diff schema changes over time. Then execute it against a live database:

```bash
vendor/bin/propulsion sql:exec generated-sql/bookstore.sql \
    --dsn="pgsql:host=localhost;dbname=bookstore" \
    --user=me --password=secret
```

`sql:exec` runs the given `.sql` files, in order, over a single PDO connection. When your schema changes later, run `sql:build` and `sql:exec` again — or, for an existing database you don't want to drop and recreate, use `sql:diff` to generate a migration instead.

## Next steps

With generated classes in place and your tables created, move on to [Basic CRUD](/propulsion/getting-started/basic-crud/) to start creating, reading, updating, and deleting rows through them.
