---
title: Adding Additional SQL Files
description: Have sql:exec run extra hand-written SQL alongside the generated DDL file.
---

You may want `sql:exec` to perform additional SQL operations beyond creating tables — adding views, stored procedures, triggers, or seed data. Rather than running extra SQL by hand every time you rebuild your object model, you can have Propulsion's generator do it for you.

## 1. Create the SQL DDL files

Create any additional SQL files you want executed against the database, after the generated DDL file is applied.

For example, to add a default value to a column using a SQL function unsupported directly in the schema format:

```sql
-- (for PostgreSQL)
ALTER TABLE my_table ALTER COLUMN my_column SET DEFAULT CURRENT_TIMESTAMP;
```

Save this as `my_column-default.sql` in the same directory as the generated DDL file (usually `generated-sql/` in your project, where `sql:build` writes one `.sql` file per `<database name="...">`, e.g. `your-db-name.sql`).

## 2. Tell `sql:exec` about the new file

`sql:exec` has no config file or mapping to edit — there is no `sqldb.map`-style mechanism in Propulsion. Instead, `sql-files` is a plain ordered argument list on the command itself: pass every `.sql` file you want executed, in the order they should run, along with the connection to run them against:

```bash
php bin/propulsion sql:exec generated-sql/your-db-name.sql my_column-default.sql \
    --dsn="pgsql:host=localhost;dbname=mydb" --user=me --password=secret
```

The generated file(s) and any hand-written extras all run over the single PDO connection given by `--dsn`/`--user`/`--password`, in the order listed on the command line.
