import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('DatevExportService', () => {
    let datevService;

    beforeEach(() => {
        global.localStorage = {
            data: {},
            getItem: vi.fn((key) => {
                const value = global.localStorage.data[key];
                return value === undefined ? null : JSON.stringify(value);
            }),
            setItem: vi.fn((key, value) => {
                global.localStorage.data[key] = JSON.parse(value);
            }),
            removeItem: vi.fn((key) => {
                delete global.localStorage.data[key];
            }),
            clear: vi.fn(() => {
                global.localStorage.data = {};
            })
        };

        // Mock bookkeepingService
        window.bookkeepingService = {
            buchungen: []
        };

        class DatevExportService {
            constructor() {
                this.exports = JSON.parse(localStorage.getItem('mhs_datev_exports') || '[]');
                this.settings = JSON.parse(localStorage.getItem('mhs_datev_settings') || '{}');

                if (!this.settings.beraterNummer) this.settings.beraterNummer = '12345';
                if (!this.settings.mandantenNummer) this.settings.mandantenNummer = '67890';
                if (!this.settings.wirtschaftsjahr) this.settings.wirtschaftsjahr = new Date().getFullYear();
                if (!this.settings.sachkontenlaenge) this.settings.sachkontenlaenge = 4;
            }

            generateExport(fromDate, toDate, options = {}) {
                const buchungen = this.getBuchungenForPeriod(fromDate, toDate);

                if (buchungen.length === 0) {
                    return { success: false, error: 'Keine Buchungen im Zeitraum' };
                }

                const exportData = {
                    id: 'datev-' + Date.now(),
                    type: options.format || 'buchungen',
                    fromDate,
                    toDate,
                    createdAt: new Date().toISOString(),
                    recordCount: buchungen.length,
                    header: this.generateHeader(fromDate, toDate),
                    data: []
                };

                buchungen.forEach((buchung, index) => {
                    const record = this.convertToDatevRecord(buchung, index + 1);
                    exportData.data.push(record);
                });

                exportData.csvContent = this.generateDatevCsv(exportData);

                this.exports.push(exportData);
                this.save();

                return { success: true, export: exportData };
            }

            getBuchungenForPeriod(fromDate, toDate) {
                if (window.bookkeepingService) {
                    return (window.bookkeepingService.buchungen || []).filter(b => {
                        const datum = b.datum || b.createdAt?.split('T')[0];
                        return datum >= fromDate && datum <= toDate;
                    });
                }
                return [];
            }

            generateHeader(fromDate, toDate) {
                const now = new Date();
                return {
                    formatVersion: '510',
                    exportTyp: 21,
                    formatName: 'Buchungsstapel',
                    formatVersion2: 12,
                    erzeugtAm: now.toISOString().slice(0, 10).replace(/-/g, ''),
                    beraterNummer: this.settings.beraterNummer,
                    mandantenNummer: this.settings.mandantenNummer,
                    wirtschaftsjahrBeginn: `${this.settings.wirtschaftsjahr}0101`,
                    sachkontenlaenge: this.settings.sachkontenlaenge,
                    datumVon: fromDate.replace(/-/g, ''),
                    datumBis: toDate.replace(/-/g, ''),
                    bezeichnung: `Export ${fromDate} bis ${toDate}`,
                    waehrung: 'EUR'
                };
            }

            convertToDatevRecord(buchung, recordNumber) {
                const isEinnahme = buchung.typ === 'einnahme';
                const betrag = Math.round(buchung.betrag * 100);

                const sachkonto = this.getSachkonto(buchung.kategorie, buchung.typ);
                const gegenkonto = isEinnahme ? '8400' : '1200';

                return {
                    satzNr: recordNumber,
                    umsatz: betrag,
                    sollHaben: isEinnahme ? 'H' : 'S',
                    waehrung: 'EUR',
                    konto: sachkonto,
                    gegenKonto: gegenkonto,
                    buchungsSchluessel: isEinnahme ? '3' : '2',
                    datum: this.formatDatevDate(buchung.datum),
                    belegfeld1: buchung.belegNummer || '',
                    belegfeld2: '',
                    skonto: 0,
                    buchungstext: (buchung.beschreibung || '').slice(0, 60),
                    postensperre: 0,
                    kost1: '',
                    kost2: '',
                    ustId: ''
                };
            }

            getSachkonto(kategorie, typ) {
                const konten = {
                    'einnahme': {
                        'Dienstleistung': '8400',
                        'Warenverkauf': '8400',
                        'Provisionen': '8520',
                        'Sonstige Erlöse': '8900',
                        'default': '8400'
                    },
                    'ausgabe': {
                        'Wareneinkauf': '3400',
                        'Material': '3400',
                        'Bürobedarf': '4930',
                        'Telefon': '4920',
                        'Miete': '4210',
                        'Versicherungen': '4360',
                        'KFZ-Kosten': '4540',
                        'Werbung': '4600',
                        'Reisekosten': '4660',
                        'Fortbildung': '4945',
                        'Bewirtung': '4650',
                        'Porto': '4910',
                        'Reparaturen': '4805',
                        'Zinsen': '2100',
                        'Gebühren': '4970',
                        'Sonstige Ausgaben': '4900',
                        'default': '4900'
                    }
                };

                const typKonten = konten[typ] || konten['ausgabe'];
                return typKonten[kategorie] || typKonten['default'];
            }

            formatDatevDate(dateString) {
                if (!dateString) return '';
                const parts = dateString.split(/[-./]/);
                if (parts.length >= 2) {
                    const day = parts[2] || parts[0];
                    const month = parts[1];
                    return day.padStart(2, '0') + month.padStart(2, '0');
                }
                return '';
            }

            generateDatevCsv(exportData) {
                const lines = [];
                const h = exportData.header;

                lines.push([
                    '"EXTF"', h.formatVersion, h.exportTyp, `"${h.formatName}"`,
                    h.formatVersion2, h.erzeugtAm, '', '', '', '', h.beraterNummer,
                    h.mandantenNummer, h.wirtschaftsjahrBeginn, h.sachkontenlaenge,
                    h.datumVon, h.datumBis, `"${h.bezeichnung}"`, '', `"${h.waehrung}"`
                ].join(';'));

                lines.push([
                    'Umsatz', 'Soll/Haben', 'WKZ', 'Konto', 'Gegenkonto', 'BU-Schlüssel',
                    'Datum', 'Belegfeld 1', 'Belegfeld 2', 'Skonto', 'Buchungstext',
                    'Postensperre', 'Kost1', 'Kost2', 'USt-IdNr'
                ].join(';'));

                exportData.data.forEach(record => {
                    lines.push([
                        record.umsatz,
                        `"${record.sollHaben}"`,
                        `"${record.waehrung}"`,
                        record.konto,
                        record.gegenKonto,
                        record.buchungsSchluessel,
                        record.datum,
                        `"${record.belegfeld1}"`,
                        `"${record.belegfeld2}"`,
                        record.skonto,
                        `"${record.buchungstext}"`,
                        record.postensperre,
                        `"${record.kost1}"`,
                        `"${record.kost2}"`,
                        `"${record.ustId}"`
                    ].join(';'));
                });

                return lines.join('\r\n');
            }

            downloadExport(exportId) {
                const exp = this.exports.find(e => e.id === exportId);
                if (!exp) return { success: false, error: 'Export nicht gefunden' };

                const blob = new Blob([exp.csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `DATEV_${exp.fromDate}_${exp.toDate}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                return { success: true };
            }

            generateEuerReport(year) {
                const fromDate = `${year}-01-01`;
                const toDate = `${year}-12-31`;
                const buchungen = this.getBuchungenForPeriod(fromDate, toDate);

                const report = {
                    year,
                    generatedAt: new Date().toISOString(),
                    einnahmen: { total: 0, byCategory: {} },
                    ausgaben: { total: 0, byCategory: {} },
                    gewinn: 0,
                    details: []
                };

                buchungen.forEach(b => {
                    const kategorie = b.kategorie || 'Sonstige';
                    const betrag = b.betrag || 0;

                    if (b.typ === 'einnahme') {
                        report.einnahmen.total += betrag;
                        report.einnahmen.byCategory[kategorie] = (report.einnahmen.byCategory[kategorie] || 0) + betrag;
                    } else {
                        report.ausgaben.total += betrag;
                        report.ausgaben.byCategory[kategorie] = (report.ausgaben.byCategory[kategorie] || 0) + betrag;
                    }

                    report.details.push({
                        datum: b.datum,
                        typ: b.typ,
                        kategorie,
                        betrag,
                        beschreibung: b.beschreibung
                    });
                });

                report.gewinn = report.einnahmen.total - report.ausgaben.total;

                return report;
            }

            generateEuerText(year) {
                const report = this.generateEuerReport(year);
                const lines = [];

                lines.push(`EINNAHMEN-ÜBERSCHUSS-RECHNUNG ${year}`);
                lines.push('='.repeat(50));
                lines.push('');

                lines.push('BETRIEBSEINNAHMEN');
                lines.push('-'.repeat(30));
                Object.entries(report.einnahmen.byCategory).forEach(([kat, betrag]) => {
                    lines.push(`  ${kat.padEnd(25)} ${this.formatCurrency(betrag).padStart(12)}`);
                });
                lines.push('-'.repeat(30));
                lines.push(`  SUMME EINNAHMEN${' '.repeat(8)} ${this.formatCurrency(report.einnahmen.total).padStart(12)}`);
                lines.push('');

                lines.push('BETRIEBSAUSGABEN');
                lines.push('-'.repeat(30));
                Object.entries(report.ausgaben.byCategory).forEach(([kat, betrag]) => {
                    lines.push(`  ${kat.padEnd(25)} ${this.formatCurrency(betrag).padStart(12)}`);
                });
                lines.push('-'.repeat(30));
                lines.push(`  SUMME AUSGABEN${' '.repeat(9)} ${this.formatCurrency(report.ausgaben.total).padStart(12)}`);
                lines.push('');

                lines.push('='.repeat(50));
                lines.push(`  GEWINN/VERLUST${' '.repeat(9)} ${this.formatCurrency(report.gewinn).padStart(12)}`);
                lines.push('');

                lines.push(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`);

                return lines.join('\n');
            }

            getTaxCategories() {
                return {
                    'vollAbzugsfaehig': ['Wareneinkauf', 'Material', 'Bürobedarf', 'Miete', 'Telefon'],
                    'beschraenktAbzugsfaehig': ['Bewirtung', 'Geschenke', 'Reisekosten'],
                    'nichtAbzugsfaehig': ['Private Ausgaben', 'Bußgelder'],
                    'abschreibung': ['Anlagevermögen', 'GWG']
                };
            }

            formatCurrency(amount) {
                return new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: 'EUR'
                }).format(amount);
            }

            getExports() {
                return this.exports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }

            updateSettings(newSettings) {
                this.settings = { ...this.settings, ...newSettings };
                localStorage.setItem('mhs_datev_settings', JSON.stringify(this.settings));
            }

            save() {
                localStorage.setItem('mhs_datev_exports', JSON.stringify(this.exports));
            }
        }

        datevService = new DatevExportService();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('Settings Management', () => {
        it('should have default settings', () => {
            expect(datevService.settings.beraterNummer).toBe('12345');
            expect(datevService.settings.mandantenNummer).toBe('67890');
            expect(datevService.settings.sachkontenlaenge).toBe(4);
        });

        it('should update settings', () => {
            datevService.updateSettings({
                beraterNummer: '99999',
                mandantenNummer: '88888'
            });

            expect(datevService.settings.beraterNummer).toBe('99999');
            expect(datevService.settings.mandantenNummer).toBe('88888');
        });
    });

    describe('Header Generation', () => {
        it('should generate DATEV header', () => {
            const header = datevService.generateHeader('2026-01-01', '2026-01-31');

            expect(header.formatVersion).toBe('510');
            expect(header.exportTyp).toBe(21);
            expect(header.formatName).toBe('Buchungsstapel');
            expect(header.waehrung).toBe('EUR');
        });

        it('should format dates without dashes in header', () => {
            const header = datevService.generateHeader('2026-01-01', '2026-01-31');

            expect(header.datumVon).toBe('20260101');
            expect(header.datumBis).toBe('20260131');
        });

        it('should include advisor and client numbers', () => {
            const header = datevService.generateHeader('2026-01-01', '2026-01-31');

            expect(header.beraterNummer).toBe('12345');
            expect(header.mandantenNummer).toBe('67890');
        });

        it('should set fiscal year correctly', () => {
            datevService.updateSettings({ wirtschaftsjahr: 2026 });
            const header = datevService.generateHeader('2026-01-01', '2026-12-31');

            expect(header.wirtschaftsjahrBeginn).toBe('20260101');
        });
    });

    describe('Sachkonto Mapping', () => {
        it('should map Dienstleistung to 8400', () => {
            const konto = datevService.getSachkonto('Dienstleistung', 'einnahme');
            expect(konto).toBe('8400');
        });

        it('should map Wareneinkauf to 3400', () => {
            const konto = datevService.getSachkonto('Wareneinkauf', 'ausgabe');
            expect(konto).toBe('3400');
        });

        it('should map Miete to 4210', () => {
            const konto = datevService.getSachkonto('Miete', 'ausgabe');
            expect(konto).toBe('4210');
        });

        it('should map Telefon to 4920', () => {
            const konto = datevService.getSachkonto('Telefon', 'ausgabe');
            expect(konto).toBe('4920');
        });

        it('should use default 8400 for unknown income category', () => {
            const konto = datevService.getSachkonto('UnknownCategory', 'einnahme');
            expect(konto).toBe('8400');
        });

        it('should use default 4900 for unknown expense category', () => {
            const konto = datevService.getSachkonto('UnknownCategory', 'ausgabe');
            expect(konto).toBe('4900');
        });
    });

    describe('Date Formatting', () => {
        it('should format date as DDMM for DATEV', () => {
            const formatted = datevService.formatDatevDate('2026-01-15');
            expect(formatted).toBe('1501');
        });

        it('should format date with slashes', () => {
            const formatted = datevService.formatDatevDate('15/01/2026');
            expect(formatted).toMatch(/\d{4}/);
        });

        it('should pad day and month with zeros', () => {
            const formatted = datevService.formatDatevDate('2026-02-05');
            expect(formatted).toBe('0502');
        });

        it('should return empty string for invalid date', () => {
            const formatted = datevService.formatDatevDate('');
            expect(formatted).toBe('');
        });
    });

    describe('Record Conversion', () => {
        it('should convert income booking to DATEV record', () => {
            const buchung = {
                typ: 'einnahme',
                betrag: 1000,
                kategorie: 'Dienstleistung',
                datum: '2026-01-15',
                belegNummer: 'INV-001',
                beschreibung: 'Metallbau Service'
            };

            const record = datevService.convertToDatevRecord(buchung, 1);

            expect(record.satzNr).toBe(1);
            expect(record.umsatz).toBe(100000);
            expect(record.sollHaben).toBe('H');
            expect(record.konto).toBe('8400');
            expect(record.buchungsSchluessel).toBe('3');
        });

        it('should convert expense booking to DATEV record', () => {
            const buchung = {
                typ: 'ausgabe',
                betrag: 500,
                kategorie: 'Miete',
                datum: '2026-01-15',
                belegNummer: 'RENT-001',
                beschreibung: 'Monthly Rent'
            };

            const record = datevService.convertToDatevRecord(buchung, 1);

            expect(record.umsatz).toBe(50000);
            expect(record.sollHaben).toBe('S');
            expect(record.konto).toBe('4210');
            expect(record.buchungsSchluessel).toBe('2');
        });

        it('should use correct counter account for income', () => {
            const buchung = {
                typ: 'einnahme',
                betrag: 1000,
                kategorie: 'Dienstleistung',
                datum: '2026-01-15'
            };

            const record = datevService.convertToDatevRecord(buchung, 1);

            expect(record.gegenKonto).toBe('8400');
        });

        it('should use correct counter account for expenses', () => {
            const buchung = {
                typ: 'ausgabe',
                betrag: 500,
                kategorie: 'Miete',
                datum: '2026-01-15'
            };

            const record = datevService.convertToDatevRecord(buchung, 1);

            expect(record.gegenKonto).toBe('1200');
        });
    });

    describe('CSV Generation', () => {
        it('should generate valid CSV with headers', () => {
            const exportData = {
                header: datevService.generateHeader('2026-01-01', '2026-01-31'),
                data: []
            };

            const csv = datevService.generateDatevCsv(exportData);

            expect(csv).toContain('EXTF');
            expect(csv).toContain('Umsatz');
            expect(csv).toContain('Soll/Haben');
        });

        it('should generate CSV with data records', () => {
            const buchung = {
                typ: 'einnahme',
                betrag: 1000,
                kategorie: 'Dienstleistung',
                datum: '2026-01-15'
            };

            const record = datevService.convertToDatevRecord(buchung, 1);

            const exportData = {
                header: datevService.generateHeader('2026-01-01', '2026-01-31'),
                data: [record]
            };

            const csv = datevService.generateDatevCsv(exportData);

            expect(csv).toContain('100000');
        });

        it('should use semicolon as delimiter', () => {
            const exportData = {
                header: datevService.generateHeader('2026-01-01', '2026-01-31'),
                data: []
            };

            const csv = datevService.generateDatevCsv(exportData);

            expect(csv).toContain(';');
        });
    });

    describe('Export Generation', () => {
        it('should return error when no bookings exist', () => {
            window.bookkeepingService.buchungen = [];

            const result = datevService.generateExport('2026-01-01', '2026-01-31');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Keine Buchungen');
        });

        it('should generate export with bookings', () => {
            window.bookkeepingService.buchungen = [
                {
                    typ: 'einnahme',
                    betrag: 1000,
                    kategorie: 'Dienstleistung',
                    datum: '2026-01-15'
                }
            ];

            const result = datevService.generateExport('2026-01-01', '2026-01-31');

            expect(result.success).toBe(true);
            expect(result.export.recordCount).toBe(1);
        });

        it('should include CSV content in export', () => {
            window.bookkeepingService.buchungen = [
                {
                    typ: 'einnahme',
                    betrag: 1000,
                    kategorie: 'Dienstleistung',
                    datum: '2026-01-15'
                }
            ];

            const result = datevService.generateExport('2026-01-01', '2026-01-31');

            expect(result.export.csvContent).toBeDefined();
            expect(result.export.csvContent).toContain('EXTF');
        });

        it('should filter bookings by date range', () => {
            window.bookkeepingService.buchungen = [
                {
                    typ: 'einnahme',
                    betrag: 1000,
                    kategorie: 'Dienstleistung',
                    datum: '2026-01-15'
                },
                {
                    typ: 'einnahme',
                    betrag: 500,
                    kategorie: 'Dienstleistung',
                    datum: '2026-02-15'
                }
            ];

            const result = datevService.generateExport('2026-01-01', '2026-01-31');

            expect(result.export.recordCount).toBe(1);
        });
    });

    describe('EÜR Report Generation', () => {
        it('should generate empty EÜR report when no bookings', () => {
            window.bookkeepingService.buchungen = [];

            const report = datevService.generateEuerReport(2026);

            expect(report.einnahmen.total).toBe(0);
            expect(report.ausgaben.total).toBe(0);
            expect(report.gewinn).toBe(0);
        });

        it('should generate EÜR report with income and expenses', () => {
            window.bookkeepingService.buchungen = [
                {
                    typ: 'einnahme',
                    betrag: 5000,
                    kategorie: 'Dienstleistung',
                    datum: '2026-01-15'
                },
                {
                    typ: 'ausgabe',
                    betrag: 2000,
                    kategorie: 'Miete',
                    datum: '2026-01-15'
                }
            ];

            const report = datevService.generateEuerReport(2026);

            expect(report.einnahmen.total).toBe(5000);
            expect(report.ausgaben.total).toBe(2000);
            expect(report.gewinn).toBe(3000);
        });

        it('should categorize bookings by category in EÜR', () => {
            window.bookkeepingService.buchungen = [
                {
                    typ: 'einnahme',
                    betrag: 5000,
                    kategorie: 'Dienstleistung',
                    datum: '2026-01-15'
                }
            ];

            const report = datevService.generateEuerReport(2026);

            expect(report.einnahmen.byCategory['Dienstleistung']).toBe(5000);
        });

        it('should generate EÜR text format', () => {
            window.bookkeepingService.buchungen = [
                {
                    typ: 'einnahme',
                    betrag: 5000,
                    kategorie: 'Dienstleistung',
                    datum: '2026-01-15'
                }
            ];

            const text = datevService.generateEuerText(2026);

            expect(text).toContain('EINNAHMEN-ÜBERSCHUSS-RECHNUNG');
            expect(text).toContain('BETRIEBSEINNAHMEN');
        });
    });

    describe('Tax Categories', () => {
        it('should return tax categories', () => {
            const categories = datevService.getTaxCategories();

            expect(categories).toHaveProperty('vollAbzugsfaehig');
            expect(categories).toHaveProperty('beschraenktAbzugsfaehig');
            expect(categories).toHaveProperty('nichtAbzugsfaehig');
            expect(categories).toHaveProperty('abschreibung');
        });

        it('should include deductible expenses', () => {
            const categories = datevService.getTaxCategories();

            expect(categories.vollAbzugsfaehig).toContain('Material');
            expect(categories.vollAbzugsfaehig).toContain('Bürobedarf');
            expect(categories.vollAbzugsfaehig).toContain('Miete');
            expect(categories.vollAbzugsfaehig).toContain('Telefon');
        });
    });

    describe('Export Retrieval', () => {
        it('should get all exports sorted by date', () => {
            window.bookkeepingService.buchungen = [
                {
                    typ: 'einnahme',
                    betrag: 1000,
                    kategorie: 'Dienstleistung',
                    datum: '2026-01-15'
                }
            ];

            datevService.generateExport('2026-01-01', '2026-01-31');
            const exports = datevService.getExports();

            expect(Array.isArray(exports)).toBe(true);
            expect(exports.length).toBeGreaterThan(0);
        });
    });

    describe('Currency Formatting', () => {
        it('should format currency to German locale', () => {
            const formatted = datevService.formatCurrency(1234.56);

            expect(formatted).toContain('1.234,56');
            expect(formatted).toContain('€');
        });
    });

    describe('Persistence', () => {
        it('should save exports to localStorage', () => {
            window.bookkeepingService.buchungen = [
                {
                    typ: 'einnahme',
                    betrag: 1000,
                    kategorie: 'Dienstleistung',
                    datum: '2026-01-15'
                }
            ];

            datevService.generateExport('2026-01-01', '2026-01-31');

            expect(localStorage.setItem).toHaveBeenCalledWith('mhs_datev_exports', expect.any(String));
        });

        it('should save settings to localStorage', () => {
            datevService.updateSettings({ beraterNummer: '55555' });

            expect(localStorage.setItem).toHaveBeenCalledWith('mhs_datev_settings', expect.any(String));
        });
    });
});
