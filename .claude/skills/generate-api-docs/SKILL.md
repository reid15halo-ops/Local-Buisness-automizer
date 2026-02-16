---
name: generate-api-docs
description: Auto-generate API documentation from FastAPI endpoints, Supabase schema, and Edge Functions — outputs OpenAPI spec or markdown.
argument-hint: [format]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Grep, Glob, Bash
---

## Generate API Documentation

**Argument:** `$ARGUMENTS` — one of: `markdown`, `openapi`, `both` (default: `markdown`)

### Steps

1. **Read** `backend/main.py` — extract all endpoints, methods, paths, models.
2. **Read** `supabase_schema.sql` — extract table structures for data models.
3. **Read** all Edge Functions in `supabase/functions/*/index.ts`.
4. Generate documentation.

### Markdown Output Structure

```markdown
# FreyAI Core API Reference

## Backend (FastAPI)

### Health Check
- **GET** `/`
- Response: `{ "status": "FreyAI Backend Active" }`

### [Endpoint Group]
#### [Method] [Path]
- **Auth**: Required / Public
- **Request Body**: (Pydantic model fields)
- **Response**: (model fields)
- **Example**:
  ```bash
  curl ...
  ```

## Edge Functions (Supabase)

### [Function Name]
- **URL**: `<SUPABASE_URL>/functions/v1/<name>`
- **Auth**: Bearer token required
- **Request Body**: JSON
- **Response**: JSON

## Database Schema

### [Table Name]
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| ... | ... | ... | ... |
```

### OpenAPI Output

Generate a `docs/openapi.json` that FastAPI would produce, extended with Edge Function definitions as custom `x-edge-functions` extension.

### Include
- All HTTP methods and paths
- Request/response schemas
- Authentication requirements
- Error response formats
- curl examples for every endpoint
