/* ============================================
   Customer Portal Service (Feature #9)
   Self-service portal for customers:
   - Token-based access management
   - Quote approval / change requests
   - Invoice viewing & Stripe payment
   - Customer messaging
   - Photo sharing controls
   - Portal link generation & email dispatch
   ============================================ */

class CustomerPortalService {
    constructor() {
        this.STORAGE_KEY = 'freyai_portal_tokens';
        this.MESSAGES_KEY = 'freyai_portal_messages';
        this.SHARED_PHOTOS_KEY = 'freyai_portal_shared_photos';

        this.tokens = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
        this.portalMessages = JSON.parse(localStorage.getItem(this.MESSAGES_KEY) || '[]');
        this.sharedPhotoIds = JSON.parse(localStorage.getItem(this.SHARED_PHOTOS_KEY) || '{}');
    }

    // ============================================
    // Token Management
    // ============================================

    /**
     * Generate a unique access token for a customer.
     * @param {string} customerId - Customer ID
     * @param {string} scope - Access scope: 'full', 'quote', or 'invoice'
     * @param {Object} options - Optional settings (expiresInDays)
     * @returns {Object} Token record
     */
    generateAccessToken(customerId, scope = 'full', options = {}) {
        try {
            if (!customerId) {
                throw new Error('Customer ID ist erforderlich');
            }

            const validScopes = ['full', 'quote', 'invoice'];
            if (!validScopes.includes(scope)) {
                throw new Error(`Ungültiger Scope: ${scope}. Erlaubt: ${validScopes.join(', ')}`);
            }

            const expiresInDays = options.expiresInDays || 30;
            const now = new Date();
            const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

            const token = 'cp-' + this._generateRandomString(32);

            const tokenRecord = {
                token,
                customerId,
                scope,
                createdAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                isActive: true,
                lastAccessedAt: null,
                accessCount: 0
            };

            this.tokens.push(tokenRecord);
            this._saveTokens();

            // Activity log
            if (window.storeService) {
                window.storeService.addActivity('🔗', `Portal-Zugang erstellt (${scope}) für Kunde`);
            }

            return tokenRecord;
        } catch (error) {
            console.error('Token generation error:', error);
            throw error;
        }
    }

    /**
     * Revoke an existing access token.
     * @param {string} token - The token string to revoke
     * @returns {boolean} Success
     */
    revokeToken(token) {
        try {
            const record = this.tokens.find(t => t.token === token);
            if (!record) {
                return false;
            }

            record.isActive = false;
            record.revokedAt = new Date().toISOString();
            this._saveTokens();

            if (window.storeService) {
                window.storeService.addActivity('🚫', 'Portal-Zugang widerrufen');
            }

            return true;
        } catch (error) {
            console.error('Token revocation error:', error);
            return false;
        }
    }

    /**
     * Validate a token and return access details.
     * @param {string} token - The token string to validate
     * @returns {Object} { valid, customer, scope, error }
     */
    validateToken(token) {
        try {
            if (!token || typeof token !== 'string') {
                return { valid: false, error: 'Kein Token angegeben' };
            }

            const record = this.tokens.find(t => t.token === token);
            if (!record) {
                return { valid: false, error: 'Ungültiger Zugangslink' };
            }

            if (!record.isActive) {
                return { valid: false, error: 'Dieser Zugang wurde deaktiviert' };
            }

            const now = new Date();
            if (new Date(record.expiresAt) < now) {
                return { valid: false, error: 'Dieser Zugangslink ist abgelaufen' };
            }

            // Look up customer
            let customer = null;
            if (window.customerService) {
                customer = window.customerService.getCustomer(record.customerId);
            }

            if (!customer) {
                return { valid: false, error: 'Kundendaten nicht gefunden' };
            }

            // Update access tracking
            record.lastAccessedAt = now.toISOString();
            record.accessCount = (record.accessCount || 0) + 1;
            this._saveTokens();

            return {
                valid: true,
                customer: {
                    id: customer.id,
                    name: customer.name,
                    firma: customer.firma || ''
                },
                scope: record.scope,
                customerId: record.customerId,
                expiresAt: record.expiresAt
            };
        } catch (error) {
            console.error('Token validation error:', error);
            return { valid: false, error: 'Technischer Fehler bei der Validierung' };
        }
    }

    /**
     * Get all active tokens for a customer.
     * @param {string} customerId - Customer ID
     * @returns {Array} Active token records
     */
    getActiveTokens(customerId) {
        const now = new Date();
        return this.tokens.filter(t =>
            t.customerId === customerId &&
            t.isActive &&
            new Date(t.expiresAt) > now
        );
    }

    /**
     * Get all tokens for a customer (including expired/revoked).
     * @param {string} customerId - Customer ID
     * @returns {Array} All token records
     */
    getAllTokens(customerId) {
        return this.tokens.filter(t => t.customerId === customerId);
    }

    // ============================================
    // Portal Data Access
    // ============================================

    /**
     * Get all portal data filtered by token scope.
     * This is the main method called by the portal page.
     * @param {string} token - Access token
     * @returns {Object|null} Filtered portal data
     */
    getPortalData(token) {
        try {
            const validation = this.validateToken(token);
            if (!validation.valid) {
                return null;
            }

            const { customerId, scope } = validation;
            const data = {
                customer: validation.customer,
                scope,
                companyInfo: this._getCompanyInfo(),
                status: null,
                quotes: [],
                invoices: [],
                messages: [],
                documents: [],
                photos: []
            };

            const store = window.storeService?.state;
            if (!store) {
                return data;
            }

            // Find related workflow items for this customer
            const customerName = validation.customer.name;

            // Get quotes (Angebote)
            if (scope === 'full' || scope === 'quote') {
                data.quotes = (store.angebote || []).filter(a =>
                    a.kunde?.name === customerName ||
                    a.kunde?.id === customerId
                ).map(a => ({
                    id: a.id,
                    leistungsart: a.leistungsart || '',
                    positionen: a.positionen || [],
                    netto: a.netto || 0,
                    mwst: a.mwst || 0,
                    brutto: a.brutto || 0,
                    status: a.status || 'offen',
                    createdAt: a.createdAt || a.datum,
                    gueltigBis: a.gueltigBis || null
                }));
            }

            // Get invoices (Rechnungen)
            if (scope === 'full' || scope === 'invoice') {
                data.invoices = (store.rechnungen || []).filter(r =>
                    r.kunde?.name === customerName ||
                    r.kunde?.id === customerId
                ).map(r => ({
                    id: r.id,
                    nummer: r.nummer || r.id,
                    leistungsart: r.leistungsart || '',
                    netto: r.netto || 0,
                    mwst: r.mwst || 0,
                    brutto: r.brutto || 0,
                    status: r.status || 'offen',
                    datum: r.datum || r.createdAt,
                    faelligkeitsdatum: r.faelligkeitsdatum || null,
                    paidAt: r.paidAt || null
                }));
            }

            // Get job status (Auftraege)
            if (scope === 'full') {
                const auftraege = (store.auftraege || []).filter(a =>
                    a.kunde?.name === customerName ||
                    a.kunde?.id === customerId
                );

                if (auftraege.length > 0) {
                    const latest = auftraege.sort((a, b) =>
                        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
                    )[0];

                    data.status = {
                        auftragId: latest.id,
                        status: latest.status || 'geplant',
                        fortschritt: latest.fortschritt || 0,
                        leistungsart: latest.leistungsart || '',
                        startDatum: latest.startDatum || null,
                        endDatum: latest.endDatum || null
                    };
                }

                // Determine workflow stage
                data.workflowStage = this._determineWorkflowStage(customerName, customerId, store);
            }

            // Get messages
            if (scope === 'full') {
                data.messages = this.getMessages(token);
            }

            // Get shared photos
            if (scope === 'full') {
                data.photos = this.getSharedPhotos(token);
            }

            // Build document list
            data.documents = this._buildDocumentList(data);

            return data;
        } catch (error) {
            console.error('Portal data retrieval error:', error);
            return null;
        }
    }

    /**
     * Determine the workflow stage for the status tracker.
     * Stages: anfrage, angebot, auftrag, rechnung, bezahlt
     * @private
     */
    _determineWorkflowStage(customerName, customerId, store) {
        const stages = {
            anfrage: 'pending',
            angebot: 'pending',
            auftrag: 'pending',
            rechnung: 'pending',
            bezahlt: 'pending'
        };

        // Check for Anfragen
        const hasAnfrage = (store.anfragen || []).some(a =>
            a.kunde?.name === customerName || a.kunde?.id === customerId
        );
        if (hasAnfrage) {
            stages.anfrage = 'completed';
        }

        // Check for Angebote
        const angebote = (store.angebote || []).filter(a =>
            a.kunde?.name === customerName || a.kunde?.id === customerId
        );
        if (angebote.length > 0) {
            stages.anfrage = 'completed';
            stages.angebot = 'completed';

            // If any angebot is still open, mark as active
            if (angebote.some(a => a.status === 'offen' || !a.status)) {
                stages.angebot = 'active';
            }
        }

        // Check for Auftraege
        const auftraege = (store.auftraege || []).filter(a =>
            a.kunde?.name === customerName || a.kunde?.id === customerId
        );
        if (auftraege.length > 0) {
            stages.anfrage = 'completed';
            stages.angebot = 'completed';
            stages.auftrag = 'completed';

            if (auftraege.some(a => a.status !== 'abgeschlossen')) {
                stages.auftrag = 'active';
            }
        }

        // Check for Rechnungen
        const rechnungen = (store.rechnungen || []).filter(r =>
            r.kunde?.name === customerName || r.kunde?.id === customerId
        );
        if (rechnungen.length > 0) {
            stages.anfrage = 'completed';
            stages.angebot = 'completed';
            stages.auftrag = 'completed';
            stages.rechnung = 'completed';

            if (rechnungen.some(r => r.status === 'offen')) {
                stages.rechnung = 'active';
            }

            if (rechnungen.every(r => r.status === 'bezahlt')) {
                stages.bezahlt = 'completed';
            } else if (rechnungen.some(r => r.status === 'bezahlt')) {
                stages.bezahlt = 'active';
            }
        }

        return stages;
    }

    /**
     * Build a list of downloadable documents from portal data.
     * @private
     */
    _buildDocumentList(data) {
        const documents = [];

        data.quotes.forEach(q => {
            documents.push({
                type: 'angebot',
                id: q.id,
                name: `Angebot ${q.id}`,
                detail: `${this._formatCurrency(q.brutto)} - ${q.leistungsart || 'Dienstleistung'}`,
                date: q.createdAt
            });
        });

        data.invoices.forEach(inv => {
            documents.push({
                type: 'rechnung',
                id: inv.id,
                name: `Rechnung ${inv.nummer}`,
                detail: `${this._formatCurrency(inv.brutto)} - ${inv.status === 'bezahlt' ? 'Bezahlt' : 'Offen'}`,
                date: inv.datum
            });
        });

        return documents;
    }

    /**
     * Get company info for portal header.
     * @private
     */
    _getCompanyInfo() {
        const adminSettings = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
        const storeSettings = window.storeService?.state?.settings || {};

        return {
            name: adminSettings.company_name || storeSettings.companyName || 'Unser Unternehmen',
            phone: adminSettings.company_phone || storeSettings.phone || '',
            email: adminSettings.company_email || storeSettings.email || '',
            address: adminSettings.company_address || storeSettings.address || '',
            logo: adminSettings.company_logo || null
        };
    }

    // ============================================
    // Quote Approval
    // ============================================

    /**
     * Approve a quote via the customer portal.
     * @param {string} token - Access token
     * @param {string} quoteId - Angebot ID
     * @param {string} customerMessage - Optional message from customer
     * @returns {Object} { success, message }
     */
    approveQuote(token, quoteId, customerMessage = '') {
        try {
            const validation = this.validateToken(token);
            if (!validation.valid) {
                return { success: false, message: validation.error };
            }

            if (validation.scope === 'invoice') {
                return { success: false, message: 'Dieser Zugang berechtigt nicht zur Angebotsfreigabe' };
            }

            const store = window.storeService?.state;
            if (!store) {
                return { success: false, message: 'Systemfehler: Store nicht verfügbar' };
            }

            const angebot = store.angebote.find(a => a.id === quoteId);
            if (!angebot) {
                return { success: false, message: 'Angebot nicht gefunden' };
            }

            // Verify this quote belongs to the customer
            if (angebot.kunde?.name !== validation.customer.name &&
                angebot.kunde?.id !== validation.customerId) {
                return { success: false, message: 'Zugriff verweigert' };
            }

            if (angebot.status === 'angenommen') {
                return { success: false, message: 'Dieses Angebot wurde bereits angenommen' };
            }

            // Accept the quote through the store service
            if (window.storeService.acceptAngebot) {
                window.storeService.acceptAngebot(quoteId);
            } else {
                angebot.status = 'angenommen';
                angebot.acceptedAt = new Date().toISOString();
                angebot.acceptedVia = 'portal';
                window.storeService.save();
            }

            // Log message if provided
            if (customerMessage) {
                this.sendCustomerMessage(token, `Angebot ${quoteId} angenommen: ${customerMessage}`);
            }

            // Activity log
            window.storeService.addActivity(
                '✅',
                `Angebot ${quoteId} vom Kunden ${validation.customer.name} online angenommen`
            );

            // Notification to business owner
            if (window.notificationService) {
                window.notificationService.sendNotification(
                    'Angebot angenommen!',
                    {
                        body: `${validation.customer.name} hat Angebot ${quoteId} über das Kundenportal angenommen.`,
                        tag: `quote-approved-${quoteId}`
                    }
                );
            }

            return { success: true, message: 'Angebot erfolgreich angenommen. Vielen Dank!' };
        } catch (error) {
            console.error('Quote approval error:', error);
            return { success: false, message: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
        }
    }

    /**
     * Reject a quote via the customer portal.
     * @param {string} token - Access token
     * @param {string} quoteId - Angebot ID
     * @param {string} reason - Optional reason from customer
     * @returns {Object} { success, message }
     */
    rejectQuote(token, quoteId, reason = '') {
        try {
            const validation = this.validateToken(token);
            if (!validation.valid) {
                return { success: false, message: validation.error };
            }

            if (validation.scope === 'invoice') {
                return { success: false, message: 'Dieser Zugang berechtigt nicht zur Angebotsverwaltung' };
            }

            const store = window.storeService?.state;
            if (!store) {
                return { success: false, message: 'Systemfehler: Store nicht verfügbar' };
            }

            const angebot = store.angebote?.find(a => a.id === quoteId);
            if (!angebot) {
                return { success: false, message: 'Angebot nicht gefunden' };
            }

            if (angebot.kunde?.name !== validation.customer.name &&
                angebot.kunde?.id !== validation.customerId) {
                return { success: false, message: 'Zugriff verweigert' };
            }

            if (angebot.status === 'abgelehnt') {
                return { success: false, message: 'Dieses Angebot wurde bereits abgelehnt' };
            }

            angebot.status = 'abgelehnt';
            angebot.rejectedAt = new Date().toISOString();
            angebot.rejectedVia = 'portal';
            if (reason) { angebot.rejectionReason = reason; }
            window.storeService.save();

            if (reason) {
                this.sendCustomerMessage(token, `Angebot ${quoteId} abgelehnt: ${reason}`);
            }

            window.storeService.addActivity(
                '❌',
                `Angebot ${quoteId} vom Kunden ${validation.customer.name} über das Portal abgelehnt`
            );

            return { success: true, message: 'Angebot wurde abgelehnt. Wir melden uns bei Ihnen.' };
        } catch (error) {
            console.error('Quote rejection error:', error);
            return { success: false, message: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
        }
    }

    /**
     * Request changes to a quote via the customer portal.
     * @param {string} token - Access token
     * @param {string} quoteId - Angebot ID
     * @param {string} changeRequest - Customer's change request
     * @returns {Object} { success, message }
     */
    requestQuoteChanges(token, quoteId, changeRequest) {
        try {
            const validation = this.validateToken(token);
            if (!validation.valid) {
                return { success: false, message: validation.error };
            }

            if (!changeRequest || !changeRequest.trim()) {
                return { success: false, message: 'Bitte beschreiben Sie die gewünschten Änderungen' };
            }

            const store = window.storeService?.state;
            if (!store) {
                return { success: false, message: 'Systemfehler' };
            }

            const angebot = store.angebote.find(a => a.id === quoteId);
            if (!angebot) {
                return { success: false, message: 'Angebot nicht gefunden' };
            }

            // Store the change request
            if (!angebot.changeRequests) {
                angebot.changeRequests = [];
            }

            angebot.changeRequests.push({
                id: 'cr-' + Date.now(),
                message: changeRequest.trim(),
                createdAt: new Date().toISOString(),
                via: 'portal',
                customerName: validation.customer.name,
                status: 'offen'
            });

            angebot.status = 'aenderung-angefragt';
            window.storeService.save();

            // Log as portal message
            this.sendCustomerMessage(
                token,
                `Änderungswunsch zu Angebot ${quoteId}: ${changeRequest.trim()}`
            );

            // Activity + notification
            window.storeService.addActivity(
                '📝',
                `Änderungswunsch von ${validation.customer.name} zu Angebot ${quoteId}`
            );

            if (window.notificationService) {
                window.notificationService.sendNotification(
                    'Änderungswunsch eingegangen',
                    {
                        body: `${validation.customer.name} wünscht Änderungen an Angebot ${quoteId}.`,
                        tag: `quote-change-${quoteId}`
                    }
                );
            }

            return { success: true, message: 'Ihre Änderungswünsche wurden übermittelt. Wir melden uns bei Ihnen.' };
        } catch (error) {
            console.error('Quote change request error:', error);
            return { success: false, message: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
        }
    }

    // ============================================
    // Customer Messaging
    // ============================================

    /**
     * Send a message from the customer to the business.
     * @param {string} token - Access token
     * @param {string} message - Message text
     * @returns {Object} { success, message, messageId }
     */
    sendCustomerMessage(token, message) {
        try {
            const validation = this.validateToken(token);
            if (!validation.valid) {
                return { success: false, message: validation.error };
            }

            if (!message || !message.trim()) {
                return { success: false, message: 'Bitte geben Sie eine Nachricht ein' };
            }

            const entry = {
                id: 'pm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                customerId: validation.customerId,
                customerName: validation.customer.name,
                direction: 'inbound',
                content: message.trim(),
                createdAt: new Date().toISOString(),
                readAt: null,
                via: 'portal'
            };

            this.portalMessages.push(entry);
            this._saveMessages();

            // Also log in communication service if available
            if (window.communicationService) {
                window.communicationService.logMessage({
                    type: 'portal',
                    direction: 'inbound',
                    from: validation.customer.name,
                    to: this._getCompanyInfo().name,
                    content: message.trim(),
                    customerId: validation.customerId,
                    customerName: validation.customer.name,
                    status: 'delivered'
                });
            }

            // Notification
            if (window.notificationService) {
                window.notificationService.sendNotification(
                    'Neue Portal-Nachricht',
                    {
                        body: `${validation.customer.name}: ${message.trim().substring(0, 80)}`,
                        tag: `portal-msg-${entry.id}`
                    }
                );
            }

            return { success: true, message: 'Nachricht gesendet', messageId: entry.id };
        } catch (error) {
            console.error('Customer message error:', error);
            return { success: false, message: 'Nachricht konnte nicht gesendet werden' };
        }
    }

    /**
     * Send a message from the business to the customer (admin-side).
     * @param {string} customerId - Customer ID
     * @param {string} message - Message text
     * @returns {Object} { success, messageId }
     */
    sendBusinessMessage(customerId, message) {
        try {
            const entry = {
                id: 'pm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                customerId,
                customerName: '',
                direction: 'outbound',
                content: message.trim(),
                createdAt: new Date().toISOString(),
                readAt: null,
                via: 'admin'
            };

            // Get customer name
            if (window.customerService) {
                const customer = window.customerService.getCustomer(customerId);
                if (customer) {
                    entry.customerName = customer.name;
                }
            }

            this.portalMessages.push(entry);
            this._saveMessages();

            return { success: true, messageId: entry.id };
        } catch (error) {
            console.error('Business message error:', error);
            return { success: false, message: 'Fehler beim Senden' };
        }
    }

    /**
     * Get message history for a token (filtered by customer).
     * @param {string} token - Access token
     * @returns {Array} Messages sorted by date
     */
    getMessages(token) {
        try {
            const record = this.tokens.find(t => t.token === token);
            if (!record) {
                return [];
            }

            return this.portalMessages
                .filter(m => m.customerId === record.customerId)
                .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } catch (error) {
            console.error('Get messages error:', error);
            return [];
        }
    }

    /**
     * Get message history by customer ID (admin-side).
     * @param {string} customerId - Customer ID
     * @returns {Array} Messages sorted by date
     */
    getMessagesByCustomer(customerId) {
        return this.portalMessages
            .filter(m => m.customerId === customerId)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    /**
     * Get unread portal messages.
     * @returns {Array} Unread inbound messages
     */
    getUnreadMessages() {
        return this.portalMessages.filter(m => m.direction === 'inbound' && !m.readAt);
    }

    /**
     * Mark a message as read.
     * @param {string} messageId - Message ID
     */
    markMessageRead(messageId) {
        const msg = this.portalMessages.find(m => m.id === messageId);
        if (msg) {
            msg.readAt = new Date().toISOString();
            this._saveMessages();
        }
    }

    // ============================================
    // Payment Integration
    // ============================================

    /**
     * Get a Stripe payment link for an invoice.
     * @param {string} token - Access token
     * @param {string} invoiceId - Rechnung ID
     * @returns {Promise<Object>} { success, url } or { success: false, error }
     */
    async getPaymentLink(token, invoiceId) {
        try {
            const validation = this.validateToken(token);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            if (validation.scope === 'quote') {
                return { success: false, error: 'Dieser Zugang berechtigt nicht zur Zahlung' };
            }

            const store = window.storeService?.state;
            if (!store) {
                return { success: false, error: 'Systemfehler' };
            }

            const invoice = store.rechnungen.find(r => r.id === invoiceId);
            if (!invoice) {
                return { success: false, error: 'Rechnung nicht gefunden' };
            }

            // Verify invoice belongs to customer
            if (invoice.kunde?.name !== validation.customer.name &&
                invoice.kunde?.id !== validation.customerId) {
                return { success: false, error: 'Zugriff verweigert' };
            }

            if (invoice.status === 'bezahlt') {
                return { success: false, error: 'Diese Rechnung wurde bereits bezahlt' };
            }

            if (invoice.status === 'storniert') {
                return { success: false, error: 'Diese Rechnung wurde storniert' };
            }

            // Try Stripe payment link
            if (window.stripeService && window.stripeService.isConfigured()) {
                const paymentInvoice = {
                    id: invoice.id,
                    nummer: invoice.nummer,
                    betrag: invoice.brutto,
                    kunde: invoice.kunde
                };

                const result = await window.stripeService.createPaymentLink(paymentInvoice);
                if (result.success) {
                    return { success: true, url: result.url };
                } else {
                    return { success: false, error: result.error || 'Zahlungslink konnte nicht erstellt werden' };
                }
            }

            return {
                success: false,
                error: 'Online-Zahlung ist derzeit nicht verfügbar. Bitte überweisen Sie den Betrag.'
            };
        } catch (error) {
            console.error('Payment link error:', error);
            return { success: false, error: 'Zahlungslink konnte nicht erstellt werden' };
        }
    }

    // ============================================
    // Photo Sharing
    // ============================================

    /**
     * Share specific photos with a customer.
     * @param {string} customerId - Customer ID
     * @param {string} jobId - Auftrag/Reference ID
     * @param {Array} photoIds - Array of photo IDs to share
     * @returns {Object} { success, sharedCount }
     */
    sharePhotosWithCustomer(customerId, jobId, photoIds) {
        try {
            if (!customerId || !photoIds || !Array.isArray(photoIds)) {
                return { success: false, message: 'Ungültige Parameter' };
            }

            const key = `${customerId}_${jobId || 'general'}`;
            if (!this.sharedPhotoIds[key]) {
                this.sharedPhotoIds[key] = [];
            }

            // Add new photo IDs (avoid duplicates)
            photoIds.forEach(pid => {
                if (!this.sharedPhotoIds[key].includes(pid)) {
                    this.sharedPhotoIds[key].push(pid);
                }
            });

            this._saveSharedPhotos();

            if (window.storeService) {
                window.storeService.addActivity('📸', `${photoIds.length} Fotos mit Kunden geteilt`);
            }

            return { success: true, sharedCount: this.sharedPhotoIds[key].length };
        } catch (error) {
            console.error('Photo sharing error:', error);
            return { success: false, message: 'Fehler beim Teilen der Fotos' };
        }
    }

    /**
     * Remove photo sharing for a specific photo.
     * @param {string} customerId - Customer ID
     * @param {string} jobId - Job reference ID
     * @param {string} photoId - Photo ID to unshare
     */
    unsharePhoto(customerId, jobId, photoId) {
        const key = `${customerId}_${jobId || 'general'}`;
        if (this.sharedPhotoIds[key]) {
            this.sharedPhotoIds[key] = this.sharedPhotoIds[key].filter(id => id !== photoId);
            this._saveSharedPhotos();
        }
    }

    /**
     * Get shared photos for a portal token.
     * @param {string} token - Access token
     * @returns {Array} Shared photo objects
     */
    getSharedPhotos(token) {
        try {
            const record = this.tokens.find(t => t.token === token);
            if (!record) {
                return [];
            }

            const customerId = record.customerId;
            const photos = [];

            // Collect all shared photo IDs for this customer
            const sharedIds = new Set();
            Object.keys(this.sharedPhotoIds).forEach(key => {
                if (key.startsWith(customerId + '_')) {
                    this.sharedPhotoIds[key].forEach(pid => sharedIds.add(pid));
                }
            });

            // Get photo objects from photo service
            if (window.photoService && sharedIds.size > 0) {
                sharedIds.forEach(photoId => {
                    const photo = window.photoService.getPhoto(photoId);
                    if (photo) {
                        photos.push({
                            id: photo.id,
                            title: photo.title || 'Foto',
                            description: photo.description || '',
                            category: photo.category || '',
                            dataUrl: photo.dataUrl,
                            timestamp: photo.timestamp
                        });
                    }
                });
            }

            return photos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('Get shared photos error:', error);
            return [];
        }
    }

    // ============================================
    // Portal Link Generation
    // ============================================

    /**
     * Generate a full portal URL with token.
     * @param {string} customerId - Customer ID
     * @param {string} scope - Access scope
     * @returns {Object} { token, url }
     */
    generatePortalLink(customerId, scope = 'full') {
        try {
            const tokenRecord = this.generateAccessToken(customerId, scope);
            const baseUrl = window.location.origin;
            const url = `${baseUrl}/customer-portal.html?token=${tokenRecord.token}`;

            return {
                token: tokenRecord.token,
                url,
                expiresAt: tokenRecord.expiresAt
            };
        } catch (error) {
            console.error('Portal link generation error:', error);
            throw error;
        }
    }

    /**
     * Send a portal link to the customer via email.
     * @param {string} customerId - Customer ID
     * @param {string} email - Customer email
     * @param {string} scope - Access scope
     * @returns {Promise<Object>} { success, message }
     */
    async sendPortalLink(customerId, email, scope = 'full') {
        try {
            if (!email) {
                return { success: false, message: 'Keine E-Mail-Adresse angegeben' };
            }

            const link = this.generatePortalLink(customerId, scope);
            const companyInfo = this._getCompanyInfo();

            // Get customer name
            let customerName = 'Kunde';
            if (window.customerService) {
                const customer = window.customerService.getCustomer(customerId);
                if (customer) {
                    customerName = customer.name;
                }
            }

            const scopeLabels = {
                full: 'Ihr persönliches Kundenportal',
                quote: 'Angebotsfreigabe',
                invoice: 'Rechnungsübersicht und Zahlung'
            };

            const subject = `${companyInfo.name} - ${scopeLabels[scope] || 'Kundenportal'}`;
            const body = [
                `Sehr geehrte/r ${customerName},`,
                '',
                `über den folgenden Link erreichen Sie ${scopeLabels[scope] || 'Ihr Kundenportal'}:`,
                '',
                link.url,
                '',
                'Dieser Link ist 30 Tage gültig und nur für Sie bestimmt.',
                'Bitte geben Sie ihn nicht an Dritte weiter.',
                '',
                `Mit freundlichen Grüßen`,
                companyInfo.name,
                companyInfo.phone ? `Tel: ${companyInfo.phone}` : '',
                companyInfo.email ? `E-Mail: ${companyInfo.email}` : ''
            ].filter(Boolean).join('\n');

            // Try to send via email service
            if (window.communicationService) {
                window.communicationService.logMessage({
                    type: 'email',
                    direction: 'outbound',
                    from: companyInfo.email || companyInfo.name,
                    to: email,
                    subject: subject,
                    content: body,
                    customerId: customerId,
                    customerName: customerName,
                    status: 'sent'
                });
            }

            // Open mailto as fallback
            const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.open(mailtoUrl, '_blank');

            // Activity log
            if (window.storeService) {
                window.storeService.addActivity('📧', `Portal-Link an ${customerName} gesendet`);
            }

            return { success: true, message: 'Portal-Link wurde per E-Mail gesendet', link };
        } catch (error) {
            console.error('Send portal link error:', error);
            return { success: false, message: 'Fehler beim Senden des Portal-Links' };
        }
    }

    // ============================================
    // Cleanup & Maintenance
    // ============================================

    /**
     * Remove expired tokens from storage.
     * @returns {number} Number of removed tokens
     */
    cleanupExpiredTokens() {
        const now = new Date();
        const before = this.tokens.length;
        this.tokens = this.tokens.filter(t =>
            t.isActive && new Date(t.expiresAt) > now
        );
        const removed = before - this.tokens.length;
        if (removed > 0) {
            this._saveTokens();
        }
        return removed;
    }

    // ============================================
    // Helpers (Private)
    // ============================================

    /**
     * Generate a cryptographically random string.
     * @private
     */
    _generateRandomString(length) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';

        // Use crypto.getRandomValues if available for better randomness
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint8Array(length);
            crypto.getRandomValues(array);
            for (let i = 0; i < length; i++) {
                result += chars[array[i] % chars.length];
            }
        } else {
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        }

        return result;
    }

    /**
     * Format a number as Euro currency.
     * @private
     */
    _formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount || 0);
    }

    /**
     * Format an ISO date string to German locale.
     * @private
     */
    _formatDate(dateStr) {
        if (!dateStr) { return '-'; }
        return new Date(dateStr).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    // Persistence
    _saveTokens() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tokens));
    }

    _saveMessages() {
        localStorage.setItem(this.MESSAGES_KEY, JSON.stringify(this.portalMessages));
    }

    _saveSharedPhotos() {
        localStorage.setItem(this.SHARED_PHOTOS_KEY, JSON.stringify(this.sharedPhotoIds));
    }
}

window.customerPortalService = new CustomerPortalService();
