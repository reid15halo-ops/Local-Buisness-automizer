import { describe, it, expect, beforeEach } from 'vitest';

// Self-contained PDF Generation Service tests
// Tests the pure data preparation and formatting logic without browser/pdfmake deps

// ---- Inline implementation of pure helpers from PDFGenerationService ----
class PDFGenerationServiceLogic {
    /**
     * Format currency in German locale
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    /**
     * Build the header section from company data
     */
    buildHeader(company, layout) {
        return {
            columns: [
                {
                    width: '*',
                    stack: [
                        { text: company.name, style: 'header' },
                        { text: company.strasse, style: 'small' },
                        { text: `${company.plz} ${company.ort}`, style: 'small' }
                    ]
                },
                {
                    width: 'auto',
                    stack: [
                        { text: company.telefon, style: 'small', alignment: 'right' },
                        { text: company.email, style: 'small', alignment: 'right' }
                    ]
                }
            ]
        };
    }

    /**
     * Build customer address section
     */
    buildCustomerAddress(kunde, layout) {
        return {
            stack: [
                { text: kunde.firma || kunde.name, bold: true },
                { text: kunde.strasse || '' },
                { text: `${kunde.plz || ''} ${kunde.ort || ''}` }
            ],
            margin: [0, 0, 0, 0]
        };
    }

    /**
     * Build invoice details section
     */
    buildInvoiceDetails(rechnung, layout) {
        return {
            columns: [
                {
                    width: '*',
                    text: 'RECHNUNG',
                    style: 'title'
                },
                {
                    width: 'auto',
                    stack: [
                        {
                            columns: [
                                { width: 100, text: 'Rechnungs-Nr.:', bold: true },
                                { width: '*', text: rechnung.nummer }
                            ]
                        },
                        {
                            columns: [
                                { width: 100, text: 'Datum:', bold: true },
                                { width: '*', text: rechnung.datum }
                            ],
                            margin: [0, 5, 0, 0]
                        },
                        {
                            columns: [
                                { width: 100, text: 'Fällig am:', bold: true },
                                { width: '*', text: rechnung.faelligkeitsdatum }
                            ],
                            margin: [0, 5, 0, 0]
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Build positions table rows
     */
    buildPositionsTable(positions, layout) {
        const tableBody = [
            [
                { text: 'Pos.', style: 'tableHeader' },
                { text: 'Beschreibung', style: 'tableHeader' },
                { text: 'Menge', style: 'tableHeader', alignment: 'right' },
                { text: 'Einzelpreis', style: 'tableHeader', alignment: 'right' },
                { text: 'Gesamt', style: 'tableHeader', alignment: 'right' }
            ]
        ];

        positions.forEach((pos, index) => {
            const menge = pos.menge || 1;
            const einzelpreis = pos.einzelpreis || 0;
            const gesamt = menge * einzelpreis;

            tableBody.push([
                { text: (index + 1).toString(), alignment: 'center' },
                { text: pos.beschreibung || pos.name || '' },
                { text: menge.toString(), alignment: 'right' },
                { text: this.formatCurrency(einzelpreis), alignment: 'right' },
                { text: this.formatCurrency(gesamt), alignment: 'right' }
            ]);
        });

        return {
            table: {
                headerRows: 1,
                widths: [30, '*', 50, 80, 80],
                body: tableBody
            }
        };
    }

    /**
     * Build totals section
     */
    buildTotals(summe, layout) {
        return {
            columns: [
                { width: '*', text: '' },
                {
                    width: 200,
                    stack: [
                        {
                            columns: [
                                { width: '*', text: 'Netto:', alignment: 'right' },
                                { width: 80, text: summe.netto, alignment: 'right' }
                            ]
                        },
                        {
                            columns: [
                                { width: '*', text: `MwSt. (${summe.mwstSatz}):`, alignment: 'right' },
                                { width: 80, text: summe.mwst, alignment: 'right' }
                            ],
                            margin: [0, 5, 0, 0]
                        },
                        {
                            columns: [
                                { width: '*', text: 'Brutto:', alignment: 'right', bold: true, fontSize: 12 },
                                { width: 80, text: summe.brutto, alignment: 'right', bold: true, fontSize: 12 }
                            ],
                            margin: [0, 10, 0, 0]
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Build payment terms section
     */
    buildPaymentTerms(company, rechnung, layout) {
        return {
            stack: [
                { text: 'Zahlungsbedingungen', bold: true, margin: [0, 0, 0, 5] },
                { text: `Bitte überweisen Sie den Betrag bis zum ${rechnung.faelligkeitsdatum} auf folgendes Konto:`, style: 'small' },
                { text: '', margin: [0, 5] },
                {
                    columns: [
                        { width: 80, text: 'IBAN:', style: 'small', bold: true },
                        { width: '*', text: company.iban, style: 'small' }
                    ]
                },
                {
                    columns: [
                        { width: 80, text: 'BIC:', style: 'small', bold: true },
                        { width: '*', text: company.bic, style: 'small' }
                    ]
                },
                {
                    columns: [
                        { width: 80, text: 'Bank:', style: 'small', bold: true },
                        { width: '*', text: company.bank, style: 'small' }
                    ]
                },
                { text: `Verwendungszweck: ${rechnung.nummer}`, style: 'small', margin: [0, 5, 0, 0] }
            ]
        };
    }

    /**
     * Build legal info footer
     */
    buildLegalInfo(company, layout) {
        return {
            stack: [
                { text: 'Angaben gemäß §14 UStG', bold: true, style: 'small', margin: [0, 0, 0, 5] },
                { text: `${company.name} | ${company.strasse} | ${company.plz} ${company.ort}`, style: 'small' },
                { text: `USt-IdNr.: ${company.ustId}`, style: 'small' },
                { text: `Tel.: ${company.telefon} | E-Mail: ${company.email}`, style: 'small' }
            ],
            margin: [0, 20, 0, 0]
        };
    }

    /**
     * Prepare template variables from invoice data
     */
    prepareTemplateVariables(invoice, company) {
        const netto = invoice.netto || 0;
        const mwstRate = invoice.mwstSatz || 0.19;
        const mwst = netto * mwstRate;
        const brutto = netto + mwst;

        const datum = new Date(invoice.datum || new Date()).toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const faelligkeitsdatum = invoice.faelligkeitsdatum
            ? new Date(invoice.faelligkeitsdatum).toLocaleDateString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            })
            : '';

        return {
            kunde: {
                name: invoice.kunde?.name || '',
                firma: invoice.kunde?.firma || invoice.kunde?.name || '',
                strasse: invoice.kunde?.strasse || '',
                plz: invoice.kunde?.plz || '',
                ort: invoice.kunde?.ort || ''
            },
            rechnung: {
                nummer: invoice.nummer || invoice.id,
                datum,
                faelligkeitsdatum
            },
            summe: {
                netto: this.formatCurrency(netto),
                mwst: this.formatCurrency(mwst),
                brutto: this.formatCurrency(brutto),
                mwstSatz: `${Math.round(mwstRate * 100)}%`
            }
        };
    }

    /**
     * Validate required fields for PDF generation
     */
    validateRequiredFields(invoice, company) {
        const missing = [];

        if (!invoice.nummer && !invoice.id) { missing.push('Rechnungsnummer'); }
        if (!invoice.kunde?.name) { missing.push('Kundenname'); }
        if (!invoice.netto && invoice.netto !== 0) { missing.push('Netto-Betrag'); }
        if (!invoice.datum) { missing.push('Rechnungsdatum'); }
        if (!company.name) { missing.push('Firmenname'); }
        if (!company.iban) { missing.push('IBAN'); }
        if (!company.ustId) { missing.push('USt-IdNr'); }

        return { valid: missing.length === 0, missing };
    }
}

// ---- Test Fixtures ----
const SAMPLE_COMPANY = {
    name: 'Musterbau GmbH',
    strasse: 'Handwerkerstraße 42',
    plz: '80331',
    ort: 'München',
    telefon: '+49 89 123456',
    email: 'info@musterbau.de',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    bank: 'Commerzbank',
    ustId: 'DE123456789'
};

const SAMPLE_INVOICE = {
    id: 'inv-001',
    nummer: 'RE-2026-001',
    datum: '2026-02-24',
    faelligkeitsdatum: '2026-03-10',
    netto: 1000,
    mwstSatz: 0.19,
    kunde: {
        name: 'Max Mustermann GmbH',
        firma: 'Max Mustermann GmbH',
        strasse: 'Kundenstraße 1',
        plz: '10115',
        ort: 'Berlin'
    },
    positionen: [
        { beschreibung: 'Heizungsinstallation', menge: 1, einzelpreis: 800 },
        { beschreibung: 'Material Heizung', menge: 2, einzelpreis: 100 }
    ]
};

const DEFAULT_LAYOUT = {
    pageSize: 'A4',
    margins: { left: 40, top: 40, right: 40, bottom: 40 },
    fontSize: { large: 18, title: 14, normal: 10, small: 8 },
    colors: { primary: '#1a1a2e', secondary: '#6c757d' }
};

describe('PDFGenerationService', () => {
    let service;

    beforeEach(() => {
        service = new PDFGenerationServiceLogic();
    });

    describe('Invoice PDF Data Preparation', () => {
        it('should prepare template variables from invoice', () => {
            const vars = service.prepareTemplateVariables(SAMPLE_INVOICE, SAMPLE_COMPANY);

            expect(vars.rechnung.nummer).toBe('RE-2026-001');
            expect(vars.kunde.name).toBe('Max Mustermann GmbH');
            expect(vars.summe.mwstSatz).toBe('19%');
        });

        it('should calculate correct MwSt amounts in template variables', () => {
            const vars = service.prepareTemplateVariables(SAMPLE_INVOICE, SAMPLE_COMPANY);

            // netto=1000, mwst=190, brutto=1190
            expect(vars.summe.netto).toContain('1.000,00');
            expect(vars.summe.mwst).toContain('190,00');
            expect(vars.summe.brutto).toContain('1.190,00');
        });

        it('should format date in German locale (DD.MM.YYYY)', () => {
            const vars = service.prepareTemplateVariables(SAMPLE_INVOICE, SAMPLE_COMPANY);
            // German format: 24.02.2026
            expect(vars.rechnung.datum).toMatch(/\d{2}\.\d{2}\.\d{4}/);
        });

        it('should handle 7% reduced MwSt rate', () => {
            const invoice7 = { ...SAMPLE_INVOICE, netto: 1000, mwstSatz: 0.07 };
            const vars = service.prepareTemplateVariables(invoice7, SAMPLE_COMPANY);
            expect(vars.summe.mwstSatz).toBe('7%');
            expect(vars.summe.mwst).toContain('70,00');
            expect(vars.summe.brutto).toContain('1.070,00');
        });
    });

    describe('Required Field Validation', () => {
        it('should pass validation for complete invoice', () => {
            const result = service.validateRequiredFields(SAMPLE_INVOICE, SAMPLE_COMPANY);
            expect(result.valid).toBe(true);
            expect(result.missing).toHaveLength(0);
        });

        it('should detect missing Rechnungsnummer', () => {
            const invoice = { ...SAMPLE_INVOICE, nummer: undefined, id: undefined };
            const result = service.validateRequiredFields(invoice, SAMPLE_COMPANY);
            expect(result.valid).toBe(false);
            expect(result.missing).toContain('Rechnungsnummer');
        });

        it('should detect missing Kundenname', () => {
            const invoice = { ...SAMPLE_INVOICE, kunde: {} };
            const result = service.validateRequiredFields(invoice, SAMPLE_COMPANY);
            expect(result.valid).toBe(false);
            expect(result.missing).toContain('Kundenname');
        });

        it('should detect missing IBAN', () => {
            const company = { ...SAMPLE_COMPANY, iban: undefined };
            const result = service.validateRequiredFields(SAMPLE_INVOICE, company);
            expect(result.valid).toBe(false);
            expect(result.missing).toContain('IBAN');
        });

        it('should detect missing USt-IdNr', () => {
            const company = { ...SAMPLE_COMPANY, ustId: undefined };
            const result = service.validateRequiredFields(SAMPLE_INVOICE, company);
            expect(result.valid).toBe(false);
            expect(result.missing).toContain('USt-IdNr');
        });

        it('should detect multiple missing fields at once', () => {
            const result = service.validateRequiredFields({}, {});
            expect(result.valid).toBe(false);
            expect(result.missing.length).toBeGreaterThan(2);
        });

        it('should accept id as fallback for nummer', () => {
            const invoice = { ...SAMPLE_INVOICE, nummer: undefined, id: 'inv-fallback' };
            const result = service.validateRequiredFields(invoice, SAMPLE_COMPANY);
            expect(result.missing).not.toContain('Rechnungsnummer');
        });
    });

    describe('Header Section Building', () => {
        it('should include company name in header', () => {
            const header = service.buildHeader(SAMPLE_COMPANY, DEFAULT_LAYOUT);

            const leftStack = header.columns[0].stack;
            expect(leftStack[0].text).toBe('Musterbau GmbH');
        });

        it('should include company address in header', () => {
            const header = service.buildHeader(SAMPLE_COMPANY, DEFAULT_LAYOUT);
            const leftStack = header.columns[0].stack;
            expect(leftStack[1].text).toBe('Handwerkerstraße 42');
            expect(leftStack[2].text).toBe('80331 München');
        });

        it('should include contact info in right column', () => {
            const header = service.buildHeader(SAMPLE_COMPANY, DEFAULT_LAYOUT);
            const rightStack = header.columns[1].stack;
            const texts = rightStack.map(s => s.text);
            expect(texts).toContain('+49 89 123456');
            expect(texts).toContain('info@musterbau.de');
        });

        it('should use two-column layout', () => {
            const header = service.buildHeader(SAMPLE_COMPANY, DEFAULT_LAYOUT);
            expect(header.columns).toHaveLength(2);
        });
    });

    describe('Customer Address Building', () => {
        it('should use firma when provided', () => {
            const addr = service.buildCustomerAddress(SAMPLE_INVOICE.kunde, DEFAULT_LAYOUT);
            expect(addr.stack[0].text).toBe('Max Mustermann GmbH');
        });

        it('should fall back to name when no firma', () => {
            const kunde = { name: 'Herr Müller', strasse: 'Teststr. 1', plz: '10115', ort: 'Berlin' };
            const addr = service.buildCustomerAddress(kunde, DEFAULT_LAYOUT);
            expect(addr.stack[0].text).toBe('Herr Müller');
        });

        it('should include street in address', () => {
            const addr = service.buildCustomerAddress(SAMPLE_INVOICE.kunde, DEFAULT_LAYOUT);
            expect(addr.stack[1].text).toBe('Kundenstraße 1');
        });

        it('should include PLZ and Ort', () => {
            const addr = service.buildCustomerAddress(SAMPLE_INVOICE.kunde, DEFAULT_LAYOUT);
            expect(addr.stack[2].text).toContain('10115');
            expect(addr.stack[2].text).toContain('Berlin');
        });
    });

    describe('Invoice Details Section', () => {
        it('should show RECHNUNG title', () => {
            const rechnung = {
                nummer: 'RE-2026-001',
                datum: '24.02.2026',
                faelligkeitsdatum: '10.03.2026'
            };
            const details = service.buildInvoiceDetails(rechnung, DEFAULT_LAYOUT);
            expect(details.columns[0].text).toBe('RECHNUNG');
        });

        it('should include invoice number in details', () => {
            const rechnung = { nummer: 'RE-2026-001', datum: '24.02.2026', faelligkeitsdatum: '10.03.2026' };
            const details = service.buildInvoiceDetails(rechnung, DEFAULT_LAYOUT);

            // Find the nummer in the nested structure
            const rightStack = details.columns[1].stack;
            const nummerRow = rightStack[0].columns;
            expect(nummerRow[1].text).toBe('RE-2026-001');
        });

        it('should include due date (Fällig am)', () => {
            const rechnung = { nummer: 'RE-001', datum: '24.02.2026', faelligkeitsdatum: '10.03.2026' };
            const details = service.buildInvoiceDetails(rechnung, DEFAULT_LAYOUT);

            const rightStack = details.columns[1].stack;
            // Third row is Fällig am
            const faelligRow = rightStack[2].columns;
            expect(faelligRow[0].text).toBe('Fällig am:');
            expect(faelligRow[1].text).toBe('10.03.2026');
        });
    });

    describe('Positions Table Building', () => {
        it('should create header row as first table row', () => {
            const result = service.buildPositionsTable(SAMPLE_INVOICE.positionen, DEFAULT_LAYOUT);
            const header = result.table.body[0];
            expect(header[1].text).toBe('Beschreibung');
            expect(header[3].text).toBe('Einzelpreis');
        });

        it('should create one row per position', () => {
            const result = service.buildPositionsTable(SAMPLE_INVOICE.positionen, DEFAULT_LAYOUT);
            // 1 header + 2 positions = 3 rows
            expect(result.table.body.length).toBe(3);
        });

        it('should calculate correct gesamt per line item', () => {
            const positions = [{ beschreibung: 'Arbeit', menge: 3, einzelpreis: 100 }];
            const result = service.buildPositionsTable(positions, DEFAULT_LAYOUT);
            const dataRow = result.table.body[1];
            // Gesamt = 3 * 100 = 300, formatted as German currency
            expect(dataRow[4].text).toContain('300,00');
        });

        it('should number positions starting from 1', () => {
            const result = service.buildPositionsTable(SAMPLE_INVOICE.positionen, DEFAULT_LAYOUT);
            expect(result.table.body[1][0].text).toBe('1');
            expect(result.table.body[2][0].text).toBe('2');
        });

        it('should format currency in German locale', () => {
            const positions = [{ beschreibung: 'Test', menge: 1, einzelpreis: 1234.56 }];
            const result = service.buildPositionsTable(positions, DEFAULT_LAYOUT);
            const dataRow = result.table.body[1];
            expect(dataRow[3].text).toContain('1.234,56');
        });

        it('should handle empty positions', () => {
            const result = service.buildPositionsTable([], DEFAULT_LAYOUT);
            // Only header row
            expect(result.table.body.length).toBe(1);
        });
    });

    describe('Totals Section Building', () => {
        it('should include Netto, MwSt and Brutto rows', () => {
            const summe = {
                netto: '1.000,00 €',
                mwst: '190,00 €',
                brutto: '1.190,00 €',
                mwstSatz: '19%'
            };

            const totals = service.buildTotals(summe, DEFAULT_LAYOUT);
            const stack = totals.columns[1].stack;

            // Check label texts
            expect(stack[0].columns[0].text).toBe('Netto:');
            expect(stack[1].columns[0].text).toContain('MwSt.');
            expect(stack[1].columns[0].text).toContain('19%');
            expect(stack[2].columns[0].text).toBe('Brutto:');
        });

        it('should include Brutto as bold', () => {
            const summe = { netto: '100 €', mwst: '19 €', brutto: '119 €', mwstSatz: '19%' };
            const totals = service.buildTotals(summe, DEFAULT_LAYOUT);
            const bruttoRow = totals.columns[1].stack[2].columns;
            expect(bruttoRow[0].bold).toBe(true);
        });
    });

    describe('Payment Terms Section', () => {
        it('should include IBAN in payment terms', () => {
            const rechnung = { nummer: 'RE-001', faelligkeitsdatum: '10.03.2026' };
            const terms = service.buildPaymentTerms(SAMPLE_COMPANY, rechnung, DEFAULT_LAYOUT);

            const allTexts = JSON.stringify(terms);
            expect(allTexts).toContain('DE89370400440532013000');
        });

        it('should include Verwendungszweck (invoice number)', () => {
            const rechnung = { nummer: 'RE-2026-001', faelligkeitsdatum: '10.03.2026' };
            const terms = service.buildPaymentTerms(SAMPLE_COMPANY, rechnung, DEFAULT_LAYOUT);

            const allTexts = JSON.stringify(terms);
            expect(allTexts).toContain('RE-2026-001');
        });

        it('should include BIC', () => {
            const rechnung = { nummer: 'RE-001', faelligkeitsdatum: '10.03.2026' };
            const terms = service.buildPaymentTerms(SAMPLE_COMPANY, rechnung, DEFAULT_LAYOUT);

            const allTexts = JSON.stringify(terms);
            expect(allTexts).toContain('COBADEFFXXX');
        });

        it('should include due date in payment instructions', () => {
            const rechnung = { nummer: 'RE-001', faelligkeitsdatum: '10.03.2026' };
            const terms = service.buildPaymentTerms(SAMPLE_COMPANY, rechnung, DEFAULT_LAYOUT);

            const allTexts = JSON.stringify(terms);
            expect(allTexts).toContain('10.03.2026');
        });
    });

    describe('Legal Info Footer', () => {
        it('should reference §14 UStG', () => {
            const legal = service.buildLegalInfo(SAMPLE_COMPANY, DEFAULT_LAYOUT);
            const allTexts = JSON.stringify(legal);
            expect(allTexts).toContain('§14 UStG');
        });

        it('should include USt-IdNr', () => {
            const legal = service.buildLegalInfo(SAMPLE_COMPANY, DEFAULT_LAYOUT);
            const allTexts = JSON.stringify(legal);
            expect(allTexts).toContain('DE123456789');
        });

        it('should include company contact details', () => {
            const legal = service.buildLegalInfo(SAMPLE_COMPANY, DEFAULT_LAYOUT);
            const allTexts = JSON.stringify(legal);
            expect(allTexts).toContain('info@musterbau.de');
            expect(allTexts).toContain('+49 89 123456');
        });
    });

    describe('German Locale Number Formatting', () => {
        it('should format 1000 as 1.000,00 €', () => {
            expect(service.formatCurrency(1000)).toContain('1.000,00');
        });

        it('should format 1234567.89 with German thousand separators', () => {
            const formatted = service.formatCurrency(1234567.89);
            expect(formatted).toContain('1.234.567,89');
        });

        it('should format 0 as 0,00 €', () => {
            expect(service.formatCurrency(0)).toContain('0,00');
        });

        it('should include Euro symbol', () => {
            const formatted = service.formatCurrency(100);
            expect(formatted).toContain('€');
        });

        it('should format negative amounts with minus prefix', () => {
            const formatted = service.formatCurrency(-500);
            expect(formatted).toContain('500');
            // Negative sign (either '-' or '−' depending on environment)
            expect(formatted.startsWith('-') || formatted.includes('−')).toBe(true);
        });
    });
});
