---
title: Input validation
description: Declaring validators with the fluent PHP builder and reading validated input.
---

Quiote validates input *before* the action runs, and enforces a strict rule afterwards: an action can only read parameters that a validator has approved. This is a security default, not a convenience — unvalidated input is not merely discouraged, it is inaccessible.

Validation runs in `ValidationMiddleware`, after security and before dispatch. This page covers the common cases; operator groups, exports, and custom validators are in [Advanced validation](/advanced/advanced-validation/).

## The fluent builder

The modern way to declare validators is the fluent PHP builder, `Quiote\Validator\Compiler\Runtime\ValidatorBuilder`. You declare validators for an action by overriding `registerValidators()` (or a per-method variant) on the action, or by placing a validator file in the module's `Validate/` directory that returns a closure over the builder.

A validator file looks like this:

```php
<?php

use Quiote\Validator\Compiler\Runtime\ValidatorBuilder;

return static function (ValidatorBuilder $v): void {
    $v->string('name', required: true)->minLength(2)->maxLength(100);
    $v->email('email', required: true);
    $v->number('age')->min(0)->max(150);
    $v->enum('status', ['draft', 'published', 'archived'], required: true);
};
```

Each factory method declares a validator for one field and returns a spec you chain constraints onto.

## Available validators

| Method | Validates | Notable options |
|---|---|---|
| `string($field, $required)` | A string | `minLength`, `maxLength`, `trim`, `utf8` |
| `number($field, $required)` | A number | `min`, `max`, `type`, `castTo` |
| `boolean($field, $required)` | A boolean | — |
| `email($field, $required)` | An email address | — |
| `enum($field, $values, $required)` | One of an allowlist | `caseSensitive`, `strict` |
| `regex($field, $pattern, $shouldMatch, $required)` | A regex match | `shouldMatch` |
| `json($field, $required)` | Valid JSON | — |
| `isNotEmpty($field, $required)` | Non-empty value | — |
| `isSet($field, $required)` | Presence | — |
| `group($operator, $configure)` | A logical group (and/or/not/xor) | see [Advanced validation](/advanced/advanced-validation/) |
| `raw($class, $arguments, ...)` | Any `Validator` subclass | wire in a custom validator |

The `enum` allowlist is a required, typed argument — you cannot forget it, and it cannot be silently ignored.

## Per-field options

Every spec supports common chainable options:

```php
$v->string('title', required: true)
    ->minLength(1)
    ->maxLength(200)
    ->trim(true)
    ->error('Please enter a title between 1 and 200 characters.');
```

- **`required(bool)`** — whether the field must be present.
- **`error($message, $for = null)`** — the error message (optionally for a specific failure).
- **`severity($severity)`** — how a failure is treated.
- **`export($to)`** — copy the sanitized value into another parameter name. See [Advanced validation](/advanced/advanced-validation/).

## Declaring validators on the action

Instead of a separate file, you can declare validators directly on the action by overriding `registerValidators()`, or a method-specific hook such as `registerWriteValidators()` (which runs only for `POST` requests). The method segment follows the same verb mapping as `execute*` — `Read`, `Write`, `Update`, `Remove` — so `registerUpdateValidators()` covers `PUT`/`PATCH` and `registerRemoveValidators()` covers `DELETE` (see [Actions and views](/architecture/actions-and-views/)):

```php
<?php
namespace App\Modules\Blog\Actions;

use Quiote\Action\Action;
use Quiote\Request\WebRequest;
use Quiote\Validator\Compiler\Runtime\ValidatorBuilder;

class PostAction extends Action
{
    public function registerWriteValidators(): void
    {
        $v = ValidatorBuilder::on(
            $this->getInitContext()->getValidationManager(),
            $this->getContext(),
        );
        $v->string('title', required: true)->minLength(1)->maxLength(200);
        $v->string('body', required: true)->minLength(1);
    }

    public function executeWrite(WebRequest $rd)
    {
        // title and body are validated and safe to read
        return 'Success';
    }
}
```

Fluent validators run *alongside* legacy `validators.xml` — both add to the same validation manager — so you can migrate a module incrementally.

## Reading validated input

An action reads input through `WebRequest::getParameter()`. Access is whitelist-enforced:

```php
$title = $rd->getParameter('title');        // OK — 'title' was validated
$foo   = $rd->getParameter('foo');          // throws — 'foo' was never validated
$bar   = $rd->getParameter('bar', null);    // returns null — default suppresses the throw
```

Reading a parameter that no validator approved throws `UnvalidatedParameterAccessException` — unless you pass a default, in which case the default is returned. This makes "I forgot to validate this field" a loud error at development time, not a silent security hole.

## The strict lockdown

For a non-simple action with **no validator configuration at all**, `ValidationMiddleware` clears every parameter before the action runs. The action sees no input rather than unvalidated input. To let an action read input, you must declare validators for it.

Actions that genuinely take no input — a static page, say — can mark themselves simple:

```php
public function isSimple(): bool
{
    return true;
}
```

A simple action skips validation entirely and takes the lighter dispatch path.

## What happens on failure

When validation fails, `ValidationMiddleware`:

1. Resolves the action's error view — `handleWriteError()` / `handleError()`, defaulting to the `Error` view.
2. Renders it in the negotiated output type with HTTP 400.
3. For JSON, returns an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem document (`application/problem+json`) instead of an HTML page.

On an HTML form submission, `FormPopulationMiddleware` also repopulates the submitted values into the re-rendered form so the user does not lose their input.

## Manual validation

For checks that do not fit a per-field validator — cross-field rules, database lookups — override `validate()` (or `validateWrite()`) on the action and return `false` to fail:

```php
public function validateWrite(WebRequest $rd): bool
{
    if ($rd->getParameter('password') !== $rd->getParameter('password_confirm')) {
        return false;
    }
    return true;
}
```

Manual validation runs after the declarative validators and contributes to the same pass/fail decision.
