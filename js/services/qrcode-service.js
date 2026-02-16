/* ============================================
   QR Code Service
   Generate QR codes for invoices and payments
   ============================================ */

class QrCodeService {
    constructor() {
        this.generatedCodes = JSON.parse(localStorage.getItem('mhs_qrcodes') || '[]');
        this.settings = JSON.parse(localStorage.getItem('mhs_qr_settings') || '{}');

        // Default settings
        if (!this.settings.size) {this.settings.size = 200;}
        if (!this.settings.errorCorrection) {this.settings.errorCorrection = 'M';}
        if (!this.settings.includePaymentLink) {this.settings.includePaymentLink = true;}
    }

    // Generate QR code as data URL
    async generateQrCode(data, options = {}) {
        const size = options.size || this.settings.size;

        // Use QR Server API (free, no key required)
        const encodedData = encodeURIComponent(data);
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}`;

        // For offline use, create simple QR placeholder
        const qrRecord = {
            id: 'qr-' + Date.now(),
            data: data,
            url: url,
            type: options.type || 'custom',
            referenceId: options.referenceId || null,
            createdAt: new Date().toISOString()
        };

        this.generatedCodes.push(qrRecord);
        this.save();

        return {
            success: true,
            qrCode: qrRecord,
            imageUrl: url
        };
    }

    // Generate QR code for invoice
    async generateInvoiceQr(invoice) {
        // Create payment data string
        const paymentData = this.createGiroCodeData(invoice);

        const qr = await this.generateQrCode(paymentData, {
            type: 'invoice',
            referenceId: invoice.id || invoice.nummer
        });

        return qr;
    }

    // Generate EPC/GiroCode QR for SEPA payment
    createGiroCodeData(invoice) {
        // EPC QR Code format for SEPA Credit Transfer
        const amount = invoice.betrag || 0;
        const iban = this.settings.iban || 'DE89370400440532013000';
        const bic = this.settings.bic || 'COBADEFFXXX';
        const recipient = this.settings.recipientName || 'MHS Metallbau Hydraulik Service';
        const reference = invoice.nummer || invoice.id;

        // EPC QR Code format
        const giroCode = [
            'BCD',           // Service Tag
            '002',           // Version
            '1',             // Character set (UTF-8)
            'SCT',           // Identification
            bic,             // BIC
            recipient,       // Recipient name
            iban,            // IBAN
            `EUR${amount.toFixed(2)}`, // Amount
            '',              // Purpose code (optional)
            reference,       // Reference
            '',              // Unstructured reference
            ''               // Information
        ].join('\n');

        return giroCode;
    }

    // Generate QR for payment link
    async generatePaymentLinkQr(paymentLink) {
        return await this.generateQrCode(paymentLink.url, {
            type: 'payment',
            referenceId: paymentLink.id
        });
    }

    // Generate QR for customer contact
    async generateContactQr(customer) {
        // vCard format
        const vCard = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `N:${customer.nachname || ''};${customer.vorname || customer.name || ''}`,
            `FN:${customer.name || customer.firma}`,
            customer.firma ? `ORG:${customer.firma}` : '',
            customer.telefon ? `TEL:${customer.telefon}` : '',
            customer.email ? `EMAIL:${customer.email}` : '',
            customer.adresse ? `ADR:;;${customer.strasse || ''};${customer.ort || ''};${customer.plz || ''};;` : '',
            'END:VCARD'
        ].filter(Boolean).join('\n');

        return await this.generateQrCode(vCard, {
            type: 'contact',
            referenceId: customer.id
        });
    }

    // Generate QR for appointment
    async generateAppointmentQr(appointment) {
        // Calendar event URL
        const startDate = new Date(`${appointment.date}T${appointment.startTime}`);
        const endDate = new Date(`${appointment.date}T${appointment.endTime || appointment.startTime}`);

        const calendarUrl = this.createGoogleCalendarUrl(
            appointment.title,
            startDate,
            endDate,
            appointment.ort || appointment.location || '',
            appointment.beschreibung || ''
        );

        return await this.generateQrCode(calendarUrl, {
            type: 'appointment',
            referenceId: appointment.id
        });
    }

    // Create Google Calendar URL
    createGoogleCalendarUrl(title, start, end, location, description) {
        const formatDate = (date) => {
            return date.toISOString().replace(/-|:|\.\d{3}/g, '');
        };

        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: title,
            dates: `${formatDate(start)}/${formatDate(end)}`,
            location: location,
            details: description
        });

        return `https://www.google.com/calendar/render?${params.toString()}`;
    }

    // Generate QR for WiFi (for customer display)
    async generateWifiQr(ssid, password, security = 'WPA') {
        const wifiString = `WIFI:T:${security};S:${ssid};P:${password};;`;

        return await this.generateQrCode(wifiString, {
            type: 'wifi'
        });
    }

    // Generate QR for product/material
    async generateProductQr(product) {
        const productData = JSON.stringify({
            type: 'product',
            id: product.id,
            name: product.name,
            sku: product.artikelnummer || product.barcode,
            price: product.preis
        });

        return await this.generateQrCode(productData, {
            type: 'product',
            referenceId: product.id
        });
    }

    // Get QR code image element
    createQrImage(qrCode, options = {}) {
        const img = document.createElement('img');
        img.src = qrCode.imageUrl;
        img.alt = 'QR Code';
        img.style.width = (options.size || this.settings.size) + 'px';
        img.style.height = (options.size || this.settings.size) + 'px';
        return img;
    }

    // Download QR code
    async downloadQrCode(qrCode, filename) {
        try {
            const response = await fetch(qrCode.imageUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `qr-${qrCode.id}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get generated QR codes
    getQrCodes(type = null) {
        let codes = [...this.generatedCodes];
        if (type) {
            codes = codes.filter(c => c.type === type);
        }
        return codes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Get QR code by reference
    getQrByReference(type, referenceId) {
        return this.generatedCodes.find(c =>
            c.type === type && c.referenceId === referenceId
        );
    }

    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('mhs_qr_settings', JSON.stringify(this.settings));
    }

    // Persistence
    save() {
        // Keep last 100 QR codes
        if (this.generatedCodes.length > 100) {
            this.generatedCodes = this.generatedCodes.slice(-100);
        }
        localStorage.setItem('mhs_qrcodes', JSON.stringify(this.generatedCodes));
    }
}

window.qrCodeService = new QrCodeService();
