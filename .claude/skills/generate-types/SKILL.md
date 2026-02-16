---
name: generate-types
description: Generate JSDoc type definitions and Pydantic models from supabase_schema.sql for both frontend and backend.
argument-hint: [table-name or "all"]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Generate Types from Schema

Generate type definitions for `$ARGUMENTS` (use "all" for every table).

### Steps

1. **Read** `supabase_schema.sql` to extract column definitions.
2. Generate types for both frontend (JSDoc) and backend (Pydantic).

### Frontend — JSDoc (for JS files)

Output a `@typedef` block for each table, using camelCase property names:

```javascript
/**
 * @typedef {Object} Client
 * @property {string} id
 * @property {string} userId
 * @property {string} companyName
 * @property {string} contactPerson
 * @property {string} address
 * @property {string} email
 * @property {string} phone
 * @property {string} vatId
 * @property {string} notes
 * @property {string} createdAt
 * @property {string} updatedAt
 */
```

### Backend — Pydantic (for Python)

Output a `BaseModel` class for each table:

```python
class Client(BaseModel):
    id: str
    user_id: str
    company_name: str
    contact_person: str = ""
    address: str = ""
    email: str = ""
    phone: str = ""
    vat_id: str = ""
    notes: str = ""
    created_at: datetime
    updated_at: datetime
```

### Type Mapping

| PostgreSQL | JSDoc | Pydantic |
|-----------|-------|----------|
| UUID | `string` | `str` |
| TEXT | `string` | `str` |
| NUMERIC(x,y) | `number` | `Decimal` or `float` |
| BOOLEAN | `boolean` | `bool` |
| TIMESTAMPTZ | `string` | `datetime` |
| DATE | `string` | `date` |
| JSONB | `Object` or `Array` | `dict` or `list` |

### Output

Write JSDoc types to `js/config/types.js` and Pydantic models to `backend/models.py`.
