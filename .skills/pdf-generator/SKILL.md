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
| Gutschrift | Credit note | `GS-` | `original_invoice_number`, `reason`, negative amounts |
| Auftragsbestaetigung | Order confirmation | `AB-` | `auftrag_id`, `start_date`, `estimated_completion` |

## 2. German Formatting Rules

All documents MUST use German formatting:

- **Dates**: `DD.MM.YYYY` (e.g. `13.03.2026`) -- never ISO format in output
- **Numbers**: Comma as decimal, period as thousands (`1.234,56`)
- **Currency**: `1.234,56 EUR` -- always EUR, never USD/CHF
- **Addresses**: Street, then PLZ + City on next line (DIN 5008)

## 3. Legal Requirements (Kleinunternehmer)

FreyAI Visions operates under **ss19 UStG** (Kleinunternehmer). Every document MUST:

1. Charge **0% MwSt** -- Netto equals Brutto
2. Include notice: `"Gemaess ss19 UStG wird keine Umsatzsteuer berechnet."`
3. Show **Steuernummer** (not USt-IdNr, since Kleinunternehmer)
4. Include full sender address, bank details (IBAN, BIC, Bank), and contact info
5. Invoices must comply with **ss14 UStG** mandatory fields:
   - Vollstaendiger Name und Anschrift (sender + recipient)
   - Steuernummer
   - Rechnungsdatum + fortlaufende Rechnungsnummer
   - Leistungsbeschreibung, Menge, Einzelpreis, Gesamtbetrag
   - Leistungszeitraum
   - Zahlungsziel

## 4. Brand Styling

| Element | Value |
|---------|-------|
| Header background | `#1a1a2e` (dark navy) |
| Accent color | `#6366f1` (indigo) |
| Alternating rows | `#f5f5f5` light gray |
| Body font | Helvetica (ReportLab) / Roboto (pdfmake) |
| Page format | A4 (210 x 297 mm) |
| Margins | 15-20mm all sides |

## 5. Generation Workflows

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

// Via pdf-generation-service.js (pdfmake) with templates
await window.pdfGenerationService.downloadPDF(invoice, 'standard-de', 'RE-2024-042.pdf');

// Get as base64 for email attachment
const base64 = await window.pdfGenerationService.getPDFBase64(invoice);
```

## 6. Data Structure (Python path)

```json
{
  "type": "rechnung",
  "number": "RE-2024-042",
  "date": "2026-03-13T10:00:00",
  "due_date": "27.03.2026",
  "exempt_vat": true,
  "company": {
    "name": "FreyAI Visions",
    "street": "Grabenstrasse 135",
    "postal_code": "63762",
    "city": "Grossostheim",
    "phone": "+49 179 4228285",
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

## 7. Gutschrift (Credit Note) Specifics

Credit notes reverse a previous invoice. Use negative amounts or clearly label as Gutschrift:

- Reference the original `Rechnung-Nr.`
- State the reason for credit
- Amounts shown as positive with "Gutschrift" label (not negative numbers in output)
- Same ss19 UStG notice applies
- Number prefix: `GS-YYYY-NNN`

## 8. Quality Checklist

Before delivering any PDF, verify:

1. [ ] Document number follows prefix convention (`RE-`, `ANG-`, `MA-`, `GS-`, `AB-`)
2. [ ] All dates in DD.MM.YYYY format
3. [ ] All amounts in German number format with EUR
4. [ ] ss19 UStG notice present, MwSt is 0
5. [ ] Sender: full name, address, Steuernummer, bank details
6. [ ] Recipient: company/name, full address
7. [ ] Positions: each has description, quantity, unit, unit_price, total
8. [ ] Totals: Netto = Brutto (no VAT line)
9. [ ] Payment terms included (14 days netto for invoices)
10. [ ] File named correctly: `{Type}_{Number}.pdf`

## References

- `references/document-templates.md` -- Field mappings per document type
- `tools/pdf-generator.py` -- Python ReportLab generator (server-side)
- `tools/sample-data-*.json` -- Sample data for each document type
- `js/services/pdf-service.js` -- jsPDF browser generator
- `js/services/pdf-generation-service.js` -- pdfmake browser generator
- `js/services/invoice-template-service.js` -- Template definitions
