/* ============================================
   Booking Service - Online-Terminbuchung
   Kundenportal für Selbstbuchung
   ============================================ */

class BookingService {
    constructor() {
        this.bookings = StorageUtils.getJSON('freyai_bookings', [], { service: 'bookingService' });
        this.settings = StorageUtils.getJSON('freyai_booking_settings', {}, { service: 'bookingService' });

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

    // Settings
    updateSettings(updates) {
        this.settings = { ...this.settings, ...updates };
        this.saveSettings();
    }

    // ── Cal.com Integration ─────────────────────────────────────────
    // Fetches bookings from self-hosted Cal.com instance.
    // Requires CALCOM_API_KEY to be set in app-config / localStorage.
    // Cal.com v1 API: GET /api/v1/bookings?apiKey=...

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
            if (!res.ok) {throw new Error(`Cal.com API ${res.status}: ${res.statusText}`);}
            const data = await res.json();
            const bookings = data.bookings || data || [];
            return bookings.map(b => this._mapCalcomBooking(b));
        } catch (err) {
            console.error('[BookingService] Cal.com Fetch fehlgeschlagen:', err);
            return [];
        }
    }

    // Maps a Cal.com booking object to the app's internal booking format.
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

    // Syncs Cal.com bookings into calendar view.
    // Call this on app init or when calendar is opened.
    async syncCalcomToCalendar() {
        try {
            const calcomBookings = await this.fetchCalcomBookings();
            if (!calcomBookings.length) {return 0;}

            let added = 0;
            for (const booking of calcomBookings) {
                // Skip cancelled
                if (booking.status === 'cancelled') {continue;}

                // Only add if not already in calendar (by calcom id)
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
                            color: '#8b5cf6', // Purple to distinguish Cal.com bookings
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

    // Persistence
    save() { localStorage.setItem('freyai_bookings', JSON.stringify(this.bookings)); }
    saveSettings() { localStorage.setItem('freyai_booking_settings', JSON.stringify(this.settings)); }
}

window.bookingService = new BookingService();
