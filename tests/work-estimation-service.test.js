import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WorkEstimationService', () => {
    let service;

    beforeEach(async () => {
        vi.resetModules();

        // Mock localStorage
        globalThis.localStorage = {
            data: {},
            getItem: vi.fn((key) => {
                const value = globalThis.localStorage.data[key];
                return value === undefined ? null : value;
            }),
            setItem: vi.fn((key, value) => {
                globalThis.localStorage.data[key] = value;
            }),
            removeItem: vi.fn((key) => {
                delete globalThis.localStorage.data[key];
            }),
            clear: vi.fn(() => {
                globalThis.localStorage.data = {};
            })
        };

        // Mock StorageUtils
        globalThis.StorageUtils = {
            getJSON: vi.fn((key, defaultVal) => defaultVal),
            setJSON: vi.fn(() => true)
        };

        // Mock window
        globalThis.window = {
            ...globalThis.window,
            companySettings: undefined,
            geminiService: undefined,
            storeService: undefined
        };

        // Mock document
        globalThis.document = {
            ...globalThis.document,
            dispatchEvent: vi.fn()
        };

        // Suppress console noise
        globalThis.console = {
            ...console,
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            log: vi.fn()
        };

        await import('../js/services/work-estimation-service.js');
        service = window.workEstimationService;
    });

    // ─── analysiereKomplexitaet ───

    describe('analysiereKomplexitaet', () => {
        it('returns mittel when no beschreibung is given', () => {
            expect(service.analysiereKomplexitaet(null)).toBe('mittel');
            expect(service.analysiereKomplexitaet(undefined)).toBe('mittel');
            expect(service.analysiereKomplexitaet('')).toBe('mittel');
        });

        it('returns einfach when simple keywords dominate', () => {
            // needs > punkteKomplex + 1 simple keywords
            const result = service.analysiereKomplexitaet('einfach standard klein kurz');
            expect(result).toBe('einfach');
        });

        it('returns komplex when complex keywords dominate', () => {
            // needs > punkteEinfach + 1 complex keywords
            const result = service.analysiereKomplexitaet('komplex umfangreich spezial maßanfertigung DIN');
            expect(result).toBe('komplex');
        });

        it('returns mittel when keywords are balanced', () => {
            const result = service.analysiereKomplexitaet('einfach standard komplex groß');
            expect(result).toBe('mittel');
        });

        it('is case-insensitive', () => {
            const result = service.analysiereKomplexitaet('EINFACH STANDARD KLEIN KURZ');
            expect(result).toBe('einfach');
        });
    });

    // ─── berechneKonfidenz ───

    describe('berechneKonfidenz', () => {
        it('returns hoch when 5 or more historical matches', () => {
            const result = service.berechneKonfidenz({}, [1, 2, 3, 4, 5]);
            expect(result).toBe('hoch');
        });

        it('returns mittel when 2-4 historical matches', () => {
            const result = service.berechneKonfidenz({}, [1, 2]);
            expect(result).toBe('mittel');
        });

        it('returns mittel when less than 2 matches but budget exists', () => {
            const result = service.berechneKonfidenz({ budget: 1000 }, []);
            expect(result).toBe('mittel');
        });

        it('returns niedrig when no matches and no budget', () => {
            const result = service.berechneKonfidenz({}, []);
            expect(result).toBe('niedrig');
        });
    });

    // ─── getEmpfehlung ───

    describe('getEmpfehlung', () => {
        it('recommends buffer for complex work', () => {
            const result = service.getEmpfehlung(10, 'komplex');
            expect(result).toContain('Puffer');
            expect(result).toContain('20-30%');
        });

        it('recommends on-site visit for jobs over 40 hours', () => {
            const result = service.getEmpfehlung(50, 'mittel');
            expect(result).toContain('Vor-Ort-Besichtigung');
        });

        it('returns standard recommendation otherwise', () => {
            const result = service.getEmpfehlung(10, 'mittel');
            expect(result).toContain('Standardschätzung');
        });

        it('prioritizes komplex recommendation over hour-based one', () => {
            // komplex check comes first in the code
            const result = service.getEmpfehlung(50, 'komplex');
            expect(result).toContain('Puffer');
        });
    });

    // ─── erstelleDetails ───

    describe('erstelleDetails', () => {
        it('returns a details object with expected structure', () => {
            const richtwert = service.basisRichtwerte['metallbau'];
            const result = service.erstelleDetails(
                { leistungsart: 'metallbau' },
                8,
                'mittel',
                richtwert
            );

            expect(result.basisStunden).toBe(8);
            expect(result.komplexitaetsFaktor).toBe(1.0);
            expect(result.ermittelteKomplexitaet).toBe('mittel');
            expect(result.leistungsart).toBe('Metallbau / Stahlkonstruktion');
            expect(typeof result.empfehlung).toBe('string');
        });
    });

    // ─── schaetzeArbeitsstunden ───

    describe('schaetzeArbeitsstunden', () => {
        it('returns an estimation object with expected keys', () => {
            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'metallbau',
                beschreibung: 'Standardkonstruktion'
            });

            expect(result).toHaveProperty('geschaetzteStunden');
            expect(result).toHaveProperty('komplexitaet');
            expect(result).toHaveProperty('konfidenz');
            expect(result).toHaveProperty('richtwert');
            expect(result).toHaveProperty('historischeDaten');
            expect(result).toHaveProperty('details');
        });

        it('uses sonstiges when leistungsart is unknown', () => {
            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'unknown_type'
            });
            expect(result.richtwert).toBe(service.basisRichtwerte['sonstiges']);
        });

        it('uses sonstiges when leistungsart is missing', () => {
            const result = service.schaetzeArbeitsstunden({});
            expect(result.richtwert).toBe(service.basisRichtwerte['sonstiges']);
        });

        it('calculates basic metallbau mittel correctly (no budget, no history)', () => {
            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'metallbau',
                beschreibung: 'Normaler Auftrag'
            });

            // basis=8, mittel factor=1.0, so 8*1.0 = 8
            // rounded to half-hour = 8
            expect(result.geschaetzteStunden).toBe(8);
            expect(result.komplexitaet).toBe('mittel');
        });

        it('applies einfach complexity factor', () => {
            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'metallbau',
                beschreibung: 'einfach standard klein kurz'
            });

            // basis=8, einfach factor=0.7, so 8*0.7 = 5.6
            // rounded to half-hour = 5.5
            expect(result.geschaetzteStunden).toBe(5.5);
            expect(result.komplexitaet).toBe('einfach');
        });

        it('applies komplex complexity factor', () => {
            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'metallbau',
                beschreibung: 'komplex umfangreich spezial maßanfertigung DIN'
            });

            // basis=8, komplex factor=1.5, so 8*1.5 = 12
            expect(result.geschaetzteStunden).toBe(12);
            expect(result.komplexitaet).toBe('komplex');
        });

        it('incorporates budget using weighted average with default stundensatz', () => {
            // Default stundensatz = 65
            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'schweissen',
                beschreibung: 'Normaler Auftrag',
                budget: 650
            });

            // basis=2, mittel factor=1.0, basisStunden=2
            // budgetStunden = 650/65 = 10
            // weighted: (2*0.3) + (10*0.7) = 0.6 + 7 = 7.6
            // rounded to half-hour = 7.5
            expect(result.geschaetzteStunden).toBe(7.5);
        });

        it('uses companySettings stundensatz when available', () => {
            window.companySettings = {
                getStundensatz: () => 80
            };

            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'schweissen',
                beschreibung: 'Normaler Auftrag',
                budget: 800
            });

            // basis=2, mittel=1.0, basisStunden=2
            // budgetStunden = 800/80 = 10
            // weighted: (2*0.3) + (10*0.7) = 0.6 + 7 = 7.6
            // rounded to half-hour = 7.5
            expect(result.geschaetzteStunden).toBe(7.5);
        });

        it('uses localStorage stundensatz as fallback', () => {
            globalThis.localStorage.data['stundensatz'] = '100';

            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'schweissen',
                beschreibung: 'Normaler Auftrag',
                budget: 1000
            });

            // basis=2, mittel=1.0, basisStunden=2
            // budgetStunden = 1000/100 = 10
            // weighted: (2*0.3) + (10*0.7) = 0.6 + 7 = 7.6
            // rounded to half-hour = 7.5
            expect(result.geschaetzteStunden).toBe(7.5);
        });

        it('incorporates historical data when present', () => {
            // Inject historical data directly
            service.historischeArbeiten = [
                { leistungsart: 'reparatur', beschreibung: 'Pumpe repariert', stunden: 10 },
                { leistungsart: 'reparatur', beschreibung: 'Ventil repariert', stunden: 6 }
            ];

            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'reparatur',
                beschreibung: 'Normaler Auftrag'
            });

            // basis=2, mittel=1.0, basisStunden=2
            // historisch average = (10+6)/2 = 8
            // weighted: (2*0.4) + (8*0.6) = 0.8 + 4.8 = 5.6
            // rounded to half-hour = 5.5
            expect(result.geschaetzteStunden).toBe(5.5);
            expect(result.historischeDaten).toBe(2);
        });

        it('rounds to half-hours', () => {
            // hydraulik: basis=1, mittel=1.0 => 1.0 => rounds to 1.0
            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'hydraulik',
                beschreibung: 'Normaler Auftrag'
            });
            // Check it's a multiple of 0.5
            expect(result.geschaetzteStunden % 0.5).toBe(0);
        });

        it('does not apply budget weighting when budget is 0', () => {
            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'metallbau',
                beschreibung: 'Normaler Auftrag',
                budget: 0
            });
            // Should be pure basis: 8 * 1.0 = 8
            expect(result.geschaetzteStunden).toBe(8);
        });
    });

    // ─── findeAehnlicheArbeiten ───

    describe('findeAehnlicheArbeiten', () => {
        it('matches by same leistungsart', () => {
            service.historischeArbeiten = [
                { leistungsart: 'metallbau', beschreibung: 'Treppe', stunden: 10 },
                { leistungsart: 'schweissen', beschreibung: 'Rohr', stunden: 5 }
            ];

            const results = service.findeAehnlicheArbeiten({ leistungsart: 'metallbau' });
            expect(results.length).toBe(1);
            expect(results[0].leistungsart).toBe('metallbau');
        });

        it('matches by description keyword overlap (at least 2 words >3 chars)', () => {
            service.historischeArbeiten = [
                { leistungsart: 'sonstiges', beschreibung: 'Große Stahltreppe Montage draußen', stunden: 20 }
            ];

            const results = service.findeAehnlicheArbeiten({
                leistungsart: 'metallbau',
                beschreibung: 'Stahltreppe Montage innen'
            });
            // 'stahltreppe' (len>3, match) and 'montage' (len>3, match) => 2 matches
            expect(results.length).toBe(1);
        });

        it('does not match when description keywords overlap less than 2', () => {
            service.historischeArbeiten = [
                { leistungsart: 'sonstiges', beschreibung: 'Kleine Reparatur', stunden: 2 }
            ];

            const results = service.findeAehnlicheArbeiten({
                leistungsart: 'metallbau',
                beschreibung: 'Große Reparatur Dach'
            });
            // Only 'reparatur' matches (len>3), that's only 1 < 2
            expect(results.length).toBe(0);
        });

        it('ignores words with 3 or fewer characters', () => {
            service.historischeArbeiten = [
                { leistungsart: 'sonstiges', beschreibung: 'ein aus dem und', stunden: 1 }
            ];

            const results = service.findeAehnlicheArbeiten({
                leistungsart: 'metallbau',
                beschreibung: 'ein aus dem und'
            });
            // All words are <= 3 chars, none count
            expect(results.length).toBe(0);
        });

        it('returns at most 5 results (the last 5)', () => {
            service.historischeArbeiten = Array.from({ length: 10 }, (_, i) => ({
                leistungsart: 'metallbau',
                beschreibung: `Arbeit ${i}`,
                stunden: i + 1
            }));

            const results = service.findeAehnlicheArbeiten({ leistungsart: 'metallbau' });
            expect(results.length).toBe(5);
            // Should be the last 5
            expect(results[0].stunden).toBe(6);
            expect(results[4].stunden).toBe(10);
        });

        it('returns empty array when no historische data exists', () => {
            service.historischeArbeiten = [];
            const results = service.findeAehnlicheArbeiten({ leistungsart: 'metallbau' });
            expect(results).toEqual([]);
        });
    });

    // ─── speichereHistorischeArbeit ───

    describe('speichereHistorischeArbeit', () => {
        it('stores a job entry with the correct fields', () => {
            const auftrag = {
                id: 'AUF-001',
                leistungsart: 'metallbau',
                positionen: [
                    { beschreibung: 'Treppe' },
                    { beschreibung: 'Geländer' }
                ],
                arbeitszeit: 12,
                materialKosten: 500,
                angebotsWert: 3000
            };

            service.speichereHistorischeArbeit(auftrag);

            expect(service.historischeArbeiten.length).toBe(1);
            const entry = service.historischeArbeiten[0];
            expect(entry.id).toBe('AUF-001');
            expect(entry.leistungsart).toBe('metallbau');
            expect(entry.beschreibung).toBe('Treppe, Geländer');
            expect(entry.stunden).toBe(12);
            expect(entry.materialKosten).toBe(500);
            expect(entry.gesamtWert).toBe(3000);
            expect(entry.datum).toBeTruthy();
        });

        it('uses defaults for missing fields', () => {
            service.speichereHistorischeArbeit({ id: 'AUF-002' });

            const entry = service.historischeArbeiten[0];
            expect(entry.beschreibung).toBe('');
            expect(entry.stunden).toBe(0);
            expect(entry.materialKosten).toBe(0);
            expect(entry.gesamtWert).toBe(0);
        });

        it('persists to localStorage', () => {
            service.speichereHistorischeArbeit({ id: 'AUF-003', leistungsart: 'schweissen' });
            expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(
                'freyai_historische_arbeiten',
                expect.any(String)
            );
        });

        it('caps historische data at 100 entries (keeps last 100)', () => {
            // Pre-fill with 100 entries
            service.historischeArbeiten = Array.from({ length: 100 }, (_, i) => ({
                id: `OLD-${i}`,
                stunden: i
            }));

            service.speichereHistorischeArbeit({ id: 'NEW-001', leistungsart: 'metallbau' });

            expect(service.historischeArbeiten.length).toBe(100);
            // The first old entry should be gone, new one should be last
            expect(service.historischeArbeiten[99].id).toBe('NEW-001');
            expect(service.historischeArbeiten[0].id).toBe('OLD-1');
        });
    });

    // ─── schaetzeMitMaterial ───

    describe('schaetzeMitMaterial', () => {
        it('adds material handling time to base estimate', () => {
            const anfrage = {
                leistungsart: 'metallbau',
                beschreibung: 'Normaler Auftrag'
            };
            const materialien = [
                { bezeichnung: 'Stahlrohr', menge: 5 },
                { bezeichnung: 'Schrauben', menge: 50 }
            ];

            const result = service.schaetzeMitMaterial(anfrage, materialien);

            // base: 8 (metallbau mittel)
            // material: 0.5 (menge<=10) + 1.0 (menge>10) = 1.5
            // total: 8 + 1.5 = 9.5
            expect(result.geschaetzteStunden).toBe(9.5);
            expect(result.details.materialHandling).toBe(1.5);
        });

        it('adds 0.5h for small material positions', () => {
            const result = service.schaetzeMitMaterial(
                { leistungsart: 'hydraulik', beschreibung: 'Normaler Auftrag' },
                [{ bezeichnung: 'Schlauch', menge: 2 }]
            );

            // hydraulik mittel: basis=1, factor=1.0 => 1
            // material: 0.5
            expect(result.details.materialHandling).toBe(0.5);
            expect(result.geschaetzteStunden).toBe(1.5);
        });

        it('adds 1h for large material positions (menge > 10)', () => {
            const result = service.schaetzeMitMaterial(
                { leistungsart: 'hydraulik', beschreibung: 'Normaler Auftrag' },
                [{ bezeichnung: 'Schrauben', menge: 100 }]
            );

            expect(result.details.materialHandling).toBe(1);
            expect(result.geschaetzteStunden).toBe(2);
        });

        it('handles empty material list', () => {
            const result = service.schaetzeMitMaterial(
                { leistungsart: 'metallbau', beschreibung: 'Normaler Auftrag' },
                []
            );

            expect(result.details.materialHandling).toBe(0);
            expect(result.geschaetzteStunden).toBe(8);
        });
    });

    // ─── schaetzeMitGemini ───

    describe('schaetzeMitGemini', () => {
        it('falls back to local estimation when geminiService is not available', async () => {
            window.geminiService = undefined;

            const result = await service.schaetzeMitGemini({
                leistungsart: 'metallbau',
                beschreibung: 'Normaler Auftrag'
            });

            expect(result.geschaetzteStunden).toBe(8);
            expect(result.quelle).toBeUndefined();
        });

        it('falls back to local estimation when geminiService.isConfigured is falsy', async () => {
            window.geminiService = { isConfigured: false };

            const result = await service.schaetzeMitGemini({
                leistungsart: 'metallbau',
                beschreibung: 'Normaler Auftrag'
            });

            expect(result.geschaetzteStunden).toBe(8);
        });

        it('returns gemini result with quelle and konfidenz when API succeeds', async () => {
            const geminiResponse = {
                geschaetzteStunden: 15,
                aufschluesselung: { vorbereitung: 2, fertigung: 8, montage: 4, dokumentation: 1 },
                komplexitaet: 'komplex',
                begruendung: 'Aufwendige Konstruktion'
            };

            window.geminiService = {
                isConfigured: true,
                _callGeminiAPI: vi.fn().mockResolvedValue({
                    candidates: [{
                        content: {
                            parts: [{ text: JSON.stringify(geminiResponse) }]
                        }
                    }]
                })
            };

            const result = await service.schaetzeMitGemini({
                leistungsart: 'metallbau',
                beschreibung: 'Große Stahlkonstruktion'
            });

            expect(result.quelle).toBe('gemini');
            expect(result.konfidenz).toBe('hoch');
            expect(result.geschaetzteStunden).toBe(15);
            expect(result.komplexitaet).toBe('komplex');
        });

        it('falls back to local estimation on API error', async () => {
            window.geminiService = {
                isConfigured: true,
                _callGeminiAPI: vi.fn().mockRejectedValue(new Error('API error'))
            };

            const result = await service.schaetzeMitGemini({
                leistungsart: 'schweissen',
                beschreibung: 'Normaler Auftrag'
            });

            // Should fallback to local: schweissen mittel = 2
            expect(result.geschaetzteStunden).toBe(2);
            expect(result.quelle).toBeUndefined();
        });

        it('falls back when gemini returns non-JSON text', async () => {
            window.geminiService = {
                isConfigured: true,
                _callGeminiAPI: vi.fn().mockResolvedValue({
                    candidates: [{
                        content: {
                            parts: [{ text: 'Sorry, I cannot help with that.' }]
                        }
                    }]
                })
            };

            const result = await service.schaetzeMitGemini({
                leistungsart: 'metallbau',
                beschreibung: 'Normaler Auftrag'
            });

            expect(result.geschaetzteStunden).toBe(8);
            expect(result.quelle).toBeUndefined();
        });

        it('passes materialien to the prompt when provided', async () => {
            window.geminiService = {
                isConfigured: true,
                _callGeminiAPI: vi.fn().mockResolvedValue({
                    candidates: [{
                        content: {
                            parts: [{ text: '{"geschaetzteStunden": 10, "komplexitaet": "mittel", "begruendung": "ok"}' }]
                        }
                    }]
                })
            };

            await service.schaetzeMitGemini(
                { leistungsart: 'metallbau', beschreibung: 'Test' },
                [{ bezeichnung: 'Stahlrohr' }, { bezeichnung: 'Schrauben' }]
            );

            const callArgs = window.geminiService._callGeminiAPI.mock.calls[0][0];
            const promptText = callArgs.contents[0].parts[0].text;
            expect(promptText).toContain('Stahlrohr');
            expect(promptText).toContain('Schrauben');
        });
    });

    // ─── basisRichtwerte ───

    describe('basisRichtwerte', () => {
        it('has all expected leistungsarten', () => {
            const expected = ['metallbau', 'schweissen', 'rohrleitungsbau', 'industriemontage', 'hydraulik', 'reparatur', 'sonstiges'];
            expected.forEach(key => {
                expect(service.basisRichtwerte).toHaveProperty(key);
            });
        });

        it('each richtwert has required properties', () => {
            Object.values(service.basisRichtwerte).forEach(richtwert => {
                expect(richtwert).toHaveProperty('basis');
                expect(richtwert).toHaveProperty('proPortion');
                expect(richtwert).toHaveProperty('komplexitaetsFaktor');
                expect(richtwert).toHaveProperty('beschreibung');
                expect(richtwert.komplexitaetsFaktor).toHaveProperty('einfach');
                expect(richtwert.komplexitaetsFaktor).toHaveProperty('mittel');
                expect(richtwert.komplexitaetsFaktor).toHaveProperty('komplex');
            });
        });

        it('mittel factor is always 1.0', () => {
            Object.values(service.basisRichtwerte).forEach(richtwert => {
                expect(richtwert.komplexitaetsFaktor.mittel).toBe(1.0);
            });
        });
    });

    // ─── komplexitaetsKeywords ───

    describe('komplexitaetsKeywords', () => {
        it('has einfach and komplex keyword lists', () => {
            expect(Array.isArray(service.komplexitaetsKeywords.einfach)).toBe(true);
            expect(Array.isArray(service.komplexitaetsKeywords.komplex)).toBe(true);
            expect(service.komplexitaetsKeywords.einfach.length).toBeGreaterThan(0);
            expect(service.komplexitaetsKeywords.komplex.length).toBeGreaterThan(0);
        });
    });

    // ─── Integration: full workflow ───

    describe('integration', () => {
        it('stores a historical job and uses it for future estimates', () => {
            // First, store some historical data
            service.speichereHistorischeArbeit({
                id: 'AUF-001',
                leistungsart: 'metallbau',
                arbeitszeit: 20,
                materialKosten: 500,
                angebotsWert: 3000
            });

            service.speichereHistorischeArbeit({
                id: 'AUF-002',
                leistungsart: 'metallbau',
                arbeitszeit: 16,
                materialKosten: 300,
                angebotsWert: 2000
            });

            // Now estimate a similar job
            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'metallbau',
                beschreibung: 'Normaler Auftrag'
            });

            // basis=8, mittel=1.0 => basisStunden=8
            // historical avg = (20+16)/2 = 18
            // weighted: (8*0.4) + (18*0.6) = 3.2 + 10.8 = 14
            expect(result.geschaetzteStunden).toBe(14);
            expect(result.historischeDaten).toBe(2);
            expect(result.konfidenz).toBe('mittel');
        });

        it('combines budget and historical data', () => {
            service.historischeArbeiten = [
                { leistungsart: 'reparatur', beschreibung: 'Ventil', stunden: 6 },
                { leistungsart: 'reparatur', beschreibung: 'Pumpe', stunden: 4 }
            ];

            const result = service.schaetzeArbeitsstunden({
                leistungsart: 'reparatur',
                beschreibung: 'Normaler Auftrag',
                budget: 650 // 650/65 = 10 budget hours
            });

            // basis=2, mittel=1.0 => basisStunden=2
            // budget: 650/65 = 10
            // after budget weighting: (2*0.3) + (10*0.7) = 0.6 + 7.0 = 7.6
            // historical avg = (6+4)/2 = 5
            // after historical weighting: (7.6*0.4) + (5*0.6) = 3.04 + 3.0 = 6.04
            // rounded to half-hour = 6.0
            expect(result.geschaetzteStunden).toBe(6);
        });
    });
});
