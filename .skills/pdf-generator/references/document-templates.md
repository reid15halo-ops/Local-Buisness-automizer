# Document Templates -- Field Mappings

## Company Data (sender -- same for all documents)

| Field | Python key | JS key | Value |
|-------|-----------|--------|-------|
| Name | `company.name` | `firma.name` | FreyAI Visions |
| Street | `company.street` | `firma.strasse` | Grabenstrasse 135 |
| PLZ | `company.postal_code` | `firma.plz` | 63762 |
| City | `company.city` | `firma.ort` | Grossostheim |
| Phone | `company.phone` | `firma.telefon` | +49 163 6727787 |
| Email | `company.email` | `firma.email` | kontakt@freyaivisions.de |
| Steuernummer | `company.tax_id` | `firma.steuernummer` | 039 863 50457 |
| IBAN | `company.iban` | `firma.iban` | (from settings) |
| BIC | `company.bic` | `firma.bic` | (from settings) |
| Bank | `company.bank_name` | `firma.bank` | (from settings) |

## Customer Data (recipient)

| Field | Python key | JS key |
|-------|-----------|--------|
| Company | `customer.company` | `kunde.firma` |
| Name | `customer.name` | `kunde.name` |
| Street | `customer.street` | `kunde.strasse` |
| PLZ | `customer.postal_code` | `kunde.plz` |
| City | `customer.city` | `kunde.ort` |

## Position (line item)

| Field | Python key | JS key | Required |
|-------|-----------|--------|----------|
| Description | `description` | `beschreibung` | Yes |
| Details | `details` | `details` | No |
| Responsible | `verantwortlich` | `verantwortlich` | No (Angebot only) |
| Quantity | `quantity` | `menge` | Yes |
| Unit | `unit` | `einheit` | Yes |
| Unit price | `unit_price` | `einzelpreis` | Yes |

### Common units
- `Std.` -- hours
- `Stueck` / `Stk.` -- pieces
- `Pauschal` -- flat rate
- `Monat` -- monthly
- `m` / `m2` -- meters / square meters
- `Paket` -- package/bundle

---

## Rechnung (Invoice)

**Number format**: `RE-YYYY-NNN` (e.g. `RE-2026-001`)

| Section | Fields |
|---------|--------|
| Header | Company name, address, contact |
| Title | "Rechnung Nr. RE-YYYY-NNN" |
| Meta | Rechnungsdatum, Zahlungsziel (14 Tage netto), Leistungszeitraum |
| Recipient | Customer company, name, address |
| Positions | Table: Pos / Beschreibung / Menge / Einheit / Einzelpreis / Gesamt |
| Totals | Gesamtbetrag (netto) + ss19 UStG notice |
| Payment | IBAN, BIC, Bank, Verwendungszweck: RE-YYYY-NNN |
| Footer | Steuernummer, full address |

**Python-specific fields**:
```json
{
  "type": "rechnung",
  "number": "RE-2026-001",
  "date": "2026-03-13T10:00:00",
  "due_date": "27.03.2026",
  "exempt_vat": true
}
```

**JS-specific fields** (pdfmake path):
```javascript
{
  rechnung: { nummer: "RE-2026-001", datum: "13.03.2026", faelligkeitsdatum: "27.03.2026" },
  summe: { netto: "3.500,00 EUR", mwst: "0,00 EUR", brutto: "3.500,00 EUR", kleinunternehmer: true }
}
```

---

## Angebot (Quote)

**Number format**: `ANG-YYYY-NNN`

| Section | Fields |
|---------|--------|
| Header | Company name, address, contact |
| Title | "Angebot Nr. ANG-YYYY-NNN" |
| Meta | Datum, Gueltig bis (30 Tage) |
| Recipient | Customer company, name, address |
| Intro text | Professional cover letter (optional `text` field) |
| Positions | Table with description, details, verantwortlich |
| Totals | Gesamtbetrag + ss19 notice |
| Trust section | Green box with guarantee items (Angebot only) |
| Terms | "Zahlungsbedingungen: 14 Tage netto" |
| Footer | Steuernummer, full address |

**Extra Python fields**:
```json
{
  "type": "angebot",
  "text": "Sehr geehrte Damen und Herren, ...",
  "trust_items": ["Qualifizierte Fachkraefte...", "DIN-Normen...", "Abnahmeprotokoll..."]
}
```

---

## Mahnung (Dunning Notice)

**Number format**: `MA-YYYY-NNN`

| Section | Fields |
|---------|--------|
| Title | "Zahlungserinnerung Nr. MA-YYYY-NNN" |
| Meta | Datum, Urspruengliche Rechnung (reference) |
| Positions | Original invoice positions |
| Terms | Ausstehender Betrag, Mahngebuehr, payment urgency |

**Extra fields**:
```json
{
  "type": "mahnung",
  "original_invoice_number": "RE-2026-001",
  "outstanding_amount": 3500.00,
  "dunning_fee": 50.00
}
```

---

## Gutschrift (Credit Note)

**Number format**: `GS-YYYY-NNN`

| Section | Fields |
|---------|--------|
| Title | "Gutschrift Nr. GS-YYYY-NNN" |
| Meta | Datum, Bezug auf Rechnung Nr. |
| Reason | Grund der Gutschrift |
| Positions | Credited items (positive amounts, labeled as credit) |
| Totals | Gutschriftbetrag + ss19 notice |

**Fields**:
```json
{
  "type": "gutschrift",
  "number": "GS-2026-001",
  "original_invoice_number": "RE-2026-001",
  "reason": "Teilrueckgabe Material",
  "positions": [
    { "description": "Rueckerstattung: Dichtungsset", "quantity": 1, "unit": "Paket", "unit_price": 320.00 }
  ]
}
```

Note: The Python generator does not yet have a native `gutschrift` type. To generate one, use `type: "rechnung"` with the title overridden to "Gutschrift" and add the reference/reason fields manually, or extend `GermanBusinessPDFGenerator` with a `gutschrift` branch.

---

## Auftragsbestaetigung (Order Confirmation)

**Number format**: `AB-YYYY-NNN`

| Section | Fields |
|---------|--------|
| Title | "Auftragsbestaetigung Nr. AB-YYYY-NNN" |
| Meta | Datum, Auftragsnummer, voraussichtlicher Beginn, geschaetzte Fertigstellung |
| Positions | Confirmed scope from accepted Angebot |
| Terms | Payment schedule, project timeline |

**Fields**:
```json
{
  "type": "auftragsbestaetigung",
  "number": "AB-2026-001",
  "auftrag_id": "AUF-2026-001",
  "angebot_number": "ANG-2026-001",
  "start_date": "2026-04-01",
  "estimated_completion": "2026-04-30"
}
```

Note: Not yet implemented in the Python generator. Extend with a new branch or reuse `angebot` layout with title override.
