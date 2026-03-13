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

globalThis.window = globalThis;
window.storeService = null;
window.supabaseDBService = null;
window.leadService = null;
window.dunningService = null;

await import('../js/services/customer-timeline-service.js');

const svc = () => window.customerTimelineService;

// ============================================
// Tests
// ============================================

describe('CustomerTimelineService', () => {
    beforeEach(() => {
        window.customerTimelineService = new window.customerTimelineService.constructor();
        window.storeService = null;
        window.supabaseDBService = null;
        window.leadService = null;
        window.dunningService = null;
    });

    // ── Status Mapping ──

    describe('_mapLeadStatus', () => {
        it('returns offen for null', () => {
            expect(svc()._mapLeadStatus(null)).toBe('offen');
        });

        it('returns abgeschlossen for gewonnen', () => {
            expect(svc()._mapLeadStatus('gewonnen')).toBe('abgeschlossen');
        });

        it('returns abgeschlossen for verloren', () => {
            expect(svc()._mapLeadStatus('verloren')).toBe('abgeschlossen');
        });

        it('returns offen for other stages', () => {
            expect(svc()._mapLeadStatus('kontakt')).toBe('offen');
        });
    });

    describe('_mapAngebotStatus', () => {
        it('returns offen for null', () => {
            expect(svc()._mapAngebotStatus(null)).toBe('offen');
        });

        it('maps angenommen to abgeschlossen', () => {
            expect(svc()._mapAngebotStatus('angenommen')).toBe('abgeschlossen');
        });

        it('maps akzeptiert to abgeschlossen', () => {
            expect(svc()._mapAngebotStatus('akzeptiert')).toBe('abgeschlossen');
        });

        it('maps abgelehnt to abgeschlossen', () => {
            expect(svc()._mapAngebotStatus('abgelehnt')).toBe('abgeschlossen');
        });

        it('maps offen to offen', () => {
            expect(svc()._mapAngebotStatus('offen')).toBe('offen');
        });
    });

    describe('_mapAuftragStatus', () => {
        it('maps abgeschlossen to abgeschlossen', () => {
            expect(svc()._mapAuftragStatus('abgeschlossen')).toBe('abgeschlossen');
        });

        it('maps fertig to abgeschlossen', () => {
            expect(svc()._mapAuftragStatus('fertig')).toBe('abgeschlossen');
        });

        it('maps neu to geplant', () => {
            expect(svc()._mapAuftragStatus('neu')).toBe('geplant');
        });

        it('maps in_arbeit to offen', () => {
            expect(svc()._mapAuftragStatus('in_arbeit')).toBe('offen');
        });
    });

    describe('_mapRechnungStatus', () => {
        it('maps bezahlt to abgeschlossen', () => {
            expect(svc()._mapRechnungStatus('bezahlt')).toBe('abgeschlossen');
        });

        it('maps ueberfaellig to ueberfaellig', () => {
            expect(svc()._mapRechnungStatus('ueberfaellig')).toBe('ueberfaellig');
        });

        it('maps storniert to abgeschlossen', () => {
            expect(svc()._mapRechnungStatus('storniert')).toBe('abgeschlossen');
        });

        it('returns offen for null', () => {
            expect(svc()._mapRechnungStatus(null)).toBe('offen');
        });
    });

    describe('_mapMahnungTyp', () => {
        it('maps erinnerung', () => {
            expect(svc()._mapMahnungTyp('erinnerung')).toBe('Zahlungserinnerung');
        });

        it('maps mahnung1', () => {
            expect(svc()._mapMahnungTyp('mahnung1')).toBe('1. Mahnung');
        });

        it('maps inkasso', () => {
            expect(svc()._mapMahnungTyp('inkasso')).toBe('Inkasso-Uebergabe');
        });

        it('returns Mahnung for unknown', () => {
            expect(svc()._mapMahnungTyp('xyz')).toBe('Mahnung');
        });
    });

    // ── Timeline ──

    describe('getTimeline', () => {
        it('returns empty array when no data', async () => {
            const events = await svc().getTimeline('k-1');
            expect(events).toHaveLength(0);
        });

        it('collects events from storeService', async () => {
            window.storeService = {
                store: {
                    angebote: [
                        { id: 'ang-1', kundeId: 'k-1', status: 'offen', datum: '2024-01-15', brutto: 5000 },
                    ],
                    auftraege: [
                        { id: 'auf-1', kundeId: 'k-1', status: 'aktiv', datum: '2024-02-01', brutto: 5000 },
                    ],
                    rechnungen: [
                        { id: 're-1', kundeId: 'k-1', status: 'bezahlt', datum: '2024-03-01', brutto: 5000, bezahltAm: '2024-03-15' },
                    ],
                }
            };

            const events = await svc().getTimeline('k-1');
            expect(events.length).toBeGreaterThanOrEqual(3);
            // Should include a bezahlt event for the paid invoice
            expect(events.some(e => e.typ === 'bezahlt')).toBe(true);
        });

        it('sorts events chronologically', async () => {
            window.storeService = {
                store: {
                    angebote: [{ id: 'a1', kundeId: 'k-1', datum: '2024-03-01' }],
                    auftraege: [{ id: 'a2', kundeId: 'k-1', datum: '2024-01-01' }],
                    rechnungen: [{ id: 'r1', kundeId: 'k-1', datum: '2024-02-01', status: 'offen' }],
                }
            };

            const events = await svc().getTimeline('k-1');
            for (let i = 1; i < events.length; i++) {
                const prev = new Date(events[i - 1].datum).getTime();
                const curr = new Date(events[i].datum).getTime();
                expect(curr).toBeGreaterThanOrEqual(prev);
            }
        });

        it('includes leads from leadService', async () => {
            window.leadService = {
                leads: [
                    { id: 'lead-1', kundeId: 'k-1', stage: 'gewonnen', createdAt: '2024-01-01', name: 'Test Lead' },
                ]
            };

            const events = await svc().getTimeline('k-1');
            expect(events.some(e => e.typ === 'anfrage')).toBe(true);
        });

        it('matches leads by customer email', async () => {
            window.leadService = {
                leads: [
                    { id: 'lead-1', email: 'test@example.com', stage: 'neu', createdAt: '2024-01-01' },
                ]
            };

            const events = await svc().getTimeline('k-1', { email: 'test@example.com' });
            expect(events).toHaveLength(1);
        });

        it('includes mahnungen linked to invoices', async () => {
            window.storeService = {
                store: {
                    angebote: [],
                    auftraege: [],
                    rechnungen: [
                        { id: 're-1', kundeId: 'k-1', status: 'offen', datum: '2024-01-01' },
                    ],
                }
            };
            window.dunningService = {
                mahnungen: [
                    { id: 'm-1', rechnungId: 're-1', typ: 'mahnung1', datum: '2024-02-01' },
                ]
            };

            const events = await svc().getTimeline('k-1');
            expect(events.some(e => e.typ === 'mahnung')).toBe(true);
        });
    });

    // ── Lifecycle Summary ──

    describe('getLifecycleSummary', () => {
        it('returns keine phase when no events', async () => {
            const summary = await svc().getLifecycleSummary('k-1');
            expect(summary.phase).toBe('keine');
            expect(summary.fortschritt).toBe(0);
            expect(summary.anzahlEvents).toBe(0);
        });

        it('calculates highest phase and revenue', async () => {
            window.storeService = {
                store: {
                    angebote: [{ id: 'a1', kundeId: 'k-1', status: 'angenommen', datum: '2024-01-01', brutto: 5000 }],
                    auftraege: [{ id: 'a2', kundeId: 'k-1', status: 'abgeschlossen', datum: '2024-02-01' }],
                    rechnungen: [
                        { id: 'r1', kundeId: 'k-1', status: 'bezahlt', datum: '2024-03-01', brutto: 5000, bezahltAm: '2024-03-15' },
                    ],
                }
            };

            const summary = await svc().getLifecycleSummary('k-1');
            expect(summary.phase).toBe('bezahlt');
            expect(summary.fortschritt).toBe(100);
            expect(summary.gesamtUmsatz).toBe(5000);
        });
    });
});
