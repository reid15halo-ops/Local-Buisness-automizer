/* ============================================
   Dunning Service - Mahnwesen mit Eskalation
   Automatische Zahlungserinnerungen und Mahnungen
   ============================================ */

class DunningService {
    constructor() {
        this.mahnungen = JSON.parse(localStorage.getItem('freyai_mahnungen') || '[]');
        this.inkassoFaelle = JSON.parse(localStorage.getItem('freyai_inkasso') || '[]');

        // Eskalationsstufen (Tage nach Rechnungsdatum)
        this.eskalationsStufen = [
            { tag: 0, typ: 'rechnung', name: 'Rechnung erstellt', gebuehr: 0 },
            { tag: 14, typ: 'erinnerung', name: 'Zahlungserinnerung', gebuehr: 0 },
            { tag: 28, typ: 'mahnung1', name: '1. Mahnung', gebuehr: 5.00 },
            { tag: 42, typ: 'mahnung2', name: '2. Mahnung', gebuehr: 10.00 },
            { tag: 56, typ: 'mahnung3', name: '3. Mahnung (letzte Warnung)', gebuehr: 15.00 },
            { tag: 70, typ: 'inkasso', name: 'Inkasso-Übergabe', gebuehr: 0 }
        ];
    }

    // ============================================
    // Mahnung Status Check
    // ============================================
    checkRechnungStatus(rechnung) {
        if (rechnung.status === 'bezahlt') {
            return { stufe: null, typ: 'bezahlt', message: 'Rechnung bezahlt' };
        }

        const rechnungsDatum = new Date(rechnung.createdAt);
        const heute = new Date();
        const tageOffen = Math.floor((heute - rechnungsDatum) / (1000 * 60 * 60 * 24));

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
            gesamtBetrag: rechnung.brutto + this.getGesamtMahngebuehren(rechnung.id) + stufe.gebuehr,
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
        const templates = {
            'erinnerung': `Sehr geehrte(r) ${rechnung.kunde.name},

bei Durchsicht unserer Buchhaltung haben wir festgestellt, dass die unten genannte Rechnung noch nicht beglichen wurde.

Rechnungsnummer: ${rechnung.id}
Rechnungsdatum: ${this.formatDate(rechnung.createdAt)}
Offener Betrag: ${this.formatCurrency(rechnung.brutto)}

Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.

Wir bitten um Überweisung innerhalb der nächsten 14 Tage.

Mit freundlichen Grüßen
FreyAI Visions`,

            'mahnung1': `Sehr geehrte(r) ${rechnung.kunde.name},

leider konnten wir trotz unserer Zahlungserinnerung keinen Zahlungseingang verzeichnen.

Rechnungsnummer: ${rechnung.id}
Ursprünglicher Betrag: ${this.formatCurrency(rechnung.brutto)}
Mahngebühr: ${this.formatCurrency(5.00)}
────────────────────────────
Gesamtbetrag: ${this.formatCurrency(rechnung.brutto + 5.00)}

Wir bitten Sie dringend, den ausstehenden Betrag innerhalb von 14 Tagen zu begleichen.

Mit freundlichen Grüßen
FreyAI Visions`,

            'mahnung2': `Sehr geehrte(r) ${rechnung.kunde.name},

trotz wiederholter Aufforderung ist die nachstehende Forderung immer noch offen.

Rechnungsnummer: ${rechnung.id}
Ursprünglicher Betrag: ${this.formatCurrency(rechnung.brutto)}
Bisherige Mahngebühren: ${this.formatCurrency(this.getGesamtMahngebuehren(rechnung.id))}
Aktuelle Mahngebühr: ${this.formatCurrency(10.00)}
────────────────────────────
Gesamtbetrag: ${this.formatCurrency(rechnung.brutto + this.getGesamtMahngebuehren(rechnung.id) + 10.00)}

Falls wir innerhalb von 14 Tagen keinen Zahlungseingang verzeichnen, sehen wir uns gezwungen, weitere rechtliche Schritte einzuleiten.

Mit freundlichen Grüßen
FreyAI Visions`,

            'mahnung3': `Sehr geehrte(r) ${rechnung.kunde.name},

LETZTE MAHNUNG VOR GERICHTLICHEM MAHNVERFAHREN

Die nachstehende Forderung ist trotz mehrfacher Aufforderung weiterhin unbeglichen:

Rechnungsnummer: ${rechnung.id}
Ursprünglicher Betrag: ${this.formatCurrency(rechnung.brutto)}
Aufgelaufene Mahngebühren: ${this.formatCurrency(this.getGesamtMahngebuehren(rechnung.id) + 15.00)}
────────────────────────────
Gesamtbetrag: ${this.formatCurrency(rechnung.brutto + this.getGesamtMahngebuehren(rechnung.id) + 15.00)}

Dies ist unsere letzte außergerichtliche Mahnung. Sollte der Betrag nicht innerhalb von 14 Tagen auf unserem Konto eingehen, werden wir:

1. Ein gerichtliches Mahnverfahren einleiten
2. Die Forderung an ein Inkassounternehmen übergeben
3. Alle entstehenden Kosten Ihnen in Rechnung stellen

Zahlungsdetails:
Bank: Sparkasse Aschaffenburg
IBAN: DE00 0000 0000 0000 0000 00
Verwendungszweck: ${rechnung.id}

FreyAI Visions`,

            'inkasso': `ÜBERGABE AN INKASSO

Rechnung: ${rechnung.id}
Kunde: ${rechnung.kunde.name}
Offener Betrag inkl. Mahngebühren: ${this.formatCurrency(rechnung.brutto + this.getGesamtMahngebuehren(rechnung.id))}

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
            gesamtForderung: rechnung.brutto + this.getGesamtMahngebuehren(rechnung.id),
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
        localStorage.setItem('freyai_mahnungen', JSON.stringify(this.mahnungen));
    }

    saveInkasso() {
        localStorage.setItem('freyai_inkasso', JSON.stringify(this.inkassoFaelle));
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
