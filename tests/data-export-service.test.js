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

// Mock DOM APIs used by downloadFile
globalThis.document = {
    createElement: vi.fn(() => ({
        href: '',
        download: '',
        click: vi.fn(),
    })),
    body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
    },
};

globalThis.URL = {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
};

globalThis.Blob = class Blob {
    constructor(parts, options) {
        this.parts = parts;
        this.type = options?.type || '';
    }
};

globalThis.Intl = {
    DateTimeFormat: () => ({
        resolvedOptions: () => ({ timeZone: 'Europe/Berlin' }),
    }),
    NumberFormat: Intl.NumberFormat,
};

globalThis.FileReader = class FileReader {
    readAsText(file) {
        setTimeout(() => {
            if (file._errorOnRead) {
                this.onerror(new Error('read error'));
            } else {
                this.onload({ target: { result: file._content } });
            }
        }, 0);
    }
};

globalThis.window = globalThis;
window.APP_CONFIG = {};
window.showToast = vi.fn();
window.storeService = null;
window.notificationService = null;
window.confirmDialogService = null;
window.errorHandler = null;

await import('../js/services/data-export-service.js');

const svc = () => window.dataExportService;

// ============================================
// Test Data (German)
// ============================================

const kundenData = [
    {
        id: 'KD-001',
        name: 'Müller Metallbau GmbH',
        email: 'info@mueller-metallbau.de',
        telefon: '+49 30 12345678',
        adresse: 'Hauptstraße 42',
        plz: '10115',
        stadt: 'Berlin',
        land: 'Deutschland',
    },
    {
        id: 'KD-002',
        name: 'Schmidt & Söhne Elektrik',
        email: 'kontakt@schmidt-elektrik.de',
        telefon: '+49 89 87654321',
        adresse: 'Industrieweg 7',
        plz: '80331',
        stadt: 'München',
        land: 'Deutschland',
    },
];

const rechnungenData = [
    {
        id: 'RE-001',
        kunde: { name: 'Müller Metallbau GmbH' },
        erstelltAm: '2026-01-15',
        netto: 5000,
        mwst: 950,
        brutto: 5950,
        status: 'bezahlt',
        zahlungsfrist: '2026-02-15',
    },
    {
        id: 'RE-002',
        kunde: { name: 'Schmidt & Söhne Elektrik' },
        erstelltAm: '2026-02-01',
        netto: 3200,
        mwst: 608,
        brutto: 3808,
        status: 'offen',
        zahlungsfrist: '2026-03-01',
    },
];

const buchungenData = [
    {
        id: 'BU-001',
        datum: '2026-01-10',
        beschreibung: 'Stahlträger Lieferung',
        kategorie: 'Material',
        betrag: 1500.50,
        typ: 'ausgabe',
        status: 'gebucht',
    },
    {
        id: 'BU-002',
        datum: '2026-01-20',
        beschreibung: 'Montagearbeiten Projekt Alpha',
        kategorie: 'Dienstleistung',
        betrag: 4200,
        typ: 'einnahme',
        status: 'gebucht',
    },
];

const materialienData = [
    {
        id: 'MAT-001',
        name: 'Stahlblech 2mm',
        kategorie: 'Rohstoffe',
        menge: 150,
        einheit: 'Stück',
        preis: 12.50,
        lagerort: 'Halle A',
    },
    {
        id: 'MAT-002',
        name: 'Kupferkabel 2.5mm²',
        kategorie: 'Elektro',
        menge: 500,
        einheit: 'Meter',
        preis: 3.80,
        lagerort: 'Lager B',
    },
];

// ============================================
// Tests
// ============================================

describe('DataExportService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        vi.clearAllMocks();

        // Reset store
        window.storeService = {
            state: {
                anfragen: [],
                angebote: [],
                auftraege: [],
                rechnungen: [...rechnungenData],
                activities: [],
                settings: { companyName: 'Müller Metallbau GmbH' },
                kunden: [...kundenData],
                buchungen: [...buchungenData],
                materialien: [...materialienData],
            },
            save: vi.fn().mockResolvedValue(true),
        };

        window.notificationService = {
            notifySystem: vi.fn(),
        };

        window.errorHandler = {
            handle: vi.fn(),
        };

        window.confirmDialogService = null;

        // Reinstantiate the service
        const DataExportServiceClass = window.dataExportService.constructor;
        window.dataExportService = new DataExportServiceClass();
    });

    // ── Constructor ──

    describe('constructor', () => {
        it('should initialize with version 1.0', () => {
            expect(svc().exportVersion).toBe('1.0');
        });

        it('should use semicolon as delimiter (German Excel standard)', () => {
            expect(svc().delimiter).toBe(';');
        });

        it('should define CSV headers for all data types', () => {
            expect(svc().csvHeaders).toHaveProperty('kunden');
            expect(svc().csvHeaders).toHaveProperty('rechnungen');
            expect(svc().csvHeaders).toHaveProperty('buchungen');
            expect(svc().csvHeaders).toHaveProperty('materialien');
        });

        it('should have German column names for kunden', () => {
            expect(svc().csvHeaders.kunden).toEqual(
                ['Name', 'Email', 'Telefon', 'Adresse', 'PLZ', 'Stadt', 'Land']
            );
        });

        it('should have German column names for rechnungen', () => {
            expect(svc().csvHeaders.rechnungen).toContain('Rechnungs-ID');
            expect(svc().csvHeaders.rechnungen).toContain('MwSt');
            expect(svc().csvHeaders.rechnungen).toContain('Brutto');
        });
    });

    // ── exportAll ──

    describe('exportAll', () => {
        it('should return export data with metadata and data sections', () => {
            const result = svc().exportAll();
            expect(result).toHaveProperty('metadata');
            expect(result).toHaveProperty('data');
        });

        it('should include export date in ISO format', () => {
            const result = svc().exportAll();
            expect(result.metadata.exportDate).toBeTruthy();
            expect(result.metadata.exportDate).toMatch(/\d{4}-\d{2}-\d{2}T/);
        });

        it('should set exportType to full-backup', () => {
            const result = svc().exportAll();
            expect(result.metadata.exportType).toBe('full-backup');
        });

        it('should include company name from settings', () => {
            const result = svc().exportAll();
            expect(result.metadata.company).toBe('Müller Metallbau GmbH');
        });

        it('should default company to FreyAI Visions when settings missing', () => {
            window.storeService.state.settings = {};
            const result = svc().exportAll();
            expect(result.metadata.company).toBe('FreyAI Visions');
        });

        it('should include timezone', () => {
            const result = svc().exportAll();
            expect(result.metadata.timezone).toBe('Europe/Berlin');
        });

        it('should include version', () => {
            const result = svc().exportAll();
            expect(result.metadata.version).toBe('1.0');
        });

        it('should export rechnungen from store', () => {
            const result = svc().exportAll();
            expect(result.data.rechnungen).toHaveLength(2);
            expect(result.data.rechnungen[0].id).toBe('RE-001');
        });

        it('should export all data types', () => {
            const result = svc().exportAll();
            expect(result.data).toHaveProperty('anfragen');
            expect(result.data).toHaveProperty('angebote');
            expect(result.data).toHaveProperty('auftraege');
            expect(result.data).toHaveProperty('rechnungen');
            expect(result.data).toHaveProperty('activities');
            expect(result.data).toHaveProperty('settings');
        });

        it('should default to empty arrays when store data is missing', () => {
            window.storeService = { state: {} };
            const result = svc().exportAll();
            expect(result.data.anfragen).toEqual([]);
            expect(result.data.rechnungen).toEqual([]);
        });

        it('should handle missing storeService gracefully', () => {
            window.storeService = null;
            const result = svc().exportAll();
            expect(result.data.anfragen).toEqual([]);
            expect(result.data.settings).toEqual({});
        });
    });

    // ── downloadFullBackup ──

    describe('downloadFullBackup', () => {
        it('should trigger a JSON download', async () => {
            await svc().downloadFullBackup();
            expect(document.createElement).toHaveBeenCalledWith('a');
        });

        it('should notify on success', async () => {
            await svc().downloadFullBackup();
            expect(window.notificationService.notifySystem).toHaveBeenCalledWith(
                expect.stringContaining('Backup exportiert')
            );
        });

        it('should handle errors gracefully', async () => {
            // Force an error by making exportAll throw
            const originalExportAll = svc().exportAll;
            svc().exportAll = () => { throw new Error('test error'); };
            await svc().downloadFullBackup();
            expect(window.errorHandler.handle).toHaveBeenCalled();
            svc().exportAll = originalExportAll;
        });
    });

    // ── downloadCSV ──

    describe('downloadCSV', () => {
        it('should export kunden data as CSV', async () => {
            await svc().downloadCSV('kunden', kundenData);
            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(window.notificationService.notifySystem).toHaveBeenCalledWith(
                expect.stringContaining('CSV exportiert')
            );
        });

        it('should show error when no dataType provided', async () => {
            await svc().downloadCSV(null, kundenData);
            expect(window.errorHandler.handle).toHaveBeenCalled();
        });

        it('should show error when data array is empty', async () => {
            await svc().downloadCSV('kunden', []);
            expect(window.errorHandler.handle).toHaveBeenCalled();
        });

        it('should fetch data from store when not provided', async () => {
            await svc().downloadCSV('kunden');
            expect(document.createElement).toHaveBeenCalledWith('a');
        });

        it('should show error when store has no data for type', async () => {
            window.storeService.state.kunden = [];
            await svc().downloadCSV('kunden');
            expect(window.errorHandler.handle).toHaveBeenCalled();
        });
    });

    // ── convertToCSV ──

    describe('convertToCSV', () => {
        it('should include UTF-8 BOM for Excel', () => {
            const csv = svc().convertToCSV('kunden', kundenData);
            expect(csv.charCodeAt(0)).toBe(0xFEFF);
        });

        it('should use semicolon as delimiter', () => {
            const csv = svc().convertToCSV('kunden', kundenData);
            const firstLine = csv.replace('\uFEFF', '').split('\n')[0];
            expect(firstLine).toContain(';');
        });

        it('should include German headers for kunden', () => {
            const csv = svc().convertToCSV('kunden', kundenData);
            const headerLine = csv.replace('\uFEFF', '').split('\n')[0];
            expect(headerLine).toBe('Name;Email;Telefon;Adresse;PLZ;Stadt;Land');
        });

        it('should include German headers for rechnungen', () => {
            const csv = svc().convertToCSV('rechnungen', rechnungenData);
            const headerLine = csv.replace('\uFEFF', '').split('\n')[0];
            expect(headerLine).toContain('Rechnungs-ID');
            expect(headerLine).toContain('MwSt');
        });

        it('should include data rows for kunden', () => {
            const csv = svc().convertToCSV('kunden', kundenData);
            const lines = csv.replace('\uFEFF', '').split('\n');
            expect(lines).toHaveLength(3); // header + 2 data rows
            expect(lines[1]).toContain('Müller Metallbau GmbH');
        });

        it('should include data rows for rechnungen', () => {
            const csv = svc().convertToCSV('rechnungen', rechnungenData);
            const lines = csv.replace('\uFEFF', '').split('\n');
            expect(lines[1]).toContain('RE-001');
            expect(lines[1]).toContain('5000');
        });

        it('should include data rows for buchungen', () => {
            const csv = svc().convertToCSV('buchungen', buchungenData);
            const lines = csv.replace('\uFEFF', '').split('\n');
            expect(lines[1]).toContain('Stahlträger Lieferung');
        });

        it('should include data rows for materialien', () => {
            const csv = svc().convertToCSV('materialien', materialienData);
            const lines = csv.replace('\uFEFF', '').split('\n');
            expect(lines[1]).toContain('Stahlblech 2mm');
            expect(lines[1]).toContain('Halle A');
        });

        it('should handle empty headers for unknown data type gracefully', () => {
            const csv = svc().convertToCSV('unknown', [{ a: 1, b: 2 }]);
            // Should still produce output using Object.values fallback
            expect(csv).toContain('1');
        });
    });

    // ── escapeCSV ──

    describe('escapeCSV', () => {
        it('should return empty string for null', () => {
            expect(svc().escapeCSV(null)).toBe('');
        });

        it('should return empty string for undefined', () => {
            expect(svc().escapeCSV(undefined)).toBe('');
        });

        it('should trim whitespace', () => {
            expect(svc().escapeCSV('  Hallo  ')).toBe('Hallo');
        });

        it('should wrap values with semicolons in quotes', () => {
            expect(svc().escapeCSV('Wert;mit;Semikolon')).toBe('"Wert;mit;Semikolon"');
        });

        it('should escape double quotes by doubling them', () => {
            expect(svc().escapeCSV('Er sagte "Hallo"')).toBe('"Er sagte ""Hallo"""');
        });

        it('should wrap values with newlines in quotes', () => {
            expect(svc().escapeCSV('Zeile1\nZeile2')).toBe('"Zeile1\nZeile2"');
        });

        it('should protect against formula injection with =', () => {
            const result = svc().escapeCSV('=SUM(A1:A10)');
            expect(result.startsWith("'")).toBe(true);
        });

        it('should protect against formula injection with +', () => {
            const result = svc().escapeCSV('+cmd|/C calc');
            expect(result.startsWith("'")).toBe(true);
        });

        it('should protect against formula injection with -', () => {
            const result = svc().escapeCSV('-cmd|/C calc');
            expect(result.startsWith("'")).toBe(true);
        });

        it('should protect against formula injection with @', () => {
            const result = svc().escapeCSV('@SUM(A1)');
            expect(result.startsWith("'")).toBe(true);
        });

        it('should convert numbers to strings', () => {
            expect(svc().escapeCSV(42)).toBe('42');
        });

        it('should handle zero correctly', () => {
            expect(svc().escapeCSV(0)).toBe('0');
        });
    });

    // ── parseCSV ──

    describe('parseCSV', () => {
        it('should parse semicolon-delimited CSV for kunden', () => {
            const csv = 'Name;Email;Telefon;Adresse;PLZ;Stadt;Land\nHans Meier;hans@meier.de;+49 171 1234567;Bergstr. 5;80331;München;Deutschland';
            const result = svc().parseCSV(csv, 'kunden');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Hans Meier');
            expect(result[0].email).toBe('hans@meier.de');
            expect(result[0].stadt).toBe('München');
        });

        it('should remove BOM before parsing', () => {
            const csv = '\uFEFFName;Email;Telefon;Adresse;PLZ;Stadt;Land\nTest;test@test.de;123;Str 1;12345;Berlin;DE';
            const result = svc().parseCSV(csv, 'kunden');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Test');
        });

        it('should auto-detect comma delimiter', () => {
            const csv = 'Name,Email,Telefon,Adresse,PLZ,Stadt,Land\nTest User,test@test.de,123,Street 1,12345,Berlin,DE';
            const result = svc().parseCSV(csv, 'kunden');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Test User');
        });

        it('should return empty array for CSV with only headers', () => {
            const csv = 'Name;Email;Telefon;Adresse;PLZ;Stadt;Land';
            const result = svc().parseCSV(csv, 'kunden');
            expect(result).toEqual([]);
        });

        it('should skip empty rows', () => {
            const csv = 'Name;Email;Telefon;Adresse;PLZ;Stadt;Land\nHans;hans@test.de;123;Str 1;10115;Berlin;DE\n;;;;;;;\nPeter;peter@test.de;456;Str 2;80331;München;DE';
            const result = svc().parseCSV(csv, 'kunden');
            expect(result).toHaveLength(2);
        });

        it('should parse rechnungen CSV', () => {
            const csv = 'Rechnungs-ID;Kunde;Datum;Netto;MwSt;Brutto;Status;Zahlungsfrist\nRE-100;Firma ABC;2026-01-15;1000;190;1190;offen;2026-02-15';
            const result = svc().parseCSV(csv, 'rechnungen');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('RE-100');
            expect(result[0]['kunde.name']).toBe('Firma ABC');
            expect(result[0].status).toBe('offen');
        });

        it('should parse buchungen CSV', () => {
            const csv = 'Datum;Beschreibung;Kategorie;Betrag;Typ;Status\n2026-01-10;Büromaterial;Bürobedarf;250;ausgabe;gebucht';
            const result = svc().parseCSV(csv, 'buchungen');
            expect(result).toHaveLength(1);
            expect(result[0].beschreibung).toBe('Büromaterial');
            expect(result[0].kategorie).toBe('Bürobedarf');
        });

        it('should parse materialien CSV', () => {
            const csv = 'Material-ID;Bezeichnung;Kategorie;Menge;Einheit;Preis;Lagerort\nMAT-100;Schrauben M8;Befestigung;1000;Stück;0.15;Lager C';
            const result = svc().parseCSV(csv, 'materialien');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('MAT-100');
            expect(result[0].name).toBe('Schrauben M8');
            expect(result[0].lagerort).toBe('Lager C');
        });

        it('should generate ID when not present in CSV', () => {
            const csv = 'Name;Email;Telefon;Adresse;PLZ;Stadt;Land\nTest;test@test.de;123;Str 1;12345;Berlin;DE';
            const result = svc().parseCSV(csv, 'kunden');
            expect(result[0].id).toMatch(/^KD-/);
        });

        it('should handle quoted values with embedded delimiters', () => {
            const csv = 'Name;Email;Telefon;Adresse;PLZ;Stadt;Land\n"Schmidt; Müller";test@test.de;123;Str 1;12345;Berlin;DE';
            const result = svc().parseCSV(csv, 'kunden');
            expect(result[0].name).toBe('Schmidt; Müller');
        });

        it('should handle escaped quotes in CSV', () => {
            const csv = 'Name;Email;Telefon;Adresse;PLZ;Stadt;Land\n"Firma ""Test""";test@test.de;123;Str 1;12345;Berlin;DE';
            const result = svc().parseCSV(csv, 'kunden');
            expect(result[0].name).toBe('Firma "Test"');
        });
    });

    // ── parseCSVLines ──

    describe('parseCSVLines', () => {
        it('should split lines by newline', () => {
            const result = svc().parseCSVLines('a;b\nc;d', ';');
            expect(result).toHaveLength(2);
        });

        it('should handle \\r\\n line endings', () => {
            const result = svc().parseCSVLines('a;b\r\nc;d', ';');
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(['a', 'b']);
            expect(result[1]).toEqual(['c', 'd']);
        });

        it('should handle quoted values spanning delimiters', () => {
            const result = svc().parseCSVLines('"a;b";c', ';');
            expect(result).toHaveLength(1);
            expect(result[0][0]).toBe('a;b');
        });

        it('should handle quoted values spanning newlines', () => {
            const result = svc().parseCSVLines('"line1\nline2";b', ';');
            expect(result).toHaveLength(1);
            expect(result[0][0]).toBe('line1\nline2');
        });

        it('should handle empty CSV', () => {
            const result = svc().parseCSVLines('', ';');
            expect(result).toEqual([]);
        });
    });

    // ── mapCSVRowToData ──

    describe('mapCSVRowToData', () => {
        it('should map kunden headers to object keys', () => {
            const headers = ['Name', 'Email', 'Telefon', 'Adresse', 'PLZ', 'Stadt', 'Land'];
            const values = ['Hans', 'hans@test.de', '123', 'Str 1', '10115', 'Berlin', 'DE'];
            const result = svc().mapCSVRowToData('kunden', headers, values);
            expect(result.name).toBe('Hans');
            expect(result.email).toBe('hans@test.de');
            expect(result.plz).toBe('10115');
        });

        it('should map rechnungen headers to object keys', () => {
            const headers = ['Rechnungs-ID', 'Kunde', 'Datum', 'Netto', 'MwSt', 'Brutto', 'Status', 'Zahlungsfrist'];
            const values = ['RE-100', 'Firma XY', '2026-01-15', '1000', '190', '1190', 'offen', '2026-02-15'];
            const result = svc().mapCSVRowToData('rechnungen', headers, values);
            expect(result.id).toBe('RE-100');
            expect(result['kunde.name']).toBe('Firma XY');
            expect(result.netto).toBe('1000');
        });

        it('should map buchungen headers to object keys', () => {
            const headers = ['Datum', 'Beschreibung', 'Kategorie', 'Betrag', 'Typ', 'Status'];
            const values = ['2026-01-10', 'Büromaterial', 'Bürobedarf', '250', 'ausgabe', 'gebucht'];
            const result = svc().mapCSVRowToData('buchungen', headers, values);
            expect(result.datum).toBe('2026-01-10');
            expect(result.beschreibung).toBe('Büromaterial');
        });

        it('should map materialien headers to object keys', () => {
            const headers = ['Material-ID', 'Bezeichnung', 'Kategorie', 'Menge', 'Einheit', 'Preis', 'Lagerort'];
            const values = ['MAT-100', 'Schrauben', 'Befestigung', '500', 'Stück', '0.10', 'Lager A'];
            const result = svc().mapCSVRowToData('materialien', headers, values);
            expect(result.id).toBe('MAT-100');
            expect(result.name).toBe('Schrauben');
            expect(result.lagerort).toBe('Lager A');
        });

        it('should generate an ID when not mapped from CSV', () => {
            const headers = ['Name', 'Email'];
            const values = ['Test', 'test@test.de'];
            const result = svc().mapCSVRowToData('kunden', headers, values);
            expect(result.id).toMatch(/^KD-/);
        });

        it('should return null for empty object (unknown headers)', () => {
            const headers = ['UnknownA', 'UnknownB'];
            const values = ['x', 'y'];
            const result = svc().mapCSVRowToData('kunden', headers, values);
            expect(result).toBeNull();
        });
    });

    // ── generateId ──

    describe('generateId', () => {
        it('should generate KD prefix for kunden', () => {
            expect(svc().generateId('kunden')).toMatch(/^KD-/);
        });

        it('should generate RE prefix for rechnungen', () => {
            expect(svc().generateId('rechnungen')).toMatch(/^RE-/);
        });

        it('should generate BU prefix for buchungen', () => {
            expect(svc().generateId('buchungen')).toMatch(/^BU-/);
        });

        it('should generate MAT prefix for materialien', () => {
            expect(svc().generateId('materialien')).toMatch(/^MAT-/);
        });

        it('should generate ID prefix for unknown types', () => {
            expect(svc().generateId('unknown')).toMatch(/^ID-/);
        });

        it('should generate unique IDs', () => {
            const id1 = svc().generateId('kunden');
            const id2 = svc().generateId('kunden');
            expect(id1).not.toBe(id2);
        });
    });

    // ── getDataByType ──

    describe('getDataByType', () => {
        it('should return kunden from store', () => {
            const result = svc().getDataByType('kunden');
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Müller Metallbau GmbH');
        });

        it('should return empty array for unknown type', () => {
            const result = svc().getDataByType('nonexistent');
            expect(result).toEqual([]);
        });

        it('should return empty array when storeService is null', () => {
            window.storeService = null;
            const result = svc().getDataByType('kunden');
            expect(result).toEqual([]);
        });
    });

    // ── countRecords ──

    describe('countRecords', () => {
        it('should count total records across data types', () => {
            const data = {
                anfragen: [{ id: 1 }, { id: 2 }],
                rechnungen: [{ id: 3 }],
                settings: { key: 'value' }, // not an array, should be skipped
            };
            expect(svc().countRecords(data)).toBe(3);
        });

        it('should return 0 for empty data', () => {
            expect(svc().countRecords({})).toBe(0);
        });

        it('should skip non-array properties', () => {
            const data = { settings: { a: 1 }, name: 'test' };
            expect(svc().countRecords(data)).toBe(0);
        });
    });

    // ── mergeImportData ──

    describe('mergeImportData', () => {
        it('should merge new records into store', async () => {
            window.storeService.state.kunden = [];
            const importData = {
                kunden: [
                    { id: 'KD-NEW-1', name: 'Neuer Kunde' },
                    { id: 'KD-NEW-2', name: 'Noch ein Kunde' },
                ],
            };
            const summary = await svc().mergeImportData(importData);
            expect(summary.imported).toBe(2);
            expect(summary.skipped).toBe(0);
            expect(window.storeService.state.kunden).toHaveLength(2);
        });

        it('should skip duplicates by ID', async () => {
            window.storeService.state.kunden = [{ id: 'KD-001', name: 'Existing' }];
            const importData = {
                kunden: [
                    { id: 'KD-001', name: 'Duplicate' },
                    { id: 'KD-NEW', name: 'New' },
                ],
            };
            const summary = await svc().mergeImportData(importData);
            expect(summary.imported).toBe(1);
            expect(summary.skipped).toBe(1);
        });

        it('should skip items without id', async () => {
            window.storeService.state.kunden = [];
            const importData = {
                kunden: [{ name: 'No ID' }],
            };
            const summary = await svc().mergeImportData(importData);
            expect(summary.imported).toBe(0);
            expect(summary.skipped).toBe(1);
        });

        it('should initialize array for new data types', async () => {
            delete window.storeService.state.newType;
            const importData = {
                newType: [{ id: 'NT-1', value: 'test' }],
            };
            const summary = await svc().mergeImportData(importData);
            expect(summary.imported).toBe(1);
            expect(window.storeService.state.newType).toHaveLength(1);
        });

        it('should throw when store service is not available', async () => {
            window.storeService = null;
            await expect(svc().mergeImportData({})).rejects.toThrow('Store service not available');
        });

        it('should return correct total', async () => {
            window.storeService.state.kunden = [{ id: 'KD-001', name: 'Existing' }];
            const importData = {
                kunden: [
                    { id: 'KD-001', name: 'Duplicate' },
                    { id: 'KD-NEW', name: 'New' },
                ],
            };
            const summary = await svc().mergeImportData(importData);
            expect(summary.total).toBe(summary.imported + summary.skipped);
        });
    });

    // ── importDataType ──

    describe('importDataType', () => {
        it('should import data into store', async () => {
            window.storeService.state.kunden = [];
            const data = [
                { id: 'KD-100', name: 'Imported Kunde' },
            ];
            const summary = await svc().importDataType('kunden', data);
            expect(summary.imported).toBe(1);
            expect(window.storeService.state.kunden).toHaveLength(1);
        });

        it('should skip duplicates', async () => {
            window.storeService.state.kunden = [{ id: 'KD-100', name: 'Existing' }];
            const data = [{ id: 'KD-100', name: 'Duplicate' }];
            const summary = await svc().importDataType('kunden', data);
            expect(summary.imported).toBe(0);
            expect(summary.skipped).toBe(1);
        });

        it('should initialize empty array for missing data type', async () => {
            window.storeService.state.tasks = 'not-an-array';
            const data = [{ id: 'T-1', name: 'Task' }];
            const summary = await svc().importDataType('tasks', data);
            expect(summary.imported).toBe(1);
        });

        it('should throw when store service is not available', async () => {
            window.storeService = null;
            await expect(svc().importDataType('kunden', [])).rejects.toThrow('Store service not available');
        });
    });

    // ── importFromJSON ──

    describe('importFromJSON', () => {
        function makeFile(content, size = null) {
            return {
                _content: content,
                size: size ?? content.length,
            };
        }

        it('should reject when no file provided', async () => {
            await expect(svc().importFromJSON(null)).rejects.toThrow('Keine Datei angegeben');
        });

        it('should reject files larger than 50 MB', async () => {
            const file = makeFile('{}', 51 * 1024 * 1024);
            await expect(svc().importFromJSON(file)).rejects.toThrow('Datei zu gross');
        });

        it('should reject invalid backup format (missing metadata)', async () => {
            const file = makeFile(JSON.stringify({ data: {} }));
            await expect(svc().importFromJSON(file)).rejects.toThrow('Invalid backup format');
        });

        it('should reject invalid backup format (missing data)', async () => {
            const file = makeFile(JSON.stringify({ metadata: {} }));
            await expect(svc().importFromJSON(file)).rejects.toThrow('Invalid backup format');
        });

        it('should import valid backup after confirmation', async () => {
            // Mock confirm to return true
            globalThis.confirm = vi.fn(() => true);

            const backupData = {
                metadata: { version: '1.0', exportType: 'full-backup' },
                data: {
                    kunden: [{ id: 'KD-IMPORT-1', name: 'Importierter Kunde' }],
                },
            };

            window.storeService.state.kunden = [];
            const file = makeFile(JSON.stringify(backupData));
            const summary = await svc().importFromJSON(file);

            expect(summary.imported).toBe(1);
            expect(window.storeService.save).toHaveBeenCalled();
            expect(window.notificationService.notifySystem).toHaveBeenCalledWith(
                expect.stringContaining('1 Datensätze importiert')
            );
        });

        it('should return cancelled when user declines confirmation', async () => {
            globalThis.confirm = vi.fn(() => false);

            const backupData = {
                metadata: { version: '1.0' },
                data: { kunden: [{ id: 'KD-1', name: 'Test' }] },
            };

            const file = makeFile(JSON.stringify(backupData));
            const result = await svc().importFromJSON(file);

            expect(result.cancelled).toBe(true);
        });

        it('should handle FileReader error', async () => {
            const file = {
                _content: '{}',
                _errorOnRead: true,
                size: 10,
            };
            await expect(svc().importFromJSON(file)).rejects.toThrow('Failed to read file');
        });
    });

    // ── importFromCSV ──

    describe('importFromCSV', () => {
        function makeFile(content, size = null) {
            return {
                _content: content,
                size: size ?? content.length,
            };
        }

        it('should reject when no file provided', async () => {
            await expect(svc().importFromCSV(null, 'kunden')).rejects.toThrow('Keine Datei angegeben');
        });

        it('should reject when no dataType provided', async () => {
            const file = makeFile('test');
            await expect(svc().importFromCSV(file, null)).rejects.toThrow('Datentyp nicht angegeben');
        });

        it('should reject files larger than 20 MB', async () => {
            const file = makeFile('test', 21 * 1024 * 1024);
            await expect(svc().importFromCSV(file, 'kunden')).rejects.toThrow('CSV-Datei zu gross');
        });

        it('should import valid kunden CSV after confirmation', async () => {
            globalThis.confirm = vi.fn(() => true);
            window.storeService.state.kunden = [];

            const csv = 'Name;Email;Telefon;Adresse;PLZ;Stadt;Land\nWerner Weber;werner@weber.de;+49 30 111;Lindenstr. 5;10969;Berlin;Deutschland';
            const file = makeFile(csv);
            const summary = await svc().importFromCSV(file, 'kunden');

            expect(summary.imported).toBe(1);
            expect(window.storeService.save).toHaveBeenCalled();
        });

        it('should return cancelled when user declines', async () => {
            globalThis.confirm = vi.fn(() => false);

            const csv = 'Name;Email;Telefon;Adresse;PLZ;Stadt;Land\nTest;test@test.de;123;Str;12345;Berlin;DE';
            const file = makeFile(csv);
            const result = await svc().importFromCSV(file, 'kunden');

            expect(result.cancelled).toBe(true);
        });

        it('should reject CSV with no valid data', async () => {
            const csv = 'Name;Email;Telefon;Adresse;PLZ;Stadt;Land';
            const file = makeFile(csv);
            await expect(svc().importFromCSV(file, 'kunden')).rejects.toThrow('No valid data found in CSV');
        });

        it('should handle FileReader error', async () => {
            const file = {
                _content: '',
                _errorOnRead: true,
                size: 10,
            };
            await expect(svc().importFromCSV(file, 'kunden')).rejects.toThrow('Failed to read file');
        });
    });

    // ── showConfirmation ──

    describe('showConfirmation', () => {
        it('should use confirmDialogService when available', async () => {
            let capturedCallbacks;
            window.confirmDialogService = {
                showConfirmDialog: vi.fn((opts) => {
                    capturedCallbacks = opts;
                }),
            };

            const promise = svc().showConfirmation('Fortfahren?', 'Import');
            // Simulate user clicking confirm
            capturedCallbacks.onConfirm();
            const result = await promise;

            expect(result).toBe(true);
            expect(window.confirmDialogService.showConfirmDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Import',
                    message: 'Fortfahren?',
                    confirmText: 'Ja, fortfahren',
                })
            );
        });

        it('should resolve false when user cancels via dialog service', async () => {
            let capturedCallbacks;
            window.confirmDialogService = {
                showConfirmDialog: vi.fn((opts) => {
                    capturedCallbacks = opts;
                }),
            };

            const promise = svc().showConfirmation('Fortfahren?', 'Import');
            capturedCallbacks.onCancel();
            const result = await promise;

            expect(result).toBe(false);
        });

        it('should fall back to native confirm when no dialog service', async () => {
            window.confirmDialogService = null;
            globalThis.confirm = vi.fn(() => true);

            const result = await svc().showConfirmation('Fortfahren?', 'Test');
            expect(globalThis.confirm).toHaveBeenCalledWith('Test\n\nFortfahren?');
            expect(result).toBe(true);
        });
    });

    // ── showError ──

    describe('showError', () => {
        it('should use errorHandler when available', () => {
            svc().showError('Testfehler');
            expect(window.errorHandler.handle).toHaveBeenCalledWith(
                expect.any(Error),
                'DataExport'
            );
        });

        it('should fall back to showToast', () => {
            window.errorHandler = null;
            window.showToast = vi.fn();
            svc().showError('Testfehler');
            expect(window.showToast).toHaveBeenCalledWith('Testfehler', 'error');
        });

        it('should fall back to console.error when nothing else available', () => {
            window.errorHandler = null;
            window.showToast = null;
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            svc().showError('Testfehler');
            expect(spy).toHaveBeenCalledWith('DataExport:', 'Testfehler');
            spy.mockRestore();
        });
    });

    // ── mapDataToCSVRow ──

    describe('mapDataToCSVRow', () => {
        it('should map kunden fields correctly', () => {
            const row = svc().mapDataToCSVRow('kunden', kundenData[0]);
            const values = row.split(';');
            expect(values[0]).toBe('Müller Metallbau GmbH');
            expect(values[1]).toBe('info@mueller-metallbau.de');
            expect(values[4]).toBe('10115');
        });

        it('should map rechnungen fields including nested kunde.name', () => {
            const row = svc().mapDataToCSVRow('rechnungen', rechnungenData[0]);
            const values = row.split(';');
            expect(values[0]).toBe('RE-001');
            expect(values[1]).toBe('Müller Metallbau GmbH');
            expect(values[3]).toBe('5000');
        });

        it('should map buchungen fields correctly', () => {
            const row = svc().mapDataToCSVRow('buchungen', buchungenData[0]);
            const values = row.split(';');
            expect(values[0]).toBe('2026-01-10');
            expect(values[1]).toBe('Stahlträger Lieferung');
        });

        it('should map materialien fields correctly', () => {
            const row = svc().mapDataToCSVRow('materialien', materialienData[0]);
            const values = row.split(';');
            expect(values[0]).toBe('MAT-001');
            expect(values[1]).toBe('Stahlblech 2mm');
            expect(values[6]).toBe('Halle A');
        });

        it('should handle missing fields with defaults', () => {
            const row = svc().mapDataToCSVRow('kunden', {});
            const values = row.split(';');
            // All values should be empty strings
            values.forEach(v => expect(v).toBe(''));
        });

        it('should use Object.values fallback for unknown types', () => {
            const row = svc().mapDataToCSVRow('unknown', { a: 'X', b: 'Y' });
            expect(row).toContain('X');
            expect(row).toContain('Y');
        });
    });

    // ── downloadFile / downloadJSON ──

    describe('downloadFile', () => {
        it('should create a Blob and trigger download', () => {
            svc().downloadFile('content', 'test.csv', 'text/csv');
            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(URL.revokeObjectURL).toHaveBeenCalled();
        });

        it('should set correct filename', () => {
            let linkEl;
            document.createElement = vi.fn(() => {
                linkEl = { href: '', download: '', click: vi.fn() };
                return linkEl;
            });

            svc().downloadFile('content', 'export.csv', 'text/csv');
            expect(linkEl.download).toBe('export.csv');
        });
    });

    describe('downloadJSON', () => {
        it('should convert data to JSON and trigger download', () => {
            const spy = vi.spyOn(svc(), 'downloadFile');
            svc().downloadJSON({ test: 'data' }, 'backup.json');

            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining('"test"'),
                'backup.json',
                'application/json'
            );
            spy.mockRestore();
        });
    });

    // ── Round-trip: export then parse ──

    describe('CSV round-trip', () => {
        it('should round-trip kunden data through CSV export and parse', () => {
            const csv = svc().convertToCSV('kunden', kundenData);
            const csvWithoutBOM = csv.replace('\uFEFF', '');
            const parsed = svc().parseCSV(csvWithoutBOM, 'kunden');

            expect(parsed).toHaveLength(2);
            expect(parsed[0].name).toBe('Müller Metallbau GmbH');
            expect(parsed[0].email).toBe('info@mueller-metallbau.de');
            expect(parsed[0].stadt).toBe('Berlin');
            expect(parsed[1].name).toBe('Schmidt & Söhne Elektrik');
        });

        it('should round-trip materialien data through CSV export and parse', () => {
            const csv = svc().convertToCSV('materialien', materialienData);
            const csvWithoutBOM = csv.replace('\uFEFF', '');
            const parsed = svc().parseCSV(csvWithoutBOM, 'materialien');

            expect(parsed).toHaveLength(2);
            expect(parsed[0].id).toBe('MAT-001');
            expect(parsed[0].name).toBe('Stahlblech 2mm');
            expect(parsed[1].lagerort).toBe('Lager B');
        });

        it('should round-trip buchungen data through CSV export and parse', () => {
            const csv = svc().convertToCSV('buchungen', buchungenData);
            const csvWithoutBOM = csv.replace('\uFEFF', '');
            const parsed = svc().parseCSV(csvWithoutBOM, 'buchungen');

            expect(parsed).toHaveLength(2);
            expect(parsed[0].beschreibung).toBe('Stahlträger Lieferung');
            expect(parsed[1].typ).toBe('einnahme');
        });
    });
});
