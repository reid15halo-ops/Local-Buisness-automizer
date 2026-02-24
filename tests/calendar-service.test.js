import { describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] !== undefined ? store[key] : null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

global.localStorage = localStorageMock;

// Self-contained CalendarService (extracted from js/services/calendar-service.js)
class CalendarService {
    constructor() {
        this.appointments = JSON.parse(localStorage.getItem('freyai_appointments') || '[]');
        this.settings = JSON.parse(localStorage.getItem('freyai_calendar_settings') || '{}');

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

    addAppointment(apt) {
        const conflicts = this.checkConflicts(apt.date, apt.startTime, apt.endTime, apt.id);

        const newApt = {
            id: apt.id || this.generateId(),
            title: apt.title,
            description: apt.description || '',
            date: apt.date,
            startTime: apt.startTime,
            endTime: apt.endTime,
            location: apt.location || '',
            customerId: apt.customerId || null,
            customerName: apt.customerName || '',
            auftragId: apt.auftragId || null,
            type: apt.type || 'termin',
            status: apt.status || 'geplant',
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

    getAppointment(id) {
        return this.appointments.find(a => a.id === id);
    }

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

    getAppointmentsForCustomer(customerId) {
        return this.appointments.filter(a => a.customerId === customerId);
    }

    checkConflicts(date, startTime, endTime, excludeId = null) {
        return this.appointments.filter(a => {
            if (a.id === excludeId) { return false; }
            if (a.date !== date) { return false; }
            if (a.status === 'abgesagt') { return false; }

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

    getAvailableSlots(date, durationMinutes = 60) {
        const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(date).getDay()];
        const workHours = this.settings.workingHours[dayOfWeek];

        if (!workHours || !workHours.active) { return []; }

        const slots = [];
        let currentTime = this.timeToMinutes(workHours.start);
        const endTime = this.timeToMinutes(workHours.end);

        while (currentTime + durationMinutes <= endTime) {
            const slotStart = this.minutesToTime(currentTime);
            const slotEnd = this.minutesToTime(currentTime + durationMinutes);

            const conflicts = this.checkConflicts(date, slotStart, slotEnd);
            if (conflicts.length === 0) {
                slots.push({ start: slotStart, end: slotEnd });
            }

            currentTime += 30;
        }

        return slots;
    }

    getUpcomingReminders() {
        const now = new Date();
        const reminders = [];

        this.appointments.forEach(apt => {
            if (!apt.reminder || apt.status === 'abgesagt') { return; }

            const aptDateTime = new Date(`${apt.date}T${apt.startTime}`);
            const reminderTime = new Date(aptDateTime.getTime() - apt.reminderMinutes * 60000);

            if (reminderTime <= now && aptDateTime > now) {
                reminders.push(apt);
            }
        });

        return reminders;
    }

    generateId() {
        return 'apt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

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

    updateWorkingHours(day, hours) {
        this.settings.workingHours[day] = hours;
        this.saveSettings();
    }

    getWorkingHours() {
        return this.settings.workingHours;
    }

    // Generate ICS format for export
    generateICS(appointments) {
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//FreyAI Visions//Calendar//DE',
            'CALSCALE:GREGORIAN'
        ];

        appointments.forEach(apt => {
            const dtStart = apt.date.replace(/-/g, '') + 'T' + apt.startTime.replace(':', '') + '00';
            const dtEnd = apt.date.replace(/-/g, '') + 'T' + apt.endTime.replace(':', '') + '00';

            lines.push('BEGIN:VEVENT');
            lines.push(`DTSTART:${dtStart}`);
            lines.push(`DTEND:${dtEnd}`);
            lines.push(`SUMMARY:${apt.title}`);
            lines.push(`DESCRIPTION:${apt.description || ''}`);
            lines.push(`LOCATION:${apt.location || ''}`);
            lines.push(`STATUS:${apt.status === 'bestaetigt' ? 'CONFIRMED' : 'TENTATIVE'}`);
            lines.push('END:VEVENT');
        });

        lines.push('END:VCALENDAR');
        return lines.join('\r\n');
    }

    save() {
        localStorage.setItem('freyai_appointments', JSON.stringify(this.appointments));
    }

    saveSettings() {
        localStorage.setItem('freyai_calendar_settings', JSON.stringify(this.settings));
    }
}

describe('CalendarService', () => {
    let service;
    const TODAY = '2026-02-24'; // Fixed test date (Monday)
    const TOMORROW = '2026-02-25';

    beforeEach(() => {
        localStorage.clear();
        service = new CalendarService();
    });

    describe('Appointment Creation', () => {
        it('should create an appointment with default values', () => {
            const apt = service.addAppointment({
                title: 'Kundentermin',
                date: TODAY,
                startTime: '09:00',
                endTime: '10:00'
            });

            expect(apt.id).toBeDefined();
            expect(apt.title).toBe('Kundentermin');
            expect(apt.status).toBe('geplant');
            expect(apt.type).toBe('termin');
            expect(apt.reminder).toBe(true);
        });

        it('should create appointment with all optional fields', () => {
            const apt = service.addAppointment({
                title: 'Reparaturtermin',
                date: TODAY,
                startTime: '10:00',
                endTime: '12:00',
                description: 'Heizungsreparatur',
                location: 'Musterstraße 1',
                customerId: 'CUST-001',
                customerName: 'Max Mustermann',
                auftragId: 'AUF-001',
                type: 'reparatur',
                status: 'bestaetigt',
                reminderMinutes: 30
            });

            expect(apt.description).toBe('Heizungsreparatur');
            expect(apt.location).toBe('Musterstraße 1');
            expect(apt.customerId).toBe('CUST-001');
            expect(apt.type).toBe('reparatur');
            expect(apt.reminderMinutes).toBe(30);
        });

        it('should assign type color based on appointment type', () => {
            const termin = service.addAppointment({ title: 'T', date: TODAY, startTime: '09:00', endTime: '10:00', type: 'termin' });
            const reparatur = service.addAppointment({ title: 'R', date: TOMORROW, startTime: '09:00', endTime: '10:00', type: 'reparatur' });

            expect(termin.color).toBe('#6366f1');
            expect(reparatur.color).toBe('#f59e0b');
        });

        it('should persist appointment to localStorage', () => {
            service.addAppointment({ title: 'Test', date: TODAY, startTime: '09:00', endTime: '10:00' });
            const stored = JSON.parse(localStorage.getItem('freyai_appointments'));
            expect(stored.length).toBe(1);
        });
    });

    describe('Appointment Queries', () => {
        beforeEach(() => {
            service.addAppointment({ title: 'Termin 1', date: TODAY, startTime: '09:00', endTime: '10:00' });
            service.addAppointment({ title: 'Termin 2', date: TODAY, startTime: '14:00', endTime: '15:00' });
            service.addAppointment({ title: 'Morgen', date: TOMORROW, startTime: '10:00', endTime: '11:00' });
        });

        it('should get appointments for a specific day', () => {
            const dayApts = service.getAppointmentsForDay(TODAY);
            expect(dayApts.length).toBe(2);
            // Sorted by start time
            expect(dayApts[0].startTime).toBe('09:00');
            expect(dayApts[1].startTime).toBe('14:00');
        });

        it('should exclude cancelled appointments from day query', () => {
            service.addAppointment({ title: 'Abgesagt', date: TODAY, startTime: '11:00', endTime: '12:00', status: 'abgesagt' });
            const dayApts = service.getAppointmentsForDay(TODAY);
            expect(dayApts.length).toBe(2); // Still 2, not 3
        });

        it('should get appointments for a week', () => {
            const weekApts = service.getAppointmentsForWeek('2026-02-23'); // Week starting Mon
            expect(weekApts.length).toBeGreaterThanOrEqual(2); // At least today and tomorrow
        });

        it('should get appointments for a month', () => {
            const monthApts = service.getAppointmentsForMonth(2026, 2);
            expect(monthApts.length).toBe(3);
        });

        it('should get appointments for a specific customer', () => {
            service.addAppointment({
                title: 'Kundentermin',
                date: TODAY,
                startTime: '16:00',
                endTime: '17:00',
                customerId: 'CUST-XYZ'
            });

            const custApts = service.getAppointmentsForCustomer('CUST-XYZ');
            expect(custApts.length).toBe(1);
        });

        it('should get appointment by id', () => {
            const apt = service.addAppointment({ title: 'Find Me', date: TOMORROW, startTime: '14:00', endTime: '15:00' });
            const found = service.getAppointment(apt.id);
            expect(found).toBeDefined();
            expect(found.title).toBe('Find Me');
        });
    });

    describe('Conflict Detection (Overlapping Times)', () => {
        it('should detect conflict when new appointment overlaps existing one', () => {
            service.addAppointment({ title: 'Existing', date: TODAY, startTime: '09:00', endTime: '11:00' });

            // Overlapping: 10:00-12:00 overlaps with 09:00-11:00
            const conflicts = service.checkConflicts(TODAY, '10:00', '12:00');
            expect(conflicts.length).toBe(1);
        });

        it('should detect conflict for contained appointment', () => {
            service.addAppointment({ title: 'Long Meeting', date: TODAY, startTime: '09:00', endTime: '12:00' });

            // New appointment inside existing one
            const conflicts = service.checkConflicts(TODAY, '10:00', '11:00');
            expect(conflicts.length).toBe(1);
        });

        it('should not detect conflict for adjacent appointments', () => {
            service.addAppointment({ title: 'Morning', date: TODAY, startTime: '09:00', endTime: '10:00' });

            // Starts exactly when previous ends - no overlap
            const conflicts = service.checkConflicts(TODAY, '10:00', '11:00');
            expect(conflicts.length).toBe(0);
        });

        it('should not detect conflict on different dates', () => {
            service.addAppointment({ title: 'Today', date: TODAY, startTime: '09:00', endTime: '10:00' });

            // Same time but different date
            const conflicts = service.checkConflicts(TOMORROW, '09:00', '10:00');
            expect(conflicts.length).toBe(0);
        });

        it('should exclude cancelled appointments from conflict detection', () => {
            service.addAppointment({ title: 'Cancelled', date: TODAY, startTime: '09:00', endTime: '10:00', status: 'abgesagt' });

            // Same time as cancelled appointment - no conflict
            const conflicts = service.checkConflicts(TODAY, '09:00', '10:00');
            expect(conflicts.length).toBe(0);
        });

        it('should exclude self from conflict detection when updating', () => {
            const apt = service.addAppointment({ id: 'APT-SELF', title: 'Self', date: TODAY, startTime: '09:00', endTime: '10:00' });

            // Checking same appointment's time slot - should not conflict with itself
            const conflicts = service.checkConflicts(TODAY, '09:00', '10:00', 'APT-SELF');
            expect(conflicts.length).toBe(0);
        });

        it('should detect multiple conflicts', () => {
            service.addAppointment({ title: 'A', date: TODAY, startTime: '09:00', endTime: '11:00' });
            service.addAppointment({ title: 'B', date: TODAY, startTime: '10:00', endTime: '12:00' });

            // New appointment overlaps both
            const conflicts = service.checkConflicts(TODAY, '09:30', '11:30');
            expect(conflicts.length).toBe(2);
        });
    });

    describe('ICS Export Format', () => {
        it('should generate valid ICS format', () => {
            const apt = {
                id: 'TEST-1',
                title: 'Kundentermin',
                date: '2026-02-24',
                startTime: '09:00',
                endTime: '10:00',
                description: 'Besichtigungstermin',
                location: 'München',
                status: 'bestaetigt'
            };

            const ics = service.generateICS([apt]);

            expect(ics).toContain('BEGIN:VCALENDAR');
            expect(ics).toContain('END:VCALENDAR');
            expect(ics).toContain('BEGIN:VEVENT');
            expect(ics).toContain('END:VEVENT');
        });

        it('should include correct datetime format in ICS', () => {
            const apt = {
                title: 'Test',
                date: '2026-02-24',
                startTime: '09:30',
                endTime: '10:30',
                status: 'geplant'
            };

            const ics = service.generateICS([apt]);
            expect(ics).toContain('DTSTART:20260224T093000');
            expect(ics).toContain('DTEND:20260224T103000');
        });

        it('should include appointment title in ICS', () => {
            const apt = {
                title: 'Reparatur Heizung',
                date: '2026-02-24',
                startTime: '09:00',
                endTime: '11:00',
                status: 'geplant'
            };

            const ics = service.generateICS([apt]);
            expect(ics).toContain('SUMMARY:Reparatur Heizung');
        });

        it('should include CONFIRMED status for confirmed appointments', () => {
            const apt = {
                title: 'Bestätigt',
                date: '2026-02-24',
                startTime: '09:00',
                endTime: '10:00',
                status: 'bestaetigt'
            };

            const ics = service.generateICS([apt]);
            expect(ics).toContain('STATUS:CONFIRMED');
        });

        it('should export multiple appointments in one ICS', () => {
            const apts = [
                { title: 'A', date: '2026-02-24', startTime: '09:00', endTime: '10:00', status: 'geplant' },
                { title: 'B', date: '2026-02-25', startTime: '10:00', endTime: '11:00', status: 'bestaetigt' }
            ];

            const ics = service.generateICS(apts);
            const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
            expect(eventCount).toBe(2);
        });
    });

    describe('Reminder Scheduling', () => {
        it('should default reminderMinutes to 60', () => {
            const apt = service.addAppointment({ title: 'Default Reminder', date: TODAY, startTime: '14:00', endTime: '15:00' });
            expect(apt.reminderMinutes).toBe(60);
        });

        it('should allow custom reminderMinutes', () => {
            const apt = service.addAppointment({
                title: 'Early Reminder',
                date: TODAY,
                startTime: '14:00',
                endTime: '15:00',
                reminderMinutes: 120
            });
            expect(apt.reminderMinutes).toBe(120);
        });

        it('should disable reminder when reminder=false', () => {
            const apt = service.addAppointment({
                title: 'No Reminder',
                date: TODAY,
                startTime: '14:00',
                endTime: '15:00',
                reminder: false
            });
            expect(apt.reminder).toBe(false);
        });
    });

    describe('Date/Time Utilities', () => {
        it('should convert time string to minutes correctly', () => {
            expect(service.timeToMinutes('09:00')).toBe(540);
            expect(service.timeToMinutes('12:30')).toBe(750);
            expect(service.timeToMinutes('00:00')).toBe(0);
        });

        it('should convert minutes back to time string', () => {
            expect(service.minutesToTime(540)).toBe('09:00');
            expect(service.minutesToTime(750)).toBe('12:30');
            expect(service.minutesToTime(0)).toBe('00:00');
        });

        it('should format time with Uhr suffix', () => {
            expect(service.formatTime('09:30')).toBe('09:30 Uhr');
        });

        it('should format date range correctly', () => {
            const apt = { startTime: '09:00', endTime: '11:00' };
            expect(service.formatDateRange(apt)).toBe('09:00 - 11:00 Uhr');
        });
    });

    describe('Appointment Update and Delete', () => {
        it('should update appointment fields', () => {
            const apt = service.addAppointment({ title: 'Original', date: TODAY, startTime: '09:00', endTime: '10:00' });
            const updated = service.updateAppointment(apt.id, { title: 'Updated', status: 'bestaetigt' });
            expect(updated.title).toBe('Updated');
            expect(updated.status).toBe('bestaetigt');
        });

        it('should return null when updating non-existent appointment', () => {
            const result = service.updateAppointment('NONEXISTENT', { title: 'Test' });
            expect(result).toBeNull();
        });

        it('should delete an appointment', () => {
            const apt = service.addAppointment({ title: 'To Delete', date: TODAY, startTime: '09:00', endTime: '10:00' });
            service.deleteAppointment(apt.id);
            expect(service.getAppointment(apt.id)).toBeUndefined();
        });

        it('should preserve remaining appointments after deletion', () => {
            const apt1 = service.addAppointment({ title: 'Keep', date: TODAY, startTime: '09:00', endTime: '10:00' });
            const apt2 = service.addAppointment({ title: 'Delete', date: TODAY, startTime: '11:00', endTime: '12:00' });
            service.deleteAppointment(apt2.id);
            expect(service.getAppointment(apt1.id)).toBeDefined();
            expect(service.getAppointment(apt2.id)).toBeUndefined();
        });
    });

    describe('Working Hours', () => {
        it('should have correct default working hours', () => {
            const wh = service.getWorkingHours();
            expect(wh.mon.start).toBe('08:00');
            expect(wh.mon.end).toBe('17:00');
            expect(wh.mon.active).toBe(true);
            expect(wh.sun.active).toBe(false);
        });

        it('should update working hours for a day', () => {
            service.updateWorkingHours('mon', { start: '07:00', end: '16:00', active: true });
            const wh = service.getWorkingHours();
            expect(wh.mon.start).toBe('07:00');
            expect(wh.mon.end).toBe('16:00');
        });

        it('should return no available slots for inactive day', () => {
            // Sunday is inactive by default
            const slots = service.getAvailableSlots('2026-02-22'); // A Sunday
            expect(slots.length).toBe(0);
        });
    });
});
