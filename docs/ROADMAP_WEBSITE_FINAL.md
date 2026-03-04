# ROADMAP: FreyAI Visions Website — Alles zum Laufen bringen

> Erstellt: 2026-03-03 | Basierend auf vollstandiger Codebase-Analyse
> Ziel: Die Internetseite so fertigstellen, dass wirklich ALLES funktioniert

---

## Aktueller Stand (Ist-Zustand)

### Was bereits existiert
- **30 Views** im index.html (Dashboard, Anfragen, Angebote, Auftraege, Rechnungen, Material, Bestellungen, Kalender, etc.)
- **94 Service-Module** in `js/services/`
- **18 UI-Komponenten** in `js/ui/`
- **938 Tests** — alle bestehen (24 Test-Dateien)
- **Supabase-Backend** (Auth, DB, Edge Functions)
- **FastAPI-Backend** (OCR, PII, GoBD)
- **PWA** mit Service Worker, Offline-Modus
- **i18n** (DE/EN, 402 Keys)
- **Security**: DOMPurify, CSP, Sanitize-Service, Auth-Gate

### Was NICHT funktioniert / unvollstaendig ist

| Problem | Schwere | Bereich |
|---------|---------|---------|
| 51 ESLint-Errors (keine Warnings) | Hoch | Code-Qualitaet |
| 322 ESLint-Warnings (unused vars, console.log) | Mittel | Code-Qualitaet |
| Supabase nicht konfiguriert = App laeuft nur mit IndexedDB/Demo | Hoch | Backend |
| E-Mail-Versand (Resend) nur mit VPS-Relay | Hoch | Kommunikation |
| SMS (Twilio/Sipgate) nicht konfiguriert | Mittel | Kommunikation |
| Stripe-Zahlung nicht live | Mittel | Billing |
| OCR/Bon-Scanner benoetigt Backend-Service | Mittel | Features |
| E-Rechnung (XRechnung/ZUGFeRD) Peppol-Submit = Placeholder | Mittel | Compliance |
| WhatsApp-Integration = nur UI, kein echtes API | Mittel | Kommunikation |
| Viele Services nutzen `localStorage` statt Supabase im Prod | Hoch | Datenpersistenz |
| Landing Page verweist auf Waitlist ohne funktionierendes Backend | Mittel | Marketing |
| Customer Portal (`customer-portal.html`) ungetestet | Mittel | Features |
| Field App Mobile UI ungetestet mit echten Daten | Mittel | Features |
| n8n-Workflows nur als JSON exportiert, nicht deployed | Mittel | Automation |
| VPS-Scripts (HA Monitor, Voice Bridge, Content Pipeline) ungetestet | Niedrig | Infrastruktur |

---

## ROADMAP: 6 Phasen

---

### PHASE 1: Code-Hygiene & Stabilitaet (Grundlage)
**Dauer-Schaetzung: 1 Sprint**
**Ziel: Saubere Codebasis ohne Errors**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 1.1 | **ESLint Errors fixen (51)** | `no-undef`, `no-redeclare`, fehlende Imports — alle 51 Errors beheben | KRITISCH |
| 1.2 | **ESLint Warnings aufraemen (322)** | Unused vars entfernen, `console.log` → `console.warn/error` oder entfernen | HOCH |
| 1.3 | **Dead Code entfernen** | Unbenutzte Variablen/Funktionen aus UI-Modulen entfernen | MITTEL |
| 1.4 | **Fehlende Error-Boundaries pruefen** | `error-boundary.js` in alle kritischen Pfade integrieren | MITTEL |
| 1.5 | **Test-Coverage erhoehen** | Fehlende Tests fuer: `email-automation-service`, `workflow-builder-service`, `field-app-service` | MITTEL |

**Abnahme-Kriterium:** `npm run lint` = 0 Errors, `npm test` = alle gruen

---

### PHASE 2: Backend & Datenpersistenz (das Herz)
**Dauer-Schaetzung: 2 Sprints**
**Ziel: Echte Daten statt nur Demo/localStorage**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 2.1 | **Supabase-Projekt konfigurieren** | `.env` erstellen, Supabase-URL + Keys setzen, `supabase-config.js` verifizieren | KRITISCH |
| 2.2 | **Datenbank-Schema deployen** | `config/supabase-schema.sql` + `migration-v2.sql` auf Supabase ausfuehren | KRITISCH |
| 2.3 | **Row-Level Security (RLS) aktivieren** | Alle Tabellen: `kunden`, `anfragen`, `angebote`, `auftraege`, `rechnungen` etc. | KRITISCH |
| 2.4 | **Auth-Flow End-to-End testen** | `auth.html` → Login → Redirect → `index.html` mit Session | KRITISCH |
| 2.5 | **Sync-Service validieren** | IndexedDB ↔ Supabase Sync bei Online/Offline-Wechsel testen | HOCH |
| 2.6 | **Edge Functions deployen** | Alle 13 Edge Functions: `ai-proxy`, `send-email`, `send-sms`, `stripe-webhook`, etc. | HOCH |
| 2.7 | **Demo-Modus vs. Live-Modus** | Klarer Switch: Demo-Daten nur wenn kein Supabase konfiguriert; sonst echte Daten | HOCH |

**Abnahme-Kriterium:** Neuer User kann sich registrieren, einloggen, Daten anlegen, abmelden, erneut einloggen → Daten sind da

---

### PHASE 3: Kern-Workflow End-to-End (das Geschaeft)
**Dauer-Schaetzung: 2 Sprints**
**Ziel: Der gesamte Handwerker-Workflow funktioniert lueckenlos**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 3.1 | **Anfrage → Angebot → Auftrag → Rechnung** | Kompletter Durchlauf mit echten Daten testen, jeden Uebergang pruefen | KRITISCH |
| 3.2 | **Rechnungsnummern-System** | `invoice-numbering-service.js` mit Supabase-Counter (keine Duplikate!) | KRITISCH |
| 3.3 | **PDF-Generierung testen** | Angebote + Rechnungen als PDF — Layout, Firmendaten, Positionen, Summen pruefen | KRITISCH |
| 3.4 | **Mahnwesen (Dunning) durchspielen** | Zahlungsfrist abgelaufen → Mahnung 1 → 2 → 3 mit korrekten Fristen | HOCH |
| 3.5 | **Buchhaltung/EUER pruefen** | Einnahmen/Ausgaben korrekt verbucht, DATEV-Export generieren und validieren | HOCH |
| 3.6 | **Material & Bestellwesen** | Lagerbestand → Reorder-Engine → Bestellung → Wareneingang → Bestandsupdate | HOCH |
| 3.7 | **Kalender & Termine** | Termin erstellen → ICS-Export → Kundenbezug → Erinnerung | MITTEL |
| 3.8 | **Aufmass-Tool** | Raummasse eingeben → Flaeche berechnen → In Angebot uebernehmen | MITTEL |
| 3.9 | **Zeiterfassung** | Start/Stop Timer → Stunden pro Auftrag → In Rechnung uebernehmen | MITTEL |

**Abnahme-Kriterium:** Ein Testfall "Neuer Handwerker-Auftrag" komplett von Anfrage bis Zahlungseingang durchspielbar

---

### PHASE 4: Kommunikation & Integrationen (die Verbindung)
**Dauer-Schaetzung: 2 Sprints**
**Ziel: E-Mail, SMS und externe Dienste funktionieren**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 4.1 | **VPS Email-Relay deployen** | `vps/email-relay/server.js` auf Hetzner VPS, Resend-Key konfigurieren | KRITISCH |
| 4.2 | **E-Mail-Versand testen** | Angebote per Mail, Rechnungen per Mail, Mahnungen per Mail | KRITISCH |
| 4.3 | **E-Mail-Templates pruefen** | `email-template-service.js` — alle Templates rendern mit echten Daten | HOCH |
| 4.4 | **SMS-Provider einrichten** | Twilio oder Sipgate konfigurieren, Terminerinnerung per SMS testen | MITTEL |
| 4.5 | **Gemini AI-Proxy konfigurieren** | Edge Function `ai-proxy` mit API-Key, Rate-Limiting pruefen | HOCH |
| 4.6 | **AI-Assistent testen** | Chatbot, AI-Textvorschlaege, Approval-Queue (95/5 Modell) | HOCH |
| 4.7 | **Stripe-Integration** | Checkout-Flow fuer Kundenportal-Zahlungen / Abonnements | MITTEL |
| 4.8 | **n8n-Workflows deployen** | 6 Workflow-JSONs importieren, Webhooks verbinden | MITTEL |
| 4.9 | **E-Rechnung (XRechnung)** | ZUGFeRD PDF-Generierung, Leitweg-ID Feld, EN 16931 Validierung | MITTEL |

**Abnahme-Kriterium:** Handwerker kann Rechnung per Mail verschicken, Kunde empfaengt sie, AI-Chatbot beantwortet Fragen

---

### PHASE 5: Frontend-Polish & UX (das Erlebnis)
**Dauer-Schaetzung: 1-2 Sprints**
**Ziel: Industrial Luxury Look & Feel, alles bedienbar**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 5.1 | **Corporate Design Audit** | Alle Views gegen Design-Tokens (core.css) pruefen — Farben, Abstande, Typografie | HOCH |
| 5.2 | **Mobile Responsive testen** | Jede der 30 Views auf Mobile (375px) testen und fixen | HOCH |
| 5.3 | **Light Mode vollstaendig pruefen** | Alle Komponenten in Light Mode — keine unlesbaren Texte, fehlende Kontraste | HOCH |
| 5.4 | **Accessibility (a11y)** | ARIA-Labels, Keyboard-Navigation, Focus-Management, Kontrast-Ratios | MITTEL |
| 5.5 | **Loading States** | Spinner/Skeleton fuer alle async-Operationen (DB-Laden, PDF-Generierung) | MITTEL |
| 5.6 | **Empty States** | Leere Listen: "Noch keine Anfragen" mit Handlungsaufforderung statt weisser Flaeche | MITTEL |
| 5.7 | **Toast/Notification-Konsistenz** | Alle Aktionen geben Feedback (Erfolg/Fehler), einheitliches Design | MITTEL |
| 5.8 | **Onboarding/Tutorial pruefen** | `onboarding-tutorial-service.js` — Durchlauf fuer neue User testen | MITTEL |
| 5.9 | **Setup-Wizard** | Ersteinrichtung (Firmenname, Steuernummer, etc.) — Wizard muss komplett durchlaufen | HOCH |
| 5.10 | **Boomer-Guide Modus** | Grosse Schrift, vereinfachte Navigation fuer aeltere Nutzer — testen | NIEDRIG |

**Abnahme-Kriterium:** Lighthouse Score >= 90 (Performance + Accessibility), keine visuellen Bugs auf Desktop + Mobile

---

### PHASE 6: Deployment & Go-Live (die Auslieferung)
**Dauer-Schaetzung: 1 Sprint**
**Ziel: Produktiv auf einem Server erreichbar**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 6.1 | **Hosting entscheiden** | Hostinger (deploy-hostinger/) vs. Hetzner VPS vs. Coolify | KRITISCH |
| 6.2 | **Domain konfigurieren** | freyaivisions.de — DNS, SSL-Zertifikat, HTTPS | KRITISCH |
| 6.3 | **Build-Pipeline** | `deploy.sh` testen, dist-Ordner generieren, Service Worker Cache-Bust | HOCH |
| 6.4 | **CSP-Headers setzen** | Content-Security-Policy fuer Prod-Domain, keine unsafe-inline noetig | HOCH |
| 6.5 | **Monitoring einrichten** | Error-Logging (client_errors Tabelle), Uptime-Check | MITTEL |
| 6.6 | **Backup-Strategie** | Supabase Auto-Backup + manueller JSON-Export Reminder | MITTEL |
| 6.7 | **Landing Page finalisieren** | Waitlist-Formular → Supabase `waitlist`-Tabelle, Bestaetigungs-Mail | HOCH |
| 6.8 | **Customer Portal publizieren** | `customer-portal.html` unter Sub-URL, Token-basierter Zugang | MITTEL |
| 6.9 | **Performance-Optimierung** | Lazy Loading verifizieren, Asset-Kompression, Cache-Headers | MITTEL |
| 6.10 | **Security-Abschluss-Audit** | Letzte Pruefung: kein API-Key im Frontend, kein XSS, DSGVO-konform | HOCH |

**Abnahme-Kriterium:** Website ist unter Domain erreichbar, Login funktioniert, kompletter Workflow nutzbar

---

## Abhaengigkeits-Graph

```
Phase 1 (Code-Hygiene)
    │
    ▼
Phase 2 (Backend)
    │
    ├──────────────┐
    ▼              ▼
Phase 3          Phase 4
(Workflow)       (Kommunikation)
    │              │
    └──────┬───────┘
           ▼
    Phase 5 (UX-Polish)
           │
           ▼
    Phase 6 (Go-Live)
```

**Phase 3 + 4 koennen parallel laufen**, da Workflow und Kommunikation unabhaengig sind.

---

## Quick-Wins (sofort machbar, grosser Effekt)

| Quick-Win | Aufwand | Effekt |
|-----------|---------|--------|
| ESLint `--fix` fuer 50 auto-fixable Errors | 5 Min | Sofort sauberer Code |
| Setup-Wizard End-to-End pruefen | 30 Min | Erster Eindruck bei neuen Usern |
| Demo-Daten-Qualitaet pruefen | 30 Min | Bessere Demo fuer Investoren/Kunden |
| Mobile Nav-Burger testen | 15 Min | Wichtigste UX-Verbesserung |
| PDF-Rechnung manuell generieren | 15 Min | Kernfeature validieren |

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|------------|
| Supabase Free-Tier Limits | Mittel | Auf Pro upgraden (25$/Monat) vor Go-Live |
| Resend Email-Limits | Niedrig | Eigenen SMTP einrichten als Fallback |
| Gemini API-Kosten | Mittel | Rate-Limiting bereits implementiert, Budget-Alarm setzen |
| Browser-Kompatibilitaet Safari | Mittel | Phase 5 Cross-Browser-Tests |
| DSGVO-Abmahnung | Niedrig | Fonts bereits lokal, kein Google Analytics, Impressum ergaenzen |
| IndexedDB voll (1GB Limit) | Niedrig | Cleanup-Routine + Cloud-Sync Push |

---

## Abgeschlossene Arbeiten (Code-Fixes)

### Phase 1: Code-Hygiene ✅
- 0 ESLint errors, 0 warnings
- DSGVO compliance, dead code removed

### Phase 2: Backend Infrastructure ✅ (Code-Fixes)
- Fixed: `supabase-config.js` loaded with `defer` (auth gate always showed offline)
- Fixed: `supabase-client.js` never loaded in HTML
- Fixed: Dual Supabase client instances (now delegates to singleton)
- Fixed: `onAuthStateChange` listener leak
- Fixed: `db-service.js` used English table names instead of German (kunden, rechnungen, etc.)
- Fixed: `supabase-db-service.js` referenced non-existent `emails` table
- Fixed: Sync queue cleared entirely even on partial failure (3 services)
- Added: `stripe_payments` table in schema
- Added: `setup-validation-service.js` for backend readiness checks

### Phase 3: Kern-Workflow ✅ (Code-Fixes)
- Fixed: `invoice-numbering-service.js` race condition (GoBD violation)
- Fixed: `dunning-service.js` calculated overdue from creation date instead of due date
- Fixed: `check-overdue` edge function same date calculation bug
- Fixed: `stripe-webhook` used wrong table names, broken `.catch()` chains
- Fixed: `process-inbound-email` adminSettings scope bug
- Fixed: `timetracking-service.js` overnight shifts calculated as 0 hours
- Fixed: `calendar-service.js` month view showed cancelled appointments
- Fixed: `booking-service.js` always created 'besichtigung' type
- Fixed: `bookkeeping-service.js` CSV import failed for amounts >= 1M
- Fixed: `pdf-service.js` hardcoded 19% MwSt (now dynamic + Kleinunternehmer)
- Fixed: PDF logo format detection (always assumed PNG, now detects JPEG/WEBP)
- Fixed: PDF missing kunde guard on generateRechnung/Angebot/Mahnung
- Fixed: Calendar UTC/local timezone shift in week view
- Fixed: Timetracking stale timer detection (>24h without clock-out)
- Fixed: DATEV export missing fiscal year header row
- Fixed: Field app signature isEmpty() always returned true

### Phase 4: Kommunikation & Integrationen ✅ (Code-Fixes)
- Fixed: `_getTaxRate()` unguarded in 19 files (ReferenceError if company-settings not loaded)
- Fixed: `create-checkout` and `create-portal-session` hardcoded `localhost:3000` fallback URLs
- Fixed: `process-inbound-email` all hardcoded 'FreyAI Visions' replaced with COMPANY_NAME env var
- Fixed: `process-inbound-email` hardcoded email replaced with COMPANY_INFO_EMAIL env var
- Fixed: `run-automation` and `run-webhook` webhook calls had no timeout (added 10s AbortController)
- Fixed: `email-template-service.js` missing optional chaining, localStorage corruption guard
- Fixed: `einvoice-service.js` localStorage parse without try-catch
- Fixed: `notification-service.js` missing deduplication (60s window)
- Fixed: `reorder-engine-service.js` localStorage parse without try-catch
- Fixed: `material-service.js` XLSX library existence check

### Remaining (Manual/Deployment Tasks)
- Phase 2: Supabase project setup, schema deployment, RLS activation, auth E2E testing
- Phase 4: VPS email relay deployment, SMS provider setup, Stripe live mode, n8n workflows
- Phase 5: Corporate design audit, mobile responsive testing, loading/empty states UI work
- Phase 6: Hosting, domain, SSL, build pipeline, monitoring, landing page, security audit

---

*Letzte Aktualisierung: 2026-03-04*
*Basierend auf: 938 Tests (alle gruen), 0 ESLint errors, 30 Views, 94 Services*
*Code-Fixes: 8 Commits auf branch claude/setup-smart-home-scenes-Qkj8g*
