---
name: migrate-entity
description: Migrate a legacy German-named entity to the new English FreyAI schema — SQL, store-service mappings, and migration script.
argument-hint: [german-name] [english-name]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Migrate Entity: German to English

**Arguments:** `$ARGUMENTS` — parse as `[german-name] [english-name]`

### Steps

#### 1. Schema
- Read `supabase_schema.sql`
- Create English table if missing (follow `/add-table` conventions)
- Design column mapping (e.g., `kunde_name` → `customer_name`)

#### 2. Store Service
- Update `_tableMap`: German table → English table
- Update `_map<Entity>FromDB()`: new English columns → existing camelCase JS
- Update `_mapToDB()`: camelCase JS → new English columns
- Do NOT rename `this.store.<german>` array (UI still uses it)

#### 3. Migration SQL
```sql
INSERT INTO <english_table> (id, user_id, <english_cols>)
SELECT id, user_id, <german_cols>
FROM <german_table>;
```

#### 4. UI Report
List all files referencing the German entity name — do NOT change them.
