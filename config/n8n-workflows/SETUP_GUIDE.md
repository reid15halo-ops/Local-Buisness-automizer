# n8n Workflow Setup Guide — FreyAI Visions

This guide covers everything needed to import, configure, and activate all n8n workflows for the FreyAI Visions business automation suite.

---

## Prerequisites

### n8n Version
- Minimum: n8n **1.30.0** (for scheduleTrigger typeVersion 1.2, switch typeVersion 3, set typeVersion 3.4)
- Recommended: n8n **1.40.0+**
- Self-hosted (Docker) or n8n Cloud both work

### Supabase Project
- A Supabase project must be created at https://supabase.com
- Run `config/supabase-schema.sql` in the Supabase SQL Editor to create all required tables
- Additional migration at `config/migration-v2.sql` must also be run
- Edge functions deployed: `send-email`, `send-sms` (see `supabase/functions/`)

### External Services (per-workflow, see details below)
- OpenAI API key (for dunning, communication workflows)
- GoCardless Open Banking (for payment matching)
- Telegram Bot (for backup/alert notifications)
- Twilio (for SMS in onboarding workflow)
- Google Calendar OAuth2 (for communication/scheduling workflow)

---

## How to Import a Workflow

### Method 1: Copy-Paste (Recommended)

1. Open your n8n instance in a browser
2. Click **"New Workflow"** or go to Workflows > New
3. Click the **"..."** menu (top-right) > **"Import from File"**
4. Select the JSON file from `config/n8n-workflows/`
5. The workflow opens in the canvas editor
6. Review all nodes and verify credentials are assigned
7. Click **"Save"** (Ctrl+S)

### Method 2: n8n CLI Import

```bash
# If running n8n via Docker:
docker exec -it n8n n8n import:workflow --input=/path/to/workflow-dunning.json

# If running n8n directly:
n8n import:workflow --input=./config/n8n-workflows/workflow-dunning.json
```

### Import All Workflows at Once

```bash
# Import all workflows from the directory
for f in ./config/n8n-workflows/workflow-*.json; do
  n8n import:workflow --input="$f"
  echo "Imported: $f"
done
```

---

## Environment Variables

Set these in n8n under **Settings > Environment Variables** (self-hosted) or as workflow-level environment in n8n Cloud.

### Core (Required by all workflows)

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://abc123.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (never expose client-side) | `eyJhbG...` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbG...` |
| `SUPABASE_PROJECT_REF` | Supabase project reference ID (the `abc123` part of the URL) | `abc123` |

### OpenAI (Required by: dunning, communication, finance-invoicing)

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key from https://platform.openai.com/api-keys | `sk-...` |

### GoCardless Open Banking (Required by: payment-matching, dunning)

| Variable | Description | Example |
|----------|-------------|---------|
| `GOCARDLESS_ACCESS_TOKEN` | GoCardless Open Banking access token | `eyJhbG...` |
| `GOCARDLESS_ACCOUNT_ID` | Bank account ID from GoCardless | `abc123...` |

To get these:
1. Register at https://bankaccountdata.gocardless.com
2. Create an end user agreement for your bank
3. Complete the OAuth flow to get access token and account ID

### Backend (Zone 2 Python Service)

| Variable | Description | Example |
|----------|-------------|---------|
| `BACKEND_URL` | Internal URL of the Zone 2 Python backend | `http://backend:8001` |
| `PDF_GENERATION_WEBHOOK_URL` | URL for PDF generation service | `http://backend:8001/pdf/generate` |
| `PUSH_NOTIFICATION_WEBHOOK_URL` | URL for push notification service | `http://backend:8001/notify/push` |

### Telegram Alerts (Required by: backup-alert)

| Variable | Description | Example |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | `123456:ABC-DEF...` |
| `TELEGRAM_CTO_CHAT_ID` | Chat ID for CTO alerts (from @userinfobot) | `123456789` |
| `CTO_EMAIL` | CTO email for alert emails | `cto@freyai-visions.de` |
| `ALERT_EMAIL_WEBHOOK_URL` | Webhook URL for email alerts | `http://backend:8001/notify/email` |

To create a Telegram bot:
1. Message @BotFather on Telegram: `/newbot`
2. Follow prompts to get `TELEGRAM_BOT_TOKEN`
3. Message @userinfobot to get your `TELEGRAM_CTO_CHAT_ID`

### Customer Onboarding

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_PROJECT_REF` | Used to construct edge function URLs | `abc123` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for edge function calls | `eyJhbG...` |
| `SUPABASE_ANON_KEY` | Anonymous key (apikey header) | `eyJhbG...` |

Twilio credentials for SMS are stored as Supabase Edge Function secrets, not in n8n:
```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your-token
supabase secrets set TWILIO_FROM_NUMBER=+4915123456789
```

---

## Configuring the Supabase Credential Node in n8n

Every workflow uses a Supabase API credential named **"Supabase API"** with ID `cred-supabase-api`.

### Steps to Create the Credential

1. Go to n8n > **Settings > Credentials > Add Credential**
2. Search for and select **"Supabase"**
3. Fill in:
   - **Name**: `Supabase API` (must match exactly)
   - **Host**: Your Supabase project URL, e.g. `https://abc123.supabase.co`
   - **Service Role Secret**: Your `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Save**

### Assigning Credentials to Workflows

After importing each workflow, open it and for each Supabase node:
1. Click the node
2. Under **Credentials**, select `Supabase API` from the dropdown
3. Save the workflow

---

## Activating and Testing Each Workflow

### Workflow Activation

1. Open the workflow in n8n
2. Toggle the **Active** switch in the top-right corner
3. Confirm in the dialog that appears

### Testing Individual Workflows

#### 1. workflow-dunning.json (Daily 08:00)
```bash
# Trigger manually in n8n UI: click "Execute Workflow" button
# Or test via REST API:
curl -X POST https://your-n8n.domain/api/v1/workflows/<workflow-id>/execute \
  -H "X-N8N-API-KEY: your-api-key"
```
Expected: Fetches rechnungen with status='offen', calculates days overdue, generates dunning letters.

#### 2. workflow-communication.json (Webhook)
```bash
curl -X POST https://your-n8n.domain/webhook/communication-intake \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "email",
    "sender_email": "test@example.de",
    "sender_name": "Max Mustermann",
    "subject": "Termin anfrage",
    "body": "Ich haette gerne einen Termin am Dienstag."
  }'
```
Expected response: `{ "status": "received", "intent": "appointment_request", "message": "Communication processed successfully" }`

#### 3. workflow-finance-invoicing.json (Storage Webhook)
Configure in Supabase Dashboard: Storage > Buckets > `invoices` > Webhooks > Add webhook pointing to `https://your-n8n.domain/webhook/supabase-invoices-storage`.
Then upload a test invoice PDF/image to the invoices bucket.

#### 4. workflow-payment-matching.json (Daily 07:00)
```bash
# Test manually via n8n UI Execute button
# Requires valid GoCardless credentials with actual bank transactions
```
Expected: Fetches last 7 days of bank transactions, attempts to match with open rechnungen.

#### 5. workflow-backup-alert.json (Every 5 Minutes)
```bash
# After activating, check n8n Executions log
# Expect: health checks running every 5 minutes
# To test alert: temporarily bring down backend service
```

#### 6. workflow-customer-onboarding.json (Webhook)
```bash
curl -X POST https://your-n8n.domain/webhook/new-customer \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Musterfrau",
    "email": "maria@example.de",
    "user_id": "your-supabase-user-uuid",
    "phone": "+4917612345678",
    "city": "Frankfurt",
    "zip": "60311"
  }'
```
Expected response: `{ "success": true, "customer_id": "KD-XXXXX-XXXX", ... }`

---

## Webhook URL Patterns

All webhook URLs follow this pattern:

```
https://your-n8n.domain/webhook/<path>
```

| Workflow | Path | Method |
|----------|------|--------|
| workflow-communication.json | `/webhook/communication-intake` | POST |
| workflow-finance-invoicing.json | `/webhook/supabase-invoices-storage` | POST |
| workflow-customer-onboarding.json | `/webhook/new-customer` | POST |

For production, use **test webhooks** while developing:
```
https://your-n8n.domain/webhook-test/<path>
```
These activate only when the workflow is open in the editor.

**Production webhooks** are active only when the workflow is toggled Active:
```
https://your-n8n.domain/webhook/<path>
```

---

## Google Calendar Credential Setup

For **workflow-communication.json** to suggest appointment slots:

1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create an OAuth 2.0 Client ID (Web application type)
3. Add your n8n callback URL: `https://your-n8n.domain/rest/oauth2-credential/callback`
4. In n8n: Settings > Credentials > Add > Google Calendar OAuth2
5. Enter Client ID and Client Secret
6. Click **Connect** and authorize your Google account

---

## Troubleshooting Common Issues

### "Supabase API credential not found"
- Go to Settings > Credentials > ensure a credential named exactly `Supabase API` exists
- Re-open the workflow and re-assign the credential to affected nodes

### "Error: Cannot read properties of undefined (reading 'toISOString')"
- Usually means a Supabase query returned no results
- Check that the `rechnungen` table has records with `status='offen'`
- Verify SUPABASE_SERVICE_ROLE_KEY has correct permissions

### "GoCardless 401 Unauthorized"
- Access tokens expire after 90 days
- Re-run the GoCardless OAuth flow to refresh GOCARDLESS_ACCESS_TOKEN

### "OpenAI rate limit exceeded"
- Workflow retries are not configured by default
- Add a Wait node (30 seconds) before the OpenAI node
- Or upgrade to higher OpenAI tier

### Webhook returns 404
- Ensure the workflow is toggled Active (for production webhooks)
- Use `/webhook-test/` path when testing with workflow open in editor
- Check n8n logs: `docker logs n8n 2>&1 | grep webhook`

### "rechnungen: permission denied"
- The Supabase credential must use the SERVICE ROLE key (not the anon key)
- Service role key bypasses Row Level Security policies

### Communication workflow: "spam" intent routes but no response sent
- Spam messages route to the "Respond to Webhook" node directly (no DB insert, no draft)
- This is intentional. Verify the Switch node output 4 connects to "Respond to Webhook"

### Backup alert fires every 5 minutes (too noisy)
- Add a cooldown: check `notifications` table for alerts in the last 30 minutes
- Only send Telegram/Email if no recent alert exists
- Alternatively, change the cron to `*/30 * * * *` (every 30 minutes)

---

## Supabase Schema Notes

The workflows use these Supabase tables (all defined in `config/supabase-schema.sql`):

| Table | Used By |
|-------|---------|
| `rechnungen` | dunning, payment-matching |
| `kunden` | customer-onboarding |
| `anfragen` | customer-onboarding |
| `communication_log` | communication |
| `dokumente` | finance-invoicing |
| `notifications` | backup-alert |
| `automation_log` | all workflows (logging) |

The `rechnungen` table has these workflow-relevant columns added via schema migration:
```sql
ALTER TABLE rechnungen ADD COLUMN IF NOT EXISTS mahnstufe INTEGER DEFAULT 0;
ALTER TABLE rechnungen ADD COLUMN IF NOT EXISTS letzte_mahnung TIMESTAMPTZ;
```
These are already included in `config/supabase-schema.sql`.
