import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────
const StorageUtils = {
    getJSON: vi.fn((key, defaultVal) => defaultVal),
    setJSON: vi.fn(() => true),
    safeDate: vi.fn(str => str ? new Date(str) : null)
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

// ── Inline Class ───────────────────────────────────────────────────
class TaskService {
    constructor() {
        this.tasks = StorageUtils.getJSON('freyai_tasks', [], { service: 'taskService' });
        this.recurringTasks = StorageUtils.getJSON('freyai_recurring_tasks', [], { service: 'taskService' });
    }

    addTask(task) {
        const newTask = {
            id: task.id || this.generateId(),
            title: task.title, description: task.description || '',
            priority: task.priority || 'normal', status: task.status || 'offen',
            dueDate: task.dueDate || null, assignee: task.assignee || null,
            category: task.category || 'allgemein', tags: task.tags || [],
            source: task.source || 'manual', sourceId: task.sourceId || null,
            customer: task.customer || null, auftragId: task.auftragId || null,
            notes: task.notes || [], subtasks: task.subtasks || [],
            timeEstimate: task.timeEstimate || null, timeSpent: task.timeSpent || 0,
            createdAt: task.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(), completedAt: null
        };
        this.tasks.push(newTask);
        this.save();
        return newTask;
    }

    updateTask(id, updates) {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            this.tasks[index] = { ...this.tasks[index], ...updates, updatedAt: new Date().toISOString() };
            if (updates.status === 'erledigt') { this.tasks[index].completedAt = new Date().toISOString(); }
            this.save();
            return this.tasks[index];
        }
        return null;
    }

    deleteTask(id) { this.tasks = this.tasks.filter(t => t.id !== id); this.save(); }
    getTask(id) { return this.tasks.find(t => t.id === id); }
    completeTask(id) { return this.updateTask(id, { status: 'erledigt' }); }
    reopenTask(id) { return this.updateTask(id, { status: 'offen', completedAt: null }); }

    addSubtask(taskId, subtask) {
        const task = this.getTask(taskId);
        if (task) { task.subtasks.push({ id: 'sub-' + Date.now(), title: subtask.title, completed: false }); this.save(); }
        return task;
    }

    toggleSubtask(taskId, subtaskId) {
        const task = this.getTask(taskId);
        if (task) {
            const subtask = task.subtasks.find(s => s.id === subtaskId);
            if (subtask) { subtask.completed = !subtask.completed; this.save(); }
        }
    }

    addNote(taskId, noteText) {
        const task = this.getTask(taskId);
        if (task) { task.notes.push({ id: 'note-' + Date.now(), text: noteText, createdAt: new Date().toISOString() }); this.save(); }
        return task;
    }

    getAllTasks() { return this.tasks; }
    getOpenTasks() { return this.tasks.filter(t => t.status !== 'erledigt'); }
    getCompletedTasks() { return this.tasks.filter(t => t.status === 'erledigt'); }
    getTasksByStatus(status) { return this.tasks.filter(t => t.status === status); }
    getTasksByPriority(priority) { return this.tasks.filter(t => t.priority === priority && t.status !== 'erledigt'); }

    getTasksForToday() {
        const today = new Date().toISOString().split('T')[0];
        return this.tasks.filter(t => t.dueDate === today && t.status !== 'erledigt');
    }

    getOverdueTasks() {
        const today = new Date().toISOString().split('T')[0];
        return this.tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'erledigt');
    }

    getUpcomingTasks(days = 7) {
        const today = new Date();
        const future = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
        return this.tasks.filter(t => {
            if (!t.dueDate || t.status === 'erledigt') { return false; }
            const due = new Date(t.dueDate);
            return due > today && due <= future;
        }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }

    createRecurringTask(template) {
        const recurring = {
            id: 'rec-' + Date.now(), title: template.title,
            description: template.description || '', priority: template.priority || 'normal',
            frequency: template.frequency, weekdays: template.weekdays || [],
            monthDay: template.monthDay || null, lastGenerated: null, active: true
        };
        this.recurringTasks.push(recurring);
        this.saveRecurring();
        return recurring;
    }

    generateTasksFromEmail(email, emailService) {
        const mainTask = emailService.createTaskFromEmail(email);
        if (mainTask) { this.addTask(mainTask); }
        return mainTask;
    }

    getStatistics() {
        return {
            total: this.tasks.length,
            open: this.tasks.filter(t => t.status === 'offen').length,
            inProgress: this.tasks.filter(t => t.status === 'in_bearbeitung').length,
            completed: this.tasks.filter(t => t.status === 'erledigt').length,
            overdue: this.getOverdueTasks().length,
            dueToday: this.getTasksForToday().length,
            highPriority: this.tasks.filter(t => t.priority === 'high' && t.status !== 'erledigt').length
        };
    }

    getKanbanData() {
        return {
            offen: this.getTasksByStatus('offen'),
            in_bearbeitung: this.getTasksByStatus('in_bearbeitung'),
            warten: this.getTasksByStatus('warten'),
            erledigt: this.getTasksByStatus('erledigt').slice(0, 10)
        };
    }

    searchTasks(query) {
        const q = query.toLowerCase();
        return this.tasks.filter(t => (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
    }

    generateId() { return 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11); }
    getPriorityIcon(p) { return { low: '🔵', normal: '🟢', high: '🟠', urgent: '🔴' }[p] || '⚪'; }
    getPriorityLabel(p) { return { low: 'Niedrig', normal: 'Normal', high: 'Hoch', urgent: 'Dringend' }[p] || p; }
    getStatusIcon(s) { return { offen: '⭕', in_bearbeitung: '🔄', warten: '⏸️', erledigt: '✅' }[s] || '⚪'; }
    getStatusLabel(s) { return { offen: 'Offen', in_bearbeitung: 'In Bearbeitung', warten: 'Warten', erledigt: 'Erledigt' }[s] || s; }

    formatDate(dateStr) {
        if (!dateStr) { return '-'; }
        return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    save() { localStorage.setItem('freyai_tasks', JSON.stringify(this.tasks)); }
    saveRecurring() { localStorage.setItem('freyai_recurring_tasks', JSON.stringify(this.recurringTasks)); }
}

// ── Tests ──────────────────────────────────────────────────────────
describe('TaskService', () => {
    let svc;

    beforeEach(() => {
        vi.restoreAllMocks();
        StorageUtils.getJSON.mockImplementation((key, defaultVal) => defaultVal);
        localStorageMock.clear();
        svc = new TaskService();
    });

    // ─── Constructor ───────────────────────────────────────────────
    describe('constructor', () => {
        it('should start with empty tasks', () => {
            expect(svc.tasks).toEqual([]);
            expect(svc.recurringTasks).toEqual([]);
        });
    });

    // ─── addTask ───────────────────────────────────────────────────
    describe('addTask', () => {
        it('should create task with defaults', () => {
            const task = svc.addTask({ title: 'Test' });
            expect(task.title).toBe('Test');
            expect(task.priority).toBe('normal');
            expect(task.status).toBe('offen');
            expect(task.category).toBe('allgemein');
            expect(task.completedAt).toBeNull();
        });

        it('should generate ID when not provided', () => {
            const task = svc.addTask({ title: 'Test' });
            expect(task.id).toMatch(/^task-/);
        });

        it('should use provided ID', () => {
            const task = svc.addTask({ title: 'Test', id: 'custom-123' });
            expect(task.id).toBe('custom-123');
        });

        it('should persist', () => {
            svc.addTask({ title: 'Test' });
            expect(localStorageMock.setItem).toHaveBeenCalledWith('freyai_tasks', expect.any(String));
        });
    });

    // ─── updateTask ────────────────────────────────────────────────
    describe('updateTask', () => {
        it('should merge updates', () => {
            const task = svc.addTask({ title: 'Old' });
            const updated = svc.updateTask(task.id, { title: 'New' });
            expect(updated.title).toBe('New');
        });

        it('should set completedAt when status=erledigt', () => {
            const task = svc.addTask({ title: 'Test' });
            const updated = svc.updateTask(task.id, { status: 'erledigt' });
            expect(updated.completedAt).toBeTruthy();
        });

        it('should return null for unknown ID', () => {
            expect(svc.updateTask('nope', {})).toBeNull();
        });
    });

    // ─── completeTask / reopenTask ─────────────────────────────────
    describe('completeTask / reopenTask', () => {
        it('should complete a task', () => {
            const task = svc.addTask({ title: 'Test' });
            const completed = svc.completeTask(task.id);
            expect(completed.status).toBe('erledigt');
            expect(completed.completedAt).toBeTruthy();
        });

        it('should reopen a task', () => {
            const task = svc.addTask({ title: 'Test' });
            svc.completeTask(task.id);
            const reopened = svc.reopenTask(task.id);
            expect(reopened.status).toBe('offen');
        });
    });

    // ─── deleteTask ────────────────────────────────────────────────
    describe('deleteTask', () => {
        it('should remove task', () => {
            const task = svc.addTask({ title: 'Delete me' });
            svc.deleteTask(task.id);
            expect(svc.tasks).toHaveLength(0);
        });
    });

    // ─── Subtasks ──────────────────────────────────────────────────
    describe('subtasks', () => {
        it('should add subtask', () => {
            const task = svc.addTask({ title: 'Parent' });
            const updated = svc.addSubtask(task.id, { title: 'Child' });
            expect(updated.subtasks).toHaveLength(1);
            expect(updated.subtasks[0].completed).toBe(false);
        });

        it('should toggle subtask', () => {
            const task = svc.addTask({ title: 'Parent' });
            svc.addSubtask(task.id, { title: 'Child' });
            const subId = task.subtasks[0].id;
            svc.toggleSubtask(task.id, subId);
            expect(task.subtasks[0].completed).toBe(true);
            svc.toggleSubtask(task.id, subId);
            expect(task.subtasks[0].completed).toBe(false);
        });

        it('should return null for unknown task', () => {
            expect(svc.addSubtask('nope', { title: 'X' })).toBeUndefined();
        });
    });

    // ─── Notes ─────────────────────────────────────────────────────
    describe('notes', () => {
        it('should add note to task', () => {
            const task = svc.addTask({ title: 'Test' });
            svc.addNote(task.id, 'A note');
            expect(task.notes).toHaveLength(1);
            expect(task.notes[0].text).toBe('A note');
        });
    });

    // ─── Queries ───────────────────────────────────────────────────
    describe('queries', () => {
        beforeEach(() => {
            svc.addTask({ title: 'Open', status: 'offen' });
            svc.addTask({ title: 'Done', status: 'erledigt' });
            svc.addTask({ title: 'WIP', status: 'in_bearbeitung' });
        });

        it('should get all tasks', () => {
            expect(svc.getAllTasks()).toHaveLength(3);
        });

        it('should get open tasks', () => {
            expect(svc.getOpenTasks()).toHaveLength(2);
        });

        it('should get completed tasks', () => {
            expect(svc.getCompletedTasks()).toHaveLength(1);
        });

        it('should filter by status', () => {
            expect(svc.getTasksByStatus('in_bearbeitung')).toHaveLength(1);
        });
    });

    // ─── getTasksForToday / getOverdueTasks ────────────────────────
    describe('date queries', () => {
        it('should find tasks for today', () => {
            const today = new Date().toISOString().split('T')[0];
            svc.addTask({ title: 'Today', dueDate: today });
            svc.addTask({ title: 'Tomorrow', dueDate: '2099-12-31' });
            expect(svc.getTasksForToday()).toHaveLength(1);
        });

        it('should find overdue tasks', () => {
            svc.addTask({ title: 'Overdue', dueDate: '2020-01-01' });
            svc.addTask({ title: 'Future', dueDate: '2099-12-31' });
            expect(svc.getOverdueTasks()).toHaveLength(1);
        });

        it('should exclude completed from overdue', () => {
            const task = svc.addTask({ title: 'Overdue', dueDate: '2020-01-01' });
            svc.completeTask(task.id);
            expect(svc.getOverdueTasks()).toHaveLength(0);
        });

        it('should get upcoming tasks sorted by date', () => {
            svc.addTask({ title: 'Later', dueDate: '2099-12-30' });
            svc.addTask({ title: 'Sooner', dueDate: '2099-12-29' });
            const upcoming = svc.getUpcomingTasks(999999);
            expect(upcoming[0].title).toBe('Sooner');
        });
    });

    // ─── Priority queries ──────────────────────────────────────────
    describe('priority queries', () => {
        it('should filter by priority excluding completed', () => {
            svc.addTask({ title: 'High open', priority: 'high' });
            const done = svc.addTask({ title: 'High done', priority: 'high' });
            svc.completeTask(done.id);
            expect(svc.getTasksByPriority('high')).toHaveLength(1);
        });
    });

    // ─── Recurring Tasks ───────────────────────────────────────────
    describe('createRecurringTask', () => {
        it('should create recurring task with defaults', () => {
            const rec = svc.createRecurringTask({ title: 'Daily', frequency: 'daily' });
            expect(rec.id).toMatch(/^rec-/);
            expect(rec.frequency).toBe('daily');
            expect(rec.active).toBe(true);
            expect(rec.lastGenerated).toBeNull();
        });

        it('should persist recurring tasks', () => {
            svc.createRecurringTask({ title: 'Weekly', frequency: 'weekly' });
            expect(localStorageMock.setItem).toHaveBeenCalledWith('freyai_recurring_tasks', expect.any(String));
        });
    });

    // ─── generateTasksFromEmail ────────────────────────────────────
    describe('generateTasksFromEmail', () => {
        it('should create task from email service result', () => {
            const emailService = { createTaskFromEmail: vi.fn(() => ({ title: 'From email' })) };
            const result = svc.generateTasksFromEmail({ subject: 'Test' }, emailService);
            expect(result.title).toBe('From email');
            expect(svc.tasks).toHaveLength(1);
        });

        it('should handle null result', () => {
            const emailService = { createTaskFromEmail: vi.fn(() => null) };
            const result = svc.generateTasksFromEmail({}, emailService);
            expect(result).toBeNull();
            expect(svc.tasks).toHaveLength(0);
        });
    });

    // ─── Statistics ────────────────────────────────────────────────
    describe('getStatistics', () => {
        it('should return correct counts', () => {
            svc.addTask({ title: 'A', priority: 'high' });
            svc.addTask({ title: 'B', status: 'in_bearbeitung' });
            const c = svc.addTask({ title: 'C' });
            svc.completeTask(c.id);
            const stats = svc.getStatistics();
            expect(stats.total).toBe(3);
            expect(stats.open).toBe(1);
            expect(stats.inProgress).toBe(1);
            expect(stats.completed).toBe(1);
            expect(stats.highPriority).toBe(1);
        });
    });

    // ─── getKanbanData ─────────────────────────────────────────────
    describe('getKanbanData', () => {
        it('should return columns', () => {
            svc.addTask({ title: 'A', status: 'offen' });
            svc.addTask({ title: 'B', status: 'warten' });
            const kanban = svc.getKanbanData();
            expect(kanban.offen).toHaveLength(1);
            expect(kanban.warten).toHaveLength(1);
        });

        it('should limit erledigt to 10', () => {
            for (let i = 0; i < 15; i++) {
                svc.addTask({ title: `Done${i}`, status: 'erledigt' });
            }
            expect(svc.getKanbanData().erledigt).toHaveLength(10);
        });
    });

    // ─── searchTasks ───────────────────────────────────────────────
    describe('searchTasks', () => {
        it('should search by title', () => {
            svc.addTask({ title: 'Fix the roof' });
            svc.addTask({ title: 'Clean office' });
            expect(svc.searchTasks('roof')).toHaveLength(1);
        });

        it('should search by description', () => {
            svc.addTask({ title: 'Task', description: 'Dachziegel ersetzen' });
            expect(svc.searchTasks('dachziegel')).toHaveLength(1);
        });
    });

    // ─── Helpers ───────────────────────────────────────────────────
    describe('helpers', () => {
        it('should return priority labels', () => {
            expect(svc.getPriorityLabel('high')).toBe('Hoch');
            expect(svc.getPriorityLabel('unknown')).toBe('unknown');
        });

        it('should return status labels', () => {
            expect(svc.getStatusLabel('offen')).toBe('Offen');
            expect(svc.getStatusLabel('erledigt')).toBe('Erledigt');
        });

        it('should format date in German', () => {
            const formatted = svc.formatDate('2024-03-15');
            expect(formatted).toContain('15');
            expect(formatted).toContain('2024');
        });

        it('should return dash for null date', () => {
            expect(svc.formatDate(null)).toBe('-');
        });
    });
});
