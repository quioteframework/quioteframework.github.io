---
title: The DI container
description: Quiote's scope-aware dependency injection container, autowiring, and the service layer.
---

Quiote has a PSR-11 dependency injection container, `Quiote\DI\Container`. It replaces Agavi's `factories.xml`-driven instantiation for new code: instead of a class reaching back through the context to find its collaborators, it declares them as constructor parameters and the container supplies them.

The container is small and deliberately so — it is code Quiote controls, not a third-party dependency, in keeping with the framework's low-magic stance.

## Scopes

Every service resolves under one of three scopes:

| Scope | Constant | Behaviour |
|---|---|---|
| Singleton | `Container::SCOPE_SINGLETON` | Built once, cached for the worker's life |
| Transient | `Container::SCOPE_TRANSIENT` | Built fresh every time |
| Request | `Container::SCOPE_REQUEST` | Built once per request, cleared on `reset()` |

Scope discipline matters under FrankenPHP. A worker lives across many requests, so a stateful service registered as a singleton leaks its state between requests. Request-scoped services are torn down at each request boundary (`Container::reset()`), in lockstep with the context's own reset. When in doubt, prefer transient or request scope; opt into singleton only for verified-stateless services.

## Registering services

There is no `bind()` / `register()` — registration is `set()` (for closures, class names, instances, or scalars), `setFactory()`, and `alias()`:

```php
use Quiote\DI\Container;

$c = new Container();

// A class name, autowired when resolved:
$c->set(OrderService::class, OrderService::class, Container::SCOPE_REQUEST);

// A closure factory:
$c->setFactory(Mailer::class, fn() => new Mailer(getenv('SMTP_DSN')));

// An existing instance:
$c->set('clock', new SystemClock());

// An alias (interface to implementation):
$c->alias(ClockInterface::class, 'clock');
```

`set()` also takes constructor parameter bindings for scalar/config values the container cannot autowire by type:

```php
$c->set(SessionStore::class, SessionStore::class, Container::SCOPE_REQUEST, [
    'table' => 'sessions',
    'mode'  => 'strict',
]);
```

## Resolving services

```php
$orders = $c->get(OrderService::class);   // memoized per scope
$fresh  = $c->make(OrderService::class);  // always a new instance
$c->has(OrderService::class);             // registered? (PSR-11)
```

- **`get()`** resolves aliases, returns the memoized instance for singleton/request scopes, detects dependency cycles (throwing `ContainerException` with the resolution path), and otherwise builds and caches per scope.
- **`make()`** always builds a fresh, never-cached instance. This is the path used for **actions and views**, which are per-execution and must never be memoized. You can pass construction-time overrides: `make(FooAction::class, [SomeContext::class => $ctx])`.
- **`has()`** reflects only explicitly registered entries, not everything that *could* be autowired — so a mistyped dependency fails loudly instead of silently autowiring a value object.

## Autowiring

When the container builds a class, it resolves each constructor parameter in strict priority order:

1. A parameter value bound at registration time, by name.
2. A parameter value bound by type.
3. An `#[Inject('id')]` attribute, resolved via `get('id')`.
4. An `#[Autowire(value)]` attribute, supplying a literal value.
5. A type-hinted class, autowired via `get()`, if it can be autowired.
6. The parameter's default value.
7. Otherwise, a loud `ContainerException`.

A class with no constructor is simply `new`'d.

### Attributes

Four attributes control wiring:

```php
use Quiote\DI\Attribute\Service;
use Quiote\DI\Attribute\Inject;
use Quiote\DI\Attribute\Autowire;
use Symfony\Contracts\Service\Attribute\Required;

#[Service(scope: Container::SCOPE_REQUEST)]
final class OrderService
{
    public function __construct(
        private OrderRepository $repo,          // autowired by type
        #[Inject('clock')] private ClockInterface $clock,
        #[Autowire('%core.currency%')] private string $currency,
    ) {}

    #[Required]
    public function setLogger(LoggerInterface $logger): void
    {
        $this->logger = $logger;               // optional setter injection
    }
}
```

- **`#[Service(scope: ...)]`** — marks a class as a service and declares its scope in one place.
- **`#[Inject('id')]`** — resolve a parameter by container id instead of by type.
- **`#[Autowire(value)]`** — inject a literal scalar or config value.
- **`#[Required]`** — after construction, the container calls every `#[Required]` method with autowired arguments. Use it for cross-cutting optional dependencies (like a logger) you do not want in every constructor. The container refuses a `#[Required]` method named `initialize` or one that type-hints an action/view init context — those are per-execution framework hooks the container does not own.

## The service layer

A "service" in Quiote is a plain object with injected dependencies — not a base class you must extend. Two opt-in markers exist:

- **`Quiote\Service\ServiceInterface`** — an empty marker interface. Implementing it (or carrying `#[Service]`) lets the container distinguish a service from an arbitrary autowireable class, and defaults it to transient scope.
- **`Quiote\Service\Service`** — an optional, transitional base that exposes `getContext()`. It exists so a half-migrated service can still reach `$this->getContext()->getModel('Other')` while its collaborators are converted. It is scaffolding to shed, not a permanent parent.

The end state for a service is a plain object with constructor-injected dependencies and no base class at all.

### Services vs. models

Quiote historically used "model" for two unrelated things: singleton service/repository objects, and transient data objects (DTOs). The container un-conflates them:

- **Services** — resolved via the container (`getService()` / injection). Business logic, repositories, finders.
- **Models** — still resolved via `getModel()`. Transient data objects built from a row.

New code injects services. `getModel()` stays for the DTO half.

## Reaching the container from a request

Outside constructor injection, the context exposes a locator:

```php
$service = $this->getContext()->getService(OrderService::class);
```

`getService()` is a thin facade over the container's `get()`. Prefer constructor injection for new code; `getService()` is there for legacy call sites and for genuinely lazy, conditional lookups that do not fit constructor wiring.
