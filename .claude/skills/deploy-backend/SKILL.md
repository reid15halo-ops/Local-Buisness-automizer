---
name: deploy-backend
description: Build the FreyAI FastAPI backend Docker image, run pre-flight checks, and prepare for deployment.
context: fork
agent: general-purpose
allowed-tools: Read, Bash, Grep, Glob
---

## Deploy Backend

### Pre-flight
1. Verify all imports in `backend/main.py` are in `requirements.txt`.
2. Scan for hardcoded secrets: `grep -rn "localhost\|password\|secret" backend/`
3. Verify `backend/Dockerfile` exists.

### Build
```bash
cd backend && docker build -t freyai-backend:latest .
```

### Validate
```bash
docker run -d --name freyai-test -p 8000:8000 freyai-backend:latest
curl -s http://localhost:8000/ | python3 -m json.tool
docker stop freyai-test && docker rm freyai-test
```

### Required Env Vars
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (NOT anon) |
| `PORT` | Server port (default: 8000) |
