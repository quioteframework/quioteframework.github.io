---
title: Cookbook
description: Task-oriented recipes for working with existing databases, schemas, column types, and Propulsion internals.
---

The cookbook collects task-oriented recipes that don't fit neatly into the getting-started or reference sections — things you reach for once you already know the basics and need to solve a specific problem.

## Common tasks

* [Working with existing databases](/propulsion/cookbook/working-with-existing-databases/) — reverse-engineer a `schema.xml` from a live database with `schema:reverse`.
* [Using SQL schemas](/propulsion/cookbook/using-sql-schemas/) — group tables into database-level schemas/namespaces on RDBMS that support them.
* [How to use namespaces](/propulsion/cookbook/namespaces/) — give generated model classes real PHP namespaces.
* [Multi-component data model](/propulsion/cookbook/multi-component-data-model/) — split a large schema across multiple files and packages.
* [Working with advanced column types](/propulsion/cookbook/working-with-advanced-column-types/) — `blob`, `enum`, `object`, and `array` columns.
* [Copying persisted objects](/propulsion/cookbook/copying-persisted-objects/) — shallow and deep copies with `copy()`.
* [Model introspection at runtime](/propulsion/cookbook/runtime-introspection/) — inspect tables, columns, and relations via the map classes.
* [Adding additional SQL files](/propulsion/cookbook/adding-additional-sql-files/) — run extra DDL alongside the generated SQL file.
* [Replication](/propulsion/cookbook/replication/) — read/write connection splitting for master-slave setups.

## Extending Propulsion

* [How to write a behavior](/propulsion/cookbook/writing-behavior/) — a step-by-step tutorial building a behavior from scratch.
* [Working with Propulsion's test suite](/propulsion/cookbook/working-with-test-suite/) — running and writing tests against the PHPUnit/Testcontainers suite.

See also the [Behaviors](/propulsion/behaviors/) reference for the full list of bundled behaviors and the behavior-authoring API.
