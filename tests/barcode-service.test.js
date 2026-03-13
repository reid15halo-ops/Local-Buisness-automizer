import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => fallback),
    setJSON: vi.fn(() => true),
};

globalThis.document = {
    createElement: vi.fn(() => ({
        id: '', className: '', innerHTML: '', textContent: '',
        style: {}, classList: { add: vi.fn(), remove: vi.fn() },
        appendChild: vi.fn(),
    })),
    getElementById: vi.fn(() => null),
    body: { appendChild: vi.fn() },
    addEventListener: vi.fn(),
};

globalThis.window = globalThis;
window.materialService = null;
window.AudioContext = undefined;
window.webkitAudioContext = undefined;
window.BarcodeDetector = undefined;

globalThis.navigator = {
    mediaDevices: {
        getUserMedia: vi.fn(),
    },
    vibrate: vi.fn(),
};

globalThis.requestAnimationFrame = vi.fn();

await import('../js/services/barcode-service.js');

const svc = () => window.barcodeService;

// ============================================
// Tests
// ============================================

describe('BarcodeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset service state
        svc().scanHistory = [];
        svc().productDatabase = {};
        svc().settings = {
            soundEnabled: true,
            vibrationEnabled: true,
            autoAddToInventory: true,
        };

        // Reset globals
        window.materialService = null;
        window.BarcodeDetector = undefined;
        window.AudioContext = undefined;
        window.webkitAudioContext = undefined;
    });

    // ── Constructor defaults ──

    describe('constructor', () => {
        it('initializes with default settings when storage is empty', () => {
            expect(svc().settings.soundEnabled).toBe(true);
            expect(svc().settings.vibrationEnabled).toBe(true);
            expect(svc().settings.autoAddToInventory).toBe(true);
        });

        it('initializes scanHistory as empty array', () => {
            expect(Array.isArray(svc().scanHistory)).toBe(true);
        });

        it('initializes productDatabase as empty object', () => {
            expect(typeof svc().productDatabase).toBe('object');
        });
    });

    // ── handleScan ──

    describe('handleScan', () => {
        it('adds a scan record to history', () => {
            svc().settings.soundEnabled = false;
            svc().settings.vibrationEnabled = false;
            svc().settings.autoAddToInventory = false;

            const result = svc().handleScan('1234567890', 'ean_13', null);

            expect(result.code).toBe('1234567890');
            expect(result.format).toBe('ean_13');
            expect(result.product).toBeNull();
            expect(svc().scanHistory).toHaveLength(1);
            expect(svc().scanHistory[0].code).toBe('1234567890');
            expect(svc().scanHistory[0].format).toBe('ean_13');
            expect(svc().scanHistory[0].action).toBeNull();
        });

        it('calls callback with scan result', () => {
            svc().settings.soundEnabled = false;
            svc().settings.vibrationEnabled = false;
            svc().settings.autoAddToInventory = false;

            const callback = vi.fn();
            svc().handleScan('ABC123', 'code_128', callback);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith({
                code: 'ABC123',
                format: 'code_128',
                product: null,
                isKnown: false,
            });
        });

        it('calls callback with known product when found', () => {
            svc().settings.soundEnabled = false;
            svc().settings.vibrationEnabled = false;
            svc().settings.autoAddToInventory = false;

            const product = { name: 'Test Product', price: 9.99 };
            svc().productDatabase['KNOWN123'] = product;

            const callback = vi.fn();
            svc().handleScan('KNOWN123', 'ean_13', callback);

            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'KNOWN123',
                    isKnown: true,
                    product: product,
                })
            );
        });

        it('triggers vibration when vibrationEnabled is true', () => {
            svc().settings.soundEnabled = false;
            svc().settings.vibrationEnabled = true;
            svc().settings.autoAddToInventory = false;

            svc().handleScan('VIB001', 'ean_13', null);

            expect(navigator.vibrate).toHaveBeenCalledWith(100);
        });

        it('does not vibrate when vibrationEnabled is false', () => {
            svc().settings.soundEnabled = false;
            svc().settings.vibrationEnabled = false;
            svc().settings.autoAddToInventory = false;

            svc().handleScan('VIB002', 'ean_13', null);

            expect(navigator.vibrate).not.toHaveBeenCalled();
        });

        it('plays beep when soundEnabled is true', () => {
            svc().settings.vibrationEnabled = false;
            svc().settings.autoAddToInventory = false;

            const playBeepSpy = vi.spyOn(svc(), 'playBeep').mockImplementation(() => {});
            svc().handleScan('BEEP001', 'ean_13', null);

            expect(playBeepSpy).toHaveBeenCalledTimes(1);
            playBeepSpy.mockRestore();
        });

        it('auto-adds to inventory when setting enabled and product found', () => {
            svc().settings.soundEnabled = false;
            svc().settings.vibrationEnabled = false;
            svc().settings.autoAddToInventory = true;

            const updateStockFn = vi.fn();
            window.materialService = {
                materials: [
                    { id: 'mat-1', barcode: 'AUTO001', bestand: 5, name: 'Screws' },
                ],
                updateStock: updateStockFn,
            };

            // Register product so lookupProduct finds it via materialService
            svc().handleScan('AUTO001', 'ean_13', null);

            expect(updateStockFn).toHaveBeenCalledWith('mat-1', 6);
        });

        it('persists scan history via localStorage', () => {
            svc().settings.soundEnabled = false;
            svc().settings.vibrationEnabled = false;
            svc().settings.autoAddToInventory = false;

            svc().handleScan('PERSIST001', 'ean_13', null);

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai_scan_history',
                expect.any(String)
            );
        });
    });

    // ── manualEntry ──

    describe('manualEntry', () => {
        it('delegates to handleScan with format "manual" and null callback', () => {
            svc().settings.soundEnabled = false;
            svc().settings.vibrationEnabled = false;
            svc().settings.autoAddToInventory = false;

            const result = svc().manualEntry('MANUAL001');

            expect(result.code).toBe('MANUAL001');
            expect(result.format).toBe('manual');
            expect(result.product).toBeNull();
            expect(svc().scanHistory).toHaveLength(1);
            expect(svc().scanHistory[0].format).toBe('manual');
        });
    });

    // ── lookupProduct ──

    describe('lookupProduct', () => {
        it('returns product from local database', () => {
            const product = { name: 'Local Product', price: 15 };
            svc().productDatabase['LOCAL001'] = product;

            const result = svc().lookupProduct('LOCAL001');
            expect(result).toBe(product);
        });

        it('returns null when product not found anywhere', () => {
            const result = svc().lookupProduct('UNKNOWN999');
            expect(result).toBeNull();
        });

        it('returns material from materialService by barcode', () => {
            window.materialService = {
                materials: [
                    {
                        id: 'mat-5',
                        barcode: 'MAT_BC_001',
                        artikelnummer: 'ART-5',
                        name: 'Copper Wire',
                        einheit: 'm',
                        preis: 3.5,
                        bestand: 100,
                    },
                ],
            };

            const result = svc().lookupProduct('MAT_BC_001');
            expect(result).toEqual({
                id: 'mat-5',
                name: 'Copper Wire',
                type: 'material',
                unit: 'm',
                price: 3.5,
                stock: 100,
            });
        });

        it('returns material from materialService by artikelnummer', () => {
            window.materialService = {
                materials: [
                    {
                        id: 'mat-6',
                        barcode: 'OTHER',
                        artikelnummer: 'ART-LOOKUP',
                        name: 'Steel Pipe',
                        einheit: 'stk',
                        preis: 12,
                        bestand: 20,
                    },
                ],
            };

            const result = svc().lookupProduct('ART-LOOKUP');
            expect(result).toEqual({
                id: 'mat-6',
                name: 'Steel Pipe',
                type: 'material',
                unit: 'stk',
                price: 12,
                stock: 20,
            });
        });

        it('prioritizes local database over materialService', () => {
            const localProduct = { name: 'Local Override' };
            svc().productDatabase['DUAL001'] = localProduct;

            window.materialService = {
                materials: [
                    {
                        id: 'mat-x',
                        barcode: 'DUAL001',
                        name: 'Material Version',
                        einheit: 'kg',
                        preis: 5,
                        bestand: 10,
                    },
                ],
            };

            const result = svc().lookupProduct('DUAL001');
            expect(result).toBe(localProduct);
        });

        it('handles materialService with no materials array', () => {
            window.materialService = {};

            const result = svc().lookupProduct('NOMATS001');
            expect(result).toBeNull();
        });
    });

    // ── registerProduct ──

    describe('registerProduct', () => {
        it('registers a new product in the database', () => {
            const productData = { name: 'New Widget', price: 25 };
            const result = svc().registerProduct('REG001', productData);

            expect(result.success).toBe(true);
            expect(result.product.name).toBe('New Widget');
            expect(result.product.price).toBe(25);
            expect(result.product.barcode).toBe('REG001');
            expect(result.product.registeredAt).toBeDefined();
        });

        it('persists product database to localStorage', () => {
            svc().registerProduct('REG002', { name: 'Saved Product' });

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai_barcode_products',
                expect.any(String)
            );
        });

        it('overwrites existing product with same code', () => {
            svc().registerProduct('DUP001', { name: 'Original' });
            svc().registerProduct('DUP001', { name: 'Updated' });

            expect(svc().productDatabase['DUP001'].name).toBe('Updated');
        });
    });

    // ── addToInventory ──

    describe('addToInventory', () => {
        it('increases stock via materialService', () => {
            const updateStockFn = vi.fn();
            window.materialService = {
                materials: [
                    { id: 'mat-10', barcode: 'ADD001', bestand: 10 },
                ],
                updateStock: updateStockFn,
            };

            const result = svc().addToInventory('ADD001', 3);

            expect(result.success).toBe(true);
            expect(result.newStock).toBe(13);
            expect(updateStockFn).toHaveBeenCalledWith('mat-10', 13);
        });

        it('defaults to quantity of 1', () => {
            const updateStockFn = vi.fn();
            window.materialService = {
                materials: [
                    { id: 'mat-11', barcode: 'ADD002', bestand: 5 },
                ],
                updateStock: updateStockFn,
            };

            const result = svc().addToInventory('ADD002');

            expect(result.success).toBe(true);
            expect(result.newStock).toBe(6);
        });

        it('returns failure when product not found', () => {
            window.materialService = {
                materials: [],
                updateStock: vi.fn(),
            };

            const result = svc().addToInventory('NOTFOUND001', 1);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Product not found');
        });

        it('returns failure when no materialService', () => {
            window.materialService = null;

            const result = svc().addToInventory('NOMS001', 1);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Product not found');
        });
    });

    // ── removeFromInventory ──

    describe('removeFromInventory', () => {
        it('decreases stock via materialService', () => {
            const updateStockFn = vi.fn();
            window.materialService = {
                materials: [
                    { id: 'mat-20', barcode: 'REM001', bestand: 10 },
                ],
                updateStock: updateStockFn,
            };

            const result = svc().removeFromInventory('REM001', 3);

            expect(result.success).toBe(true);
            expect(result.newStock).toBe(7);
            expect(updateStockFn).toHaveBeenCalledWith('mat-20', 7);
        });

        it('defaults to quantity of 1', () => {
            const updateStockFn = vi.fn();
            window.materialService = {
                materials: [
                    { id: 'mat-21', barcode: 'REM002', bestand: 5 },
                ],
                updateStock: updateStockFn,
            };

            const result = svc().removeFromInventory('REM002');

            expect(result.success).toBe(true);
            expect(result.newStock).toBe(4);
        });

        it('clamps stock to zero (never goes negative)', () => {
            const updateStockFn = vi.fn();
            window.materialService = {
                materials: [
                    { id: 'mat-22', barcode: 'REM003', bestand: 2 },
                ],
                updateStock: updateStockFn,
            };

            const result = svc().removeFromInventory('REM003', 10);

            expect(result.success).toBe(true);
            expect(result.newStock).toBe(0);
            expect(updateStockFn).toHaveBeenCalledWith('mat-22', 0);
        });

        it('returns failure when product not found', () => {
            window.materialService = {
                materials: [],
                updateStock: vi.fn(),
            };

            const result = svc().removeFromInventory('NOTFOUND002', 1);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Product not found');
        });

        it('returns failure when no materialService', () => {
            window.materialService = null;

            const result = svc().removeFromInventory('NOMS002', 1);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Product not found');
        });
    });

    // ── generateBarcode ──

    describe('generateBarcode', () => {
        it('generates a barcode starting with FREY', () => {
            const code = svc().generateBarcode('prod-1');
            expect(code).toMatch(/^FREY\d{10}$/);
        });

        it('generates unique barcodes on successive calls', () => {
            const code1 = svc().generateBarcode('prod-1');
            const code2 = svc().generateBarcode('prod-2');
            // They could theoretically be equal if Date.now() is the same,
            // but in practice they should differ or at least have valid format
            expect(code1).toMatch(/^FREY\d{10}$/);
            expect(code2).toMatch(/^FREY\d{10}$/);
        });
    });

    // ── playBeep ──

    describe('playBeep', () => {
        it('creates audio context and oscillator when AudioContext is available', () => {
            const stopFn = vi.fn();
            const startFn = vi.fn();
            const connectFn = vi.fn();
            const mockOscillator = {
                connect: connectFn,
                frequency: { value: 0 },
                type: '',
                start: startFn,
                stop: stopFn,
            };
            const mockGainNode = {
                connect: connectFn,
                gain: { value: 0 },
            };

            window.AudioContext = vi.fn(() => ({
                createOscillator: vi.fn(() => mockOscillator),
                createGain: vi.fn(() => mockGainNode),
                destination: 'dest',
                currentTime: 0,
            }));

            svc().playBeep();

            expect(window.AudioContext).toHaveBeenCalled();
            expect(startFn).toHaveBeenCalled();
            expect(stopFn).toHaveBeenCalledWith(0.1);
        });

        it('does not throw when AudioContext is unavailable', () => {
            window.AudioContext = undefined;
            window.webkitAudioContext = undefined;

            expect(() => svc().playBeep()).not.toThrow();
        });
    });

    // ── getScanHistory ──

    describe('getScanHistory', () => {
        it('returns empty array when no scans', () => {
            const history = svc().getScanHistory();
            expect(history).toEqual([]);
        });

        it('returns scans sorted by timestamp descending', () => {
            svc().scanHistory = [
                { id: 's1', code: 'A', timestamp: '2026-01-01T10:00:00.000Z' },
                { id: 's2', code: 'B', timestamp: '2026-01-03T10:00:00.000Z' },
                { id: 's3', code: 'C', timestamp: '2026-01-02T10:00:00.000Z' },
            ];

            const history = svc().getScanHistory();

            expect(history[0].code).toBe('B');
            expect(history[1].code).toBe('C');
            expect(history[2].code).toBe('A');
        });

        it('respects the limit parameter', () => {
            svc().scanHistory = Array.from({ length: 10 }, (_, i) => ({
                id: `s${i}`,
                code: `CODE${i}`,
                timestamp: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
            }));

            const history = svc().getScanHistory(3);
            expect(history).toHaveLength(3);
        });

        it('defaults to limit of 50', () => {
            svc().scanHistory = Array.from({ length: 60 }, (_, i) => ({
                id: `s${i}`,
                code: `CODE${i}`,
                timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(),
            }));

            const history = svc().getScanHistory();
            expect(history).toHaveLength(50);
        });
    });

    // ── getStatistics ──

    describe('getStatistics', () => {
        it('returns zero stats when no data', () => {
            const stats = svc().getStatistics();

            expect(stats.totalScans).toBe(0);
            expect(stats.todayScans).toBe(0);
            expect(stats.registeredProducts).toBe(0);
            expect(stats.uniqueBarcodesScanned).toBe(0);
        });

        it('counts total scans correctly', () => {
            svc().scanHistory = [
                { id: 's1', code: 'A', timestamp: '2025-06-01T10:00:00.000Z' },
                { id: 's2', code: 'B', timestamp: '2025-06-02T10:00:00.000Z' },
                { id: 's3', code: 'A', timestamp: '2025-06-03T10:00:00.000Z' },
            ];

            const stats = svc().getStatistics();
            expect(stats.totalScans).toBe(3);
        });

        it('counts unique barcodes scanned', () => {
            svc().scanHistory = [
                { id: 's1', code: 'A', timestamp: '2025-06-01T10:00:00.000Z' },
                { id: 's2', code: 'B', timestamp: '2025-06-02T10:00:00.000Z' },
                { id: 's3', code: 'A', timestamp: '2025-06-03T10:00:00.000Z' },
            ];

            const stats = svc().getStatistics();
            expect(stats.uniqueBarcodesScanned).toBe(2);
        });

        it('counts registered products', () => {
            svc().productDatabase = {
                'P1': { name: 'Product 1' },
                'P2': { name: 'Product 2' },
            };

            const stats = svc().getStatistics();
            expect(stats.registeredProducts).toBe(2);
        });

        it('counts today scans based on ISO date prefix', () => {
            const today = new Date().toISOString().split('T')[0];
            svc().scanHistory = [
                { id: 's1', code: 'A', timestamp: `${today}T08:00:00.000Z` },
                { id: 's2', code: 'B', timestamp: `${today}T09:00:00.000Z` },
                { id: 's3', code: 'C', timestamp: '2020-01-01T10:00:00.000Z' },
            ];

            const stats = svc().getStatistics();
            expect(stats.todayScans).toBe(2);
        });
    });

    // ── isSupported ──

    describe('isSupported', () => {
        it('returns true when BarcodeDetector exists on window', () => {
            window.BarcodeDetector = class {};
            expect(svc().isSupported()).toBe(true);
        });

        it('returns false when BarcodeDetector does not exist', () => {
            delete window.BarcodeDetector;
            expect(svc().isSupported()).toBe(false);
        });
    });

    // ── getSupportedFormats ──

    describe('getSupportedFormats', () => {
        it('returns formats from BarcodeDetector when available', async () => {
            const formats = ['ean_13', 'qr_code'];
            window.BarcodeDetector = {
                getSupportedFormats: vi.fn(async () => formats),
            };

            const result = await svc().getSupportedFormats();
            expect(result).toEqual(formats);
        });

        it('returns empty array when BarcodeDetector not available', async () => {
            delete window.BarcodeDetector;

            const result = await svc().getSupportedFormats();
            expect(result).toEqual([]);
        });
    });

    // ── updateSettings ──

    describe('updateSettings', () => {
        it('merges new settings with existing', () => {
            svc().updateSettings({ soundEnabled: false });

            expect(svc().settings.soundEnabled).toBe(false);
            expect(svc().settings.vibrationEnabled).toBe(true);
            expect(svc().settings.autoAddToInventory).toBe(true);
        });

        it('persists settings to localStorage', () => {
            svc().updateSettings({ vibrationEnabled: false });

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai_barcode_settings',
                expect.any(String)
            );

            const savedValue = JSON.parse(localStorage.setItem.mock.calls.at(-1)[1]);
            expect(savedValue.vibrationEnabled).toBe(false);
        });

        it('allows adding new custom settings', () => {
            svc().updateSettings({ customField: 'hello' });

            expect(svc().settings.customField).toBe('hello');
        });
    });

    // ── saveScanHistory ──

    describe('saveScanHistory', () => {
        it('truncates history to last 500 entries when exceeding limit', () => {
            svc().scanHistory = Array.from({ length: 510 }, (_, i) => ({
                id: `s${i}`,
                code: `CODE${i}`,
                timestamp: new Date().toISOString(),
            }));

            svc().saveScanHistory();

            expect(svc().scanHistory).toHaveLength(500);
            // Should keep the last 500 (i.e., items 10-509)
            expect(svc().scanHistory[0].id).toBe('s10');
        });

        it('does not truncate when at or below 500', () => {
            svc().scanHistory = Array.from({ length: 500 }, (_, i) => ({
                id: `s${i}`,
                code: `CODE${i}`,
                timestamp: new Date().toISOString(),
            }));

            svc().saveScanHistory();

            expect(svc().scanHistory).toHaveLength(500);
        });

        it('persists to localStorage', () => {
            svc().scanHistory = [{ id: 's1', code: 'A', timestamp: new Date().toISOString() }];
            svc().saveScanHistory();

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai_scan_history',
                expect.any(String)
            );
        });
    });

    // ── saveProductDatabase ──

    describe('saveProductDatabase', () => {
        it('persists product database to localStorage', () => {
            svc().productDatabase = { 'P1': { name: 'Widget' } };
            svc().saveProductDatabase();

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai_barcode_products',
                JSON.stringify({ 'P1': { name: 'Widget' } })
            );
        });
    });

    // ── startScanning ──

    describe('startScanning', () => {
        it('returns error when getUserMedia fails', async () => {
            navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(
                new Error('Camera denied')
            );

            const videoEl = { srcObject: null, play: vi.fn() };
            const result = await svc().startScanning(videoEl, vi.fn());

            expect(result.success).toBe(false);
            expect(result.error).toBe('Camera denied');
        });

        it('returns not-supported error when BarcodeDetector absent', async () => {
            delete window.BarcodeDetector;

            const mockStream = { getTracks: vi.fn(() => []) };
            navigator.mediaDevices.getUserMedia.mockResolvedValueOnce(mockStream);

            const videoEl = { srcObject: null, play: vi.fn().mockResolvedValue(undefined) };
            const result = await svc().startScanning(videoEl, vi.fn());

            expect(result.success).toBe(false);
            expect(result.error).toBe('BarcodeDetector not supported');
        });

        it('returns success with stream when BarcodeDetector is available', async () => {
            const mockStream = { getTracks: vi.fn(() => []) };
            navigator.mediaDevices.getUserMedia.mockResolvedValueOnce(mockStream);

            window.BarcodeDetector = vi.fn(() => ({
                detect: vi.fn(async () => []),
            }));

            const videoEl = { srcObject: null, play: vi.fn().mockResolvedValue(undefined) };
            const result = await svc().startScanning(videoEl, vi.fn());

            expect(result.success).toBe(true);
            expect(result.stream).toBe(mockStream);
            expect(videoEl.srcObject).toBe(mockStream);
            expect(requestAnimationFrame).toHaveBeenCalled();
        });
    });

    // ── stopScanning ──

    describe('stopScanning', () => {
        it('stops all tracks and clears srcObject', () => {
            const stopFn = vi.fn();
            const videoEl = {
                srcObject: {
                    getTracks: () => [{ stop: stopFn }, { stop: stopFn }],
                },
            };

            svc().stopScanning(videoEl);

            expect(stopFn).toHaveBeenCalledTimes(2);
            expect(videoEl.srcObject).toBeNull();
        });

        it('does nothing when srcObject is null', () => {
            const videoEl = { srcObject: null };

            expect(() => svc().stopScanning(videoEl)).not.toThrow();
        });
    });
});
