---
title: How to Write a Behavior
description: A step-by-step tutorial building a schema-level behavior from scratch.
---

Behaviors are a good way to reuse code across models without inheritance — horizontal reuse instead of vertical. This tutorial walks through porting hand-written model code into a real behavior, using a simplified version of the bundled [`aggregate_column`](/propulsion/behaviors/aggregate-column/) behavior as the running example: keeping a `total_nb_votes` column on a `PollQuestion` object up to date every time a related `PollAnswer` is saved, edited, or deleted.

Read [Behaviors](/propulsion/behaviors/) first for the basics — what behaviors are, how to enable one, and the full list of hook methods available. This page focuses on building one from the ground up.

## Bootstrapping a behavior

A behavior is a class that alters the generated classes for a table in your model. It extends `Propulsion\Generator\Model\Behavior` and implements one or more "hook" methods. Here's the skeleton to start with for an `aggregate_column`-style behavior:

```php
<?php

class AggregateColumnBehavior extends \Propulsion\Generator\Model\Behavior
{
    // default parameter values
    protected array $parameters = [
        'name' => null,
    ];
}
```

Save this class as `AggregateColumnBehavior.php`. Propulsion resolves third-party behaviors via Composer, so tell it where to find your class through your package's `composer.json`:

1. Add a `propulsion.behavior.<name>.class` entry, **or**
2. Expose an `extra.name`/`extra.class` pair, the same way bundled behaviors register a short name instead of requiring their fully-qualified class name in the schema.

```json
{
    "name": "your-name/aggregate-column-behavior",
    "extra": {
        "name": "aggregate_column",
        "class": "\\YourVendor\\PropulsionBehaviors\\AggregateColumn\\AggregateColumnBehavior"
    }
}
```

Then require that package from your project's `composer.json`. If you don't want to publish a package at all, you can skip registration entirely and reference the behavior by its fully-qualified class name directly in the schema — see [Using third-party behaviors](/propulsion/behaviors/#using-third-party-behaviors).

Test the behavior by adding it to a table in your model — for instance, a `poll_question` table:

```xml
<database name="poll" defaultIdMethod="native">
  <table name="poll_question" phpName="PollQuestion">
    <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
    <column name="body" type="varchar" size="100" />
    <behavior name="aggregate_column">
      <parameter name="name" value="total_nb_votes" />
    </behavior>
  </table>
</database>
```

Rebuild your model (`bin/propulsion model:build`) and check the generated `PollQuestionTableMap` class under the `Map/` subdirectory of your build output. It should carry a `getBehaviors()` method proving the behavior was applied:

```php
<?php
class PollQuestionTableMap extends TableMap
{
    // ...

    public function getBehaviors(): array
    {
        return [
            'aggregate_column' => ['name' => 'total_nb_votes'],
        ];
    }
}
```

## Adding a column

The behavior works, but it doesn't do anything yet. Make it useful by having it add a column — implement `modifyTable()`:

```php
<?php

class AggregateColumnBehavior extends \Propulsion\Generator\Model\Behavior
{
    // ...

    public function modifyTable(): void
    {
        $table = $this->getTable();
        $columnName = $this->getParameter('name');
        if (!$columnName) {
            throw new \InvalidArgumentException(sprintf(
                "You must define a 'name' parameter for the 'aggregate_column' behavior in the '%s' table",
                $table->getName(),
            ));
        }

        // add the aggregate column if not already present
        if (!$table->hasColumn($columnName)) {
            $table->addColumn([
                'name' => $columnName,
                'type' => 'integer',
            ]);
        }
    }
}
```

This shows that a behavior has access to the `<parameter>` elements defined for it in `schema.xml` through `getParameter()`, and to the `Table` object attached to it via `getTable()`. A `Table` can check whether a column exists and add a new one. `Table` is one of many *build-time* model classes used to describe the object model while generating code, alongside `Column`, `ForeignKey`, `Index`, and others, all found under `generator/Lib/Model/` in the Propulsion source.

:::tip
Don't confuse the *runtime* database model (`DatabaseMap`, `TableMap`, `ColumnMap`, `RelationMap` — see [Model introspection at runtime](/propulsion/cookbook/runtime-introspection/)) with the *build-time* model (`Database`, `Table`, `Column`, and so on) used here. The build-time model is deliberately detailed, to make the builders' job of writing Active Record and Query classes easier. The runtime model is optimized for speed and carries only what's needed for correct hydration and binding. Behaviors operate on the build-time model, since they run at build time.
:::

Rebuild the model and the SQL, and the new column shows up: `BasePollQuestion` gets `getTotalNbVotes()`/`setTotalNbVotes()` methods, and the generated table-creation SQL includes the new `total_nb_votes` column:

```sql
DROP TABLE IF EXISTS poll_question;
CREATE TABLE poll_question
(
  id INTEGER NOT NULL,
  body VARCHAR(100),
  total_nb_votes INTEGER,
  PRIMARY KEY (id)
);
```

:::tip
The behavior only adds the column when it isn't already present (`!$table->hasColumn($columnName)`). If a user needs to customize the column's type or any other attribute, they can declare a `<column>` tag with the same name in the table, and `modifyTable()` skips adding it a second time.
:::

## Adding a method to the Active Record class

The previous version relied on an external method updating `total_nb_votes` by hand. A behavior can add such a method itself by implementing `objectMethods()`:

```php
<?php

use Propulsion\Generator\Builder\OM\ObjectBuilder;

class AggregateColumnBehavior extends \Propulsion\Generator\Model\Behavior
{
    // ...

    public function objectMethods(ObjectBuilder $builder): string
    {
        return $this->addUpdateAggregateColumn();
    }

    protected function addUpdateAggregateColumn(): string
    {
        $sql = sprintf(
            'SELECT %s FROM %s WHERE %s = ?',
            $this->getParameter('expression'),
            $this->getParameter('foreign_table'),
            $this->getParameter('foreign_column'),
        );
        $table = $this->getTable();
        $aggregateColumn = $table->getColumn($this->getParameter('name'));
        $columnPhpName = $aggregateColumn->getPhpName();
        $localColumn = $table->getColumn($this->getParameter('local_column'));

        return <<<PHP

/**
 * Updates the aggregate column {$aggregateColumn->getName()}
 *
 * @param \Propulsion\Runtime\Connection\ConnectionInterface \$con A connection object
 */
public function update{$columnPhpName}(\Propulsion\Runtime\Connection\ConnectionInterface \$con): void
{
    \$sql = '{$sql}';
    \$stmt = \$con->prepare(\$sql);
    \$stmt->execute([\$this->get{$localColumn->getPhpName()}()]);
    \$this->set{$columnPhpName}(\$stmt->fetchColumn());
    \$this->save(\$con);
}
PHP;
    }
}
```

The Active Record class builder appends the string returned from `objectMethods()` to the generated class body. Don't worry about indentation — the builder classes indent whatever a behavior returns. A good rule of thumb is one behavior method per generated method, for readability.

The schema needs the extra parameters this method relies on:

```xml
<database name="poll" defaultIdMethod="native">
  <table name="poll_question" phpName="PollQuestion">
    <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
    <column name="body" type="varchar" size="100" />
    <behavior name="aggregate_column">
      <parameter name="name" value="total_nb_votes" />
      <parameter name="expression" value="count(nb_votes)" />
      <parameter name="foreign_table" value="poll_answer" />
      <parameter name="foreign_column" value="question_id" />
      <parameter name="local_column" value="id" />
    </behavior>
  </table>
  <table name="poll_answer" phpName="PollAnswer">
    <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
    <column name="question_id" required="true" type="integer" />
    <column name="body" type="varchar" size="100" />
    <column name="nb_votes" type="integer" />
    <foreign-key foreignTable="poll_question" onDelete="cascade">
      <reference local="question_id" foreign="id" />
    </foreign-key>
  </table>
</database>
```

Rebuild the model, and the generated `BasePollQuestion` class now includes the new `updateTotalNbVotes()` method:

```php
<?php
class BasePollQuestion implements ActiveRecordInterface
{
    // ...

    /**
     * Updates the aggregate column total_nb_votes
     *
     * @param \Propulsion\Runtime\Connection\ConnectionInterface $con A connection object
     */
    public function updateTotalNbVotes(\Propulsion\Runtime\Connection\ConnectionInterface $con): void
    {
        $sql = 'SELECT count(nb_votes) FROM poll_answer WHERE question_id = ?';
        $stmt = $con->prepare($sql);
        $stmt->execute([$this->getId()]);
        $this->setTotalNbVotes($stmt->fetchColumn());
        $this->save($con);
    }
}
```

Behaviors offer a similar hook to add methods to query classes (`queryMethods()`), and to add attributes with `objectAttributes()`/`queryAttributes()`. See [Behaviors: Writing a behavior](/propulsion/behaviors/#writing-a-behavior) for the full list of hooks — pre/post save and delete hooks, table-map hooks, and hooks for adding entirely new generated classes.

## Using a template for generated code

Building method bodies as raw interpolated strings, like `addUpdateAggregateColumn()` above, gets hard to read fast. Propulsion behaviors can use a simple templating system instead — an external PHP file rendered with a fixed set of variables.

Refactor `addUpdateAggregateColumn()` to render a template:

```php
<?php

class AggregateColumnBehavior extends \Propulsion\Generator\Model\Behavior
{
    // ...

    protected function addUpdateAggregateColumn(): string
    {
        $sql = sprintf(
            'SELECT %s FROM %s WHERE %s = ?',
            $this->getParameter('expression'),
            $this->getParameter('foreign_table'),
            $this->getParameter('foreign_column'),
        );
        $table = $this->getTable();
        $aggregateColumn = $table->getColumn($this->getParameter('name'));

        return $this->renderTemplate('objectUpdateAggregate', [
            'aggregateColumn' => $aggregateColumn,
            'columnPhpName'   => $aggregateColumn->getPhpName(),
            'localColumn'     => $table->getColumn($this->getParameter('local_column')),
            'sql'             => $sql,
        ]);
    }
}
```

The method now returns a *rendered template* rather than a hand-built string. Propulsion templates are plain PHP files executed in a sandbox, with access only to the variables passed as the second argument to `renderTemplate()`.

Create a `templates/` directory next to the `AggregateColumnBehavior` class file, and add `objectUpdateAggregate.php`:

```php
/**
 * Updates the aggregate column <?php echo $aggregateColumn->getName() ?>
 *
 * @param \Propulsion\Runtime\Connection\ConnectionInterface $con A connection object
 */
public function update<?php echo $columnPhpName ?>(\Propulsion\Runtime\Connection\ConnectionInterface $con): void
{
    $sql = '<?php echo $sql ?>';
    $stmt = $con->prepare($sql);
    $stmt->execute([$this->get<?php echo $localColumn->getPhpName() ?>()]);
    $this->set<?php echo $columnPhpName ?>($stmt->fetchColumn());
    $this->save($con);
}
```

No need to escape dollar signs — this separation is much cleaner for larger behaviors, and it's exactly the pattern the bundled `aggregate_column` behavior itself uses under `generator/Lib/Behavior/AggregateColumn/templates/` in the Propulsion source.

## Adding another behavior from a behavior

This is where it gets trickier. The `updateTotalNbVotes()` calls in a real implementation need to run from the `postSave()`/`postDelete()` hooks of `PollAnswer`, not `PollQuestion` — but the behavior above is registered on `poll_question`. How can it modify code generated for a different table?

It can't directly. To modify classes built for `poll_answer`, a behavior has to be registered on the `poll_answer` table. But a behavior is a first-class part of the build-time model, just like a column or a foreign key — so the trick is to have `AggregateColumnBehavior::modifyTable()` *add a second behavior* to the foreign table, one whose job is implementing the `postSave()`/`postDelete()` hooks on `PollAnswer`. This is exactly what the real bundled `aggregate_column` behavior does — it pairs an `AggregateColumnBehavior` on the table owning the aggregate column with an internal `AggregateColumnRelationBehavior` it registers on the foreign table automatically. Read `generator/Lib/Behavior/AggregateColumn/AggregateColumnBehavior.php` in the Propulsion source for the full implementation once you're comfortable with the pieces above.
