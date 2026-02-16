---
name: add-table
description: Add a new Supabase PostgreSQL table with UUID PKs, RLS policies, updated_at trigger, and indexes. Use when creating new database entities.
argument-hint: [table-name]
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add a Supabase Table

Create a new table called `$ARGUMENTS` in `supabase_schema.sql`.

### Requirements

1. **Read** `supabase_schema.sql` to understand the existing schema and conventions.
2. **Append** the new table definition to `supabase_schema.sql` following these rules:

#### Schema Rules (FreyAI Core)

- **Primary key**: `id UUID DEFAULT uuid_generate_v4() PRIMARY KEY`
- **Ownership**: `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL`
- **Timestamps**: `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **RLS**: Always `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
- **RLS Policy**: Use a single `FOR ALL USING (auth.uid() = user_id)` policy named `<table>_all_own`
- **Index**: Always create `idx_<table>_user_id` on `user_id`
- **Trigger**: Attach the existing `update_updated_at()` trigger as `trg_<table>_updated_at`
- **Naming**: Use English, snake_case column names
- **Numerics**: Use `NUMERIC(12,2)` for money, `NUMERIC(5,2)` for percentages
- **JSONB**: Prefer JSONB for flexible/nested data; add a `COMMENT ON COLUMN` explaining the shape
- **CHECK constraints**: Add for status enums (e.g., `CHECK (status IN ('active', 'archived'))`)
- **Foreign keys**: Reference other project tables where appropriate, use `ON DELETE SET NULL` for optional refs

#### Output Format

Wrap the new table in a section comment block matching the existing style:

```sql
-- ============================================================
-- N. TABLE_NAME
-- ============================================================
```

3. **Ask the user** if they want you to also add the store-service mapping for this table (offer to run `/add-store-entity`).
