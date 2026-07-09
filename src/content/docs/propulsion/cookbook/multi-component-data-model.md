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
    'propulsion.targetPackage' => 'my_project',
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
Splitting tables related by a foreign key across separate *files* (like `book.schema.xml` and `author.schema.xml` here) is not automatically resolved just by giving the files a shared `<database name="...">`: each schema file is parsed into its own model independently, so a table can only see other tables declared in the same file. To let `book`'s foreign key resolve against `author`, declare an explicit `<external-schema filename="author.schema.xml"/>` element inside `book.schema.xml`'s `<database>` element (see the `external-schema` element in the schema DTD). The `packageObjectModel` build property exists in `generator/default.php` but is not read anywhere in Propulsion's current build pipeline — setting it has no effect.
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

If no `package` attribute is set anywhere, Propulsion places all classes according to `propulsion.targetPackage`:

* `generated-classes/`
  * `Base/`
  * `Map/`
  * `Author.php`
  * `AuthorQuery.php`
  * `Book.php`
  * `BookQuery.php`
  * `Review.php`
  * `ReviewQuery.php`

You can further control where Propulsion writes generated files with the `--output-dir`/`-o` option on `model:build` (and `sql:build` for SQL, see below). There is no `outputDir` build-config property for this — it's a command-line option, and it defaults to `./generated-classes` for `model:build`.

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

SQL generation does *not* split by package. `sql:build` writes exactly one `.sql` file per distinct `<database name="...">` value: all `CREATE TABLE` statements for every schema file (and every package) that shares that database `name` are concatenated together into that one file, named `<name>.sql`.

For the `author.schema.xml`/`book.schema.xml` example above, both files declare `<database name="bookstore" ...>`, so regardless of their different `package` attributes (`author`, `book`, `review`), the output is a single file:

* `generated-sql/`
  * `bookstore.sql` — `CREATE TABLE author`, `CREATE TABLE book`, and `CREATE TABLE review`

To get separate SQL files, give the `<database>` elements different `name` attributes instead of relying on `package`.

## Understanding `packageObjectModel`

`propulsion.packageObjectModel` is a build property defined in `generator/default.php` (defaulting to `false`), but it is not currently read anywhere in Propulsion's build pipeline — toggling it has no observable effect on `model:build` or `sql:build`. Each schema file passed to a build command is parsed into its own independent model; a table can only resolve foreign keys against tables declared in the *same file*, regardless of whether other files share its database `name`. To reference tables defined in another file, use an explicit `<external-schema filename="..."/>` element inside the `<database>` element that needs the reference.

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

To build the packaged example, run from the project directory containing these schema files (the `schema` argument tells the command where to look — its default is `./schema`, so pass `.` to scan the current directory instead):

```bash
php bin/propulsion model:build .
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
php bin/propulsion sql:build .
```

Inspect the `generated-sql/` directory: one SQL file has been created per distinct `<database name="...">` value, *not* per package. If `author.schema.xml`, `book.schema.xml`, `club.schema.xml`, `media.schema.xml`, `publisher.schema.xml`, and `review.schema.xml` all declare `<database name="bookstore" ...>` while `log.schema.xml` declares `<database name="bookstore-log" ...>`, the build produces just two files:

* `bookstore.sql` — `CREATE TABLE` statements for every table across the six `bookstore` schema files, regardless of their `package` attribute
* `bookstore-log.sql` — `CREATE TABLE` statements for `log.schema.xml`'s table

Run `sql:exec` to execute a file against your configured database (it requires an explicit list of `.sql` files and connection options — there's no config-driven auto-discovery):

```bash
php bin/propulsion sql:exec generated-sql/bookstore.sql --dsn="pgsql:host=localhost;dbname=mydb" --user=me --password=secret
```
