/* ============================================
   Banking Integration Service
   PSD2 / Nordigen (GoCardless Bank Account Data API)
   German FinTS-compatible bank connectivity via Supabase Edge Function proxy
   ============================================ */

/**
 * BankingService — connects to the Nordigen/GoCardless Bank Account Data API
 * via a Supabase Edge Function proxy (banking-proxy) that keeps API credentials
 * server-side.
 *
 * Invoice data structure reference (store.rechnungen entries):
 *   id                  — e.g. "RE-2024-0001"
 *   kunde               — { name, email, ... }
 *   status              — 'offen' | 'bezahlt' | 'storniert'
 *   faelligkeitsdatum   — ISO date string (due date)
 *   gesamtNetto         — number (net total)
 *   gesamtBrutto        — number (gross total, used for matching)
 *   datum               — ISO date string (invoice date)
 *   paidAt              — ISO date string or null
 *
 * Edge Function endpoints proxied:
 *   GET  /institutions?country=DE
 *   POST /requisitions
 *   GET  /accounts/{id}/transactions?dateFrom=&dateTo=
 *   GET  /accounts/{id}/balances
 */

class BankingService {
    constructor() {
        /** @type {Array<Object>} Connected bank accounts */
        this.accounts = [];
        /** @type {Array<Object>} Cached normalised transactions */
        this.transactions = [];
        /** @type {Object} Persistent configuration (API keys, account list, cache) */
        this.config = this.loadConfig();
        /** Base URL of the Supabase Edge Function banking proxy */
        this._proxyBase = this._resolveProxyBase();
    }

    // ---------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------

    /**
     * Resolve the banking proxy base URL from the globally initialised
     * Supabase client. Falls back to a relative path for local dev.
     * @returns {string}
     */
    _resolveProxyBase() {
        try {
            const supabaseUrl =
                window.supabaseClient?.supabaseUrl ||
                (typeof supabase !== 'undefined' && supabase?.supabaseUrl) ||
                this.config.supabaseUrl ||
                '';
            if (supabaseUrl) {
                return `${supabaseUrl}/functions/v1/banking-proxy`;
            }
        } catch (_) { /* ignore */ }
        return '/functions/v1/banking-proxy';
    }

    /**
     * Build common fetch headers including the Supabase session Bearer token.
     * @returns {Promise<Object>}
     */
    async _authHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        try {
            const client =
                window.supabaseClient ||
                (typeof supabase !== 'undefined' ? supabase : null);
            if (client) {
                const { data: { session } } = await client.auth.getSession();
                if (session?.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }
            }
        } catch (_) { /* proceed without token — proxy will reject if auth required */ }
        return headers;
    }

    /**
     * Authenticated fetch wrapper with consistent error handling.
     * @param {string} path   — path relative to the proxy base
     * @param {Object} [opts] — standard fetch options
     * @returns {Promise<any>} parsed JSON response body
     */
    async _apiFetch(path, opts = {}) {
        const headers = await this._authHeaders();
        const url = `${this._proxyBase}${path}`;
        const res = await fetch(url, {
            ...opts,
            headers: { ...headers, ...(opts.headers || {}) },
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
    }

    // ---------------------------------------------------------------
    // Bank connectivity — Nordigen/GoCardless PSD2 flow
    // ---------------------------------------------------------------

    /**
     * Initiate the Nordigen OAuth-style requisition to connect a German bank.
     * Opens the Nordigen bank-authorization URL in a new tab. The requisition
     * ID is persisted locally so the callback can retrieve account IDs.
     *
     * @param {string} institutionId — Nordigen institution ID (e.g. "SPARKASSE_SSKMDEMMXXX")
     * @param {string} [countryCode='DE']
     * @returns {Promise<{requisitionId: string, link: string}>}
     */
    async connectBank(institutionId, countryCode = 'DE') {
        if (!institutionId) throw new Error('institutionId ist erforderlich');

        const redirectUri =
            `${window.location.origin}${window.location.pathname}#banking-callback`;

        const data = await this._apiFetch('/requisitions', {
            method: 'POST',
            body: JSON.stringify({ institutionId, countryCode, redirectUri }),
        });

        // Persist requisition metadata for later polling
        const requisitions = this.config.requisitions || [];
        requisitions.push({
            id: data.requisitionId,
            institutionId,
            countryCode,
            createdAt: new Date().toISOString(),
            status: 'pending',
        });
        this.saveConfig({ ...this.config, requisitions });

        // Open Nordigen authorization page for the user
        if (data.link) {
            window.open(data.link, '_blank', 'noopener,noreferrer');
        }

        return data;
    }

    /**
     * Fetch a list of supported German bank institutions from the proxy.
     * Results are cached in config for 24 hours.
     *
     * @returns {Promise<Array<{id: string, name: string, bic: string, logo: string}>>}
     */
    async getGermanBanks() {
        const cacheKey = 'institutionsDE';
        const cached = this.config[cacheKey];
        if (cached?.fetchedAt) {
            const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
            if (ageMs < 24 * 60 * 60 * 1000) {
                return cached.items;
            }
        }

        const data = await this._apiFetch('/institutions?country=DE');
        const items = Array.isArray(data) ? data : (data.institutions || []);

        this.saveConfig({
            ...this.config,
            [cacheKey]: { items, fetchedAt: new Date().toISOString() },
        });

        return items;
    }

    /**
     * Fetch booked transactions for an account and date range.
     * Normalises the Nordigen response into a consistent shape and caches
     * the result in this.transactions.
     *
     * @param {string} accountId
     * @param {string} dateFrom — ISO date "YYYY-MM-DD"
     * @param {string} dateTo   — ISO date "YYYY-MM-DD"
     * @returns {Promise<Array<Object>>} normalised transaction list
     */
    async fetchTransactions(accountId, dateFrom, dateTo) {
        if (!accountId) throw new Error('accountId ist erforderlich');

        const params = new URLSearchParams();
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo)   params.set('dateTo',   dateTo);

        const data = await this._apiFetch(
            `/accounts/${encodeURIComponent(accountId)}/transactions?${params}`
        );

        // Nordigen wraps booked transactions under data.transactions.booked
        const raw = data.transactions?.booked ?? data.transactions ?? data ?? [];
        const normalised = raw.map(t => this._normaliseTransaction(t));
        this.transactions = normalised;
        return normalised;
    }

    /**
     * Normalise a raw Nordigen transaction object into a flat, consistent shape.
     * @param {Object} t — raw Nordigen transaction
     * @returns {Object}
     */
    _normaliseTransaction(t) {
        return {
            id: t.transactionId
                || t.internalTransactionId
                || `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            date:         t.bookingDate || t.valueDate || null,
            amount:       parseFloat(t.transactionAmount?.amount ?? t.amount ?? 0),
            currency:     t.transactionAmount?.currency || t.currency || 'EUR',
            description:  t.remittanceInformationUnstructured
                       || t.remittanceInformationStructured
                       || t.additionalInformation
                       || '',
            creditorName: t.creditorName || '',
            debtorName:   t.debtorName   || '',
            creditorIban: t.creditorAccount?.iban || '',
            debtorIban:   t.debtorAccount?.iban   || '',
            raw:          t,
        };
    }

    // ---------------------------------------------------------------
    // Auto-matching: transactions → open invoices
    // ---------------------------------------------------------------

    /**
     * Match a list of normalised transactions to open invoices using
     * multi-factor fuzzy scoring.
     *
     * Scoring factors (max 100 per pair):
     *   +50  exact amount match
     *   +35  amount within ±1 € tolerance
     *   +15  amount within ±5 € tolerance
     *   +30  invoice ID found verbatim in transaction description
     *   0–20 date proximity (linear, within 30 days of due date)
     *   +10  customer name partial match
     *
     * A match is surfaced when confidence >= 40.
     *
     * @param {Array<Object>} transactions  — normalised transaction objects
     * @param {Array<Object>} openInvoices  — store.rechnungen filtered to status 'offen'
     * @returns {Array<{
     *   transaction: Object,
     *   invoice: Object|null,
     *   confidence: number,
     *   reasons: string[]
     * }>}
     */
    autoMatchToInvoices(transactions, openInvoices) {
        if (!Array.isArray(transactions) || !Array.isArray(openInvoices)) return [];

        return transactions.map(tx => {
            const scored = openInvoices
                .map(inv => this._scoreMatch(tx, inv))
                .sort((a, b) => b.confidence - a.confidence);

            const best = scored[0] || { invoice: null, confidence: 0, reasons: [] };
            return {
                transaction: tx,
                invoice:     best.confidence >= 40 ? best.invoice : null,
                confidence:  best.confidence,
                reasons:     best.reasons,
            };
        });
    }

    /**
     * Score how well a single transaction matches a single open invoice.
     *
     * @param {Object} tx  — normalised transaction
     * @param {Object} inv — invoice from store.rechnungen
     * @returns {{invoice: Object, confidence: number, reasons: string[]}}
     */
    _scoreMatch(tx, inv) {
        let confidence = 0;
        const reasons  = [];

        // Use gross total (Brutto) for matching; fall back to netto or generic betrag field
        const invoiceAmount = parseFloat(
            inv.gesamtBrutto ?? inv.gesamtNetto ?? inv.betrag ?? 0
        );
        // Incoming customer payments are positive; outgoing debits are negative
        const txAmount = Math.abs(tx.amount);

        // 1. Amount matching ─────────────────────────────────────────
        if (invoiceAmount > 0) {
            const diff = Math.abs(txAmount - invoiceAmount);
            if (diff === 0) {
                confidence += 50;
                reasons.push('Betrag stimmt exakt überein');
            } else if (diff <= 1.0) {
                confidence += 35;
                reasons.push(`Betrag innerhalb ±1 € (Differenz: ${diff.toFixed(2)} €)`);
            } else if (diff <= 5.0) {
                confidence += 15;
                reasons.push(`Betrag nahe (Differenz: ${diff.toFixed(2)} €)`);
            }
        }

        // 2. Invoice reference in transaction description ─────────────
        if (inv.id) {
            // Compare both the raw ID and a digit-only version to tolerate
            // formatting differences like "RE2024001" vs "RE-2024-001"
            const invIdClean  = inv.id.replace(/[^a-zA-Z0-9]/g, '');
            const descClean   = tx.description.replace(/[^a-zA-Z0-9]/g, '');
            if (tx.description.includes(inv.id) || descClean.includes(invIdClean)) {
                confidence += 30;
                reasons.push(`Rechnungsnummer "${inv.id}" im Verwendungszweck gefunden`);
            }
        }

        // 3. Date proximity ──────────────────────────────────────────
        // Compare transaction booking date to invoice due date (within 30 days)
        if (tx.date && inv.faelligkeitsdatum) {
            const txDate   = new Date(tx.date);
            const dueDate  = new Date(inv.faelligkeitsdatum);
            const daysDiff = Math.abs((txDate - dueDate) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 30) {
                const dateScore = Math.round(20 * (1 - daysDiff / 30));
                confidence += dateScore;
                reasons.push(
                    `Buchungsdatum ${Math.round(daysDiff)} Tag(e) von Fälligkeit entfernt (+${dateScore})`
                );
            }
        }

        // 4. Customer name heuristic ──────────────────────────────────
        const customerName = (inv.kunde?.name || '').toLowerCase();
        const txCounterpart = (tx.debtorName || tx.creditorName || '').toLowerCase();
        if (
            customerName && txCounterpart && (
                txCounterpart.includes(customerName) ||
                customerName.includes(txCounterpart) ||
                this._partialNameMatch(customerName, txCounterpart)
            )
        ) {
            confidence += 10;
            reasons.push('Kundenname teilweise übereinstimmend');
        }

        return { invoice: inv, confidence: Math.min(confidence, 100), reasons };
    }

    /**
     * Returns true if any word (≥4 chars) from nameA appears in nameB.
     * @param {string} nameA
     * @param {string} nameB
     * @returns {boolean}
     */
    _partialNameMatch(nameA, nameB) {
        const words = nameA.split(/\s+/).filter(w => w.length >= 4);
        return words.some(w => nameB.includes(w));
    }

    // ---------------------------------------------------------------
    // AI-powered transaction categorisation (via ai-proxy edge function)
    // ---------------------------------------------------------------

    /**
     * Send a transaction to the Gemini AI proxy for automatic SKR03
     * bookkeeping category assignment.
     *
     * @param {Object} transaction — normalised transaction object
     * @returns {Promise<{
     *   category: string,
     *   account: string,
     *   confidence: number,
     *   explanation: string
     * }>}
     */
    async categorizeTransaction(transaction) {
        const prompt = `Du bist ein deutscher Buchhalter. Kategorisiere die folgende Banktransaktion \
für die Buchhaltung eines deutschen Kleinunternehmens (Kontenrahmen SKR03).

Transaktion:
- Datum: ${transaction.date || 'unbekannt'}
- Betrag: ${transaction.amount} ${transaction.currency || 'EUR'}
- Verwendungszweck: ${transaction.description || '—'}
- Auftraggeber/Empfänger: ${transaction.debtorName || transaction.creditorName || 'unbekannt'}

Antworte ausschließlich mit einem gültigen JSON-Objekt (kein Markdown, keine Erklärungen) \
mit diesen Feldern:
{
  "category": "Kategoriename auf Deutsch",
  "account": "SKR03-Kontonummer (4-stellige Zahl)",
  "confidence": <Zahl 0-100>,
  "explanation": "Kurze Begründung (1 Satz)"
}`;

        try {
            const client =
                window.supabaseClient ||
                (typeof supabase !== 'undefined' ? supabase : null);
            if (!client) throw new Error('Supabase-Client nicht verfügbar');

            const { data: { session } } = await client.auth.getSession();
            if (!session) throw new Error('Nicht angemeldet');

            const supabaseUrl = client.supabaseUrl || '';
            const aiProxyUrl  = supabaseUrl
                ? `${supabaseUrl}/functions/v1/ai-proxy`
                : '/functions/v1/ai-proxy';

            const res = await fetch(aiProxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 256, temperature: 0.1 },
                }),
            });

            if (!res.ok) throw new Error(`AI-Proxy Fehler: ${res.status}`);

            const aiData = await res.json();
            const text   = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            const clean  = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            return JSON.parse(clean);
        } catch (err) {
            console.warn('[BankingService] Kategorisierung fehlgeschlagen:', err.message);
            return {
                category:    'Nicht kategorisiert',
                account:     '0000',
                confidence:  0,
                explanation: err.message,
            };
        }
    }

    // ---------------------------------------------------------------
    // Invoice payment marking
    // ---------------------------------------------------------------

    /**
     * Mark an invoice as paid, linking it to the matched bank transaction.
     * Updates the Rechnungen store and persists immediately.
     *
     * @param {string} invoiceId
     * @param {Object} transaction — normalised transaction that represents the payment
     * @returns {boolean} true on success
     */
    markInvoicePaid(invoiceId, transaction) {
        const storeRef =
            window.store ||
            (typeof AppUtils !== 'undefined' ? AppUtils.store : null);

        if (!storeRef?.rechnungen) {
            console.error('[BankingService] store.rechnungen nicht verfügbar');
            return false;
        }

        const idx = storeRef.rechnungen.findIndex(r => r.id === invoiceId);
        if (idx === -1) {
            console.warn(`[BankingService] Rechnung ${invoiceId} nicht gefunden`);
            return false;
        }

        storeRef.rechnungen[idx] = {
            ...storeRef.rechnungen[idx],
            status:               'bezahlt',
            paidAt:               transaction.date || new Date().toISOString(),
            bankTransactionId:    transaction.id,
            bankTransactionAmount: transaction.amount,
        };

        // Persist store
        if (typeof saveStore === 'function') {
            saveStore();
        } else if (typeof AppUtils?.saveStore === 'function') {
            AppUtils.saveStore();
        }

        // Activity log
        const msg = `Rechnung ${invoiceId} als bezahlt markiert \
(Bankabgleich, Betrag: ${transaction.amount} ${transaction.currency || 'EUR'})`;
        if (typeof addActivity === 'function') {
            addActivity('🏦', msg);
        } else if (typeof AppUtils?.addActivity === 'function') {
            AppUtils.addActivity('🏦', msg);
        }

        return true;
    }

    // ---------------------------------------------------------------
    // Account balance
    // ---------------------------------------------------------------

    /**
     * Retrieve the current balance for a connected account from the proxy.
     * Prefers "closingBooked" or "interimAvailable" balance types.
     *
     * @param {string} accountId
     * @returns {Promise<{amount: number, currency: string, type: string}>}
     */
    async getBalance(accountId) {
        if (!accountId) throw new Error('accountId ist erforderlich');
        const data     = await this._apiFetch(
            `/accounts/${encodeURIComponent(accountId)}/balances`
        );
        const balances = data.balances || data || [];
        const preferred =
            balances.find(b =>
                ['closingBooked', 'interimAvailable'].includes(b.balanceType)
            ) || balances[0];

        return {
            amount:   parseFloat(
                preferred?.balanceAmount?.amount ?? preferred?.amount ?? 0
            ),
            currency: preferred?.balanceAmount?.currency || preferred?.currency || 'EUR',
            type:     preferred?.balanceType || 'unknown',
        };
    }

    // ---------------------------------------------------------------
    // Configuration persistence (localStorage)
    // ---------------------------------------------------------------

    /**
     * Persist configuration to localStorage.
     * @param {Object} config
     */
    saveConfig(config) {
        try {
            localStorage.setItem('bankingServiceConfig', JSON.stringify(config));
            this.config = config;
        } catch (err) {
            console.warn('[BankingService] saveConfig fehlgeschlagen:', err.message);
        }
    }

    /**
     * Load configuration from localStorage.
     * @returns {Object}
     */
    loadConfig() {
        try {
            const raw = localStorage.getItem('bankingServiceConfig');
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    // ---------------------------------------------------------------
    // UI — Dashboard
    // ---------------------------------------------------------------

    /**
     * Render the full banking dashboard into the specified DOM container.
     *
     * @param {string} containerId — id of the target DOM element
     */
    renderDashboard(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`[BankingService] Container #${containerId} nicht gefunden`);
            return;
        }

        const connectedAccounts = this.config.accounts || [];
        const lastSync = this.config.lastSync
            ? new Date(this.config.lastSync).toLocaleString('de-DE')
            : 'Noch nie';

        container.innerHTML = `
<div class="banking-dashboard">
    <div class="banking-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <h2 style="margin:0;">🏦 Banking &amp; Bankabgleich</h2>
        <div style="display:flex;gap:0.5rem;">
            <button class="btn btn-secondary" onclick="window.bankingService.showSettingsModal()">
                ⚙️ Einstellungen
            </button>
            <button class="btn btn-primary"
                    onclick="window.bankingService.syncAllAccounts()"
                    ${connectedAccounts.length === 0 ? 'disabled' : ''}>
                🔄 Synchronisieren
            </button>
        </div>
    </div>

    <div class="banking-status-bar"
         style="background:var(--card-bg,#1e1e1e);border-radius:8px;padding:0.75rem 1rem;
                margin-bottom:1rem;font-size:0.85rem;color:var(--text-secondary,#aaa);">
        Letzter Sync: <strong>${lastSync}</strong>
        &nbsp;|&nbsp;
        Verbundene Konten: <strong>${connectedAccounts.length}</strong>
    </div>

    ${connectedAccounts.length === 0
        ? `<div class="banking-empty"
               style="text-align:center;padding:3rem;background:var(--card-bg,#1e1e1e);border-radius:12px;">
                <div style="font-size:3rem;margin-bottom:1rem;">🏦</div>
                <h3>Noch kein Bankkonto verbunden</h3>
                <p style="color:var(--text-secondary,#aaa);">
                    Verbinde dein Bankkonto über die PSD2-Schnittstelle
                    (Nordigen / GoCardless Bank Account Data API), um Transaktionen
                    automatisch zu importieren und Rechnungen abzugleichen.
                </p>
                <button class="btn btn-primary"
                        onclick="window.bankingService.showConnectBankModal()">
                    + Bankkonto verbinden
                </button>
           </div>`
        : `<div class="banking-accounts"
               style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
                      gap:1rem;margin-bottom:1.5rem;">
                ${connectedAccounts.map(acc => this._renderAccountCard(acc)).join('')}
                <div class="banking-add-card"
                     style="display:flex;align-items:center;justify-content:center;
                            min-height:120px;border:2px dashed var(--border-color,#333);
                            border-radius:12px;cursor:pointer;"
                     onclick="window.bankingService.showConnectBankModal()">
                    <span style="color:var(--text-secondary,#aaa);">+ Konto hinzufügen</span>
                </div>
           </div>
           <div id="banking-transaction-area">
               ${this.transactions.length > 0
                   ? this.renderTransactionList(this.transactions)
                   : '<p style="color:var(--text-secondary,#aaa);">Keine Transaktionen geladen. Klicke auf Synchronisieren.</p>'}
           </div>`
    }
</div>`;
    }

    /**
     * Render an individual account card as an HTML string.
     * @param {Object} acc
     * @returns {string}
     */
    _renderAccountCard(acc) {
        const balance = acc.balance != null
            ? new Intl.NumberFormat('de-DE', {
                  style: 'currency', currency: acc.currency || 'EUR'
              }).format(acc.balance)
            : 'Unbekannt';

        return `
<div class="banking-account-card"
     style="background:var(--card-bg,#1e1e1e);border-radius:12px;
            padding:1rem 1.25rem;border:1px solid var(--border-color,#333);">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;">
        <div>
            <div style="font-weight:600;">${this._escHtml(acc.name || 'Konto')}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary,#aaa);">
                ${this._escHtml(acc.iban || acc.id || '')}
            </div>
        </div>
        <span class="status-badge" style="background:#22c55e;font-size:0.75rem;">Verbunden</span>
    </div>
    <div style="font-size:1.4rem;font-weight:700;margin-top:0.5rem;">${balance}</div>
    <div style="margin-top:0.75rem;display:flex;gap:0.5rem;">
        <button class="btn btn-sm btn-secondary"
                onclick="window.bankingService.fetchAndDisplayTransactions('${this._escHtml(acc.id)}')">
            Transaktionen
        </button>
        <button class="btn btn-sm btn-danger"
                onclick="window.bankingService.disconnectAccount('${this._escHtml(acc.id)}')">
            Trennen
        </button>
    </div>
</div>`;
    }

    // ---------------------------------------------------------------
    // UI — Transaction list
    // ---------------------------------------------------------------

    /**
     * Render a table of transactions, including auto-match badges and
     * action buttons for AI categorisation and invoice payment marking.
     *
     * @param {Array<Object>} transactions
     * @returns {string} HTML string
     */
    renderTransactionList(transactions) {
        if (!transactions || transactions.length === 0) {
            return '<p style="color:var(--text-secondary,#aaa);">Keine Transaktionen vorhanden.</p>';
        }

        const openInvoices = (window.store?.rechnungen || [])
            .filter(r => r.status === 'offen');
        const matches = this.autoMatchToInvoices(transactions, openInvoices);

        const rows = transactions.map((tx, i) => {
            const match      = matches[i];
            const isIncoming = tx.amount > 0;
            const amtFmt     = new Intl.NumberFormat('de-DE', {
                style: 'currency', currency: tx.currency || 'EUR'
            }).format(tx.amount);

            const matchBadge = match?.invoice
                ? `<span class="badge badge-success"
                          style="cursor:pointer;background:#22c55e;color:#fff;
                                 border-radius:4px;padding:2px 6px;font-size:0.8rem;"
                          title="${this._escHtml(match.reasons.join(' | '))}"
                          onclick="window.bankingService.showMatchingModal('${this._escHtml(tx.id)}')">
                       Rechnung: ${this._escHtml(match.invoice.id)} (${match.confidence}%)
                   </span>`
                : '';

            const payBtn = match?.invoice
                ? `<button class="btn btn-sm btn-primary" style="margin-left:0.25rem;"
                           onclick="window.bankingService.confirmMatch(
                               '${this._escHtml(tx.id)}',
                               '${this._escHtml(match.invoice.id)}')">
                       Als bezahlt
                   </button>`
                : '';

            return `
<tr class="banking-tx-row"
    style="border-bottom:1px solid var(--border-color,#333);">
    <td style="padding:0.6rem 0.5rem;white-space:nowrap;">
        ${this._escHtml(tx.date || '')}
    </td>
    <td style="padding:0.6rem 0.5rem;max-width:300px;overflow:hidden;
               text-overflow:ellipsis;white-space:nowrap;"
        title="${this._escHtml(tx.description)}">
        ${this._escHtml(tx.description || tx.debtorName || tx.creditorName || '—')}
    </td>
    <td style="padding:0.6rem 0.5rem;text-align:right;font-weight:600;
               color:${isIncoming ? '#22c55e' : '#ef4444'};">
        ${amtFmt}
    </td>
    <td style="padding:0.6rem 0.5rem;">${matchBadge}</td>
    <td style="padding:0.6rem 0.5rem;">
        <button class="btn btn-sm btn-secondary"
                onclick="window.bankingService.categorizeAndShow('${this._escHtml(tx.id)}')">
            KI-Kategorie
        </button>
        ${payBtn}
    </td>
</tr>`;
        }).join('');

        return `
<div class="banking-transactions">
    <h3 style="margin-bottom:0.75rem;">Transaktionen (${transactions.length})</h3>
    <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
            <thead>
                <tr style="text-align:left;border-bottom:2px solid var(--border-color,#333);
                            color:var(--text-secondary,#aaa);">
                    <th style="padding:0.5rem;">Datum</th>
                    <th style="padding:0.5rem;">Verwendungszweck</th>
                    <th style="padding:0.5rem;text-align:right;">Betrag</th>
                    <th style="padding:0.5rem;">Abgleich</th>
                    <th style="padding:0.5rem;">Aktionen</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>
</div>`;
    }

    // ---------------------------------------------------------------
    // UI — Matching dialog
    // ---------------------------------------------------------------

    /**
     * Render the interactive matching UI for manually assigning a transaction
     * to one of up to 5 candidate open invoices, ordered by confidence score.
     *
     * @param {Object} transaction
     * @param {Array<Object>} invoices — candidate invoice list
     * @returns {string} HTML string
     */
    renderMatchingUI(transaction, invoices) {
        const scored = invoices
            .map(inv => this._scoreMatch(transaction, inv))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5);

        const txAmtFmt = new Intl.NumberFormat('de-DE', {
            style: 'currency', currency: transaction.currency || 'EUR'
        }).format(transaction.amount);

        const rows = scored.map(({ invoice: inv, confidence, reasons }) => {
            const invAmt    = parseFloat(inv.gesamtBrutto ?? inv.gesamtNetto ?? 0);
            const invAmtFmt = new Intl.NumberFormat('de-DE', {
                style: 'currency', currency: 'EUR'
            }).format(invAmt);
            const badgeColor =
                confidence >= 70 ? '#22c55e' :
                confidence >= 40 ? '#f59e0b' : '#6b7280';

            return `
<tr style="border-bottom:1px solid var(--border-color,#333);">
    <td style="padding:0.6rem 0.5rem;">${this._escHtml(inv.id)}</td>
    <td style="padding:0.6rem 0.5rem;">${this._escHtml(inv.kunde?.name || '—')}</td>
    <td style="padding:0.6rem 0.5rem;text-align:right;">${invAmtFmt}</td>
    <td style="padding:0.6rem 0.5rem;">
        <span style="background:${badgeColor};color:#fff;border-radius:4px;
                     padding:2px 6px;font-size:0.8rem;">${confidence}%</span>
    </td>
    <td style="padding:0.6rem 0.5rem;font-size:0.8rem;color:var(--text-secondary,#aaa);">
        ${reasons.map(r => `<div>${this._escHtml(r)}</div>`).join('')}
    </td>
    <td style="padding:0.6rem 0.5rem;">
        <button class="btn btn-sm btn-primary"
                onclick="window.bankingService.confirmMatch(
                    '${this._escHtml(transaction.id)}',
                    '${this._escHtml(inv.id)}');
                    document.getElementById('banking-match-modal')?.remove();">
            Verknüpfen
        </button>
    </td>
</tr>`;
        }).join('');

        return `
<div style="padding:1rem;">
    <h3 style="margin-bottom:0.5rem;">Transaktion zuordnen</h3>
    <div style="background:var(--card-bg,#1e1e1e);border-radius:8px;
                padding:0.75rem;margin-bottom:1rem;font-size:0.875rem;">
        <strong>Datum:</strong> ${this._escHtml(transaction.date || '—')} &nbsp;
        <strong>Betrag:</strong> ${txAmtFmt} &nbsp;
        <strong>Verwendungszweck:</strong>
            ${this._escHtml(transaction.description || '—')}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
        <thead>
            <tr style="text-align:left;border-bottom:2px solid var(--border-color,#333);
                        color:var(--text-secondary,#aaa);">
                <th style="padding:0.5rem;">Rechnung</th>
                <th style="padding:0.5rem;">Kunde</th>
                <th style="padding:0.5rem;text-align:right;">Betrag</th>
                <th style="padding:0.5rem;">Konfidenz</th>
                <th style="padding:0.5rem;">Gründe</th>
                <th style="padding:0.5rem;">Aktion</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>
</div>`;
    }

    // ---------------------------------------------------------------
    // Interactive helpers (called from inline onclick attributes)
    // ---------------------------------------------------------------

    /** Open the institution-picker modal and start the Nordigen flow. */
    async showConnectBankModal() {
        let banks = [];
        try {
            banks = await this.getGermanBanks();
        } catch (err) {
            this._showToast('Bankliste konnte nicht geladen werden: ' + err.message, 'error');
            return;
        }

        const options = banks.slice(0, 200)
            .map(b => `<option value="${this._escHtml(b.id)}">` +
                      `${this._escHtml(b.name)} (${this._escHtml(b.bic || '')})` +
                      `</option>`)
            .join('');

        this._showModal('banking-connect-modal', `
<h3 style="margin-bottom:1rem;">Bankkonto verbinden (PSD2 / Nordigen)</h3>
<p style="color:var(--text-secondary,#aaa);margin-bottom:1rem;font-size:0.875rem;">
    Wähle deine Bank. Du wirst zur sicheren Anmeldeseite deiner Bank
    weitergeleitet (PSD2 Open Banking via Nordigen / GoCardless).
</p>
<label style="display:block;margin-bottom:0.5rem;font-weight:600;">Bank auswählen</label>
<select id="banking-institution-select"
        style="width:100%;padding:0.6rem;border-radius:6px;
               border:1px solid var(--border-color,#333);
               background:var(--input-bg,#111);color:inherit;margin-bottom:1rem;">
    <option value="">-- Bank auswählen --</option>
    ${options}
</select>
<div style="display:flex;gap:0.5rem;justify-content:flex-end;">
    <button class="btn btn-secondary"
            onclick="document.getElementById('banking-connect-modal')?.remove()">
        Abbrechen
    </button>
    <button class="btn btn-primary"
            onclick="window.bankingService._doConnectBank()">
        Verbinden
    </button>
</div>`);
    }

    /** Trigger the Nordigen requisition for the selected institution. */
    async _doConnectBank() {
        const sel = document.getElementById('banking-institution-select');
        if (!sel?.value) {
            this._showToast('Bitte eine Bank auswählen', 'warning');
            return;
        }
        try {
            await this.connectBank(sel.value, 'DE');
            document.getElementById('banking-connect-modal')?.remove();
            this._showToast(
                'Bankverbindung gestartet. Bitte schließe den Autorisierungsprozess in deiner Bank ab.',
                'info'
            );
        } catch (err) {
            this._showToast('Fehler beim Verbinden: ' + err.message, 'error');
        }
    }

    /** Open the Nordigen API key settings modal. */
    showSettingsModal() {
        const secretId  = this.config.nordigenSecretId  || '';
        const secretKey = this.config.nordigenApiKey    || '';
        this._showModal('banking-settings-modal', `
<h3 style="margin-bottom:1rem;">⚙️ Banking-Einstellungen</h3>
<label style="display:block;margin-bottom:0.25rem;font-weight:600;">
    Nordigen / GoCardless Secret ID
</label>
<input id="banking-secret-id" type="text" value="${this._escHtml(secretId)}"
    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    style="width:100%;padding:0.6rem;border-radius:6px;
           border:1px solid var(--border-color,#333);
           background:var(--input-bg,#111);color:inherit;margin-bottom:0.75rem;">
<label style="display:block;margin-bottom:0.25rem;font-weight:600;">
    Nordigen / GoCardless Secret Key
</label>
<input id="banking-secret-key" type="password" value="${this._escHtml(secretKey)}"
    placeholder="Dein geheimer API-Schlüssel"
    style="width:100%;padding:0.6rem;border-radius:6px;
           border:1px solid var(--border-color,#333);
           background:var(--input-bg,#111);color:inherit;margin-bottom:1rem;">
<p style="font-size:0.8rem;color:var(--text-secondary,#aaa);margin-bottom:1rem;">
    API-Schlüssel werden als Supabase Edge Function Secrets gespeichert —
    niemals im Browser oder Client-Code.
    <a href="https://bankaccountdata.gocardless.com/" target="_blank"
       rel="noopener noreferrer"
       style="color:var(--accent,#6366f1);">
        GoCardless-Konto erstellen
    </a>
</p>
<div style="display:flex;gap:0.5rem;justify-content:flex-end;">
    <button class="btn btn-secondary"
            onclick="document.getElementById('banking-settings-modal')?.remove()">
        Abbrechen
    </button>
    <button class="btn btn-primary"
            onclick="window.bankingService._saveSettings()">
        Speichern
    </button>
</div>`);
    }

    /** Persist Nordigen API credentials from the settings modal. */
    _saveSettings() {
        const secretId  = document.getElementById('banking-secret-id')?.value  || '';
        const secretKey = document.getElementById('banking-secret-key')?.value || '';
        this.saveConfig({
            ...this.config,
            nordigenSecretId: secretId,
            nordigenApiKey:   secretKey,
        });
        document.getElementById('banking-settings-modal')?.remove();
        this._showToast('Einstellungen gespeichert', 'success');
    }

    /**
     * Fetch transactions for a single account and refresh the transaction area.
     * @param {string} accountId
     */
    async fetchAndDisplayTransactions(accountId) {
        try {
            this._showToast('Lade Transaktionen…', 'info');
            const dateTo   = new Date().toISOString().slice(0, 10);
            const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                .toISOString().slice(0, 10);
            const txs = await this.fetchTransactions(accountId, dateFrom, dateTo);
            const area = document.getElementById('banking-transaction-area');
            if (area) area.innerHTML = this.renderTransactionList(txs);
            this._showToast(`${txs.length} Transaktionen geladen`, 'success');
        } catch (err) {
            this._showToast('Fehler beim Laden: ' + err.message, 'error');
        }
    }

    /** Sync all connected accounts (last 90 days) and refresh the UI. */
    async syncAllAccounts() {
        const accounts = this.config.accounts || [];
        if (accounts.length === 0) {
            this._showToast('Keine Konten verbunden', 'warning');
            return;
        }
        let allTx = [];
        for (const acc of accounts) {
            try {
                const dateTo   = new Date().toISOString().slice(0, 10);
                const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                    .toISOString().slice(0, 10);
                const txs = await this.fetchTransactions(acc.id, dateFrom, dateTo);
                allTx = allTx.concat(txs);
            } catch (err) {
                console.warn(`[BankingService] Sync fehlgeschlagen für ${acc.id}:`, err.message);
            }
        }
        this.saveConfig({ ...this.config, lastSync: new Date().toISOString() });
        const area = document.getElementById('banking-transaction-area');
        if (area) area.innerHTML = this.renderTransactionList(allTx);
        this._showToast(`Sync abgeschlossen: ${allTx.length} Transaktionen`, 'success');
    }

    /** Open the matching modal for the given transaction ID. */
    showMatchingModal(transactionId) {
        const tx = this.transactions.find(t => t.id === transactionId);
        if (!tx) return;
        const openInvoices = (window.store?.rechnungen || [])
            .filter(r => r.status === 'offen');
        this._showModal('banking-match-modal', this.renderMatchingUI(tx, openInvoices));
    }

    /**
     * Confirm a transaction-to-invoice match: mark invoice paid, refresh UI.
     * @param {string} transactionId
     * @param {string} invoiceId
     */
    confirmMatch(transactionId, invoiceId) {
        const tx = this.transactions.find(t => t.id === transactionId);
        if (!tx) {
            this._showToast('Transaktion nicht gefunden', 'error');
            return;
        }
        const ok = this.markInvoicePaid(invoiceId, tx);
        if (ok) {
            this._showToast(`Rechnung ${invoiceId} als bezahlt markiert`, 'success');
            const area = document.getElementById('banking-transaction-area');
            if (area && this.transactions.length > 0) {
                area.innerHTML = this.renderTransactionList(this.transactions);
            }
        }
    }

    /**
     * Run AI categorisation for a transaction and show the result in a modal.
     * @param {string} transactionId
     */
    async categorizeAndShow(transactionId) {
        const tx = this.transactions.find(t => t.id === transactionId);
        if (!tx) return;
        try {
            this._showToast('KI kategorisiert…', 'info');
            const result = await this.categorizeTransaction(tx);
            this._showModal('banking-category-modal', `
<h3 style="margin-bottom:1rem;">KI-Buchungskategorie (SKR03)</h3>
<table style="width:100%;border-collapse:collapse;font-size:0.875rem;">
    <tr>
        <td style="padding:0.4rem 0;font-weight:600;width:35%;">Kategorie</td>
        <td>${this._escHtml(result.category)}</td>
    </tr>
    <tr>
        <td style="padding:0.4rem 0;font-weight:600;">SKR03-Konto</td>
        <td>${this._escHtml(String(result.account))}</td>
    </tr>
    <tr>
        <td style="padding:0.4rem 0;font-weight:600;">Konfidenz</td>
        <td>${result.confidence}%</td>
    </tr>
    <tr>
        <td style="padding:0.4rem 0;font-weight:600;">Begründung</td>
        <td>${this._escHtml(result.explanation)}</td>
    </tr>
</table>
<div style="display:flex;justify-content:flex-end;margin-top:1rem;">
    <button class="btn btn-secondary"
            onclick="document.getElementById('banking-category-modal')?.remove()">
        Schließen
    </button>
</div>`);
        } catch (err) {
            this._showToast('KI-Kategorisierung fehlgeschlagen: ' + err.message, 'error');
        }
    }

    /**
     * Remove a connected account from config.
     * @param {string} accountId
     */
    disconnectAccount(accountId) {
        if (!confirm('Dieses Konto wirklich trennen?')) return;
        const accounts = (this.config.accounts || []).filter(a => a.id !== accountId);
        this.saveConfig({ ...this.config, accounts });
        this._showToast('Konto getrennt', 'success');
        // Re-render dashboard if it is currently visible
        const dashboard = document.querySelector('.banking-dashboard');
        if (dashboard?.parentElement?.id) {
            this.renderDashboard(dashboard.parentElement.id);
        }
    }

    // ---------------------------------------------------------------
    // Generic modal / toast helpers
    // ---------------------------------------------------------------

    /**
     * Render content inside a full-screen modal overlay.
     * Clicking the backdrop closes the modal.
     * @param {string} id       — unique DOM id for the overlay element
     * @param {string} innerHtml — HTML content for the modal body
     */
    _showModal(id, innerHtml) {
        document.getElementById(id)?.remove();
        const overlay     = document.createElement('div');
        overlay.id        = id;
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:9999',
            'display:flex', 'align-items:center', 'justify-content:center',
            'background:rgba(0,0,0,0.65)',
        ].join(';');
        overlay.innerHTML = `
<div style="background:var(--bg-secondary,#1a1a2e);border-radius:12px;padding:1.5rem;
            max-width:700px;width:90%;max-height:85vh;overflow-y:auto;
            box-shadow:0 8px 32px rgba(0,0,0,0.5);">
    ${innerHtml}
</div>`;
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove();
        });
        document.body.appendChild(overlay);
    }

    /**
     * Show a toast notification.
     * Delegates to the global showToast / AppUtils.showToast if available,
     * otherwise falls back to console.
     * @param {string} message
     * @param {'success'|'error'|'warning'|'info'} type
     */
    _showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else if (typeof AppUtils?.showToast === 'function') {
            AppUtils.showToast(message, type);
        } else {
            console.info(`[BankingService][${type}] ${message}`);
        }
    }

    /**
     * Minimal HTML entity escaping to prevent XSS in template literals.
     * @param {string} str
     * @returns {string}
     */
    _escHtml(str) {
        return String(str)
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;')
            .replace(/'/g,  '&#39;');
    }
}

// Expose as a global singleton so inline onclick handlers can reach it
window.bankingService = new BankingService();
