---
title: Working with Existing Databases
description: Reverse-engineer an existing database into a schema.xml with schema:reverse.
---

This page is for developers who already have a working database and want to bring it under Propulsion instead of starting a schema from scratch. Propulsion provides `bin/propulsion schema:reverse`, a command-line tool that connects to a live database and reverse-engineers its structure into the abstract XML schema format used to generate model classes.

## Working with database structures

Propulsion uses an abstract XML schema file to represent databases (see the [schema reference](/propulsion/reference/schema/)). It builds RDBMS-specific SQL from that schema — and can also reverse-engineer the schema file from an existing database's metadata.

### Creating an XML schema from a DB structure

`schema:reverse` connects to a live database over PDO and inspects its tables, columns, types, foreign keys, and indices to produce a `schema.xml`. This is useful when integrating with a legacy database, or when starting a new project from a schema someone else already built by hand.

To generate the schema:

1. Run `schema:reverse` with a PDO DSN, a name for the generated `<database>` element, and the source database adapter:

    ```bash
    php bin/propulsion schema:reverse \
        --dsn="pgsql:host=localhost;dbname=mydb" \
        --database=pgsql \
        --database-name=mydb \
        --user=me \
        --password=secret
    ```

2. Review the console output for any errors or warnings, then inspect the generated schema file.

3. By default the schema is written to `./schema.xml` in the current directory; use `--output-file` (`-o`) to change that. You can now proceed with model generation:

    ```bash
    php bin/propulsion model:build schema.xml --output-dir=src/Model --database=pgsql
    ```

The `reverse` alias also works, for anyone used to typing the shorter Propel 1 command name:

```bash
php bin/propulsion reverse --dsn="mysql:host=localhost;dbname=mydb" --database=mysql --database-name=mydb -o schema.xml
```

#### Options

| Option | Description | Default |
|---|---|---|
| `--dsn` | PDO DSN of the live database to reverse-engineer. **Required.** | — |
| `--database-name` | Name to use for the `<database name="...">` attribute in the generated schema. **Required.** | — |
| `--database`, `-d` | Source database adapter (`mysql`, `pgsql`, `sqlite`, …) — selects which `SchemaParser`/`Platform` to use. | resolved from config |
| `--user`, `-u` / `--password`, `-p` | Database credentials, if not embedded in the DSN. | — |
| `--output-file`, `-o` | Path to write the generated `schema.xml` to. | `./schema.xml` |
| `--add-validators` | Comma-separated list of validators to add to generated columns: `none`, `maxlength`, `maxvalue`, `type`, `required`, `unique`, `all`. | `none` |
| `--config`, `-c` | A `build.php`/`build.properties` file overriding `generator/default.php` (repeatable; later files win). | `[]` |

`schema:reverse` has no built-in option to exclude tables from the generated schema. If your database includes tables you don't want reflected in it (third-party tables, framework-internal tables, and so on), remove the corresponding `<table>` elements from the generated `schema.xml` by hand before using it to build models.

#### Limitations

`schema:reverse` does not reverse-engineer views, materialized views, or PostgreSQL enum types — these aren't supported as first-class schema objects. If you want to use a view within Propulsion, define it manually as a `<table>` with `skipSql="true"` to generate read-only Object Model/Query classes against it without Propulsion trying to `CREATE TABLE` it.

The level of detail available also depends on the source database: metadata for SQLite is comparatively basic, since SQLite is a dynamically-typed database with limited column-type information to reverse-engineer from.

### Migrating structure to a new RDBMS

Because Propulsion can both reverse-engineer an XML schema from an existing database and generate RDBMS-specific DDL from that schema, you can use it as a bridge to move a structure from one database engine to another:

1. Follow the steps above to produce a `schema.xml` from the existing database.
2. Change the target database adapter and connection settings in your project's [configuration](/propulsion/basics/configuration/) to point at the new database.
3. Run `sql:build` to generate DDL for the new target:

    ```bash
    php bin/propulsion sql:build
    ```

4. Run `sql:exec` to execute that DDL against the new database:

    ```bash
    php bin/propulsion sql:exec
    ```
