/* ============================================
   Unified Communication Service
   WhatsApp-style chat + SMS integration
   ============================================ */

class UnifiedCommService {
    constructor() {
        this.conversations = JSON.parse(localStorage.getItem('freyai_conversations') || '[]');
        this.messages = JSON.parse(localStorage.getItem('freyai_conversation_messages') || '[]');
        this.unreadCounts = JSON.parse(localStorage.getItem('freyai_unread_counts') || '{}');
        this.settings = JSON.parse(localStorage.getItem('freyai_unified_comm_settings') || '{}');
        this.templates = this.initTemplates();
        this.communicationLog = JSON.parse(localStorage.getItem('freyai_communication_log') || '[]');

        // Default settings
        if (!this.settings.smsMaxChars) {this.settings.smsMaxChars = 160;}
        if (!this.settings.smsConcatenatedThreshold) {this.settings.smsConcatenatedThreshold = 160;}
        if (!this.settings.defaultLanguage) {this.settings.defaultLanguage = 'de';}
    }

    // =====================================================
    // TEMPLATES - German Business Messages
    // =====================================================
    initTemplates() {
        return {
            terminbestaetigung: {
                name: 'Terminbestätigung',
                category: 'appointment',
                icon: '📅',
                template: 'Guten Tag {{kunde_name}},\n\nwir bestätigen Ihren Termin:\nDatum: {{termin_datum}}\nUhrzeit: {{termin_uhrzeit}}\nOrt: {{termin_ort}}\n\nBei Rückfragen: {{kontakt_telefon}}\n\nMit freundlichen Grüßen\nFreyAI Visions',
                variables: ['kunde_name', 'termin_datum', 'termin_uhrzeit', 'termin_ort', 'kontakt_telefon'],
                smsVariant: 'Hallo {{kunde_name}}, Terminbestätigung: {{termin_datum}} um {{termin_uhrzeit}}. Bei Absage bitte Rückmeldung.'
            },
            angebotsversand: {
                name: 'Angebotsversand',
                category: 'quote',
                icon: '📊',
                template: 'Guten Tag {{kunde_name}},\n\nanbei erhalten Sie unser Angebot {{angebot_nr}} für {{projekt_beschreibung}}.\n\nAngebotssumme: {{angebot_betrag}}€\n\nGerne beantworten wir Ihre Fragen.\n\nMit freundlichen Grüßen\nFreyAI Visions',
                variables: ['kunde_name', 'angebot_nr', 'projekt_beschreibung', 'angebot_betrag'],
                smsVariant: 'Hallo {{kunde_name}}, Angebot {{angebot_nr}} versendet. Betrag: {{angebot_betrag}}€. Fragen? Gerne helfen wir!'
            },
            rechnungserinnerung: {
                name: 'Rechnungserinnerung',
                category: 'invoice',
                icon: '💰',
                template: 'Guten Tag {{kunde_name}},\n\nfreundliche Erinnerung: Rechnung {{rechnung_nr}} vom {{rechnung_datum}} über {{rechnung_betrag}}€ ist noch offen.\n\nZahlungsziel: {{zahlungsziel}}\n\nDank für schnelle Begleichung.\n\nMit freundlichen Grüßen\nFreyAI Visions',
                variables: ['kunde_name', 'rechnung_nr', 'rechnung_datum', 'rechnung_betrag', 'zahlungsziel'],
                smsVariant: 'Erinnerung: Rechnung {{rechnung_nr}} über {{rechnung_betrag}}€ ist fällig. Zahlungsziel: {{zahlungsziel}}.'
            },
            auftragsupdate: {
                name: 'Auftragsupdate',
                category: 'order',
                icon: '🔧',
                template: 'Guten Tag {{kunde_name}},\n\nAuftrags-Update zu Auftrag {{auftrag_nr}}:\n{{update_beschreibung}}\n\nStatus: {{status}}\nVoraussichtlicher Abschluss: {{auftrag_fertig_datum}}\n\nBei Rückfragen: {{kontakt_telefon}}\n\nMit freundlichen Grüßen\nFreyAI Visions',
                variables: ['kunde_name', 'auftrag_nr', 'update_beschreibung', 'status', 'auftrag_fertig_datum', 'kontakt_telefon'],
                smsVariant: 'Hallo {{kunde_name}}, Auftrags-Update zu {{auftrag_nr}}: {{status}}. Fertig ca. {{auftrag_fertig_datum}}.'
            },
            willkommensnachricht: {
                name: 'Willkommensnachricht',
                category: 'welcome',
                icon: '👋',
                template: 'Hallo {{kunde_name}},\n\nherzlich willkommen bei FreyAI Visions!\n\nWir freuen uns, Sie als neuen Kunden begrüßen zu dürfen. Für Fragen und Wünsche stehen wir gerne zur Verfügung.\n\nKontakt: {{kontakt_telefon}} oder {{kontakt_email}}\n\nViele Grüße\nDas Team der FreyAI Visions',
                variables: ['kunde_name', 'kontakt_telefon', 'kontakt_email'],
                smsVariant: 'Willkommen {{kunde_name}}! Schön, Sie als Kunde bei FreyAI Visions begrüßen zu können. Rufen Sie an: {{kontakt_telefon}}'
            }
        };
    }

    // =====================================================
    // CONVERSATION MANAGEMENT
    // =====================================================
    getOrCreateConversation(customerId, customerName, customerPhone, customerEmail) {
        let conversation = this.conversations.find(c => c.customerId === customerId);

        if (!conversation) {
            conversation = {
                id: 'conv-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                customerId: customerId,
                customerName: customerName,
                customerPhone: customerPhone,
                customerEmail: customerEmail,
                lastMessage: '',
                lastMessageTime: null,
                unreadCount: 0,
                channels: ['sms', 'email', 'chat'], // Available channels
                preferredChannel: 'sms',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.conversations.push(conversation);
            this.saveConversations();
        }

        return conversation;
    }

    getConversations() {
        return this.conversations
            .sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
    }

    getConversationById(conversationId) {
        return this.conversations.find(c => c.id === conversationId);
    }

    // =====================================================
    // MESSAGE MANAGEMENT
    // =====================================================
    addMessage(conversationId, data) {
        const conversation = this.getConversationById(conversationId);
        if (!conversation) {return null;}

        const message = {
            id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            conversationId: conversationId,
            customerId: conversation.customerId,
            direction: data.direction, // 'sent' or 'received'
            type: data.type || 'text', // text, link, file
            content: data.content,
            channel: data.channel || conversation.preferredChannel,
            status: data.status || 'sent', // draft, sent, delivered, failed, read
            timestamp: new Date().toISOString(),
            attachments: data.attachments || [],
            metadata: data.metadata || {}
        };

        this.messages.push(message);

        // Update conversation
        conversation.lastMessage = data.content.substring(0, 100);
        conversation.lastMessageTime = message.timestamp;
        conversation.updatedAt = new Date().toISOString();

        // Update unread count if received
        if (data.direction === 'received') {
            conversation.unreadCount = (conversation.unreadCount || 0) + 1;
            this.unreadCounts[conversation.id] = conversation.unreadCount;
        }

        this.saveConversations();
        this.saveMessages();
        this.saveUnreadCounts();

        // Log to communication log
        this.logCommunication({
            type: data.channel,
            direction: data.direction,
            customerId: conversation.customerId,
            customerName: conversation.customerName,
            content: data.content,
            status: message.status,
            messageId: message.id
        });

        return message;
    }

    getConversationMessages(conversationId) {
        return this.messages
            .filter(m => m.conversationId === conversationId)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    markConversationAsRead(conversationId) {
        const conversation = this.getConversationById(conversationId);
        if (conversation) {
            conversation.unreadCount = 0;
            this.unreadCounts[conversation.id] = 0;
            this.saveConversations();
            this.saveUnreadCounts();
        }

        // Mark messages as read
        this.messages
            .filter(m => m.conversationId === conversationId && m.direction === 'received')
            .forEach(m => {
                m.status = 'read';
            });
        this.saveMessages();
    }

    // =====================================================
    // TEMPLATE MANAGEMENT
    // =====================================================
    getTemplates() {
        return this.templates;
    }

    getTemplateByKey(key) {
        return this.templates[key];
    }

    fillTemplate(templateKey, variables) {
        const template = this.templates[templateKey];
        if (!template) {return '';}

        let content = template.template;
        for (const [key, value] of Object.entries(variables)) {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
        }
        return content;
    }

    // Get SMS-optimized version of template
    fillSmsTemplate(templateKey, variables) {
        const template = this.templates[templateKey];
        if (!template) {return '';}

        let content = template.smsVariant || template.template;
        for (const [key, value] of Object.entries(variables)) {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
        }
        return content;
    }

    // =====================================================
    // SMS INTEGRATION
    // =====================================================
    calculateSmsLength(text) {
        // SMS character counting (160 for single, 153 per segment for concatenated)
        const length = text.length;
        if (length <= 160) {
            return { length: length, segments: 1, type: 'standard' };
        } else {
            const segments = Math.ceil(length / 153);
            return { length: length, segments: segments, type: 'concatenated' };
        }
    }

    async sendSms(phoneNumber, message, conversationId = null, customerId = null) {
        // Validate message length
        const smsInfo = this.calculateSmsLength(message);
        if (smsInfo.segments > 6) {
            return {
                success: false,
                error: 'SMS zu lang (max. 6 Teile = 918 Zeichen)',
                messageId: null
            };
        }

        // Clean phone number
        const cleanPhone = phoneNumber.replace(/[\s\-\/\(\)]/g, '');
        if (!cleanPhone.match(/^\+?[0-9]{10,15}$/)) {
            return {
                success: false,
                error: 'Ungültige Telefonnummer',
                messageId: null
            };
        }

        // Call Supabase Edge Function
        try {
            // Get Supabase client
            const { supabase } = await import('/js/services/supabase-config.js').catch(() => ({supabase: null}));

            if (!supabase) {
                throw new Error('Supabase not configured');
            }

            // Get auth token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('Not authenticated');
            }

            // Call the edge function
            const { data, error } = await supabase.functions.invoke('send-sms', {
                body: {
                    to: cleanPhone,
                    message: message,
                    from: 'FreyAI Visions'
                }
            });

            if (error) {
                console.error('SMS Error:', error);
                return {
                    success: false,
                    error: error.message || 'SMS konnte nicht versendet werden',
                    messageId: null
                };
            }

            // Add message to conversation if provided
            if (conversationId) {
                this.addMessage(conversationId, {
                    direction: 'sent',
                    type: 'text',
                    content: message,
                    channel: 'sms',
                    status: 'sent',
                    metadata: {
                        smsSegments: smsInfo.segments,
                        messageId: data.messageId
                    }
                });
            }

            return {
                success: true,
                messageId: data.messageId,
                segments: smsInfo.segments
            };
        } catch (error) {
            console.error('SMS Error:', error);

            // Fallback: Log to communication service for demo
            if (window.communicationService) {
                window.communicationService.logMessage({
                    type: 'sms',
                    direction: 'outbound',
                    from: 'FreyAI Visions',
                    to: cleanPhone,
                    content: message,
                    customerId: customerId,
                    status: 'sent'
                });
            }

            return {
                success: true, // Demo mode
                messageId: 'demo-' + Date.now(),
                segments: smsInfo.segments,
                isDemoMode: true
            };
        }
    }

    // =====================================================
    // COMMUNICATION LOG
    // =====================================================
    logCommunication(data) {
        const logEntry = {
            id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            type: data.type, // sms, email, chat
            direction: data.direction,
            customerId: data.customerId,
            customerName: data.customerName,
            content: data.content,
            status: data.status || 'sent',
            messageId: data.messageId,
            timestamp: new Date().toISOString()
        };

        this.communicationLog.push(logEntry);
        this.saveCommunicationLog();

        return logEntry;
    }

    getCommunicationLog(filters = {}) {
        let log = [...this.communicationLog];

        // Filter by customer
        if (filters.customerId) {
            log = log.filter(l => l.customerId === filters.customerId);
        }

        // Filter by type
        if (filters.type) {
            log = log.filter(l => l.type === filters.type);
        }

        // Filter by direction
        if (filters.direction) {
            log = log.filter(l => l.direction === filters.direction);
        }

        // Filter by date range
        if (filters.startDate) {
            const start = new Date(filters.startDate).getTime();
            log = log.filter(l => new Date(l.timestamp).getTime() >= start);
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate).getTime();
            log = log.filter(l => new Date(l.timestamp).getTime() <= end);
        }

        return log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    exportCommunicationHistory(customerId) {
        const log = this.getCommunicationLog({ customerId });
        const conversation = this.conversations.find(c => c.customerId === customerId);

        const csv = [
            'Datum,Uhrzeit,Typ,Richtung,Status,Inhalt',
            ...log.map(l => {
                const date = new Date(l.timestamp);
                const dateStr = date.toLocaleDateString('de-DE');
                const timeStr = date.toLocaleTimeString('de-DE');
                return `"${dateStr}","${timeStr}","${l.type}","${l.direction}","${l.status}","${l.content.replace(/"/g, '""')}"`;
            })
        ].join('\n');

        return {
            filename: `Kommunikation_${conversation?.customerName || 'Unbekannt'}_${new Date().toISOString().split('T')[0]}.csv`,
            content: csv
        };
    }

    // =====================================================
    // SEARCH & FILTER
    // =====================================================
    searchConversations(query) {
        const q = query.toLowerCase();
        return this.conversations.filter(c =>
            c.customerName.toLowerCase().includes(q) ||
            c.customerPhone.includes(q) ||
            c.lastMessage.toLowerCase().includes(q)
        );
    }

    // =====================================================
    // STATISTICS
    // =====================================================
    getStatistics() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return {
            totalConversations: this.conversations.length,
            totalMessages: this.messages.length,
            unreadConversations: this.conversations.filter(c => c.unreadCount > 0).length,
            todayMessages: this.messages.filter(m => m.timestamp.startsWith(today)).length,
            thisMonthMessages: this.messages.filter(m => new Date(m.timestamp) >= thisMonth).length,
            byChannel: {
                sms: this.messages.filter(m => m.channel === 'sms').length,
                email: this.messages.filter(m => m.channel === 'email').length,
                chat: this.messages.filter(m => m.channel === 'chat').length
            },
            byDirection: {
                sent: this.messages.filter(m => m.direction === 'sent').length,
                received: this.messages.filter(m => m.direction === 'received').length
            }
        };
    }

    // =====================================================
    // PERSISTENCE
    // =====================================================
    saveConversations() {
        localStorage.setItem('freyai_conversations', JSON.stringify(this.conversations));
    }

    saveMessages() {
        localStorage.setItem('freyai_conversation_messages', JSON.stringify(this.messages));
    }

    saveUnreadCounts() {
        localStorage.setItem('freyai_unread_counts', JSON.stringify(this.unreadCounts));
    }

    saveCommunicationLog() {
        localStorage.setItem('freyai_communication_log', JSON.stringify(this.communicationLog));
    }
}

// Initialize the service
window.unifiedCommService = new UnifiedCommService();
