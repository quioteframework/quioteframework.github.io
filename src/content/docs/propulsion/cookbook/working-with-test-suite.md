---
title: Working with Propulsion's Test Suite
description: Running and writing tests against Propulsion's PHPUnit and Testcontainers-based suite.
---

Propulsion's own test suite looks quite different from Propel 1's — it's still PHPUnit-based, but the Phing/manual-database-setup workflow described in Propel 1's cookbook is gone, replaced by Testcontainers spinning up real, disposable databases automatically. This page describes the suite as it exists in the Propulsion repository today; if you're contributing to Propulsion itself (rather than just using it in an app), this is what you'll actually run.

## Where the tests live

Test classes and support files live under `test/` in the Propulsion repository (not `tests/`, and not namespaced under a `Propulsion\Tests\` PSR-4 root — the suite predates the `Propel` → `Propulsion` rename and still references generator classes like `Criteria`, `ModelCriteria`, `Behavior`, and `XmlToAppData` by their bare historic names; `test/bootstrap.php` eagerly aliases these before PHPUnit loads any test file):

```
test/
├── bootstrap.php
├── phpunit.xml
├── fixtures/       # schema fixtures (bookstore, schemas, namespaced, ...)
├── testsuite/
│   ├── generator/  # build-time / code-generation tests
│   ├── runtime/    # runtime tests (Session, ServiceContainer, PropulsionPDO, ...)
│   └── misc/
├── tools/helpers/  # base test-case classes (BookstoreTestBase, ...)
└── worker/         # FrankenPHP worker-mode black-box test harness
```

## Running the suite

The full suite runs against a real PostgreSQL database, provisioned automatically via [Testcontainers](https://testcontainers.com/) — there's no manual `CREATE DATABASE`/`GRANT` step to run first, unlike Propel 1's setup:

```bash
cd test
rm -rf fixtures/bookstore/build fixtures/schemas/build fixtures/namespaced/build
../vendor/bin/phpunit -c phpunit.xml
```

The first run pulls a `postgres:latest` image and builds the Bookstore fixture classes into the testcontainer, which takes a few minutes; subsequent runs are faster. Requires Docker.

### Skipping the database-backed tests

If Docker isn't available, set `PROPULSION_SKIP_INTEGRATION=1` to skip everything that needs a live database connection:

```bash
PROPULSION_SKIP_INTEGRATION=1 ../vendor/bin/phpunit -c phpunit.xml
```

Pure generator-output and object-model tests (inspecting generated PHP class shape, building SQL strings in memory against a swapped-in platform adapter, and so on) don't touch a database at all and still run — and still exercise real code generation via the same `ModelManager`/`SqlManager` classes `bin/propulsion` itself uses — under `PROPULSION_SKIP_INTEGRATION=1` or with no Docker present.

### Testing against MySQL instead of PostgreSQL

PostgreSQL is the suite's default target, matching Propulsion's own PostgreSQL-first design, but you can point the main Bookstore fixture at a MySQL testcontainer instead:

```bash
PROPULSION_TEST_DB=mysql ../vendor/bin/phpunit -c phpunit.xml
```

This is useful for checking whether a test failure is a genuine bug or an expected MySQL/PostgreSQL SQL-semantics difference before writing a platform-conditional branch into a test — see `IntegrationDatabase::currentPlatform()` in the test helpers.

### Cleaning up leaked containers

`IntegrationDatabase` stops its containers via `register_shutdown_function()`, which doesn't run if a test run is killed with `kill -9` or a hard `timeout`. Every container this suite starts is labeled `propulsion.test-container=true`, so a leaked container can always be found and removed regardless of what killed the process:

```bash
composer test:cleanup-containers
```

### Worker-mode tests

A separate black-box harness under `test/worker/` builds a [FrankenPHP](https://frankenphp.dev/) worker-mode Docker image, starts it, and drives it with real sequential HTTP requests to prove Propulsion's worker-safety guarantees hold under an actual persistent-worker process — not just in the unit tests that exercise `Session::reset()` directly. It asserts on things like: no pooled-instance bleed across requests, dangling transactions from one request don't affect the next, the same `PropulsionPDO` connection is reused across requests, and memory stays flat under sustained load. Run it with:

```bash
composer test:worker
```

Skips cleanly if Docker isn't available, or if `PROPULSION_SKIP_INTEGRATION=1` is set — same convention as `IntegrationDatabase`. Its container is labeled the same way, so a leaked one is covered by `composer test:cleanup-containers` too. Set `WORKER_TEST_LOAD_REQUESTS` to change the sustained-load request count (defaults to 500).

## Current status

As of this writing, the full Docker/Postgres suite is green: 2263 tests, 0 errors, 0 failures, 0 risky, 14 skipped. See [`KNOWN_ISSUES.md`](https://github.com/quioteframework/propulsion/blob/main/KNOWN_ISSUES.md)'s "Test suite status" section for the up-to-date count and any currently-tracked flakiness — it's the authoritative source, since this can drift as the suite grows.

## How tests work

Every method beginning with `test` in a test class is run as its own test case by PHPUnit. Tests run in isolation: `setUp()` runs before each test, `tearDown()` after each.

The base classes under `test/tools/helpers/` set up and tear down shared fixtures for you:

| Class | Needs a database | Use for |
|---|---|---|
| `BookstoreTestBase` | Yes | Model classes with real database access — populates and depopulates the Bookstore fixture data around each test. |
| `BookstoreEmptyTestBase` | Yes | Like `BookstoreTestBase`, but without the sample data population step. |
| `SchemasTestBase` | Yes | Tests exercising SQL-schema support (see [Using SQL Schemas](/propulsion/cookbook/using-sql-schemas/)). |
| `CmsTestBase` | Yes | The CMS/delegate-behavior fixture. |

Database-backed test classes guard their own `setUp()`/`tearDown()` so that a clean skip under `PROPULSION_SKIP_INTEGRATION=1` stays a skip rather than turning into an error — if you add a new database-dependent base class or test, make sure `tearDown()` only runs cleanup when `setUp()` actually got as far as opening a connection.

## Writing tests

If you've changed a code-generation template or a runtime behavior, write a unit test proving it works and keeps working. Writing a test usually means adding a method to an existing test class — for example, adding a `testSaveWithDefaultValues()` method to `GeneratedObjectTest` to check that saving an object with only default values set still works correctly:

```php
<?php
/**
 * Test saving an object when only default values are set.
 */
public function testSaveWithDefaultValues(): void
{
    // Relies on a default value of 'Penguin' specified in the schema
    // for the publisher.name column.
    $pub = new Publisher();
    $pub->setName('Penguin');
    // In the past this wouldn't have marked the object as modified,
    // since 'Penguin' is the value already set for that attribute.
    $pub->save();

    // If getId() returns the new ID, save() worked.
    $this->assertNotNull($pub->getId(), 'Expected Publisher::save() to work with only default values.');
}
```

Run it directly to check it passes:

```bash
cd test
../vendor/bin/phpunit testsuite/generator/builder/om/GeneratedObjectTest.php
```

You can also add new test classes anywhere under `test/testsuite/` — PHPUnit picks them up automatically as long as they match the configured suite directories in `phpunit.xml`.

## Static analysis

Run PHPStan before opening a pull request:

```bash
composer analyse
```

CI (`.github/workflows/tests.yml`) runs both a no-Docker `unit` tier and the Docker-backed `integration` tier on every push and pull request; both are blocking.
