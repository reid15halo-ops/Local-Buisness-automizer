---
name: supabase
description: |
  Supabase database, RLS policies, Edge Functions, migrations, and queries for FreyAI Visions.
  Trigger on: "add a table", "migration", "edge function", "RLS", "database", "schema", "policy",
  "pg_cron", "realtime", "service_role", or any FreyAI table name (kunden, rechnungen, angebote, etc.).
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

## Task Router

Determine what the user needs and jump to the right section:

| User wants | Go to |
|-----------|-------|
| New table | "Creating New Tables" below |
| Schema change on existing table | "Writing Migrations" below |
| Edge Function (new or edit) | "Edge Functions" below |
| Client-side query | "Client-Side Queries" below |
| Scheduled job | "pg_cron Jobs" below |
| RLS policy work | `references/rls-patterns.md` |

## Database Work

### Creating New Tables

Every new table MUST include these 5 elements (no exceptions):
1. `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL`
2. `created_at TIMESTAMPTZ DEFAULT NOW()` and `updated_at TIMESTAMPTZ DEFAULT NOW()`
3. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
4. User-own policy: `auth.uid() = user_id`
5. Service role bypass policy: `auth.role() = 'service_role'`

See `references/schema-guide.md` for the full table template with SQL. Key decisions:
- **Primary key**: TEXT (offline-first, client-generated UUID) vs UUID (server-generated)
- **JSONB**: Use for flexible structures (positionen, metadata), not for queryable fields
- **Indexes**: Add for columns in WHERE/ORDER BY clauses
- **Status values**: Constrain with CHECK

Read `references/rls-patterns.md` for the complete RLS policy catalog with granular per-operation patterns.

### Writing Migrations

File: `supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql` + copy to `config/sql/migration-[name].sql`

Rules:
1. **Idempotent**: `IF NOT EXISTS` / `DROP ... IF EXISTS`
2. **Rollback comment**: Every migration starts with `-- Rollback: [SQL]`
3. **One concern per file**: No mixing table creation with data seeding
4. **RLS in same file**: Include RLS policies alongside table creation
5. **Wrap in transaction**: `BEGIN; ... COMMIT;`

### Client-Side Queries

Client: `window.supabaseConfig.get()`. Critical rules:
- Always include `user_id: authService.user.id` on INSERT (RLS requires it)
- Use `.select().single()` after INSERT to get the created row back
- Always check `{ error }` in response -- never ignore it
- The offline-first layer in `db-service.js` handles IndexedDB fallback -- do not duplicate
- Table name mapping: IndexedDB uses English (customers), Supabase uses German (kunden)

See `references/schema-guide.md` for query examples (SELECT, INSERT, UPDATE, DELETE).

## Edge Functions

Location: `supabase/functions/[name]/index.ts` (Deno/TypeScript). Read `references/edge-functions-guide.md` for full boilerplate.

Every Edge Function MUST have: CORS preflight handler, proper auth pattern, error response with status code, no hardcoded secrets.

| Category | Auth Pattern | Example |
|----------|-------------|---------|
| **User-facing** | JWT from client (anon key) | ai-proxy, portal-api |
| **Webhook** | `--no-verify-jwt`, validate webhook secret | stripe-webhook |
| **Internal/Cron** | service_role key validation | check-overdue |
| **Billing** | JWT + Stripe SDK | create-checkout |

Deploy: `supabase functions deploy <name> --project-ref incbhhaiiayohrjqevog`

### TypeScript Types & Runtime Validation

Every Edge Function must define TypeScript interfaces for its request and response payloads. Never use `any`.

```typescript
// Define strict interfaces for all data shapes
interface AngebotPayload {
  angebot_id: string;
  kunde_email: string;
  positionen: Position[];
  netto: number;
  gueltig_bis: string; // ISO 8601 date string
}

interface Position {
  beschreibung: string;
  menge: number;
  einheit: 'Pauschal' | 'Std.' | 'Stk.' | 'Monat' | 'm' | 'm2';
  einzelpreis: number;
  rabatt?: number;
}

// Runtime validation -- reject malformed payloads early
function validateAngebotPayload(body: unknown): body is AngebotPayload {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.angebot_id === 'string' &&
    typeof b.kunde_email === 'string' &&
    Array.isArray(b.positionen) &&
    typeof b.netto === 'number' &&
    typeof b.gueltig_bis === 'string'
  );
}

// Use in handler
Deno.serve(async (req) => {
  const body = await req.json().catch(() => null);
  if (!validateAngebotPayload(body)) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  // body is now typed as AngebotPayload
});
```

### Type-Safe Supabase Client in Edge Functions

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Always type the client with Database generic if available
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Type the response explicitly
const { data, error }: { data: Kunde[] | null; error: Error | null } =
  await supabase.from('kunden').select('*').eq('user_id', userId);

if (error) {
  console.error('[Edge] Supabase query failed:', error.message);
  return new Response(JSON.stringify({ error: error.message }), { status: 500 });
}
```

### Environment Variables

Never hardcode secrets. All secrets via `Deno.env.get()`:

```typescript
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

// Fail fast if required env vars are missing
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing required environment variables');
}
```

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
- [ ] **TypeScript types**: Edge Functions define interfaces for all request/response payloads, no `any`
- [ ] **Runtime validation**: Edge Functions validate incoming payload shape before processing
- [ ] **Env var guard**: Edge Function fails fast if required env vars are missing

## Reference Files

- `references/schema-guide.md` — Complete table catalog, column types, relationships, naming conventions
- `references/edge-functions-guide.md` — Edge Function boilerplate, auth patterns, deployment, env vars
- `references/rls-patterns.md` — RLS policy patterns (simple, granular, service_role, special cases)
