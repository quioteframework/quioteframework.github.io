---
title: Configuration file reference
description: Build-time properties (build.php/build.properties), build-time database connections, and the runtime configuration array Propulsion::init() loads.
---

Propulsion has two entirely separate configuration surfaces, loaded by different code at different times:

1. **Build-time properties** — the flat `propulsion.*` key space controlling how `bin/propulsion` generates code (builders, platform, paths, object-model options). Read by `Propulsion\Generator\Config\GeneratorConfig`.
2. **Runtime configuration** — the datasource/connection array your generated Object Model classes use to actually connect to the database at request time. Read by `Propulsion::init()` (`Propulsion\Propulsion`) into a `Propulsion\Config\PropulsionConfiguration`.

There's also a narrower, easy-to-conflate third thing: **build-time database connections** — the DSN(s) the generator itself connects with, only needed for build-time tasks that talk to a live database (`schema:reverse`, `sql:exec`, `sql:diff` against a live schema). This page covers all three.

This page replaces Propel 1's `propel.ext`/YAML configuration file and `runtime-conf.xml` reference — Propulsion's actual configuration format is different from both, as detailed below.

## Build-time properties

### Where and how to specify them

Properties come from three layers, merged in order (later layers win):

1. **`generator/default.php`** — the base set Propulsion ships with. A plain PHP file `return`ing a flat `['propulsion.foo' => 'value', ...]` array. This is the authoritative list of every property and its default; read it directly if this page and the code ever disagree.
2. **One or more override files**, passed with `--config` (repeatable — later files win) on the console commands. Two formats are accepted, dispatched by extension:
   - **`build.php`** (recommended) — a plain PHP file returning the same flat `['propulsion.foo' => ...]` shape.
   - **`build.properties`** (legacy) — an Ant/Phing-style text file, one `key = value` pair per line, `#`/`;` comments. Still fully supported for existing Propel 1 projects; see `GeneratorConfig::parsePropertiesFile()`.
3. **Ad-hoc CLI overrides** — `--database` and `--target-platform` on `model:build` set `propulsion.database`/`propulsion.targetPlatform` directly, applied after the config files.

```bash
bin/propulsion model:build schema.xml --config=build.php --database=pgsql
bin/propulsion model:build schema.xml --config=build.properties --config=build.local.properties
```

`${propulsion.some.key}` placeholders are resolved against the fully-merged flat array (up to 10 passes, innermost-first), regardless of which format produced them — so `propulsion.platform.class => ${propulsion.platform.${propulsion.database}.class}` in `default.php` resolves once `propulsion.database` is set.

:::tip
There is no `propel:`/YAML unified configuration tree, no `phpDir`/`schemaDir`-style camelCase-only key naming, and no `propel-gen` — Propulsion never adopted Propel 2's YAML config format. If you're migrating a Propel **1** project, your existing `build.properties` works as-is; if you're coming from Propel 2's YAML config, you'll need to flatten it back into `propulsion.*` keys.
:::

### Property list

The following tables list every `propulsion.*` key from `generator/default.php`, grouped the same way the file is. Property names below drop the `propulsion.` prefix and use dots for readability — write them with the full `propulsion.` prefix in your own `build.php`/`build.properties`.

#### Basic properties

| Property | Default | Description |
|---|---|---|
| `version` | `1.6.2-dev` | Propulsion's own version string. |
| `home` | `.` | Propulsion's install root, used to resolve `templatePath` and the XSD/XSL resource paths below. |
| `database` | `pgsql` | Target database adapter: `pgsql`, `mysql`, `sqlite`, `oracle`, `mssql`, `sqlsrv`. **PostgreSQL is the default** (Propel 1 defaulted to `mysql`). |
| `targetPackage` | `` (empty) | Default package for generated classes when a schema doesn't set its own. |
| `targetPlatform` | `` (empty) | Codegen dialect selector. Left empty so builder resolution falls through to the modern (unsuffixed) builder classes below; set to `php5` only to opt back into the legacy PHP5* builders via `builder.*.php5.class` overrides — not recommended, PHP5 builders are archived, not maintained. |
| `runOnlyOnSchemaChange` | `false` | Skip regeneration when the schema file's mtime hasn't changed. |
| `packageObjectModel` | `false` | Whether to join schemas sharing a database name into a single schema. |
| `useDateTimeClass` | `true` | Whether temporal getters return `DateTime` objects. |
| `dateTimeClass` | `DateTime` | Which `DateTime`-compatible class to instantiate for temporal columns. |
| `schema.validate` | `true` | Validate `schema.xml` against the bundled XSD before building. |
| `schema.transform` | `false` | Run the schema through the XSL transform file before building. |
| `schema.autoPackage` | `false` | Copy a table's `schema` attribute to its `package` attribute. |
| `schema.autoNamespace` | `false` | Copy a table's `schema` attribute to its `namespace` attribute. |
| `schema.autoPrefix` | `false` | Use a table's `schema` attribute as a phpName prefix. |
| `useLeftJoinsInDoJoinMethods` | `true` | Whether generated `doSelectJoin*()`-style methods default to LEFT JOIN. |

#### Database settings

| Property | Default | Description |
|---|---|---|
| `database.url` | `` (empty) | Single build-time database DSN (fallback path — see [Build-time database connections](#build-time-database-connections)). |
| `database.buildUrl` | `${propulsion.database.url}` | DSN used specifically for build tasks. |
| `database.createUrl` | `${propulsion.database.buildUrl}` | DSN used when creating the database. |
| `database.driver` | `` (empty) | Overrides the PDO driver segment if it differs from `database`. |
| `database.schema` | `` (empty) | Default SQL schema/namespace for RDBMS that support it. |
| `database.encoding` | `` (empty) | Character encoding for DDL generation. |
| `database.manualCreation` | `false` | Skip automatic database creation. |
| `database.user` / `database.password` | `` (empty) | Fallback build-time credentials, used together with `database.url` when no `buildtime-conf` is configured. |

#### Database-to-XML settings

| Property | Default | Description |
|---|---|---|
| `samePhpName` | `false` | Whether reverse-engineered columns get a phpName identical to the column name. |
| `addVendorInfo` | `false` | Whether reverse engineering emits `<vendor>` elements. |
| `addValidators` | `none` | Validator rules to emit when reverse-engineering. |

#### Template variables (object model)

| Property | Default | Description |
|---|---|---|
| `addGenericAccessors` | `true` | Generate `getByName()`/`getByPosition()`/`toArray()`. |
| `addGenericMutators` | `true` | Generate `setByName()`/`setByPosition()`/`fromArray()`. |
| `addSaveMethod` | `true` | Generate `save()`. |
| `addTimeStamp` | `false` | Add a generation timestamp to the phpDoc header of generated classes. |
| `addValidateMethod` | `true` | Generate `validate()`/`getValidationFailures()`. |
| `addIncludes` | `false` | Emit `require`/`include` statements in generated code instead of relying on autoloading. |
| `addHooks` | `true` | Generate `pre`/`post` lifecycle hook call sites on `save()`/`delete()`. |
| `basePrefix` | `Base` | Prefix for the abstract `Base*` classes. |
| `saveException` | `PropulsionException` | Exception class thrown by generated `save()`/`delete()` on failure. |
| `emulateForeignKeyConstraints` | `false` | Emit application-level FK constraint checks instead of relying on the database. |
| `disableIdentifierQuoting` | `false` | Disable identifier quoting in generated DDL/SQL — can be necessary on PostgreSQL for certain identifier casing. |
| `defaultTimeStampFormat` | `Y-m-d H:i:s` | Default format string for `TIMESTAMP` columns' `getByName()`-style access. |
| `defaultTimeFormat` | `%X` | Default format string for `TIME` columns. |
| `defaultDateFormat` | `%x` | Default format string for `DATE` columns. |
| `namespace.om` | `OM` | Sub-namespace segment for generated OM classes (only used by certain packaging modes). |
| `namespace.map` | `Map` | Sub-namespace segment for generated `*TableMap` classes. |
| `namespace.autoPackage` | `true` | Use a table's `namespace` attribute to derive its output subdirectory. |

#### Directories

| Property | Default | Description |
|---|---|---|
| `conf.dir` | `${propulsion.project.dir}` | Directory searched for runtime/buildtime config files. |
| `schema.dir` | `${propulsion.project.dir}` | Directory searched for `schema.xml` files. |
| `templatePath` | `${propulsion.home}/templates` | Code-generation template root. |
| `output.dir` | `${propulsion.project.dir}/build` | Root output directory (legacy Phing-style layout; the console's `--output-dir` option is the modern equivalent for `model:build`). |
| `php.dir` | `${propulsion.output.dir}/classes` | Generated PHP class output directory (legacy path — superseded by `--output-dir`). |
| `phpconf.dir` | `${propulsion.output.dir}/conf` | Generated runtime-config output directory. |
| `sql.dir` | `${propulsion.output.dir}/sql` | Generated DDL/SQL output directory. |
| `migration.dir` | `${propulsion.output.dir}/migrations` | Generated migration class output directory. |
| `graph.dir` | `${propulsion.output.dir}/graph` | `graph:build` output directory. |
| `dbd2propel.dir` | `${propulsion.project.dir}/dbd` | DBDesigner4 import source directory. |

#### Default file names

| Property | Default | Description |
|---|---|---|
| `runtime.conf.file` | `runtime-conf.xml` | Legacy default filename some tooling still probes for — not what `Propulsion::init()` expects; pass your PHP runtime config file's path explicitly (see [Runtime configuration](#runtime-configuration)). |
| `runtime.phpconf.file` | `${propulsion.project}-conf.php` | Legacy compiled runtime-config filename pattern. |
| `runtime.phpconf-classmap.file` | `classmap-${propulsion.runtime.phpconf.file}` | Legacy classmap companion file. |
| `default.schema.basename` | `schema` | Base filename schemas are matched against (`*schema.xml`). |
| `buildtime.conf.file` | `buildtime-conf.xml` | Legacy build-time-connections filename — see [Build-time database connections](#build-time-database-connections). |
| `schema.xsd.file` | `${propulsion.home}/resources/xsd/database.xsd` | Schema-validation XSD path. |
| `schema.xsl.file` | `${propulsion.home}/resources/xsl/database.xsl` | Schema-transform XSL path. |
| `dbd2propel.xsl.file` | `${propulsion.home}/resources/xsl/dbd2propel.xsl` | DBDesigner4 import XSL path. |

#### Include/exclude and mapper settings

| Property | Default | Description |
|---|---|---|
| `schema.sql.includes` / `schema.sql.excludes` | `*schema.xml` / `` | File matching for the SQL-build task. |
| `schema.doc.includes` / `schema.doc.excludes` | `*schema.xml` / `` | File matching for documentation generation. |
| `schema.create-db.includes` / `schema.create-db.excludes` | `*schema.xml` / `` | File matching for database creation. |
| `schema.init-sql.includes` / `schema.init-sql.excludes` | `*schema.xml` / `id-table-schema.xml` | File matching for initial-data SQL. |
| `schema.om.includes` / `schema.om.excludes` | `*schema.xml` / `id-table-schema.xml` | File matching for Object Model generation. |
| `schema.datadtd.includes` / `schema.datadtd.excludes` | `*schema.xml` / `id-table-schema.xml` | File matching for data-DTD generation. |
| `dbd2propel.includes` | `*.xml` | File matching for DBDesigner4 import. |
| `datasql.mapper.from` / `datasql.mapper.to` | `*.xml` / `*.sql` | Data-XML-to-SQL filename mapping. |
| `datadump.mapper.from` / `datadump.mapper.to` | `*schema.xml` / `*data.xml` | Schema-to-data-dump filename mapping. |
| `datadtd.mapper.from` / `datadtd.mapper.to` | `*.xml` / `*.dtd` | Data-to-DTD filename mapping. |
| `sql.mapper.from` / `sql.mapper.to` | `*.xml` / `*.sql` | Schema-to-SQL filename mapping. |

#### Migration settings

| Property | Default | Description |
|---|---|---|
| `migration.editor` | `` (empty) | Editor command invoked when opening a generated migration for review. |
| `migration.table` | `propulsion_migration` | Append-only ledger table Propulsion uses to record migration run attempts — see [Migrations: How it works](/propulsion/basics/migrations/#how-it-works). |
| `migration.caseInsensitive` | `true` | Whether migration filename comparison ignores case. |

#### Builder settings

Every `builder.*.class` key names the concrete class for a stage of code generation. All of them point at the modern PHP 8.4+ builders unconditionally — the PHP5-era builder classes (`PHP5PeerBuilder`, `PHP5ObjectBuilder`, `PHP5TableMapBuilder`, `PHP5QueryBuilder`, the PHP5 node/nestedset family) **have been removed from the codebase entirely** (archived under `archaeology/php5-builders/`). `targetPlatform` is effectively vestigial as a result — there's no alternate builder set left to select via `php5`, though `GeneratorConfig::getBuilderClassname()` still honors a `builder.*.php5.class`-style override if you supply your own.

| Property | Default |
|---|---|
| `builder.peer.class` | `Propulsion\Generator\Builder\OM\PeerBuilder` |
| `builder.object.class` | `Propulsion\Generator\Builder\OM\ObjectBuilder` |
| `builder.objectstub.class` | `Propulsion\Generator\Builder\OM\ExtensionObjectBuilder` |
| `builder.peerstub.class` | `Propulsion\Generator\Builder\OM\ExtensionPeerBuilder` |
| `builder.objectmultiextend.class` | `Propulsion\Generator\Builder\OM\MultiExtendObjectBuilder` |
| `builder.tablemap.class` | `Propulsion\Generator\Builder\OM\TableMapBuilder` |
| `builder.query.class` | `Propulsion\Generator\Builder\OM\QueryBuilder` |
| `builder.querystub.class` | `Propulsion\Generator\Builder\OM\ExtensionQueryBuilder` |
| `builder.interface.class` | `Propulsion\Generator\Builder\OM\InterfaceBuilder` |
| `builder.node.class` / `builder.nodepeer.class` | `Propulsion\Generator\Builder\OM\NodeBuilder` / `NodePeerBuilder` |
| `builder.nodestub.class` / `builder.nodepeerstub.class` | `Propulsion\Generator\Builder\OM\ExtensionNodeBuilder` / `ExtensionNodePeerBuilder` |
| `builder.nestedset.class` / `builder.nestedsetpeer.class` | `Propulsion\Generator\Builder\OM\NestedSetBuilder` / `NestedSetPeerBuilder` |
| `builder.queryinheritance.class` / `builder.queryinheritancestub.class` | `Propulsion\Generator\Builder\OM\QueryInheritanceBuilder` / `ExtensionQueryInheritanceBuilder` |
| `builder.pluralizer.class` | `Propulsion\Generator\Builder\Util\DefaultEnglishPluralizer` |
| `builder.datasql.mysql.class` | `Propulsion\Generator\Builder\SQL\MySQL\MysqlDataSQLBuilder` |
| `builder.datasql.pgsql.class` | `Propulsion\Generator\Builder\SQL\PgSQL\PgsqlDataSQLBuilder` |
| `builder.datasql.mssql.class` | `Propulsion\Generator\Builder\SQL\MSSQL\MssqlDataSQLBuilder` |
| `builder.datasql.sqlsrv.class` | `Propulsion\Generator\Builder\SQL\Sqlsrv\SqlsrvDataSQLBuilder` |
| `builder.datasql.oracle.class` | `Propulsion\Generator\Builder\SQL\Oracle\OracleDataSQLBuilder` |
| `builder.datasql.class` | `${propulsion.builder.datasql.${propulsion.database}.class}` |

`builder.*.php84.class` variants of the OM builders above also exist, as an explicit alias for anyone who still passes `--target-platform=php84` — they resolve to the exact same classes.

#### Platform classes

| Property | Default |
|---|---|
| `platform.mysql.class` | `Propulsion\Generator\Platform\MysqlPlatform` |
| `platform.pgsql.class` | `Propulsion\Generator\Platform\PgsqlPlatform` |
| `platform.sqlite.class` | `Propulsion\Generator\Platform\SqlitePlatform` |
| `platform.oracle.class` | `Propulsion\Generator\Platform\OraclePlatform` |
| `platform.mssql.class` | `Propulsion\Generator\Platform\MssqlPlatform` |
| `platform.sqlsrv.class` | `Propulsion\Generator\Platform\SqlsrvPlatform` |
| `platform.class` | `${propulsion.platform.${propulsion.database}.class}` |

#### Reverse-engineering (schema parser) classes

| Property | Default |
|---|---|
| `reverse.parser.mysql.class` | `Propulsion\Generator\Reverse\MySQL\MysqlSchemaParser` |
| `reverse.parser.pgsql.class` | `Propulsion\Generator\Reverse\PgSQL\PgsqlSchemaParser` — requires **PostgreSQL 15+** (uses `pg_get_expr(adbin, adrelid)`, not the pre-12 `pg_attrdef.adsrc` text column). |
| `reverse.parser.sqlite.class` | `Propulsion\Generator\Reverse\SQLite\SqliteSchemaParser` |
| `reverse.parser.mssql.class` | `Propulsion\Generator\Reverse\MSSQL\MssqlSchemaParser` |
| `reverse.parser.sqlsrv.class` | `Propulsion\Generator\Reverse\Sqlsrv\SqlsrvSchemaParser` |
| `reverse.parser.oracle.class` | `Propulsion\Generator\Reverse\Oracle\OracleSchemaParser` |
| `reverse.parser.class` | `${propulsion.reverse.parser.${propulsion.database}.class}` |

#### MySQL-specific settings

| Property | Default | Description |
|---|---|---|
| `mysql.tableType` | `MyISAM` | Default storage engine for generated `CREATE TABLE` statements. |
| `mysql.tableEngineKeyword` | `ENGINE` | Keyword used to specify the engine (`TYPE` on MySQL &lt; 5, not relevant to any currently supported MySQL version). |

#### Oracle-specific settings

| Property | Default | Description |
|---|---|---|
| `oracle.autoincrementSequencePattern` | `${table}_SEQ` | Sequence naming pattern for autoincrement columns. |

#### Behavior classes

| Property | Default |
|---|---|
| `behavior.timestampable.class` | `Propulsion\Generator\Behavior\TimestampableBehavior` |
| `behavior.alternative_coding_standards.class` | `Propulsion\Generator\Behavior\AlternativeCodingStandardsBehavior` |
| `behavior.soft_delete.class` | `Propulsion\Generator\Behavior\SoftDeleteBehavior` |
| `behavior.auto_add_pk.class` | `Propulsion\Generator\Behavior\AutoAddPkBehavior` |
| `behavior.nested_set.class` | `Propulsion\Generator\Behavior\NestedSet\NestedSetBehavior` |
| `behavior.sortable.class` | `Propulsion\Generator\Behavior\Sortable\SortableBehavior` |
| `behavior.sluggable.class` | `Propulsion\Generator\Behavior\Sluggable\SluggableBehavior` |
| `behavior.concrete_inheritance.class` | `Propulsion\Generator\Behavior\ConcreteInheritance\ConcreteInheritanceBehavior` |
| `behavior.query_cache.class` | `Propulsion\Generator\Behavior\QueryCache\QueryCacheBehavior` |
| `behavior.aggregate_column.class` | `Propulsion\Generator\Behavior\AggregateColumn\AggregateColumnBehavior` |
| `behavior.versionable.class` | `Propulsion\Generator\Behavior\Versionable\VersionableBehavior` |
| `behavior.i18n.class` | `Propulsion\Generator\Behavior\I18n\I18nBehavior` |
| `behavior.delegate.class` | `Propulsion\Generator\Behavior\DelegateBehavior` |
| `behavior.archivable.class` | `Propulsion\Generator\Behavior\Archivable\ArchivableBehavior` |

#### Object Model base classes

| Property | Default |
|---|---|
| `om.BaseObject` | `Propulsion\OM\BaseObject` |
| `om.Persistent` | `Propulsion\OM\Persistent` |

### What was removed relative to Propel 1

- All `propulsion.builder.*.php5.class` **default** entries — the PHP5 builder classes they used to point at (`PHP5PeerBuilder`, `PHP5ObjectBuilder`, `PHP5TableMapBuilder`, `PHP5QueryBuilder`, `PHP5NodeBuilder`, `PHP5NestedSetBuilder`, and their extension/stub counterparts) are gone from the codebase. `targetPlatform=php5` no longer has anything to fall back to; only supply `builder.*.php5.class` yourself if you've written a replacement.
- Propel 1's default database (`mysql`) — see [`propulsion.database`](#basic-properties) above; PostgreSQL is now the default.

### What changed defaults relative to Propel 1

Only `propulsion.database` (`mysql` → `pgsql`) changes default value versus Propel 1's own `default.properties`. Every other Propel 1 default carries over unchanged, modulo the class renames.

## Build-time database connections

Separate from the generator's own build **properties**, some build-time tasks need a live database connection — reverse-engineering an existing schema (`schema:reverse`), diffing against a live database (`sql:diff`), or executing generated SQL (`sql:exec`). `GeneratorConfig::getBuildConnections()` resolves this, checked in order:

1. **`propulsion.buildtimeConfigArray`** build property — a plain PHP array already in the target shape (see below). The recommended path for new configs.
2. **`propulsion.buildtimeConfFile`** build property naming a file, tried at a `projectDir`-relative path, the given path directly, and a couple of legacy `build/propel/`-style fallback locations. Dispatched by extension:
   - a `.php` file `require`d and expected to return the same shape as `buildtimeConfigArray`.
   - a legacy `buildtime-conf.xml` file (kept for backward compatibility).
3. **`propulsion.buildtimeConf`** — a base64-encoded XML string, for passing build-time connection info on a command line without whitespace issues.
4. If none of the above resolve a connection for the requested datasource name, falls back to the single connection assembled from `propulsion.database.url`/`.driver`/`.user`/`.password` (see [Database settings](#database-settings)).

The plain-PHP array shape:

```php
<?php
// buildtime-conf.php
return [
    'default'     => 'bookstore',
    'datasources' => [
        'bookstore' => [
            'adapter'  => 'pgsql',
            'dsn'      => 'pgsql:host=localhost;dbname=bookstore',
            'user'     => 'me',
            'password' => 'secret',
        ],
    ],
];
```

## Runtime configuration

This is the configuration your **generated Object Model classes** use to open a real database connection when your application runs — the Propulsion equivalent of what Propel 1 called `runtime-conf.xml`. It has nothing to do with the build-time properties or build-time connections above; it's loaded separately, by your application, not by `bin/propulsion`.

### Format: a plain PHP array, not XML

Propel 1's `runtime-conf.xml` is gone. `Propulsion::init($path)` (`Propulsion\Propulsion::init()`) calls `Propulsion::configure($path)`, which does exactly one thing: `include($path)` and expects the file to `return` an array. That array is wrapped in a `Propulsion\Config\PropulsionConfiguration` (an `ArrayAccess` container supporting dotted-key lookups like `$config->getParameter('datasources.bookstore.connection.dsn')`) and stored for the rest of the process.

```php
<?php
// runtime-conf.php
return [
    'datasources' => [
        'default'   => 'bookstore',
        'bookstore' => [
            'adapter'    => 'pgsql',
            'connection' => [
                'classname' => 'Propulsion\Connection\PropulsionPDO', // optional; this is the default
                'dsn'       => 'pgsql:host=localhost;dbname=bookstore',
                'user'      => 'app',
                'password'  => 'secret',
                'options'   => [],   // PDO constructor options
                'attributes' => [],  // set via PDO::setAttribute() after connecting
                'settings'  => [
                    'charset' => 'utf8',
                    'queries' => [], // SQL run once, immediately after connecting
                ],
            ],
            // optional: read-replica connections for this datasource
            'slaves' => [
                'connection' => [
                    ['dsn' => 'pgsql:host=replica-1;dbname=bookstore'],
                    ['dsn' => 'pgsql:host=replica-2;dbname=bookstore'],
                ],
            ],
        ],
    ],
];
```

```php
<?php
Propulsion::init(__DIR__ . '/runtime-conf.php');

$con    = Propulsion::getConnection('bookstore');               // master, by default
$reader = Propulsion::getConnection('bookstore', Propulsion::CONNECTION_READ); // a slave, if configured
```

### Key shape

| Key path | Description |
|---|---|
| `datasources.default` | Name of the datasource `Propulsion::getConnection()` uses when called with no argument. |
| `datasources.<name>.adapter` | Database adapter identifier (`pgsql`, `mysql`, `sqlite`, `oracle`, `mssql`, `sqlsrv`) — used to select the right `DBAdapter` subclass, independent from the PDO driver in `dsn` (e.g. an ODBC DSN targeting SQL Server would still set `adapter: sqlsrv`). |
| `datasources.<name>.connection.classname` | The PDO subclass to instantiate. Defaults to `Propulsion\Connection\PropulsionPDO`; must extend it (or plain `PDO`) since Propulsion relies on nested-transaction support that isn't in stock `PDO`. |
| `datasources.<name>.connection.dsn` | The PDO DSN. Same format PHP's PDO drivers always expected — see the PHP manual for [PostgreSQL](https://www.php.net/manual/en/ref.pdo-pgsql.connection.php), [MySQL](https://www.php.net/manual/en/ref.pdo-mysql.connection.php), [SQLite](https://www.php.net/manual/en/ref.pdo-sqlite.connection.php), [Oracle](https://www.php.net/manual/en/ref.pdo-oci.connection.php), [SQL Server](https://www.php.net/manual/en/ref.pdo-sqlsrv.connection.php). |
| `datasources.<name>.connection.user` / `.password` | Credentials, for adapters that don't embed them in the DSN. |
| `datasources.<name>.connection.options` | PDO constructor options array — passed to `new PDO($dsn, $user, $password, $options)`. |
| `datasources.<name>.connection.attributes` | Options applied via `PDO::setAttribute()` **after** the connection is created — same key space as `options`, different timing. |
| `datasources.<name>.connection.settings.charset` | Character set applied to the connection where the RDBMS supports it. |
| `datasources.<name>.connection.settings.queries` | Array of SQL statements executed once, immediately after connecting. |
| `datasources.<name>.slaves.connection` | Either a single connection array, or a list of them — one is picked at random per `getConnection(..., Propulsion::CONNECTION_READ)` call when there's more than one. |

Read a value at runtime with `Propulsion::getConfiguration()` or, for a single dotted key, `PropulsionConfiguration::getParameter('datasources.bookstore.connection.dsn')`.

### What replaced `runtime-conf.xml`

| Propel 1 (`runtime-conf.xml`) | Propulsion (runtime array) |
|---|---|
| `<datasources default="bookstore">` | `'datasources' => ['default' => 'bookstore', ...]` |
| `<datasource id="bookstore"><adapter>mysql</adapter>` | `'datasources' => ['bookstore' => ['adapter' => 'pgsql', ...]]` |
| `<connection><dsn>...</dsn><user>...</user><password>...</password></connection>` | `'connection' => ['dsn' => ..., 'user' => ..., 'password' => ...]` |
| `<connection><classname>Propel\Runtime\Connection\ConnectionWrapper</classname></connection>` | `'connection' => ['classname' => 'Propulsion\Connection\PropulsionPDO']` |
| `<connection><options>...</options></connection>` | `'connection' => ['options' => [...]]` |
| `<connection><attributes>...</attributes></connection>` | `'connection' => ['attributes' => [...]]` |
| `<connection><settings><charset>utf8</charset><queries>...</queries></settings></connection>` | `'connection' => ['settings' => ['charset' => 'utf8', 'queries' => [...]]]` |
| `<slaves><connection>...</connection>...</slaves>` | `'slaves' => ['connection' => [...]]` |
| `Propel::init('/path/to/runtime-conf.php')` (compiled from XML) | `Propulsion::init('/path/to/runtime-conf.php')` (hand-written PHP array, no compile step) |

Since the runtime file is plain PHP, there's no separate "compile the XML into PHP" build step the way Propel 1's `propel-gen` produced a `*-conf.php` alongside `runtime-conf.xml` — you write the array directly, or generate it yourself from whatever source you like (environment variables, a secrets manager, etc.).

### Logging

Propel 1's runtime config carried Zend/sfLogger-flavored `<log>`/`<logger>` sections. Propulsion doesn't read logging configuration from the runtime array at all — it logs through [PSR-3](https://www.php-fig.org/psr/psr-3/) instead, and you register your own logger programmatically:

```php
<?php
Propulsion::init(__DIR__ . '/runtime-conf.php');
Propulsion::setLogger($myPsr3Logger); // e.g. a Monolog\Logger instance
```

Without a registered logger, `Propulsion::log()` is a no-op — there's no implicit `error_log()` fallback. See [Logging](/propulsion/basics/logging/) for the full setup, including per-connection overrides.

### Using it from Quiote

If you're using Propulsion through Quiote's [database adapter](/basics/databases/#propulsion) rather than standalone, you don't call `Propulsion::init()` yourself — point the `propulsion` database's `config` parameter at this same file, and `PropulsionDatabase` calls it for you:

```php
// Config/databases.php
return [
    'databases' => [
        'main' => [
            'class'      => 'propulsion',
            'parameters' => [
                'config'     => __DIR__ . '/runtime-conf.php',
                'datasource' => 'bookstore',
            ],
        ],
    ],
];
```

See [Databases: Propulsion](/basics/databases/#propulsion) for the full parameter list.
