---
name: review
description: Code review against FreyAI Core conventions — security, architecture, data layer, frontend, backend, git hygiene.
context: fork
agent: general-purpose
allowed-tools: Read, Grep, Glob, Bash
---

## Code Review — FreyAI Core

Review current uncommitted changes or the specified scope.

### Checklist (report PASS / WARN / FAIL per category)

#### 1. Architecture
- No IndexedDB or localStorage for business data
- No `window.dbService` calls (use `window.freyaiSupabase` or `window.storeService`)
- No service-worker or offline-first patterns
- New services use lazy-loader, not direct `<script>` tags

#### 2. Security (OWASP)
- No raw HTML injection — use `window.UI.sanitize()`
- No `eval()`, unsanitized `innerHTML`, `document.write()`
- No hardcoded credentials or API keys
- Backend validates input with Pydantic models

#### 3. Data Layer
- RLS enabled with `auth.uid() = user_id` policies
- UUID primary keys
- `created_at`/`updated_at` timestamps + trigger
- Money: `NUMERIC(12,2)` not FLOAT
- JSONB columns have `COMMENT ON COLUMN`

#### 4. Frontend
- JSDoc on public methods
- Console logs prefixed `[FreyAI]`
- German UI text for user-facing strings
- `window.<name>` pattern for globals

#### 5. Backend
- FastAPI endpoints have docstrings
- Pydantic request/response models
- Proper HTTP status codes

#### 6. Git
- No `.env`, credentials, or secrets staged
- No large binaries

### Output: `APPROVE` or `REQUEST CHANGES` with findings.
