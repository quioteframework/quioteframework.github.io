---
title: Installation
description: Requirements and installation instructions for Propulsion.
---

## Requirements

- PHP **8.5** or higher, with the `dom` (libxml2) extension enabled
- A supported database: PostgreSQL (recommended and default), MySQL, SQLite, Oracle, or MSSQL/SQL Server
- [Composer](https://getcomposer.org/)

Propulsion depends on a handful of Symfony components (`symfony/console`, `symfony/yaml`) and `psr/log` for its logging interface — Composer pulls these in automatically.

## Installing via Composer

:::caution
Propulsion is not yet on Packagist. Install directly from the GitHub repository until the first tagged release.
:::

```bash
composer require quioteframework/propulsion:dev-main
```

Or add it to your `composer.json` manually:

```json
{
    "require": {
        "quioteframework/propulsion": "dev-main"
    },
    "repositories": [
        {
            "type": "vcs",
            "url": "https://github.com/quioteframework/propulsion"
        }
    ]
}
```

Then run:

```bash
composer install
```

## The `bin/propulsion` CLI

Propulsion ships a single console script, `bin/propulsion`, that replaces everything Propel 1 did through Phing. It's a plain [Symfony Console](https://symfony.com/doc/current/components/console.html) application — no `build.xml`, no Ant, no `propel-gen` wrapper script. Check that it's available:

```bash
vendor/bin/propulsion
```

This prints the Propulsion version and the list of available commands. The ones you'll use most while getting started:

| Command | Purpose |
|---|---|
| `init` | Scaffold a new project's directory structure, a sample schema, and a starter config file |
| `model:build` | Generate Object Model and Query classes from a schema |
| `sql:build` | Generate SQL DDL from a schema |
| `sql:exec` | Run `.sql` files against a live database |
| `sql:diff` | Compare a schema against a live database and generate migration SQL |
| `schema:reverse` | Generate a schema from an existing database |
| `graph:build` | Render a schema as a Graphviz diagram |

See [Building your schema](/propulsion/getting-started/schema-and-build-time/) for `model:build` and `sql:build` in detail, and [Migrating from Propel 1](/propulsion/getting-started/migrating-from-propel/) for the full old-Phing-target-to-new-command mapping.

## Scaffolding a new project with `init`

`bin/propulsion init` asks a couple of questions and creates a starting point for a new project:

```bash
vendor/bin/propulsion init
```

It prompts for a project name (used to name the generated directory and the sample database) and a database platform (`mysql`, `postgresql`, `sqlite`, `oracle`, or `mssql`), then creates:

- `<project>/schema/` — holds your schema XML files, seeded with a sample `schema.xml` describing a small `user`/`post` data model (with a `timestampable` behavior and a foreign key between them) so you have something to build against immediately
- `<project>/generated-classes/` — the default output directory `model:build` writes Object Model and Query classes into
- `<project>/generated-sql/` — the default output directory `sql:build` writes DDL into
- a starter connection configuration file with a DSN guessed from the platform you picked (e.g. `pgsql:host=localhost;dbname=<project>`) and placeholder credentials you'll need to edit

Treat the generated config as a starting point rather than a final answer — for a real project you'll want to move to a `build.php` file (see [Building your schema](/propulsion/getting-started/schema-and-build-time/)) once you're past the initial scaffold. From there, the workflow is the same one `init` prints at the end: edit the schema, run `model:build`, then `sql:build` and `sql:exec` to create the tables.

## Next steps

With Propulsion installed, move on to [Building your schema](/propulsion/getting-started/schema-and-build-time/) to describe a data model in XML and generate PHP classes from it.
