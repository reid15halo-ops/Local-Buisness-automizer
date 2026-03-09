# Marketing-Pakete: Vollautomatisierte 3-Monats-Kampagnen

**Stand: März 2026 · FreyAI Visions**

---

## Konzept

Du verkaufst **vorgefertigte Social-Media-Kampagnen** an Handwerker.
Der Kunde liefert einmal seine Daten (Logo, Fotos, Texte, USPs) — der Rest läuft vollautomatisch.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  ONBOARDING  │────▶│   TEMPLATE   │────▶│  SCHEDULING  │────▶│   POSTING    │
│  (1x manuell)│     │  GENERATION  │     │  (n8n Cron)  │     │  (API Push)  │
│              │     │  (Canva API) │     │              │     │              │
│ - Logo       │     │ - 36 Posts   │     │ - 1-3x/Woche │     │ - Instagram  │
│ - Fotos      │     │ - 12 Stories │     │ - Randomized │     │ - Facebook   │
│ - USPs       │     │ - 4 Reels    │     │ - Best-Time  │     │ - Google Biz │
│ - Farben     │     │   Covers     │     │   Posting    │     │ - LinkedIn   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
                                                          ┌────────────┤
                                                          ▼            ▼
                                                   ┌────────────┐ ┌────────────┐
                                                   │  ANALYTICS  │ │  REPOSTING │
                                                   │  (Monthly)  │ │  (Nach 3M) │
                                                   └────────────┘ └────────────┘
```

---

## Dein Aufwand pro Kunde: ~2 Stunden

| Schritt | Dauer | Was du tust |
|---------|-------|-------------|
| Onboarding-Call | 30 Min | Fragebogen durchgehen, Daten sammeln |
| Canva-Templates personalisieren | 45 Min | Logo/Farben in Master-Templates einfügen |
| Qualitätscheck | 30 Min | 52 Posts kurz durchscrollen, freigeben |
| n8n-Kampagne aktivieren | 15 Min | Kunde in DB anlegen, Workflow starten |
| **Gesamt** | **~2 Std** | **Danach: 0 Aufwand für 3 Monate** |

---

## Pakete & Preise

### Paket S — "Sichtbar werden" (990 EUR = 330 EUR/Monat)

- **36 Posts** (3x/Woche, 12 Wochen)
- 1 Plattform (Instagram ODER Facebook)
- 6 Content-Kategorien im Wechsel
- Automatisches Posting via n8n + Meta API
- Monatlicher Performance-Report (automatisch)
- **Nach 3 Monaten**: Reposting-Modus (Evergreen-Posts wiederholen)

### Paket M — "Lokal dominieren" (1.790 EUR = 597 EUR/Monat) — EMPFOHLEN

- **48 Posts** (4x/Woche, 12 Wochen)
- 2 Plattformen (Instagram + Facebook)
- 8 Content-Kategorien + 12 Stories
- Google Business Profil-Posts inklusive
- Hashtag-Strategie lokalisiert (Stadt/Region)
- Monatlicher Performance-Report (automatisch)
- **Nach 3 Monaten**: Reposting-Modus

### Paket L — "Premium-Präsenz" (2.990 EUR = 997 EUR/Monat)

- **48 Posts + 12 Stories + 4 Reel-Cover** (4x/Woche, 12 Wochen)
- 3 Plattformen (Instagram + Facebook + LinkedIn/Google)
- 10 Content-Kategorien + saisonale Specials
- 4 Reel-Storyboard-Vorlagen (Kunde filmt selbst, wir editieren)
- Lead-Capture Landing Page (1x)
- Wöchentlicher Performance-Report
- Priority-Support während Kampagne
- **Nach 3 Monaten**: Reposting-Modus

### Optional Add-Ons

| Add-On | Preis | Beschreibung |
|--------|-------|-------------|
| Zusätzliche Plattform | +290 EUR | LinkedIn, Pinterest, TikTok |
| Bezahlte Ads Management | +490 EUR/Monat | Meta Ads, 50-200 EUR Ad-Budget extra |
| Content-Refresh (nach 3M) | 790 EUR | 24 neue Posts statt Reposting |
| Reel-Produktion (4 Stück) | 890 EUR | Wir filmen + editieren vor Ort |

---

## Content-Kategorien (Template-Bibliothek)

Jede Kategorie hat 6-8 Canva-Master-Templates, die mit Kundendaten befüllt werden:

| # | Kategorie | Beispiel-Post | Ziel |
|---|-----------|--------------|------|
| 1 | **Vorher/Nachher** | Renovierungsprojekt mit Slider-Look | Trust + Wow-Effekt |
| 2 | **Team & Werkstatt** | "Das ist unser Meister Max" | Nahbarkeit |
| 3 | **Tipps & Tricks** | "3 Fehler bei der Badsanierung" | Expertise zeigen |
| 4 | **Kundenstimmen** | Zitat + Sternebewertung | Social Proof |
| 5 | **Saisonale Posts** | "Heizungscheck vor dem Winter" | Relevanz + Leads |
| 6 | **Behind the Scenes** | Werkstatt, Werkzeug, Material | Authentizität |
| 7 | **Angebote & Aktionen** | "10% auf Wartungsverträge im März" | Conversion |
| 8 | **Lokaler Bezug** | "Ihr Dachdecker in [Stadt]" | Local SEO |
| 9 | **Meilensteine** | "500 zufriedene Kunden" | Brand Building |
| 10 | **Wissen/Infografik** | "So funktioniert eine Wärmepumpe" | Reichweite |

---

## Technische Architektur

### Datenfluss

```
Onboarding Form (App)
       │
       ▼
┌─────────────────────┐
│ Supabase: marketing │
│ _campaigns          │──────┐
│ _templates          │      │
│ _posts              │      │
│ _analytics          │      │
└─────────────────────┘      │
       │                     │
       ▼                     ▼
┌──────────────┐    ┌──────────────────┐
│ Canva API    │    │ n8n Workflow:     │
│ (Template    │    │ social-media-    │
│  Generation) │    │ scheduler        │
└──────┬───────┘    └────────┬─────────┘
       │                     │
       ▼                     ▼
┌──────────────┐    ┌──────────────────┐
│ Supabase     │    │ Meta Graph API   │
│ Storage      │    │ Google Biz API   │
│ (Post Images)│    │ LinkedIn API     │
└──────────────┘    └──────────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │ Analytics        │
                    │ (Webhook-based)  │
                    └──────────────────┘
```

### Supabase-Tabellen

- `marketing_campaigns` — Kampagne pro Kunde (Status, Paket, Zeitraum)
- `marketing_templates` — Canva-Template-Referenzen + Metadaten
- `marketing_posts` — Einzelne Posts mit Zeitplan, Status, Plattform
- `marketing_analytics` — Engagement-Daten (Likes, Reach, Clicks)

### n8n-Workflows

1. **workflow-social-media-scheduler.json** — Täglicher Cron, postet fällige Posts
2. **workflow-social-media-analytics.json** — Wöchentlich, sammelt Engagement-Daten
3. **workflow-social-media-repost.json** — Prüft abgelaufene Kampagnen, aktiviert Reposting

### APIs & Integrationen

| Service | Zweck | Kosten |
|---------|-------|--------|
| Canva API (Connect) | Template-Generierung | Free (bis 50 Designs/Monat) |
| Meta Graph API | Instagram + Facebook Posting | Free |
| Google Business Profile API | Google Posts | Free |
| LinkedIn API | Unternehmensseiten-Posts | Free |

---

## Rollout-Roadmap

### Phase 1: Foundation (Woche 1-2)

- [ ] Supabase-Migration: Marketing-Tabellen erstellen
- [ ] `marketing-campaign-service.js` — CRUD + Statusmanagement
- [ ] Canva Master-Templates erstellen (10 Kategorien x 6 Templates = 60 Stück)
- [ ] Onboarding-Fragebogen in App integrieren

### Phase 2: Automation (Woche 3-4)

- [ ] n8n Workflow: `workflow-social-media-scheduler.json`
- [ ] Meta Graph API Integration (Instagram + Facebook)
- [ ] Google Business Profile API Integration
- [ ] Canva API Integration (Template-Klonen + Personalisierung)
- [ ] Post-Queue mit Retry-Logik

### Phase 3: Analytics & Reposting (Woche 5-6)

- [ ] n8n Workflow: `workflow-social-media-analytics.json`
- [ ] Automatischer Monatsreport (PDF per E-Mail)
- [ ] Reposting-Engine: Top-Performer identifizieren, recyclen
- [ ] Dashboard-Widget: Kampagnen-Übersicht im App

### Phase 4: Launch & Vertrieb (Woche 7-8)

- [ ] 3 Pilot-Kunden akquirieren (kostenlos/vergünstigt)
- [ ] Feedback einarbeiten
- [ ] Preisliste aktualisieren
- [ ] Landing Page für Marketing-Pakete
- [ ] Upsell-Automatisierung: E-Mail vor Kampagnen-Ende

---

## ROI-Kalkulation

### Dein Aufwand

| Position | Einmalig | Pro Kunde |
|----------|----------|-----------|
| 60 Canva Master-Templates | ~20 Std | 0 |
| n8n Workflows + API Setup | ~15 Std | 0 |
| Supabase + Service-Code | ~10 Std | 0 |
| **Pro Kunde Onboarding** | — | **~2 Std** |

### Markt-Kontext (Empirische Daten)

- Agenturpreise DE: 1.200-5.000 EUR/Monat (Agenturfinder, Shapefruit, Dreikon)
- Freelancer DE: 400-900 EUR/Monat
- Handwerker Marketing-Budget (GfK): ~500 EUR/Monat (Kleinstunternehmen)
- 43% der Handwerker nutzen bereits externe Dienstleister (Bitkom)
- Opportunitätskosten Meister: 60-90 EUR/Std x 15 Std/Mo = 900-1.350 EUR/Mo

### Einnahmen-Szenario (konservativ)

| Monat | Neue Kunden | Paket-Mix | Umsatz/Monat |
|-------|-------------|-----------|-------------|
| 1 | 3 (davon 2 Lockangebote) | 2x Schnupper (490) + 1x M (1.790) | 2.770 EUR |
| 2 | 3 | 1x S + 1x M + 1x L | 5.770 EUR |
| 3 | 4 | 2x S + 1x M + 1x L | 6.770 EUR |
| 4-6 | 4/Monat | Mix | ~7.000 EUR/Monat |
| **6 Monate Total** | **20 Kunden** | — | **~42.000 EUR** |

### Stundensatz

- 20 Kunden x 2 Std = 40 Std Arbeit
- 42.000 EUR / 40 Std = **~1.050 EUR/Std effektiv**
- Setup-Invest: ~45 Std (einmalig, amortisiert nach ~3 Kunden)

### Reposting = Passive Income

Nach 3 Monaten ohne Verlängerung: Posts wiederholen sich automatisch.
- Kein Aufwand für dich
- Kunde behält "lebendiges" Profil
- Upsell-Trigger: "Ihre Follower wachsen — neue Inhalte würden 3x mehr Engagement bringen"

---

## Upsell-Funnel (automatisiert)

```
Woche 10: E-Mail "Ihre Kampagne läuft super — hier sind die Zahlen"
    │
    ▼
Woche 11: E-Mail "Nur noch 1 Woche! Verlängern Sie mit 20% Rabatt"
    │
    ▼
Woche 12: E-Mail "Ihre Kampagne endet morgen. Wir wechseln in den Repost-Modus"
    │
    ├── Kunde verlängert ──▶ Neue 3-Monats-Kampagne (Fresh Content)
    │
    └── Kunde verlängert nicht ──▶ Reposting-Modus (Top 12 Posts rotieren)
                                          │
                                          ▼
                                   Monat 6: "Ihre Inhalte sind 3 Monate alt.
                                   Frische Posts = 3x mehr Reichweite"
```

---

*FreyAI Visions · Jonas Frey · info@freyai-visions.de*
