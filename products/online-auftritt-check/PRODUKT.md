# Online-Auftritt-Check — Produktbeschreibung

---

## Auf einen Blick

| | |
|---|---|
| **Produktname** | Online-Auftritt-Check |
| **Interner Codename** | `auftritt-check` |
| **Zielgruppe** | Jeder Handwerksbetrieb / lokale Dienstleister |
| **Preis** | **Kostenlos** (Lead Magnet) |
| **Zweck** | E-Mail-Adresse einsammeln, Vertrauen aufbauen, zu paid Tools konvertieren |
| **Hauptversprechen** | In 60 Sekunden sehen, wie Ihr Betrieb online dasteht |

---

## 1. Das Konzept

Der Online-Auftritt-Check ist KEIN Produkt — er ist ein **Lead Magnet**.

Ziel:
1. Handwerker gibt Firmennamen + E-Mail ein
2. Bekommt eine Bewertung seiner Online-Präsenz
3. Sieht konkrete Schwächen (= Kaufmotivation)
4. Wird in E-Mail-Funnel geleitet → Review Booster, Morgenblick, Schnell-Angebot, Website

---

## 2. Was wird geprüft?

### Check-Bereiche (8 Kategorien)

| # | Bereich | Max. Punkte | Was wird geprüft |
|---|---|---|---|
| 1 | **Google-Präsenz** | 20 | Google Maps Eintrag vorhanden? Vollständig? Öffnungszeiten? |
| 2 | **Bewertungen** | 20 | Anzahl, Durchschnitt, Aktualität der Bewertungen |
| 3 | **Website** | 15 | Existiert eine Website? Mobil-optimiert? HTTPS? |
| 4 | **Kontaktdaten** | 10 | Telefon, E-Mail, Adresse auffindbar? |
| 5 | **Social Media** | 10 | Facebook, Instagram vorhanden? Aktiv? |
| 6 | **Auffindbarkeit** | 10 | Ranking für "[Gewerk] + [Stadt]" |
| 7 | **Vertrauenssignale** | 10 | Impressum, DSGVO, Handwerkskammer, Zertifikate |
| 8 | **Konkurrenz-Vergleich** | 5 | Wie steht der Betrieb im Vergleich zu Top 3 |
| | **GESAMT** | **100** | |

### Ergebnis-Kategorien

| Punkte | Bewertung | Farbe | Aussage |
|---|---|---|---|
| 80-100 | Exzellent | Grün | "Ihr Online-Auftritt ist top — kleine Feinheiten verbessern" |
| 60-79 | Gut | Gelb-Grün | "Solide Basis, aber ungenutztes Potenzial" |
| 40-59 | Ausbaufähig | Orange | "Sie verlieren wahrscheinlich Kunden an die Konkurrenz" |
| 20-39 | Kritisch | Rot | "Kunden finden Sie kaum online — dringendes Handeln nötig" |
| 0-19 | Nicht vorhanden | Dunkelrot | "Sie sind online praktisch unsichtbar" |

---

## 3. Der Report

Der Handwerker bekommt einen **visuellen Report** (HTML-Seite + optionale PDF-Version):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ONLINE-AUFTRITT-CHECK
  Muster Handwerk GmbH, München
  Erstellt am: 04. März 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  GESAMTPUNKTZAHL:  42 / 100
  Bewertung:        ■■■■□□□□□□  AUSBAUFÄHIG

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ Google-Präsenz           14/20   Eintrag vorhanden, aber unvollständig
  ⚠️ Bewertungen               8/20   Nur 12 Bewertungen (Konkurrenz: Ø 67)
  ❌ Website                   3/15   Keine eigene Website gefunden
  ✅ Kontaktdaten              8/10   Telefon + E-Mail auffindbar
  ❌ Social Media              0/10   Keine Profile gefunden
  ⚠️ Auffindbarkeit            5/10   Seite 2 bei Google Maps
  ⚠️ Vertrauenssignale         4/10   Kein Impressum online
  ❌ vs. Konkurrenz            0/5    Deutlich hinter Top 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  TOP 3 EMPFEHLUNGEN:

  1. 🔴 Website erstellen — Sie haben keine eigene
     Webseite. 87% der Kunden suchen online, bevor
     sie anrufen.
     → LÖSUNG: Website-Paket (€119/Monat)

  2. 🟡 Mehr Google-Bewertungen sammeln — Mit 12
     Bewertungen sind Sie weit unter dem Durchschnitt
     Ihrer Konkurrenz (67 Bewertungen).
     → LÖSUNG: Review Booster (€29/Monat)

  3. 🟡 Google-Profil vervollständigen — Fehlend:
     Öffnungszeiten, Fotos, Leistungsbeschreibung.
     → ANLEITUNG: Kostenlos in 15 Min. (Anleitung per E-Mail)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Kostenlose Beratung buchen:
  → freyai-visions.de/beratung

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 4. Features

### MVP (Version 1.0)
- [ ] Eingabe-Formular: Firmenname, Stadt, Gewerk, E-Mail
- [ ] Automatischer Check (simuliert / semi-automatisch)
- [ ] Visueller Report mit Punktesystem
- [ ] Konkrete Empfehlungen mit Links zu unseren Tools
- [ ] E-Mail mit Report an den Handwerker
- [ ] Lead-Erfassung in Datenbank (für E-Mail-Funnel)

### Version 2.0 (Später)
- [ ] Google Places API Integration (automatische Daten)
- [ ] Lighthouse/PageSpeed API für Website-Check
- [ ] Automatischer Konkurrenz-Vergleich
- [ ] PDF-Export des Reports
- [ ] "Teilen Sie Ihren Score" (virales Element)

### Hinweis zum MVP
In V1 wird der Check **semi-automatisch** durchgeführt:
- Einige Checks laufen automatisch (Website vorhanden? HTTPS? etc.)
- Andere werden manuell vom Admin ergänzt (Google-Bewertungen, Ranking)
- Der Handwerker bemerkt keinen Unterschied — der Report sieht identisch aus

---

## 5. Conversion-Strategie

```
Handwerker füllt Check aus
         │
         ▼
   Report wird angezeigt
   (mit Empfehlungen → unsere Tools)
         │
         ├──→ E-Mail 1 (sofort): Report + "Kostenlose Beratung buchen"
         ├──→ E-Mail 2 (Tag 3): "Ihre Konkurrenz hat 3x so viele Bewertungen"
         ├──→ E-Mail 3 (Tag 7): "So verbessern Sie Ihren Score kostenlos"
         ├──→ E-Mail 4 (Tag 14): Testimonial + Review Booster Angebot
         └──→ E-Mail 5 (Tag 21): "Nochmal testen? Score verbessert?"
```

Jede Empfehlung im Report verlinkt direkt auf das passende Tool.

---

## 6. Technische Umsetzung (MVP)

Minimal viable:
- **Frontend:** Einfaches Formular + Report-Anzeige (HTML/CSS/JS)
- **Backend:** Node.js Express — Daten speichern, E-Mail senden
- **Checks V1:** Einfache HTTP-Checks (Website erreichbar? HTTPS? robots.txt?)
- **Checks V2:** Google Places API, PageSpeed API

Der Report muss gut aussehen — das ist das Verkaufs-Tool.

---

## 7. Lead-Wert-Berechnung

```
Online-Auftritt-Checks pro Monat:       50
→ davon öffnen E-Mail 2:                35 (70%)
→ davon klicken auf Tool-Link:          10 (28%)
→ davon starten Gratis-Test:             5 (50%)
→ davon werden zahlende Kunden:          2 (40%)

Ø Kundenwert (12 Monate):              €29 × 12 = €348
2 neue Kunden × €348 =                 €696/Monat

Kosten pro Lead:                        ~€0 (organisch/Direktansprache)
CAC (Customer Acquisition Cost):        €0 — der Check IST die Akquise
```

---

*FreyAI Visions · Intern*
