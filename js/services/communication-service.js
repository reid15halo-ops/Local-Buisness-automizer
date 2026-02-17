/* ============================================
   Communication Service - Unified Messaging
   Zentraler Kommunikations-Hub
   ============================================ */

class CommunicationService {
    constructor() {
        this.messages = JSON.parse(localStorage.getItem('freyai_messages') || '[]');
        this.callLogs = JSON.parse(localStorage.getItem('freyai_call_logs') || '[]');
        this.settings = JSON.parse(localStorage.getItem('freyai_comm_settings') || '{}');
    }

    // Unified Message Log
    logMessage(message) {
        const entry = {
            id: this.generateId(),
            type: message.type, // email, sms, whatsapp, call
            direction: message.direction, // inbound, outbound
            from: message.from,
            to: message.to,
            subject: message.subject || '',
            content: message.content,
            customerId: message.customerId || null,
            customerName: message.customerName || '',
            status: message.status || 'sent', // draft, sent, delivered, failed
            readAt: null,
            createdAt: new Date().toISOString()
        };

        this.messages.push(entry);
        this.save();

        // Add to customer interaction if customer service available
        if (window.customerService && message.customerId) {
            window.customerService.addInteraction(message.customerId, {
                type: message.type,
                subject: message.subject,
                content: message.content,
                direction: message.direction
            });
        }

        return entry;
    }

    // Call Logging
    logCall(call) {
        const entry = {
            id: this.generateId(),
            direction: call.direction, // inbound, outbound
            phoneNumber: call.phoneNumber,
            customerId: call.customerId || null,
            customerName: call.customerName || '',
            duration: call.duration || 0, // seconds
            notes: call.notes || '',
            outcome: call.outcome || 'connected', // connected, voicemail, no_answer, busy
            createdAt: new Date().toISOString()
        };

        this.callLogs.push(entry);
        this.saveCallLogs();

        // Also add to messages for unified view
        this.logMessage({
            type: 'call',
            direction: entry.direction,
            from: entry.direction === 'inbound' ? entry.phoneNumber : 'FreyAI Visions',
            to: entry.direction === 'outbound' ? entry.phoneNumber : 'FreyAI Visions',
            content: entry.notes || `Anruf ${entry.outcome === 'connected' ? 'verbunden' : entry.outcome}`,
            customerId: entry.customerId,
            customerName: entry.customerName
        });

        return entry;
    }

    // SMS (Demo Mode - would need Twilio/API)
    async sendSMS(to, message, customerId = null) {
        console.log('SMS senden (Demo):', to, message);

        // In production, this would call Twilio or similar API
        const smsEntry = this.logMessage({
            type: 'sms',
            direction: 'outbound',
            from: 'FreyAI Visions',
            to: to,
            content: message,
            customerId: customerId,
            status: 'sent'
        });

        return { success: true, messageId: smsEntry.id };
    }

    // WhatsApp (Demo Mode - would need WhatsApp Business API)
    async sendWhatsApp(to, message, customerId = null) {
        console.log('WhatsApp senden (Demo):', to, message);

        // Open WhatsApp Web as fallback
        const waUrl = `https://wa.me/${to.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

        const waEntry = this.logMessage({
            type: 'whatsapp',
            direction: 'outbound',
            from: 'FreyAI Visions',
            to: to,
            content: message,
            customerId: customerId,
            status: 'sent'
        });

        return { success: true, messageId: waEntry.id, whatsappUrl: waUrl };
    }

    // Query Messages
    getAllMessages() { return this.messages; }

    getMessagesByCustomer(customerId) {
        return this.messages.filter(m => m.customerId === customerId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    getMessagesByType(type) {
        return this.messages.filter(m => m.type === type);
    }

    getRecentMessages(limit = 50) {
        return [...this.messages]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit);
    }

    getUnreadMessages() {
        return this.messages.filter(m => m.direction === 'inbound' && !m.readAt);
    }

    markAsRead(messageId) {
        const msg = this.messages.find(m => m.id === messageId);
        if (msg) {
            msg.readAt = new Date().toISOString();
            this.save();
        }
    }

    // Call Logs
    getCallLogs() { return this.callLogs; }

    getCallsForCustomer(customerId) {
        return this.callLogs.filter(c => c.customerId === customerId);
    }

    getRecentCalls(limit = 20) {
        return [...this.callLogs]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit);
    }

    // Communication Templates
    getTemplates() {
        return {
            termin_bestaetigung: {
                name: 'Terminbestätigung (SMS)',
                content: 'Ihr Termin bei FreyAI Visions: {{datum}} um {{uhrzeit}} Uhr. Bei Fragen: 06029-9922964'
            },
            termin_erinnerung: {
                name: 'Terminerinnerung (SMS)',
                content: 'Erinnerung: Morgen {{datum}} um {{uhrzeit}} Uhr Termin bei FreyAI Visions. Wir freuen uns auf Sie!'
            },
            rechnung_erinnerung: {
                name: 'Zahlungserinnerung (SMS)',
                content: 'Freundliche Erinnerung: Rechnung {{rechnungId}} über {{betrag}}€ ist noch offen. FreyAI Visions'
            },
            angebot_followup: {
                name: 'Angebots-Nachfrage',
                content: 'Guten Tag! Haben Sie Fragen zu unserem Angebot {{angebotId}}? Gerne stehen wir zur Verfügung. FreyAI Visions'
            }
        };
    }

    fillTemplate(templateKey, data) {
        const templates = this.getTemplates();
        let content = templates[templateKey]?.content || '';

        for (const [key, value] of Object.entries(data)) {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }

        return content;
    }

    // Statistics
    getStatistics() {
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const today = now.toISOString().split('T')[0];

        return {
            totalMessages: this.messages.length,
            totalCalls: this.callLogs.length,
            unreadMessages: this.getUnreadMessages().length,
            todayMessages: this.messages.filter(m => m.createdAt.startsWith(today)).length,
            todayCalls: this.callLogs.filter(c => c.createdAt.startsWith(today)).length,
            thisMonthMessages: this.messages.filter(m => new Date(m.createdAt) >= thisMonth).length,
            byType: {
                email: this.messages.filter(m => m.type === 'email').length,
                sms: this.messages.filter(m => m.type === 'sms').length,
                whatsapp: this.messages.filter(m => m.type === 'whatsapp').length,
                call: this.messages.filter(m => m.type === 'call').length
            }
        };
    }

    // Helpers
    generateId() { return 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9); }

    getTypeIcon(type) {
        const icons = { email: '📧', sms: '💬', whatsapp: '📱', call: '📞' };
        return icons[type] || '📝';
    }

    getTypeLabel(type) {
        const labels = { email: 'E-Mail', sms: 'SMS', whatsapp: 'WhatsApp', call: 'Anruf' };
        return labels[type] || type;
    }

    getDirectionIcon(direction) {
        return direction === 'inbound' ? '📥' : '📤';
    }

    formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    // Persistence
    save() { localStorage.setItem('freyai_messages', JSON.stringify(this.messages)); }
    saveCallLogs() { localStorage.setItem('freyai_call_logs', JSON.stringify(this.callLogs)); }
}

window.communicationService = new CommunicationService();
