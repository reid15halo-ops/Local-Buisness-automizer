# FreyAI Codebase Guide for Reviewers

## Architecture Overview

- **Frontend**: Vanilla JS (ES6+), HTML5, CSS3 — offline-first PWA
- **Database**: Supabase (PostgreSQL + Edge Functions + Realtime)
- **Backend**: FastAPI (Python) — only for OCR, PII, guardrails (5% of logic)
- **Automation**: n8n workflows handle 95% of async business logic
- **Pattern**: 95/5 — 95% async (n8n) / 5% sync (FastAPI)

## Key Services (js/services/)

| Service | Lines | Purpose | Watch For |
|---------|-------|---------|-----------|
| `store-service.js` | 537 | In-memory state + IndexedDB persistence | Dual sync with db-service, data loss on overwrite |
| `db-service.js` | 1321 | Supabase + IndexedDB CRUD + sync queue | Race conditions, offline queue management |
| `auth-service.js` | 158 | Supabase Auth wrapper | Rate limiting not wired, session validation |
| `security-service.js` | 365 | CSP, XSS prevention, CSRF, rate limiting | Dead code (CSRF never called), dual sanitization |
| `sanitize-service.js` | ~200 | Input sanitization, HTML escaping | Overlaps with security-service |
| `customer-timeline-service.js` | ~300 | Customer lifecycle aggregation | Uses kunde_name not kunde_id for queries |
| `approval-queue-service.js` | ~250 | 95/5 human-in-the-loop queue | AI actions require approval |
| `stripe-service.js` | ~200 | Subscription billing | Webhook signature verification |
| `datev-export-service.js` | ~300 | DATEV CSV/ZIP export | German number formatting, encoding |
| `bookkeeping-service.js` | ~400 | EUR bookkeeping | Rounding, tax calculations |

## Supabase Schema — Key Tables

All tables use flat columns (NO foreign key joins for kunde):

```
kunden:       id, user_id, name, email, telefon, firma, ...
anfragen:     id, user_id, kunde_name, kunde_email, kunde_telefon, ...
angebote:     id, user_id, kunde_name, kunde_email, status, ...
auftraege:    id, user_id, kunde_name, kunde_email, status, ...
rechnungen:   id, user_id, kunde_name, kunde_email, status, betrag, ...
positionen:   id, rechnung_id, beschreibung, menge, einzelpreis, ...
zahlungen:    id, rechnung_id, betrag, datum, ...
```

**Critical**: Tables use `kunde_name TEXT` not `kunde_id UUID`. Any query using `.eq('kunde_id', ...)` on these tables will silently return zero rows.

Full schema: `config/sql/supabase-schema.sql`

## Naming Conventions

- **Tables**: German, lowercase, plural (`rechnungen`, `angebote`, `auftraege`)
- **Columns**: German, snake_case (`kunde_name`, `erstellt_am`, `monatspreis`)
- **Status values**: German (`entwurf`, `aktiv`, `bezahlt`, `storniert`)
- **JS services**: English, kebab-case files, camelCase methods
- **CSS**: BEM-ish with `--accent`, `--bg-dark`, `--bg-card` design tokens

## Common Patterns

### Offline-First Data Flow
```
User action → StoreService (in-memory) → IndexedDB (persist) → Supabase (sync when online)
                                          ↑
                              DBService sync queue (offline writes)
```

### Auth Flow
```
auth.html → Supabase Auth (signUp/signIn) → init-auth-gate.js → index.html
```
Client-side gate is UX only. Security enforced by Supabase RLS policies.

### Known Issues to Watch For
1. **Dual sync**: store-service and db-service sync independently — can race
2. **kunde_name queries**: All customer lookups use name, not ID — duplicate names = data mixing
3. **Silent error swallowing**: Many services catch errors and only console.warn
4. **Dead code**: CSRF system fully implemented but never called
5. **Rate limiting**: Built in security-service but not wired to auth flows
