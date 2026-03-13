---
name: deployment
description: |
  Deployment procedures for the FreyAI Visions infrastructure. Use this skill ANY time the user mentions: deploy, push to prod, staging, VPS, nginx, SSL, certbot, rollback, go live, ship it, release, production, edge functions, Postiz restart, or server. Handles app deploy, website deploy, staging, Supabase Edge Functions, Postiz, SSL certs, and rollback.
---

# Deployment — FreyAI Visions Infrastructure

## Targets

| Target | VPS Path | Domain |
|--------|----------|--------|
| App (prod) | `/home/openclaw/workspace/projects/freyai-app` | `app.freyaivisions.de` |
| Website (prod) | `/home/openclaw/workspace/projects/freyai-website` | `freyaivisions.de` |
| App (staging) | `/home/openclaw/workspace/projects/freyai-app-staging` | `staging.app.freyaivisions.de` |
| Website (staging) | `/home/openclaw/workspace/projects/freyai-website-staging` | `staging.freyaivisions.de` |

VPS: `root@72.61.187.24` | GitHub: `reid15halo-ops/Local-Buisness-automizer`

## Pre-Deploy Checklist

Before ANY deploy, verify ALL of these:
1. `git status` — working tree clean, no uncommitted changes
2. On correct branch (`main` for prod, feature branch for staging)
3. `git log --oneline -3` — confirm the commits you expect are there
4. Push to GitHub first: `git push origin main`
5. Ask the user to confirm the target (prod vs staging)

## Deploy Commands

**App (prod):**
```bash
ssh root@72.61.187.24 "cd /home/openclaw/workspace/projects/freyai-app && git fetch github main && git reset --hard github/main"
```
**Website (prod):**
```bash
ssh root@72.61.187.24 "cd /home/openclaw/workspace/projects/freyai-website && git fetch github main && git reset --hard github/main"
```
**App (staging):**
```bash
ssh root@72.61.187.24 "cd /home/openclaw/workspace/projects/freyai-app-staging && git fetch github main && git reset --hard github/main"
```
**Supabase Edge Functions:**
```bash
supabase functions deploy <function-name> --project-ref incbhhaiiayohrjqevog
```
**Postiz Restart:**
```bash
ssh root@72.61.187.24 "cd /opt/postiz && docker compose down && docker compose up -d"
```

## Post-Deploy Verification

After every deploy, run these checks:
1. `curl -s -o /dev/null -w "%{http_code}" https://<domain>/` — expect 200
2. `curl -s https://<domain>/ | head -20` — verify correct content
3. `curl -sI https://<domain>/ | grep -i strict` — verify HSTS
4. `curl -s -o /dev/null -w "%{http_code}" https://<domain>/service-worker.js` — expect 200

## SSL / Certbot

Prerequisites: DNS A record must point to `72.61.187.24` first.
```bash
ssh root@72.61.187.24 "certbot --nginx -d <subdomain>.freyaivisions.de"
```
Nginx config: `/etc/nginx/sites-available/` — after edits: `nginx -t && systemctl reload nginx`

## Rollback

Capture current SHA before deploy, then rollback = reset to previous commit:
```bash
# Before deploy — save rollback point
ssh root@72.61.187.24 "cd <target-path> && git rev-parse HEAD"
# Find previous good commit
ssh root@72.61.187.24 "cd <target-path> && git log --oneline -5"
# Reset to it
ssh root@72.61.187.24 "cd <target-path> && git reset --hard <commit-sha>"
```

## Safety Rules

- NEVER force push to the VPS (push is disabled anyway)
- ALWAYS confirm the target with the user before deploying
- ALWAYS capture current commit SHA before deploy (for rollback)
- NEVER deploy uncommitted or unpushed changes
- ALWAYS run post-deploy verification
- For prod deploys, deploy to staging first when possible
- IP whitelist for app: Home `2.215.47.176`, Office `217.5.196.98`
