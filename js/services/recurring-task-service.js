/* ============================================
   Recurring Tasks Service (Feature #22)
   Automated recurring task creation
   ============================================ */

class RecurringTaskService {
    constructor() {
        this.recurringTasks = JSON.parse(localStorage.getItem('mhs_recurring_tasks') || '[]');
        this.generatedTasks = JSON.parse(localStorage.getItem('mhs_generated_tasks') || '[]');
        this.settings = JSON.parse(localStorage.getItem('mhs_recurring_settings') || '{}');

        // German holidays (static for now, could be dynamic)
        this.holidays = this.getGermanHolidays(new Date().getFullYear());

        // Start the scheduler
        this.startScheduler();
    }

    // Create a recurring task template
    createRecurringTask(taskData) {
        const task = {
            id: 'rec-' + Date.now(),
            title: taskData.title,
            description: taskData.description || '',
            priority: taskData.priority || 'normal',
            category: taskData.category || '',
            assignee: taskData.assignee || '',

            // Recurrence settings
            recurrence: {
                type: taskData.recurrence?.type || 'weekly', // daily, weekly, monthly, yearly
                interval: taskData.recurrence?.interval || 1, // every X days/weeks/months
                daysOfWeek: taskData.recurrence?.daysOfWeek || [], // [1,2,3,4,5] for Mon-Fri
                dayOfMonth: taskData.recurrence?.dayOfMonth || 1,
                monthOfYear: taskData.recurrence?.monthOfYear || 1,
                time: taskData.recurrence?.time || '09:00'
            },

            // Duration settings
            startDate: taskData.startDate || new Date().toISOString().split('T')[0],
            endDate: taskData.endDate || null, // null = no end
            maxOccurrences: taskData.maxOccurrences || null,

            // Behavior
            skipHolidays: taskData.skipHolidays !== false,
            skipWeekends: taskData.skipWeekends || false,
            advanceDays: taskData.advanceDays || 0, // Create task X days before due

            // State
            active: true,
            occurrenceCount: 0,
            lastGenerated: null,
            nextDue: null,
            createdAt: new Date().toISOString()
        };

        // Calculate first occurrence
        task.nextDue = this.calculateNextOccurrence(task);

        this.recurringTasks.push(task);
        this.save();

        return { success: true, task };
    }

    // Update recurring task
    updateRecurringTask(id, updates) {
        const task = this.recurringTasks.find(t => t.id === id);
        if (!task) return { success: false, error: 'Nicht gefunden' };

        Object.assign(task, updates, { updatedAt: new Date().toISOString() });
        task.nextDue = this.calculateNextOccurrence(task);
        this.save();

        return { success: true, task };
    }

    // Delete recurring task
    deleteRecurringTask(id) {
        this.recurringTasks = this.recurringTasks.filter(t => t.id !== id);
        this.save();
        return { success: true };
    }

    // Toggle active state
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

    // Calculate next occurrence date
    calculateNextOccurrence(task, fromDate = null) {
        const start = fromDate ? new Date(fromDate) : new Date();
        const rec = task.recurrence;
        let next = new Date(start);

        // If we have a lastGenerated, start from there
        if (task.lastGenerated) {
            next = new Date(task.lastGenerated);
        } else if (task.startDate) {
            next = new Date(task.startDate);
        }

        // Advance based on recurrence type
        switch (rec.type) {
            case 'daily':
                next.setDate(next.getDate() + rec.interval);
                break;

            case 'weekly':
                if (rec.daysOfWeek && rec.daysOfWeek.length > 0) {
                    // Find next matching day of week
                    let found = false;
                    for (let i = 1; i <= 7 * rec.interval && !found; i++) {
                        next.setDate(next.getDate() + 1);
                        if (rec.daysOfWeek.includes(next.getDay())) {
                            found = true;
                        }
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
                if (rec.monthOfYear) {
                    next.setMonth(rec.monthOfYear - 1);
                }
                if (rec.dayOfMonth) {
                    next.setDate(Math.min(rec.dayOfMonth, this.getDaysInMonth(next)));
                }
                break;
        }

        // Skip weekends if needed
        if (task.skipWeekends) {
            while (next.getDay() === 0 || next.getDay() === 6) {
                next.setDate(next.getDate() + 1);
            }
        }

        // Skip holidays if needed
        if (task.skipHolidays) {
            const nextStr = next.toISOString().split('T')[0];
            while (this.isHoliday(nextStr)) {
                next.setDate(next.getDate() + 1);
            }
        }

        // Check if past end date
        if (task.endDate && next > new Date(task.endDate)) {
            return null;
        }

        // Check max occurrences
        if (task.maxOccurrences && task.occurrenceCount >= task.maxOccurrences) {
            return null;
        }

        return next.toISOString().split('T')[0];
    }

    // Get days in month
    getDaysInMonth(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }

    // Check if date is a holiday
    isHoliday(dateStr) {
        return this.holidays.includes(dateStr);
    }

    // Get German holidays for a year
    getGermanHolidays(year) {
        const holidays = [];

        // Fixed holidays
        holidays.push(`${year}-01-01`); // Neujahr
        holidays.push(`${year}-05-01`); // Tag der Arbeit
        holidays.push(`${year}-10-03`); // Tag der deutschen Einheit
        holidays.push(`${year}-12-25`); // Weihnachten 1
        holidays.push(`${year}-12-26`); // Weihnachten 2

        // Calculate Easter-based holidays
        const easter = this.calculateEaster(year);
        holidays.push(this.addDays(easter, -2));  // Karfreitag
        holidays.push(this.addDays(easter, 0));   // Ostersonntag
        holidays.push(this.addDays(easter, 1));   // Ostermontag
        holidays.push(this.addDays(easter, 39));  // Christi Himmelfahrt
        holidays.push(this.addDays(easter, 49));  // Pfingstsonntag
        holidays.push(this.addDays(easter, 50));  // Pfingstmontag
        holidays.push(this.addDays(easter, 60));  // Fronleichnam (Bayern)

        return holidays;
    }

    // Calculate Easter Sunday (Anonymous Gregorian algorithm)
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

    // Add days to date and return ISO string
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().split('T')[0];
    }

    // Generate task from recurring template
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

        // Track generated task
        this.generatedTasks.push({
            recurringTaskId: recurringTask.id,
            generatedTaskId: newTask.id,
            dueDate: dueDate,
            generatedAt: new Date().toISOString()
        });

        // Update recurring task
        recurringTask.lastGenerated = recurringTask.nextDue;
        recurringTask.occurrenceCount++;
        recurringTask.nextDue = this.calculateNextOccurrence(recurringTask);

        this.save();

        return newTask;
    }

    // Check and generate due tasks
    checkAndGenerateTasks() {
        const today = new Date().toISOString().split('T')[0];

        this.recurringTasks.filter(t => t.active && t.nextDue).forEach(task => {
            // Generate task if due today or earlier (with advance days)
            const generateDate = task.advanceDays > 0
                ? this.addDays(new Date(task.nextDue), -task.advanceDays)
                : task.nextDue;

            if (generateDate <= today) {
                // Check if already generated today
                const alreadyGenerated = this.generatedTasks.some(g =>
                    g.recurringTaskId === task.id &&
                    g.dueDate === task.nextDue
                );

                if (!alreadyGenerated) {
                    this.generateTask(task);
                }
            }
        });
    }

    // Start the scheduler (check every hour)
    startScheduler() {
        // Check immediately
        setTimeout(() => this.checkAndGenerateTasks(), 5000);

        // Then check every hour
        setInterval(() => this.checkAndGenerateTasks(), 3600000);
    }

    // Manual trigger to generate next occurrence
    generateNextOccurrence(id) {
        const task = this.recurringTasks.find(t => t.id === id);
        if (task && task.nextDue) {
            return this.generateTask(task);
        }
        return null;
    }

    // Get all recurring tasks
    getRecurringTasks() {
        return this.recurringTasks;
    }

    // Get active recurring tasks
    getActiveRecurringTasks() {
        return this.recurringTasks.filter(t => t.active);
    }

    // Get upcoming tasks preview (next 30 days)
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

                // Calculate next
                tempTask.lastGenerated = nextDate;
                nextDate = this.calculateNextOccurrence(tempTask);
            }
        });

        return preview.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }

    // Get recurrence type display name
    getRecurrenceTypeName(type) {
        const names = {
            'daily': 'Täglich',
            'weekly': 'Wöchentlich',
            'monthly': 'Monatlich',
            'yearly': 'Jährlich'
        };
        return names[type] || type;
    }

    // Pre-built templates
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
                recurrence: { type: 'weekly', daysOfWeek: [5] }, // Freitag
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

    // Persistence
    save() {
        localStorage.setItem('mhs_recurring_tasks', JSON.stringify(this.recurringTasks));
        localStorage.setItem('mhs_generated_tasks', JSON.stringify(this.generatedTasks));
    }
}

window.recurringTaskService = new RecurringTaskService();
