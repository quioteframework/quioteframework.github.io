---
title: Inheritance
description: Single-table, class-table (via the delegate behavior), and concrete-table inheritance in a Propulsion schema.
---

Inheritance is an object-oriented concept without a direct database equivalent, so an ORM has to emulate it. Propulsion supports the same three strategies Propel 1 did:

- **[Single Table Inheritance](https://martinfowler.com/eaaCatalog/singleTableInheritance.html)** — the cheapest at query time, but limited to a small, fixed set of inherited columns.
- **[Class Table Inheritance](https://martinfowler.com/eaaCatalog/classTableInheritance.html)** — one table per class, joined together. Propulsion doesn't implement this directly; the `delegate` behavior gives you the same result.
- **[Concrete Table Inheritance](https://martinfowler.com/eaaCatalog/concreteTableInheritance.html)** — the most flexible, at the cost of a little write overhead.

## Single table inheritance

One table backs every subclass, so the table needs every column any subclass might use. Propulsion generates a stub subclass for each.

Consider `Book`, with two subclasses, `Essay` and `Comic`. A discriminator column (conventionally `class_key`, but any name works) needs the `inheritance="single"` attribute and one `<inheritance>` child per subclass:

```xml title="schema.xml"
<table name="book">
  <column name="id" type="integer" primaryKey="true" autoIncrement="true"/>
  <column name="title" type="varchar" size="100"/>
  <column name="class_key" type="integer" inheritance="single">
    <inheritance key="1" class="Book"/>
    <inheritance key="2" class="Essay" extends="Book"/>
    <inheritance key="3" class="Comic" extends="Book"/>
  </column>
</table>
```

Rebuilding generates `Book`, `Essay`, `Comic` (each extending `Book`), and matching `BookQuery`, `EssayQuery`, `ComicQuery` classes (each extending `BookQuery`). An `<inheritance>` element can itself `extends` another inherited class, so a `Manga` type could extend `Comic` instead of `Book` directly.

:::tip
An `<inheritance>` element with no `extends` attribute must use the table's `phpName` as its `class` value.
:::

Use the generated classes exactly like any other model class — Propulsion sets the discriminator column for you:

```php
<?php
$book = new Book();
$book->setTitle('War And Peace');
$book->save();

$essay = new Essay();
$essay->setTitle('On the Duty of Civil Disobedience');
$essay->save();
```

```
id | title                             | class_key
---|-----------------------------------|----------
1  | War And Peace                     | Book
2  | On the Duty of Civil Disobedience | Essay
```

Querying the parent class hydrates the correct subclass automatically:

```php
<?php
$books = BookQuery::create()->find();
foreach ($books as $book) {
    echo get_class($book) . ': ' . $book->getTitle() . "\n";
}
// Book: War And Peace
// Essay: On the Duty of Civil Disobedience
```

Query with a subclass's own `Query` class (`ComicQuery::create()->find()`) to restrict results to just that subclass. Mark a table `abstract="true"` to prevent instantiating the base class directly, forcing callers through a subclass:

```xml
<table name="book" abstract="true">
  <!-- ... -->
</table>
```

:::note
Namespaced single-table inheritance has one open edge case: an `<inheritance>` element's `extends="..."` attribute naming an ancestor in a *different* namespace than its child isn't resolved — see the "Open issues" section of [`KNOWN_ISSUES.md`](https://github.com/quioteframework/propulsion/blob/main/KNOWN_ISSUES.md) for the exact mechanism. It's fine as long as every class in the hierarchy shares a namespace, which covers the overwhelming majority of schemas.
:::

## Class table inheritance via `delegate`

Propulsion has no dedicated class-table-inheritance feature; the `delegate` behavior gets you the same result by proxying method calls from a child table to a "parent" table it doesn't actually inherit from in PHP terms.

```xml title="schema.xml"
<table name="player">
  <column name="id" type="integer" primaryKey="true" autoIncrement="true"/>
  <column name="first_name" type="varchar" size="100"/>
  <column name="last_name" type="varchar" size="100"/>
</table>
<table name="basketballer">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="integer"/>
  <column name="points" type="integer"/>
  <column name="player_id" type="integer"/>
  <foreign-key foreignTable="player">
    <reference local="player_id" foreign="id"/>
  </foreign-key>
  <behavior name="delegate">
    <parameter name="to" value="player"/>
  </behavior>
</table>
```

`Basketballer` delegates unknown method calls to its related `Player` — setting `Player` columns directly on a `Basketballer` instance:

```php
<?php
$basketballer = new Basketballer();
$basketballer->setPoints(101);
$basketballer->setFirstName('Michael'); // delegated to a Player instance
$basketballer->setLastName('Giordano');
$basketballer->save(); // saves both the basketballer and the player row
```

If no `Player` is already attached, `delegate` creates one automatically. Delegation is single-level — a deeper hierarchy needs delegation to every ancestor (`to="basketballer, player"`), simulating multiple inheritance. Because delegation works through `__call()`, an IDE won't see the delegated-to class's methods as available on the delegating class.

## Concrete table inheritance

Each class in the hierarchy gets its own table, duplicating the superclass's columns into every subclass's table. Writing this by hand is repetitive, so the `concrete_inheritance` behavior generates it for you from a much shorter schema:

```xml title="schema.xml"
<table name="content">
  <column name="id" type="integer" primaryKey="true" autoIncrement="true"/>
  <column name="title" type="varchar" size="100"/>
  <column name="category_id" required="false" type="integer"/>
  <foreign-key foreignTable="category" onDelete="cascade">
    <reference local="category_id" foreign="id"/>
  </foreign-key>
</table>
<table name="article">
  <behavior name="concrete_inheritance">
    <parameter name="extends" value="content"/>
  </behavior>
  <column name="body" type="varchar" size="100"/>
</table>
<table name="video">
  <behavior name="concrete_inheritance">
    <parameter name="extends" value="content"/>
  </behavior>
  <column name="resource_link" type="varchar" size="100"/>
</table>
```

`concrete_inheritance` copies columns, foreign keys, and indices from `content` into `article` and `video` at build time, and — at the PHP level — makes `Article`/`ArticleQuery` and `Video`/`VideoQuery` extend `Content`/`ContentQuery`:

```php
<?php
$cat = new Category();
$cat->setName('Movie');
$cat->save();

$art = new Article();
$art->setTitle('Avatar Makes Best Opening Weekend in the History');
$art->setCategory($cat);
$art->setBody('...');
$art->save();
```

```php
<?php
class ContentQuery extends BaseContentQuery
{
    public function filterByCategoryName(string $name): static
    {
        return $this->withCategoryQuery(fn ($category) => $category->filterByName($name));
    }
}

$articles = ArticleQuery::create()->filterByCategoryName('Movie')->find();
```

### Data replication

By default, saving an `Article` or `Video` also copies `title` and `category_id` into a `Content` row, and a one-to-one relationship links a `Content` row back to its concrete child. That means you can retrieve every content item regardless of subtype through `ContentQuery`, then reach the concrete subtype on demand:

```php
<?php
$contents = ContentQuery::create()->find();
foreach ($contents as $content) {
    echo $content->getTitle();
    if ($content->hasChildObject()) {
        echo $content->getChildObject()->getPreview();
    }
}
```

Set the behavior's `copy_data_to_parent` parameter to `false` to disable the replication; the behavior then only reshapes the table at build time and does nothing at runtime, and any primary key copied from the parent is no longer turned into a foreign key.
