/* ============================================
   Banking Integration Service (PSD2/FinTS)
   Auto-import transactions, match to invoices
   ============================================ */

class BankingService {
    constructor() {
        try { this.accounts = JSON.parse(localStorage.getItem('freyai_bank_accounts') || '[]'); } catch { this.accounts = []; }
        try { this.transactions = JSON.parse(localStorage.getItem('freyai_bank_transactions') || '[]'); } catch { this.transactions = []; }
        try { this.matchedPayments = JSON.parse(localStorage.getItem('freyai_matched_payments') || '[]'); } catch { this.matchedPayments = []; }
        try { this.settings = JSON.parse(localStorage.getItem('freyai_banking_settings') || '{}'); } catch { this.settings = {}; }

        // Demo bank data
        this.demoBanks = [
            { blz: '50010517', name: 'ING-DiBa', bic: 'INGDDEFFXXX' },
            { blz: '37040044', name: 'Commerzbank', bic: 'COBADEFFXXX' },
            { blz: '50070010', name: 'Deutsche Bank', bic: 'DEUTDEFFXXX' },
            { blz: '70150000', name: 'Stadtsparkasse München', bic: 'SSKMDEMMXXX' },
            { blz: '50050201', name: 'Frankfurter Sparkasse', bic: 'HELODEF1822' }
        ];
    }

    // Connect a bank account (demo mode)
    async connectBank(bankData) {
        // In production: Use FinTS or Nordigen API
        const account = {
            id: 'acc-' + Date.now(),
            bankName: bankData.bankName,
            blz: bankData.blz,
            iban: bankData.iban,
            bic: bankData.bic || '',
            accountHolder: bankData.accountHolder,
            lastSync: null,
            balance: 0,
            status: 'connected',
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
        this.accounts = this.accounts.filter(a => a.id !== accountId);
        this.transactions = this.transactions.filter(t => t.accountId !== accountId);
        this.saveAccounts();
        this.saveTransactions();
        return { success: true };
    }

    // Fetch transactions (demo mode)
    async fetchTransactions(accountId, dateRange = {}) {
        const account = this.accounts.find(a => a.id === accountId);
        if (!account) {return { success: false, error: 'Account not found' };}

        // In production: Call FinTS/Nordigen API
        // For demo: Generate new transactions
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

    // Generate demo transactions for testing
    async generateDemoTransactions(accountId) {
        const demoTransactions = [
            { amount: 2500.00, type: 'credit', reference: 'RE-2026-001', name: 'Müller GmbH', purpose: 'Rechnung RE-2026-001 Schweißarbeiten' },
            { amount: -450.50, type: 'debit', reference: 'Würth Bestellung', name: 'Würth GmbH', purpose: 'Material Bestellung 45892' },
            { amount: 1850.00, type: 'credit', reference: 'RE-2026-002', name: 'Schmidt Bau AG', purpose: 'Zahlung Rechnung RE-2026-002' },
            { amount: -125.00, type: 'debit', reference: 'Tanken', name: 'Shell Station', purpose: 'Diesel Firmenfahrzeug' },
            { amount: 3200.00, type: 'credit', reference: 'RE-2026-003', name: 'Industrie Meier', purpose: 'Rechnung Hydraulikservice' },
            { amount: -89.99, type: 'debit', reference: 'Telekom', name: 'Telekom GmbH', purpose: 'Mobilfunk Januar' },
            { amount: -1200.00, type: 'debit', reference: 'Miete', name: 'Vermieter Immobilien', purpose: 'Werkstattmiete Januar' },
            { amount: 980.00, type: 'credit', reference: 'RE-2026-004', name: 'Privatperson Weber', purpose: 'Balkongitter Montage' }
        ];

        const transactions = demoTransactions.map((t, i) => ({
            id: 'tx-' + Date.now() + '-' + i,
            accountId: accountId,
            date: new Date(Date.now() - (i * 2 * 24 * 60 * 60 * 1000)).toISOString(),
            valueDate: new Date(Date.now() - (i * 2 * 24 * 60 * 60 * 1000)).toISOString(),
            amount: t.amount,
            currency: 'EUR',
            type: t.type,
            name: t.name,
            iban: 'DE89' + Math.random().toString().substr(2, 18),
            purpose: t.purpose,
            reference: t.reference,
            category: this.categorizeTransaction({ purpose: t.purpose, amount: t.amount }),
            matched: false,
            matchedTo: null,
            createdAt: new Date().toISOString()
        }));

        this.transactions.push(...transactions);
        this.saveTransactions();

        // Auto-match invoices
        this.autoMatchInvoices();
    }

    // Generate random transactions
    generateRandomTransactions(accountId, count) {
        const templates = [
            { type: 'credit', names: ['Kunde A', 'Firma B', 'Herr Meier'], purposes: ['Zahlung Rechnung', 'Überweisung', 'Abschlagszahlung'] },
            { type: 'debit', names: ['Lieferant X', 'Tankstelle', 'Versicherung'], purposes: ['Material', 'Diesel', 'Betriebskosten'] }
        ];

        return Array.from({ length: count }, (_, i) => {
            const isCredit = Math.random() > 0.4;
            const template = templates[isCredit ? 0 : 1];
            const amount = isCredit
                ? Math.round((500 + Math.random() * 3000) * 100) / 100
                : -Math.round((50 + Math.random() * 500) * 100) / 100;

            return {
                id: 'tx-' + Date.now() + '-' + i,
                accountId: accountId,
                date: new Date().toISOString(),
                valueDate: new Date().toISOString(),
                amount: amount,
                currency: 'EUR',
                type: isCredit ? 'credit' : 'debit',
                name: template.names[Math.floor(Math.random() * template.names.length)],
                iban: 'DE89' + Math.random().toString().substr(2, 18),
                purpose: template.purposes[Math.floor(Math.random() * template.purposes.length)],
                category: null,
                matched: false,
                matchedTo: null,
                createdAt: new Date().toISOString()
            };
        });
    }

    // Known material supplier patterns for auto-detection
    static MATERIAL_SUPPLIERS = [
        { pattern: /w[üu]rth/i, name: 'Würth', type: 'wuerth' },
        { pattern: /kl[öo]ckner/i, name: 'Klöckner', type: 'kloeckner' },
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
        { pattern: /schweiß|schweiss/i, name: 'Schweißbedarf', type: 'schweiss' },
        { pattern: /farben|lack/i, name: 'Farbenhandel', type: 'farben' }
    ];

    // Auto-categorize transaction using AI/rules
    categorizeTransaction(transaction) {
        const purpose = (transaction.purpose || '').toLowerCase();
        const name = (transaction.name || '').toLowerCase();
        const combined = purpose + ' ' + name;
        const amount = transaction.amount;

        // Rule-based categorization
        if (purpose.includes('rechnung') || purpose.includes('zahlung')) {return 'einnahme_kunde';}

        // Enhanced material detection: check supplier patterns
        for (const sup of BankingService.MATERIAL_SUPPLIERS) {
            if (sup.pattern.test(combined)) {return 'material';}
        }
        if (purpose.includes('material') || purpose.includes('werkzeug') || purpose.includes('baumaterial')) {return 'material';}

        if (purpose.includes('diesel') || purpose.includes('tanken') || purpose.includes('benzin')) {return 'fahrzeug';}
        if (purpose.includes('miete') || purpose.includes('pacht')) {return 'miete';}
        if (purpose.includes('versicherung')) {return 'versicherung';}
        if (purpose.includes('strom') || purpose.includes('gas') || purpose.includes('wasser')) {return 'nebenkosten';}
        if (purpose.includes('telekom') || purpose.includes('vodafone') || purpose.includes('o2')) {return 'kommunikation';}
        if (purpose.includes('lohn') || purpose.includes('gehalt')) {return 'personal';}

        // Amount-based guessing
        if (amount > 0) {return 'sonstige_einnahme';}
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

    // Auto-match incoming payments to open invoices
    autoMatchInvoices() {
        const rechnungen = store?.rechnungen || [];
        const openInvoices = rechnungen.filter(r => r.status === 'offen' || r.status === 'versendet');

        const unmatchedCredits = this.transactions.filter(t =>
            t.type === 'credit' && !t.matched
        );

        let matchCount = 0;

        unmatchedCredits.forEach(tx => {
            // Try to match by reference number in purpose
            const purposeLower = tx.purpose.toLowerCase();

            for (const invoice of openInvoices) {
                const invoiceRef = (invoice.nummer || invoice.id).toLowerCase();

                // Check if purpose contains invoice number
                if (purposeLower.includes(invoiceRef)) {
                    // Check amount match (with 1% tolerance for fees)
                    const amountDiff = Math.abs(tx.amount - invoice.betrag);
                    const tolerance = invoice.betrag * 0.01;

                    if (amountDiff <= tolerance) {
                        this.matchPaymentToInvoice(tx.id, invoice.id);
                        matchCount++;
                        break;
                    }
                }

                // Fallback: Match by exact amount and customer name
                if (Math.abs(tx.amount - invoice.betrag) < 0.01) {
                    const customerName = (invoice.kunde?.name || invoice.kunde?.firma || '').toLowerCase();
                    if (customerName && tx.name.toLowerCase().includes(customerName.split(' ')[0])) {
                        this.matchPaymentToInvoice(tx.id, invoice.id);
                        matchCount++;
                        break;
                    }
                }
            }
        });

        return { matched: matchCount };
    }

    // Match a payment to an invoice
    matchPaymentToInvoice(transactionId, invoiceId) {
        const tx = this.transactions.find(t => t.id === transactionId);
        if (!tx) {return { success: false };}

        tx.matched = true;
        tx.matchedTo = { type: 'rechnung', id: invoiceId };
        tx.matchedAt = new Date().toISOString();

        this.matchedPayments.push({
            transactionId: transactionId,
            invoiceId: invoiceId,
            amount: tx.amount,
            matchedAt: new Date().toISOString()
        });

        // Update invoice status
        if (typeof store !== 'undefined' && store.rechnungen) {
            const invoice = store.rechnungen.find(r => r.id === invoiceId || r.nummer === invoiceId);
            if (invoice) {
                invoice.status = 'bezahlt';
                invoice.bezahltAm = new Date().toISOString();
                invoice.zahlungseingang = tx.amount;
                if (typeof saveStore === 'function') {saveStore();}
            }
        }

        // Add to bookkeeping
        if (window.bookkeepingService) {
            window.bookkeepingService.addBuchung({
                typ: 'einnahme',
                datum: tx.date.split('T')[0],
                brutto: tx.amount,
                betrag: tx.amount,
                kategorie: 'Kundeneinnahmen',
                beschreibung: `Zahlung ${invoiceId}: ${tx.name}`,
                quelle: 'bank_import',
                transactionId: tx.id
            });
        }

        this.saveTransactions();
        this.saveMatchedPayments();

        return { success: true };
    }

    // Unmatch payment
    unmatchPayment(transactionId) {
        const tx = this.transactions.find(t => t.id === transactionId);
        if (tx) {
            tx.matched = false;
            tx.matchedTo = null;
            this.matchedPayments = this.matchedPayments.filter(m => m.transactionId !== transactionId);
            this.saveTransactions();
            this.saveMatchedPayments();
        }
    }

    // Get reconciliation status
    getReconciliationStatus() {
        const accounts = this.accounts;
        const transactions = this.transactions;

        const totalCredits = transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
        const totalDebits = transactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const matchedCount = transactions.filter(t => t.matched).length;
        const unmatchedCredits = transactions.filter(t => t.type === 'credit' && !t.matched);

        return {
            accountCount: accounts.length,
            totalBalance: accounts.reduce((sum, a) => sum + (a.balance || 0), 0),
            transactionCount: transactions.length,
            totalCredits,
            totalDebits,
            matchedCount,
            unmatchedCreditsCount: unmatchedCredits.length,
            unmatchedCreditsAmount: unmatchedCredits.reduce((sum, t) => sum + t.amount, 0),
            lastSync: accounts.length > 0 ? accounts.reduce((latest, a) =>
                a.lastSync > latest ? a.lastSync : latest, accounts[0].lastSync) : null
        };
    }

    // Calculate account balance
    calculateBalance(accountId) {
        return this.transactions
            .filter(t => t.accountId === accountId)
            .reduce((sum, t) => sum + t.amount, 0);
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
        if (filters.search) {
            const q = filters.search.toLowerCase();
            txs = txs.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.purpose.toLowerCase().includes(q) ||
                (t.reference && t.reference.toLowerCase().includes(q))
            );
        }

        return txs.sort((a, b) => new Date(b.date) - new Date(a.date));
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
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    // Persistence
    saveAccounts() { localStorage.setItem('freyai_bank_accounts', JSON.stringify(this.accounts)); }
    saveTransactions() { localStorage.setItem('freyai_bank_transactions', JSON.stringify(this.transactions)); }
    saveMatchedPayments() { localStorage.setItem('freyai_matched_payments', JSON.stringify(this.matchedPayments)); }
}

window.bankingService = new BankingService();
