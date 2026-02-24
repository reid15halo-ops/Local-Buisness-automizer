# Security Review – FreyAI Visions / Local-Business-Automizer

**Date:** 2026-02-24
**Reviewer:** Claude (Automated Security Review)
**Scope:** Full codebase — frontend JS, Supabase Edge Functions, FastAPI backend, email relay, database schema, infrastructure configs

---

## Executive Summary

The codebase demonstrates solid security fundamentals: RLS on every database table, server-side API key proxying, HSTS/CSP headers, and input validation in many critical paths. However, several findings range from **critical** (unauthenticated public endpoints) to **medium** (incomplete SSRF blocklists, XSS sanitization gaps) that should be addressed before production scaling.

---

## Findings

### CRITICAL

---

#### C-1 — `process-inbound-email` is fully unauthenticated (no webhook signature check)

**File:** `supabase/functions/process-inbound-email/index.ts`
**Line:** 66 — `serve(async (req) => {`

The function is deployed with `--no-verify-jwt`, removing Supabase's built-in auth check. The code then immediately calls `req.json()` and processes the payload without verifying it originated from Resend's webhook system. Any actor on the internet can POST a crafted payload to this endpoint and:

- Create arbitrary customer records in the `kunden` table
- Create `anfragen` and `angebote` records under the default service-role context (no `user_id`)
- Trigger outbound emails to any address via the Resend API, consuming API quota
- Cause resource exhaustion / billing spikes on Gemini and Resend

**Resend inbound webhooks include an HMAC-SHA256 signature in the `svix-signature` header.** This should be verified before processing.

**Recommended fix:**
```typescript
import { Webhook } from 'https://esm.sh/svix@1.15.0/dist/webhook.js'

const wh = new Webhook(Deno.env.get('RESEND_WEBHOOK_SECRET')!)
const payload = await req.text()
const headers = Object.fromEntries(req.headers)
wh.verify(payload, headers) // throws if invalid
const email: InboundEmail = JSON.parse(payload)
```

---

#### C-2 — `check-overdue` has no incoming authentication

**File:** `supabase/functions/check-overdue/index.ts`
**Line:** 23 — `serve(async (req) => {`

This function accesses ALL users' invoices via service role and sends dunning emails. There is no check that the caller is the pg_cron scheduler or an admin. Any unauthenticated request triggers the dunning batch for every user in the system, potentially sending hundreds of emails.

**Recommended fix:** Validate that the `Authorization` header contains the `SUPABASE_SERVICE_ROLE_KEY` before processing:

```typescript
const authHeader = req.headers.get('Authorization') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, ... })
}
```

---

### HIGH

---

#### H-1 — API credentials stored in `localStorage`

**Files:** `js/app.js:2663`, `js/app-new.js:218`, `js/app-new.js:383`, `js/app-new.js:408`

The following secrets are persisted to `localStorage` (unencrypted, accessible to all JS on the page):

- `gemini_api_key`
- `email_relay_secret`
- `twilio_token` / `twilio_sid`
- `n8n_webhook_url`

`localStorage` is readable by any JavaScript executing on the same origin. An XSS vulnerability anywhere on the page — including in third-party scripts loaded via CDN — would expose all of these secrets. Combined with finding H-2 below (XSS gaps), this creates a realistic exfiltration path.

**Recommended mitigations:**
1. Move Twilio and relay credentials entirely to Supabase Edge Function environment variables — never to the browser.
2. The `gemini_api_key` is already proxied server-side via `ai-proxy`. If the frontend is not calling Gemini directly, remove the client-side key entirely.
3. If client-side storage is unavoidable, use `sessionStorage` (tab-scoped, cleared on close) and consider encrypting with a per-session key derived from the user's Supabase JWT.

---

#### H-2 — XSS: `window.UI?.sanitize?.(...)` is opt-in and silently skips when undefined

**File:** `js/app.js` (multiple locations — lines 195, 199, 200, 204, 261, 263, ...)

The codebase uses `window.UI?.sanitize?.(value)` in template literals rendered via `innerHTML`. The optional chaining (`?.`) means that if `window.UI` is undefined at render time (race condition, load order issue, or exception during initialization), the raw unsanitized value is used silently.

Example at `app.js:195`:
```js
container.innerHTML = anfragen.map(a => `
    <h3>${window.UI?.sanitize?.(a.kunde?.name) || 'Unbekannt'}</h3>
    ...
`).join('');
```

If `window.UI` is not yet loaded, `a.kunde?.name` is interpolated directly. Customer names, descriptions, and notizen fields come from database data that originated as user input — and the `process-inbound-email` function (C-1) populates these from AI-extracted email content, making injection a realistic attack path.

**Recommended fix:**
1. Ensure sanitization is a hard dependency — use a module-scoped function that throws if `UI` is unavailable rather than silently degrading.
2. Prefer `element.textContent = value` over `innerHTML` for text-only output.
3. Use a Content Security Policy `nonce`-based approach and remove `'unsafe-inline'` from `script-src`.

---

#### H-3 — SSRF protection is bypassable in `run-webhook` and `run-automation`

**Files:**
- `supabase/functions/run-webhook/index.ts:14`
- `supabase/functions/run-automation/index.ts:107`

**`run-webhook` blocklist:**
```typescript
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', 'metadata.google']
```

**`run-automation` blocklist:**
```typescript
if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) { ... }
```

These blocklists miss multiple SSRF bypass techniques:

| Bypass | Example |
|--------|---------|
| IPv6 loopback | `http://[::1]/` |
| Decimal IP | `http://2130706433/` (= 127.0.0.1) |
| Octal IP | `http://0177.0.0.1/` |
| Private RFC 1918 | `http://10.0.0.1/`, `http://192.168.1.1/` |
| AWS metadata | `http://169.254.169.254/latest/meta-data/` (partially blocked, but only exact match) |
| GCP/Azure metadata | `http://metadata.google.internal/` variants |
| DNS rebinding | `evil.com` resolving to 127.0.0.1 after URL check |

An authenticated user can use `run-webhook` to reach internal services on the same network as the Supabase edge function runtime.

**Recommended fix:** Use an IP-based allowlist approach: resolve the hostname after URL parsing and check the resolved IP against RFC 1918 / RFC 5735 ranges, rejecting any that fall in private/link-local/loopback space. Also consider limiting target domains to a user-configured allowlist.

---

#### H-4 — HTML injection in outbound emails from AI-extracted content

**File:** `supabase/functions/process-inbound-email/index.ts:503–565`

Customer names and AI-generated follow-up questions extracted from inbound emails are interpolated directly into HTML email bodies:

```typescript
const htmlBody = `
    ...
    <p>Sehr geehrte/r ${kundenName},</p>
    ...
    ${questionsHTML}
    ...
`
```

Where `questionsHTML` is:
```typescript
const questionsHTML = questions.map((q, i) =>
    `<li><strong>${i + 1}.</strong> ${q}</li>`
).join('')
```

An attacker can send an email with an HTML payload in their name or in the email body, causing the AI to include it in a `question`, which then gets rendered as raw HTML in the outbound email. While email clients vary in HTML rendering security, this could inject tracking pixels, external resource loads, or phishing links into emails sent to customers.

**Recommended fix:** HTML-encode all AI-extracted strings before interpolation:
```typescript
function escapeHtml(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
           .replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
```

---

### MEDIUM

---

#### M-1 — `automation_log` INSERT policy allows spoofing `user_id`

**File:** `config/supabase-schema.sql:383`

```sql
CREATE POLICY "Edge functions can insert logs" ON automation_log
    FOR INSERT WITH CHECK (true);
```

`WITH CHECK (true)` allows any authenticated user to insert log rows with any `user_id` value, including another user's ID. This pollutes audit logs and could be used to frame other users or obscure an attacker's own activity.

**Recommended fix:**
```sql
CREATE POLICY "Edge functions can insert logs" ON automation_log
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR auth.role() = 'service_role'
    );
```

---

#### M-2 — `rejectUnauthorized: false` disables TLS validation on SMTP

**File:** `vps/email-relay/server.js:44-46`

```javascript
tls: {
    rejectUnauthorized: false,
}
```

This disables certificate verification for the SMTP connection to Proton Mail Bridge. While the Bridge runs locally on `127.0.0.1` with a self-signed cert, this setting persists even if `SMTP_HOST` is misconfigured to an external host, enabling a man-in-the-middle attack on email credentials and content.

**Recommended fix:** Pin the Proton Bridge certificate fingerprint, or use a separate config path:
```javascript
tls: {
    rejectUnauthorized: SMTP_HOST !== '127.0.0.1' && SMTP_HOST !== 'localhost',
}
```

---

#### M-3 — In-memory rate limiter resets on cold starts

**File:** `supabase/functions/ai-proxy/index.ts:15-33`

```typescript
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
```

Supabase Edge Functions are stateless; each new function instance starts with an empty `rateLimitMap`. A user who understands cold-start behavior (or an attacker who deliberately triggers restarts) can reset their rate limit counter, effectively bypassing the 50 req/hour limit.

**Recommended fix:** Store rate limit counters in the `automation_log` table (count rows in last hour per user), or in Supabase KV / Redis if available. A simple SQL-based approach:
```sql
-- Check rate limit
SELECT COUNT(*) FROM automation_log
WHERE user_id = $1 AND action = 'ai.gemini_request'
  AND created_at > NOW() - INTERVAL '1 hour';
```

---

#### M-4 — `process-inbound-email` creates records without `user_id`

**File:** `supabase/functions/process-inbound-email/index.ts:318-347`

Records inserted into `kunden` and `anfragen` tables via the automated email pipeline do not include a `user_id`:

```typescript
await supabase.from('kunden').insert({
    name: analysis.kunde.name,
    firma: analysis.kunde.firma,
    email: email.from.email,
    ...
    // no user_id!
})
```

The schema defines `user_id UUID ... NOT NULL` on these tables. Unless there is a DB-level default, these inserts will fail silently (or succeed if the service role bypasses NOT NULL). Even if it works, orphaned records without `user_id` are invisible to all users via RLS and create data integrity issues.

**Recommended fix:** Map inbound emails to a specific user account (e.g., by the recipient address) and include the corresponding `user_id` in all inserts.

---

#### M-5 — `nginx.conf` CSP references `api.openai.com`

**File:** `infrastructure/hetzner/nginx.conf:177`

```nginx
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com;
```

The nginx CSP allows browser-to-OpenAI connections. This contradicts the stated security model where AI keys are held server-side. If this is unused, remove it. If OpenAI is used directly from the browser in some deployments, those calls should also be proxied through an edge function.

---

#### M-6 — Error messages expose internal details in 500 responses

**Files:** Multiple Edge Functions (e.g., `ai-proxy/index.ts:122`, `send-email/index.ts:86`)

```typescript
return new Response(
    JSON.stringify({ error: err.message }),
    { status: 500, ... }
)
```

Unhandled exceptions return `err.message` directly. This can expose internal paths, dependency versions, and configuration details to external callers.

**Recommended fix:** Log the full error server-side and return a generic message:
```typescript
console.error('Unhandled error:', err)
return new Response(
    JSON.stringify({ error: 'Interner Serverfehler' }),
    { status: 500, ... }
)
```

---

### LOW

---

#### L-1 — Token comparison is not timing-safe

**File:** `vps/email-relay/server.js:65`

```javascript
if (token !== API_SECRET) { ... }
```

String comparison with `!==` is not constant-time, making it theoretically susceptible to timing attacks. In practice this requires very precise measurement in a local network environment, but best practice is to use a constant-time comparison.

**Recommended fix:**
```javascript
const crypto = require('crypto')
if (!API_SECRET || !crypto.timingSafeEqual(
    Buffer.from(token), Buffer.from(API_SECRET)
)) { ... }
```

---

#### L-2 — Pinned Deno std library version is outdated

**Files:** All `supabase/functions/*/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
```

Version `0.177.0` was released in early 2023. The current Deno standard library has received multiple security and bug fixes since then. Consider updating to a recent release.

---

#### L-3 — `esm.sh` imports lack pinned patch versions

**Files:** All edge functions using `@supabase/supabase-js@2` and `stripe@14.14.0`

`@supabase/supabase-js@2` resolves to any `2.x.x` patch, which could introduce breaking changes or regressions. Consider pinning to an exact version for reproducibility.

---

#### L-4 — `client_max_body_size 50M` on webhook proxy

**File:** `infrastructure/hetzner/nginx.conf:147`

50 MB is generous for webhook payloads and could be used to tie up worker processes with large uploads. Unless n8n workflows genuinely need 50 MB file uploads over the webhook path, consider reducing to 5–10 MB.

---

#### L-5 — `notifications` INSERT policy allows any authenticated user to notify any user

**File:** `config/supabase-schema.sql:406`

```sql
CREATE POLICY "Edge functions can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);
```

Any authenticated user can insert a notification with any `user_id`, causing notifications to appear in another user's UI. Similar to M-1, this should require `auth.uid() = user_id OR auth.role() = 'service_role'`.

---

## Positive Security Controls

The following are well-implemented and should be maintained:

| Area | Detail |
|------|--------|
| **RLS on all tables** | Every table has `ENABLE ROW LEVEL SECURITY` and appropriate policies |
| **Server-side AI key proxy** | Gemini key is never sent to the browser; the `ai-proxy` edge function holds it |
| **Stripe webhook signature verification** | `stripe.webhooks.constructEvent()` correctly validates the `stripe-signature` header |
| **HSTS + full CSP** | Both `.htaccess` and `netlify.toml` include comprehensive security headers |
| **`server_tokens off`** | Nginx version not exposed |
| **GDPR-compliant font delivery** | No Google Fonts CDN — fonts are self-hosted |
| **No secrets in git** | `.gitignore` excludes `.env` and `.credentials`; only `.env.example` committed |
| **PII sanitizer** | FastAPI `pii_sanitizer.py` provides GDPR-compliant redaction before AI processing |
| **Non-root Docker user** | `services/backend/Dockerfile` runs as `appuser:1001` |
| **TLS 1.2/1.3 only** | `nginx.conf` explicitly disables TLS 1.0/1.1 |
| **Blocked hidden files** | `location ~ /\.` returns 404 in nginx |
| **Content-type validation** | FastAPI uses Pydantic models for all request bodies |

---

## Remediation Priority

| ID | Severity | Finding | Effort |
|----|----------|---------|--------|
| C-1 | Critical | `process-inbound-email` unauthenticated — add Resend webhook signature verification | Low |
| C-2 | Critical | `check-overdue` unauthenticated — add service role token check | Low |
| H-1 | High | Credentials in `localStorage` — move to server-side env vars | Medium |
| H-2 | High | XSS sanitization silently skipped — harden to fail-closed | Medium |
| H-3 | High | SSRF blocklist incomplete — add private range IP checks | Low |
| H-4 | High | HTML injection in outbound emails — HTML-encode AI output | Low |
| M-1 | Medium | `automation_log` policy allows `user_id` spoofing | Low |
| M-2 | Medium | TLS validation disabled on SMTP | Low |
| M-3 | Medium | Rate limiter resets on cold start | Medium |
| M-4 | Medium | Inbound email records created without `user_id` | Medium |
| M-5 | Medium | CSP allows OpenAI direct browser access | Low |
| M-6 | Medium | 500 responses expose internal error messages | Low |
| L-1 | Low | Non-constant-time token comparison | Low |
| L-2 | Low | Outdated Deno std library | Low |
| L-3 | Low | Unpinned esm.sh versions | Low |
| L-4 | Low | 50 MB upload limit on webhook proxy | Low |
| L-5 | Low | `notifications` INSERT allows cross-user injection | Low |
