---
title: Migrating from Propel 1
description: What changed between Propel 1 and Propulsion, and how to move an existing project over.
---

Propulsion is a hard fork of [Propel 1](https://github.com/propelorm/Propel1), not a rewrite from scratch — the schema format, the generated Active Record/Query class shapes, and almost the entire runtime API carry over unchanged. Moving an existing Propel 1 project to Propulsion is mostly a rename, plus a handful of deliberate breaking changes described below. This page assumes Propel **1** (XML schema, `build.properties`, `Criteria`/`Peer` classes) — Propel 2 is a separate, incompatible codebase and out of scope here.

## Namespace and package rename

Every `Propel*` class and namespace became `Propulsion*`. There's no compatibility shim or aliasing layer — this is a mechanical find-and-replace across your codebase and generated classes:

```
Propel\Runtime\...        → Propulsion\Runtime\...
PropelPDO                 → PropulsionPDO
PropelException           → PropulsionException
Propel::init(...)         → Propulsion::init(...)
```

Regenerate your models after updating (`bin/propulsion model:build`) rather than hand-editing generated code — see [Building your schema](/propulsion/getting-started/schema-and-build-time/).

## Phing is gone; use the `propulsion` console app

Propel 1's Phing-based build tooling (`propel-gen`, `build.xml`) has been removed entirely and replaced with a plain [Symfony Console](https://symfony.com/doc/current/components/console.html) application, `bin/propulsion`:

| Propel 1 (Phing) | Propulsion (`bin/propulsion`) |
|---|---|
| `propel-gen om` | `model:build` |
| `propel-gen sql` | `sql:build` |
| `propel-gen insert-sql` | `sql:exec` |
| `propel-gen diff-sql` | `sql:diff` |
| `propel-gen reverse` | `schema:reverse` |
| `propel-gen graph` | `graph:build` |
| — | `init` (scaffold a new project) |

Schema migrations keep the same three-verb shape, now as subcommands: `migration:status`, `migration:up`, `migration:down` (Propel 1's equivalents were also Phing targets — `propel-gen migration-status`, `-migrate`, `-migrate-down`). Data fixtures move the same way: `data:dump`, `data:sql`.

No Ant/XML build file is required anymore. `default.php` — a plain PHP file returning a flat `['propulsion.foo' => ...]` array — replaces `default.properties` as the base configuration Propulsion ships with; see [Configuration](/propulsion/basics/configuration/) and the [configuration file reference](/propulsion/reference/configuration-file/) for the full property list and how overrides merge.

## `build.properties` still works, but prefer `build.php`

You don't have to rewrite your project's configuration to migrate: a legacy `build.properties` text file is still read and parsed the same way it always was. But new projects — and any project actively being modernized — should prefer a `build.php` file returning a plain array, passed with `--config` (repeatable) on the console commands. It's the same flat `propulsion.*` key space either way; `${propulsion.some.key}` placeholder interpolation resolves identically regardless of which format produced the merged array.

## PostgreSQL is now the default database

Propel 1 defaulted to MySQL. Propulsion's `propulsion.database` default is `pgsql`, and PostgreSQL (15+) gets the most feature-parity attention across the platform, schema-parser, and SQL-builder classes — it's what this project's own test suite and CI run against by default. MySQL, SQLite, Oracle, and MSSQL/SQL Server are all still fully supported; if your project targets one of them, set `propulsion.database` explicitly in your `build.php`/`build.properties`, or pass `--database` on the console commands, same as before.

## `useQuery()`/`endUse()` → `withQuery()`

This is the main runtime-API change, and the only one with automated tooling. `useQuery()`/`endUse()` (and the generated `use<Relation>Query()` wrappers) still work exactly as before and aren't going away, but they're now `@deprecated` in favor of a closure-scoped replacement — `withQuery()` on `ModelCriteria`, with a generated `with<Relation>Query()` sibling next to every `use<Relation>Query()`:

```php
// Propel 1 / still-supported Propulsion style
$books = BookQuery::create()
    ->useAuthorQuery()
        ->filterByFirstName('Jane')
    ->endUse()
    ->find();

// Propulsion's preferred style
$books = BookQuery::create()
    ->withAuthorQuery(fn ($q) => $q->filterByFirstName('Jane'))
    ->find();
```

The reason: `endUse()` can't statically know which concrete query class originally called `useQuery()` — that's only tracked at runtime — so it's typed to return the generic `ModelCriteria` base class, which collapses the type of every chained call after it and breaks IDE autocomplete and PHPStan inference for the rest of the chain. The closure form has no `endUse()` to mistype; "switching back" is just the callback returning. It also composes cleanly for relations nested to any depth, including multiple sibling relations queried inside the same outer relation:

```php
$q->withAuthorQuery(fn ($author) => $author
    ->withBookQuery(fn ($book) => $book->filterByTitle('War And Peace'))
    ->withPublisherQuery(fn ($publisher) => $publisher->filterByName('Penguin')));
```

**Automated migration:** Propulsion ships a [Rector](https://github.com/rectorphp/rector) rule, `Propulsion\Generator\Rector\UseQueryToWithQueryRector`, that mechanically rewrites `useQuery()->...->endUse()` chains — including the generated `use<Relation>Query()` form and nested/sibling chains at any depth — into the `withQuery()`/`with<Relation>Query()` form above. It ships as part of Propulsion's own source, so it's available as soon as you require the package; you only need Rector itself installed to run it:

```bash
composer require --dev rector/rector
```

```php
// rector.php
use Propulsion\Generator\Rector\UseQueryToWithQueryRector;
use Rector\Config\RectorConfig;

return RectorConfig::configure()
    ->withPaths([__DIR__ . '/src'])
    ->withRules([UseQueryToWithQueryRector::class]);
```

Regenerate your models first (`bin/propulsion model:build`), so the `with<Relation>Query()` wrappers the rewritten code calls actually exist — the rule doesn't check this for you, it's a purely syntactic rewrite. Then, as with any Rector rule, review before applying:

```bash
vendor/bin/rector process --dry-run
vendor/bin/rector process
```

The rule rewrites any fluent (single-expression) chain built directly off `useQuery()`/`use<Relation>Query()` and closed by a matching `endUse()`, with other relations or plain method calls (`where()`, `_or()`, `filterBy*()`, `add()`, …) nested or sequenced in between — those pass through into the closure body untouched. It deliberately leaves alone chains split across variables instead of one fluent expression (e.g. `$sub = $q->useQuery('x'); ...; $sub->endUse();`), since that shape can't be mechanically rewritten into a closure the same way.

## PHP version and syntax

Propulsion targets PHP **8.5+**. The PHP5-era builder classes (`PHP5PeerBuilder`, `PHP5ObjectBuilder`, etc., previously selectable via `propulsion.targetPlatform=php5`) have been removed from the codebase entirely — archived under `archaeology/php5-builders/` for reference — and generated code uses current PHP syntax and types throughout. If your project's generated classes still date from a PHP 5-targeted build, regenerate them; there's no runtime support for the old output left to fall back to.

## Logging: PSR-3, no implicit fallback

Propulsion logs through [PSR-3](https://www.php-fig.org/psr/psr-3/) (`Psr\Log\LoggerInterface`) instead of Propel 1's Zend/sfLogger-flavored logging. It ships no concrete logger implementation — register your own (Monolog or any other PSR-3 logger) after `Propulsion::init()`. If you don't register one, `Propulsion::log()` is a no-op; there's no implicit `error_log()` fallback the way older Propel logging configurations sometimes provided. See [Logging](/propulsion/basics/logging/) for the full setup, including per-connection logger overrides.

## What didn't change

The schema XML format, the generated Active Record method shapes (`getFoo()`/`setFoo()`, `save()`, `delete()`), `ModelCriteria`/`Query` filtering methods (`filterBy*()`, `where()`, `_or()`), behaviors (schema-level `<behavior>` elements), and single/concrete-table inheritance are all unchanged in shape from Propel 1 — see [Behaviors](/propulsion/behaviors/) and [Inheritance](/propulsion/basics/inheritance/). If a page in this documentation doesn't call out a Propulsion-specific difference, assume Propel 1's behavior applies as-is.

## Known gaps

Propulsion's [`KNOWN_ISSUES.md`](https://github.com/quioteframework/propulsion/blob/main/KNOWN_ISSUES.md) tracks currently open issues and remaining modernization work in detail — worth a read before migrating a large or unusual schema (nested-set behavior completeness and namespaced single-table-inheritance edge cases are called out there specifically).
