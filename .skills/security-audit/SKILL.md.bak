---
name: security-audit
description: |
  Perform security audits, vulnerability assessments, and compliance reviews for the FreyAI Visions platform.
  Use this skill when the user asks about security review, security audit, CSP policy, Content Security Policy,
  XSS prevention, cross-site scripting, RLS audit, row level security review, DSGVO compliance, GDPR compliance,
  auth hardening, authentication security, vulnerability scan, penetration testing, pen test, input validation,
  OWASP, SQL injection, CSRF, rate limiting, token security, session management, data encryption, PII protection,
  data breach prevention, or says things like "is this secure", "check security", "audit the auth", "harden this",
  "review CSP", "fix XSS", "are we DSGVO compliant", "security checklist", "vulnerability check". Be pushy.
---

# Security Audit Skill

Perform comprehensive security audits for FreyAI Visions. This platform handles PII (customer data, addresses, phone numbers) and financial data (invoices, payments, IBAN) for German craftsmen. DSGVO compliance is non-negotiable.

Read `references/checklist.md` before starting any audit -- it contains the full security checklist organized by severity.

## Project Security Architecture

Before auditing, understand the existing security layers:

- **`js/services/security-service.js`** -- Input validation (email, phone, IBAN, tax ID), rate limiting, CSRF tokens, HTML escaping, URL validation, security event logging
- **`js/services/sanitize-service.js`** -- XSS protection (escapeHtml, escapeAttr, sanitizeText, sanitizeUrl, sanitizeEmail, sanitizePhone), safe JSON parse
- **`js/services/auth-service.js`** -- Supabase Auth wrapper (login, register, logout, session, password reset, auth state listeners)
- **Supabase RLS** -- Row Level Security on all tables, user_id tenant isolation, service_role bypass for n8n/Edge Functions
- **Edge Functions** -- CORS headers, JWT validation, service_role auth for internal calls
- **Service Worker** -- Offline-first PWA with cache management

## 1. CSP Policy Review

Check the Content Security Policy configuration. For this stack (Vanilla JS PWA + Supabase + self-hosted fonts), the CSP must be tight.

### Required Directives

| Directive | Allowed Sources | Rationale |
|-----------|----------------|-----------|
| `default-src` | `'self'` | Deny everything not explicitly allowed |
| `script-src` | `'self'` | No inline scripts, no CDN, no eval. If inline is needed, use nonce/hash |
| `style-src` | `'self' 'unsafe-inline'` | Self-hosted CSS. Unsafe-inline only if absolutely required (document why) |
| `connect-src` | `'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co` | Supabase REST + Realtime WebSocket |
| `img-src` | `'self' data: blob:` | Local images, data URIs for generated content |
| `font-src` | `'self'` | Self-hosted fonts only (DSGVO -- no Google Fonts CDN) |
| `frame-ancestors` | `'none'` | Prevent clickjacking |
| `base-uri` | `'self'` | Prevent base tag injection |
| `form-action` | `'self'` | Restrict form submission targets |
| `object-src` | `'none'` | No plugins (Flash, Java) |
| `upgrade-insecure-requests` | (directive) | Force HTTPS |

### Audit Steps

1. Check where CSP is set (meta tag in HTML vs. server header). Server header is preferred.
2. Search all HTML files for `<meta http-equiv="Content-Security-Policy">`
3. Check Nginx config on VPS for CSP headers
4. Verify no `unsafe-eval` in script-src (breaks CSP for XSS protection)
5. Verify no wildcard (`*`) in any directive
6. Check that Supabase project URL is specifically listed, not a broad wildcard
7. Test by opening browser DevTools Console -- CSP violations show as errors

## 2. XSS Prevention

FreyAI uses two services for XSS prevention. Audit their usage across the codebase.

### Sanitize Service Integration Checks

1. **Every `innerHTML` assignment** must use `sanitize.escapeHtml()` or `sanitize.sanitizeText()`
2. **Every data attribute** set from user input must use `sanitize.sanitizeForDataAttr()`
3. **Every URL from user input** must pass through `sanitize.sanitizeUrl()` (blocks `javascript:` protocol)
4. **Template literals in DOM** -- search for `` `<div>${variable}` `` patterns without escaping
5. **Event handler attributes** -- search for `onclick=`, `onerror=` in dynamically generated HTML

### Audit Commands

```bash
# Find innerHTML assignments without sanitize
grep -rn 'innerHTML' js/ --include='*.js' | grep -v 'sanitize\|escapeHtml'

# Find template literals injecting into DOM
grep -rn 'innerHTML.*\`' js/ --include='*.js'

# Find document.write usage (should be zero)
grep -rn 'document\.write' js/ --include='*.js'

# Find eval usage (should be zero)
grep -rn 'eval(' js/ --include='*.js'

# Find dangerouslySetInnerHTML patterns
grep -rn 'insertAdjacentHTML\|outerHTML' js/ --include='*.js'
```

### DOM Injection Patterns to Flag

- Direct `element.innerHTML = userInput` without escaping -- **CRITICAL**
- `document.createElement('script')` with dynamic src -- **CRITICAL**
- `window.location = userInput` without URL validation -- **HIGH**
- `element.setAttribute('href', userInput)` without sanitizeUrl -- **HIGH**
- `element.style.cssText = userInput` (CSS injection) -- **MEDIUM**

## 3. Supabase RLS Audit

Every table in the database MUST have RLS enabled with proper policies. The 95/5 architecture means most data flows through service_role (n8n), so RLS bypass documentation is critical.

### RLS Checklist

For each table in the schema (`config/sql/supabase-schema.sql`):

1. **RLS enabled**: `ALTER TABLE [table] ENABLE ROW LEVEL SECURITY` exists
2. **User-own policy**: `auth.uid() = user_id` for ALL operations (SELECT, INSERT, UPDATE, DELETE)
3. **Service role bypass**: Separate policy with `auth.role() = 'service_role'` for n8n/Edge Functions
4. **No public access**: No policy that grants access without auth (unless intentional, e.g., waitlist)
5. **INSERT restriction**: WITH CHECK clause ensures user_id = auth.uid() on INSERT (prevents impersonation)
6. **DELETE restriction**: Verify CASCADE behavior on user deletion

### Tables to Audit

From the schema: `waitlist`, `profiles`, `kunden`, `anfragen`, `angebote`, `auftraege`, `rechnungen`, `positionen`, `materialien`, `lager`, `bestellungen`, `termine`, `zahlungen`, `mahnungen`, `dokumente`, `email_log`, `sms_log`

### Service Role Bypass Documentation

The `service_role` key bypasses RLS entirely. Document where it is used:

- **n8n workflows**: All async automations use service_role via environment variable
- **Edge Functions**: Internal/cron functions use `SUPABASE_SERVICE_ROLE_KEY` from Deno.env
- **Backend (FastAPI)**: OCR, PII processing use service_role for data access
- **NEVER in client-side code**: The anon key is for client-side, service_role must never be exposed to the browser

### Audit Command

```sql
-- Check which tables have RLS enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- List all RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

## 4. Auth Flow Security

Audit the authentication implementation in `auth-service.js` and supporting infrastructure.

### Token Storage

- Supabase JS SDK stores tokens in `localStorage` by default
- Verify: is `localStorage` the configured storage, or has it been changed to `sessionStorage` or cookies?
- Risk: localStorage is accessible to any JS on the same origin (XSS can steal tokens)
- Mitigation: Tight CSP + XSS prevention. Consider `cookieOptions` in Supabase client config for httpOnly cookies

### Session Management

1. **Session refresh**: Supabase SDK auto-refreshes tokens. Verify `onAuthStateChange` is subscribed
2. **Session expiry**: Check Supabase project settings for JWT expiry duration (default 3600s = 1 hour)
3. **Logout cleanup**: Verify `logout()` clears both `this.user` and `this.session`, plus any localStorage keys
4. **Multiple tabs**: Supabase handles cross-tab auth sync via `onAuthStateChange`. Verify no conflicts
5. **Stale session**: After token refresh failure, user should be redirected to login

### Password Policies

- Supabase enforces minimum password length (default 6 chars -- should be increased to 8+)
- Check: Does the frontend enforce stronger rules before sending to Supabase?
- Recommended: 8+ chars, at least one number, one special character
- Check: Is password reset rate-limited? (`security-service.js` checkRateLimit should cover this)

### Auth Guards

- Every protected page must check `authService.isLoggedIn()` on load
- Redirect to `auth.html` if not authenticated
- Check: Are there any HTML pages that load without auth check but should require it?

## 5. DSGVO Technical Measures

FreyAI handles PII for German craftsmen's customers. DSGVO (GDPR) compliance requires specific technical measures.

### Encryption

| Layer | Requirement | Implementation |
|-------|-------------|----------------|
| **In Transit** | TLS 1.2+ for all connections | Nginx SSL config, Supabase enforces HTTPS |
| **At Rest** | Database encryption | Supabase encrypts at rest by default (AES-256) |
| **Client-side** | IndexedDB data | Not encrypted by default -- document as accepted risk or implement Web Crypto API |
| **Backups** | Encrypted backups | Supabase automated backups are encrypted |

### Data Minimization

1. Only collect data that is strictly necessary for the business function
2. Audit each table's columns: are there fields that store unnecessary PII?
3. Check: Does the waitlist table store more than email + company name?
4. Check: Are log tables (email_log, sms_log) retaining content or just metadata?

### Right to Deletion (Recht auf Loeschung)

1. When a user is deleted from `auth.users`, CASCADE must delete all user data
2. Verify: All tables with `user_id` have `ON DELETE CASCADE`
3. Check: Are there any tables without `user_id` that store user-related data?
4. Check: Does the service worker cache contain user data that persists after deletion?
5. Check: Does IndexedDB data get cleared on account deletion?
6. Implement: A "Delete My Account" function that triggers full data purge

### Consent Tracking

Read `config/sql/supabase-schema.sql` to verify consent columns in the `profiles` table (e.g., `consent_given`, `consent_timestamp`, `privacy_accepted_at`) and confirm `ON DELETE CASCADE` on all `user_id` foreign keys. Without reading the actual schema, you cannot provide concrete evidence.

1. Check: Is there a consent mechanism before data collection (cookie banner, terms acceptance)?
2. Check: Is consent timestamp stored in the database? (verify columns in the schema file)
3. Check: Can consent be withdrawn, and does withdrawal trigger data deletion?
4. Check: Are analytics (Umami) configured for privacy (no cookies, anonymized IP)?

### Data Processing Agreements (AVV)

Verify Auftragsverarbeitungsvertrag exists for:
- Supabase (data processor)
- Hostinger (VPS hosting)
- Any email service (Resend)
- Payment processor (Stripe)

## 6. OWASP Top 10 for This Stack

Adapted for Vanilla JS + Supabase + FastAPI + n8n.

### A01: Broken Access Control

- **Check RLS policies** on every Supabase table (see Section 3)
- **Check Edge Function auth**: JWT validation for user-facing, service_role for internal
- **Check FastAPI endpoints**: Auth middleware, no unprotected routes
- **Check n8n webhooks**: Webhook secret validation, not just open endpoints

### A02: Cryptographic Failures

- **No secrets in frontend code**: Search for API keys, passwords in JS files
- **Environment variables**: All secrets via `.env`, never hardcoded
- **HTTPS everywhere**: No mixed content, no HTTP fallback
- **Password hashing**: Handled by Supabase Auth (bcrypt) -- do not implement custom hashing

### A03: Injection

- **SQL Injection**: Supabase PostgREST parameterizes queries. But check:
  - Any raw SQL via `.rpc()` calls -- parameters must be passed, not concatenated
  - Edge Functions using `createClient` -- use parameterized queries
  - FastAPI backend -- use SQLAlchemy/Psycopg2 parameterized queries
- **XSS**: See Section 2
- **Command Injection**: FastAPI backend -- no `os.system()` or `subprocess` with user input

### A04: Insecure Design

- **95/5 Pattern**: Human approval queue for AI actions (approval-queue-service.js)
- **Rate limiting**: security-service.js rate limiter on sensitive operations
- **Input validation**: Dual validation (client + server/database constraints)

### A05: Security Misconfiguration

- **Default credentials**: Supabase dashboard password, VPS SSH
- **Debug mode**: No debug flags in production (check `console.log` in production builds)
- **CORS**: Edge Functions should restrict to `app.freyaivisions.de`, not `*`
- **Nginx headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy

### A06: Vulnerable Components

- **Supabase SDK version**: Check for known vulnerabilities
- **Deno imports in Edge Functions**: Pin versions (e.g., `@0.224.0`), don't use `@latest`
- **Python packages in FastAPI**: Run `pip audit` or `safety check`
- **No CDN dependencies**: All fonts/icons self-hosted (DSGVO compliance + supply chain security)

### A07: Authentication Failures

- See Section 4 (Auth Flow Security)
- **Brute force protection**: Rate limiting on login attempts
- **Account enumeration**: Check if login error messages differ for "user not found" vs "wrong password"
- **Password reset**: Rate limit on password reset requests

### A08: Data Integrity Failures

- **Stripe webhook**: Verify webhook signature before processing
- **n8n webhook**: Validate webhook secret
- **Edge Function input**: Validate and sanitize all incoming JSON bodies
- **Client-side data**: Never trust client-side calculations for billing (verify server-side)

### A09: Logging & Monitoring

- **Security events**: `security-service.js` has `logSecurityEvent()` -- verify it's called for auth failures, rate limit hits, invalid inputs
- **Supabase logs**: Enable and monitor Supabase dashboard logs
- **VPS monitoring**: Check that failed SSH attempts, Nginx errors are logged
- **Alerting**: Set up alerts for unusual patterns (mass login failures, data export spikes)

### A10: Server-Side Request Forgery (SSRF)

- **AI proxy**: The `ai-proxy` Edge Function must validate URLs before fetching
- **Image/file processing**: FastAPI OCR endpoint -- validate file types, don't follow redirects from user URLs
- **n8n HTTP nodes**: Restrict to known domains in workflow configurations

## 7. Input Validation Patterns

### Client-Side (First Layer)

```javascript
// Always validate before sending to Supabase
const { valid, sanitized } = securityService.validateEmail(userInput);
if (!valid) { showError('Invalid email'); return; }

// Sanitize all text inputs
const cleanName = sanitize.sanitizeText(rawName);
const cleanPhone = sanitize.sanitizePhone(rawPhone);
const cleanUrl = sanitize.sanitizeUrl(rawUrl);

// Validate amounts (prevents NaN, negative values)
const { valid: amountValid, parsed } = securityService.validateAmount(rawAmount);
```

### Server-Side (Second Layer -- Supabase)

- **CHECK constraints**: Enforce valid status values at database level
- **NOT NULL**: Require critical fields at database level
- **Foreign keys**: Ensure referential integrity
- **Type enforcement**: PostgreSQL types prevent wrong data types

### PostgREST SQL Injection Prevention

Supabase PostgREST automatically parameterizes queries via the JS SDK. However:

- **`.rpc()` calls**: Parameters are passed safely, but audit custom SQL functions for string concatenation
- **`.or()` and `.filter()` with user input**: Ensure filter values are sanitized
- **Text search**: `.textSearch()` and `.ilike()` -- user input should be escaped for special chars (`%`, `_`)

### Validation Rules Reference

| Field Type | Client Validation | DB Constraint |
|-----------|-------------------|---------------|
| Email | `securityService.validateEmail()` | TEXT + CHECK format |
| Phone | `securityService.validatePhone()` | TEXT |
| IBAN | `securityService.validateIBAN()` | TEXT + CHECK format |
| Amount | `securityService.validateAmount()` | NUMERIC(10,2) CHECK >= 0 |
| Status | Dropdown (fixed values) | CHECK constraint |
| Date | Date picker | TIMESTAMPTZ |
| Free text | `sanitize.sanitizeText()` | TEXT + length limit |

## Quality Checklist

Before delivering any security audit, verify:

- [ ] **CSP reviewed**: All directives checked against Section 1 requirements
- [ ] **XSS scan**: Searched for all innerHTML/DOM injection patterns per Section 2
- [ ] **RLS audit**: Every public table checked for proper policies per Section 3
- [ ] **Auth flow**: Token storage, session management, password policies reviewed per Section 4
- [ ] **DSGVO**: Encryption, data minimization, deletion rights, consent checked per Section 5
- [ ] **OWASP Top 10**: All 10 categories evaluated for this stack per Section 6
- [ ] **Input validation**: Client-side and server-side validation patterns verified per Section 7
- [ ] **Findings documented**: Each issue categorized as Critical/High/Medium/Low with remediation steps
- [ ] **No false positives**: Each finding verified with actual code evidence, not assumptions

## Reference Files

- `references/checklist.md` -- Detailed security checklist with severity ratings and check methods
- `js/services/security-service.js` -- Input validation, rate limiting, CSRF, HTML escaping
- `js/services/sanitize-service.js` -- XSS protection, input sanitization
- `js/services/auth-service.js` -- Supabase Auth wrapper
- `config/sql/supabase-schema.sql` -- Database schema with RLS policies
- `docs/security/` -- Existing security reviews and CSP documentation
