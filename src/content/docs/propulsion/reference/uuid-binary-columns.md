---
title: UUID and binary columns
description: Propulsion does not implement Propel 2's UUID/UUID_BINARY column type or automatic UUID-to-binary conversion — what to use instead.
---

Propel 2's `reference/uuid-binary-columns.markdown` documents a `UUID_BINARY` column type — a schema-level type that stores UUIDs as native binary data (`BINARY(16)` on MySQL/MSSQL, `RAW(16)` on Oracle, `BYTEA` on PostgreSQL, `BLOB` on SQLite) while presenting them to PHP as ordinary UUID strings, plus a `UUID` type that maps to the database's native UUID column type where one exists and falls back to `UUID_BINARY` otherwise.

**Neither `UUID` nor `UUID_BINARY` exists in Propulsion.** This isn't an oversight this page is working around — it's a straightforward fact you can verify yourself: `Propulsion\Generator\Model\PropulsionTypes` (`generator/Lib/Model/PropulsionTypes.php`) has no `UUID` or `UUID_BINARY` constant, and neither does the schema XSD's column-type enumeration (`generator/resources/xsd/database.xsd`). There is also no `UuidConverter` class, no `uuidColumnType` adapter setting, and no `UuidSwapFlag` vendor parameter anywhere in the codebase. If your Propel 2 schema declares a `UUID` or `UUID_BINARY` column, `bin/propulsion model:build` will reject it as an invalid column type — this isn't a "still works, just undocumented" situation.

## What to do instead

Pick one of these, in order of how close they get to Propel 2's behavior:

### Store as a plain string column

The simplest and most portable option: declare the column as `VARCHAR` (or `CHAR`, sized to `36` for the canonical hyphenated form) and store the UUID as text.

```xml
<table name="my_table">
  <column name="uuid" type="VARCHAR" size="36" required="true" />
</table>
```

```php
$myTableObject->setUuid('8ddb2ec4-f996-4777-b4f4-d59399530734');
echo $myTableObject->getUuid(); // '8ddb2ec4-f996-4777-b4f4-d59399530734'
```

No conversion, no vendor-specific storage, works identically on every supported RDBMS. The cost is the same one Propel 2's `UUID_BINARY` type existed to avoid: a 36-byte indexed string column instead of a 16-byte binary one, and no automatic dashless/binary round-tripping.

### Use the database's native UUID type via `sqlType`

If you're targeting PostgreSQL (which has a real native `uuid` column type), override the SQL type while keeping a string-compatible Propulsion type:

```xml
<table name="my_table">
  <column name="uuid" type="VARCHAR" size="36" sqlType="uuid" required="true" />
</table>
```

PostgreSQL stores and indexes this as its native `uuid` type; Propulsion still treats it as an ordinary string column for PHP getter/setter purposes, since `Propulsion\Generator\Model\PropulsionTypes` has no UUID-specific handling to hand it off to. This gets you native storage efficiency on PostgreSQL without any Propulsion-side UUID support — but it isn't portable to a database without a native UUID column type (MySQL, SQLite), where you'd fall back to plain `VARCHAR`/`BINARY` per platform.

### Convert to/from binary yourself

If you specifically need 16-byte binary storage (matching what Propel 2's `UUID_BINARY` produced) on a database without a native UUID type, declare a `BINARY`/`VARBINARY` column and do the string↔binary conversion in your own code, e.g. with `ramsey/uuid`:

```xml
<table name="my_table">
  <column name="uuid_bin" type="BINARY" size="16" required="true" />
</table>
```

```php
use Ramsey\Uuid\Uuid;

$myTableObject->setUuidBin(Uuid::fromString('8ddb2ec4-f996-4777-b4f4-d59399530734')->getBytes());
echo Uuid::fromBytes($myTableObject->getUuidBin())->toString();
```

There's no Propulsion-provided `UuidConverter::uuidToBin()`/`binToUuid()` equivalent, no built-in swap-flag handling for the byte-reordering trick MySQL/MariaDB's `UUID_TO_BIN(..., 1)` performs (see [the original Propel 2 rationale](https://lefred.be/content/mysql-uuids/) if you're porting logic that relied on it), and no automatic conversion in `filterByXXX()` filter methods — you convert both directions by hand, everywhere a value crosses the PHP/database boundary. This is materially more work than Propel 2's `UUID_BINARY` type, but it's the closest equivalent for binary-format UUID storage where a native UUID column type doesn't exist.

## Migrating an existing Propel 2 schema

If you're porting a Propel 2 schema to Propulsion and it uses `UUID` or `UUID_BINARY` columns:

1. Decide which of the three approaches above fits each column (native `uuid` type if PostgreSQL-only; plain string if portability matters most; manual binary conversion if you need the storage density and already have MySQL/MariaDB data in that format).
2. Change the column's `type` (and, for the native-type approach, add `sqlType`) in `schema.xml` accordingly.
3. If existing data is already stored as MySQL/MariaDB binary UUIDs (via `UUID_TO_BIN()`), write your own one-off migration to convert it to whichever representation you chose — Propulsion generates no automatic `CHAR`↔`UUID_BINARY` migration path the way Propel 2 did, since the type doesn't exist to migrate to or from.
4. Regenerate your models (`bin/propulsion model:build`) and update any code that called Propel 2's `UuidConverter` or relied on `filterByXXX()` accepting a UUID string on what's now a plain binary column.

## Related

- [Database schema reference: column types](/propulsion/reference/schema/#column-types) — Propulsion's full column type list, and the other Propel 2 types (`SET`, `GEOMETRY`) that are similarly absent.
- [Migrating from Propel 1](/propulsion/getting-started/migrating-from-propel/) — the broader set of behavior differences to check before porting a schema.
