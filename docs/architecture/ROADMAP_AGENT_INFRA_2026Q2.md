# FreyAI Visions -- Agent Infrastructure Roadmap Q2/2026

> Three initiatives to level up from "guy with scripts" to "orchestrated AI company"

---

## Initiative 1: Anthropic Skill Creator 2.0

**Goal:** Pull the latest Anthropic Skill Creator into the project. Build proper, evaluated skills for all FreyAI workflows.

**Why:** The updated Skill Creator adds 4 modes (Create, Eval, Improve, Benchmark) with parallel A/B testing. Our current skills (.skills/boomer-ux, .skills/question) are v1 -- no evals, no benchmarks.

### Tasks

| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 1.1 | Install Skill Creator from anthropics/skills repo | 15 min | -- |
| 1.2 | Run /skill-creator improve on existing boomer-ux skill | 30 min | 1.1 |
| 1.3 | Run /skill-creator improve on existing question skill | 30 min | 1.1 |
| 1.4 | Create new skill: handwerker-onboarding (client setup wizard) | 1h | 1.1 |
| 1.5 | Create new skill: morpheus-review (trigger 4-agent feedback loop) | 1h | 1.1 |
| 1.6 | Create new skill: datev-export (generate DATEV-compliant CSV) | 1h | 1.1 |
| 1.7 | Write evals for all skills using /skill-creator eval | 2h | 1.2-1.6 |
| 1.8 | Benchmark old vs new skills using /skill-creator benchmark | 1h | 1.7 |
| 1.9 | Update VPS OpenClaw skills with eval-tested versions | 30 min | 1.8 |

**Total estimate:** ~8h | **Priority:** HIGH | **Blocked by:** Nothing

---

## Initiative 2: Google Workspace CLI Integration

**Goal:** Connect FreyAI to Google Workspace (Gmail, Drive, Calendar, Docs, Sheets) via the new `gws` CLI + MCP server for client automation.

**Why:** Handwerker clients live in Google Workspace. Automating their email, calendar, and docs via n8n + gws eliminates manual data entry. This is a sellable feature (retainer value).

### Prerequisites

- Google Cloud project with Workspace APIs enabled (already have OAuth client)
- Google Workspace account for FreyAI (or client workspace)
- Node.js 20+ on VPS (already have)

### Tasks

| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 2.1 | Install gws CLI on VPS: `npm install -g @googleworkspace/cli` | 15 min | -- |
| 2.2 | Authenticate with Google OAuth (reuse existing Cal.com client) | 30 min | 2.1 |
| 2.3 | Test core commands: `gws gmail send`, `gws drive list`, `gws calendar list` | 30 min | 2.2 |
| 2.4 | Start MCP server: `gws mcp` -- verify structured JSON output | 15 min | 2.3 |
| 2.5 | Create n8n workflow: New Anfrage -> create Google Doc + email client | 2h | 2.3 |
| 2.6 | Create n8n workflow: Angebot approved -> create Google Sheets invoice | 2h | 2.3 |
| 2.7 | Create n8n workflow: Termin booked -> sync to Google Calendar | 1h | 2.3 |
| 2.8 | Create Claude Code skill: workspace-sync (file/email ops via gws) | 1h | 2.4 |
| 2.9 | Create n8n workflow: Weekly report -> Google Doc + email to client | 2h | 2.5 |
| 2.10 | Write docs: client onboarding guide for Google Workspace connection | 1h | 2.5-2.9 |

**Total estimate:** ~10h | **Priority:** MEDIUM | **Blocked by:** Client Google Workspace credentials

### Architecture

```
Client Action (Anfrage/Booking/Zahlung)
    |
    v
n8n Webhook --> n8n Workflow
    |
    +--> gws gmail send (confirmation email)
    +--> gws drive create (document)
    +--> gws calendar create (appointment)
    +--> gws sheets append (bookkeeping row)
    |
    v
FreyAI Dashboard (real-time sync via Supabase)
```

---

## Initiative 3: Paperclip Deployment and Evaluation

**Goal:** Deploy Paperclip on VPS to orchestrate all FreyAI agents (OpenClaw, Claude Code, n8n bots) as a unified AI company.

**Why:** Currently managing agents manually across n8n, OpenClaw cron jobs, and ad-hoc Claude Code sessions. Paperclip adds org charts, budgets, governance, persistent task state, and cost tracking.

### Prerequisites

- VPS has Docker, Node.js 20+, PostgreSQL capacity
- ~2 GB additional RAM for Paperclip + its Postgres instance
- Subdomain: `ops.freyaivisions.de` (needs DNS A record)

### Phase A: Deploy and Explore (Day 1-2)

| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 3.1 | Create DNS record: `ops.freyaivisions.de -> 72.61.187.24` | 5 min | -- |
| 3.2 | Create `/opt/paperclip/docker-compose.yml` on VPS | 30 min | -- |
| 3.3 | Deploy Paperclip via Docker Compose (port 3100, behind Nginx) | 30 min | 3.1, 3.2 |
| 3.4 | Obtain SSL cert via certbot for ops.freyaivisions.de | 10 min | 3.3 |
| 3.5 | Create Nginx reverse proxy config | 15 min | 3.3, 3.4 |
| 3.6 | Access UI, create first company: FreyAI Visions | 15 min | 3.5 |
| 3.7 | Set company objective | 10 min | 3.6 |

### Phase B: Agent Onboarding (Day 3-5)

| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 3.8 | Configure CEO agent (Claude Opus -- strategy, reviews, approvals) | 30 min | 3.6 |
| 3.9 | Configure CTO agent (Claude Code -- architecture, code reviews) | 30 min | 3.8 |
| 3.10 | Configure Dev Agent (OpenClaw -- feature implementation, bug fixes) | 1h | 3.9 |
| 3.11 | Configure Ops Agent (n8n webhooks -- automation, monitoring) | 1h | 3.9 |
| 3.12 | Configure Marketing Agent (Postiz -- social media, content) | 30 min | 3.8 |
| 3.13 | Configure Finance Agent (DATEV export, invoice generation) | 30 min | 3.8 |
| 3.14 | Set monthly budgets per agent | 15 min | 3.8-3.13 |
| 3.15 | Configure heartbeat intervals (Dev: 30min, Marketing: 6h, Finance: 24h) | 15 min | 3.8-3.13 |

### Phase C: Morpheus Integration (Day 5-7)

| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 3.16 | Map Morpheus 4-agent loop to Paperclip task workflow | 1h | 3.10 |
| 3.17 | Create Paperclip skill: Grounding -> Execution -> Evaluation -> Finalize | 2h | 3.16 |
| 3.18 | Wire n8n Morpheus webhook to Paperclip task API | 1h | 3.16 |
| 3.19 | Test end-to-end: create task -> agents execute -> 4 reviewers approve | 2h | 3.17, 3.18 |
| 3.20 | Configure Board governance: Jonas as sole approver for > $50 tasks | 30 min | 3.6 |

### Phase D: Evaluate and Decide (Day 7-10)

| # | Task | Effort | Depends On |
|---|------|--------|------------|
| 3.21 | Run 5 real tasks through Paperclip (feature, bugfix, content, report, deploy) | 4h | 3.19 |
| 3.22 | Compare: Paperclip orchestration vs current n8n-only approach | 1h | 3.21 |
| 3.23 | Evaluate: cost tracking, agent coordination, governance overhead | 1h | 3.21 |
| 3.24 | Decision: adopt Paperclip permanently or keep n8n-only | -- | 3.22, 3.23 |
| 3.25 | If adopt: migrate remaining OpenClaw cron jobs into Paperclip | 2h | 3.24 |

**Total estimate:** ~20h over 10 days | **Priority:** MEDIUM-HIGH | **Blocked by:** DNS record, VPS RAM

### Proposed Org Chart

```
         Jonas (Board / Human Governor)
                    |
            CEO Agent (Claude Opus)
           /    |     |      \
         CTO   CMO   CFO    COO
          |     |     |      |
        Dev   Mktg  Finance  Ops
     (OpenClaw) (Postiz) (DATEV) (n8n)
```

### Budget Allocation (Monthly)

| Agent | Budget | Heartbeat | Model |
|-------|--------|-----------|-------|
| CEO | $50 | On-demand | Claude Opus 4.6 |
| CTO | $100 | On-demand | Claude Opus 4.6 |
| Dev | $200 | 30 min | OpenClaw / Mistral Small |
| Marketing | $30 | 6h | Claude Sonnet 4.6 |
| Finance | $20 | 24h | Mistral Small |
| Ops | $20 | 1h | n8n (no LLM cost) |
| **Total** | **$420/mo** | | |

---

## Timeline Overview

```
Week 1 (Mar 10-14):  [=== Initiative 1: Skill Creator ===]
                      [== Init 3A: Deploy Paperclip ==]

Week 2 (Mar 17-21):  [=== Initiative 2: Google Workspace ===]
                      [=== Init 3B: Agent Onboarding ===]

Week 3 (Mar 24-28):  [== Init 3C: Morpheus Integration ==]
                      [= Init 3D: Evaluate =]
```

**Total across all initiatives:** ~38h over 3 weeks

---

## Decision Criteria for Paperclip Adoption

| Criteria | Keep n8n-only | Adopt Paperclip |
|----------|---------------|-----------------|
| Agent count | < 3 active | > 3 active |
| Cost visibility | Not needed | Need per-agent budgets |
| Governance | Manual review | Approval gates needed |
| Task persistence | OK to lose context | Need cross-session memory |
| Complexity | Adds overhead | Justified by scale |

---

*Generated: 2026-03-09 | FreyAI Visions*
