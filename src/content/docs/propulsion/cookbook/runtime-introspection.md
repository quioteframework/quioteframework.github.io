---
title: Model Introspection At Runtime
description: Inspect tables, columns, and relations at runtime through the generated TableMap, ColumnMap, and RelationMap classes.
---

Besides the Object Model classes used for CRUD operations, Propulsion generates an object mapping for your tables that supports runtime introspection. These introspection objects are instances of the map classes — Propulsion maps databases, tables, columns, and relations into objects you can query at runtime.

## Retrieving a TableMap

The starting point for runtime introspection is usually a table map — an object that carries every property of a table as defined in `schema.xml`, made accessible at runtime.

Retrieve the table map for a table using the `getTableMap()` static method of the related `Peer` class. For instance, to retrieve the table map for the `book` table:

```php
<?php
$bookTable = BookPeer::getTableMap();
```

## TableMap properties

A `TableMap` object carries the same information as the schema. Reading a table's general properties from its map looks like this:

```php
<?php
echo $bookTable->getName();          // 'book'
echo $bookTable->getPhpName();       // 'Book'
echo $bookTable->getPackage();       // 'bookstore'
echo $bookTable->isUseIdGenerator(); // true
```

:::tip
A `TableMap` also references the `DatabaseMap` that contains it. From the database map you can retrieve other table maps by table name or phpName:

```php
<?php
$dbMap = $bookTable->getDatabaseMap();
$authorTable = $dbMap->getTable('author');
$authorTable = $dbMap->getTableByPhpName('Author');
```
:::

To introspect a table's columns, use any of `getColumns()`, `getPrimaryKeys()`, or `getForeignKeys()` — all return an array of `ColumnMap` objects.

```php
<?php
$bookColumns = $bookTable->getColumns();
foreach ($bookColumns as $column) {
    echo $column->getName();
}
```

If you already know a column name, retrieve its `ColumnMap` directly with `getColumn($name)`:

```php
<?php
$bookTitleColumn = $bookTable->getColumn('title');
```

The `DatabaseMap` object offers a shortcut to any `ColumnMap` if you know the fully qualified column name:

```php
<?php
$bookTitleColumn = $dbMap->getColumn('book.TITLE');
```

## ColumnMaps

A `ColumnMap` instance exposes a lot of information about a table column:

```php
<?php
$bookTitleColumn->getTableName();    // 'book'
$bookTitleColumn->getTablePhpName(); // 'Book'
$bookTitleColumn->getType();         // 'VARCHAR'
$bookTitleColumn->getSize();         // 255
$bookTitleColumn->getDefaultValue(); // null
$bookTitleColumn->isLob();           // false
$bookTitleColumn->isTemporal();      // false
$bookTitleColumn->isEpochTemporal(); // false
$bookTitleColumn->isNumeric();       // false
$bookTitleColumn->isText();          // true
$bookTitleColumn->isPrimaryKey();    // false
$bookTitleColumn->isForeignKey();    // false
$bookTitleColumn->isPrimaryString(); // true
```

`ColumnMap` objects also keep a reference back to their parent `TableMap`:

```php
<?php
$bookTable = $bookTitleColumn->getTable();
```

Foreign key columns expose more information, including the related table and column:

```php
<?php
$bookPublisherIdColumn = $bookTable->getColumn('publisher_id');
echo $bookPublisherIdColumn->isForeignKey();         // true
echo $bookPublisherIdColumn->getRelatedName();       // 'publisher.ID'
echo $bookPublisherIdColumn->getRelatedTableName();  // 'publisher'
echo $bookPublisherIdColumn->getRelatedColumnName(); // 'ID'
$publisherTable    = $bookPublisherIdColumn->getRelatedTable();
$publisherRelation = $bookPublisherIdColumn->getRelation();
```

## RelationMaps

To inspect all of a table's relationships — including ones whose foreign key lives on another table — use its `RelationMap` objects.

If you know the relation's name, retrieve it with `TableMap::getRelation($relationName)`. The relation name is the phpName of the related table, unless the foreign key defines its own `phpName` in the schema. For instance, the `RelationMap` for the `book.publisher_id` column is named `Publisher`:

```php
<?php
$publisherRelation = $bookTable->getRelation('Publisher');
```

Alternatively, reach a `RelationMap` from a foreign key column via `ColumnMap::getRelation()`:

```php
<?php
$publisherRelation = $bookTable->getColumn('publisher_id')->getRelation();
```

Once you have a `RelationMap`, inspect its properties:

```php
<?php
echo $publisherRelation->getType();     // RelationMap::MANY_TO_ONE
echo $publisherRelation->getOnDelete(); // 'SET NULL'
$bookTable      = $publisherRelation->getLocalTable();
$publisherTable = $publisherRelation->getForeignTable();
print_r($publisherRelation->getColumnMappings());
    // ['book.PUBLISHER_ID' => 'publisher.ID']
print_r($publisherRelation->getLocalColumns());
    // [$bookPublisherIdColumn]
print_r($publisherRelation->getForeignColumns());
    // [$publisherBookIdColumn]
```

This works the same way for relationships pointing back at the current table:

```php
<?php
$reviewRelation = $bookTable->getRelation('Review');
echo $reviewRelation->getType();     // RelationMap::ONE_TO_MANY
echo $reviewRelation->getOnDelete(); // 'CASCADE'
$reviewTable = $reviewRelation->getLocalTable();
$bookTable   = $reviewRelation->getForeignTable();
print_r($reviewRelation->getColumnMappings());
    // ['review.BOOK_ID' => 'book.ID']
```

To retrieve every relation on a table, call `TableMap::getRelations()` and iterate over the resulting array of `RelationMap` objects.

:::tip
`RelationMap` objects are lazy-loaded — a `TableMap` doesn't instantiate any relation object until `getRelations()` is called, keeping the `TableMap` lightweight when relationship introspection isn't needed.
:::
