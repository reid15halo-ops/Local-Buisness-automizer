/* ============================================
   Booking Service - Online-Terminbuchung
   Kundenportal für Selbstbuchung
   ============================================ */

class BookingService {
    constructor() {
        this.bookings = JSON.parse(localStorage.getItem('freyai_bookings') || '[]');
        this.settings = JSON.parse(localStorage.getItem('freyai_booking_settings') || '{}');

        // Default settings
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
                minDaysAhead: 1, // Mindestens 1 Tag im Voraus
                maxDaysAhead: 30 // Maximal 30 Tage im Voraus
            };
        }

        if (!this.settings.confirmationEmail) {
            this.settings.confirmationEmail = true;
        }
    }

    // Booking CRUD
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
            status: 'pending', // pending, confirmed, cancelled, completed
            confirmationCode: this.generateConfirmationCode(),
            createdAt: new Date().toISOString(),
            confirmedAt: null,
            cancelledAt: null,
            reminderSent: false
        };

        this.bookings.push(newBooking);
        this.save();

        // Create calendar appointment
        if (window.calendarService) {
            window.calendarService.addAppointment({
                title: `Buchung: ${this.getServiceName(booking.serviceType)}`,
                description: `Kunde: ${newBooking.customer.name}\nTel: ${newBooking.customer.telefon}`,
                date: newBooking.date,
                startTime: newBooking.startTime,
                endTime: newBooking.endTime,
                customerName: newBooking.customer.name,
                type: 'besichtigung',
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

    // Available Slots for Customer Portal
    getAvailableSlots(serviceTypeId, date) {
        const service = this.getServiceType(serviceTypeId);
        if (!service) {return [];}

        // Get base available slots from calendar
        if (window.calendarService) {
            return window.calendarService.getAvailableSlots(date, service.duration);
        }

        // Fallback: Return demo slots
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

    // Service Types
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

    // Generate Booking Link for sharing
    generateBookingLink(serviceTypeId = null) {
        const baseUrl = window.location.origin + '/booking.html';
        if (serviceTypeId) {
            return `${baseUrl}?service=${serviceTypeId}`;
        }
        return baseUrl;
    }

    // Email Templates
    getConfirmationEmailData(booking) {
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
Tel: +49 6029 99 22 96 4
E-Mail: info@freyai-visions.de

Mit freundlichen Grüßen
FreyAI Visions`
        };
    }

    getReminderEmailData(booking) {
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
FreyAI Visions`
        };
    }

    // Statistics
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

    // Helpers
    generateId() { return 'book-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9); }

    generateConfirmationCode() {
        return 'FREY-' + Math.random().toString(36).substr(2, 6).toUpperCase();
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
        const colors = { pending: '#f59e0b', confirmed: '#22c55e', completed: '#6366f1', cancelled: '#ef4444' };
        return colors[status] || '#64748b';
    }

    // Settings
    updateSettings(updates) {
        this.settings = { ...this.settings, ...updates };
        this.saveSettings();
    }

    // Persistence
    save() { localStorage.setItem('freyai_bookings', JSON.stringify(this.bookings)); }
    saveSettings() { localStorage.setItem('freyai_booking_settings', JSON.stringify(this.settings)); }
}

window.bookingService = new BookingService();
