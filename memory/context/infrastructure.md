# Infrastructure — FreyAI Visions

## VPS (Primary Server)

- **Provider**: Hostinger KVM 4
- **IP**: 72.61.187.24
- **OS**: Ubuntu 24.04
- **RAM**: 16 GB
- **Access**: `ssh root@72.61.187.24`
- **Docker**: Yes (Docker Compose)

### Services on VPS

| Service | Path | Port | Notes |
|---------|------|------|-------|
| Postiz (Social Media Scheduler) | /opt/postiz/ | 443 (HTTPS) | Docker Compose, v2.20.1 |
| n8n (Workflow Automation) | — | — | Docker |
| Ollama (Local LLMs) | — | 11434 | Mistral Small, Qwen3.5:9b |
| Email Relay | infrastructure/vps/email-relay/ | — | Outbound email |

### Postiz Configuration

- **URL**: https://social.freyaivisions.de
- **Config**: /opt/postiz/.env
- **Docker Compose**: /opt/postiz/docker-compose.yml
- **Containers**: postiz, postiz-temporal, postiz-postgres, postiz-redis
- **Version**: v2.20.1

#### Postiz .env Keys
```
JWT_SECRET=12062a7e8712ee07cea5e58d1322bca2e41a07aaeeea7047e9f0ee864d2aef2e
POSTGRES_PASSWORD=ytpJsqmEOD9ozLzqbhRNxAW7Wzi8ZhQ7
TELEGRAM_TOKEN=8699736997:AAFQOVtdY3gJieIbvMdeKZR92c4pO5SjCxI
TIKTOK_CLIENT_ID=awafwbdkarj5uxt0
TIKTOK_CLIENT_SECRET=giE99BDfRTNUMePUwD7KOzuya0kNSgnx
```

**IMPORTANT**: ENV variable for Telegram MUST be `TELEGRAM_TOKEN` (not TELEGRAM_BOT_TOKEN). Postiz uses node-telegram-bot-api with polling, NOT webhooks.

#### Connected Postiz Channels

| Channel ID | Platform | Name |
|-----------|----------|------|
| cmmhxwgi60001o57d6ata0j5u | instagram-standalone | FreyAI Visions |
| cmmizwowe0003nu45cmd1ynkt | instagram-standalone | Lithiumamethyst |
| cmmizy9xn0007nu4567ua0ioc | linkedin | Jonas Glawion |
| cmmhzkn8r0008mp6qjggw723u | linkedin-page | FreyAI Visions |
| cmmhzgjk10001mp6qu7ztxtgy | facebook | Freyai visions |
| cmml2rody0001mi4qfdaq1eec | telegram | Channel_56146656 |

#### Postiz API Patterns (Browser JS, session-cookie auth)

```javascript
// All calls need credentials: 'include' and must wrap in IIFE
(async () => {
  // List posts (minified keys: i=id, c=content, d=date, s=status, n=integration)
  const posts = await fetch('/api/posts?startDate=...&endDate=...', {credentials: 'include'}).then(r => r.json());
  // posts.p = array of posts

  // Create post
  await fetch('/api/posts', {
    method: 'POST',
    credentials: 'include',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      type: "schedule", // or "draft", "now"
      date: "2026-03-12T09:00:00.000Z",
      shortLink: false,
      tags: [],
      posts: [{
        integration: {id: "channel-id"},
        value: [{content: "caption", image: [{id: "media-uuid", path: "media-url"}]}],
        settings: {__type: "instagram", post_type: "story"} // post_type required for IG
      }]
    })
  });

  // Upload media
  const formData = new FormData();
  formData.append('file', blob, 'filename.png');
  await fetch('/api/media/upload-simple', {method: 'POST', credentials: 'include', body: formData});

  // List media (paginated: {pages, results})
  const media = await fetch('/api/media', {credentials: 'include'}).then(r => r.json());

  // List integrations
  const integrations = await fetch('/api/integrations/list', {credentials: 'include'}).then(r => r.json());
  // integrations.integrations = array
})();
```

**Post Settings by Platform:**
- Instagram: `{__type: "instagram", post_type: "post"}` or `post_type: "story"`
- Facebook: `{__type: "facebook"}` (post_type optional) or `post_type: "story"`
- LinkedIn: `{__type: "linkedin"}`
- Telegram: `{__type: "telegram"}`

### Telegram Bot

- **Bot**: @FreyAIPostizBot
- **Token**: 8699736997:AAFQOVtdY3gJieIbvMdeKZR92c4pO5SjCxI
- **Created via**: @BotFather
- **Polling**: Postiz uses polling (NOT webhooks) — do NOT set a webhook manually

---

## NAS (Local Network)

- **Device**: UGREEN NAS
- **IP**: 192.168.178.75
- **Web UI**: http://192.168.178.75:9999/desktop/#/
- **Shared Folder**: /FreyAI Visions/ (marketing campaign images)
- **Access**: Local network only (not reachable from VM/sandbox)

---

## Domains

| Domain | Purpose |
|--------|---------|
| freyai-visions.de | Main website (Hostinger static hosting) |
| social.freyaivisions.de | Postiz instance (VPS) |

---

## Supabase

- **Project URL**: See .env SUPABASE_URL
- **Auth**: Supabase Auth (email + OAuth)
- **Storage Buckets**: marketing-assets (for campaign logos/photos)
- **Edge Functions**: 13 functions (Deno/TypeScript), including canva-proxy

---

## Canva Integration

- **Account**: Canva Pro
- **API**: Canva Connect API (Private Integration, no review needed)
- **Proxy**: supabase/functions/canva-proxy/index.ts
- **Client Service**: js/services/canva-integration-service.js
- **Folder**: FAHDk1VB76k "FreyAI Visions — Instagram Stories Campaign"
- **12 Story Designs**: DAHDkxPYXOo, DAHDk8Xi9xg, DAHDkwtkBWE, DAHDk37Amlo, DAHDk9sBibw, DAHDk7BqNFc, DAHDk9D6HtA, DAHDk0lvbWk, DAHDk4tjl64, DAHDkyeGASA, DAHDk-zj3KM, DAHDk8bh3ZE
