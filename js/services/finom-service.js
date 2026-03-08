/* ============================================
   Finom Banking & SEPA Payment Service
   Eingangsrechnungen bezahlen, SEPA XML generieren,
   Auto-Pay Regeln verwalten
   ============================================ */

(function () {
    'use strict';

    // ============================================
    // IBAN Validation (ISO 13616)
    // ============================================

    const IBAN_LENGTHS = {
        DE: 22, AT: 20, CH: 21, FR: 27, IT: 27, ES: 24, NL: 18,
        BE: 16, LU: 20, PT: 25, IE: 22, FI: 18, GR: 27, CZ: 24,
        PL: 28, DK: 18, SE: 24, NO: 15, GB: 22, HU: 28, SK: 24,
        HR: 21, SI: 19, BG: 22, RO: 24, LT: 20, LV: 21, EE: 20
    };

    function normalizeIban(iban) {
        return (iban || '').replace(/\s+/g, '').toUpperCase();
    }

    function validateIban(iban) {
        const cleaned = normalizeIban(iban);
        if (!cleaned || cleaned.length < 5) {
            return { valid: false, error: 'IBAN zu kurz' };
        }

        const country = cleaned.substring(0, 2);
        const expectedLength = IBAN_LENGTHS[country];

        if (!expectedLength) {
            return { valid: false, error: `Unbekanntes Land: ${country}` };
        }
        if (cleaned.length !== expectedLength) {
            return { valid: false, error: `IBAN fuer ${country} muss ${expectedLength} Zeichen haben, hat ${cleaned.length}` };
        }
        if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) {
            return { valid: false, error: 'Ungueltiges IBAN-Format' };
        }

        // MOD-97 check (ISO 7064)
        const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
        const numeric = rearranged.replace(/[A-Z]/g, ch => (ch.charCodeAt(0) - 55).toString());

        // BigInt-free modulo for large numbers
        let remainder = 0;
        for (let i = 0; i < numeric.length; i++) {
            remainder = (remainder * 10 + parseInt(numeric[i], 10)) % 97;
        }

        if (remainder !== 1) {
            return { valid: false, error: 'IBAN Pruefsumme ungueltig' };
        }

        return { valid: true, country, bic: null };
    }

    function formatIban(iban) {
        const cleaned = normalizeIban(iban);
        return cleaned.replace(/(.{4})/g, '$1 ').trim();
    }

    // ============================================
    // XML Escaping
    // ============================================

    function escapeXml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // Restrict to SEPA-allowed characters (EPC Best Practices)
    function sepaClean(str) {
        if (!str) return '';
        return String(str)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // strip diacritics
            .replace(/[^a-zA-Z0-9 \/\-?:().,'+]/g, '')
            .substring(0, 140);
    }

    // ============================================
    // Helper: Supabase Client
    // ============================================

    function supabase() {
        return window.supabaseClient?.client || window.supabaseClient?.getClient?.();
    }

    function isOnline() {
        return !!(supabase() && window.supabaseClient?.isConfigured?.());
    }

    function showToast(msg, type) {
        if (window.showToast) {
            window.showToast(msg, type);
        } else if (window.AppUtils?.showToast) {
            window.AppUtils.showToast(msg, type);
        }
    }

    function handleError(error, context) {
        console.error(`[FinomService] ${context}:`, error);
        if (window.errorHandler?.handle) {
            window.errorHandler.handle(error, `FinomService.${context}`, true);
        } else {
            showToast('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.', 'error');
        }
    }

    // ============================================
    // Storage Keys
    // ============================================

    const KEYS = {
        CONFIG: 'finom_config',
        AUTO_PAY_RULES: 'finom_auto_pay_rules',
        PAYMENT_LOG: 'finom_payment_log'
    };

    function loadJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function saveJson(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn(`[FinomService] localStorage write failed for ${key}:`, e);
        }
    }

    // ============================================
    // Finom Service Class
    // ============================================

    class FinomService {
        constructor() {
            this.config = loadJson(KEYS.CONFIG, {});
            this.autoPayRules = loadJson(KEYS.AUTO_PAY_RULES, []);
            this.paymentLog = loadJson(KEYS.PAYMENT_LOG, []);
            this.TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
        }

        // ========================================
        // Configuration
        // ========================================

        isConfigured() {
            return !!(this.config.apiToken && this.config.orgId);
        }

        configure({ apiToken, orgId, firmenName, firmenIban, firmenBic }) {
            if (!apiToken || !orgId) {
                showToast('API Token und Organisations-ID erforderlich', 'error');
                return false;
            }

            if (firmenIban) {
                const check = validateIban(firmenIban);
                if (!check.valid) {
                    showToast(`Eigene IBAN ungueltig: ${check.error}`, 'error');
                    return false;
                }
            }

            this.config = {
                apiToken,
                orgId,
                firmenName: firmenName || 'FreyAI Visions',
                firmenIban: normalizeIban(firmenIban || ''),
                firmenBic: (firmenBic || '').replace(/\s+/g, '').toUpperCase(),
                configuredAt: new Date().toISOString()
            };

            saveJson(KEYS.CONFIG, this.config);
            showToast('Finom-Konfiguration gespeichert', 'success');
            return true;
        }

        getConfig() {
            return {
                ...this.config,
                apiToken: this.config.apiToken ? '***' + this.config.apiToken.slice(-4) : null
            };
        }

        clearConfig() {
            this.config = {};
            localStorage.removeItem(KEYS.CONFIG);
            showToast('Finom-Konfiguration entfernt', 'info');
        }

        // ========================================
        // Payable Invoices (Eingangsrechnungen)
        // ========================================

        async getPayableInvoices() {
            try {
                const invoices = [];

                // Source 1: Purchase Orders from Supabase
                if (isOnline()) {
                    const { data: pos, error } = await supabase()
                        .from('purchase_orders')
                        .select('*')
                        .eq('tenant_id', this.TENANT_ID)
                        .in('status', ['bestaetigt', 'geliefert', 'teilgeliefert', 'offen'])
                        .order('created_at', { ascending: false });

                    if (error) throw error;

                    if (pos) {
                        for (const po of pos) {
                            // Skip already fully paid
                            if (this._isAlreadyPaid(po.id)) continue;

                            const betrag = po.brutto || po.netto || 0;
                            if (betrag <= 0) continue;

                            invoices.push({
                                id: po.id,
                                quelle: 'purchase_order',
                                nummer: po.nummer || po.id,
                                lieferant: po.lieferant_name || 'Unbekannt',
                                lieferantEmail: po.lieferant_email || '',
                                lieferantIban: po.lieferant_iban || '',
                                lieferantBic: po.lieferant_bic || '',
                                betrag: betrag,
                                waehrung: 'EUR',
                                faelligAm: po.faellig_am || po.lieferdatum || null,
                                verwendungszweck: `PO ${po.nummer || po.id}`,
                                status: this._getPaymentStatus(po.id),
                                erstelltAm: po.created_at
                            });
                        }
                    }
                }

                // Source 2: Buchungen (bookkeeping entries) marked as Ausgabe
                if (isOnline()) {
                    const { data: buchungen, error } = await supabase()
                        .from('buchungen')
                        .select('*')
                        .eq('tenant_id', this.TENANT_ID)
                        .eq('typ', 'ausgabe')
                        .eq('bezahlt', false)
                        .order('datum', { ascending: false });

                    if (!error && buchungen) {
                        for (const b of buchungen) {
                            if (this._isAlreadyPaid(b.id)) continue;

                            const betrag = Math.abs(b.betrag || 0);
                            if (betrag <= 0) continue;

                            invoices.push({
                                id: b.id,
                                quelle: 'buchung',
                                nummer: b.belegnummer || b.id,
                                lieferant: b.empfaenger || b.beschreibung || 'Unbekannt',
                                lieferantEmail: '',
                                lieferantIban: b.empfaenger_iban || '',
                                lieferantBic: b.empfaenger_bic || '',
                                betrag: betrag,
                                waehrung: 'EUR',
                                faelligAm: b.faellig_am || b.datum || null,
                                verwendungszweck: b.beschreibung || `Buchung ${b.belegnummer || b.id}`,
                                status: this._getPaymentStatus(b.id),
                                erstelltAm: b.created_at || b.datum
                            });
                        }
                    }
                }

                // Sort: overdue first, then by due date
                const now = new Date().toISOString().split('T')[0];
                invoices.sort((a, b) => {
                    const aOverdue = a.faelligAm && a.faelligAm < now ? 1 : 0;
                    const bOverdue = b.faelligAm && b.faelligAm < now ? 1 : 0;
                    if (aOverdue !== bOverdue) return bOverdue - aOverdue;
                    return (a.faelligAm || '9999') < (b.faelligAm || '9999') ? -1 : 1;
                });

                return { success: true, invoices };
            } catch (error) {
                handleError(error, 'getPayableInvoices');
                return { success: false, error: error.message, invoices: [] };
            }
        }

        // ========================================
        // Payment Tracking
        // ========================================

        async markAsPaid(invoiceId, { amount, date, reference, method, source }) {
            try {
                if (!invoiceId) throw new Error('Rechnungs-ID fehlt');
                if (!amount || amount <= 0) throw new Error('Betrag muss groesser als 0 sein');

                const zahlung = {
                    id: 'fzahl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8),
                    invoiceId,
                    betrag: parseFloat(amount),
                    datum: date || new Date().toISOString().split('T')[0],
                    referenz: reference || '',
                    methode: method || 'ueberweisung',
                    source: source || 'unknown',
                    erfasstAm: new Date().toISOString()
                };

                this.paymentLog.push(zahlung);
                saveJson(KEYS.PAYMENT_LOG, this.paymentLog);

                if (isOnline()) {
                    const table = source === 'purchase_order' ? 'purchase_orders' : 'buchungen';
                    const updateData = source === 'purchase_order'
                        ? { status: 'bezahlt', bezahlt_am: zahlung.datum }
                        : { bezahlt: true, bezahlt_am: zahlung.datum };

                    const { error } = await supabase()
                        .from(table)
                        .update(updateData)
                        .eq('id', invoiceId);

                    if (error) {
                        console.warn(`[FinomService] Update ${table} fehlgeschlagen:`, error.message);
                    }
                }

                showToast(`Zahlung von ${parseFloat(amount).toFixed(2)} EUR erfasst`, 'success');
                return { success: true, zahlung };
            } catch (error) {
                handleError(error, 'markAsPaid');
                return { success: false, error: error.message };
            }
        }

        _isAlreadyPaid(invoiceId) {
            return this.paymentLog.some(p => p.invoiceId === invoiceId);
        }

        _getPaymentStatus(invoiceId) {
            const zahlung = this.paymentLog.find(p => p.invoiceId === invoiceId);
            if (zahlung) return 'bezahlt';

            return 'offen';
        }

        getPaymentLog() {
            return [...this.paymentLog].sort((a, b) =>
                (b.erfasstAm || '') > (a.erfasstAm || '') ? 1 : -1
            );
        }

        // ========================================
        // SEPA XML Generation (pain.001.003.03)
        // ========================================

        generateSepaXml(payments) {
            if (!payments || payments.length === 0) {
                showToast('Keine Zahlungen ausgewaehlt', 'error');
                return null;
            }

            // Validate own IBAN
            const eigenIban = normalizeIban(this.config.firmenIban || '');
            if (!eigenIban) {
                showToast('Eigene IBAN nicht konfiguriert. Bitte Finom-Einstellungen pruefen.', 'error');
                return null;
            }
            const eigenCheck = validateIban(eigenIban);
            if (!eigenCheck.valid) {
                showToast(`Eigene IBAN ungueltig: ${eigenCheck.error}`, 'error');
                return null;
            }

            // Validate all payments
            const errors = [];
            const validPayments = [];

            for (let i = 0; i < payments.length; i++) {
                const p = payments[i];
                const nr = i + 1;

                if (!p.empfaengerName) {
                    errors.push(`Zahlung ${nr}: Empfaenger-Name fehlt`);
                    continue;
                }
                if (!p.empfaengerIban) {
                    errors.push(`Zahlung ${nr} (${p.empfaengerName}): IBAN fehlt`);
                    continue;
                }

                const ibanCheck = validateIban(p.empfaengerIban);
                if (!ibanCheck.valid) {
                    errors.push(`Zahlung ${nr} (${p.empfaengerName}): ${ibanCheck.error}`);
                    continue;
                }

                if (!p.betrag || p.betrag <= 0) {
                    errors.push(`Zahlung ${nr} (${p.empfaengerName}): Betrag ungueltig`);
                    continue;
                }

                validPayments.push({
                    endToEndId: sepaClean(p.endToEndId || `FINOM-${Date.now()}-${nr}`).substring(0, 35),
                    betrag: parseFloat(p.betrag).toFixed(2),
                    empfaengerName: sepaClean(p.empfaengerName).substring(0, 70),
                    empfaengerIban: normalizeIban(p.empfaengerIban),
                    empfaengerBic: (p.empfaengerBic || '').replace(/\s+/g, '').toUpperCase(),
                    verwendungszweck: sepaClean(p.verwendungszweck || 'Zahlung').substring(0, 140),
                    ausfuehrungsdatum: p.ausfuehrungsdatum || new Date().toISOString().split('T')[0]
                });
            }

            if (errors.length > 0) {
                console.warn('[FinomService] SEPA Validierungsfehler:', errors);
                if (validPayments.length === 0) {
                    showToast(`Keine gueltige Zahlung: ${errors[0]}`, 'error');
                    return null;
                }
                showToast(`${errors.length} Zahlung(en) uebersprungen (ungueltig)`, 'warning');
            }

            // Build SEPA pain.001.003.03 XML
            const msgId = `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
            const pmtInfId = `PMT-${Date.now()}`;
            const creationDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
            const nbOfTxs = validPayments.length;
            const ctrlSum = validPayments.reduce((sum, p) => sum + parseFloat(p.betrag), 0).toFixed(2);
            const firmenName = sepaClean(this.config.firmenName || 'FreyAI Visions').substring(0, 70);
            const firmenBic = this.config.firmenBic || '';

            // Determine execution date (earliest requested or today)
            const requestedDatum = validPayments
                .map(p => p.ausfuehrungsdatum)
                .sort()[0] || new Date().toISOString().split('T')[0];

            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml += '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03"';
            xml += ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
            xml += ' xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03 pain.001.003.03.xsd">\n';
            xml += '  <CstmrCdtTrfInitn>\n';

            // Group Header
            xml += '    <GrpHdr>\n';
            xml += `      <MsgId>${escapeXml(msgId)}</MsgId>\n`;
            xml += `      <CreDtTm>${creationDateTime}</CreDtTm>\n`;
            xml += `      <NbOfTxs>${nbOfTxs}</NbOfTxs>\n`;
            xml += `      <CtrlSum>${ctrlSum}</CtrlSum>\n`;
            xml += '      <InitgPty>\n';
            xml += `        <Nm>${escapeXml(firmenName)}</Nm>\n`;
            xml += '      </InitgPty>\n';
            xml += '    </GrpHdr>\n';

            // Payment Information Block
            xml += '    <PmtInf>\n';
            xml += `      <PmtInfId>${escapeXml(pmtInfId)}</PmtInfId>\n`;
            xml += '      <PmtMtd>TRF</PmtMtd>\n'; // Transfer
            xml += '      <BtchBookg>true</BtchBookg>\n';
            xml += `      <NbOfTxs>${nbOfTxs}</NbOfTxs>\n`;
            xml += `      <CtrlSum>${ctrlSum}</CtrlSum>\n`;

            // Payment Type
            xml += '      <PmtTpInf>\n';
            xml += '        <InstrPrty>NORM</InstrPrty>\n';
            xml += '        <SvcLvl>\n';
            xml += '          <Cd>SEPA</Cd>\n';
            xml += '        </SvcLvl>\n';
            xml += '      </PmtTpInf>\n';

            // Requested Execution Date
            xml += `      <ReqdExctnDt>${requestedDatum}</ReqdExctnDt>\n`;

            // Debtor (Auftraggeber)
            xml += '      <Dbtr>\n';
            xml += `        <Nm>${escapeXml(firmenName)}</Nm>\n`;
            xml += '      </Dbtr>\n';
            xml += '      <DbtrAcct>\n';
            xml += '        <Id>\n';
            xml += `          <IBAN>${eigenIban}</IBAN>\n`;
            xml += '        </Id>\n';
            xml += '      </DbtrAcct>\n';

            // Debtor Agent (Bank)
            xml += '      <DbtrAgt>\n';
            xml += '        <FinInstnId>\n';
            if (firmenBic) {
                xml += `          <BIC>${escapeXml(firmenBic)}</BIC>\n`;
            } else {
                xml += '          <Othr>\n';
                xml += '            <Id>NOTPROVIDED</Id>\n';
                xml += '          </Othr>\n';
            }
            xml += '        </FinInstnId>\n';
            xml += '      </DbtrAgt>\n';

            xml += '      <ChrgBr>SLEV</ChrgBr>\n'; // Shared charges

            // Individual Transactions
            for (const payment of validPayments) {
                xml += '      <CdtTrfTxInf>\n';

                // Payment ID
                xml += '        <PmtId>\n';
                xml += `          <EndToEndId>${escapeXml(payment.endToEndId)}</EndToEndId>\n`;
                xml += '        </PmtId>\n';

                // Amount
                xml += '        <Amt>\n';
                xml += `          <InstdAmt Ccy="EUR">${payment.betrag}</InstdAmt>\n`;
                xml += '        </Amt>\n';

                // Creditor Agent (Empfaengerbank)
                if (payment.empfaengerBic) {
                    xml += '        <CdtrAgt>\n';
                    xml += '          <FinInstnId>\n';
                    xml += `            <BIC>${escapeXml(payment.empfaengerBic)}</BIC>\n`;
                    xml += '          </FinInstnId>\n';
                    xml += '        </CdtrAgt>\n';
                }

                // Creditor (Empfaenger)
                xml += '        <Cdtr>\n';
                xml += `          <Nm>${escapeXml(payment.empfaengerName)}</Nm>\n`;
                xml += '        </Cdtr>\n';

                // Creditor Account
                xml += '        <CdtrAcct>\n';
                xml += '          <Id>\n';
                xml += `            <IBAN>${payment.empfaengerIban}</IBAN>\n`;
                xml += '          </Id>\n';
                xml += '        </CdtrAcct>\n';

                // Remittance Info (Verwendungszweck)
                xml += '        <RmtInf>\n';
                xml += `          <Ustrd>${escapeXml(payment.verwendungszweck)}</Ustrd>\n`;
                xml += '        </RmtInf>\n';

                xml += '      </CdtTrfTxInf>\n';
            }

            xml += '    </PmtInf>\n';
            xml += '  </CstmrCdtTrfInitn>\n';
            xml += '</Document>';

            return {
                xml,
                msgId,
                nbOfTxs,
                ctrlSum,
                validPayments,
                skippedCount: payments.length - validPayments.length,
                errors
            };
        }

        downloadSepaXml(payments) {
            const result = this.generateSepaXml(payments);
            if (!result) return null;

            const blob = new Blob([result.xml], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const datum = new Date().toISOString().split('T')[0];
            const filename = `SEPA_Sammelueberweisung_${datum}_${result.nbOfTxs}Zahlungen.xml`;

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 200);

            showToast(
                `SEPA XML mit ${result.nbOfTxs} Zahlung(en) heruntergeladen (${result.ctrlSum} EUR)`,
                'success'
            );

            return result;
        }

        /**
         * Convenience: Build SEPA payment array from payable invoices.
         * Accepts the invoice objects returned by getPayableInvoices().
         */
        invoicesToSepaPayments(invoices) {
            return invoices
                .filter(inv => inv.lieferantIban && inv.betrag > 0)
                .map(inv => ({
                    endToEndId: `FV-${(inv.nummer || inv.id).toString().substring(0, 25)}`,
                    betrag: inv.betrag,
                    empfaengerName: inv.lieferant,
                    empfaengerIban: inv.lieferantIban,
                    empfaengerBic: inv.lieferantBic || '',
                    verwendungszweck: inv.verwendungszweck || `Rechnung ${inv.nummer || inv.id}`,
                    ausfuehrungsdatum: inv.faelligAm || new Date().toISOString().split('T')[0]
                }));
        }

        // ========================================
        // Auto-Pay Rules
        // ========================================

        getAutoPayRules() {
            return [...this.autoPayRules];
        }

        saveAutoPayRule({ id, supplierId, supplierName, maxAmount, payWithinDays, active }) {
            try {
                if (!supplierName && !supplierId) {
                    showToast('Lieferant muss angegeben werden', 'error');
                    return { success: false };
                }
                if (!maxAmount || maxAmount <= 0) {
                    showToast('Maximalbetrag muss groesser als 0 sein', 'error');
                    return { success: false };
                }

                const rule = {
                    id: id || 'apr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                    supplierId: supplierId || null,
                    supplierName: supplierName || '',
                    maxAmount: parseFloat(maxAmount),
                    payWithinDays: parseInt(payWithinDays, 10) || 14,
                    active: active !== false,
                    erstelltAm: new Date().toISOString(),
                    letzteAusfuehrung: null
                };

                const existingIdx = this.autoPayRules.findIndex(r => r.id === rule.id);
                if (existingIdx >= 0) {
                    // Preserve creation date on update
                    rule.erstelltAm = this.autoPayRules[existingIdx].erstelltAm;
                    this.autoPayRules[existingIdx] = rule;
                } else {
                    this.autoPayRules.push(rule);
                }

                saveJson(KEYS.AUTO_PAY_RULES, this.autoPayRules);
                showToast(`Auto-Pay Regel fuer "${rule.supplierName}" gespeichert`, 'success');
                return { success: true, rule };
            } catch (error) {
                handleError(error, 'saveAutoPayRule');
                return { success: false, error: error.message };
            }
        }

        deleteAutoPayRule(ruleId) {
            const before = this.autoPayRules.length;
            this.autoPayRules = this.autoPayRules.filter(r => r.id !== ruleId);

            if (this.autoPayRules.length < before) {
                saveJson(KEYS.AUTO_PAY_RULES, this.autoPayRules);
                showToast('Auto-Pay Regel geloescht', 'success');
                return { success: true };
            }
            return { success: false, error: 'Regel nicht gefunden' };
        }

        async checkAndExecuteAutoPayRules() {
            try {
                const activeRules = this.autoPayRules.filter(r => r.active);
                if (activeRules.length === 0) {
                    return { success: true, matched: [], message: 'Keine aktiven Regeln' };
                }

                const result = await this.getPayableInvoices();
                if (!result.success || result.invoices.length === 0) {
                    return { success: true, matched: [], message: 'Keine offenen Rechnungen' };
                }

                const today = new Date();
                const matched = [];

                for (const invoice of result.invoices) {
                    if (invoice.status === 'bezahlt') continue;

                    for (const rule of activeRules) {
                        const nameMatch = rule.supplierName &&
                            invoice.lieferant.toLowerCase().includes(rule.supplierName.toLowerCase());
                        const idMatch = rule.supplierId && invoice.id === rule.supplierId;

                        if (!nameMatch && !idMatch) continue;
                        if (invoice.betrag > rule.maxAmount) continue;

                        // Check if within payment window
                        if (invoice.faelligAm) {
                            const faellig = new Date(invoice.faelligAm);
                            const diff = Math.ceil((faellig - today) / (1000 * 60 * 60 * 24));

                            // Only match if due within the configured window
                            if (diff > rule.payWithinDays) continue;
                        }

                        matched.push({
                            invoice,
                            rule,
                            empfohleneDurchfuehrung: invoice.faelligAm || today.toISOString().split('T')[0]
                        });
                        break; // One rule match per invoice is enough
                    }
                }

                if (matched.length > 0) {
                    // Update last execution timestamp on matched rules
                    const matchedRuleIds = new Set(matched.map(m => m.rule.id));
                    for (const rule of this.autoPayRules) {
                        if (matchedRuleIds.has(rule.id)) {
                            rule.letzteAusfuehrung = new Date().toISOString();
                        }
                    }
                    saveJson(KEYS.AUTO_PAY_RULES, this.autoPayRules);
                }

                return {
                    success: true,
                    matched,
                    message: matched.length > 0
                        ? `${matched.length} Rechnung(en) stimmen mit Auto-Pay Regeln ueberein`
                        : 'Keine Uebereinstimmungen gefunden'
                };
            } catch (error) {
                handleError(error, 'checkAndExecuteAutoPayRules');
                return { success: false, matched: [], error: error.message };
            }
        }

        // ========================================
        // Payment Statistics
        // ========================================

        async getPaymentStats() {
            try {
                const result = await this.getPayableInvoices();
                const invoices = result.invoices || [];

                const bezahlt = this.paymentLog;
                const offen = invoices.filter(i => i.status !== 'bezahlt');
                const today = new Date().toISOString().split('T')[0];
                const ueberfaellig = offen.filter(i => i.faelligAm && i.faelligAm < today);

                const totalPaid = bezahlt.reduce((s, p) => s + (p.betrag || 0), 0);
                const totalPending = offen.reduce((s, i) => s + (i.betrag || 0), 0);
                const totalOverdue = ueberfaellig.reduce((s, i) => s + (i.betrag || 0), 0);

                // Average payment time (days between creation and payment)
                let avgPaymentTime = 0;
                if (bezahlt.length > 0) {
                    const times = bezahlt.map(p => {
                        const inv = invoices.find(i => i.id === p.invoiceId);
                        if (inv?.erstelltAm && p.datum) {
                            const created = new Date(inv.erstelltAm);
                            const paid = new Date(p.datum);
                            return Math.max(0, Math.ceil((paid - created) / (1000 * 60 * 60 * 24)));
                        }
                        return null;
                    }).filter(t => t !== null);

                    if (times.length > 0) {
                        avgPaymentTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
                    }
                }

                return {
                    totalPaid: Math.round(totalPaid * 100) / 100,
                    totalPending: Math.round(totalPending * 100) / 100,
                    totalOverdue: Math.round(totalOverdue * 100) / 100,
                    anzahlBezahlt: bezahlt.length,
                    anzahlOffen: offen.length,
                    anzahlUeberfaellig: ueberfaellig.length,
                    avgPaymentTime,
                    autoPayRulesActive: this.autoPayRules.filter(r => r.active).length
                };
            } catch (error) {
                handleError(error, 'getPaymentStats');
                return {
                    totalPaid: 0, totalPending: 0, totalOverdue: 0,
                    anzahlBezahlt: 0, anzahlOffen: 0, anzahlUeberfaellig: 0,
                    avgPaymentTime: 0, autoPayRulesActive: 0
                };
            }
        }

        // ========================================
        // IBAN Utilities (exposed for UI usage)
        // ========================================

        validateIban(iban) {
            return validateIban(iban);
        }

        formatIban(iban) {
            return formatIban(iban);
        }
    }

    // ============================================
    // Instantiate and attach to window
    // ============================================

    window.finomService = new FinomService();

})();
