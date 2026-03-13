# Postiz Setup — FreyAI Visions

## Docker Compose Configuration

### Location: `/opt/postiz/docker-compose.yml` on VPS (72.61.187.24)

```yaml
services:
  postiz:
    image: ghcr.io/gitroomhq/postiz-app:latest
    container_name: postiz
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postiz:${POSTIZ_DB_PASSWORD}@postiz-postgres:5432/postiz
      - REDIS_URL=redis://postiz-redis:6379
      - JWT_SECRET=${POSTIZ_JWT_SECRET}
      - FRONTEND_URL=https://social.freyaivisions.de
      - BACKEND_URL=https://social.freyaivisions.de
      # OAuth tokens for social platforms
      - INSTAGRAM_APP_ID=${INSTAGRAM_APP_ID}
      - INSTAGRAM_APP_SECRET=${INSTAGRAM_APP_SECRET}
      - FACEBOOK_APP_ID=${FACEBOOK_APP_ID}
      - FACEBOOK_APP_SECRET=${FACEBOOK_APP_SECRET}
      - LINKEDIN_CLIENT_ID=${LINKEDIN_CLIENT_ID}
      - LINKEDIN_CLIENT_SECRET=${LINKEDIN_CLIENT_SECRET}
    # CRITICAL: orchestrator MUST be in command
    command: sh -c "npm run start:prod & npm run start:orchestrator"
    depends_on:
      - postiz-postgres
      - postiz-redis
      - postiz-temporal

  postiz-temporal:
    image: temporalio/auto-setup:latest
    container_name: postiz-temporal
    restart: unless-stopped
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=postiz
      - POSTGRES_PWD=${POSTIZ_DB_PASSWORD}
      - POSTGRES_SEEDS=postiz-postgres

  postiz-postgres:
    image: postgres:15-alpine
    container_name: postiz-postgres
    restart: unless-stopped
    volumes:
      - postiz-pg-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=postiz
      - POSTGRES_PASSWORD=${POSTIZ_DB_PASSWORD}
      - POSTGRES_DB=postiz

  postiz-redis:
    image: redis:7-alpine
    container_name: postiz-redis
    restart: unless-stopped

volumes:
  postiz-pg-data:
```

## Nginx Configuration

### Location: `/etc/nginx/sites-available/social.freyaivisions.de`

```nginx
server {
    listen 443 ssl http2;
    server_name social.freyaivisions.de;

    ssl_certificate /etc/letsencrypt/live/social.freyaivisions.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/social.freyaivisions.de/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (for real-time updates)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Container Management

### Health Checks
```bash
# All 4 containers must be running
docker ps --filter "name=postiz" --format "{{.Names}}: {{.Status}}"
# Expected:
# postiz: Up X hours
# postiz-temporal: Up X hours
# postiz-postgres: Up X hours
# postiz-redis: Up X hours
```

### Restart Procedure
```bash
cd /opt/postiz
docker compose down
docker compose up -d

# Verify orchestrator started
docker logs postiz 2>&1 | grep -i orchestrator
# Should see: "Orchestrator started" or similar
```

### Update Procedure
```bash
cd /opt/postiz
docker compose pull
docker compose down
docker compose up -d
# Re-verify subscription row after updates (can get wiped)
```

### Log Inspection
```bash
# Main app logs
docker logs postiz --tail 100 -f

# Temporal workflow logs
docker logs postiz-temporal --tail 50

# Database logs
docker logs postiz-postgres --tail 50
```

## Subscription Setup

After fresh install or update, ensure subscription row exists:

```bash
docker exec -it postiz-postgres psql -U postiz -d postiz -c "
  SELECT * FROM \"Subscription\" WHERE \"organizationId\" = 'c740c0dd-30e5-42e1-b0e0-507882c01506';
"
```

If empty:
```bash
docker exec -it postiz-postgres psql -U postiz -d postiz -c "
  INSERT INTO \"Subscription\" (\"organizationId\", \"identifier\", \"totalChannels\", \"isLifetime\")
  VALUES ('c740c0dd-30e5-42e1-b0e0-507882c01506', 'YEARLY', 100, true)
  ON CONFLICT DO NOTHING;
"
```

## Channel Configuration

### Connected Channels
| Platform | Integration Type | OAuth Provider |
|----------|-----------------|----------------|
| Instagram | instagram-standalone | Facebook/Meta |
| Facebook | facebook | Facebook/Meta |
| LinkedIn | linkedin-page | LinkedIn |

### Adding a New Channel
1. Go to `social.freyaivisions.de/settings/channels`
2. Click "Add Channel"
3. Select platform
4. OAuth flow → authorize FreyAI app
5. Select page/profile to post as
6. Channel appears in channel selector for new posts

### OAuth Token Refresh
- Instagram/Facebook tokens expire every 60 days
- LinkedIn tokens expire every 365 days
- Google Business Profile: see `reference_google_oauth.md` in MEMORY
- Manual refresh: re-authenticate via Settings → Channels

## n8n Integration

### Workflow Connections
n8n workflows interact with Postiz via its API:

```
n8n Server (VPS localhost)
  ↓ HTTP Request node
Postiz API (localhost:5000/api/...)
  ├─→ POST /api/posts — Create scheduled post
  ├─→ GET /api/posts — List posts
  ├─→ POST /api/media — Upload image
  └─→ GET /api/analytics — Get engagement data
```

### Workflow Files (in config/n8n-workflows/)
- Social media scheduler workflow
- Social analytics collector
- Content repost workflow
- Monthly social report

## Content Pipeline

### content_pipeline.py (VPS)
```python
# Generates social media content using AI
# Input: content brief (topic, tone, platform)
# Output: post text + image prompt
# Then creates post via Postiz API

async def create_post(content, image_url, platforms, schedule_time):
    # 1. Upload image → get media ID
    media_id = await upload_media(image_url)

    # 2. Create post with correct image format
    post = {
        'content': content,
        'image': [{'id': media_id}],  # CRITICAL: object array format
        'publishDate': schedule_time.isoformat(),
        'channels': [channel_ids[p] for p in platforms],
        'organizationId': ORG_ID
    }

    # 3. POST to Postiz API
    response = await postiz_api.post('/api/posts', json=post)
    return response
```

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Posts not publishing | Orchestrator not running | Check docker compose command |
| "Subscription required" | Missing DB row | Insert Subscription row |
| Images not showing | Wrong format `["uuid"]` | Use `[{"id":"uuid"}]` |
| Temporal errors | DB corruption | Restart temporal + postiz |
| Channel disconnected | OAuth expired | Re-authenticate in settings |
| Container won't start | Port conflict | Check `docker ps -a`, resolve conflicts |
| Missing scheduled posts | Post outside ±2h window | Change status to QUEUE |
