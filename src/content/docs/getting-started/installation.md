---
title: Installation
description: Requirements and installation instructions for Quiote.
---

## Requirements

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
| `iconv` | Charset conversion beyond ISO-8859-1 ↔ UTF-8 |
| `APCu` | APCu-backed config cache for persistent workers |

## Installing via Composer

:::caution
Quiote is not yet available on Packagist. Until the first stable release, install directly from the GitHub repository.
:::

```bash
composer require quioteframework/quiote:dev-main
```

Or add it to your `composer.json` manually:

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

Then run:

```bash
composer install
```

## Verifying the installation

After installation, check that the CLI tool is available:

```bash
vendor/bin/quiote --version
```

See [The command-line tool](/getting-started/cli/) for everything `quiote` can do — including scaffolding a new application with `quiote new`.

## Next steps

With Quiote installed, build your first application: [Your first application](/getting-started/your-first-app/) walks through a scaffolded app end to end — the front controller, a route, an action, a view, and a template.
