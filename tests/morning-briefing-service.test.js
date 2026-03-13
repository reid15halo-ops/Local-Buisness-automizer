import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

const mockStorage = {};
globalThis.localStorage = {
    getItem: vi.fn(k => mockStorage[k] || null),
    setItem: vi.fn((k, v) => { mockStorage[k] = v; }),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => {
        const raw = mockStorage[key];
        return raw ? JSON.parse(raw) : fallback;
    }),
};

globalThis.window = globalThis;
globalThis.document = {
    dispatchEvent: vi.fn(),
    createElement: vi.fn(() => ({ textContent: '', innerHTML: '' })),
};
globalThis.CustomEvent = class CustomEvent {
    constructor(type, opts) { this.type = type; this.detail = opts?.detail; }
};

window.storeService = null;
window.calendarService = null;
window.bookkeepingService = null;
window.cashFlowService = null;
window.cashflowService = null;
window.teamManagementService = null;
window.fieldAppService = null;
window.geminiService = null;
window.voiceCommandService = null;
window.speechSynthesis = null;
window.esc = (s) => String(s || '');

// Suppress setTimeout auto-generate
vi.useFakeTimers();

await import('../js/services/morning-briefing-service.js');

const svc = () => window.morningBriefingService;

// ============================================
// Tests
// ============================================

describe('MorningBriefingService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        vi.clearAllTimers();
        window.morningBriefingService = new window.morningBriefingService.constructor();
        window.storeService = null;
        window.calendarService = null;
        window.bookkeepingService = null;
        window.cashFlowService = null;
        window.teamManagementService = null;
        window.fieldAppService = null;
        window.geminiService = null;
    });

    // ── Data Gathering ──

    describe('_getOverdueInvoices', () => {
        it('returns empty when no storeService', () => {
            const result = svc()._getOverdueInvoices();
            expect(result.count).toBe(0);
            expect(result.total).toBe(0);
        });

        it('finds overdue invoices', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 5);
            window.storeService = {
                store: {
                    rechnungen: [
                        { id: 'r1', status: 'offen', faelligkeitsdatum: yesterday.toISOString().split('T')[0], brutto: 1190 },
                        { id: 'r2', status: 'bezahlt', faelligkeitsdatum: yesterday.toISOString().split('T')[0], brutto: 500 },
                        { id: 'r3', status: 'offen', faelligkeitsdatum: '2099-12-31', brutto: 200 },
                    ]
                }
            };
            const result = svc()._getOverdueInvoices();
            expect(result.count).toBe(1);
            expect(result.total).toBe(1190);
        });
    });

    describe('_getNewInquiries', () => {
        it('returns empty when no data', () => {
            const result = svc()._getNewInquiries();
            expect(result.count).toBe(0);
        });

        it('finds new anfragen', () => {
            window.storeService = {
                store: {
                    anfragen: [
                        { id: 'a1', status: 'neu', kunde_name: 'Meier' },
                        { id: 'a2', status: 'bearbeitet', kunde_name: 'Schmidt' },
                        { id: 'a3', status: 'neu', kundeName: 'Müller' },
                    ]
                }
            };
            const result = svc()._getNewInquiries();
            expect(result.count).toBe(2);
        });
    });

    describe('_getActiveOrders', () => {
        it('counts active orders', () => {
            window.storeService = {
                store: {
                    auftraege: [
                        { status: 'aktiv' },
                        { status: 'in_bearbeitung' },
                        { status: 'abgeschlossen' },
                    ]
                }
            };
            const result = svc()._getActiveOrders();
            expect(result.count).toBe(2);
        });
    });

    describe('_getPendingQuotes', () => {
        it('counts pending quotes and expiring', () => {
            const soonDate = new Date();
            soonDate.setDate(soonDate.getDate() + 2);
            window.storeService = {
                store: {
                    angebote: [
                        { status: 'offen', gueltigBis: soonDate.toISOString().split('T')[0] },
                        { status: 'versendet' },
                        { status: 'angenommen' },
                    ]
                }
            };
            const result = svc()._getPendingQuotes();
            expect(result.count).toBe(2);
            expect(result.expiringCount).toBe(1);
        });
    });

    describe('_getTodaysAppointments', () => {
        it('returns empty without calendarService', () => {
            const result = svc()._getTodaysAppointments();
            expect(result.count).toBe(0);
        });

        it('gets appointments from calendar', () => {
            window.calendarService = {
                getAppointmentsForDay: vi.fn(() => [
                    { title: 'Meeting', startTime: '09:00', location: 'Büro' },
                    { title: 'Besuch', startTime: '14:00' },
                ])
            };
            const result = svc()._getTodaysAppointments();
            expect(result.count).toBe(2);
            expect(result.items[0].title).toBe('Meeting');
        });
    });

    describe('_getCashflowStatus', () => {
        it('returns unknown without service', () => {
            expect(svc()._getCashflowStatus()).toBe('unknown');
        });

        it('returns healthy when balance high', () => {
            window.cashFlowService = {
                getCurrentSnapshot: () => ({ currentBalance: 20000 }),
                settings: { safetyBuffer: 5000 }
            };
            expect(svc()._getCashflowStatus()).toBe('healthy');
        });

        it('returns warning when balance moderate', () => {
            window.cashFlowService = {
                getCurrentSnapshot: () => ({ currentBalance: 6000 }),
                settings: { safetyBuffer: 5000 }
            };
            expect(svc()._getCashflowStatus()).toBe('warning');
        });

        it('returns critical when balance low', () => {
            window.cashFlowService = {
                getCurrentSnapshot: () => ({ currentBalance: 2000 }),
                settings: { safetyBuffer: 5000 }
            };
            expect(svc()._getCashflowStatus()).toBe('critical');
        });
    });

    // ── Alerts ──

    describe('_generateAlerts', () => {
        it('generates overdue invoice alert', () => {
            const alerts = svc()._generateAlerts({
                overdueInvoices: { count: 3, total: 5000 },
                pendingQuotes: { expiringCount: 0 },
                cashflowStatus: 'healthy',
                offlineQueuePending: 0,
            });
            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('warning');
            expect(alerts[0].text).toContain('3');
        });

        it('generates critical cashflow alert', () => {
            const alerts = svc()._generateAlerts({
                overdueInvoices: { count: 0, total: 0 },
                pendingQuotes: { expiringCount: 0 },
                cashflowStatus: 'critical',
                offlineQueuePending: 0,
            });
            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('danger');
        });

        it('generates offline queue alert', () => {
            const alerts = svc()._generateAlerts({
                overdueInvoices: { count: 0, total: 0 },
                pendingQuotes: { expiringCount: 0 },
                cashflowStatus: 'healthy',
                offlineQueuePending: 5,
            });
            expect(alerts).toHaveLength(1);
            expect(alerts[0].type).toBe('info');
        });
    });

    // ── Recommendations ──

    describe('_generateRecommendations', () => {
        it('recommends processing new inquiries', () => {
            const recs = svc()._generateRecommendations({
                newInquiries: { count: 3 },
                overdueInvoices: { count: 0 },
                pendingQuotes: { count: 0 },
                todaysAppointments: { count: 1 },
                cashflowStatus: 'healthy',
            });
            expect(recs.some(r => r.includes('Anfrage'))).toBe(true);
        });

        it('recommends Mahnlauf for many overdue', () => {
            const recs = svc()._generateRecommendations({
                newInquiries: { count: 0 },
                overdueInvoices: { count: 5 },
                pendingQuotes: { count: 0 },
                todaysAppointments: { count: 1 },
                cashflowStatus: 'healthy',
            });
            expect(recs.some(r => r.includes('Mahnlauf'))).toBe(true);
        });

        it('recommends using free time when no appointments', () => {
            const recs = svc()._generateRecommendations({
                newInquiries: { count: 0 },
                overdueInvoices: { count: 0 },
                pendingQuotes: { count: 0 },
                todaysAppointments: { count: 0 },
                cashflowStatus: 'healthy',
            });
            expect(recs.some(r => r.includes('Keine Termine'))).toBe(true);
        });
    });

    // ── Greeting ──

    describe('_getGreeting', () => {
        it('returns greeting with name', () => {
            window.storeService = { store: { settings: { owner: 'Hans' } } };
            const greeting = svc()._getGreeting();
            expect(greeting).toContain('Hans');
            expect(greeting).toContain('Guten');
        });

        it('falls back to Chef when no owner set', () => {
            const greeting = svc()._getGreeting();
            expect(greeting).toContain('Chef');
        });
    });

    // ── Generate Briefing ──

    describe('generateBriefing', () => {
        it('generates full briefing', async () => {
            const briefing = await svc().generateBriefing();
            expect(briefing.date).toBeTruthy();
            expect(briefing.greeting).toContain('Guten');
            expect(briefing.summary).toBeTruthy();
            expect(briefing.summary.overdueInvoices).toBeTruthy();
            expect(briefing.alerts).toBeDefined();
            expect(briefing.recommendations).toBeDefined();
            expect(briefing.generatedAt).toBeTruthy();
        });

        it('caches briefing', async () => {
            await svc().generateBriefing();
            expect(svc().cachedBriefing).toBeTruthy();
            expect(mockStorage['freyai_morning_briefing']).toBeTruthy();
        });

        it('dispatches event', async () => {
            await svc().generateBriefing();
            expect(document.dispatchEvent).toHaveBeenCalled();
        });
    });

    // ── Cached Access ──

    describe('getCachedBriefing', () => {
        it('returns null when no briefing', () => {
            expect(svc().getCachedBriefing()).toBeNull();
        });

        it('returns briefing after generation', async () => {
            await svc().generateBriefing();
            expect(svc().getCachedBriefing()).toBeTruthy();
        });
    });

    describe('isTodaysBriefing', () => {
        it('returns false when no briefing', () => {
            expect(svc().isTodaysBriefing()).toBe(false);
        });

        it('returns true for today briefing', async () => {
            await svc().generateBriefing();
            expect(svc().isTodaysBriefing()).toBe(true);
        });
    });

    // ── HTML Rendering ──

    describe('renderBriefingHTML', () => {
        it('returns no-briefing message when empty', () => {
            const html = svc().renderBriefingHTML();
            expect(html).toContain('Kein Briefing');
        });

        it('renders briefing HTML after generation', async () => {
            await svc().generateBriefing();
            const html = svc().renderBriefingHTML();
            expect(html).toContain('briefing-header');
            expect(html).toContain('briefing-grid');
        });
    });

    // ── Speak ──

    describe('speakBriefing', () => {
        it('does nothing without cached briefing', () => {
            svc().speakBriefing();
            // no error thrown
        });

        it('uses voiceCommandService if available', async () => {
            await svc().generateBriefing();
            window.voiceCommandService = { speak: vi.fn() };
            svc().speakBriefing();
            expect(window.voiceCommandService.speak).toHaveBeenCalled();
            window.voiceCommandService = null;
        });
    });
});
