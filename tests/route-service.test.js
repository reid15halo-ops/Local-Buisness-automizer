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
window.storeService = null;

await import('../js/services/route-service.js');

const svc = () => window.routeService;

// ============================================
// Tests
// ============================================

describe('RouteService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        window.routeService = new window.routeService.constructor();
    });

    // ── Settings ──

    describe('constructor defaults', () => {
        it('has default work times', () => {
            expect(svc().settings.workStartTime).toBe('08:00');
            expect(svc().settings.workEndTime).toBe('17:00');
        });

        it('has default service duration', () => {
            expect(svc().settings.avgServiceDuration).toBe(60);
        });

        it('has default travel speed', () => {
            expect(svc().settings.avgTravelSpeed).toBe(40);
        });
    });

    // ── Distance Calculation ──

    describe('calculateDistance', () => {
        it('returns 10 for null coords', () => {
            expect(svc().calculateDistance(null, { lat: 50, lng: 9 })).toBe(10);
        });

        it('returns 0 for same point', () => {
            const coord = { lat: 50.0, lng: 9.0 };
            expect(svc().calculateDistance(coord, coord)).toBe(0);
        });

        it('calculates distance between two points', () => {
            const frankfurt = { lat: 50.1109, lng: 8.6821 };
            const munich = { lat: 48.1351, lng: 11.5820 };
            const distance = svc().calculateDistance(frankfurt, munich);
            expect(distance).toBeGreaterThan(250);
            expect(distance).toBeLessThan(400);
        });
    });

    // ── Time Parsing/Formatting ──

    describe('parseTime', () => {
        it('parses time string to minutes', () => {
            expect(svc().parseTime('08:00')).toBe(480);
            expect(svc().parseTime('17:30')).toBe(1050);
        });
    });

    describe('formatTime', () => {
        it('formats minutes to time string', () => {
            expect(svc().formatTime(480)).toBe('08:00');
            expect(svc().formatTime(1050)).toBe('17:30');
        });
    });

    // ── Stop Optimization ──

    describe('optimizeStopOrder', () => {
        it('returns single stop unchanged', () => {
            const stops = [{ coordinates: { lat: 50, lng: 9 } }];
            const result = svc().optimizeStopOrder(stops);
            expect(result).toHaveLength(1);
        });

        it('optimizes multiple stops', () => {
            const stops = [
                { coordinates: { lat: 50.0, lng: 9.0 } },
                { coordinates: { lat: 50.1, lng: 9.1 } },
                { coordinates: { lat: 49.9, lng: 9.05 } },
            ];
            const result = svc().optimizeStopOrder(stops);
            expect(result).toHaveLength(3);
            result.forEach(s => expect(s.distanceFromPrevious).toBeDefined());
        });
    });

    // ── Route Creation ──

    describe('createRoute', () => {
        it('fails without appointments', async () => {
            const result = await svc().createRoute('2024-03-15', []);
            expect(result.success).toBe(false);
        });

        it('creates route with appointments', async () => {
            const result = await svc().createRoute('2024-03-15', [
                { id: 'apt-1', title: 'Kunde A', location: 'Frankfurt' },
                { id: 'apt-2', title: 'Kunde B', location: 'Offenbach' },
            ]);
            expect(result.success).toBe(true);
            expect(result.route.stops).toHaveLength(2);
            expect(result.route.date).toBe('2024-03-15');
            expect(result.route.status).toBe('planned');
        });

        it('persists route', async () => {
            await svc().createRoute('2024-03-15', [{ id: 'a1', title: 'Test' }]);
            expect(svc().routes).toHaveLength(1);
            expect(mockStorage['freyai_routes']).toBeTruthy();
        });
    });

    // ── Route Queries ──

    describe('getRouteForDate', () => {
        it('finds route by date', async () => {
            await svc().createRoute('2024-03-15', [{ id: 'a1', title: 'T' }]);
            expect(svc().getRouteForDate('2024-03-15')).toBeTruthy();
            expect(svc().getRouteForDate('2024-03-16')).toBeFalsy();
        });
    });

    describe('getRoutes', () => {
        it('returns routes sorted by date descending', async () => {
            await svc().createRoute('2024-03-10', [{ id: 'a1', title: 'T' }]);
            await svc().createRoute('2024-03-20', [{ id: 'a2', title: 'T' }]);
            const routes = svc().getRoutes();
            expect(new Date(routes[0].date) >= new Date(routes[1].date)).toBe(true);
        });
    });

    // ── Stop Status ──

    describe('updateStopStatus', () => {
        it('updates stop status', async () => {
            const { route } = await svc().createRoute('2024-03-15', [
                { id: 'apt-1', title: 'Test' },
                { id: 'apt-2', title: 'Test2' },
            ]);
            const result = svc().updateStopStatus(route.id, 'apt-1', 'completed');
            expect(result.success).toBe(true);
            expect(route.status).toBe('in_progress');
        });

        it('marks route completed when all stops done', async () => {
            const { route } = await svc().createRoute('2024-03-15', [
                { id: 'apt-1', title: 'Test' },
            ]);
            svc().updateStopStatus(route.id, 'apt-1', 'completed');
            expect(route.status).toBe('completed');
        });

        it('returns failure for unknown route', () => {
            expect(svc().updateStopStatus('route-999', 'x', 'done').success).toBe(false);
        });
    });

    // ── Navigation Links ──

    describe('getGoogleMapsLink', () => {
        it('returns null for unknown route', () => {
            expect(svc().getGoogleMapsLink('route-999')).toBeNull();
        });

        it('generates link with addresses', async () => {
            const { route } = await svc().createRoute('2024-03-15', [
                { id: 'a1', title: 'T', location: 'Frankfurt' },
            ]);
            const link = svc().getGoogleMapsLink(route.id);
            expect(link).toContain('google.com/maps');
        });
    });

    describe('getNavigationLink', () => {
        it('generates navigation link for stop', async () => {
            await svc().createRoute('2024-03-15', [
                { id: 'apt-1', title: 'Test', location: 'Main Street' },
            ]);
            const link = svc().getNavigationLink('apt-1');
            expect(link).toContain('google.com/maps');
        });

        it('returns null for unknown stop', () => {
            expect(svc().getNavigationLink('unknown')).toBeNull();
        });
    });

    // ── Statistics ──

    describe('getStatistics', () => {
        it('returns zeroes for empty routes', () => {
            const stats = svc().getStatistics();
            expect(stats.totalRoutes).toBe(0);
            expect(stats.completedRoutes).toBe(0);
        });

        it('calculates stats', async () => {
            await svc().createRoute('2024-03-15', [{ id: 'a1', title: 'T' }]);
            const stats = svc().getStatistics();
            expect(stats.totalRoutes).toBe(1);
            expect(stats.avgStopsPerRoute).toBe(1);
        });
    });

    // ── Delete ──

    describe('deleteRoute', () => {
        it('removes route', async () => {
            const { route } = await svc().createRoute('2024-03-15', [{ id: 'a1', title: 'T' }]);
            svc().deleteRoute(route.id);
            expect(svc().routes).toHaveLength(0);
        });
    });

    // ── Settings ──

    describe('updateSettings', () => {
        it('updates settings', () => {
            svc().updateSettings({ avgServiceDuration: 90 });
            expect(svc().settings.avgServiceDuration).toBe(90);
        });
    });
});
