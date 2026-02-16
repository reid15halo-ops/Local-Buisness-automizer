---
name: security-audit
description: Deep security audit of the entire codebase — OWASP Top 10, credential leaks, XSS, injection, RLS gaps, and dependency risks.
context: fork
agent: general-purpose
allowed-tools: Read, Grep, Glob, Bash
---

## Security Audit — FreyAI Core

Perform a comprehensive security audit of the entire codebase.

### Scan Targets

#### 1. Credential Leaks
```
Search for: API keys, passwords, tokens, secrets
Patterns: sk_live, sk_test, password, secret, token, Bearer, eyJ
Files: *.js, *.py, *.html, *.json, *.env, *.sql
```
Report any hardcoded credentials found.

#### 2. XSS (Cross-Site Scripting)
```
Search for: innerHTML, outerHTML, document.write, insertAdjacentHTML
Check: Is user input sanitized before insertion?
Required: window.UI.sanitize() or equivalent escaping
```

#### 3. SQL Injection
```
Check: Are Supabase queries parameterized? (they should be via the JS client)
Check: Any raw SQL string concatenation in Edge Functions?
Check: Backend uses Pydantic validation before DB queries?
```

#### 4. RLS Gaps
```
Read: supabase_schema.sql
Check: Every table has RLS enabled
Check: Every table has at least one policy
Check: Policies use auth.uid() = user_id (not hardcoded IDs)
```

#### 5. Auth Security
```
Check: No anon key used as service role key
Check: JWT validation on backend endpoints
Check: Session handling (auto-refresh, expiry)
Check: Password requirements in signup flow
```

#### 6. CORS
```
Check: backend/main.py CORS config
Flag: allow_origins=["*"] in production is a risk
```

#### 7. Dependency Risk
```
Check: CDN scripts use pinned versions (not @latest)
Check: Python requirements use pinned versions
```

### Output Format

```
## Security Audit Report

### CRITICAL (fix immediately)
- ...

### HIGH (fix before deployment)
- ...

### MEDIUM (fix soon)
- ...

### LOW (nice to have)
- ...

### PASSED
- ...
```
