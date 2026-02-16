---
name: db-audit
description: Audit the entire Supabase schema for missing RLS, indexes, triggers, type mismatches, and orphaned references.
context: fork
agent: general-purpose
allowed-tools: Read, Grep, Glob
---

## Database Schema Audit

### Steps

1. **Read** `supabase_schema.sql` completely.
2. Audit every table against the checklist below.
3. Report findings as a structured table.

### Audit Checklist (per table)

| Check | Rule |
|-------|------|
| PK | `id UUID DEFAULT uuid_generate_v4()` |
| user_id | Present, references `auth.users(id) ON DELETE CASCADE` |
| RLS | `ENABLE ROW LEVEL SECURITY` present |
| RLS Policy | At least one policy with `auth.uid() = user_id` |
| created_at | `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| updated_at | `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| updated_at trigger | `trg_<table>_updated_at` attached |
| user_id index | `idx_<table>_user_id` exists |
| Money columns | Use `NUMERIC(12,2)`, not FLOAT/REAL/DOUBLE |
| Status columns | Have CHECK constraint with valid values |
| FK integrity | All REFERENCES point to existing tables |
| JSONB docs | JSONB columns have `COMMENT ON COLUMN` |
| Naming | All columns are English snake_case |

### Output Format

```
| Table | PK | RLS | Policy | Timestamps | Trigger | Index | Issues |
|-------|----|----|--------|------------|---------|-------|--------|
| profiles | OK | OK | OK | OK | OK | N/A | None |
| clients  | OK | OK | OK | OK | MISSING | OK | Add trigger |
```

Then list specific SQL fixes for each issue found.
