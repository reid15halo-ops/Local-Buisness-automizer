# FreyAI Visions -- Security Audit Checklist

Organized by category. Each item includes what to check, how to check it, and severity rating.

Severity scale:
- **Critical**: Exploitable now, leads to data breach or full compromise
- **High**: Serious vulnerability, exploitable with moderate effort
- **Medium**: Weakness that increases attack surface or violates best practices
- **Low**: Minor hardening opportunity, defense-in-depth measure

---

## AUTH -- Authentication & Session Security

| # | Check | How to Verify | Severity |
|---|-------|---------------|----------|
| A1 | Supabase Auth tokens not stored in cookies without httpOnly | Inspect `localStorage` vs cookie storage in Supabase client config | High |
| A2 | Session refresh working (token auto-renewal) | Check `onAuthStateChange` subscription in `auth-service.js`, verify it fires on token refresh | High |
| A3 | Logout clears all auth state | Call `logout()`, verify `this.user`, `this.session` are null, check localStorage for leftover tokens | Critical |
| A4 | Password minimum length >= 8 characters | Check Supabase Auth settings (dashboard > Authentication > Policies) and frontend validation before `register()` | Medium |
| A5 | Login rate limiting active | Verify `securityService.checkRateLimit('login', ...)` is called before `authService.login()` | High |
| A6 | Password reset rate limiting | Verify rate limit on `resetPassword()` calls to prevent email bombing | Medium |
| A7 | Account enumeration prevented | Test login with non-existent email vs wrong password -- error messages should be identical | Medium |
| A8 | Auth guard on every protected page | Search all HTML files for auth check on page load (redirect to auth.html if not logged in) | Critical |
| A9 | Service role key never in frontend code | `grep -rn 'service_role\|SERVICE_ROLE' js/ *.html` should return zero results | Critical |
| A10 | JWT expiry duration reasonable | Check Supabase dashboard: JWT expiry should be 3600s (1 hour) or less | Medium |
| A11 | CSRF token validated on state-changing operations | Verify `securityService.validateCSRFToken()` is called on form submissions and API mutations | High |
| A12 | Auth state listener is singleton | Verify `_authSubscription` prevents duplicate Supabase subscriptions (memory leak + double events) | Low |

## DATA -- Data Protection & DSGVO

| # | Check | How to Verify | Severity |
|---|-------|---------------|----------|
| D1 | All connections use TLS 1.2+ | Check Nginx SSL config (`ssl_protocols TLSv1.2 TLSv1.3;`), test with `ssllabs.com` | Critical |
| D2 | Database encryption at rest | Verify Supabase project has encryption at rest enabled (default on paid plans) | High |
| D3 | No PII in client-side logs | Search for `console.log` that outputs user data (email, phone, name, IBAN) | Medium |
| D4 | IndexedDB data not encrypted | Document as accepted risk OR implement Web Crypto API encryption for offline PII | Medium |
| D5 | CASCADE delete on user_id foreign keys | Check every table: `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE` | Critical |
| D6 | Service Worker cache does not persist PII after logout | Verify cache is cleared on logout, or cached responses don't contain PII | High |
| D7 | Email/SMS logs store metadata only, not content | Check `email_log` and `sms_log` table schemas -- should not store full message bodies | Medium |
| D8 | Analytics (Umami) configured privacy-first | Verify: no cookies, anonymized IPs, hosted in EU, no personal data tracking | Medium |
| D9 | Data export function exists (DSGVO Art. 20) | Verify user can download all their data in machine-readable format | Medium |
| D10 | Account deletion function exists (DSGVO Art. 17) | Verify user can delete their account and all associated data is purged | High |
| D11 | Consent tracking in database | Check for consent timestamp column in profiles or separate consent table | Medium |
| D12 | AVV (Auftragsverarbeitungsvertrag) with all processors | Verify contracts exist for Supabase, Hostinger, Resend, Stripe | Medium |
| D13 | No Google Fonts or external CDN resources | `grep -rn 'fonts.googleapis\|cdn.' *.html css/` should return zero | Medium |
| D14 | Backup retention policy documented | How long are Supabase backups kept? Who has access? | Low |

## NETWORK -- Network & Transport Security

| # | Check | How to Verify | Severity |
|---|-------|---------------|----------|
| N1 | HTTPS enforced (no HTTP fallback) | Check Nginx: `return 301 https://` on port 80, CSP `upgrade-insecure-requests` | Critical |
| N2 | HSTS header set | Nginx: `Strict-Transport-Security: max-age=31536000; includeSubDomains` | High |
| N3 | X-Frame-Options: DENY | Nginx response headers or CSP `frame-ancestors 'none'` | High |
| N4 | X-Content-Type-Options: nosniff | Nginx response headers | Medium |
| N5 | Referrer-Policy: strict-origin-when-cross-origin | Nginx response headers | Medium |
| N6 | Permissions-Policy set | Disable unnecessary browser features: camera, microphone, geolocation (unless needed) | Low |
| N7 | CORS on Edge Functions restricted | ALLOWED_ORIGIN set to `https://app.freyaivisions.de`, not `*` | High |
| N8 | VPS SSH hardened | Key-only auth, no root password login, fail2ban active, non-default port optional | High |
| N9 | IP whitelist on staging/admin | Verify Nginx IP restrictions for `app.freyaivisions.de` and staging domains | Medium |
| N10 | WebSocket connections (Supabase Realtime) use WSS | Verify `wss://` not `ws://` in Supabase client config | High |

## CLIENT -- Client-Side Security

| # | Check | How to Verify | Severity |
|---|-------|---------------|----------|
| C1 | CSP meta tag or header present | Search HTML for `<meta http-equiv="Content-Security-Policy">` or check Nginx headers | Critical |
| C2 | No `unsafe-eval` in script-src | Parse CSP directive -- `unsafe-eval` breaks XSS protection | Critical |
| C3 | No wildcard (`*`) in CSP directives | Parse CSP -- wildcards negate the protection | High |
| C4 | All innerHTML uses escapeHtml | `grep -rn 'innerHTML' js/` -- every hit must use sanitize.escapeHtml or be a static string | Critical |
| C5 | No `document.write()` usage | `grep -rn 'document.write' js/` should return zero | High |
| C6 | No `eval()` usage | `grep -rn 'eval(' js/` should return zero (excluding comments) | Critical |
| C7 | No inline event handlers in dynamic HTML | Search for `onclick=`, `onerror=`, `onload=` in JS template literals | High |
| C8 | URL validation before navigation | Any `window.location =` or `window.open()` with user input must use `securityService.isValidURL()` | High |
| C9 | sanitize.sanitizeUrl blocks javascript: protocol | Verify sanitizeUrl rejects `javascript:alert(1)` | Critical |
| C10 | Safe JSON parse for localStorage | All `JSON.parse(localStorage.getItem(...))` should use `sanitize.safeJsonParse()` | Medium |
| C11 | No secrets in JavaScript source | Search for API keys, passwords, tokens in JS files: `grep -rn 'sk_\|secret\|password\|apikey' js/` | Critical |
| C12 | Service Worker version pinned and updatable | Check `service-worker.js` has version constant, cache-busting strategy works | Medium |
| C13 | Subresource Integrity (SRI) on external scripts | If any external scripts exist (should be zero), verify `integrity` attribute | Medium |

## SERVER -- Server-Side Security

| # | Check | How to Verify | Severity |
|---|-------|---------------|----------|
| S1 | RLS enabled on every public table | Query `pg_tables` for `rowsecurity = true` on all public tables | Critical |
| S2 | User-own RLS policy on every data table | Query `pg_policies` -- every table with user_id must have `auth.uid() = user_id` policy | Critical |
| S3 | Service role bypass policy documented | Each `auth.role() = 'service_role'` policy has a comment explaining why | Medium |
| S4 | Edge Functions validate JWT for user-facing routes | Check `Authorization` header extraction and user verification in each function | Critical |
| S5 | Edge Functions validate service_role for internal routes | Internal/cron functions verify `SUPABASE_SERVICE_ROLE_KEY` match | High |
| S6 | Webhook endpoints verify signatures | Stripe webhook: verify `stripe-signature` header. n8n webhooks: verify secret | Critical |
| S7 | FastAPI input validation | Check Pydantic models validate all inputs, no raw string concatenation in SQL | High |
| S8 | FastAPI CORS restricted | Check CORS middleware origins -- should be `app.freyaivisions.de` only | High |
| S9 | No raw SQL string concatenation | Search Edge Functions and FastAPI for SQL built with string templates | Critical |
| S10 | File upload validation | FastAPI OCR endpoint: validate file type (MIME + magic bytes), size limit, no path traversal | High |
| S11 | Environment variables for all secrets | `grep -rn` for hardcoded URLs with credentials, API keys not in .env | Critical |
| S12 | Docker containers use non-root user | Check Dockerfiles for `USER` directive (Postiz, RAGFlow) | Medium |
| S13 | Database connection pooling | Verify connection limits and pooling to prevent DoS via connection exhaustion | Medium |
| S14 | Error messages don't leak internals | Edge Functions and FastAPI catch blocks should return generic errors, not stack traces | Medium |
| S15 | pg_cron jobs use service_role correctly | Verify cron SQL uses `net.http_post` with service_role in header, not hardcoded in URL | High |

---

## Audit Report Template

When completing an audit, use this format:

```markdown
# Security Audit Report -- [Date]

## Scope
[What was audited: full audit, auth only, CSP only, etc.]

## Summary
- Critical: X findings
- High: X findings
- Medium: X findings
- Low: X findings

## Findings

### [SEVERITY] [ID] -- [Title]
**Category**: Auth / Data / Network / Client / Server
**Status**: Open / Fixed / Accepted Risk
**Description**: [What the issue is]
**Evidence**: [Code snippet, file path, or test result]
**Remediation**: [How to fix it]
**Effort**: [Low / Medium / High]

## Recommendations
[Prioritized list of next steps]
```
