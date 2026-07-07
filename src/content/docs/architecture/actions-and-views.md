---
title: Actions and views
description: The action/view contract — how methods are chosen, how data flows, and how view names resolve.
---

Quiote separates *deciding what to do* from *producing output*. An **action** handles the request and returns the name of a view. A **view** turns that result into output for a specific output type. Neither one writes HTML directly into the response — the framework does that after the view runs.

This split is the same one Agavi used, and it is the reason a single action class can serve HTML, JSON, and XML without knowing anything about rendering.

## Actions

An action extends `Quiote\Action\Action`. The base class defines **no** `execute*` methods — the framework calls them dynamically based on the request. What the base class gives you is a set of hooks:

| Method | Default | Purpose |
|---|---|---|
| `getCredentials()` | `null` | Required credential(s) for a secure action |
| `isSecure()` | `false` | Whether the action requires authorization |
| `isSimple()` | `false` | Skip **all** execution for this action — see below |
| `isCacheable()` | `false` | Whether the action/view output can be cached |
| `validate(WebRequest)` | `true` | Manual validation hook |
| `registerValidators()` | loads compiled/XML | Declare validators in PHP |
| `getDefaultViewName()` | `'Input'` | View name when execution returns nothing |
| `handleError(WebRequest)` | `'Error'` | View name on validation failure |
| `setAttribute($name, $value)` | — | Pass data to the view |

### `isSimple()` means no action code runs at all

`isSimple()` is stronger than "skip validation." When it returns `true`, `ActionExecutor`/`SlotDispatcher` never call `ActionResolver::execute()` at all — no `execute*()` method, no `validate()`/`validate{Method}()`, no `registerValidators()`. `getDefaultViewName()` is used directly as the view token, and rendering proceeds straight to the view. There is no code path left inside a simple action that could read attacker-controlled (or even developer-supplied) input, because that code path never executes — reach for it for actions that are genuinely static or purely presentational, most commonly [slots](/basics/templates-and-rendering/#slots-embedding-one-action-in-another). An action that needs its `execute*()` to run — even just to read arguments with nothing else going on — must not override `isSimple()` to return `true`.

### Which method runs

Quiote maps the HTTP verb to an `execute*` method. The mapping is defined once, in `Quiote\Execution\HttpMethodMapper`:

| Verb | Method |
|---|---|
| `GET`, `HEAD`, `OPTIONS`, `TRACE` | `executeRead` |
| `POST` | `executeWrite` |
| `PUT`, `PATCH` | `executeUpdate` |
| `DELETE` | `executeRemove` |

The resolver (`Quiote\Execution\ActionResolver`) tries, in order:

1. `execute<Verb>` — a verb-exact method, e.g. `executeGet`, `executePost`, `executePut`.
2. The semantic method from the table above (`executeRead`, `executeWrite`, `executeUpdate`, `executeRemove`).
3. Bare `execute()`.
4. `getDefaultViewName()` if none of the above exist.

Most actions use the semantic methods: `executeRead` to display, `executeWrite` to create, `executeUpdate` to modify, `executeRemove` to delete. Reach for a verb-exact method only when you need to tell apart two verbs that share a semantic method — `PUT` and `PATCH`, for instance, both resolve to `executeUpdate`, so define `executePut` / `executePatch` if they must behave differently.

The same tokens (`read` / `write` / `update` / `remove`) name the per-method validation hooks — see [Validation](/basics/validation/). The mapping is not fixed: you can override or extend it (remap a verb, or add a non-standard one like `LOCK`) with the `routing.http_method_map` setting — see [Customising the HTTP verb mapping](/basics/routing/#customising-the-http-verb-mapping).

```php
<?php
namespace App\Modules\Blog\Actions;

use Quiote\Action\Action;
use Quiote\Request\WebRequest;

class PostAction extends Action
{
    public function executeRead(WebRequest $rd)
    {
        $this->setAttribute('post', /* ... */);
        return 'Success';
    }

    public function executeWrite(WebRequest $rd)
    {
        // handle the submitted form...
        return 'Success';
    }
}
```

### The return value is a view name

An action returns a **string** — the view name — never content. `'Success'` is the conventional name for the happy path; `'Input'` for showing a form; `'Error'` for a failure. Returning `View::NONE` (`null`) means "no view, I have already produced the response myself" (e.g. a redirect).

### Passing data with attributes

Data reaches the view through attributes, not through return values:

```php
$this->setAttribute('post', $post);
$this->setAttribute('comments', $comments);
return 'Success';
```

The executor snapshots the action's attributes after it runs and hands that snapshot to the view. The action object itself never crosses into the view or template.

This `setAttribute()` is the action/view's own — a plain mutable attribute holder — not `WebRequest::setAttribute()`, which is a distinct, immutable method on the request object itself; see [Mutating a request](/basics/requests-and-responses/#mutating-a-request). For page-level CSS/JS specifically, reach for `View::addCss()`/`addJavascript()` instead of an attribute — see [Page assets](/basics/templates-and-rendering/#page-assets-css-and-javascript).

## Views

A view extends `Quiote\View\View`. Like actions, the method that runs depends on context — here, on the **output type**.

### Which method runs

`ActionExecutor::selectViewMethod()` picks `execute<OutputType>()` if it exists, otherwise `execute()`:

- Output type `html` calls `executeHtml()`
- Output type `json` calls `executeJson()`
- Fallback calls `execute()`

This is how one view serves multiple formats:

```php
<?php
namespace App\Modules\Blog\Views;

use Quiote\Request\WebRequest;
use Quiote\View\View;

class PostSuccessView extends View
{
    public function executeHtml(WebRequest $rd)
    {
        $this->loadLayout();
        $this->setAttribute('pageTitle', 'Post');
    }

    public function executeJson(WebRequest $rd)
    {
        return json_encode(['post' => $this->getAttribute('post')]);
    }
}
```

For HTML, `executeHtml()` typically calls `loadLayout()` (which prepares the template layers) and sets a few presentation attributes, then returns nothing — the layers render. For JSON, `executeJson()` returns the body string directly. See [Output types](/basics/output-types-and-content-negotiation/) and [Templates and rendering](/basics/templates-and-rendering/).

### Attributes and templates

A view sees the action's attributes plus any it sets itself. Those attributes become the `$template` array in a PHP template. See [Templates and rendering](/basics/templates-and-rendering/) for the rendering half.

## View name resolution

Given an action in module `Blog` named `Post` that returns `'Success'`, Quiote resolves:

- **View class**: `PostSuccessView` (action name + view name + `View`), in the module's `Views/` directory.
- **Template**: `PostSuccess.php` (action name + view name), in the module's `Templates/` directory.

The `ViewNameResolver` handles this mapping. Keeping the names aligned — action, view, template — is what lets the convention stay implicit; deviate and you wire it explicitly.

## The two-phase pattern

Both actions and views are created bare and then handed their execution context via `initialize()`. This is deliberate: the **constructor** is for injected services (see [The DI container](/architecture/container/)), and **`initialize()`** is for the per-request framework context. Keeping them separate means adding a constructor dependency to an action never interferes with how the framework wires its context.
