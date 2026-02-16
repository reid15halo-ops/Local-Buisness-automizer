---
name: add-endpoint
description: Add a new FastAPI route to the Python backend with Supabase integration, Pydantic models, and error handling.
argument-hint: [method] [path] [description]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

## Add a FastAPI Endpoint

**Arguments:** `$ARGUMENTS` — parse as `[HTTP_METHOD] [PATH] [DESCRIPTION]`

### Steps

1. **Read** `backend/main.py` and `backend/requirements.txt`.
2. **Read** `supabase_schema.sql` for the relevant table schema.
3. **Add** the endpoint following conventions below.
4. If new deps needed, update `backend/requirements.txt`.

### Conventions

- Async handlers with Pydantic `BaseModel` for request/response
- Extract JWT from `Authorization: Bearer <token>`, verify via Supabase
- Use `HTTPException` with appropriate status codes
- Explicit response model on every endpoint
- snake_case matching DB columns from `supabase_schema.sql`
- One-line docstring on every endpoint function
- CORS already configured — don't duplicate

### Template

```python
class CreateItemRequest(BaseModel):
    name: str
    description: str = ""

class ItemResponse(BaseModel):
    id: str
    name: str

@app.post("/api/items", response_model=ItemResponse)
async def create_item(req: CreateItemRequest):
    """Create a new item."""
    ...
```
