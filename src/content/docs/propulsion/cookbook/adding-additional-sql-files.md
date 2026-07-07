---
title: Adding Additional SQL Files
description: Have sql:exec run extra hand-written SQL alongside the generated schema.sql.
---

You may want `sql:exec` to perform additional SQL operations beyond creating tables — adding views, stored procedures, triggers, or seed data. Rather than running extra SQL by hand every time you rebuild your object model, you can have Propulsion's generator do it for you.

## 1. Create the SQL DDL files

Create any additional SQL files you want executed against the database, after the base `schema.sql` file is applied.

For example, to add a default value to a column using a SQL function unsupported directly in the schema format:

```sql
-- (for PostgreSQL)
ALTER TABLE my_table ALTER COLUMN my_column SET DEFAULT CURRENT_TIMESTAMP;
```

Save this as `my_column-default.sql` in the same directory as the generated `schema.sql` file (usually `generated-sql/` in your project).

## 2. Tell Propulsion about the new file

In that same directory, a `sqldb.map` file maps SQL DDL files to the database connection they should run against. After running the generator, you'll usually have a single entry that looks like:

```
schema.sql=your-db-name
```

Add the new file to this mapping (future builds preserve anything you add here). When you're done, the file looks like:

```
schema.sql=your-db-name
my_column-default.sql=your-db-name
```

Now when you run `sql:exec`, the `my_column-default.sql` file is executed against the `your-db-name` connection right after `schema.sql`:

```bash
php bin/propulsion sql:exec
```
