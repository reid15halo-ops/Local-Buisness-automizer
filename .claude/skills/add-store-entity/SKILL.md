---
name: add-store-entity
description: Add a new entity type to the frontend store-service.js with full Supabase CRUD, DB mapping, and in-memory cache. Use after creating a new Supabase table.
argument-hint: [entity-name]
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add a Store Entity

Add full CRUD support for `$ARGUMENTS` to the frontend store-service.

### Steps

1. **Read** `js/services/store-service.js` to understand the current architecture.
2. **Read** `supabase_schema.sql` to get the exact column definitions for the target table.

### What to Add

#### A. In-memory store array

Add `$ARGUMENTS: []` to `this.store` in the constructor.

#### B. Table mapping

Add `$ARGUMENTS: '$ARGUMENTS'` to `this._tableMap`.

#### C. DB → JS mapper

Create `_map<EntityName>FromDB(row)` that converts snake_case DB rows to camelCase JS objects. Follow the pattern of existing mappers like `_mapAnfrageFromDB`.

Rules:
- DB `snake_case` → JS `camelCase`
- Parse numeric fields with `parseFloat(row.field) || 0`
- Default empty strings for text fields: `row.field || ''`
- Default empty arrays for JSONB array fields: `row.field || []`
- Always include `id` and `createdAt: row.created_at`

#### D. JS → DB mapper

Add a new `case` in `_mapToDB(storeKey, item)` that converts the JS object back to DB row format. Always include `...base` (which has `id` and `user_id`).

#### E. CRUD actions

Add these public methods following the existing pattern:

```javascript
add<Entity>(item)       // Push to array + _insertRow
update<Entity>(id, updates) // Find + Object.assign + _updateRow
delete<Entity>(id)      // Filter array + fire-and-forget delete
```

#### F. Load integration

Add the new table to `_fetchAllFromSupabase()`:
- Add to the `Promise.all` parallel fetch
- Map the result: `this.store.$ARGUMENTS = (res.data || []).map(r => this._map<Entity>FromDB(r))`

#### G. Save integration

The existing `save()` method already iterates `this._tableMap`, so adding the entry in step B is sufficient.

### After

- Add the new array to `_clearStore()`
- Verify `resetToDemo()` won't break (it uses `Object.keys` so new arrays auto-clear)
