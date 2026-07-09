---
title: Sortable Behavior
description: Turn a model into an ordered list, with rank-based traversal and reordering methods.
---

The `sortable` behavior allows a model to become an ordered list, and provides numerous methods to traverse that list efficiently.

## Basic usage

In `schema.xml`, use the `<behavior>` tag to add the `sortable` behavior to a table:

```xml
<table name="task">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" primaryString="true" />
  <behavior name="sortable" />
</table>
```

Rebuild your model, run the table creation SQL again, and you're ready to go. The model now has the ability to be inserted into an ordered list:

```php
$t1 = new Task();
$t1->setTitle('Wash the dishes');
$t1->save();
echo $t1->getRank(); // 1, the first rank to be given (not 0)

$t2 = new Task();
$t2->setTitle('Do the laundry');
$t2->save();
echo $t2->getRank(); // 2

$t3 = new Task();
$t3->setTitle('Rest a little');
$t3->save();
echo $t3->getRank(); // 3
```

As long as you save new objects, Propulsion gives them the first available rank in the list.

Once you've built an ordered list, you can traverse it using the methods added by the `sortable` behavior. For instance:

```php
$firstTask = TaskQuery::create()->findOneByRank(1); // $t1
$secondTask = $firstTask->getNext();      // $t2
$lastTask = $secondTask->getNext();       // $t3
$secondTask = $lastTask->getPrevious();   // $t2

$allTasks = TaskQuery::create()->findList();
// => collection($t1, $t2, $t3)
$allTasksInReverseOrder = TaskQuery::create()->orderByRank('desc')->find();
// => collection($t3, $t2, $t1)
```

The results returned by these methods are regular model objects, with access to their properties and related models. The `sortable` behavior also adds inspection methods to objects:

```php
echo $t2->isFirst(); // false
echo $t2->isLast();  // false
echo $t2->getRank(); // 2
```

## Manipulating objects in a list

You can move an object in the list using `moveUp()`, `moveDown()`, `moveToTop()`, `moveToBottom()`, `moveToRank()`, and `swapWith()`. These operations are immediate and don't require saving the model afterwards:

```php
// The list is 1 - Wash the dishes, 2 - Do the laundry, 3 - Rest a little
$t2->moveToTop();
// The list is now 1 - Do the laundry, 2 - Wash the dishes, 3 - Rest a little
$t2->moveToBottom();
// The list is now 1 - Wash the dishes, 2 - Rest a little, 3 - Do the laundry
$t2->moveUp();
// The list is 1 - Wash the dishes, 2 - Do the laundry, 3 - Rest a little
$t2->swapWith($t1);
// The list is now 1 - Do the laundry, 2 - Wash the dishes, 3 - Rest a little
$t2->moveToRank(3);
// The list is now 1 - Wash the dishes, 2 - Rest a little, 3 - Do the laundry
$t2->moveToRank(2);
```

By default, new objects are added at the bottom of the list, but you can also insert them at a specific position using `insertAtTop()`, `insertAtBottom()`, and `insertAtRank()`. The `insertAtXXX` methods don't save the object:

```php
// The list is 1 - Wash the dishes, 2 - Do the laundry, 3 - Rest a little
$t4 = new Task();
$t4->setTitle('Clean windows');
$t4->insertAtRank(2);
$t4->save();
// The list is now 1 - Wash the dishes, 2 - Clean windows, 3 - Do the laundry, 4 - Rest a little
```

Whenever you `delete()` an object, the ranks are rearranged to fill the gap:

```php
$t4->delete();
// The list is now 1 - Wash the dishes, 2 - Do the laundry, 3 - Rest a little
```

:::note
You can remove an object from the list without deleting it by calling `removeFromList()`. Don't forget to `save()` it afterwards so the other objects in the list are rearranged to fill the gap.
:::

## Multiple lists

When you need to store several lists for a single model — for instance, one task list per user — use a *scope* for each list. This requires enabling scope support in the behavior definition via the `use_scope` parameter:

```xml
<table name="task">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" primaryString="true" />
  <column name="user_id" required="true" type="integer" />
  <foreign-key foreignTable="user" onDelete="cascade">
    <reference local="user_id" foreign="id" />
  </foreign-key>
  <behavior name="sortable">
    <parameter name="use_scope" value="true" />
    <parameter name="scope_column" value="user_id" />
  </behavior>
</table>
```

Now, after rebuilding your model, you can have as many lists as required:

```php
// test users
$paul = new User();
$john = new User();

// now onto the tasks
$t1 = new Task();
$t1->setTitle('Wash the dishes');
$t1->setUser($paul);
$t1->save();
echo $t1->getRank(); // 1

$t2 = new Task();
$t2->setTitle('Do the laundry');
$t2->setUser($paul);
$t2->save();
echo $t2->getRank(); // 2

$t3 = new Task();
$t3->setTitle('Rest a little');
$t3->setUser($john);
$t3->save();
echo $t3->getRank(); // 1, because John has his own task list
```

The generated methods now accept a `$scope` parameter to restrict the query to a given scope:

```php
$firstPaulTask = TaskQuery::create()->findOneByRank(rank: 1, scope: $paul->getId()); // $t1
$lastPaulTask = $firstPaulTask->getNext();      // $t2
$firstJohnTask = TaskQuery::create()->findOneByRank(rank: 1, scope: $john->getId()); // $t1
```

Models using the sortable behavior with scope get one additional query method, `inList()`:

```php
$allPaulsTasks = TaskQuery::create()->inList(scope: $paul->getId())->find();
```

## Parameters

By default, the behavior adds one column to the model — two if you use the scope feature. If these columns are already described in the schema, the behavior detects them and doesn't add them a second time. The behavior parameters let you use custom names for the sortable columns. The following schema illustrates a complete customization of the behavior:

```xml
<table name="task">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="title" type="varchar" required="true" primaryString="true" />
  <column name="my_rank_column" required="true" type="integer" />
  <column name="user_id" required="true" type="integer" />
  <foreign-key foreignTable="user" onDelete="cascade">
    <reference local="user_id" foreign="id" />
  </foreign-key>
  <behavior name="sortable">
    <parameter name="rank_column" value="my_rank_column" />
    <parameter name="use_scope" value="true" />
    <parameter name="scope_column" value="user_id" />
  </behavior>
</table>
```

Whatever name you give your columns, the `sortable` behavior always adds the following proxy methods, mapped to the correct column:

```php
$task->getRank();       // returns $task->my_rank_column
$task->setRank($rank);
$task->getScopeValue(); // returns $task->user_id
$task->setScopeValue($scope);
```

The same happens for the generated query object:

```php
$query = TaskQuery::create()->filterByRank();  // proxies to filterByMyRankColumn()
$query = TaskQuery::create()->orderByRank();   // proxies to orderByMyRankColumn()
$tasks = TaskQuery::create()->findOneByRank(); // proxies to findOneByMyRankColumn()
```

:::note
The behavior adds columns but no index. Depending on your table structure, you might want to add a column index by hand to speed up queries on sorted lists.
:::

## Complete API

Methods added by the behavior to the model objects:

```php
// storage columns accessors
int     getRank()
$object setRank(int $rank)
// only for behavior with use_scope
int     getScopeValue()
$object setScopeValue(int $scope)

// inspection methods
bool    isFirst()
bool    isLast()

// list traversal methods
$object getNext()
$object getPrevious()

// methods to insert an object in the list (require calling save() afterwards)
$object insertAtRank($rank)
$object insertAtBottom()
$object insertAtTop()

// methods to move an object in the list (immediate, no need to save() afterwards)
$object moveToRank($rank)
$object moveUp()
$object moveDown()
$object moveToTop()
$object moveToBottom()
$object swapWith($object)

// method to remove an object from the list (requires calling save() afterwards)
$object removeFromList()
```

Methods added by the behavior to the query objects:

```php
query   filterByRank($rank, $scope = null)
query   orderByRank($order)
$object findOneByRank($rank, $scope = null)
coll    findList($scope = null)
int     getMaxRank($scope = null)
bool    reorder($order) // $order is an $id => $rank associative array
// only for behavior with use_scope
array   inList($scope)
```

A few more methods added to the peer classes:

```php
int     getMaxRank($scope = null)
$object retrieveByRank($rank, $scope = null)
array   doSelectOrderByRank($criteria = null, $order)
bool    reorder($order) // $order is an $id => $rank associative array
// only for behavior with use_scope
array   retrieveList($scope)
int     countList($scope)
int     deleteList($scope)
```
