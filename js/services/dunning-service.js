/* ============================================
   Dunning Service - Mahnwesen mit Eskalation
   Automatische Zahlungserinnerungen und Mahnungen
   ============================================ */

class DunningService {
    constructor() {
        this.mahnungen = [];
        this.inkassoFaelle = [];
        this._ready = false;
        this._tenantId = 'a0000000-0000-0000-0000-000000000001';

        // Eskalationsstufen (Tage nach Faelligkeitsdatum)
        this.eskalationsStufen = [
            { tag: 0, typ: 'rechnung', name: 'Rechnung erstellt', gebuehr: 0 },
            { tag: 7, typ: 'erinnerung', name: 'Zahlungserinnerung', gebuehr: 0 },
            { tag: 14, typ: 'mahnung1', name: '1. Mahnung', gebuehr: 5.00 },
            { tag: 28, typ: 'mahnung2', name: '2. Mahnung', gebuehr: 10.00 },
            { tag: 42, typ: 'mahnung3', name: '3. Mahnung (letzte Warnung)', gebuehr: 15.00 },
            { tag: 56, typ: 'inkasso', name: 'Inkasso-Übergabe', gebuehr: 0 }
        ];
    }

    // ============================================
    // Supabase helpers
    // ============================================
    _supabase() {
        return window.supabaseClient?.client;
    }

    _isOnline() {
        return !!(this._supabase() && window.supabaseClient?.isConfigured());
    }

    async init() {
        if (this._initialized) {return;}
        this._initialized = true;
        try {
            const { data } = await this._supabase()?.auth?.getUser() || {};
            this._userId = data?.user?.id || '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc';
        } catch {
            this._userId = '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc';
        }
        await this._loadMahnungenFromSupabase();
        this._ready = true;
        console.debug(`[Dunning] Initialisiert – ${this.mahnungen.length} Mahnungen geladen`);
    }

    async _loadMahnungenFromSupabase() {
        if (!this._isOnline()) {return;}
        try {
            const { data, error } = await this._supabase()
                .from('mahnungen')
                .select('*')
                .eq('tenant_id', this._tenantId)
                .order('gesendet_am', { ascending: false });
            if (error) {
                console.error('[Dunning] Supabase load error:', error.message);
                return;
            }
            this.mahnungen = (data || []).map(r => this._fromSupabaseRow(r));
        } catch (err) {
            console.error('[Dunning] Supabase load failed:', err.message);
        }
    }

    _toSupabaseRow(m) {
        return {
            id: m.id,
            user_id: this._userId || '83d1bcd4-b317-4ad5-ba5c-1cab4059fcbc',
            tenant_id: this._tenantId,
            rechnung_id: m.rechnungId,
            rechnung_nr: m.rechnungNr || m.rechnungId,
            kunde_name: m.kunde?.name || m.kundeName || '',
            empfaenger: m.empfaenger || '',
            stufe: m.stufe,
            stufen_name: m.stufenName || '',
            original_betrag: m.originalBetrag || 0,
            mahngebuehr: m.mahngebuehr || 0,
            gesamt_betrag: m.gesamtBetrag || 0,
            gesendet_am: m.gesendetAm || new Date().toISOString(),
            status: m.status || 'gesendet'
        };
    }

    _fromSupabaseRow(r) {
        return {
            id: r.id,
            rechnungId: r.rechnung_id,
            rechnungNr: r.rechnung_nr || r.rechnung_id,
            kundeName: r.kunde_name || '',
            kunde: { name: r.kunde_name || '' },
            empfaenger: r.empfaenger || '',
            stufe: r.stufe,
            stufenName: r.stufen_name || '',
            originalBetrag: parseFloat(r.original_betrag) || 0,
            mahngebuehr: parseFloat(r.mahngebuehr) || 0,
            gesamtBetrag: parseFloat(r.gesamt_betrag) || 0,
            gesendetAm: r.gesendet_am,
            erstelltAm: r.created_at || r.gesendet_am,
            status: r.status || 'gesendet'
        };
    }

    // ============================================
    // Mahnung Status Check
    // ============================================
    checkRechnungStatus(rechnung) {
        if (rechnung.status === 'bezahlt') {
            return { stufe: null, typ: 'bezahlt', message: 'Rechnung bezahlt' };
        }

        // Use explicit due date if available, otherwise calculate from creation + zahlungsziel
        let faelligAm;
        if (rechnung.faelligkeitsdatum) {
            faelligAm = new Date(rechnung.faelligkeitsdatum);
        } else {
            const rechnungsDatum = new Date(rechnung.createdAt || rechnung.created_at);
            const zahlungsziel = rechnung.zahlungsziel_tage || rechnung.zahlungsziel || 14;
            faelligAm = new Date(rechnungsDatum.getTime() + zahlungsziel * 86400000);
        }
        if (isNaN(faelligAm.getTime())) {
            return { stufe: null, typ: 'unbekannt', message: 'Fälligkeitsdatum nicht ermittelbar' };
        }
        const heute = new Date();
        const tageOffen = Math.floor((heute - faelligAm) / (1000 * 60 * 60 * 24));

        // Finde aktuelle Eskalationsstufe
        let aktuelleStufe = this.eskalationsStufen[0];
        for (const stufe of this.eskalationsStufen) {
            if (tageOffen >= stufe.tag) {
                aktuelleStufe = stufe;
            }
        }

        return {
            stufe: aktuelleStufe,
            tageOffen: tageOffen,
            naechsteStufe: this.getNextStufe(aktuelleStufe),
            tageZurNaechstenStufe: this.getDaysToNextLevel(tageOffen, aktuelleStufe)
        };
    }

    getNextStufe(aktuelleStufe) {
        const idx = this.eskalationsStufen.findIndex(s => s.typ === aktuelleStufe.typ);
        return this.eskalationsStufen[idx + 1] || null;
    }

    getDaysToNextLevel(tageOffen, aktuelleStufe) {
        const next = this.getNextStufe(aktuelleStufe);
        return next ? next.tag - tageOffen : null;
    }

    // ============================================
    // Mahnung erstellen (Supabase-first)
    // ============================================
    async erstelleMahnung(rechnung, stufe) {
        const mahnung = {
            id: `MAH-${Date.now().toString(36).toUpperCase()}`,
            rechnungId: rechnung.id,
            rechnungNr: rechnung.id,
            kunde: rechnung.kunde,
            kundeName: rechnung.kunde?.name || '',
            empfaenger: rechnung.kunde?.email || '',
            originalBetrag: rechnung.brutto,
            mahngebuehr: stufe.gebuehr,
            gesamtBetrag: Math.round(((parseFloat(rechnung.brutto) || 0) + this.getGesamtMahngebuehren(rechnung.id) + stufe.gebuehr) * 100) / 100,
            stufe: stufe.typ,
            stufenName: stufe.name,
            gesendetAm: new Date().toISOString(),
            status: 'gesendet'
        };

        this.mahnungen.push(mahnung);
        await this._saveMahnungToSupabase(mahnung);
        return mahnung;
    }

    // ============================================
    // Mahnung per Email senden (1-Click)
    // ============================================
    async sendMahnung(rechnung, stufe) {
        if (!rechnung || !stufe) {
            window.showToast?.('Ungültige Rechnungs- oder Stufendaten', 'error');
            return null;
        }

        const kundeEmail = rechnung.kunde?.email;
        if (!kundeEmail) {
            window.showToast?.('Keine E-Mail-Adresse beim Kunden hinterlegt', 'error');
            return null;
        }

        // Bereits fuer diese Stufe gesendet?
        if (this.hasMahnungForStufe(rechnung.id, stufe.typ)) {
            window.showToast?.(`${stufe.name} wurde bereits gesendet`, 'warning');
            return null;
        }

        try {
            // Email-Inhalt generieren
            const emailData = this.generateMahnungHtmlEmail(rechnung, stufe);
            const gesamtBetrag = (parseFloat(rechnung.brutto) || 0) + this.getGesamtMahngebuehren(rechnung.id) + stufe.gebuehr;

            // Via n8n Webhook senden
            const webhookUrl = '/n8n-webhook/freyai-events';
            const payload = {
                event: 'dunning.send',
                data: {
                    to: kundeEmail,
                    subject: emailData.subject,
                    body: emailData.html,
                    rechnungNr: rechnung.id,
                    stufe: stufe.typ,
                    stufenName: stufe.name,
                    betrag: gesamtBetrag,
                    kundeName: rechnung.kunde?.name || '',
                    mahngebuehr: stufe.gebuehr
                }
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Webhook Fehler: ${response.status} ${response.statusText}`);
            }

            // In Supabase speichern
            const mahnung = await this.erstelleMahnung(rechnung, stufe);

            const safeEmail = typeof window.esc === 'function' ? window.esc(kundeEmail) : String(kundeEmail).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
            window.showToast?.(`${stufe.name} an ${safeEmail} gesendet`, 'success');
            return mahnung;

        } catch (err) {
            console.error('[Dunning] sendMahnung Fehler:', err);
            window.showToast?.('Mahnung konnte nicht gesendet werden: ' + err.message, 'error');
            return null;
        }
    }

    // ============================================
    // Supabase persistence
    // ============================================
    async _saveMahnungToSupabase(mahnung) {
        if (!this._isOnline()) {return;}
        try {
            const row = this._toSupabaseRow(mahnung);
            const { error } = await this._supabase()
                .from('mahnungen')
                .upsert(row, { onConflict: 'id' });
            if (error) {
                console.error('[Dunning] Supabase save error:', error.message);
            }
        } catch (err) {
            console.error('[Dunning] Supabase save failed:', err.message);
        }
    }

    getGesamtMahngebuehren(rechnungId) {
        return this.mahnungen
            .filter(m => m.rechnungId === rechnungId)
            .reduce((sum, m) => sum + (m.mahngebuehr || 0), 0);
    }

    getMahnungenForRechnung(rechnungId) {
        return this.mahnungen.filter(m => m.rechnungId === rechnungId);
    }

    // ============================================
    // Mahnung Texte generieren
    // ============================================
    generateMahnText(rechnung, stufe) {
        const firma = this._getCompanyName();
        const empfaenger = StorageUtils.getCustomerName(rechnung, 'dunning');
        if (!empfaenger) {
            console.error('[Dunning] Cannot send Mahnung: missing customer for Rechnung', rechnung.id);
            return null;
        }

        const templates = {
            'erinnerung': `Sehr geehrte(r) ${empfaenger},

bei Durchsicht unserer Buchhaltung haben wir festgestellt, dass die unten genannte Rechnung noch nicht beglichen wurde.

Rechnungsnummer: ${rechnung.id}
Rechnungsdatum: ${this.formatDate(rechnung.createdAt)}
Offener Betrag: ${this.formatCurrency(rechnung.brutto)}

Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.

Wir bitten um Überweisung innerhalb der nächsten 7 Tage.

${this._getBankDetails()}
Verwendungszweck: ${rechnung.id}

Mit freundlichen Grüßen
${firma}`,

            'mahnung1': `Sehr geehrte(r) ${empfaenger},

leider konnten wir trotz unserer Zahlungserinnerung keinen Zahlungseingang verzeichnen.

Rechnungsnummer: ${rechnung.id}
Ursprünglicher Betrag: ${this.formatCurrency(rechnung.brutto)}
Mahngebühr (1. Mahnung): ${this.formatCurrency(stufe.gebuehr)}
────────────────────────────
Gesamtbetrag: ${this.formatCurrency((parseFloat(rechnung.brutto) || 0) + stufe.gebuehr)}

Wir bitten Sie dringend, den ausstehenden Betrag innerhalb von 14 Tagen zu begleichen.

${this._getBankDetails()}
Verwendungszweck: ${rechnung.id}

Mit freundlichen Grüßen
${firma}`,

            'mahnung2': `Sehr geehrte(r) ${empfaenger},

trotz wiederholter Aufforderung ist die nachstehende Forderung immer noch offen.

Rechnungsnummer: ${rechnung.id}
Ursprünglicher Betrag: ${this.formatCurrency(rechnung.brutto)}
Bisherige Mahngebühren: ${this.formatCurrency(this.getGesamtMahngebuehren(rechnung.id))}
Aktuelle Mahngebühr (2. Mahnung): ${this.formatCurrency(stufe.gebuehr)}
────────────────────────────
Gesamtbetrag: ${this.formatCurrency((parseFloat(rechnung.brutto) || 0) + this.getGesamtMahngebuehren(rechnung.id) + stufe.gebuehr)}

Falls wir innerhalb von 14 Tagen keinen Zahlungseingang verzeichnen, sehen wir uns gezwungen, weitere rechtliche Schritte einzuleiten.

${this._getBankDetails()}
Verwendungszweck: ${rechnung.id}

Mit freundlichen Grüßen
${firma}`,

            'mahnung3': `Sehr geehrte(r) ${empfaenger},

LETZTE MAHNUNG VOR GERICHTLICHEM MAHNVERFAHREN

Die nachstehende Forderung ist trotz mehrfacher Aufforderung weiterhin unbeglichen:

Rechnungsnummer: ${rechnung.id}
Ursprünglicher Betrag: ${this.formatCurrency(rechnung.brutto)}
Aufgelaufene Mahngebühren: ${this.formatCurrency(this.getGesamtMahngebuehren(rechnung.id) + stufe.gebuehr)}
────────────────────────────
Gesamtbetrag: ${this.formatCurrency((parseFloat(rechnung.brutto) || 0) + this.getGesamtMahngebuehren(rechnung.id) + stufe.gebuehr)}

Dies ist unsere letzte außergerichtliche Mahnung. Sollte der Betrag nicht innerhalb von 14 Tagen auf unserem Konto eingehen, werden wir:

1. Ein gerichtliches Mahnverfahren einleiten
2. Die Forderung an ein Inkassounternehmen übergeben
3. Alle entstehenden Kosten Ihnen in Rechnung stellen

Zahlungsdetails:
${this._getBankDetails()}
Verwendungszweck: ${rechnung.id}

${firma}`,

            'inkasso': `ÜBERGABE AN INKASSO

Rechnung: ${rechnung.id}
Kunde: ${empfaenger}
Offener Betrag inkl. Mahngebühren: ${this.formatCurrency((parseFloat(rechnung.brutto) || 0) + this.getGesamtMahngebuehren(rechnung.id))}

Status: Zur manuellen Prüfung vor Inkasso-Übergabe markiert.

Nächste Schritte:
1. Kontaktaufnahme mit Inkassodienst
2. Übergabe der Unterlagen
3. Gerichtliches Mahnverfahren einleiten`
        };

        return templates[stufe.typ] || '';
    }

    // ============================================
    // Alle offenen Mahnungen prüfen
    // ============================================
    checkAllOverdueInvoices(rechnungen) {
        const overdueItems = [];

        rechnungen.forEach(rechnung => {
            if (rechnung.status !== 'bezahlt' && rechnung.status !== 'storniert') {
                const status = this.checkRechnungStatus(rechnung);
                if (status.stufe && status.stufe.typ !== 'rechnung') {
                    overdueItems.push({
                        rechnung,
                        status,
                        actionNeeded: !this.hasMahnungForStufe(rechnung.id, status.stufe.typ)
                    });
                }
            }
        });

        return overdueItems;
    }

    hasMahnungForStufe(rechnungId, stufeTyp) {
        return this.mahnungen.some(m =>
            m.rechnungId === rechnungId && m.stufe === stufeTyp
        );
    }

    // ============================================
    // Inkasso Fall erstellen
    // ============================================
    erstelleInkassoFall(rechnung) {
        const fall = {
            id: `INK-${Date.now().toString(36).toUpperCase()}`,
            rechnungId: rechnung.id,
            kunde: rechnung.kunde,
            gesamtForderung: (parseFloat(rechnung.brutto) || 0) + this.getGesamtMahngebuehren(rechnung.id),
            mahnHistorie: this.getMahnungenForRechnung(rechnung.id),
            erstelltAm: new Date().toISOString(),
            status: 'zur_pruefung'
        };

        this.inkassoFaelle.push(fall);
        this.saveInkasso();
        return fall;
    }

    getInkassoFaelle() {
        return this.inkassoFaelle;
    }

    // ============================================
    // Persistence (Supabase-first)
    // ============================================
    async save() {
        // Noop — individual saves via _saveMahnungToSupabase
    }

    saveInkasso() {
        // Inkasso bleibt vorerst lokal (seltener Anwendungsfall)
        try {
            localStorage.setItem('freyai_inkasso', JSON.stringify(this.inkassoFaelle));
        } catch (e) {
            console.error('Inkasso Speicherung fehlgeschlagen:', e.message);
        }
    }

    /**
     * Get the last Mahnung sent for a specific Rechnung
     */
    getLetzteMahnung(rechnungId) {
        const mahnungen = this.getMahnungenForRechnung(rechnungId);
        if (mahnungen.length === 0) {return null;}
        return mahnungen.sort((a, b) => new Date(b.gesendetAm || b.erstelltAm) - new Date(a.gesendetAm || a.erstelltAm))[0];
    }

    /**
     * Get the recommended next dunning level for a Rechnung
     */
    getEmpfohleneStufe(rechnung) {
        const status = this.checkRechnungStatus(rechnung);
        if (!status.stufe || status.stufe.typ === 'rechnung' || status.stufe.typ === 'bezahlt') {
            return null;
        }

        // Find the highest stufe already sent
        const sentStufen = this.getMahnungenForRechnung(rechnung.id).map(m => m.stufe);
        const stufeIndex = this.eskalationsStufen.findIndex(s => s.typ === status.stufe.typ);

        // Walk from current status stufe backwards to find unsent level
        for (let i = stufeIndex; i >= 1; i--) {
            const s = this.eskalationsStufen[i];
            if (s.typ !== 'inkasso' && !sentStufen.includes(s.typ)) {
                return s;
            }
        }

        // If current stufe already sent, offer next
        if (status.naechsteStufe && status.naechsteStufe.typ !== 'inkasso' && !sentStufen.includes(status.naechsteStufe.typ)) {
            return status.naechsteStufe;
        }

        return status.stufe.typ !== 'inkasso' && !sentStufen.includes(status.stufe.typ) ? status.stufe : null;
    }

    // ============================================
    // Helpers
    // ============================================
    formatCurrency(amount) {
        return window.formatCurrency(amount);
    }

    _getBankDetails() {
        const settings = window.storeService?.state?.settings || {};
        let admin = StorageUtils.getJSON('admin_panel_data', {}, { financial: true, service: 'dunningService' });
        const bank = admin.bank_name || settings.bank_name || '';
        const iban = admin.bank_iban || settings.iban || '';
        const bic = admin.bank_bic || settings.bic || '';
        const lines = [];
        if (bank) {lines.push(`Bank: ${bank}`);}
        if (iban) {lines.push(`IBAN: ${iban}`);}
        if (bic) {lines.push(`BIC: ${bic}`);}
        return lines.length > 0 ? lines.join('\n') : 'Bankverbindung: siehe Rechnung';
    }

    _getCompanyName() {
        if (window.eInvoiceService?.settings?.businessData?.name) {
            return window.eInvoiceService.settings.businessData.name;
        }
        try {
            const ap = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
            return ap.company_name || 'FreyAI Visions';
        } catch { return 'FreyAI Visions'; }
    }

    /**
     * Generate HTML email for a dunning level using emailTemplateService
     * Falls back to plain text if template service is unavailable
     */
    generateMahnungHtmlEmail(rechnung, stufe) {
        if (window.emailTemplateService) {
            // Map dunning level to template service level
            const levelMap = { 'erinnerung': 0, 'mahnung1': 1, 'mahnung2': 2, 'mahnung3': 3 };
            const templateLevel = levelMap[stufe.typ];

            if (templateLevel === 0) {
                // Use Zahlungserinnerung template
                return window.emailTemplateService.getZahlungserinnerungEmail(rechnung);
            }

            if (templateLevel >= 1 && templateLevel <= 3) {
                const mahnungData = {
                    kunde: rechnung.kunde,
                    betrag: parseFloat(rechnung.brutto || 0) + this.getGesamtMahngebuehren(rechnung.id) + stufe.gebuehr,
                    originalRechnung: {
                        nummer: rechnung.id || rechnung.nummer,
                        datum: rechnung.datum || rechnung.createdAt || rechnung.created_at
                    }
                };
                return window.emailTemplateService.getMahnungEmail(mahnungData, templateLevel);
            }
        }

        // Fallback: plain text (escape for safe HTML embedding)
        const text = this.generateMahnText(rechnung, stufe);
        const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return {
            subject: `${stufe.name}: Rechnung ${rechnung.id}`,
            html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap; line-height: 1.6;">${safeText}</pre>`
        };
    }

    formatDate(dateStr) {
        const date = StorageUtils.safeDate(dateStr);
        if (!date) { return '—'; }
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
}

// Create global instance and initialize from Supabase
window.dunningService = new DunningService();
// Async init — loads mahnungen from Supabase when client is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => window.dunningService.init().catch(e => console.warn('[Dunning] init:', e.message)), 500);
    });
} else {
    setTimeout(() => window.dunningService.init().catch(e => console.warn('[Dunning] init:', e.message)), 500);
}
