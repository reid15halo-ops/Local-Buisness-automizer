---
name: supabase
description: |
  Create and modify Supabase database tables, RLS policies, Edge Functions, migrations, and client-side
  Supabase queries for the FreyAI Visions project. Use this skill whenever the user wants to add a new
  database table, write a migration, create or edit an Edge Function, set up RLS policies, write Supabase
  queries, configure pg_cron jobs, work with Supabase Auth, manage Storage buckets, or debug any
  Supabase-related issue. Also trigger when the user says "add a table", "new migration", "edge function",
  "RLS", "row level security", "database", "schema", "policy", "Deno function", "cron job", "pg_cron",
  "realtime", "Supabase Storage", "auth trigger", "service_role", or mentions any FreyAI table name
  (kunden, rechnungen, angebote, auftraege, anfragen, termine, etc.).
---

# Supabase — Database, Auth, Edge Functions & Migrations

Build and maintain Supabase infrastructure for FreyAI Visions. Every database change must be safe,
auditable, and follow the project's multi-tenant RLS patterns.

## Project Context

Before writing anything, understand the architecture:

- **Project ref**: `incbhhaiiayohrjqevog`
- **Architecture**: 95/5 — 95% async (n8n workflows via service_role), 5% sync (client-side via anon key)
- **Multi-tenant**: Every data table has `user_id UUID REFERENCES auth.users(id)` for tenant isolation
- **RLS everywhere**: No table without RLS. No policy without both user-own and service_role bypass
- **Edge Functions**: Deno/TypeScript, deployed via `supabase functions deploy <name>`
- **Extensions**: `uuid-ossp`, `pg_cron`, `pg_net` are enabled
- **German table names**: Business tables use German (kunden, rechnungen, angebote, auftraege, anfragen, termine)

Read `references/schema-guide.md` for the complete table catalog and naming conventions.

## Database Work

### Creating New Tables

Every new table follows this template:

```sql
-- ============================================
-- [Table Name] ([English description])
-- ============================================
CREATE TABLE IF NOT EXISTS [table_name] (
    id TEXT PRIMARY KEY,                    -- or UUID DEFAULT uuid_generate_v4()
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    -- ... domain columns ...
    status TEXT DEFAULT '[default]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- User owns their rows
CREATE POLICY "[table]_user_own" ON [table_name]
    FOR ALL USING (auth.uid() = user_id);

-- Service role bypass (n8n, Edge Functions)
CREATE POLICY "[table]_service_role" ON [table_name]
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
```

Key decisions for every table:
1. **Primary key**: TEXT (client-generated UUIDs for offline-first) or UUID (server-generated)
2. **Foreign keys**: Always include `ON DELETE CASCADE` for user_id, consider for other FKs
3. **JSONB columns**: Use for flexible structures (positionen, metadata) but not for queryable fields
4. **Indexes**: Add for columns used in WHERE/ORDER BY after the table is created
5. **Status values**: Use CHECK constraints to enumerate valid statuses

Read `references/rls-patterns.md` for the complete RLS policy catalog with granular per-operation patterns.

### Writing Migrations

Migrations go in `supabase/migrations/` with timestamp prefix:

```
supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql
```

Migration rules:
1. **Idempotent**: Use `IF NOT EXISTS`, `DROP ... IF EXISTS` before CREATE
2. **Rollback-safe**: Include comments for manual rollback steps
3. **One concern per file**: Don't mix table creation with data seeding
4. **RLS in same file**: Always include RLS policies alongside table creation
5. **Test locally first**: Run against a test database before production

Also place a copy in `config/sql/migration-[name].sql` for the migration archive.

```sql
-- Migration: YYYYMMDDHHMMSS_create_[table_name]
-- Purpose: [one-line description]
-- Rollback: DROP TABLE IF EXISTS [table_name];

BEGIN;

-- Table creation + RLS policies here

COMMIT;
```

### Client-Side Queries

The frontend uses `window.supabaseConfig.get()` to access the Supabase client. Queries follow this pattern:

```javascript
const client = window.supabaseConfig.get();

// SELECT with RLS (auto-filtered to user's data)
const { data, error } = await client
    .from('kunden')
    .select('*')
    .eq('status', 'aktiv')
    .order('created_at', { ascending: false });

// INSERT
const { data, error } = await client
    .from('kunden')
    .insert({ id: crypto.randomUUID(), name, email, user_id: authService.user.id })
    .select()
    .single();

// UPDATE
const { error } = await client
    .from('kunden')
    .update({ name: newName, updated_at: new Date().toISOString() })
    .eq('id', kundeId);

// DELETE
const { error } = await client
    .from('kunden')
    .delete()
    .eq('id', kundeId);
```

Important patterns:
- Always include `user_id` on INSERT (RLS requires it)
- Use `.select().single()` after INSERT to get the created row back
- The offline-first layer in `db-service.js` handles IndexedDB fallback — don't duplicate that logic
- Table name mapping: IndexedDB uses English (customers), Supabase uses German (kunden)

## Edge Functions

### Creating Edge Functions

Edge Functions live in `supabase/functions/[name]/index.ts` and use Deno.

Read `references/edge-functions-guide.md` for the complete boilerplate, CORS setup, auth patterns, and deployment checklist.

Standard structure:

```typescript
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Auth: extract user from JWT or validate service_role
        const authHeader = req.headers.get('Authorization') ?? ''
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // ... function logic ...

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
```

### Edge Function Categories

| Category | Functions | Auth Pattern |
|----------|-----------|-------------|
| **User-facing** | ai-proxy, portal-api | JWT from client (anon key) |
| **Webhook receivers** | stripe-webhook, process-inbound-email | `--no-verify-jwt`, validate via webhook secret |
| **Internal/Cron** | check-overdue, run-automation | service_role key validation |
| **Billing** | create-checkout, create-portal-session | JWT + Stripe SDK |

## pg_cron Jobs

Set up scheduled jobs using pg_cron + pg_net to call Edge Functions:

```sql
SELECT cron.schedule(
    'job-name-daily',
    '0 8 * * *',  -- 08:00 UTC daily
    $$SELECT net.http_post(
        url := '<SUPABASE_URL>/functions/v1/function-name',
        headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    )$$
);
```

Existing cron jobs:
- `check-overdue-daily` — 08:00 daily, calls `check-overdue` for invoice reminders

## Quality Checklist

Before delivering any Supabase work, verify:

- [ ] **RLS enabled**: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` present
- [ ] **User policy**: `auth.uid() = user_id` for row ownership
- [ ] **Service role bypass**: Separate policy with `auth.role() = 'service_role'`
- [ ] **user_id column**: Every data table has `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`
- [ ] **Idempotent DDL**: Uses `IF NOT EXISTS`, `IF EXISTS` for safe re-runs
- [ ] **Migration file**: Placed in both `supabase/migrations/` and `config/sql/`
- [ ] **CORS headers**: Edge Functions include CORS preflight handler
- [ ] **Error handling**: All Supabase calls check `{ error }` response
- [ ] **German naming**: Business tables use German names matching existing schema
- [ ] **No secrets in code**: Environment variables via `Deno.env.get()`, never hardcoded
- [ ] **Timestamps**: `created_at` and `updated_at` columns with TIMESTAMPTZ
- [ ] **CASCADE**: Foreign keys to auth.users use ON DELETE CASCADE

## Reference Files

- `references/schema-guide.md` — Complete table catalog, column types, relationships, naming conventions
- `references/edge-functions-guide.md` — Edge Function boilerplate, auth patterns, deployment, env vars
- `references/rls-patterns.md` — RLS policy patterns (simple, granular, service_role, special cases)
