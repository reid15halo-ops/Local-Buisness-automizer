/* ============================================
   Document Service - Scanner & OCR
   Dokumentendigitalisierung mit Texterkennung
   ============================================ */

class DocumentService {
    constructor() {
        try { this.documents = JSON.parse(localStorage.getItem('freyai_documents') || '[]'); } catch { this.documents = []; }
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
                    if (file.size > 10 * 1024 * 1024) {
                        window.showToast?.('Datei zu groß (max. 10 MB)', 'error');
                        resolve(null);
                        return;
                    }
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
                    if (file.size > 10 * 1024 * 1024) {
                        window.showToast?.('Datei zu groß (max. 10 MB)', 'error');
                        resolve(null);
                        return;
                    }
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
            script.integrity = 'sha384-+56qagDlzJ3YYkDcyAXRdhrP7/+ai8qJcS6HpjACl2idDoCyCqRf5VVi7E/XkGae';
            script.crossOrigin = 'anonymous';
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
                logger: () => {}
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

    ocrFallback(_imageBase64) {
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

    // ============================================
    // Paperless-ngx Integration
    // ============================================

    get paperlessUrl() {
        return (window.APP_CONFIG?.PAPERLESS_URL || '').replace(/\/+$/, '');
    }

    get paperlessHeaders() {
        const token = window.APP_CONFIG?.PAPERLESS_TOKEN || '';
        return {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    // Map Paperless document_type names to app categories
    paperlessTypeToCategory(typeName) {
        if (!typeName) return 'sonstiges';
        const name = typeName.toLowerCase();
        const map = {
            'rechnung': 'rechnung', 'invoice': 'rechnung',
            'quittung': 'quittung', 'receipt': 'quittung', 'kassenbon': 'quittung',
            'vertrag': 'vertrag', 'contract': 'vertrag',
            'angebot': 'angebot', 'offer': 'angebot', 'quote': 'angebot',
            'lieferschein': 'lieferschein', 'delivery note': 'lieferschein'
        };
        for (const [key, cat] of Object.entries(map)) {
            if (name.includes(key)) return cat;
        }
        return 'sonstiges';
    }

    async paperlessFetch(endpoint, params = {}) {
        const url = new URL(`${this.paperlessUrl}/api/${endpoint}`);
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
        });
        const res = await fetch(url.toString(), { headers: this.paperlessHeaders });
        if (!res.ok) throw new Error(`Paperless API Fehler: ${res.status} ${res.statusText}`);
        return res.json();
    }

    // List documents with optional pagination
    async paperlessListDocuments(page = 1, pageSize = 25) {
        return this.paperlessFetch('documents/', { page, page_size: pageSize });
    }

    // Search documents by query string (uses Paperless full-text search)
    async paperlessSearchDocuments(query, page = 1, pageSize = 25) {
        return this.paperlessFetch('documents/', { query, page, page_size: pageSize });
    }

    // Filter documents by tag ID(s)
    async paperlessFilterByTag(tagId, page = 1) {
        return this.paperlessFetch('documents/', {
            tags__id__in: Array.isArray(tagId) ? tagId.join(',') : tagId,
            page
        });
    }

    // Filter documents by document type ID
    async paperlessFilterByType(typeId, page = 1) {
        return this.paperlessFetch('documents/', { document_type__id: typeId, page });
    }

    // Get a single document's metadata
    async paperlessGetDocument(id) {
        return this.paperlessFetch(`documents/${id}/`);
    }

    // Fetch thumbnail as blob URL (avoids token in URL)
    async paperlessThumbnailUrl(id) {
        try {
            const res = await fetch(`${this.paperlessUrl}/api/documents/${id}/thumb/`, { headers: this.paperlessHeaders });
            if (!res.ok) return '';
            const blob = await res.blob();
            return URL.createObjectURL(blob);
        } catch { return ''; }
    }

    // Fetch download as blob URL (avoids token in URL)
    async paperlessDownloadUrl(id) {
        try {
            const res = await fetch(`${this.paperlessUrl}/api/documents/${id}/download/`, { headers: this.paperlessHeaders });
            if (!res.ok) return '';
            const blob = await res.blob();
            return URL.createObjectURL(blob);
        } catch { return ''; }
    }

    // Link to view document in Paperless web UI
    paperlessWebUrl(id) {
        return `${this.paperlessUrl}/documents/${id}/details`;
    }

    // Fetch available tags
    async paperlessGetTags() {
        return this.paperlessFetch('tags/');
    }

    // Fetch available document types
    async paperlessGetDocumentTypes() {
        return this.paperlessFetch('document_types/');
    }

    // Fetch correspondents
    async paperlessGetCorrespondents() {
        return this.paperlessFetch('correspondents/');
    }

    // Import a Paperless document into the local app documents list
    async paperlessImportDocument(paperlessId) {
        const doc = await this.paperlessGetDocument(paperlessId);

        // Resolve document type name for category mapping
        let typeName = null;
        if (doc.document_type) {
            try {
                const typeObj = await this.paperlessFetch(`document_types/${doc.document_type}/`);
                typeName = typeObj.name;
            } catch { /* ignore */ }
        }

        return this.addDocument({
            name: doc.title || `Paperless-${paperlessId}`,
            category: this.paperlessTypeToCategory(typeName),
            tags: (doc.tags || []).map(String),
            ocrText: doc.content || '',
            fileType: 'pdf',
            fileSize: 0,
            extractedData: {
                datum: doc.created ? doc.created.split('T')[0] : null,
                firma: doc.correspondent_name || null,
                paperlessId: paperlessId
            },
            source: 'paperless'
        });
    }

    // Persistence
    save() { localStorage.setItem('freyai_documents', JSON.stringify(this.documents)); }
}

window.documentService = new DocumentService();
