# Security Checklist for Code Reviews

## OWASP Top 10 — FreyAI Context

### A01: Broken Access Control
- [ ] New Supabase tables have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] RLS policies filter by `auth.uid() = user_id`
- [ ] Service-role operations use `auth.role() = 'service_role'`, not anon key
- [ ] Client-side auth gates are NOT the security boundary (RLS is)
- [ ] No admin endpoints accessible without proper role check

### A02: Cryptographic Failures
- [ ] No secrets/API keys in source code (check for hardcoded strings)
- [ ] Supabase anon key is public by design — NOT a secret
- [ ] Service role key is server-side only (never in frontend JS)
- [ ] CSRF tokens use `crypto.getRandomValues()`, not `Math.random()`
- [ ] Passwords have minimum length + complexity requirements

### A03: Injection
- [ ] Supabase queries use `.eq()`, `.in()`, `.or()` — NOT string concatenation
- [ ] `.or()` filter strings validate inputs (no user-controlled interpolation)
- [ ] HTML output uses `escapeHtml()` or `DOMPurify`, NOT `innerHTML` with raw input
- [ ] URL parameters are validated before use
- [ ] `eval()`, `Function()`, `setTimeout(string)` are never used

### A04: Insecure Design
- [ ] AI actions go through approval queue (95/5 human-in-the-loop)
- [ ] File uploads validate type and size
- [ ] Rate limiting applied to auth and API endpoints

### A05: Security Misconfiguration
- [ ] CSP headers include only necessary domains
- [ ] No `unsafe-eval` or `unsafe-inline` in CSP
- [ ] CORS restricted to specific origins (not `*`)
- [ ] No debug/development flags left enabled

### A07: Cross-Site Scripting (XSS)
- [ ] User input sanitized before rendering (`sanitize.escapeHtml()`)
- [ ] `innerHTML` only used with sanitized content
- [ ] Event handler attributes never contain user input
- [ ] URL validation restricts to `http:` and `https:` protocols

## Supabase-Specific Security

### Auth Patterns
- **JWT validation**: Use `supabase.auth.getUser(token)` for server-side validation, NOT `getSession()` (reads from storage without server check)
- **Rate limiting**: `securityService.checkRateLimit(key, max, windowMs)` exists but must be called explicitly
- **Session cleanup**: Logout must clear CSRF tokens and rate limiter state

### RLS Policy Patterns
```sql
-- User owns row
CREATE POLICY "user_own" ON table FOR ALL USING (auth.uid() = user_id);

-- Service role bypass
CREATE POLICY "service_role" ON table FOR ALL USING (auth.role() = 'service_role');

-- Public insert (e.g., waitlist)
CREATE POLICY "public_insert" ON table FOR INSERT WITH CHECK (true);
```

### Edge Function Auth
```typescript
// JWT auth (user-facing)
const token = req.headers.get('Authorization')?.replace('Bearer ', '');
const { data: { user }, error } = await supabase.auth.getUser(token);

// Service role auth (cron/internal)
const key = req.headers.get('Authorization')?.replace('Bearer ', '');
if (key !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return new Response('Unauthorized', { status: 401 });
```

## DSGVO (GDPR) Compliance

- [ ] No external CDN fonts (self-hosted only)
- [ ] No Google Analytics (Umami self-hosted at analytics.freyaivisions.de)
- [ ] User data export endpoint exists
- [ ] User data deletion endpoint exists (right to erasure)
- [ ] PII is not logged to console in production
- [ ] Data processing agreement (AVV) considerations for third-party services
- [ ] Cookie banner not needed if no tracking cookies used

## Common Security Anti-Patterns in This Codebase

1. **`sanitizeInput()` vs `escapeHtml()`**: Two different implementations exist. Use `sanitize.escapeHtml()` for HTML contexts.
2. **Silent error swallowing**: `.catch(() => {})` hides real errors. At minimum log to console.warn.
3. **`window.authService` exposed**: Any script can read the JWT. Mitigate by preventing XSS.
4. **`logSecurityEvent()` is a no-op**: No audit trail in production. Check for `process.env.NODE_ENV` issues in browser context.
