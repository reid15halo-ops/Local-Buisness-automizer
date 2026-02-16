---
name: seed-data
description: Generate realistic German-locale seed/demo data for any Supabase table. Outputs SQL INSERT statements or updates demo-data-service.js.
argument-hint: [table-name] [count]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Generate Seed Data

Generate realistic demo data for `$ARGUMENTS` (parse as `[table-name] [count]`, default count=10).

### Steps

1. **Read** `supabase_schema.sql` to get exact column definitions for the target table.
2. **Read** `js/services/demo-data-service.js` to match the style of existing demo data.
3. Generate data following these rules:

### Data Rules

- **Locale**: German — use German names, addresses, company names (Handwerksbetriebe focus)
- **IDs**: Generate realistic prefixed IDs (e.g., `ANF-DEMO-001`, `RE-2024-0042`)
- **Dates**: Use dates within the last 90 days, formatted as ISO 8601
- **Money**: Realistic EUR amounts (net: 50-15000, tax: 19% MwSt)
- **Status distribution**: Mix of statuses (e.g., 60% open, 20% paid, 20% overdue)
- **Relationships**: Reference existing demo IDs where foreign keys exist
- **Text**: Realistic German business descriptions (Metallbau, Hydraulik, Schlosserei, etc.)
- **Phone**: German format `+49 XXXX XXXXXXX`
- **VAT IDs**: Format `DE` + 9 digits

### Output Options

Ask which format:
1. **SQL** — `INSERT INTO` statements to paste into Supabase SQL Editor
2. **JS** — Update `demo-data-service.js` with the new data arrays
3. **Both**
