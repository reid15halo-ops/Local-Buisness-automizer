---
name: security-audit
description: |
  Security audit, vulnerability assessment, and DSGVO/GDPR compliance review for FreyAI Visions.
  Trigger on: "security audit", "CSP review", "XSS check", "RLS audit", "DSGVO compliance",
  "vulnerability scan", "is this secure", "check security", "harden this", "OWASP review",
  or any request to evaluate security posture.
---

# Security Audit Skill

Perform comprehensive security audits for FreyAI Visions. This platform handles PII (customer data, addresses, phone numbers) and financial data (invoices, payments, IBAN) for German craftsmen. DSGVO compliance is non-negotiable.

Read `references/checklist.md` before starting any audit -- it contains the full security checklist organized by severity.

## Workflow

1. Read `references/checklist.md` for severity-organized checklist
2. Identify audit scope (full audit vs. targeted: CSP, XSS, RLS, Auth, DSGVO, OWASP)
3. For each area: scan actual code, collect evidence, classify findings by severity (Critical > High > Medium > Low)
4. Produce findings report with evidence and remediation steps
5. Never report assumptions as findings -- every issue must reference a file path and line number

## Project Security Architecture

Existing security layers (read these files before auditing):

- **`js/services/security-service.js`** -- Input validation, rate limiting, CSRF tokens, security event logging
- **`js/services/sanitize-service.js`** -- XSS protection (escapeHtml, sanitizeText, sanitizeUrl, sanitizePhone)
- **`js/services/auth-service.js`** -- Supabase Auth wrapper (login, register, session, password reset)
- **Supabase RLS** -- Row Level Security on all tables, user_id tenant isolation, service_role bypass
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

1. Search HTML files for `<meta http-equiv="Content-Security-Policy">` and check Nginx config for CSP headers (server header preferred)
2. Verify: no `unsafe-eval` in script-src, no wildcard (`*`) in any directive
3. Verify: Supabase project URL specifically listed (not broad wildcard)
4. Check browser DevTools Console for CSP violation errors

## 2. XSS Prevention

FreyAI uses two services for XSS prevention. Audit their usage across the codebase.

### Sanitize Service Integration Checks

1. **Every `innerHTML` assignment** must use `sanitize.escapeHtml()` or `sanitize.sanitizeText()`
2. **Every data attribute** set from user input must use `sanitize.sanitizeForDataAttr()`
3. **Every URL from user input** must pass through `sanitize.sanitizeUrl()` (blocks `javascript:` protocol)
4. **Template literals in DOM** -- search for `` `<div>${variable}` `` patterns without escaping
5. **Event handler attributes** -- search for `onclick=`, `onerror=` in dynamically generated HTML

### Scan Patterns (use Grep tool, not bash grep)

Search `js/` for these patterns and flag violations:

| Pattern | Severity | What to find |
|---------|----------|-------------|
| `innerHTML` without `sanitize`/`escapeHtml` | CRITICAL | Direct DOM injection |
| `document.write`, `eval(` | CRITICAL | Code execution |
| `insertAdjacentHTML`, `outerHTML` | HIGH | Uncontrolled DOM insertion |
| `window.location = ` without URL validation | HIGH | Open redirect |
| `setAttribute('href', ...)` without `sanitizeUrl` | HIGH | XSS via href |
| Template literals in `innerHTML` assignments | HIGH | Unescaped interpolation |

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

### Audit Method

Read `config/sql/supabase-schema.sql` and verify each table has: RLS enabled, user-own policy (`auth.uid() = user_id`), service_role bypass policy, and `ON DELETE CASCADE` on user_id FK. Cross-reference the tables listed above.

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

- **No secrets in frontend code**: Scan all JS/HTML files for hardcoded secrets (see Section 8 for patterns)
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

## 7. Hardcoded Secrets Detection

Every JS, HTML, and config file in the repo must be scanned for secrets before audit completion. Use the Grep tool with the patterns below. Any match that is not a placeholder/comment is a CRITICAL finding.

### Scan Patterns

| Pattern | Severity | Examples |
|---------|----------|---------|
| `eyJ[A-Za-z0-9_-]{20,}` | CRITICAL | JWT / Supabase anon/service_role key |
| `sk_live_[A-Za-z0-9]{24,}` | CRITICAL | Stripe live secret key |
| `sk_test_[A-Za-z0-9]{24,}` | HIGH | Stripe test secret key |
| `SUPABASE_SERVICE_ROLE` | CRITICAL | Service role key reference |
| `service_role` followed by a key string | CRITICAL | Inline service_role key |
| `Authorization.*Bearer [A-Za-z0-9._-]{20,}` | CRITICAL | Hardcoded Bearer token |
| `password\s*[:=]\s*['"][^'"]{6,}` | HIGH | Hardcoded password string |
| `api[_-]?key\s*[:=]\s*['"][^'"]{10,}` | HIGH | Generic API key assignment |
| `secret\s*[:=]\s*['"][^'"]{8,}` | HIGH | Hardcoded secret string |
| `HOSTINGER_API\|hostinger.*api` | HIGH | Hosting provider API key |
| `n8n_api_[A-Za-z0-9]{20,}` | HIGH | n8n API key |
| `sbp_[A-Za-z0-9]{30,}` | CRITICAL | Supabase Personal Access Token |
| `[0-9]{10}:AA[A-Za-z0-9_-]{33}` | HIGH | Telegram Bot Token |

### Scan Procedure

1. Run Grep for each pattern above across `js/`, `config/`, `*.html`, `*.env*`
2. Exclude `node_modules/`, `.git/`, `*.md`, test fixtures
3. For each match: verify it is not a comment, placeholder, or example value
4. If a real secret is found: flag CRITICAL, rotate immediately, add to `.gitignore`
5. Check `git log --all` for secrets committed historically (if repo access available)

### Common False Positives to Filter

- `'your-api-key-here'`, `'xxx'`, `'PLACEHOLDER'`
- Strings inside comments (`//`, `/* */`)
- Values pulled from `import.meta.env.*` or `process.env.*` (these are safe references)

## 8. Input Validation Audit

Verify dual-layer validation (client + database) for all user-facing inputs:

| Field Type | Client Layer | DB Layer | Audit Action |
|-----------|-------------|----------|-------------|
| Email | `securityService.validateEmail()` | TEXT + CHECK | Grep for raw email usage without validation |
| Phone | `securityService.validatePhone()` | TEXT | Grep for phone inputs bypassing sanitize |
| IBAN | `securityService.validateIBAN()` | TEXT + CHECK | Verify IBAN fields always validated |
| Amount | `securityService.validateAmount()` | NUMERIC CHECK >= 0 | Check for raw number parsing without validation |
| Free text | `sanitize.sanitizeText()` | TEXT + length limit | Grep for unsanitized text in Supabase inserts |

Also audit `.rpc()` calls for string concatenation in custom SQL functions, and `.ilike()`/`.textSearch()` for unescaped special chars (`%`, `_`).

## Report Template

Every security audit MUST be delivered using this exact structure. Do not omit sections.

```
# Security Audit Report — FreyAI Visions
**Date**: YYYY-MM-DD
**Scope**: [Full Audit | Targeted: CSP / XSS / RLS / Auth / DSGVO / OWASP / Secrets]
**Auditor**: Claude (security-audit skill)

---

## Executive Summary
[2-4 sentences: overall risk level, most critical findings, recommended immediate actions]

**Risk Level**: CRITICAL | HIGH | MEDIUM | LOW

---

## Findings

### [SEVERITY] Finding Title
| Field | Value |
|-------|-------|
| **ID** | SA-001 |
| **Severity** | CRITICAL / HIGH / MEDIUM / LOW |
| **Category** | OWASP A01 / XSS / RLS / Secrets / DSGVO / Auth / CSP |
| **File** | `path/to/file.js:LINE` |
| **Status** | Open |

**Description**: What the vulnerability is and why it is dangerous.

**Evidence**:
```code snippet or grep output showing the actual issue```

**Remediation**: Concrete fix with code example where applicable. Include priority (immediate/next sprint/backlog).

---
[Repeat for each finding, ordered CRITICAL → HIGH → MEDIUM → LOW]

---

## OWASP Top 10 Coverage Matrix
| # | Category | Status | Findings |
|---|----------|--------|---------|
| A01 | Broken Access Control | PASS / FAIL / PARTIAL | SA-001, SA-003 |
| A02 | Cryptographic Failures | PASS / FAIL / PARTIAL | — |
| A03 | Injection | PASS / FAIL / PARTIAL | — |
| A04 | Insecure Design | PASS / FAIL / PARTIAL | — |
| A05 | Security Misconfiguration | PASS / FAIL / PARTIAL | — |
| A06 | Vulnerable Components | PASS / FAIL / PARTIAL | — |
| A07 | Authentication Failures | PASS / FAIL / PARTIAL | — |
| A08 | Data Integrity Failures | PASS / FAIL / PARTIAL | — |
| A09 | Logging & Monitoring | PASS / FAIL / PARTIAL | — |
| A10 | SSRF | PASS / FAIL / PARTIAL | — |

## Statistics
- Critical: N | High: N | Medium: N | Low: N
- Total Findings: N
- Files Audited: N
```

## Quality Checklist

Before delivering any security audit, verify:

- [ ] **CSP reviewed**: All directives checked against Section 1 requirements
- [ ] **XSS scan**: Searched for all innerHTML/DOM injection patterns per Section 2
- [ ] **RLS audit**: Every public table checked for proper policies per Section 3
- [ ] **Auth flow**: Token storage, session management, password policies reviewed per Section 4
- [ ] **DSGVO**: Encryption, data minimization, deletion rights, consent checked per Section 5
- [ ] **OWASP Top 10**: All 10 categories evaluated for this stack per Section 6
- [ ] **Secrets scan**: All patterns from Section 7 searched across js/, config/, HTML files
- [ ] **Input validation**: Client-side and server-side validation patterns verified per Section 8
- [ ] **Report uses template**: Report follows the exact Report Template structure above
- [ ] **Findings documented**: Each issue has ID, Severity, Category, File:Line, Evidence, Remediation
- [ ] **OWASP matrix complete**: All 10 rows filled with PASS/FAIL/PARTIAL and finding references
- [ ] **No false positives**: Each finding verified with actual code evidence, not assumptions

## Reference Files

- `references/checklist.md` -- Detailed security checklist with severity ratings and check methods
- `js/services/security-service.js` -- Input validation, rate limiting, CSRF, HTML escaping
- `js/services/sanitize-service.js` -- XSS protection, input sanitization
- `js/services/auth-service.js` -- Supabase Auth wrapper
- `config/sql/supabase-schema.sql` -- Database schema with RLS policies
- `docs/security/` -- Existing security reviews and CSP documentation
