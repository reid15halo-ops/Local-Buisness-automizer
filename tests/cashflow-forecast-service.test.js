import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CashflowForecastService', () => {
    let service;

    // Sample forecast data matching a German craftsman business
    const sampleForecast = {
        id: 1,
        forecast_date: '2026-03-09',
        current_balance: 12450.80,
        forecast_30d: 8200.50,
        forecast_60d: 3100.00,
        forecast_90d: 750.25,
        details: {
            bewertung: 'GRUEN',
            gemini_analyse: 'Stabile Einnahmen aus laufenden Auftraegen. Materialkosten steigen leicht.',
            gemini_empfehlung: 'Offene Forderungen zeitnah einziehen. Lagerbestand optimieren.',
            offene_forderungen: 4500.00,
            offene_verbindlichkeiten: 2100.00,
            avg_einnahmen: 9500.00,
            avg_ausgaben: 7200.00,
        },
    };

    function createMockSupabase(responses = {}) {
        const chain = {
            from: vi.fn(() => chain),
            select: vi.fn(() => chain),
            order: vi.fn(() => chain),
            limit: vi.fn(() => chain),
            gte: vi.fn(() => chain),
            single: vi.fn(() => responses.single || { data: sampleForecast, error: null }),
        };
        // For loadForecastHistory which does not call .single()
        // The last chained call before await should resolve
        // order returns promise-like for history path
        const historyChain = {
            from: vi.fn(() => historyChain),
            select: vi.fn(() => historyChain),
            order: vi.fn(() => responses.history || { data: [], error: null }),
            gte: vi.fn(() => historyChain),
        };
        return { chain, historyChain };
    }

    beforeEach(async () => {
        vi.resetModules();

        // Clean up globals
        delete window.cashflowForecastService;
        delete window.supabaseClient;
        delete window.supabase;
        delete window.errorHandler;

        // Default: no supabase client
        window.supabase = undefined;
        window.supabaseClient = undefined;
        window.errorHandler = { handle: vi.fn() };

        globalThis.localStorage = {
            data: {},
            getItem: vi.fn((key) => globalThis.localStorage.data[key] ?? null),
            setItem: vi.fn((key, val) => { globalThis.localStorage.data[key] = val; }),
            removeItem: vi.fn((key) => { delete globalThis.localStorage.data[key]; }),
            clear: vi.fn(() => { globalThis.localStorage.data = {}; }),
        };

        globalThis.StorageUtils = {
            getJSON: vi.fn((key, def) => def),
            setJSON: vi.fn(() => true),
        };

        await import('../js/services/cashflow-forecast-service.js');
        service = window.cashflowForecastService;
    });

    // ─── getAmpel ────────────────────────────────────────────────

    describe('getAmpel', () => {
        it('returns "gruen" for balance >= 5000', () => {
            expect(service.getAmpel(5000)).toBe('gruen');
            expect(service.getAmpel(50000)).toBe('gruen');
            expect(service.getAmpel(5000.01)).toBe('gruen');
        });

        it('returns "gelb" for balance >= 1000 and < 5000', () => {
            expect(service.getAmpel(1000)).toBe('gelb');
            expect(service.getAmpel(4999.99)).toBe('gelb');
            expect(service.getAmpel(2500)).toBe('gelb');
        });

        it('returns "rot" for balance < 1000', () => {
            expect(service.getAmpel(999.99)).toBe('rot');
            expect(service.getAmpel(0)).toBe('rot');
            expect(service.getAmpel(-500)).toBe('rot');
        });
    });

    // ─── getAmpelColor ───────────────────────────────────────────

    describe('getAmpelColor', () => {
        it('returns green hex for gruen', () => {
            expect(service.getAmpelColor(10000)).toBe('#22c55e');
        });

        it('returns yellow hex for gelb', () => {
            expect(service.getAmpelColor(3000)).toBe('#eab308');
        });

        it('returns red hex for rot', () => {
            expect(service.getAmpelColor(500)).toBe('#ef4444');
        });
    });

    // ─── getAmpelLabel ───────────────────────────────────────────

    describe('getAmpelLabel', () => {
        it('returns "Gut" for gruen', () => {
            expect(service.getAmpelLabel(8000)).toBe('Gut');
        });

        it('returns "Achtung" for gelb', () => {
            expect(service.getAmpelLabel(2000)).toBe('Achtung');
        });

        it('returns "Kritisch" for rot', () => {
            expect(service.getAmpelLabel(100)).toBe('Kritisch');
        });
    });

    // ─── clearCache ──────────────────────────────────────────────

    describe('clearCache', () => {
        it('resets cache and cacheAt', () => {
            service._cache = { some: 'data' };
            service._cacheAt = Date.now();

            service.clearCache();

            expect(service._cache).toBeNull();
            expect(service._cacheAt).toBe(0);
        });
    });

    // ─── loadLatestForecast ──────────────────────────────────────

    describe('loadLatestForecast', () => {
        it('returns null when no Supabase client is available', async () => {
            window.supabase = undefined;
            window.supabaseClient = undefined;

            const result = await service.loadLatestForecast();
            expect(result).toBeNull();
        });

        it('loads forecast from Supabase and caches it', async () => {
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: sampleForecast, error: null }),
            };
            window.supabase = mockDb;

            const result = await service.loadLatestForecast();

            expect(result).toEqual(sampleForecast);
            expect(mockDb.from).toHaveBeenCalledWith('cashflow_forecasts');
            expect(mockDb.select).toHaveBeenCalledWith('*');
            expect(mockDb.order).toHaveBeenCalledWith('forecast_date', { ascending: false });
            expect(mockDb.limit).toHaveBeenCalledWith(1);

            // Verify caching
            expect(service._cache).toEqual(sampleForecast);
            expect(service._cacheAt).toBeGreaterThan(0);
        });

        it('returns cached data within TTL', async () => {
            service._cache = sampleForecast;
            service._cacheAt = Date.now(); // fresh cache

            const result = await service.loadLatestForecast();
            expect(result).toEqual(sampleForecast);
        });

        it('refreshes cache after TTL expires', async () => {
            const updatedForecast = { ...sampleForecast, current_balance: 20000 };

            service._cache = sampleForecast;
            service._cacheAt = Date.now() - 16 * 60 * 1000; // 16 min ago, past 15 min TTL

            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: updatedForecast, error: null }),
            };
            window.supabase = mockDb;

            const result = await service.loadLatestForecast();
            expect(result).toEqual(updatedForecast);
            expect(service._cache).toEqual(updatedForecast);
        });

        it('returns null on PGRST116 error (no rows)', async () => {
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            };
            window.supabase = mockDb;

            const result = await service.loadLatestForecast();
            expect(result).toBeNull();
        });

        it('returns null on other Supabase errors', async () => {
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: { code: 'OTHER', message: 'fail' } }),
            };
            window.supabase = mockDb;

            const result = await service.loadLatestForecast();
            expect(result).toBeNull();
        });

        it('returns null on unexpected exception', async () => {
            const mockDb = {
                from: vi.fn(() => { throw new Error('Netzwerkfehler'); }),
            };
            window.supabase = mockDb;

            const result = await service.loadLatestForecast();
            expect(result).toBeNull();
        });

        it('prefers supabaseClient.client over window.supabase', async () => {
            const mockClientDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: sampleForecast, error: null }),
            };
            window.supabaseClient = { client: mockClientDb };
            window.supabase = { from: vi.fn() }; // should not be used

            await service.loadLatestForecast();
            expect(mockClientDb.from).toHaveBeenCalled();
            expect(window.supabase.from).not.toHaveBeenCalled();
        });
    });

    // ─── loadForecastHistory ─────────────────────────────────────

    describe('loadForecastHistory', () => {
        it('returns empty array when no Supabase client is available', async () => {
            window.supabase = undefined;
            window.supabaseClient = undefined;

            const result = await service.loadForecastHistory();
            expect(result).toEqual([]);
        });

        it('loads forecast history from Supabase', async () => {
            const historyData = [
                { forecast_date: '2026-01-19', current_balance: 10000, forecast_30d: 8000, forecast_60d: 6000, forecast_90d: 5000 },
                { forecast_date: '2026-01-26', current_balance: 11000, forecast_30d: 9000, forecast_60d: 7000, forecast_90d: 5500 },
                { forecast_date: '2026-02-02', current_balance: 12000, forecast_30d: 9500, forecast_60d: 7500, forecast_90d: 6000 },
            ];

            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: historyData, error: null }),
            };
            window.supabase = mockDb;

            const result = await service.loadForecastHistory(8);

            expect(result).toEqual(historyData);
            expect(mockDb.from).toHaveBeenCalledWith('cashflow_forecasts');
            expect(mockDb.select).toHaveBeenCalledWith('forecast_date,current_balance,forecast_30d,forecast_60d,forecast_90d');
            expect(mockDb.order).toHaveBeenCalledWith('forecast_date', { ascending: true });
        });

        it('uses default 8 weeks when no parameter given', async () => {
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
            window.supabase = mockDb;

            await service.loadForecastHistory();

            // gte should have been called with a date ~56 days ago
            expect(mockDb.gte).toHaveBeenCalledTimes(1);
            const [field, dateStr] = mockDb.gte.mock.calls[0];
            expect(field).toBe('forecast_date');

            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() - 56);
            expect(dateStr).toBe(expectedDate.toISOString().split('T')[0]);
        });

        it('returns empty array on error', async () => {
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Tabelle nicht gefunden' } }),
            };
            window.supabase = mockDb;

            const result = await service.loadForecastHistory();
            expect(result).toEqual([]);
        });

        it('returns empty array on unexpected exception', async () => {
            const mockDb = {
                from: vi.fn(() => { throw new Error('Verbindung fehlgeschlagen'); }),
            };
            window.supabase = mockDb;

            const result = await service.loadForecastHistory();
            expect(result).toEqual([]);
        });

        it('returns empty array when data is null (no error)', async () => {
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                gte: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
            window.supabase = mockDb;

            const result = await service.loadForecastHistory();
            expect(result).toEqual([]);
        });
    });

    // ─── getWidgetData ───────────────────────────────────────────

    describe('getWidgetData', () => {
        it('returns hasData:false when no forecast available', async () => {
            // No supabase -> loadLatestForecast returns null
            const data = await service.getWidgetData();

            expect(data.type).toBe('cashflow-ai');
            expect(data.hasData).toBe(false);
            expect(data.message).toContain('Noch keine KI-Prognose');
        });

        it('returns full widget data when forecast is available', async () => {
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: sampleForecast, error: null }),
            };
            window.supabase = mockDb;

            const data = await service.getWidgetData();

            expect(data.type).toBe('cashflow-ai');
            expect(data.hasData).toBe(true);
            expect(data.forecastDate).toBe('2026-03-09');
            expect(data.currentBalance).toBe(12450.80);
            expect(data.forecast30d).toBe(8200.50);
            expect(data.forecast60d).toBe(3100.00);
            expect(data.forecast90d).toBe(750.25);
            expect(data.bewertung).toBe('GRUEN');
            expect(data.analyse).toBe('Stabile Einnahmen aus laufenden Auftraegen. Materialkosten steigen leicht.');
            expect(data.empfehlung).toBe('Offene Forderungen zeitnah einziehen. Lagerbestand optimieren.');
            expect(data.offeneForderungen).toBe(4500.00);
            expect(data.offeneVerbindlichkeiten).toBe(2100.00);
            expect(data.avgEinnahmen).toBe(9500.00);
            expect(data.avgAusgaben).toBe(7200.00);
        });

        it('computes ampel statuses correctly', async () => {
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: sampleForecast, error: null }),
            };
            window.supabase = mockDb;

            const data = await service.getWidgetData();

            // current_balance=12450.80 -> gruen, 30d=8200.50 -> gruen, 60d=3100 -> gelb, 90d=750.25 -> rot
            expect(data.ampel.current).toBe('gruen');
            expect(data.ampel.d30).toBe('gruen');
            expect(data.ampel.d60).toBe('gelb');
            expect(data.ampel.d90).toBe('rot');
        });

        it('computes ageTage correctly', async () => {
            // forecast_date is 2026-03-09, current date context is 2026-03-13
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: sampleForecast, error: null }),
            };
            window.supabase = mockDb;

            const data = await service.getWidgetData();

            // Age should be a non-negative integer
            expect(data.ageTage).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(data.ageTage)).toBe(true);
        });

        it('uses fallback bewertung from getAmpel when details.bewertung missing', async () => {
            const forecastNoBewertung = {
                ...sampleForecast,
                details: { ...sampleForecast.details, bewertung: undefined },
            };
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: forecastNoBewertung, error: null }),
            };
            window.supabase = mockDb;

            const data = await service.getWidgetData();

            // current_balance=12450.80 -> gruen -> 'GRUEN'
            expect(data.bewertung).toBe('GRUEN');
        });

        it('handles forecast with no details object', async () => {
            const forecastNoDetails = {
                ...sampleForecast,
                details: undefined,
            };
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: forecastNoDetails, error: null }),
            };
            window.supabase = mockDb;

            const data = await service.getWidgetData();

            expect(data.hasData).toBe(true);
            // Fallback values
            expect(data.bewertung).toBe('GRUEN'); // from getAmpel
            expect(data.analyse).toBe('');
            expect(data.empfehlung).toBe('');
            expect(data.offeneForderungen).toBe(0);
            expect(data.offeneVerbindlichkeiten).toBe(0);
            expect(data.avgEinnahmen).toBe(0);
            expect(data.avgAusgaben).toBe(0);
        });

        it('returns error state when loadLatestForecast throws', async () => {
            // Force an error by making loadLatestForecast throw
            service.loadLatestForecast = vi.fn().mockRejectedValue(new Error('Datenbankfehler'));

            const data = await service.getWidgetData();

            expect(data.type).toBe('cashflow-ai');
            expect(data.hasData).toBe(false);
            expect(data.message).toContain('Fehler');
        });
    });

    // ─── renderWidget ────────────────────────────────────────────

    describe('renderWidget', () => {
        it('renders empty state when no data available', async () => {
            // No supabase -> no forecast
            const html = await service.renderWidget();

            expect(html).toContain('cashflow-empty');
            expect(html).toContain('KI Cashflow-Prognose');
            expect(html).toContain('Noch keine KI-Prognose');
        });

        it('renders full widget with forecast data', async () => {
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: sampleForecast, error: null }),
            };
            window.supabase = mockDb;

            const html = await service.renderWidget();

            expect(html).toContain('cashflow-ai-widget');
            expect(html).toContain('KI Cashflow-Prognose');
            expect(html).toContain('Aktueller Stand');
            expect(html).toContain('30 Tage');
            expect(html).toContain('60 Tage');
            expect(html).toContain('90 Tage');
            expect(html).toContain('EUR');
            // Analyse and Empfehlung sections
            expect(html).toContain('Analyse');
            expect(html).toContain('Stabile Einnahmen');
            expect(html).toContain('Empfehlung');
            expect(html).toContain('Offene Forderungen zeitnah');
        });

        it('renders ampel badges with correct colors', async () => {
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: sampleForecast, error: null }),
            };
            window.supabase = mockDb;

            const html = await service.renderWidget();

            expect(html).toContain('cashflow-ampel-gruen');
            expect(html).toContain('cashflow-ampel-gelb');
            expect(html).toContain('cashflow-ampel-rot');
            expect(html).toContain('#22c55e'); // green
            expect(html).toContain('#eab308'); // yellow
            expect(html).toContain('#ef4444'); // red
        });

        it('renders Forderungen and Verbindlichkeiten', async () => {
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: sampleForecast, error: null }),
            };
            window.supabase = mockDb;

            const html = await service.renderWidget();

            expect(html).toContain('Forderungen');
            expect(html).toContain('Verbindlichkeiten');
        });

        it('omits Analyse section when analyse is empty', async () => {
            const forecastNoAnalyse = {
                ...sampleForecast,
                details: { ...sampleForecast.details, gemini_analyse: '', gemini_empfehlung: '' },
            };
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: forecastNoAnalyse, error: null }),
            };
            window.supabase = mockDb;

            const html = await service.renderWidget();

            expect(html).not.toContain('cashflow-ai-analyse-title');
            expect(html).not.toContain('cashflow-ai-empfehlung-title');
        });

        it('escapes HTML in analyse and empfehlung to prevent XSS', async () => {
            const forecastXSS = {
                ...sampleForecast,
                details: {
                    ...sampleForecast.details,
                    gemini_analyse: '<script>alert("xss")</script>',
                    gemini_empfehlung: 'Test & "Bewertung" <b>fett</b>',
                },
            };
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: forecastXSS, error: null }),
            };
            window.supabase = mockDb;

            const html = await service.renderWidget();

            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
            expect(html).toContain('&amp;');
            expect(html).toContain('&quot;Bewertung&quot;');
        });

        it('shows age warning when forecast is older than 7 days', async () => {
            const oldForecast = {
                ...sampleForecast,
                forecast_date: '2026-02-01', // well over 7 days ago from 2026-03-13
            };
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: oldForecast, error: null }),
            };
            window.supabase = mockDb;

            service.clearCache();
            const html = await service.renderWidget();

            expect(html).toContain('cashflow-age-warn');
            expect(html).toContain('Tage alt');
        });

        it('shows date info when forecast is recent', async () => {
            const recentForecast = {
                ...sampleForecast,
                forecast_date: new Date().toISOString().split('T')[0], // today
            };
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: recentForecast, error: null }),
            };
            window.supabase = mockDb;

            service.clearCache();
            const html = await service.renderWidget();

            expect(html).toContain('cashflow-age-info');
            expect(html).toContain('Stand:');
        });

        it('handles widget rendering error gracefully', async () => {
            service.getWidgetData = vi.fn().mockRejectedValue(new Error('Rendering kaputt'));

            const html = await service.renderWidget();

            expect(html).toContain('cashflow-empty');
            expect(html).toContain('Widget-Fehler');
        });

        it('formats negative amounts with minus sign', async () => {
            const negativeForecast = {
                ...sampleForecast,
                current_balance: -2500.50,
                forecast_30d: -1000,
                forecast_60d: -500,
                forecast_90d: -100,
            };
            const mockDb = {
                from: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: negativeForecast, error: null }),
            };
            window.supabase = mockDb;

            service.clearCache();
            const html = await service.renderWidget();

            // Negative amounts should have minus sign
            expect(html).toContain('-');
            expect(html).toContain('EUR');
        });
    });

    // ─── Constructor / Singleton ─────────────────────────────────

    describe('singleton behavior', () => {
        it('is accessible via window.cashflowForecastService', () => {
            expect(window.cashflowForecastService).toBeDefined();
            expect(window.cashflowForecastService).toBe(service);
        });

        it('initializes with empty cache', () => {
            // After fresh import, cache should be null
            expect(service._cache).toBeNull();
            expect(service._cacheAt).toBe(0);
            expect(service._ttl).toBe(15 * 60 * 1000);
        });
    });
});
