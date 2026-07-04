---
title: Design philosophy
description: Why Quiote is deliberately unopinionated, and where opinionated defaults may live in the future.
---

Quiote puts **choice and freedom over limiting conventions**. Most frameworks make a large set of decisions for you and ask you to follow them. Quiote makes as few as it can, and hands the rest back.

This page explains that stance — why it exists, what it costs, and where opinionated tooling fits in.

## Quiote is a skeleton, not a kit

Quiote is not a website construction kit. It is a skeleton over which you build your application. The framework gives you a request pipeline, a container, a config system, routing, validation, and rendering — and then gets out of the way.

Concretely, that means Quiote does not decide:

- **How you structure your business logic.** There is no mandated repository, service, or "model" pattern. A service is a plain object with constructor-injected dependencies; how you organise those objects is yours.
- **How you talk to your database.** Quiote ships PDO and several Doctrine/Propel connectors, but no ORM is required, and nothing forces one query style over another.
- **How you render output.** The default renderer is plain PHP templates. PHPTAL and XSLT renderers exist. You wire whichever you want per output type.
- **What your config looks like on disk.** The same config can be written as PHP, YAML, or XML — per file. See [Configuration](/architecture/configuration/).

## Why build it this way

Three reasons, all downstream of the target audience — large, long-lived codebases.

1. **Conventions are cheap to adopt and expensive to leave.** A convention that saves a week in month one can cost a quarter in year five, when the application has grown past the shape the convention assumed. Quiote optimises for the year-five case: explicit wiring you can read and change, rather than implicit behaviour you have to work around.

2. **Auditability.** In a large system with many contributors, "where does this happen?" is asked constantly. Quiote answers it with an explicit [middleware pipeline](/architecture/middleware-pipeline/) — routing, security, validation, CSRF, and dispatch are each a named object in a list you can print. Nothing important happens by magic.

3. **Integration.** The applications Quiote is built for tend to have unusual requirements — legacy systems to bridge, non-standard auth, protocols that predate the framework. An unopinionated core bends to those requirements instead of fighting them.

## What this costs you

Being unopinionated is not free. Quiote asks more of you up front:

- More boilerplate than a batteries-included framework. Your first app declares its own routing, factories, and output types (the CLI scaffolds these for you — see [Your first application](/getting-started/your-first-app/)).
- No community-wide "the Quiote way" to copy from for every problem. You make more decisions.
- A steeper start. The payoff is control and longevity, not speed to first deploy.

If that trade is wrong for your project, that is a signal Quiote is the wrong tool — and that is fine. See [Introduction](/getting-started/introduction/) for who Quiote is and isn't for.

## Opinionated layers on top

Unopinionated at the core does not mean unopinionated forever, everywhere. The framework core stays neutral, and opinionated defaults arrive as optional, drop-in layers — **[plugins](/architecture/plugins/)** you add when you want them and omit when you don't.

The intent is a two-tier design:

- **The core** stays a skeleton: no assumed persistence layer, no assumed auth provider, no assumed front-end pipeline.
- **Plugins** provide the batteries: an authentication provider, health checks, a mailer, a conventional service/repository layout, and similar. Adopting one is opting into its conventions for that slice of your app — not the whole framework.

A plugin contributes through one `register()` call — config defaults, services, middleware, event listeners, routes, commands, HTTP clients — routed to the framework's existing seams, and it can never silently override your application (app settings and bindings always win). See [Plugins and extensibility](/architecture/plugins/). The freedom in the core is deliberate: convenience arrives as things you choose to add, not defaults you have to escape.
