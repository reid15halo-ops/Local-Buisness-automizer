/* ============================================
   OCR Scanner Service (Feature #5)
   Document scanning with text extraction
   ============================================ */

class OcrScannerService {
    constructor() {
        this.scannedDocuments = JSON.parse(localStorage.getItem('mhs_scanned_docs') || '[]');
        this.settings = JSON.parse(localStorage.getItem('mhs_ocr_settings') || '{}');

        // Default settings
        if (!this.settings.language) this.settings.language = 'deu'; // German
        if (!this.settings.autoProcess) this.settings.autoProcess = true;
    }

    // Scan document from file input
    async scanFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const imageData = e.target.result;
                const result = await this.processImage(imageData, file.name);
                resolve(result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Scan from camera capture
    async scanFromCamera(videoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0);

        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        return await this.processImage(imageData, 'camera-scan-' + Date.now() + '.jpg');
    }

    // Process image and extract text
    async processImage(imageData, filename) {
        const doc = {
            id: 'scan-' + Date.now(),
            filename: filename,
            imageData: imageData,
            text: '',
            extractedData: {},
            category: 'uncategorized',
            createdAt: new Date().toISOString(),
            processed: false
        };

        try {
            // Use Tesseract.js for OCR (if available) or fallback to pattern matching
            if (window.Tesseract) {
                const result = await Tesseract.recognize(imageData, this.settings.language, {
                    logger: m => console.log(m)
                });
                doc.text = result.data.text;
                doc.confidence = result.data.confidence;
            } else {
                // Fallback: Create a placeholder and use manual entry
                doc.text = '[OCR nicht verfügbar - manueller Text]';
                doc.requiresManualEntry = true;
            }

            // Extract structured data
            if (doc.text) {
                doc.extractedData = this.extractStructuredData(doc.text);
                doc.category = this.categorizeDocument(doc.text, doc.extractedData);
            }

            doc.processed = true;
            this.scannedDocuments.push(doc);
            this.save();

            return { success: true, document: doc };

        } catch (error) {
            console.error('OCR Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Extract structured data from text
    extractStructuredData(text) {
        const data = {};

        // Extract dates (German format DD.MM.YYYY)
        const dateMatches = text.match(/\d{1,2}\.\d{1,2}\.\d{2,4}/g);
        if (dateMatches) {
            data.dates = dateMatches;
            data.primaryDate = dateMatches[0];
        }

        // Extract amounts (€ xxx,xx or xxx.xxx,xx EUR)
        const amountMatches = text.match(/(?:€\s*)?[\d.,]+(?:\s*€|\s*EUR)?/gi);
        if (amountMatches) {
            data.amounts = amountMatches.map(a => {
                const num = a.replace(/[€EUR\s]/gi, '').replace('.', '').replace(',', '.');
                return parseFloat(num);
            }).filter(n => !isNaN(n) && n > 0);
            if (data.amounts.length > 0) {
                data.totalAmount = Math.max(...data.amounts);
            }
        }

        // Extract invoice/document number
        const invoiceMatch = text.match(/(?:Rechnung|Rechnungs?-?Nr\.?|Invoice|Beleg)[\s:]*([A-Z0-9\-\/]+)/i);
        if (invoiceMatch) {
            data.documentNumber = invoiceMatch[1];
        }

        // Extract IBAN
        const ibanMatch = text.match(/[A-Z]{2}\d{2}\s?(?:\d{4}\s?){4,7}\d{1,4}/);
        if (ibanMatch) {
            data.iban = ibanMatch[0].replace(/\s/g, '');
        }

        // Extract tax ID / Steuernummer
        const taxMatch = text.match(/(?:Steuer-?Nr\.?|USt-IdNr\.?|Steuernummer)[\s:]*([A-Z0-9\/\s]+)/i);
        if (taxMatch) {
            data.taxId = taxMatch[1].trim();
        }

        // Extract phone numbers
        const phoneMatches = text.match(/(?:\+49|0)[0-9\s\-\/]{8,15}/g);
        if (phoneMatches) {
            data.phoneNumbers = phoneMatches.map(p => p.replace(/[\s\-\/]/g, ''));
        }

        // Extract email addresses
        const emailMatches = text.match(/[\w.-]+@[\w.-]+\.\w+/g);
        if (emailMatches) {
            data.emails = emailMatches;
        }

        // Extract company names (heuristic: lines with GmbH, AG, etc.)
        const companyMatch = text.match(/([A-ZÄÖÜa-zäöüß\s]+(?:GmbH|AG|KG|OHG|e\.?K\.?|UG))/);
        if (companyMatch) {
            data.companyName = companyMatch[1].trim();
        }

        return data;
    }

    // Categorize document based on content
    categorizeDocument(text, extractedData) {
        const lowerText = text.toLowerCase();

        if (lowerText.includes('rechnung') || lowerText.includes('invoice')) {
            return extractedData.amounts && extractedData.amounts.length > 0 ? 'rechnung' : 'angebot';
        }
        if (lowerText.includes('quittung') || lowerText.includes('kassenbon') || lowerText.includes('beleg')) {
            return 'quittung';
        }
        if (lowerText.includes('angebot') || lowerText.includes('kostenvoranschlag')) {
            return 'angebot';
        }
        if (lowerText.includes('vertrag') || lowerText.includes('vereinbarung')) {
            return 'vertrag';
        }
        if (lowerText.includes('lieferschein') || lowerText.includes('warenbegleit')) {
            return 'lieferschein';
        }
        if (lowerText.includes('mahnung') || lowerText.includes('zahlungserinnerung')) {
            return 'mahnung';
        }
        if (lowerText.includes('steuer') || lowerText.includes('finanzamt')) {
            return 'steuer';
        }

        return 'sonstiges';
    }

    // Get category display name
    getCategoryName(category) {
        const names = {
            'rechnung': 'Eingangsrechnung',
            'quittung': 'Quittung/Beleg',
            'angebot': 'Angebot',
            'vertrag': 'Vertrag',
            'lieferschein': 'Lieferschein',
            'mahnung': 'Mahnung',
            'steuer': 'Steuer-Dokument',
            'sonstiges': 'Sonstiges',
            'uncategorized': 'Nicht kategorisiert'
        };
        return names[category] || category;
    }

    // Search in scanned documents
    searchDocuments(query) {
        const lowerQuery = query.toLowerCase();
        return this.scannedDocuments.filter(doc =>
            doc.text.toLowerCase().includes(lowerQuery) ||
            doc.filename.toLowerCase().includes(lowerQuery) ||
            JSON.stringify(doc.extractedData).toLowerCase().includes(lowerQuery)
        );
    }

    // Get documents by category
    getByCategory(category) {
        return this.scannedDocuments.filter(doc => doc.category === category);
    }

    // Get all documents
    getDocuments(options = {}) {
        let docs = [...this.scannedDocuments];

        if (options.category) {
            docs = docs.filter(d => d.category === options.category);
        }
        if (options.fromDate) {
            docs = docs.filter(d => d.createdAt >= options.fromDate);
        }
        if (options.toDate) {
            docs = docs.filter(d => d.createdAt <= options.toDate);
        }

        return docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Get document by ID
    getDocument(id) {
        return this.scannedDocuments.find(d => d.id === id);
    }

    // Update document category or extracted data
    updateDocument(id, updates) {
        const doc = this.scannedDocuments.find(d => d.id === id);
        if (doc) {
            Object.assign(doc, updates, { updatedAt: new Date().toISOString() });
            this.save();
            return { success: true, document: doc };
        }
        return { success: false, error: 'Dokument nicht gefunden' };
    }

    // Delete document
    deleteDocument(id) {
        this.scannedDocuments = this.scannedDocuments.filter(d => d.id !== id);
        this.save();
        return { success: true };
    }

    // Create document entry for bookkeeping from scan
    createBookkeepingEntry(docId) {
        const doc = this.getDocument(docId);
        if (!doc || !doc.extractedData) return { success: false };

        if (window.bookkeepingService) {
            const entry = window.bookkeepingService.addBuchung({
                typ: 'ausgabe',
                betrag: doc.extractedData.totalAmount || 0,
                kategorie: 'Wareneinkauf',
                beschreibung: `${doc.extractedData.companyName || 'Gescannter Beleg'} - ${doc.extractedData.documentNumber || doc.filename}`,
                datum: doc.extractedData.primaryDate || new Date().toISOString().split('T')[0],
                belegNummer: doc.extractedData.documentNumber,
                anhang: doc.id
            });
            return { success: true, entry };
        }
        return { success: false, error: 'Buchhaltung nicht verfügbar' };
    }

    // Get statistics
    getStatistics() {
        const byCategory = {};
        this.scannedDocuments.forEach(doc => {
            byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
        });

        return {
            totalDocuments: this.scannedDocuments.length,
            byCategory,
            totalAmount: this.scannedDocuments.reduce((sum, doc) =>
                sum + (doc.extractedData?.totalAmount || 0), 0
            ),
            needsManualEntry: this.scannedDocuments.filter(d => d.requiresManualEntry).length
        };
    }

    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('mhs_ocr_settings', JSON.stringify(this.settings));
    }

    // Persistence
    save() {
        localStorage.setItem('mhs_scanned_docs', JSON.stringify(this.scannedDocuments));
    }
}

window.ocrScannerService = new OcrScannerService();
