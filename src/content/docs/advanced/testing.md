---
title: Testing your application
description: Unit-testing actions and services, driving the full pipeline, and process isolation for worker-safe tests.
---

Quiote targets long-lived codebases, so it ships a test harness built on **PHPUnit**. The framework's own test suite is the reference: it runs the real container, real config, and (for flow tests) the real middleware pipeline against PSR-7 requests. This page covers the patterns that suite actually uses.

## Running tests

Tests are driven by PHPUnit through Composer scripts:

```bash
composer test              # the default suite (unit, flow, fragment, psr)
composer test:apcu         # APCu config-cache tests (needs apc.enable_cli)
composer test:integration  # database integration tests (Docker / Testcontainers)
composer test:e2e          # end-to-end tests (Docker)
```

The default run uses `tests/config/phpunit.xml`, which excludes the `apcu`, `e2e`, and `integration` groups so the common case stays fast and Docker-free. The slower suites are opt-in.

## The foundation: `UnitTestCase`

Most tests extend `Quiote\Testing\UnitTestCase`. It bootstraps the framework once (in the `testing` environment) and gives you a live `Context` plus a helper for building requests:

```php
use Quiote\Testing\UnitTestCase;

final class OrderServiceTest extends UnitTestCase
{
    public function testPlacingAnOrderPersistsIt(): void
    {
        $context = $this->getContext();
        $service = $context->getService(\App\Service\OrderService::class);

        $order = $service->placeOrder($this->sampleCart());

        $this->assertNotNull($order->id);
    }
}
```

`getContext()` returns the bootstrapped context, so you can resolve services, models, and other collaborators exactly as the running application would. For request-driven code, `newWebRequest($params, $whitelist)` builds a PSR-7 `WebRequest` with the given parameters already whitelisted (so [strict parameter access](/basics/requests-and-responses/#strict-parameter-access) doesn't get in the way):

```php
$request = $this->newWebRequest(['name' => 'Ada']);
$result  = $service->handle($request);
```

This — a `UnitTestCase` that resolves the unit under test from the context and exercises it directly — is the dominant pattern in the framework's own suite, and the one to reach for first.

## Testing the full pipeline

To test a request end to end — routing outcome, middleware, action, view, response — compose the middleware stack yourself against a PSR-7 request. This is how the framework's pipeline tests work and is the most faithful way to test dispatch:

```php
use PHPUnit\Framework\TestCase;
use Nyholm\Psr7\ServerRequest;
use Relay\Relay;
use Quiote\Quiote;
use Quiote\Execution\ActionDescriptor;
use Quiote\Middleware\{ErrorHandlingMiddleware, SecurityMiddleware, ValidationMiddleware, DispatchMiddleware};

final class ShowPostFlowTest extends TestCase
{
    public function testItRenders(): void
    {
        Quiote::bootstrap('testing', 'web', ['prewarm' => false]);
        $controller = Quiote::context('web', true)->getController();

        $descriptor = new ActionDescriptor('Blog', 'ShowPost', 'GET', 'html', false);
        $stack = [
            new ErrorHandlingMiddleware(),
            new SecurityMiddleware($controller),
            new ValidationMiddleware($controller),
            new DispatchMiddleware($controller),
        ];

        $request = (new ServerRequest('GET', 'http://localhost/blog/1'))
            ->withAttribute('module', 'Blog')
            ->withAttribute('action', 'ShowPost')
            ->withAttribute('output_type', 'html')
            ->withAttribute(ActionDescriptor::class, $descriptor);

        $response = (new Relay($stack))->handle($request);

        $this->assertSame(200, $response->getStatusCode());
    }
}
```

Because this runs the actual middleware, it catches wiring problems a unit test wouldn't — security decisions, validation pruning, view resolution.

:::caution[Exercise the error path too, not just the happy path]
A custom middleware that reads or modifies the response (adding a header, say) can pass every happy-path assertion and still silently do nothing on an error response, if it's positioned relative to `ErrorHandlingMiddleware` incorrectly — see [Writing custom middleware: ErrorHandlingMiddleware placement](/advanced/custom-middleware/#errorhandlingmiddleware-before-and-after-are-not-symmetric). When you write a flow test for a new middleware that touches the response, add a second case that dispatches to a route that throws and assert your middleware's effect still shows up on the resulting error response — not just the 200 case.
:::

## The fragment harness

The framework also ships focused base classes for testing a single MVC fragment in isolation, without going through routing:

| Base class | For testing |
|---|---|
| `ActionTestCase` | One action's dispatch outcome (which view it returns) and validation |
| `ViewTestCase` | One view's output for an output type |
| `FlowTestCase` | A full request flow via the controller |
| `FragmentTestCase` | Shared base for the action/view fragment cases |

`ActionTestCase` is the most useful of these. You set the module and action, seed parameters, optionally run validation, then dispatch and assert on the resolved view name:

```php
use Quiote\Testing\ActionTestCase;

final class SaveUserActionTest extends ActionTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->moduleName = 'User';
        $this->actionName = 'Save';
    }

    public function testWriteReturnsSuccessView(): void
    {
        $this->setRequestMethod('write');                 // POST
        $this->applyRequestParameters(['name' => 'Ada']);

        $this->performValidation();
        $this->assertTrue($this->validationSuccess);

        $this->runAction();
        $this->assertViewNameEquals('Success');
    }
}
```

:::note[These base classes are transitional]
`ActionTestCase`, `ViewTestCase`, `FlowTestCase`, and `ContainerTestCase` emulate a pre-PSR-7 execution container that has since been removed, and the framework's own suite has largely moved to `UnitTestCase` plus the middleware-composition pattern above. Some assertions on these classes depend on the removed container and will not behave — notably `ViewTestCase`'s response/header/cookie assertions and `ActionTestCase`'s argument assertions unless you called `performValidation()`. `ContainerTestCase` refers to that old *execution* container, **not** the DI container. For new tests, prefer `UnitTestCase` and pipeline composition; use `ActionTestCase` for the view-name-outcome case where it fits.
:::

## Process isolation

Quiote holds a lot of process-wide state — the config store, compiled config, the APCu cache, context singletons. Under [worker mode](/architecture/deployment/) that state persists across requests by design; in a test process it means one test's environment or locale change can poison later tests in the same process. The harness solves this with **process isolation** plus a clean re-bootstrap per isolated test.

Mark a test class (or method) to run in a separate process and declare the environment it should bootstrap:

```php
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Quiote\Testing\Attributes\{IsolationEnvironment, IsolationDefaultContext, ClearIsolationCache};

#[RunTestsInSeparateProcesses]
#[IsolationEnvironment('testing.integration')]
#[IsolationDefaultContext('web')]
#[ClearIsolationCache]
final class LocaleSensitiveTest extends \Quiote\Testing\PhpUnitTestCase
{
    #[IsolationEnvironment('testing.other')]   // method-level override wins
    public function testInAnotherEnvironment(): void { /* ... */ }
}
```

The isolation attributes:

| Attribute | Effect |
|---|---|
| `IsolationEnvironment('name')` | Bootstrap this environment in the isolated process. |
| `IsolationDefaultContext('name')` | Set `core.default_context` for it. |
| `ClearIsolationCache` | Clear the compiled-config/cache dir first. |
| `Bootstrap(false)` | Skip bootstrapping Quiote in the child. |

Under the hood a bootstrap script (`IsolatedBootstrap`) re-establishes a pristine framework in the child process — the test-time equivalent of a fresh worker. The project's `phpunit.xml` sets `QUIOTE_ISOLATION_*` environment variables to configure this suite-wide. Reach for isolation whenever a test mutates global state (environment, locale, default context) that a sibling test could inherit.

## E2E and integration groups

Two heavier suites are gated by stock PHPUnit groups so they stay out of the default run:

- **`#[Group('integration')]`** — database integration tests that spin up real databases with Testcontainers. Run with `composer test:integration`.
- **`#[Group('e2e')]`** — end-to-end tests that stand up a real FrankenPHP worker (and, for telemetry, an OpenTelemetry collector) via docker-compose and assert on live behaviour. Run with `composer test:e2e`.

Both need Docker and are excluded from `composer test`, so day-to-day development stays fast while the full-stack checks remain available in CI.
