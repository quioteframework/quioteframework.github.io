---
title: Timestampable Behavior
description: Automatically track the creation and last-update timestamps of a model object.
---

The `timestampable` behavior lets you keep track of the date of creation and last update of your model objects.

## Basic usage

In `schema.xml`, use the `<behavior>` tag to add the `timestampable` behavior to a table:

```xml
<table name="book">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" primaryString="true" />
  <behavior name="timestampable" />
</table>
```

Rebuild your model, run the table creation SQL again, and you're ready to go. The model now has two new columns, `created_at` and `updated_at`, that store a timestamp automatically updated on save:

```php
$b = new Book();
$b->setTitle('War And Peace');
$b->save();
echo $b->getCreatedAt('Y-m-d H:i:s'); // 2009-10-02 18:14:23
echo $b->getUpdatedAt('Y-m-d H:i:s'); // 2009-10-02 18:14:23
$b->setTitle('Anna Karenina');
$b->save();
echo $b->getCreatedAt('Y-m-d H:i:s'); // 2009-10-02 18:14:23
echo $b->getUpdatedAt('Y-m-d H:i:s'); // 2009-10-02 18:14:25
```

The object query also has specific methods to retrieve recent objects and order them by their update date:

```php
$books = BookQuery::create()
    ->recentlyUpdated()  // adds a minimum value for the update date
    ->lastUpdatedFirst() // orders the results by descending update date
    ->find();
```

You can use any of the following methods on the object query:

```php
// limits the query to recent objects
ModelCriteria recentlyCreated($nbDays = 7)
ModelCriteria recentlyUpdated($nbDays = 7)
// orders the results
ModelCriteria lastCreatedFirst()  // order by creation date desc
ModelCriteria firstCreatedFirst() // order by creation date asc
ModelCriteria lastUpdatedFirst()  // order by update date desc
ModelCriteria firstUpdatedFirst() // order by update date asc
```

:::note
You may need to keep the update date unchanged after an update, for instance when you only update a calculated column. In that case, call `keepUpdateDateUnchanged()` on the object before saving it.
:::

## Parameters

You can change the name of the columns added by the behavior with the `create_column` and `update_column` parameters:

```xml
<table name="book">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" primaryString="true" />
  <column name="my_create_date" type="timestamp" />
  <column name="my_update_date" type="timestamp" />
  <behavior name="timestampable">
    <parameter name="create_column" value="my_create_date" />
    <parameter name="update_column" value="my_update_date" />
  </behavior>
</table>
```

```php
$b = new Book();
$b->setTitle('War And Peace');
$b->save();
echo $b->getMyCreateDate('Y-m-d H:i:s'); // 2009-10-02 18:14:23
echo $b->getMyUpdateDate('Y-m-d H:i:s'); // 2009-10-02 18:14:23
$b->setTitle('Anna Karenina');
$b->save();
echo $b->getMyCreateDate('Y-m-d H:i:s'); // 2009-10-02 18:14:23
echo $b->getMyUpdateDate('Y-m-d H:i:s'); // 2009-10-02 18:14:25
```

It's also possible to completely skip the update column:

```xml
<behavior name="timestampable">
  <parameter name="disable_updated_at" value="true" />
</behavior>
```
