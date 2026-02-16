# PDF Generator Tool - Professional German Business Documents

Professional PDF generation for German business documents (Angebote, Rechnungen, Mahnungen) using Python and ReportLab.

## Features

- **Angebot (Quote)** - Professional quote documents with 30-day validity
- **Rechnung (Invoice)** - Full invoices with payment terms and VAT handling
- **Mahnung (Dunning Notice)** - Payment reminders with escalation levels
- **Professional Layout** - DIN 5008 German business letter format
- **German Formatting** - Proper German number format (1.234,56 €) and dates (16.02.2026)
- **Responsive Design** - Clean, professional appearance with company branding

## Installation

```bash
pip install reportlab --break-system-packages
```

## Usage

### Command Line

#### Generate Sample Angebot (Quote)
```bash
python3 tools/pdf-generator.py --type angebot --output angebot.pdf
```

#### Generate Sample Rechnung (Invoice)
```bash
python3 tools/pdf-generator.py --type rechnung --output rechnung.pdf
```

#### Generate Sample Mahnung (Dunning Notice)
```bash
python3 tools/pdf-generator.py --type mahnung --output mahnung.pdf
```

#### Generate with Custom Data
```bash
python3 tools/pdf-generator.py --type rechnung --data '{"number": "RE-2024-042", "company": {...}, "customer": {...}, "positions": [...]}' --output custom-invoice.pdf
```

### Python Module

```python
from pdf_generator import GermanBusinessPDFGenerator

# Prepare data
data = {
    'type': 'rechnung',
    'number': 'RE-2024-001',
    'date': '2026-02-16T10:00:00',
    'company': {
        'name': 'Your Company Name',
        'street': 'Street 123',
        'postal_code': '12345',
        'city': 'Your City',
        'phone': '+49 123 456789',
        'email': 'contact@company.de',
        'tax_id': '12 345 678 901',
        'vat_id': 'DE123456789',
        'iban': 'DE89 3704 0044 0532 0130 00',
        'bic': 'COBADEFFXXX',
        'bank_name': 'Your Bank'
    },
    'customer': {
        'company': 'Customer Company',
        'name': 'Customer Name',
        'street': 'Customer Street 42',
        'postal_code': '60311',
        'city': 'Frankfurt am Main'
    },
    'positions': [
        {
            'description': 'Service Description',
            'quantity': 8,
            'unit': 'Std.',
            'unit_price': 75.00
        },
        {
            'description': 'Material Cost',
            'quantity': 1,
            'unit': 'Paket',
            'unit_price': 150.00
        }
    ],
    'exempt_vat': False  # For invoices: true for Kleinunternehmer
}

# Generate PDF
generator = GermanBusinessPDFGenerator(data)
generator.generate('output.pdf')
```

## Data Format

### Document Types

#### Angebot (Quote)
```json
{
  "type": "angebot",
  "number": "ANG-2024-001",
  "date": "2026-02-16T10:00:00",
  "company": { ... },
  "customer": { ... },
  "positions": [ ... ]
}
```

#### Rechnung (Invoice)
```json
{
  "type": "rechnung",
  "number": "RE-2024-001",
  "date": "2026-02-16T10:00:00",
  "due_date": "02.03.2026",
  "company": { ... },
  "customer": { ... },
  "positions": [ ... ],
  "exempt_vat": false
}
```

#### Mahnung (Dunning Notice)
```json
{
  "type": "mahnung",
  "number": "MA-2024-001",
  "date": "2026-02-16T10:00:00",
  "original_invoice_number": "RE-2024-001",
  "outstanding_amount": 1875.00,
  "dunning_fee": 50.00,
  "company": { ... },
  "customer": { ... },
  "positions": [ ... ]
}
```

### Company Object
```json
{
  "name": "Company Name",
  "street": "Street Address",
  "postal_code": "12345",
  "city": "City Name",
  "phone": "+49 123 456789",
  "email": "contact@company.de",
  "tax_id": "12 345 678 901",
  "vat_id": "DE123456789",
  "iban": "DE89 3704 0044 0532 0130 00",
  "bic": "COBADEFFXXX",
  "bank_name": "Bank Name"
}
```

### Customer Object
```json
{
  "company": "Customer Company (optional)",
  "name": "Customer Name",
  "street": "Street Address",
  "postal_code": "12345",
  "city": "City Name"
}
```

### Position Object
```json
{
  "description": "Item Description",
  "quantity": 8,
  "unit": "Std.",
  "unit_price": 75.00
}
```

## Integration with JavaScript Frontend

Create a service to call the PDF generator from your JavaScript application:

```javascript
// js/services/pdf-generation-service.js
class PDFGenerationService {
    async generatePDF(type, data, filename) {
        // Prepare data for Python script
        const jsonData = JSON.stringify(data);

        // Call backend API that invokes the Python script
        const response = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: type,
                data: jsonData,
                filename: filename
            })
        });

        // Download the PDF
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
        }
    }
}
```

## Design Features

### Colors
- **Header/Dark**: #1a1a2e (Dark navy)
- **Accent**: #6366f1 (Indigo)
- **Light Background**: #f5f5f5 (Light gray)
- **Border**: #e0e0e0 (Subtle gray)
- **Text**: #333333 (Dark gray)

### Layout
- **Page Size**: A4 (210 × 297 mm)
- **Margins**: 20mm top/bottom, 15mm left/right
- **Font**: Helvetica for professional appearance
- **Format**: DIN 5008 German business letter format

### Sections
1. **Header** - Company name on dark background with contact info
2. **Document Title** - Document type and number
3. **Info Block** - Dates and document-specific information
4. **Customer Block** - Customer/client address
5. **Positions Table** - Line items with alternating row colors
6. **Totals Section** - Subtotal, VAT (if applicable), total
7. **Terms & Conditions** - Payment terms or special notes
8. **Footer** - Legal information (tax ID, VAT ID, bank details)

## Sample PDFs

Three sample PDFs are included:
- `samples/sample-angebot.pdf` - Quote example
- `samples/sample-rechnung.pdf` - Invoice example
- `samples/sample-mahnung.pdf` - Dunning notice example

## Number Formatting

German number format is automatically applied:
- Thousands separator: `.` (dot)
- Decimal separator: `,` (comma)
- Currency: Always followed by ` €`

Examples:
- 1234.56 → 1.234,56 €
- 100.00 → 100,00 €

## Date Formatting

German date format (DD.MM.YYYY):
- 2026-02-16 → 16.02.2026

## VAT Handling

### Standard (19% VAT)
- Used by default
- Shows "Zwischensumme", "MwSt. (19%)", "Gesamtbetrag"

### Exempt (Kleinunternehmer - Small Business)
- Set `exempt_vat: true` in invoice
- Shows notice: "Gemäß §19 UStG wird keine Umsatzsteuer berechnet"

## Legal Compliance

- German §14 UStG compliance for invoice elements
- Proper VAT handling (19% or exempt)
- Bank details and tax information in footer
- Professional German business letter format

## Troubleshooting

### ReportLab Not Found
```bash
pip install reportlab --break-system-packages
```

### JSON Parsing Error
Ensure JSON is properly formatted and escaped when passed via command line.

### PDF Not Generated
Check error output for details. Common issues:
- Missing required fields in data
- Invalid file path for output
- Permission issues with output directory

## Performance

- File size: ~3-4KB per PDF (highly compressed)
- Generation time: <500ms per document
- No external dependencies beyond ReportLab

## Future Enhancements

- [ ] Multiple language support (EN, FR, ES, IT)
- [ ] Company logo integration
- [ ] Custom templates
- [ ] Email integration for auto-sending
- [ ] Payment QR code support (German standards)
- [ ] Multi-page position lists
- [ ] Custom fonts and colors
