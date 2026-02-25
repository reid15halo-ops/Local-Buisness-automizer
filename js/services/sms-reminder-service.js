/* ============================================
   SMS Reminder Service
   Automated appointment reminders via SMS
   ============================================ */

class SmsReminderService {
    constructor() {
        this.reminders = JSON.parse(localStorage.getItem('freyai_sms_reminders') || '[]');
        this.sentMessages = JSON.parse(localStorage.getItem('freyai_sms_sent') || '[]');
        this.settings = JSON.parse(localStorage.getItem('freyai_sms_settings') || '{}');
        this.noShowTracking = JSON.parse(localStorage.getItem('freyai_noshow_tracking') || '[]');

        // Throttle: minimum 5 minutes between any two SMS to the same number.
        // In-memory only — resets on page reload (intentional: prevents
        // a burst after a page reload but allows legitimate next-day sends).
        // Map<normalizedNumber, lastSentTimestamp>
        this._smsThrottle = new Map();

        // Default settings
        if (!this.settings.enabled) {this.settings.enabled = true;}
        if (!this.settings.reminder24h) {this.settings.reminder24h = true;}
        if (!this.settings.reminder1h) {this.settings.reminder1h = true;}
        if (!this.settings.confirmationRequired) {this.settings.confirmationRequired = true;}
        if (!this.settings.senderName) {this.settings.senderName = 'FreyAI Visions';}

        // Templates
        this.templates = {
            reminder24h: 'Erinnerung: Ihr Termin bei {business} ist morgen um {time} Uhr. Adresse: {address}. Antworten Sie JA zur Bestätigung oder rufen Sie an: {phone}',
            reminder1h: 'Ihr Termin bei {business} beginnt in 1 Stunde um {time} Uhr. Wir freuen uns auf Sie!',
            confirmation: 'Danke für Ihre Bestätigung! Wir sehen uns am {date} um {time} Uhr.',
            cancellation: 'Ihr Termin am {date} um {time} Uhr wurde storniert. Bitte kontaktieren Sie uns für einen neuen Termin.',
            reschedule: 'Möchten Sie Ihren Termin verschieben? Antworten Sie mit dem gewünschten Datum oder rufen Sie an: {phone}'
        };

        // Check for due reminders every minute
        this.startReminderCheck();
    }

    // Schedule a reminder for an appointment
    scheduleReminder(appointment) {
        const appointmentDate = new Date(appointment.date + 'T' + appointment.startTime);

        // Schedule 24h reminder
        if (this.settings.reminder24h) {
            const reminder24h = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
            if (reminder24h > new Date()) {
                this.createReminder(appointment, '24h', reminder24h);
            }
        }

        // Schedule 1h reminder
        if (this.settings.reminder1h) {
            const reminder1h = new Date(appointmentDate.getTime() - 60 * 60 * 1000);
            if (reminder1h > new Date()) {
                this.createReminder(appointment, '1h', reminder1h);
            }
        }

        return { success: true, remindersScheduled: 2 };
    }

    // Create a reminder entry
    createReminder(appointment, type, sendAt) {
        const reminder = {
            id: 'rem-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            appointmentId: appointment.id,
            type: type, // '24h', '1h', 'custom'
            recipient: appointment.kunde?.telefon || appointment.telefon,
            recipientName: appointment.kunde?.name || appointment.name,
            appointmentDate: appointment.date,
            appointmentTime: appointment.startTime,
            sendAt: sendAt.toISOString(),
            status: 'scheduled', // scheduled, sent, failed, cancelled
            message: null,
            createdAt: new Date().toISOString()
        };

        // Don't duplicate
        const exists = this.reminders.find(r =>
            r.appointmentId === appointment.id &&
            r.type === type &&
            r.status === 'scheduled'
        );

        if (!exists) {
            this.reminders.push(reminder);
            this.save();
        }

        return reminder;
    }

    // Check for due reminders — serialised with 500 ms gap to avoid burst limits.
    // The 5-minute per-number throttle in sendSms() provides the second guard.
    async checkDueReminders() {
        const now = new Date();
        const dueReminders = this.reminders.filter(r =>
            r.status === 'scheduled' &&
            new Date(r.sendAt) <= now
        );

        for (const reminder of dueReminders) {
            await this.sendReminder(reminder);
            if (dueReminders.length > 1) {
                // Brief pause between messages to avoid burst limits
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return dueReminders.length;
    }

    // Send a reminder
    async sendReminder(reminder) {
        const template = reminder.type === '24h' ? this.templates.reminder24h : this.templates.reminder1h;

        const message = this.formatMessage(template, {
            business: this.settings.senderName,
            time: reminder.appointmentTime,
            date: new Date(reminder.appointmentDate).toLocaleDateString('de-DE'),
            address: this.settings.businessAddress || 'Siehe Terminbestätigung',
            phone: this.settings.businessPhone || '06029-9922964'
        });

        reminder.message = message;

        // Send via SMS API (demo mode)
        const result = await this.sendSms(reminder.recipient, message);

        if (result.success) {
            reminder.status = 'sent';
            reminder.sentAt = new Date().toISOString();

            this.sentMessages.push({
                id: 'sms-' + Date.now(),
                reminderId: reminder.id,
                to: reminder.recipient,
                message: message,
                status: 'delivered',
                sentAt: reminder.sentAt
            });
        } else {
            reminder.status = 'failed';
            reminder.error = result.error;
        }

        this.save();
        this.saveSentMessages();

        return result;
    }

    /**
     * Send an SMS via the configured gateway (Twilio, sipgate, or MessageBird).
     * Provider and credentials are read from window.APP_CONFIG / localStorage.
     *
     * Supported providers (set SMS_PROVIDER env var):
     *   twilio      — requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
     *   sipgate     — requires SIPGATE_TOKEN_ID, SIPGATE_TOKEN, SIPGATE_SMS_ID
     *   messagebird — requires MESSAGEBIRD_API_KEY, MESSAGEBIRD_ORIGINATOR
     *
     * Falls back to console-only logging when no provider is configured.
     */
    async sendSms(phoneNumber, message) {
        const cleanNumber = phoneNumber.replace(/[\s\-\/\(\)]/g, '');
        const provider    = window.APP_CONFIG?.SMS_PROVIDER
            || localStorage.getItem('freyai_sms_provider')
            || 'none';

        // ── 5-minute per-number throttle ─────────────────────────────────
        const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
        const lastSent = this._smsThrottle.get(cleanNumber);
        if (lastSent && (Date.now() - lastSent) < MIN_INTERVAL_MS) {
            const waitSec = Math.ceil((MIN_INTERVAL_MS - (Date.now() - lastSent)) / 1000);
            console.warn(`[SMS] Throttled (${cleanNumber}) — next allowed in ${waitSec}s`);
            return { success: false, throttled: true, error: `Rate-Limit: Bitte ${waitSec}s warten` };
        }

        let result = { success: false, messageId: null, method: provider };

        try {
            if (provider === 'twilio') {
                result = await this._sendViaTwilio(cleanNumber, message);
            } else if (provider === 'sipgate') {
                result = await this._sendViaSipgate(cleanNumber, message);
            } else if (provider === 'messagebird') {
                result = await this._sendViaMessageBird(cleanNumber, message);
            } else {
                // No provider configured — log only (development / demo mode)
                console.log(`📱 [SMS-Demo] → ${cleanNumber}:\n${message}`);
                result = { success: true, messageId: 'demo-' + Date.now(), method: 'demo' };
            }
        } catch (err) {
            console.error('[SmsReminderService] Send error:', err);
            result = { success: false, error: err.message, method: provider };
        }

        // Record send time for throttle regardless of success/fail
        // (failed sends also count — the gateway already received the request)
        this._smsThrottle.set(cleanNumber, Date.now());

        if (window.communicationService) {
            window.communicationService.logMessage({
                type: 'sms',
                direction: 'outbound',
                from: this.settings.senderName,
                to: cleanNumber,
                content: message,
                status: result.success ? 'sent' : 'failed'
            });
        }

        return result;
    }

    async _sendViaTwilio(to, body) {
        const sid   = window.APP_CONFIG?.TWILIO_ACCOUNT_SID || localStorage.getItem('freyai_twilio_sid');
        const token = window.APP_CONFIG?.TWILIO_AUTH_TOKEN  || localStorage.getItem('freyai_twilio_token');
        const from  = window.APP_CONFIG?.TWILIO_FROM_NUMBER || localStorage.getItem('freyai_twilio_from');
        if (!sid || !token || !from) throw new Error('Twilio credentials nicht konfiguriert');

        const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${sid}:${token}`),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({ To: to, From: from, Body: body })
            }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || `Twilio HTTP ${response.status}`);
        return { success: true, messageId: data.sid, method: 'twilio' };
    }

    async _sendViaSipgate(to, message) {
        const tokenId = window.APP_CONFIG?.SIPGATE_TOKEN_ID || localStorage.getItem('freyai_sipgate_token_id');
        const token   = window.APP_CONFIG?.SIPGATE_TOKEN    || localStorage.getItem('freyai_sipgate_token');
        const smsId   = window.APP_CONFIG?.SIPGATE_SMS_ID   || localStorage.getItem('freyai_sipgate_sms_id');
        if (!tokenId || !token) throw new Error('sipgate credentials nicht konfiguriert');

        const response = await fetch('https://api.sipgate.com/v2/sessions/sms', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(`${tokenId}:${token}`),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ smsId: smsId || 's0', recipient: to, message })
        });
        if (!response.ok) throw new Error(`sipgate HTTP ${response.status}`);
        return { success: true, messageId: 'sipgate-' + Date.now(), method: 'sipgate' };
    }

    async _sendViaMessageBird(to, body) {
        const apiKey     = window.APP_CONFIG?.MESSAGEBIRD_API_KEY   || localStorage.getItem('freyai_messagebird_key');
        const originator = window.APP_CONFIG?.MESSAGEBIRD_ORIGINATOR || localStorage.getItem('freyai_messagebird_from') || 'FreyAI';
        if (!apiKey) throw new Error('MessageBird API-Key nicht konfiguriert');

        const response = await fetch('https://rest.messagebird.com/messages', {
            method: 'POST',
            headers: {
                'Authorization': `AccessKey ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipients: [to], originator, body })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.errors?.[0]?.description || `MessageBird HTTP ${response.status}`);
        return { success: true, messageId: data.id, method: 'messagebird' };
    }

    // Handle incoming SMS reply
    handleIncomingReply(from, message) {
        const lowerMsg = message.toLowerCase().trim();

        // Find recent pending confirmation
        const recentReminder = this.reminders
            .filter(r => r.recipient === from && r.status === 'sent')
            .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0];

        if (!recentReminder) {
            return { handled: false, action: 'no_context' };
        }

        // Check for confirmation
        if (['ja', 'yes', 'ok', 'bestätigt', 'komme'].includes(lowerMsg)) {
            return this.processConfirmation(recentReminder.appointmentId, from);
        }

        // Check for cancellation
        if (['nein', 'absage', 'storno', 'cancel'].includes(lowerMsg)) {
            return this.processCancellation(recentReminder.appointmentId, from);
        }

        // Check for reschedule request
        if (lowerMsg.includes('verschieben') || lowerMsg.includes('ändern')) {
            return this.processRescheduleRequest(recentReminder.appointmentId, from);
        }

        return { handled: false, action: 'unknown_reply' };
    }

    // Process appointment confirmation
    processConfirmation(appointmentId, from) {
        // Update appointment status
        if (window.calendarService) {
            window.calendarService.updateAppointment(appointmentId, {
                confirmed: true,
                confirmedAt: new Date().toISOString(),
                confirmationMethod: 'sms'
            });
        }

        // Send confirmation reply
        const confirmationMsg = this.formatMessage(this.templates.confirmation, {
            date: 'Ihrem Termin',
            time: ''
        });

        this.sendSms(from, confirmationMsg);

        return { handled: true, action: 'confirmed' };
    }

    // Process cancellation
    processCancellation(appointmentId, from) {
        // Update appointment
        if (window.calendarService) {
            window.calendarService.updateAppointment(appointmentId, {
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                cancellationMethod: 'sms'
            });
        }

        // Track potential no-show pattern
        this.trackNoShow(from, 'cancellation');

        // Create follow-up task
        if (window.taskService) {
            window.taskService.addTask({
                title: 'Terminabsage per SMS',
                description: `Kunde hat per SMS abgesagt (${from}). Neuen Termin anbieten.`,
                priority: 'normal',
                source: 'sms',
                dueDate: new Date().toISOString().split('T')[0]
            });
        }

        return { handled: true, action: 'cancelled' };
    }

    // Process reschedule request
    processRescheduleRequest(appointmentId, from) {
        const rescheduleMsg = this.formatMessage(this.templates.reschedule, {
            phone: this.settings.businessPhone || '06029-9922964'
        });

        this.sendSms(from, rescheduleMsg);

        // Create task for manual follow-up
        if (window.taskService) {
            window.taskService.addTask({
                title: 'Terminverschiebung gewünscht',
                description: `Kunde (${from}) möchte Termin verschieben. Rückruf erforderlich.`,
                priority: 'high',
                source: 'sms',
                dueDate: new Date().toISOString().split('T')[0]
            });
        }

        return { handled: true, action: 'reschedule_requested' };
    }

    // Track no-shows and cancellations
    trackNoShow(phoneNumber, type) {
        this.noShowTracking.push({
            id: 'ns-' + Date.now(),
            phoneNumber: phoneNumber,
            type: type, // 'no_show', 'cancellation', 'late_cancellation'
            date: new Date().toISOString()
        });

        // Check pattern
        const customerHistory = this.noShowTracking.filter(n => n.phoneNumber === phoneNumber);
        if (customerHistory.length >= 3) {
            // Flag customer as high-risk
            if (window.customerService) {
                const customer = window.customerService.getCustomerByPhone(phoneNumber);
                if (customer) {
                    window.customerService.updateCustomer(customer.id, {
                        noShowRisk: 'high',
                        noShowCount: customerHistory.length
                    });
                }
            }
        }

        localStorage.setItem('freyai_noshow_tracking', JSON.stringify(this.noShowTracking));
    }

    // Format message with placeholders
    formatMessage(template, data) {
        let message = template;
        for (const [key, value] of Object.entries(data)) {
            message = message.replace(new RegExp(`{${key}}`, 'g'), value);
        }
        return message;
    }

    // Cancel scheduled reminders for an appointment
    cancelReminders(appointmentId) {
        this.reminders = this.reminders.map(r => {
            if (r.appointmentId === appointmentId && r.status === 'scheduled') {
                r.status = 'cancelled';
            }
            return r;
        });
        this.save();
    }

    // Get reminder statistics
    getStatistics() {
        const sent = this.sentMessages.length;
        const scheduled = this.reminders.filter(r => r.status === 'scheduled').length;
        const failed = this.reminders.filter(r => r.status === 'failed').length;

        // Calculate confirmation rate
        const confirmedAppointments = this.reminders.filter(r =>
            r.status === 'sent' &&
            window.calendarService?.getAppointment(r.appointmentId)?.confirmed
        ).length;

        const sentReminders = this.reminders.filter(r => r.status === 'sent').length;
        const confirmationRate = sentReminders > 0
            ? ((confirmedAppointments / sentReminders) * 100).toFixed(1)
            : 0;

        return {
            totalSent: sent,
            scheduled: scheduled,
            failed: failed,
            confirmationRate: parseFloat(confirmationRate),
            noShowCount: this.noShowTracking.filter(n => n.type === 'no_show').length
        };
    }

    // Get pending reminders
    getPendingReminders() {
        return this.reminders
            .filter(r => r.status === 'scheduled')
            .sort((a, b) => new Date(a.sendAt) - new Date(b.sendAt));
    }

    // Get sent messages
    getSentMessages(limit = 50) {
        return this.sentMessages
            .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
            .slice(0, limit);
    }

    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('freyai_sms_settings', JSON.stringify(this.settings));
    }

    // Start periodic reminder check
    startReminderCheck() {
        // Check every minute
        setInterval(() => {
            if (this.settings.enabled) {
                this.checkDueReminders();
            }
        }, 60000);

        // Initial check
        setTimeout(() => this.checkDueReminders(), 5000);
    }

    // Persistence
    save() { localStorage.setItem('freyai_sms_reminders', JSON.stringify(this.reminders)); }
    saveSentMessages() { localStorage.setItem('freyai_sms_sent', JSON.stringify(this.sentMessages)); }
}

window.smsReminderService = new SmsReminderService();
