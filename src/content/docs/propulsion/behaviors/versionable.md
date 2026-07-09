---
title: Versionable Behavior
description: Track and revert to previous versions of a model object, including related objects.
---

The `versionable` behavior provides versioning capabilities to any ActiveRecord object. Using this behavior, you can:

* Revert an object to a previous version easily.
* Track and browse the history of an object's modifications.
* Keep track of modifications to related objects.

## Basic usage

In `schema.xml`, use the `<behavior>` tag to add the `versionable` behavior to a table:

```xml
<table name="book">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" />
  <behavior name="versionable" />
</table>
```

Rebuild your model, run the table creation SQL again, and you're ready to go. The model now has one new column, `version`, storing the version number. It also has a new table, `book_version`, storing all past and present versions of all `Book` objects. You won't need to interact with this second table directly — the behavior offers an easy-to-use API that handles all versioning actions from the main ActiveRecord object.

```php
$book = new Book();

// automatic version increment
$book->setTitle('War and Peas');
$book->save();
echo $book->getVersion(); // 1
$book->setTitle('War and Peace');
$book->save();
echo $book->getVersion(); // 2

// reverting to a previous version
$book->toVersion(1);
echo $book->getTitle(); // 'War and Peas'
// saving a previous version creates a new one
$book->save();
echo $book->getVersion(); // 3

// checking differences between versions
print_r($book->compareVersions(1, 2));
// array(
//   'Title' => array(1 => 'War and Peas', 2 => 'War and Peace'),
// );

// deleting an object also deletes all its versions
$book->delete();
```

## Adding details about each revision

For future reference, you probably need to record who edited an object, as well as when and why. To enable audit log capabilities, add the following three parameters to the `<behavior>` tag:

```xml
<table name="book">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" />
  <behavior name="versionable">
    <parameter name="log_created_at" value="true" />
    <parameter name="log_created_by" value="true" />
    <parameter name="log_comment" value="true" />
  </behavior>
</table>
```

Rebuild your model, and you can now define an author name and a comment for each revision using `setVersionCreatedBy()` and `setVersionComment()`:

```php
$book = new Book();
$book->setTitle('War and Peas');
$book->setVersionCreatedBy('John Doe');
$book->setVersionComment('Book creation');
$book->save();

$book->setTitle('War and Peace');
$book->setVersionCreatedBy('John Doe');
$book->setVersionComment('Corrected typo on book title');
$book->save();
```

## Retrieving revision history

```php
// details about each revision are available for all versions of an object
$book->toVersion(1);
echo $book->getVersionCreatedBy();  // 'John Doe'
echo $book->getVersionComment();    // 'Book creation'
// the behavior also logs the creation date for all versions
echo $book->getVersionCreatedAt();  // '2010-12-21 22:57:19'

// to list revision details, prefer the version object over the main object --
// the following requires only one database query
foreach ($book->getAllVersions() as $bookVersion) {
    echo sprintf(
        "'%s', Version %d, updated by %s on %s (%s)\n",
        $bookVersion->getTitle(),
        $bookVersion->getVersion(),
        $bookVersion->getVersionCreatedBy(),
        $bookVersion->getVersionCreatedAt(),
        $bookVersion->getVersionComment(),
    );
}
// 'War and Peas', Version 1, updated by John Doe on 2010-12-21 22:53:02 (Book creation)
// 'War and Peace', Version 2, updated by John Doe on 2010-12-21 22:57:19 (Corrected typo on book title)
```

## Conditional versioning

You may not need a new version every time an object is created or modified. To specify your own condition, override `isVersioningNecessary()` in your stub class. The behavior calls it behind the scenes each time you `save()` the main object; no version is created if it returns `false`.

```php
class Book extends BaseBook
{
    public function isVersioningNecessary(): bool
    {
        return $this->getIsbn() !== null && parent::isVersioningNecessary();
    }
}

$book = new Book();
$book->setTitle('Pride and Prejudice');
$book->save(); // book is saved, no new version is created
$book->setIsbn('0553213105');
$book->save(); // book is saved, and a new version is created
```

Alternatively, disable automatic version creation on every save, for all objects of a given model, by calling `disableVersioning()` on the peer class. You still have the ability to manually create a new version of an object using `addVersion()` on a saved object:

```php
BookPeer::disableVersioning();
$book = new Book();
$book->setTitle('Pride and Prejudice');
$book->setVersion(1);
$book->save();       // book is saved, no new version is created
$book->addVersion(); // a new version is created

// you can re-enable versioning using the peer static method enableVersioning()
BookPeer::enableVersioning();
```

## Versioning related objects

If a model uses the versionable behavior and is related to another model that also uses it, each object automatically keeps track of modifications to related objects. Calling `toVersion()` restores the state of the main object *and* the related objects.

The following example assumes both the `Book` and `Author` models are versionable, and one `Author` has many `Book`s:

```php
$author = new Author();
$author->setFirstName('Leo');
$author->setLastName('Totoi');
$book = new Book();
$book->setTitle('War and Peas');
$book->setAuthor($author);
$book->save(); // version 1

$book->setTitle('War and Peace');
$book->save(); // version 2

$author->setLastName('Tolstoi');
$book->save(); // version 3

$book->toVersion(1);
echo $book->getTitle();               // 'War and Peas'
echo $book->getAuthor()->getLastName(); // 'Totoi'
$book->toVersion(3);
echo $book->getTitle();               // 'War and Peace'
echo $book->getAuthor()->getLastName(); // 'Tolstoi'
```

:::note
Versioning of related objects is only possible for simple foreign keys. Relationships based on composite foreign keys can't preserve relation versioning for now.
:::

## Parameters

You can change the name of the column added by the behavior with the `version_column` parameter. Propulsion only adds the column if it isn't already present, so you can customize it by adding it manually to your schema:

```xml
<table name="book">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" />
  <column name="my_version_column" type="bigint" description="Version column" />
  <behavior name="versionable">
    <parameter name="version_column" value="my_version_column" />
  </behavior>
</table>
```

```php
$b = new Book();
$b->setTitle('War And Peace');
$b->save();
echo $b->getMyVersionColumn(); // 1
// for convenience and ease of use, Propulsion generates a getVersion() alias anyway
echo $b->getVersion(); // 1
```

You can also change the name of the version table using the `version_table` parameter. Propulsion automatically creates the table, unless it's already present in the schema:

```xml
<table name="book">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" />
  <behavior name="versionable">
    <parameter name="version_table" value="my_book_version" />
  </behavior>
</table>
```

The audit log abilities need to be enabled in the schema as well:

```xml
<table name="book">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" />
  <behavior name="versionable">
    <!-- Log the version creation date -->
    <parameter name="log_created_at" value="true" />
    <!-- Log the version creator name, using setVersionCreatedBy() -->
    <parameter name="log_created_by" value="true" />
    <!-- Log the version comment, using setVersionComment() -->
    <parameter name="log_comment" value="true" />
  </behavior>
</table>
```

Sometimes it's necessary to have indexes from the origin table also present in the version table, e.g. to run queries against it. Fully describe `<tableName>_version` in your schema with all its necessary indexes, so the behavior won't overwrite/re-add it:

```xml
<table name="book">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" />
  <index>
    <index-column name="title" />
  </index>
  <behavior name="versionable" />
</table>
```

## Public API

### ActiveRecord class

* `void save()`: Adds a new version to the object's version history and increments the `version` property.
* `void delete()`: Deletes the object's version history.
* `bool isVersioningNecessary(?PropulsionPDO $con = null)`: Checks whether a new version needs to be saved.
* `BaseObject toVersion(int $versionNumber)`: Populates the properties of the current object with values from the requested version. Saving the object afterwards creates a new version (rather than updating the previous one).
* `int getLastVersionNumber(PropulsionPDO $con)`: Queries the database for the highest version number recorded for this object.
* `bool isLastVersion()`: Returns `true` if the current object is the latest available version.
* `Version addVersion(PropulsionPDO $con)`: Creates a new `Version` record and saves it — used when `isVersioningNecessary()` is `false`. Doesn't increment the main object's version number, and the main object must be saved prior to calling this method.
* `PropulsionObjectCollection getAllVersions(PropulsionPDO $con)`: Returns all `Version` objects related to the main object, in a collection.
* `Version getOneVersion(int $versionNumber, PropulsionPDO $con)`: Returns a given version object.
* `array compareVersions(int $version1, int $version2)`: Returns an array of differences showing which parts of a resource changed between two versions.
* `BaseObject populateFromVersion(Version $version, PropulsionPDO $con)`: Populates an ActiveRecord object based on a `Version` object.
* `BaseObject setVersionCreatedBy(string $createdBy)`: Defines the author name for the revision.
* `string getVersionCreatedBy()`: Gets the author name for the revision.
* `mixed getVersionCreatedAt()`: Gets the creation date for the revision (set automatically by the behavior).
* `BaseObject setVersionComment(string $comment)`: Defines the comment for the revision.
* `string getVersionComment()`: Gets the comment for the revision.

### Peer static methods

* `void enableVersioning()`: Enables versioning for all instances of the related ActiveRecord class.
* `void disableVersioning()`: Disables versioning for all instances of the related ActiveRecord class.
* `bool isVersioningEnabled()`: Checks whether versioning is enabled.
