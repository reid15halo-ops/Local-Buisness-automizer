/* ============================================
   Dunning Service - Mahnwesen mit Eskalation
   Automatische Zahlungserinnerungen und Mahnungen
   ============================================ */

class DunningService {
    constructor() {
        try { this.mahnungen = JSON.parse(localStorage.getItem('freyai_mahnungen') || '[]'); } catch { this.mahnungen = []; }
        try { this.inkassoFaelle = JSON.parse(localStorage.getItem('freyai_inkasso') || '[]'); } catch { this.inkassoFaelle = []; }

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
    // Mahnung erstellen
    // ============================================
    erstelleMahnung(rechnung, stufe) {
        const mahnung = {
            id: `MAH-${Date.now().toString(36).toUpperCase()}`,
            rechnungId: rechnung.id,
            kunde: rechnung.kunde,
            originalBetrag: rechnung.brutto,
            mahngebuehr: stufe.gebuehr,
            gesamtBetrag: (parseFloat(rechnung.brutto) || 0) + this.getGesamtMahngebuehren(rechnung.id) + stufe.gebuehr,
            stufe: stufe.typ,
            stufenName: stufe.name,
            erstelltAm: new Date().toISOString(),
            status: 'erstellt'
        };

        this.mahnungen.push(mahnung);
        this.save();
        return mahnung;
    }

    getGesamtMahngebuehren(rechnungId) {
        return this.mahnungen
            .filter(m => m.rechnungId === rechnungId)
            .reduce((sum, m) => sum + m.mahngebuehr, 0);
    }

    getMahnungenForRechnung(rechnungId) {
        return this.mahnungen.filter(m => m.rechnungId === rechnungId);
    }

    // ============================================
    // Mahnung Texte generieren
    // ============================================
    generateMahnText(rechnung, stufe) {
        const firma = this._getCompanyName();
        const templates = {
            'erinnerung': `Sehr geehrte(r) ${rechnung.kunde?.name || 'Kunde'},

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

            'mahnung1': `Sehr geehrte(r) ${rechnung.kunde?.name || 'Kunde'},

leider konnten wir trotz unserer Zahlungserinnerung keinen Zahlungseingang verzeichnen.

Rechnungsnummer: ${rechnung.id}
Ursprünglicher Betrag: ${this.formatCurrency(rechnung.brutto)}
Mahngebühr (1. Mahnung): ${this.formatCurrency(5.00)}
────────────────────────────
Gesamtbetrag: ${this.formatCurrency((parseFloat(rechnung.brutto) || 0) + 5.00)}

Wir bitten Sie dringend, den ausstehenden Betrag innerhalb von 14 Tagen zu begleichen.

${this._getBankDetails()}
Verwendungszweck: ${rechnung.id}

Mit freundlichen Grüßen
${firma}`,

            'mahnung2': `Sehr geehrte(r) ${rechnung.kunde?.name || 'Kunde'},

trotz wiederholter Aufforderung ist die nachstehende Forderung immer noch offen.

Rechnungsnummer: ${rechnung.id}
Ursprünglicher Betrag: ${this.formatCurrency(rechnung.brutto)}
Bisherige Mahngebühren: ${this.formatCurrency(this.getGesamtMahngebuehren(rechnung.id))}
Aktuelle Mahngebühr (2. Mahnung): ${this.formatCurrency(10.00)}
────────────────────────────
Gesamtbetrag: ${this.formatCurrency((parseFloat(rechnung.brutto) || 0) + this.getGesamtMahngebuehren(rechnung.id) + 10.00)}

Falls wir innerhalb von 14 Tagen keinen Zahlungseingang verzeichnen, sehen wir uns gezwungen, weitere rechtliche Schritte einzuleiten.

${this._getBankDetails()}
Verwendungszweck: ${rechnung.id}

Mit freundlichen Grüßen
${firma}`,

            'mahnung3': `Sehr geehrte(r) ${rechnung.kunde?.name || 'Kunde'},

LETZTE MAHNUNG VOR GERICHTLICHEM MAHNVERFAHREN

Die nachstehende Forderung ist trotz mehrfacher Aufforderung weiterhin unbeglichen:

Rechnungsnummer: ${rechnung.id}
Ursprünglicher Betrag: ${this.formatCurrency(rechnung.brutto)}
Aufgelaufene Mahngebühren: ${this.formatCurrency(this.getGesamtMahngebuehren(rechnung.id) + 15.00)}
────────────────────────────
Gesamtbetrag: ${this.formatCurrency((parseFloat(rechnung.brutto) || 0) + this.getGesamtMahngebuehren(rechnung.id) + 15.00)}

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
Kunde: ${rechnung.kunde?.name || 'Kunde'}
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
            if (rechnung.status !== 'bezahlt') {
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
    // Persistence
    // ============================================
    save() {
        try {
            localStorage.setItem('freyai_mahnungen', JSON.stringify(this.mahnungen));
        } catch (e) {
            console.error('Mahnungen Speicherung fehlgeschlagen:', e.message);
        }
    }

    saveInkasso() {
        try {
            localStorage.setItem('freyai_inkasso', JSON.stringify(this.inkassoFaelle));
        } catch (e) {
            console.error('Inkasso Speicherung fehlgeschlagen:', e.message);
        }
    }

    // ============================================
    // Helpers
    // ============================================
    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    _getBankDetails() {
        const settings = window.storeService?.state?.settings || {};
        let admin; try { admin = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}'); } catch { admin = {}; }
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
                    betrag: rechnung.brutto + this.getGesamtMahngebuehren(rechnung.id) + stufe.gebuehr,
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
        return new Date(dateStr).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
}

// Create global instance
window.dunningService = new DunningService();
