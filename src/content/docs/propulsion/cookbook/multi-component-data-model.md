---
title: Multi-Component Data Model
description: Split a large schema across multiple files and organize generated classes into packages.
---

Propulsion comes with packaging capabilities that make it easier to integrate into a packaged or modularized application.

## Multiple schemas

You can use as many `schema.xml` files as you want. Schema files must be named `(*.)schema.xml`, so `schema.xml`, `package1.schema.xml`, and `core.package1.schema.xml` are all acceptable names. These files have to be located in your project directory.

Each schema file must contain a `<database>` element with a `name` attribute. This name references the connection settings to use for this database (configured in your project's [configuration](/propulsion/basics/configuration/)), so separate schema files can share a common database name.

Whenever you run a Propulsion build command, it considers all matching schema files and builds classes (or SQL) for every table across all of them.

## Understanding packages

In Propulsion, a *package* is a group of models. It's a convenient way to organize your code in a modularized fashion, since classes and SQL files for a given package are grouped together and separated from other packages. By carefully choosing the package for each model, an application ends up split into smaller, independent modules that are easier to manage.

### Package cascade

The package is defined through a configuration cascade — you can set it for the whole project, for all the tables in a schema, or for a single table.

For the whole project, set the main package in your configuration file:

```php
<?php
// build.php
return [
    'propulsion.generator.targetPackage' => 'my_project',
];
```

By default, all tables in all schemas use this package. You can override it for a given `<database>` by setting its `package` attribute:

```xml
<!-- in author.schema.xml -->
<database package="author" name="bookstore">
    <table name="author">
        <!-- author columns -->
    </table>
</database>

<!-- in book.schema.xml -->
<database package="book" name="bookstore">
    <table name="book">
        <!-- book columns -->
    </table>
    <table name="review">
        <!-- review columns -->
    </table>
</database>
```

Thanks to the `package` attribute, tables are grouped into:

* `my_project.author` package: the `author` table
* `my_project.book` package: the `book` and `review` tables

:::caution
If you split tables related by a foreign key across separate packages (like `book` and `author` here), you must enable the `packageObjectModel` build property so Propulsion considers other packages when resolving relations.
:::

You can also override `package` at the `<table>` element level:

```xml
<!-- in author.schema.xml -->
<database package="author" name="bookstore">
    <table name="author">
        <!-- author columns -->
    </table>
</database>

<!-- in book.schema.xml -->
<database package="book" name="bookstore">
    <table name="book">
        <!-- book columns -->
    </table>
    <table name="review" package="review">
        <!-- review columns -->
    </table>
</database>
```

This produces:

* `my_project.author` package: the `author` table
* `my_project.book` package: the `book` table
* `my_project.review` package: the `review` table

Tables can end up in separate packages even though they belong to the same schema file.

:::tip
You can use dots in a package name to add more package levels.
:::

### Packages and generated model files

A table's `package` attribute translates to the directory Propulsion generates its Model classes into.

If no `package` attribute is set anywhere, Propulsion places all classes according to `propulsion.generator.targetPackage`:

* `generated-classes/`
  * `Base/`
  * `Map/`
  * `Author.php`
  * `AuthorQuery.php`
  * `Book.php`
  * `BookQuery.php`
  * `Review.php`
  * `ReviewQuery.php`

You can further control where Propulsion writes generated files by changing `propulsion.paths.outputDir`. By default this is the directory you run `bin/propulsion` commands from; point it at any other directory to use as your build output root.

If you set up packages at the `<database>` level, Propulsion splits the generated model classes into subdirectories named after the package:

* `generated-classes/`
  * `author/`
    * `Base/`
    * `Map/`
    * `Author.php`
    * `AuthorQuery.php`
  * `book/`
    * `Base/`
    * `Map/`
    * `Book.php`
    * `BookQuery.php`
    * `Review.php`
    * `ReviewQuery.php`

And, if you specialize `package` per table, one table can use its own package:

* `generated-classes/`
  * `author/`
    * `Base/`
    * `Map/`
    * `Author.php`
    * `AuthorQuery.php`
  * `book/`
    * `Base/`
    * `Map/`
    * `Book.php`
    * `BookQuery.php`
  * `review/`
    * `Base/`
    * `Map/`
    * `Review.php`
    * `ReviewQuery.php`

### Packages and SQL files

Propulsion also considers packages for SQL generation, producing one SQL file per package. Each file contains the `CREATE TABLE` statements needed for all the tables in that package.

By default, without any package overrides, all tables end up in a single SQL file:

* `generated-sql/`
  * `schema.sql`

If you specialize `package` for each `<database>` element, Propulsion uses it to split the SQL file too:

* `generated-sql/`
  * `author.schema.sql` — `CREATE TABLE author`
  * `book.schema.sql` — `CREATE TABLE book` and `CREATE TABLE review`

And a package overridden at the table level also produces its own independent SQL file:

* `generated-sql/`
  * `author.schema.sql` — `CREATE TABLE author`
  * `book.schema.sql` — `CREATE TABLE book`
  * `review.schema.sql` — `CREATE TABLE review`

## Understanding `packageObjectModel`

The `propulsion.generator.packageObjectModel` configuration property enables the "packaged" build process. It changes how build commands join `<database>` elements: elements sharing the same `name` are merged, while their packages are kept separate. This lets you split a large schema across several files regardless of foreign-key dependencies between them, since Propulsion joins all schema files sharing a database name before resolving relations.

This property is enabled by default.

## A packaged example

Consider a project laid out with these schema files:

* `author.schema.xml`
* `book.schema.xml`
* `club.schema.xml`
* `media.schema.xml`
* `publisher.schema.xml`
* `review.schema.xml`
* `log.schema.xml`

Each file's `<database>` tag sets `package` to the package name every table in that file belongs to. For example, `author.schema.xml` might contain:

```xml
<database package="core.author" name="bookstore" ...>
```

This means the `Author` Object Model classes are generated under a `core/author/` subdirectory of the build output directory.

More than one schema file can belong to the same package — for example, `book.schema.xml` and `media.schema.xml` might both belong to `core.book`, so their generated classes end up together under `core/book/`.

### The Object Model build

To build the packaged example, run from the project directory containing these schema files:

```bash
php bin/propulsion model:build
```

This produces a directory tree along these lines (the `Base/` and `Map/` subdirectories under each package are omitted for clarity):

* `addon/`
  * `club/`
    * `BookClubList.php`
    * `BookListRel.php`
* `core/`
  * `author/`
    * `Author.php`
  * `book/`
    * `Book.php`
  * `media/`
    * `Media.php`
  * `publisher/`
    * `Publisher.php`
  * `review/`
    * `Review.php`
* `util/`
  * `log/`
    * `BookstoreLog.php`

### The SQL build

From the same schema files, generate SQL with:

```bash
php bin/propulsion sql:build
```

Inspect the `generated-sql/` directory: one SQL file has been created per package attribute found in the schema files:

* `addon.club.schema.sql`
* `core.author.schema.sql`
* `core.book.schema.sql`
* `core.publisher.schema.sql`
* `core.review.schema.sql`
* `util.log.schema.sql`

Each file contains the `CREATE TABLE` statements for its package. Run `sql:exec` to execute them against your configured database:

```bash
php bin/propulsion sql:exec
```
