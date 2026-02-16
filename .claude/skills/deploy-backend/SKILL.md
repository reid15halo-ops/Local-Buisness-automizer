---
name: deploy-backend
description: Build the FreyAI FastAPI backend Docker image, run pre-flight checks, and prepare for deployment.
allowed-tools: Read, Bash, Grep, Glob
---

## Deploy Backend

Build and validate the FreyAI FastAPI backend for deployment.

### Pre-flight Checks

1. **Read** `backend/requirements.txt` and verify all imports in `backend/main.py` are listed.
2. **Check** for hardcoded secrets or localhost URLs in `backend/`:
   ```bash
   grep -rn "localhost\|127\.0\.0\.1\|hardcoded\|password\|secret" backend/
   ```
3. **Verify** `backend/Dockerfile` exists and is valid.

### Build

```bash
cd backend && docker build -t freyai-backend:latest .
```

### Validate

```bash
# Start container
docker run -d --name freyai-test -p 8000:8000 freyai-backend:latest

# Health check
curl -s http://localhost:8000/ | python3 -m json.tool

# Stop and remove
docker stop freyai-test && docker rm freyai-test
```

### Required Environment Variables

When deploying to production, these env vars must be set:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (NOT anon key) for backend |
| `PORT` | Server port (default: 8000) |

### Deployment Options

Report which option the user wants:

1. **Docker Compose** — Add a `docker-compose.yml` to the project root
2. **Fly.io** — Generate a `fly.toml` config
3. **Railway** — Uses Dockerfile automatically
4. **Manual VPS** — Provide systemd service unit file

### Post-Deploy

- Verify health endpoint returns `{"status": "FreyAI Backend Active"}`
- Confirm CORS allows the frontend origin
- Check Supabase connection from the backend
