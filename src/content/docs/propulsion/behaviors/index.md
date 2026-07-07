---
title: Behaviors
description: Reusable schema-level model extensions — what behaviors are, how to enable one, and how to write your own.
---

Behaviors are a great way to package model extensions for reusability. They are powerful, versatile, fast, and help you organize your code in a better way.

## Pre and post hooks for `save()` and `delete()` methods

The `save()` and `delete()` methods of your generated objects are easy to override. In fact, Propulsion looks for one of the following methods in your objects and executes them when needed:

* `preInsert`: code executed before insertion of a new object
* `postInsert`: code executed after insertion of a new object
* `preUpdate`: code executed before update of an existing object
* `postUpdate`: code executed after update of an existing object
* `preSave`: code executed before saving an object (new or existing)
* `postSave`: code executed after saving an object (new or existing)
* `preDelete`: code executed before deleting an object
* `postDelete`: code executed after deleting an object

For example, you may want to keep track of the creation date of every row in the `book` table. In order to achieve this behavior, you can add a `created_at` column to the table in `schema.xml`:

```xml
<table name="book">
  <!-- ... -->
  <column name="created_at" type="timestamp" />
</table>
```

Then, you can force the update of the `created_at` column before every insertion as follows:

```php
<?php

class Book extends BaseBook
{
    public function preInsert(?ConnectionInterface $con = null): bool
    {
        $this->setCreatedAt(time());

        return true;
    }
}
```

Whenever you call `save()` on a new object, Propulsion now executes the `preInsert()` method on this object and therefore updates the `created_at` column:

```php
$b = new Book();
$b->setTitle('War And Peace');
$b->save();
echo $b->getCreatedAt(); // 2009-10-02 18:14:23
```

:::caution
If you implement `preInsert()`, `preUpdate()`, `preSave()`, or `preDelete()`, these methods **must return a boolean value**. Any return value other than `true` stops the action (save or delete). This is a neat way to bypass persistence in some cases, but can also create unexpected problems if you forget to return `true`.
:::

:::note
Since this feature adds a small overhead to write operations, you can disable it completely in your configuration by setting `propulsion.generator.objectModel.addHooks` to `false` in your `build.php`/`build.properties`.
:::

## Introducing behaviors

When several of your custom model classes end up with similar methods added, it is time to refactor the common code.

For example, you may want to add the same ability you gave to `Book` to all the other objects in your model. Let's call this the "timestampable behavior," because then all of your rows have a timestamp marking their creation. In order to achieve this, you'd have to repeat the same operations on every table: add a `created_at` column to each table, and add a `preInsert()` hook to each stub class. Even for a simple example, that repetition is already too much — imagine a more complex behavior, and the copy-and-paste approach quickly becomes a maintenance nightmare.

Behaviors are special objects that use events called during the build process to enhance the generated model classes. They can add attributes and methods to both the table map and model classes, modify the course of some generated methods, and even modify the structure of a database by adding columns or tables.

Propulsion bundles a behavior called `timestampable`, which does exactly the same thing as described above. Instead of adding columns and methods by hand, all you have to do is declare it in a `<behavior>` tag in your `schema.xml`:

```xml
<table name="book">
  <!-- ... -->
  <behavior name="timestampable" />
</table>
<table name="author">
  <!-- ... -->
  <behavior name="timestampable" />
</table>
```

Then rebuild your model, and there you go: two columns, `created_at` and `updated_at`, were automatically added to both the `book` and `author` tables. Besides, the generated `BaseBook` and `BaseAuthor` classes already contain the code necessary to auto-set the current time on creation and on insertion.

## Bundled behaviors

Propulsion bundles the following behaviors — see each page for usage details:

* [aggregate_column](/propulsion/behaviors/aggregate-column/)
* [archivable](/propulsion/behaviors/archivable/)
* [auto_add_pk](/propulsion/behaviors/auto-add-pk/)
* [delegate](/propulsion/behaviors/delegate/)
* [i18n](/propulsion/behaviors/i18n/)
* [nested_set](/propulsion/behaviors/nested-set/)
* [query_cache](/propulsion/behaviors/query-cache/)
* [sluggable](/propulsion/behaviors/sluggable/)
* [sortable](/propulsion/behaviors/sortable/)
* [timestampable](/propulsion/behaviors/timestampable/)
* [validate](/propulsion/behaviors/validate/)
* [versionable](/propulsion/behaviors/versionable/)

Bundled behaviors require no further installation and work out of the box. `generator/default.php` in the Propulsion source registers each one under a `propulsion.behavior.<name>.class` key (e.g. `propulsion.behavior.timestampable.class` → `Propulsion\Generator\Behavior\TimestampableBehavior`) — cross-check that file if you need the exact class name for a behavior.

Not covered here: `soft_delete` (deprecated upstream in favor of `archivable`), `concrete_inheritance` (documented alongside [Inheritance](/propulsion/basics/inheritance/) since it's as much an inheritance strategy as a behavior), and `alternative_coding_standards`.

## Customizing behaviors

Behaviors often offer parameters to tweak their effect. For instance, the `timestampable` behavior allows you to customize the names of the columns added to store the creation date and the update date. Customization happens in `schema.xml`, inside `<parameter>` tags nested in the `<behavior>` tag. So let's set the behavior to use `created_on` instead of `created_at` for the creation date column name (and the same for the update date column):

```xml
<table name="book">
  <!-- ... -->
  <behavior name="timestampable">
    <parameter name="create_column" value="created_on" />
    <parameter name="update_column" value="updated_on" />
  </behavior>
</table>
```

If the columns already exist in your schema, a behavior is smart enough not to add them a second time:

```xml
<table name="book">
  <!-- ... -->
  <column name="created_on" type="timestamp" />
  <column name="updated_on" type="timestamp" />
  <behavior name="timestampable">
    <parameter name="create_column" value="created_on" />
    <parameter name="update_column" value="updated_on" />
  </behavior>
</table>
```

## Using third-party behaviors

Propulsion installs third-party behaviors via **Composer**. Add the behavior's package to your `composer.json`, and Propulsion will find the behavior class whenever you reference its registered name in your schema:

```xml
<table name="author">
  <!-- ... -->
  <behavior name="timestampable" />
  <behavior name="formidable" />
</table>
```

If you don't want to publish a Composer package for your own behavior, you can use the fully-qualified class name (FQCN) directly as the `name` instead:

```xml
<table name="author">
  <!-- ... -->
  <behavior name="\Me\PropulsionBehaviors\FormidableBehavior" />
</table>
```

A third-party behavior's own `composer.json` can also expose a short name via `extra.name`/`extra.class`, the same way the bundled behaviors are registered by name rather than FQCN — check the package's own docs for whether it supports this.

## Applying a behavior to all tables

You can add a `<behavior>` tag directly under the `<database>` tag. That way, the behavior applies to every table in the database:

```xml
<database name="app">
  <behavior name="timestampable" />
  <table name="book">
    <!-- ... -->
  </table>
  <table name="author">
    <!-- ... -->
  </table>
</database>
```

In this example, both the `book` and `author` tables benefit from the `timestampable` behavior, and therefore automatically update their `created_at` and `updated_at` columns upon saving.

## Writing a behavior

Behaviors extend `Propulsion\Generator\Behavior\Behavior` (the bundled behaviors under `generator/Lib/Behavior/` in the Propulsion source are the best starting point for understanding how they're built).

### Modifying the data model

Behaviors can modify their table, and even add another table, by implementing the `modifyTable()` method. Use `$this->getTable()` to retrieve the table's build-time model and manipulate it. For instance, to add a new column named `foo` to the current table:

```php
<?php

class MyBehavior extends Behavior
{
    // default parameter values
    protected array $parameters = [
        'column_name' => 'foo',
    ];

    public function modifyTable(): void
    {
        $table = $this->getTable();
        $columnName = $this->getParameter('column_name');

        // add the column if not present
        if (!$table->hasColumn($columnName)) {
            $table->addColumn([
                'name' => $columnName,
                'type' => 'INTEGER',
            ]);
        }
    }
}
```

### Modifying the ActiveRecord classes

Behaviors can add code to the generated model object by implementing one of the following methods:

* `objectAttributes`: add attributes to the object
* `objectMethods`: add methods to the object
* `preInsert` / `postInsert`: code executed before/after insertion of a new object
* `preUpdate` / `postUpdate`: code executed before/after update of an existing object
* `preSave` / `postSave`: code executed before/after saving an object (new or existing)
* `preDelete` / `postDelete`: code executed before/after deleting an object
* `objectCall`: add code to be executed inside the object's `__call()`
* `objectFilter($script)`: do whatever you want with the generated code, passed by reference

### Modifying the query classes

Behaviors can also add code to the generated query objects by implementing one of the following methods:

* `queryAttributes`: add attributes to the query class
* `queryMethods`: add methods to the query class
* `preSelectQuery` / `preUpdateQuery` / `postUpdateQuery` / `preDeleteQuery` / `postDeleteQuery`: hooks around selection/update/deletion of existing objects
* `queryFilter(&$script)`: do whatever you want with the generated code, passed by reference

### Modifying the table map classes

Behaviors can also add code to the generated table map objects by implementing one of the following methods:

* `staticAttributes`: add static attributes to the table map class
* `staticMethods`: add static methods to the table map class
* `tableMapFilter(&$script)`: do whatever you want with the generated code, passed by reference

### Adding new classes

Behaviors can add entirely new classes based on the data model. To build a new class, a behavior provides an array of builder class names from `getAdditionalBuilders()`, plus the builder classes themselves. For instance, to add an empty child class for the ActiveRecord class:

```php
<?php

require_once 'AddChildBehaviorBuilder.php';

class AddChildBehavior extends Behavior
{
    protected array $additionalBuilders = ['AddChildBehaviorBuilder'];
}
```

Next, write a builder extending `OMBuilder`, implementing `getUnprefixedClassName()`, `addClassOpen()`, and `addClassBody()`:

```php
<?php

class AddChildBehaviorBuilder extends OMBuilder
{
    public function getUnprefixedClassname(): string
    {
        return $this->getStubObjectBuilder()->getUnprefixedClassname() . 'Child';
    }

    protected function addClassOpen(&$script): void
    {
        $table = $this->getTable();
        $tableName = $table->getName();
        $script .= <<<PHP

/**
 * Test class for additional builder enabled on the '{$tableName}' table.
 */
class {$this->getClassname()} extends {$this->getStubObjectBuilder()}
{

PHP;
    }

    protected function addClassBody(&$script): void
    {
        $script .= '  // no code';
    }

    protected function addClassClose(&$script): void
    {
        $script .= "\n}";
    }
}
```

By default, classes added by a behavior are regenerated every time the model is rebuilt. To limit generation to the first time (for instance, for stub classes), add a public `$overwrite` attribute to the builder and set it to `false`.

You can set the additional class to be generated in a subfolder by implementing `getPackage()`.

### Replacing or removing existing methods

Behaviors can modify existing methods even when no hook is called in the builders, using a service class that parses and rewrites generated PHP. This is best used inside "filter" hooks in behaviors. For instance, to replace the `findPk()` method in the generated query class with a custom one:

```php
<?php

class FastPkFindBehavior extends Behavior
{
    public function queryFilter(&$script): void
    {
        $table = $this->getTable();
        $newFindPkMethod = sprintf(<<<'PHP'
            public function findPk($key, $con = null)
            {
                $query = 'SELECT * from `%s` WHERE id = ?';
                $con ??= Propulsion::getReadConnection(%sTableMap::DATABASE_NAME);
                $stmt = $con->prepare($query);
                $stmt->bindValue(1, $key);
                $stmt->execute();

                // hydrate ActiveRecord objects with the result
                $formatter = new \Propulsion\Runtime\Formatter\ObjectFormatter();
                $formatter->setClass('%s');

                return $formatter->formatOne($con->getSingleDataFetcher($stmt));
            }
            PHP,
            $table->getName(),
            $table->getPhpName(),
            $table->getPhpName(),
        );

        $parser = new PropulsionPHPParser($script, true);
        $parser->replaceMethod('findPk', $newFindPkMethod);
        $script = $parser->getCode();
    }
}
```

The parser class provides the following utility methods:

* `removeMethod($methodName)`
* `replaceMethod($methodName, $newCode)`
* `addMethodAfter($methodName, $newCode)`
* `addMethodBefore($methodName, $newCode)`
