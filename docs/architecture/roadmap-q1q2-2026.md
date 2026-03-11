# FreyAI Visions — Implementation Roadmap Q1/Q2 2026

**Erstellt:** 11.03.2026
**Status:** Aktiv
**VPS:** 72.61.187.24 (16 GB RAM, 87 GB frei)

---

## Phase 1: Sofort (KW 11 — diese Woche)

### 1.1 Telegram-Spam fixen
**Status:** ✅ Erledigt (11.03.2026)
**Umgesetzt:**
- `QUIET_PATTERNS` erweitert um häufige Routine-Outputs
- `__CHANGED__` Modus mit MD5-Hash-basierter Dedup implementiert
- 3 Jobs von `__ALWAYS__` auf `__CHANGED__` umgestellt (system_dashboard, proposal_pipeline, akquise_check)
- `daily_visitor_report.py` — nur bei >0 Besuchern senden
- `backup_rotation.py` — nur bei Löschungen/Errors/Disk<15% senden
- 7 weitere Scripts geprüft: bereits korrekt event-basiert
**Aufwand:** 2-3h
**Impact:** Sofort spürbar

### 1.2 Gemini 3.1 Flash-Lite
**Status:** ✅ Bereits implementiert (alle 5 Dateien nutzen `gemini-3.1-flash-lite`)
**Aufwand:** 0h — fertig

### 1.3 n8n Update prüfen
**Status:** ✅ Läuft auf `latest` mit Watchtower Auto-Updates
**Aufwand:** 0h — fertig

---

## Phase 2: Kurzfristig (KW 12-13)

### 2.1 Moondream Vision Model auf VPS
**Status:** ✅ Erledigt (11.03.2026)
**Umgesetzt:**

- Moondream via Ollama deployed (1.7 GB, ~5s Inferenz auf CPU)
- FastAPI Endpoint: `POST /vision/analyze` (4 Modi: general, damage, invoice, construction)
- Telegram Bot: `/vision [mode]` → Foto senden → Moondream-Analyse
- 10 MB Image-Size-Limit, 120s Timeout, Morpheus-reviewed (8.5/10)
**Aufwand:** 3h
**Impact:** Hoch

### 2.2 Morpheus Code Review — Ollama-basiert

**Status:** ✅ Basis erledigt (11.03.2026)
**Umgesetzt:**

- `morpheus_review.py` deployed — konsolidierter 4-Perspektiven-Review via Mistral Small
- Telegram Bot: `/review` (Git diff) und `/review file <pfad>` (Datei)
- CLI: `python3 morpheus_review.py --diff` oder `--file <path>`

**Offen (Phase 2b):**

- Claude Agent SDK für echte Multi-Agent Reviews (braucht Anthropic API Key auf VPS)
- n8n Trigger: Bei neuem PR automatisch Review starten

**Aufwand:** Basis 2h (erledigt), Agent SDK 2-3 Tage (offen)
**Impact:** Hoch

---

## Phase 3: Mittelfristig (KW 14-17 / April)

### 3.1 RAGFlow — Semantische Dokumentensuche

**Status:** ✅ Deployed (11.03.2026)
**Umgesetzt:**

- RAGFlow v0.24.0 auf VPS deployed (Infinity-Engine statt Elasticsearch, ~4.5 GB RAM)
- Web UI: `http://rag.freyaivisions.de` (Port 8380, nginx Reverse Proxy)
- API: Port 9380
- Sichere Passwörter für MySQL, MinIO
- Docker Containers: ragflow-cpu, mysql, infinity, minio, redis

**Offen:**

- SSL-Zertifikat für `rag.freyaivisions.de` (certbot)
- Ollama als Embedding-Model konfigurieren
- Supabase-Daten indexieren (Angebote, Rechnungen, Kundenanfragen)
- PWA-Integration: Suchleiste mit semantischer Suche

**Aufwand:** Deploy 1h (erledigt), Integration 1 Woche (offen)
**Impact:** Hoch (Killer-Feature für Pilotphase)

### 3.2 MCP Server für FreyAI

**Status:** ✅ Basis deployed (11.03.2026)
**Umgesetzt:**

- MCP Server (`freyai_mcp.py`) auf VPS deployed mit 8 Tools:
  - `get_customers`, `get_customer_detail`, `search_invoices`, `get_quotes`
  - `get_tickets`, `get_schedule`, `get_revenue_summary`, `get_overdue_invoices`
- Supabase REST API als Backend
- Claude Code Integration via `.mcp.json` (SSH stdio transport)
- Python venv unter `/opt/freyai-mcp/`

**Offen:**

- Auth (aktuell Service Key, braucht User-Token-basierte Auth)
- Rate Limiting + Audit Log
- `create_quote` Tool (Angebote erstellen via MCP)

**Aufwand:** Basis 1h (erledigt), Auth+Rate Limiting 1-2 Wochen (offen)
**Impact:** Hoch (zukunftssicher, AI-native Schnittstelle)

---

## Phase 4: Supabase Vector Search (KW 18+ / Mai)

### 4.1 Vector Embeddings für Kundendaten
**Status:** Supabase Vector Buckets ist Public Alpha — warten auf Beta
**Ziel:** Embedding-basierte Ähnlichkeitssuche direkt in Supabase
**Migration:** RAGFlow → Supabase Vector (wenn stabil)
**Aufwand:** 1-2 Wochen (Migration)

---

## Nicht umsetzen

| Projekt | Grund |
|---|---|
| MiniMax M2.5 | DSGVO-inkompatibel (China-hosted, keine EU-Garantie) |
| Ollama lokal (Windows) | Keine GPU — nur Intel iGPU, zu langsam |
| OpenClaw als Produkt-Feature | Anderes Marktsegment (Consumer vs. B2B Handwerker) |

---

## VPS Ressourcen-Planung

| Service | RAM aktuell | Nach Roadmap |
|---|---|---|
| Bestehende Services | ~5.5 GB | ~5.5 GB |
| Moondream (Ollama) | — | +1 GB |
| RAGFlow | — | +2 GB |
| Claude Agent SDK | — | +0.5 GB |
| **Gesamt** | **5.5 GB** | **~9 GB** |
| **Verfügbar** | **10.5 GB** | **~7 GB** |

Passt auf den VPS (16 GB RAM). Swap von 8 GB als Puffer vorhanden.

---

*Roadmap erstellt am 11.03.2026 | FreyAI Visions*
