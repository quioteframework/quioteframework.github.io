---
title: Configuration
description: Build-time config (build.php, --config, property interpolation) and runtime config (Propulsion::init()).
---

Propulsion has two entirely separate configuration surfaces: **build-time** configuration, read by `bin/propulsion` while generating code/SQL, and **runtime** configuration, read by `Propulsion::init()` when your application boots and needs to open database connections. They don't share a file format or a loader.

## Build-time configuration

The code generator's build properties are a single flat namespace of `propulsion.*` keys — everything from `propulsion.database` to per-builder class overrides. `generator/default.php` ships Propulsion's own defaults for every key; your project overrides only the ones it needs to change.

### `build.php` (preferred)

A `build.php` file is a plain PHP file returning a flat array:

```php title="build.php"
<?php

return [
    'propulsion.database' => 'pgsql',
    'propulsion.targetPackage' => 'App\\Model',
];
```

Pass it with `--config` (repeatable — later files win on conflicting keys, so a base file plus a per-environment override both work):

```bash
vendor/bin/propulsion model:build --config=build.php
vendor/bin/propulsion model:build --config=build.php --config=build.local.php
```

### `build.properties` (legacy)

A `build.properties` text file — Propel 1's original `key = value` format — still works unchanged, and is dispatched to the same loader based on file extension (anything that isn't `.php` is parsed as legacy properties):

```properties title="build.properties"
propulsion.database = pgsql
propulsion.targetPackage = App.Model
```

```bash
vendor/bin/propulsion model:build --config=build.properties
```

There's no need to migrate an existing `build.properties` just to move to Propulsion — only prefer `build.php` for new configuration, since a plain PHP array gets you IDE autocomplete and static analysis that a text file can't.

### Property interpolation

Both formats resolve `${propulsion.some.key}` placeholders the same way, against the fully-merged flat array — this is why, for example, `generator/default.php` can define `propulsion.platform.class` as `${propulsion.platform.${propulsion.database}.class}` and have it resolve correctly once `propulsion.database` is set, regardless of whether that setting came from `default.php`, your `build.php`, or an ad-hoc `--database` override:

```php title="build.php"
<?php

return [
    'propulsion.database' => 'pgsql',
    // resolves to the same value as propulsion.output.dir, whatever that is
    'propulsion.migration.dir' => '${propulsion.output.dir}/migrations',
];
```

Resolution runs several passes so nested placeholders (a placeholder whose value is itself another placeholder) resolve correctly, not just one level deep.

### Connection config for `sql:diff`/migrations

`sql:diff`, `migration:status`, `migration:up`, and `migration:down` need to open a real database connection, which is a different, smaller piece of configuration than the generator's `propulsion.*` build properties — a `buildtime-conf.php` (or legacy `buildtime-conf.xml`) file, passed with `--buildtime-conf`:

```php title="buildtime-conf.php"
<?php

return [
    'default' => 'bookstore',
    'datasources' => [
        'bookstore' => [
            'adapter'  => 'pgsql',
            'dsn'      => 'pgsql:host=localhost;dbname=bookstore',
            'user'     => 'me',
            'password' => 'secret',
        ],
    ],
];
```

See [Migrations](/propulsion/basics/migrations/) for this file in context.

## Runtime configuration

Your generated application code — the actual `Book`, `BookQuery`, and friends — needs to know how to open a database connection when it runs, independent of any of the build-time settings above. This is `Propulsion::init()`, called once at application bootstrap, before any generated class touches the database:

```php
<?php
use Propulsion\Propulsion;

Propulsion::init('/path/to/generated-conf/bookstore-conf.php');
```

The runtime config file is a plain PHP file returning an array — there's no XML format for this in Propulsion (Propel 1's `runtime-conf.xml` has no direct successor; a PHP array replaces it):

```php title="generated-conf/bookstore-conf.php"
<?php

return [
    'datasources' => [
        'default' => 'bookstore',
        'bookstore' => [
            'adapter' => 'pgsql',
            'connection' => [
                'dsn'       => 'pgsql:host=localhost;dbname=bookstore',
                'user'      => 'me',
                'password'  => 'secret',
                'classname' => 'PropulsionPDO',
                'settings' => [
                    'queries' => [
                        'SET lock_timeout = 5000',
                        'SET statement_timeout = 15000',
                    ],
                ],
            ],
        ],
    ],
];
```

`datasources.default` names which entry is used when generated code doesn't specify one explicitly; every other top-level key under `datasources` is a named connection matching a `<database name="...">` from your schema. `connection.classname` selects the PDO wrapper class — `PropulsionPDO` for normal use, `DebugPDO` to enable query counting and full query logging during development (see [Logging](/propulsion/basics/logging/)). `connection.settings.queries` lists SQL statements run once immediately after the connection opens — session-level settings like statement timeouts, exactly as in the example above.

You can skip the file entirely and pass the same array straight to `Propulsion::setConfiguration()` if you're assembling it from environment variables or a secrets manager at boot time:

```php
<?php
Propulsion::setConfiguration([
    'datasources' => [
        'default' => 'bookstore',
        'bookstore' => [
            'adapter' => 'pgsql',
            'connection' => [
                'dsn'      => getenv('DATABASE_DSN'),
                'user'     => getenv('DATABASE_USER'),
                'password' => getenv('DATABASE_PASSWORD'),
            ],
        ],
    ],
]);
Propulsion::initialize();
```

`Propulsion::init($path)` is exactly `Propulsion::configure($path)` (which `include`s the file and calls `setConfiguration()`) followed by `Propulsion::initialize()` — use whichever entry point fits how your application assembles its configuration.

:::note
This runtime config array is process-global, read once at boot. If you're deploying under a persistent worker (FrankenPHP, RoadRunner, Swoole), call `Propulsion::init()` once at worker start, not per request — the same way you'd configure any other process-scoped singleton. Connections themselves follow the same process-scoped rule, but per-request state (instance pools, dangling transactions) doesn't — see [The instance pool § Worker-safety](/propulsion/getting-started/basic-crud/#worker-safety-pools-are-per-request-not-per-process) for the `Propulsion::getSession()->reset()` call your request boundary needs to make.
:::
