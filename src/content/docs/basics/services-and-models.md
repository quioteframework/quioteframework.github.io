---
title: Services and models
description: Where business logic goes — writing a service with constructor injection, and using models as data objects.
---

Quiote is deliberately unopinionated about where your business logic lives (see [Design philosophy](/getting-started/philosophy/)). It does not mandate a repository pattern, a service layer shape, or a "model" base class. What it gives you is two conventions — **services** and **models** — and a container that wires the first one for you. This page is the practical answer to "where does my code go?"

The short version:

- **Services** hold behaviour — business logic, repositories, finders, integrations. They are resolved through the [DI container](/architecture/container/) with constructor injection.
- **Models** are data objects — a DTO built from a row, a value object, a domain entity. They are resolved through `getModel()`.

These were historically conflated (Agavi used "model" for both singleton service objects and transient data objects). Quiote keeps them separate on purpose.

## Writing a service

A service is a plain object. There is no base class to extend and nothing to register in a config file — you declare its dependencies as constructor parameters and the container supplies them:

```php
<?php
namespace App\Service;

use App\Repository\OrderRepository;
use Psr\Clock\ClockInterface;

final class OrderService
{
    public function __construct(
        private OrderRepository $repo,
        private ClockInterface $clock,
    ) {}

    public function placeOrder(Cart $cart): Order
    {
        // business logic here
        return $this->repo->save(Order::fromCart($cart, $this->clock->now()));
    }
}
```

That is a complete, usable service. When something asks the container for `OrderService`, the container inspects the constructor, resolves `OrderRepository` and `ClockInterface`, and builds it.

### Marking a service

Two optional markers make intent explicit and control lifetime:

- **`#[Service]`** — marks the class as a service and declares its [scope](/architecture/container/#scopes) in one place:

  ```php
  use Quiote\DI\Attribute\Service;
  use Quiote\DI\Container;

  #[Service(scope: Container::SCOPE_REQUEST)]
  final class OrderService { /* ... */ }
  ```

- **`Quiote\Service\ServiceInterface`** — an empty marker interface. Implementing it lets the container tell a service apart from an arbitrary autowireable class.

Neither is required to be injectable, but they matter for one reason: **scope**. A class carrying `#[Service]` uses the scope you declare. A class that only implements `ServiceInterface` defaults to **transient**. Everything else the container autowires defaults to singleton. That default is deliberate — silently promoting a stateful service to a process-wide singleton under [worker mode](/architecture/deployment/) is a cross-request bug waiting to happen, so services lean toward transient.

:::caution[Scope discipline under worker mode]
A worker process is long-lived, so a singleton service that stores request data leaks it into the next request. Register anything holding per-request state as `SCOPE_REQUEST` (torn down at each request boundary) or `SCOPE_TRANSIENT` (fresh every time). Reserve singleton for verified-stateless services. See [The DI container](/architecture/container/#scopes).
:::

### Reaching a service without injection

Prefer constructor injection. For the cases that don't fit it — a lazy, conditional lookup deep inside a method — the context exposes a locator:

```php
$orders = $this->getContext()->getService(OrderService::class);
```

`getService()` is a thin wrapper over the container's `get()`. It is there for legacy call sites and genuinely conditional lookups, not the default way to reach a collaborator.

### The transitional `Service` base class

There is a `Quiote\Service\Service` base class that exposes `getContext()`. It exists only to help a half-migrated service reach `$this->getContext()->getModel('Other')` while its collaborators are being converted to injection. It is scaffolding to shed — the end state is a plain object with injected dependencies and no base class. Don't reach for it in new code; extending it out of habit rebuilds the service-locator pattern under a new name.

For the full container API — `set()`, `make()`, `#[Inject]`, `#[Autowire]`, `#[Required]`, autowiring order — see [The DI container](/architecture/container/).

## Models

A model is a data object. Where a service *does* things, a model *is* something: a row loaded from the database, a value object, a piece of domain state. You get one with `getModel()`:

```php
$post = $this->getContext()->getModel('Post', 'Blog');
```

### How a model resolves

`getModel($name, $module = null, $parameters = null)` locates the class the same way [modules](/basics/modules/) locate actions and views:

| Call | Class |
|---|---|
| `getModel('Post', 'Blog')` | `App\Modules\Blog\Models\PostModel` |
| `getModel('Clock')` | `App\Models\ClockModel` |
| `getModel(\App\Domain\Money::class)` | that class as-is (FQCN passthrough) |

A module model lives in the module's `Models/` directory; a global model lives in the app-level `Models/` directory (`core.model_dir`). If you pass a fully-qualified class name, it is used directly.

The `$parameters` argument, when given, is passed both to the constructor and — if the class defines one — to an `initialize($context, $parameters)` method.

### Model lifetime

By default a model is built fresh every time. A model that implements `Quiote\Model\ISingletonModel` is cached on the context for its lifetime instead — one instance shared per request. Because the context is reset between worker requests, a singleton model must not hold request-specific state that could leak; treat singleton models as stateless caches, not per-request scratch space.

The abstract `Quiote\Model\Model` base class provides `getContext()` and serialization hooks (it swaps the live context for its name when serialized and restores it on wake-up), so a model can be safely cached or stored in a session.

## Which one do I use?

| Question | Use |
|---|---|
| Does it hold behaviour / talk to other services? | A **service** with constructor injection |
| Is it a passive data object built from a row or request? | A **model** via `getModel()` |
| Does it need to be autowired into other classes? | A **service** (the container only autowires services) |
| Does it need to be serialized into a session? | A **model** (the base class handles context serialization) |

New code should put logic in services and reserve models for data. The two conventions stay separate so that "where does this happen?" always has a clear answer — behaviour in the container, data in `getModel()`.
