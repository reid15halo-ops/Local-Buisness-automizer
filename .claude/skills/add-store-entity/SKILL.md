---
name: add-store-entity
description: Add a new entity type to store-service.js with full Supabase CRUD, bidirectional DB mapping, and in-memory cache.
argument-hint: [entity-name]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add a Store Entity

Wire `$ARGUMENTS` into `js/services/store-service.js`.

### Steps

1. **Read** `js/services/store-service.js` and `supabase_schema.sql`.

### Checklist — add each of these:

**A. Constructor** — add `$ARGUMENTS: []` to `this.store`

**B. Table map** — add `$ARGUMENTS: '$ARGUMENTS'` to `this._tableMap`

**C. `_map<Entity>FromDB(row)`** — snake_case DB → camelCase JS:
- `parseFloat()` for numerics, `|| ''` for text, `|| []` for JSONB arrays
- Always include `id` and `createdAt: row.created_at`

**D. `_mapToDB()` case** — camelCase JS → snake_case DB:
- Always spread `...base` (has `id`, `user_id`)

**E. CRUD methods:**
```javascript
add<Entity>(item)          // push + _insertRow
update<Entity>(id, updates) // find + assign + _updateRow
delete<Entity>(id)          // filter + Supabase delete
```

**F. `_fetchAllFromSupabase()`** — add to `Promise.all`, map result

**G. `_clearStore()`** — add `this.store.$ARGUMENTS = []`
