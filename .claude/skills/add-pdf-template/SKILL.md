---
name: add-pdf-template
description: Create a PDF generation template for invoices, quotes, or reports — HTML-to-PDF layout with German business formatting.
argument-hint: [template-type]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob
---

## Create PDF Template

**Argument:** `$ARGUMENTS` — one of: `invoice`, `quote`, `order`, `report`, `dunning`, `custom`

### Steps

1. **Read** `js/services/pdf-service.js` and `js/services/pdf-generation-service.js`.
2. **Read** `js/services/invoice-template-service.js` for existing templates.
3. Create or update the template.

### German Business Document Layout

```
+--------------------------------------------------+
|  [LOGO]              Company Name                |
|                      Street Address               |
|                      PLZ City                     |
|                      Tel / Email                  |
|                      Steuer-Nr / USt-IdNr        |
+--------------------------------------------------+
|                                                   |
|  Recipient Address                                |
|  Company / Name                                   |
|  Street, PLZ City                                |
|                                                   |
+--------------------------------------------------+
|  RECHNUNG Nr. RE-2024-0042       Datum: DD.MM.YYYY|
|  Kundennummer: K-001              Fällig: DD.MM.YYYY|
+--------------------------------------------------+
|  Pos | Beschreibung      | Menge | Einheit | Preis | Gesamt |
|  1   | Metallarbeiten    |   5   |  Std.   | 65,00 | 325,00 |
|  2   | Material Edelstahl|   2   |  m²     | 89,50 | 179,00 |
+--------------------------------------------------+
|                              Netto:     504,00 €  |
|                              MwSt 19%:   95,76 €  |
|                              Brutto:    599,76 €  |
+--------------------------------------------------+
|  Zahlungsbedingungen: 14 Tage netto               |
|  Bankverbindung: IBAN DE89... BIC COBADEFFXXX     |
+--------------------------------------------------+
```

### Formatting Rules
- **Currency**: `1.234,56 €` (German format — dot for thousands, comma for decimals)
- **Dates**: `DD.MM.YYYY` (German format)
- **Tax**: Show Netto, MwSt (19%), Brutto separately
- **Paper**: A4 (210mm x 297mm), margins 25mm
- **Font**: Inter or Arial, 10pt body, 14pt headings
- **Legal**: Must include Steuer-Nr or USt-IdNr, bank details, Geschäftsführer

### PDF Generation

The existing `pdf-service.js` generates HTML strings and converts them. Follow the same pattern — output an HTML string that the service can render.
