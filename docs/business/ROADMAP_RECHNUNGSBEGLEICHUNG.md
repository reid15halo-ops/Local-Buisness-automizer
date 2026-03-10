# FreyAI Visions — Roadmap Rechnungsbegleichung
**Stand: März 2026 · Owner: Jonas Frey**

---

## Vision

> Vom Rechnungsversand bis zum Zahlungseingang vergehen maximal 7 Tage.
> 95% aller Zahlungen werden automatisch erkannt und verbucht.
> Kein manuelles Nachfassen mehr — das System eskaliert selbständig.

---

## Ist-Zustand (März 2026)

| Bereich | Code | Produktiv | Problem |
|---------|:----:|:---------:|---------|
| Rechnungserstellung | ✅ | ✅ | Funktioniert, aber kein QR-Code, kein Payment-Link |
| Stripe Payment Links | ✅ | ❌ | Keys nicht konfiguriert, Webhook nicht aktiv |
| Mahnwesen (6 Stufen) | ✅ | ❌ | n8n Workflow existiert, nicht aktiviert |
| Bank-Auto-Matching | ✅ | ❌ | Demo-Modus — keine echte Bankanbindung |
| Finom Integration | ✅ | ❌ | Code da, keine Verbindung |
| Buchungs-Sync | ✅ | ✅ | Läuft (nach Dedup-Fix März 2026) |
| DATEV Export | ✅ | ⚠️ | Demo vorhanden, Produktiv-Feature noch offen |
| Cashflow-Forecast | ✅ | ❌ | Benötigt echte Bankdaten |

**Fazit:** Die Infrastruktur ist zu 80% gebaut, aber nur 20% davon läuft produktiv.

---

## Roadmap: 4 Phasen

---

### Phase 1: Quick Wins (Woche 1)
> **Ziel:** Jede Rechnung hat einen Bezahl-Link und QR-Code. Zahlungserinnerungen laufen automatisch.

#### 1.1 EPC-QR-Code auf Rechnungen
- **Was:** GiroCode (EPC QR) auf jede Rechnung drucken
- **Warum:** Kunde scannt → Bank-App öffnet vorausgefüllt → keine Tippfehler, 3x schnellere Überweisung
- **Wo:** `js/services/invoice-service.js` → PDF-Generierung erweitern
- **Daten im QR:** IBAN, BIC, Betrag, Verwendungszweck (Rechnungsnummer)
- **Aufwand:** 2h
- **Impact:** ⭐⭐⭐⭐⭐

#### 1.2 Skonto-Anreiz auf Rechnung
- **Was:** "2% Skonto bei Zahlung innerhalb 7 Tagen" auf jede Rechnung
- **Warum:** Handwerker-Kunden reagieren stark auf Skonti. Beschleunigt Zahlungseingang um ~14 Tage
- **Wo:** Rechnungstemplate + `invoice-service.js` (Skonto-Berechnung)
- **Aufwand:** 1h
- **Impact:** ⭐⭐⭐⭐

#### 1.3 Mahnwesen aktivieren (VPS)
- **Was:** n8n Dunning-Workflow auf VPS aktivieren + Email-Relay anbinden
- **Warum:** Automatische Eskalation ohne manuelles Nachfassen
- **Workflow:** `config/n8n-workflows/workflow-dunning.json`
- **Eskalation:** Erinnerung (Tag 7) → Mahnung 1 +5€ (Tag 14) → Mahnung 2 +10€ (Tag 28) → Mahnung 3 +15€ (Tag 42) → Inkasso (Tag 56)
- **Aufwand:** 30min (Workflow aktivieren, Resend-API-Key prüfen)
- **Impact:** ⭐⭐⭐⭐⭐

#### 1.4 Proaktive Zahlungserinnerung (3 Tage vor Fälligkeit)
- **Was:** Freundliche E-Mail 3 Tage vor Fälligkeitsdatum
- **Warum:** Verhindert Vergessen, reduziert Mahnquote um ~40%
- **Wo:** Neuer n8n Trigger im Dunning-Workflow
- **Aufwand:** 1h
- **Impact:** ⭐⭐⭐⭐

**Phase 1 Ergebnis:** Zahlungsfrist sinkt von Ø 28 Tage auf Ø 14 Tage.

---

### Phase 2: Online-Bezahlung (Woche 2-3)
> **Ziel:** Kunden können per Karte oder Sofortüberweisung bezahlen. Zahlung wird automatisch erkannt.

#### 2.1 Stripe Payment Links aktivieren
- **Was:** Stripe-Account verbinden, Payment Links auf jeder Rechnung
- **Wo:** `js/services/stripe-service.js` + `supabase/functions/check-overdue/`
- **Setup:**
  1. Stripe-Account verifizieren (bereits vorhanden?)
  2. `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in `.env`
  3. Webhook-Endpoint in Supabase Edge Function aktivieren
  4. "Jetzt bezahlen"-Button in Rechnungs-E-Mail
- **Gebühren:** 1.4% + 0.25€ pro Transaktion (Karte EU)
- **Aufwand:** 2-3h
- **Impact:** ⭐⭐⭐⭐⭐

#### 2.2 Stripe Webhook → Auto-Verbuchung
- **Was:** Bei Zahlungseingang via Stripe automatisch:
  1. Rechnung → Status `bezahlt`
  2. Buchung in `buchungen` erstellen (Umsatzerlöse)
  3. Bestätigungs-E-Mail an Kunden
  4. Telegram-Benachrichtigung an Jonas
- **Wo:** `supabase/functions/check-overdue/index.ts` (Stripe Webhook Handler)
- **Aufwand:** 2h
- **Impact:** ⭐⭐⭐⭐⭐

#### 2.3 PayPal als Fallback
- **Was:** PayPal.me-Link als Alternative auf Rechnung
- **Wo:** `js/services/payment-service.js` (bereits implementiert)
- **Aufwand:** 30min (Link generieren + auf Rechnung drucken)
- **Impact:** ⭐⭐⭐

#### 2.4 Anzahlungs-Workflow (Deposit)
- **Was:** Bei Aufträgen > 1.000€ automatisch 30% Anzahlung anfordern
- **Wo:** `js/services/payment-service.js` → `calculateDeposit()`
- **Flow:** Auftrag bestätigt → Anzahlungsrechnung → Payment Link → Nach Zahlung: Auftrag starten
- **Aufwand:** 2h
- **Impact:** ⭐⭐⭐⭐

**Phase 2 Ergebnis:** Kunden haben 3 Zahlungswege (Überweisung, Karte, PayPal). Kartenzahlungen werden sofort verbucht.

---

### Phase 3: Bank-Automatisierung (Woche 4-5)
> **Ziel:** Bankkonto wird täglich abgeglichen. Überweisungen werden automatisch zugeordnet.

#### 3.1 GoCardless/Nordigen Open Banking
- **Was:** Kostenloses Open-Banking-API für täglichen Transaktionsimport
- **Wo:** `js/services/banking-service.js` → von Demo auf Produktion umstellen
- **Setup:**
  1. GoCardless Bank Account Data (ehem. Nordigen) Account erstellen
  2. Geschäftskonto verbinden (PSD2-Consent)
  3. API-Keys in `.env`
  4. n8n Workflow: Täglicher Import um 07:00
- **Kosten:** Kostenlos bis 100 Requests/Tag (GoCardless Free Tier)
- **Aufwand:** 3-4h
- **Impact:** ⭐⭐⭐⭐⭐

#### 3.2 Auto-Matching Engine aktivieren
- **Was:** Eingehende Überweisungen automatisch gegen offene Rechnungen matchen
- **Wo:** `js/services/banking-service.js` → `autoMatchTransactions()`
- **Matching-Logik (bereits implementiert):**
  1. **Verwendungszweck** enthält Rechnungsnummer → Confidence 95%
  2. **Betrag + Kundenname** exakt → Confidence 85%
  3. **Betrag ±1%** (Bankgebühren) → Confidence 70%
- **Bei Match:** Rechnung → `bezahlt`, Buchung erstellen, Dunning stoppen
- **Aufwand:** 2h (Workflow + Matching-Schwellwerte kalibrieren)
- **Impact:** ⭐⭐⭐⭐⭐

#### 3.3 Unmatched-Transactions Dashboard
- **Was:** UI-Widget für nicht zugeordnete Zahlungseingänge
- **Warum:** 5% der Zahlungen werden nicht automatisch erkannt (fehlende Referenz, Teilzahlungen)
- **Wo:** Dashboard-Modul mit manueller Zuordnung per Drag & Drop
- **Aufwand:** 4h
- **Impact:** ⭐⭐⭐

#### 3.4 Finom SEPA-Integration (Optional)
- **Was:** Falls Geschäftskonto bei Finom → native API statt GoCardless
- **Wo:** `js/services/finom-service.js` + `config/sql/migration-finom-transactions.sql`
- **Bonus:** SEPA-XML für ausgehende Zahlungen (Lieferanten automatisch bezahlen)
- **Aufwand:** 3h
- **Impact:** ⭐⭐⭐⭐

**Phase 3 Ergebnis:** 90%+ der Überweisungen werden automatisch erkannt und verbucht. Manueller Aufwand: ~5 min/Tag.

---

### Phase 4: Intelligence & Optimierung (Woche 6-8)
> **Ziel:** Das System lernt, prognostiziert und optimiert selbständig.

#### 4.1 Cashflow-Forecast aktivieren
- **Was:** 6-Monats-Prognose basierend auf echten Bankdaten
- **Wo:** `js/services/cashflow-service.js` (Code vorhanden, benötigt echte Daten aus Phase 3)
- **Features:**
  - Monatsweise Einnahmen-/Ausgabenprognose
  - Warnung bei Liquiditätsengpass (< 5.000€ Buffer)
  - Berücksichtigung von Steuervorauszahlungen (Q1/Q2/Q3/Q4)
- **Aufwand:** 2h (Anbindung an echte Transaktionsdaten)
- **Impact:** ⭐⭐⭐⭐

#### 4.2 Zahlungsverhalten-Scoring pro Kunde
- **Was:** Jeder Kunde bekommt einen Payment-Score basierend auf historischem Zahlungsverhalten
- **Logik:**
  - Ø Tage bis Zahlung
  - Mahnquote (wie oft wurde gemahnt)
  - Zahlungsart (Karte = sofort, Überweisung = langsam)
- **Auswirkung:**
  - Score < 50: Vorkasse/Anzahlung verlangen
  - Score > 80: Längere Zahlungsziele anbieten
- **Aufwand:** 3h
- **Impact:** ⭐⭐⭐⭐

#### 4.3 Intelligente Zahlungserinnerung (KI-Timing)
- **Was:** Erinnerung zum optimalen Zeitpunkt senden (nicht starr Tag 7)
- **Logik:** ML auf Basis vergangener Zahlungen — wann zahlt dieser Kunde typischerweise?
- **Beispiel:** Kunde zahlt immer freitags → Erinnerung donnerstags senden
- **Aufwand:** 4h (Ollama/Mistral auf VPS für Pattern-Erkennung)
- **Impact:** ⭐⭐⭐

#### 4.4 DATEV-Export Produktiv
- **Was:** Monatlicher automatischer DATEV-Export für Steuerberater
- **Wo:** `js/services/datev-export-service.js` (Code vorhanden)
- **Flow:** Monatsende → Export generieren → per E-Mail an Steuerberater
- **Aufwand:** 2h
- **Impact:** ⭐⭐⭐⭐

#### 4.5 SEPA-Lastschrift (Langfristig)
- **Was:** Für Retainer-Kunden: SEPA-Mandat → automatische monatliche Abbuchung
- **Voraussetzung:** Gläubiger-ID bei Bundesbank beantragen
- **Wo:** `js/services/finom-service.js` → SEPA Direct Debit
- **Aufwand:** 8h + Bürokratie
- **Impact:** ⭐⭐⭐⭐⭐ (für wiederkehrende Einnahmen)

**Phase 4 Ergebnis:** Vollautomatische Finanzpipeline. Steuerberater bekommt DATEV-Daten automatisch. Cashflow wird prognostiziert.

---

## Zusammenfassung: Timeline

```
Woche 1          Woche 2-3         Woche 4-5          Woche 6-8
┌──────────┐    ┌──────────┐     ┌──────────┐      ┌──────────┐
│ PHASE 1  │    │ PHASE 2  │     │ PHASE 3  │      │ PHASE 4  │
│          │    │          │     │          │      │          │
│ QR-Code  │    │ Stripe   │     │ Bank-API │      │ Cashflow │
│ Skonto   │───▶│ PayPal   │────▶│ Auto-    │─────▶│ Scoring  │
│ Mahnwesen│    │ Anzahlung│     │ Matching │      │ KI-Timing│
│ Reminder │    │ Webhooks │     │ Dashboard│      │ DATEV    │
│          │    │          │     │          │      │ SEPA-LSV │
└──────────┘    └──────────┘     └──────────┘      └──────────┘
  ~5h Aufwand    ~7h Aufwand      ~12h Aufwand      ~19h Aufwand

Ø Zahlungsfrist:
  28 Tage ──▶ 14 Tage ──▶ 7 Tage ──▶ 3 Tage

Automatisierungsgrad:
  20% ──────▶ 50% ──────▶ 90% ──────▶ 98%
```

---

## KPIs & Erfolgsmessung

| KPI | Heute | Nach Phase 2 | Nach Phase 4 |
|-----|-------|-------------|-------------|
| Ø Tage bis Zahlung | ~28 | ~14 | ~5 |
| Manueller Aufwand/Monat | ~8h | ~3h | ~30min |
| Automatisch erkannte Zahlungen | 0% | 40% (Stripe) | 95% |
| Mahnquote | unbekannt | ~15% | ~5% |
| Offene Posten > 30 Tage | unbekannt | < 10% | < 2% |

---

## Kosten

| Posten | Monatlich | Einmalig |
|--------|-----------|----------|
| Stripe | 1.4% + 0.25€/Txn | 0€ |
| GoCardless Open Banking | 0€ (Free Tier) | 0€ |
| Resend (E-Mail) | 0€ (Free bis 3k/Monat) | 0€ |
| SEPA Gläubiger-ID | 0€ | 0€ (Bundesbank) |
| **Gesamt** | **~5-15€/Monat** | **0€** |

---

## Nächster Schritt

**Phase 1 starten — sofort umsetzbar:**
1. EPC-QR-Code Library einbinden
2. Skonto-Zeile auf Rechnungstemplate
3. Dunning-Workflow in n8n aktivieren
4. Proaktive Erinnerung (3 Tage vor Fälligkeit) als n8n Cron

> *"Jede Rechnung ohne QR-Code und Payment-Link ist verschenktes Geld."*
