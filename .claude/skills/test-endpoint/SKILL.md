---
name: test-endpoint
description: Generate and run curl/httpie test commands for a FastAPI endpoint — validates request/response, auth, error cases.
argument-hint: [endpoint-path]
context: fork
agent: general-purpose
allowed-tools: Read, Grep, Glob, Bash
---

## Test API Endpoint

**Argument:** `$ARGUMENTS` — the endpoint path (e.g., `/`, `/api/clients`)

### Steps

1. **Read** `backend/main.py` to find the endpoint definition.
2. Extract: HTTP method, path, request body schema, response model.
3. Generate test commands.

### Test Cases

#### Happy path
```bash
curl -s -X <METHOD> http://localhost:8000<path> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '<json-body>' | python3 -m json.tool
```

#### Missing auth
```bash
curl -s -X <METHOD> http://localhost:8000<path> \
  -H "Content-Type: application/json" \
  -d '<json-body>'
# Expected: 401 or 403
```

#### Invalid body
```bash
curl -s -X <METHOD> http://localhost:8000<path> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"invalid": "data"}'
# Expected: 422 Validation Error
```

#### Empty body (for POST/PUT)
```bash
curl -s -X <METHOD> http://localhost:8000<path> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"
# Expected: 422
```

### Validation
- Response status code matches expected
- Response body matches Pydantic model shape
- Error responses have `detail` field
- Health check returns `{"status": "FreyAI Backend Active"}`
