---
title: Introduction
description: What Quiote is, where it came from, and whether it is the right framework for your project.
---

Quiote is a PHP 8.5+ MVC framework descended from [Agavi](https://www.agavi.org/) — itself a fork of Mojavi, one of the earliest PHP MVC frameworks. It targets **large, long-lived applications** where developers need fine-grained control over behaviour.

:::note[Version]
The latest stable release is **v1.2**.
:::

## Where the name comes from

Mojavi was named after the Mojave desert. The agave plant grows in that desert, so the fork became Agavi. Quiote is the flower (the *quiote*) that the agave sends up at the end of its life — the framework that blooms from Agavi.

Agavi started life around 2006 and was maintained into the mid-2010s. It kept serving production systems for roughly a decade after active development stopped. In 2025 the largest remaining Agavi user began porting it to PHP 8. What started as a direct port became a substantial rewrite once it was clear how much had changed in PHP and in the wider ecosystem — PSR-7/PSR-15, DI containers, and modern language features did not exist when Agavi was designed.

## What changed from Agavi

| Agavi | Quiote |
|---|---|
| Global/action filter chain | PSR-15 middleware pipeline |
| Bespoke request/response | PSR-7 (`nyholm/psr7`) |
| `factories.xml` instantiation | DI container with constructor injection |
| Ad-hoc logging | PSR-3 structured logging |
| XML-only config | PHP, YAML, or XML — mixed per file |
| Homegrown routing | Symfony Routing component |
| PHP 5 codebase | PHP 8.5+: enums, readonly, attributes |

## Who Quiote is for

Quiote is **not** a rapid-prototyping framework. There is no "make a CRUD app in five minutes" story, and it will not scaffold an admin panel for you. What it gives you instead is a skeleton with explicit, auditable behaviour and a configuration system flexible enough to accommodate unusual requirements.

It fits best when:

- The codebase is large and has many contributors.
- The project is long-lived and you expect it to outlive the current team.
- The integration surface is complex or unusual.
- A team needs to retain very fine control over how requests are handled.

If you need to ship something quickly with opinionated defaults that make common decisions for you, Laravel and Symfony are better choices. If you are migrating from Agavi, or building something you expect to maintain for a decade, read on — and see [Design philosophy](/getting-started/philosophy/) for *why* Quiote is deliberately unopinionated.

## A slim core, opinionated packages

That unopinionated stance is structural, not just cultural. The `quioteframework/quiote` kernel is a skeleton; the opinionated, heavier subsystems — rate limiting, the developer error page, an MCP server, OpenTelemetry, the Eloquent / Doctrine / Cycle / Propulsion ORM adapters, the PHPTAL / XSLT / Twig renderers, and PDO / cloud session backends — ship as separate `quioteframework/*` packages you install and enable only when you need them. (CSRF is the one that's on by default — a security posture you consciously disable rather than opt into.) See [Plugins overview](/plugins/overview/).
