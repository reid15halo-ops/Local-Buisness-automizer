/* ============================================
   Time Tracking Service - Zeiterfassung
   Mitarbeiter-Stunden und Projektzeiten
   ============================================ */

class TimeTrackingService {
    constructor() {
        this.entries = JSON.parse(localStorage.getItem('freyai_time_entries') || '[]');
        this.employees = JSON.parse(localStorage.getItem('freyai_employees') || '[]');
        this.activeTimers = JSON.parse(localStorage.getItem('freyai_active_timers') || '{}');
        this.settings = JSON.parse(localStorage.getItem('freyai_time_settings') || '{}');

        // Default settings
        if (!this.settings.dailyHours) {this.settings.dailyHours = 8;}
        if (!this.settings.overtimeThreshold) {this.settings.overtimeThreshold = 40;}
        if (!this.settings.breakDuration) {this.settings.breakDuration = 30;}
    }

    // Time Entry CRUD
    addEntry(entry) {
        const newEntry = {
            id: entry.id || this.generateId(),
            employeeId: entry.employeeId || 'default',
            date: entry.date || new Date().toISOString().split('T')[0],
            startTime: entry.startTime,
            endTime: entry.endTime,
            breakMinutes: entry.breakMinutes || 0,
            projectId: entry.projectId || null,
            auftragId: entry.auftragId || null,
            customerId: entry.customerId || null,
            description: entry.description || '',
            type: entry.type || 'arbeit', // arbeit, fahrt, pause
            billable: entry.billable !== false,
            createdAt: new Date().toISOString()
        };

        // Calculate duration
        newEntry.durationMinutes = this.calculateDuration(newEntry.startTime, newEntry.endTime, newEntry.breakMinutes);
        newEntry.durationHours = Math.round(newEntry.durationMinutes / 60 * 100) / 100;

        this.entries.push(newEntry);
        this.save();
        return newEntry;
    }

    updateEntry(id, updates) {
        const index = this.entries.findIndex(e => e.id === id);
        if (index !== -1) {
            this.entries[index] = { ...this.entries[index], ...updates };
            // Recalculate duration if times changed
            if (updates.startTime || updates.endTime || updates.breakMinutes !== undefined) {
                const entry = this.entries[index];
                entry.durationMinutes = this.calculateDuration(entry.startTime, entry.endTime, entry.breakMinutes);
                entry.durationHours = Math.round(entry.durationMinutes / 60 * 100) / 100;
            }
            this.save();
            return this.entries[index];
        }
        return null;
    }

    deleteEntry(id) {
        this.entries = this.entries.filter(e => e.id !== id);
        this.save();
    }

    getEntry(id) { return this.entries.find(e => e.id === id); }

    // Clock In/Out
    clockIn(employeeId = 'default', projectId = null) {
        const now = new Date();
        this.activeTimers[employeeId] = {
            startTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
            date: now.toISOString().split('T')[0],
            projectId: projectId,
            startedAt: now.toISOString()
        };
        this.saveTimers();
        return this.activeTimers[employeeId];
    }

    clockOut(employeeId = 'default', description = '') {
        const timer = this.activeTimers[employeeId];
        if (!timer) {return null;}

        const now = new Date();
        const entry = this.addEntry({
            employeeId: employeeId,
            date: timer.date,
            startTime: timer.startTime,
            endTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
            projectId: timer.projectId,
            description: description
        });

        delete this.activeTimers[employeeId];
        this.saveTimers();
        return entry;
    }

    isClockActive(employeeId = 'default') {
        return !!this.activeTimers[employeeId];
    }

    getActiveTimer(employeeId = 'default') {
        const timer = this.activeTimers[employeeId];
        if (!timer) {return null;}

        const started = new Date(timer.startedAt);
        const now = new Date();
        const elapsedMinutes = Math.floor((now - started) / 60000);

        return {
            ...timer,
            elapsedMinutes,
            elapsedFormatted: this.formatDuration(elapsedMinutes)
        };
    }

    // Query Entries
    getEntriesForDay(date, employeeId = null) {
        return this.entries.filter(e =>
            e.date === date &&
            (!employeeId || e.employeeId === employeeId)
        ).sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    getEntriesForWeek(startDate, employeeId = null) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);

        return this.entries.filter(e => {
            const entryDate = new Date(e.date);
            return entryDate >= start && entryDate < end &&
                (!employeeId || e.employeeId === employeeId);
        });
    }

    getEntriesForMonth(year, month, employeeId = null) {
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        return this.entries.filter(e =>
            e.date.startsWith(monthStr) &&
            (!employeeId || e.employeeId === employeeId)
        );
    }

    getEntriesForAuftrag(auftragId) {
        return this.entries.filter(e => e.auftragId === auftragId);
    }

    getEntriesForCustomer(customerId) {
        return this.entries.filter(e => e.customerId === customerId);
    }

    // Calculations
    calculateDuration(startTime, endTime, breakMinutes = 0) {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;
        return Math.max(0, endTotal - startTotal - breakMinutes);
    }

    getTotalHoursForDay(date, employeeId = null) {
        const entries = this.getEntriesForDay(date, employeeId);
        const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
        return Math.round(totalMinutes / 60 * 100) / 100;
    }

    getTotalHoursForWeek(startDate, employeeId = null) {
        const entries = this.getEntriesForWeek(startDate, employeeId);
        const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
        return Math.round(totalMinutes / 60 * 100) / 100;
    }

    getOvertimeForWeek(startDate, employeeId = null) {
        const totalHours = this.getTotalHoursForWeek(startDate, employeeId);
        return Math.max(0, totalHours - this.settings.overtimeThreshold);
    }

    getBillableHoursForPeriod(startDate, endDate, customerId = null) {
        return this.entries.filter(e => {
            if (!e.billable) {return false;}
            if (e.date < startDate || e.date > endDate) {return false;}
            if (customerId && e.customerId !== customerId) {return false;}
            return true;
        }).reduce((sum, e) => sum + e.durationHours, 0);
    }

    // Timesheet Generation
    generateTimesheet(employeeId, year, month) {
        const entries = this.getEntriesForMonth(year, month, employeeId);

        // Group by date
        const byDate = {};
        entries.forEach(e => {
            if (!byDate[e.date]) {byDate[e.date] = [];}
            byDate[e.date].push(e);
        });

        const daysInMonth = new Date(year, month, 0).getDate();
        const rows = [];
        let totalHours = 0;
        let totalOvertimeHours = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEntries = byDate[date] || [];
            const dayHours = dayEntries.reduce((sum, e) => sum + e.durationHours, 0);
            const dayOvertime = Math.max(0, dayHours - this.settings.dailyHours);

            const dayOfWeek = new Date(date).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            rows.push({
                date: date,
                dayName: new Date(date).toLocaleDateString('de-DE', { weekday: 'short' }),
                entries: dayEntries,
                totalHours: dayHours,
                overtime: dayOvertime,
                isWeekend: isWeekend
            });

            totalHours += dayHours;
            totalOvertimeHours += dayOvertime;
        }

        return {
            employeeId,
            year,
            month,
            monthName: new Date(year, month - 1).toLocaleDateString('de-DE', { month: 'long' }),
            rows,
            totalHours: Math.round(totalHours * 100) / 100,
            regularHours: Math.round((totalHours - totalOvertimeHours) * 100) / 100,
            overtimeHours: Math.round(totalOvertimeHours * 100) / 100,
            workDays: rows.filter(r => r.totalHours > 0).length
        };
    }

    // Export
    exportToCSV(employeeId, year, month) {
        const timesheet = this.generateTimesheet(employeeId, year, month);

        let csv = 'Datum;Wochentag;Beginn;Ende;Pause (Min);Arbeitszeit (Std);Beschreibung\n';

        timesheet.rows.forEach(row => {
            if (row.entries.length === 0 && !row.isWeekend) {
                csv += `${row.date};${row.dayName};;;;;\n`;
            } else {
                row.entries.forEach(e => {
                    csv += `${row.date};${row.dayName};${e.startTime};${e.endTime};${e.breakMinutes};${e.durationHours};${e.description}\n`;
                });
            }
        });

        csv += `\nGesamt;;;${timesheet.totalHours} Std;;davon Überstunden: ${timesheet.overtimeHours} Std\n`;

        return csv;
    }

    // Employees
    addEmployee(employee) {
        const emp = {
            id: employee.id || 'emp-' + Date.now(),
            name: employee.name,
            email: employee.email || '',
            role: employee.role || 'Mitarbeiter',
            weeklyHours: employee.weeklyHours || 40,
            active: true
        };
        this.employees.push(emp);
        this.saveEmployees();
        return emp;
    }

    getEmployees() { return this.employees.filter(e => e.active); }
    getEmployee(id) { return this.employees.find(e => e.id === id); }

    // Statistics
    getStatistics(employeeId = null, year = null, month = null) {
        let entries = this.entries;

        if (employeeId) {entries = entries.filter(e => e.employeeId === employeeId);}
        if (year && month) {
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;
            entries = entries.filter(e => e.date.startsWith(monthStr));
        }

        const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
        const billableMinutes = entries.filter(e => e.billable).reduce((sum, e) => sum + e.durationMinutes, 0);

        return {
            totalEntries: entries.length,
            totalHours: Math.round(totalMinutes / 60 * 100) / 100,
            billableHours: Math.round(billableMinutes / 60 * 100) / 100,
            avgHoursPerDay: entries.length > 0 ? Math.round(totalMinutes / 60 / [...new Set(entries.map(e => e.date))].length * 100) / 100 : 0,
            byType: {
                arbeit: entries.filter(e => e.type === 'arbeit').reduce((sum, e) => sum + e.durationHours, 0),
                fahrt: entries.filter(e => e.type === 'fahrt').reduce((sum, e) => sum + e.durationHours, 0)
            }
        };
    }

    // Helpers
    generateId() { return 'time-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9); }

    formatDuration(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}:${String(m).padStart(2, '0')}`;
    }

    formatHours(hours) {
        return hours.toFixed(2).replace('.', ',') + ' Std';
    }

    // Persistence
    save() { localStorage.setItem('freyai_time_entries', JSON.stringify(this.entries)); }
    saveTimers() { localStorage.setItem('freyai_active_timers', JSON.stringify(this.activeTimers)); }
    saveEmployees() { localStorage.setItem('freyai_employees', JSON.stringify(this.employees)); }
    saveSettings() { localStorage.setItem('freyai_time_settings', JSON.stringify(this.settings)); }
}

window.timeTrackingService = new TimeTrackingService();
