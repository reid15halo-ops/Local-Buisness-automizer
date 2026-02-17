# PDF Generator Integration Guide

Complete guide to integrate the Python PDF generator with the existing JavaScript application.

## Architecture Overview

```
JavaScript Application (Browser)
        ↓
[pdf-generation-service.js] ← Sends JSON
        ↓
Backend API Endpoint
        ↓
[pdf-generator.py] ← Generates PDF
        ↓
Browser Downloads PDF
```

## Backend Integration

### Node.js/Express Integration

Create a backend endpoint that calls the Python script:

```javascript
// backend/routes/pdf.js
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const router = express.Router();

router.post('/generate-pdf', (req, res) => {
    const { type, data, filename } = req.body;

    // Validate input
    if (!['angebot', 'rechnung', 'mahnung'].includes(type)) {
        return res.status(400).json({ error: 'Invalid document type' });
    }

    const outputPath = path.join(__dirname, '../../tmp', filename);
    const pythonScript = path.join(__dirname, '../../tools/pdf-generator.py');

    // Ensure tmp directory exists
    if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }

    // Spawn Python process
    const python = spawn('python3', [
        pythonScript,
        '--type', type,
        '--data', JSON.stringify(data),
        '--output', outputPath
    ]);

    let errorOutput = '';

    python.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    python.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).json({
                error: 'PDF generation failed',
                details: errorOutput
            });
        }

        // Send file
        res.download(outputPath, filename, (err) => {
            if (err) console.error('Download error:', err);
            // Clean up temp file
            fs.unlink(outputPath, (err) => {
                if (err) console.error('Cleanup error:', err);
            });
        });
    });

    python.on('error', (err) => {
        res.status(500).json({
            error: 'Failed to spawn process',
            details: err.message
        });
    });
});

module.exports = router;
```

### Integration in Server

```javascript
// server.js or app.js
const pdfRoutes = require('./routes/pdf');
app.use('/api', pdfRoutes);
```

## Frontend Integration

### Update PDF Generation Service

Enhance the existing `pdf-generation-service.js`:

```javascript
// js/services/pdf-generation-service.js
class PDFGenerationService {
    /**
     * Generate PDF using Python backend
     * @param {string} type - 'angebot', 'rechnung', or 'mahnung'
     * @param {Object} data - Document data
     * @returns {Promise<void>}
     */
    async generatePDF(type, data) {
        try {
            // Prepare filename
            const filename = this._generateFilename(type, data.number);

            // Send to backend
            const response = await fetch('/api/generate-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: type,
                    data: data,
                    filename: filename
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details || error.error);
            }

            // Download PDF
            const blob = await response.blob();
            this._downloadBlob(blob, filename);

        } catch (error) {
            console.error('PDF generation error:', error);
            throw error;
        }
    }

    /**
     * Generate Angebot (Quote)
     */
    async generateAngebot(invoiceData) {
        const data = this._prepareData('angebot', invoiceData);
        return this.generatePDF('angebot', data);
    }

    /**
     * Generate Rechnung (Invoice)
     */
    async generateRechnung(invoiceData) {
        const data = this._prepareData('rechnung', invoiceData);
        return this.generatePDF('rechnung', data);
    }

    /**
     * Generate Mahnung (Dunning Notice)
     */
    async generateMahnung(invoiceData, mahnungData) {
        const data = this._prepareData('mahnung', invoiceData);
        data.original_invoice_number = mahnungData.original_invoice_number;
        data.outstanding_amount = mahnungData.outstanding_amount;
        data.dunning_fee = mahnungData.dunning_fee;
        return this.generatePDF('mahnung', data);
    }

    /**
     * Prepare data from invoice service format
     */
    _prepareData(type, invoiceData) {
        // Get company data from existing service
        const companyData = this._getCompanyData();
        const customerData = this._getCustomerData(invoiceData);
        const positions = this._getPositions(invoiceData);

        return {
            type: type,
            number: invoiceData.number,
            date: invoiceData.date || new Date().toISOString(),
            due_date: invoiceData.due_date,
            company: companyData,
            customer: customerData,
            positions: positions,
            exempt_vat: invoiceData.exempt_vat || false
        };
    }

    /**
     * Get company data from storeService
     */
    _getCompanyData() {
        if (window.storeService) {
            const company = window.storeService.getCompanyData();
            return {
                name: company.name,
                street: company.street,
                postal_code: company.postal_code,
                city: company.city,
                phone: company.phone,
                email: company.email,
                tax_id: company.tax_id,
                vat_id: company.vat_id,
                iban: company.iban,
                bic: company.bic,
                bank_name: company.bank_name
            };
        }

        // Fallback to defaults
        return {
            name: 'FreyAI Visions',
            street: 'Musterstraße 123',
            postal_code: '63843',
            city: 'Musterstadt',
            phone: '+49 6029 9922964',
            email: 'info@freyai-visions.de',
            tax_id: '12 345 678 901',
            vat_id: 'DE123456789',
            iban: 'DE89 3704 0044 0532 0130 00',
            bic: 'COBADEFFXXX',
            bank_name: 'Commerzbank'
        };
    }

    /**
     * Get customer data from invoice
     */
    _getCustomerData(invoiceData) {
        const customer = invoiceData.customer || {};
        return {
            company: customer.company || '',
            name: customer.name || customer.customer_name || '',
            street: customer.street || customer.customer_street || '',
            postal_code: customer.postal_code || customer.customer_postal_code || '',
            city: customer.city || customer.customer_city || ''
        };
    }

    /**
     * Get positions from invoice
     */
    _getPositions(invoiceData) {
        return (invoiceData.positions || invoiceData.positionen || []).map(pos => ({
            description: pos.description || pos.beschreibung || '',
            quantity: parseFloat(pos.quantity || pos.menge || 0),
            unit: pos.unit || pos.einheit || 'Std.',
            unit_price: parseFloat(pos.unit_price || pos.einzelpreis || 0)
        }));
    }

    /**
     * Generate filename based on type and number
     */
    _generateFilename(type, number) {
        const timestamp = new Date().toISOString().split('T')[0];
        const typePrefix = {
            'angebot': 'ANG',
            'rechnung': 'RE',
            'mahnung': 'MA'
        }[type];

        return `${typePrefix}-${number}-${timestamp}.pdf`;
    }

    /**
     * Trigger browser download
     */
    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Initialize service
if (!window.pdfGenerationService) {
    window.pdfGenerationService = new PDFGenerationService();
}
```

## Usage in Application

### Generate Angebot from Invoice Form

```javascript
// In your invoice form component
async function downloadAngebot(invoiceData) {
    try {
        await window.pdfGenerationService.generateAngebot(invoiceData);
        // Show success message
    } catch (error) {
        console.error('Failed to generate Angebot:', error);
        // Show error message to user
    }
}
```

### Generate Rechnung from Invoice

```javascript
async function downloadRechnung(invoiceData) {
    try {
        await window.pdfGenerationService.generateRechnung(invoiceData);
        // Show success message
    } catch (error) {
        console.error('Failed to generate Rechnung:', error);
        // Show error message to user
    }
}
```

### Generate Mahnung (Dunning Notice)

```javascript
async function downloadMahnung(invoiceData, mahnungData) {
    try {
        await window.pdfGenerationService.generateMahnung(invoiceData, {
            original_invoice_number: invoiceData.number,
            outstanding_amount: invoiceData.total,
            dunning_fee: 50.00
        });
        // Show success message
    } catch (error) {
        console.error('Failed to generate Mahnung:', error);
        // Show error message to user
    }
}
```

## HTML Integration

Add buttons to your invoice interface:

```html
<div class="pdf-actions">
    <button onclick="downloadAngebot()" class="btn btn-primary">
        <i class="fas fa-file-pdf"></i> Angebot als PDF
    </button>
    <button onclick="downloadRechnung()" class="btn btn-primary">
        <i class="fas fa-file-pdf"></i> Rechnung als PDF
    </button>
    <button onclick="downloadMahnung()" class="btn btn-warning">
        <i class="fas fa-file-pdf"></i> Mahnung als PDF
    </button>
</div>
```

## Docker Setup (Optional)

If using Docker for the backend:

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install Python
RUN apk add --no-cache python3 py3-pip

# Install Python dependencies
RUN pip install reportlab --break-system-packages

# Copy application
COPY . /app
WORKDIR /app

# Install Node dependencies
RUN npm install

# Start application
CMD ["node", "server.js"]
```

## Error Handling

The service includes comprehensive error handling:

```javascript
try {
    await pdfGenerationService.generateRechnung(invoiceData);
} catch (error) {
    if (error.message.includes('JSON')) {
        // JSON parsing error
        showError('Invalid invoice data format');
    } else if (error.status === 400) {
        // Invalid document type
        showError('Unsupported document type');
    } else {
        // General error
        showError('Failed to generate PDF: ' + error.message);
    }
}
```

## Performance Optimization

### Caching Generated PDFs

```javascript
class PDFCache {
    constructor(maxSize = 10) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    getKey(type, data) {
        return `${type}-${data.number}-${JSON.stringify(data).hashCode()}`;
    }

    get(type, data) {
        return this.cache.get(this.getKey(type, data));
    }

    set(type, data, blob) {
        const key = this.getKey(type, data);
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, blob);
    }
}
```

## Testing

### Test PDF Generation

```bash
# Test angebot
python3 tools/pdf-generator.py --type angebot --output test-angebot.pdf

# Test with custom data
python3 tools/pdf-generator.py --type rechnung \
    --data @tools/sample-data-rechnung.json \
    --output test-rechnung.pdf

# Test mahnung
python3 tools/pdf-generator.py --type mahnung --output test-mahnung.pdf
```

## Troubleshooting

### PDF Generation Hangs

Ensure Python process has proper permissions and resources.

### Memory Issues with Large PDFs

The script is optimized for typical business documents (single page). For larger documents, consider implementing pagination.

### Unicode Characters Not Displaying

Helvetica supports standard Latin characters. For special characters, consider adding font support:

```python
# In pdf-generator.py
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register custom font if needed
```

## Security Considerations

1. **Input Validation** - All data from frontend should be validated on backend
2. **File Cleanup** - Temporary files are automatically deleted after download
3. **No Sensitive Data in URLs** - All data sent via POST body, not query parameters
4. **File Size Limits** - Implement size checks for position lists
5. **Rate Limiting** - Consider adding rate limiting to PDF generation endpoint

## Future Enhancements

- [ ] Direct email sending of PDFs
- [ ] Batch PDF generation
- [ ] Custom templates per company
- [ ] QR code for invoice reference
- [ ] Digital signature support
- [ ] Archive storage integration
