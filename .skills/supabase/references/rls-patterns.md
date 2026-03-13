# RLS Patterns — FreyAI Visions

Row Level Security policy patterns used across the project. Every table must have RLS enabled
and at minimum two policies: user-own and service_role bypass.

## Pattern 1: Simple User-Own (Most Tables)

The default for business data tables. User sees only their own rows, service_role sees all.

```sql
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;

-- User CRUD on own rows
CREATE POLICY "[table]_user_own" ON [table]
    FOR ALL USING (auth.uid() = user_id);

-- Service role bypass (n8n, Edge Functions, pg_cron)
CREATE POLICY "[table]_service_role" ON [table]
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
```

Used by: kunden, anfragen, angebote, auftraege, rechnungen, buchungen, materialien, termine,
aufgaben, zeiteintraege, dokumente, purchase_orders, stock_movements, material_reservations,
suppliers, communication_log, admin_settings, bautagebuch_entries

## Pattern 2: Granular Per-Operation (High-Security Tables)

Separate policies for SELECT, INSERT, UPDATE, DELETE when you need different rules per operation
or want clearer audit trail.

```sql
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "[table]_select_own" ON [table]
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "[table]_insert_own" ON [table]
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "[table]_update_own" ON [table]
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "[table]_delete_own" ON [table]
    FOR DELETE USING (auth.uid() = user_id);

-- Service role with GUC bypass (secondary check)
CREATE POLICY "[table]_service_role" ON [table]
    FOR ALL USING (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    )
    WITH CHECK (
        auth.role() = 'service_role'
        OR (
            current_setting('app.bypass_rls', true) IS NOT NULL
            AND current_setting('app.bypass_rls', true)::boolean = true
        )
    );
```

Used by: profiles (via migration 003)

## Pattern 3: Append-Only (Audit Tables)

User can only read, service_role can insert. No updates or deletes allowed.

```sql
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;

-- Users read their own audit entries
CREATE POLICY "[table]_select_own" ON [table]
    FOR SELECT USING (auth.uid() = user_id);

-- Only service_role can insert (via Edge Functions, n8n)
CREATE POLICY "[table]_service_role_insert" ON [table]
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- No UPDATE or DELETE policies = immutable audit trail
```

Used by: gobd_audit_log, automation_log

## Pattern 4: Public Insert, Restricted Read (Forms)

Anonymous users can submit, only admins/service_role can read.

```sql
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous signups)
CREATE POLICY "[table]_anon_insert" ON [table]
    FOR INSERT WITH CHECK (true);

-- Only service_role can read
CREATE POLICY "[table]_admin_read" ON [table]
    FOR SELECT USING (auth.role() = 'service_role');
```

Used by: waitlist, client_errors (INSERT only for users)

## Pattern 5: Cross-Table Join Access (Portal)

Access granted via a join to another table (e.g., portal_responses visible via portal_tokens).

```sql
ALTER TABLE portal_responses ENABLE ROW LEVEL SECURITY;

-- No direct insert by authenticated users
CREATE POLICY "portal_responses_insert" ON portal_responses
    FOR INSERT WITH CHECK (false);  -- Only via Edge Function

-- Read access via token ownership join
CREATE POLICY "portal_responses_select" ON portal_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM portal_tokens pt
            WHERE pt.id = portal_responses.token_id
            AND pt.user_id = auth.uid()
        )
    );

-- Service role bypass
CREATE POLICY "portal_responses_service" ON portal_responses
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
```

Used by: portal_responses, stripe_payments (read via rechnungen join)

## Pattern 6: Service-Role Only (Internal Tables)

No user access at all — only Edge Functions and n8n via service_role.

```sql
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "[table]_service_only" ON [table]
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
```

Used by: inbound_emails

## Common Mistakes to Avoid

1. **Forgetting RLS entirely** — Every table must have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
2. **Missing service_role bypass** — n8n and Edge Functions need to access all rows
3. **Using `FOR ALL` without WITH CHECK** — INSERT/UPDATE require WITH CHECK, not just USING
4. **Forgetting user_id in INSERT policy** — User must set user_id = auth.uid() on insert
5. **UPDATE without double check** — Need both USING (which rows can be updated) and WITH CHECK (what values are valid)
6. **Not dropping old policies on migration** — Use `DROP POLICY IF EXISTS` before CREATE to avoid conflicts
