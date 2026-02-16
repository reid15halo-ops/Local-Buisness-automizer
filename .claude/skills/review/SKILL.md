---
name: review
description: Review code changes against FreyAI Core conventions, checking for security issues, broken patterns, and architectural violations.
allowed-tools: Read, Grep, Glob, Bash
---

## Code Review — FreyAI Core

Review the current uncommitted changes (or the specified file/PR) against project conventions.

### Review Checklist

Run through each category and report findings as: PASS, WARN, or FAIL.

#### 1. Architecture

- [ ] No IndexedDB or localStorage usage for business data (Supabase only)
- [ ] No `window.dbService` calls (should use `window.freyaiSupabase` or `window.storeService`)
- [ ] No service-worker references or offline-first patterns
- [ ] New services use the lazy-loader pattern, not direct `<script>` tags
- [ ] Supabase queries include proper `user_id` filtering (RLS backup)

#### 2. Security (OWASP)

- [ ] No raw HTML injection — all user input goes through `window.UI.sanitize()` or equivalent
- [ ] No `eval()`, `innerHTML` with unsanitized data, or `document.write()`
- [ ] No hardcoded credentials, API keys, or secrets
- [ ] Supabase Anon Key is never used as a Service Role Key
- [ ] Backend endpoints validate input with Pydantic models

#### 3. Data Layer

- [ ] New Supabase tables have RLS enabled with `auth.uid() = user_id` policies
- [ ] UUID primary keys (not auto-increment integers)
- [ ] `created_at` and `updated_at` timestamps present
- [ ] `updated_at` trigger attached
- [ ] Money uses `NUMERIC(12,2)`, not `FLOAT` or `REAL`
- [ ] JSONB columns have a `COMMENT ON COLUMN` explaining the shape

#### 4. Frontend Conventions

- [ ] JSDoc `@param` / `@returns` on all public methods
- [ ] Console logs prefixed with `[FreyAI]`
- [ ] Error handling uses `window.errorHandler?.error()` for user-facing messages
- [ ] German UI text for user-facing strings (this is a German business tool)
- [ ] New global registrations use `window.<name>` pattern

#### 5. Backend Conventions

- [ ] FastAPI endpoints have docstrings
- [ ] Pydantic models for request/response
- [ ] Proper HTTP status codes and `HTTPException` usage
- [ ] CORS already configured — no duplicate middleware

#### 6. Git Hygiene

- [ ] No `.env`, credentials, or secrets in staged files
- [ ] No large binaries or node_modules
- [ ] Commit messages describe the "why", not just the "what"

### Output Format

```
## Review: [file or scope]

### Architecture: PASS/WARN/FAIL
- ...

### Security: PASS/WARN/FAIL
- ...

(etc.)

### Summary
X passes, Y warnings, Z failures
Recommendation: APPROVE / REQUEST CHANGES
```
