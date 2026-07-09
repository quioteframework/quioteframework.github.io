---
title: Installation
description: Requirements and installation instructions for Quiote.
---

This page gets Quiote onto your machine. Quiote is a Composer library, so you add it to a project like any other dependency — there is no separate installer. Work through it in order: check the requirements, install with Composer, then verify the CLI runs. Once it does, [Your first application](/getting-started/your-first-app/) builds something with it.

## Requirements

Before installing, make sure your environment has these. The extensions are the ones the kernel needs to boot; the optional table further down lists ones that unlock extra subsystems.

- PHP **8.5** or higher
- Required extensions: `dom`, `intl`, `SPL`, `Reflection`, `PCRE` (and `libxml`, which `dom` depends on)
- [Composer](https://getcomposer.org/)

Optional extensions that unlock additional functionality:

| Extension | Enables |
|---|---|
| `xsl` | Transformation of pre-1.0 style configuration files |
| `tokenizer` | More efficient config cache generation |
| `session` | Built-in session handling |
| `PDO` | PDO-based database connectors |
| `iconv` | Charset conversion between ISO-8859-1 and UTF-8 |
| `APCu` | APCu-backed config cache for persistent workers |

## Installing via Composer

:::caution
Quiote is not yet available on Packagist. Until the first stable release, install directly from the GitHub repository.
:::

Follow these steps from your project directory.

1. **Require the package.** In an existing Composer project, one command adds Quiote and pulls in its dependencies:

   ```bash
   composer require quioteframework/quiote:dev-main
   ```

2. **Or add it to `composer.json` by hand.** If you prefer to edit the manifest yourself, add both the requirement and the VCS repository (needed while Quiote is off Packagist), then run `composer install`:

   ```json
   {
       "require": {
           "quioteframework/quiote": "dev-main"
       },
       "repositories": [
           {
               "type": "vcs",
               "url": "https://github.com/quioteframework/quiote"
           }
       ]
   }
   ```

   ```bash
   composer install
   ```

## Verifying the installation

3. **Confirm the CLI runs.** Composer installs the `quiote` binary to `vendor/bin`. Ask it for its version — a version string (currently `2.0.0-dev`) means Quiote is installed and runnable:

   ```bash
   vendor/bin/quiote --version
   ```

See [The command-line tool](/getting-started/cli/) for everything `quiote` can do — including scaffolding a new application with `quiote new`.

## Next steps

With Quiote installed, build your first application: [Your first application](/getting-started/your-first-app/) walks through a scaffolded app end to end — the front controller, a route, an action, a view, and a template.
