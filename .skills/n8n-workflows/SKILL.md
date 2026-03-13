---
name: n8n-workflows
description: |
  Design, build, audit, and export n8n workflow JSON for the FreyAI Visions business automation suite.
  Use this skill whenever the user mentions workflow, automation, n8n, trigger, webhook, cron, schedule,
  batch processing, workflow design, automated emails, dunning, payment matching, invoice processing,
  morning briefing, or any task that should run asynchronously on a schedule or in response to events.
  Also trigger when the user asks to "automate" something, wants to connect Supabase with external APIs,
  or needs to process data in a pipeline (fetch -> transform -> act -> log). Even if the user doesn't
  say "n8n" explicitly, if the task is about recurring automation or event-driven processing, use this skill.
---

# n8n Workflow Design -- FreyAI Visions

Design production-grade n8n workflows for a German craftsman business suite. Every workflow follows the
95/5 architecture: n8n handles 95% of work asynchronously, humans review the remaining 5%.

## Architecture Context

- **n8n** runs in Docker on Hostinger VPS (Ubuntu 24.04, 16 GB RAM)
- **Supabase** is the database (PostgreSQL + Edge Functions + Storage)
- **Ollama** on VPS provides local LLMs (Mistral Small, Qwen3.5:9b) at `http://172.19.0.1:11434`
- **Supabase Edge Functions** handle email (`send-email`) and SMS (`send-sms`)
- **Telegram Bot API** for alerts and briefings
- All workflows export as JSON to `config/n8n-workflows/workflow-<name>.json`

## Workflow Design Process

### 1. Choose the Trigger

| Trigger | When to Use | Node Type |
|---------|-------------|-----------|
| Cron/Schedule | Recurring tasks (daily reports, hourly checks) | `n8n-nodes-base.scheduleTrigger` |
| Webhook | External event (form submission, API call, Supabase event) | `n8n-nodes-base.webhook` |
| Manual | Testing or one-off tasks | `n8n-nodes-base.manualTrigger` |

Cron schedules use `Europe/Berlin` timezone. Convention: morning jobs at 07:00-08:00.

### 2. Follow the Standard Pipeline

Every workflow follows: **Trigger -> Fetch -> Transform -> Act -> Log**

1. **Trigger**: Cron or Webhook (with input validation for webhooks)
2. **Fetch**: Query Supabase tables or external APIs
3. **Transform**: Set nodes for field mapping, Code nodes for complex logic, IF/Switch for routing
4. **Act**: Send emails, generate PDFs, call LLMs, update database records
5. **Log**: Always write to `automation_log` table (action, target, metadata JSONB)

### 3. Apply Error Handling

Every workflow needs:
- `continueOnFail: true` on all external API calls (LLM, email, PDF, third-party)
- A dedicated error handler node that logs to `automation_log` with `action = '<workflow>.error'`
- Fallback paths when AI/API calls fail (e.g., template text instead of LLM-generated text)
- Webhook workflows must return proper HTTP responses (200 success, 400 validation, 500 error)

### 4. Use the Right Node Types

Read `references/node-patterns.md` for detailed node configurations covering:
- Supabase CRUD operations (getAll with filters, create, update)
- Ollama/Mistral LLM calls via HTTP Request
- Telegram Bot API messaging
- Supabase Edge Function calls (send-email, send-sms)
- Batch processing with splitInBatches
- Data routing with IF and Switch nodes

### 5. Naming and Export Conventions

- **Workflow name**: German business term + English subtitle, e.g. `"Mahnwesen (Dunning / Receivables)"`
- **Node names**: Descriptive, prefixed with action: `SELECT Offene Rechnungen`, `INSERT automation_log`
- **Notes on every node**: Explain what it does, what columns it uses, any fixes applied
- **Tags**: Lowercase keywords for categorization: `["dunning", "finance", "zone2"]`
- **File name**: `workflow-<kebab-case-name>.json`
- **Workflow-level notes**: Include setup instructions, env vars needed, schema dependencies

## Supabase Integration

### Tables Used by Workflows

| Table | Common Operations | Key Columns |
|-------|-------------------|-------------|
| `rechnungen` | Read open/overdue, update status | id, status, brutto, zahlungsziel_tage, mahnstufe |
| `kunden` | Lookup by email, create/update | id, user_id, name, email, telefon, kategorie |
| `anfragen` | Create from inbound messages | id, user_id, kunde_name, leistungsart, status |
| `auftraege` | Read active orders | id, status, kunde_name, leistungsart |
| `automation_log` | Write after every action | action, target, metadata (JSONB) |
| `dokumente` | Store OCR results | dateiname, kategorie, storage_path, extrahierte_daten |
| `notifications` | Health check alerts | type, title, message, read |

### Credential: `Supabase API` (id: `cred-supabase-api`)

All Supabase nodes reference this single credential. Uses SERVICE_ROLE key (bypasses RLS).

## LLM Integration via Ollama

Local LLMs on VPS via Docker bridge network. Never send PII to external LLM APIs.

```
URL:     http://172.19.0.1:11434/api/chat
Model:   mistral-small (default) or mistral:latest
Stream:  false (always)
Timeout: 60-120 seconds
```

System prompts in German. Temperature 0.3-0.4 for business documents, 0.6-0.7 for creative content.

## Environment Variables

Workflows reference these via `$env['VAR_NAME']`:

- `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `OLLAMA_BASE_URL` (default: `http://172.19.0.1:11434`)
- `OLLAMA_MODEL` (default: `mistral-small`)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CTO_CHAT_ID`
- `OWNER_EMAIL` (default: `kontakt@freyaivisions.de`)
- `BACKEND_URL` (default: `http://backend:8001`)

## Quality Checklist

Before delivering any workflow:

- [ ] Every external API node has `continueOnFail: true`
- [ ] Error handler logs to `automation_log` with descriptive action name
- [ ] Webhook workflows validate required fields and return proper HTTP status codes
- [ ] All Supabase nodes reference credential `cred-supabase-api`
- [ ] Cron triggers use `Europe/Berlin` timezone
- [ ] Node names are descriptive (verb + target, e.g. `SELECT Overdue Rechnungen`)
- [ ] Every node has a `notes` field explaining its purpose
- [ ] Tags array includes relevant keywords
- [ ] Workflow-level notes document setup requirements and env vars
- [ ] LLM calls use local Ollama, not external APIs (unless specifically needed)
- [ ] Batch processing for large result sets (splitInBatches, batchSize: 5-10)
- [ ] JSON exported to `config/n8n-workflows/workflow-<name>.json`

## Reference Files

- `references/node-patterns.md` -- Detailed JSON snippets for every common node type
