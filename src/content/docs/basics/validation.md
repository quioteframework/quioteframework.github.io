---
title: Input validation
description: Declaring validators with the fluent PHP builder and reading validated input.
---

Quiote validates input *before* the action runs, and enforces a strict rule afterwards: an action can only read parameters that a validator has approved. This is a security default, not a convenience — unvalidated input is not merely discouraged, it is inaccessible.

Validation runs in `ValidationMiddleware`, after security and before dispatch. This page covers the common cases; operator groups, exports, and custom validators are in [Advanced validation](/advanced/advanced-validation/).

## How it fits in a request

Validation is not something you call — it is a middleware the kernel wires into the request pipeline for you. At boot, the `MiddlewareAttributeScanner` scans middleware classes for `#[Middleware]` attributes and the `MiddlewareOrderResolver` orders them topologically. `ValidationMiddleware` declares that it runs `after: SecurityMiddleware` and `before: DispatchMiddleware`, which fixes its place in the chain:

> Kernel boots and builds the pipeline → request enters → `RoutingMiddleware` resolves the action → `SecurityMiddleware` checks access → `ValidationMiddleware` runs the action's validators, then prunes any parameter no validator approved → `DispatchMiddleware` runs the action and renders the view.

So by the time your `execute*()` code runs, input has already been checked and unvalidated parameters are gone. For the full pipeline see [Request lifecycle](/architecture/request-lifecycle/) and [Middleware pipeline](/architecture/middleware-pipeline/).

## The fluent builder

The modern way to declare validators is the fluent PHP builder, `Quiote\Validator\Compiler\Runtime\ValidatorBuilder`. You declare validators for an action by overriding `registerValidators()` (or a per-method variant) on the action, or by placing a validator file in the module's `Validate/` directory that returns a closure over the builder.

A validator file lives next to the action it guards, at `Modules/<Module>/Validate/<Action>.php`, and returns a closure over the builder:

```php
<?php
// Modules/Blog/Validate/Post.php

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

For a non-simple action with **no validator configuration at all**, `ValidationMiddleware` clears every request parameter before the action runs — query parameters, the parsed body, and any promoted route parameters — via `WebRequest::clearParameters()`. The action sees no parameter input rather than unvalidated input: to let it read a parameter, declare a validator for that parameter's name (see [Advanced validation](/advanced/advanced-validation/)). This clearing applies to the parameter store only; headers, cookies, and uploaded files are not wiped by the lockdown, so treat those as unvalidated input and read them defensively.

Actions that genuinely take no input — a static page, say — can mark themselves simple:

```php
public function isSimple(): bool
{
    return true;
}
```

`isSimple()` is stronger than "skip validation": no `execute*()`, `validate()`, or `registerValidators()` runs at all for that action — see [Actions and views](/architecture/actions-and-views/#issimple-means-no-action-code-runs-at-all) for the full guarantee. It's the mechanism [slots](/basics/templates-and-rendering/#slots-embedding-one-action-in-another) lean on most: a purely presentational slot action has no business-logic code path left to misuse.

## What happens on failure

When validation *fails* — a validator or `validate()` returns `false`/reports an error, not an exception — `ValidationMiddleware`:

1. Resolves the action's error view — `handleWriteError()` / `handleError()`, defaulting to the `Error` view.
2. Renders it in the negotiated output type with HTTP 400.
3. For JSON, returns an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem document (`application/problem+json`) instead of an HTML page.

On an HTML form submission, the submitted values are repopulated into the re-rendered error form — see [Sticky forms after a partial validation failure](#sticky-forms-after-a-partial-validation-failure) below for how that survives strict pruning.

:::caution[A throwing validator is a 500, not a 400]
A validator (or a manual `validate*()` hook) that **throws** is not treated as "the user submitted something invalid" — it's logged at error level and rethrown, reaching `ErrorHandlingMiddleware` and becoming a 500 (see [Error handling](/architecture/error-handling/)), not a graceful 400. A validator crashing is a framework/app bug; conflating it with an ordinary validation failure would also skip the pruning that normally scrubs unvalidated data before the exception is caught. Return `false` (or use the validator's own failure mechanism) for an expected validation failure — reserve exceptions for genuinely unexpected errors.
:::

## Sticky forms after a partial validation failure

Strict pruning has one legitimate-UX cost: if a field has two validators (say, length and not-numeric) and a submitted value passes one and fails the other, the field's value is scrubbed from the request entirely — even though the field name stays whitelisted — because `getParameter()` must never return a partially-invalid value. That's correct for business logic, but it means a re-rendered HTML form would lose exactly the value the user needs to see to fix their mistake.

`ValidationManager::getRawParameterSnapshot()` captures query and body parameters *before* any pruning happens, held on the validation manager itself — deliberately **not** on `WebRequest`, so it is not reachable via `getParameter()`/`getParameters()` and can't be mistaken for a validated read. On a validation failure, `ValidationMiddleware` itself drives the sticky-form repopulation inline (via `FormPopulationEngine`) using this snapshot, scoped to `html` output only — a JSON/API client is expected to hold its own state rather than have the framework redisplay it. (This is distinct from `FormPopulationMiddleware`, which runs in `after_action` for the normal response flow.)

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

Manual validation runs after the declarative validators and contributes to the same pass/fail decision. Throwing from here follows the same rule as a throwing validator above — it's a 500, not a failed validation.
