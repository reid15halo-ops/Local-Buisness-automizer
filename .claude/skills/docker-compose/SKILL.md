---
name: docker-compose
description: Generate a docker-compose.yml for the full FreyAI stack — FastAPI backend, optional Supabase local, nginx reverse proxy.
argument-hint: [profile]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Generate Docker Compose

**Argument:** `$ARGUMENTS` — one of: `dev`, `prod`, `full`

### Steps

1. **Read** `backend/Dockerfile` and `backend/requirements.txt`.
2. Generate `docker-compose.yml` in the project root.

### Profiles

#### dev — Backend only
```yaml
version: "3.8"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    volumes:
      - ./backend:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### prod — Backend + nginx
```yaml
services:
  backend:
    build: ./backend
    env_file: .env
    restart: unless-stopped
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - .:/usr/share/nginx/html:ro
    depends_on:
      - backend
    restart: unless-stopped
```

#### full — Backend + Supabase local + nginx
Includes Supabase self-hosted stack (postgres, gotrue, realtime, storage, kong).

### Always generate a `.env.example` alongside:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
