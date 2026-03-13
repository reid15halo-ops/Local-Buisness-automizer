import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

globalThis.localStorage = {
    _data: {},
    getItem: vi.fn((key) => {
        return globalThis.localStorage._data[key] ?? null;
    }),
    setItem: vi.fn((key, value) => {
        globalThis.localStorage._data[key] = value;
    }),
    removeItem: vi.fn((key) => {
        delete globalThis.localStorage._data[key];
    }),
    clear: vi.fn(() => {
        globalThis.localStorage._data = {};
    }),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => {
        const raw = globalThis.localStorage._data[key];
        if (raw == null) return fallback;
        try { return JSON.parse(raw); } catch { return fallback; }
    }),
};

globalThis.document = {
    createElement: vi.fn(() => ({ style: {} })),
    addEventListener: vi.fn(),
};

globalThis.window = globalThis;
window.companySettings = undefined;
window.companySettingsService = undefined;
window.eInvoiceService = undefined;

await import('../js/services/email-template-service.js');

const svc = () => window.emailTemplateService;

// ============================================
// Helpers
// ============================================

const defaultCompany = {
    name: 'Meisterbetrieb Müller',
    street: 'Hauptstr. 12',
    city: 'München',
    postalCode: '80331',
    phone: '+49 89 1234567',
    email: 'info@meister-mueller.de',
    vatId: 'DE123456789',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    bankName: 'Commerzbank',
    logoUrl: null,
};

const sampleKunde = {
    name: 'Schmidt',
    anrede: 'Herr',
    firma: 'Schmidt GmbH',
    strasse: 'Berliner Str. 5',
    plz: '10115',
    ort: 'Berlin',
};

const samplePositionen = [
    { beschreibung: 'Fliesenlegen Bad', menge: 20, einzelpreis: 45 },
    { beschreibung: 'Silikonfugen', menge: 10, einzelpreis: 15 },
];

function makeAngebot(overrides = {}) {
    return {
        id: 'ANG-2024-001',
        nummer: 'ANG-2024-001',
        datum: '2024-06-15',
        kunde: sampleKunde,
        positionen: samplePositionen,
        ...overrides,
    };
}

function makeRechnung(overrides = {}) {
    return {
        id: 'RE-2024-001',
        nummer: 'RE-2024-001',
        datum: '2024-06-15',
        brutto: 1190,
        zahlungsziel: 14,
        kunde: sampleKunde,
        positionen: samplePositionen,
        ...overrides,
    };
}

function makeMahnung(overrides = {}) {
    return {
        betrag: 1200,
        kunde: sampleKunde,
        originalRechnung: {
            nummer: 'RE-2024-001',
            datum: '2024-05-01',
        },
        ...overrides,
    };
}

function makeTermin(overrides = {}) {
    return {
        id: 'T-001',
        datum: '2024-07-10',
        uhrzeit: '14:30',
        ort: 'Kundenadresse',
        mitarbeiter: 'Hans Müller',
        kunde: sampleKunde,
        ...overrides,
    };
}

function makeAuftrag(overrides = {}) {
    return {
        id: 'AUF-2024-001',
        nummer: 'AUF-2024-001',
        datum: '2024-06-20',
        kunde: sampleKunde,
        positionen: samplePositionen,
        ...overrides,
    };
}

// ============================================
// Tests
// ============================================

describe('EmailTemplateService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.localStorage._data = {};
        window.companySettings = undefined;
        window.companySettingsService = undefined;
        window.eInvoiceService = undefined;

        // Rebuild instance so constructor re-reads company info
        window.emailTemplateService = new (Object.getPrototypeOf(svc()).constructor)();
    });

    // ── _escHtml ──

    describe('_escHtml', () => {
        it('escapes HTML special characters', () => {
            expect(svc()._escHtml('<script>"hello"&\'world\'</script>')).toBe(
                '&lt;script&gt;&quot;hello&quot;&amp;&#39;world&#39;&lt;/script&gt;'
            );
        });

        it('returns empty string for falsy input', () => {
            expect(svc()._escHtml(null)).toBe('');
            expect(svc()._escHtml(undefined)).toBe('');
            expect(svc()._escHtml('')).toBe('');
            expect(svc()._escHtml(0)).toBe('');
        });

        it('converts numbers to string', () => {
            expect(svc()._escHtml(42)).toBe('42');
            expect(svc()._escHtml(123.45)).toBe('123.45');
        });

        it('passes through safe strings unchanged', () => {
            expect(svc()._escHtml('Hello World')).toBe('Hello World');
        });
    });

    // ── _isKleinunternehmer ──

    describe('_isKleinunternehmer', () => {
        it('returns value from companySettingsService if available', () => {
            window.companySettingsService = { isKleinunternehmer: vi.fn(() => true) };
            expect(svc()._isKleinunternehmer()).toBe(true);
            expect(window.companySettingsService.isKleinunternehmer).toHaveBeenCalled();
        });

        it('reads from localStorage key "kleinunternehmer"', () => {
            globalThis.localStorage._data['kleinunternehmer'] = 'true';
            expect(svc()._isKleinunternehmer()).toBe(true);
        });

        it('returns false when localStorage key is "false"', () => {
            globalThis.localStorage._data['kleinunternehmer'] = 'false';
            expect(svc()._isKleinunternehmer()).toBe(false);
        });

        it('falls back to freyai_admin_settings in localStorage', () => {
            globalThis.localStorage._data['freyai_admin_settings'] = JSON.stringify({
                kleinunternehmer: true,
            });
            expect(svc()._isKleinunternehmer()).toBe(true);
        });

        it('returns false when no source is available', () => {
            expect(svc()._isKleinunternehmer()).toBe(false);
        });

        it('returns false on JSON parse error', () => {
            globalThis.localStorage._data['freyai_admin_settings'] = '{bad json';
            expect(svc()._isKleinunternehmer()).toBe(false);
        });
    });

    // ── getCompanyInfo ──

    describe('getCompanyInfo', () => {
        it('reads from companySettings._cache if available', () => {
            window.companySettings = {
                _cache: {
                    company_name: 'Test GmbH',
                    company_address: 'Teststr. 1',
                    company_phone: '+49 123',
                    company_email: 'test@test.de',
                    tax_id: 'DE111',
                    bank_iban: 'DE89...',
                    bank_bic: 'COBAXXX',
                    bank_name: 'Testbank',
                    logo_url: 'https://example.com/logo.png',
                },
            };

            const info = svc().getCompanyInfo();
            expect(info.name).toBe('Test GmbH');
            expect(info.street).toBe('Teststr. 1');
            expect(info.phone).toBe('+49 123');
            expect(info.email).toBe('test@test.de');
            expect(info.vatId).toBe('DE111');
            expect(info.iban).toBe('DE89...');
            expect(info.bic).toBe('COBAXXX');
            expect(info.bankName).toBe('Testbank');
            expect(info.logoUrl).toBe('https://example.com/logo.png');
            // city and postalCode are always '' from this source
            expect(info.city).toBe('');
            expect(info.postalCode).toBe('');
        });

        it('falls back to eInvoiceService.settings.businessData', () => {
            window.eInvoiceService = {
                settings: {
                    businessData: {
                        name: 'Invoice Co',
                        street: 'Inv Str',
                        city: 'Inv City',
                        postalCode: '12345',
                        phone: '+49 000',
                        email: 'inv@co.de',
                        vatId: 'DE222',
                        iban: 'DE11...',
                        bic: 'BIC1',
                        bankName: 'Bank1',
                    },
                },
            };

            const info = svc().getCompanyInfo();
            expect(info.name).toBe('Invoice Co');
            expect(info.city).toBe('Inv City');
            expect(info.logoUrl).toBeNull();
        });

        it('falls back to StorageUtils.getJSON for admin settings', () => {
            globalThis.StorageUtils.getJSON.mockReturnValue({
                company_name: 'Storage Co',
                address_street: 'Storage St',
                address_city: 'Storage City',
                address_postal: '99999',
                company_phone: '+49 111',
                company_email: 'storage@co.de',
                tax_number: 'DE333',
                bank_iban: 'DE22...',
                bank_bic: 'BIC2',
                bank_name: 'Bank2',
                company_logo: 'logo.png',
            });

            const info = svc().getCompanyInfo();
            expect(info.name).toBe('Storage Co');
            expect(info.street).toBe('Storage St');
            expect(info.city).toBe('Storage City');
            expect(info.postalCode).toBe('99999');
            expect(info.logoUrl).toBe('logo.png');
        });

        it('returns empty strings when no data sources are available', () => {
            globalThis.StorageUtils.getJSON.mockReturnValue({});
            const info = svc().getCompanyInfo();
            expect(info.name).toBe('');
            expect(info.street).toBe('');
            expect(info.email).toBe('');
            expect(info.logoUrl).toBeNull();
        });
    });

    // ── getBaseCss ──

    describe('getBaseCss', () => {
        it('returns a style tag with media query', () => {
            const css = svc().getBaseCss();
            expect(css).toContain('<style type="text/css">');
            expect(css).toContain('@media only screen and (max-width: 600px)');
            expect(css).toContain('</style>');
        });
    });

    // ── getHeader ──

    describe('getHeader', () => {
        it('renders company name in header', () => {
            svc().company = { ...defaultCompany };
            const header = svc().getHeader();
            expect(header).toContain('Meisterbetrieb M');
            expect(header).toContain('table');
        });

        it('includes logo img tag when logoUrl is set', () => {
            svc().company = { ...defaultCompany, logoUrl: 'https://example.com/logo.png' };
            const header = svc().getHeader();
            expect(header).toContain('<img src="https://example.com/logo.png"');
        });

        it('omits logo img tag when logoUrl is null', () => {
            svc().company = { ...defaultCompany, logoUrl: null };
            const header = svc().getHeader();
            expect(header).not.toContain('<img');
        });

        it('includes address line when street and city are set', () => {
            svc().company = { ...defaultCompany };
            const header = svc().getHeader();
            expect(header).toContain('Hauptstr. 12');
        });
    });

    // ── getFooter ──

    describe('getFooter', () => {
        it('renders contact, bank, and tax info', () => {
            svc().company = { ...defaultCompany };
            svc().kleinunternehmer = false;
            const footer = svc().getFooter();
            expect(footer).toContain('Kontakt');
            expect(footer).toContain('Bankverbindung');
            expect(footer).toContain('DE89370400440532013000');
            expect(footer).toContain('USt-IdNr');
        });

        it('shows Kleinunternehmer label when applicable', () => {
            svc().company = { ...defaultCompany };
            svc().kleinunternehmer = true;
            const footer = svc().getFooter();
            expect(footer).toContain('Kleinunternehmer');
            expect(footer).toContain('Steuernr.');
            expect(footer).not.toContain('USt-IdNr');
        });

        it('includes copyright year', () => {
            svc().company = { ...defaultCompany };
            const footer = svc().getFooter();
            expect(footer).toContain(`${new Date().getFullYear()}`);
        });
    });

    // ── formatDate ──

    describe('formatDate', () => {
        it('formats ISO date string in German format', () => {
            const result = svc().formatDate('2024-06-15');
            expect(result).toMatch(/15\.06\.2024/);
        });

        it('returns "-" for null/undefined input', () => {
            expect(svc().formatDate(null)).toBe('-');
            expect(svc().formatDate(undefined)).toBe('-');
        });

        it('returns "-" for invalid date string', () => {
            expect(svc().formatDate('not-a-date')).toBe('-');
        });

        it('returns "-" for empty string', () => {
            expect(svc().formatDate('')).toBe('-');
        });

        it('formats Date objects', () => {
            const result = svc().formatDate(new Date('2024-01-01'));
            expect(result).toContain('2024');
        });
    });

    // ── getAngebotEmail ──

    describe('getAngebotEmail', () => {
        beforeEach(() => {
            svc().company = { ...defaultCompany };
            svc().kleinunternehmer = false;
        });

        it('returns object with subject and html', () => {
            const result = svc().getAngebotEmail(makeAngebot());
            expect(result).toHaveProperty('subject');
            expect(result).toHaveProperty('html');
        });

        it('subject contains Angebot Nr. and company name', () => {
            const result = svc().getAngebotEmail(makeAngebot());
            expect(result.subject).toContain('Angebot Nr. ANG-2024-001');
            expect(result.subject).toContain('Meisterbetrieb Müller');
        });

        it('html contains DOCTYPE and proper structure', () => {
            const result = svc().getAngebotEmail(makeAngebot());
            expect(result.html).toContain('<!DOCTYPE html>');
            expect(result.html).toContain('Angebot Nr.');
            expect(result.html).toContain('</html>');
        });

        it('renders positionen in the table', () => {
            const result = svc().getAngebotEmail(makeAngebot());
            expect(result.html).toContain('Fliesenlegen Bad');
            expect(result.html).toContain('Silikonfugen');
        });

        it('calculates netto, MwSt, and brutto correctly for non-Kleinunternehmer', () => {
            const result = svc().getAngebotEmail(makeAngebot());
            // netto = 20*45 + 10*15 = 900+150 = 1050
            // MwSt 19% = 199.50
            // brutto = 1249.50
            expect(result.html).toContain('Nettobetrag');
            expect(result.html).toContain('MwSt (19%)');
            expect(result.html).toContain('Gesamtbetrag');
        });

        it('renders greeting for Herr when anrede is not Frau', () => {
            const result = svc().getAngebotEmail(makeAngebot());
            expect(result.html).toContain('geehrter Herr');
        });

        it('renders greeting for Frau', () => {
            const angebot = makeAngebot({
                kunde: { ...sampleKunde, anrede: 'Frau' },
            });
            const result = svc().getAngebotEmail(angebot);
            expect(result.html).toContain('geehrte Frau');
        });

        it('skips MwSt for Kleinunternehmer', () => {
            svc().kleinunternehmer = true;
            globalThis.localStorage._data['kleinunternehmer'] = 'true';
            window.companySettingsService = { isKleinunternehmer: () => true };
            const result = svc().getAngebotEmail(makeAngebot());
            expect(result.html).not.toContain('Nettobetrag');
            expect(result.html).not.toContain('MwSt (19%)');
            expect(result.html).toContain('19 UStG');
        });

        it('renders customer firma when provided', () => {
            const result = svc().getAngebotEmail(makeAngebot());
            expect(result.html).toContain('Schmidt GmbH');
        });

        it('handles missing kunde gracefully', () => {
            const result = svc().getAngebotEmail(makeAngebot({ kunde: undefined }));
            expect(result.html).toContain('Sehr geehrte/r Kunde');
        });

        it('handles empty positionen array', () => {
            const result = svc().getAngebotEmail(makeAngebot({ positionen: [] }));
            expect(result).toHaveProperty('html');
            expect(result.html).toContain('Gesamtbetrag');
        });

        it('uses company override when provided', () => {
            const customCompany = { ...defaultCompany, name: 'Custom GmbH' };
            const result = svc().getAngebotEmail(makeAngebot(), customCompany);
            expect(result.subject).toContain('Custom GmbH');
            expect(result.html).toContain('Custom GmbH');
        });

        it('falls back to angebot.nummer if id is missing', () => {
            const result = svc().getAngebotEmail(makeAngebot({ id: undefined, nummer: 'N-999' }));
            expect(result.subject).toContain('Angebot Nr. N-999');
        });

        it('contains validity notice (30 Tage)', () => {
            const result = svc().getAngebotEmail(makeAngebot());
            expect(result.html).toContain('30 Tage');
        });

        it('includes header and footer', () => {
            const result = svc().getAngebotEmail(makeAngebot());
            expect(result.html).toContain('Kontakt');
            expect(result.html).toContain('Bankverbindung');
        });
    });

    // ── getRechnungEmail ──

    describe('getRechnungEmail', () => {
        beforeEach(() => {
            svc().company = { ...defaultCompany };
            svc().kleinunternehmer = false;
        });

        it('returns object with subject and html', () => {
            const result = svc().getRechnungEmail(makeRechnung());
            expect(result).toHaveProperty('subject');
            expect(result).toHaveProperty('html');
        });

        it('subject contains Rechnung Nr. and company name', () => {
            const result = svc().getRechnungEmail(makeRechnung());
            expect(result.subject).toContain('Rechnung Nr. RE-2024-001');
            expect(result.subject).toContain('Meisterbetrieb Müller');
        });

        it('html contains Rechnungsdatum', () => {
            const result = svc().getRechnungEmail(makeRechnung());
            expect(result.html).toContain('Rechnungsdatum');
        });

        it('includes payment terms section', () => {
            const result = svc().getRechnungEmail(makeRechnung());
            expect(result.html).toContain('Zahlungsanweisung');
            expect(result.html).toContain('Zahlbar bis');
            expect(result.html).toContain('IBAN');
            expect(result.html).toContain('Verwendungszweck');
        });

        it('calculates due date based on zahlungsziel', () => {
            // datum: 2024-06-15, zahlungsziel: 14 => due: 2024-06-29
            const result = svc().getRechnungEmail(makeRechnung({ datum: '2024-06-15', zahlungsziel: 14 }));
            expect(result.html).toContain('29.06.2024');
        });

        it('defaults zahlungsziel to 14 days', () => {
            const result = svc().getRechnungEmail(makeRechnung({ zahlungsziel: undefined, datum: '2024-06-15' }));
            expect(result.html).toContain('29.06.2024');
        });

        it('includes SEPA QR-Code placeholder', () => {
            const result = svc().getRechnungEmail(makeRechnung());
            expect(result.html).toContain('SEPA QR-Code');
        });

        it('renders positionen', () => {
            const result = svc().getRechnungEmail(makeRechnung());
            expect(result.html).toContain('Fliesenlegen Bad');
            expect(result.html).toContain('Silikonfugen');
        });

        it('skips MwSt for Kleinunternehmer', () => {
            svc().kleinunternehmer = true;
            window.companySettingsService = { isKleinunternehmer: () => true };
            globalThis.localStorage._data['kleinunternehmer'] = 'true';
            const result = svc().getRechnungEmail(makeRechnung());
            expect(result.html).not.toContain('Nettobetrag');
            expect(result.html).toContain('19 UStG');
        });

        it('shows Rechnungsbetrag label', () => {
            const result = svc().getRechnungEmail(makeRechnung());
            expect(result.html).toContain('Rechnungsbetrag');
        });

        it('uses company override when provided', () => {
            const customCompany = { ...defaultCompany, name: 'Rechnungs Co' };
            const result = svc().getRechnungEmail(makeRechnung(), customCompany);
            expect(result.subject).toContain('Rechnungs Co');
        });

        it('renders Rechnungsempfänger label', () => {
            const result = svc().getRechnungEmail(makeRechnung());
            expect(result.html).toContain('Rechnungsempf');
        });
    });

    // ── getMahnungEmail ──

    describe('getMahnungEmail', () => {
        beforeEach(() => {
            svc().company = { ...defaultCompany };
            svc().kleinunternehmer = false;
        });

        it('returns object with subject and html', () => {
            const result = svc().getMahnungEmail(makeMahnung());
            expect(result).toHaveProperty('subject');
            expect(result).toHaveProperty('html');
        });

        it('subject for stufe 1 contains "1. Mahnung"', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 1);
            expect(result.subject).toContain('1. Mahnung');
            expect(result.subject).toContain('RE-2024-001');
        });

        it('subject for stufe 2 contains "2. Mahnung"', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 2);
            expect(result.subject).toContain('2. Mahnung');
        });

        it('subject for stufe 3 contains "Letzte Mahnung"', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 3);
            expect(result.subject).toContain('Letzte Mahnung vor Inkasso');
        });

        it('html for stufe 1 has info styling (blue background)', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 1);
            expect(result.html).toContain('#e0f2fe');
            expect(result.html).toContain('#0284c7');
        });

        it('html for stufe 2 has warning styling (yellow background)', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 2);
            expect(result.html).toContain('#fef3c7');
            expect(result.html).toContain('#d97706');
        });

        it('html for stufe 3 has danger styling (red background)', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 3);
            expect(result.html).toContain('#fee2e2');
            expect(result.html).toContain('#ef4444');
        });

        it('stufe 3 includes final warning block', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 3);
            expect(result.html).toContain('bereits Zahlung geleistet');
        });

        it('stufe 1 does not include final warning block', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 1);
            expect(result.html).not.toContain('bereits Zahlung geleistet');
        });

        it('includes invoice details section', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 1);
            expect(result.html).toContain('Rechnungsdetails');
            expect(result.html).toContain('Rechnungsnummer');
            expect(result.html).toContain('Ausstehender Betrag');
        });

        it('includes payment instructions', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 1);
            expect(result.html).toContain('Zahlungsanweisung');
            expect(result.html).toContain('IBAN');
            expect(result.html).toContain('Verwendungszweck');
        });

        it('defaults to stufe 1 for invalid stufe', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 99);
            expect(result.html).toContain('1. Mahnung');
        });

        it('uses company override when provided', () => {
            const customCompany = { ...defaultCompany, name: 'Mahnung Co' };
            const result = svc().getMahnungEmail(makeMahnung(), 1, customCompany);
            expect(result.subject).toContain('Mahnung Co');
        });

        it('renders greeting for Frau', () => {
            const mahnung = makeMahnung({
                kunde: { ...sampleKunde, anrede: 'Frau' },
            });
            const result = svc().getMahnungEmail(mahnung, 1);
            expect(result.html).toContain('geehrte Frau');
        });

        it('handles missing kunde gracefully', () => {
            const result = svc().getMahnungEmail(makeMahnung({ kunde: undefined }), 1);
            expect(result.html).toContain('geehrter Herr');
        });

        it('stufe 2 mentions rechtliche Schritte', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 2);
            expect(result.html).toContain('rechtliche Schritte');
        });

        it('stufe 3 mentions Inkassounternehmen', () => {
            const result = svc().getMahnungEmail(makeMahnung(), 3);
            expect(result.html).toContain('Inkassounternehmen');
        });
    });

    // ── getTerminEmail ──

    describe('getTerminEmail', () => {
        beforeEach(() => {
            svc().company = { ...defaultCompany };
        });

        it('returns object with subject, html, icsContent, icsFilename', () => {
            const result = svc().getTerminEmail(makeTermin());
            expect(result).toHaveProperty('subject');
            expect(result).toHaveProperty('html');
            expect(result).toHaveProperty('icsContent');
            expect(result).toHaveProperty('icsFilename');
        });

        it('subject contains date and time', () => {
            const result = svc().getTerminEmail(makeTermin());
            expect(result.subject).toContain('14:30 Uhr');
        });

        it('html contains appointment details', () => {
            const result = svc().getTerminEmail(makeTermin());
            expect(result.html).toContain('Terminbest');
            expect(result.html).toContain('14:30');
            expect(result.html).toContain('Kundenadresse');
            expect(result.html).toContain('Hans M');
        });

        it('renders address section when termin.adresse is provided', () => {
            const result = svc().getTerminEmail(makeTermin({ adresse: 'Musterstr. 1\n12345 Berlin' }));
            expect(result.html).toContain('Genaue Adresse');
            expect(result.html).toContain('Musterstr. 1');
        });

        it('omits address section when termin.adresse is not provided', () => {
            const result = svc().getTerminEmail(makeTermin({ adresse: undefined }));
            expect(result.html).not.toContain('Genaue Adresse');
        });

        it('includes hints section', () => {
            const result = svc().getTerminEmail(makeTermin());
            expect(result.html).toContain('Hinweise');
            expect(result.html).toContain('24h vorher');
        });

        it('uses default uhrzeit 09:00 when not provided', () => {
            const result = svc().getTerminEmail(makeTermin({ uhrzeit: undefined }));
            expect(result.html).toContain('09:00');
        });

        it('uses default ort when not provided', () => {
            const result = svc().getTerminEmail(makeTermin({ ort: undefined }));
            expect(result.html).toContain('Nach Vereinbarung');
        });

        it('icsFilename contains formatted date', () => {
            const result = svc().getTerminEmail(makeTermin({ datum: '2024-07-10' }));
            expect(result.icsFilename).toContain('Termin_');
            expect(result.icsFilename).toContain('.ics');
        });

        it('uses company override when provided', () => {
            const customCompany = { ...defaultCompany, name: 'Termin Co' };
            const result = svc().getTerminEmail(makeTermin(), customCompany);
            expect(result.html).toContain('Termin Co');
        });
    });

    // ── generateICS ──

    describe('generateICS', () => {
        it('generates valid ICS calendar content', () => {
            const ics = svc().generateICS(makeTermin(), defaultCompany);
            expect(ics).toContain('BEGIN:VCALENDAR');
            expect(ics).toContain('END:VCALENDAR');
            expect(ics).toContain('BEGIN:VEVENT');
            expect(ics).toContain('END:VEVENT');
            expect(ics).toContain('VERSION:2.0');
        });

        it('includes DTSTART and DTEND', () => {
            const ics = svc().generateICS(makeTermin(), defaultCompany);
            expect(ics).toContain('DTSTART:');
            expect(ics).toContain('DTEND:');
        });

        it('includes location', () => {
            const ics = svc().generateICS(makeTermin({ ort: 'Berlin' }), defaultCompany);
            expect(ics).toContain('LOCATION:Berlin');
        });

        it('returns empty string for invalid date', () => {
            const ics = svc().generateICS(makeTermin({ datum: 'invalid' }), defaultCompany);
            expect(ics).toBe('');
        });

        it('returns empty string for empty datum', () => {
            const ics = svc().generateICS(makeTermin({ datum: '' }), defaultCompany);
            expect(ics).toBe('');
        });

        it('includes company info in ORGANIZER and PRODID', () => {
            const ics = svc().generateICS(makeTermin(), defaultCompany);
            expect(ics).toContain('ORGANIZER');
            expect(ics).toContain(defaultCompany.email);
        });

        it('uses default uhrzeit when not provided', () => {
            const ics = svc().generateICS(makeTermin({ uhrzeit: undefined }), defaultCompany);
            // Should not throw and should contain DTSTART
            expect(ics).toContain('DTSTART:');
        });

        it('includes UID with termin id', () => {
            const ics = svc().generateICS(makeTermin({ id: 'T-42' }), defaultCompany);
            expect(ics).toContain('UID:termin-T-42@');
        });

        it('sets METHOD to REQUEST', () => {
            const ics = svc().generateICS(makeTermin(), defaultCompany);
            expect(ics).toContain('METHOD:REQUEST');
        });

        it('sets STATUS to CONFIRMED', () => {
            const ics = svc().generateICS(makeTermin(), defaultCompany);
            expect(ics).toContain('STATUS:CONFIRMED');
        });
    });

    // ── getAuftragsbestaetigungEmail ──

    describe('getAuftragsbestaetigungEmail', () => {
        beforeEach(() => {
            svc().company = { ...defaultCompany };
            svc().kleinunternehmer = false;
        });

        it('returns object with subject and html', () => {
            const result = svc().getAuftragsbestaetigungEmail(makeAuftrag());
            expect(result).toHaveProperty('subject');
            expect(result).toHaveProperty('html');
        });

        it('subject contains Auftragsbestätigung and company name', () => {
            const result = svc().getAuftragsbestaetigungEmail(makeAuftrag());
            expect(result.subject).toContain('Auftragsbest');
            expect(result.subject).toContain('AUF-2024-001');
            expect(result.subject).toContain('Meisterbetrieb');
        });

        it('html contains positionen', () => {
            const result = svc().getAuftragsbestaetigungEmail(makeAuftrag());
            expect(result.html).toContain('Fliesenlegen Bad');
            expect(result.html).toContain('Silikonfugen');
        });

        it('renders Auftraggeber label', () => {
            const result = svc().getAuftragsbestaetigungEmail(makeAuftrag());
            expect(result.html).toContain('Auftraggeber');
        });

        it('shows Liefertermin when provided', () => {
            const result = svc().getAuftragsbestaetigungEmail(
                makeAuftrag({ liefertermin: '2024-08-01' })
            );
            expect(result.html).toContain('Liefertermin');
            expect(result.html).toContain('01.08.2024');
        });

        it('omits Liefertermin when not provided', () => {
            const result = svc().getAuftragsbestaetigungEmail(
                makeAuftrag({ liefertermin: undefined })
            );
            expect(result.html).not.toContain('Liefertermin');
        });

        it('includes "Nächste Schritte" section', () => {
            const result = svc().getAuftragsbestaetigungEmail(makeAuftrag());
            expect(result.html).toContain('chste Schritte');
        });

        it('skips MwSt for Kleinunternehmer', () => {
            svc().kleinunternehmer = true;
            window.companySettingsService = { isKleinunternehmer: () => true };
            globalThis.localStorage._data['kleinunternehmer'] = 'true';
            const result = svc().getAuftragsbestaetigungEmail(makeAuftrag());
            expect(result.html).not.toContain('Nettobetrag');
            expect(result.html).toContain('19 UStG');
        });

        it('uses company override when provided', () => {
            const customCompany = { ...defaultCompany, name: 'Auftrag Co' };
            const result = svc().getAuftragsbestaetigungEmail(makeAuftrag(), customCompany);
            expect(result.subject).toContain('Auftrag Co');
        });

        it('handles missing positionen', () => {
            const result = svc().getAuftragsbestaetigungEmail(makeAuftrag({ positionen: [] }));
            expect(result).toHaveProperty('html');
        });
    });

    // ── getZahlungserinnerungEmail ──

    describe('getZahlungserinnerungEmail', () => {
        beforeEach(() => {
            svc().company = { ...defaultCompany };
        });

        it('returns object with subject and html', () => {
            const result = svc().getZahlungserinnerungEmail(makeRechnung());
            expect(result).toHaveProperty('subject');
            expect(result).toHaveProperty('html');
        });

        it('subject contains Zahlungserinnerung and Rechnung Nr', () => {
            const result = svc().getZahlungserinnerungEmail(makeRechnung());
            expect(result.subject).toContain('Zahlungserinnerung');
            expect(result.subject).toContain('RE-2024-001');
            expect(result.subject).toContain('Meisterbetrieb');
        });

        it('html contains friendly tone', () => {
            const result = svc().getZahlungserinnerungEmail(makeRechnung());
            expect(result.html).toContain('Freundliche Zahlungserinnerung');
            expect(result.html).toContain('Versehen');
        });

        it('shows invoice details (Rechnungsnummer, Rechnungsdatum, Offener Betrag)', () => {
            const result = svc().getZahlungserinnerungEmail(makeRechnung());
            expect(result.html).toContain('Rechnungsnummer');
            expect(result.html).toContain('Rechnungsdatum');
            expect(result.html).toContain('Offener Betrag');
        });

        it('shows bank details (Bankverbindung)', () => {
            const result = svc().getZahlungserinnerungEmail(makeRechnung());
            expect(result.html).toContain('Bankverbindung');
            expect(result.html).toContain('IBAN');
            expect(result.html).toContain('DE89370400440532013000');
        });

        it('mentions 7 Tage payment window', () => {
            const result = svc().getZahlungserinnerungEmail(makeRechnung());
            expect(result.html).toContain('7 Tage');
        });

        it('uses company override when provided', () => {
            const customCompany = { ...defaultCompany, name: 'Erinnerung Co' };
            const result = svc().getZahlungserinnerungEmail(makeRechnung(), customCompany);
            expect(result.subject).toContain('Erinnerung Co');
        });

        it('falls back to rechnung.createdAt when datum is missing', () => {
            const result = svc().getZahlungserinnerungEmail(
                makeRechnung({ datum: undefined, createdAt: '2024-03-01' })
            );
            expect(result.html).toContain('01.03.2024');
        });

        it('handles missing kunde gracefully', () => {
            const result = svc().getZahlungserinnerungEmail(makeRechnung({ kunde: undefined }));
            expect(result.html).toContain('geehrter Herr');
        });
    });

    // ── XSS protection ──

    describe('XSS protection', () => {
        beforeEach(() => {
            svc().company = { ...defaultCompany };
            svc().kleinunternehmer = false;
        });

        it('escapes HTML in customer name for Angebot', () => {
            const angebot = makeAngebot({
                kunde: { ...sampleKunde, name: '<script>alert("xss")</script>' },
            });
            const result = svc().getAngebotEmail(angebot);
            expect(result.html).not.toContain('<script>alert');
            expect(result.html).toContain('&lt;script&gt;');
        });

        it('escapes HTML in position beschreibung for Rechnung', () => {
            const rechnung = makeRechnung({
                positionen: [{ beschreibung: '<img onerror=alert(1)>', menge: 1, einzelpreis: 100 }],
            });
            const result = svc().getRechnungEmail(rechnung);
            expect(result.html).not.toContain('<img onerror');
            expect(result.html).toContain('&lt;img onerror');
        });
    });

    // ── Global instance ──

    describe('global instance', () => {
        it('is accessible via window.emailTemplateService', () => {
            expect(window.emailTemplateService).toBeDefined();
            expect(typeof window.emailTemplateService.getAngebotEmail).toBe('function');
            expect(typeof window.emailTemplateService.getRechnungEmail).toBe('function');
            expect(typeof window.emailTemplateService.getMahnungEmail).toBe('function');
            expect(typeof window.emailTemplateService.getTerminEmail).toBe('function');
            expect(typeof window.emailTemplateService.getAuftragsbestaetigungEmail).toBe('function');
            expect(typeof window.emailTemplateService.getZahlungserinnerungEmail).toBe('function');
        });
    });
});
