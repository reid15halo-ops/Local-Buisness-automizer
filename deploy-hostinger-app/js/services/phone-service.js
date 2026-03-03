/* ============================================
   Phone Service - Telefon-Integration
   Click-to-Call und Anrufprotokoll
   ============================================ */

class PhoneService {
    constructor() {
        this.callHistory = JSON.parse(localStorage.getItem('freyai_phone_history') || '[]');
        this.quickDials = JSON.parse(localStorage.getItem('freyai_quick_dials') || '[]');

        // Add default quick dials if empty
        if (this.quickDials.length === 0) {
            this.quickDials = [
                { name: 'Büro', number: '+49602999229640' },
                { name: 'Notfall', number: '112' }
            ];
        }
    }

    // Click-to-Call
    makeCall(phoneNumber, customerData = null) {
        // Clean phone number
        const cleanNumber = this.formatPhoneForCall(phoneNumber);

        // Create call log entry
        const callEntry = {
            id: this.generateId(),
            phoneNumber: phoneNumber,
            cleanNumber: cleanNumber,
            customerId: customerData?.id || null,
            customerName: customerData?.name || null,
            direction: 'outbound',
            status: 'initiated',
            startedAt: new Date().toISOString(),
            endedAt: null,
            duration: null,
            notes: ''
        };

        this.callHistory.push(callEntry);
        this.save();

        // Open phone dialer
        const telUrl = `tel:${cleanNumber}`;
        window.location.href = telUrl;

        // Also open call notes modal after short delay
        setTimeout(() => {
            this.showCallNotesPrompt(callEntry.id);
        }, 1000);

        return callEntry;
    }

    // Update call after completion
    completeCall(callId, notes, duration = null) {
        const call = this.getCall(callId);
        if (call) {
            call.status = 'completed';
            call.endedAt = new Date().toISOString();
            call.notes = notes;
            if (duration) {call.duration = duration;}
            this.save();

            // Log to communication service if available
            if (window.communicationService) {
                window.communicationService.logCall({
                    direction: call.direction,
                    phoneNumber: call.phoneNumber,
                    customerId: call.customerId,
                    customerName: call.customerName,
                    duration: call.duration,
                    notes: call.notes,
                    outcome: 'connected'
                });
            }

            return call;
        }
        return null;
    }

    // Mark as no answer
    markNoAnswer(callId) {
        const call = this.getCall(callId);
        if (call) {
            call.status = 'no_answer';
            call.endedAt = new Date().toISOString();
            this.save();
            return call;
        }
        return null;
    }

    // Get call
    getCall(id) { return this.callHistory.find(c => c.id === id); }

    // Call History
    getCallHistory(limit = 50) {
        return [...this.callHistory]
            .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
            .slice(0, limit);
    }

    getCallsForCustomer(customerId) {
        return this.callHistory.filter(c => c.customerId === customerId);
    }

    getTodaysCalls() {
        const today = new Date().toISOString().split('T')[0];
        return this.callHistory.filter(c => c.startedAt.startsWith(today));
    }

    // Quick Dial
    addQuickDial(name, number) {
        this.quickDials.push({ name, number, id: 'qd-' + Date.now() });
        this.saveQuickDials();
    }

    removeQuickDial(id) {
        this.quickDials = this.quickDials.filter(q => q.id !== id);
        this.saveQuickDials();
    }

    getQuickDials() { return this.quickDials; }

    // Caller Info (for incoming call popup - would need integration)
    getCallerInfo(phoneNumber) {
        const cleanNumber = phoneNumber.replace(/\D/g, '');

        // Search in customers
        if (window.customerService) {
            const customers = window.customerService.getAllCustomers();
            const match = customers.find(c => {
                const custPhone = (c.telefon || '').replace(/\D/g, '');
                const custMobil = (c.mobil || '').replace(/\D/g, '');
                return custPhone.includes(cleanNumber) || cleanNumber.includes(custPhone) ||
                    custMobil.includes(cleanNumber) || cleanNumber.includes(custMobil);
            });

            if (match) {
                return {
                    found: true,
                    customer: match,
                    recentOrders: window.store?.auftraege?.filter(a =>
                        a.kunde?.email === match.email || a.kunde?.telefon === match.telefon
                    ).slice(0, 3) || []
                };
            }
        }

        // Search in recent calls
        const recentCall = this.callHistory.find(c =>
            c.phoneNumber.replace(/\D/g, '').includes(cleanNumber)
        );

        return {
            found: false,
            recentCall: recentCall || null
        };
    }

    // Show call notes prompt (UI helper)
    showCallNotesPrompt(callId) {
        // This is a placeholder - the actual UI is in app.js
        const event = new CustomEvent('phoneCallStarted', {
            detail: { callId, call: this.getCall(callId) }
        });
        window.dispatchEvent(event);
    }

    // Phone Number Formatting
    formatPhoneForCall(number) {
        // Remove all non-digits except +
        let clean = number.replace(/[^\d+]/g, '');

        // Convert 0 prefix to +49 for German numbers
        if (clean.startsWith('0') && !clean.startsWith('00')) {
            clean = '+49' + clean.substring(1);
        } else if (clean.startsWith('00')) {
            clean = '+' + clean.substring(2);
        }

        return clean;
    }

    formatPhoneForDisplay(number) {
        if (!number) {return '-';}

        // Try to format nicely
        let clean = number.replace(/[^\d+]/g, '');

        if (clean.startsWith('+49')) {
            // German format: +49 XXX XXXXXXX
            const rest = clean.substring(3);
            if (rest.length >= 10) {
                return `+49 ${rest.substring(0, 3)} ${rest.substring(3, 7)} ${rest.substring(7)}`;
            }
        }

        return number;
    }

    // Statistics
    getStatistics() {
        const today = new Date().toISOString().split('T')[0];
        const thisWeek = new Date();
        thisWeek.setDate(thisWeek.getDate() - 7);

        return {
            totalCalls: this.callHistory.length,
            todayCalls: this.getTodaysCalls().length,
            weekCalls: this.callHistory.filter(c => new Date(c.startedAt) >= thisWeek).length,
            outbound: this.callHistory.filter(c => c.direction === 'outbound').length,
            inbound: this.callHistory.filter(c => c.direction === 'inbound').length,
            avgDuration: this.calculateAvgDuration()
        };
    }

    calculateAvgDuration() {
        const callsWithDuration = this.callHistory.filter(c => c.duration);
        if (callsWithDuration.length === 0) {return 0;}
        const total = callsWithDuration.reduce((sum, c) => sum + c.duration, 0);
        return Math.round(total / callsWithDuration.length);
    }

    // Helpers
    generateId() { return 'call-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9); }

    formatDuration(seconds) {
        if (!seconds) {return '-';}
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    getStatusIcon(status) {
        const icons = {
            initiated: '📞',
            completed: '✅',
            no_answer: '❌',
            voicemail: '📫',
            busy: '🔴'
        };
        return icons[status] || '📞';
    }

    // Persistence
    save() { localStorage.setItem('freyai_phone_history', JSON.stringify(this.callHistory)); }
    saveQuickDials() { localStorage.setItem('freyai_quick_dials', JSON.stringify(this.quickDials)); }
}

window.phoneService = new PhoneService();
