---
title: Logging
description: PSR-3 logging in Propulsion — registering a logger, log levels, no-op-by-default behavior, and per-connection overrides.
---

Propulsion logs through [PSR-3](https://www.php-fig.org/psr/psr-3/) (`Psr\Log\LoggerInterface`) — a real behavioral change from Propel 1's Monolog-and-`ServiceContainer` setup, not just a rename. Propulsion ships **no concrete logger implementation** of its own; you bring one.

## Registering a logger

Register a PSR-3 logger with `Propulsion::setLogger()`, typically right after `Propulsion::init()`:

```php
<?php
use Propulsion\Propulsion;
use Monolog\Logger;
use Monolog\Handler\StreamHandler;

Propulsion::init('/path/to/runtime-conf.php');

$logger = new Logger('propulsion');
$logger->pushHandler(new StreamHandler('/path/to/propulsion.log'));
Propulsion::setLogger($logger);
```

Any PSR-3 implementation works — [Monolog](https://github.com/Seldaek/monolog) is the obvious choice, but nothing Propulsion-specific is required of it.

:::caution[No implicit fallback]
If you never call `Propulsion::setLogger()`, `Propulsion::log()` is a **no-op** — nothing is written anywhere. Unlike some older Propel 1 configurations, there is no implicit fallback to `error_log()` or a default log file. If you want log output, you must register a logger.
:::

Check whether one is registered with `Propulsion::hasLogger()`, and retrieve it with `Propulsion::logger()` (returns `null` if none was set).

## Log level constants

`Propulsion::LOG_EMERG` through `Propulsion::LOG_DEBUG` are aliases for the corresponding `Psr\Log\LogLevel::*` string constants, so existing Propel-1-style call sites keep working unchanged:

```php
<?php
Propulsion::log('Something went wrong with ' . $myObj->getName(), Propulsion::LOG_ERR);
```

| Constant | `Psr\Log\LogLevel` |
|---|---|
| `Propulsion::LOG_EMERG` | `EMERGENCY` |
| `Propulsion::LOG_ALERT` | `ALERT` |
| `Propulsion::LOG_CRIT` | `CRITICAL` |
| `Propulsion::LOG_ERR` | `ERROR` |
| `Propulsion::LOG_WARNING` | `WARNING` |
| `Propulsion::LOG_NOTICE` | `NOTICE` |
| `Propulsion::LOG_INFO` | `INFO` |
| `Propulsion::LOG_DEBUG` | `DEBUG` |

`Propulsion::log($message, $level, $context)` forwards straight to the registered logger's `log()` method — `$context` is the same associative array PSR-3 loggers accept for message interpolation (`{placeholder}` tokens) and structured fields.

## Per-connection logger overrides

A `PropulsionPDO` connection can be given its own logger, which takes priority over the globally-registered one for every query run on that connection:

```php
<?php
$con = Propulsion::getWriteConnection(\Map\BookTableMap::DATABASE_NAME);
$con->setLogger($logger);
```

This is useful when one datasource needs noisier (or quieter) logging than the rest of the application — a read-replica connection you're debugging, for instance — without changing what every other connection logs.

## What didn't change

`DebugPDO`/`ConnectionWrapper`-style query counting and the "log every executed query" debug mode from Propel 1 are unaffected by the PSR-3 switch — they still exist, and still write through whichever logger (global or per-connection) is in effect once enabled. If you're bringing over debug-mode configuration from an existing Propel 1 project, it carries across unchanged; only *how you register the destination logger* is different.
