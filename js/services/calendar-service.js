/* ============================================
   Calendar Service - Terminverwaltung
   ============================================ */

class CalendarService {
    constructor() {
        this.appointments = JSON.parse(localStorage.getItem('freyai_appointments') || '[]');
        this.settings = JSON.parse(localStorage.getItem('freyai_calendar_settings') || '{}');

        // Default working hours
        if (!this.settings.workingHours) {
            this.settings.workingHours = {
                mon: { start: '08:00', end: '17:00', active: true },
                tue: { start: '08:00', end: '17:00', active: true },
                wed: { start: '08:00', end: '17:00', active: true },
                thu: { start: '08:00', end: '17:00', active: true },
                fri: { start: '08:00', end: '16:00', active: true },
                sat: { start: '09:00', end: '12:00', active: false },
                sun: { start: '00:00', end: '00:00', active: false }
            };
        }
    }

    // Appointment CRUD
    addAppointment(apt) {
        // Check for conflicts
        const conflicts = this.checkConflicts(apt.date, apt.startTime, apt.endTime, apt.id);
        if (conflicts.length > 0) {
            console.warn('Terminkonflikt:', conflicts);
        }

        const newApt = {
            id: apt.id || this.generateId(),
            title: apt.title,
            description: apt.description || '',
            date: apt.date, // YYYY-MM-DD
            startTime: apt.startTime, // HH:MM
            endTime: apt.endTime,
            location: apt.location || '',
            customerId: apt.customerId || null,
            customerName: apt.customerName || '',
            auftragId: apt.auftragId || null,
            type: apt.type || 'termin', // termin, besichtigung, reparatur, meeting
            status: apt.status || 'geplant', // geplant, bestaetigt, abgeschlossen, abgesagt
            color: apt.color || this.getTypeColor(apt.type),
            reminder: apt.reminder !== false,
            reminderMinutes: apt.reminderMinutes || 60,
            notes: apt.notes || '',
            createdAt: new Date().toISOString()
        };

        this.appointments.push(newApt);
        this.save();
        return newApt;
    }

    updateAppointment(id, updates) {
        const index = this.appointments.findIndex(a => a.id === id);
        if (index !== -1) {
            this.appointments[index] = { ...this.appointments[index], ...updates };
            this.save();
            return this.appointments[index];
        }
        return null;
    }

    deleteAppointment(id) {
        this.appointments = this.appointments.filter(a => a.id !== id);
        this.save();
    }

    getAppointment(id) { return this.appointments.find(a => a.id === id); }

    // Query Appointments
    getAppointmentsForDay(date) {
        return this.appointments
            .filter(a => a.date === date && a.status !== 'abgesagt')
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    getAppointmentsForWeek(startDate) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);

        return this.appointments.filter(a => {
            const aptDate = new Date(a.date);
            return aptDate >= start && aptDate < end && a.status !== 'abgesagt';
        }).sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            return dateCompare !== 0 ? dateCompare : a.startTime.localeCompare(b.startTime);
        });
    }

    getAppointmentsForMonth(year, month) {
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        return this.appointments.filter(a => a.date.startsWith(monthStr));
    }

    getUpcomingAppointments(days = 7) {
        const today = new Date().toISOString().split('T')[0];
        const future = new Date();
        future.setDate(future.getDate() + days);
        const futureStr = future.toISOString().split('T')[0];

        return this.appointments.filter(a =>
            a.date >= today && a.date <= futureStr && a.status !== 'abgesagt'
        ).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
    }

    getTodaysAppointments() {
        return this.getAppointmentsForDay(new Date().toISOString().split('T')[0]);
    }

    getAppointmentsForCustomer(customerId) {
        return this.appointments.filter(a => a.customerId === customerId);
    }

    // Conflict Detection
    checkConflicts(date, startTime, endTime, excludeId = null) {
        return this.appointments.filter(a => {
            if (a.id === excludeId) {return false;}
            if (a.date !== date) {return false;}
            if (a.status === 'abgesagt') {return false;}

            // Check time overlap
            const aStart = this.timeToMinutes(a.startTime);
            const aEnd = this.timeToMinutes(a.endTime);
            const newStart = this.timeToMinutes(startTime);
            const newEnd = this.timeToMinutes(endTime);

            return (newStart < aEnd && newEnd > aStart);
        });
    }

    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    minutesToTime(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    // Available Slots
    getAvailableSlots(date, durationMinutes = 60) {
        const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(date).getDay()];
        const workHours = this.settings.workingHours[dayOfWeek];

        if (!workHours || !workHours.active) {return [];}

        const slots = [];
        const existingApts = this.getAppointmentsForDay(date);

        let currentTime = this.timeToMinutes(workHours.start);
        const endTime = this.timeToMinutes(workHours.end);

        while (currentTime + durationMinutes <= endTime) {
            const slotStart = this.minutesToTime(currentTime);
            const slotEnd = this.minutesToTime(currentTime + durationMinutes);

            const conflicts = this.checkConflicts(date, slotStart, slotEnd);
            if (conflicts.length === 0) {
                slots.push({ start: slotStart, end: slotEnd });
            }

            currentTime += 30; // 30-minute increments
        }

        return slots;
    }

    // Create from Auftrag
    createFromAuftrag(auftrag) {
        return this.addAppointment({
            title: `Auftrag: ${auftrag.id}`,
            description: auftrag.beschreibung || '',
            date: auftrag.termin || new Date().toISOString().split('T')[0],
            startTime: '09:00',
            endTime: '12:00',
            customerId: auftrag.kunde?.id,
            customerName: auftrag.kunde?.name,
            auftragId: auftrag.id,
            type: 'reparatur'
        });
    }

    // Reminders
    getUpcomingReminders() {
        const now = new Date();
        const reminders = [];

        this.appointments.forEach(apt => {
            if (!apt.reminder || apt.status === 'abgesagt') {return;}

            const aptDateTime = new Date(`${apt.date}T${apt.startTime}`);
            const reminderTime = new Date(aptDateTime.getTime() - apt.reminderMinutes * 60000);

            if (reminderTime <= now && aptDateTime > now) {
                reminders.push(apt);
            }
        });

        return reminders;
    }

    // Week View Data
    getWeekViewData(startDate) {
        const days = [];
        const start = new Date(startDate);

        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];

            days.push({
                date: dateStr,
                dayName: date.toLocaleDateString('de-DE', { weekday: 'short' }),
                dayNumber: date.getDate(),
                isToday: dateStr === new Date().toISOString().split('T')[0],
                appointments: this.getAppointmentsForDay(dateStr)
            });
        }

        return days;
    }

    // Helpers
    generateId() { return 'apt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9); }

    getTypeColor(type) {
        const colors = {
            termin: '#6366f1',
            besichtigung: '#22c55e',
            reparatur: '#f59e0b',
            meeting: '#3b82f6',
            default: '#64748b'
        };
        return colors[type] || colors.default;
    }

    getTypeIcon(type) {
        const icons = { termin: '📅', besichtigung: '🔍', reparatur: '🔧', meeting: '👥' };
        return icons[type] || '📅';
    }

    formatTime(time) {
        return time + ' Uhr';
    }

    formatDateRange(apt) {
        return `${apt.startTime} - ${apt.endTime} Uhr`;
    }

    // Settings
    updateWorkingHours(day, hours) {
        this.settings.workingHours[day] = hours;
        this.saveSettings();
    }

    getWorkingHours() {
        return this.settings.workingHours;
    }

    // Persistence
    save() { localStorage.setItem('freyai_appointments', JSON.stringify(this.appointments)); }
    saveSettings() { localStorage.setItem('freyai_calendar_settings', JSON.stringify(this.settings)); }
}

window.calendarService = new CalendarService();
