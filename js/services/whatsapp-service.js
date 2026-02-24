/* ============================================
   WhatsApp Business API Integration Service
   WhatsApp Cloud API Anbindung fuer Handwerksbetriebe
   ============================================ */

class WhatsAppService {
    constructor() {
        this.STORAGE_KEY = 'freyai_whatsapp_data';
        this.CONFIG_KEY = 'freyai_whatsapp_config';
        this.CONVERSATIONS_KEY = 'freyai_whatsapp_conversations';
        this.MESSAGES_KEY = 'freyai_whatsapp_messages';
        this.SETTINGS_KEY = 'freyai_whatsapp_settings';

        this.config = this._loadConfig();
        this.conversations = JSON.parse(localStorage.getItem(this.CONVERSATIONS_KEY) || '{}');
        this.messageLog = JSON.parse(localStorage.getItem(this.MESSAGES_KEY) || '[]');
        this.settings = JSON.parse(localStorage.getItem(this.SETTINGS_KEY) || '{}');

        // Rate limiting
        this._rateLimitQueue = [];
        this._rateLimitInterval = null;
        this._maxRequestsPerSecond = 10;

        // Initialize default settings
        if (!this.settings.autoSend) {
            this.settings.autoSend = {
                terminErinnerung: false,
                angebotFertig: false,
                rechnungGesendet: false,
                zahlungErhalten: false
            };
            this._saveSettings();
        }

        // Pre-defined German message templates
        this.TEMPLATES = {
            termin_erinnerung: {
                name: 'Terminerinnerung',
                category: 'termin',
                icon: '📅',
                text: 'Guten Tag {{kundenName}}, wir moechten Sie an Ihren Termin am {{datum}} um {{uhrzeit}} erinnern. Bei Fragen erreichen Sie uns unter {{telefon}}. Viele Gruesse, {{firmenName}}',
                variables: ['kundenName', 'datum', 'uhrzeit', 'telefon', 'firmenName']
            },
            angebot_fertig: {
                name: 'Angebot bereit',
                category: 'angebot',
                icon: '📊',
                text: 'Guten Tag {{kundenName}}, Ihr Angebot Nr. {{angebotNr}} ueber {{betrag}} ist fertig. Sie koennen es hier einsehen: {{link}}. Viele Gruesse, {{firmenName}}',
                variables: ['kundenName', 'angebotNr', 'betrag', 'link', 'firmenName']
            },
            rechnung_gesendet: {
                name: 'Rechnung gesendet',
                category: 'rechnung',
                icon: '💰',
                text: 'Guten Tag {{kundenName}}, Ihre Rechnung Nr. {{rechnungNr}} ueber {{betrag}} wurde erstellt. Zahlungsziel: {{zahlungsziel}}. Viele Gruesse, {{firmenName}}',
                variables: ['kundenName', 'rechnungNr', 'betrag', 'zahlungsziel', 'firmenName']
            },
            zahlung_erhalten: {
                name: 'Zahlung erhalten',
                category: 'zahlung',
                icon: '✅',
                text: 'Guten Tag {{kundenName}}, vielen Dank! Ihre Zahlung ueber {{betrag}} fuer Rechnung Nr. {{rechnungNr}} ist eingegangen. Viele Gruesse, {{firmenName}}',
                variables: ['kundenName', 'betrag', 'rechnungNr', 'firmenName']
            },
            auftrag_status: {
                name: 'Auftragsstatus',
                category: 'auftrag',
                icon: '🔧',
                text: 'Guten Tag {{kundenName}}, Ihr Auftrag "{{auftragTitel}}" ist jetzt: {{status}}. {{nachricht}} Viele Gruesse, {{firmenName}}',
                variables: ['kundenName', 'auftragTitel', 'status', 'nachricht', 'firmenName']
            }
        };
    }

    // =====================================================
    // CONFIGURATION
    // =====================================================

    _loadConfig() {
        const stored = JSON.parse(localStorage.getItem('freyai_whatsapp_config') || 'null');
        return stored || {
            apiUrl: 'https://graph.facebook.com/v18.0',
            accessToken: '',
            phoneNumberId: '',
            webhookVerifyToken: '',
            businessName: '',
            isConfigured: false
        };
    }

    /**
     * Save API credentials and configuration
     * @param {Object} newConfig - Configuration object with API credentials
     */
    configure(newConfig) {
        try {
            this.config = {
                ...this.config,
                apiUrl: newConfig.apiUrl || this.config.apiUrl,
                accessToken: newConfig.accessToken || '',
                phoneNumberId: newConfig.phoneNumberId || '',
                webhookVerifyToken: newConfig.webhookVerifyToken || '',
                businessName: newConfig.businessName || '',
                isConfigured: !!(newConfig.accessToken && newConfig.phoneNumberId)
            };
            this._saveConfig();
            return { success: true };
        } catch (error) {
            console.error('WhatsApp Konfigurationsfehler:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if WhatsApp is properly configured
     * @returns {boolean}
     */
    isConfigured() {
        return this.config.isConfigured && !!this.config.accessToken && !!this.config.phoneNumberId;
    }

    /**
     * Verify API connectivity by checking the phone number status
     * @returns {Object} { success, message, data }
     */
    async testConnection() {
        if (!this.config.accessToken || !this.config.phoneNumberId) {
            return {
                success: false,
                message: 'API-Zugangsdaten fehlen. Bitte konfigurieren Sie zuerst Access Token und Phone Number ID.'
            };
        }

        try {
            const url = `${this.config.apiUrl}/${this.config.phoneNumberId}`;
            const response = await this._apiRequest(url, 'GET');

            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    message: 'Verbindung erfolgreich! WhatsApp Business API ist bereit.',
                    data: {
                        phoneNumber: data.display_phone_number || '',
                        qualityRating: data.quality_rating || '',
                        verifiedName: data.verified_name || ''
                    }
                };
            } else {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData?.error?.message || `HTTP-Fehler ${response.status}`;
                return {
                    success: false,
                    message: `Verbindung fehlgeschlagen: ${errorMsg}`
                };
            }
        } catch (error) {
            console.error('WhatsApp Verbindungstest fehlgeschlagen:', error);
            return {
                success: false,
                message: `Verbindungsfehler: ${error.message}`
            };
        }
    }

    // =====================================================
    // SENDING MESSAGES
    // =====================================================

    /**
     * Send a text message via WhatsApp Cloud API
     * @param {string} phoneNumber - Recipient phone number
     * @param {string} message - Text message content
     * @param {string} [customerId] - Optional customer ID for logging
     * @returns {Object} { success, messageId }
     */
    async sendTextMessage(phoneNumber, message, customerId = null) {
        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            if (!formattedPhone) {
                return { success: false, error: 'Ungueltige Telefonnummer' };
            }

            if (!this.isConfigured()) {
                // Fallback: log locally and open wa.me link
                return this._fallbackSend(formattedPhone, message, customerId);
            }

            const url = `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`;
            const body = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: formattedPhone,
                type: 'text',
                text: {
                    preview_url: true,
                    body: message
                }
            };

            const response = await this._apiRequest(url, 'POST', body);
            const data = await response.json();

            if (response.ok && data.messages && data.messages.length > 0) {
                const messageId = data.messages[0].id;

                // Log message
                this._logMessage({
                    id: messageId,
                    phoneNumber: formattedPhone,
                    direction: 'outbound',
                    type: 'text',
                    content: message,
                    status: 'sent',
                    customerId: customerId,
                    timestamp: new Date().toISOString()
                });

                // Update conversation
                this._updateConversation(formattedPhone, {
                    lastMessage: message,
                    lastMessageTime: new Date().toISOString(),
                    direction: 'outbound'
                }, customerId);

                // Also log to communication service for unified view
                this._logToCommunicationService('outbound', formattedPhone, message, customerId);

                return { success: true, messageId: messageId };
            } else {
                const errorMsg = data?.error?.message || 'Unbekannter API-Fehler';
                console.error('WhatsApp API Fehler:', errorMsg);
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            console.error('WhatsApp sendTextMessage Fehler:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send a pre-approved template message
     * @param {string} phoneNumber - Recipient phone number
     * @param {string} templateName - WhatsApp-approved template name
     * @param {Array} parameters - Template parameter values
     * @param {string} [languageCode] - Language code, defaults to 'de'
     * @param {string} [customerId] - Optional customer ID
     * @returns {Object} { success, messageId }
     */
    async sendTemplateMessage(phoneNumber, templateName, parameters = [], languageCode = 'de', customerId = null) {
        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            if (!formattedPhone) {
                return { success: false, error: 'Ungueltige Telefonnummer' };
            }

            if (!this.isConfigured()) {
                // Render the local template text and fallback
                const localTemplate = this.TEMPLATES[templateName];
                if (localTemplate) {
                    const vars = {};
                    localTemplate.variables.forEach((v, i) => {
                        vars[v] = parameters[i] || '';
                    });
                    const rendered = this.renderTemplate(templateName, vars);
                    return this._fallbackSend(formattedPhone, rendered, customerId);
                }
                return { success: false, error: 'Vorlage nicht gefunden und API nicht konfiguriert' };
            }

            const url = `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`;
            const components = [];

            if (parameters.length > 0) {
                components.push({
                    type: 'body',
                    parameters: parameters.map(p => ({
                        type: 'text',
                        text: String(p)
                    }))
                });
            }

            const body = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: formattedPhone,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: languageCode
                    },
                    components: components
                }
            };

            const response = await this._apiRequest(url, 'POST', body);
            const data = await response.json();

            if (response.ok && data.messages && data.messages.length > 0) {
                const messageId = data.messages[0].id;

                this._logMessage({
                    id: messageId,
                    phoneNumber: formattedPhone,
                    direction: 'outbound',
                    type: 'template',
                    content: `[Vorlage: ${templateName}] ${parameters.join(', ')}`,
                    templateName: templateName,
                    templateParams: parameters,
                    status: 'sent',
                    customerId: customerId,
                    timestamp: new Date().toISOString()
                });

                this._updateConversation(formattedPhone, {
                    lastMessage: `[Vorlage: ${templateName}]`,
                    lastMessageTime: new Date().toISOString(),
                    direction: 'outbound'
                }, customerId);

                this._logToCommunicationService('outbound', formattedPhone, `[Vorlage: ${templateName}]`, customerId);

                return { success: true, messageId: messageId };
            } else {
                const errorMsg = data?.error?.message || 'Vorlagen-Versand fehlgeschlagen';
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            console.error('WhatsApp sendTemplateMessage Fehler:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send a document (PDF) via WhatsApp
     * @param {string} phoneNumber - Recipient phone number
     * @param {string} documentUrl - Public URL of the document
     * @param {string} [caption] - Optional caption for the document
     * @param {string} [filename] - Optional filename
     * @param {string} [customerId] - Optional customer ID
     * @returns {Object} { success, messageId }
     */
    async sendDocument(phoneNumber, documentUrl, caption = '', filename = '', customerId = null) {
        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            if (!formattedPhone) {
                return { success: false, error: 'Ungueltige Telefonnummer' };
            }

            if (!this.isConfigured()) {
                return this._fallbackSend(formattedPhone, `[Dokument: ${filename || documentUrl}] ${caption}`, customerId);
            }

            const url = `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`;
            const body = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: formattedPhone,
                type: 'document',
                document: {
                    link: documentUrl,
                    caption: caption,
                    filename: filename || 'Dokument.pdf'
                }
            };

            const response = await this._apiRequest(url, 'POST', body);
            const data = await response.json();

            if (response.ok && data.messages && data.messages.length > 0) {
                const messageId = data.messages[0].id;

                this._logMessage({
                    id: messageId,
                    phoneNumber: formattedPhone,
                    direction: 'outbound',
                    type: 'document',
                    content: caption || filename || 'Dokument',
                    documentUrl: documentUrl,
                    filename: filename,
                    status: 'sent',
                    customerId: customerId,
                    timestamp: new Date().toISOString()
                });

                this._updateConversation(formattedPhone, {
                    lastMessage: `📄 ${filename || 'Dokument'}`,
                    lastMessageTime: new Date().toISOString(),
                    direction: 'outbound'
                }, customerId);

                this._logToCommunicationService('outbound', formattedPhone, `[Dokument: ${filename}] ${caption}`, customerId);

                return { success: true, messageId: messageId };
            } else {
                const errorMsg = data?.error?.message || 'Dokument-Versand fehlgeschlagen';
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            console.error('WhatsApp sendDocument Fehler:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send an image via WhatsApp
     * @param {string} phoneNumber - Recipient phone number
     * @param {string} imageUrl - Public URL of the image
     * @param {string} [caption] - Optional caption for the image
     * @param {string} [customerId] - Optional customer ID
     * @returns {Object} { success, messageId }
     */
    async sendImage(phoneNumber, imageUrl, caption = '', customerId = null) {
        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            if (!formattedPhone) {
                return { success: false, error: 'Ungueltige Telefonnummer' };
            }

            if (!this.isConfigured()) {
                return this._fallbackSend(formattedPhone, `[Bild] ${caption}`, customerId);
            }

            const url = `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`;
            const body = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: formattedPhone,
                type: 'image',
                image: {
                    link: imageUrl,
                    caption: caption
                }
            };

            const response = await this._apiRequest(url, 'POST', body);
            const data = await response.json();

            if (response.ok && data.messages && data.messages.length > 0) {
                const messageId = data.messages[0].id;

                this._logMessage({
                    id: messageId,
                    phoneNumber: formattedPhone,
                    direction: 'outbound',
                    type: 'image',
                    content: caption || 'Bild',
                    imageUrl: imageUrl,
                    status: 'sent',
                    customerId: customerId,
                    timestamp: new Date().toISOString()
                });

                this._updateConversation(formattedPhone, {
                    lastMessage: `📷 ${caption || 'Bild'}`,
                    lastMessageTime: new Date().toISOString(),
                    direction: 'outbound'
                }, customerId);

                this._logToCommunicationService('outbound', formattedPhone, `[Bild] ${caption}`, customerId);

                return { success: true, messageId: messageId };
            } else {
                const errorMsg = data?.error?.message || 'Bild-Versand fehlgeschlagen';
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            console.error('WhatsApp sendImage Fehler:', error);
            return { success: false, error: error.message };
        }
    }

    // =====================================================
    // TEMPLATE RENDERING
    // =====================================================

    /**
     * Render a local template by filling in variables
     * @param {string} templateId - Template key from TEMPLATES
     * @param {Object} variables - Key/value pairs for template variables
     * @returns {string} Rendered template text
     */
    renderTemplate(templateId, variables) {
        const template = this.TEMPLATES[templateId];
        if (!template) {
            console.warn('Vorlage nicht gefunden:', templateId);
            return '';
        }

        let text = template.text;

        // Auto-fill business name if not provided
        if (!variables.firmenName) {
            variables.firmenName = this._getBusinessName();
        }

        // Auto-fill phone if not provided
        if (!variables.telefon) {
            variables.telefon = this._getBusinessPhone();
        }

        for (const [key, value] of Object.entries(variables)) {
            text = text.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
        }

        return text;
    }

    /**
     * Get list of available templates
     * @returns {Object} All templates with metadata
     */
    getTemplates() {
        return this.TEMPLATES;
    }

    /**
     * Get a specific template by ID
     * @param {string} templateId - Template key
     * @returns {Object|null} Template object or null
     */
    getTemplate(templateId) {
        return this.TEMPLATES[templateId] || null;
    }

    // =====================================================
    // INCOMING MESSAGES (WEBHOOK)
    // =====================================================

    /**
     * Process an incoming webhook payload from WhatsApp Cloud API
     * @param {Object} webhookPayload - The raw webhook JSON
     * @returns {Object} { processed, messages }
     */
    processIncomingMessage(webhookPayload) {
        try {
            const processedMessages = [];

            if (!webhookPayload || !webhookPayload.entry) {
                return { processed: false, messages: [] };
            }

            for (const entry of webhookPayload.entry) {
                if (!entry.changes) { continue; }

                for (const change of entry.changes) {
                    if (change.field !== 'messages') { continue; }

                    const value = change.value;
                    if (!value || !value.messages) { continue; }

                    // Get contact info
                    const contacts = value.contacts || [];

                    for (const msg of value.messages) {
                        const contactInfo = contacts.find(c => c.wa_id === msg.from) || {};
                        const senderName = contactInfo.profile?.name || msg.from;
                        const senderPhone = msg.from;

                        let content = '';
                        let msgType = 'text';

                        switch (msg.type) {
                            case 'text':
                                content = msg.text?.body || '';
                                msgType = 'text';
                                break;
                            case 'image':
                                content = msg.image?.caption || '[Bild]';
                                msgType = 'image';
                                break;
                            case 'document':
                                content = msg.document?.caption || msg.document?.filename || '[Dokument]';
                                msgType = 'document';
                                break;
                            case 'audio':
                                content = '[Sprachnachricht]';
                                msgType = 'audio';
                                break;
                            case 'video':
                                content = msg.video?.caption || '[Video]';
                                msgType = 'video';
                                break;
                            case 'location':
                                content = `[Standort: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
                                msgType = 'location';
                                break;
                            default:
                                content = `[${msg.type}]`;
                                msgType = msg.type;
                        }

                        const incomingMsg = {
                            id: msg.id,
                            phoneNumber: senderPhone,
                            senderName: senderName,
                            direction: 'inbound',
                            type: msgType,
                            content: content,
                            status: 'received',
                            whatsappTimestamp: msg.timestamp,
                            timestamp: new Date().toISOString(),
                            customerId: this._matchCustomerByPhone(senderPhone),
                            rawPayload: msg
                        };

                        // Store in message log
                        this._logMessage(incomingMsg);

                        // Update conversation
                        this._updateConversation(senderPhone, {
                            lastMessage: content,
                            lastMessageTime: incomingMsg.timestamp,
                            direction: 'inbound',
                            senderName: senderName,
                            unread: true
                        }, incomingMsg.customerId);

                        // Log to communication service
                        this._logToCommunicationService('inbound', senderPhone, content, incomingMsg.customerId, senderName);

                        // Trigger notification
                        this._triggerNotification(senderName, content);

                        processedMessages.push(incomingMsg);
                    }

                    // Handle status updates (sent, delivered, read)
                    if (value.statuses) {
                        for (const status of value.statuses) {
                            this._updateMessageStatus(status.id, status.status, status.timestamp);
                        }
                    }
                }
            }

            return { processed: true, messages: processedMessages };
        } catch (error) {
            console.error('WhatsApp Webhook Verarbeitung fehlgeschlagen:', error);
            return { processed: false, messages: [], error: error.message };
        }
    }

    /**
     * Verify webhook callback (for initial setup)
     * @param {Object} params - URL query parameters
     * @returns {Object} { valid, challenge }
     */
    verifyWebhook(params) {
        const mode = params['hub.mode'];
        const token = params['hub.verify_token'];
        const challenge = params['hub.challenge'];

        if (mode === 'subscribe' && token === this.config.webhookVerifyToken) {
            return { valid: true, challenge: challenge };
        }

        return { valid: false };
    }

    // =====================================================
    // CONVERSATION HISTORY
    // =====================================================

    /**
     * Get all messages for a specific phone number
     * @param {string} phoneNumber - Phone number (will be formatted)
     * @returns {Array} Messages sorted by timestamp (oldest first)
     */
    getConversation(phoneNumber) {
        const formatted = this.formatPhoneNumber(phoneNumber);
        if (!formatted) { return []; }

        return this.messageLog
            .filter(m => m.phoneNumber === formatted)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    /**
     * Get list of all active conversations (grouped by phone number)
     * @returns {Array} Conversations sorted by last message time
     */
    getRecentConversations() {
        const convArray = Object.values(this.conversations);

        return convArray
            .sort((a, b) => {
                const timeA = a.lastMessageTime ? new Date(a.lastMessageTime) : new Date(0);
                const timeB = b.lastMessageTime ? new Date(b.lastMessageTime) : new Date(0);
                return timeB - timeA;
            });
    }

    /**
     * Get conversation metadata for a phone number
     * @param {string} phoneNumber
     * @returns {Object|null}
     */
    getConversationMeta(phoneNumber) {
        const formatted = this.formatPhoneNumber(phoneNumber);
        return this.conversations[formatted] || null;
    }

    /**
     * Mark a conversation as read
     * @param {string} phoneNumber
     */
    markAsRead(phoneNumber) {
        const formatted = this.formatPhoneNumber(phoneNumber);
        if (!formatted || !this.conversations[formatted]) { return; }

        this.conversations[formatted].unread = false;
        this.conversations[formatted].unreadCount = 0;
        this._saveConversations();

        // Mark individual messages as read
        this.messageLog.forEach(msg => {
            if (msg.phoneNumber === formatted && msg.direction === 'inbound' && msg.status !== 'read') {
                msg.status = 'read';
            }
        });
        this._saveMessages();

        // Send read receipts via API if configured
        if (this.isConfigured()) {
            const unreadIds = this.messageLog
                .filter(m => m.phoneNumber === formatted && m.direction === 'inbound' && m.id)
                .map(m => m.id);

            // Mark last message as read via API (batch not supported, mark latest)
            if (unreadIds.length > 0) {
                this._sendReadReceipt(unreadIds[unreadIds.length - 1]).catch(err => {
                    console.warn('Lesebestaetigung konnte nicht gesendet werden:', err);
                });
            }
        }
    }

    /**
     * Get total unread message count
     * @returns {number}
     */
    getUnreadCount() {
        return Object.values(this.conversations)
            .reduce((total, conv) => total + (conv.unreadCount || 0), 0);
    }

    /**
     * Search conversations by name or phone number
     * @param {string} query - Search query
     * @returns {Array} Matching conversations
     */
    searchConversations(query) {
        if (!query) { return this.getRecentConversations(); }
        const q = query.toLowerCase();

        return this.getRecentConversations().filter(conv =>
            (conv.customerName && conv.customerName.toLowerCase().includes(q)) ||
            (conv.phoneNumber && conv.phoneNumber.includes(q)) ||
            (conv.lastMessage && conv.lastMessage.toLowerCase().includes(q))
        );
    }

    /**
     * Delete a conversation and all its messages
     * @param {string} phoneNumber
     */
    deleteConversation(phoneNumber) {
        const formatted = this.formatPhoneNumber(phoneNumber);
        if (!formatted) { return; }

        delete this.conversations[formatted];
        this.messageLog = this.messageLog.filter(m => m.phoneNumber !== formatted);
        this._saveConversations();
        this._saveMessages();
    }

    // =====================================================
    // MESSAGE LOG & FILTERING
    // =====================================================

    /**
     * Get filtered message log
     * @param {Object} filters - { dateFrom, dateTo, status, customerId, direction, type }
     * @returns {Array} Filtered messages
     */
    getMessageLog(filters = {}) {
        let log = [...this.messageLog];

        if (filters.customerId) {
            log = log.filter(m => m.customerId === filters.customerId);
        }

        if (filters.direction) {
            log = log.filter(m => m.direction === filters.direction);
        }

        if (filters.status) {
            log = log.filter(m => m.status === filters.status);
        }

        if (filters.type) {
            log = log.filter(m => m.type === filters.type);
        }

        if (filters.dateFrom) {
            const from = new Date(filters.dateFrom).getTime();
            log = log.filter(m => new Date(m.timestamp).getTime() >= from);
        }

        if (filters.dateTo) {
            const to = new Date(filters.dateTo).getTime();
            log = log.filter(m => new Date(m.timestamp).getTime() <= to);
        }

        if (filters.phoneNumber) {
            const formatted = this.formatPhoneNumber(filters.phoneNumber);
            log = log.filter(m => m.phoneNumber === formatted);
        }

        return log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Get message statistics
     * @returns {Object} Statistics summary
     */
    getStatistics() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return {
            totalMessages: this.messageLog.length,
            totalConversations: Object.keys(this.conversations).length,
            unreadCount: this.getUnreadCount(),
            todayMessages: this.messageLog.filter(m => m.timestamp && m.timestamp.startsWith(today)).length,
            thisMonthMessages: this.messageLog.filter(m => m.timestamp && new Date(m.timestamp) >= thisMonth).length,
            byDirection: {
                sent: this.messageLog.filter(m => m.direction === 'outbound').length,
                received: this.messageLog.filter(m => m.direction === 'inbound').length
            },
            byType: {
                text: this.messageLog.filter(m => m.type === 'text').length,
                template: this.messageLog.filter(m => m.type === 'template').length,
                document: this.messageLog.filter(m => m.type === 'document').length,
                image: this.messageLog.filter(m => m.type === 'image').length
            },
            byStatus: {
                sent: this.messageLog.filter(m => m.status === 'sent').length,
                delivered: this.messageLog.filter(m => m.status === 'delivered').length,
                read: this.messageLog.filter(m => m.status === 'read').length,
                failed: this.messageLog.filter(m => m.status === 'failed').length
            }
        };
    }

    // =====================================================
    // PHONE NUMBER UTILITIES
    // =====================================================

    /**
     * Format a phone number to E.164 format (e.g., +491711234567)
     * Handles various German phone number formats.
     * @param {string} phone - Input phone number
     * @returns {string|null} Formatted phone number or null if invalid
     */
    formatPhoneNumber(phone) {
        if (!phone) { return null; }

        // Remove all non-digit characters except leading +
        let cleaned = phone.trim();
        const hasPlus = cleaned.startsWith('+');
        cleaned = cleaned.replace(/\D/g, '');

        // If it had a + prefix, prepend it back
        if (hasPlus) {
            cleaned = '+' + cleaned;
        }

        // Handle different German formats
        if (cleaned.startsWith('+')) {
            // Already has country code (e.g., +491711234567)
            if (cleaned.startsWith('+49') && cleaned.length >= 12 && cleaned.length <= 15) {
                return cleaned;
            }
            // Other country codes - accept as-is if reasonable length
            if (cleaned.length >= 10 && cleaned.length <= 16) {
                return cleaned;
            }
        } else if (cleaned.startsWith('0049')) {
            // International format with 00 prefix
            cleaned = '+' + cleaned.substring(2);
            if (cleaned.length >= 12 && cleaned.length <= 15) {
                return cleaned;
            }
        } else if (cleaned.startsWith('49') && cleaned.length >= 11) {
            // Missing + but has country code
            return '+' + cleaned;
        } else if (cleaned.startsWith('0')) {
            // German national format (e.g., 0171 1234567)
            cleaned = '+49' + cleaned.substring(1);
            if (cleaned.length >= 12 && cleaned.length <= 15) {
                return cleaned;
            }
        } else if (cleaned.startsWith('1') && cleaned.length >= 10 && cleaned.length <= 11) {
            // Mobile number without leading 0 (e.g., 171 1234567)
            return '+49' + cleaned;
        }

        // Final validation: must be at least 10 digits with country code
        if (cleaned.startsWith('+') && cleaned.length >= 10) {
            return cleaned;
        }

        return null;
    }

    /**
     * Validate a phone number for WhatsApp
     * @param {string} phone - Input phone number
     * @returns {boolean}
     */
    isValidWhatsAppNumber(phone) {
        const formatted = this.formatPhoneNumber(phone);
        return formatted !== null && formatted.length >= 12;
    }

    // =====================================================
    // AUTO-SEND SETTINGS
    // =====================================================

    /**
     * Get auto-send settings
     * @returns {Object}
     */
    getAutoSendSettings() {
        return this.settings.autoSend || {};
    }

    /**
     * Update auto-send setting for a specific event
     * @param {string} eventKey - Event identifier
     * @param {boolean} enabled - Whether to auto-send
     */
    setAutoSend(eventKey, enabled) {
        if (!this.settings.autoSend) {
            this.settings.autoSend = {};
        }
        this.settings.autoSend[eventKey] = enabled;
        this._saveSettings();
    }

    // =====================================================
    // INTERNAL HELPERS
    // =====================================================

    /**
     * Make an API request with rate limiting and error handling
     */
    async _apiRequest(url, method = 'GET', body = null) {
        // Simple rate limiting: wait if we've exceeded the limit
        await this._waitForRateLimit();

        const options = {
            method: method,
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        return fetch(url, options);
    }

    /**
     * Basic rate limiter
     */
    _waitForRateLimit() {
        return new Promise(resolve => {
            const now = Date.now();
            // Clean old entries (older than 1 second)
            this._rateLimitQueue = this._rateLimitQueue.filter(t => now - t < 1000);

            if (this._rateLimitQueue.length < this._maxRequestsPerSecond) {
                this._rateLimitQueue.push(now);
                resolve();
            } else {
                // Wait until the oldest request in the window expires
                const waitTime = 1000 - (now - this._rateLimitQueue[0]);
                setTimeout(() => {
                    this._rateLimitQueue.push(Date.now());
                    resolve();
                }, Math.max(waitTime, 100));
            }
        });
    }

    /**
     * Fallback when API is not configured: log locally and provide wa.me link
     */
    _fallbackSend(formattedPhone, message, customerId) {
        const waUrl = `https://wa.me/${formattedPhone.replace('+', '')}?text=${encodeURIComponent(message)}`;
        const msgId = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

        this._logMessage({
            id: msgId,
            phoneNumber: formattedPhone,
            direction: 'outbound',
            type: 'text',
            content: message,
            status: 'pending',
            customerId: customerId,
            timestamp: new Date().toISOString(),
            isDemoMode: true
        });

        this._updateConversation(formattedPhone, {
            lastMessage: message,
            lastMessageTime: new Date().toISOString(),
            direction: 'outbound'
        }, customerId);

        this._logToCommunicationService('outbound', formattedPhone, message, customerId);

        return {
            success: true,
            messageId: msgId,
            isDemoMode: true,
            whatsappUrl: waUrl
        };
    }

    /**
     * Send a read receipt via API
     */
    async _sendReadReceipt(messageId) {
        if (!this.isConfigured() || !messageId) { return; }

        const url = `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`;
        const body = {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId
        };

        try {
            await this._apiRequest(url, 'POST', body);
        } catch (error) {
            console.warn('Lesebestaetigung fehlgeschlagen:', error);
        }
    }

    /**
     * Log a message to the local message store
     */
    _logMessage(msg) {
        // Avoid duplicates
        const exists = this.messageLog.find(m => m.id === msg.id);
        if (!exists) {
            this.messageLog.push(msg);
            this._saveMessages();
        }
    }

    /**
     * Update or create a conversation entry
     */
    _updateConversation(phoneNumber, data, customerId = null) {
        if (!this.conversations[phoneNumber]) {
            this.conversations[phoneNumber] = {
                phoneNumber: phoneNumber,
                customerName: data.senderName || this._lookupCustomerName(phoneNumber, customerId) || phoneNumber,
                customerId: customerId,
                lastMessage: '',
                lastMessageTime: null,
                unread: false,
                unreadCount: 0,
                createdAt: new Date().toISOString()
            };
        }

        const conv = this.conversations[phoneNumber];
        conv.lastMessage = data.lastMessage || conv.lastMessage;
        conv.lastMessageTime = data.lastMessageTime || conv.lastMessageTime;

        if (data.senderName && data.senderName !== phoneNumber) {
            conv.customerName = data.senderName;
        }

        if (customerId) {
            conv.customerId = customerId;
        }

        // Update unread status for incoming messages
        if (data.direction === 'inbound') {
            conv.unread = data.unread !== undefined ? data.unread : true;
            conv.unreadCount = (conv.unreadCount || 0) + 1;
        }

        this._saveConversations();
    }

    /**
     * Update the status of a message (sent -> delivered -> read)
     */
    _updateMessageStatus(messageId, newStatus, timestamp) {
        const msg = this.messageLog.find(m => m.id === messageId);
        if (msg) {
            msg.status = newStatus;
            if (timestamp) {
                msg.statusTimestamp = new Date(parseInt(timestamp) * 1000).toISOString();
            }
            this._saveMessages();
        }
    }

    /**
     * Match a phone number to an existing customer
     */
    _matchCustomerByPhone(phoneNumber) {
        if (!window.customerService) { return null; }

        const customers = window.customerService.customers || [];
        const formatted = this.formatPhoneNumber(phoneNumber);

        for (const customer of customers) {
            const customerPhones = [customer.telefon, customer.mobil].filter(Boolean);
            for (const cp of customerPhones) {
                if (this.formatPhoneNumber(cp) === formatted) {
                    return customer.id;
                }
            }
        }

        return null;
    }

    /**
     * Look up a customer name by ID or phone number
     */
    _lookupCustomerName(phoneNumber, customerId) {
        if (!window.customerService) { return null; }

        if (customerId) {
            const customer = window.customerService.customers?.find(c => c.id === customerId);
            if (customer) { return customer.name; }
        }

        // Try matching by phone
        const matched = this._matchCustomerByPhone(phoneNumber);
        if (matched) {
            const customer = window.customerService.customers?.find(c => c.id === matched);
            if (customer) { return customer.name; }
        }

        return null;
    }

    /**
     * Log to the existing communication service for unified view
     */
    _logToCommunicationService(direction, phoneNumber, content, customerId = null, customerName = '') {
        if (window.communicationService) {
            window.communicationService.logMessage({
                type: 'whatsapp',
                direction: direction === 'inbound' ? 'inbound' : 'outbound',
                from: direction === 'inbound' ? phoneNumber : this._getBusinessName(),
                to: direction === 'outbound' ? phoneNumber : this._getBusinessName(),
                content: content,
                customerId: customerId,
                customerName: customerName || this._lookupCustomerName(phoneNumber, customerId) || '',
                status: 'sent'
            });
        }
    }

    /**
     * Trigger a notification for incoming messages
     */
    _triggerNotification(senderName, content) {
        if (window.notificationService) {
            window.notificationService.notify({
                type: 'system',
                title: `WhatsApp: ${senderName}`,
                message: content.substring(0, 100),
                icon: '💬'
            });
        }
    }

    /**
     * Get business name from admin settings
     */
    _getBusinessName() {
        if (this.config.businessName) { return this.config.businessName; }
        const ap = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
        return ap.company_name || window.storeService?.state?.settings?.companyName || 'FreyAI Visions';
    }

    /**
     * Get business phone from admin settings
     */
    _getBusinessPhone() {
        const ap = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
        return ap.company_phone || window.storeService?.state?.settings?.phone || '';
    }

    // =====================================================
    // FORMATTING HELPERS
    // =====================================================

    /**
     * Format a date string for display
     * @param {string} dateStr - ISO date string
     * @returns {string} German-formatted date
     */
    formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    }

    /**
     * Format a date with time
     * @param {string} dateStr - ISO date string
     * @returns {string} German-formatted date + time
     */
    formatDateTime(dateStr) {
        return new Date(dateStr).toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    /**
     * Get relative time string (German)
     * @param {string} dateStr - ISO date string
     * @returns {string} e.g., "vor 5 Min.", "Gestern"
     */
    getRelativeTime(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) { return 'Gerade eben'; }
        if (minutes < 60) { return `vor ${minutes} Min.`; }
        if (hours < 24) { return `vor ${hours} Std.`; }
        if (days === 1) { return 'Gestern'; }
        if (days < 7) { return `vor ${days} Tagen`; }
        return this.formatDate(dateStr);
    }

    /**
     * Get status icon for message status
     * @param {string} status - sent, delivered, read, failed
     * @returns {string} Unicode checkmark icons
     */
    getStatusIcon(status) {
        switch (status) {
            case 'sent': return '\u2713';       // single check
            case 'delivered': return '\u2713\u2713';  // double check
            case 'read': return '\u2713\u2713';  // double check (will be blue in CSS)
            case 'failed': return '\u2717';      // x mark
            case 'pending': return '\u231B';     // hourglass
            default: return '';
        }
    }

    // =====================================================
    // PERSISTENCE
    // =====================================================

    _saveConfig() {
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(this.config));
    }

    _saveConversations() {
        localStorage.setItem(this.CONVERSATIONS_KEY, JSON.stringify(this.conversations));
    }

    _saveMessages() {
        localStorage.setItem(this.MESSAGES_KEY, JSON.stringify(this.messageLog));
    }

    _saveSettings() {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
    }

    /**
     * Generate a unique ID
     * @returns {string}
     */
    generateId() {
        return 'wa-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Export conversation history as CSV
     * @param {string} phoneNumber
     * @returns {Object} { filename, content }
     */
    exportConversation(phoneNumber) {
        const messages = this.getConversation(phoneNumber);
        const conv = this.conversations[this.formatPhoneNumber(phoneNumber)];
        const name = conv?.customerName || phoneNumber;

        const csv = [
            'Datum,Uhrzeit,Richtung,Typ,Status,Nachricht',
            ...messages.map(m => {
                const date = new Date(m.timestamp);
                const dateStr = date.toLocaleDateString('de-DE');
                const timeStr = date.toLocaleTimeString('de-DE');
                const direction = m.direction === 'inbound' ? 'Empfangen' : 'Gesendet';
                return `"${dateStr}","${timeStr}","${direction}","${m.type}","${m.status}","${(m.content || '').replace(/"/g, '""')}"`;
            })
        ].join('\n');

        return {
            filename: `WhatsApp_${name}_${new Date().toISOString().split('T')[0]}.csv`,
            content: csv
        };
    }

    /**
     * Clear all WhatsApp data (for testing/reset)
     */
    clearAllData() {
        this.conversations = {};
        this.messageLog = [];
        this._saveConversations();
        this._saveMessages();
    }
}

// Register as global service
window.whatsappService = new WhatsAppService();
