---
title: Validators
description: Declare column validation rules in schema.xml and check them at the PHP level before persisting.
---

Validators are rules describing what data a column accepts. They are declared in `schema.xml` with `<validator>` tags and checked in PHP, before an object is persisted.

:::note
Validators are applied **at the PHP level** — they are not created as database constraints. If another application writes to the same database, these rules are not enforced against it. (For column validation that follows the Propel 1 model; note that Propulsion has no Symfony-Validator-based `validate` *behavior* — that is a Propel 2 feature. See the [behaviors overview](/propulsion/behaviors/).)
:::

## Declaring a validator

A `<validator>` binds a set of `<rule>` tags to a column. Each `<rule>` names a validator, an optional `value`, and the `message` shown on failure. For example, requiring `username` to be at least 4 characters:

```xml
<table name="user">
  <column name="id" type="integer" primaryKey="true" autoIncrement="true" />
  <column name="username" type="varchar" size="34" required="true" />
  <validator column="username">
    <rule name="minLength" value="4" message="Username must be at least ${value} characters." />
  </validator>
</table>
```

`${value}` in a message is replaced with the rule's `value`. You can apply several rules to one column by nesting multiple `<rule>` tags in a single `<validator>` (or by declaring multiple `<validator>` tags for the same column):

```xml
<column name="security_level" type="integer" required="true" default="10" />
<validator column="security_level">
  <rule name="minValue" value="0"  message="Security level must be between 0 and 10." />
  <rule name="maxValue" value="10" message="Security level must be between 0 and 10." />
</validator>
```

## Validating at runtime

After rebuilding your model, each ActiveRecord object gains a `validate()` method (returning a `bool`) and a `getValidationFailures()` method (returning an array of `Propulsion\Validator\ValidationFailed` objects):

```php
$user = new User();
$user->setUsername('foo'); // 3 characters — too short
if ($user->validate()) {
    $user->save();
} else {
    foreach ($user->getValidationFailures() as $failure) {
        echo $failure->getMessage() . "\n";
    }
}
```

Each `ValidationFailed` exposes `getColumn()`, `getMessage()`, and `getValidator()`. `validate()` optionally takes a column name or array of column names to validate only a subset (`validate(array|string|null $columns = null)`).

## Core validators

Propulsion bundles validators for the most common cases. The `name` attribute of a `<rule>` selects one:

| Rule `name` | Checks | Notes |
|---|---|---|
| `required` | The value is present. | A cleaner, PHP-level counterpart to `required="true"` on the column. No `value`. |
| `minLength` | String length ≥ `value`. | Uses `mb_strlen()` when available. |
| `maxLength` | String length ≤ `value`. | If the column has a `size`, `value` may be omitted and defaults to it. |
| `minValue` | Number ≥ `value` (non-strict). | |
| `maxValue` | Number ≤ `value` (non-strict). | |
| `match` | Value matches a `preg` pattern in `value`. | Pattern is given without delimiters, or delimited with `/`. Other delimiters are not supported. |
| `notMatch` | Value does **not** match the `preg` pattern in `value`. | Same delimiter rule as `match`. |
| `validValues` | Value is one of a `|`-delimited list in `value`. | e.g. `value="account|delivery"`. |
| `type` | Value is of the PHP type named in `value`. | e.g. `value="string"`. |
| `unique` | The value does not already exist in the table. | No `value`. |

A few worked examples:

```xml
<!-- email address by regular expression -->
<validator column="email">
  <rule name="match"
        value="/^([a-zA-Z0-9])+([\.a-zA-Z0-9_-])*@([a-zA-Z0-9])+(\.[a-zA-Z0-9_-]+)+$/"
        message="Please enter a valid email address." />
</validator>

<!-- restrict to a fixed set of values -->
<validator column="address_type">
  <rule name="validValues" value="account|delivery" message="Please select a valid address type." />
</validator>

<!-- reject anything that isn't a digit or a dash -->
<validator column="isbn">
  <rule name="notMatch" value="/[^\d-]+/" message="Please enter a valid ISBN." />
</validator>
```

:::tip[maxLength and the column `size`]
If a column declares a `size`, a `maxLength` rule without a `value` automatically uses that size — so you don't repeat the number.
:::

## Writing a custom validator

A custom validator is a class implementing `Propulsion\Validator\BasicValidator`, which requires a single `isValid(ValidatorMap $map, $str): bool` method. The `ValidatorMap` gives access to the rule's attributes — `$map->getValue()` returns the rule's `value`:

```php
use Propulsion\Validator\BasicValidator;
use Propulsion\Map\ValidatorMap;

class EmailValidator implements BasicValidator
{
    public function isValid(ValidatorMap $map, $str): bool
    {
        return preg_match('/^([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})$/i', $str ?? '') !== 0;
    }
}
```

:::caution
`isValid()` must return a real boolean — Propulsion is strict about this, and a truthy/falsy mixed value won't do.
:::

Enable it with a `<rule>` whose `name` is `class` and whose `class` attribute is the validator's **dot-path** — the class name with namespace separators replaced by dots, which Propulsion resolves via `Propulsion::importClass()`:

```xml
<validator column="email">
  <rule name="class" class="app.validator.EmailValidator" message="Invalid e-mail address." />
</validator>
```
