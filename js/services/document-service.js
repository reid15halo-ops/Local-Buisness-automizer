/* ============================================
   Document Service - Scanner & OCR
   Dokumentendigitalisierung mit Texterkennung
   ============================================ */

class DocumentService {
    constructor() {
        this.documents = JSON.parse(localStorage.getItem('freyai_documents') || '[]');
        this.categories = ['rechnung', 'quittung', 'vertrag', 'angebot', 'lieferschein', 'sonstiges'];
        this.ocrLibLoaded = false;
    }

    // Document CRUD
    addDocument(doc) {
        const newDoc = {
            id: doc.id || this.generateId(),
            name: doc.name,
            category: doc.category || 'sonstiges',
            tags: doc.tags || [],
            content: doc.content || '', // Base64 image or text
            ocrText: doc.ocrText || '',
            fileType: doc.fileType || 'image',
            fileSize: doc.fileSize || 0,
            extractedData: doc.extractedData || {},
            customerId: doc.customerId || null,
            auftragId: doc.auftragId || null,
            rechnungId: doc.rechnungId || null,
            createdAt: new Date().toISOString(),
            source: doc.source || 'scan' // scan, upload, email
        };

        this.documents.push(newDoc);
        this.save();
        return newDoc;
    }

    updateDocument(id, updates) {
        const index = this.documents.findIndex(d => d.id === id);
        if (index !== -1) {
            this.documents[index] = { ...this.documents[index], ...updates };
            this.save();
            return this.documents[index];
        }
        return null;
    }

    deleteDocument(id) {
        this.documents = this.documents.filter(d => d.id !== id);
        this.save();
    }

    getDocument(id) { return this.documents.find(d => d.id === id); }
    getAllDocuments() { return this.documents; }
    getDocumentsByCategory(category) { return this.documents.filter(d => d.category === category); }
    getDocumentsForCustomer(customerId) { return this.documents.filter(d => d.customerId === customerId); }

    // Camera/File Capture
    async captureFromCamera() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment'; // Use back camera on mobile

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const base64 = await this.fileToBase64(file);
                    resolve({ content: base64, fileType: file.type, fileName: file.name, fileSize: file.size });
                } else {
                    reject(new Error('Keine Datei ausgewählt'));
                }
            };
            input.click();
        });
    }

    async uploadDocument() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,.pdf';

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const base64 = await this.fileToBase64(file);
                    resolve({ content: base64, fileType: file.type, fileName: file.name, fileSize: file.size });
                } else {
                    reject(new Error('Keine Datei ausgewählt'));
                }
            };
            input.click();
        });
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // OCR with Tesseract.js
    async loadOCRLibrary() {
        if (this.ocrLibLoaded) {return true;}
        // Check if Tesseract is available
        if (typeof Tesseract !== 'undefined') {
            this.ocrLibLoaded = true;
            return true;
        }
        // Load Tesseract.js from CDN
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
            script.onload = () => { this.ocrLibLoaded = true; resolve(true); };
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        });
    }

    async performOCR(imageBase64, lang = 'deu') {
        const loaded = await this.loadOCRLibrary();
        if (!loaded || typeof Tesseract === 'undefined') {
            console.warn('Tesseract nicht verfügbar, verwende Fallback');
            return this.ocrFallback(imageBase64);
        }

        try {
            const result = await Tesseract.recognize(imageBase64, lang, {
                logger: m => console.log(m.status, Math.round(m.progress * 100) + '%')
            });
            return {
                text: result.data.text,
                confidence: result.data.confidence,
                words: result.data.words
            };
        } catch (error) {
            console.error('OCR Error:', error);
            return this.ocrFallback(imageBase64);
        }
    }

    ocrFallback(imageBase64) {
        // Fallback: Return placeholder text for demo
        return {
            text: '[OCR nicht verfügbar - Bitte Text manuell eingeben]',
            confidence: 0,
            words: []
        };
    }

    // Extract Data from OCR Text
    extractReceiptData(ocrText) {
        const data = {
            datum: null,
            betrag: null,
            mwst: null,
            firma: null,
            kategorie: null
        };

        // Extract date (German format)
        const dateMatch = ocrText.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
        if (dateMatch) {
            const year = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
            data.datum = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
        }

        // Extract amounts
        const amountMatches = ocrText.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2}))\s*€?/g);
        if (amountMatches && amountMatches.length > 0) {
            const amounts = amountMatches.map(a =>
                parseFloat(a.replace('.', '').replace(',', '.').replace('€', ''))
            ).filter(a => !isNaN(a));

            if (amounts.length > 0) {
                data.betrag = Math.max(...amounts); // Assume largest is total
            }
        }

        // Extract VAT
        const mwstMatch = ocrText.match(/MwSt\.?\s*(\d+)\s*%/i) || ocrText.match(/(\d+)\s*%\s*MwSt/i);
        if (mwstMatch) {
            data.mwst = parseInt(mwstMatch[1]);
        }

        // Try to extract company name (first line usually)
        const lines = ocrText.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
            data.firma = lines[0].trim();
        }

        // Categorize based on keywords
        const textLower = ocrText.toLowerCase();
        if (textLower.includes('tankstelle') || textLower.includes('benzin') || textLower.includes('diesel')) {
            data.kategorie = 'Kraftstoff';
        } else if (textLower.includes('büro') || textLower.includes('office')) {
            data.kategorie = 'Bürobedarf';
        } else if (textLower.includes('restaurant') || textLower.includes('gaststätte')) {
            data.kategorie = 'Bewirtung';
        } else if (textLower.includes('hotel') || textLower.includes('übernachtung')) {
            data.kategorie = 'Reisekosten';
        }

        return data;
    }

    // Scan and Process Complete Flow
    async scanAndProcess(options = {}) {
        try {
            // Capture image
            const captured = await (options.fromCamera ? this.captureFromCamera() : this.uploadDocument());

            // Perform OCR
            const ocrResult = await this.performOCR(captured.content, options.lang || 'deu');

            // Extract data
            const extractedData = this.extractReceiptData(ocrResult.text);

            // Auto-categorize
            let category = 'sonstiges';
            if (extractedData.kategorie) {
                category = 'quittung';
            }
            if (ocrResult.text.toLowerCase().includes('rechnung')) {
                category = 'rechnung';
            }

            // Create document
            const doc = this.addDocument({
                name: captured.fileName || `Scan_${new Date().toISOString().split('T')[0]}`,
                category: category,
                content: captured.content,
                fileType: captured.fileType,
                fileSize: captured.fileSize,
                ocrText: ocrResult.text,
                extractedData: extractedData
            });

            return {
                success: true,
                document: doc,
                ocrText: ocrResult.text,
                extractedData: extractedData,
                confidence: ocrResult.confidence
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Create Buchung from scanned receipt
    createBuchungFromScan(document) {
        if (!document.extractedData || !document.extractedData.betrag) {
            return null;
        }

        return {
            datum: document.extractedData.datum || new Date().toISOString().split('T')[0],
            art: 'ausgabe',
            betrag: document.extractedData.betrag,
            kategorie: document.extractedData.kategorie || 'Sonstiges',
            beschreibung: document.extractedData.firma || document.name,
            mwstSatz: document.extractedData.mwst || 19,
            belegId: document.id,
            quelle: 'scan'
        };
    }

    // Search in OCR text
    searchDocuments(query) {
        const q = query.toLowerCase();
        return this.documents.filter(d =>
            d.name.toLowerCase().includes(q) ||
            d.ocrText.toLowerCase().includes(q) ||
            d.tags.some(t => t.toLowerCase().includes(q)) ||
            d.extractedData?.firma?.toLowerCase().includes(q)
        );
    }

    // Helpers
    generateId() { return 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9); }

    getCategoryIcon(cat) {
        const icons = {
            rechnung: '📄', quittung: '🧾', vertrag: '📝',
            angebot: '📋', lieferschein: '📦', sonstiges: '📎'
        };
        return icons[cat] || '📎';
    }

    getCategoryLabel(cat) {
        const labels = {
            rechnung: 'Rechnung', quittung: 'Quittung', vertrag: 'Vertrag',
            angebot: 'Angebot', lieferschein: 'Lieferschein', sonstiges: 'Sonstiges'
        };
        return labels[cat] || cat;
    }

    formatFileSize(bytes) {
        if (bytes < 1024) {return bytes + ' B';}
        if (bytes < 1024 * 1024) {return (bytes / 1024).toFixed(1) + ' KB';}
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Persistence
    save() { localStorage.setItem('freyai_documents', JSON.stringify(this.documents)); }
}

window.documentService = new DocumentService();
