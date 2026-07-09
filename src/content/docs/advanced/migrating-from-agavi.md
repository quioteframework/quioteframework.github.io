---
title: Migrating from Agavi
description: What carries over from Agavi, what changed, and a practical order to move an application across.
---

Quiote grew out of [Agavi](https://github.com/agavi/agavi), and it keeps Agavi's core mental model on purpose: modules of actions and views, actions that return view names, views that render per output type, and XML config for the pieces that want it. If you know Agavi, you already know the shape of a Quiote app. What changed is underneath — PHP 8 namespaces and attributes, a DI container, a PSR-15 middleware pipeline instead of the filter chain, and a worker-mode runtime.

This guide maps the familiar concepts to their Quiote form and suggests an order to move an application across. It is deliberately incremental: Quiote retains fallbacks for several Agavi conventions so you can migrate a module at a time rather than in one cut.

## At a glance: Agavi to Quiote

Use this table to find the Quiote equivalent of an Agavi concept. The sections below explain each change in detail.

| Agavi | Quiote | What to do |
|---|---|---|
| Flat class names (`Blog_PostAction`) | PSR-4 namespaces (`App\Modules\Blog\Actions\PostAction`) | Namespace incrementally — the flat-name fallback keeps unported classes running. |
| `Agavi` class prefix | `Quiote\` class prefix | Update `use` statements as you touch each file. |
| `factories.xml` + context lookups | `factories` config (framework roles) + [DI container](/architecture/container/) (app code) | Declare dependencies as constructor parameters; let the container autowire. |
| Singleton "models" | [Services](/basics/services-and-models/) (container-managed) | Move behaviour to services; keep data in `getModel()`. |
| Execution filters | [Middleware pipeline](/architecture/middleware-pipeline/) | Rewrite each filter as a [custom middleware](/advanced/custom-middleware/). |
| `routing.xml` | `Routing::build()` and `#[Route]` attributes | Define routes in code; the `routing.xml` handler is not wired. |
| XML-only config | XML **or** PHP **or** YAML, per file | Leave XML in place; write new config in any format. |
| `validators.xml` only | `validators.xml` **or** the fluent PHP builder | Keep XML; migrate rules to PHP one at a time. |
| Request-per-process runtime | Worker-mode-first runtime | Audit singletons and static state for cross-request leaks. |
| `SecurityUser` / RBAC / `rbac_definitions.xml` | Same — carried over intact | No change needed. |

## What carries over unchanged

- **Module layout.** `Modules/{Name}/Actions|Views|Templates` is the same. See [Modules](/basics/modules/).
- **The action/view split.** An action returns a view name (`'Success'`, `'Input'`, `'Error'`); a view renders per output type. `executeRead` / `executeWrite` / `executeUpdate` / `executeRemove` map from the HTTP verb exactly as before. See [Actions and views](/architecture/actions-and-views/).
- **XML config.** `validators.xml`, `output_types.xml`, `rbac_definitions.xml`, and module `config.xml`/`module.xml` are still XML config files, compiled and cached. The schemas moved to Quiote namespaces, and old versions are upgraded by XSL transforms on load.
- **The security model.** `SecurityUser` / `RbacSecurityUser`, `isSecure()` / `getCredentials()`, and the AND/OR credential shape are intact. See [Authentication and authorization](/advanced/authentication-authorization/).
- **RBAC definitions.** `rbac_definitions.xml` with nested roles still expresses the role hierarchy.

## What changed

### Namespaces and class names

Agavi's flat class names (`Blog_PostAction`) become PSR-4 namespaced classes (`App\Modules\Blog\Actions\PostAction`). The framework itself moved from the `Agavi` prefix to `Quiote\`.

You don't have to rename everything at once: when it can't find the namespaced class, the controller falls back to the old flat name and includes the file by path. That fallback is what lets you carry an Agavi module across, get it running, and namespace its classes incrementally.

### factories.xml becomes the DI container

Agavi wired collaborators through `factories.xml` and context lookups. Quiote keeps a `factories` config for framework roles (`controller`, `response`, `routing`, `user`, `storage`, …) but new application code uses the [DI container](/architecture/container/): declare dependencies as constructor parameters and let the container autowire them. The old "reach through the context to find a model" pattern becomes constructor injection.

This is also where the **model** concept splits. Agavi used "model" for two things — singleton service objects and transient data objects. Quiote un-conflates them: behaviour goes in [services](/basics/services-and-models/) (container-managed), data stays in models (`getModel()`). Your Agavi singleton "models" are, in Quiote terms, services.

### Filter chain becomes the middleware pipeline

Agavi's execution filters are gone — the legacy execution-filter hooks throw if called. Their job is done by an explicit [middleware pipeline](/architecture/middleware-pipeline/): routing, security, validation, CSRF, dispatch, and the rest are each a named middleware in an ordered list you can print. Cross-cutting logic that was an Agavi filter becomes a [custom middleware](/advanced/custom-middleware/).

### routing.xml becomes `Routing::build()` and `#[Route]`

Routes are defined in a routing class (`Routing::build()`) and/or with `#[Route]` attributes on actions, merged together. The old `routing.xml` handler is not wired. See [Routing](/basics/routing/).

### Config gains PHP and YAML

Every config file that was XML can now also be written as PHP or YAML, per file — the same `settings` can be `settings.php`, `settings.yaml`, or `settings.xml`. You can leave existing XML in place and write new config in whatever format your team prefers. See [Configuration](/architecture/configuration/).

### Validators gain a fluent PHP builder

`validators.xml` still works (with a `parent` chain to shared rules). Alongside it, you can register validators in PHP with a fluent builder, and migrate an action's rules from XML to PHP one at a time — both feed the same validation manager. See [Advanced validation](/advanced/advanced-validation/) and [Writing a custom validator](/advanced/custom-validators/).

### The runtime is worker-mode first

This is the biggest operational change. Quiote's primary target is [FrankenPHP worker mode](/architecture/deployment/): the app boots once and the process serves many requests. That makes cross-request state a real hazard Agavi's request-per-process model never had. The framework resets its own per-request state between requests, but **your** services must respect [scope](/architecture/container/#scopes): don't store request data on singletons. This is the one place where "it worked in Agavi" can quietly break, so it's worth reviewing any global or static state as you port.

## A suggested order

1. **Stand up an empty Quiote app** with `quiote new` and confirm it boots. See [Your first application](/getting-started/your-first-app/).
2. **Port `settings`, `factories`, and `output_types`** — keep them as XML initially so you're changing one thing at a time.
3. **Move one module.** Copy its `Actions/Views/Templates` across. Let the legacy class-name fallback carry it while you namespace classes, then add PSR-4 namespaces to make it first-class.
4. **Bring its `validators.xml`** over as-is; the `parent` chain and schema upgrade handle the rest. Convert to the fluent builder later if you want.
5. **Replace filters with middleware.** For each Agavi filter, write a [middleware](/advanced/custom-middleware/) and place it in the pipeline.
6. **Convert singleton "models" to services** with constructor injection, and audit them for worker-mode state leaks.
7. **Move routing** into `Routing::build()` or `#[Route]` attributes.
8. **Deploy under worker mode** and load-test. Cross-request leaks show up under sustained traffic, not a single request — see the [state-leak hazards](/architecture/deployment/#state-leak-hazards) table.

Taken this way, the application keeps running at every step: each module works under the fallbacks before you modernize it, so you're never mid-rewrite with nothing that boots.
