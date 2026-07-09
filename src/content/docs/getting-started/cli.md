---
title: The command-line tool
description: The quiote CLI — scaffold an application, list routes, and inspect the environment.
---

Quiote ships a command-line tool, `quiote`, built on Symfony Console. Its built-in commands scaffold a new application (`new`), list an app's routes (`routes:list`), print framework/app info (`about`), and compile caches ahead of time (`routes:compile`, `cache:warmup`). Plugins can contribute more (see [Writing your own command](#writing-your-own-command)).

## Running it

The CLI comes with the framework, so [install Quiote](/getting-started/installation/) first. Every command except `new` also needs an application to point at (see [Application-aware commands](#application-aware-commands) below); `new` runs anywhere because it only writes files.

When Quiote is installed as a dependency, the binary is at `vendor/bin/quiote`. From a checkout of the framework itself it's `bin/quiote`.

```bash
vendor/bin/quiote list          # show all available commands
vendor/bin/quiote <command> --help   # options for one command
vendor/bin/quiote --version
```

`list`, `help`, and `--version` come from Symfony Console; the Quiote-specific commands are below.

## Commands

| Command | Purpose | Needs an app? |
|---|---|---|
| `new` | Scaffold a new Quiote application | No (writes files only) |
| `routes:list` | List routes from the app's routing service | Yes |
| `about` | Print framework and application info | Yes |
| `routes:compile` | Compile route/module introspection data into `cache/introspection/app.json` | Yes |
| `cache:warmup` | Compile and cache configuration ahead of time so workers start warm | Yes |

The three most commonly used — `new`, `routes:list`, and `about` — are documented in detail below.

### Application-aware commands

Every command except `new` bootstraps a real application, so it needs to find one. `new` does not — it only writes files and never boots the framework.

The app-aware commands all accept:

| Option | Default | Effect |
|---|---|---|
| `--app-dir` | `$QUIOTE_APP_DIR`, else an upward search | Path to the application directory. |
| `--env` | `$QUIOTE_ENV`, else `development` | Environment to bootstrap. |

**App-directory resolution order:** `--app-dir`, then `$QUIOTE_APP_DIR`, then a `.quiote.json` marker file (`{"app_dir": "...", "env": "..."}`) found by walking up from the current directory, then an upward search from the current directory for a `Config/settings.*` file. If none is found, the command errors and tells you to pass `--app-dir`, set `$QUIOTE_APP_DIR`, or run from inside an app directory. In practice, running the command from your project root just works.

## `new` — scaffold an application

Creates a self-contained, runnable application: a `Default` module with `Index`, `About`, `Boom`, and `Contact` actions (the last routed via a `#[Route]` attribute rather than in `AppRouting`, to demonstrate both routing styles), the config needed to boot (`settings`, `factories`, `databases`, `output_types`) plus a PHP `AppRouting` routing class, and a FrankenPHP-ready `pub/index.php`.

```bash
vendor/bin/quiote new my-app
```

| Argument / option | Default | Effect |
|---|---|---|
| `path` (argument, required) | — | Directory to create the application in. |
| `--namespace` | `App` | PSR-4 namespace prefix for the app (e.g. `App`, `SampleApp`). Must start with an uppercase letter. |
| `--config-format` | `php` | Format for the generated `settings` file: `php`, `yaml`, or `xml`. (The scaffold deliberately mixes formats: `factories` is always YAML and `databases`/`output_types` are always XML, so a generated app exercises all three config drivers.) |
| `--force`, `-f` | — | Write into a directory that already exists and is non-empty. |

```bash
# A YAML-configured app under a custom namespace
vendor/bin/quiote new ./shop --namespace Shop --config-format yaml
```

If the target directory exists and isn't empty, the command refuses unless you pass `--force`. The generated app has no `composer.json` of its own — its front controller registers a PSR-4 autoloader for its own namespace and locates a `vendor/autoload.php` that has Quiote in it.

After scaffolding, the command prints the next steps:

```bash
cd my-app
php -S localhost:8000 -t pub pub/index.php   # quick smoke test
# or, with FrankenPHP:
frankenphp php-server --root pub
```

The generated app serves `GET /`, `GET /about`, `GET /contact`, and `GET /boom` — `boom` deliberately throws, so you can see error handling (set `core.developer_exceptions` true in `Config/settings.*` for the Whoops page). See [Your first application](/getting-started/your-first-app/) for a walkthrough of what it generates.

## `routes:list` — list routes

Lists every route the app's configured routing service knows about — whatever the class named for the `routing` factory role exposes, whether declared in `Routing::build()`, via `#[Route]` attributes, or both merged together. It is a read-only view of the live result, not a second opinion. See [Routing](/basics/routing/).

```bash
vendor/bin/quiote routes:list
```

```
 Name    Path          Methods  Module   Action   Output type  Source
 ------- ------------- -------- -------- -------- ------------ ----------
 index   /             ANY      Default  Index                 File
 about   /about        ANY      Default  About                 File
 contact /contact      GET      Default  Contact               Attribute
```

Columns:

- **Methods** — the HTTP methods the route accepts, or `ANY` if unrestricted.
- **Source** — `Attribute` if the route's name was declared via a `#[Route]` attribute, `File` for anything else (`Routing::build()`, a programmatic builder, and so on).

Options (in addition to `--app-dir` / `--env`):

| Option | Default | Effect |
|---|---|---|
| `--context` | `core.default_context`, else `web` | Context to resolve the routing service from. |
| `--module` | — | Only show routes for this module (case-insensitive). |
| `--action` | — | Only show routes resolving to this action (case-insensitive). |
| `--sort` | `name` | Sort by `name`, `path`, `module`, or `action`. |
| `--json` | — | Output JSON instead of a table. |

```bash
vendor/bin/quiote routes:list --module Blog --sort path
vendor/bin/quiote routes:list --json
```

**Diagnostics and exit code:** the command independently scans `#[Route]` attributes and reports authoring problems (e.g. duplicate route names or paths) as warnings or errors above the table. If any diagnostic is an error, the command exits non-zero — useful in CI to catch route conflicts.

## `about` — framework and app info

Bootstraps the app and prints a short diagnostic table: Quiote version, application directory, environment, module directory, and namespace prefix.

```bash
vendor/bin/quiote about
```

It takes the standard `--app-dir` / `--env` options and nothing else. It's the simplest way to confirm the CLI can locate and boot your application.

## Writing your own command

Because the CLI is Symfony Console, a custom command is a standard Symfony `Command`. The one Quiote-specific piece is the base class `Quiote\Console\Command\AbstractAppCommand`, which handles bootstrapping a real application so your command has access to config, the context, and the DI container.

```php
<?php
declare(strict_types=1);

namespace App\Console;

use Quiote\Config\Config;
use Quiote\Context;
use Quiote\Console\Command\AbstractAppCommand;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\{InputInterface, InputOption};
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'cache:prune', description: 'Prune expired cache entries')]
final class PruneCacheCommand extends AbstractAppCommand
{
    protected function configure(): void
    {
        $this->configureAppOptions();   // adds --app-dir and --env
        $this->addOption('context', null, InputOption::VALUE_REQUIRED, 'Context to use', 'web');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->bootstrapApp($input);    // Config + Context now available
        $io = new SymfonyStyle($input, $output);

        $context = Context::getInstance((string) $input->getOption('context'));
        // resolve services via $context->getContainer()->get(...), read Config::get(...), etc.

        $io->success('Done.');
        return self::SUCCESS;
    }
}
```

The essentials:

- **`#[AsCommand(name:, description:)]`** names the command (this is also how it's de-duplicated).
- **`configure()`** — call `$this->configureAppOptions()` to get the standard `--app-dir` / `--env`, then add your own arguments and options.
- **`bootstrapApp($input)`** — call this first in `execute()`. It resolves the app directory, reads `--env`, boots the framework, and registers a fallback autoloader for your app's namespace. After it returns, `Config::get()` and `Context::getInstance()` work.
- **`execute()`** returns `self::SUCCESS` or `self::FAILURE`. Use `SymfonyStyle` for tables, titles, and status output.

A command that only writes files and never needs the framework (like a scaffolder) can extend Symfony's `Command` directly and skip `bootstrapApp()`.

### Registering the command

There is no directory scan for commands — you contribute yours through a [plugin](/architecture/plugins/), with `PluginRegistrar::command()`:

```php
$registrar->command(\App\Console\PruneCacheCommand::class);
```

Once a plugin registers it, the CLI picks it up (after the app is bootstrapped) and `vendor/bin/quiote cache:prune` runs. This is the same seam plugins use to ship their own commands, so an authentication or health-check plugin can add commands to your CLI without you wiring anything.
