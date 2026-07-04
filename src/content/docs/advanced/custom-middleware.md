---
title: Writing custom middleware
description: Add your own PSR-15 middleware to the pipeline and position it precisely.
---

Quiote's request pipeline is a plain PSR-15 stack (see [The middleware pipeline](/architecture/middleware-pipeline/)). Adding your own behaviour — a health check, a JWT authenticator, a tenant resolver — means writing a standard PSR-15 middleware and telling the pipeline where it goes.

There are two ways to place it:

- **`MiddlewareCatalog::register()`** — imperative: you pass a factory and explicit `before`/`after`/`priority`. Good for one-off wiring in a bootstrap file.
- **The `#[Middleware]` attribute + `MiddlewareCatalog::registerAttributed()`** — declarative: the class states its own placement, and it is ordered in the same pass as the framework's own middleware (which is how they order themselves). Good for reusable middleware that ships with its position.

Both are shown below.

## Write a PSR-15 middleware

Your middleware implements `Psr\Http\Server\MiddlewareInterface` — nothing Quiote-specific:

```php
<?php
namespace App\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Nyholm\Psr7\Response;

final class HealthzMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if ($request->getUri()->getPath() === '/healthz') {
            return new Response(200, ['Content-Type' => 'text/plain'], 'ok');
        }
        return $handler->handle($request);   // pass through
    }
}
```

Two things every middleware does: it can short-circuit by returning a response (as `/healthz` does), or delegate downstream with `$handler->handle($request)` and optionally post-process the returned response on the way back out.

## Option 1 — register()

The imperative way. Application middleware is added through `Quiote\Middleware\MiddlewareCatalog::register()`:

```php
public static function register(
    string   $fqcn,             // identity + label in the debug stack (use the class name)
    callable $factory,          // () => PSR-15 MiddlewareInterface (lazy; called when the pipeline builds)
    ?string  $after  = null,    // insert immediately AFTER this middleware's FQCN
    ?string  $before = null,    // insert immediately BEFORE this middleware's FQCN
    int      $priority = 0,     // tie-break ordering among registered middleware
): void
```

- **`$factory`** is called once, when the pipeline is first built. It returns the middleware instance — keep construction lazy so it does not run at registration time.
- **`$after` / `$before`** position your middleware relative to a built-in (see the anchor list below) *or* another registered middleware.
- If you give neither, the middleware is inserted **just before `SecurityMiddleware`** — a safe default: after routing and negotiation, before auth.

```php
use App\Middleware\HealthzMiddleware;
use App\Middleware\JwtAuthMiddleware;
use Quiote\Middleware\MiddlewareCatalog;
use Quiote\Middleware\RoutingMiddleware;
use Quiote\Middleware\SessionMiddleware;

MiddlewareCatalog::register(
    HealthzMiddleware::class,
    fn() => new HealthzMiddleware(),
    before: SessionMiddleware::class,        // answer /healthz before touching the session
);

MiddlewareCatalog::register(
    JwtAuthMiddleware::class,
    fn() => new JwtAuthMiddleware(),
    after: RoutingMiddleware::class,         // needs the matched route
);
```

## Register before the kernel runs

The pipeline is built lazily on the first request and cached for the worker's lifetime. **All registrations must happen before `Kernel::run()`.** Do it in a bootstrap class called from your front controller:

```php
// src/App/Bootstrap/MiddlewareBootstrap.php
final class MiddlewareBootstrap
{
    public static function register(): void
    {
        MiddlewareCatalog::register(/* ... */);
    }
}
```

```php
// pub/index.php — before the kernel runs
App\Bootstrap\MiddlewareBootstrap::register();

Quiote\Runtime\Kernel::create([
    'app_dir' => dirname(__DIR__),
    'env'     => getenv('QUIOTE_ENV') ?: 'production',
    'context' => 'web',
])->run();
```

## Built-in anchor points

Use any of these FQCNs (in `Quiote\Middleware\`) as a `before:` / `after:` target. This is the order their `#[Middleware]` attributes resolve to — outermost first:

```
ErrorHandlingMiddleware       (outermost — catches everything)
SessionMiddleware
TimingMiddleware
TraceMiddleware
PayloadParsingMiddleware
ContentNegotiationMiddleware
RoutingMiddleware             (route is known after this)
OutputTypeSyncMiddleware
CsrfInjectionMiddleware
CsrfValidationMiddleware
SecurityMiddleware            (authentication / authorization)
ValidationMiddleware
SlotMiddleware
DispatchMiddleware            (runs the action — effectively terminal)
AssetAggregationMiddleware
FormPopulationMiddleware
ExecutionTimeMiddleware
```

Place your middleware relative to the earliest built-in whose work it depends on. A route-aware middleware goes `after: RoutingMiddleware`; something that must run before the session is touched goes `before: SessionMiddleware`.

## Ordering rules and caveats

- **Register order matters for chains.** If middleware B is positioned `after: A` and A is itself a *registered* middleware, register A first — otherwise A is not in the stack yet when B looks for it, and B falls back to "before `SecurityMiddleware`". Use `priority` to make intent explicit rather than relying on registration order.
- **Register once.** Registrations are process-global static state, keyed by FQCN. Registering the same class twice overwrites the earlier entry.
- **A missing target falls back.** If the named `before:` / `after:` target is not found, the safe default (before `SecurityMiddleware`) applies.
- **Enable/disable.** Any middleware — framework or attributed — can be toggled off via `<middleware_config>` (see [The middleware pipeline](/architecture/middleware-pipeline/#enabling-and-disabling-middlewares)); a config entry overrides the attribute's `enabled` default. (`register()`-ed middleware is skipped when its FQCN is disabled the same way.)

## Verify the position

Do not reason about ordering — assert it. `MiddlewarePipeline::debugStack()` returns the ordered list of labels for the pipeline as actually built, including your middleware:

```php
$stack = $pipeline->debugStack();
// assert HealthzMiddleware appears before SessionMiddleware, etc.
```

## Option 2 — the `#[Middleware]` attribute

The declarative way. Every framework middleware carries a `#[Quiote\Middleware\Attribute\Middleware]` attribute that states its own placement, and the pipeline **computes the order from these attributes** — a scanner reads them and a topological resolver sorts them. This is not decorative: it is the actual source of the pipeline order. Your middleware can join that same ordering pass.

Put the attribute on your class and opt it into scanning with `registerAttributed()`:

```php
<?php
namespace App\Middleware;

use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Quiote\Middleware\Attribute\Middleware;

#[Middleware(phase: 'before_action', after: 'RoutingMiddleware')]
final class JwtAuthMiddleware implements MiddlewareInterface
{
    public function __construct(private TokenVerifier $tokens) {}   // autowired

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        // ...
        return $handler->handle($request);
    }
}
```

```php
// bootstrap, before Kernel::run()
use Quiote\Middleware\MiddlewareCatalog;

MiddlewareCatalog::registerAttributed(App\Middleware\JwtAuthMiddleware::class);
```

Unlike `register()`, there is no factory: an attributed middleware is built through the [DI container](/architecture/container/), so its constructor dependencies are autowired.

### The attribute

```php
#[Middleware(
    phase:    'before_action',   // which band it runs in (see below)
    priority: 0,                 // higher runs earlier within the band
    before:   null,              // run before this middleware (short name or FQCN)
    after:    null,              // run after this middleware (short name or FQCN)
    enabled:  true,              // default on; overridable via <middleware_config>
)]
```

- **`phase`** is the primary sort key — one of, in order: `bootstrap`, `pre_routing`, `pre`, `routing`, `before_action`, `action`, `after_action`, `finalize`. It groups middleware into the same coarse bands the pipeline has always used.
- **`before` / `after`** are hard ordering constraints (a topological sort). They may name a short class name (`'RoutingMiddleware'`) or a fully-qualified name. A cycle is a build error; an unresolved or ambiguous name logs a diagnostic and the constraint is dropped.
- **`priority`** (higher first) plus scan order break remaining ties within a band.
- **`enabled`** is the default on/off state; a `<middleware_config>` entry overrides it (see [The middleware pipeline](/architecture/middleware-pipeline/#enabling-and-disabling-middlewares)).

### register() vs registerAttributed()

- **`registerAttributed()`** joins the unified attribute ordering — it is sorted together with the framework middleware by phase/`before`/`after`/`priority`, and DI-resolved.
- **`register()`** is spliced in *after* that ordered stack is built, at the position its `before`/`after`/`priority` name (falling back to before `SecurityMiddleware`).
- If the same class is passed to **both**, `register()` wins outright — the attributed candidate is ignored and a warning is logged.

Either way, confirm placement with `debugStack()` (above) rather than reasoning about it.

## Replacing the entire stack (the footgun)

`register()` covers "add my middleware at this point" — the overwhelming majority of customization — and leaves every framework default intact around it. For the rare case where an application genuinely cannot run inside Quiote's request lifecycle at all, `MiddlewareCatalog::replaceCoreStack()` discards the built-in stack completely and lets you supply your own.

:::danger
This throws away **all** of Quiote's default middleware — error handling, sessions, CSRF, security, routing, validation, and dispatch. Once it is active, the framework guarantees none of them for that context. You own the entire pipeline, including producing a response and handling your own errors. This is deliberately a footgun; reach for it only if `register()` genuinely cannot express what you need.
:::

```php
use Quiote\Context;
use Quiote\Middleware\MiddlewareCatalog;
use Psr\Http\Server\MiddlewareInterface;

MiddlewareCatalog::replaceCoreStack(
    function (Context $context): array {
        return [
            new MyErrorMiddleware(),
            new MyRouterMiddleware($context),
            new MyDispatchMiddleware($context),
            // ...the complete, ordered stack you want to run
        ];
    },
    MiddlewareCatalog::REPLACE_CORE_STACK_ACKNOWLEDGEMENT,
);
```

Two guardrails make this hard to trigger by accident:

1. **An exact acknowledgement string.** The second argument must equal `MiddlewareCatalog::REPLACE_CORE_STACK_ACKNOWLEDGEMENT` verbatim — a long, explicit constant (`I_UNDERSTAND_THIS_DISCARDS_ERROR_HANDLING_SESSIONS_CSRF_SECURITY_AND_ROUTING`). Anything else throws `InvalidArgumentException`. A stray boolean or a config typo cannot flip this on.
2. **A warning on every build.** Whenever the replacement stack is built, the pipeline logs a `warning` naming what was bypassed, so the resulting behaviour is traceable in your logs rather than silent.

What you get and what you owe:

- Your factory receives the `Context` and returns the **complete ordered list** of PSR-15 middleware. There are no defaults around it.
- Quiote still appends its terminal sentinel after your stack — that is a PSR-15 contract requirement (the pipeline must yield a response instead of returning null), not an opinion about your stack's contents. So your stack must produce a response before reaching the end.
- **`register()`-ed middleware is not spliced in** when a replacement is active. If you want any of it, add it inside your factory yourself.
- Registered as it is (process-global static state), `replaceCoreStack()` must be called at bootstrap, before `Kernel::run()` — same timing as `register()`. `MiddlewareCatalog::reset()` clears it (along with registered middleware).

If you only need to *remove* a default or two — not the whole stack — do not use this. Disable the specific middlewares via `MiddlewareCatalog::initialize([Fqcn::class => false])` (see [The middleware pipeline](/architecture/middleware-pipeline/)) and keep everything else.
