---
name: add-middleware
description: Add FastAPI middleware — rate limiting, request logging, JWT validation, response compression, or custom headers.
argument-hint: [middleware-type]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Add FastAPI Middleware

**Argument:** `$ARGUMENTS` — one of: `rate-limit`, `logging`, `jwt-auth`, `compression`, `timing`, `custom`

### Steps

1. **Read** `backend/main.py` for existing middleware (CORS is already configured).
2. Add the middleware AFTER the CORS middleware.

### Templates

#### rate-limit
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Apply rate limiting per IP
    ...
```
Add `slowapi` to `requirements.txt`.

#### logging
```python
import logging
import time

logger = logging.getLogger("freyai")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    logger.info(f"{request.method} {request.url.path} → {response.status_code} ({duration:.3f}s)")
    return response
```

#### jwt-auth
```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify Supabase JWT and return user data."""
    token = credentials.credentials
    # Verify with Supabase
    ...
    return user
```

#### timing
```python
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = f"{time.time() - start:.4f}"
    return response
```
