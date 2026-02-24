# n8n Workflow Reference — FreyAI Visions

This document describes each workflow in detail: its business purpose, trigger conditions, node descriptions, Supabase table dependencies, and error handling behavior.

---

## Table of Contents

1. [workflow-dunning.json — Mahnwesen (Dunning)](#1-workflow-dunningjson--mahnwesen-dunning)
2. [workflow-communication.json — Kommunikation & Terminplanung](#2-workflow-communicationjson--kommunikation--terminplanung)
3. [workflow-finance-invoicing.json — Rechnungseingang (Invoice Intake)](#3-workflow-finance-invoicingjson--rechnungseingang-invoice-intake)
4. [workflow-payment-matching.json — Zahlungsabgleich](#4-workflow-payment-matchingjson--zahlungsabgleich)
5. [workflow-backup-alert.json — Zone 3 Health Monitoring](#5-workflow-backup-alertjson--zone-3-health-monitoring)
6. [workflow-customer-onboarding.json — Kunden-Onboarding](#6-workflow-customer-onboardingjson--kunden-onboarding)

---

## 1. workflow-dunning.json — Mahnwesen (Dunning)

### Purpose / Business Trigger
Automatically detects overdue invoices (Rechnungen) every morning and generates escalating dunning letters (Mahnschreiben) using GPT-4o-mini. Integrates four dunning levels aligned with German commercial law practices.

### Input: What Triggers It
- **Trigger type**: Scheduled (cron)
- **Schedule**: Every day at 08:00 Europe/Berlin (`0 8 * * *`)
- **Input data**: Reads all `rechnungen` records with `status = 'offen'`

### Output: What It Produces
- GPT-generated dunning letter text (German)
- PDF dunning letter via PDF generation service
- Updated `rechnungen.mahnstufe` and `rechnungen.letzte_mahnung`
- `automation_log` entry with action `dunning.sent`

### Nodes

| Node | Type | Description |
|------|------|-------------|
| Daily 08:00 Berlin | scheduleTrigger | Cron trigger at 08:00 Berlin time |
| SELECT Overdue Rechnungen | supabase (getAll) | Fetches all rechnungen with status='offen' |
| Split In Batches | splitInBatches | Processes 5 invoices at a time to avoid memory issues |
| Calculate Days Overdue | set | Computes `days_overdue` from `created_at + zahlungsziel_tage - now()` |
| Is Overdue? | if | Skips invoices still within payment terms (days_overdue <= 0) |
| Dunning Level Switch | switch | Routes to 4 output branches: reminder (<14d), 1st notice (14-30d), 2nd notice (30-60d), final notice (>60d) |
| Set Dunning Level Label | set | Sets `dunning_level` (German text) and `new_mahnstufe` (integer 1-4) |
| Generate Dunning Letter (GPT) | httpRequest | POST to OpenAI GPT-4o-mini to generate dunning letter text |
| Generate PDF | httpRequest | POST to PDF generation service, returns `pdf_url` |
| UPDATE rechnungen (mahnstufe) | supabase (update) | Updates `mahnstufe` and `letzte_mahnung` columns |
| INSERT automation_log (dunning) | supabase (create) | Logs successful dunning action |
| Error Handler: Log to automation_log | supabase (create) | Catches and logs any step failure |

### Dependencies

**Supabase Tables:**
- `rechnungen` (read): `id`, `status`, `zahlungsziel_tage`, `brutto`, `created_at`, `kunde_name`
- `rechnungen` (update): `mahnstufe`, `letzte_mahnung`
- `automation_log` (write): `action`, `target`, `metadata`

**External Services:**
- OpenAI API (`OPENAI_API_KEY`) — GPT-4o-mini for letter generation
- PDF Generation Service (`PDF_GENERATION_WEBHOOK_URL`) — converts letter to PDF

### Error Handling
- `Generate Dunning Letter (GPT)` has `continueOnFail: true` — if GPT fails, the PDF node receives a fallback message
- `Generate PDF` has `continueOnFail: true` — if PDF generation fails, the Supabase update still runs
- Dedicated `Error Handler` node logs failures to `automation_log` with `action = 'dunning.error'`

---

## 2. workflow-communication.json — Kommunikation & Terminplanung

### Purpose / Business Trigger
Processes inbound customer communications (email, WhatsApp) through AI-powered intent classification. Routes each message to the appropriate response pipeline and saves a draft reply to the database for human review.

### Input: What Triggers It
- **Trigger type**: Webhook (HTTP POST)
- **Webhook path**: `/webhook/communication-intake`
- **HTTP method**: POST
- **Expected payload**:
  ```json
  {
    "channel": "email",
    "sender_email": "kunde@example.de",
    "sender_name": "Max Mustermann",
    "subject": "Terminanfrage",
    "body": "Ich haette gerne einen Termin...",
    "attachments": []
  }
  ```

### Output: What It Produces
- AI intent classification (one of: `appointment_request`, `quote_request`, `complaint`, `payment`, `general`, `spam`)
- GPT-4o-mini generated draft reply (in German)
- `communication_log` entry with inbound message and classified intent
- `automation_log` entry with intent, confidence, channel, urgency
- For appointment requests: Google Calendar free/busy check included in draft
- Webhook response: `{ "status": "received", "intent": "...", "message": "..." }`

### Nodes

| Node | Type | Description |
|------|------|-------------|
| Communication Webhook | webhook | POST /webhook/communication-intake, waits for responseNode |
| OpenAI Intent Analysis | httpRequest | Calls GPT-4o-mini for intent classification, returns JSON |
| Extract Intent Fields | set | Parses GPT JSON response into individual fields (intent, confidence, summary, urgency). Falls back to 'general' on failure |
| Route by Intent | switch | Routes to 5 named outputs + fallback general |
| Google Calendar Free/Busy | httpRequest | Queries Google Calendar API for next 14 days availability (appointment path only) |
| Draft Appointment Reply | httpRequest | GPT generates appointment suggestion email with 2 time slots |
| Draft General Reply | httpRequest | GPT generates appropriate reply for non-appointment intents |
| INSERT communication_log (appointment) | supabase (create) | Saves inbound message + draft to communication_log |
| INSERT communication_log (general) | supabase (create) | Saves inbound message + draft to communication_log |
| INSERT automation_log (appointment processed) | supabase (create) | Logs processing event |
| INSERT automation_log (general processed) | supabase (create) | Logs processing event |
| Respond to Webhook | respondToWebhook | Returns success JSON to caller |
| Respond to Webhook (Error) | respondToWebhook | Returns error JSON for validation failures |

### Dependencies

**Supabase Tables:**
- `communication_log` (write): `channel`, `kunde_name`, `message`, `direction`, `status`, `template_id`
- `automation_log` (write): `action`, `target`, `metadata`

**External Services:**
- OpenAI API (`OPENAI_API_KEY`) — intent classification and reply drafting
- Google Calendar OAuth2 (`cred-google-calendar`) — free/busy query for appointments

### Error Handling
- `OpenAI Intent Analysis` has `continueOnFail: true`; `Extract Intent Fields` defaults to `intent='general'` if GPT fails
- `Google Calendar Free/Busy` has `continueOnFail: true`; appointment draft proceeds with empty calendar data
- All GPT reply nodes have `continueOnFail: true`
- Dedicated error response node returns HTTP 400 for missing webhook body fields
- Spam messages route directly to webhook response without any database insert

---

## 3. workflow-finance-invoicing.json — Rechnungseingang (Invoice Intake)

### Purpose / Business Trigger
Processes incoming invoice documents uploaded to Supabase Storage. Uses GPT-4o vision OCR to extract structured invoice data, validates the arithmetic, then stores in `dokumente` with confidence-based routing.

### Input: What Triggers It
- **Trigger type**: Webhook (HTTP POST) — called by Supabase Storage webhook
- **Webhook path**: `/webhook/supabase-invoices-storage`
- **Configured in**: Supabase Dashboard > Storage > Buckets > `invoices` > Webhooks
- **Expected payload** (from Supabase Storage):
  ```json
  {
    "type": "INSERT",
    "table": "objects",
    "record": {
      "bucket_id": "invoices",
      "name": "invoice-2026-001.pdf",
      "owner": "user-uuid",
      "created_at": "2026-02-24T10:00:00Z"
    }
  }
  ```

### Output: What It Produces
- Signed download URL for the uploaded file
- Preprocessed and PII-sanitized image (via Zone 2 backend)
- Extracted invoice data in `dokumente.extrahierte_daten` JSONB
- `automation_log` entry with OCR result and confidence
- Push notification if manual review required

### Nodes

| Node | Type | Description |
|------|------|-------------|
| Supabase Storage Trigger | webhook | Receives storage event from Supabase |
| Get Signed File URL | httpRequest | POST to Supabase Storage sign endpoint, returns signedURL |
| Preprocess Image (Zone 2) | httpRequest | POST to BACKEND_URL/image/preprocess — resizes, enhances image |
| PII Sanitize (Zone 2) | httpRequest | POST to BACKEND_URL/pii/sanitize — removes personal data before sending to OpenAI |
| OpenAI GPT-4o Vision Extract | httpRequest | Multimodal GPT-4o-mini call with image, extracts invoice JSON |
| Math Validate (Zone 2) | httpRequest | POST to BACKEND_URL/math/validate — verifies totals, tax calculations |
| Confidence >= 0.95? | if | Routes to approved path (true) or needs_review path (false) |
| INSERT dokumente (approved) | supabase (create) | Stores document metadata with status='pending_approval' |
| INSERT dokumente (needs_review) | supabase (create) | Stores document metadata with status='needs_review' |
| INSERT automation_log (approved) | supabase (create) | Logs successful OCR |
| INSERT automation_log (needs_review) | supabase (create) | Logs low-confidence OCR |
| Push Notification (needs_review) | httpRequest | Sends push notification for manual review |
| Error Handler | supabase (create) | Logs any processing failures |

### Dependencies

**Supabase Tables:**
- `dokumente` (write): `dateiname`, `kategorie`, `storage_path`, `extrahierte_daten`
- `automation_log` (write): `action`, `target`, `metadata`

**External Services:**
- Supabase Storage API — signed URL generation (`SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY`)
- Zone 2 Python Backend (`BACKEND_URL`) — image preprocessing, PII sanitization, math validation
- OpenAI API (`OPENAI_API_KEY`) — GPT-4o-mini vision for OCR
- Push notification service (`PUSH_NOTIFICATION_WEBHOOK_URL`)

### Error Handling
- `OpenAI GPT-4o Vision Extract` has `continueOnFail: true`; safe fallback JSON sent to math validator
- `Math Validate` has `continueOnFail: true`; defaults `confidence=0` and `math_valid=false` on failure
- Low confidence (< 0.95) routes to `needs_review` path + push notification
- `Push Notification` has `continueOnFail: true` (notification failure does not block DB write)
- Dedicated error handler logs failures to `automation_log` with `action='invoice_ocr.error'`

---

## 4. workflow-payment-matching.json — Zahlungsabgleich

### Purpose / Business Trigger
Automatically matches incoming bank transactions from GoCardless Open Banking against open invoices (rechnungen) using dual matching strategies. Marks matched invoices as `bezahlt` and queues unmatched transactions for manual review.

### Input: What Triggers It
- **Trigger type**: Scheduled (cron)
- **Schedule**: Every day at 07:00 Europe/Berlin (`0 7 * * *`) — runs 1 hour before dunning check
- **Input data**: GoCardless API returns last 7 days of booked bank transactions

### Output: What It Produces
- `rechnungen.status` updated to `'bezahlt'` for matched invoices
- `rechnungen.paid_at` set to bank booking date
- `automation_log` entry with `action='payment.auto_matched'` for successful matches
- `automation_log` entry with `action='payment.unmatched'` for transactions requiring manual review
- `automation_log` entry with `action='payment.matching_run_empty'` if no transactions found

### Nodes

| Node | Type | Description |
|------|------|-------------|
| Daily 07:00 Berlin | scheduleTrigger | Cron trigger at 07:00 Berlin time |
| Fetch Last 7 Days Transactions | httpRequest | GET GoCardless API for last 7 days transactions |
| Has Transactions? | if | Skips to empty-run log if no booked transactions |
| Split Booked Transactions | splitOut | Splits transactions.booked array into individual items |
| Normalize Transaction Fields | set | Extracts: txn_amount, txn_currency, txn_id, txn_booking_date, txn_creditor_name, txn_reference, txn_creditor_iban |
| Credit Transactions Only | if | Filters to positive amounts only (incoming payments) |
| Lookup Rechnung by Amount (±0.01) | supabase (getAll) | Matches rechnungen.brutto within ±0.01 EUR |
| Lookup Rechnung by Reference | supabase (getAll) | Matches rechnungen.leistungsart contains transaction reference |
| Merge Match Results | merge | Combines results from both lookup strategies |
| Match Found? | if | Routes to paid-update (true) or manual-review queue (false) |
| UPDATE rechnungen status='bezahlt' | supabase (update) | Sets status='bezahlt' and paid_at |
| INSERT automation_log (matched) | supabase (create) | Logs successful match with transaction details |
| INSERT automation_log (manual review) | supabase (create) | Queues unmatched transaction for manual review |
| Log: No Transactions | supabase (create) | Logs empty run to automation_log |
| Error Handler: Log Fetch Error | supabase (create) | Catches GoCardless API failures |

### Dependencies

**Supabase Tables:**
- `rechnungen` (read): `id`, `status`, `brutto`, `leistungsart`
- `rechnungen` (update): `status`, `paid_at`
- `automation_log` (write): `action`, `target`, `metadata`

**External Services:**
- GoCardless Open Banking API (`GOCARDLESS_ACCESS_TOKEN`, `GOCARDLESS_ACCOUNT_ID`)

### Error Handling
- `Has Transactions?` false path logs empty run (normal behavior on weekends/holidays)
- `Credit Transactions Only` false path silently drops outgoing payments (no log needed)
- Unmatched transactions stored in `automation_log` with `requires_manual_review: true` in metadata
- Dedicated error handler for GoCardless API failures

---

## 5. workflow-backup-alert.json — Zone 3 Health Monitoring

### Purpose / Business Trigger
Monitors the health of critical infrastructure services every 5 minutes. Sends immediate alerts via Telegram and email if any service is down. Logs all health checks to the Supabase `notifications` table.

### Input: What Triggers It
- **Trigger type**: Scheduled (cron)
- **Schedule**: Every 5 minutes (`*/5 * * * *`)
- **Input data**: HTTP health checks to two services (parallel execution)

### Output: What It Produces
- Telegram alert message to CTO chat (on outage)
- Email alert to CTO (on outage)
- `notifications` entry with `type='service_outage'` and `read=false` (on outage)
- `notifications` entry with `type='health_check'` and `read=true` (on healthy)

### Nodes

| Node | Type | Description |
|------|------|-------------|
| Every 5 Minutes | scheduleTrigger | Cron trigger every 5 minutes |
| GET Uptime Kuma Status | httpRequest | GET Uptime Kuma status page at http://uptime-kuma-pi4:3001 via Tailscale |
| GET Backend Health (Zone 2) | httpRequest | GET BACKEND_URL/health endpoint |
| Merge Health Results | merge | Combines parallel health check results into single item |
| Evaluate Health Status | set | Extracts: uptime_kuma_ok, backend_ok, status codes, monitor list, check_timestamp |
| Detect Service Outages | set | Computes: any_service_down boolean, down_services array |
| Any Service Down? | if | Routes to alert path (true) or healthy log path (false) |
| Telegram Alert to CTO | httpRequest | POST to Telegram Bot API to send alert message |
| Email Alert to CTO | httpRequest | POST to email alert webhook |
| Log Outage to Supabase | supabase (create) | Inserts notifications record for outage |
| Log Healthy Status to Supabase | supabase (create) | Inserts notifications record (read=true) for healthy check |

### Dependencies

**Supabase Tables:**
- `notifications` (write): `type`, `title`, `message`, `read`

**External Services:**
- Uptime Kuma (Zone 3 / Raspberry Pi 4) via Tailscale — `http://uptime-kuma-pi4:3001`
- Zone 2 Backend (`BACKEND_URL`) — health endpoint
- Telegram Bot API (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CTO_CHAT_ID`)
- Alert email service (`ALERT_EMAIL_WEBHOOK_URL`, `CTO_EMAIL`)

### Error Handling
- Both health check nodes have `continueOnFail: true` — a failed HTTP request is treated as "service down" (which is correct: if the endpoint is unreachable, it IS down)
- `Telegram Alert to CTO` has `continueOnFail: true` — if Telegram is down, email alert still sends
- `Email Alert to CTO` has `continueOnFail: true` — if email fails, Supabase log still runs
- Note: `Log Outage to Supabase` may receive two items (from Telegram and Email nodes both connecting to it). This is by design — both alert confirmations flow into the log. Use `n8n-nodes-base.merge` with Wait mode if deduplication is needed.

---

## 6. workflow-customer-onboarding.json — Kunden-Onboarding

### Purpose / Business Trigger
Processes new customer registrations submitted via webhook. Creates or updates the Kunden record, sends a welcome email and optional SMS, creates an initial inquiry (Anfrage), and logs the onboarding event.

### Input: What Triggers It
- **Trigger type**: Webhook (HTTP POST)
- **Webhook path**: `/webhook/new-customer`
- **HTTP method**: POST
- **Expected payload**:
  ```json
  {
    "name": "Maria Musterfrau",        // REQUIRED
    "email": "maria@example.de",        // REQUIRED
    "user_id": "supabase-user-uuid",    // REQUIRED
    "phone": "+4917612345678",           // optional
    "address": "Musterstrasse 1",        // optional (also: adresse)
    "city": "Frankfurt",                 // optional (also: stadt)
    "zip": "60311",                      // optional (also: plz)
    "kategorie": "neukunde",             // optional, default: neukunde
    "notes": "Referred by partner"       // optional (also: notizen)
  }
  ```

### Output: What It Produces
- New `kunden` record created (or existing one updated if email matches)
- Welcome email sent via `send-email` Supabase Edge Function
- Welcome SMS sent via `send-sms` Supabase Edge Function (if phone present)
- Initial `anfragen` record with `leistungsart='Erstberatung'` and `status='neu'`
- `automation_log` entry with `action='customer.onboarded'`
- Webhook response:
  - Success: `{ "success": true, "customer_id": "KD-XXXXX-XXXX", "name": "...", "email": "...", "anfrage_created": true }`
  - Validation error: `{ "success": false, "error": "Validation failed: ...", "required_fields": [...] }` (HTTP 400)
  - Server error: `{ "success": false, "error": "Internal server error...", "customer_id": null }` (HTTP 500)

### Nodes

| Node | Type | Description |
|------|------|-------------|
| Webhook: New Customer | webhook | POST /webhook/new-customer, responseMode=responseNode |
| Validate Required Fields | if | Checks name, email, user_id are all non-empty |
| Prepare Customer Data | set | Normalizes fields, generates customer ID (KD-XXXXX-XXXX), handles EN/DE field names |
| Check Existing Kunden by Email | supabase (getAll) | Looks up existing kunden by email + user_id |
| Customer Already Exists? | if | Routes to UPDATE (true) or INSERT (false) |
| UPDATE kunden (existing) | supabase (update) | Updates name, telefon, adresse, stadt, plz, notizen, status='aktiv' |
| INSERT kunden (new) | supabase (create) | Creates new kunden record with all fields |
| Resolve Customer Record | set | Normalizes customer data from either UPDATE or INSERT path |
| Send Welcome Email (Edge Function) | httpRequest | POST to Supabase /functions/v1/send-email with HTML welcome email |
| Phone Number Present? | if | Routes to SMS send (true) or skips (false) |
| Send Welcome SMS (Edge Function) | httpRequest | POST to Supabase /functions/v1/send-sms with welcome SMS |
| INSERT anfragen (initial inquiry) | supabase (create) | Creates initial inquiry with leistungsart='Erstberatung' |
| INSERT automation_log (onboarding) | supabase (create) | Logs onboarding completion |
| Respond: Success | respondToWebhook | HTTP 200 success response |
| Respond: Validation Error (400) | respondToWebhook | HTTP 400 for missing required fields |
| INSERT automation_log (onboarding error) | supabase (create) | Logs processing errors |
| Respond: Server Error (500) | respondToWebhook | HTTP 500 for processing failures |

### Dependencies

**Supabase Tables:**
- `kunden` (read): lookup by email + user_id
- `kunden` (create/update): `id`, `user_id`, `name`, `email`, `telefon`, `adresse`, `stadt`, `plz`, `notizen`, `kategorie`, `status`
- `anfragen` (create): `id`, `user_id`, `kunde_name`, `kunde_email`, `kunde_telefon`, `leistungsart`, `beschreibung`, `status`
- `automation_log` (write): `action`, `target`, `metadata`

**Supabase Edge Functions:**
- `send-email` — sends welcome HTML email via Proton Mail relay
- `send-sms` — sends welcome SMS via Twilio

**Environment Variables Required:**
- `SUPABASE_PROJECT_REF` — to construct edge function URLs
- `SUPABASE_SERVICE_ROLE_KEY` — for edge function Authorization header
- `SUPABASE_ANON_KEY` — for edge function apikey header

### Error Handling
- Missing `name`, `email`, or `user_id` → HTTP 400 validation error, no DB writes
- `Send Welcome Email` has `continueOnFail: true` — email failure does not block anfragen creation
- `Send Welcome SMS` has `continueOnFail: true` — SMS failure does not block anfragen creation
- Duplicate customer (same email) handled gracefully: updates existing record instead of failing
- Error handler node logs failures to `automation_log` with `action='customer.onboarding_error'`
- Error handler node then returns HTTP 500 to caller

---

## Summary: Workflow Dependencies Matrix

| Workflow | Tables Read | Tables Written | External APIs |
|----------|-------------|----------------|---------------|
| workflow-dunning | rechnungen | rechnungen, automation_log | OpenAI, PDF service |
| workflow-communication | — | communication_log, automation_log | OpenAI, Google Calendar |
| workflow-finance-invoicing | — | dokumente, automation_log | Supabase Storage, OpenAI, Zone 2 backend |
| workflow-payment-matching | rechnungen | rechnungen, automation_log | GoCardless |
| workflow-backup-alert | — | notifications | Telegram, email service, Zone 2 backend |
| workflow-customer-onboarding | kunden | kunden, anfragen, automation_log | send-email edge fn, send-sms edge fn |

## Summary: Workflow Triggers

| Workflow | Trigger Type | Schedule / Path |
|----------|-------------|-----------------|
| workflow-dunning | Scheduled | Daily 08:00 Europe/Berlin |
| workflow-communication | Webhook | POST /webhook/communication-intake |
| workflow-finance-invoicing | Webhook (Storage) | POST /webhook/supabase-invoices-storage |
| workflow-payment-matching | Scheduled | Daily 07:00 Europe/Berlin |
| workflow-backup-alert | Scheduled | Every 5 minutes |
| workflow-customer-onboarding | Webhook | POST /webhook/new-customer |
