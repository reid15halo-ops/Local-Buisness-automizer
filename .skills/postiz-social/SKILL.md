---
name: postiz-social
description: |
  Manage the Postiz social media integration for FreyAI Visions.
  Use this skill when the user asks about Postiz setup, social media posting,
  content scheduling, Docker configuration, Temporal workflows, n8n social automations,
  or social media channel management.
  Also trigger when the user says "Postiz", "social media", "post erstellen",
  "content pipeline", "Instagram", "Facebook", "LinkedIn", "social scheduling",
  "Temporal", or any request involving social media automation infrastructure.
---

# Postiz Social Skill — FreyAI Social Media Infrastructure

Manage the self-hosted Postiz social media platform: Docker setup, Temporal workflows, content pipeline, n8n automations, and critical operational gotchas.

Read `references/postiz-setup.md` for the full infrastructure map before making changes.

## 1. Infrastructure Overview

### Docker Stack
```yaml
# /opt/postiz/docker-compose.yml on VPS (72.61.187.24)
services:
  postiz:          # Main app (port 5000 → social.freyaivisions.de)
  postiz-temporal: # Temporal workflow engine
  postiz-postgres: # PostgreSQL database
  postiz-redis:    # Redis cache/queue
```

### DNS & Access
- `social.freyaivisions.de` → Postiz web UI (Nginx reverse proxy)
- Organization ID: `c740c0dd-30e5-42e1-b0e0-507882c01506`

### Connected Channels
| Platform | Type | Channel |
|----------|------|---------|
| Instagram | instagram-standalone | FreyAI Visions |
| Facebook | facebook | FreyAI Visions Page |
| LinkedIn | linkedin-page | FreyAI Visions Company |

## 2. Critical Gotchas

### Gotcha 1: Orchestrator MUST Be Running
```yaml
# docker-compose.yml — postiz service command MUST include orchestrator
command: sh -c "npm run start:prod & npm run start:orchestrator"
```
**Without the orchestrator, NO posts will publish.** The orchestrator polls for scheduled posts and triggers Temporal workflows.

### Gotcha 2: Subscription Row Required
Self-hosted Postiz requires a manual `Subscription` row in the database:
```sql
INSERT INTO "Subscription" ("organizationId", "identifier", "totalChannels", "isLifetime")
VALUES ('c740c0dd-30e5-42e1-b0e0-507882c01506', 'YEARLY', 100, true);
```
Without this, the app limits channels and features.

### Gotcha 3: Image Format
Post images must use the object array format, NOT string array:
```javascript
// CORRECT
post.image = [{"id": "uuid-here"}]

// WRONG — will silently fail
post.image = ["uuid-here"]
```

### Gotcha 4: Temporal — Never Touch the DB Directly
- Never modify Temporal's internal database tables
- Use the Temporal API or restart services instead
- If workflows are stuck: `docker restart postiz-temporal postiz`

### Gotcha 5: Missing Post Recovery
The `missing-post-workflow` runs every 1 hour and picks up QUEUE status posts within ±2 hours of their scheduled time. If a post was missed, change its status back to QUEUE.

## 3. Content Pipeline

### Automated Flow
```
Content idea (manual or AI-generated)
  ↓
content_pipeline.py — generates post text + image prompts
  ↓
Postiz API — creates post with schedule
  ↓
Temporal workflow — publishes at scheduled time
  ↓
n8n analytics — tracks engagement
```

### Story Schedule
- Instagram: 2/day (08:00, 17:00 CET)
- Facebook: 1/day (12:00 CET)

### Content Types
| Type | Platforms | Frequency |
|------|-----------|-----------|
| Stories | Instagram, Facebook | Daily |
| Feed Posts | Instagram, LinkedIn | 3-4/week |
| Articles | LinkedIn | 1/week |
| Reels | Instagram | 1-2/week |

## 4. n8n Social Workflows

### 4 Workflows
| Workflow | Purpose | Trigger |
|----------|---------|---------|
| Social Scheduler | Queue posts from content pipeline | Cron (daily 06:00) |
| Social Analytics | Collect engagement metrics | Cron (daily 22:00) |
| Social Repost | Re-share evergreen content | Cron (weekly) |
| Monthly Report | Engagement summary email | Cron (1st of month) |

### Workflow Data Flow
```
content_pipeline.py → n8n (Social Scheduler)
  → Postiz API: POST /api/posts
  → Sets: content, image, publishDate, channels[]
  → Status: QUEUE (waiting for Temporal to pick up)
```

## 5. Postiz API Usage

### Creating a Post
```javascript
const response = await fetch('https://social.freyaivisions.de/api/posts', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${POSTIZ_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: 'Post text here',
    image: [{ id: 'uploaded-image-uuid' }],  // Object array format!
    publishDate: '2026-03-15T08:00:00Z',
    channels: ['channel-uuid-1', 'channel-uuid-2'],
    organizationId: 'c740c0dd-30e5-42e1-b0e0-507882c01506'
  })
});
```

### Uploading Media
```javascript
const formData = new FormData();
formData.append('file', imageBlob);
const { id } = await fetch('https://social.freyaivisions.de/api/media', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${POSTIZ_API_KEY}` },
  body: formData
}).then(r => r.json());
// Use id in post.image: [{ id }]
```

## 6. Troubleshooting

### Posts Not Publishing
1. Check orchestrator is running: `docker logs postiz | grep orchestrator`
2. Check Temporal is healthy: `docker logs postiz-temporal`
3. Check post status is QUEUE (not DRAFT)
4. Check publishDate is in the future (or within ±2h for recovery)

### Container Issues
```bash
# Full restart sequence
ssh root@72.61.187.24
cd /opt/postiz
docker compose down
docker compose up -d

# Check all 4 containers running
docker ps | grep postiz
```

### Channel Disconnected
1. Go to `social.freyaivisions.de/settings/channels`
2. Re-authenticate the affected platform
3. Verify OAuth tokens are valid (Google OAuth especially expires)

## 7. Marketing Schema (Supabase)

| Table | Purpose |
|-------|---------|
| `marketing_campaigns` | Campaign definitions and budgets |
| `marketing_posts` | Scheduled/published post records |
| `marketing_analytics` | Engagement metrics per post |
| `marketing_templates` | Reusable content templates |

## 8. Quality Checklist

Before modifying Postiz infrastructure, verify all 8 items:

1. [ ] Docker compose includes orchestrator in postiz command
2. [ ] Subscription row exists in Postiz database
3. [ ] Image format uses object array `[{"id":"uuid"}]`
4. [ ] All 4 containers running (postiz, temporal, postgres, redis)
5. [ ] Post publishDate is in correct timezone (CET/CEST)
6. [ ] Channel OAuth tokens are valid (check expiry)
7. [ ] n8n workflows are active and not errored
8. [ ] Temporal is not touched directly (use API or restart)

## References

- `references/postiz-setup.md` — Docker config, Nginx, DNS, container management
