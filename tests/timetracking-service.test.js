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
    safeDate: vi.fn(s => s ? new Date(s) : null),
};

globalThis.window = globalThis;
window.showToast = vi.fn();
window.dbService = null;
window.storeService = null;
window.invoiceService = null;

await import('../js/services/timetracking-service.js');

const svc = () => window.timeTrackingService;

// ============================================
// Tests
// ============================================

describe('TimeTrackingService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        window.timeTrackingService = new window.timeTrackingService.constructor();
    });

    // ── Duration Calculation ──

    describe('calculateDuration', () => {
        it('calculates simple duration', () => {
            expect(svc().calculateDuration('08:00', '12:00')).toBe(240);
        });

        it('subtracts break time', () => {
            expect(svc().calculateDuration('08:00', '17:00', 60)).toBe(480);
        });

        it('handles overnight shifts', () => {
            expect(svc().calculateDuration('22:00', '06:00')).toBe(480);
        });

        it('returns 0 for missing times', () => {
            expect(svc().calculateDuration(null, '12:00')).toBe(0);
            expect(svc().calculateDuration('08:00', null)).toBe(0);
        });

        it('returns 0 when break exceeds duration', () => {
            expect(svc().calculateDuration('08:00', '09:00', 120)).toBe(0);
        });
    });

    // ── Entry CRUD ──

    describe('Entry CRUD', () => {
        it('adds a time entry with defaults', () => {
            const entry = svc().addEntry({ startTime: '08:00', endTime: '12:00' });
            expect(entry.id).toBeTruthy();
            expect(entry.durationMinutes).toBe(240);
            expect(entry.durationHours).toBe(4);
            expect(entry.employeeId).toBe('default');
            expect(entry.type).toBe('arbeit');
            expect(entry.billable).toBe(true);
        });

        it('adds entry with all fields', () => {
            const entry = svc().addEntry({
                employeeId: 'emp-1',
                date: '2024-03-15',
                startTime: '09:00',
                endTime: '17:30',
                breakMinutes: 30,
                projectId: 'proj-1',
                customerId: 'cust-1',
                description: 'Schweißarbeiten',
                type: 'arbeit',
                billable: true,
            });
            expect(entry.durationMinutes).toBe(480);
            expect(entry.durationHours).toBe(8);
            expect(entry.projectId).toBe('proj-1');
            expect(entry.customerId).toBe('cust-1');
        });

        it('retrieves entry by ID', () => {
            const entry = svc().addEntry({ startTime: '08:00', endTime: '12:00' });
            expect(svc().getEntry(entry.id)).toBeTruthy();
        });

        it('updates entry and recalculates duration', () => {
            const entry = svc().addEntry({ startTime: '08:00', endTime: '12:00' });
            const updated = svc().updateEntry(entry.id, { endTime: '16:00' });
            expect(updated.durationMinutes).toBe(480);
            expect(updated.durationHours).toBe(8);
        });

        it('returns null when updating non-existent entry', () => {
            expect(svc().updateEntry('nonexistent', {})).toBeNull();
        });

        it('deletes an entry', () => {
            const entry = svc().addEntry({ startTime: '08:00', endTime: '12:00' });
            svc().deleteEntry(entry.id);
            expect(svc().getEntry(entry.id)).toBeUndefined();
        });
    });

    // ── Clock In/Out ──

    describe('Clock In/Out', () => {
        it('clocks in an employee', () => {
            const timer = svc().clockIn('emp-1', 'proj-1');
            expect(timer.startTime).toBeTruthy();
            expect(timer.projectId).toBe('proj-1');
            expect(svc().isClockActive('emp-1')).toBe(true);
        });

        it('clocks out and creates entry', () => {
            svc().clockIn('emp-1');
            const entry = svc().clockOut('emp-1', 'Testarbeit');
            expect(entry).toBeTruthy();
            expect(entry.description).toBe('Testarbeit');
            expect(svc().isClockActive('emp-1')).toBe(false);
        });

        it('returns null when clocking out without clock-in', () => {
            expect(svc().clockOut('emp-1')).toBeNull();
        });

        it('uses default employee ID', () => {
            svc().clockIn();
            expect(svc().isClockActive('default')).toBe(true);
        });

        it('gets active timer info', () => {
            svc().clockIn('emp-1');
            const timer = svc().getActiveTimer('emp-1');
            expect(timer).toBeTruthy();
            expect(timer.elapsedMinutes).toBeGreaterThanOrEqual(0);
            expect(timer.elapsedFormatted).toBeTruthy();
        });

        it('returns null for inactive timer', () => {
            expect(svc().getActiveTimer('emp-1')).toBeNull();
        });
    });

    // ── Stale Timer Detection ──

    describe('Stale Timers', () => {
        it('detects stale timers (>24h)', () => {
            const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
            svc().activeTimers['emp-1'] = {
                startTime: '08:00',
                date: yesterday.toISOString().split('T')[0],
                startedAt: yesterday.toISOString(),
            };
            const stale = svc().getStaleTimers();
            expect(stale).toHaveLength(1);
            expect(stale[0].employeeId).toBe('emp-1');
        });

        it('auto-resolves stale timer', () => {
            const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
            svc().activeTimers['emp-1'] = {
                startTime: '08:00',
                date: yesterday.toISOString().split('T')[0],
                startedAt: yesterday.toISOString(),
            };
            const entry = svc().autoResolveStaleTimer('emp-1', '17:00');
            expect(entry).toBeTruthy();
            expect(entry.endTime).toBe('17:00');
            expect(entry.description).toContain('Auto-geschlossen');
            expect(svc().isClockActive('emp-1')).toBe(false);
        });
    });

    // ── Queries ──

    describe('Queries', () => {
        beforeEach(() => {
            svc().addEntry({ date: '2024-03-15', startTime: '08:00', endTime: '12:00', employeeId: 'emp-1' });
            svc().addEntry({ date: '2024-03-15', startTime: '13:00', endTime: '17:00', employeeId: 'emp-1' });
            svc().addEntry({ date: '2024-03-16', startTime: '08:00', endTime: '16:00', employeeId: 'emp-1' });
            svc().addEntry({ date: '2024-03-15', startTime: '09:00', endTime: '15:00', employeeId: 'emp-2' });
        });

        it('gets entries for a day', () => {
            const entries = svc().getEntriesForDay('2024-03-15', 'emp-1');
            expect(entries).toHaveLength(2);
        });

        it('gets entries for all employees on a day', () => {
            const entries = svc().getEntriesForDay('2024-03-15');
            expect(entries).toHaveLength(3);
        });

        it('gets entries for month', () => {
            const entries = svc().getEntriesForMonth(2024, 3, 'emp-1');
            expect(entries).toHaveLength(3);
        });

        it('calculates total hours for day', () => {
            const hours = svc().getTotalHoursForDay('2024-03-15', 'emp-1');
            expect(hours).toBe(8);
        });
    });

    // ── Timesheet Generation ──

    describe('Timesheet', () => {
        it('generates monthly timesheet', () => {
            svc().addEntry({ date: '2024-03-15', startTime: '08:00', endTime: '17:00', breakMinutes: 60, employeeId: 'emp-1' });
            svc().addEntry({ date: '2024-03-18', startTime: '08:00', endTime: '17:00', breakMinutes: 60, employeeId: 'emp-1' });

            const sheet = svc().generateTimesheet('emp-1', 2024, 3);
            expect(sheet.year).toBe(2024);
            expect(sheet.month).toBe(3);
            expect(sheet.rows).toHaveLength(31);
            expect(sheet.totalHours).toBe(16);
            expect(sheet.workDays).toBe(2);
        });
    });

    // ── CSV Export ──

    describe('CSV Export', () => {
        it('exports CSV with headers', () => {
            svc().addEntry({ date: '2024-03-15', startTime: '08:00', endTime: '12:00', employeeId: 'emp-1', description: 'Test' });
            const csv = svc().exportToCSV('emp-1', 2024, 3);
            expect(csv).toContain('Datum;Wochentag;Beginn;Ende;Pause (Min);Arbeitszeit (Std);Beschreibung');
            expect(csv).toContain('08:00');
            expect(csv).toContain('12:00');
            expect(csv).toContain('Gesamt');
        });
    });

    // ── Employee Management ──

    describe('Employees', () => {
        it('adds an employee', () => {
            const emp = svc().addEmployee({ name: 'Max Mustermann', email: 'max@test.de' });
            expect(emp.id).toBeTruthy();
            expect(emp.name).toBe('Max Mustermann');
            expect(emp.active).toBe(true);
        });

        it('gets active employees', () => {
            svc().addEmployee({ name: 'A' });
            svc().addEmployee({ name: 'B' });
            expect(svc().getEmployees()).toHaveLength(2);
        });

        it('gets employee by ID', () => {
            const emp = svc().addEmployee({ name: 'Test' });
            expect(svc().getEmployee(emp.id).name).toBe('Test');
        });
    });

    // ── Statistics ──

    describe('Statistics', () => {
        it('calculates statistics', () => {
            svc().addEntry({ date: '2024-03-15', startTime: '08:00', endTime: '12:00', billable: true });
            svc().addEntry({ date: '2024-03-15', startTime: '13:00', endTime: '15:00', billable: false, type: 'fahrt' });

            const stats = svc().getStatistics();
            expect(stats.totalEntries).toBe(2);
            expect(stats.totalHours).toBe(6);
            expect(stats.billableHours).toBe(4);
            expect(stats.byType.fahrt).toBe(2);
        });
    });

    // ── Billing ──

    describe('Billing', () => {
        it('gets unbilled entries for customer', () => {
            svc().addEntry({ customerId: 'c1', billable: true, startTime: '08:00', endTime: '12:00' });
            svc().addEntry({ customerId: 'c1', billable: true, billed: true, startTime: '13:00', endTime: '17:00' });
            svc().addEntry({ customerId: 'c2', billable: true, startTime: '08:00', endTime: '10:00' });

            const unbilled = svc().getUnbilledEntries('c1');
            expect(unbilled).toHaveLength(1);
        });

        it('marks entries as billed', () => {
            const e1 = svc().addEntry({ customerId: 'c1', billable: true, startTime: '08:00', endTime: '12:00' });
            const e2 = svc().addEntry({ customerId: 'c1', billable: true, startTime: '13:00', endTime: '17:00' });

            const count = svc().markEntriesAsBilled([e1.id, e2.id], 'inv-001');
            expect(count).toBe(2);
            expect(svc().getEntry(e1.id).billed).toBe(true);
            expect(svc().getEntry(e1.id).invoiceId).toBe('inv-001');
        });

        it('gets billing summary for customer', () => {
            svc().addEntry({ customerId: 'c1', billable: true, startTime: '08:00', endTime: '12:00' });
            const e2 = svc().addEntry({ customerId: 'c1', billable: true, startTime: '13:00', endTime: '17:00' });
            svc().markEntriesAsBilled([e2.id], 'inv-001');

            const summary = svc().getBillingSummary('c1');
            expect(summary.offeneEintraege).toBe(1);
            expect(summary.offeneStunden).toBe(4);
            expect(summary.abgerechneteEintraege).toBe(1);
            expect(summary.abgerechneteStunden).toBe(4);
        });
    });

    // ── Formatting Helpers ──

    describe('Formatting', () => {
        it('formats duration in hours:minutes', () => {
            expect(svc().formatDuration(90)).toBe('1:30');
            expect(svc().formatDuration(480)).toBe('8:00');
            expect(svc().formatDuration(0)).toBe('0:00');
        });

        it('formats hours with German decimal', () => {
            expect(svc().formatHours(8.5)).toBe('8,50 Std');
            expect(svc().formatHours(0)).toBe('0,00 Std');
        });
    });

    // ── Settings ──

    describe('Settings', () => {
        it('has default settings', () => {
            expect(svc().settings.dailyHours).toBe(8);
            expect(svc().settings.overtimeThreshold).toBe(40);
            expect(svc().settings.breakDuration).toBe(30);
        });
    });
});
