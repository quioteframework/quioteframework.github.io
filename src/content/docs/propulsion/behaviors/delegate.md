---
title: Delegate Behavior
description: Delegate a model's methods to one of its relationships, isolating logic in a dedicated model.
---

The `delegate` behavior allows a model to delegate methods to one of its relationships. This helps isolate logic in a dedicated model, or simulate [class table inheritance](http://martinfowler.com/eaaCatalog/classTableInheritance.html).

## Basic usage

In `schema.xml`, use the `<behavior>` tag to add the `delegate` behavior to a table. In its `<parameter>` tags, specify the table that the current table delegates to as the `to` parameter:

```xml
<table name="account">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="login" type="varchar" required="true" />
  <column name="password" type="varchar" required="true" />
  <behavior name="delegate">
    <parameter name="to" value="profile" />
  </behavior>
</table>
<table name="profile">
  <column name="email" type="varchar" />
  <column name="telephone" type="varchar" />
</table>
```

Rebuild your model, run the table creation SQL again, and you're ready to go. The delegate `profile` table is now related to the `account` table with a one-to-one relationship — the behavior creates a foreign primary key in the `profile` table. In fact, this is equivalent to having defined the following schema:

```xml
<table name="account">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="login" type="varchar" required="true" />
  <column name="password" type="varchar" required="true" />
</table>
<table name="profile">
  <column name="id" required="true" primaryKey="true" type="integer" />
  <column name="email" type="varchar" />
  <column name="telephone" type="varchar" />
  <foreign-key foreignTable="account" onDelete="setnull" onUpdate="cascade">
    <reference local="id" foreign="id" />
  </foreign-key>
</table>
```

:::note
If the delegate table already has a foreign key to the main table, the behavior doesn't recreate it — this gives you full control over the relationship between the two tables.
:::

In addition, the ActiveRecord `Account` class now provides integrated delegation capabilities. That means it offers to handle the columns of the `Profile` model directly, while in reality it finds or creates a related `Profile` object and calls the methods on that delegate:

```php
$account = new Account();
$account->setLogin('francois');
$account->setPassword('S€cr3t');

// fill the profile via delegation
$account->setEmail('francois@example.com');
$account->setTelephone('202-555-9355');
// same as
$profile = new Profile();
$profile->setEmail('francois@example.com');
$profile->setTelephone('202-555-9355');
$account->setProfile($profile);

// save the account and its profile
$account->save();

// retrieve delegated data directly from the main object
echo $account->getEmail(); // francois@example.com
```

Getter and setter methods for delegate columns don't exist on the main object — delegation is handled by the magic `__call()` method. Therefore, delegation also works for custom methods on the delegate table:

```php
class Profile extends BaseProfile
{
    public function setFakeEmail(): void
    {
        $n = random_int(0, PHP_INT_MAX);
        $fakeEmail = base_convert((string) $n, 10, 36) . '@example.com';
        $this->setEmail($fakeEmail);
    }
}

$account = new Account();
$account->setFakeEmail(); // delegates to Profile::setFakeEmail()
```

## Delegating using a many-to-one relationship

Instead of adding a one-to-one relationship, the `delegate` behavior can take advantage of an existing many-to-one relationship. For instance:

```xml
<table name="player">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="first_name" type="varchar" />
  <column name="last_name" type="varchar" />
</table>
<table name="basketballer">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="points" type="integer" />
  <column name="field_goals" type="integer" />
  <column name="three_points_field_goals" type="integer" />
  <column name="player_id" type="integer" />
  <foreign-key foreignTable="player">
    <reference local="player_id" foreign="id" />
  </foreign-key>
  <behavior name="delegate">
    <parameter name="to" value="player" />
  </behavior>
</table>
```

In that case, the behavior doesn't modify the foreign keys — it just proxies methods called on `Basketballer` to the related `Player`, or creates one if it doesn't exist:

```php
$basketballer = new Basketballer();
$basketballer->setPoints(101);
$basketballer->setFieldGoals(47);
$basketballer->setThreePointsFieldGoals(7);
// set player identity via delegation
$basketballer->setFirstName('Michael');
$basketballer->setLastName('Giordano');
// same as
$player = new Player();
$player->setFirstName('Michael');
$player->setLastName('Giordano');
$basketballer->setPlayer($player);

// save basketballer and player
$basketballer->save();

// retrieve delegated data directly from the main object
echo $basketballer->getFirstName(); // Michael
```

Since several models can delegate to the same player object, a single player can have both basketball and soccer stats.

:::note
In this example, table delegation is used to implement [Class Table Inheritance](http://martinfowler.com/eaaCatalog/classTableInheritance.html). See [Inheritance](/propulsion/basics/inheritance/) for how Propulsion implements this inheritance type, and others.
:::

## Delegating to several tables

Delegation allows delegating to several tables. Just separate the delegate table names with commas in the `to` parameter of the `delegate` behavior tag:

```xml
<table name="account">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="login" type="varchar" required="true" />
  <column name="password" type="varchar" required="true" />
  <behavior name="delegate">
    <parameter name="to" value="profile, preference" />
  </behavior>
</table>
<table name="profile">
  <column name="email" type="varchar" />
  <column name="telephone" type="varchar" />
</table>
<table name="preference">
  <column name="preferred_color" type="varchar" />
  <column name="max_size" type="integer" />
</table>
```

Now the `Account` class has two delegates, addressable seamlessly:

```php
$account = new Account();
$account->setLogin('francois');
$account->setPassword('S€cr3t');

// fill the profile via delegation
$account->setEmail('francois@example.com');
$account->setTelephone('202-555-9355');
// fill the preference via delegation
$account->setPreferredColor('orange');
$account->setMaxSize('200');

// save the account and its profile and its preference
$account->save();
```

On the other hand, it's not possible to cascade delegation to yet another model. So even if the `profile` table delegates to another `detail` table, the methods of the `Detail` model won't be accessible from `Profile` objects.

## Parameters

The `delegate` behavior takes only one parameter, the list of delegate tables:

```xml
<table name="account">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer" />
  <column name="login" type="varchar" required="true" />
  <column name="password" type="varchar" required="true" />
  <behavior name="delegate">
    <parameter name="to" value="profile, preference" />
  </behavior>
</table>
```

The delegate tables must exist, but they don't need to share a relationship with the main table — in that case, the behavior creates a one-to-one relationship.
