---
name: pdf-generator
description: |
  Generate professional German business PDFs (Rechnungen, Angebote, Mahnungen, Gutschriften, Auftragsbestaetigungen).
  Use this skill when the user asks to create a PDF, generate an invoice, print a document, export a quote,
  create a Rechnung, build a Mahnung, prepare a Gutschrift, or generate any business document as PDF.
  Also trigger on: "PDF erstellen", "Rechnung erstellen", "Angebot PDF", "invoice PDF", "generate document",
  "print invoice", "Dokument drucken", "PDF exportieren", "Gutschrift erstellen", "credit note",
  "Auftragsbestaetigung", "order confirmation PDF", "Mahnung erstellen", "dunning notice".
---

# PDF Generator Skill -- FreyAI Business Documents

Generate legally compliant, professionally styled German business PDFs. Two generation paths exist:

| Path | Tool | Use case |
|------|------|----------|
| **Server-side** | `tools/pdf-generator.py` (ReportLab) | VPS/backend, batch generation, CLI |
| **Client-side** | `js/services/pdf-service.js` (jsPDF) + `js/services/pdf-generation-service.js` (pdfmake) | Browser download, email attachment |

Read `references/document-templates.md` for field mappings per document type before generating.

## 1. Document Types

| Type | German | Number prefix | Key fields |
|------|--------|--------------|------------|
| Angebot | Quote | `ANG-` | `gueltig_bis` (30 days), `text`, `trust_items` |
| Rechnung | Invoice | `RE-` | `due_date` (14 days), `exempt_vat`, bank details |
| Mahnung | Dunning notice | `MA-` | `original_invoice_number`, `outstanding_amount`, `dunning_fee` |
| Gutschrift | Credit note | `GS-` | `original_invoice_number`, `reason`, positive amounts with credit label |
| Auftragsbestaetigung | Order confirmation | `AB-` | `auftrag_id`, `start_date`, `estimated_completion` |

**Implementation gaps (as of 2026-03)**: The Python generator (`tools/pdf-generator.py`) does not yet natively support `gutschrift` or `auftragsbestaetigung`. When generating these via CLI, use `type: "rechnung"` / `type: "angebot"` with a title override field and add the reference/reason fields manually. The JS path (pdfmake) supports all types natively.

## 2. German Formatting Rules

All documents MUST use German formatting:

- **Dates**: `DD.MM.YYYY` (e.g. `13.03.2026`) -- never ISO format in output
- **Numbers**: Comma as decimal, period as thousands (`1.234,56`)
- **Currency**: `1.234,56 EUR` -- always EUR, never USD/CHF
- **Addresses**: Street, then PLZ + City on next line (DIN 5008)
- **Umlauts**: Use actual UTF-8 characters (ae/oe/ue only as ASCII fallback in filenames)

## 3. Legal Requirements (Kleinunternehmer)

FreyAI Visions operates under **§19 UStG** (Kleinunternehmer). Every document MUST:

1. Charge **0% MwSt** -- Netto equals Brutto
2. Include notice: `"Gemäß §19 UStG wird keine Umsatzsteuer berechnet."`
3. Show **Steuernummer** `039 863 50457` (not USt-IdNr, since Kleinunternehmer)
4. Include full sender address, bank details (IBAN, BIC, Bank), and contact info
5. Invoices must comply with **§14 UStG** mandatory fields:
   - Vollständiger Name und Anschrift (sender + recipient)
   - Steuernummer
   - Rechnungsdatum + fortlaufende Rechnungsnummer
   - Leistungsbeschreibung, Menge, Einzelpreis, Gesamtbetrag
   - Leistungszeitraum
   - Zahlungsziel

**Mahnung specifics**: The Mahngebühr (dunning fee) is treated as a separate non-VAT-liable cost. Show it as a separate line below the invoice total. Apply §19 UStG notice to the entire document. State new payment deadline explicitly (e.g. "Bitte zahlen Sie den ausstehenden Betrag bis zum DD.MM.YYYY").

## 4. Brand Styling

| Element | Value |
|---------|-------|
| Header background | `#1a1a2e` (dark navy) |
| Accent color | `#6366f1` (indigo) |
| Alternating rows | `#f5f5f5` light gray |
| Body font | Helvetica (ReportLab) / Roboto (pdfmake) |
| Page format | A4 (210 x 297 mm) |
| Margins | 15-20mm all sides |
| Logo | FreyAI Visions wordmark in header (white on dark navy) |
| Trust box | Green background (#e8f5e9), used in Angebote only |

## 5. Supabase Customer Lookup (E5 -- REQUIRED)

**Always load customer data from Supabase before generating a PDF.** Do not rely on manually typed customer data unless the user explicitly provides it and no customer name/ID can be matched.

Supabase project: `incbhhaiiayohrjqevog.supabase.co`
Table: `customers` (or `kunden`)

```javascript
// Browser-side lookup via app Supabase client
const { data: customer } = await supabase
  .from('customers')
  .select('*')
  .ilike('name', '%Musterfirma%')
  .single();

// Then map to PDF customer object:
const kundeData = {
  company: customer.firma,
  name: customer.ansprechpartner,
  street: customer.strasse,
  postal_code: customer.plz,
  city: customer.ort
};
```

```bash
# VPS/CLI lookup via Supabase REST API
curl -s "https://incbhhaiiayohrjqevog.supabase.co/rest/v1/customers?name=ilike.*Musterfirma*&select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

If no match is found, ask the user for the customer details. If a partial match is found, show candidates and let the user confirm.

## 6. Generation Workflows

### Python CLI (server-side)
```bash
# From JSON file
python3 tools/pdf-generator.py --type rechnung --data "$(cat data.json)" --output RE-2024-042.pdf

# Sample generation
python3 tools/pdf-generator.py --type angebot --output sample.pdf

# Batch
python3 tools/batch-generate.py --input documents.json --output-dir batch_output/
```

### JavaScript (browser)
```javascript
// Via pdf-service.js (jsPDF)
await window.pdfService.ensureLoaded();
window.pdfService.generateInvoice(invoiceData);

// Via pdf-generation-service.js (pdfmake) with templates -- preferred for all types
await window.pdfGenerationService.downloadPDF(invoice, 'standard-de', 'RE-2024-042.pdf');

// Get as base64 for email attachment
const base64 = await window.pdfGenerationService.getPDFBase64(invoice);
```

### Email Delivery (VPS Email Relay)

To send the PDF as email attachment via the FreyAI email relay (Port 3100 on 72.61.187.24):

```javascript
// 1. Get PDF as base64
const base64 = await window.pdfGenerationService.getPDFBase64(invoice);

// 2. Send via email relay
await fetch('http://72.61.187.24:3100/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'rechnungen@freyaivisions.de',
    to: customer.email,
    subject: `Rechnung ${invoice.number} - FreyAI Visions`,
    text: `Sehr geehrte Damen und Herren,\n\nim Anhang erhalten Sie Ihre Rechnung ${invoice.number}.\n\nMit freundlichen Grüßen\nJonas Glawion\nFreyAI Visions`,
    attachments: [{
      filename: `Rechnung_${invoice.number}.pdf`,
      content: base64,
      encoding: 'base64'
    }]
  })
});
```

**SMTP alternative** (Dovecot/Postfix): `mail.freyaivisions.de:587` (STARTTLS), from `rechnungen@freyaivisions.de`.

## 7. Data Structure (Python path)

```json
{
  "type": "rechnung",
  "number": "RE-2024-042",
  "date": "2026-03-13T10:00:00",
  "due_date": "27.03.2026",
  "service_period": "01.03.2026 - 31.03.2026",
  "exempt_vat": true,
  "company": {
    "name": "FreyAI Visions",
    "street": "Grabenstrasse 135",
    "postal_code": "63762",
    "city": "Grossostheim",
    "phone": "+49 163 6727787",
    "email": "kontakt@freyaivisions.de",
    "tax_id": "039 863 50457",
    "iban": "...", "bic": "...", "bank_name": "..."
  },
  "customer": {
    "company": "Firma GmbH",
    "name": "Max Mustermann",
    "street": "Kundenstrasse 42",
    "postal_code": "60311",
    "city": "Frankfurt am Main"
  },
  "positions": [
    {
      "description": "Leistungsbeschreibung",
      "details": "Ausfuehrliche Details (optional)",
      "quantity": 1,
      "unit": "Pauschal",
      "unit_price": 3500.00
    }
  ]
}
```

**Note**: `service_period` (Leistungszeitraum) is a §14 UStG mandatory field -- always include it.

## 8. Gutschrift (Credit Note) Specifics

Credit notes reverse a previous invoice. Use negative amounts or clearly label as Gutschrift:

- Reference the original `Rechnung-Nr.`
- State the reason for credit in a visible "Grund der Gutschrift:" field
- Amounts shown as positive with "Gutschrift" label (not negative numbers in output)
- Same §19 UStG notice applies
- Number prefix: `GS-YYYY-NNN`
- **Python workaround**: Use `type: "rechnung"` + `"title_override": "Gutschrift"` + add `original_invoice_number` and `reason` fields. The template renderer will use these to display the reference.
- JS path: use `type: "gutschrift"` natively in pdfmake service.

## 9. Mahnung (Dunning Notice) Specifics

- Reference the unpaid invoice: `original_invoice_number`
- Show original invoice amount and due date
- Add `dunning_fee` as a separate line (e.g. "Mahngebühr: 10,00 EUR")
- Calculate `total_outstanding` = original amount + dunning fee
- Set new strict payment deadline (7-14 days from Mahnung date)
- Tone: firm but professional ("Zahlungserinnerung" for 1st, "Mahnung" for 2nd+)
- §19 UStG notice still applies to the document

## 10. Auftragsbestaetigung (Order Confirmation) Specifics

- References the accepted Angebot: `angebot_number`
- States confirmed scope (copy positions from Angebot)
- Includes `start_date` and `estimated_completion` (both in DD.MM.YYYY)
- States payment schedule if applicable
- **Python workaround**: Use `type: "angebot"` layout + `"title_override": "Auftragsbestaetigung"` + add `auftrag_id`, `angebot_number`, `start_date`, `estimated_completion` fields.

## 11. Quality Checklist

Before delivering any PDF, verify:

1. [ ] Document number follows prefix convention (`RE-`, `ANG-`, `MA-`, `GS-`, `AB-`)
2. [ ] All dates in DD.MM.YYYY format
3. [ ] All amounts in German number format (comma decimal) with EUR
4. [ ] §19 UStG notice present, MwSt is 0
5. [ ] Sender: FreyAI Visions, Grabenstrasse 135, 63762 Grossostheim, Steuernummer 039 863 50457, IBAN/BIC/Bank
6. [ ] Recipient: loaded from Supabase (company/name, full address)
7. [ ] Positions: each has description, quantity, unit, unit_price, total
8. [ ] Totals: Netto = Brutto (no VAT line)
9. [ ] Payment terms included (14 days netto for invoices; new deadline for Mahnungen)
10. [ ] Leistungszeitraum (service period) included for Rechnungen (§14 UStG)
11. [ ] File named correctly: `{Type}_{Number}.pdf` (e.g. `Rechnung_RE-2026-042.pdf`)
12. [ ] Delivery: offered as download button OR sent via email relay -- confirm with user

## References

- `references/document-templates.md` -- Field mappings per document type
- `tools/pdf-generator.py` -- Python ReportLab generator (server-side)
- `tools/sample-data-*.json` -- Sample data for each document type
- `js/services/pdf-service.js` -- jsPDF browser generator
- `js/services/pdf-generation-service.js` -- pdfmake browser generator (preferred)
- `js/services/invoice-template-service.js` -- Template definitions
