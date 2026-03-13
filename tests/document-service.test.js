import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

const mockStorage = {};
globalThis.localStorage = {
    getItem: vi.fn(k => mockStorage[k] || null),
    setItem: vi.fn((k, v) => { mockStorage[k] = v; }),
    removeItem: vi.fn(k => { delete mockStorage[k]; }),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => {
        const raw = mockStorage[key];
        return raw ? JSON.parse(raw) : fallback;
    }),
    setJSON: vi.fn((key, val) => {
        mockStorage[key] = JSON.stringify(val);
        return true;
    }),
};

globalThis.document = {
    createElement: vi.fn(() => ({
        type: '', accept: '', capture: '', click: vi.fn(), onchange: null,
    })),
    head: { appendChild: vi.fn() },
};

globalThis.window = globalThis;
window.APP_CONFIG = {};
window.showToast = vi.fn();

await import('../js/services/document-service.js');

const svc = () => window.documentService;

// ============================================
// Tests
// ============================================

describe('DocumentService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        window.documentService = new window.documentService.constructor();
    });

    // ── CRUD ──

    describe('Document CRUD', () => {
        it('adds a document with defaults', () => {
            const doc = svc().addDocument({ name: 'Test.pdf' });
            expect(doc.id).toBeTruthy();
            expect(doc.name).toBe('Test.pdf');
            expect(doc.category).toBe('sonstiges');
            expect(doc.createdAt).toBeTruthy();
        });

        it('adds a document with custom fields', () => {
            const doc = svc().addDocument({
                name: 'Rechnung.pdf',
                category: 'rechnung',
                tags: ['wichtig'],
                customerId: 'cust-1',
                source: 'email',
            });
            expect(doc.category).toBe('rechnung');
            expect(doc.tags).toEqual(['wichtig']);
            expect(doc.customerId).toBe('cust-1');
            expect(doc.source).toBe('email');
        });

        it('retrieves a document by ID', () => {
            const doc = svc().addDocument({ name: 'Test.pdf' });
            const found = svc().getDocument(doc.id);
            expect(found).toBeTruthy();
            expect(found.name).toBe('Test.pdf');
        });

        it('returns undefined for non-existent document', () => {
            expect(svc().getDocument('nonexistent')).toBeUndefined();
        });

        it('updates a document', () => {
            const doc = svc().addDocument({ name: 'Old.pdf' });
            const updated = svc().updateDocument(doc.id, { name: 'New.pdf' });
            expect(updated.name).toBe('New.pdf');
        });

        it('returns null when updating non-existent document', () => {
            expect(svc().updateDocument('nonexistent', { name: 'x' })).toBeNull();
        });

        it('deletes a document', () => {
            const doc = svc().addDocument({ name: 'Delete.pdf' });
            svc().deleteDocument(doc.id);
            expect(svc().getDocument(doc.id)).toBeUndefined();
        });

        it('gets all documents', () => {
            svc().addDocument({ name: 'A.pdf' });
            svc().addDocument({ name: 'B.pdf' });
            expect(svc().getAllDocuments()).toHaveLength(2);
        });
    });

    // ── Filtering ──

    describe('Filtering', () => {
        it('filters by category', () => {
            svc().addDocument({ name: 'R1.pdf', category: 'rechnung' });
            svc().addDocument({ name: 'V1.pdf', category: 'vertrag' });
            svc().addDocument({ name: 'R2.pdf', category: 'rechnung' });
            expect(svc().getDocumentsByCategory('rechnung')).toHaveLength(2);
        });

        it('filters by customer', () => {
            svc().addDocument({ name: 'A.pdf', customerId: 'c1' });
            svc().addDocument({ name: 'B.pdf', customerId: 'c2' });
            svc().addDocument({ name: 'C.pdf', customerId: 'c1' });
            expect(svc().getDocumentsForCustomer('c1')).toHaveLength(2);
        });
    });

    // ── Search ──

    describe('Search', () => {
        it('searches in document names', () => {
            svc().addDocument({ name: 'Rechnung Meier.pdf' });
            svc().addDocument({ name: 'Vertrag Schmidt.pdf' });
            expect(svc().searchDocuments('meier')).toHaveLength(1);
        });

        it('searches in OCR text', () => {
            svc().addDocument({ name: 'Scan.pdf', ocrText: 'Werkzeughandel Berlin' });
            expect(svc().searchDocuments('berlin')).toHaveLength(1);
        });

        it('searches in tags', () => {
            svc().addDocument({ name: 'Doc.pdf', tags: ['steuer', 'wichtig'] });
            expect(svc().searchDocuments('steuer')).toHaveLength(1);
        });

        it('searches in extracted firma', () => {
            svc().addDocument({
                name: 'Receipt.pdf',
                extractedData: { firma: 'Bauhaus GmbH' },
            });
            expect(svc().searchDocuments('bauhaus')).toHaveLength(1);
        });

        it('returns empty for no matches', () => {
            svc().addDocument({ name: 'Test.pdf' });
            expect(svc().searchDocuments('nonexistent')).toHaveLength(0);
        });
    });

    // ── OCR Data Extraction ──

    describe('extractReceiptData', () => {
        it('extracts German date', () => {
            const data = svc().extractReceiptData('Datum: 15.03.2024\nBetrag: 50,00 €');
            expect(data.datum).toBe('2024-03-15');
        });

        it('extracts 2-digit year', () => {
            const data = svc().extractReceiptData('05.06.24');
            expect(data.datum).toBe('2024-06-05');
        });

        it('extracts amount in German format', () => {
            const data = svc().extractReceiptData('Gesamt: 1.234,56 €');
            expect(data.betrag).toBe(1234.56);
        });

        it('extracts largest amount as total', () => {
            const data = svc().extractReceiptData('Netto: 100,00\nMwSt: 19,00\nGesamt: 119,00');
            expect(data.betrag).toBe(119);
        });

        it('extracts VAT rate', () => {
            const data = svc().extractReceiptData('inkl. 19% MwSt.');
            expect(data.mwst).toBe(19);
        });

        it('extracts 7% VAT', () => {
            const data = svc().extractReceiptData('MwSt. 7 %');
            expect(data.mwst).toBe(7);
        });

        it('extracts company name from first line', () => {
            const data = svc().extractReceiptData('Bauhaus GmbH\nStraße 1\n10115 Berlin');
            expect(data.firma).toBe('Bauhaus GmbH');
        });

        it('categorizes fuel receipts', () => {
            const data = svc().extractReceiptData('Shell Tankstelle\nDiesel 45L');
            expect(data.kategorie).toBe('Kraftstoff');
        });

        it('categorizes restaurant receipts', () => {
            const data = svc().extractReceiptData('Restaurant zum Goldenen Hirsch\nBewirtung');
            expect(data.kategorie).toBe('Bewirtung');
        });

        it('categorizes hotel receipts', () => {
            const data = svc().extractReceiptData('Hotel Marriott\nÜbernachtung 2 Nächte');
            expect(data.kategorie).toBe('Reisekosten');
        });

        it('returns null for undetected fields', () => {
            const data = svc().extractReceiptData('just some random text');
            expect(data.datum).toBeNull();
            expect(data.betrag).toBeNull();
            expect(data.mwst).toBeNull();
        });
    });

    // ── Buchung from Scan ──

    describe('createBuchungFromScan', () => {
        it('creates buchung from document with extracted data', () => {
            const doc = svc().addDocument({
                name: 'Receipt.pdf',
                extractedData: {
                    datum: '2024-03-15',
                    betrag: 119.00,
                    kategorie: 'Kraftstoff',
                    firma: 'Shell',
                    mwst: 19,
                },
            });
            const buchung = svc().createBuchungFromScan(doc);
            expect(buchung).toBeTruthy();
            expect(buchung.betrag).toBe(119.00);
            expect(buchung.kategorie).toBe('Kraftstoff');
            expect(buchung.mwstSatz).toBe(19);
            expect(buchung.art).toBe('ausgabe');
            expect(buchung.quelle).toBe('scan');
        });

        it('returns null when no amount extracted', () => {
            const doc = svc().addDocument({ name: 'Empty.pdf' });
            expect(svc().createBuchungFromScan(doc)).toBeNull();
        });

        it('uses default values for missing fields', () => {
            const doc = svc().addDocument({
                name: 'Partial.pdf',
                extractedData: { betrag: 50 },
            });
            const buchung = svc().createBuchungFromScan(doc);
            expect(buchung.mwstSatz).toBe(19);
            expect(buchung.kategorie).toBe('Sonstiges');
        });
    });

    // ── Helpers ──

    describe('Helpers', () => {
        it('generates unique IDs', () => {
            const id1 = svc().generateId();
            const id2 = svc().generateId();
            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^doc-/);
        });

        it('returns category icons', () => {
            expect(svc().getCategoryIcon('rechnung')).toBeTruthy();
            expect(svc().getCategoryIcon('unknown')).toBe('📎');
        });

        it('returns category labels', () => {
            expect(svc().getCategoryLabel('rechnung')).toBe('Rechnung');
            expect(svc().getCategoryLabel('vertrag')).toBe('Vertrag');
        });

        it('formats file sizes', () => {
            expect(svc().formatFileSize(500)).toBe('500 B');
            expect(svc().formatFileSize(1536)).toBe('1.5 KB');
            expect(svc().formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
        });
    });

    // ── Categories ──

    describe('Categories', () => {
        it('has all expected categories', () => {
            expect(svc().categories).toContain('rechnung');
            expect(svc().categories).toContain('quittung');
            expect(svc().categories).toContain('vertrag');
            expect(svc().categories).toContain('angebot');
            expect(svc().categories).toContain('lieferschein');
            expect(svc().categories).toContain('sonstiges');
        });
    });

    // ── Paperless Integration ──

    describe('Paperless Integration', () => {
        it('maps document types to categories', () => {
            expect(svc().paperlessTypeToCategory('Rechnung')).toBe('rechnung');
            expect(svc().paperlessTypeToCategory('Invoice')).toBe('rechnung');
            expect(svc().paperlessTypeToCategory('Receipt')).toBe('quittung');
            expect(svc().paperlessTypeToCategory('Contract')).toBe('vertrag');
            expect(svc().paperlessTypeToCategory('Unknown')).toBe('sonstiges');
            expect(svc().paperlessTypeToCategory(null)).toBe('sonstiges');
        });

        it('generates paperless web URL', () => {
            window.APP_CONFIG = { PAPERLESS_URL: 'https://docs.example.com' };
            const url = svc().paperlessWebUrl(42);
            expect(url).toContain('/documents/42/details');
        });
    });

    // ── OCR Fallback ──

    describe('OCR Fallback', () => {
        it('returns placeholder text', () => {
            const result = svc().ocrFallback('base64data');
            expect(result.text).toContain('OCR nicht verfügbar');
            expect(result.confidence).toBe(0);
            expect(result.words).toEqual([]);
        });
    });
});
