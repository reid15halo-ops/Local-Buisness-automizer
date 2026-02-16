---
name: add-rls-policy
description: Add or modify Row Level Security policies on a Supabase table — supports per-operation policies, role-based access, and shared data patterns.
argument-hint: [table-name] [policy-type]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add RLS Policy

**Arguments:** `$ARGUMENTS` — parse as `[table-name] [policy-type]`

Policy types: `own` (default), `shared`, `readonly`, `admin`, `public-read`

### Steps

1. **Read** `supabase_schema.sql` to find the table and existing policies.
2. Add the appropriate policy:

### Policy Templates

**own** (default — user sees only their data):
```sql
CREATE POLICY "<table>_all_own" ON <table>
    FOR ALL USING (auth.uid() = user_id);
```

**shared** (user sees own + shared records):
```sql
CREATE POLICY "<table>_own" ON <table>
    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "<table>_shared_read" ON <table>
    FOR SELECT USING (
        id IN (SELECT record_id FROM shares WHERE shared_with = auth.uid())
    );
```

**readonly** (user can read but not modify):
```sql
CREATE POLICY "<table>_select_own" ON <table>
    FOR SELECT USING (auth.uid() = user_id);
```

**admin** (service role bypasses, users see own):
```sql
CREATE POLICY "<table>_user_own" ON <table>
    FOR ALL USING (auth.uid() = user_id);
-- Note: service_role key bypasses RLS automatically
```

**public-read** (anyone can read, only owner can write):
```sql
CREATE POLICY "<table>_public_read" ON <table>
    FOR SELECT USING (true);
CREATE POLICY "<table>_owner_write" ON <table>
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "<table>_owner_update" ON <table>
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "<table>_owner_delete" ON <table>
    FOR DELETE USING (auth.uid() = user_id);
```

### Always verify RLS is enabled first:
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
```
