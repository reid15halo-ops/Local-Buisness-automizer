# FreyAI Visions — Codebase Overview

> AI context file. Read this before exploring the repo to avoid redundant file traversal.

## Project Purpose

AI-powered business automation suite for German craftspeople (Handwerker). Covers the full workflow: Anfragen → Angebote → Aufträge → Rechnungen, plus bookkeeping, inventory, communication, and AI automation. Offline-first PWA, German-language UI, GDPR-compliant.

- **Version:** 3.0 (production-ready)
- **Language:** German (DE primary, EN available)
- **Stack:** Vanilla JS + HTML/CSS frontend, Supabase backend, FastAPI image processing, n8n automation
- **AI:** Google Gemini 2.0 Flash via server-side proxy (95/5 human-in-the-loop model)

---

## Directory Layout

```
/
├── index.html                  Main application UI (158 KB)
├── auth.html                   Login / registration
├── landing.html                Marketing landing page
├── booking.html                Public online booking widget
├── offline.html                Service worker offline fallback
├── setup-credentials.html      First-run credential setup
├── test-invoice-system.html    Invoice numbering test harness
├── fragebogen-beta-v1.html     Beta tester questionnaire (HTML form)
│
├── css/
│   ├── core.css                Base styles & design tokens
│   ├── components.css          All UI components (139 KB)
│   ├── fonts.css               Self-hosted Inter font (GDPR-safe, no CDN)
│   ├── admin-panel.css
│   ├── agent-workflows.css
│   ├── boomer-guide.css        Elderly-friendly UX styles
│   ├── field-app.css           Mobile field-work UI
│   ├── purchase-orders.css
│   └── reorder-engine.css
│
├── js/
│   ├── app.js / app-new.js     Application bootstrap & router
│   ├── services/               94 service modules (see list below)
│   ├── modules/                14 feature/page modules
│   ├── ui/                     18 UI component modules
│   └── i18n/                   de.js, en.js, i18n-ui.js (402 keys)
│
├── config/
│   ├── supabase-schema.sql     Full DB schema (primary reference)
│   ├── migration-v2.sql        v2 migration
│   └── n8n-workflow.json       n8n master workflow
│
├── supabase/
│   ├── functions/              13 Edge Functions (Deno/TypeScript)
│   │   ├── ai-proxy/           Gemini API proxy with guardrails
│   │   ├── send-email/         Resend integration
│   │   ├── send-sms/           Twilio integration
│   │   ├── stripe-webhook/
│   │   ├── create-checkout/
│   │   ├── check-overdue/      Invoice aging cron
│   │   ├── run-automation/
│   │   └── process-inbound-email/
│   └── migrations/
│       └── 001_initial_schema.sql
│
├── services/backend/           FastAPI Python service
│   ├── main.py                 API routes
│   ├── image_processor.py      OCR / document handling
│   ├── pii_sanitizer.py        GDPR PII scrubbing
│   ├── math_guardrail.py       Numeric validation
│   └── models.py
│
├── docs/                       21 markdown docs
│   ├── BETA_FRAGEBOGEN_V1.md   Source content for the beta questionnaire
│   ├── PHASE1–4_COMPLETE_REPORT.md  Phase completion reports
│   └── *.md                    Architecture, security, UX notes
│
├── infrastructure/             Hetzner + Zone3 rack IaC configs
├── vps/email-relay/            Self-hosted email relay
├── tools/                      PDF generator, batch scripts, sample data
├── tests/                      JS unit tests
└── .github/workflows/          ci.yml, security.yml
```

---

## Key JS Modules

### services/ (selected important ones)

| File | Purpose |
|------|---------|
| `auth-service.js` | Supabase Auth wrapper |
| `security-service.js` | CSP, XSS, auth guards |
| `sanitize-service.js` | Input sanitization (all user fields) |
| `customer-service.js` | Kunden CRUD |
| `invoice-service.js` | Rechnungen logic + numbering |
| `db-service.js` | IndexedDB + Supabase sync layer |
| `calendar-service.js` | Appointments + ICS export |
| `gemini-service.js` | AI calls (via ai-proxy edge function) |
| `ai-assistant-service.js` | AI text suggestions with human override |
| `ocr-scanner-service.js` | Tesseract.js receipt scan |
| `bon-scanner-service.js` | Bon / receipt parsing |
| `chatbot-service.js` | In-app AI assistant |
| `email-service.js` | Outbound email (Resend) |
| `sms-reminder-service.js` | SMS (Twilio) |
| `dunning-service.js` | Payment reminders / Mahnwesen |
| `datev-export-service.js` | DATEV CSV/ZIP export |
| `stripe-service.js` | Subscription billing |
| `aufmass-service.js` | Job-site measurement tracking |
| `reorder-engine-service.js` | Inventory auto-reorder |
| `purchase-order-service.js` | Bestellwesen |
| `bookkeeping-service.js` | EÜR bookkeeping |
| `approval-queue-service.js` | 95/5 human-in-the-loop queue |
| `work-estimation-service.js` | Job cost / time estimation |
| `webhook-service.js` | Outbound webhooks |
| `supabase-client.js` | Supabase JS client singleton |

### modules/ (page-level)

`anfragen.js`, `angebote.js`, `auftraege.js`, `rechnungen.js`, `dashboard.js`, `activity.js`, `wareneingang.js` + 7 more.

### ui/ (component modules)

`admin-panel-ui.js`, `agent-workflow-ui.js`, `field-app-ui.js`, `setup-wizard-ui.js`, `boomer-guide-ui.js` + 13 more.

---

## Database Tables (Supabase / Postgres)

`waitlist`, `profiles`, `kunden`, `anfragen`, `angebote`, `aufträge`, `rechnungen`, `positionen`, `materialien`, `lager`, `bestellungen`, `termine`, `zahlungen`, `mahnungen`, `dokumente`, `email_log`, `sms_log`

Full schema: `config/supabase-schema.sql`

---

## Design Tokens (css/core.css)

```css
--accent: #6366f1          /* Indigo — primary brand colour */
--bg-dark: #09090b
--bg-card: #18181b
--text: #fafafa
--text-secondary: #a1a1aa
--border: #27272a
--success: #22c55e
--warning: #f59e0b
--radius: 16px
```

---

## Architecture Notes

- **Offline-first:** Service Worker v8 + IndexedDB (1 GB local). All data syncs to Supabase when online.
- **95/5 AI model:** AI generates drafts, humans approve. See `approval-queue-service.js`.
- **Security:** All user input passes through `sanitize-service.js`. CSP headers in `.htaccess` and `netlify.toml`. Row-level security on all Supabase tables.
- **i18n:** All UI strings are keys resolved by `js/i18n/de.js` or `en.js` via `i18n-ui.js`.
- **No external font CDN:** Fonts are self-hosted in `css/fonts.css` for DSGVO compliance.
- **PWA:** `manifest.json` + service worker. Installable on desktop and mobile.

---

## Environment Variables

See `.env.example` for all required keys:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (server-side only, never exposed to client)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`

---

## Deployment

| Target | Config |
|--------|--------|
| Netlify (primary) | `netlify.toml` |
| Raspberry Pi kiosk | `raspberry-pi-auto-install.sh` |
| Hetzner VPS | `infrastructure/hetzner/` |
| Zone 3 rack | `infrastructure/zone3/` |
| Docker (backend) | `services/backend/Dockerfile` |

---

## Docs Quick Reference

| File | Content |
|------|---------|
| `docs/BETA_FRAGEBOGEN_V1.md` | Source for beta questionnaire |
| `docs/PHASE1–4_COMPLETE_REPORT.md` | What was built in each phase |
| `docs/MODE_SYSTEM_GUIDE.md` | Light/dark mode system |
| `docs/CONFIRMATION_DIALOGS.md` | UX patterns for destructive actions |
| `docs/HTML_STRUCTURE_REVIEW.md` | HTML architecture audit |
| `docs/FEATURE_BRAINSTORM.md` | Backlog / future ideas |
| `SECURITY.md` | Security implementation details |
| `.agent/SKILL.md` | Agent skill definitions |
| `.skills/boomer-ux/SKILL.md` | Elderly-friendly UX guidelines |

---

*Last updated: Feb 2026*
