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
window.customerService = null;
window.timeTrackingService = null;
window.taskService = null;
window.bookkeepingService = null;
window.formatCurrency = vi.fn(a => `${(a || 0).toFixed(2)} €`);

await import('../js/services/report-service.js');

const svc = () => window.reportService;

// ============================================
// Tests
// ============================================

describe('ReportService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        window.reportService = new window.reportService.constructor();
        window.storeService = null;
        window.taskService = null;
        window.timeTrackingService = null;
    });

    // ── Sales Report ──

    describe('generateSalesReport', () => {
        it('returns error without dates', () => {
            const result = svc().generateSalesReport(null, null);
            expect(result.error).toBeTruthy();
        });

        it('generates empty report when no data', () => {
            const report = svc().generateSalesReport('2024-01-01', '2024-12-31');
            expect(report.type).toBe('sales');
            expect(report.summary.anzahlRechnungen).toBe(0);
        });

        it('generates report with invoice data', () => {
            window.storeService = {
                state: {
                    rechnungen: [
                        { id: 'RE-1', datum: '2024-03-15', brutto: 1190, netto: 1000, status: 'bezahlt', kunde: { name: 'A' } },
                        { id: 'RE-2', datum: '2024-03-20', brutto: 595, netto: 500, status: 'offen', kunde: { name: 'B' } },
                        { id: 'RE-3', datum: '2025-01-01', brutto: 238, netto: 200, status: 'offen', kunde: { name: 'C' } },
                    ],
                },
            };

            const report = svc().generateSalesReport('2024-01-01', '2024-12-31');
            expect(report.summary.anzahlRechnungen).toBe(2);
            expect(report.summary.gesamtBrutto).toBe(1785);
            expect(report.summary.anzahlBezahlt).toBe(1);
            expect(report.summary.anzahlOffen).toBe(1);
            expect(report.byMonth).toHaveLength(1);
            expect(report.byMonth[0].month).toBe('2024-03');
        });
    });

    // ── Customer Report ──

    describe('generateCustomerReport', () => {
        it('returns error without dates', () => {
            expect(svc().generateCustomerReport(null, null).error).toBeTruthy();
        });

        it('generates customer revenue breakdown', () => {
            window.storeService = {
                state: {
                    rechnungen: [
                        { datum: '2024-03-15', brutto: 1000, kunde: { name: 'Meier', email: 'meier@test.de' } },
                        { datum: '2024-03-20', brutto: 500, kunde: { name: 'Meier', email: 'meier@test.de' } },
                        { datum: '2024-04-01', brutto: 2000, kunde: { name: 'Schmidt', email: 'schmidt@test.de' } },
                    ],
                },
            };
            window.customerService = { getAllCustomers: () => [{ id: '1' }, { id: '2' }] };

            const report = svc().generateCustomerReport('2024-01-01', '2024-12-31');
            expect(report.type).toBe('customer');
            expect(report.topCustomers.length).toBe(2);
            expect(report.topCustomers[0].name).toBe('Schmidt'); // highest revenue
        });
    });

    // ── Time Report ──

    describe('generateTimeReport', () => {
        it('returns error without dates', () => {
            expect(svc().generateTimeReport(null, null).error).toBeTruthy();
        });

        it('returns error when time tracking unavailable', () => {
            window.timeTrackingService = null;
            expect(svc().generateTimeReport('2024-01-01', '2024-12-31').error).toBeTruthy();
        });

        it('generates time report', () => {
            window.timeTrackingService = {
                entries: [
                    { date: '2024-03-15', startTime: '08:00', endTime: '12:00', durationHours: 4, billable: true, auftragId: 'A1' },
                    { date: '2024-03-15', startTime: '13:00', endTime: '17:00', durationHours: 4, billable: false },
                    { date: '2024-03-16', startTime: '08:00', endTime: '16:00', durationHours: 8, billable: true, auftragId: 'A1' },
                ],
            };

            const report = svc().generateTimeReport('2024-01-01', '2024-12-31');
            expect(report.summary.totalHours).toBe(16);
            expect(report.summary.billableHours).toBe(12);
            expect(report.byDay).toHaveLength(2);
        });
    });

    // ── Task Report ──

    describe('generateTaskReport', () => {
        it('returns error without dates', () => {
            expect(svc().generateTaskReport(null, null).error).toBeTruthy();
        });

        it('generates task report', () => {
            window.taskService = {
                getAllTasks: () => [
                    { title: 'T1', status: 'erledigt', priority: 'high', createdAt: '2024-03-15T10:00:00Z' },
                    { title: 'T2', status: 'offen', priority: 'normal', createdAt: '2024-03-16T10:00:00Z', dueDate: '2020-01-01' },
                    { title: 'T3', status: 'offen', priority: 'urgent', createdAt: '2024-03-17T10:00:00Z' },
                ],
            };

            const report = svc().generateTaskReport('2024-01-01', '2024-12-31');
            expect(report.summary.totalTasks).toBe(3);
            expect(report.summary.completed).toBe(1);
            expect(report.summary.overdue).toBe(1);
            expect(report.summary.completionRate).toBe(33);
            expect(report.byPriority.urgent).toBe(1);
        });
    });

    // ── CSV Export ──

    describe('exportToCSV', () => {
        it('exports sales report to CSV', () => {
            const report = {
                type: 'sales',
                details: [
                    { id: 'RE-1', datum: '2024-03-15', kunde: { name: 'Test' }, netto: 100, brutto: 119, status: 'bezahlt' },
                ],
            };
            const csv = svc().exportToCSV(report);
            expect(csv).toContain('\uFEFF'); // BOM
            expect(csv).toContain('Rechnungs-Nr');
            expect(csv).toContain('RE-1');
        });

        it('exports time report to CSV', () => {
            const report = {
                type: 'time',
                details: [
                    { date: '2024-03-15', startTime: '08:00', endTime: '12:00', durationHours: 4, description: 'Test' },
                ],
            };
            const csv = svc().exportToCSV(report);
            expect(csv).toContain('Datum;Start;Ende');
            expect(csv).toContain('08:00');
        });

        it('sanitizes CSV injection attempts', () => {
            const report = {
                type: 'sales',
                details: [
                    { id: '=cmd()', datum: '2024-01-01', kunde: { name: '+test' }, netto: 0, brutto: 0, status: 'offen' },
                ],
            };
            const csv = svc().exportToCSV(report);
            expect(csv).toContain("'=cmd()");
            expect(csv).toContain("'+test");
        });
    });

    // ── Printable HTML ──

    describe('exportToPrintableHTML', () => {
        it('generates HTML', () => {
            const report = {
                title: 'Umsatzbericht',
                period: { start: '2024-01-01', end: '2024-12-31' },
                generatedAt: new Date().toISOString(),
                summary: { total: 1000 },
            };
            const html = svc().exportToPrintableHTML(report);
            expect(html).toContain('<html>');
            expect(html).toContain('Umsatzbericht');
        });
    });

    // ── Save/Delete Reports ──

    describe('Saved Reports', () => {
        it('saves a report', () => {
            const report = { type: 'sales', summary: {} };
            const saved = svc().saveReport(report, 'Q1 Report');
            expect(saved.id).toBeTruthy();
            expect(saved.name).toBe('Q1 Report');
            expect(svc().getSavedReports()).toHaveLength(1);
        });

        it('returns null for missing params', () => {
            expect(svc().saveReport(null, 'test')).toBeNull();
            expect(svc().saveReport({ type: 'x' }, '')).toBeNull();
        });

        it('deletes a saved report', () => {
            const saved = svc().saveReport({ type: 'sales' }, 'Test');
            svc().deleteSavedReport(saved.id);
            expect(svc().getSavedReports()).toHaveLength(0);
        });

        it('truncates long names', () => {
            const saved = svc().saveReport({ type: 'sales' }, 'A'.repeat(300));
            expect(saved.name.length).toBe(200);
        });
    });

    // ── Report Types ──

    describe('getReportTypes', () => {
        it('returns all report types', () => {
            const types = svc().getReportTypes();
            expect(types.length).toBeGreaterThan(0);
            expect(types.find(t => t.id === 'sales')).toBeTruthy();
            expect(types.find(t => t.id === 'customer')).toBeTruthy();
        });
    });
});
