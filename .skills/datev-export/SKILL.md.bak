---
name: datev-export
description: |
  DATEV export, Buchungssätze, SKR03/SKR04 Kontenrahmen, bookkeeping export, CSV for Steuerbüro,
  GoBD compliance, Buchungsschlüssel, Gegenkonto, Sachkonto mapping, EÜR export, tax preparation.
  Use this skill ANY time the user mentions: DATEV, Buchungssatz, Buchungssätze, SKR03, SKR04,
  Kontenrahmen, Steuerbüro, Steuerberater, Buchhaltung export, CSV export, GoBD, Buchungsschlüssel,
  Gegenkonto, Sachkonto, Erlöskonto, Aufwandskonto, Kontenzuordnung, Steuerexport, EXTF, Belegfeld,
  Umsatzsteuer-Schlüssel, Buchungsstapel, Einnahmen-Überschuss-Rechnung export, EÜR DATEV,
  "für den Steuerberater", "Steuerbüro schicken", "Export für Buchhalter", "DATEV-Format",
  "Kontenrahmen anpassen", Skonto, Gutschrift, Storno, Teilzahlung, Mahngebühren buchen,
  or any question about German bookkeeping export formats. This skill is CRITICAL for all
  DATEV-related work — always activate it even if the user only tangentially mentions export
  or Steuerberater in a bookkeeping context.
---

# DATEV Export — FreyAI Visions Buchhaltungsexport

German DATEV CSV export for Handwerker. Kleinunternehmer §19 UStG. SKR03 default.

## Architecture

Two services handle DATEV export:

| Service | File | Role |
|---------|------|------|
| `DatevExportService` | `js/services/datev-export-service.js` | DATEV EXTF CSV generation, SKR03 mapping, download |
| `BookkeepingService` | `js/services/bookkeeping-service.js` | Buchungen CRUD, EÜR calculation, simplified DATEV export |

Global instances: `window.datevExportService`, `window.bookkeepingService`

**Data flow:** BookkeepingService stores Buchungen in Supabase (`buchungen` table) -> DatevExportService reads them via `window.bookkeepingService.buchungen` -> converts to DATEV EXTF format -> generates CSV -> download as file.

## DATEV CSV Format (EXTF)

### Header Row (Line 1)

```
"EXTF";510;21;"Buchungsstapel";12;YYYYMMDD;;;;<BeraterNr>;<MandantenNr>;YYYYMMDD;<Sachkontenlänge>;YYYYMMDD;YYYYMMDD;"Bezeichnung";;"EUR"
```

| Field | Position | Value | Notes |
|-------|----------|-------|-------|
| Kennzeichen | 1 | `"EXTF"` | Always EXTF for external format |
| Versionsnummer | 2 | `510` | Format version 5.10 |
| Datenkategorie | 3 | `21` | 21 = Buchungsstapel |
| Formatname | 4 | `"Buchungsstapel"` | |
| Formatversion | 5 | `12` | |
| Erzeugt am | 6 | `YYYYMMDD` | Generation date |
| Berater-Nr | 11 | 5-7 digits | From settings |
| Mandanten-Nr | 12 | 5-7 digits | From settings |
| WJ-Beginn | 13 | `YYYYMMDD` | Wirtschaftsjahr start |
| Sachkontenlänge | 14 | `4` | SKR03/04 = 4 digits |
| Datum von | 15 | `YYYYMMDD` | Period start |
| Datum bis | 16 | `YYYYMMDD` | Period end |
| Bezeichnung | 17 | Free text | Export description |
| Währung | 19 | `"EUR"` | |

### Column Headers (Line 2)

```
Umsatz;Soll/Haben;WKZ;Konto;Gegenkonto;BU-Schlüssel;Datum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext;Postensperre;Kost1;Kost2;USt-IdNr
```

### Data Rows (Line 3+)

| Field | Format | Example | Notes |
|-------|--------|---------|-------|
| Umsatz | Cents (integer) | `119900` | = 1.199,00 EUR. Always positive. |
| Soll/Haben | `S` or `H` | `H` | H=Haben (Einnahme), S=Soll (Ausgabe) |
| WKZ | ISO 4217 | `EUR` | |
| Konto | 4 digits | `8400` | Sachkonto (Erlös-/Aufwandskonto) |
| Gegenkonto | 4 digits | `1200` | Typically Bank (1200) or Kasse (1000) |
| BU-Schlüssel | 1-2 digits | `0` | See Buchungsschlüssel below |
| Datum | DDMM | `1503` | Day+Month only (year from header) |
| Belegfeld 1 | max 36 chars | `RE-2026-001` | Invoice/receipt number |
| Belegfeld 2 | max 12 chars | | Optional secondary reference |
| Skonto | Cents | `0` | Skonto amount in cents |
| Buchungstext | max 60 chars | `Rechnung Müller` | Description |
| Postensperre | 0/1 | `0` | 0=normal |
| Kost1 | | | Kostenstelle 1 (optional) |
| Kost2 | | | Kostenstelle 2 (optional) |
| USt-IdNr | | | Only for EU cross-border |

### Encoding & Delimiter

- **Encoding:** Windows-1252 (CP1252) — NOT UTF-8
- **Delimiter:** Semicolon `;`
- **Line ending:** `\r\n` (CRLF)
- **Text fields:** Quoted with `""`
- **Decimal:** Comma for display, but Umsatz field is in Cents (integer)
- **BOM:** No BOM

## Buchungsschlüssel (BU-Schlüssel)

**CRITICAL for §19 Kleinunternehmer:**

| BU | Meaning | Use Case |
|----|---------|----------|
| `0` | Keine USt | **DEFAULT for Kleinunternehmer §19** |
| `2` | 7% Vorsteuer | Einkauf mit 7% (Bücher, Lebensmittel) |
| `3` | 19% USt | Einnahmen mit 19% (NOT for Kleinunternehmer) |
| `8` | 7% USt | Einnahmen mit 7% (NOT for Kleinunternehmer) |
| `9` | 19% Vorsteuer | Einkauf mit 19% |
| `40` | Innergemeinschaftlicher Erwerb | EU-Einkauf |

**FreyAI is Kleinunternehmer §19 UStG** -> ALL Einnahmen use BU-Schlüssel `0` (keine USt).
Ausgaben CAN have Vorsteuer (BU `9` for 19%, BU `2` for 7%) IF the Steuerberater wants to track input VAT for threshold monitoring, but typically also `0` for Kleinunternehmer.

> **BUG in current code:** `datev-export-service.js` line 102 sets `buchungsSchluessel: isEinnahme ? '3' : '2'` which implies 19% USt. This is WRONG for Kleinunternehmer. Must be `'0'` for all entries, or conditionally `'0'` when `kleinunternehmer === true`.

## SKR03 Kontenrahmen — Handwerker Accounts

### Einnahmen (Erlöskonten, Klasse 8)

| Konto | Bezeichnung | Verwendung |
|-------|-------------|------------|
| `8400` | Erlöse 19% USt | **Standard-Erlöskonto** (auch bei §19, Konto bleibt gleich) |
| `8300` | Erlöse 7% USt | Ermäßigte Leistungen |
| `8120` | Steuerfreie Umsätze §19 | Alternative: explizites §19-Konto |
| `8520` | Provisionserlöse | Vermittlungsprovisionen |
| `8900` | Sonstige Erlöse | Schadensersatz, Versicherungsentschädigungen |
| `8735` | Gewährte Skonti | Skontoabzug auf Erlöse (Minderung) |

### Ausgaben (Aufwandskonten, Klasse 3-4)

| Konto | Bezeichnung | Typisch für Handwerker |
|-------|-------------|----------------------|
| `3400` | Wareneingang 19% | Materialeinkauf |
| `3300` | Wareneingang 7% | |
| `4210` | Miete/Pacht | Werkstatt, Lager |
| `4360` | Versicherungen | Betriebshaftpflicht, Werkzeugversicherung |
| `4540` | KFZ-Kosten | Transporter, Diesel |
| `4580` | Kfz-Versicherungen | |
| `4600` | Werbung | Marketing, Visitenkarten |
| `4650` | Bewirtung (70%) | Kundenessen (nur 70% absetzbar) |
| `4660` | Reisekosten | Fahrt zu Baustellen |
| `4806` | Reparaturen/Instandhaltung | Werkzeug-Reparatur |
| `4900` | Sonstige Ausgaben | Auffangkonto |
| `4910` | Porto | |
| `4920` | Telefon/Internet | |
| `4930` | Bürobedarf | |
| `4945` | Fortbildung | Meisterkurs, Schulungen |
| `4970` | Nebenkosten Geldverkehr | Bankgebühren, Stripe-Gebühren |

### Bilanzkonten (Bestandskonten, Klasse 1)

| Konto | Bezeichnung | Verwendung |
|-------|-------------|------------|
| `1000` | Kasse | Barzahlung |
| `1200` | Bank | **Standard-Gegenkonto** |
| `1400` | Forderungen aus L+L | Offene Rechnungen (Debitoren) |
| `1600` | Verbindlichkeiten aus L+L | Offene Eingangsrechnungen (Kreditoren) |
| `1590` | Durchlaufende Posten | Auslagen für Kunden |
| `1776` | USt 19% | USt-Konto (irrelevant für §19) |
| `1571` | Vorsteuer 19% | Vorsteuer-Konto |

## Buchungssätze — Patterns für Handwerker

### 1. Rechnung erstellt (Forderung)

```
Soll 1400 (Forderungen) an Haben 8400 (Erlöse)
DATEV: Konto=8400, Gegenkonto=1400, S/H=H, BU=0
```

### 2. Zahlung eingeht (Forderung aufgelöst)

```
Soll 1200 (Bank) an Haben 1400 (Forderungen)
DATEV: Konto=1200, Gegenkonto=1400, S/H=S, BU=0
```

### 3. Direktzahlung (Rechnung sofort bezahlt)

```
Soll 1200 (Bank) an Haben 8400 (Erlöse)
DATEV: Konto=8400, Gegenkonto=1200, S/H=H, BU=0
```

### 4. Materialeinkauf

```
Soll 3400 (Wareneingang) an Haben 1200 (Bank)
DATEV: Konto=3400, Gegenkonto=1200, S/H=S, BU=9 (19% VSt) oder 0 (§19)
```

### 5. Betriebsausgabe

```
Soll 4xxx (Aufwandskonto) an Haben 1200 (Bank)
DATEV: Konto=4xxx, Gegenkonto=1200, S/H=S, BU=0
```

### 6. Gutschrift / Storno

```
Soll 8400 (Erlöse) an Haben 1400 (Forderungen)  — Storno der Forderung
DATEV: Konto=8400, Gegenkonto=1400, S/H=S, BU=0
Umsatz = Stornobetrag, negative Buchung via S statt H
```

### 7. Skonto gewährt (Kunde zahlt mit Abzug)

```
Buchung 1: Soll 1200 (Bank) an Haben 1400 (Forderungen) — Teilbetrag
Buchung 2: Soll 8735 (Gewährte Skonti) an Haben 1400 (Forderungen) — Skontobetrag
```

In DATEV CSV:
```
# Zahlungseingang (reduziert)
Konto=1200, Gegenkonto=1400, S/H=S, BU=0, Umsatz=<Nettobetrag nach Skonto>
# Skonto-Buchung
Konto=8735, Gegenkonto=1400, S/H=S, BU=0, Umsatz=<Skontobetrag>
```

### 8. Teilzahlung

```
Soll 1200 (Bank) an Haben 1400 (Forderungen) — Teilbetrag
DATEV: Konto=1200, Gegenkonto=1400, S/H=S, BU=0, Umsatz=<Teilbetrag>
```
Forderung bleibt offen bis Restbetrag eingeht. Each partial payment = separate DATEV row.

## Kleinunternehmer §19 UStG — Specifics

### What changes for §19:

1. **No USt on invoices** — Rechnungen enthalten keine Umsatzsteuer
2. **BU-Schlüssel always `0`** for Einnahmen — no VAT code
3. **Erlöskonto still `8400`** — the account stays the same, tax handling differs
4. **No USt-Voranmeldung** needed — no quarterly VAT return
5. **Vorsteuer NOT deductible** — Kleinunternehmer cannot claim input VAT
6. **Brutto = Netto** for all Einnahmen — since no USt is added
7. **Invoice MUST state:** "Gemäß §19 UStG wird keine Umsatzsteuer berechnet."

### Threshold monitoring (Pflicht):

- Current year revenue must stay < 25.000 EUR (as of 2025 reform, was 22.000)
- Previous year revenue < 25.000 EUR
- If exceeded: automatic switch to Regelbesteuerung next year

### Impact on DATEV export:

- All `buchungsSchluessel` for Einnahmen = `0`
- `ust` column in Buchungen = `0`
- Erlöskonto `8400` OR alternative `8120` (steuerfreie Umsätze §19) — depends on Steuerberater preference
- BookkeepingService already sets `this.einstellungen.umsatzsteuersatz = 0` when `kleinunternehmer = true`

## GoBD Compliance Rules

GoBD = Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern, Aufzeichnungen und Unterlagen in elektronischer Form.

### Mandatory Requirements:

| Principle | German | Implementation |
|-----------|--------|----------------|
| Nachvollziehbarkeit | Traceability | Every Buchung has `belegnummer`, `datum`, linked `rechnungId` |
| Ordnung | Organization | Sequential Belegnummern, consistent Kontenrahmen |
| Vollständigkeit | Completeness | ALL business transactions must be recorded |
| Richtigkeit | Correctness | Amounts must match source documents |
| Zeitgerechtheit | Timeliness | Record within 10 days of transaction |
| Unveränderbarkeit | Immutability | Once exported, data must not be altered |
| Aufbewahrung | Retention | **10 years** for Buchungsbelege, Rechnungen, Jahresabschlüsse |

### Implementation in FreyAI:

- **Unveränderbarkeit:** DATEV exports are stored with timestamp in `freyai_datev_exports`. Once generated, the CSV content is frozen.
- **Belegnummern:** Linked to `rechnung.id` (RE-xxx) or `buchung.belegnummer`
- **Audit trail:** `exportData.createdAt` timestamp on every export
- **Retention:** Exports stored in IndexedDB + Supabase. User must ensure 10-year backup.

### Export file naming convention:

```
DATEV_YYYY-MM-DD_YYYY-MM-DD.csv
```
Example: `DATEV_2026-01-01_2026-03-31.csv` (Q1 2026)

## Edge Cases

### Partial Payments (Teilzahlungen)

- Each partial payment creates a separate Buchung against Forderungen (1400)
- DATEV: one row per payment, all referencing same Belegfeld1 (invoice number)
- Remaining open amount stays on 1400 until fully paid

### Gutschriften (Credit Notes)

- Reverse the original Buchungssatz: swap S/H
- Erlöskonto 8400 gets debited (S), Forderungen 1400 get credited (H)
- Buchungstext must reference original invoice: "Gutschrift zu RE-2026-001"

### Skonto

- Two DATEV rows: reduced payment (Bank an Forderungen) + Skonto booking (8735 an Forderungen)
- Skonto field in DATEV record can also carry the amount
- Common Skonto terms for Handwerker: 2% within 10 days, 0% within 30 days

### Foreign Currency (Fremdwährung)

- Rare for local Handwerker, but possible (Swiss border, Austrian suppliers)
- WKZ field changes from EUR to CHF/other
- Exchange rate must be documented
- Use Tageskurs (daily rate) from ECB

### Mahngebühren

- Mahngebühren are separate Einnahmen: Konto 8400 or 2650 (sonstige betriebliche Erträge)
- Each Mahnstufe can add fees (typically 5-10 EUR)
- Must be separate Buchung from the original invoice

### Stripe/Payment Processor Fees

- Stripe fees are Ausgaben: Konto 4970 (Nebenkosten Geldverkehr)
- Book gross payment as Einnahme, Stripe fee as separate Ausgabe
- Never net the fee — GoBD requires full transparency

## Code Integration Points

### DatevExportService (`js/services/datev-export-service.js`)

```javascript
// Generate export
window.datevExportService.generateExport('2026-01-01', '2026-03-31');

// Download CSV
window.datevExportService.downloadExport('datev-1234567890');

// Update Berater/Mandanten-Nr
window.datevExportService.updateSettings({
    beraterNummer: '12345',
    mandantenNummer: '67890',
    sachkontenlaenge: 4
});

// Get SKR03 account for category
window.datevExportService.getSachkonto('Dienstleistung', 'einnahme'); // -> '8400'
```

### BookkeepingService (`js/services/bookkeeping-service.js`)

```javascript
// Simplified DATEV export (alternative path)
const csv = window.bookkeepingService.exportDATEV(2026);

// Check Kleinunternehmer status
window.bookkeepingService.einstellungen.kleinunternehmer; // true

// Get all Buchungen for DATEV period
window.bookkeepingService.getBuchungenForJahr(2026);
window.bookkeepingService.getBuchungenForMonat(2026, 3);
```

### Known Issues to Fix

1. **BU-Schlüssel Bug:** `datev-export-service.js:102` hardcodes BU `3`/`2` (19% USt). Must check `window.bookkeepingService.einstellungen.kleinunternehmer` and use `0` when true.
2. **Dual export paths:** Both services generate DATEV CSV independently. Should consolidate to one authoritative path (DatevExportService).
3. **Encoding:** Current export uses UTF-8 (`text/csv;charset=utf-8`). DATEV import expects Windows-1252. May cause Umlaute issues (ä, ö, ü, ß).
4. **Umsatz format:** DatevExportService uses Cents (correct). BookkeepingService uses decimal with comma (also acceptable but less standard).
5. **Missing Forderungen workflow:** Current code books directly `Erlöse an Bank`. Should support the two-step flow: `Forderungen an Erlöse` (invoice created) then `Bank an Forderungen` (payment received).
