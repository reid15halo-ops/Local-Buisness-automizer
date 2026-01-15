/* ============================================
   SMS Reminder Service
   Automated appointment reminders via SMS
   ============================================ */

class SmsReminderService {
    constructor() {
        this.reminders = JSON.parse(localStorage.getItem('mhs_sms_reminders') || '[]');
        this.sentMessages = JSON.parse(localStorage.getItem('mhs_sms_sent') || '[]');
        this.settings = JSON.parse(localStorage.getItem('mhs_sms_settings') || '{}');
        this.noShowTracking = JSON.parse(localStorage.getItem('mhs_noshow_tracking') || '[]');

        // Default settings
        if (!this.settings.enabled) this.settings.enabled = true;
        if (!this.settings.reminder24h) this.settings.reminder24h = true;
        if (!this.settings.reminder1h) this.settings.reminder1h = true;
        if (!this.settings.confirmationRequired) this.settings.confirmationRequired = true;
        if (!this.settings.senderName) this.settings.senderName = 'MHS Service';

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

    // Check for due reminders
    checkDueReminders() {
        const now = new Date();
        const dueReminders = this.reminders.filter(r =>
            r.status === 'scheduled' &&
            new Date(r.sendAt) <= now
        );

        dueReminders.forEach(reminder => {
            this.sendReminder(reminder);
        });

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

    // Send SMS via API (demo implementation)
    async sendSms(phoneNumber, message) {
        // Clean phone number
        const cleanNumber = phoneNumber.replace(/[\s\-\/\(\)]/g, '');

        // In production: Call sipgate.io, Twilio, or MessageBird API
        // Demo mode: Log and simulate success
        console.log(`📱 SMS an ${cleanNumber}:\n${message}`);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));

        // Log to communication service
        if (window.communicationService) {
            window.communicationService.logMessage({
                type: 'sms',
                direction: 'outbound',
                from: this.settings.senderName,
                to: cleanNumber,
                content: message,
                status: 'sent'
            });
        }

        return {
            success: true,
            messageId: 'sms-' + Date.now(),
            method: 'demo'
        };
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

        localStorage.setItem('mhs_noshow_tracking', JSON.stringify(this.noShowTracking));
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
        localStorage.setItem('mhs_sms_settings', JSON.stringify(this.settings));
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
    save() { localStorage.setItem('mhs_sms_reminders', JSON.stringify(this.reminders)); }
    saveSentMessages() { localStorage.setItem('mhs_sms_sent', JSON.stringify(this.sentMessages)); }
}

window.smsReminderService = new SmsReminderService();
