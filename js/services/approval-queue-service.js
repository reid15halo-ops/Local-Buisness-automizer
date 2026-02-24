/* ============================================
   Approval Queue Service
   The 5% human interaction layer
   FreyAI Visions - 95/5 Architecture
   
   Manages the queue of AI-prepared items that
   need human approval. Fetches from multiple
   sources: invoices, communications, dunning.
   Prioritizes items and presents them via the
   SwipeApproveComponent.
   
   This IS the 5% of the 95/5 architecture —
   the Handwerker only sees what AI couldn't
   decide autonomously.
   ============================================ */

class ApprovalQueueService {
    constructor() {
        /** @type {Object[]} In-memory approval queue */
        this._queue = [];
        /** @type {boolean} */
        this._loaded = false;
        /** @type {Function|null} */
        this._realtimeUnsub = null;
        /** @type {number} */
        this._badgeCount = 0;
        /** @type {Function[]} */
        this._listeners = [];

        // Subscribe to Supabase Realtime to auto-refresh queue on changes
        this._setupRealtimeListener();
    }

    // ========================================
    // Initialization & Realtime
    // ========================================

    _getUserId() {
        if (window.authService && window.authService.getUser()) {
            return window.authService.getUser().id;
        }
        if (window.userManager && window.userManager.getCurrentUser()) {
            return window.userManager.getCurrentUser().id;
        }
        return 'default';
    }

    _setupRealtimeListener() {
        if (!window.realtimeService) { return; }

        // Wait a tick for realtimeService to be ready
        setTimeout(() => {
            const userId = this._getUserId();
            if (!userId || userId === 'default') { return; }

            // Listen for invoice changes that might create new approval items
            this._realtimeUnsub = window.realtimeService.subscribeToInvoices(userId, (payload) => {
                const invoice = payload.new;
                if (invoice && invoice.status === 'pending_approval') {
                    // Refresh the queue
                    this.refresh();
                }
            });
        }, 1000);
    }

    /**
     * Refresh the queue from all sources.
     */
    async refresh() {
        await this.getPendingApprovals();
        this._notifyListeners();
    }

    // ========================================
    // Queue Fetching
    // ========================================

    /**
     * Get all items pending human approval, sorted by priority.
     * Priority order: dunning > invoice > communication
     * 
     * @returns {Promise<Object[]>} Array of approval items
     */
    async getPendingApprovals() {
        const [invoices, communications, dunningItems] = await Promise.all([
            this._getPendingInvoices(),
            this._getPendingCommunications(),
            this._getPendingDunning()
        ]);

        // Build unified approval items
        const items = [
            ...dunningItems.map(d => this._mapDunningToApproval(d)),
            ...invoices.map(inv => this._mapInvoiceToApproval(inv)),
            ...communications.map(comm => this._mapCommunicationToApproval(comm))
        ];

        // Sort: dunning first, then by created_at desc
        items.sort((a, b) => {
            const priorityOrder = { dunning: 0, invoice: 1, email: 2, communication: 2 };
            const pa = priorityOrder[a.type] ?? 9;
            const pb = priorityOrder[b.type] ?? 9;
            if (pa !== pb) { return pa - pb; }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        this._queue = items;
        this._loaded = true;
        this._updateBadge(items.length);

        return items;
    }

    async _getPendingInvoices() {
        try {
            // Try Supabase first
            if (window.dbService) {
                return await window.dbService.getInvoices({ status: 'pending_approval' });
            }
        } catch (err) {
            console.warn('[ApprovalQueue] Error fetching pending invoices:', err);
        }

        // Fallback: scan storeService
        const rechnungen = window.storeService?.state?.rechnungen || [];
        return rechnungen.filter(r => r.status === 'pending_approval');
    }

    async _getPendingCommunications() {
        try {
            // Try Supabase
            const supabase = window.supabaseClient?.client;
            const userId = this._getUserId();

            if (supabase && window.supabaseClient?.isConfigured()) {
                const { data, error } = await supabase
                    .from('communications')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('status', 'draft')
                    .order('created_at', { ascending: false });

                if (!error) { return data || []; }
            }
        } catch (err) {
            console.warn('[ApprovalQueue] Error fetching pending communications:', err);
        }

        // Fallback: localStorage (communicationService)
        try {
            const comms = JSON.parse(localStorage.getItem('freyai_communications') || '[]');
            return comms.filter(c => c.status === 'draft' && c.aiGenerated);
        } catch (e) {
            console.error('[ApprovalQueueService] Error:', e);
            return [];
        }
    }

    async _getPendingDunning() {
        try {
            // Try Supabase
            const supabase = window.supabaseClient?.client;
            const userId = this._getUserId();

            if (supabase && window.supabaseClient?.isConfigured()) {
                const { data, error } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('status', 'action_required_dunning')
                    .order('created_at', { ascending: false });

                if (!error) { return data || []; }
            }
        } catch (err) {
            console.warn('[ApprovalQueue] Error fetching dunning items:', err);
        }

        // Fallback: use dunningService if available
        if (window.dunningService) {
            try {
                const rechnungen = window.storeService?.state?.rechnungen || [];
                const heute = new Date();
                return rechnungen.filter(r => {
                    if (r.status === 'bezahlt' || r.status === 'storniert') { return false; }
                    const tageOffen = Math.floor(
                        (heute - new Date(r.createdAt || r.datum)) / (1000 * 60 * 60 * 24)
                    );
                    return tageOffen >= 28 && r.status !== 'bezahlt'; // 28+ days overdue
                }).map(r => ({ ...r, status: 'action_required_dunning' }));
            } catch (e) { console.error('[ApprovalQueueService] Error:', e); return []; }
        }

        return [];
    }

    // ========================================
    // Data Mappers
    // ========================================

    _mapInvoiceToApproval(invoice) {
        const betrag = invoice.brutto || invoice.total_amount || 0;
        const kundenName = invoice.kunde?.name || invoice.customer_name || 'Unbekannter Kunde';
        const nummer = invoice.nummer || invoice.invoice_number || invoice.id?.substring(0, 8);

        return {
            id: `approval-invoice-${invoice.id}`,
            type: 'invoice',
            title: `Rechnung ${nummer}`,
            summary: `${kundenName} — ${betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`,
            data: invoice,
            confidence: invoice.ai_confidence || invoice.confidence || 0.85,
            jobId: invoice.job_id || null,
            priority: 2,
            createdAt: invoice.created_at || invoice.createdAt || new Date().toISOString(),
            actions: {
                approve: 'Rechnung freigeben & versenden',
                reject: 'Abweichungen korrigieren',
                escalate: 'Zur manuellen Prüfung markieren'
            },
            details: [
                { label: 'Betrag', value: betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) },
                { label: 'Kunde', value: kundenName },
                { label: 'Rechnungsnr.', value: nummer || '—' },
                { label: 'Positionen', value: `${(invoice.positionen || invoice.items || []).length} Pos.` },
                { label: 'KI-Konfidenz', value: `${Math.round((invoice.ai_confidence || 0.85) * 100)}%` }
            ]
        };
    }

    _mapCommunicationToApproval(comm) {
        const empfaenger = comm.to || comm.customer_email || comm.empfaenger || 'Unbekannt';
        const betreff = comm.subject || comm.betreff || 'Ohne Betreff';

        return {
            id: `approval-comm-${comm.id}`,
            type: 'email',
            title: `E-Mail Entwurf`,
            summary: `An: ${empfaenger} — ${betreff}`,
            data: comm,
            confidence: comm.ai_confidence || comm.confidence || 0.80,
            jobId: comm.job_id || null,
            priority: 3,
            createdAt: comm.created_at || comm.createdAt || new Date().toISOString(),
            actions: {
                approve: 'E-Mail jetzt senden',
                reject: 'Entwurf verwerfen',
                escalate: 'Manuell bearbeiten'
            },
            details: [
                { label: 'An', value: empfaenger },
                { label: 'Betreff', value: betreff },
                { label: 'Inhalt', value: (comm.body || comm.content || '').substring(0, 100) + '...' },
                { label: 'KI-Konfidenz', value: `${Math.round((comm.ai_confidence || 0.80) * 100)}%` }
            ]
        };
    }

    _mapDunningToApproval(item) {
        const betrag = item.brutto || item.total_amount || 0;
        const kundenName = item.kunde?.name || item.customer_name || 'Unbekannter Kunde';
        const tageOffen = item.days_overdue || Math.floor(
            (new Date() - new Date(item.createdAt || item.created_at)) / (1000 * 60 * 60 * 24)
        );

        return {
            id: `approval-dunning-${item.id}`,
            type: 'dunning',
            title: `Mahnung erforderlich`,
            summary: `${kundenName} — ${betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} (${tageOffen} Tage offen)`,
            data: item,
            confidence: 0.95, // Dunning decisions have high confidence
            jobId: item.job_id || null,
            priority: 1, // Highest priority
            createdAt: item.created_at || item.createdAt || new Date().toISOString(),
            actions: {
                approve: 'Mahnung jetzt senden',
                reject: 'Vorerst nicht mahnen',
                escalate: 'An Inkasso übergeben'
            },
            details: [
                { label: 'Betrag', value: betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) },
                { label: 'Kunde', value: kundenName },
                { label: 'Tage offen', value: `${tageOffen} Tage` },
                { label: 'Empfehlung', value: tageOffen > 56 ? 'Inkasso' : tageOffen > 42 ? '3. Mahnung' : '2. Mahnung' },
                { label: 'KI-Konfidenz', value: '95%' }
            ]
        };
    }

    // ========================================
    // Approval Processing
    // ========================================

    /**
     * Show the next pending approval in the SwipeApproveComponent.
     * @returns {Promise<void>}
     */
    async processNextApproval() {
        if (!this._loaded) {
            await this.getPendingApprovals();
        }

        if (this._queue.length === 0) {
            this._showEmptyState();
            return;
        }

        const next = this._queue[0];
        if (window.swipeApproveComponent) {
            window.swipeApproveComponent.show(next);
        } else {
            console.warn('[ApprovalQueue] SwipeApproveComponent not available.');
        }
    }

    /**
     * Process all approvals one by one.
     */
    async processAll() {
        if (!this._loaded) {
            await this.getPendingApprovals();
        }
        await this.processNextApproval();
    }

    /**
     * Called when a card is approved.
     * @param {Object} card - The approval card data
     */
    async onItemApproved(card) {
        try {
            switch (card.type) {
                case 'invoice':
                    await this._approveInvoice(card);
                    break;
                case 'email':
                    await this._approveEmail(card);
                    break;
                case 'dunning':
                    await this._approveDunning(card);
                    break;
                default:
                    console.warn('[ApprovalQueue] Unknown card type:', card.type);
            }

            // Remove from queue
            this._removeFromQueue(card.id);
            this._notifyListeners();

            // Show next item if any remain
            if (this._queue.length > 0) {
                setTimeout(() => this.processNextApproval(), 500);
            }

        } catch (err) {
            console.error('[ApprovalQueue] onItemApproved error:', err);
            if (window.errorHandler) {
                window.errorHandler.error('Freigabe fehlgeschlagen: ' + err.message);
            }
        }
    }

    /**
     * Called when a card is rejected.
     * @param {Object} card
     */
    async onItemRejected(card) {
        try {
            switch (card.type) {
                case 'invoice':
                    await window.dbService.updateInvoiceStatus(card.data.id, 'draft', {
                        rejection_reason: 'Vom Benutzer abgelehnt',
                        rejected_at: new Date().toISOString()
                    });
                    break;
                case 'email':
                    await this._rejectEmail(card);
                    break;
                case 'dunning':
                    await this._skipDunning(card);
                    break;
            }

            this._removeFromQueue(card.id);
            this._notifyListeners();

            if (this._queue.length > 0) {
                setTimeout(() => this.processNextApproval(), 500);
            }

        } catch (err) {
            console.error('[ApprovalQueue] onItemRejected error:', err);
        }
    }

    /**
     * Called when a card is escalated for manual review.
     * @param {Object} card
     */
    async onItemEscalated(card) {
        try {
            // Mark as escalated in the data source
            const escalateData = {
                escalated: true,
                escalated_at: new Date().toISOString(),
                escalated_by: this._getUserId()
            };

            if (card.type === 'invoice') {
                await window.dbService.updateInvoiceStatus(card.data.id, 'escalated', escalateData);
            } else if (card.type === 'dunning') {
                await window.dbService.updateInvoiceStatus(card.data.id, 'escalated_dunning', escalateData);
            }

            // Also create an activity log entry
            if (window.storeService) {
                window.storeService.addActivity('⚠️', `${card.title} zur manuellen Prüfung eskaliert`);
            }

            this._removeFromQueue(card.id);
            this._notifyListeners();

            if (this._queue.length > 0) {
                setTimeout(() => this.processNextApproval(), 500);
            }

        } catch (err) {
            console.error('[ApprovalQueue] onItemEscalated error:', err);
        }
    }

    // ========================================
    // Action Implementations
    // ========================================

    async _approveInvoice(card) {
        const invoice = card.data;

        // 1. Update status to 'approved' (triggers bank sync job in backend)
        await window.dbService.updateInvoiceStatus(invoice.id, 'approved', {
            approved_at: new Date().toISOString(),
            approved_by: this._getUserId()
        });

        // 2. Also update storeService rechnungen
        if (window.storeService) {
            const r = window.storeService.state.rechnungen.find(r => r.id === invoice.id);
            if (r) {
                r.status = 'approved';
                r.approvedAt = new Date().toISOString();
                window.storeService.save();
            }
        }

        // 3. Submit PDF generation job
        if (window.jobQueueService) {
            window.jobQueueService.submitInvoicePDFGeneration(invoice.id).catch(e => {
                console.warn('[ApprovalQueue] PDF generation job failed:', e);
            });
        }

        // 4. Activity log
        if (window.storeService) {
            const betrag = (invoice.brutto || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
            window.storeService.addActivity('✅', `Rechnung ${invoice.nummer || invoice.id} freigegeben (${betrag})`);
        }

        // 5. Toast notification
        this._showToast(`Rechnung ${invoice.nummer || ''} freigegeben`, 'success');
    }

    async _approveEmail(card) {
        const comm = card.data;

        // Update communication status to 'sent'
        const supabase = window.supabaseClient?.client;
        if (supabase && window.supabaseClient?.isConfigured()) {
            await supabase
                .from('communications')
                .update({
                    status: 'sent',
                    sent_at: new Date().toISOString()
                })
                .eq('id', comm.id);
        } else {
            // Update localStorage
            try {
                const comms = JSON.parse(localStorage.getItem('freyai_communications') || '[]');
                const idx = comms.findIndex(c => c.id === comm.id);
                if (idx !== -1) {
                    comms[idx].status = 'sent';
                    comms[idx].sentAt = new Date().toISOString();
                    localStorage.setItem('freyai_communications', JSON.stringify(comms));
                }
            } catch (e) {
                console.error('[ApprovalQueueService] Unhandled error:', e);
            }
        }

        // Submit send job to backend
        if (window.jobQueueService) {
            window.jobQueueService.submitJob('email_send', {
                communication_id: comm.id,
                to: comm.to || comm.empfaenger,
                subject: comm.subject || comm.betreff,
                body: comm.body || comm.content
            }).catch(e => console.warn('[ApprovalQueue] Email send job failed:', e));
        }

        this._showToast('E-Mail wird gesendet', 'success');
    }

    async _approveDunning(card) {
        const invoice = card.data;
        const tageOffen = Math.floor(
            (new Date() - new Date(invoice.createdAt || invoice.created_at)) / (1000 * 60 * 60 * 24)
        );

        // Determine dunning level
        let dunningLevel = 'mahnung1';
        if (tageOffen > 56) { dunningLevel = 'mahnung3'; }
        else if (tageOffen > 42) { dunningLevel = 'mahnung2'; }

        // Submit dunning send job
        if (window.jobQueueService) {
            window.jobQueueService.submitJob('dunning_send', {
                invoice_id: invoice.id,
                dunning_level: dunningLevel,
                customer_email: invoice.kunde?.email || invoice.customer_email,
                amount: invoice.brutto || 0
            }).catch(e => console.warn('[ApprovalQueue] Dunning send job failed:', e));
        }

        // Update invoice status
        await window.dbService.updateInvoiceStatus(invoice.id, 'dunning_sent', {
            dunning_level: dunningLevel,
            dunning_sent_at: new Date().toISOString()
        });

        // Activity
        if (window.storeService) {
            window.storeService.addActivity('📨', `Mahnung gesendet an ${invoice.kunde?.name || 'Kunde'}`);
        }

        this._showToast('Mahnung wird gesendet', 'success');
    }

    async _rejectEmail(card) {
        const comm = card.data;

        try {
            const supabase = window.supabaseClient?.client;
            if (supabase && window.supabaseClient?.isConfigured()) {
                await supabase
                    .from('communications')
                    .update({ status: 'rejected', rejected_at: new Date().toISOString() })
                    .eq('id', comm.id);
            } else {
                const comms = JSON.parse(localStorage.getItem('freyai_communications') || '[]');
                const idx = comms.findIndex(c => c.id === comm.id);
                if (idx !== -1) {
                    comms[idx].status = 'rejected';
                    localStorage.setItem('freyai_communications', JSON.stringify(comms));
                }
            }
        } catch (e) {
            console.error('[ApprovalQueueService] Unhandled error:', e);
        }
    }

    async _skipDunning(card) {
        const invoice = card.data;
        await window.dbService.updateInvoiceStatus(invoice.id, 'dunning_skipped', {
            dunning_skipped_at: new Date().toISOString()
        });
    }

    // ========================================
    // Badge & UI
    // ========================================

    /**
     * Get the current queue item count.
     * @returns {number}
     */
    getQueueCount() {
        return this._queue.length;
    }

    /**
     * Update the sidebar badge with the current count.
     * @param {number} count
     */
    updateBadge(count = null) {
        const effectiveCount = count !== null ? count : this._queue.length;
        this._updateBadge(effectiveCount);
    }

    _updateBadge(count) {
        this._badgeCount = count;
        const badge = document.getElementById('approvals-badge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : String(count);
                badge.style.display = 'inline-flex';
                badge.classList.add('badge-pulse');
            } else {
                badge.textContent = '';
                badge.style.display = 'none';
                badge.classList.remove('badge-pulse');
            }
        }

        // Also update mobile notification badge if available
        const notifBadge = document.getElementById('notification-badge');
        if (notifBadge && count > 0) {
            const currentCount = parseInt(notifBadge.textContent || '0', 10);
            // Don't double-count, just show the approvals count separately
        }
    }

    _removeFromQueue(cardId) {
        this._queue = this._queue.filter(item => item.id !== cardId);
        this._updateBadge(this._queue.length);
    }

    _showEmptyState() {
        const container = document.getElementById('approvals-container');
        if (container) {
            container.innerHTML = `
                <div class="approval-empty-state">
                    <div class="approval-empty-icon">✅</div>
                    <h3>Alles erledigt!</h3>
                    <p>Keine ausstehenden Freigaben. Die KI hat alles vorbereitet.</p>
                    <p class="approval-empty-subtext">Neue Elemente erscheinen automatisch, sobald die KI sie vorbereitet hat.</p>
                </div>
            `;
        }
    }

    _showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else if (window.UI && typeof window.UI.showToast === 'function') {
            window.UI.showToast(message, type);
        } else {
            console.info(`[ApprovalQueue] ${type}: ${message}`);
        }
    }

    // ========================================
    // Subscription
    // ========================================

    /**
     * Register a listener for queue changes.
     * @param {Function} callback - Called with the current queue array
     * @returns {Function} Unsubscribe function
     */
    onChange(callback) {
        this._listeners.push(callback);
        return () => {
            this._listeners = this._listeners.filter(cb => cb !== callback);
        };
    }

    _notifyListeners() {
        this._listeners.forEach(cb => {
            try { cb(this._queue); } catch (e) {}
        });
    }

    /**
     * Render the approvals view container with current queue.
     */
    async renderApprovalsView() {
        const container = document.getElementById('approvals-container');
        if (!container) { return; }

        container.innerHTML = '<div class="loading-spinner-container"><div class="loading-spinner"></div><p>Freigaben werden geladen...</p></div>';

        await this.getPendingApprovals();

        if (this._queue.length === 0) {
            this._showEmptyState();
            return;
        }

        // Render queue cards list
        container.innerHTML = `
            <div class="approvals-queue-header">
                <span class="approvals-count">${this._queue.length} ausstehende Freigabe${this._queue.length !== 1 ? 'n' : ''}</span>
                <button class="btn btn-primary btn-sm" onclick="window.approvalQueueService.processAll()">
                    Jetzt prüfen ▶
                </button>
            </div>
            <div class="approvals-list">
                ${this._queue.map(item => this._renderQueueCard(item)).join('')}
            </div>
        `;
    }

    _renderQueueCard(item) {
        const confidence = Math.round((item.confidence || 0) * 100);
        const trafficLight = confidence >= 85 ? '🟢' : confidence >= 65 ? '🟡' : '🔴';
        const typeIcon = { invoice: '💰', email: '📧', dunning: '⚠️', communication: '📧' }[item.type] || '📋';
        const typeLabel = { invoice: 'Rechnung', email: 'E-Mail', dunning: 'Mahnung', communication: 'Kommunikation' }[item.type] || item.type;

        return `
            <div class="approval-card-item" onclick="window.approvalQueueService._showCard('${item.id}')">
                <div class="approval-card-icon">${typeIcon}</div>
                <div class="approval-card-content">
                    <div class="approval-card-title">${item.title}</div>
                    <div class="approval-card-summary">${item.summary}</div>
                    <div class="approval-card-meta">
                        <span class="approval-type-badge approval-type-${item.type}">${typeLabel}</span>
                        <span class="approval-confidence">${trafficLight} ${confidence}% Konfidenz</span>
                    </div>
                </div>
                <div class="approval-card-arrow">›</div>
            </div>
        `;
    }

    _showCard(cardId) {
        const card = this._queue.find(item => item.id === cardId);
        if (!card) { return; }
        if (window.swipeApproveComponent) {
            window.swipeApproveComponent.show(card);
        }
    }

    /**
     * Cleanup resources.
     */
    destroy() {
        if (this._realtimeUnsub) {
            try { this._realtimeUnsub(); } catch (e) {}
            this._realtimeUnsub = null;
        }
        this._listeners = [];
        this._queue = [];
    }
}

window.approvalQueueService = new ApprovalQueueService();
