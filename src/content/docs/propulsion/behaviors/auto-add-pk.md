---
title: AutoAddPk Behavior
description: Automatically add a primary key column to tables that don't declare one.
---

The `auto_add_pk` behavior adds a primary key column to tables that don't have one. Using this behavior lets you omit the declaration of primary keys in your tables.

## Basic usage

In `schema.xml`, use the `<behavior>` tag to add the `auto_add_pk` behavior to a table:

```xml
<table name="book">
  <column name="title" type="varchar" required="true" primaryString="true" />
  <behavior name="auto_add_pk" />
</table>
```

Rebuild your model, and run the table creation SQL. You'll notice the `book` table has two columns, not just one — the behavior added an `id` column, of type integer and auto-incremented. This column can be used like any other column:

```php
$b = new Book();
$b->setTitle('War And Peace');
$b->save();
echo $b->getId(); // 1
```

This behavior is more powerful applied to the database instead of a single table. That way, it alters every table that doesn't define a primary key column, and leaves the others unchanged:

```xml
<database name="bookstore" defaultIdMethod="native">
  <behavior name="auto_add_pk" />
  <table name="book">
    <column name="title" type="varchar" required="true" primaryString="true" />
  </table>
</database>
```

## Parameters

By default, the behavior adds a column named `id` to the table if the table has no primary key. You can customize all the attributes of the added column by setting corresponding parameters in the behavior definition:

```xml
<database name="bookstore" defaultIdMethod="native">
  <behavior name="auto_add_pk">
    <parameter name="name" value="identifier" />
    <parameter name="autoIncrement" value="false" />
    <parameter name="type" value="bigint" />
  </behavior>
  <table name="book">
    <column name="title" type="varchar" required="true" primaryString="true" />
  </table>
</database>
```

Once you regenerate your model, the column has a different name:

```php
$b = new Book();
$b->setTitle('War And Peace');
$b->setIdentifier(1);
$b->save();
echo $b->getIdentifier(); // 1
```
