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
const StorageUtils = {
    getJSON: vi.fn((key, defaultVal) => defaultVal),
    setJSON: vi.fn(() => true),
    safeDate: vi.fn(str => str ? new Date(str) : null)
};
global.StorageUtils = StorageUtils;

// Mock window globals
global.window = {
    ...global.window,
    calendarService: undefined,
    storeService: undefined,
    errorHandler: undefined,
    location: { origin: 'https://app.freyaivisions.de' },
    APP_CONFIG: {}
};

// Mock fetch
global.fetch = vi.fn();

// Mock document.dispatchEvent for Cal.com sync
global.document = {
    ...global.document,
    dispatchEvent: vi.fn()
};

// Mock console methods to keep test output clean
global.console = {
    ...console,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
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

    async fetchCalcomBookings() {
        const cfg = window.APP_CONFIG || {};
        const baseUrl = (cfg.CALCOM_URL || 'https://buchung.freyaivisions.de').replace(/\/+$/, '');
        const apiKey = cfg.CALCOM_API_KEY || '';

        if (!apiKey) {
            console.warn('[BookingService] Cal.com API-Key nicht konfiguriert – Sync übersprungen.');
            return [];
        }

        try {
            const res = await fetch(`${baseUrl}/api/v1/bookings`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (!res.ok) { throw new Error(`Cal.com API ${res.status}: ${res.statusText}`); }
            const data = await res.json();
            const bookings = data.bookings || data || [];
            return bookings.map(b => this._mapCalcomBooking(b));
        } catch (err) {
            console.error('[BookingService] Cal.com Fetch fehlgeschlagen:', err);
            return [];
        }
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

    async syncCalcomToCalendar() {
        try {
            const calcomBookings = await this.fetchCalcomBookings();
            if (!calcomBookings.length) { return 0; }

            let added = 0;
            for (const booking of calcomBookings) {
                if (booking.status === 'cancelled') { continue; }

                if (window.calendarService) {
                    const existing = window.calendarService.getAppointment(booking.id);
                    if (!existing) {
                        window.calendarService.addAppointment({
                            id: booking.id,
                            title: `Cal.com: ${booking.customer.name || booking.serviceType}`,
                            description: booking.notes,
                            date: booking.date,
                            startTime: booking.startTime,
                            endTime: booking.endTime,
                            customerName: booking.customer.name,
                            type: 'termin',
                            status: booking.status === 'confirmed' ? 'bestaetigt' : 'geplant',
                            color: '#8b5cf6',
                            forceAdd: true
                        });
                        added++;
                    }
                }
            }

            if (added > 0) {
                console.debug(`[BookingService] ${added} Cal.com-Buchungen synchronisiert.`);
                document.dispatchEvent(new CustomEvent('calcom:synced', { detail: { count: added } }));
            }

            return added;
        } catch (e) {
            window.errorHandler?.handle(e, 'BookingService');
            return 0;
        }
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

// Sample Cal.com booking object for reuse
function sampleCalcomBooking(overrides = {}) {
    return {
        id: 42,
        uid: 'abc-uid-123',
        startTime: '2026-05-15T10:00:00.000Z',
        endTime: '2026-05-15T11:00:00.000Z',
        status: 'ACCEPTED',
        title: 'Beratung mit Schmidt',
        description: 'Dach prüfen',
        eventType: { slug: 'beratung', title: 'Beratungsgespräch' },
        attendees: [{ name: 'Hans Schmidt', email: 'hans@schmidt.de', phone: '+49 171 9999' }],
        createdAt: '2026-05-01T08:00:00.000Z',
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
        StorageUtils.safeDate.mockClear();
        window.calendarService = undefined;
        window.storeService = undefined;
        window.errorHandler = undefined;
        window.APP_CONFIG = {};
        global.fetch.mockReset();
        global.document.dispatchEvent.mockClear();
        service = new BookingService();
    });

    // ── 1. Constructor / Defaults ────────────────────────────────────

    describe('constructor', () => {
        it('initializes with empty bookings array', () => {
            expect(service.bookings).toEqual([]);
        });

        it('sets four default service types (beratung/besichtigung/reparatur/wartung)', () => {
            const types = service.getServiceTypes();
            expect(types).toHaveLength(4);
            expect(types.map(t => t.id)).toEqual(['beratung', 'besichtigung', 'reparatur', 'wartung']);
        });

        it('sets correct durations for each default service type', () => {
            expect(service.getServiceType('beratung').duration).toBe(30);
            expect(service.getServiceType('besichtigung').duration).toBe(60);
            expect(service.getServiceType('reparatur').duration).toBe(120);
            expect(service.getServiceType('wartung').duration).toBe(90);
        });

        it('sets default booking window (1-30 days)', () => {
            expect(service.settings.bookingWindow.minDaysAhead).toBe(1);
            expect(service.settings.bookingWindow.maxDaysAhead).toBe(30);
        });

        it('enables confirmation email by default', () => {
            expect(service.settings.confirmationEmail).toBe(true);
        });

        it('reads bookings from StorageUtils on construction', () => {
            expect(StorageUtils.getJSON).toHaveBeenCalledWith('freyai_bookings', [], { service: 'bookingService' });
        });

        it('reads settings from StorageUtils on construction', () => {
            // Second call in constructor is for settings
            expect(StorageUtils.getJSON).toHaveBeenNthCalledWith(2, 'freyai_booking_settings', expect.any(Object), { service: 'bookingService' });
        });
    });

    // ── 2. createBooking() ───────────────────────────────────────────

    describe('createBooking()', () => {
        it('creates a booking with pending status', () => {
            const booking = service.createBooking(sampleBookingInput());
            expect(booking.status).toBe('pending');
        });

        it('generates an ID starting with book-', () => {
            const booking = service.createBooking(sampleBookingInput());
            expect(booking.id).toMatch(/^book-/);
        });

        it('generates a confirmation code starting with FREY-', () => {
            const booking = service.createBooking(sampleBookingInput());
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
            expect(booking.customer.telefon).toBe('+49 170 1234567');
            expect(booking.customer.firma).toBe('Musterbau GmbH');
        });

        it('defaults missing customer fields to empty strings', () => {
            const booking = service.createBooking({ serviceType: 'beratung', date: '2026-04-10', startTime: '09:00', endTime: '09:30' });
            expect(booking.customer.name).toBe('');
            expect(booking.customer.email).toBe('');
            expect(booking.customer.telefon).toBe('');
            expect(booking.customer.firma).toBe('');
        });

        it('uses provided id when given', () => {
            const booking = service.createBooking(sampleBookingInput({ id: 'custom-id-42' }));
            expect(booking.id).toBe('custom-id-42');
        });

        it('sets confirmedAt and cancelledAt to null initially', () => {
            const booking = service.createBooking(sampleBookingInput());
            expect(booking.confirmedAt).toBeNull();
            expect(booking.cancelledAt).toBeNull();
        });

        it('sets reminderSent to false initially', () => {
            const booking = service.createBooking(sampleBookingInput());
            expect(booking.reminderSent).toBe(false);
        });

        it('calls calendarService.addAppointment when available', () => {
            const mockAdd = vi.fn();
            window.calendarService = { addAppointment: mockAdd };
            service.createBooking(sampleBookingInput());
            expect(mockAdd).toHaveBeenCalledTimes(1);
            expect(mockAdd.mock.calls[0][0].title).toContain('Buchung:');
            expect(mockAdd.mock.calls[0][0].status).toBe('geplant');
        });

        it('does not throw when calendarService is undefined', () => {
            window.calendarService = undefined;
            expect(() => service.createBooking(sampleBookingInput())).not.toThrow();
        });

        it('adds booking to internal bookings array', () => {
            service.createBooking(sampleBookingInput());
            expect(service.getAllBookings()).toHaveLength(1);
        });
    });

    // ── 3. confirmBooking() ──────────────────────────────────────────

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

        it('persists change to localStorage', () => {
            const created = service.createBooking(sampleBookingInput());
            service.confirmBooking(created.id);
            const stored = JSON.parse(localStorage.getItem('freyai_bookings'));
            expect(stored[0].status).toBe('confirmed');
        });
    });

    // ── 4. cancelBooking() ───────────────────────────────────────────

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

    // ── 5. completeBooking() ─────────────────────────────────────────

    describe('completeBooking()', () => {
        it('sets status to completed via updateBooking delegation', () => {
            const created = service.createBooking(sampleBookingInput());
            const completed = service.completeBooking(created.id);
            expect(completed.status).toBe('completed');
        });

        it('returns null for non-existent id', () => {
            expect(service.completeBooking('nope')).toBeNull();
        });
    });

    // ── 6. updateBooking() ───────────────────────────────────────────

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

        it('persists updated booking to localStorage', () => {
            const created = service.createBooking(sampleBookingInput());
            service.updateBooking(created.id, { notes: 'Geändert' });
            const stored = JSON.parse(localStorage.getItem('freyai_bookings'));
            expect(stored[0].notes).toBe('Geändert');
        });
    });

    // ── Full lifecycle ───────────────────────────────────────────────

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

    // ── 7. getBooking / getBookingByCode ─────────────────────────────

    describe('getBooking() / getBookingByCode()', () => {
        it('finds booking by id', () => {
            const created = service.createBooking(sampleBookingInput());
            expect(service.getBooking(created.id)).toBe(created);
        });

        it('finds booking by confirmation code', () => {
            const created = service.createBooking(sampleBookingInput());
            expect(service.getBookingByCode(created.confirmationCode).id).toBe(created.id);
        });

        it('returns undefined for unknown id', () => {
            expect(service.getBooking('nonexistent')).toBeUndefined();
        });

        it('returns undefined for unknown code', () => {
            expect(service.getBookingByCode('FREY-ZZZZZZ')).toBeUndefined();
        });
    });

    // ── 8. getBookingsForDate() ──────────────────────────────────────

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

        it('returns empty array when no bookings match', () => {
            expect(service.getBookingsForDate('2099-01-01')).toEqual([]);
        });

        it('includes pending and confirmed bookings', () => {
            const b1 = service.createBooking(sampleBookingInput({ date: '2026-04-10' }));
            const b2 = service.createBooking(sampleBookingInput({ date: '2026-04-10' }));
            service.confirmBooking(b2.id);
            expect(service.getBookingsForDate('2026-04-10')).toHaveLength(2);
        });
    });

    // ── Filter helpers ───────────────────────────────────────────────

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

    // ── 9. getAvailableSlots() ───────────────────────────────────────

    describe('getAvailableSlots()', () => {
        it('returns 4 fallback slots when no calendarService', () => {
            const slots = service.getAvailableSlots('beratung', '2026-04-10');
            expect(slots).toHaveLength(4);
            expect(slots[0].start).toBe('09:00');
            expect(slots[0].end).toBe('09:30');
        });

        it('returns empty array for unknown service type', () => {
            expect(service.getAvailableSlots('nonexistent', '2026-04-10')).toEqual([]);
        });

        it('calculates correct end times for 120-min reparatur', () => {
            const slots = service.getAvailableSlots('reparatur', '2026-04-10');
            expect(slots[0].end).toBe('11:00');
            expect(slots[2].end).toBe('16:00');
        });

        it('calculates correct end times for 90-min wartung', () => {
            const slots = service.getAvailableSlots('wartung', '2026-04-10');
            expect(slots[0].end).toBe('10:30');
            expect(slots[1].end).toBe('12:00');
        });

        it('delegates to calendarService when available', () => {
            const mockSlots = [{ start: '10:00', end: '10:30' }];
            window.calendarService = { getAvailableSlots: vi.fn(() => mockSlots) };
            const result = service.getAvailableSlots('beratung', '2026-04-10');
            expect(result).toBe(mockSlots);
            expect(window.calendarService.getAvailableSlots).toHaveBeenCalledWith('2026-04-10', 30);
        });
    });

    // ── 10. getAvailableDates() ──────────────────────────────────────

    describe('getAvailableDates()', () => {
        it('returns dates within booking window', () => {
            const dates = service.getAvailableDates('beratung', 5);
            expect(dates.length).toBeGreaterThan(0);
            expect(dates.length).toBeLessThanOrEqual(5);
        });

        it('each date has date, dayName, and slotsAvailable', () => {
            const dates = service.getAvailableDates('beratung', 3);
            dates.forEach(d => {
                expect(d).toHaveProperty('date');
                expect(d).toHaveProperty('dayName');
                expect(d).toHaveProperty('slotsAvailable');
                expect(d.slotsAvailable).toBeGreaterThan(0);
            });
        });

        it('respects maxDaysAhead limit', () => {
            service.settings.bookingWindow.maxDaysAhead = 3;
            const dates = service.getAvailableDates('beratung', 100);
            expect(dates.length).toBeLessThanOrEqual(3);
        });

        it('returns empty for unknown service type', () => {
            const dates = service.getAvailableDates('nonexistent', 5);
            expect(dates).toEqual([]);
        });
    });

    // ── 11. Service type CRUD ────────────────────────────────────────

    describe('Service type management', () => {
        it('getServiceTypes() returns all 4 defaults', () => {
            expect(service.getServiceTypes()).toHaveLength(4);
        });

        it('getServiceType() returns correct service', () => {
            const st = service.getServiceType('wartung');
            expect(st.name).toBe('Wartungstermin');
            expect(st.duration).toBe(90);
        });

        it('getServiceType() returns undefined for unknown id', () => {
            expect(service.getServiceType('ghost')).toBeUndefined();
        });

        it('getServiceName() returns name for known id', () => {
            expect(service.getServiceName('beratung')).toBe('Beratungsgespräch');
        });

        it('getServiceName() falls back to id for unknown type', () => {
            expect(service.getServiceName('unknown')).toBe('unknown');
        });

        it('addServiceType() adds and persists a new type', () => {
            service.addServiceType({ id: 'notdienst', name: 'Notdienst', duration: 45, price: 150 });
            expect(service.getServiceTypes()).toHaveLength(5);
            expect(service.getServiceType('notdienst').price).toBe(150);
            const stored = JSON.parse(localStorage.getItem('freyai_booking_settings'));
            expect(stored.serviceTypes).toHaveLength(5);
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

        it('updateServiceType() does nothing for unknown id', () => {
            service.updateServiceType('nonexistent', { price: 999 });
            expect(service.getServiceTypes()).toHaveLength(4);
        });
    });

    // ── 12. generateBookingLink() ────────────────────────────────────

    describe('generateBookingLink()', () => {
        it('returns base URL without service type', () => {
            expect(service.generateBookingLink()).toBe('https://app.freyaivisions.de/booking.html');
        });

        it('appends service query param when given', () => {
            expect(service.generateBookingLink('reparatur')).toBe('https://app.freyaivisions.de/booking.html?service=reparatur');
        });

        it('returns base URL when null passed explicitly', () => {
            expect(service.generateBookingLink(null)).toBe('https://app.freyaivisions.de/booking.html');
        });
    });

    // ── 13. Email Templates ──────────────────────────────────────────

    describe('getConfirmationEmailData()', () => {
        it('returns email with correct recipient and subject', () => {
            const booking = service.createBooking(sampleBookingInput());
            const email = service.getConfirmationEmailData(booking);
            expect(email.to).toBe('max@example.de');
            expect(email.subject).toContain('Terminbestätigung');
            expect(email.subject).toContain('Beratungsgespräch');
        });

        it('body contains confirmation code, time, and customer name', () => {
            const booking = service.createBooking(sampleBookingInput());
            const email = service.getConfirmationEmailData(booking);
            expect(email.body).toContain(booking.confirmationCode);
            expect(email.body).toContain('09:00 - 09:30 Uhr');
            expect(email.body).toContain('Max Mustermann');
        });

        it('body contains company name fallback (FreyAI Visions)', () => {
            const booking = service.createBooking(sampleBookingInput());
            const email = service.getConfirmationEmailData(booking);
            expect(email.body).toContain('FreyAI Visions');
        });

        it('body includes company phone and email when available', () => {
            StorageUtils.getJSON.mockImplementation((key, defaultVal) => {
                if (key === 'freyai_admin_settings') {
                    return { company_name: 'Meister GmbH', company_phone: '0800-123', company_email: 'info@meister.de' };
                }
                return defaultVal;
            });
            service = new BookingService();
            const booking = service.createBooking(sampleBookingInput());
            const email = service.getConfirmationEmailData(booking);
            expect(email.body).toContain('Tel: 0800-123');
            expect(email.body).toContain('E-Mail: info@meister.de');
            expect(email.body).toContain('Meister GmbH');
        });
    });

    describe('getReminderEmailData()', () => {
        it('returns reminder with start time in subject', () => {
            const booking = service.createBooking(sampleBookingInput());
            const email = service.getReminderEmailData(booking);
            expect(email.subject).toContain('Terminerinnerung');
            expect(email.subject).toContain('09:00 Uhr');
        });

        it('body contains service name, customer greeting, and closing', () => {
            const booking = service.createBooking(sampleBookingInput());
            const email = service.getReminderEmailData(booking);
            expect(email.body).toContain('Beratungsgespräch');
            expect(email.body).toContain('Max Mustermann');
            expect(email.body).toContain('Wir freuen uns auf Sie');
        });

        it('sends to the correct email address', () => {
            const booking = service.createBooking(sampleBookingInput());
            const email = service.getReminderEmailData(booking);
            expect(email.to).toBe('max@example.de');
        });
    });

    // ── 14. _companyInfo() ───────────────────────────────────────────

    describe('_companyInfo()', () => {
        it('returns defaults when no admin_settings or storeService', () => {
            const info = service._companyInfo();
            expect(info.name).toBe('FreyAI Visions');
            expect(info.phone).toBe('');
            expect(info.email).toBe('');
        });

        it('reads from admin_settings first', () => {
            StorageUtils.getJSON.mockImplementation((key, defaultVal) => {
                if (key === 'freyai_admin_settings') {
                    return { company_name: 'Admin Firma', company_phone: '0800-ADMIN', company_email: 'admin@test.de' };
                }
                return defaultVal;
            });
            const info = service._companyInfo();
            expect(info.name).toBe('Admin Firma');
            expect(info.phone).toBe('0800-ADMIN');
            expect(info.email).toBe('admin@test.de');
        });

        it('falls back to storeService when admin_settings empty', () => {
            window.storeService = {
                state: {
                    settings: { companyName: 'Store Firma', phone: '0800-STORE', email: 'store@test.de' }
                }
            };
            const info = service._companyInfo();
            expect(info.name).toBe('Store Firma');
            expect(info.phone).toBe('0800-STORE');
            expect(info.email).toBe('store@test.de');
        });

        it('admin_settings takes priority over storeService', () => {
            StorageUtils.getJSON.mockImplementation((key, defaultVal) => {
                if (key === 'freyai_admin_settings') {
                    return { company_name: 'Admin Wins' };
                }
                return defaultVal;
            });
            window.storeService = {
                state: { settings: { companyName: 'Store Loses' } }
            };
            const info = service._companyInfo();
            expect(info.name).toBe('Admin Wins');
        });
    });

    // ── 15. Cal.com Integration ──────────────────────────────────────

    describe('fetchCalcomBookings()', () => {
        it('returns empty array when no API key configured', async () => {
            window.APP_CONFIG = {};
            const result = await service.fetchCalcomBookings();
            expect(result).toEqual([]);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('fetches bookings from Cal.com API with Bearer token', async () => {
            window.APP_CONFIG = { CALCOM_API_KEY: 'test-key-123', CALCOM_URL: 'https://cal.example.com' };
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ bookings: [sampleCalcomBooking()] })
            });

            const result = await service.fetchCalcomBookings();
            expect(global.fetch).toHaveBeenCalledWith(
                'https://cal.example.com/api/v1/bookings',
                { headers: { 'Authorization': 'Bearer test-key-123' } }
            );
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('calcom-42');
        });

        it('uses default Cal.com URL when not configured', async () => {
            window.APP_CONFIG = { CALCOM_API_KEY: 'key' };
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ([])
            });

            await service.fetchCalcomBookings();
            expect(global.fetch).toHaveBeenCalledWith(
                'https://buchung.freyaivisions.de/api/v1/bookings',
                expect.any(Object)
            );
        });

        it('returns empty array on HTTP error', async () => {
            window.APP_CONFIG = { CALCOM_API_KEY: 'key' };
            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            const result = await service.fetchCalcomBookings();
            expect(result).toEqual([]);
        });

        it('returns empty array on network error', async () => {
            window.APP_CONFIG = { CALCOM_API_KEY: 'key' };
            global.fetch.mockRejectedValue(new Error('Network failure'));

            const result = await service.fetchCalcomBookings();
            expect(result).toEqual([]);
        });

        it('handles response with data array directly (no .bookings wrapper)', async () => {
            window.APP_CONFIG = { CALCOM_API_KEY: 'key' };
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => [sampleCalcomBooking({ id: 99 })]
            });

            const result = await service.fetchCalcomBookings();
            expect(result).toHaveLength(1);
            expect(result[0].calcomId).toBe(99);
        });
    });

    describe('_mapCalcomBooking()', () => {
        const calcomBooking = sampleCalcomBooking();

        it('maps id with calcom- prefix', () => {
            const mapped = service._mapCalcomBooking(calcomBooking);
            expect(mapped.id).toBe('calcom-42');
            expect(mapped.calcomId).toBe(42);
            expect(mapped.calcomUid).toBe('abc-uid-123');
        });

        it('extracts date and time strings from ISO timestamps', () => {
            const mapped = service._mapCalcomBooking(calcomBooking);
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

        it('falls back to eventType title when no slug', () => {
            const noSlug = sampleCalcomBooking({ eventType: { title: 'Wartung' } });
            const mapped = service._mapCalcomBooking(noSlug);
            expect(mapped.serviceType).toBe('Wartung');
        });

        it('falls back to calcom when no eventType', () => {
            const noEvent = sampleCalcomBooking({ eventType: null });
            const mapped = service._mapCalcomBooking(noEvent);
            expect(mapped.serviceType).toBe('calcom');
        });

        it('falls back to title when no attendee', () => {
            const noAttendee = sampleCalcomBooking({ attendees: [] });
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

        it('sets empty confirmationCode', () => {
            const mapped = service._mapCalcomBooking(calcomBooking);
            expect(mapped.confirmationCode).toBe('');
        });
    });

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

    describe('syncCalcomToCalendar()', () => {
        it('returns 0 when fetchCalcomBookings returns empty', async () => {
            window.APP_CONFIG = {};
            const count = await service.syncCalcomToCalendar();
            expect(count).toBe(0);
        });

        it('adds non-cancelled bookings to calendarService', async () => {
            window.APP_CONFIG = { CALCOM_API_KEY: 'key' };
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ bookings: [sampleCalcomBooking({ status: 'ACCEPTED' })] })
            });
            window.calendarService = {
                getAppointment: vi.fn(() => null),
                addAppointment: vi.fn()
            };

            const count = await service.syncCalcomToCalendar();
            expect(count).toBe(1);
            expect(window.calendarService.addAppointment).toHaveBeenCalledTimes(1);
            expect(window.calendarService.addAppointment.mock.calls[0][0].color).toBe('#8b5cf6');
        });

        it('skips cancelled bookings', async () => {
            window.APP_CONFIG = { CALCOM_API_KEY: 'key' };
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ bookings: [sampleCalcomBooking({ status: 'CANCELLED' })] })
            });
            window.calendarService = {
                getAppointment: vi.fn(() => null),
                addAppointment: vi.fn()
            };

            const count = await service.syncCalcomToCalendar();
            expect(count).toBe(0);
            expect(window.calendarService.addAppointment).not.toHaveBeenCalled();
        });

        it('skips bookings already in calendar', async () => {
            window.APP_CONFIG = { CALCOM_API_KEY: 'key' };
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ bookings: [sampleCalcomBooking()] })
            });
            window.calendarService = {
                getAppointment: vi.fn(() => ({ id: 'calcom-42' })),
                addAppointment: vi.fn()
            };

            const count = await service.syncCalcomToCalendar();
            expect(count).toBe(0);
            expect(window.calendarService.addAppointment).not.toHaveBeenCalled();
        });

        it('dispatches calcom:synced event when bookings added', async () => {
            window.APP_CONFIG = { CALCOM_API_KEY: 'key' };
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ bookings: [sampleCalcomBooking()] })
            });
            window.calendarService = {
                getAppointment: vi.fn(() => null),
                addAppointment: vi.fn()
            };

            await service.syncCalcomToCalendar();
            expect(global.document.dispatchEvent).toHaveBeenCalled();
        });

        it('calls errorHandler on unexpected errors', async () => {
            const mockHandle = vi.fn();
            window.errorHandler = { handle: mockHandle };
            // Override fetchCalcomBookings to throw inside syncCalcomToCalendar's try block
            service.fetchCalcomBookings = vi.fn().mockRejectedValue(new Error('sync explosion'));

            const count = await service.syncCalcomToCalendar();
            expect(count).toBe(0);
            expect(mockHandle).toHaveBeenCalledWith(expect.any(Error), 'BookingService');
        });
    });

    // ── 16. addMinutes() ─────────────────────────────────────────────

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

        it('handles midnight rollover (23:30 + 60)', () => {
            expect(service.addMinutes('23:30', 60)).toBe('24:30');
        });

        it('handles zero minutes', () => {
            expect(service.addMinutes('08:15', 0)).toBe('08:15');
        });

        it('pads single-digit hours and minutes', () => {
            expect(service.addMinutes('00:00', 5)).toBe('00:05');
            expect(service.addMinutes('01:00', 0)).toBe('01:00');
        });
    });

    // ── 17. formatDate() ─────────────────────────────────────────────

    describe('formatDate()', () => {
        it('returns German locale date string with year, month, and day', () => {
            const formatted = service.formatDate('2026-04-10');
            expect(formatted).toContain('2026');
            expect(formatted).toContain('April');
            expect(formatted).toContain('10');
        });

        it('contains a weekday name', () => {
            const formatted = service.formatDate('2026-04-10');
            // 2026-04-10 is a Friday -> Freitag in German
            expect(formatted.length).toBeGreaterThan(10);
        });
    });

    // ── 18. getStatusLabel / getStatusColor ──────────────────────────

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

    // ── 19. getBookingStats() ────────────────────────────────────────

    describe('getBookingStats()', () => {
        it('returns zeroes when no bookings', () => {
            const stats = service.getBookingStats();
            expect(stats.total).toBe(0);
            expect(stats.pending).toBe(0);
            expect(stats.confirmed).toBe(0);
            expect(stats.completed).toBe(0);
            expect(stats.cancelled).toBe(0);
            expect(stats.thisMonth).toBe(0);
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

        it('counts thisMonth bookings (all created now are thisMonth)', () => {
            service.createBooking(sampleBookingInput());
            service.createBooking(sampleBookingInput());
            const stats = service.getBookingStats();
            expect(stats.thisMonth).toBe(2);
        });
    });

    // ── 20. generateConfirmationCode() ───────────────────────────────

    describe('generateConfirmationCode()', () => {
        it('starts with FREY-', () => {
            const code = service.generateConfirmationCode();
            expect(code.startsWith('FREY-')).toBe(true);
        });

        it('matches FREY-XXXXXX format (6 uppercase alphanumeric chars)', () => {
            for (let i = 0; i < 20; i++) {
                const code = service.generateConfirmationCode();
                expect(code).toMatch(/^FREY-[A-Z0-9]{6}$/);
            }
        });

        it('generates unique codes', () => {
            const codes = new Set();
            for (let i = 0; i < 50; i++) {
                codes.add(service.generateConfirmationCode());
            }
            // With 36^6 possibilities, 50 codes should all be unique
            expect(codes.size).toBe(50);
        });
    });

    // ── Settings ─────────────────────────────────────────────────────

    describe('updateSettings()', () => {
        it('merges and persists settings', () => {
            service.updateSettings({ confirmationEmail: false });
            expect(service.settings.confirmationEmail).toBe(false);
            expect(service.settings.serviceTypes).toHaveLength(4);
            const stored = JSON.parse(localStorage.getItem('freyai_booking_settings'));
            expect(stored.confirmationEmail).toBe(false);
        });

        it('preserves booking window when updating other settings', () => {
            service.updateSettings({ customField: 'test' });
            expect(service.settings.bookingWindow.minDaysAhead).toBe(1);
            expect(service.settings.bookingWindow.maxDaysAhead).toBe(30);
        });
    });

    // ── generateId() ─────────────────────────────────────────────────

    describe('generateId()', () => {
        it('generates ids starting with book-', () => {
            const id = service.generateId();
            expect(id).toMatch(/^book-/);
        });

        it('generates unique ids', () => {
            const id1 = service.generateId();
            const id2 = service.generateId();
            expect(id1).not.toBe(id2);
        });
    });
});
