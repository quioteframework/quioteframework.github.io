---
title: Relationships
description: Foreign keys, generated relation accessors, joins, and query-time relation filtering.
---

Defining foreign keys in your schema lets Propulsion add smart, typed methods to the generated model and query classes. In practice, this means you rarely deal with primary and foreign key values directly — you set and read related objects instead. This page reuses the bookstore schema from [Building your schema](/propulsion/getting-started/schema-and-build-time/): `Book` has foreign keys to `Author` and `Publisher`.

## Setting a related object

Propulsion generates a setter for each `<foreign-key>` — `setAuthor()` on `Book`, based on the relation's `phpName`:

```php
<?php
$author = new Author();
$author->setFirstName('Leo');
$author->setLastName('Tolstoy');
$author->save();

$book = new Book();
$book->setTitle('War & Peace');
$book->setAuthor($author); // internally translates to setAuthorId($author->getId())
$book->save();
```

You don't have to `save()` the related object first — Propulsion automatically cascades `INSERT`s to unsaved related objects:

```php
<?php
$author = new Author();
$author->setFirstName('Leo');
$author->setLastName('Tolstoy');
// not saved yet

$publisher = new Publisher();
$publisher->setName('Viking Press');
// not saved yet

$book = new Book();
$book->setTitle('War & Peace');
$book->setPublisher($publisher);
$book->setAuthor($author);
$book->save(); // saves all three objects
```

From the *many* side of a one-to-many relationship, the generated method is plural — `Author` doesn't get a `setBook()`, it gets `addBook()`:

```php
<?php
$book = new Book();
$book->setTitle('War & Peace');

$author = new Author();
$author->setFirstName('Leo');
$author->setLastName('Tolstoy');
$author->addBook($book);
$author->save(); // saves both, book.author_id is correctly set
```

## Reading related objects

A matching getter exists for every relation, in both directions:

```php
<?php
$book = BookQuery::create()->findPk(1);
$author = $book->getAuthor();
echo $author->getFirstName(); // 'Leo'

$author = AuthorQuery::create()->findPk(1);
$books = $author->getBooks(); // a collection, since one Author has many Books
foreach ($books as $book) {
    echo $book->getTitle();
}
```

`countBooks()` returns the number of related rows without hydrating them — prefer it to `count($author->getBooks())` when you only need the count. `getBooks()` also accepts an optional query, letting you filter or reorder the related collection without a separate round trip:

```php
<?php
$query = BookQuery::create()->orderByTitle();
$books = $author->getBooks($query);
```

## Filtering by a related object

Every relation gets a `filterByXXX()` method on the query class, named after the relation, so you can find rows related to an object you already have without writing the join condition yourself:

```php
<?php
$author = AuthorQuery::create()->findPk(1);
$books = BookQuery::create()
    ->filterByAuthor($author)
    ->orderByTitle()
    ->find();
```

## Embedding queries with `withQuery()`

To filter on a *column of the related table* — not just an object you already have — embed the related table's query into the main one. `BookQuery` gets a generated `withAuthorQuery()` and `withPublisherQuery()`, each taking a closure that receives the related query object:

```php
<?php
// SELECT book.* FROM book
// INNER JOIN author ON book.author_id = author.id
// WHERE book.isbn = '0140444173' AND author.first_name = 'Leo'
// ORDER BY book.title ASC LIMIT 10
$books = BookQuery::create()
    ->filterByISBN('0140444173')
    ->withAuthorQuery(fn ($author) => $author->filterByFirstName('Leo'))
    ->orderByTitle()
    ->limit(10)
    ->find();
```

Propulsion infers the `ON` clause from the foreign key defined in the schema. `withQuery()` closures compose to any depth, including several sibling relations nested inside the same outer relation:

```php
<?php
// Find all authors of books published by Viking Press
$authors = AuthorQuery::create()
    ->withBookQuery(fn ($book) => $book
        ->withPublisherQuery(fn ($publisher) => $publisher->filterByName('Viking Press')))
    ->find();
```

:::note
The generated `use<Relation>Query()`/`endUse()` methods (`useAuthorQuery()->filterByFirstName('Leo')->endUse()`) still work and do the same thing, but are deprecated — `endUse()` returns the generic `ModelCriteria` base type, which loses static type information for the rest of the chain. See [Migrating from Propel 1](/propulsion/getting-started/migrating-from-propel/#usequeryenduse--withquery) for the full rationale and an automated Rector rule that rewrites existing `useQuery()`/`endUse()` chains to `withQuery()`.
:::

## Minimizing queries with `with()`

`withQuery()`/`filterByXXX()` filter on a related table, but reading the related object afterwards still issues a separate query unless you also ask Propulsion to hydrate it in the same `SELECT`, via `with()`:

```php
<?php
$book = BookQuery::create()
    ->withAuthorQuery(fn ($author) => $author->filterByFirstName('Leo'))
    ->with('Author')
    ->findOne();
$author = $book->getAuthor(); // no additional query
```

`with()` adds the related table's columns to the `SELECT`, so it costs more memory and a wider row — use it only when you know you'll need the related object. If you don't need a filter but still want the join, `joinWith()` is a shorthand for `withXXXQuery()` + `with()`:

```php
<?php
$review = ReviewQuery::create()
    ->joinWith('Review.Book')
    ->joinWith('Book.Author')
    ->joinWith('Book.Publisher')
    ->findOne();
$author = $review->getBook()->getAuthor(); // no additional queries
```

:::caution
`with()`/`joinWith()` also work as a left join for one-to-many relationships, but not together with `limit()` — Propulsion has no way to know the true row count of the main object in that case. Use `populateRelation()` on the resulting collection instead:

```php
<?php
$authors = AuthorQuery::create()->limit(5)->find();
$authors->populateRelation('Book'); // one extra query, not one per author
foreach ($authors as $author) {
    foreach ($author->getBooks() as $book) { /* no per-row query */ }
}
```
:::

## Many-to-many relationships

A junction table marked `isCrossRef="true"` is exposed on both ends as a plain one-to-many relationship — `$user->addGroup($group)`, `$group->getUsers()`, `$user->countGroups()` — plus `filterByGroup()`/`filterByUser()` on the respective query classes:

```xml
<table name="user_group" isCrossRef="true">
  <column name="user_id" type="integer" primaryKey="true"/>
  <column name="group_id" type="integer" primaryKey="true"/>
  <foreign-key foreignTable="user">
    <reference local="user_id" foreign="id"/>
  </foreign-key>
  <foreign-key foreignTable="group">
    <reference local="group_id" foreign="id"/>
  </foreign-key>
</table>
```

Cross-reference tables with more than two primary-key columns (an extra `type` discriminator column, say) aren't specially supported — Propulsion's generator only ever pairs the two foreign keys of a cross-reference table when building the `addXXX()`/`getXXX()`/`countXXX()` accessors, so a third primary-key column doesn't get its own combination accessor. Stick to the two-foreign-key shape shown above.

## One-to-one relationships

When a table's primary key is *also* a foreign key, Propulsion treats the relationship as one-to-one and generates singular accessors on both sides:

```xml
<table name="bookstore_employee">
  <column name="id" type="integer" primaryKey="true" autoIncrement="true"/>
  <column name="name" type="varchar" size="32"/>
</table>
<table name="bookstore_employee_account">
  <column name="employee_id" type="integer" primaryKey="true"/>
  <column name="login" type="varchar" size="32"/>
  <foreign-key foreignTable="bookstore_employee">
    <reference local="employee_id" foreign="id"/>
  </foreign-key>
</table>
```

This generates `BookstoreEmployee::getBookstoreEmployeeAccount()` and `BookstoreEmployeeAccount::getBookstoreEmployee()`.

## `onDelete`/`onUpdate` triggers

`<foreign-key>` accepts `onUpdate`/`onDelete` attributes with values `CASCADE`, `SETNULL`, or `RESTRICT`. On databases with native foreign key support these become real database-level constraints; elsewhere Propulsion emulates them:

```xml
<foreign-key foreignTable="book" onDelete="CASCADE">
  <reference local="book_id" foreign="id"/>
</foreign-key>
```

## Model-only relationships

A `<foreign-key>` with `skipSql="true"` isn't emitted as a real database constraint — useful against a legacy schema where the relationship exists conceptually but the underlying table wasn't built with it. Propulsion still generates the full set of accessors and filters for it, it just never writes the SQL constraint:

```xml
<table name="review">
  <column name="review_id" type="integer" primaryKey="true" required="true"/>
  <column name="book_id" required="true" type="integer"/>
  <foreign-key foreignTable="book" onDelete="CASCADE" skipSql="true">
    <reference local="book_id" foreign="id"/>
  </foreign-key>
</table>
```
