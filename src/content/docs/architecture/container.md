---
title: The DI container
description: Quiote's dependency-injection container — how services are registered, resolved, autowired, and scoped, and where your own services fit in.
---

A **dependency-injection (DI) container** is the object that builds your objects for you. Instead of a class reaching out to find the things it needs, it lists them as constructor parameters, and the container supplies them when it creates the class. Quiote's container is `Quiote\DI\Container`, a small [PSR-11](https://www.php-fig.org/psr/psr-11/) implementation.

Here is the shift it makes, concretely. The old Agavi style had a class reach back through the context to locate its collaborators:

```php
// Before: the class goes looking for what it needs
class OrderService
{
    public function doThing(): void
    {
        $repo = $this->getContext()->getModel('OrderRepository'); // service-locator style
    }
}
```

With the container, the class just *declares* what it needs, and receives it already built:

```php
// After: the container supplies collaborators through the constructor
class OrderService
{
    public function __construct(private OrderRepository $repo) {} // injected for you
}
```

The container is small on purpose — it's code Quiote owns rather than a third-party dependency, in keeping with the framework's low-magic stance. This page covers how it works and, importantly, **where your own services get registered**.

## How it fits in a request

The container is built once when a [context](/architecture/request-lifecycle/) boots, and three kinds of thing end up inside it:

1. **Core framework objects** — the controller, request, routing, storage, user, database manager, and so on. These are built by the older `factories` config (see [Configuration](/architecture/configuration/#factories)), and then **bridged into the container** by `Context::registerCoreServicesInContainer()`, which registers each one under both its role name (e.g. `databaseManager`) and its concrete class. *(The `factories` config itself does not talk to the container — it builds the objects, and the context registers the results. That's the one wiring detail worth remembering.)*
2. **Plugin services** — anything a [plugin](/architecture/plugins/) contributes via `PluginRegistrar::service()` at boot (see [Registering services](#registering-services) below).
3. **Your application's services** — resolved on demand, either by constructor injection or an explicit lookup.

During a request the container is mostly invisible: your action's and view's dependencies are already wired by the time your code runs. Where it actively works each request is at the boundaries:

> Context boots → `factories` build the core objects → `Context::registerCoreServicesInContainer()` registers them → plugins' `register()` add their services → **each request:** actions and views are built fresh via `make()` (never cached), their constructor dependencies autowired → at the end of the request `Container::reset()` clears request-scoped services, keeping singletons for the next request.

That last step is why scopes matter under a long-lived worker — see below.

## Scopes

Every service resolves under one of three scopes, which decide how long its instance lives:

| Scope | Constant | Lifetime |
|---|---|---|
| Singleton | `Container::SCOPE_SINGLETON` | Built once, reused for the whole worker's life. |
| Transient | `Container::SCOPE_TRANSIENT` | Built fresh every time it's asked for. |
| Request | `Container::SCOPE_REQUEST` | Built once per request, then cleared at the request boundary. |

**Why this matters under [worker mode](/architecture/deployment/).** A FrankenPHP worker stays in memory across many requests. A stateful object registered as a *singleton* would carry its state from one request into the next — leaking one user's data into another's request. Request-scoped services avoid that: `Container::reset()` runs at each request boundary (in lockstep with the context's own reset) and drops them, so the next request builds them clean. Singletons and the container's definitions survive; only request-scoped instances are cleared.

:::tip[Rule of thumb]
When unsure, choose **transient** or **request** scope. Reserve **singleton** for objects you've confirmed hold no per-request state.
:::

## Registering services

There are two places you register a service, depending on who owns it.

### The usual path: a plugin's `register()`

Application and package services are registered inside a [plugin](/architecture/plugins/), through the `PluginRegistrar` handed to `register()`. This is the normal way to add your own service to the container:

```php
// src/Plugin/AppPlugin.php
namespace App\Plugin;

use Quiote\DI\Container;
use Quiote\Plugin\{PluginInterface, PluginRegistrar};
use Quiote\Plugin\Attribute\Plugin;

#[Plugin(name: 'app')]
final class AppPlugin implements PluginInterface
{
    public function register(PluginRegistrar $r): void
    {
        // id, concrete (class-string | closure | instance), scope, ...aliases
        $r->service(OrderService::class, OrderService::class, Container::SCOPE_REQUEST);
        $r->service(ClockInterface::class, fn() => new SystemClock());
    }
}
```

The plugin only runs once you list it in your `Config/plugins.{php,yaml,xml}` file — see [Plugins](/architecture/plugins/#registering-a-plugin). At boot, `PluginManager` calls each plugin's `register()`, and the deferred `service()` calls are applied to each context's container (registered only if not already bound, so your app and the core always win over a plugin).

### The lower-level path: the container API directly

If you hold a `Container` instance yourself (for example in a test or a custom bootstrap), you register with `set()`, `setFactory()`, and `alias()` — there is no `bind()` or `register()` method:

```php
use Quiote\DI\Container;

$c = new Container();

// A class name — autowired when first resolved:
$c->set(OrderService::class, OrderService::class, Container::SCOPE_REQUEST);

// A closure factory:
$c->setFactory(Mailer::class, fn() => new Mailer(getenv('SMTP_DSN')));

// An already-built instance:
$c->set('clock', new SystemClock());

// An alias — bind an interface to a concrete id:
$c->alias(ClockInterface::class, 'clock');
```

`set()` also takes a fourth argument: constructor values the container can't figure out from types alone (scalars, config strings), bound by parameter name:

```php
$c->set(SessionStore::class, SessionStore::class, Container::SCOPE_REQUEST, [
    'table' => 'sessions',
    'mode'  => 'strict',
]);
```

## Resolving services

Three methods read from the container:

```php
$orders = $c->get(OrderService::class);   // resolve, memoized per scope
$fresh  = $c->make(OrderService::class);  // resolve, always a brand-new instance
$c->has(OrderService::class);             // is it registered? (PSR-11)
```

- **`get()`** resolves aliases, returns the cached instance for singleton/request scopes (building and caching it the first time), and detects dependency cycles — a circular dependency throws `ContainerException` with the full resolution path so you can see what referred to what.
- **`make()`** always builds a fresh, never-cached instance. This is the path the framework uses for **actions and views**, which are per-request and must never be reused. You can pass construction-time overrides: `make(FooAction::class, [SomeDependency::class => $value])`.
- **`has()`** reports only what has been *explicitly registered* — not everything that *could* be autowired. So a mistyped dependency fails loudly instead of a look-alike being silently constructed.

## Autowiring

When the container builds a class, it fills each constructor parameter by trying these sources **in order**, stopping at the first that applies:

1. A value bound at registration time **by parameter name** (the `set()` params array, or `make()` overrides).
2. A value bound **by type**.
3. An **`#[Inject('id')]`** attribute on the parameter — resolved via `get('id')`.
4. An **`#[Autowire(value)]`** attribute — a literal value supplied inline.
5. A **type-hinted class** that can itself be autowired — resolved via `get()`.
6. The parameter's **default value**, if it has one.
7. Otherwise, a loud `ContainerException` — the container never guesses.

A class with no constructor is simply instantiated with `new`.

### A worked example

```php
use Quiote\DI\Container;
use Quiote\DI\Attribute\{Service, Inject, Autowire};
use Symfony\Contracts\Service\Attribute\Required;

#[Service(scope: Container::SCOPE_REQUEST)]           // marks it a service + sets its scope
final class OrderService
{
    public function __construct(
        private OrderRepository $repo,                // (5) autowired by type
        #[Inject('clock')] private ClockInterface $clock,   // (3) resolved by container id
        #[Autowire('USD')] private string $currency,  // (4) a literal value
    ) {}

    #[Required]
    public function setLogger(LoggerInterface $logger): void
    {
        $this->logger = $logger;                      // optional setter injection
    }
}
```

The four attributes:

- **`#[Service(scope: ...)]`** — marks a class as a service and declares its scope in one place (so you don't have to pass the scope at every registration).
- **`#[Inject('id')]`** — fill this parameter from a specific container id, instead of by its type.
- **`#[Autowire(value)]`** — inject a literal scalar value (a table name, a mode, a default) for a parameter that has no type to autowire against. It's a literal, not a config lookup — to pull a value from config, register the service with a `set()` params binding (or a factory closure) that reads `Config::get()`.
- **`#[Required]`** — after construction, the container calls every `#[Required]` method with autowired arguments. Use it for cross-cutting optional dependencies (a logger, say) you don't want in every constructor.

:::note
The container refuses a `#[Required]` method named `initialize`, or one that type-hints an action/view init context (`ActionInitContext` / `ViewInitContext`) — those are per-request framework hooks the container doesn't own, so it won't call them.
:::

## The service layer

A "service" in Quiote is just a plain object with injected dependencies — **not a base class you must extend**. Two opt-in markers exist:

- **`Quiote\Service\ServiceInterface`** — an empty marker interface. Implementing it (or carrying `#[Service]`) lets the container tell a real service apart from any other autowireable class, and defaults it to **transient** scope.
- **`Quiote\Service\Service`** — an optional, transitional base class that exposes `getContext()`. It exists so a half-migrated service can still reach `$this->getContext()->getModel('Other')` while its collaborators are being converted to injection. Treat it as scaffolding to remove, not a permanent parent.

The end state for a service is a plain object with constructor-injected dependencies and no base class at all.

### Services vs. models

Quiote historically used the word "model" for two unrelated things: long-lived service/repository objects, and short-lived data objects (DTOs). The container separates them:

- **Services** — resolved through the container (`getService()` / injection). Business logic, repositories, finders.
- **Models** — still resolved with `getModel()`. Transient data objects, typically built from a database row.

New code injects **services**; `getModel()` remains for the DTO half.

## Reaching the container from a request

Prefer constructor injection. When that doesn't fit — a legacy call site, or a genuinely lazy, conditional lookup — the context exposes a locator:

```php
$service = $this->getContext()->getService(OrderService::class);
```

`getService()` is a thin wrapper over the container's `get()`. It's there for those cases; new code should inject its dependencies through the constructor instead.
