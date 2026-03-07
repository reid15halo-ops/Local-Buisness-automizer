# ROADMAP: FreyAI Visions — Komplette Produktstrategie

> Erstellt: 2026-03-03 | Erweitert: 2026-03-06 | Morpheus-Audit abgeschlossen
> Status: Gewerbe angemeldet (01.03.2026), App in Production + Staging

---

## Aktueller Stand (06.03.2026)

### Infrastruktur (LIVE)
- **Production**: https://app.freyaivisions.de (Hetzner VPS)
- **Staging**: https://staging.freyaivisions.de
- **Domains**: freyaivisions.de + freyavision.de (Hostinger)
- **Email**: 5 Accounts @freyaivisions.de (Dovecot/Postfix)
- **Containers**: Paperless-ngx, Postiz, n8n, Temporal, Email-Relay, Voice-STT
- **Supabase**: incbhhaiiayohrjqevog.supabase.co (Prod)
- **Deploy**: `./deploy.sh staging|production|both`

### Codebase
- **112 Service-Module** in `js/services/`
- **23 UI-Komponenten** in `js/ui/`
- **15 Feature-Module** in `js/modules/`
- **Service Worker v21** mit 112 gecachten Assets
- **PWA** mit Offline-First, IndexedDB + Supabase Sync
- **i18n** DE/EN (402 Keys)
- **Morpheus Feedback Loop** als Standard-QA-Prozess

### Morpheus-Audit Ergebnis (06.03.2026)
- **Runde 1**: 42 Bugs gefunden (10 KRITISCH), alle gefixt
- **Runde 2**: 3 Regressionen gefunden, Hotfix angewendet
- **Endscore**: 7.6/10 (von 5.4/10)
- **Security**: PBKDF2 Passwort-Hashing, XSS-Escaping komplett, CSP bereinigt
- **Compliance**: Kleinunternehmerregelung, Leistungsdatum, Einheit in Rechnungen

---

## ABGESCHLOSSENE PHASEN

### Phase 1: Code-Hygiene & Stabilitaet -- ERLEDIGT
- 0 ESLint Errors, 0 Warnings
- DSGVO Compliance (lokale Fonts, kein Google Analytics)
- Dead Code entfernt
- Error-Boundaries integriert

### Phase 2: Backend & Datenpersistenz -- ERLEDIGT (Code-Fixes)
- Supabase-Client Singleton, Auth-Gate, Event-Listener-Leak gefixt
- DB-Service deutsche Tabellennamen (kunden, rechnungen, etc.)
- Sync-Queue Key-Mismatch behoben
- setup-validation-service.js hinzugefuegt

### Phase 3: Kern-Workflow -- ERLEDIGT (Code-Fixes)
- Invoice-Numbering Race Condition (GoBD) gefixt
- Dunning-Service Faelligkeitsdatum statt Erstelldatum
- PDF-Generation: Dynamische MwSt, Kleinunternehmer, Logo-Format-Erkennung
- Zeiterfassung: Nachtschicht, Stale-Timer-Erkennung
- DATEV-Export: Fiscal Year Header
- Bookkeeping: CSV-Import >= 1M, dynamische Steuerrate
- Cashflow-Service: korrekte EUeR-Felder

### Phase 4: Kommunikation & Integrationen -- ERLEDIGT (Code-Fixes)
- `_getTaxRate()` Absicherung in 19 Dateien
- Email-Template-Service: Optional Chaining, localStorage-Guard
- Notification-Service: Deduplizierung (60s Fenster)
- E-Rechnung: localStorage try-catch
- n8n-Workflows: Error-Handler verbunden, Backup-Cron optimiert

### Phase 5: UX & Robustheit -- ERLEDIGT (Code-Fixes)
- 143 `JSON.parse(localStorage.getItem(...))` Calls abgesichert (59 Dateien)
- XSS-Escaping in allen UI-Modulen (setup-wizard, excel-import, purchase-order, reorder-engine, etc.)
- Division-by-Zero in profitability, dashboard-charts, bon-scanner, approval
- showToast-Konsistenz (window.showToast statt this.showToast)

### Morpheus Security-Hardening -- ERLEDIGT
- PBKDF2 (100k Iterationen) statt SHA-256 fuer Admin + PIN Hashing
- API-Key-Exposure in Gemini/LLM Service verhindert
- Retry-Counter capped (max 20)
- setInterval-Referenzen gespeichert (kein Leak)
- VPS nginx CSP: Single Source of Truth (nur meta-Tag)

---

## NEUE PHASE: OpenClaw Automation (07.03.2026) -- ERLEDIGT

### Alle 12 Features implementiert und auf VPS deployed:

| # | Feature | Script | Cron | Status |
|---|---------|--------|------|--------|
| 1 | Telegram Command Center | telegram_bot.py | Daemon | LIVE |
| 2 | n8n Webhook Bridge | webhook-event-service.js + n8n Workflow | Event-basiert | LIVE |
| 3 | Cron Health Monitor | cron_health.py | */15 Min | LIVE |
| 4 | Backup Rotation | backup_rotation.py | Taeglich 04:00 | LIVE |
| 5 | Bookkeeping Sync | bookkeeping_sync.py | */30 Min | LIVE |
| 6 | KI Cashflow-Prognose | cashflow_forecast.py | Woechentlich Mo 09:00 | LIVE |
| 7 | Email KI-Autoresponder | email_autoresponder.py | */15 Min | LIVE |
| 8 | Invoice Notification | invoice_notification.py | PAUSIERT (Verifizierung) | PAUSIERT |
| 9 | Lead Responder (erweitert) | lead_responder.py | */15 Min | LIVE |
| 10 | Voice-to-Action Bridge | voice_bridge.py | Via Telegram Bot | LIVE |
| 11 | Paperless Invoice Bridge | paperless_invoice_bridge.py | */15 Min | LIVE |
| 12 | Cashflow Dashboard Widget | index.html + CSS | Frontend | LIVE |

### Telegram Bot Commands (LIVE):
/status, /errors, /backup, /smoke, /help, /logs, /disk, /services,
/tickets, /ticket, /rechnungen, /umsatz, /pos, /deploy, /health, /stats, /crons
+ Voice Messages mit Gemini Intent Recognition

### Infrastruktur-Verbesserungen:
- Supabase-first Migration: Bookkeeping + PO Services
- n8n Workflow 100: Upsert (merge-duplicates) statt Insert
- Ticket-System: Spam-Filter, Dedup (subject+sender), message_id Index
- Inbox Sync: resolution=ignore-duplicates
- SSL Check: Certbot Timeout (120s)
- Unique Index auf inbound_emails.message_id

---

## OFFENE PHASEN

---

### PHASE 6: Deployment & Go-Live Finalisierung
**Ziel: Production 100% betriebsbereit fuer erste Kunden**
**Status: Teilweise erledigt (Hosting + Domain live)**

| # | Aufgabe | Status | Prioritaet |
|---|---------|--------|------------|
| 6.1 | Domain + SSL + Hosting | ERLEDIGT | -- |
| 6.2 | Staging-Umgebung | ERLEDIGT | -- |
| 6.3 | Email-System (Dovecot/Postfix) | ERLEDIGT | -- |
| 6.4 | Deploy-Script (staging/production/both) | ERLEDIGT | -- |
| 6.5 | **Supabase Schema + RLS auf Prod deployen** | OFFEN | KRITISCH |
| 6.6 | **Auth-Flow E2E testen** (Register → Login → Session) | OFFEN | KRITISCH |
| 6.7 | **Edge Functions deployen** (13 Stueck) | OFFEN | HOCH |
| 6.8 | **VPS Email-Relay mit Resend verbinden** | OFFEN | HOCH |
| 6.9 | **n8n-Workflows importieren + Webhooks verbinden** | OFFEN | HOCH |
| 6.10 | Monitoring: Error-Logging (client_errors Tabelle) | OFFEN | MITTEL |
| 6.11 | Backup-Strategie: Supabase Auto-Backup + JSON-Export | OFFEN | MITTEL |
| 6.12 | Landing Page: Waitlist → Supabase waitlist-Tabelle | OFFEN | MITTEL |
| 6.13 | Performance: Lighthouse >= 90, Cache-Headers pruefen | OFFEN | MITTEL |

**Abnahme**: Neuer User kann sich registrieren, Anfrage→Angebot→Rechnung durchlaufen, PDF generieren, per Mail versenden

---

### PHASE 7: Erster Kunde & Beta-Programm
**Ziel: 3-5 Beta-Kunden onboarden, echtes Feedback sammeln**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 7.1 | **Setup-Wizard E2E** | Firmenname, Steuernummer, Logo, Bankdaten → komplett durchlaufen | KRITISCH |
| 7.2 | **Onboarding-Tutorial** | onboarding-tutorial-service.js fuer neue User testen | HOCH |
| 7.3 | **Demo-Modus vs. Live-Modus** | Klarer Switch: Demo nur ohne Supabase, sonst echte Daten | HOCH |
| 7.4 | **Beta-Fragebogen** | docs/business/BETA_FRAGEBOGEN_V1.md an erste Tester schicken | HOCH |
| 7.5 | **Ticket-System** | support_tickets + ticket_messages (Supabase) bereits live | ERLEDIGT |
| 7.6 | **Mobile Responsive** | Alle 30 Views auf 375px testen und fixen | HOCH |
| 7.7 | **Light Mode Audit** | Alle Komponenten in Light Mode pruefen (Kontrast, Lesbarkeit) | MITTEL |
| 7.8 | **Impressum + Datenschutz** | Rechtlich korrekte Seiten fuer freyaivisions.de | KRITISCH |
| 7.9 | **AGB fuer SaaS** | Allgemeine Geschaeftsbedingungen fuer Kunden | HOCH |
| 7.10 | **Preisliste finalisieren** | Setup 3.5-7.5k EUR + Retainer 300-500 EUR/Monat | MITTEL |

**Abnahme**: 3 Beta-Kunden nutzen die App aktiv, kein Datenverlust, positives Feedback

---

### PHASE 8: Kommunikations-Stack (Live)
**Ziel: E-Mail, SMS und WhatsApp funktionieren produktiv**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 8.1 | **E-Mail-Versand produktiv** | Angebote, Rechnungen, Mahnungen per Mail | KRITISCH |
| 8.2 | **E-Mail-Templates mit echten Daten** | email-template-service.js rendern + testen | HOCH |
| 8.3 | **Inbound-Email Processing** | process-inbound-email Edge Function + Relay | HOCH |
| 8.4 | **SMS-Terminerinnerungen** | Sipgate oder eigener Provider (KEIN Twilio-Abo) | MITTEL |
| 8.5 | **WhatsApp Business API** | 360dialog oder offizielle Cloud API | MITTEL |
| 8.6 | **Mahnwesen automatisiert** | Frist abgelaufen → Mahnung 1→2→3 per Mail | HOCH |
| 8.7 | **Kundenportal-Benachrichtigungen** | Status-Updates per Mail an Kunden | MITTEL |

**Abnahme**: Handwerker verschickt Rechnung per Mail, Kunde empfaengt sie, Mahnung geht automatisch

---

### PHASE 9: KI-Features & Automation
**Ziel: Gemini AI + n8n als produktive Werkzeuge**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 9.1 | **AI-Proxy Edge Function** | Gemini API-Key server-seitig, Rate-Limiting aktiv | HOCH |
| 9.2 | **AI-Chatbot testen** | Fachberatung, Angebotsvorschlaege, Materialempfehlung | HOCH |
| 9.3 | **Approval-Queue (95/5)** | AI macht 95% async, Mensch bestaetig 5% | HOCH |
| 9.4 | **Morpheus Feedback Loop in n8n** | workflow-feedback-loop.json produktiv deployen | MITTEL |
| 9.5 | **Morning Briefing Agent** | Taegliche Zusammenfassung: offene Auftraege, faellige Rechnungen, Termine | MITTEL |
| 9.6 | **Predictive Dunning** | AI schaetzt Zahlungswahrscheinlichkeit, passt Mahnton an | NIEDRIG |
| 9.7 | **Smart Scheduling** | AI schlaegt optimale Terminslots vor (Entfernung + Dauer) | NIEDRIG |

**Abnahme**: AI-Chatbot beantwortet Kundenfragen korrekt, Approval-Queue funktioniert, Morning Briefing laeuft

---

### PHASE 10: Compliance & Rechtssicherheit
**Ziel: Alles rechtlich wasserdicht fuer deutsche Kunden**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 10.1 | **E-Rechnung (XRechnung/ZUGFeRD)** | ZUGFeRD PDF/A-3, XRechnung XML, EN 16931 Validierung | KRITISCH |
| 10.2 | **GoBD-Konformitaet pruefen** | Unveraenderbarkeit, Nachvollziehbarkeit, Aufbewahrungsfrist | KRITISCH |
| 10.3 | **DATEV-Export validieren** | Export an echtem Steuerberater testen | HOCH |
| 10.4 | **Kleinunternehmerregelung** | §19 UStG komplett (Rechnungen, PDF, EUeR) | ERLEDIGT |
| 10.5 | **Leistungsdatum auf Rechnungen** | §14 UStG Pflichtfeld | ERLEDIGT |
| 10.6 | **DSGVO-Audit** | Datenschutzerklaerung, Loeschkonzept, Auskunftsrecht | HOCH |
| 10.7 | **Aufbewahrungsfristen** | 10 Jahre Rechnungen, 6 Jahre Geschaeftsbriefe | MITTEL |
| 10.8 | **Verfahrensdokumentation** | Fuer Finanzamt: wie werden Daten erfasst, gespeichert, gesichert | MITTEL |

**Abnahme**: Steuerberater bestaetigt DATEV-Import, E-Rechnung validiert gegen EN 16931, DSGVO-Checkliste komplett

---

### PHASE 11: Mobile Field App & UX
**Ziel: Handwerker nutzt die App taeglich auf der Baustelle**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 11.1 | **Field Mode** | Vereinfachte mobile Ansicht: Timer, Material, Foto, Unterschrift | HOCH |
| 11.2 | **Kamera-Integration** | Fotos pro Auftrag mit Auto-Tagging (Job-ID, Datum, GPS) | HOCH |
| 11.3 | **Voice-to-Note** | Web Speech API fuer Notizen auf der Baustelle | MITTEL |
| 11.4 | **Offline-Sync Konflikt-UI** | Diff-Ansicht bei Konflikten statt Last-Write-Wins | MITTEL |
| 11.5 | **GPS Check-In** | Automatischer Baustellen-Check-In per Standort | NIEDRIG |
| 11.6 | **Boomer-Guide Modus** | Grosse Schrift, vereinfachte Navigation | NIEDRIG |
| 11.7 | **Dashboard-Widgets** | Drag-and-Drop, benutzerdefinierte KPIs | MITTEL |
| 11.8 | **Accessibility (a11y)** | ARIA-Labels, Keyboard-Navigation, Kontrast-Ratios | MITTEL |

**Abnahme**: Handwerker loggt Zeit, macht Foto, holt Unterschrift — alles auf dem Handy, auch offline

---

### PHASE 12: Wachstum & Skalierung
**Ziel: Von Einzelunternehmer zu 5-10 Mitarbeiter**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 12.1 | **Multi-User / Rollen** | Meister (Admin), Geselle (Worker), Azubi, Subunternehmer | HOCH |
| 12.2 | **Team-Zeiterfassung** | Stunden pro Mitarbeiter pro Auftrag | HOCH |
| 12.3 | **Routenplanung** | Leaflet.js + OpenRouteService, Tagestouren optimieren | MITTEL |
| 12.4 | **Subunternehmer-Portal** | Eingeschraenkte Ansicht fuer externe Mitarbeiter | MITTEL |
| 12.5 | **Bautagebuch** | Tagesbericht: Wetter, Anwesende, Arbeit, Fotos, Unterschrift | MITTEL |
| 12.6 | **Wartungs-Vertraege** | Wiederkehrende Rechnungen, Wartungsintervalle, QR-Codes | MITTEL |
| 12.7 | **Azubi-Berichtsheft** | Auto-generiert aus Zeiterfassung, IHK/HWK Format | NIEDRIG |
| 12.8 | **Branchen-Templates** | SHK, Elektro, Maler, Dachdecker — spezifische Kalkulationen | NIEDRIG |

**Abnahme**: Team mit 3 Benutzern arbeitet gleichzeitig, Rollen greifen, Subunternehmer sieht nur seine Auftraege

---

### PHASE 13: Marketing & Kundengewinnung
**Ziel: FreyAI Visions als Marke etablieren, erste zahlende Kunden**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 13.1 | **Landing Page finalisieren** | freyaivisions.de: USP, Features, Preise, CTA | HOCH |
| 13.2 | **Google-Bewertungen automatisch** | Nach Auftragsabschluss: Review-Request per Mail/SMS | HOCH |
| 13.3 | **Social Media (Postiz)** | AI-generierte Posts aus abgeschlossenen Projekten | MITTEL |
| 13.4 | **Referral-Programm** | "Empfohlen von [Kunde]" Rabattcodes | MITTEL |
| 13.5 | **SEO fuer Handwerker-Keywords** | "Handwerker Software", "Rechnungsprogramm Kleinunternehmer" | MITTEL |
| 13.6 | **Bachgaubote Werbung** | Bereits geschaltet (06.03.2026) | ERLEDIGT |
| 13.7 | **LinkedIn/XING Praesenz** | Fachbeitraege ueber Digitalisierung im Handwerk | NIEDRIG |
| 13.8 | **Lokale Netzwerke** | Handwerkskammer, IHK Aschaffenburg, Gewerbeverein | NIEDRIG |

**Abnahme**: 10 Leads ueber Landing Page, 3 zahlende Kunden, positive Google-Bewertungen

---

### PHASE 14: Plattform & Integrationen
**Ziel: Oekosystem-Anbindung fuer Power-User**

| # | Aufgabe | Details | Prioritaet |
|---|---------|---------|------------|
| 14.1 | **Zapier/Make Integration** | Triggers + Actions publizieren | MITTEL |
| 14.2 | **ELSTER-Schnittstelle** | UStVA direkt ans Finanzamt (oder DATEV-Steuerberater-Workflow) | MITTEL |
| 14.3 | **Lieferanten-APIs** | Grosshandel-Preise abfragen, automatische Bestellungen | NIEDRIG |
| 14.4 | **Stripe Live-Modus** | Kundenzahlungen ueber Kundenportal | MITTEL |
| 14.5 | **Visual Workflow Builder** | No-Code Automatisierungen im Browser | NIEDRIG |
| 14.6 | **Webhook-API dokumentieren** | Oeffentliche API fuer Drittanbieter | NIEDRIG |
| 14.7 | **Paperless-ngx Integration** | Dokumente direkt aus App in Paperless archivieren | MITTEL |

**Abnahme**: Mindestens 2 externe Integrationen produktiv, API-Dokumentation veroeffentlicht

---

## Abhaengigkeits-Graph

```
Phase 6 (Go-Live Finalisierung)
    |
    v
Phase 7 (Beta-Programm)
    |
    +------------------+------------------+
    |                  |                  |
    v                  v                  v
Phase 8            Phase 9            Phase 10
(Kommunikation)    (KI/Automation)    (Compliance)
    |                  |                  |
    +--------+---------+--------+---------+
             |                  |
             v                  v
         Phase 11           Phase 12
         (Mobile/UX)        (Skalierung)
             |                  |
             +--------+---------+
                      |
                      v
               Phase 13 (Marketing)
                      |
                      v
               Phase 14 (Plattform)
```

**Phase 8 + 9 + 10 koennen parallel laufen.**
**Phase 11 + 12 koennen parallel laufen.**

---

## Naechste Schritte (Sofort)

| # | Aufgabe | Aufwand | Effekt |
|---|---------|---------|--------|
| 1 | Supabase Schema + RLS deployen | 1h | Echte Datenpersistenz |
| 2 | Auth-Flow E2E testen | 30min | Benutzer koennen sich registrieren |
| 3 | Impressum + Datenschutz erstellen | 1h | Rechtliche Absicherung |
| 4 | Setup-Wizard E2E testen | 30min | Erster Eindruck bei Beta-Kunden |
| 5 | Edge Functions deployen | 2h | AI-Proxy, Email, SMS funktionieren |
| 6 | Mobile Responsive Quick-Fix | 2h | Handwerker koennen mobil arbeiten |

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|------------|
| Supabase Free-Tier Limits | Mittel | Monitoring + rechtzeitig Pro-Upgrade |
| Erste Kunden finden | Hoch | Bachgaubote Werbung (laeuft), lokales Netzwerk |
| DSGVO-Abmahnung | Niedrig | Fonts lokal, kein Google Analytics, Impressum + DSE |
| E-Rechnung Pflicht 2028 | Sicher | Phase 10 priorisieren |
| Einzelkaempfer-Risiko | Mittel | Automatisierung maximieren, AI-Assistenten nutzen |
| Browser-Kompatibilitaet | Niedrig | Chrome/Firefox/Edge 90+ getestet |
| Konkurrenzdruck (Lexoffice etc.) | Mittel | USP: Custom-Fit, Branchen-spezifisch, AI-powered |

---

## Metriken & Ziele

| Metrik | Aktuell | Ziel Q2/2026 | Ziel Q4/2026 |
|--------|---------|--------------|--------------|
| Beta-Kunden | 0 | 5 | 15 |
| Zahlende Kunden | 0 | 2 | 8 |
| MRR (Monthly Recurring Revenue) | 0 EUR | 600 EUR | 3.000 EUR |
| Service-Module | 112 | 115 | 120 |
| Morpheus-Score | 7.6/10 | 8.5/10 | 9.0/10 |
| Lighthouse Score | ~90 | 95+ | 95+ |
| Uptime | -- | 99.5% | 99.9% |

---

## Morpheus Review 07.03.2026 — Ergebnisse

### VPS Scripts Review (10 Scripts)
| Script | Vor Fix | Nach Fix |
|---|---|---|
| telegram_bot.py | 5/10 | 7/10 |
| cron_health.py | 8/10 | 8/10 |
| backup_rotation.py | 8/10 | 8/10 |
| bookkeeping_sync.py | 5/10 | 8/10 |
| cashflow_forecast.py | 5/10 | 8/10 |
| email_autoresponder.py | 8/10 | 8/10 |
| invoice_notification.py | 5/10 | 7/10 |
| voice_bridge.py | 6/10 | 8/10 |
| paperless_invoice_bridge.py | 7/10 | 8/10 |
| lead_responder.py | 7/10 | 7/10 |
| **Gesamt** | **6.4/10** | **7.7/10** |

### App JS Review (6 Dateien)
| Datei | Score |
|---|---|
| webhook-event-service.js | 8/10 |
| invoice-service.js | 7/10 |
| purchase-order-service.js | 8/10 (nach Fix) |
| bookkeeping-service.js | 7/10 |
| voice-input-service.js | 8/10 |
| ocr-scanner-service.js | 7/10 (nach Fix) |

### Fixes angewendet:
- 5x hardcoded Secrets externalisiert (Gemini Key, Supabase Key, Token, Paperless Token)
- shell=True entfernt (telegram_bot.py)
- async/await Bugs in PO-Service gefixt
- OCR betrag/brutto + belegnummer Field Mismatch gefixt
- lead_responder: responded-on-failure Bug gefixt
- cashflow_forecast: Exception Handler hinzugefuegt

---

## Feature-Brainstorming Runde 2 (07.03.2026) — Priorisierte Naechste Schritte

### Sofort (Impact 5/5, Aufwand 1-2/5)
1. Impressum/Datenschutz-Generator aus Firmendaten
2. Angebots-PDF mit digitalem Annahme-Link
3. Zahlungserinnerung per Mail (1-Click aus Rechnungsansicht)
4. Dashboard KPI-Alerts (ueberfaellige Rechnungen, Cashflow-Warnung)
5. Schnell-Erfassung (Rechnung in 30 Sekunden)
6. Kundenstatus-Timeline (Anfrage → Bezahlt)

### Naechste Woche (Impact 4-5/5, Aufwand 3/5)
1. Wiederkehrende Rechnungen (Retainer/Abo-Verwaltung)
2. Kundenportal Self-Service (Angebote annehmen, Rechnungen sehen)
3. Projekt-Profitabilitaet Live-Tracker
4. Dokumenten-Vorlagen-System
5. E-Rechnung Validierung (ZUGFeRD/XRechnung)
6. Integrierter Kalender mit Auftragsverknuepfung
7. Belegerfassung per Kamera (Bon-to-Buchung)

### Grossprojekte (Impact 4-5/5, Aufwand 4-5/5)
1. Multi-Tenant mit Rollen
2. Vollstaendige Offline-First Sync Engine
3. ELSTER/DATEV Integration
4. Visual Workflow Builder

---

*Letzte Aktualisierung: 2026-03-07*
*Basierend auf: 113 Services, 24 UI-Komponenten, 15 Feature-Module*
*Morpheus-Audit VPS: 7.7/10 | App: 7.5/10 | 8 kritische Fixes angewendet*
*OpenClaw Phase: 12 Features deployed, 26 Cron Jobs aktiv*
*Gewerbe: FreyAI Visions, Nebenerwerb ab 01.03.2026, Gemeindekennzahl 09671122*
