---
title: Copying Persisted Objects
description: Shallow and deep copies of persisted rows with copy().
---

Propulsion's generated Active Record classes provide a `copy()` method to duplicate a mapped row in the database. Propulsion does *not* override PHP's built-in `__clone()` — that stays available if you need a local, in-memory duplicate of an object that still maps to the same persisted row.

By default, `copy()` performs a shallow copy: any foreign key references on the copy remain the same as on the original.

```php
<?php

$a = new Author();
$a->setFirstName('Aldous');
$a->setLastName('Huxley');

$p = new Publisher();
$p->setName('Harper');

$b = new Book();
$b->setTitle('Brave New World');
$b->setPublisher($p);
$b->setAuthor($a);

$b->save(); // so that auto-increment IDs are created

$bcopy = $b->copy();
var_export($bcopy->getId() == $b->getId());       // false
var_export($bcopy->getAuthorId() == $b->getAuthorId()); // true
var_export($bcopy->getAuthor() == $b->getAuthor());     // true
```

## Deep copies

Calling `copy(true)` makes Propulsion create a deep copy of the object. "Deep" here specifically means the objects that reference *this* row through a foreign key (its fkey referrers, e.g. a `Book`'s `Review` rows) are copied too, rather than shared by reference — it does **not** mean the row's own foreign key columns get new related objects. A `Book`'s `author_id`/`publisher_id` columns are copied verbatim by `copyInto()` regardless of `$deepCopy`, so the copy still points at the same `Author`/`Publisher` row either way.

Continuing the example above:

```php
<?php

$bdeep = $b->copy(true);
var_export($bdeep->getId() == $b->getId());             // false
var_export($bdeep->getAuthorId() == $b->getAuthorId());       // true
var_export($bdeep->getAuthor() == $b->getAuthor());           // true
```
