---
title: Archivable Behavior
description: Copy model objects to an archive table on insert, update, or delete — Propulsion's soft-delete implementation.
---

The `archivable` behavior gives model objects the ability to be copied to an archive table. By default, the behavior archives objects on deletion, which makes it Propulsion's implementation of the "soft delete" pattern.

## List of parameters

Adjust the behavior by adding parameters:

```xml
<behavior name="archivable">
  <parameter name="archive_table" value="special_book_archive" />
  <parameter name="log_archived_at" value="true" />
  <parameter name="archived_at_column" value="archival_date" />
</behavior>
```

These parameters are available:

| Parameter | Value | Description | Default |
|---|---|---|---|
| `archive_table` | literal | Name of the table storing archive data. Created if it doesn't exist. Cannot be combined with `archive_class`. | Original table name with suffix `_archive` |
| `archive_class` | literal | Name of an existing model class. The underlying table is used to store the archive. Cannot be combined with `archive_table`. | none |
| `log_archived_at` | `true`/`false` | Enables or disables the additional archival timestamp column. | `true` |
| `archived_at_column` | literal | Sets the name of the column storing the archival datetime. | `archived_at` |
| `archive_on_insert` | `true`/`false` | Archive row data on insert. | `false` |
| `archive_on_update` | `true`/`false` | Archive row data on update. | `false` |
| `archive_on_delete` | `true`/`false` | Archive row data on delete. | `true` |

## Basic usage

In `schema.xml`, use the `<behavior>` tag to add the `archivable` behavior to a table:

```xml
<table name="book">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" primaryString="true" />
  <behavior name="archivable" />
</table>
```

Rebuild your model, run the table creation SQL again, and you're ready to go. The model now has one new table, `book_archive`, with the same columns as the original `book` table. This table stores the archived books together with their archive date. To archive an object, call the `archive()` method:

```php
$book = new Book();
$book->setTitle('War And Peace');
$book->save();
// copy the current Book to a BookArchive object and save it
$archivedBook = $book->archive();
```

The archive table contains only the freshest copy of each archived object. Archiving an object twice doesn't create a new record in the archive table — it updates the existing archive.

The `book_archive` table has generated ActiveRecord and ActiveQuery classes, so you can browse the archive at will. Archived objects share the same primary key as the original objects, and additionally have an `ArchivedAt` property storing the date the object was archived:

```php
// find the archived book
$archivedBook = BookArchiveQuery::create()->findPk($book->getId());
echo $archivedBook->getTitle(); // 'War And Peace'
echo $archivedBook->getArchivedAt(); // 2011-08-23 18:14:23
```

The ActiveRecord class of an `archivable` model has more methods to deal with the archive:

```php
// restore an object to the state it had when last archived
$book->restoreFromArchive();
// find the archived version of an existing book
$archivedBook = $book->getArchive();
// populate a book based on an archive
$book = new Book();
$book->populateFromArchive($archivedBook);
```

By default, an `archivable` model is archived just before deletion:

```php
$book = new Book();
$book->setTitle('Sense and Sensibility');
$book->save();
// delete and archive the book
$book->delete();
echo BookQuery::create()->count(); // 0
// find the archived book
$archivedBook = BookArchiveQuery::create()
    ->findOneByTitle('Sense and Sensibility');
```

:::note
The behavior does not take care of archiving related objects. This may be surprising on deletions if the deleted object has `ON DELETE CASCADE` foreign keys. If you want to archive relations, override the generated `archive()` method in the ActiveRecord class with your own logic.
:::

To recover deleted objects, use `populateFromArchive()` on a new object and save it:

```php
// create a new object based on the archive
$book = new Book();
$book->populateFromArchive($archivedBook);
$book->save();
echo $book->getTitle(); // 'Sense and Sensibility'
```

If you want to delete an `archivable` object without archiving it, use the generated `deleteWithoutArchive()` method:

```php
// delete the book but don't archive it
$book->deleteWithoutArchive();
```

## Archiving a set of objects

The `archivable` behavior also generates an `archive()` method on the generated ActiveQuery class. That means you can easily archive a set of objects, the same way you archive a single object:

```php
// archive all books with a title starting with "war"
$nbArchivedObjects = BookQuery::create()
    ->filterByTitle('War%')
    ->archive();
```

`archive()` returns the number of archived objects, not the current ActiveQuery object, so it's a termination method.

:::note
Since `archive()` doesn't duplicate archived objects, it must iterate over the results of the query to check whether each object has already been archived. In practice, `archive()` issues `2n+1` database queries, where `n` is the number of results of the query as returned by `count()`.
:::

As explained earlier, an `archivable` model is archived just before deletion by default. This is also true when using the ActiveQuery class's `delete()` and `deleteAll()` methods:

```php
// delete and archive all books with a title starting with "war"
$nbDeletedObjects = BookQuery::create()
    ->filterByTitle('War%')
    ->delete();

// use deleteWithoutArchive() if you just want to delete
$nbDeletedObjects = BookQuery::create()
    ->filterByTitle('War%')
    ->deleteWithoutArchive();

// you can also turn off the query alteration on the current query
// by calling setArchiveOnDelete(false) before deleting
$nbDeletedObjects = BookQuery::create()
    ->filterByTitle('War%')
    ->setArchiveOnDelete(false)
    ->delete();
```

## Archiving on insert, update, or delete

As explained earlier, the `archivable` behavior archives objects on deletion by default, but insertions and updates don't trigger `archive()`. You can disable auto-archiving on deletion, and enable it for insertion and update, via the behavior's `<parameter>` tags. Here is the default configuration:

```xml
<table name="book">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" primaryString="true" />
  <behavior name="archivable">
    <parameter name="archive_on_insert" value="false" />
    <parameter name="archive_on_update" value="false" />
    <parameter name="archive_on_delete" value="true" />
  </behavior>
</table>
```

If you turn on `archive_on_insert`, calling `save()` on a new ActiveRecord object archives it — unless you call `saveWithoutArchive()`.

If you turn on `archive_on_update`, calling `save()` on an existing ActiveRecord object archives it, and calling `update()` on an ActiveQuery object archives the results as well. You can still use `saveWithoutArchive()` on the ActiveRecord class and `updateWithoutArchive()` on the ActiveQuery class to skip archiving on updates.

Even if `archive_on_insert` or a similar parameter isn't turned on, you can always archive an object manually after persisting it by simply calling `archive()`:

```php
// create a new object, save it, and archive it
$book = new Book();
$book->save();
$book->archive();
```

## Archiving to another database

The behavior can use another database connection for the archive table, to make it safer. To allow cross-database archives, declare the archive schema manually in another XML schema, and reference the archive class in the behavior parameter:

```xml
<database name="main">
  <table name="book">
    <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
    <column name="title" type="varchar" required="true" primaryString="true" />
    <behavior name="archivable">
      <parameter name="archive_class" value="MyBookArchive" />
    </behavior>
  </table>
</database>
<database name="backup">
  <table name="my_book_archive" phpName="MyBookArchive">
    <column name="id" required="true" primaryKey="true" type="integer" />
    <column name="title" type="varchar" required="true" primaryString="true" />
    <column name="archived_at" type="timestamp" />
  </table>
</database>
```

The archive table must have the same columns as the archivable table, but without auto-increments and without foreign keys.

With this setup, the behavior uses `MyBookArchive` and `MyBookArchiveQuery` for all operations on archives, and therefore uses the `backup` connection.

## Migrating from `soft_delete`

If you use `archivable` as a replacement for the `soft_delete` behavior, here's how to update your code:

```php
// do a soft delete
$book->delete(); // with soft_delete
$book->delete(); // with archivable

// do a hard delete
// with soft_delete
$book->forceDelete();
// with archivable
$book->deleteWithoutArchive();

// find deleted objects
// with soft_delete
$books = BookQuery::create()
    ->includeDeleted()
    ->where('Book.DeletedAt IS NOT NULL')
    ->find();
// with archivable
$bookArchives = BookArchiveQuery::create()
    ->find();

// recover a deleted object
// with soft_delete
$book->unDelete();
// with archivable
$book = new Book();
$book->populateFromArchive($bookArchive);
$book->save();
```
