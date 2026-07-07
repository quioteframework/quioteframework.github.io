---
title: How to Use Namespaces
description: Give generated Object Model and Query classes real PHP namespaces.
---

Generated model classes can use a PHP namespace. This eases management of large database models and lets Propulsion's generated classes integrate cleanly into namespaced PHP applications.

## Namespace declaration and inheritance

To define a namespace for a model class, specify it in the `namespace` attribute of a `<table>` element for a single table, or on the `<database>` element to set the same namespace for every table in it.

Here's an example schema using namespaces:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<database name="bookstore" defaultIdMethod="native" namespace="Bookstore">

  <table name="book">
    <!-- ... -->
  </table>

  <table name="author">
    <!-- ... -->
  </table>

  <table name="publisher" namespace="Book">
    <!-- ... -->
  </table>

  <table name="user" namespace="\Admin">
    <!-- ... -->
  </table>

</database>
```

The `<database>` element defines a `namespace` attribute. The `book` and `author` tables inherit their namespace from the database, so the generated classes for these tables are `\Bookstore\Book` and `\Bookstore\Author`.

The `publisher` table defines its own `namespace` attribute, which *extends* the database namespace — the generated class becomes `\Bookstore\Book\Publisher`.

The `user` table defines an absolute namespace (starting with a backslash), which *overrides* the database namespace entirely — the generated class becomes `\Admin\User`.

:::tip
You can use subnamespaces (namespaces containing backslashes) in the `namespace` attribute.
:::

## Using namespaced models

Namespaced models are autoloaded via Composer just like any other class — alias them with `use`, or reference their fully qualified name:

```php
<?php
// use an alias
use Bookstore\Book;
$book = new Book();

// or use the fully qualified name
$book = new \Bookstore\Book();
```

Relation names Propulsion derives from the schema don't take the namespace into account — related getters and setters make no mention of it:

```php
<?php
$author = new \Bookstore\Author();
$book = new \Bookstore\Book();
$book->setAuthor($author);
$book->save();
```

The namespace applies to both the Active Record class and its Query class. Just remember that relation names in a query never include the namespace:

```php
<?php
$author = \Bookstore\AuthorQuery::create()
    ->withBookQuery(fn ($book) => $book->filterByPrice(['max' => 10]))
    ->findOne();
```

Related tables can live in different namespaces without interfering with the object model's functionality:

```php
<?php
$book = \Bookstore\BookQuery::create()->findOne();
echo get_class($book->getPublisher());
// \Bookstore\Book\Publisher
```

## Using namespaces as a directory structure

In a schema, you can define a `package` attribute on a `<database>` or `<table>` tag to generate model classes in a subdirectory (see [Multi-component data model](/propulsion/cookbook/multi-component-data-model/)). If your autoloading is based on namespaces mapping to directories (PSR-4), you may find yourself repeating the same information in both the `namespace` and `package` attributes:

```xml
<database name="bookstore" defaultIdMethod="native"
  namespace="Foo\Bar" package="Foo.Bar">
```

To avoid the repetition, set the generator's `autoPackage` setting to `true` in your `build.php`:

```php
<?php
// build.php
return [
    'propulsion.generator.schema.autoPackage' => true,
];
```

Now Propulsion automatically derives a `package` from the `namespace` attribute — and therefore distributes model classes into matching subdirectories — so you can omit the manual `package` attribute in the schema entirely:

```xml
<database name="bookstore" defaultIdMethod="native" namespace="Foo\Bar">
```
