---
name: migrate-entity
description: Migrate a legacy German-named entity (e.g., anfragen, angebote) to the new English FreyAI schema, updating SQL, store-service, and UI references.
argument-hint: [german-name] [english-name]
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Migrate Entity: German → English

Migrate `$ARGUMENTS` (parse as `[german-name] [english-name]`).

### Context

The FreyAI Core project is transitioning from German-named tables/columns (legacy MHS Workflow) to English-named tables. The current state:

- **Already English**: `profiles`, `clients`, `products`, `invoices` (in `supabase_schema.sql`)
- **Still German**: `anfragen`, `angebote`, `auftraege`, `rechnungen` (in store-service.js `_tableMap`)

### Migration Steps

#### 1. Schema

- **Read** `supabase_schema.sql`
- If the English table doesn't exist yet, create it following `/add-table` conventions
- Design a column mapping from the German schema to English:

Example mapping:
```
anfragen.kunde_name      → inquiries.customer_name
anfragen.leistungsart    → inquiries.service_type
anfragen.beschreibung    → inquiries.description
anfragen.termin          → inquiries.deadline
anfragen.budget          → inquiries.budget
```

#### 2. Store Service

- **Read** `js/services/store-service.js`
- Update `_tableMap`: change the Supabase table name from German to English
- Update `_map<Entity>FromDB()`: map new English column names → existing camelCase JS properties
- Update `_mapToDB()`: map camelCase JS → new English column names
- **Do NOT** rename the `this.store.<german>` array or the public API methods yet (the UI still uses them)

#### 3. Data Migration SQL

Generate a one-time migration script that copies data from the old German table to the new English table:

```sql
INSERT INTO <english_table> (id, user_id, <english_columns...>)
SELECT id, user_id, <german_columns...>
FROM <german_table>;
```

#### 4. UI Mapping (Document Only)

List all places in the UI (`js/app.js`, `js/ui/`, `js/features-integration.js`) that reference the German entity name. Do NOT change them yet — just create a report for the future UI rewrite.

### Output

Provide:
1. The updated SQL in `supabase_schema.sql` (if table is new)
2. The updated mappings in `store-service.js`
3. A migration SQL script (as a comment block or separate file)
4. A report of UI references that will need updating later
