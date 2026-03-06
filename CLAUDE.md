# FreyAI Visions -- Project Rules

## Product & Brand

- **Product**: AI-powered business suite for German craftsmen (Handwerker, 5-10 employees)
- **Brand**: "Industrial Luxury" (Rolex/Apple-Vibe). Dark mode, bold typography, minimalist industrial visuals
- **USP**: Premium custom-fit digital backbone (Setup: 3.5k-7.5k EUR + Retainer: 300-500 EUR/month)
- **Tone**: Direct, professional, visionary. Skip the fluff. Complete code blocks + concise explanations.

## Architecture

- **95/5 Pattern**: 95% async (n8n workflows) / 5% sync (FastAPI backend)
- **Frontend**: Vanilla JS (ES6+), HTML5, CSS3 -- offline-first PWA
- **Database**: Supabase (PostgreSQL + Edge Functions + Realtime)
- **VPS**: Hostinger KVM 4 (Ubuntu 24.04, Docker, 16 GB RAM)
- **Local LLMs**: Ollama on VPS (Mistral Small, Qwen3.5:9b)
- **Cloud LLMs**: Claude (Anthropic), Codex (OpenAI)
- **AI**: Google Gemini 2.0 Flash via server-side proxy (95/5 human-in-the-loop)

## Directory Layout

```
/
├── *.html                      App pages (index, auth, landing, booking, etc.)
├── css/                        Stylesheets (core, components, fonts, feature-specific)
├── js/
│   ├── services/               112 service modules
│   ├── modules/                14 feature/page modules
│   ├── ui/                     18 UI component modules
│   └── i18n/                   Translations (DE/EN, 402 keys)
├── fonts/, icons/, img/        Static assets
├── manifest.json               PWA manifest
├── service-worker.js           Service Worker v21
│
├── backend/                    FastAPI Python service (OCR, PII, guardrails)
├── supabase/
│   ├── functions/              13 Edge Functions (Deno/TypeScript)
│   └── migrations/             SQL migrations
│
├── config/
│   ├── app-config.js           App configuration
│   ├── sql/                    Schema + migration SQL files
│   └── n8n-workflows/          n8n workflow JSON exports
│
├── deploy/
│   ├── hostinger/              Hostinger static site deploy package
│   └── scripts/                Deploy & build scripts
│
├── infrastructure/
│   ├── vps/                    VPS services (email-relay, postiz, scripts, skills)
│   ├── hetzner/                Hetzner IaC configs
│   ├── zone3/                  Zone3 rack scripts
│   └── raspberry-pi/           Pi setup & auto-install
│
├── tools/                      PDF generator, batch scripts, sample data
├── tests/                      JS unit tests (vitest)
├── test-data/                  CSV test fixtures
│
├── docs/
│   ├── architecture/           Phase reports, feature plans, audits
│   ├── security/               Security reviews, CSP, VPS audit
│   ├── business/               Pricing, beta questionnaire, marketing
│   └── guides/                 Setup guides, UX patterns
│
├── .agent/                     Agent skill definitions
├── .skills/                    Custom skills (boomer-ux, question)
└── .github/workflows/          CI/CD (ci.yml, security.yml)
```

## Key Services

| File | Purpose |
|------|---------|
| `js/services/auth-service.js` | Supabase Auth wrapper |
| `js/services/security-service.js` | CSP, XSS, auth guards |
| `js/services/sanitize-service.js` | Input sanitization |
| `js/services/db-service.js` | IndexedDB + Supabase sync |
| `js/services/approval-queue-service.js` | 95/5 human-in-the-loop queue |
| `js/services/stripe-service.js` | Subscription billing |
| `js/services/datev-export-service.js` | DATEV CSV/ZIP export |
| `js/services/bookkeeping-service.js` | EUR bookkeeping |

## Database Tables (Supabase)

`waitlist`, `profiles`, `kunden`, `anfragen`, `angebote`, `auftraege`, `rechnungen`, `positionen`, `materialien`, `lager`, `bestellungen`, `termine`, `zahlungen`, `mahnungen`, `dokumente`, `email_log`, `sms_log`

Full schema: `config/sql/supabase-schema.sql`

## Design Tokens (css/core.css)

```css
--accent: #6366f1;    /* Indigo -- primary brand */
--bg-dark: #09090b;
--bg-card: #18181b;
--text: #fafafa;
--success: #22c55e;
--warning: #f59e0b;
--radius: 16px;
```

## Definition of Done (DoD) -- Morpheus Feedback Loop

When implementing features, follow the 4-agent workflow:

1. **Grounding Agent**: Research the issue/task thoroughly before coding
2. **Execution Agent**: Implement solution (Mistral Small for simple, Claude for complex)
3. **Evaluation Agent**: 4 parallel reviewers (2x Codex/GPT + 2x Claude) must all approve
4. **Finalizing Agent**: Git commit, update docs, deploy

If ANY reviewer flags an issue -> back to Execution Agent. Loop until all 4 approve.

## Coding Standards

- Vanilla JS (ES6+) for frontend, TypeScript for Edge Functions
- Python for backend (FastAPI)
- SQL migrations in supabase/migrations/
- n8n workflows exported as JSON in config/n8n-workflows/
- Always use RLS policies on new Supabase tables
- Self-hosted fonts only (DSGVO compliance, no CDN)

## Git Workflow

- Main branch: main
- Feature branches: feature/<name>
- Commit messages: conventional commits (feat:, fix:, chore:)
- Never push directly to main without review loop completion

## Environment Variables

See `.env.example` for all required keys:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (server-side only)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
