/* ============================================
   Banking Integration Service (GoCardless Open Banking)
   Auto-import transactions, match to invoices
   Supports: GoCardless Bank Account Data API (formerly Nordigen)
   Fallback: Demo mode when no API credentials configured
   ============================================ */

class BankingService {
    // Match confidence tiers
    static CONFIDENCE = {
        REFERENCE_MATCH: 0.95,   // Verwendungszweck contains invoice number
        AMOUNT_AND_NAME: 0.85,   // Amount exact + customer name partial match
        AMOUNT_FUZZY: 0.70       // Amount within +/-1% tolerance
    };

    constructor() {
        this.accounts = StorageUtils.getJSON('freyai_bank_accounts', [], { financial: true, service: 'bankingService' });
        this.transactions = StorageUtils.getJSON('freyai_bank_transactions', [], { financial: true, service: 'bankingService' });
        this.matchedPayments = StorageUtils.getJSON('freyai_matched_payments', [], { financial: true, service: 'bankingService' });
        this.settings = StorageUtils.getJSON('freyai_banking_settings', {}, { financial: true, service: 'bankingService' });

        // Demo bank data (fallback)
        this.demoBanks = [
            { blz: '50010517', name: 'ING-DiBa', bic: 'INGDDEFFXXX' },
            { blz: '37040044', name: 'Commerzbank', bic: 'COBADEFFXXX' },
            { blz: '50070010', name: 'Deutsche Bank', bic: 'DEUTDEFFXXX' },
            { blz: '70150000', name: 'Stadtsparkasse München', bic: 'SSKMDEMMXXX' },
            { blz: '50050201', name: 'Frankfurter Sparkasse', bic: 'HELODEF1822' }
        ];
    }

    // ============================================
    // Mode Detection
    // ============================================

    /**
     * Check if GoCardless is available (Supabase configured = Edge Function reachable)
     * Credentials are now stored server-side as Supabase env vars, never in the browser.
     */
    isLiveMode() {
        // Live mode requires Supabase to be configured (Edge Function proxy handles credentials)
        const config = window.supabaseConfig;
        return !!(config?.isConfigured?.());
    }

    // ============================================
    // GoCardless Server-Side Proxy
    // ============================================

    /**
     * Make request to GoCardless via the gocardless-proxy Edge Function.
     * All credentials (secret_id, secret_key) stay server-side.
     * Auth + token refresh handled by the Edge Function.
     */
    async _gcRequest(method, path, body = null) {
        const config = window.supabaseConfig;
        if (!config?.isConfigured?.()) {
            throw new Error('[BankingService] Supabase nicht konfiguriert -- GoCardless-Proxy nicht erreichbar');
        }

        const cfg = config.get();
        const session = await window.authService?.getSession();
        if (!session?.access_token) {
            throw new Error('[BankingService] Nicht authentifiziert');
        }

        const response = await fetch(`${cfg.url}/functions/v1/gocardless-proxy`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': cfg.anonKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ method, path, body }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`GoCardless API error (${response.status} ${method} ${path}): ${errorBody}`);
        }

        return response.json();
    }

    // ============================================
    // GoCardless Institution & Requisition Flow
    // ============================================

    /**
     * List available banks/institutions for a country
     * @param {string} country - ISO 3166-1 alpha-2 (default: 'DE')
     * @returns {Array} List of institutions with id, name, logo, bic, countries
     */
    async listInstitutions(country = 'DE') {
        if (!this.isLiveMode()) {
            return this.demoBanks.map(b => ({
                id: `DEMO_${b.blz}`,
                name: b.name,
                bic: b.bic,
                logo: null,
                countries: ['DE']
            }));
        }

        const data = await this._gcRequest('GET', `/institutions/?country=${country}`);
        return data;
    }

    /**
     * Initiate bank connection via GoCardless requisition flow
     * Creates an end-user agreement + requisition, returns redirect link
     * @param {string} institutionId - GoCardless institution ID (e.g. 'SPARKASSE_FINTS_DE')
     * @returns {Object} { requisitionId, link } - redirect user to link for bank auth
     */
    async connectBank(institutionIdOrBankData) {
        // If not in live mode, fall back to demo
        if (!this.isLiveMode()) {
            return this._connectBankDemo(institutionIdOrBankData);
        }

        const institutionId = typeof institutionIdOrBankData === 'string'
            ? institutionIdOrBankData
            : institutionIdOrBankData.institutionId;

        if (!institutionId) {
            throw new Error('institutionId is required for GoCardless bank connection');
        }

        try {
            // Step 1: Create end-user agreement (90 days access, 90 days history)
            const agreement = await this._gcRequest('POST', '/agreements/enduser/', {
                institution_id: institutionId,
                max_historical_days: 90,
                access_valid_for_days: 90,
                access_scope: ['balances', 'details', 'transactions']
            });

            // Step 2: Create requisition with redirect
            const redirectUrl = window.location.origin + '/banking-callback.html';
            const requisition = await this._gcRequest('POST', '/requisitions/', {
                redirect: redirectUrl,
                institution_id: institutionId,
                agreement: agreement.id,
                user_language: 'DE'
            });

            // Store requisition for later retrieval
            const pendingConnection = {
                requisitionId: requisition.id,
                institutionId: institutionId,
                agreementId: agreement.id,
                status: 'pending',
                link: requisition.link,
                createdAt: new Date().toISOString()
            };

            this.settings.pendingRequisitions = this.settings.pendingRequisitions || [];
            this.settings.pendingRequisitions.push(pendingConnection);
            this._saveSettings();

            console.log('[BankingService] Bank connection initiated, redirect to:', requisition.link);

            return {
                success: true,
                requisitionId: requisition.id,
                link: requisition.link
            };
        } catch (err) {
            console.error('[BankingService] connectBank error:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Complete bank connection after user returns from bank auth
     * Call this from the banking-callback page
     * @param {string} requisitionId - The requisition ID from the redirect URL params
     */
    async completeBankConnection(requisitionId) {
        if (!this.isLiveMode()) {
            return { success: false, error: 'Not in live mode' };
        }

        try {
            // Fetch requisition status
            const requisition = await this._gcRequest('GET', `/requisitions/${requisitionId}/`);

            if (requisition.status !== 'LN') {
                // LN = linked (success). Other statuses: CR=created, GC=giving_consent, UA=undergoing_auth, etc.
                return { success: false, error: `Requisition status: ${requisition.status}`, status: requisition.status };
            }

            // Requisition linked -- extract account IDs
            const accountIds = requisition.accounts || [];
            const connectedAccounts = [];

            for (const gcAccountId of accountIds) {
                // Fetch account details
                const details = await this._gcRequest('GET', `/accounts/${gcAccountId}/details/`);
                const balances = await this._gcRequest('GET', `/accounts/${gcAccountId}/balances/`);

                const accountDetail = details.account || {};
                const balanceData = (balances.balances || [])[0] || {};

                const account = {
                    id: gcAccountId,
                    gcAccountId: gcAccountId,
                    requisitionId: requisitionId,
                    bankName: accountDetail.ownerName || requisition.institution_id,
                    iban: accountDetail.iban || '',
                    bic: accountDetail.bic || '',
                    accountHolder: accountDetail.ownerName || '',
                    currency: accountDetail.currency || 'EUR',
                    lastSync: null,
                    balance: parseFloat(balanceData.balanceAmount?.amount || 0),
                    status: 'connected',
                    source: 'gocardless',
                    createdAt: new Date().toISOString()
                };

                this.accounts.push(account);
                connectedAccounts.push(account);
            }

            // Remove from pending
            if (this.settings.pendingRequisitions) {
                this.settings.pendingRequisitions = this.settings.pendingRequisitions.filter(
                    r => r.requisitionId !== requisitionId
                );
            }

            this.saveAccounts();
            this._saveSettings();

            // Initial transaction sync
            for (const acc of connectedAccounts) {
                await this.fetchTransactions(acc.id);
            }

            return { success: true, accounts: connectedAccounts };
        } catch (err) {
            console.error('[BankingService] completeBankConnection error:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ============================================
    // Transaction Fetching
    // ============================================

    /**
     * Fetch transactions for an account
     * In live mode: calls GoCardless API
     * In demo mode: generates random transactions
     * @param {string} accountId - Account ID (GoCardless account UUID or local demo ID)
     * @param {Object} dateRange - { fromDate: 'YYYY-MM-DD', toDate: 'YYYY-MM-DD' }
     */
    async fetchTransactions(accountId, dateRange = {}) {
        const account = this.accounts.find(a => a.id === accountId);
        if (!account) { return { success: false, error: 'Account not found' }; }

        // Live mode: GoCardless API
        if (this.isLiveMode() && account.source === 'gocardless') {
            return this._fetchTransactionsLive(account, dateRange);
        }

        // Demo mode: Generate random transactions
        const newTransactions = this.generateRandomTransactions(accountId, 5);
        this.transactions.push(...newTransactions);

        account.lastSync = new Date().toISOString();
        account.balance = this.calculateBalance(accountId);

        this.saveAccounts();
        this.saveTransactions();

        return {
            success: true,
            transactions: newTransactions,
            balance: account.balance
        };
    }

    /**
     * Fetch real transactions from GoCardless API
     * GET /api/v2/accounts/{id}/transactions/?date_from=...&date_to=...
     */
    async _fetchTransactionsLive(account, dateRange = {}) {
        try {
            const fromDate = dateRange.fromDate || new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const toDate = dateRange.toDate || new Date().toISOString().split('T')[0];

            const queryParams = `?date_from=${fromDate}&date_to=${toDate}`;
            const data = await this._gcRequest('GET', `/accounts/${account.gcAccountId}/transactions/${queryParams}`);

            const bookedTxs = data.transactions?.booked || [];
            const pendingTxs = data.transactions?.pending || [];

            // Normalize GoCardless transaction format to internal format
            const newTransactions = [];

            for (const gcTx of [...bookedTxs, ...pendingTxs]) {
                const txId = gcTx.transactionId || gcTx.internalTransactionId || `gc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

                // Skip duplicates
                if (this.transactions.some(t => t.externalId === txId)) {
                    continue;
                }

                const amount = parseFloat(gcTx.transactionAmount?.amount || 0);
                const isPending = pendingTxs.includes(gcTx);

                const tx = {
                    id: crypto?.randomUUID ? `tx-${crypto.randomUUID()}` : 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
                    externalId: txId,
                    accountId: account.id,
                    date: gcTx.bookingDate || gcTx.valueDate || new Date().toISOString().split('T')[0],
                    valueDate: gcTx.valueDate || gcTx.bookingDate || new Date().toISOString().split('T')[0],
                    amount: amount,
                    currency: gcTx.transactionAmount?.currency || 'EUR',
                    type: amount >= 0 ? 'credit' : 'debit',
                    name: gcTx.creditorName || gcTx.debtorName || '',
                    iban: gcTx.creditorAccount?.iban || gcTx.debtorAccount?.iban || '',
                    purpose: gcTx.remittanceInformationUnstructured || gcTx.remittanceInformationStructured || '',
                    reference: gcTx.endToEndId || '',
                    category: null,
                    matched: false,
                    matchedTo: null,
                    matchConfidence: null,
                    matchMethod: null,
                    status: isPending ? 'pending' : 'booked',
                    source: 'gocardless',
                    createdAt: new Date().toISOString()
                };

                // Auto-categorize
                tx.category = this.categorizeTransaction(tx);

                newTransactions.push(tx);
            }

            this.transactions.push(...newTransactions);

            // Update account
            account.lastSync = new Date().toISOString();

            // Refresh balance
            try {
                const balances = await this._gcRequest('GET', `/accounts/${account.gcAccountId}/balances/`);
                const balanceData = (balances.balances || [])[0] || {};
                account.balance = parseFloat(balanceData.balanceAmount?.amount || 0);
            } catch (balErr) {
                console.warn('[BankingService] Balance fetch failed, computing locally:', balErr.message);
                account.balance = this.calculateBalance(account.id);
            }

            this.saveAccounts();
            this.saveTransactions();

            // Auto-match after import
            const matchResult = await this.autoMatchInvoices();

            console.log(`[BankingService] Synced ${newTransactions.length} transactions, matched ${matchResult.matched}`);

            return {
                success: true,
                transactions: newTransactions,
                balance: account.balance,
                matched: matchResult.matched,
                source: 'gocardless'
            };
        } catch (err) {
            console.error('[BankingService] Live transaction fetch error:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Sync all connected accounts (daily sync method)
     * Called by n8n workflow or manual trigger
     * Fetches last 2 days of transactions for each account
     */
    async syncTransactions() {
        const results = {
            success: true,
            accountsSynced: 0,
            totalNewTransactions: 0,
            totalMatched: 0,
            errors: []
        };

        const fromDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = new Date().toISOString().split('T')[0];

        for (const account of this.accounts) {
            try {
                const result = await this.fetchTransactions(account.id, { fromDate, toDate });
                if (result.success) {
                    results.accountsSynced++;
                    results.totalNewTransactions += (result.transactions || []).length;
                    results.totalMatched += (result.matched || 0);
                } else {
                    results.errors.push({ accountId: account.id, error: result.error });
                }
            } catch (err) {
                results.errors.push({ accountId: account.id, error: err.message });
            }
        }

        if (results.errors.length > 0) {
            results.success = results.accountsSynced > 0; // partial success
        }

        console.log(`[BankingService] syncTransactions complete:`, results);
        return results;
    }

    // ============================================
    // Demo Mode (Fallback)
    // ============================================

    /**
     * Connect a bank account in demo mode
     */
    async _connectBankDemo(bankData) {
        const account = {
            id: 'acc-' + Date.now(),
            bankName: bankData.bankName || bankData.name || 'Demo Bank',
            blz: bankData.blz || '',
            iban: bankData.iban || '',
            bic: bankData.bic || '',
            accountHolder: bankData.accountHolder || '',
            lastSync: null,
            balance: 0,
            status: 'connected',
            source: 'demo',
            createdAt: new Date().toISOString()
        };

        this.accounts.push(account);
        this.saveAccounts();

        // Generate demo transactions
        await this.generateDemoTransactions(account.id);

        return { success: true, account };
    }

    // Disconnect bank account
    disconnectBank(accountId) {
        const account = this.accounts.find(a => a.id === accountId);

        // If GoCardless account, delete the requisition
        if (account?.requisitionId && this.isLiveMode()) {
            this._gcRequest('DELETE', `/requisitions/${account.requisitionId}/`).catch(err => {
                console.warn('[BankingService] Failed to delete GoCardless requisition:', err.message);
            });
        }

        this.accounts = this.accounts.filter(a => a.id !== accountId);
        this.transactions = this.transactions.filter(t => t.accountId !== accountId);
        this.saveAccounts();
        this.saveTransactions();
        return { success: true };
    }

    // Generate demo transactions for testing
    async generateDemoTransactions(accountId) {
        const demoTransactions = [
            { amount: 2500.00, type: 'credit', reference: 'RE-2026-001', name: 'Muller GmbH', purpose: 'Rechnung RE-2026-001 Schweissarbeiten' },
            { amount: -450.50, type: 'debit', reference: 'Wuerth Bestellung', name: 'Wuerth GmbH', purpose: 'Material Bestellung 45892' },
            { amount: 1850.00, type: 'credit', reference: 'RE-2026-002', name: 'Schmidt Bau AG', purpose: 'Zahlung Rechnung RE-2026-002' },
            { amount: -125.00, type: 'debit', reference: 'Tanken', name: 'Shell Station', purpose: 'Diesel Firmenfahrzeug' },
            { amount: 3200.00, type: 'credit', reference: 'RE-2026-003', name: 'Industrie Meier', purpose: 'Rechnung Hydraulikservice' },
            { amount: -89.99, type: 'debit', reference: 'Telekom', name: 'Telekom GmbH', purpose: 'Mobilfunk Januar' },
            { amount: -1200.00, type: 'debit', reference: 'Miete', name: 'Vermieter Immobilien', purpose: 'Werkstattmiete Januar' },
            { amount: 980.00, type: 'credit', reference: 'RE-2026-004', name: 'Privatperson Weber', purpose: 'Balkongitter Montage' }
        ];

        const transactions = demoTransactions.map((t, i) => ({
            id: crypto?.randomUUID ? `tx-${crypto.randomUUID()}` : 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9) + '-' + i,
            accountId: accountId,
            date: new Date(Date.now() - (i * 2 * 24 * 60 * 60 * 1000)).toISOString(),
            valueDate: new Date(Date.now() - (i * 2 * 24 * 60 * 60 * 1000)).toISOString(),
            amount: t.amount,
            currency: 'EUR',
            type: t.type,
            name: t.name,
            iban: 'DE89' + Math.random().toString().substring(2, 20),
            purpose: t.purpose,
            reference: t.reference,
            category: this.categorizeTransaction({ purpose: t.purpose, amount: t.amount }),
            matched: false,
            matchedTo: null,
            matchConfidence: null,
            matchMethod: null,
            status: 'booked',
            source: 'demo',
            createdAt: new Date().toISOString()
        }));

        this.transactions.push(...transactions);
        this.saveTransactions();

        // Auto-match invoices
        await this.autoMatchInvoices();
    }

    // Generate random transactions
    generateRandomTransactions(accountId, count) {
        const templates = [
            { type: 'credit', names: ['Kunde A', 'Firma B', 'Herr Meier'], purposes: ['Zahlung Rechnung', 'Ueberweisung', 'Abschlagszahlung'] },
            { type: 'debit', names: ['Lieferant X', 'Tankstelle', 'Versicherung'], purposes: ['Material', 'Diesel', 'Betriebskosten'] }
        ];

        return Array.from({ length: count }, (_, i) => {
            const isCredit = Math.random() > 0.4;
            const template = templates[isCredit ? 0 : 1];
            const amount = isCredit
                ? Math.round((500 + Math.random() * 3000) * 100) / 100
                : -Math.round((50 + Math.random() * 500) * 100) / 100;

            return {
                id: crypto?.randomUUID ? `tx-${crypto.randomUUID()}` : 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9) + '-' + i,
                accountId: accountId,
                date: new Date().toISOString(),
                valueDate: new Date().toISOString(),
                amount: amount,
                currency: 'EUR',
                type: isCredit ? 'credit' : 'debit',
                name: template.names[Math.floor(Math.random() * template.names.length)],
                iban: 'DE89' + Math.random().toString().substring(2, 20),
                purpose: template.purposes[Math.floor(Math.random() * template.purposes.length)],
                category: null,
                matched: false,
                matchedTo: null,
                matchConfidence: null,
                matchMethod: null,
                status: 'booked',
                source: 'demo',
                createdAt: new Date().toISOString()
            };
        });
    }

    // ============================================
    // Material Supplier Detection
    // ============================================

    // Known material supplier patterns for auto-detection
    static MATERIAL_SUPPLIERS = [
        { pattern: /w[uue]rth/i, name: 'Wuerth', type: 'wuerth' },
        { pattern: /kl[ooe]ckner/i, name: 'Kloeckner', type: 'kloeckner' },
        { pattern: /obi[\s-]/i, name: 'OBI', type: 'baumarkt' },
        { pattern: /hornbach/i, name: 'Hornbach', type: 'baumarkt' },
        { pattern: /bauhaus/i, name: 'Bauhaus', type: 'baumarkt' },
        { pattern: /toom/i, name: 'Toom', type: 'baumarkt' },
        { pattern: /hagebau/i, name: 'Hagebau', type: 'baumarkt' },
        { pattern: /hellweg/i, name: 'Hellweg', type: 'baumarkt' },
        { pattern: /globus[\s-]?bau/i, name: 'Globus Baumarkt', type: 'baumarkt' },
        { pattern: /baywa/i, name: 'BayWa', type: 'baumarkt' },
        { pattern: /stahl/i, name: 'Stahlhandel', type: 'stahl' },
        { pattern: /schrauben/i, name: 'Schraubenhandel', type: 'verbindung' },
        { pattern: /hydraulik/i, name: 'Hydraulikhandel', type: 'hydraulik' },
        { pattern: /schwei(ss|ß)/i, name: 'Schweissbedarf', type: 'schweiss' },
        { pattern: /farben|lack/i, name: 'Farbenhandel', type: 'farben' }
    ];

    // Auto-categorize transaction using AI/rules
    categorizeTransaction(transaction) {
        const purpose = (transaction.purpose || '').toLowerCase();
        const name = (transaction.name || '').toLowerCase();
        const combined = purpose + ' ' + name;
        const amount = transaction.amount;

        // Rule-based categorization
        if (purpose.includes('rechnung') || purpose.includes('zahlung')) { return 'einnahme_kunde'; }

        // Enhanced material detection: check supplier patterns
        for (const sup of BankingService.MATERIAL_SUPPLIERS) {
            if (sup.pattern.test(combined)) { return 'material'; }
        }
        if (purpose.includes('material') || purpose.includes('werkzeug') || purpose.includes('baumaterial')) { return 'material'; }

        if (purpose.includes('diesel') || purpose.includes('tanken') || purpose.includes('benzin')) { return 'fahrzeug'; }
        if (purpose.includes('miete') || purpose.includes('pacht')) { return 'miete'; }
        if (purpose.includes('versicherung')) { return 'versicherung'; }
        if (purpose.includes('strom') || purpose.includes('gas') || purpose.includes('wasser')) { return 'nebenkosten'; }
        if (purpose.includes('telekom') || purpose.includes('vodafone') || purpose.includes('o2')) { return 'kommunikation'; }
        if (purpose.includes('lohn') || purpose.includes('gehalt')) { return 'personal'; }

        // Amount-based guessing
        if (amount > 0) { return 'sonstige_einnahme'; }
        return 'sonstige_ausgabe';
    }

    /**
     * Detect unprocessed material purchases from bank transactions
     * @returns {Array} Transactions categorized as material that haven't been linked to a Wareneingang
     */
    getUnprocessedMaterialPurchases() {
        return this.transactions.filter(t =>
            t.type === 'debit' &&
            !t.wareneingangProcessed &&
            (t.category === 'material' || this.categorizeTransaction(t) === 'material')
        );
    }

    /**
     * Identify the supplier from a transaction
     * @param {Object} tx - Bank transaction
     * @returns {Object|null} {name, type} of matched supplier
     */
    identifySupplier(tx) {
        const combined = ((tx.purpose || '') + ' ' + (tx.name || '')).toLowerCase();
        for (const sup of BankingService.MATERIAL_SUPPLIERS) {
            if (sup.pattern.test(combined)) {
                return { name: sup.name, type: sup.type };
            }
        }
        return { name: tx.name || 'Unbekannt', type: 'generic' };
    }

    /**
     * Mark a transaction as processed by Wareneingang
     * @param {string} transactionId
     * @param {string} wareneingangId
     */
    markAsWareneingangProcessed(transactionId, wareneingangId) {
        const tx = this.transactions.find(t => t.id === transactionId);
        if (tx) {
            tx.wareneingangProcessed = true;
            tx.wareneingangId = wareneingangId;
            tx.wareneingangAt = new Date().toISOString();
            this.saveTransactions();
        }
    }

    // ============================================
    // Payment Matching (3-tier confidence)
    // ============================================

    /**
     * Auto-match incoming payments to open invoices
     * Matching tiers:
     *   1. Verwendungszweck contains invoice number -> 95% confidence
     *   2. Exact amount + customer name partial match -> 85% confidence
     *   3. Amount within +/-1% tolerance -> 70% confidence
     */
    async autoMatchInvoices() {
        const rechnungen = window.storeService?.store?.rechnungen || [];
        const openInvoices = rechnungen.filter(r => r.status === 'offen' || r.status === 'versendet');

        const unmatchedCredits = this.transactions.filter(t =>
            t.type === 'credit' && !t.matched
        );

        let matchCount = 0;

        for (const tx of unmatchedCredits) {
            const purposeLower = (tx.purpose || '').toLowerCase();
            const txNameLower = (tx.name || '').toLowerCase();
            let bestMatch = null;
            let bestConfidence = 0;
            let bestMethod = '';

            for (const invoice of openInvoices) {
                const invoiceRef = (invoice.nummer || invoice.id || '').toLowerCase();
                const invoiceAmount = invoice.brutto || invoice.betrag || 0;
                const customerName = (invoice.kunde?.name || invoice.kunde?.firma || '').toLowerCase();

                // Tier 1: Verwendungszweck contains invoice number (95%)
                if (invoiceRef && purposeLower.includes(invoiceRef)) {
                    const amountDiff = Math.abs(tx.amount - invoiceAmount);
                    const tolerance = invoiceAmount * 0.01;

                    if (amountDiff <= tolerance && BankingService.CONFIDENCE.REFERENCE_MATCH > bestConfidence) {
                        bestMatch = invoice;
                        bestConfidence = BankingService.CONFIDENCE.REFERENCE_MATCH;
                        bestMethod = 'reference_match';
                    }
                }

                // Tier 2: Exact amount + customer name match (85%)
                if (Math.abs(tx.amount - invoiceAmount) < 0.01 && BankingService.CONFIDENCE.AMOUNT_AND_NAME > bestConfidence) {
                    if (customerName) {
                        // Match on first word of customer name or full name
                        const firstWord = customerName.split(' ')[0];
                        if (firstWord.length >= 3 && (txNameLower.includes(firstWord) || txNameLower.includes(customerName))) {
                            bestMatch = invoice;
                            bestConfidence = BankingService.CONFIDENCE.AMOUNT_AND_NAME;
                            bestMethod = 'amount_and_name';
                        }
                    }
                }

                // Tier 3: Amount within +/-1% (70%)
                if (BankingService.CONFIDENCE.AMOUNT_FUZZY > bestConfidence) {
                    const amountDiff = Math.abs(tx.amount - invoiceAmount);
                    const tolerance = invoiceAmount * 0.01;
                    if (amountDiff <= tolerance && amountDiff >= 0.01) {
                        bestMatch = invoice;
                        bestConfidence = BankingService.CONFIDENCE.AMOUNT_FUZZY;
                        bestMethod = 'amount_fuzzy';
                    }
                }
            }

            if (bestMatch && bestConfidence > 0) {
                await this.matchPaymentToInvoice(tx.id, bestMatch.id, bestConfidence, bestMethod);
                matchCount++;

                // Remove from open invoices to prevent double matching
                const idx = openInvoices.indexOf(bestMatch);
                if (idx > -1) { openInvoices.splice(idx, 1); }
            }
        }

        return { matched: matchCount };
    }

    /**
     * Match a payment to an invoice with confidence tracking
     * @param {string} transactionId
     * @param {string} invoiceId
     * @param {number} confidence - 0.00 to 1.00
     * @param {string} method - 'reference_match', 'amount_and_name', 'amount_fuzzy', 'manual'
     */
    async matchPaymentToInvoice(transactionId, invoiceId, confidence = 1.0, method = 'manual') {
        const tx = this.transactions.find(t => t.id === transactionId);
        if (!tx) { return { success: false }; }

        tx.matched = true;
        tx.matchedTo = { type: 'rechnung', id: invoiceId };
        tx.matchedAt = new Date().toISOString();
        tx.matchConfidence = confidence;
        tx.matchMethod = method;

        this.matchedPayments.push({
            transactionId: transactionId,
            invoiceId: invoiceId,
            amount: tx.amount,
            confidence: confidence,
            method: method,
            matchedAt: new Date().toISOString()
        });

        // Update invoice status
        if (window.storeService?.store?.rechnungen) {
            const invoice = window.storeService.store.rechnungen.find(r => r.id === invoiceId || r.nummer === invoiceId);
            if (invoice) {
                invoice.status = 'bezahlt';
                invoice.bezahltAm = new Date().toISOString();
                invoice.zahlungseingang = tx.amount;
                await window.storeService?.save();
            }
        }

        // Add to bookkeeping
        if (window.bookkeepingService) {
            await window.bookkeepingService.addBuchung({
                typ: 'einnahme',
                datum: (tx.date || '').split('T')[0],
                brutto: tx.amount,
                betrag: tx.amount,
                kategorie: 'Kundeneinnahmen',
                beschreibung: `Zahlung ${invoiceId}: ${tx.name} (${method}, ${Math.round(confidence * 100)}%)`,
                quelle: 'bank_import',
                transactionId: tx.id
            });
        }

        this.saveTransactions();
        this.saveMatchedPayments();

        return { success: true, confidence, method };
    }

    // ============================================
    // Unmatched Transaction Handling
    // ============================================

    /**
     * Get all unmatched credit transactions (incoming payments not linked to an invoice)
     * Excludes dismissed transactions
     * @returns {Array} Unmatched credit transactions sorted by date descending
     */
    getUnmatchedTransactions() {
        return this.transactions
            .filter(t => t.type === 'credit' && !t.matched && !t.dismissed && t.amount > 0)
            .sort((a, b) => (StorageUtils.safeDate(b.date) || 0) - (StorageUtils.safeDate(a.date) || 0));
    }

    /**
     * Manually match a transaction to an invoice
     * Sets confidence to 1.0 and method to 'manual', marks invoice as 'bezahlt', creates buchung
     * @param {string} transactionId - Transaction ID
     * @param {string} invoiceId - Invoice ID or nummer
     * @returns {Object} { success, confidence, method }
     */
    async manualMatch(transactionId, invoiceId) {
        return this.matchPaymentToInvoice(transactionId, invoiceId, 1.0, 'manual');
    }

    /**
     * Dismiss a transaction that is not an invoice payment (e.g. tax refund, personal transfer)
     * @param {string} transactionId - Transaction ID
     * @param {string} reason - Reason for dismissal (e.g. 'Steuerrueckerstattung', 'Privatueberweisung')
     * @returns {Object} { success }
     */
    dismissTransaction(transactionId, reason) {
        const tx = this.transactions.find(t => t.id === transactionId);
        if (!tx) { return { success: false, error: 'Transaction not found' }; }

        tx.dismissed = true;
        tx.dismissReason = reason || '';
        tx.dismissedAt = new Date().toISOString();
        this.saveTransactions();

        return { success: true, transactionId, reason };
    }

    // Unmatch payment
    unmatchPayment(transactionId) {
        const tx = this.transactions.find(t => t.id === transactionId);
        if (tx) {
            tx.matched = false;
            tx.matchedTo = null;
            tx.matchConfidence = null;
            tx.matchMethod = null;
            this.matchedPayments = this.matchedPayments.filter(m => m.transactionId !== transactionId);
            this.saveTransactions();
            this.saveMatchedPayments();
        }
    }

    // ============================================
    // Reporting & Queries
    // ============================================

    // Get reconciliation status
    getReconciliationStatus() {
        const accounts = this.accounts;
        const transactions = this.transactions;

        const totalCredits = transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalDebits = transactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
        const matchedCount = transactions.filter(t => t.matched).length;
        const unmatchedCredits = transactions.filter(t => t.type === 'credit' && !t.matched);

        // Confidence breakdown
        const matchedTxs = transactions.filter(t => t.matched && t.matchConfidence);
        const avgConfidence = matchedTxs.length > 0
            ? matchedTxs.reduce((sum, t) => sum + t.matchConfidence, 0) / matchedTxs.length
            : 0;

        return {
            accountCount: accounts.length,
            totalBalance: accounts.reduce((sum, a) => sum + (a.balance || 0), 0),
            transactionCount: transactions.length,
            totalCredits,
            totalDebits,
            matchedCount,
            unmatchedCreditsCount: unmatchedCredits.length,
            unmatchedCreditsAmount: unmatchedCredits.reduce((sum, t) => sum + (t.amount || 0), 0),
            averageMatchConfidence: Math.round(avgConfidence * 100),
            isLiveMode: this.isLiveMode(),
            lastSync: accounts.length > 0 ? accounts.reduce((latest, a) =>
                a.lastSync > latest ? a.lastSync : latest, accounts[0].lastSync) : null
        };
    }

    // Calculate account balance
    calculateBalance(accountId) {
        return this.transactions
            .filter(t => t.accountId === accountId)
            .reduce((sum, t) => sum + (t.amount || 0), 0);
    }

    // Get transactions with filters
    getTransactions(filters = {}) {
        let txs = [...this.transactions];

        if (filters.accountId) {
            txs = txs.filter(t => t.accountId === filters.accountId);
        }
        if (filters.type) {
            txs = txs.filter(t => t.type === filters.type);
        }
        if (filters.matched !== undefined) {
            txs = txs.filter(t => t.matched === filters.matched);
        }
        if (filters.category) {
            txs = txs.filter(t => t.category === filters.category);
        }
        if (filters.dateFrom) {
            txs = txs.filter(t => t.date >= filters.dateFrom);
        }
        if (filters.dateTo) {
            txs = txs.filter(t => t.date <= filters.dateTo);
        }
        if (filters.source) {
            txs = txs.filter(t => t.source === filters.source);
        }
        if (filters.minConfidence) {
            txs = txs.filter(t => !t.matched || (t.matchConfidence && t.matchConfidence >= filters.minConfidence));
        }
        if (filters.search) {
            const q = filters.search.toLowerCase();
            txs = txs.filter(t =>
                (t.name || '').toLowerCase().includes(q) ||
                (t.purpose || '').toLowerCase().includes(q) ||
                (t.reference && t.reference.toLowerCase().includes(q))
            );
        }

        return txs.sort((a, b) => (StorageUtils.safeDate(b.date) || 0) - (StorageUtils.safeDate(a.date) || 0));
    }

    // Get category labels
    getCategoryLabel(category) {
        const labels = {
            'einnahme_kunde': 'Kundeneinnahme',
            'material': 'Materialeinkauf',
            'fahrzeug': 'Fahrzeugkosten',
            'miete': 'Miete/Pacht',
            'versicherung': 'Versicherung',
            'nebenkosten': 'Nebenkosten',
            'kommunikation': 'Telefon/Internet',
            'personal': 'Personalkosten',
            'sonstige_einnahme': 'Sonstige Einnahme',
            'sonstige_ausgabe': 'Sonstige Ausgabe'
        };
        return labels[category] || category;
    }

    // Get accounts
    getAccounts() {
        return this.accounts;
    }

    // Format currency
    formatCurrency(amount) {
        return window.formatCurrency(amount);
    }

    // ============================================
    // Persistence
    // ============================================

    saveAccounts() {
        const ok = StorageUtils.setJSON('freyai_bank_accounts', this.accounts, { service: 'BankingService' });
        if (!ok) { console.error('[BankingService] CRITICAL: Failed to save bank accounts -- GoBD write failure'); }
    }
    saveTransactions() {
        const ok = StorageUtils.setJSON('freyai_bank_transactions', this.transactions, { service: 'BankingService' });
        if (!ok) { console.error('[BankingService] CRITICAL: Failed to save bank transactions -- GoBD write failure'); }
    }
    saveMatchedPayments() {
        const ok = StorageUtils.setJSON('freyai_matched_payments', this.matchedPayments, { service: 'BankingService' });
        if (!ok) { console.error('[BankingService] CRITICAL: Failed to save matched payments -- GoBD write failure'); }
    }
    _saveSettings() {
        const ok = StorageUtils.setJSON('freyai_banking_settings', this.settings, { service: 'BankingService' });
        if (!ok) { console.error('[BankingService] CRITICAL: Failed to save banking settings -- GoBD write failure'); }
    }
}

window.bankingService = new BankingService();
