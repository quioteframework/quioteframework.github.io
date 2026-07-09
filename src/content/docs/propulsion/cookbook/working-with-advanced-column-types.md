---
title: Working with Advanced Column Types
description: blob, enum, object, and array columns, and how their generated accessors behave.
---

Propulsion offers a set of advanced column types, implemented database-agnostically so they work the same way across every supported RDBMS.

## `blob` columns

Propulsion stores *Binary Large Objects* (BLOBs) internally as PHP streams. This mirrors PDO's own convention of using streams when returning LOB columns in a result set and when binding values to prepared statements. If a PDO driver returns the raw string contents instead of a stream, Propulsion wraps it in a `php://memory` stream, giving you a consistent API regardless of driver.

Note that CLOBs (*Character* Locator Objects) are treated as plain strings, since there's no equivalent PDO convention for treating them as streams.

### Getting `blob` values

Blob values are returned as PHP stream resources from the generated accessor methods. If the value is `NULL` in the database, the accessor returns PHP `null`.

```php
<?php
$media = MediaQuery::create()->findPk(1);
$fp = $media->getCoverImage();
if ($fp !== null) {
    echo stream_get_contents($fp);
}
```

### Setting `blob` values

When setting a blob column, you can pass either a stream or the raw blob contents:

```php
<?php
// Setting using a stream
$fp = fopen('/path/to/file.ext', 'rb');
$media = new Media();
$media->setCoverImage($fp);

// Setting using file contents
$media = new Media();
$media->setCoverImage(file_get_contents('/path/to/file.ext'));
```

Regardless of which form you use to set it, the blob is always represented internally as a stream resource — subsequent calls to the accessor return a stream:

```php
<?php
$media = new Media();
$media->setCoverImage(file_get_contents('/path/to/file.ext'));

$fp = $media->getCoverImage();
echo gettype($fp); // "resource"
```

### Setting `blob` columns and `isModified()`

Because a stream's contents can be modified externally, mutator methods for blob columns always mark the object as modified — even if the stream passed in has the same identity as the stream previously returned:

```php
<?php
$media = MediaQuery::create()->findPk(1);
$fp = $media->getCoverImage();
$media->setCoverImage($fp);

var_export($media->isModified()); // true
```

## `enum` columns

Enum columns are stored in the database as integers but let you manipulate a set of predefined string values without worrying about storage details.

```xml
<table name="book">
  <!-- ... -->
  <column name="style" type="enum" valueSet="novel, essay, poetry" />
</table>
```

```php
<?php
// The Active Record setter/getter accept and return any value from the valueSet
$book = new Book();
$book->setStyle('novel');
echo $book->getStyle(); // novel
// Setting a value not in the valueSet throws an exception

// Enum columns are searchable via the generated filterByXXX() method,
// or other ModelCriteria methods (where(), condition())
$books = BookQuery::create()
    ->filterByStyle('novel')
    ->find();
```

## `object` columns

The `object` column type stores PHP objects in the database. The generated setter serializes the object, storing it as a string; the generated getter unserializes the string back into an object. For the end user, the column behaves as if it simply contained the object.

### Getting and setting `object` values

```php
<?php
class GeographicCoordinates
{
    public function __construct(
        public float $latitude,
        public float $longitude,
    ) {
    }

    public function isInNorthernHemisphere(): bool
    {
        return $this->latitude > 0;
    }
}

// The 'house' table has a 'coordinates' column of type object
$house = new House();
$house->setCoordinates(new GeographicCoordinates(48.8527, 2.3510));
echo $house->getCoordinates()->isInNorthernHemisphere(); // true
$house->save();
```

### Retrieving records based on `object` values

`object` columns are also searchable using the generated `filterByXXX()` method on the query class:

```php
<?php
$house = HouseQuery::create()
    ->filterByCoordinates(new GeographicCoordinates(48.8527, 2.3510))
    ->find();
```

Propulsion looks in the database for a serialized version of the object passed as the `filterByXXX()` argument.

## `array` columns

An `array` column stores a simple PHP array in the database — nested arrays and associative arrays aren't accepted. The generated setter serializes the array to a string; the generated getter unserializes it back into an array.

### Getting and setting `array` values

```php
<?php
// The 'book' table has a 'tags' column of type array
$book = new Book();
$book->setTags(['novel', 'russian']);
print_r($book->getTags()); // ['novel', 'russian']

// If the column name is plural, Propulsion also generates hasXXX(), addXXX(),
// and removeXXX() methods, where XXX is the singular column name
echo $book->hasTag('novel'); // true
$book->addTag('romantic');
print_r($book->getTags()); // ['novel', 'russian', 'romantic']
$book->removeTag('russian');
print_r($book->getTags()); // ['novel', 'romantic']
```

### Retrieving records based on `array` values

Propulsion doesn't use `serialize()` for array columns — it uses a special serialization format that makes searching by value possible:

```php
<?php
// Search books that contain all the specified tags
$books = BookQuery::create()
    ->filterByTags(['novel', 'russian'], Criteria::CONTAINS_ALL)
    ->find();

// Search books that contain at least one of the specified tags
$books = BookQuery::create()
    ->filterByTags(['novel', 'russian'], Criteria::CONTAINS_SOME)
    ->find();

// Search books that don't contain any of the specified tags
$books = BookQuery::create()
    ->filterByTags(['novel', 'russian'], Criteria::CONTAINS_NONE)
    ->find();

// If the column name is plural, Propulsion also generates a singular filter
// method expecting a scalar parameter instead of an array
$books = BookQuery::create()
    ->filterByTag('russian')
    ->find();
```

:::tip
Filters on `array` columns translate to `LIKE` conditions in SQL, so the resulting query often requires a full table scan — not well suited to large tables.
:::

:::caution
Only generated Query classes (via `filterByXXX()`) and `ModelCriteria` (via `where()` and `condition()`) support conditions on `enum`, `object`, and `array` columns. Plain `Criteria` (via `add()`, `addAnd()`, `addOr()`) does not.
:::
