---
name: perf-audit
description: Performance audit — frontend load time, Supabase query efficiency, bundle size, DOM complexity, and memory leaks.
context: fork
agent: general-purpose
allowed-tools: Read, Grep, Glob, Bash
---

## Performance Audit — FreyAI Core

### Frontend Analysis

#### 1. Script Load (check `index.html`)
- Count total `<script>` tags and their sizes
- Identify scripts that could be lazy-loaded instead
- Check for render-blocking scripts in `<head>`
- Verify CDN scripts use `async` or `defer` where possible

#### 2. DOM Complexity
- Count total elements in `index.html`
- Identify large inline HTML blocks that could be templates
- Check for deeply nested DOM structures (>10 levels)

#### 3. Store Service Efficiency
- Check `_fetchAllFromSupabase()`: Are all tables fetched even if view isn't active?
- Check `save()`: Does it upsert ALL data on every mutation? (wasteful)
- Check `_insertRow` / `_updateRow`: Are they fire-and-forget? (good)
- Look for `notify()` calls that could cause excessive re-renders

#### 4. Memory Leaks
- Check for event listeners without cleanup
- Check for `subscribe()` calls without unsubscribe
- Check for growing arrays without bounds (activities is capped at 50 — good)

#### 5. Supabase Query Efficiency
- Check for missing indexes on frequently filtered columns
- Check for `SELECT *` that could be `SELECT specific_columns`
- Check for N+1 query patterns (looping with individual queries)

### Backend Analysis

#### 6. FastAPI
- Check for sync handlers that should be async
- Check for missing response caching headers
- Check Dockerfile for multi-stage build optimization

### Output

```
| Category | Score | Issues | Recommendations |
|----------|-------|--------|-----------------|
| Load Time | B | 3 | Lazy-load 5 scripts |
| Queries | A | 0 | None |
| Memory | B | 1 | Add event cleanup |
| Backend | A | 0 | None |
```
