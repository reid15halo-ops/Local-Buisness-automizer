# PDF Generator - Quick Start Guide

Get up and running with professional German business PDFs in minutes.

## Installation (30 seconds)

```bash
pip install reportlab --break-system-packages
```

## Generate Your First PDF (1 minute)

### Option 1: Sample Documents
```bash
# Generate a sample quote
python3 tools/pdf-generator.py --type angebot --output my-quote.pdf

# Generate a sample invoice
python3 tools/pdf-generator.py --type rechnung --output my-invoice.pdf

# Generate a sample dunning notice
python3 tools/pdf-generator.py --type mahnung --output my-reminder.pdf
```

### Option 2: Use Your Own Data
```bash
python3 tools/pdf-generator.py --type rechnung \
  --data @tools/sample-data-rechnung.json \
  --output custom-invoice.pdf
```

## Verify Installation

```bash
python3 tools/test-pdf-generator.py
```

Expected: **11 tests passed**

## Data Format

All documents need this basic structure:

```json
{
  "type": "rechnung",
  "number": "RE-2024-001",
  "date": "2026-02-16T10:00:00",
  "company": {
    "name": "Your Company",
    "street": "Street 123",
    "postal_code": "12345",
    "city": "City Name",
    "phone": "+49 123 456789",
    "email": "contact@company.de",
    "tax_id": "12 345 678 901",
    "vat_id": "DE123456789",
    "iban": "DE89 3704 0044 0532 0130 00",
    "bic": "COBADEFFXXX",
    "bank_name": "Your Bank"
  },
  "customer": {
    "company": "Customer Company",
    "name": "Customer Name",
    "street": "Customer Street 42",
    "postal_code": "60311",
    "city": "City Name"
  },
  "positions": [
    {
      "description": "Service Description",
      "quantity": 8,
      "unit": "Std.",
      "unit_price": 75.00
    }
  ]
}
```

## Quick Examples

### Create Invoice with Custom Data

```python
from pdf_generator import GermanBusinessPDFGenerator

data = {
    "type": "rechnung",
    "number": "RE-2024-042",
    "company": {
        "name": "FreyAI Visions",
        "street": "Main Street 1",
        "postal_code": "63843",
        "city": "Musterstadt",
        "phone": "+49 6029 9922964",
        "email": "info@freyai-visions.de",
        "tax_id": "12 345 678 901",
        "vat_id": "DE123456789",
        "iban": "DE89 3704 0044 0532 0130 00",
        "bic": "COBADEFFXXX",
        "bank_name": "Commerzbank"
    },
    "customer": {
        "name": "John Doe",
        "street": "Customer St 10",
        "postal_code": "60311",
        "city": "Frankfurt"
    },
    "positions": [
        {
            "description": "Hydraulic System Installation",
            "quantity": 16,
            "unit": "Std.",
            "unit_price": 75.00
        },
        {
            "description": "Materials and Parts",
            "quantity": 1,
            "unit": "Paket",
            "unit_price": 320.00
        }
    ]
}

generator = GermanBusinessPDFGenerator(data)
generator.generate('my-invoice.pdf')
```

### Create Quote

```bash
python3 tools/pdf-generator.py --type angebot --output quote.pdf
```

### Create Dunning Notice

```bash
python3 tools/pdf-generator.py --type mahnung --output dunning.pdf
```

## What You Get

Each PDF includes:
- ✅ Professional header with company branding
- ✅ Document number and date
- ✅ Customer information block
- ✅ Itemized positions table with alternating row colors
- ✅ Automatic calculations (subtotal, VAT, total)
- ✅ Payment terms and legal information
- ✅ Footer with tax/bank details
- ✅ German formatting (numbers, dates, currency)
- ✅ DIN 5008 compliant layout

## Document Types

| Type | Use Case | Features |
|------|----------|----------|
| **Angebot** | Quote/Estimate | 30-day validity, no payment info yet |
| **Rechnung** | Invoice | Payment terms, bank details, VAT handling |
| **Mahnung** | Dunning Notice | References original invoice, tracks arrears |

## Integrate with Your App

### JavaScript Example

```javascript
// Call Python backend to generate PDF
async function downloadInvoice(invoiceData) {
    const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'rechnung',
            data: invoiceData,
            filename: 'RE-2024-001.pdf'
        })
    });

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RE-2024-001.pdf';
    a.click();
}
```

## Command Line Reference

### Generate Angebot
```bash
python3 tools/pdf-generator.py --type angebot --output angebot.pdf
```

### Generate Rechnung
```bash
python3 tools/pdf-generator.py --type rechnung --output rechnung.pdf
```

### Generate Mahnung
```bash
python3 tools/pdf-generator.py --type mahnung --output mahnung.pdf
```

### With Custom Data
```bash
python3 tools/pdf-generator.py \
  --type rechnung \
  --data '{"number": "RE-2024-001", "company": {...}, ...}' \
  --output invoice.pdf
```

### With JSON File
```bash
python3 tools/pdf-generator.py \
  --type rechnung \
  --data @sample-data-rechnung.json \
  --output invoice.pdf
```

## Features at a Glance

- **German Formatting**: Numbers (1.234,56), Dates (16.02.2026), Currency (€)
- **Professional Design**: Dark header, indigo accents, clean typography
- **Legal Compliance**: §14 UStG, §19 UStG, VAT handling
- **Customizable**: Company data, positions, amounts all configurable
- **Fast**: Generates PDFs in < 500ms
- **Lightweight**: ~3KB per PDF
- **No External Dependencies**: Only requires ReportLab

## Troubleshooting

### Python not found
```bash
# Use python3 explicitly
python3 tools/pdf-generator.py --type angebot --output test.pdf
```

### ReportLab error
```bash
# Install again
pip install reportlab --break-system-packages
```

### Permission denied
```bash
# Make script executable
chmod +x tools/pdf-generator.py
```

### PDF not created
- Check output directory exists and is writable
- Verify JSON data format is correct
- Check error output for details

## Next Steps

1. ✅ Install reportlab
2. ✅ Run test suite: `python3 tools/test-pdf-generator.py`
3. ✅ Generate sample PDFs
4. ✅ Customize with your company data
5. ✅ Integrate with backend API
6. ✅ Add to frontend application

## Full Documentation

For detailed information, see:
- **Usage Guide**: `README.md`
- **Backend Integration**: `INTEGRATION_GUIDE.md`
- **Complete Summary**: `PDF_GENERATOR_SUMMARY.md`
- **Sample Data**: `sample-data-*.json`

## Support

Run tests to verify everything works:
```bash
python3 tools/test-pdf-generator.py
```

Check sample PDFs in:
- `tools/samples/` - Generated examples
- `mnt/outputs/` - Distributed copies

Enjoy your professional German business PDFs!
