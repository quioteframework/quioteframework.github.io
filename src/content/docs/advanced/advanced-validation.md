---
title: Advanced validation
description: Exports, logical operator groups, and custom validators with the fluent builder.
---

The [Validation](/basics/validation/) page covers per-field validators and reading validated input. This page covers the parts you reach for in real forms: **exports** (making a sanitized value available to the action), **operator groups** (and/or/xor/not), and **custom validators**.

## Exports: sanitized values into parameters

A validator does more than accept or reject — it can *sanitize and cast* a value, then make that cleaned value the one the action reads. That is what `export` does: it copies the validator's processed value into a runtime parameter.

```php
return static function (ValidatorBuilder $v): void {
    $v->number('age', required: true)
        ->castTo('int')
        ->export('age');          // action reads the cast int, not the raw string

    $v->string('email', required: true)
        ->trim(true)
        ->export('email');        // action reads the trimmed value
};
```

Without `export`, the action reads the original submitted value. With it, the action reads what the validator produced — the cast integer, the trimmed string, the normalized value. This keeps sanitization in one place (the validator) instead of repeated in every action.

Exported parameters are tracked specially by the validation manager: they are re-whitelisted after parameter pruning **even if validation failed**, so an action can safely assert that an exported value is null on failure rather than hitting the strict-access exception. Related options:

- **`export($to)`** — the destination parameter name.
- Export severity and "export to source" behaviour are configurable through the validator's parameters for finer control over when and where the value lands.

## Operator groups: and / or / xor / not

Real validation is often conditional — *this field is required only if that one is set*, *at least one of these must be present*. Operator groups express that by nesting validators under a logical operator:

```php
return static function (ValidatorBuilder $v): void {
    // At least one contact method must be provided.
    $v->group('or', function (ValidatorBuilder $g): void {
        $g->email('email');
        $g->string('phone')->minLength(7);
    });

    // Exactly one of card / paypal / invoice.
    $v->group('xor', function (ValidatorBuilder $g): void {
        $g->isSet('card');
        $g->isSet('paypal');
        $g->isSet('invoice');
    });
};
```

The four operators map to container validators:

| Operator | Passes when |
|---|---|
| `and` | All child validators pass |
| `or` | At least one child passes |
| `xor` | Exactly one child passes |
| `not` | The child validator fails |

Groups nest — an `and` inside an `or` — so you can build the boolean structure a form actually needs. Group behaviour is tunable with chainable options such as `breakOnFirst` (stop at the first failing child) and `skipErrors` (evaluate the logic without recording child error messages).

## Custom validators

When no built-in validator fits, write a `Validator` subclass and wire it in with `raw()`, which accepts any validator class:

```php
$v->raw(
    \App\Validation\IbanValidator::class,
    arguments: ['iban'],                 // the field(s) it validates
    parameters: ['country' => 'FI'],     // validator-specific parameters
    errors: ['invalid' => 'Not a valid IBAN.'],
);
```

`raw()` takes the validator class, its argument fields, its parameters, its error messages, and optionally child validators. Everything the fluent methods do for built-in validators, `raw()` lets you do for your own.

A custom validator extends `Quiote\Validator\Validator` and implements its check. The framework handles the rest — registration, running it in `ValidationMiddleware`, whitelisting the field it validates, and honouring `export` if you set it.

## Per-method validator sets

You often want different rules for reading and writing. Override the method-specific hook so a rule set applies only to that verb:

```php
class AccountAction extends Action
{
    public function registerWriteValidators(): void
    {
        $v = ValidatorBuilder::on(
            $this->getInitContext()->getValidationManager(),
            $this->getContext(),
        );
        $v->string('name', required: true)->maxLength(100);
        $v->group('or', function (ValidatorBuilder $g): void {
            $g->email('email');
            $g->string('phone')->minLength(7);
        });
    }
}
```

`registerWriteValidators()` runs for write requests only; `registerValidators()` runs for all. Both add to the same validation manager, and both compose with any `validators.xml` present — so you can migrate a legacy XML validator set to fluent PHP one rule at a time.

## Where the fluent builder comes from

The fluent builder and the file-based validator format target the exact same internal registration calls — the file format is the fluent calls, emitted to a cached PHP file. A misspelled fluent call (say `->onArray()` instead of `->oneOf()`) is a fatal "call to undefined method" at registration time, not a silently ignored parameter. That is the point of the builder over hand-written XML: mistakes surface immediately instead of failing open at runtime.
