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
        src: '',
        integrity: '',
        crossOrigin: '',
        async: false,
        onload: null,
        onerror: null,
    })),
    head: {
        appendChild: vi.fn(),
    },
};

globalThis.window = globalThis;
window.showToast = vi.fn();
window.storeService = null;
window.timeTrackingService = null;
window.fieldAppService = null;
window.teamManagementService = null;
window.companySettingsService = null;
window.pdfGenerationService = null;
window.pdfMake = null;

// Mock navigator for geolocation tests
globalThis.navigator = { geolocation: null };

// Mock fetch for weather tests
globalThis.fetch = vi.fn();

await import('../js/services/bautagebuch-service.js');

const BautagebuchService = window.bautagebuchService.constructor;
const svc = () => window.bautagebuchService;

// ============================================
// Tests
// ============================================

describe('BautagebuchService', () => {
    beforeEach(() => {
        // Clear storage
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        // Reset window service mocks
        window.timeTrackingService = null;
        window.fieldAppService = null;
        window.teamManagementService = null;
        window.companySettingsService = null;
        window.storeService = null;
        window.pdfMake = null;
        window.pdfGenerationService = null;
        window.showToast = vi.fn();
        fetch.mockReset();
        navigator.geolocation = null;
        // Re-instantiate service
        window.bautagebuchService = new BautagebuchService();
    });

    // ── Constructor ──

    describe('constructor', () => {
        it('initializes with empty entries and settings', () => {
            expect(svc().entries).toEqual([]);
            expect(svc().settings).toEqual({});
        });

        it('loads entries from localStorage', () => {
            const entries = [{ id: 'BTB-1', jobId: 'J1', date: '2025-01-01' }];
            mockStorage['freyai_bautagebuch'] = JSON.stringify(entries);
            window.bautagebuchService = new BautagebuchService();
            expect(svc().entries).toEqual(entries);
        });

        it('loads settings from localStorage', () => {
            const settings = { openWeatherMapApiKey: 'test-key' };
            mockStorage['freyai_bautagebuch_settings'] = JSON.stringify(settings);
            window.bautagebuchService = new BautagebuchService();
            expect(svc().settings).toEqual(settings);
        });

        it('handles corrupt entries JSON gracefully', () => {
            mockStorage['freyai_bautagebuch'] = '{broken json';
            window.bautagebuchService = new BautagebuchService();
            expect(svc().entries).toEqual([]);
        });

        it('handles corrupt settings JSON gracefully', () => {
            mockStorage['freyai_bautagebuch_settings'] = 'not-json';
            window.bautagebuchService = new BautagebuchService();
            expect(svc().settings).toEqual({});
        });

        it('has WEATHER_CONDITIONS list', () => {
            expect(svc().WEATHER_CONDITIONS).toContain('Sonnig');
            expect(svc().WEATHER_CONDITIONS).toContain('Sturm');
            expect(svc().WEATHER_CONDITIONS.length).toBe(15);
        });

        it('has WIND_LEVELS list', () => {
            expect(svc().WIND_LEVELS).toContain('Windstill');
            expect(svc().WIND_LEVELS).toContain('Sturm');
            expect(svc().WIND_LEVELS.length).toBe(6);
        });

        it('has PRECIPITATION_TYPES list', () => {
            expect(svc().PRECIPITATION_TYPES).toContain('Kein');
            expect(svc().PRECIPITATION_TYPES).toContain('Hagel');
            expect(svc().PRECIPITATION_TYPES.length).toBe(8);
        });
    });

    // ── createEntry ──

    describe('createEntry', () => {
        it('creates a new entry with defaults', () => {
            const entry = svc().createEntry('JOB-1', '2025-03-10');
            expect(entry).not.toBeNull();
            expect(entry.id).toMatch(/^BTB-/);
            expect(entry.jobId).toBe('JOB-1');
            expect(entry.date).toBe('2025-03-10');
            expect(entry.weather).toEqual({ condition: '', temperature: null, wind: '', precipitation: '' });
            expect(entry.workersPresent).toEqual([]);
            expect(entry.workDescription).toBe('');
            expect(entry.materialsUsed).toEqual([]);
            expect(entry.photos).toEqual([]);
            expect(entry.incidents).toBe('');
            expect(entry.delays).toBe('');
            expect(entry.notes).toBe('');
            expect(entry.bauleiterSignature).toBeNull();
            expect(entry.confirmedAt).toBeNull();
            expect(entry.createdAt).toBeTruthy();
            expect(entry.updatedAt).toBeTruthy();
        });

        it('creates entry with provided data', () => {
            const data = {
                weather: { condition: 'Sonnig', temperature: 22, wind: 'Leicht', precipitation: 'Kein' },
                workersPresent: [{ name: 'Max', role: 'Maurer', hours: 8 }],
                workDescription: 'Mauern hochgezogen',
                materialsUsed: [{ name: 'Ziegel', quantity: 200, unit: 'Stk' }],
                notes: 'Alles gut',
            };
            const entry = svc().createEntry('JOB-2', '2025-04-01', data);
            expect(entry.weather.condition).toBe('Sonnig');
            expect(entry.weather.temperature).toBe(22);
            expect(entry.workersPresent).toHaveLength(1);
            expect(entry.workersPresent[0].name).toBe('Max');
            expect(entry.workDescription).toBe('Mauern hochgezogen');
            expect(entry.materialsUsed[0].name).toBe('Ziegel');
            expect(entry.notes).toBe('Alles gut');
        });

        it('saves to localStorage after creation', () => {
            svc().createEntry('JOB-1', '2025-03-10');
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai_bautagebuch',
                expect.any(String)
            );
        });

        it('returns null if jobId is missing', () => {
            expect(svc().createEntry(null, '2025-03-10')).toBeNull();
            expect(svc().createEntry('', '2025-03-10')).toBeNull();
        });

        it('returns null if date is missing', () => {
            expect(svc().createEntry('JOB-1', null)).toBeNull();
            expect(svc().createEntry('JOB-1', '')).toBeNull();
        });

        it('updates existing entry if same jobId+date', () => {
            const first = svc().createEntry('JOB-1', '2025-03-10', { notes: 'first' });
            const second = svc().createEntry('JOB-1', '2025-03-10', { notes: 'updated' });
            expect(second.id).toBe(first.id);
            expect(second.notes).toBe('updated');
            expect(svc().entries).toHaveLength(1);
        });

        it('uses storeService.generateId when available', () => {
            window.storeService = { generateId: vi.fn(() => 'BTB-CUSTOM-ID') };
            window.bautagebuchService = new BautagebuchService();
            const entry = svc().createEntry('JOB-1', '2025-01-01');
            expect(entry.id).toBe('BTB-CUSTOM-ID');
            expect(window.storeService.generateId).toHaveBeenCalledWith('BTB');
        });
    });

    // ── getEntry ──

    describe('getEntry', () => {
        it('returns entry by jobId and date', () => {
            svc().createEntry('JOB-1', '2025-03-10', { notes: 'found' });
            const entry = svc().getEntry('JOB-1', '2025-03-10');
            expect(entry).not.toBeNull();
            expect(entry.notes).toBe('found');
        });

        it('returns null if not found', () => {
            expect(svc().getEntry('NONE', '2025-01-01')).toBeNull();
        });
    });

    // ── getEntryById ──

    describe('getEntryById', () => {
        it('returns entry by id', () => {
            const created = svc().createEntry('JOB-1', '2025-03-10');
            const found = svc().getEntryById(created.id);
            expect(found).not.toBeNull();
            expect(found.id).toBe(created.id);
        });

        it('returns null for unknown id', () => {
            expect(svc().getEntryById('BTB-NOPE')).toBeNull();
        });
    });

    // ── getEntriesForJob ──

    describe('getEntriesForJob', () => {
        it('returns entries sorted by date', () => {
            svc().createEntry('JOB-1', '2025-03-12');
            svc().createEntry('JOB-1', '2025-03-10');
            svc().createEntry('JOB-1', '2025-03-11');
            const entries = svc().getEntriesForJob('JOB-1');
            expect(entries).toHaveLength(3);
            expect(entries[0].date).toBe('2025-03-10');
            expect(entries[1].date).toBe('2025-03-11');
            expect(entries[2].date).toBe('2025-03-12');
        });

        it('returns empty array for unknown job', () => {
            expect(svc().getEntriesForJob('NONE')).toEqual([]);
        });

        it('only returns entries for the given job', () => {
            svc().createEntry('JOB-1', '2025-03-10');
            svc().createEntry('JOB-2', '2025-03-10');
            expect(svc().getEntriesForJob('JOB-1')).toHaveLength(1);
        });
    });

    // ── updateEntry ──

    describe('updateEntry', () => {
        it('updates an entry by id', () => {
            const entry = svc().createEntry('JOB-1', '2025-03-10', { notes: 'old' });
            const updated = svc().updateEntry(entry.id, { notes: 'new' });
            expect(updated).not.toBeNull();
            expect(updated.notes).toBe('new');
            expect(updated.id).toBe(entry.id);
        });

        it('preserves id and createdAt on update', () => {
            const entry = svc().createEntry('JOB-1', '2025-03-10');
            const updated = svc().updateEntry(entry.id, { id: 'HACKED', createdAt: 'HACKED' });
            expect(updated.id).toBe(entry.id);
            expect(updated.createdAt).toBe(entry.createdAt);
        });

        it('deep merges weather objects', () => {
            const entry = svc().createEntry('JOB-1', '2025-03-10', {
                weather: { condition: 'Sonnig', temperature: 20, wind: 'Leicht', precipitation: 'Kein' },
            });
            const updated = svc().updateEntry(entry.id, { weather: { temperature: 25 } });
            expect(updated.weather.condition).toBe('Sonnig');
            expect(updated.weather.temperature).toBe(25);
        });

        it('returns null for unknown id', () => {
            expect(svc().updateEntry('BTB-NOPE', { notes: 'x' })).toBeNull();
        });

        it('sets updatedAt timestamp', () => {
            const entry = svc().createEntry('JOB-1', '2025-03-10');
            const oldUpdated = entry.updatedAt;
            // Small delay to ensure different timestamp
            const updated = svc().updateEntry(entry.id, { notes: 'change' });
            expect(updated.updatedAt).toBeTruthy();
        });
    });

    // ── deleteEntry ──

    describe('deleteEntry', () => {
        it('deletes an entry and returns true', () => {
            const entry = svc().createEntry('JOB-1', '2025-03-10');
            expect(svc().deleteEntry(entry.id)).toBe(true);
            expect(svc().entries).toHaveLength(0);
        });

        it('returns false for unknown id', () => {
            expect(svc().deleteEntry('BTB-NOPE')).toBe(false);
        });

        it('saves to localStorage after deletion', () => {
            const entry = svc().createEntry('JOB-1', '2025-03-10');
            localStorage.setItem.mockClear();
            svc().deleteEntry(entry.id);
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai_bautagebuch',
                expect.any(String)
            );
        });
    });

    // ── confirmEntry ──

    describe('confirmEntry', () => {
        it('sets signature and confirmedAt', () => {
            const entry = svc().createEntry('JOB-1', '2025-03-10');
            const confirmed = svc().confirmEntry(entry.id, 'data:image/png;base64,ABC');
            expect(confirmed).not.toBeNull();
            expect(confirmed.bauleiterSignature).toBe('data:image/png;base64,ABC');
            expect(confirmed.confirmedAt).toBeTruthy();
        });

        it('returns null for unknown id', () => {
            expect(svc().confirmEntry('BTB-NOPE', 'sig')).toBeNull();
        });
    });

    // ── autoPopulateEntry ──

    describe('autoPopulateEntry', () => {
        it('creates entry with empty data when no services available', () => {
            const entry = svc().autoPopulateEntry('JOB-1', '2025-03-10');
            expect(entry).not.toBeNull();
            expect(entry.jobId).toBe('JOB-1');
            expect(entry.workersPresent).toEqual([]);
            expect(entry.photos).toEqual([]);
            expect(entry.materialsUsed).toEqual([]);
        });

        it('populates workers from timeTrackingService', () => {
            window.timeTrackingService = {
                entries: [
                    { auftragId: 'JOB-1', date: '2025-03-10', employeeId: 'emp1', durationHours: 8 },
                    { auftragId: 'JOB-1', date: '2025-03-10', employeeId: 'emp2', durationHours: 6 },
                ],
            };
            const entry = svc().autoPopulateEntry('JOB-1', '2025-03-10');
            expect(entry.workersPresent).toHaveLength(2);
            expect(entry.workersPresent.find(w => w.name === 'emp1').hours).toBe(8);
        });

        it('falls back to fieldAppService for workers if timeTracking empty', () => {
            window.timeTrackingService = { entries: [] };
            window.fieldAppService = {
                timeEntries: [
                    { jobId: 'JOB-1', date: '2025-03-10', employeeName: 'Hans', durationHours: 7 },
                ],
                getPhotos: vi.fn(() => []),
                getMaterialLog: vi.fn(() => []),
            };
            const entry = svc().autoPopulateEntry('JOB-1', '2025-03-10');
            expect(entry.workersPresent).toHaveLength(1);
            expect(entry.workersPresent[0].name).toBe('Hans');
            expect(entry.workersPresent[0].hours).toBe(7);
        });

        it('populates photos from fieldAppService', () => {
            window.fieldAppService = {
                timeEntries: [],
                getPhotos: vi.fn(() => [
                    { id: 'p1', note: 'Dach', timestamp: '2025-03-10T10:00:00' },
                    { id: 'p2', description: 'Wand', timestamp: '2025-03-10T14:00:00' },
                ]),
                getMaterialLog: vi.fn(() => []),
            };
            const entry = svc().autoPopulateEntry('JOB-1', '2025-03-10');
            expect(entry.photos).toHaveLength(2);
            expect(entry.photos[0].id).toBe('p1');
            expect(entry.photos[0].note).toBe('Dach');
            expect(entry.photos[1].note).toBe('Wand');
        });

        it('populates materials from fieldAppService', () => {
            window.fieldAppService = {
                timeEntries: [],
                getPhotos: vi.fn(() => []),
                getMaterialLog: vi.fn(() => [
                    { name: 'Zement', quantity: 10, unit: 'kg', date: '2025-03-10' },
                ]),
            };
            const entry = svc().autoPopulateEntry('JOB-1', '2025-03-10');
            expect(entry.materialsUsed).toHaveLength(1);
            expect(entry.materialsUsed[0].name).toBe('Zement');
            expect(entry.materialsUsed[0].quantity).toBe(10);
            expect(entry.materialsUsed[0].unit).toBe('kg');
        });

        it('enriches workers with team data', () => {
            window.timeTrackingService = {
                entries: [
                    { auftragId: 'JOB-1', date: '2025-03-10', employeeId: 'emp1', durationHours: 8 },
                ],
            };
            window.teamManagementService = {
                getTeamMembers: vi.fn(() => [
                    { id: 'emp1', name: 'Max Mustermann', role: 'Polier' },
                ]),
            };
            const entry = svc().autoPopulateEntry('JOB-1', '2025-03-10');
            expect(entry.workersPresent[0].name).toBe('Max Mustermann');
            expect(entry.workersPresent[0].role).toBe('Polier');
        });
    });

    // ── fetchWeather ──

    describe('fetchWeather', () => {
        it('returns null if no API key configured', async () => {
            const result = await svc().fetchWeather(52.52, 13.405);
            expect(result).toBeNull();
        });

        it('fetches weather from API', async () => {
            svc().settings.openWeatherMapApiKey = 'test-key';
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    weather: [{ description: 'Klarer Himmel' }],
                    main: { temp: 18.7 },
                    wind: { speed: 5.5 },
                    rain: null,
                    snow: null,
                }),
            });
            const result = await svc().fetchWeather(52.52, 13.405);
            expect(result).not.toBeNull();
            expect(result.condition).toBe('Klarer Himmel');
            expect(result.temperature).toBe(19);
            expect(result.wind).toBe('Mäßig');
            expect(result.precipitation).toBe('Kein');
        });

        it('returns rain precipitation when rain is present', async () => {
            svc().settings.openWeatherMapApiKey = 'test-key';
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    weather: [{ description: 'Regen' }],
                    main: { temp: 10 },
                    wind: { speed: 1 },
                    rain: { '1h': 2.5 },
                    snow: null,
                }),
            });
            const result = await svc().fetchWeather(52.52, 13.405);
            expect(result.precipitation).toBe('Regen');
        });

        it('returns snow precipitation when snow is present', async () => {
            svc().settings.openWeatherMapApiKey = 'test-key';
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    weather: [{ description: 'Schnee' }],
                    main: { temp: -2 },
                    wind: { speed: 0.2 },
                    rain: null,
                    snow: { '1h': 1.0 },
                }),
            });
            const result = await svc().fetchWeather(52.52, 13.405);
            expect(result.precipitation).toBe('Schnee');
        });

        it('returns null on API error', async () => {
            svc().settings.openWeatherMapApiKey = 'test-key';
            fetch.mockResolvedValueOnce({ ok: false, status: 401 });
            const result = await svc().fetchWeather(52.52, 13.405);
            expect(result).toBeNull();
        });

        it('returns null on fetch exception', async () => {
            svc().settings.openWeatherMapApiKey = 'test-key';
            fetch.mockRejectedValueOnce(new Error('Network error'));
            const result = await svc().fetchWeather(52.52, 13.405);
            expect(result).toBeNull();
        });
    });

    // ── autoFillWeather ──

    describe('autoFillWeather', () => {
        it('returns null if no API key', async () => {
            const result = await svc().autoFillWeather('BTB-1');
            expect(result).toBeNull();
        });

        it('returns null if no geolocation support', async () => {
            svc().settings.openWeatherMapApiKey = 'test-key';
            navigator.geolocation = null;
            const result = await svc().autoFillWeather('BTB-1');
            expect(result).toBeNull();
        });

        it('fetches weather using geolocation and updates entry', async () => {
            const entry = svc().createEntry('JOB-1', '2025-03-10');
            svc().settings.openWeatherMapApiKey = 'test-key';

            navigator.geolocation = {
                getCurrentPosition: vi.fn((success) => {
                    success({ coords: { latitude: 52.52, longitude: 13.405 } });
                }),
            };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    weather: [{ description: 'Bewölkt' }],
                    main: { temp: 15 },
                    wind: { speed: 3 },
                    rain: null,
                    snow: null,
                }),
            });

            const result = await svc().autoFillWeather(entry.id);
            expect(result).not.toBeNull();
            expect(result.weather.condition).toBe('Bewölkt');
            expect(result.weather.temperature).toBe(15);
        });

        it('returns null if geolocation fails', async () => {
            const entry = svc().createEntry('JOB-1', '2025-03-10');
            svc().settings.openWeatherMapApiKey = 'test-key';

            navigator.geolocation = {
                getCurrentPosition: vi.fn((_, error) => {
                    error(new Error('Permission denied'));
                }),
            };

            const result = await svc().autoFillWeather(entry.id);
            expect(result).toBeNull();
        });
    });

    // ── Settings ──

    describe('settings', () => {
        it('setWeatherApiKey stores the key', () => {
            svc().setWeatherApiKey('my-api-key');
            expect(svc().settings.openWeatherMapApiKey).toBe('my-api-key');
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai_bautagebuch_settings',
                expect.any(String)
            );
        });

        it('setWeatherApiKey with empty string clears key', () => {
            svc().setWeatherApiKey('something');
            svc().setWeatherApiKey('');
            expect(svc().settings.openWeatherMapApiKey).toBe('');
        });

        it('getSettings returns a copy', () => {
            svc().settings.openWeatherMapApiKey = 'key';
            const copy = svc().getSettings();
            expect(copy.openWeatherMapApiKey).toBe('key');
            copy.openWeatherMapApiKey = 'modified';
            expect(svc().settings.openWeatherMapApiKey).toBe('key');
        });

        it('updateSettings merges and saves', () => {
            svc().updateSettings({ customSetting: 'abc', openWeatherMapApiKey: 'k' });
            expect(svc().settings.customSetting).toBe('abc');
            expect(svc().settings.openWeatherMapApiKey).toBe('k');
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'freyai_bautagebuch_settings',
                expect.any(String)
            );
        });
    });

    // ── getJobSummary ──

    describe('getJobSummary', () => {
        it('returns null for job with no entries', () => {
            expect(svc().getJobSummary('NONE')).toBeNull();
        });

        it('summarizes a job with multiple entries', () => {
            svc().createEntry('JOB-1', '2025-03-10', {
                workersPresent: [
                    { name: 'Max', role: 'Maurer', hours: 8 },
                    { name: 'Anna', role: 'Helferin', hours: 6 },
                ],
                materialsUsed: [
                    { name: 'Zement', quantity: 50, unit: 'kg' },
                ],
                incidents: 'Wasserschaden',
            });
            svc().createEntry('JOB-1', '2025-03-11', {
                workersPresent: [
                    { name: 'Max', role: 'Maurer', hours: 7 },
                ],
                materialsUsed: [
                    { name: 'Zement', quantity: 30, unit: 'kg' },
                    { name: 'Ziegel', quantity: 100, unit: 'Stk' },
                ],
                delays: 'Lieferverzögerung',
            });

            // Confirm first entry
            const firstEntry = svc().getEntriesForJob('JOB-1')[0];
            svc().confirmEntry(firstEntry.id, 'data:image/png;base64,sig');

            const summary = svc().getJobSummary('JOB-1');
            expect(summary).not.toBeNull();
            expect(summary.totalDays).toBe(2);
            expect(summary.dateRange.from).toBe('2025-03-10');
            expect(summary.dateRange.to).toBe('2025-03-11');
            expect(summary.totalWorkerHours).toBe(21);
            expect(summary.totalWorkerDays).toBe(3); // 2 + 1 workers across days
            expect(summary.incidentCount).toBe(1);
            expect(summary.delayCount).toBe(1);
            expect(summary.confirmedCount).toBe(1);
            expect(summary.confirmationRate).toBe(50);

            // Materials aggregated
            const cement = summary.materials.find(m => m.name === 'Zement');
            expect(cement.quantity).toBe(80);
            expect(cement.unit).toBe('kg');
            const bricks = summary.materials.find(m => m.name === 'Ziegel');
            expect(bricks.quantity).toBe(100);
        });

        it('returns 0 confirmation rate when no entries confirmed', () => {
            svc().createEntry('JOB-1', '2025-03-10');
            const summary = svc().getJobSummary('JOB-1');
            expect(summary.confirmedCount).toBe(0);
            expect(summary.confirmationRate).toBe(0);
        });
    });

    // ── generatePDF ──

    describe('generatePDF', () => {
        it('returns null when no entries exist for job', async () => {
            window.pdfMake = { createPdf: vi.fn() };
            const result = await svc().generatePDF('NONE');
            expect(result).toBeNull();
        });

        it('calls pdfMake.createPdf and download', async () => {
            svc().createEntry('JOB-1', '2025-03-10', {
                workDescription: 'Test work',
            });

            const mockDownload = vi.fn();
            const mockGetBlob = vi.fn();
            window.pdfMake = {
                createPdf: vi.fn(() => ({
                    download: mockDownload,
                    getBlob: mockGetBlob,
                })),
            };

            await svc().generatePDF('JOB-1');
            expect(window.pdfMake.createPdf).toHaveBeenCalled();
            expect(mockDownload).toHaveBeenCalled();
        });

        it('returns blob when returnBlob option is set', async () => {
            svc().createEntry('JOB-1', '2025-03-10');

            const fakeBlob = new Uint8Array([1, 2, 3]);
            window.pdfMake = {
                createPdf: vi.fn(() => ({
                    download: vi.fn(),
                    getBlob: vi.fn((cb) => cb(fakeBlob)),
                })),
            };

            const result = await svc().generatePDF('JOB-1', { returnBlob: true });
            expect(result).toBe(fakeBlob);
        });

        it('uses pdfGenerationService.loadPdfMake when available', async () => {
            svc().createEntry('JOB-1', '2025-03-10');

            window.pdfGenerationService = {
                loadPdfMake: vi.fn(async () => {
                    window.pdfMake = {
                        createPdf: vi.fn(() => ({ download: vi.fn() })),
                    };
                }),
            };

            await svc().generatePDF('JOB-1');
            expect(window.pdfGenerationService.loadPdfMake).toHaveBeenCalled();
        });

        it('uses custom filename when provided', async () => {
            svc().createEntry('JOB-1', '2025-03-10');

            const mockDownload = vi.fn();
            window.pdfMake = {
                createPdf: vi.fn(() => ({
                    download: mockDownload,
                    getBlob: vi.fn(),
                })),
            };

            await svc().generatePDF('JOB-1', { filename: 'Custom Report.pdf' });
            expect(mockDownload).toHaveBeenCalledWith('Custom_Report.pdf');
        });
    });

    // ── _getJobInfo ──

    describe('_getJobInfo', () => {
        it('returns default info when storeService unavailable', () => {
            const info = svc()._getJobInfo('JOB-1');
            expect(info).toEqual({ id: 'JOB-1', title: '', customer: '', address: '' });
        });

        it('returns job info from storeService', () => {
            window.storeService = {
                store: {
                    auftraege: [
                        { id: 'JOB-1', title: 'Dachsanierung', customerName: 'Herr Müller', address: 'Berliner Str. 5' },
                    ],
                },
            };
            const info = svc()._getJobInfo('JOB-1');
            expect(info.title).toBe('Dachsanierung');
            expect(info.customer).toBe('Herr Müller');
            expect(info.address).toBe('Berliner Str. 5');
        });

        it('enriches with customer data when customerId present', () => {
            window.storeService = {
                store: {
                    auftraege: [
                        { id: 'JOB-1', title: 'Bau', customerId: 'C1' },
                    ],
                    customers: [
                        { id: 'C1', name: 'Firma Schmidt', address: 'Hauptstr. 1' },
                    ],
                },
            };
            const info = svc()._getJobInfo('JOB-1');
            expect(info.customer).toBe('Firma Schmidt');
            expect(info.address).toBe('Hauptstr. 1');
        });

        it('returns defaults for unknown job', () => {
            window.storeService = { store: { auftraege: [] } };
            const info = svc()._getJobInfo('UNKNOWN');
            expect(info).toEqual({ id: 'UNKNOWN', title: '', customer: '', address: '' });
        });
    });

    // ── _getCompanyInfo ──

    describe('_getCompanyInfo', () => {
        it('falls back to localStorage company_name', () => {
            mockStorage['company_name'] = 'Test GmbH';
            const info = svc()._getCompanyInfo();
            expect(info.name).toBe('Test GmbH');
            expect(info.address).toBe('');
        });

        it('uses companySettingsService when available', () => {
            window.companySettingsService = {
                getAll: vi.fn(() => ({
                    company_name: 'Bau AG',
                    street: 'Industriestr. 10',
                    zip: '10115',
                    city: 'Berlin',
                })),
            };
            const info = svc()._getCompanyInfo();
            expect(info.name).toBe('Bau AG');
            expect(info.address).toBe('Industriestr. 10, 10115 Berlin');
        });

        it('uses _cache fallback when getAll is not a function', () => {
            window.companySettingsService = {
                _cache: { company_name: 'Cached Corp', street: 'Musterweg 3' },
            };
            const info = svc()._getCompanyInfo();
            expect(info.name).toBe('Cached Corp');
            expect(info.address).toContain('Musterweg 3');
        });
    });

    // ── _mapWindSpeed ──

    describe('_mapWindSpeed', () => {
        it('returns Windstill for very low speed', () => {
            expect(svc()._mapWindSpeed(0)).toBe('Windstill');
            expect(svc()._mapWindSpeed(0.4)).toBe('Windstill');
        });

        it('returns Leicht for low speed', () => {
            expect(svc()._mapWindSpeed(0.5)).toBe('Leicht');
            expect(svc()._mapWindSpeed(3.3)).toBe('Leicht');
        });

        it('returns Mäßig for moderate speed', () => {
            expect(svc()._mapWindSpeed(3.4)).toBe('Mäßig');
            expect(svc()._mapWindSpeed(7.9)).toBe('Mäßig');
        });

        it('returns Frisch for fresh speed', () => {
            expect(svc()._mapWindSpeed(8.0)).toBe('Frisch');
            expect(svc()._mapWindSpeed(13.8)).toBe('Frisch');
        });

        it('returns Stark for strong speed', () => {
            expect(svc()._mapWindSpeed(13.9)).toBe('Stark');
            expect(svc()._mapWindSpeed(20.7)).toBe('Stark');
        });

        it('returns Sturm for storm speed', () => {
            expect(svc()._mapWindSpeed(20.8)).toBe('Sturm');
            expect(svc()._mapWindSpeed(50)).toBe('Sturm');
        });
    });

    // ── _formatDate ──

    describe('_formatDate', () => {
        it('formats YYYY-MM-DD to DD.MM.YYYY', () => {
            expect(svc()._formatDate('2025-03-10')).toBe('10.03.2025');
        });

        it('returns - for empty input', () => {
            expect(svc()._formatDate('')).toBe('-');
            expect(svc()._formatDate(null)).toBe('-');
            expect(svc()._formatDate(undefined)).toBe('-');
        });

        it('returns original string if not 3-part date', () => {
            expect(svc()._formatDate('invalid')).toBe('invalid');
        });
    });

    // ── _formatDateTime ──

    describe('_formatDateTime', () => {
        it('formats ISO string to DD.MM.YYYY HH:MM', () => {
            const result = svc()._formatDateTime('2025-03-10T14:30:00.000Z');
            expect(result).toMatch(/10\.03\.2025/);
            // Time depends on timezone but format should be HH:MM
            expect(result).toMatch(/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/);
        });

        it('returns - for empty input', () => {
            expect(svc()._formatDateTime('')).toBe('-');
            expect(svc()._formatDateTime(null)).toBe('-');
            expect(svc()._formatDateTime(undefined)).toBe('-');
        });
    });

    // ── _getDayName ──

    describe('_getDayName', () => {
        it('returns German day name', () => {
            // 2025-03-10 is a Monday
            expect(svc()._getDayName('2025-03-10')).toBe('Montag');
            // 2025-03-09 is a Sunday
            expect(svc()._getDayName('2025-03-09')).toBe('Sonntag');
        });

        it('returns empty string for empty input', () => {
            expect(svc()._getDayName('')).toBe('');
            expect(svc()._getDayName(null)).toBe('');
            expect(svc()._getDayName(undefined)).toBe('');
        });
    });

    // ── _generateId ──

    describe('_generateId', () => {
        it('generates ID with prefix', () => {
            const id = svc()._generateId('BTB');
            expect(id).toMatch(/^BTB-/);
            expect(id).toBe(id.toUpperCase());
        });

        it('uses storeService.generateId when available', () => {
            window.storeService = { generateId: vi.fn(() => 'BTB-STORE-123') };
            const id = svc()._generateId('BTB');
            expect(id).toBe('BTB-STORE-123');
        });
    });

    // ── _save error handling ──

    describe('_save error handling', () => {
        it('handles QuotaExceededError gracefully', () => {
            const quotaError = new Error('quota');
            quotaError.name = 'QuotaExceededError';
            localStorage.setItem.mockImplementationOnce(() => { throw quotaError; });

            // Should not throw
            expect(() => svc().createEntry('JOB-1', '2025-03-10')).not.toThrow();
            expect(window.showToast).toHaveBeenCalledWith(
                'Speicher voll — bitte Daten exportieren',
                'warning'
            );
        });

        it('handles QuotaExceededError with code 22', () => {
            const quotaError = new Error('quota');
            quotaError.code = 22;
            localStorage.setItem.mockImplementationOnce(() => { throw quotaError; });

            expect(() => svc().createEntry('JOB-1', '2025-03-10')).not.toThrow();
            expect(window.showToast).toHaveBeenCalled();
        });

        it('handles generic storage errors', () => {
            localStorage.setItem.mockImplementationOnce(() => { throw new Error('disk error'); });
            expect(() => svc().createEntry('JOB-1', '2025-03-10')).not.toThrow();
        });
    });

    // ── _saveSettings error handling ──

    describe('_saveSettings error handling', () => {
        it('handles QuotaExceededError on settings save', () => {
            const quotaError = new Error('quota');
            quotaError.name = 'QuotaExceededError';
            localStorage.setItem.mockImplementationOnce(() => { throw quotaError; });

            expect(() => svc().setWeatherApiKey('key')).not.toThrow();
            expect(window.showToast).toHaveBeenCalled();
        });

        it('handles generic error on settings save', () => {
            localStorage.setItem.mockImplementationOnce(() => { throw new Error('fail'); });
            expect(() => svc().setWeatherApiKey('key')).not.toThrow();
        });

        it('does not call showToast if not available', () => {
            window.showToast = null;
            const quotaError = new Error('quota');
            quotaError.name = 'QuotaExceededError';
            localStorage.setItem.mockImplementationOnce(() => { throw quotaError; });

            expect(() => svc().createEntry('JOB-1', '2025-03-10')).not.toThrow();
        });
    });

    // ── _getWorkersFromTimeTracking ──

    describe('_getWorkersFromTimeTracking', () => {
        it('groups hours by employee', () => {
            window.timeTrackingService = {
                entries: [
                    { auftragId: 'JOB-1', date: '2025-03-10', employeeId: 'emp1', durationHours: 4 },
                    { auftragId: 'JOB-1', date: '2025-03-10', employeeId: 'emp1', durationHours: 4 },
                    { auftragId: 'JOB-1', date: '2025-03-10', employeeId: 'emp2', durationHours: 6 },
                ],
            };
            const workers = svc()._getWorkersFromTimeTracking('JOB-1', '2025-03-10');
            expect(workers).toHaveLength(2);
            const emp1 = workers.find(w => w.name === 'emp1');
            expect(emp1.hours).toBe(8);
        });

        it('matches by projectId as well', () => {
            window.timeTrackingService = {
                entries: [
                    { projectId: 'JOB-1', date: '2025-03-10', employeeId: 'emp1', durationHours: 5 },
                ],
            };
            const workers = svc()._getWorkersFromTimeTracking('JOB-1', '2025-03-10');
            expect(workers).toHaveLength(1);
        });

        it('uses default employee id when none provided', () => {
            window.timeTrackingService = {
                entries: [
                    { auftragId: 'JOB-1', date: '2025-03-10', durationHours: 3 },
                ],
            };
            const workers = svc()._getWorkersFromTimeTracking('JOB-1', '2025-03-10');
            expect(workers).toHaveLength(1);
            expect(workers[0].name).toBe('default');
        });

        it('returns empty when service unavailable', () => {
            window.timeTrackingService = null;
            expect(svc()._getWorkersFromTimeTracking('JOB-1', '2025-03-10')).toEqual([]);
        });
    });

    // ── _getWorkersFromFieldApp ──

    describe('_getWorkersFromFieldApp', () => {
        it('extracts workers from field app time entries', () => {
            window.fieldAppService = {
                timeEntries: [
                    { jobId: 'JOB-1', date: '2025-03-10', employeeName: 'Karl', hours: 8 },
                ],
            };
            const workers = svc()._getWorkersFromFieldApp('JOB-1', '2025-03-10');
            expect(workers).toHaveLength(1);
            expect(workers[0].name).toBe('Karl');
            expect(workers[0].hours).toBe(8);
        });

        it('uses employeeId when employeeName missing', () => {
            window.fieldAppService = {
                timeEntries: [
                    { jobId: 'JOB-1', date: '2025-03-10', employeeId: 'E1', durationHours: 5 },
                ],
            };
            const workers = svc()._getWorkersFromFieldApp('JOB-1', '2025-03-10');
            expect(workers[0].name).toBe('E1');
            expect(workers[0].hours).toBe(5);
        });

        it('uses Unbekannt when no name info', () => {
            window.fieldAppService = {
                timeEntries: [
                    { jobId: 'JOB-1', date: '2025-03-10', durationHours: 3 },
                ],
            };
            const workers = svc()._getWorkersFromFieldApp('JOB-1', '2025-03-10');
            expect(workers[0].name).toBe('Unbekannt');
        });

        it('returns empty when service unavailable', () => {
            window.fieldAppService = null;
            expect(svc()._getWorkersFromFieldApp('JOB-1', '2025-03-10')).toEqual([]);
        });
    });

    // ── _getPhotosFromFieldApp ──

    describe('_getPhotosFromFieldApp', () => {
        it('returns empty when service unavailable', () => {
            expect(svc()._getPhotosFromFieldApp('JOB-1', '2025-03-10')).toEqual([]);
        });

        it('returns empty when getPhotos is not a function', () => {
            window.fieldAppService = { timeEntries: [] };
            expect(svc()._getPhotosFromFieldApp('JOB-1', '2025-03-10')).toEqual([]);
        });

        it('filters photos by date', () => {
            window.fieldAppService = {
                getPhotos: vi.fn(() => [
                    { id: 'p1', note: 'A', timestamp: '2025-03-10T10:00:00' },
                    { id: 'p2', note: 'B', timestamp: '2025-03-11T10:00:00' },
                ]),
            };
            const photos = svc()._getPhotosFromFieldApp('JOB-1', '2025-03-10');
            expect(photos).toHaveLength(1);
            expect(photos[0].id).toBe('p1');
        });

        it('returns all photos when no date specified', () => {
            window.fieldAppService = {
                getPhotos: vi.fn(() => [
                    { id: 'p1', timestamp: '2025-03-10T10:00:00' },
                    { id: 'p2', timestamp: '2025-03-11T10:00:00' },
                ]),
            };
            const photos = svc()._getPhotosFromFieldApp('JOB-1', null);
            expect(photos).toHaveLength(2);
        });
    });

    // ── _getMaterialsFromFieldApp ──

    describe('_getMaterialsFromFieldApp', () => {
        it('returns empty when service unavailable', () => {
            expect(svc()._getMaterialsFromFieldApp('JOB-1', '2025-03-10')).toEqual([]);
        });

        it('extracts and maps material data', () => {
            window.fieldAppService = {
                getMaterialLog: vi.fn(() => [
                    { name: 'Zement', quantity: 50, unit: 'kg', date: '2025-03-10' },
                ]),
            };
            const mats = svc()._getMaterialsFromFieldApp('JOB-1', '2025-03-10');
            expect(mats).toHaveLength(1);
            expect(mats[0]).toEqual({ name: 'Zement', quantity: 50, unit: 'kg' });
        });

        it('uses fallback field names', () => {
            window.fieldAppService = {
                getMaterialLog: vi.fn(() => [
                    { material: 'Sand', amount: 100, date: '2025-03-10' },
                ]),
            };
            const mats = svc()._getMaterialsFromFieldApp('JOB-1', '2025-03-10');
            expect(mats[0].name).toBe('Sand');
            expect(mats[0].quantity).toBe(100);
            expect(mats[0].unit).toBe('Stk');
        });

        it('filters by date', () => {
            window.fieldAppService = {
                getMaterialLog: vi.fn(() => [
                    { name: 'A', quantity: 1, unit: 'kg', date: '2025-03-10' },
                    { name: 'B', quantity: 2, unit: 'kg', date: '2025-03-11' },
                ]),
            };
            const mats = svc()._getMaterialsFromFieldApp('JOB-1', '2025-03-10');
            expect(mats).toHaveLength(1);
            expect(mats[0].name).toBe('A');
        });
    });

    // ── _enrichWithTeamData ──

    describe('_enrichWithTeamData', () => {
        it('returns workers unchanged when no team service', () => {
            const workers = [{ name: 'emp1', role: '', hours: 8 }];
            expect(svc()._enrichWithTeamData(workers)).toEqual(workers);
        });

        it('enriches worker name and role from team members', () => {
            window.teamManagementService = {
                getTeamMembers: vi.fn(() => [
                    { id: 'emp1', name: 'Max Mustermann', role: 'Polier' },
                ]),
            };
            const workers = [{ name: 'emp1', role: '', hours: 8 }];
            const enriched = svc()._enrichWithTeamData(workers);
            expect(enriched[0].name).toBe('Max Mustermann');
            expect(enriched[0].role).toBe('Polier');
            expect(enriched[0].hours).toBe(8);
        });

        it('matches by name field as well', () => {
            window.teamManagementService = {
                getTeamMembers: vi.fn(() => [
                    { id: 'X', name: 'Karl', role: 'Meister', email: 'karl@test.de' },
                ]),
            };
            const workers = [{ name: 'Karl', role: '', hours: 5 }];
            const enriched = svc()._enrichWithTeamData(workers);
            expect(enriched[0].role).toBe('Meister');
        });

        it('matches by email field', () => {
            window.teamManagementService = {
                getTeamMembers: vi.fn(() => [
                    { id: 'X', name: 'Hans', role: 'Geselle', email: 'hans@bau.de' },
                ]),
            };
            const workers = [{ name: 'hans@bau.de', role: '', hours: 4 }];
            const enriched = svc()._enrichWithTeamData(workers);
            expect(enriched[0].name).toBe('Hans');
            expect(enriched[0].role).toBe('Geselle');
        });

        it('leaves unmatched workers unchanged', () => {
            window.teamManagementService = {
                getTeamMembers: vi.fn(() => [
                    { id: 'other', name: 'Other', role: 'Chef' },
                ]),
            };
            const workers = [{ name: 'unknown', role: 'helper', hours: 3 }];
            const enriched = svc()._enrichWithTeamData(workers);
            expect(enriched[0].name).toBe('unknown');
            expect(enriched[0].role).toBe('helper');
        });

        it('returns workers unchanged when getTeamMembers returns empty', () => {
            window.teamManagementService = {
                getTeamMembers: vi.fn(() => []),
            };
            const workers = [{ name: 'emp1', role: '', hours: 8 }];
            expect(svc()._enrichWithTeamData(workers)).toEqual(workers);
        });
    });

    // ── _ensurePdfMake ──

    describe('_ensurePdfMake', () => {
        it('does nothing if pdfMake already loaded', async () => {
            window.pdfMake = { createPdf: vi.fn() };
            await svc()._ensurePdfMake();
            expect(window.pdfMake.createPdf).toBeDefined();
        });

        it('loads via pdfGenerationService if available', async () => {
            window.pdfGenerationService = {
                loadPdfMake: vi.fn(async () => {
                    window.pdfMake = { createPdf: vi.fn() };
                }),
            };
            await svc()._ensurePdfMake();
            expect(window.pdfGenerationService.loadPdfMake).toHaveBeenCalled();
            expect(window.pdfMake).not.toBeNull();
        });
    });

    // ── PDF document building (integration) ──

    describe('_buildPdfDocument', () => {
        it('returns a valid pdfmake document definition', () => {
            const entries = [
                {
                    id: 'BTB-1', jobId: 'JOB-1', date: '2025-03-10',
                    weather: { condition: 'Sonnig', temperature: 20, wind: 'Leicht', precipitation: 'Kein' },
                    workersPresent: [{ name: 'Max', role: 'Maurer', hours: 8 }],
                    workDescription: 'Mauern',
                    materialsUsed: [{ name: 'Ziegel', quantity: 100, unit: 'Stk' }],
                    photos: [{ id: 'p1', note: 'Foto 1' }],
                    incidents: 'Test incident',
                    delays: 'Test delay',
                    notes: 'Test note',
                    bauleiterSignature: null,
                    confirmedAt: null,
                },
            ];
            const jobInfo = { id: 'JOB-1', title: 'Testauftrag', customer: 'Kunde', address: 'Str. 1' };
            const companyInfo = { name: 'Test GmbH', address: 'Musterstr. 1' };

            const doc = svc()._buildPdfDocument(entries, jobInfo, companyInfo, {});
            expect(doc.pageSize).toBe('A4');
            expect(doc.pageOrientation).toBe('portrait');
            expect(doc.defaultStyle.font).toBe('Roboto');
            expect(doc.styles).toBeDefined();
            expect(doc.styles.header).toBeDefined();
            expect(doc.styles.dayHeader).toBeDefined();
            expect(typeof doc.footer).toBe('function');
        });
    });

    // ── Edge cases ──

    describe('edge cases', () => {
        it('multiple entries for different jobs are independent', () => {
            svc().createEntry('JOB-A', '2025-03-10', { notes: 'A' });
            svc().createEntry('JOB-B', '2025-03-10', { notes: 'B' });
            expect(svc().getEntriesForJob('JOB-A')).toHaveLength(1);
            expect(svc().getEntriesForJob('JOB-B')).toHaveLength(1);
            expect(svc().getEntriesForJob('JOB-A')[0].notes).toBe('A');
        });

        it('deleting non-existent entry does not affect others', () => {
            svc().createEntry('JOB-1', '2025-03-10');
            svc().deleteEntry('BTB-NOPE');
            expect(svc().entries).toHaveLength(1);
        });

        it('confirmEntry updates existing entry in place', () => {
            const entry = svc().createEntry('JOB-1', '2025-03-10', { notes: 'keep' });
            svc().confirmEntry(entry.id, 'sig-data');
            const updated = svc().getEntryById(entry.id);
            expect(updated.notes).toBe('keep');
            expect(updated.bauleiterSignature).toBe('sig-data');
        });
    });
});
