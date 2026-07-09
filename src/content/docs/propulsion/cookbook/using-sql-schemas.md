---
title: Using SQL Schemas
description: Group tables into database-level schemas on RDBMS that support them, and mirror that grouping in generated PHP code.
---

Some database vendors support "schemas" — namespaces of collections of database objects (tables, views, and so on) within a single database. PostgreSQL and MSSQL, and to a lesser extent MySQL, all provide the ability to group and organize tables into schemas. Propulsion supports tables organized into schemas and works seamlessly in this context. On platforms with no native concept of schemas, such as Oracle and SQLite, the `schema` attribute is ignored for SQL generation purposes.

## Schema definition

### Assigning a table to a schema

In an XML schema, you can assign every table under a `<database>` tag to a given SQL schema by setting the `schema` attribute on the `<database>` tag:

```xml
<database name="bookstore" schema="bookstore">
  <table name="book">
    <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
    <column name="title" type="varchar" required="true" />
  </table>
</database>
```

:::note
On RDBMS that don't support SQL schemas (Oracle, SQLite), the `schema` attribute is ignored.
:::

You can also assign a table to a schema individually, overriding whatever `schema` its parent `<database>` declares:

```xml
<table name="book" schema="bookstore1">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" />
</table>
```

### Foreign keys between schemas

You can create foreign keys between tables assigned to different schemas by setting the `foreignSchema` attribute on the `<foreign-key>` tag:

```xml
<table name="book" schema="bookstore">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" />
  <column name="author_id" type="integer" />
  <foreign-key foreignTable="author" foreignSchema="people" onDelete="setnull" onUpdate="cascade">
    <reference local="author_id" foreign="id" />
  </foreign-key>
</table>
<table name="author" schema="people">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="name" type="varchar" required="true" />
</table>
```

## Schemas in generated SQL

When generating table-creation SQL, Propulsion adds the schema prefix correctly for the target platform, for example on PostgreSQL:

```sql
CREATE TABLE "bookstore"."book"
(
  "id" SERIAL NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  PRIMARY KEY ("id")
)
```

:::note
On PostgreSQL, Propulsion emits a `CREATE SCHEMA` statement for every distinct schema referenced by the `schema` attribute, so the schema itself doesn't need to already exist — the database user Propulsion connects as does, however, need the privileges to create it. Other platforms may still require the target schema to already exist.
:::

## Schemas in PHP code

Just like table names, SQL schemas don't appear in generated PHP code. For the PHP developer manipulating phpNames, it's as if schemas didn't exist — you can freely write queries spanning several schemas without the schema boundary leaking into method names.

:::note
In MySQL, `SCHEMA` and `DATABASE` are synonyms. The ability to assign a table to a different schema therefore effectively enables cross-database queries on MySQL.
:::

## Using the schema as a base for PHP code organization

Propulsion provides two independent features for organizing generated model classes:

* **Packages** are subdirectories generated Model classes get placed into (see [Multi-component data model](/propulsion/cookbook/multi-component-data-model/)).
* **Namespaces** are actual PHP namespaces for generated Model classes (see [How to use namespaces](/propulsion/cookbook/namespaces/)).

You can tell Propulsion to copy the `schema` attribute onto both the `package` and `namespace` attributes automatically, reproducing your SQL-level organization at the PHP level. Set `autoPackage` and `autoNamespace` under the generator's schema settings in your `build.php`:

```php
<?php
// build.php
return [
    'propulsion.schema.autoPackage'   => true,
    'propulsion.schema.autoNamespace' => true,
];
```

With this configuration, a `book` table assigned to the `bookstore` schema generates a `bookstore\Book` Active Record class under a `bookstore/` subdirectory — the `namespace`/`package` values are copied verbatim from the `schema` attribute, so their casing follows whatever case you used for `schema`.
