# Glossary — FreyAI Visions

## People
- **Jonas / reid15halo-ops**: Founder, FreyAI Visions. Steinmetz-Background.
- **OpenClaw / Cowork**: AI assistant (Claude). Jonas' name for the AI.

## Products & Services
- **FreyAI Visions**: AI business suite for German Handwerker
- **Marketing-Pakete**: S/M/L social media packages (990/1790/2990 EUR)
- **Morpheus Feedback Loop**: 4-agent review workflow (Grounding → Execution → Evaluation → Finalizing)

## Infrastructure
- **VPS**: 72.61.187.24 (Hostinger KVM 4, Ubuntu 24.04, 16GB RAM, Docker)
- **Postiz**: Self-hosted social media scheduler at social.freyaivisions.de
- **NAS**: UGREEN at 192.168.178.75:9999 (local network only)
- **Supabase**: PostgreSQL + Edge Functions + Realtime + Storage

## Platforms & Tools
- **n8n**: Workflow automation (95% of business logic)
- **FastAPI**: Python backend (5% sync operations)
- **Ollama**: Local LLMs on VPS (Mistral Small, Qwen3.5:9b)
- **Canva Pro**: Design tool, API via canva-proxy Edge Function
- **Postiz API**: Session-cookie auth, minified JSON keys (i=id, c=content, d=date, s=status, n=integration)

## German Terms
- **Handwerker**: Craftsmen/tradespeople
- **Zettelwirtschaft**: Paper chaos / manual paperwork
- **Angebot**: Quote/offer
- **Auftrag**: Order/job
- **Rechnung**: Invoice
- **Mahnung**: Payment reminder
- **DATEV**: German accounting software standard
- **DSGVO**: German GDPR
- **Meister**: Master craftsman
- **Azubi**: Apprentice
- **Gewerk**: Trade/craft discipline

## Brand
- **Industrial Luxury**: Rolex/Apple aesthetic — dark mode, bold typography
- **Colors**: Teal #00BCB4, Dark Navy #0a1628, Indigo #6366f1, Accent Blue #2563eb
- **Logo**: Freya goddess in celtic octagon (teal/cyan)
- **Tone**: Direct, professional, visionary. No fluff.
