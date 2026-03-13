import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => fallback),
};

globalThis.document = {
    createElement: vi.fn((tag) => {
        if (tag === 'canvas') {
            return {
                width: 0, height: 0,
                getContext: () => ({
                    fillStyle: '',
                    fillRect: vi.fn(),
                    imageSmoothingEnabled: true,
                    drawImage: vi.fn(),
                }),
                toDataURL: vi.fn(() => 'data:image/png;base64,mockdata'),
            };
        }
        return { src: '', width: 0, height: 0, alt: '', style: {} };
    }),
};

globalThis.window = globalThis;
globalThis.TextEncoder = TextEncoder;
window.eInvoiceService = null;
window.APP_CONFIG = {};

await import('../js/services/epc-qr-service.js');

const svc = () => window.epcQrService;

// ============================================
// Tests
// ============================================

describe('EpcQrService', () => {
    beforeEach(() => {
        svc().defaultBankDetails = null;
    });

    // ── IBAN Validation ──

    describe('validateIBAN', () => {
        it('validates correct German IBAN', () => {
            const result = svc().validateIBAN('DE89 3704 0044 0532 0130 00');
            expect(result.valid).toBe(true);
            expect(result.error).toBeNull();
        });

        it('validates IBAN without spaces', () => {
            const result = svc().validateIBAN('DE89370400440532013000');
            expect(result.valid).toBe(true);
        });

        it('rejects empty IBAN', () => {
            expect(svc().validateIBAN('').valid).toBe(false);
            expect(svc().validateIBAN(null).valid).toBe(false);
        });

        it('rejects IBAN with wrong length', () => {
            const result = svc().validateIBAN('DE891234');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('22 Zeichen');
        });

        it('rejects IBAN with wrong checksum', () => {
            const result = svc().validateIBAN('DE00370400440532013000');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Prüfsumme');
        });

        it('rejects unknown country code', () => {
            const result = svc().validateIBAN('XX12345678901234567890');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Ländercode');
        });

        it('validates Austrian IBAN', () => {
            const result = svc().validateIBAN('AT611904300234573201');
            expect(result.valid).toBe(true);
        });

        it('validates Swiss IBAN', () => {
            const result = svc().validateIBAN('CH9300762011623852957');
            expect(result.valid).toBe(true);
        });

        it('handles lowercase input', () => {
            const result = svc().validateIBAN('de89370400440532013000');
            expect(result.valid).toBe(true);
        });

        it('rejects IBAN with invalid characters', () => {
            const result = svc().validateIBAN('DE89!70400440532013000');
            expect(result.valid).toBe(false);
        });
    });

    // ── BIC Validation ──

    describe('validateBIC', () => {
        it('validates 8-char BIC', () => {
            const result = svc().validateBIC('COBADEFF');
            expect(result.valid).toBe(true);
        });

        it('validates 11-char BIC', () => {
            const result = svc().validateBIC('COBADEFFXXX');
            expect(result.valid).toBe(true);
        });

        it('rejects empty BIC', () => {
            expect(svc().validateBIC('').valid).toBe(false);
            expect(svc().validateBIC(null).valid).toBe(false);
        });

        it('rejects wrong length BIC', () => {
            expect(svc().validateBIC('COBAD').valid).toBe(false);
        });

        it('rejects BIC with invalid format', () => {
            expect(svc().validateBIC('12345678').valid).toBe(false);
        });

        it('handles lowercase', () => {
            expect(svc().validateBIC('cobadeff').valid).toBe(true);
        });
    });

    // ── EPC Payload ──

    describe('buildEpcPayload', () => {
        const bank = {
            iban: 'DE89370400440532013000',
            bic: 'COBADEFFXXX',
            recipientName: 'Max Mustermann',
        };

        it('builds correct BCD payload', () => {
            const payload = svc().buildEpcPayload({ brutto: 119.00, nummer: 'RE-2024-001' }, bank);
            const lines = payload.split('\n');
            expect(lines[0]).toBe('BCD');
            expect(lines[1]).toBe('002');
            expect(lines[2]).toBe('1');
            expect(lines[3]).toBe('SCT');
            expect(lines[4]).toBe('COBADEFFXXX');
            expect(lines[5]).toBe('Max Mustermann');
            expect(lines[6]).toBe('DE89370400440532013000');
            expect(lines[7]).toBe('EUR119.00');
            expect(lines[10]).toBe('RE-2024-001');
        });

        it('uses betrag if brutto not set', () => {
            const payload = svc().buildEpcPayload({ betrag: 50.00, nummer: 'INV-1' }, bank);
            expect(payload).toContain('EUR50.00');
        });

        it('throws for missing IBAN', () => {
            expect(() => svc().buildEpcPayload({ brutto: 100 }, { recipientName: 'Test' }))
                .toThrow('IBAN');
        });

        it('throws for missing recipient name', () => {
            expect(() => svc().buildEpcPayload({ brutto: 100 }, { iban: 'DE89370400440532013000' }))
                .toThrow('Empfängername');
        });

        it('throws for invalid amount', () => {
            expect(() => svc().buildEpcPayload({ brutto: 0 }, bank)).toThrow('Betrag');
            expect(() => svc().buildEpcPayload({ brutto: -10 }, bank)).toThrow('Betrag');
        });

        it('truncates reference to 140 chars', () => {
            const longRef = 'A'.repeat(200);
            const payload = svc().buildEpcPayload({ brutto: 100, nummer: longRef }, bank);
            const lines = payload.split('\n');
            expect(lines[10].length).toBe(140);
        });

        it('truncates recipient name to 70 chars', () => {
            const longBank = { ...bank, recipientName: 'X'.repeat(100) };
            const payload = svc().buildEpcPayload({ brutto: 100, nummer: 'RE-1' }, longBank);
            const lines = payload.split('\n');
            expect(lines[5].length).toBe(70);
        });

        it('handles optional BIC (empty string)', () => {
            const noBic = { iban: 'DE89370400440532013000', bic: '', recipientName: 'Test' };
            const payload = svc().buildEpcPayload({ brutto: 100, nummer: 'RE-1' }, noBic);
            const lines = payload.split('\n');
            expect(lines[4]).toBe('');
        });
    });

    // ── Bank Details Resolution ──

    describe('Bank Details', () => {
        it('uses setBankDetails override', () => {
            svc().setBankDetails({ iban: 'DE1234', bic: 'BIC', recipientName: 'Custom' });
            const details = svc().getBankDetails();
            expect(details.iban).toBe('DE1234');
            expect(details.recipientName).toBe('Custom');
        });

        it('falls back to defaults when no config', () => {
            const details = svc().getBankDetails();
            expect(details.recipientName).toBe('FreyAI Visions');
        });
    });

    // ── QR Code Generation ──

    describe('QR Code Generation', () => {
        const bank = {
            iban: 'DE89370400440532013000',
            bic: 'COBADEFFXXX',
            recipientName: 'Test GmbH',
        };

        it('generates QR data URL', () => {
            svc().setBankDetails(bank);
            const result = svc().generateEpcQrCode({ brutto: 119.00, nummer: 'RE-001' });
            expect(result).toMatch(/^data:image\/png/);
        });

        it('returns null for invalid IBAN', () => {
            svc().setBankDetails({ ...bank, iban: 'INVALID' });
            const result = svc().generateEpcQrCode({ brutto: 100, nummer: 'RE-1' });
            expect(result).toBeNull();
        });

        it('returns null for invalid BIC', () => {
            svc().setBankDetails({ ...bank, bic: '123' });
            const result = svc().generateEpcQrCode({ brutto: 100, nummer: 'RE-1' });
            expect(result).toBeNull();
        });
    });

    // ── QR Encoder Internal ──

    describe('QR Encoder', () => {
        it('selects appropriate version for short text', () => {
            expect(svc()._selectVersion(10, 0)).toBe(1);
        });

        it('selects higher version for longer text', () => {
            expect(svc()._selectVersion(100, 0)).toBeGreaterThan(1);
        });

        it('returns -1 for data too long', () => {
            expect(svc()._selectVersion(999, 0)).toBe(-1);
        });

        it('encodes without throwing', () => {
            const modules = svc()._encode('Hello');
            expect(modules.length).toBeGreaterThan(0);
            expect(modules[0].length).toBe(modules.length); // square
        });

        it('throws for data exceeding capacity', () => {
            expect(() => svc()._encode('X'.repeat(999))).toThrow();
        });
    });

    // ── GF(256) arithmetic ──

    describe('GF(256)', () => {
        it('initializes lookup tables', () => {
            expect(svc()._gfExp.length).toBe(256);
            expect(svc()._gfLog.length).toBe(256);
        });

        it('gfMul returns 0 when multiplying by 0', () => {
            expect(svc()._gfMul(0, 42)).toBe(0);
            expect(svc()._gfMul(42, 0)).toBe(0);
        });

        it('gfMul(1, x) = x', () => {
            expect(svc()._gfMul(1, 42)).toBe(42);
        });
    });
});
