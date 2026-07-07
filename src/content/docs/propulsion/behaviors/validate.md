---
title: Validate Behavior
description: Validate an ActiveRecord object and its related objects using the Symfony Validator component.
---

The `validate` behavior provides validation capabilities to ActiveRecord objects. Using this behavior, you can validate an ActiveRecord and its related objects, checking whether properties meet certain conditions.

This behavior is based on the [Symfony Validator component](https://symfony.com/doc/current/validation.html). We recommend reading the Symfony Validator component documentation, in particular the [Validator constraints](https://symfony.com/doc/current/reference/constraints.html) chapter, before using this behavior.

## Basic usage

In `schema.xml`, use the `<behavior>` tag to add the `validate` behavior, then add validation rules via `<parameter>` tags on the table:

```xml
<table name="author" description="Author Table">
  <column name="id" required="true" primaryKey="true" autoIncrement="true" type="INTEGER" description="Author Id" />
  <column name="first_name" required="true" type="VARCHAR" size="128" description="First Name" />
  <column name="last_name" required="true" type="VARCHAR" size="128" description="Last Name" />
  <column name="email" type="VARCHAR" size="128" description="E-Mail Address" />

  <behavior name="validate">
    <parameter name="rule1" value="{column: first_name, validator: NotNull}" />
    <parameter name="rule2" value="{column: first_name, validator: Length, options: {max: 128}}" />
    <parameter name="rule3" value="{column: last_name, validator: NotNull}" />
    <parameter name="rule4" value="{column: last_name, validator: Length, options: {max: 128}}" />
    <parameter name="rule5" value="{column: email, validator: Email}" />
  </behavior>
</table>
```

The properties of the `<parameter>` tag:

* The `name` of each parameter doesn't relate to a column — just make sure it's unique.
* The `value` of a parameter is an array in YAML format, specifying three values:
  * `column`: the column to validate
  * `validator`: the [validator constraint](https://symfony.com/doc/current/reference/constraints.html) you're using
  * `options`: (optional) an array of values to pass to the validator constraint class, per its own reference documentation

After rebuilding your model, the ActiveRecord object exposes two additional public methods:

* `validate()`: performs validation on the ActiveRecord object itself and on all related objects. Returns `true` if successful, `false` otherwise.
* `getValidationFailures()`: returns a `ConstraintViolationList` object — a list of `ConstraintViolation` objects if `validate()` returned `false`, or an empty list if it returned `true`.

Now you're ready to perform validations:

```php
$author = new Author();
$author->setLastName('Wilde');
$author->setFirstName('Oscar');
$author->setEmail('oscar.wilde@gmail.com');

if (!$author->validate()) {
    foreach ($author->getValidationFailures() as $failure) {
        echo "Property {$failure->getPropertyPath()}: {$failure->getMessage()}\n";
    }
} else {
    echo "Everything's all right!";
}
```

## Related objects validation

When using the ActiveRecord `validate()` method, validation is performed on the object itself and on all related objects. As an incredibly powerful function, it's worth knowing exactly what it does to avoid unpleasant surprises.

`validate()` follows these steps:

1. Search the 1-n related objects by foreign key.
2. If the `validate` behavior is configured on it, call its `validate()` method.
3. Perform validation on itself.
4. Search the n-1 related objects.
5. If the `validate` behavior is configured on them, call their `validate()` method.

Let's see it in action, with an example. Consider the following model:

```xml
<database name="bookstore">
    <table name="book">
        <column name="id" required="true" primaryKey="true" autoIncrement="true" type="INTEGER" />
        <column name="title" type="VARCHAR" required="true" />
        <column name="isbn" type="VARCHAR" size="24" />
        <column name="price" required="false" type="FLOAT" />
        <column name="publisher_id" required="false" type="INTEGER" />
        <column name="author_id" required="false" type="INTEGER" />
        <foreign-key foreignTable="publisher" onDelete="setnull">
            <reference local="publisher_id" foreign="id" />
        </foreign-key>
        <foreign-key foreignTable="author" onDelete="setnull" onUpdate="cascade">
            <reference local="author_id" foreign="id" />
        </foreign-key>
        <behavior name="validate">
            <parameter name="rule1" value="{column: title, validator: NotNull}" />
        </behavior>
    </table>

    <table name="publisher">
        <column name="id" required="true" primaryKey="true" autoIncrement="true" type="INTEGER" />
        <column name="name" required="true" type="VARCHAR" size="128" />
        <column name="website" type="VARCHAR" />
        <behavior name="validate">
            <parameter name="rule1" value="{column: name, validator: NotNull}" />
            <parameter name="rule2" value="{column: website, validator: Url}" />
        </behavior>
    </table>

    <table name="author">
        <column name="id" required="true" primaryKey="true" autoIncrement="true" type="INTEGER" />
        <column name="first_name" required="true" type="VARCHAR" size="128" />
        <column name="last_name" required="true" type="VARCHAR" size="128" />
        <column name="email" type="VARCHAR" size="128" />
        <behavior name="validate">
            <parameter name="rule1" value="{column: first_name, validator: NotNull}" />
            <parameter name="rule2" value="{column: first_name, validator: Length, options: {max: 128}}" />
            <parameter name="rule3" value="{column: last_name, validator: NotNull}" />
            <parameter name="rule4" value="{column: last_name, validator: Length, options: {max: 128}}" />
            <parameter name="rule5" value="{column: email, validator: Email}" />
        </behavior>
    </table>

    <table name="reader">
        <column name="id" required="true" primaryKey="true" autoIncrement="true" type="INTEGER" />
        <column name="first_name" required="true" type="VARCHAR" size="128" />
        <column name="last_name" required="true" type="VARCHAR" size="128" />
        <column name="email" type="VARCHAR" size="128" />
        <behavior name="validate">
            <parameter name="rule1" value="{column: first_name, validator: NotNull}" />
            <parameter name="rule2" value="{column: first_name, validator: Length, options: {min: 4}}" />
            <parameter name="rule3" value="{column: last_name, validator: NotNull}" />
            <parameter name="rule4" value="{column: last_name, validator: Length, options: {max: 128}}" />
            <parameter name="rule5" value="{column: email, validator: Email}" />
        </behavior>
    </table>

    <table name="reader_book" isCrossRef="true">
        <column name="reader_id" type="INTEGER" primaryKey="true" />
        <column name="book_id" type="INTEGER" primaryKey="true" />
        <foreign-key foreignTable="reader">
            <reference local="reader_id" foreign="id" />
        </foreign-key>
        <foreign-key foreignTable="book">
            <reference local="book_id" foreign="id" />
        </foreign-key>
    </table>
</database>
```

Now perform a validation on a book object:

```php
$book = new Book();

// some operations by which we add related objects to $book:
// a publisher, an author, and some readers

$book->validate();
```

The steps of validation are as follows:

1. Search the author and publisher objects related to our book.
2. Author and publisher objects have the `validate` behavior tag in their schema definition, so `$author->validate()` and `$publisher->validate()` are called.
3. Perform validation on the `$book` object itself.
4. Search all reader objects associated with this book, using the `reader_book` table.
5. The `reader_book` table has *no* `validate` behavior, so no other validation is performed.

In this case, no reader object is validated, because the cross-reference table has no `validate` behavior, even though the `reader` table has it properly configured. No error is raised, because the behavior lets you configure validation on a table without cascading it to related ones — it's your choice.

Continuing the example, you can also validate reader objects, but you need to configure the behavior on the `reader_book` table as well:

```xml
<!-- previous schema -->

<table name="reader_book" isCrossRef="true">
    <column name="reader_id" type="INTEGER" primaryKey="true" />
    <column name="book_id" type="INTEGER" primaryKey="true" />
    <foreign-key foreignTable="reader">
        <reference local="reader_id" foreign="id" />
    </foreign-key>
    <foreign-key foreignTable="book">
        <reference local="book_id" foreign="id" />
    </foreign-key>
    <behavior name="validate">
        <parameter name="rule1" value="{column: reader_id, validator: NotNull}" />
        <parameter name="rule2" value="{column: book_id, validator: NotNull}" />
        <parameter name="rule3" value="{column: reader_id, validator: Type, options: {type: integer}}" />
        <parameter name="rule4" value="{column: book_id, validator: Type, options: {type: integer}}" />
    </behavior>
</table>
```

Now the validation process is as follows:

1. Search the author and publisher objects.
2. Author and publisher objects have the `validate` behavior tag in their schema definition, so `$author->validate()` and `$publisher->validate()` are called.
3. Perform validation on `$book` itself.
4. Search all readers associated with this book, via the `reader_book` table.
5. The `reader_book` table now has the behavior, so `$reader_book->validate()` is called.
6. Inside `$reader_book->validate()`, all related reader objects are searched and validated.

:::note
If you configure the behavior on all related objects, every object is *always* validated, no matter which one's `validate()` method you call.
:::

## Parameter tag: name

Inside the `<parameter>` tag, you define the `name` property. This can be any value of your choice, but it should be *unique* — if you define more rules with the same name, only the last one is considered.

In the following example, only the third and fourth rules are considered: the first two are overwritten by the third one.

```xml
<!-- your schema -->

<column name="reader_id" type="INTEGER" primaryKey="true" />
<column name="book_id" type="INTEGER" primaryKey="true" />
<behavior name="validate">
    <parameter name="rule1" value="{column: reader_id, validator: NotNull}" />
    <parameter name="rule1" value="{column: book_id, validator: NotNull}" />
    <parameter name="rule1" value="{column: reader_id, validator: Type, options: {type: integer}}" />
    <parameter name="rule2" value="{column: book_id, validator: Type, options: {type: integer}}" />
</behavior>

<!-- end of your schema -->
```

## Parameter tag: value

As mentioned earlier, the `value` property is a string representing an array in YAML format. This format was chosen because YAML array definitions have no special XML characters to escape, and there's no need to touch the standard schema XSD/XSL files. The `options` key, inside the value array, is itself an array, and can contain other arrays (for instance, the [Choice constraint](https://symfony.com/doc/current/reference/constraints/Choice.html)'s `choices` option), which YAML handles without problems.

There's one case worth being careful about. Any respectable validation library (including the Symfony Validator component) allows validation against regular expressions, using the [Regex constraint](https://symfony.com/doc/current/reference/constraints/Regex.html), whose `options` parameter contains a `pattern` key defining the pattern to validate against.

A regular expression pattern usually contains a lot of special and escape characters, so in the YAML definition it needs to be wrapped in double quotes (`"`):

```xml
<!-- ATTENTION: THIS EXAMPLE DOES NOT WORK -->

<!-- your schema -->
<behavior name="validate">
    <!-- ... -->
    <parameter name="rule1" value="{column: isbn, validator: Regex, options: {pattern: "/[^\d-]+/", match: false, message: Please enter a valid ISBN}}" />
</behavior>

<!-- end of your schema -->
```

Remember that inside an XML attribute string, double-quote characters must be escaped as `&quot;`:

```xml
<!-- THIS EXAMPLE WORKS FINE -->

<!-- your schema -->
<behavior name="validate">
    <!-- ... -->
    <parameter name="rule1" value="{column: isbn, validator: Regex, options: {pattern: &quot;/[^\d-]+/&quot;, match: false, message: Please enter a valid ISBN}}" />
</behavior>

<!-- end of your schema -->
```

## Automatic validation

You can automatically validate an ActiveRecord before saving it, via the `preSave()` hook (see [Behaviors](/propulsion/behaviors/)). For example, to add automatic validation to a `Book` class, open `Book.php` in your model path and add:

```php
<?php
// Code of your Book class.
// Remember to import ConnectionInterface from the right namespace.

public function preSave(?ConnectionInterface $con = null): bool
{
    return $this->validate();
}
```

If validation fails, `preSave()` returns `false` and the save operation stops. No error is raised, but `save()` returns `0`, since no object was affected. Check the return value of `save()` to see what happened and retrieve any error messages:

```php
$author = AuthorQuery::create()->findPk(1);
$publisher = PublisherQuery::create()->findPk(1);

$book = new Book();
$book->setAuthor($author);
$book->setPublisher($publisher);
$book->setTitle('The country house');
$book->setPrice(10.00);

$ret = $book->save();

// $ret <= 0 means no rows were affected -- either validation failed or there was nothing to persist
if ($ret <= 0) {
    $failures = $book->getValidationFailures();

    // count($failures) > 0 means validation actually failed
    if (count($failures) > 0) {
        foreach ($failures as $failure) {
            echo "{$failure->getPropertyPath()} validation failed: {$failure->getMessage()}";
        }
    }
}
```

## Supported constraints

The behavior supports all Symfony Validator constraints (see the [Symfony documentation](https://symfony.com/doc/current/reference/constraints.html) for details), except `UniqueEntity`, which isn't compatible with Propulsion. Propulsion has its own unique validator, the `Unique` constraint, which checks whether a value is already stored in the database:

```xml
<!-- your schema -->
<behavior name="validate">
    <parameter name="rule1" value="{column: column_name, validator: Unique}" />
</behavior>
```

And to specify a custom error message:

```xml
<!-- your schema -->
<behavior name="validate">
    <parameter name="rule1" value="{column: column_name, validator: Unique, options: {message: Your message here}}" />
</behavior>
```

:::note
Do you store date-times as strings? Use the `Date`, `Time`, and `DateTime` constraints to prevent invalid PHP date-times from raising exceptions before any validation runs.
:::

## Custom validation constraints

Propulsion and the Symfony Validator component come with many bundled constraints, covering most validation needs. For cases the built-in constraints don't cover, you can write your own — a two-step process:

1. Write your custom constraint: see [this Symfony cookbook article](https://symfony.com/doc/current/validation/custom_constraint.html) and the example below.
2. Set up autoloading so Propulsion can find it: map the `Propulsion\Runtime\Validator\Constraints` namespace to the directory holding your constraint classes.

:::note
Propulsion expects to find custom constraints under the `Propulsion\Runtime\Validator\Constraints` namespace.
:::

For example, suppose you want a custom constraint, `PropulsionDomain`, that checks whether a URL belongs to the `example.org` domain. Put the files in a subdirectory of your project root, `myConstraints/Propulsion/Runtime/Validator/Constraints/`:

`PropulsionDomain.php`:

```php
<?php
// myConstraints/Propulsion/Runtime/Validator/Constraints/PropulsionDomain.php

namespace Propulsion\Runtime\Validator\Constraints;

use Symfony\Component\Validator\Constraint;

class PropulsionDomain extends Constraint
{
    public string $message = 'This URL does not belong to the example.org domain';
    public string $column = '';
}
```

`PropulsionDomainValidator.php`:

```php
<?php
// myConstraints/Propulsion/Runtime/Validator/Constraints/PropulsionDomainValidator.php

namespace Propulsion\Runtime\Validator\Constraints;

use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;

class PropulsionDomainValidator extends ConstraintValidator
{
    public function validate(mixed $value, Constraint $constraint): void
    {
        if (!str_contains((string) $value, 'example.org')) {
            $this->context->buildViolation($constraint->message)->addViolation();
        }
    }
}
```

Then register the namespace in your `composer.json` autoload section:

```json
{
    "autoload": {
        "psr-4": {
            "Propulsion\\Runtime\\Validator\\Constraints\\": "myConstraints/Propulsion/Runtime/Validator/Constraints/"
        }
    }
}
```

Now you can use your custom validator constraint in `schema.xml`, as usual:

```xml
<!-- your schema -->
<behavior name="validate">
    <parameter name="rule1" value="{column: website, validator: PropulsionDomain, options: {message: Your custom message}}" />
</behavior>

<!-- end of your schema -->
```

## Inside Symfony

This behavior adds a static `loadValidatorMetadata()` method to ActiveRecord objects, containing all validation rules. So, inside a Symfony project, you can perform the usual Symfony validations:

```php
use Symfony\Component\HttpFoundation\Response;
use YourVendor\YourBundle\Model\Author;

public function indexAction(): Response
{
    $author = new Author();
    // ... do something with $author

    $validator = $this->get('validator');
    $errors = $validator->validate($author);

    if (count($errors) > 0) {
        return new Response((string) $errors);
    }

    return new Response('The author is valid!');
}
```

If you also want automatic validation of related objects, use the ActiveRecord `validate()` method, passing it the registered validator instance:

```php
use Symfony\Component\HttpFoundation\Response;
use YourVendor\YourBundle\Model\Author;

public function indexAction(): Response
{
    $author = new Author();
    // ... do something with $author

    $validator = $this->get('validator');

    if (!$author->validate($validator)) {
        $errors = $author->getValidationFailures();

        return new Response((string) $errors);
    }

    return new Response('The author is valid!');
}
```

## Properties and methods added to ActiveRecord

The behavior adds the following properties to your ActiveRecord:

* `alreadyInValidation`: a *protected* flag that prevents an endless validation loop when this object is referenced by another object already being validated.
* `validationFailures`: a *protected* property holding the `ConstraintViolationList` object.

The behavior adds the following methods to your ActiveRecord:

* `validate()`: *public*, validates the object and all objects related to it.
* `getValidationFailures()`: *public*, returns the `ConstraintViolationList` object from the last call to `validate()`.
* `loadValidatorMetadata()`: *public static*, contains all the `Constraint` objects.
