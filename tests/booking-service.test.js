import { describe, it, expect, beforeEach, vi } from 'vitest';

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

// Mock StorageUtils
global.StorageUtils = {
    getJSON: vi.fn((key, defaultVal) => defaultVal),
    setJSON: vi.fn(() => true)
};

// Mock window globals
global.window = {
    ...global.window,
    calendarService: undefined,
    storeService: undefined,
    location: { origin: 'https://app.freyaivisions.de' },
    APP_CONFIG: {}
};

// ── BookingService (inline from js/services/booking-service.js) ──────────

class BookingService {
    constructor() {
        this.bookings = StorageUtils.getJSON('freyai_bookings', [], { service: 'bookingService' });
        this.settings = StorageUtils.getJSON('freyai_booking_settings', {}, { service: 'bookingService' });

        if (!this.settings.serviceTypes) {
            this.settings.serviceTypes = [
                { id: 'beratung', name: 'Beratungsgespräch', duration: 30, price: 0 },
                { id: 'besichtigung', name: 'Vor-Ort-Besichtigung', duration: 60, price: 0 },
                { id: 'reparatur', name: 'Reparaturtermin', duration: 120, price: 0 },
                { id: 'wartung', name: 'Wartungstermin', duration: 90, price: 0 }
            ];
        }

        if (!this.settings.bookingWindow) {
            this.settings.bookingWindow = {
                minDaysAhead: 1,
                maxDaysAhead: 30
            };
        }

        if (!this.settings.confirmationEmail) {
            this.settings.confirmationEmail = true;
        }
    }

    createBooking(booking) {
        const newBooking = {
            id: booking.id || this.generateId(),
            serviceType: booking.serviceType,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            customer: {
                name: booking.customer?.name || '',
                email: booking.customer?.email || '',
                telefon: booking.customer?.telefon || '',
                firma: booking.customer?.firma || ''
            },
            notes: booking.notes || '',
            status: 'pending',
            confirmationCode: this.generateConfirmationCode(),
            createdAt: new Date().toISOString(),
            confirmedAt: null,
            cancelledAt: null,
            reminderSent: false
        };

        this.bookings.push(newBooking);
        this.save();

        if (window.calendarService) {
            window.calendarService.addAppointment({
                title: `Buchung: ${this.getServiceName(booking.serviceType)}`,
                description: `Kunde: ${newBooking.customer.name}\nTel: ${newBooking.customer.telefon}`,
                date: newBooking.date,
                startTime: newBooking.startTime,
                endTime: newBooking.endTime,
                customerName: newBooking.customer.name,
                type: booking.serviceType || 'besichtigung',
                status: 'geplant'
            });
        }

        return newBooking;
    }

    confirmBooking(id) {
        const booking = this.getBooking(id);
        if (booking) {
            booking.status = 'confirmed';
            booking.confirmedAt = new Date().toISOString();
            this.save();
            return booking;
        }
        return null;
    }

    cancelBooking(id, reason = '') {
        const booking = this.getBooking(id);
        if (booking) {
            booking.status = 'cancelled';
            booking.cancelledAt = new Date().toISOString();
            booking.cancellationReason = reason;
            this.save();
            return booking;
        }
        return null;
    }

    completeBooking(id) {
        return this.updateBooking(id, { status: 'completed' });
    }

    updateBooking(id, updates) {
        const index = this.bookings.findIndex(b => b.id === id);
        if (index !== -1) {
            this.bookings[index] = { ...this.bookings[index], ...updates };
            this.save();
            return this.bookings[index];
        }
        return null;
    }

    getBooking(id) { return this.bookings.find(b => b.id === id); }
    getBookingByCode(code) { return this.bookings.find(b => b.confirmationCode === code); }

    getAllBookings() { return this.bookings; }
    getPendingBookings() { return this.bookings.filter(b => b.status === 'pending'); }
    getConfirmedBookings() { return this.bookings.filter(b => b.status === 'confirmed'); }

    getBookingsForDate(date) {
        return this.bookings.filter(b => b.date === date && b.status !== 'cancelled');
    }

    getAvailableSlots(serviceTypeId, date) {
        const service = this.getServiceType(serviceTypeId);
        if (!service) { return []; }

        if (window.calendarService) {
            return window.calendarService.getAvailableSlots(date, service.duration);
        }

        return [
            { start: '09:00', end: this.addMinutes('09:00', service.duration) },
            { start: '10:30', end: this.addMinutes('10:30', service.duration) },
            { start: '14:00', end: this.addMinutes('14:00', service.duration) },
            { start: '15:30', end: this.addMinutes('15:30', service.duration) }
        ];
    }

    getAvailableDates(serviceTypeId, daysToShow = 14) {
        const dates = [];
        const today = new Date();

        for (let i = this.settings.bookingWindow.minDaysAhead; i <= Math.min(daysToShow, this.settings.bookingWindow.maxDaysAhead); i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);

            const dateStr = date.toISOString().split('T')[0];
            const slots = this.getAvailableSlots(serviceTypeId, dateStr);

            if (slots.length > 0) {
                dates.push({
                    date: dateStr,
                    dayName: date.toLocaleDateString('de-DE', { weekday: 'long' }),
                    slotsAvailable: slots.length
                });
            }
        }

        return dates;
    }

    getServiceTypes() { return this.settings.serviceTypes; }
    getServiceType(id) { return this.settings.serviceTypes.find(s => s.id === id); }
    getServiceName(id) { return this.getServiceType(id)?.name || id; }

    addServiceType(service) {
        this.settings.serviceTypes.push({
            id: service.id || 'service-' + Date.now(),
            name: service.name,
            duration: service.duration || 60,
            price: service.price || 0
        });
        this.saveSettings();
    }

    updateServiceType(id, updates) {
        const index = this.settings.serviceTypes.findIndex(s => s.id === id);
        if (index !== -1) {
            this.settings.serviceTypes[index] = { ...this.settings.serviceTypes[index], ...updates };
            this.saveSettings();
        }
    }

    generateBookingLink(serviceTypeId = null) {
        const baseUrl = window.location.origin + '/booking.html';
        if (serviceTypeId) {
            return `${baseUrl}?service=${serviceTypeId}`;
        }
        return baseUrl;
    }

    _companyInfo() {
        let ap = StorageUtils.getJSON('freyai_admin_settings', {}, { service: 'bookingService' });
        const store = window.storeService?.state?.settings || {};
        return {
            name: ap.company_name || store.companyName || 'FreyAI Visions',
            phone: ap.company_phone || store.phone || '',
            email: ap.company_email || store.email || ''
        };
    }

    getConfirmationEmailData(booking) {
        const ci = this._companyInfo();
        return {
            to: booking.customer.email,
            subject: `Terminbestätigung: ${this.getServiceName(booking.serviceType)}`,
            body: `Sehr geehrte(r) ${booking.customer.name},

Ihr Termin wurde erfolgreich gebucht!

Details:
- Leistung: ${this.getServiceName(booking.serviceType)}
- Datum: ${this.formatDate(booking.date)}
- Uhrzeit: ${booking.startTime} - ${booking.endTime} Uhr
- Bestätigungscode: ${booking.confirmationCode}

Bei Fragen oder zur Stornierung erreichen Sie uns unter:
${ci.phone ? 'Tel: ' + ci.phone + '\n' : ''}${ci.email ? 'E-Mail: ' + ci.email + '\n' : ''}
Mit freundlichen Grüßen
${ci.name}`
        };
    }

    getReminderEmailData(booking) {
        const ci = this._companyInfo();
        return {
            to: booking.customer.email,
            subject: `Terminerinnerung: Morgen um ${booking.startTime} Uhr`,
            body: `Sehr geehrte(r) ${booking.customer.name},

dies ist eine Erinnerung an Ihren morgigen Termin:

- Leistung: ${this.getServiceName(booking.serviceType)}
- Datum: ${this.formatDate(booking.date)}
- Uhrzeit: ${booking.startTime} Uhr

Wir freuen uns auf Sie!

Mit freundlichen Grüßen
${ci.name}`
        };
    }

    getBookingStats() {
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return {
            total: this.bookings.length,
            pending: this.bookings.filter(b => b.status === 'pending').length,
            confirmed: this.bookings.filter(b => b.status === 'confirmed').length,
            completed: this.bookings.filter(b => b.status === 'completed').length,
            cancelled: this.bookings.filter(b => b.status === 'cancelled').length,
            thisMonth: this.bookings.filter(b => new Date(b.createdAt) >= thisMonth).length
        };
    }

    generateId() { return 'book-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11); }

    generateConfirmationCode() {
        return 'FREY-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    addMinutes(time, minutes) {
        const [h, m] = time.split(':').map(Number);
        const totalMinutes = h * 60 + m + minutes;
        const newH = Math.floor(totalMinutes / 60);
        const newM = totalMinutes % 60;
        return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    }

    formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('de-DE', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        });
    }

    getStatusLabel(status) {
        const labels = {
            pending: 'Ausstehend',
            confirmed: 'Bestätigt',
            completed: 'Abgeschlossen',
            cancelled: 'Storniert'
        };
        return labels[status] || status;
    }

    getStatusColor(status) {
        const colors = { pending: '#f59e0b', confirmed: '#22c55e', completed: '#c8956c', cancelled: '#ef4444' };
        return colors[status] || '#64748b';
    }

    updateSettings(updates) {
        this.settings = { ...this.settings, ...updates };
        this.saveSettings();
    }

    _mapCalcomBooking(cb) {
        const start = new Date(cb.startTime);
        const end = new Date(cb.endTime);
        const pad = n => String(n).padStart(2, '0');
        const dateStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
        const startTimeStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
        const endTimeStr = `${pad(end.getHours())}:${pad(end.getMinutes())}`;

        const attendee = (cb.attendees && cb.attendees[0]) || {};

        return {
            id: 'calcom-' + cb.id,
            serviceType: cb.eventType?.slug || cb.eventType?.title || 'calcom',
            date: dateStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            customer: {
                name: attendee.name || cb.title || '',
                email: attendee.email || '',
                telefon: attendee.phone || '',
                firma: ''
            },
            notes: cb.description || '',
            status: this._mapCalcomStatus(cb.status),
            confirmationCode: '',
            createdAt: cb.createdAt || new Date().toISOString(),
            source: 'calcom',
            calcomId: cb.id,
            calcomUid: cb.uid || ''
        };
    }

    _mapCalcomStatus(status) {
        const map = {
            'ACCEPTED': 'confirmed',
            'PENDING': 'pending',
            'CANCELLED': 'cancelled',
            'REJECTED': 'cancelled'
        };
        return map[status] || 'pending';
    }

    save() { localStorage.setItem('freyai_bookings', JSON.stringify(this.bookings)); }
    saveSettings() { localStorage.setItem('freyai_booking_settings', JSON.stringify(this.settings)); }
}

// ── Helper: create a sample booking input ────────────────────────────────

function sampleBookingInput(overrides = {}) {
    return {
        serviceType: 'beratung',
        date: '2026-04-10',
        startTime: '09:00',
        endTime: '09:30',
        customer: {
            name: 'Max Mustermann',
            email: 'max@example.de',
            telefon: '+49 170 1234567',
            firma: 'Musterbau GmbH'
        },
        notes: 'Erstberatung Dachsanierung',
        ...overrides
    };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('BookingService', () => {
    let service;

    beforeEach(() => {
        localStorage.clear();
        StorageUtils.getJSON.mockImplementation((key, defaultVal) => defaultVal);
        StorageUtils.setJSON.mockClear();
        window.calendarService = undefined;
        window.storeService = undefined;
        service = new BookingService();
    });

    // ── Constructor / Defaults ───────────────────────────────────────

    describe('constructor', () => {
        it('initializes with empty bookings array', () => {
            expect(service.bookings).toEqual([]);
        });

        it('sets four default service types', () => {
            const types = service.getServiceTypes();
            expect(types).toHaveLength(4);
            expect(types.map(t => t.id)).toEqual(['beratung', 'besichtigung', 'reparatur', 'wartung']);
        });

        it('sets default booking window (1-30 days)', () => {
            expect(service.settings.bookingWindow.minDaysAhead).toBe(1);
            expect(service.settings.bookingWindow.maxDaysAhead).toBe(30);
        });

        it('enables confirmation email by default', () => {
            expect(service.settings.confirmationEmail).toBe(true);
        });
    });

    // ── Booking CRUD Lifecycle ───────────────────────────────────────

    describe('createBooking()', () => {
        it('creates a booking with pending status', () => {
            const booking = service.createBooking(sampleBookingInput());
            expect(booking.status).toBe('pending');
            expect(booking.id).toBeTruthy();
            expect(booking.confirmationCode).toMatch(/^FREY-[A-Z0-9]{6}$/);
        });

        it('persists booking to localStorage via save()', () => {
            service.createBooking(sampleBookingInput());
            const stored = JSON.parse(localStorage.getItem('freyai_bookings'));
            expect(stored).toHaveLength(1);
        });

        it('populates customer fields from input', () => {
            const booking = service.createBooking(sampleBookingInput());
            expect(booking.customer.name).toBe('Max Mustermann');
            expect(booking.customer.email).toBe('max@example.de');
            expect(booking.customer.firma).toBe('Musterbau GmbH');
        });

        it('defaults missing customer fields to empty strings', () => {
            const booking = service.createBooking({ serviceType: 'beratung', date: '2026-04-10', startTime: '09:00', endTime: '09:30' });
            expect(booking.customer.name).toBe('');
            expect(booking.customer.telefon).toBe('');
        });

        it('uses provided id when given', () => {
            const booking = service.createBooking(sampleBookingInput({ id: 'custom-id-42' }));
            expect(booking.id).toBe('custom-id-42');
        });

        it('calls calendarService.addAppointment when available', () => {
            const mockAdd = vi.fn();
            window.calendarService = { addAppointment: mockAdd };
            service.createBooking(sampleBookingInput());
            expect(mockAdd).toHaveBeenCalledTimes(1);
            expect(mockAdd.mock.calls[0][0].title).toContain('Buchung:');
        });

        it('sets confirmedAt and cancelledAt to null initially', () => {
            const booking = service.createBooking(sampleBookingInput());
            expect(booking.confirmedAt).toBeNull();
            expect(booking.cancelledAt).toBeNull();
        });
    });

    describe('confirmBooking()', () => {
        it('sets status to confirmed and records confirmedAt', () => {
            const created = service.createBooking(sampleBookingInput());
            const confirmed = service.confirmBooking(created.id);
            expect(confirmed.status).toBe('confirmed');
            expect(confirmed.confirmedAt).toBeTruthy();
        });

        it('returns null for non-existent id', () => {
            expect(service.confirmBooking('does-not-exist')).toBeNull();
        });
    });

    describe('cancelBooking()', () => {
        it('sets status to cancelled with reason', () => {
            const created = service.createBooking(sampleBookingInput());
            const cancelled = service.cancelBooking(created.id, 'Kunde hat abgesagt');
            expect(cancelled.status).toBe('cancelled');
            expect(cancelled.cancellationReason).toBe('Kunde hat abgesagt');
            expect(cancelled.cancelledAt).toBeTruthy();
        });

        it('defaults reason to empty string', () => {
            const created = service.createBooking(sampleBookingInput());
            const cancelled = service.cancelBooking(created.id);
            expect(cancelled.cancellationReason).toBe('');
        });

        it('returns null for non-existent id', () => {
            expect(service.cancelBooking('ghost-id')).toBeNull();
        });
    });

    describe('completeBooking()', () => {
        it('sets status to completed', () => {
            const created = service.createBooking(sampleBookingInput());
            service.confirmBooking(created.id);
            const completed = service.completeBooking(created.id);
            expect(completed.status).toBe('completed');
        });

        it('returns null for non-existent id', () => {
            expect(service.completeBooking('nope')).toBeNull();
        });
    });

    describe('Full lifecycle: create -> confirm -> complete', () => {
        it('transitions through all statuses correctly', () => {
            const booking = service.createBooking(sampleBookingInput());
            expect(booking.status).toBe('pending');

            service.confirmBooking(booking.id);
            expect(service.getBooking(booking.id).status).toBe('confirmed');

            service.completeBooking(booking.id);
            expect(service.getBooking(booking.id).status).toBe('completed');
        });
    });

    describe('updateBooking()', () => {
        it('merges updates into existing booking', () => {
            const created = service.createBooking(sampleBookingInput());
            const updated = service.updateBooking(created.id, { notes: 'Aktualisiert' });
            expect(updated.notes).toBe('Aktualisiert');
            expect(updated.customer.name).toBe('Max Mustermann');
        });

        it('returns null for non-existent id', () => {
            expect(service.updateBooking('missing', { notes: 'x' })).toBeNull();
        });
    });

    // ── Query Methods ────────────────────────────────────────────────

    describe('getBooking() / getBookingByCode()', () => {
        it('finds booking by id', () => {
            const created = service.createBooking(sampleBookingInput());
            expect(service.getBooking(created.id)).toBe(created);
        });

        it('finds booking by confirmation code', () => {
            const created = service.createBooking(sampleBookingInput());
            expect(service.getBookingByCode(created.confirmationCode).id).toBe(created.id);
        });

        it('returns undefined for unknown code', () => {
            expect(service.getBookingByCode('FREY-ZZZZZZ')).toBeUndefined();
        });
    });

    describe('getPendingBookings() / getConfirmedBookings()', () => {
        it('filters by status correctly', () => {
            const b1 = service.createBooking(sampleBookingInput());
            const b2 = service.createBooking(sampleBookingInput({ serviceType: 'wartung' }));
            service.confirmBooking(b2.id);

            expect(service.getPendingBookings()).toHaveLength(1);
            expect(service.getConfirmedBookings()).toHaveLength(1);
            expect(service.getConfirmedBookings()[0].id).toBe(b2.id);
        });
    });

    describe('getBookingsForDate()', () => {
        it('returns bookings for given date', () => {
            service.createBooking(sampleBookingInput({ date: '2026-04-10' }));
            service.createBooking(sampleBookingInput({ date: '2026-04-11' }));
            expect(service.getBookingsForDate('2026-04-10')).toHaveLength(1);
        });

        it('excludes cancelled bookings', () => {
            const b = service.createBooking(sampleBookingInput({ date: '2026-04-10' }));
            service.cancelBooking(b.id, 'Test');
            expect(service.getBookingsForDate('2026-04-10')).toHaveLength(0);
        });
    });

    // ── Available Slots ──────────────────────────────────────────────

    describe('getAvailableSlots()', () => {
        it('returns fallback slots when no calendarService', () => {
            const slots = service.getAvailableSlots('beratung', '2026-04-10');
            expect(slots).toHaveLength(4);
            expect(slots[0].start).toBe('09:00');
            // beratung = 30 min
            expect(slots[0].end).toBe('09:30');
        });

        it('returns empty array for unknown service type', () => {
            expect(service.getAvailableSlots('nonexistent', '2026-04-10')).toEqual([]);
        });

        it('calculates correct end times for 120-min reparatur', () => {
            const slots = service.getAvailableSlots('reparatur', '2026-04-10');
            expect(slots[0].end).toBe('11:00'); // 09:00 + 120 min
            expect(slots[2].end).toBe('16:00'); // 14:00 + 120 min
        });

        it('delegates to calendarService when available', () => {
            const mockSlots = [{ start: '10:00', end: '10:30' }];
            window.calendarService = { getAvailableSlots: vi.fn(() => mockSlots) };
            const result = service.getAvailableSlots('beratung', '2026-04-10');
            expect(result).toBe(mockSlots);
        });
    });

    describe('getAvailableDates()', () => {
        it('returns dates within booking window', () => {
            const dates = service.getAvailableDates('beratung', 5);
            expect(dates.length).toBeGreaterThan(0);
            expect(dates.length).toBeLessThanOrEqual(5);
            dates.forEach(d => {
                expect(d).toHaveProperty('date');
                expect(d).toHaveProperty('dayName');
                expect(d).toHaveProperty('slotsAvailable');
            });
        });
    });

    // ── Service Types ────────────────────────────────────────────────

    describe('Service type management', () => {
        it('getServiceType() returns correct service', () => {
            const st = service.getServiceType('wartung');
            expect(st.name).toBe('Wartungstermin');
            expect(st.duration).toBe(90);
        });

        it('getServiceName() returns name or fallback to id', () => {
            expect(service.getServiceName('beratung')).toBe('Beratungsgespräch');
            expect(service.getServiceName('unknown')).toBe('unknown');
        });

        it('addServiceType() adds and persists', () => {
            service.addServiceType({ id: 'notdienst', name: 'Notdienst', duration: 45, price: 150 });
            expect(service.getServiceTypes()).toHaveLength(5);
            expect(service.getServiceType('notdienst').price).toBe(150);
        });

        it('addServiceType() uses defaults for missing fields', () => {
            service.addServiceType({ name: 'Minimal' });
            const added = service.getServiceTypes().at(-1);
            expect(added.duration).toBe(60);
            expect(added.price).toBe(0);
            expect(added.id).toMatch(/^service-/);
        });

        it('updateServiceType() merges updates', () => {
            service.updateServiceType('beratung', { price: 50, duration: 45 });
            const updated = service.getServiceType('beratung');
            expect(updated.price).toBe(50);
            expect(updated.duration).toBe(45);
            expect(updated.name).toBe('Beratungsgespräch');
        });
    });

    // ── Booking Link ─────────────────────────────────────────────────

    describe('generateBookingLink()', () => {
        it('returns base URL without service type', () => {
            expect(service.generateBookingLink()).toBe('https://app.freyaivisions.de/booking.html');
        });

        it('appends service query param when given', () => {
            expect(service.generateBookingLink('reparatur')).toBe('https://app.freyaivisions.de/booking.html?service=reparatur');
        });
    });

    // ── Email Templates ──────────────────────────────────────────────

    describe('getConfirmationEmailData()', () => {
        it('returns email with correct recipient and subject', () => {
            const booking = service.createBooking(sampleBookingInput());
            const email = service.getConfirmationEmailData(booking);
            expect(email.to).toBe('max@example.de');
            expect(email.subject).toContain('Terminbestätigung');
            expect(email.subject).toContain('Beratungsgespräch');
        });

        it('body contains confirmation code and date', () => {
            const booking = service.createBooking(sampleBookingInput());
            const email = service.getConfirmationEmailData(booking);
            expect(email.body).toContain(booking.confirmationCode);
            expect(email.body).toContain('09:00 - 09:30 Uhr');
            expect(email.body).toContain('Max Mustermann');
        });

        it('body contains company name fallback', () => {
            const booking = service.createBooking(sampleBookingInput());
            const email = service.getConfirmationEmailData(booking);
            expect(email.body).toContain('FreyAI Visions');
        });
    });

    describe('getReminderEmailData()', () => {
        it('returns reminder with start time in subject', () => {
            const booking = service.createBooking(sampleBookingInput());
            const email = service.getReminderEmailData(booking);
            expect(email.subject).toContain('Terminerinnerung');
            expect(email.subject).toContain('09:00 Uhr');
        });

        it('body contains service name and customer greeting', () => {
            const booking = service.createBooking(sampleBookingInput());
            const email = service.getReminderEmailData(booking);
            expect(email.body).toContain('Beratungsgespräch');
            expect(email.body).toContain('Max Mustermann');
            expect(email.body).toContain('Wir freuen uns auf Sie');
        });
    });

    // ── Statistics ────────────────────────────────────────────────────

    describe('getBookingStats()', () => {
        it('returns zeroes when no bookings', () => {
            const stats = service.getBookingStats();
            expect(stats.total).toBe(0);
            expect(stats.pending).toBe(0);
            expect(stats.confirmed).toBe(0);
            expect(stats.completed).toBe(0);
            expect(stats.cancelled).toBe(0);
        });

        it('counts statuses correctly after mixed operations', () => {
            const b1 = service.createBooking(sampleBookingInput());
            const b2 = service.createBooking(sampleBookingInput());
            const b3 = service.createBooking(sampleBookingInput());
            const b4 = service.createBooking(sampleBookingInput());

            service.confirmBooking(b1.id);
            service.completeBooking(b2.id);
            service.cancelBooking(b3.id, 'Test');
            // b4 stays pending

            const stats = service.getBookingStats();
            expect(stats.total).toBe(4);
            expect(stats.confirmed).toBe(1);
            expect(stats.completed).toBe(1);
            expect(stats.cancelled).toBe(1);
            expect(stats.pending).toBe(1);
        });

        it('counts thisMonth bookings', () => {
            service.createBooking(sampleBookingInput());
            const stats = service.getBookingStats();
            expect(stats.thisMonth).toBeGreaterThanOrEqual(1);
        });
    });

    // ── Helpers ──────────────────────────────────────────────────────

    describe('generateConfirmationCode()', () => {
        it('matches FREY-XXXXXX format (6 uppercase alphanumeric chars)', () => {
            for (let i = 0; i < 20; i++) {
                const code = service.generateConfirmationCode();
                expect(code).toMatch(/^FREY-[A-Z0-9]{6}$/);
            }
        });
    });

    describe('addMinutes()', () => {
        it('adds 30 minutes to 09:00', () => {
            expect(service.addMinutes('09:00', 30)).toBe('09:30');
        });

        it('rolls over the hour correctly', () => {
            expect(service.addMinutes('09:45', 30)).toBe('10:15');
        });

        it('handles multi-hour addition', () => {
            expect(service.addMinutes('14:00', 120)).toBe('16:00');
        });

        it('handles midnight rollover', () => {
            expect(service.addMinutes('23:30', 60)).toBe('24:30');
        });

        it('handles zero minutes', () => {
            expect(service.addMinutes('08:15', 0)).toBe('08:15');
        });
    });

    describe('formatDate()', () => {
        it('returns German locale date string', () => {
            const formatted = service.formatDate('2026-04-10');
            // Should contain weekday, day, month, year in German
            expect(formatted).toContain('2026');
            expect(formatted).toContain('April');
            expect(formatted).toContain('10');
        });
    });

    describe('getStatusLabel()', () => {
        it('returns German labels for known statuses', () => {
            expect(service.getStatusLabel('pending')).toBe('Ausstehend');
            expect(service.getStatusLabel('confirmed')).toBe('Bestätigt');
            expect(service.getStatusLabel('completed')).toBe('Abgeschlossen');
            expect(service.getStatusLabel('cancelled')).toBe('Storniert');
        });

        it('returns raw status for unknown values', () => {
            expect(service.getStatusLabel('custom')).toBe('custom');
        });
    });

    describe('getStatusColor()', () => {
        it('returns correct hex colors for each status', () => {
            expect(service.getStatusColor('pending')).toBe('#f59e0b');
            expect(service.getStatusColor('confirmed')).toBe('#22c55e');
            expect(service.getStatusColor('completed')).toBe('#c8956c');
            expect(service.getStatusColor('cancelled')).toBe('#ef4444');
        });

        it('returns fallback grey for unknown status', () => {
            expect(service.getStatusColor('unknown')).toBe('#64748b');
        });
    });

    // ── Cal.com Mapping ──────────────────────────────────────────────

    describe('_mapCalcomStatus()', () => {
        it('maps ACCEPTED to confirmed', () => {
            expect(service._mapCalcomStatus('ACCEPTED')).toBe('confirmed');
        });

        it('maps PENDING to pending', () => {
            expect(service._mapCalcomStatus('PENDING')).toBe('pending');
        });

        it('maps CANCELLED to cancelled', () => {
            expect(service._mapCalcomStatus('CANCELLED')).toBe('cancelled');
        });

        it('maps REJECTED to cancelled', () => {
            expect(service._mapCalcomStatus('REJECTED')).toBe('cancelled');
        });

        it('defaults unknown status to pending', () => {
            expect(service._mapCalcomStatus('WHATEVER')).toBe('pending');
        });
    });

    describe('_mapCalcomBooking()', () => {
        const calcomBooking = {
            id: 42,
            uid: 'abc-uid-123',
            startTime: '2026-05-15T10:00:00.000Z',
            endTime: '2026-05-15T11:00:00.000Z',
            status: 'ACCEPTED',
            title: 'Beratung mit Schmidt',
            description: 'Dach prüfen',
            eventType: { slug: 'beratung', title: 'Beratungsgespräch' },
            attendees: [{ name: 'Hans Schmidt', email: 'hans@schmidt.de', phone: '+49 171 9999' }],
            createdAt: '2026-05-01T08:00:00.000Z'
        };

        it('maps id with calcom- prefix', () => {
            const mapped = service._mapCalcomBooking(calcomBooking);
            expect(mapped.id).toBe('calcom-42');
            expect(mapped.calcomId).toBe(42);
            expect(mapped.calcomUid).toBe('abc-uid-123');
        });

        it('extracts date and time strings from ISO timestamps', () => {
            const mapped = service._mapCalcomBooking(calcomBooking);
            // Note: dates are parsed in local TZ; we check the format
            expect(mapped.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(mapped.startTime).toMatch(/^\d{2}:\d{2}$/);
            expect(mapped.endTime).toMatch(/^\d{2}:\d{2}$/);
        });

        it('maps attendee data to customer fields', () => {
            const mapped = service._mapCalcomBooking(calcomBooking);
            expect(mapped.customer.name).toBe('Hans Schmidt');
            expect(mapped.customer.email).toBe('hans@schmidt.de');
            expect(mapped.customer.telefon).toBe('+49 171 9999');
        });

        it('uses eventType slug as serviceType', () => {
            const mapped = service._mapCalcomBooking(calcomBooking);
            expect(mapped.serviceType).toBe('beratung');
        });

        it('falls back to title when no attendee', () => {
            const noAttendee = { ...calcomBooking, attendees: [] };
            const mapped = service._mapCalcomBooking(noAttendee);
            expect(mapped.customer.name).toBe('Beratung mit Schmidt');
        });

        it('sets source to calcom', () => {
            const mapped = service._mapCalcomBooking(calcomBooking);
            expect(mapped.source).toBe('calcom');
        });

        it('maps status through _mapCalcomStatus', () => {
            const mapped = service._mapCalcomBooking(calcomBooking);
            expect(mapped.status).toBe('confirmed');
        });
    });

    // ── Settings ─────────────────────────────────────────────────────

    describe('updateSettings()', () => {
        it('merges and persists settings', () => {
            service.updateSettings({ confirmationEmail: false });
            expect(service.settings.confirmationEmail).toBe(false);
            // serviceTypes should still exist
            expect(service.settings.serviceTypes).toHaveLength(4);
            const stored = JSON.parse(localStorage.getItem('freyai_booking_settings'));
            expect(stored.confirmationEmail).toBe(false);
        });
    });
});
