/* ============================================
   Customer Portal Service (Feature #9)
   Self-service portal for customers:
   - Token-based access management
   - Quote approval / change requests
   - Invoice viewing & Stripe payment
   - Customer messaging
   - Photo sharing controls
   - Portal link generation & email dispatch
   Supabase-first — no localStorage
   ============================================ */

class CustomerPortalService {
    constructor() {
        this.tokens = [];
        this.portalMessages = [];
        this.sharedPhotos = {};
        this._ready = false;
        this._tenantId = 'a0000000-0000-0000-0000-000000000001';
    }

    // ============================================
    // Init & Supabase helpers
    // ============================================

    async init() {
        if (this._initialized) return;
        this._initialized = true;
        try {
            const { data } = await this._supabase()?.auth?.getUser() || {};
            this._userId = data?.user?.id || '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc';
        } catch {
            this._userId = '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc';
        }
        await this._loadAllFromSupabase();
        this._ready = true;
    }

    _supabase() {
        return window.supabaseClient?.client;
    }

    _isOnline() {
        return !!(this._supabase() && window.supabaseClient?.isConfigured());
    }

    async _loadAllFromSupabase() {
        if (!this._isOnline()) return;
        try {
            await Promise.all([
                this._loadTokens(),
                this._loadMessages(),
                this._loadSharedPhotos()
            ]);
        } catch (err) {
            console.warn('CustomerPortalService: Supabase load error', err);
        }
    }

    async _loadTokens() {
        try {
            const { data, error } = await this._supabase()
                .from('portal_tokens')
                .select('*')
                .eq('tenant_id', this._tenantId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            this.tokens = (data || []).map(r => this._tokenFromRow(r));
        } catch (err) {
            console.warn('CustomerPortalService: tokens load error', err);
            this.tokens = [];
        }
    }

    async _loadMessages() {
        try {
            const { data, error } = await this._supabase()
                .from('portal_messages')
                .select('*')
                .eq('tenant_id', this._tenantId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            this.portalMessages = (data || []).map(r => this._messageFromRow(r));
        } catch (err) {
            console.warn('CustomerPortalService: messages load error', err);
            this.portalMessages = [];
        }
    }

    async _loadSharedPhotos() {
        try {
            const { data, error } = await this._supabase()
                .from('portal_shared_photos')
                .select('*')
                .eq('tenant_id', this._tenantId);
            if (error) throw error;
            this.sharedPhotos = {};
            (data || []).forEach(r => {
                this.sharedPhotos[r.customer_id] = {
                    id: r.id,
                    photoIds: r.photo_ids || [],
                    sharedAt: r.shared_at
                };
            });
        } catch (err) {
            console.warn('CustomerPortalService: shared photos load error', err);
            this.sharedPhotos = {};
        }
    }

    // ============================================
    // Row conversion helpers
    // ============================================

    _tokenToRow(t) {
        return {
            id: t.id || undefined,
            customer_id: t.customerId,
            token: t.token,
            scope: t.scope,
            expires_at: t.expiresAt,
            active: t.isActive,
            tenant_id: this._tenantId
        };
    }

    _tokenFromRow(r) {
        return {
            id: r.id,
            token: r.token,
            customerId: r.customer_id,
            scope: r.scope,
            createdAt: r.created_at,
            expiresAt: r.expires_at,
            isActive: r.active
        };
    }

    _messageToRow(m) {
        return {
            id: m.id || undefined,
            customer_id: m.customerId,
            token_id: m.tokenId || null,
            sender: m.direction === 'inbound' ? 'customer' : 'business',
            text: m.content,
            read: !!m.readAt,
            tenant_id: this._tenantId
        };
    }

    _messageFromRow(r) {
        return {
            id: r.id,
            customerId: r.customer_id,
            tokenId: r.token_id,
            customerName: '',
            direction: r.sender === 'customer' ? 'inbound' : 'outbound',
            content: r.text,
            createdAt: r.created_at,
            readAt: r.read ? r.created_at : null,
            via: r.sender === 'customer' ? 'portal' : 'admin'
        };
    }

    // ============================================
    // Token Management
    // ============================================

    /**
     * Generate a unique access token for a customer.
     * @param {string} customerId - Customer ID
     * @param {string} scope - Access scope: 'full', 'quote', or 'invoice'
     * @param {Object} options - Optional settings (expiresInDays)
     * @returns {Promise<Object>} Token record
     */
    async generateAccessToken(customerId, scope = 'full', options = {}) {
        try {
            if (!customerId) {
                throw new Error('Customer ID ist erforderlich');
            }

            const validScopes = ['full', 'quote', 'invoice'];
            if (!validScopes.includes(scope)) {
                throw new Error(`Ungueltiger Scope: ${scope}. Erlaubt: ${validScopes.join(', ')}`);
            }

            const expiresInDays = options.expiresInDays || 30;
            const now = new Date();
            const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

            const token = 'cp-' + this._generateRandomString(32);

            const row = {
                customer_id: customerId,
                token,
                scope,
                expires_at: expiresAt.toISOString(),
                active: true,
                tenant_id: this._tenantId
            };

            const { data, error } = await this._supabase()
                .from('portal_tokens')
                .insert(row)
                .select()
                .single();

            if (error) throw error;

            const tokenRecord = this._tokenFromRow(data);
            this.tokens.push(tokenRecord);

            if (window.storeService) {
                window.storeService.addActivity('portal', `Portal-Zugang erstellt (${scope}) fuer Kunde`);
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
     * @returns {Promise<boolean>} Success
     */
    async revokeToken(token) {
        try {
            const record = this.tokens.find(t => t.token === token);
            if (!record) {
                return false;
            }

            const { error } = await this._supabase()
                .from('portal_tokens')
                .update({ active: false })
                .eq('id', record.id)
                .eq('tenant_id', this._tenantId);

            if (error) throw error;

            record.isActive = false;

            if (window.storeService) {
                window.storeService.addActivity('portal', 'Portal-Zugang widerrufen');
            }

            return true;
        } catch (error) {
            console.warn('Token revocation error:', error);
            return false;
        }
    }

    /**
     * Validate a token and return access details.
     * @param {string} token - The token string to validate
     * @returns {Promise<Object>} { valid, customer, scope, error }
     */
    async validateToken(token) {
        try {
            if (!token || typeof token !== 'string') {
                return { valid: false, error: 'Kein Token angegeben' };
            }

            // Always fetch fresh from Supabase for validation
            const { data: row, error } = await this._supabase()
                .from('portal_tokens')
                .select('*')
                .eq('token', token)
                .eq('tenant_id', this._tenantId)
                .single();

            if (error || !row) {
                return { valid: false, error: 'Ungueltiger Zugangslink' };
            }

            if (!row.active) {
                return { valid: false, error: 'Dieser Zugang wurde deaktiviert' };
            }

            const now = new Date();
            if (new Date(row.expires_at) < now) {
                return { valid: false, error: 'Dieser Zugangslink ist abgelaufen' };
            }

            // Look up customer
            let customer = null;
            if (window.customerService) {
                customer = window.customerService.getCustomer(row.customer_id);
            }

            if (!customer) {
                return { valid: false, error: 'Kundendaten nicht gefunden' };
            }

            return {
                valid: true,
                customer: {
                    id: customer.id,
                    name: customer.name,
                    firma: customer.firma || ''
                },
                scope: row.scope,
                customerId: row.customer_id,
                expiresAt: row.expires_at,
                tokenId: row.id
            };
        } catch (error) {
            console.warn('Token validation error:', error);
            return { valid: false, error: 'Technischer Fehler bei der Validierung' };
        }
    }

    /**
     * Get all active tokens for a customer.
     * @param {string} customerId - Customer ID
     * @returns {Promise<Array>} Active token records
     */
    async getActiveTokens(customerId) {
        try {
            const { data, error } = await this._supabase()
                .from('portal_tokens')
                .select('*')
                .eq('customer_id', customerId)
                .eq('active', true)
                .eq('tenant_id', this._tenantId)
                .gt('expires_at', new Date().toISOString());
            if (error) throw error;
            return (data || []).map(r => this._tokenFromRow(r));
        } catch (err) {
            console.warn('getActiveTokens error:', err);
            return [];
        }
    }

    /**
     * Get all tokens for a customer (including expired/revoked).
     * @param {string} customerId - Customer ID
     * @returns {Promise<Array>} All token records
     */
    async getAllTokens(customerId) {
        try {
            const { data, error } = await this._supabase()
                .from('portal_tokens')
                .select('*')
                .eq('customer_id', customerId)
                .eq('tenant_id', this._tenantId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map(r => this._tokenFromRow(r));
        } catch (err) {
            console.warn('getAllTokens error:', err);
            return [];
        }
    }

    // ============================================
    // Portal Data Access
    // ============================================

    /**
     * Get all portal data filtered by token scope.
     * This is the main method called by the portal page.
     * @param {string} token - Access token
     * @returns {Promise<Object|null>} Filtered portal data
     */
    async getPortalData(token) {
        try {
            const validation = await this.validateToken(token);
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

            // Get messages & shared photos in parallel
            if (scope === 'full') {
                const [messages, photos] = await Promise.all([
                    this.getMessages(token),
                    this.getSharedPhotos(token)
                ]);
                data.messages = messages;
                data.photos = photos;
            }

            // Build document list
            data.documents = this._buildDocumentList(data);

            return data;
        } catch (error) {
            console.warn('Portal data retrieval error:', error);
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
        const storeSettings = window.storeService?.state?.settings || {};

        return {
            name: storeSettings.companyName || 'Unser Unternehmen',
            phone: storeSettings.phone || '',
            email: storeSettings.email || '',
            address: storeSettings.address || '',
            logo: storeSettings.companyLogo || null
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
     * @returns {Promise<Object>} { success, message }
     */
    async approveQuote(token, quoteId, customerMessage = '') {
        try {
            const validation = await this.validateToken(token);
            if (!validation.valid) {
                return { success: false, message: validation.error };
            }

            if (validation.scope === 'invoice') {
                return { success: false, message: 'Dieser Zugang berechtigt nicht zur Angebotsfreigabe' };
            }

            const store = window.storeService?.state;
            if (!store) {
                return { success: false, message: 'Systemfehler: Store nicht verfuegbar' };
            }

            const angebot = (store.angebote || []).find(a => a.id === quoteId);
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
                await this.sendCustomerMessage(token, `Angebot ${quoteId} angenommen: ${customerMessage}`);
            }

            // Activity log
            window.storeService.addActivity(
                'check',
                `Angebot ${quoteId} vom Kunden ${validation.customer.name} online angenommen`
            );

            // Notification to business owner
            if (window.notificationService) {
                window.notificationService.sendNotification(
                    'Angebot angenommen!',
                    {
                        body: `${validation.customer.name} hat Angebot ${quoteId} ueber das Kundenportal angenommen.`,
                        tag: `quote-approved-${quoteId}`
                    }
                );
            }

            return { success: true, message: 'Angebot erfolgreich angenommen. Vielen Dank!' };
        } catch (error) {
            console.warn('Quote approval error:', error);
            return { success: false, message: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
        }
    }

    /**
     * Reject a quote via the customer portal.
     * @param {string} token - Access token
     * @param {string} quoteId - Angebot ID
     * @param {string} reason - Optional reason from customer
     * @returns {Promise<Object>} { success, message }
     */
    async rejectQuote(token, quoteId, reason = '') {
        try {
            const validation = await this.validateToken(token);
            if (!validation.valid) {
                return { success: false, message: validation.error };
            }

            if (validation.scope === 'invoice') {
                return { success: false, message: 'Dieser Zugang berechtigt nicht zur Angebotsverwaltung' };
            }

            const store = window.storeService?.state;
            if (!store) {
                return { success: false, message: 'Systemfehler: Store nicht verfuegbar' };
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
                await this.sendCustomerMessage(token, `Angebot ${quoteId} abgelehnt: ${reason}`);
            }

            window.storeService.addActivity(
                'cancel',
                `Angebot ${quoteId} vom Kunden ${validation.customer.name} ueber das Portal abgelehnt`
            );

            return { success: true, message: 'Angebot wurde abgelehnt. Wir melden uns bei Ihnen.' };
        } catch (error) {
            console.warn('Quote rejection error:', error);
            return { success: false, message: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' };
        }
    }

    /**
     * Request changes to a quote via the customer portal.
     * @param {string} token - Access token
     * @param {string} quoteId - Angebot ID
     * @param {string} changeRequest - Customer's change request
     * @returns {Promise<Object>} { success, message }
     */
    async requestQuoteChanges(token, quoteId, changeRequest) {
        try {
            const validation = await this.validateToken(token);
            if (!validation.valid) {
                return { success: false, message: validation.error };
            }

            if (!changeRequest || !changeRequest.trim()) {
                return { success: false, message: 'Bitte beschreiben Sie die gewuenschten Aenderungen' };
            }

            const sanitizedChangeRequest = changeRequest.trim().substring(0, 2000);

            const store = window.storeService?.state;
            if (!store) {
                return { success: false, message: 'Systemfehler' };
            }

            const angebot = (store.angebote || []).find(a => a.id === quoteId);
            if (!angebot) {
                return { success: false, message: 'Angebot nicht gefunden' };
            }

            // Store the change request
            if (!angebot.changeRequests) {
                angebot.changeRequests = [];
            }

            angebot.changeRequests.push({
                id: 'cr-' + Date.now(),
                message: sanitizedChangeRequest,
                createdAt: new Date().toISOString(),
                via: 'portal',
                customerName: validation.customer.name,
                status: 'offen'
            });

            angebot.status = 'aenderung-angefragt';
            window.storeService.save();

            // Log as portal message
            await this.sendCustomerMessage(
                token,
                `Aenderungswunsch zu Angebot ${quoteId}: ${sanitizedChangeRequest}`
            );

            // Activity + notification
            window.storeService.addActivity(
                'edit',
                `Aenderungswunsch von ${validation.customer.name} zu Angebot ${quoteId}`
            );

            if (window.notificationService) {
                window.notificationService.sendNotification(
                    'Aenderungswunsch eingegangen',
                    {
                        body: `${validation.customer.name} wuenscht Aenderungen an Angebot ${quoteId}.`,
                        tag: `quote-change-${quoteId}`
                    }
                );
            }

            return { success: true, message: 'Ihre Aenderungswuensche wurden uebermittelt. Wir melden uns bei Ihnen.' };
        } catch (error) {
            console.warn('Quote change request error:', error);
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
     * @returns {Promise<Object>} { success, message, messageId }
     */
    async sendCustomerMessage(token, message) {
        try {
            const validation = await this.validateToken(token);
            if (!validation.valid) {
                return { success: false, message: validation.error };
            }

            if (!message || !message.trim()) {
                return { success: false, message: 'Bitte geben Sie eine Nachricht ein' };
            }

            const sanitizedText = message.trim().substring(0, 2000);

            const row = {
                customer_id: validation.customerId,
                token_id: validation.tokenId || null,
                sender: 'customer',
                text: sanitizedText,
                read: false,
                tenant_id: this._tenantId
            };

            const { data, error } = await this._supabase()
                .from('portal_messages')
                .insert(row)
                .select()
                .single();

            if (error) throw error;

            const entry = this._messageFromRow(data);
            entry.customerName = validation.customer.name;
            this.portalMessages.push(entry);

            // Also log in communication service if available
            if (window.communicationService) {
                window.communicationService.logMessage({
                    type: 'portal',
                    direction: 'inbound',
                    from: validation.customer.name,
                    to: this._getCompanyInfo().name,
                    content: sanitizedText,
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
                        body: `${validation.customer.name}: ${sanitizedText.substring(0, 80)}`,
                        tag: `portal-msg-${entry.id}`
                    }
                );
            }

            return { success: true, message: 'Nachricht gesendet', messageId: entry.id };
        } catch (error) {
            console.warn('Customer message error:', error);
            return { success: false, message: 'Nachricht konnte nicht gesendet werden' };
        }
    }

    /**
     * Send a message from the business to the customer (admin-side).
     * @param {string} customerId - Customer ID
     * @param {string} message - Message text
     * @returns {Promise<Object>} { success, messageId }
     */
    async sendBusinessMessage(customerId, message) {
        try {
            if (!customerId) {
                return { success: false, message: 'Kunden-ID fehlt' };
            }
            if (!message || !message.trim()) {
                return { success: false, message: 'Nachricht darf nicht leer sein' };
            }

            const row = {
                customer_id: customerId,
                token_id: null,
                sender: 'business',
                text: message.trim().substring(0, 5000),
                read: false,
                tenant_id: this._tenantId
            };

            const { data, error } = await this._supabase()
                .from('portal_messages')
                .insert(row)
                .select()
                .single();

            if (error) throw error;

            const entry = this._messageFromRow(data);

            // Get customer name
            if (window.customerService) {
                const customer = window.customerService.getCustomer(customerId);
                if (customer) {
                    entry.customerName = customer.name;
                }
            }

            this.portalMessages.push(entry);

            return { success: true, messageId: entry.id };
        } catch (error) {
            console.warn('Business message error:', error);
            return { success: false, message: 'Fehler beim Senden' };
        }
    }

    /**
     * Get message history for a token (filtered by customer).
     * @param {string} token - Access token
     * @returns {Promise<Array>} Messages sorted by date
     */
    async getMessages(token) {
        try {
            // Find token record to get customer_id
            const { data: tokenRow, error: tErr } = await this._supabase()
                .from('portal_tokens')
                .select('customer_id')
                .eq('token', token)
                .eq('tenant_id', this._tenantId)
                .single();

            if (tErr || !tokenRow) return [];

            const { data, error } = await this._supabase()
                .from('portal_messages')
                .select('*')
                .eq('customer_id', tokenRow.customer_id)
                .eq('tenant_id', this._tenantId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return (data || []).map(r => this._messageFromRow(r));
        } catch (error) {
            console.warn('Get messages error:', error);
            return [];
        }
    }

    /**
     * Get message history by customer ID (admin-side).
     * @param {string} customerId - Customer ID
     * @returns {Promise<Array>} Messages sorted by date
     */
    async getMessagesByCustomer(customerId) {
        try {
            const { data, error } = await this._supabase()
                .from('portal_messages')
                .select('*')
                .eq('customer_id', customerId)
                .eq('tenant_id', this._tenantId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return (data || []).map(r => this._messageFromRow(r));
        } catch (err) {
            console.warn('getMessagesByCustomer error:', err);
            return [];
        }
    }

    /**
     * Get unread portal messages.
     * @returns {Promise<Array>} Unread inbound messages
     */
    async getUnreadMessages() {
        try {
            const { data, error } = await this._supabase()
                .from('portal_messages')
                .select('*')
                .eq('sender', 'customer')
                .eq('read', false)
                .eq('tenant_id', this._tenantId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return (data || []).map(r => this._messageFromRow(r));
        } catch (err) {
            console.warn('getUnreadMessages error:', err);
            return [];
        }
    }

    /**
     * Mark a message as read.
     * @param {string} messageId - Message ID
     * @returns {Promise<void>}
     */
    async markMessageRead(messageId) {
        try {
            const { error } = await this._supabase()
                .from('portal_messages')
                .update({ read: true })
                .eq('id', messageId)
                .eq('tenant_id', this._tenantId);

            if (error) throw error;

            // Update local cache
            const msg = this.portalMessages.find(m => m.id === messageId);
            if (msg) {
                msg.readAt = new Date().toISOString();
            }
        } catch (err) {
            console.warn('markMessageRead error:', err);
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
            const validation = await this.validateToken(token);
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

            const invoice = (store.rechnungen || []).find(r => r.id === invoiceId);
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
                error: 'Online-Zahlung ist derzeit nicht verfuegbar. Bitte ueberweisen Sie den Betrag.'
            };
        } catch (error) {
            console.warn('Payment link error:', error);
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
     * @returns {Promise<Object>} { success, sharedCount }
     */
    async sharePhotosWithCustomer(customerId, jobId, photoIds) {
        try {
            if (!customerId || !photoIds || !Array.isArray(photoIds)) {
                return { success: false, message: 'Ungueltige Parameter' };
            }

            // Check if a record already exists for this customer
            const { data: existing, error: selErr } = await this._supabase()
                .from('portal_shared_photos')
                .select('*')
                .eq('customer_id', customerId)
                .eq('tenant_id', this._tenantId)
                .single();

            if (selErr && selErr.code !== 'PGRST116') throw selErr; // PGRST116 = no rows

            let allPhotoIds;
            if (existing) {
                // Merge: add new IDs without duplicates
                const currentIds = existing.photo_ids || [];
                const mergedSet = new Set([...currentIds, ...photoIds]);
                allPhotoIds = [...mergedSet];

                const { error } = await this._supabase()
                    .from('portal_shared_photos')
                    .update({ photo_ids: allPhotoIds, shared_at: new Date().toISOString() })
                    .eq('id', existing.id)
                    .eq('tenant_id', this._tenantId);

                if (error) throw error;
            } else {
                allPhotoIds = [...new Set(photoIds)];

                const { error } = await this._supabase()
                    .from('portal_shared_photos')
                    .insert({
                        customer_id: customerId,
                        photo_ids: allPhotoIds,
                        shared_at: new Date().toISOString(),
                        tenant_id: this._tenantId
                    });

                if (error) throw error;
            }

            // Update local cache
            this.sharedPhotos[customerId] = {
                photoIds: allPhotoIds,
                sharedAt: new Date().toISOString()
            };

            if (window.storeService) {
                window.storeService.addActivity('photo', `${photoIds.length} Fotos mit Kunden geteilt`);
            }

            return { success: true, sharedCount: allPhotoIds.length };
        } catch (error) {
            console.warn('Photo sharing error:', error);
            return { success: false, message: 'Fehler beim Teilen der Fotos' };
        }
    }

    /**
     * Remove photo sharing for a specific photo.
     * @param {string} customerId - Customer ID
     * @param {string} jobId - Job reference ID
     * @param {string} photoId - Photo ID to unshare
     * @returns {Promise<void>}
     */
    async unsharePhoto(customerId, jobId, photoId) {
        try {
            const { data: existing, error: selErr } = await this._supabase()
                .from('portal_shared_photos')
                .select('*')
                .eq('customer_id', customerId)
                .eq('tenant_id', this._tenantId)
                .single();

            if (selErr || !existing) return;

            const updatedIds = (existing.photo_ids || []).filter(id => id !== photoId);

            const { error } = await this._supabase()
                .from('portal_shared_photos')
                .update({ photo_ids: updatedIds })
                .eq('id', existing.id)
                .eq('tenant_id', this._tenantId);

            if (error) throw error;

            // Update local cache
            if (this.sharedPhotos[customerId]) {
                this.sharedPhotos[customerId].photoIds = updatedIds;
            }
        } catch (err) {
            console.warn('unsharePhoto error:', err);
        }
    }

    /**
     * Get shared photos for a portal token.
     * @param {string} token - Access token
     * @returns {Promise<Array>} Shared photo objects
     */
    async getSharedPhotos(token) {
        try {
            const { data: tokenRow, error: tErr } = await this._supabase()
                .from('portal_tokens')
                .select('customer_id')
                .eq('token', token)
                .eq('tenant_id', this._tenantId)
                .single();

            if (tErr || !tokenRow) return [];

            const customerId = tokenRow.customer_id;

            const { data: photoRow, error: pErr } = await this._supabase()
                .from('portal_shared_photos')
                .select('*')
                .eq('customer_id', customerId)
                .eq('tenant_id', this._tenantId)
                .single();

            if (pErr || !photoRow) return [];

            const sharedIds = new Set(photoRow.photo_ids || []);
            const photos = [];

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
            console.warn('Get shared photos error:', error);
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
     * @returns {Promise<Object>} { token, url }
     */
    async generatePortalLink(customerId, scope = 'full') {
        try {
            const tokenRecord = await this.generateAccessToken(customerId, scope);
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

            const link = await this.generatePortalLink(customerId, scope);
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
                full: 'Ihr persoenliches Kundenportal',
                quote: 'Angebotsfreigabe',
                invoice: 'Rechnungsuebersicht und Zahlung'
            };

            const subject = `${companyInfo.name} - ${scopeLabels[scope] || 'Kundenportal'}`;
            const body = [
                `Sehr geehrte/r ${customerName},`,
                '',
                `ueber den folgenden Link erreichen Sie ${scopeLabels[scope] || 'Ihr Kundenportal'}:`,
                '',
                link.url,
                '',
                'Dieser Link ist 30 Tage gueltig und nur fuer Sie bestimmt.',
                'Bitte geben Sie ihn nicht an Dritte weiter.',
                '',
                `Mit freundlichen Gruessen`,
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
                window.storeService.addActivity('email', `Portal-Link an ${customerName} gesendet`);
            }

            return { success: true, message: 'Portal-Link wurde per E-Mail gesendet', link };
        } catch (error) {
            console.warn('Send portal link error:', error);
            return { success: false, message: 'Fehler beim Senden des Portal-Links' };
        }
    }

    // ============================================
    // Cleanup & Maintenance
    // ============================================

    /**
     * Remove expired tokens from storage.
     * @returns {Promise<number>} Number of removed tokens
     */
    async cleanupExpiredTokens() {
        try {
            const now = new Date().toISOString();

            const { data, error } = await this._supabase()
                .from('portal_tokens')
                .delete()
                .eq('tenant_id', this._tenantId)
                .or(`active.eq.false,expires_at.lt.${now}`)
                .select();

            if (error) throw error;

            const removed = (data || []).length;

            // Refresh local cache
            if (removed > 0) {
                await this._loadTokens();
            }

            return removed;
        } catch (err) {
            console.warn('cleanupExpiredTokens error:', err);
            return 0;
        }
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
            throw new Error('crypto.getRandomValues is required for secure token generation');
        }

        return result;
    }

    /**
     * Format a number as Euro currency.
     * @private
     */
    _formatCurrency(amount) {
        return window.formatCurrency(amount);
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
}

// Instantiate and auto-init when Supabase is ready
window.customerPortalService = new CustomerPortalService();
if (window.supabaseClient?.isConfigured()) {
    window.customerPortalService.init().catch(e => console.warn('CustomerPortalService init error:', e));
} else {
    window.addEventListener('supabase-ready', () => {
        window.customerPortalService.init().catch(e => console.warn('CustomerPortalService init error:', e));
    }, { once: true });
}
