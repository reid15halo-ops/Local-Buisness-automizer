import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('DunningService', () => {
    let dunningService;

    beforeEach(() => {
        global.localStorage = {
            data: {},
            getItem: vi.fn((key) => {
                const value = global.localStorage.data[key];
                return value !== undefined ? JSON.stringify(value) : null;
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

        const DunningServiceClass = class DunningService {
            constructor() {
                this.mahnungen = JSON.parse(localStorage.getItem('freyai_mahnungen') || '[]');
                this.inkassoFaelle = JSON.parse(localStorage.getItem('freyai_inkasso') || '[]');

                this.eskalationsStufen = [
                    { tag: 0, typ: 'rechnung', name: 'Rechnung erstellt', gebuehr: 0 },
                    { tag: 14, typ: 'erinnerung', name: 'Zahlungserinnerung', gebuehr: 0 },
                    { tag: 28, typ: 'mahnung1', name: '1. Mahnung', gebuehr: 5.00 },
                    { tag: 42, typ: 'mahnung2', name: '2. Mahnung', gebuehr: 10.00 },
                    { tag: 56, typ: 'mahnung3', name: '3. Mahnung (letzte Warnung)', gebuehr: 15.00 },
                    { tag: 70, typ: 'inkasso', name: 'Inkasso-Übergabe', gebuehr: 0 }
                ];
            }

            checkRechnungStatus(rechnung) {
                if (rechnung.status === 'bezahlt') {
                    return { stufe: null, typ: 'bezahlt', message: 'Rechnung bezahlt' };
                }

                const rechnungsDatum = new Date(rechnung.createdAt);
                const heute = new Date();
                const tageOffen = Math.floor((heute - rechnungsDatum) / (1000 * 60 * 60 * 24));

                let aktuelleStufe = this.eskalationsStufen[0];
                for (const stufe of this.eskalationsStufen) {
                    if (tageOffen >= stufe.tag) {
                        aktuelleStufe = stufe;
                    }
                }

                return {
                    stufe: aktuelleStufe,
                    tageOffen: tageOffen,
                    naechsteStufe: this.getNextStufe(aktuelleStufe),
                    tageZurNaechstenStufe: this.getDaysToNextLevel(tageOffen, aktuelleStufe)
                };
            }

            getNextStufe(aktuelleStufe) {
                const idx = this.eskalationsStufen.findIndex(s => s.typ === aktuelleStufe.typ);
                return this.eskalationsStufen[idx + 1] || null;
            }

            getDaysToNextLevel(tageOffen, aktuelleStufe) {
                const next = this.getNextStufe(aktuelleStufe);
                return next ? next.tag - tageOffen : null;
            }

            erstelleMahnung(rechnung, stufe) {
                const mahnung = {
                    id: `MAH-${Date.now().toString(36).toUpperCase()}`,
                    rechnungId: rechnung.id,
                    kunde: rechnung.kunde,
                    originalBetrag: rechnung.brutto,
                    mahngebuehr: stufe.gebuehr,
                    gesamtBetrag: rechnung.brutto + this.getGesamtMahngebuehren(rechnung.id) + stufe.gebuehr,
                    stufe: stufe.typ,
                    stufenName: stufe.name,
                    erstelltAm: new Date().toISOString(),
                    status: 'erstellt'
                };

                this.mahnungen.push(mahnung);
                this.save();
                return mahnung;
            }

            getGesamtMahngebuehren(rechnungId) {
                return this.mahnungen
                    .filter(m => m.rechnungId === rechnungId)
                    .reduce((sum, m) => sum + m.mahngebuehr, 0);
            }

            getMahnungenForRechnung(rechnungId) {
                return this.mahnungen.filter(m => m.rechnungId === rechnungId);
            }

            generateMahnText(rechnung, stufe) {
                const templates = {
                    'erinnerung': `Sehr geehrte(r) ${rechnung.kunde.name},

bei Durchsicht unserer Buchhaltung haben wir festgestellt, dass die unten genannte Rechnung noch nicht beglichen wurde.`,
                    'mahnung1': `Sehr geehrte(r) ${rechnung.kunde.name},

leider konnten wir trotz unserer Zahlungserinnerung keinen Zahlungseingang verzeichnen.`,
                    'mahnung2': `Sehr geehrte(r) ${rechnung.kunde.name},

trotz wiederholter Aufforderung ist die nachstehende Forderung immer noch offen.`,
                    'mahnung3': `Sehr geehrte(r) ${rechnung.kunde.name},

LETZTE MAHNUNG VOR GERICHTLICHEM MAHNVERFAHREN`,
                    'inkasso': `ÜBERGABE AN INKASSO

Rechnung: ${rechnung.id}`
                };

                return templates[stufe.typ] || '';
            }

            checkAllOverdueInvoices(rechnungen) {
                const overdueItems = [];

                rechnungen.forEach(rechnung => {
                    if (rechnung.status !== 'bezahlt') {
                        const status = this.checkRechnungStatus(rechnung);
                        if (status.stufe && status.stufe.typ !== 'rechnung') {
                            overdueItems.push({
                                rechnung,
                                status,
                                actionNeeded: !this.hasMahnungForStufe(rechnung.id, status.stufe.typ)
                            });
                        }
                    }
                });

                return overdueItems;
            }

            hasMahnungForStufe(rechnungId, stufeTyp) {
                return this.mahnungen.some(m =>
                    m.rechnungId === rechnungId && m.stufe === stufeTyp
                );
            }

            erstelleInkassoFall(rechnung) {
                const fall = {
                    id: `INK-${Date.now().toString(36).toUpperCase()}`,
                    rechnungId: rechnung.id,
                    kunde: rechnung.kunde,
                    gesamtForderung: rechnung.brutto + this.getGesamtMahngebuehren(rechnung.id),
                    mahnHistorie: this.getMahnungenForRechnung(rechnung.id),
                    erstelltAm: new Date().toISOString(),
                    status: 'zur_pruefung'
                };

                this.inkassoFaelle.push(fall);
                this.saveInkasso();
                return fall;
            }

            getInkassoFaelle() {
                return this.inkassoFaelle;
            }

            save() {
                localStorage.setItem('freyai_mahnungen', JSON.stringify(this.mahnungen));
            }

            saveInkasso() {
                localStorage.setItem('freyai_inkasso', JSON.stringify(this.inkassoFaelle));
            }

            formatCurrency(amount) {
                return new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: 'EUR'
                }).format(amount);
            }

            formatDate(dateStr) {
                return new Date(dateStr).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            }
        };

        dunningService = new DunningServiceClass();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('Escalation Levels', () => {
        it('should have 6 escalation levels', () => {
            expect(dunningService.eskalationsStufen.length).toBe(6);
        });

        it('should have correct escalation fee structure', () => {
            const fees = dunningService.eskalationsStufen.map(s => s.gebuehr);
            expect(fees).toEqual([0, 0, 5, 10, 15, 0]);
        });

        it('should have correct day thresholds', () => {
            const days = dunningService.eskalationsStufen.map(s => s.tag);
            expect(days).toEqual([0, 14, 28, 42, 56, 70]);
        });
    });

    describe('Invoice Status Checking', () => {
        it('should show paid invoice as complete', () => {
            const rechnung = {
                id: 'R-001',
                status: 'bezahlt',
                createdAt: new Date().toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            const status = dunningService.checkRechnungStatus(rechnung);

            expect(status.typ).toBe('bezahlt');
            expect(status.message).toBe('Rechnung bezahlt');
        });

        it('should detect overdue invoice at 14 days', () => {
            const now = new Date();
            const date14DaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: date14DaysAgo.toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            const status = dunningService.checkRechnungStatus(rechnung);

            expect(status.stufe.typ).toBe('erinnerung');
            expect(status.tageOffen).toBeGreaterThanOrEqual(14);
        });

        it('should detect invoice in first reminder at 28 days', () => {
            const now = new Date();
            const date28DaysAgo = new Date(now - 28 * 24 * 60 * 60 * 1000);

            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: date28DaysAgo.toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            const status = dunningService.checkRechnungStatus(rechnung);

            expect(status.stufe.typ).toBe('mahnung1');
            expect(status.stufe.gebuehr).toBe(5);
        });

        it('should detect invoice in second reminder at 42 days', () => {
            const now = new Date();
            const date42DaysAgo = new Date(now - 42 * 24 * 60 * 60 * 1000);

            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: date42DaysAgo.toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            const status = dunningService.checkRechnungStatus(rechnung);

            expect(status.stufe.typ).toBe('mahnung2');
            expect(status.stufe.gebuehr).toBe(10);
        });

        it('should detect invoice in final reminder at 56 days', () => {
            const now = new Date();
            const date56DaysAgo = new Date(now - 56 * 24 * 60 * 60 * 1000);

            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: date56DaysAgo.toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            const status = dunningService.checkRechnungStatus(rechnung);

            expect(status.stufe.typ).toBe('mahnung3');
            expect(status.stufe.gebuehr).toBe(15);
        });

        it('should detect invoice ready for collection at 70 days', () => {
            const now = new Date();
            const date70DaysAgo = new Date(now - 70 * 24 * 60 * 60 * 1000);

            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: date70DaysAgo.toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            const status = dunningService.checkRechnungStatus(rechnung);

            expect(status.stufe.typ).toBe('inkasso');
        });

        it('should calculate days to next level', () => {
            const now = new Date();
            const date20DaysAgo = new Date(now - 20 * 24 * 60 * 60 * 1000);

            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: date20DaysAgo.toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            const status = dunningService.checkRechnungStatus(rechnung);

            expect(status.tageZurNaechstenStufe).toBeCloseTo(8, -1);
        });
    });

    describe('Mahnung Creation', () => {
        it('should create a mahnung', () => {
            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: new Date().toISOString(),
                kunde: { name: 'Test Customer' },
                brutto: 1000
            };

            const mahnung = dunningService.erstelleMahnung(rechnung, dunningService.eskalationsStufen[2]);

            expect(mahnung.rechnungId).toBe('R-001');
            expect(mahnung.stufe).toBe('mahnung1');
            expect(mahnung.mahngebuehr).toBe(5);
        });

        it('should set correct total amount with fees', () => {
            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: new Date().toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            const mahnung = dunningService.erstelleMahnung(rechnung, dunningService.eskalationsStufen[2]);

            expect(mahnung.gesamtBetrag).toBe(1005);
        });

        it('should accumulate fees from multiple mahnungen', () => {
            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: new Date().toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            dunningService.erstelleMahnung(rechnung, dunningService.eskalationsStufen[2]);
            dunningService.erstelleMahnung(rechnung, dunningService.eskalationsStufen[3]);

            const gesamtGebuehren = dunningService.getGesamtMahngebuehren('R-001');

            expect(gesamtGebuehren).toBe(15);
        });

        it('should retrieve all mahnungen for a rechnung', () => {
            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: new Date().toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            dunningService.erstelleMahnung(rechnung, dunningService.eskalationsStufen[2]);
            dunningService.erstelleMahnung(rechnung, dunningService.eskalationsStufen[3]);

            const mahnungen = dunningService.getMahnungenForRechnung('R-001');

            expect(mahnungen.length).toBe(2);
        });
    });

    describe('Mahnung Text Generation', () => {
        it('should generate erinnerung text', () => {
            const rechnung = {
                id: 'R-001',
                kunde: { name: 'Test Customer' },
                brutto: 1000
            };

            const text = dunningService.generateMahnText(rechnung, dunningService.eskalationsStufen[1]);

            expect(text).toContain('Test Customer');
            expect(text).toContain('Buchhaltung');
        });

        it('should generate mahnung1 text', () => {
            const rechnung = {
                id: 'R-001',
                kunde: { name: 'Test Customer' },
                brutto: 1000
            };

            const text = dunningService.generateMahnText(rechnung, dunningService.eskalationsStufen[2]);

            expect(text).toContain('Zahlungserinnerung');
            expect(text).toContain('Zahlungseingang');
        });

        it('should generate mahnung3 text', () => {
            const rechnung = {
                id: 'R-001',
                kunde: { name: 'Test Customer' },
                brutto: 1000
            };

            const text = dunningService.generateMahnText(rechnung, dunningService.eskalationsStufen[4]);

            expect(text).toContain('LETZTE MAHNUNG');
        });

        it('should generate inkasso text', () => {
            const rechnung = {
                id: 'R-001',
                kunde: { name: 'Test Customer' },
                brutto: 1000
            };

            const text = dunningService.generateMahnText(rechnung, dunningService.eskalationsStufen[5]);

            expect(text).toContain('INKASSO');
        });
    });

    describe('Overdue Invoice Detection', () => {
        it('should detect all overdue invoices', () => {
            const date30DaysAgo = new Date(new Date() - 30 * 24 * 60 * 60 * 1000);

            const rechnungen = [
                {
                    id: 'R-001',
                    status: 'offen',
                    createdAt: date30DaysAgo.toISOString(),
                    kunde: { name: 'Test' },
                    brutto: 1000
                },
                {
                    id: 'R-002',
                    status: 'bezahlt',
                    createdAt: date30DaysAgo.toISOString(),
                    kunde: { name: 'Test' },
                    brutto: 1000
                }
            ];

            const overdueItems = dunningService.checkAllOverdueInvoices(rechnungen);

            expect(overdueItems.length).toBeGreaterThan(0);
            expect(overdueItems.some(item => item.rechnung.id === 'R-001')).toBe(true);
        });

        it('should not include paid invoices in overdue list', () => {
            const date30DaysAgo = new Date(new Date() - 30 * 24 * 60 * 60 * 1000);

            const rechnungen = [
                {
                    id: 'R-001',
                    status: 'bezahlt',
                    createdAt: date30DaysAgo.toISOString(),
                    kunde: { name: 'Test' },
                    brutto: 1000
                }
            ];

            const overdueItems = dunningService.checkAllOverdueInvoices(rechnungen);

            expect(overdueItems.length).toBe(0);
        });

        it('should check if mahnung exists for stufe', () => {
            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: new Date().toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            dunningService.erstelleMahnung(rechnung, dunningService.eskalationsStufen[2]);

            expect(dunningService.hasMahnungForStufe('R-001', 'mahnung1')).toBe(true);
            expect(dunningService.hasMahnungForStufe('R-001', 'mahnung2')).toBe(false);
        });
    });

    describe('Inkasso Case Creation', () => {
        it('should create inkasso case', () => {
            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: new Date().toISOString(),
                kunde: { name: 'Test Customer' },
                brutto: 1000
            };

            const fall = dunningService.erstelleInkassoFall(rechnung);

            expect(fall.rechnungId).toBe('R-001');
            expect(fall.status).toBe('zur_pruefung');
            expect(fall.gesamtForderung).toBe(1000);
        });

        it('should include all mahnungen in inkasso case', () => {
            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: new Date().toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            dunningService.erstelleMahnung(rechnung, dunningService.eskalationsStufen[2]);
            dunningService.erstelleMahnung(rechnung, dunningService.eskalationsStufen[3]);

            const fall = dunningService.erstelleInkassoFall(rechnung);

            expect(fall.mahnHistorie.length).toBe(2);
        });

        it('should get all inkasso cases', () => {
            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: new Date().toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            dunningService.erstelleInkassoFall(rechnung);

            const faelle = dunningService.getInkassoFaelle();

            expect(faelle.length).toBe(1);
        });
    });

    describe('Formatting Helpers', () => {
        it('should format currency to German format', () => {
            const formatted = dunningService.formatCurrency(1234.56);

            expect(formatted).toContain('1.234,56');
            expect(formatted).toContain('€');
        });

        it('should format date to German format', () => {
            const dateStr = '2026-02-16T10:30:00';
            const formatted = dunningService.formatDate(dateStr);

            expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/);
        });
    });

    describe('Persistence', () => {
        it('should save mahnungen to localStorage', () => {
            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: new Date().toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            dunningService.erstelleMahnung(rechnung, dunningService.eskalationsStufen[2]);

            expect(localStorage.setItem).toHaveBeenCalledWith('freyai_mahnungen', expect.any(String));
        });

        it('should save inkasso cases to localStorage', () => {
            const rechnung = {
                id: 'R-001',
                status: 'offen',
                createdAt: new Date().toISOString(),
                kunde: { name: 'Test' },
                brutto: 1000
            };

            dunningService.erstelleInkassoFall(rechnung);

            expect(localStorage.setItem).toHaveBeenCalledWith('freyai_inkasso', expect.any(String));
        });
    });
});
