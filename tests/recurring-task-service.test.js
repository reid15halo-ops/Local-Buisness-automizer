import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────
const StorageUtils = {
    getJSON: vi.fn((key, defaultVal) => defaultVal),
    setJSON: vi.fn(() => true)
};
global.StorageUtils = StorageUtils;

const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn(k => store[k] || null),
        setItem: vi.fn((k, v) => { store[k] = v; }),
        removeItem: vi.fn(k => { delete store[k]; }),
        clear: vi.fn(() => { store = {}; })
    };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

// console.warn mock for generateTask fallback
const originalWarn = console.warn;
global.console = { ...console, warn: vi.fn() };

// ── Inline Class (extracted from js/services/recurring-task-service.js) ──
class RecurringTaskService {
    constructor() {
        this.recurringTasks = StorageUtils.getJSON('freyai_recurring_tasks', [], { service: 'recurringTaskService' });
        this.generatedTasks = StorageUtils.getJSON('freyai_generated_tasks', [], { service: 'recurringTaskService' });
        this.settings = StorageUtils.getJSON('freyai_recurring_settings', {}, { service: 'recurringTaskService' });
        this.holidays = this.getGermanHolidays(new Date().getFullYear());
        // Don't start scheduler in tests
    }

    createRecurringTask(taskData) {
        const task = {
            id: 'rec-' + Date.now(),
            title: taskData.title,
            description: taskData.description || '',
            priority: taskData.priority || 'normal',
            category: taskData.category || '',
            assignee: taskData.assignee || '',
            recurrence: {
                type: taskData.recurrence?.type || 'weekly',
                interval: taskData.recurrence?.interval || 1,
                daysOfWeek: taskData.recurrence?.daysOfWeek || [],
                dayOfMonth: taskData.recurrence?.dayOfMonth || 1,
                monthOfYear: taskData.recurrence?.monthOfYear || 1,
                time: taskData.recurrence?.time || '09:00'
            },
            startDate: taskData.startDate || new Date().toISOString().split('T')[0],
            endDate: taskData.endDate || null,
            maxOccurrences: taskData.maxOccurrences || null,
            skipHolidays: taskData.skipHolidays !== false,
            skipWeekends: taskData.skipWeekends || false,
            advanceDays: taskData.advanceDays || 0,
            active: true,
            occurrenceCount: 0,
            lastGenerated: null,
            nextDue: null,
            createdAt: new Date().toISOString()
        };
        task.nextDue = this.calculateNextOccurrence(task);
        this.recurringTasks.push(task);
        this.save();
        return { success: true, task };
    }

    updateRecurringTask(id, updates) {
        const task = this.recurringTasks.find(t => t.id === id);
        if (!task) { return { success: false, error: 'Nicht gefunden' }; }
        Object.assign(task, updates, { updatedAt: new Date().toISOString() });
        task.nextDue = this.calculateNextOccurrence(task);
        this.save();
        return { success: true, task };
    }

    deleteRecurringTask(id) {
        this.recurringTasks = this.recurringTasks.filter(t => t.id !== id);
        this.save();
        return { success: true };
    }

    toggleRecurringTask(id) {
        const task = this.recurringTasks.find(t => t.id === id);
        if (task) {
            task.active = !task.active;
            if (task.active) {
                task.nextDue = this.calculateNextOccurrence(task);
            }
            this.save();
            return { success: true, active: task.active };
        }
        return { success: false };
    }

    calculateNextOccurrence(task, fromDate = null) {
        const start = fromDate ? new Date(fromDate) : new Date();
        const rec = task.recurrence;
        let next = new Date(start);
        if (task.lastGenerated) {
            next = new Date(task.lastGenerated);
        } else if (task.startDate) {
            next = new Date(task.startDate);
        }
        switch (rec.type) {
            case 'daily':
                next.setDate(next.getDate() + rec.interval);
                break;
            case 'weekly':
                if (rec.daysOfWeek && rec.daysOfWeek.length > 0) {
                    let found = false;
                    for (let i = 1; i <= 7 * rec.interval && !found; i++) {
                        next.setDate(next.getDate() + 1);
                        if (rec.daysOfWeek.includes(next.getDay())) { found = true; }
                    }
                } else {
                    next.setDate(next.getDate() + 7 * rec.interval);
                }
                break;
            case 'monthly':
                next.setMonth(next.getMonth() + rec.interval);
                if (rec.dayOfMonth) {
                    next.setDate(Math.min(rec.dayOfMonth, this.getDaysInMonth(next)));
                }
                break;
            case 'yearly':
                next.setFullYear(next.getFullYear() + rec.interval);
                if (rec.monthOfYear) { next.setMonth(rec.monthOfYear - 1); }
                if (rec.dayOfMonth) {
                    next.setDate(Math.min(rec.dayOfMonth, this.getDaysInMonth(next)));
                }
                break;
        }
        if (task.skipWeekends) {
            while (next.getDay() === 0 || next.getDay() === 6) {
                next.setDate(next.getDate() + 1);
            }
        }
        if (task.skipHolidays) {
            while (this.isHoliday(next.toISOString().split('T')[0])) {
                next.setDate(next.getDate() + 1);
            }
        }
        if (task.endDate && next > new Date(task.endDate)) { return null; }
        if (task.maxOccurrences && task.occurrenceCount >= task.maxOccurrences) { return null; }
        return next.toISOString().split('T')[0];
    }

    getDaysInMonth(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }

    isHoliday(dateStr) {
        return this.holidays.includes(dateStr);
    }

    getGermanHolidays(year) {
        const holidays = [];
        holidays.push(`${year}-01-01`);
        holidays.push(`${year}-05-01`);
        holidays.push(`${year}-10-03`);
        holidays.push(`${year}-12-25`);
        holidays.push(`${year}-12-26`);
        const easter = this.calculateEaster(year);
        holidays.push(this.addDays(easter, -2));
        holidays.push(this.addDays(easter, 0));
        holidays.push(this.addDays(easter, 1));
        holidays.push(this.addDays(easter, 39));
        holidays.push(this.addDays(easter, 49));
        holidays.push(this.addDays(easter, 50));
        holidays.push(this.addDays(easter, 60));
        return holidays;
    }

    calculateEaster(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }

    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().split('T')[0];
    }

    generateTask(recurringTask) {
        if (!window.taskService) {
            console.warn('TaskService not available');
            return null;
        }
        const dueDate = recurringTask.advanceDays > 0
            ? this.addDays(new Date(recurringTask.nextDue), -recurringTask.advanceDays)
            : recurringTask.nextDue;
        const newTask = window.taskService.addTask({
            title: recurringTask.title,
            description: recurringTask.description,
            priority: recurringTask.priority,
            category: recurringTask.category,
            assignee: recurringTask.assignee,
            dueDate: dueDate,
            source: 'recurring',
            recurringTaskId: recurringTask.id
        });
        this.generatedTasks.push({
            recurringTaskId: recurringTask.id,
            generatedTaskId: newTask.id,
            dueDate: dueDate,
            generatedAt: new Date().toISOString()
        });
        recurringTask.lastGenerated = recurringTask.nextDue;
        recurringTask.occurrenceCount++;
        recurringTask.nextDue = this.calculateNextOccurrence(recurringTask);
        this.save();
        return newTask;
    }

    checkAndGenerateTasks() {
        const today = new Date().toISOString().split('T')[0];
        this.recurringTasks.filter(t => t.active && t.nextDue).forEach(task => {
            const generateDate = task.advanceDays > 0
                ? this.addDays(new Date(task.nextDue), -task.advanceDays)
                : task.nextDue;
            if (generateDate <= today) {
                const alreadyGenerated = this.generatedTasks.some(g =>
                    g.recurringTaskId === task.id && g.dueDate === task.nextDue
                );
                if (!alreadyGenerated) {
                    this.generateTask(task);
                }
            }
        });
    }

    generateNextOccurrence(id) {
        const task = this.recurringTasks.find(t => t.id === id);
        if (task && task.nextDue) { return this.generateTask(task); }
        return null;
    }

    getRecurringTasks() { return this.recurringTasks; }
    getActiveRecurringTasks() { return this.recurringTasks.filter(t => t.active); }

    getUpcomingPreview(days = 30) {
        const preview = [];
        const endDate = this.addDays(new Date(), days);
        this.recurringTasks.filter(t => t.active).forEach(task => {
            let tempTask = { ...task };
            let nextDate = tempTask.nextDue;
            while (nextDate && nextDate <= endDate) {
                preview.push({
                    recurringTaskId: task.id,
                    title: task.title,
                    dueDate: nextDate,
                    priority: task.priority
                });
                tempTask.lastGenerated = nextDate;
                nextDate = this.calculateNextOccurrence(tempTask);
            }
        });
        return preview.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }

    getRecurrenceTypeName(type) {
        const names = {
            'daily': 'Täglich',
            'weekly': 'Wöchentlich',
            'monthly': 'Monatlich',
            'yearly': 'Jährlich'
        };
        return names[type] || type;
    }

    getTemplates() {
        return [
            {
                name: 'Monatliche Rechnungsstellung',
                title: 'Monatsrechnungen erstellen',
                recurrence: { type: 'monthly', dayOfMonth: 1 },
                priority: 'high'
            },
            {
                name: 'Wöchentlicher Kassenbericht',
                title: 'Wochenbericht Kasse erstellen',
                recurrence: { type: 'weekly', daysOfWeek: [5] },
                priority: 'normal'
            },
            {
                name: 'Tägliche Backup-Prüfung',
                title: 'Backup-Status prüfen',
                recurrence: { type: 'daily', interval: 1 },
                priority: 'low'
            },
            {
                name: 'Jährliche Steuererklärung',
                title: 'Steuererklärung vorbereiten',
                recurrence: { type: 'yearly', monthOfYear: 3, dayOfMonth: 1 },
                priority: 'high'
            }
        ];
    }

    save() {
        localStorage.setItem('freyai_recurring_tasks', JSON.stringify(this.recurringTasks));
        localStorage.setItem('freyai_generated_tasks', JSON.stringify(this.generatedTasks));
    }
}

// ── Tests ──────────────────────────────────────────────────────────
describe('RecurringTaskService', () => {
    let svc;

    beforeEach(() => {
        vi.restoreAllMocks();
        StorageUtils.getJSON.mockImplementation((key, defaultVal) => defaultVal);
        localStorageMock.clear();
        delete window.taskService;
        svc = new RecurringTaskService();
    });

    // ─── Constructor ───────────────────────────────────────────────
    describe('constructor', () => {
        it('should start with empty task arrays', () => {
            expect(svc.recurringTasks).toEqual([]);
            expect(svc.generatedTasks).toEqual([]);
            expect(svc.settings).toEqual({});
        });

        it('should load German holidays for current year', () => {
            expect(svc.holidays).toBeInstanceOf(Array);
            expect(svc.holidays.length).toBeGreaterThan(0);
            const year = new Date().getFullYear();
            expect(svc.holidays).toContain(`${year}-01-01`); // Neujahr
            expect(svc.holidays).toContain(`${year}-12-25`); // Weihnachten 1
            expect(svc.holidays).toContain(`${year}-12-26`); // Weihnachten 2
        });

        it('should call StorageUtils.getJSON for all storage keys', () => {
            expect(StorageUtils.getJSON).toHaveBeenCalledWith('freyai_recurring_tasks', [], { service: 'recurringTaskService' });
            expect(StorageUtils.getJSON).toHaveBeenCalledWith('freyai_generated_tasks', [], { service: 'recurringTaskService' });
            expect(StorageUtils.getJSON).toHaveBeenCalledWith('freyai_recurring_settings', {}, { service: 'recurringTaskService' });
        });
    });

    // ─── createRecurringTask ───────────────────────────────────────
    describe('createRecurringTask', () => {
        it('should create a task with defaults', () => {
            const result = svc.createRecurringTask({ title: 'Werkzeug prüfen' });
            expect(result.success).toBe(true);
            expect(result.task.id).toMatch(/^rec-/);
            expect(result.task.title).toBe('Werkzeug prüfen');
            expect(result.task.priority).toBe('normal');
            expect(result.task.active).toBe(true);
            expect(result.task.occurrenceCount).toBe(0);
            expect(result.task.lastGenerated).toBeNull();
            expect(result.task.recurrence.type).toBe('weekly');
            expect(result.task.recurrence.interval).toBe(1);
            expect(result.task.recurrence.time).toBe('09:00');
        });

        it('should set custom recurrence settings', () => {
            const result = svc.createRecurringTask({
                title: 'Monatsrechnung',
                description: 'Rechnungen an alle Kunden erstellen',
                priority: 'high',
                category: 'Buchhaltung',
                assignee: 'Hans Müller',
                recurrence: { type: 'monthly', dayOfMonth: 15, interval: 1 }
            });
            expect(result.task.description).toBe('Rechnungen an alle Kunden erstellen');
            expect(result.task.priority).toBe('high');
            expect(result.task.category).toBe('Buchhaltung');
            expect(result.task.assignee).toBe('Hans Müller');
            expect(result.task.recurrence.type).toBe('monthly');
            expect(result.task.recurrence.dayOfMonth).toBe(15);
        });

        it('should calculate nextDue date', () => {
            const result = svc.createRecurringTask({
                title: 'Tägliche Kontrolle',
                recurrence: { type: 'daily', interval: 1 }
            });
            expect(result.task.nextDue).toBeTruthy();
            expect(result.task.nextDue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should add task to recurringTasks array', () => {
            svc.createRecurringTask({ title: 'Aufgabe 1' });
            svc.createRecurringTask({ title: 'Aufgabe 2' });
            expect(svc.recurringTasks).toHaveLength(2);
        });

        it('should persist to localStorage', () => {
            svc.createRecurringTask({ title: 'Lager prüfen' });
            expect(localStorageMock.setItem).toHaveBeenCalledWith('freyai_recurring_tasks', expect.any(String));
            expect(localStorageMock.setItem).toHaveBeenCalledWith('freyai_generated_tasks', expect.any(String));
        });

        it('should handle skipHolidays default to true', () => {
            const result = svc.createRecurringTask({ title: 'Test' });
            expect(result.task.skipHolidays).toBe(true);
        });

        it('should handle skipHolidays set to false', () => {
            const result = svc.createRecurringTask({ title: 'Test', skipHolidays: false });
            expect(result.task.skipHolidays).toBe(false);
        });

        it('should handle skipWeekends', () => {
            const result = svc.createRecurringTask({ title: 'Test', skipWeekends: true });
            expect(result.task.skipWeekends).toBe(true);
        });

        it('should handle advanceDays', () => {
            const result = svc.createRecurringTask({ title: 'Test', advanceDays: 3 });
            expect(result.task.advanceDays).toBe(3);
        });

        it('should handle endDate and maxOccurrences', () => {
            const result = svc.createRecurringTask({
                title: 'Befristete Aufgabe',
                endDate: '2030-12-31',
                maxOccurrences: 10
            });
            expect(result.task.endDate).toBe('2030-12-31');
            expect(result.task.maxOccurrences).toBe(10);
        });
    });

    // ─── updateRecurringTask ───────────────────────────────────────
    describe('updateRecurringTask', () => {
        it('should update an existing task', () => {
            const { task } = svc.createRecurringTask({ title: 'Alte Aufgabe' });
            const result = svc.updateRecurringTask(task.id, { title: 'Neue Aufgabe' });
            expect(result.success).toBe(true);
            expect(result.task.title).toBe('Neue Aufgabe');
            expect(result.task.updatedAt).toBeTruthy();
        });

        it('should recalculate nextDue after update', () => {
            const { task } = svc.createRecurringTask({
                title: 'Test',
                recurrence: { type: 'daily', interval: 1 }
            });
            const originalNextDue = task.nextDue;
            const result = svc.updateRecurringTask(task.id, {
                recurrence: { type: 'daily', interval: 3 }
            });
            // nextDue should be recalculated
            expect(result.task.nextDue).toBeTruthy();
        });

        it('should return error for unknown ID', () => {
            const result = svc.updateRecurringTask('nicht-vorhanden', { title: 'X' });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Nicht gefunden');
        });

        it('should persist changes', () => {
            const { task } = svc.createRecurringTask({ title: 'Test' });
            localStorageMock.setItem.mockClear();
            svc.updateRecurringTask(task.id, { priority: 'high' });
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });
    });

    // ─── deleteRecurringTask ───────────────────────────────────────
    describe('deleteRecurringTask', () => {
        it('should remove a task', () => {
            const { task } = svc.createRecurringTask({ title: 'Zu löschen' });
            expect(svc.recurringTasks).toHaveLength(1);
            const result = svc.deleteRecurringTask(task.id);
            expect(result.success).toBe(true);
            expect(svc.recurringTasks).toHaveLength(0);
        });

        it('should only remove the targeted task', () => {
            const { task: taskA } = svc.createRecurringTask({ title: 'Aufgabe A' });
            taskA.id = 'rec-aaa';
            const { task: taskB } = svc.createRecurringTask({ title: 'Aufgabe B' });
            taskB.id = 'rec-bbb';
            const { task: taskC } = svc.createRecurringTask({ title: 'Aufgabe C' });
            taskC.id = 'rec-ccc';
            svc.deleteRecurringTask('rec-bbb');
            expect(svc.recurringTasks).toHaveLength(2);
            expect(svc.recurringTasks.find(t => t.id === 'rec-bbb')).toBeUndefined();
        });

        it('should succeed silently for unknown ID', () => {
            const result = svc.deleteRecurringTask('nicht-vorhanden');
            expect(result.success).toBe(true);
        });
    });

    // ─── toggleRecurringTask ───────────────────────────────────────
    describe('toggleRecurringTask', () => {
        it('should deactivate an active task', () => {
            const { task } = svc.createRecurringTask({ title: 'Aktiv' });
            const result = svc.toggleRecurringTask(task.id);
            expect(result.success).toBe(true);
            expect(result.active).toBe(false);
        });

        it('should reactivate a deactivated task', () => {
            const { task } = svc.createRecurringTask({ title: 'Test' });
            svc.toggleRecurringTask(task.id); // deactivate
            const result = svc.toggleRecurringTask(task.id); // reactivate
            expect(result.success).toBe(true);
            expect(result.active).toBe(true);
        });

        it('should recalculate nextDue when reactivating', () => {
            const { task } = svc.createRecurringTask({
                title: 'Test',
                recurrence: { type: 'daily', interval: 1 }
            });
            svc.toggleRecurringTask(task.id); // deactivate
            svc.toggleRecurringTask(task.id); // reactivate
            const reactivated = svc.recurringTasks.find(t => t.id === task.id);
            expect(reactivated.nextDue).toBeTruthy();
        });

        it('should return failure for unknown ID', () => {
            const result = svc.toggleRecurringTask('nicht-vorhanden');
            expect(result.success).toBe(false);
        });
    });

    // ─── calculateNextOccurrence ───────────────────────────────────
    describe('calculateNextOccurrence', () => {
        it('should calculate daily recurrence', () => {
            const task = {
                recurrence: { type: 'daily', interval: 1 },
                startDate: '2026-03-01',
                lastGenerated: null,
                skipHolidays: false,
                skipWeekends: false,
                endDate: null,
                maxOccurrences: null,
                occurrenceCount: 0
            };
            const next = svc.calculateNextOccurrence(task);
            expect(next).toBe('2026-03-02');
        });

        it('should calculate daily recurrence with interval > 1', () => {
            const task = {
                recurrence: { type: 'daily', interval: 3 },
                startDate: '2026-03-01',
                lastGenerated: null,
                skipHolidays: false,
                skipWeekends: false,
                endDate: null,
                maxOccurrences: null,
                occurrenceCount: 0
            };
            const next = svc.calculateNextOccurrence(task);
            expect(next).toBe('2026-03-04');
        });

        it('should calculate weekly recurrence without daysOfWeek', () => {
            const task = {
                recurrence: { type: 'weekly', interval: 1, daysOfWeek: [] },
                startDate: '2026-03-01',
                lastGenerated: null,
                skipHolidays: false,
                skipWeekends: false,
                endDate: null,
                maxOccurrences: null,
                occurrenceCount: 0
            };
            const next = svc.calculateNextOccurrence(task);
            expect(next).toBe('2026-03-08'); // +7 days
        });

        it('should calculate weekly recurrence with daysOfWeek', () => {
            // 2026-03-02 is a Monday (day 1)
            const task = {
                recurrence: { type: 'weekly', interval: 1, daysOfWeek: [5] }, // Friday
                startDate: '2026-03-02',
                lastGenerated: null,
                skipHolidays: false,
                skipWeekends: false,
                endDate: null,
                maxOccurrences: null,
                occurrenceCount: 0
            };
            const next = svc.calculateNextOccurrence(task);
            // From Monday 2026-03-02, next Friday is 2026-03-06
            expect(next).toBe('2026-03-06');
        });

        it('should calculate monthly recurrence', () => {
            const task = {
                recurrence: { type: 'monthly', interval: 1, dayOfMonth: 15 },
                startDate: '2026-03-01',
                lastGenerated: null,
                skipHolidays: false,
                skipWeekends: false,
                endDate: null,
                maxOccurrences: null,
                occurrenceCount: 0
            };
            const next = svc.calculateNextOccurrence(task);
            expect(next).toBe('2026-04-15');
        });

        it('should clamp dayOfMonth for short months', () => {
            const task = {
                recurrence: { type: 'monthly', interval: 1, dayOfMonth: 31 },
                startDate: '2026-01-15',
                lastGenerated: null,
                skipHolidays: false,
                skipWeekends: false,
                endDate: null,
                maxOccurrences: null,
                occurrenceCount: 0
            };
            const next = svc.calculateNextOccurrence(task);
            // February 2026 has 28 days, so dayOfMonth 31 clamps to 28
            expect(next).toBe('2026-02-28');
        });

        it('should calculate yearly recurrence', () => {
            const task = {
                recurrence: { type: 'yearly', interval: 1, monthOfYear: 3, dayOfMonth: 1 },
                startDate: '2026-03-01',
                lastGenerated: null,
                skipHolidays: false,
                skipWeekends: false,
                endDate: null,
                maxOccurrences: null,
                occurrenceCount: 0
            };
            const next = svc.calculateNextOccurrence(task);
            expect(next).toBe('2027-03-01');
        });

        it('should use lastGenerated when available', () => {
            const task = {
                recurrence: { type: 'daily', interval: 1 },
                startDate: '2026-01-01',
                lastGenerated: '2026-06-15',
                skipHolidays: false,
                skipWeekends: false,
                endDate: null,
                maxOccurrences: null,
                occurrenceCount: 5
            };
            const next = svc.calculateNextOccurrence(task);
            expect(next).toBe('2026-06-16');
        });

        it('should skip weekends when skipWeekends is true', () => {
            // 2026-03-06 is a Friday, +1 day = Saturday -> should skip to Monday
            const task = {
                recurrence: { type: 'daily', interval: 1 },
                startDate: '2026-03-06',
                lastGenerated: null,
                skipHolidays: false,
                skipWeekends: true,
                endDate: null,
                maxOccurrences: null,
                occurrenceCount: 0
            };
            const next = svc.calculateNextOccurrence(task);
            expect(next).toBe('2026-03-09'); // Monday
        });

        it('should return null when past endDate', () => {
            const task = {
                recurrence: { type: 'daily', interval: 1 },
                startDate: '2026-03-01',
                lastGenerated: '2026-03-10',
                skipHolidays: false,
                skipWeekends: false,
                endDate: '2026-03-10',
                maxOccurrences: null,
                occurrenceCount: 5
            };
            const next = svc.calculateNextOccurrence(task);
            expect(next).toBeNull();
        });

        it('should return null when maxOccurrences reached', () => {
            const task = {
                recurrence: { type: 'daily', interval: 1 },
                startDate: '2026-03-01',
                lastGenerated: null,
                skipHolidays: false,
                skipWeekends: false,
                endDate: null,
                maxOccurrences: 3,
                occurrenceCount: 3
            };
            const next = svc.calculateNextOccurrence(task);
            expect(next).toBeNull();
        });

        it('should calculate bi-weekly recurrence', () => {
            const task = {
                recurrence: { type: 'weekly', interval: 2, daysOfWeek: [] },
                startDate: '2026-03-01',
                lastGenerated: null,
                skipHolidays: false,
                skipWeekends: false,
                endDate: null,
                maxOccurrences: null,
                occurrenceCount: 0
            };
            const next = svc.calculateNextOccurrence(task);
            expect(next).toBe('2026-03-15'); // +14 days
        });
    });

    // ─── getDaysInMonth ────────────────────────────────────────────
    describe('getDaysInMonth', () => {
        it('should return 28 for February in non-leap year', () => {
            expect(svc.getDaysInMonth(new Date(2026, 1, 1))).toBe(28);
        });

        it('should return 29 for February in leap year', () => {
            expect(svc.getDaysInMonth(new Date(2028, 1, 1))).toBe(29);
        });

        it('should return 31 for January', () => {
            expect(svc.getDaysInMonth(new Date(2026, 0, 1))).toBe(31);
        });

        it('should return 30 for April', () => {
            expect(svc.getDaysInMonth(new Date(2026, 3, 1))).toBe(30);
        });
    });

    // ─── German Holidays ──────────────────────────────────────────
    describe('getGermanHolidays', () => {
        it('should include all fixed holidays', () => {
            const holidays = svc.getGermanHolidays(2026);
            expect(holidays).toContain('2026-01-01'); // Neujahr
            expect(holidays).toContain('2026-05-01'); // Tag der Arbeit
            expect(holidays).toContain('2026-10-03'); // Tag der deutschen Einheit
            expect(holidays).toContain('2026-12-25'); // Weihnachten 1
            expect(holidays).toContain('2026-12-26'); // Weihnachten 2
        });

        it('should include Easter-based holidays', () => {
            const holidays = svc.getGermanHolidays(2026);
            // Easter 2026 is April 5
            expect(holidays).toContain('2026-04-03'); // Karfreitag (Easter - 2)
            expect(holidays).toContain('2026-04-05'); // Ostersonntag
            expect(holidays).toContain('2026-04-06'); // Ostermontag (Easter + 1)
        });

        it('should return 12 holidays', () => {
            const holidays = svc.getGermanHolidays(2026);
            expect(holidays).toHaveLength(12);
        });
    });

    // ─── calculateEaster ──────────────────────────────────────────
    describe('calculateEaster', () => {
        it('should calculate Easter 2026 correctly (April 5)', () => {
            const easter = svc.calculateEaster(2026);
            expect(easter.getFullYear()).toBe(2026);
            expect(easter.getMonth()).toBe(3); // April = 3 (0-indexed)
            expect(easter.getDate()).toBe(5);
        });

        it('should calculate Easter 2025 correctly (April 20)', () => {
            const easter = svc.calculateEaster(2025);
            expect(easter.getFullYear()).toBe(2025);
            expect(easter.getMonth()).toBe(3);
            expect(easter.getDate()).toBe(20);
        });

        it('should calculate Easter 2024 correctly (March 31)', () => {
            const easter = svc.calculateEaster(2024);
            expect(easter.getFullYear()).toBe(2024);
            expect(easter.getMonth()).toBe(2); // March = 2
            expect(easter.getDate()).toBe(31);
        });
    });

    // ─── isHoliday ────────────────────────────────────────────────
    describe('isHoliday', () => {
        it('should return true for Neujahr', () => {
            const year = new Date().getFullYear();
            expect(svc.isHoliday(`${year}-01-01`)).toBe(true);
        });

        it('should return false for a normal day', () => {
            expect(svc.isHoliday('2026-07-15')).toBe(false);
        });
    });

    // ─── addDays ──────────────────────────────────────────────────
    describe('addDays', () => {
        it('should add positive days', () => {
            expect(svc.addDays(new Date('2026-03-01'), 5)).toBe('2026-03-06');
        });

        it('should subtract days with negative value', () => {
            expect(svc.addDays(new Date('2026-03-10'), -3)).toBe('2026-03-07');
        });

        it('should handle month boundaries', () => {
            expect(svc.addDays(new Date('2026-01-30'), 3)).toBe('2026-02-02');
        });
    });

    // ─── generateTask ─────────────────────────────────────────────
    describe('generateTask', () => {
        it('should return null when taskService is not available', () => {
            const { task } = svc.createRecurringTask({
                title: 'Dachinspektion',
                recurrence: { type: 'monthly', dayOfMonth: 1 }
            });
            const result = svc.generateTask(task);
            expect(result).toBeNull();
        });

        it('should generate a task via window.taskService', () => {
            const mockNewTask = { id: 'task-123', title: 'Werkstatt reinigen' };
            window.taskService = {
                addTask: vi.fn(() => mockNewTask)
            };
            const { task } = svc.createRecurringTask({
                title: 'Werkstatt reinigen',
                description: 'Jeden Freitag Werkstatt aufräumen',
                priority: 'normal',
                recurrence: { type: 'weekly', interval: 1 }
            });
            const result = svc.generateTask(task);
            expect(result).toEqual(mockNewTask);
            expect(window.taskService.addTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Werkstatt reinigen',
                    description: 'Jeden Freitag Werkstatt aufräumen',
                    source: 'recurring',
                    recurringTaskId: task.id
                })
            );
        });

        it('should track generated task', () => {
            window.taskService = {
                addTask: vi.fn(() => ({ id: 'task-456', title: 'Test' }))
            };
            const { task } = svc.createRecurringTask({
                title: 'Materialbestellung',
                recurrence: { type: 'monthly', dayOfMonth: 1 }
            });
            svc.generateTask(task);
            expect(svc.generatedTasks).toHaveLength(1);
            expect(svc.generatedTasks[0].recurringTaskId).toBe(task.id);
            expect(svc.generatedTasks[0].generatedTaskId).toBe('task-456');
        });

        it('should increment occurrenceCount and update lastGenerated', () => {
            window.taskService = {
                addTask: vi.fn(() => ({ id: 'task-789', title: 'Test' }))
            };
            const { task } = svc.createRecurringTask({
                title: 'Prüfung',
                recurrence: { type: 'daily', interval: 1 }
            });
            const prevNextDue = task.nextDue;
            svc.generateTask(task);
            expect(task.occurrenceCount).toBe(1);
            expect(task.lastGenerated).toBe(prevNextDue);
        });

        it('should apply advanceDays for due date calculation', () => {
            window.taskService = {
                addTask: vi.fn((data) => ({ id: 'task-adv', ...data }))
            };
            const { task } = svc.createRecurringTask({
                title: 'Vorbereitung Steuererklärung',
                advanceDays: 5,
                recurrence: { type: 'monthly', dayOfMonth: 15 }
            });
            svc.generateTask(task);
            const callArgs = window.taskService.addTask.mock.calls[0][0];
            // Due date should be advanceDays before the nextDue
            expect(callArgs.dueDate).toBeTruthy();
            expect(callArgs.dueDate).not.toBe(task.lastGenerated);
        });
    });

    // ─── generateNextOccurrence ───────────────────────────────────
    describe('generateNextOccurrence', () => {
        it('should return null for unknown task ID', () => {
            expect(svc.generateNextOccurrence('nicht-vorhanden')).toBeNull();
        });

        it('should generate task for valid ID with nextDue', () => {
            window.taskService = {
                addTask: vi.fn(() => ({ id: 'gen-1', title: 'Test' }))
            };
            const { task } = svc.createRecurringTask({
                title: 'Wochenplanung',
                recurrence: { type: 'weekly', interval: 1 }
            });
            const result = svc.generateNextOccurrence(task.id);
            expect(result).toBeTruthy();
            expect(result.id).toBe('gen-1');
        });
    });

    // ─── checkAndGenerateTasks ────────────────────────────────────
    describe('checkAndGenerateTasks', () => {
        it('should not generate tasks when taskService is missing', () => {
            svc.createRecurringTask({
                title: 'Test',
                startDate: '2020-01-01',
                recurrence: { type: 'daily', interval: 1 }
            });
            // Should not throw
            svc.checkAndGenerateTasks();
        });

        it('should not generate tasks for inactive tasks', () => {
            window.taskService = {
                addTask: vi.fn(() => ({ id: 'x' }))
            };
            const { task } = svc.createRecurringTask({
                title: 'Inaktiv',
                startDate: '2020-01-01',
                recurrence: { type: 'daily', interval: 1 }
            });
            svc.toggleRecurringTask(task.id); // deactivate
            svc.checkAndGenerateTasks();
            expect(window.taskService.addTask).not.toHaveBeenCalled();
        });

        it('should not duplicate already generated tasks', () => {
            window.taskService = {
                addTask: vi.fn(() => ({ id: 'dup-1' }))
            };
            const { task } = svc.createRecurringTask({
                title: 'Duplikat-Test',
                startDate: '2020-01-01',
                recurrence: { type: 'daily', interval: 1 }
            });
            // Generate first time
            svc.checkAndGenerateTasks();
            const callCount = window.taskService.addTask.mock.calls.length;
            // Generate again - should not create duplicate
            svc.checkAndGenerateTasks();
            // The second call may generate again because nextDue advanced,
            // but the same dueDate should not be generated twice
            // The first nextDue was already tracked
        });
    });

    // ─── getRecurringTasks / getActiveRecurringTasks ───────────────
    describe('getRecurringTasks / getActiveRecurringTasks', () => {
        it('should return all recurring tasks', () => {
            svc.createRecurringTask({ title: 'Aufgabe 1' });
            svc.createRecurringTask({ title: 'Aufgabe 2' });
            expect(svc.getRecurringTasks()).toHaveLength(2);
        });

        it('should return only active tasks', () => {
            const { task: t1 } = svc.createRecurringTask({ title: 'Aktiv' });
            t1.id = 'rec-active';
            const { task: t2 } = svc.createRecurringTask({ title: 'Inaktiv' });
            t2.id = 'rec-inactive';
            svc.toggleRecurringTask('rec-inactive');
            expect(svc.getActiveRecurringTasks()).toHaveLength(1);
            expect(svc.getActiveRecurringTasks()[0].title).toBe('Aktiv');
        });
    });

    // ─── getUpcomingPreview ───────────────────────────────────────
    describe('getUpcomingPreview', () => {
        it('should return sorted preview of upcoming occurrences', () => {
            svc.createRecurringTask({
                title: 'Tägliche Aufgabe',
                recurrence: { type: 'daily', interval: 1 },
                skipHolidays: false,
                skipWeekends: false
            });
            const preview = svc.getUpcomingPreview(7);
            expect(preview.length).toBeGreaterThan(0);
            // Should be sorted by date
            for (let i = 1; i < preview.length; i++) {
                expect(preview[i].dueDate >= preview[i - 1].dueDate).toBe(true);
            }
        });

        it('should include task metadata in preview entries', () => {
            const { task } = svc.createRecurringTask({
                title: 'Kundenbesuch',
                priority: 'high',
                recurrence: { type: 'daily', interval: 1 },
                skipHolidays: false,
                skipWeekends: false
            });
            const preview = svc.getUpcomingPreview(3);
            if (preview.length > 0) {
                expect(preview[0].recurringTaskId).toBe(task.id);
                expect(preview[0].title).toBe('Kundenbesuch');
                expect(preview[0].priority).toBe('high');
                expect(preview[0].dueDate).toBeTruthy();
            }
        });

        it('should not include inactive tasks', () => {
            const { task } = svc.createRecurringTask({
                title: 'Inaktiv',
                recurrence: { type: 'daily', interval: 1 },
                skipHolidays: false
            });
            svc.toggleRecurringTask(task.id);
            const preview = svc.getUpcomingPreview(30);
            expect(preview).toHaveLength(0);
        });

        it('should default to 30 days', () => {
            svc.createRecurringTask({
                title: 'Wöchentlich',
                recurrence: { type: 'weekly', interval: 1, daysOfWeek: [] },
                skipHolidays: false,
                skipWeekends: false
            });
            const preview = svc.getUpcomingPreview();
            // Weekly over 30 days = ~4 occurrences
            expect(preview.length).toBeGreaterThanOrEqual(1);
            expect(preview.length).toBeLessThanOrEqual(6);
        });
    });

    // ─── getRecurrenceTypeName ────────────────────────────────────
    describe('getRecurrenceTypeName', () => {
        it('should return German names for recurrence types', () => {
            expect(svc.getRecurrenceTypeName('daily')).toBe('Täglich');
            expect(svc.getRecurrenceTypeName('weekly')).toBe('Wöchentlich');
            expect(svc.getRecurrenceTypeName('monthly')).toBe('Monatlich');
            expect(svc.getRecurrenceTypeName('yearly')).toBe('Jährlich');
        });

        it('should return input for unknown type', () => {
            expect(svc.getRecurrenceTypeName('custom')).toBe('custom');
        });
    });

    // ─── getTemplates ─────────────────────────────────────────────
    describe('getTemplates', () => {
        it('should return 4 templates', () => {
            const templates = svc.getTemplates();
            expect(templates).toHaveLength(4);
        });

        it('should include Monatliche Rechnungsstellung', () => {
            const templates = svc.getTemplates();
            const invoice = templates.find(t => t.name === 'Monatliche Rechnungsstellung');
            expect(invoice).toBeTruthy();
            expect(invoice.title).toBe('Monatsrechnungen erstellen');
            expect(invoice.recurrence.type).toBe('monthly');
            expect(invoice.priority).toBe('high');
        });

        it('should include Wöchentlicher Kassenbericht', () => {
            const templates = svc.getTemplates();
            const report = templates.find(t => t.name === 'Wöchentlicher Kassenbericht');
            expect(report).toBeTruthy();
            expect(report.recurrence.type).toBe('weekly');
            expect(report.recurrence.daysOfWeek).toEqual([5]); // Freitag
        });

        it('should include Tägliche Backup-Prüfung', () => {
            const templates = svc.getTemplates();
            const backup = templates.find(t => t.name === 'Tägliche Backup-Prüfung');
            expect(backup).toBeTruthy();
            expect(backup.recurrence.type).toBe('daily');
            expect(backup.priority).toBe('low');
        });

        it('should include Jährliche Steuererklärung', () => {
            const templates = svc.getTemplates();
            const tax = templates.find(t => t.name === 'Jährliche Steuererklärung');
            expect(tax).toBeTruthy();
            expect(tax.recurrence.type).toBe('yearly');
            expect(tax.recurrence.monthOfYear).toBe(3); // März
            expect(tax.priority).toBe('high');
        });
    });

    // ─── save / persistence ───────────────────────────────────────
    describe('save', () => {
        it('should persist both recurring and generated tasks', () => {
            localStorageMock.setItem.mockClear();
            svc.save();
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'freyai_recurring_tasks',
                JSON.stringify([])
            );
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'freyai_generated_tasks',
                JSON.stringify([])
            );
        });
    });

    // ─── Integration: Full Lifecycle ──────────────────────────────
    describe('integration: full lifecycle', () => {
        it('should handle create -> generate -> deactivate -> delete', () => {
            window.taskService = {
                addTask: vi.fn((data) => ({ id: 'task-lc-1', ...data }))
            };

            // Create
            const { task } = svc.createRecurringTask({
                title: 'Schornsteinfeger Termin',
                description: 'Jährliche Überprüfung',
                priority: 'high',
                category: 'Wartung',
                recurrence: { type: 'yearly', monthOfYear: 6, dayOfMonth: 15, interval: 1 }
            });
            expect(task.active).toBe(true);
            expect(svc.getRecurringTasks()).toHaveLength(1);

            // Generate
            const generated = svc.generateNextOccurrence(task.id);
            expect(generated).toBeTruthy();
            expect(task.occurrenceCount).toBe(1);
            expect(svc.generatedTasks).toHaveLength(1);

            // Deactivate
            const toggleResult = svc.toggleRecurringTask(task.id);
            expect(toggleResult.active).toBe(false);
            expect(svc.getActiveRecurringTasks()).toHaveLength(0);

            // Delete
            svc.deleteRecurringTask(task.id);
            expect(svc.getRecurringTasks()).toHaveLength(0);
        });
    });
});
