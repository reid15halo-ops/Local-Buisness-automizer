---
name: add-endpoint
description: Add a new FastAPI route to the Python backend with Supabase integration, Pydantic models, and proper error handling.
argument-hint: [method] [path] [description]
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

## Add a FastAPI Endpoint

Add a new endpoint to the FreyAI backend.

**Arguments:** `$ARGUMENTS`
Parse as: `[HTTP_METHOD] [PATH] [DESCRIPTION]`
Example: `POST /api/clients Create a new client`

### Steps

1. **Read** `backend/main.py` to understand the current structure.
2. **Read** `backend/requirements.txt` to check available dependencies.
3. **Add** the endpoint following these conventions:

#### Backend Conventions (FreyAI Core)

- **Framework**: FastAPI with async handlers
- **Validation**: Use Pydantic `BaseModel` for request/response schemas
- **Supabase**: Import and use the `supabase` Python client for DB operations
- **Auth**: Extract the user's JWT from `Authorization: Bearer <token>` header; verify via Supabase
- **Error handling**: Use `HTTPException` with appropriate status codes
- **Response model**: Always define an explicit response model
- **Naming**: snake_case for Python, match DB column names from `supabase_schema.sql`
- **Docstrings**: Add a one-line docstring to every endpoint function
- **CORS**: Already configured in `main.py` — no changes needed

#### Endpoint Template

```python
from pydantic import BaseModel
from fastapi import HTTPException, Depends

class CreateClientRequest(BaseModel):
    company_name: str
    contact_person: str = ""
    email: str = ""

class ClientResponse(BaseModel):
    id: str
    company_name: str
    # ... fields matching supabase_schema.sql

@app.post("/api/clients", response_model=ClientResponse)
async def create_client(req: CreateClientRequest):
    """Create a new client."""
    # Implementation using supabase client
```

4. If new dependencies are needed, add them to `backend/requirements.txt`.
5. Show the user a `curl` example to test the endpoint.
