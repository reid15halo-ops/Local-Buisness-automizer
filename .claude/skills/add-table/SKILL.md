---
name: add-table
description: Add a new Supabase PostgreSQL table with UUID PKs, RLS policies, updated_at trigger, and indexes.
argument-hint: [table-name]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add a Supabase Table

Create a new table called `$ARGUMENTS` in `supabase_schema.sql`.

### Steps

1. **Read** `supabase_schema.sql` to understand existing schema and conventions.
2. **Append** the new table definition following these rules:

#### Schema Rules (FreyAI Core)

- **Primary key**: `id UUID DEFAULT uuid_generate_v4() PRIMARY KEY`
- **Ownership**: `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL`
- **Timestamps**: `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **RLS**: Always `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
- **RLS Policy**: Single `FOR ALL USING (auth.uid() = user_id)` policy named `<table>_all_own`
- **Index**: Always create `idx_<table>_user_id` on `user_id`
- **Trigger**: Attach `update_updated_at()` as `trg_<table>_updated_at`
- **Naming**: English, snake_case column names
- **Numerics**: `NUMERIC(12,2)` for money, `NUMERIC(5,2)` for percentages
- **JSONB**: Prefer for nested data; add `COMMENT ON COLUMN` explaining shape
- **CHECK constraints**: For status enums
- **Foreign keys**: `ON DELETE SET NULL` for optional refs

#### Output Format

```sql
-- ============================================================
-- N. TABLE_NAME
-- ============================================================
```
