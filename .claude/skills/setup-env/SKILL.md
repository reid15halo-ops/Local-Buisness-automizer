---
name: setup-env
description: Configure environment variables — generate .env files, document required vars, and validate existing configuration.
argument-hint: [action]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Grep, Glob, Bash
---

## Setup Environment

**Argument:** `$ARGUMENTS` — one of: `generate`, `validate`, `document`

### Actions

#### generate — Create .env files

Create `.env.example` in the project root with all required variables:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Backend
PORT=8000
ENVIRONMENT=development

# Frontend (stored in localStorage, not .env)
# freyai_supabase_url = SUPABASE_URL
# freyai_supabase_anon_key = SUPABASE_ANON_KEY

# Optional: Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Email (via Edge Functions)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Optional: AI
GEMINI_API_KEY=
```

#### validate — Check current config
- Scan for `.env` files and verify they're in `.gitignore`
- Check `backend/main.py` for `os.getenv()` calls without defaults
- Check `js/config/supabase-client.js` for placeholder values
- Report missing or placeholder variables

#### document — Generate env var docs
- Scan codebase for all env var references
- Output a markdown table of all variables, their purpose, and where they're used
