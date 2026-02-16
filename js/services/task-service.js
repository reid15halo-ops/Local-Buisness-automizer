/* ============================================
   Task Service - Aufgabenverwaltung
   ============================================ */

class TaskService {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('mhs_tasks') || '[]');
        this.recurringTasks = JSON.parse(localStorage.getItem('mhs_recurring_tasks') || '[]');
        this.processRecurringTasks();
    }

    // Task CRUD
    addTask(task) {
        const newTask = {
            id: task.id || this.generateId(),
            title: task.title,
            description: task.description || '',
            priority: task.priority || 'normal',
            status: task.status || 'offen',
            dueDate: task.dueDate || null,
            assignee: task.assignee || null,
            category: task.category || 'allgemein',
            tags: task.tags || [],
            source: task.source || 'manual',
            sourceId: task.sourceId || null,
            customer: task.customer || null,
            auftragId: task.auftragId || null,
            notes: task.notes || [],
            subtasks: task.subtasks || [],
            timeEstimate: task.timeEstimate || null,
            timeSpent: task.timeSpent || 0,
            createdAt: task.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null
        };
        this.tasks.push(newTask);
        this.save();
        return newTask;
    }

    updateTask(id, updates) {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            this.tasks[index] = { ...this.tasks[index], ...updates, updatedAt: new Date().toISOString() };
            if (updates.status === 'erledigt') {this.tasks[index].completedAt = new Date().toISOString();}
            this.save();
            return this.tasks[index];
        }
        return null;
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.save();
    }

    getTask(id) { return this.tasks.find(t => t.id === id); }
    completeTask(id) { return this.updateTask(id, { status: 'erledigt' }); }
    reopenTask(id) { return this.updateTask(id, { status: 'offen', completedAt: null }); }

    // Subtasks
    addSubtask(taskId, subtask) {
        const task = this.getTask(taskId);
        if (task) {
            task.subtasks.push({ id: 'sub-' + Date.now(), title: subtask.title, completed: false });
            this.save();
        }
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
        if (task) {
            task.notes.push({ id: 'note-' + Date.now(), text: noteText, createdAt: new Date().toISOString() });
            this.save();
        }
        return task;
    }

    // Queries
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
            if (!t.dueDate || t.status === 'erledigt') {return false;}
            const due = new Date(t.dueDate);
            return due > today && due <= future;
        }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }

    // Recurring Tasks
    createRecurringTask(template) {
        const recurring = {
            id: 'rec-' + Date.now(),
            title: template.title,
            description: template.description || '',
            priority: template.priority || 'normal',
            frequency: template.frequency, // daily, weekly, monthly
            weekdays: template.weekdays || [],
            monthDay: template.monthDay || null,
            lastGenerated: null,
            active: true
        };
        this.recurringTasks.push(recurring);
        this.saveRecurring();
        return recurring;
    }

    processRecurringTasks() {
        const today = new Date().toISOString().split('T')[0];
        this.recurringTasks.forEach(rec => {
            if (!rec.active || rec.lastGenerated === today) {return;}
            if (this.shouldGenerateToday(rec)) {
                this.addTask({ title: rec.title, description: rec.description, priority: rec.priority, dueDate: today, source: 'recurring', sourceId: rec.id });
                rec.lastGenerated = today;
            }
        });
        this.saveRecurring();
    }

    shouldGenerateToday(rec) {
        const dayOfWeek = new Date().getDay();
        if (rec.frequency === 'daily') {return true;}
        if (rec.frequency === 'weekly') {return rec.weekdays.includes(dayOfWeek);}
        if (rec.frequency === 'monthly') {return new Date().getDate() === rec.monthDay;}
        return false;
    }

    // Generate from Email
    generateTasksFromEmail(email, emailService) {
        const mainTask = emailService.createTaskFromEmail(email);
        if (mainTask) {this.addTask(mainTask);}
        return mainTask;
    }

    // Statistics
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
        return this.tasks.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }

    // Helpers
    generateId() { return 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9); }
    getPriorityIcon(p) { return { low: '🔵', normal: '🟢', high: '🟠', urgent: '🔴' }[p] || '⚪'; }
    getPriorityLabel(p) { return { low: 'Niedrig', normal: 'Normal', high: 'Hoch', urgent: 'Dringend' }[p] || p; }
    getStatusIcon(s) { return { offen: '⭕', in_bearbeitung: '🔄', warten: '⏸️', erledigt: '✅' }[s] || '⚪'; }
    getStatusLabel(s) { return { offen: 'Offen', in_bearbeitung: 'In Bearbeitung', warten: 'Warten', erledigt: 'Erledigt' }[s] || s; }

    formatDate(dateStr) {
        if (!dateStr) {return '-';}
        return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    // Persistence
    save() { localStorage.setItem('mhs_tasks', JSON.stringify(this.tasks)); }
    saveRecurring() { localStorage.setItem('mhs_recurring_tasks', JSON.stringify(this.recurringTasks)); }
}

window.taskService = new TaskService();
