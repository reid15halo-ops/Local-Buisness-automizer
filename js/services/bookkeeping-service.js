/* ============================================
   Bookkeeping Service - EÜR & DATEV Export
   Einnahmen-Überschuss-Rechnung für KMUs
   ============================================ */

class BookkeepingService {
    constructor() {
        this.buchungen = JSON.parse(localStorage.getItem('freyai_buchungen') || '[]');
        this.einstellungen = JSON.parse(localStorage.getItem('freyai_buchhaltung_settings') || '{}');

        // Default settings
        if (!this.einstellungen.kleinunternehmer) {
            this.einstellungen = {
                kleinunternehmer: false,          // § 19 UStG
                umsatzsteuersatz: 19,              // Standard 19%
                firmenName: 'FreyAI Visions',
                steuernummer: '',
                ustIdNr: '',
                finanzamt: '',
                geschaeftsjahr: new Date().getFullYear()
            };
            this.saveSettings();
        }
    }

    // ============================================
    // Buchungen
    // ============================================
    addBuchung(buchung) {
        buchung.id = `BU-${Date.now().toString(36).toUpperCase()}`;
        buchung.erstelltAm = new Date().toISOString();

        // Calculate USt if not Kleinunternehmer
        if (!this.einstellungen.kleinunternehmer && buchung.typ === 'einnahme') {
            buchung.netto = buchung.brutto / 1.19;
            buchung.ust = buchung.brutto - buchung.netto;
        } else {
            buchung.netto = buchung.brutto;
            buchung.ust = 0;
        }

        this.buchungen.push(buchung);
        this.save();
        return buchung;
    }

    // Automatisch aus Rechnung erstellen
    addFromRechnung(rechnung) {
        const buchung = {
            typ: 'einnahme',
            kategorie: 'Umsatzerlöse',
            beschreibung: `Rechnung ${rechnung.id} - ${rechnung.kunde.name}`,
            rechnungId: rechnung.id,
            datum: rechnung.paidAt || rechnung.createdAt,
            brutto: rechnung.brutto,
            belegnummer: rechnung.id,
            zahlungsart: 'Überweisung'
        };
        return this.addBuchung(buchung);
    }

    // Record payment when invoice is paid (creates Umsatzerlöse entry)
    recordPayment(payment) {
        // payment = {invoiceId, amount, date, method, reference}
        const buchung = {
            typ: 'einnahme',
            kategorie: 'Umsatzerlöse',
            beschreibung: `Zahlung Rechnung ${payment.reference}`,
            rechnungId: payment.invoiceId,
            datum: payment.date,
            brutto: payment.amount,
            belegnummer: payment.reference,
            zahlungsart: payment.method || 'Überweisung'
        };
        return this.addBuchung(buchung);
    }

    // Record material costs (COGS) for an invoice
    recordMaterialCosts(rechnung) {
        // Only create entry if there are material costs
        if (!rechnung.materialKosten && !rechnung.stueckliste) {
            return null;
        }

        const materialKosten = rechnung.materialKosten || 0;

        const buchung = {
            typ: 'ausgabe',
            kategorie: 'Materialaufwendungen',
            beschreibung: `Materialeinsatz Rechnung ${rechnung.nummer} - ${rechnung.kunde.name}`,
            rechnungId: rechnung.id,
            datum: rechnung.paidAt || rechnung.createdAt,
            brutto: materialKosten,
            belegnummer: rechnung.nummer,
            zahlungsart: 'Material',
            auftragId: rechnung.auftragId
        };
        return this.addBuchung(buchung);
    }

    // Ausgabe hinzufügen
    addAusgabe(daten) {
        const buchung = {
            typ: 'ausgabe',
            kategorie: daten.kategorie || 'Sonstige Ausgaben',
            beschreibung: daten.beschreibung,
            datum: daten.datum || new Date().toISOString(),
            brutto: daten.betrag,
            netto: daten.betrag / 1.19,
            vorsteuer: daten.betrag - (daten.betrag / 1.19),
            belegnummer: daten.belegnummer || '',
            zahlungsart: daten.zahlungsart || 'Überweisung'
        };
        return this.addBuchung(buchung);
    }

    // ============================================
    // EÜR Berechnung
    // ============================================
    berechneEUR(jahr = null) {
        const jahr_ = jahr || this.einstellungen.geschaeftsjahr;
        const jahresBuchungen = this.getBuchungenForJahr(jahr_);

        const einnahmen = jahresBuchungen.filter(b => b.typ === 'einnahme');
        const ausgaben = jahresBuchungen.filter(b => b.typ === 'ausgabe');
        const materialKosten = ausgaben.filter(b => b.kategorie === 'Materialaufwendungen');
        const sonstigeAusgaben = ausgaben.filter(b => b.kategorie !== 'Materialaufwendungen');

        const summeEinnahmenBrutto = einnahmen.reduce((sum, b) => sum + b.brutto, 0);
        const summeEinnahmenNetto = einnahmen.reduce((sum, b) => sum + b.netto, 0);
        const summeUst = einnahmen.reduce((sum, b) => sum + (b.ust || 0), 0);

        const summeMaterialKosten = materialKosten.reduce((sum, b) => sum + b.brutto, 0);
        const summeSonstigeAusgaben = sonstigeAusgaben.reduce((sum, b) => sum + b.brutto, 0);
        const summeAusgabenBrutto = ausgaben.reduce((sum, b) => sum + b.brutto, 0);
        const summeAusgabenNetto = ausgaben.reduce((sum, b) => sum + b.netto, 0);
        const summeVorsteuer = ausgaben.reduce((sum, b) => sum + (b.vorsteuer || 0), 0);

        const rohertrag = summeEinnahmenNetto - summeMaterialKosten;
        const gewinnVorSteuer = summeEinnahmenNetto - summeAusgabenNetto;
        const ustZahllast = summeUst - summeVorsteuer;

        return {
            jahr: jahr_,
            einnahmen: {
                brutto: summeEinnahmenBrutto,
                netto: summeEinnahmenNetto,
                ust: summeUst,
                anzahl: einnahmen.length
            },
            materialaufwendungen: {
                brutto: summeMaterialKosten,
                netto: summeMaterialKosten,
                anzahl: materialKosten.length
            },
            rohertrag: rohertrag,
            ausgaben: {
                brutto: summeSonstigeAusgaben,
                netto: summeSonstigeAusgaben,
                vorsteuer: summeVorsteuer,
                anzahl: sonstigeAusgaben.length
            },
            ausgabenGesamt: {
                brutto: summeAusgabenBrutto,
                netto: summeAusgabenNetto,
                vorsteuer: summeVorsteuer,
                anzahl: ausgaben.length
            },
            gewinn: gewinnVorSteuer,
            ustZahllast: this.einstellungen.kleinunternehmer ? 0 : ustZahllast,
            kleinunternehmer: this.einstellungen.kleinunternehmer
        };
    }

    // USt-Voranmeldung für Quartal/Monat
    berechneUStVA(jahr, monat = null, quartal = null) {
        let buchungen = this.buchungen.filter(b => {
            const datum = new Date(b.datum);
            if (datum.getFullYear() !== jahr) {return false;}

            if (monat !== null) {
                return datum.getMonth() + 1 === monat;
            }
            if (quartal !== null) {
                const q = Math.floor(datum.getMonth() / 3) + 1;
                return q === quartal;
            }
            return true;
        });

        const einnahmen = buchungen.filter(b => b.typ === 'einnahme');
        const ausgaben = buchungen.filter(b => b.typ === 'ausgabe');

        return {
            zeitraum: monat ? `${monat}/${jahr}` : (quartal ? `Q${quartal}/${jahr}` : `${jahr}`),
            umsaetze19: einnahmen.reduce((sum, b) => sum + (b.netto || 0), 0),
            ust19: einnahmen.reduce((sum, b) => sum + (b.ust || 0), 0),
            vorsteuer: ausgaben.reduce((sum, b) => sum + (b.vorsteuer || 0), 0),
            zahllast: einnahmen.reduce((sum, b) => sum + (b.ust || 0), 0) -
                ausgaben.reduce((sum, b) => sum + (b.vorsteuer || 0), 0)
        };
    }

    // ============================================
    // Kategorien-Auswertung
    // ============================================
    getKategorienAuswertung(jahr) {
        const buchungen = this.getBuchungenForJahr(jahr);
        const kategorien = {};

        buchungen.forEach(b => {
            const kat = b.kategorie || 'Sonstiges';
            if (!kategorien[kat]) {
                kategorien[kat] = { einnahmen: 0, ausgaben: 0, anzahl: 0 };
            }
            if (b.typ === 'einnahme') {
                kategorien[kat].einnahmen += b.brutto;
            } else {
                kategorien[kat].ausgaben += b.brutto;
            }
            kategorien[kat].anzahl++;
        });

        return kategorien;
    }

    // ============================================
    // DATEV Export
    // ============================================
    exportDATEV(jahr) {
        const buchungen = this.getBuchungenForJahr(jahr);

        // DATEV CSV Format (vereinfacht)
        const header = [
            'Umsatz', 'Soll/Haben', 'WKZ', 'Belegdatum', 'Belegfeld 1',
            'Buchungstext', 'Gegenkonto', 'Konto', 'USt-ID', 'USt-Schlüssel'
        ].join(';');

        const rows = buchungen.map(b => {
            const datum = new Date(b.datum);
            const datevDatum = `${datum.getDate().toString().padStart(2, '0')}${(datum.getMonth() + 1).toString().padStart(2, '0')}`;

            return [
                b.brutto.toFixed(2).replace('.', ','),          // Umsatz
                b.typ === 'einnahme' ? 'H' : 'S',               // Soll/Haben
                'EUR',                                           // Währungskennzeichen
                datevDatum,                                      // Belegdatum (DDMM)
                b.belegnummer || b.id,                          // Belegfeld 1
                b.beschreibung.substring(0, 60),                // Buchungstext (max 60)
                b.typ === 'einnahme' ? '1200' : '1000',         // Gegenkonto (Bank/Kasse)
                b.typ === 'einnahme' ? '8400' : '4400',         // Konto (Erlöse/Aufwand)
                '',                                              // USt-ID
                this.einstellungen.kleinunternehmer ? '0' : '9' // USt-Schlüssel (9 = 19%)
            ].join(';');
        });

        return `${header}\n${rows.join('\n')}`;
    }

    // CSV Export (einfacheres Format)
    exportCSV(jahr) {
        const buchungen = this.getBuchungenForJahr(jahr);

        const header = ['Datum', 'Typ', 'Kategorie', 'Beschreibung', 'Belegnr.', 'Netto', 'USt/VSt', 'Brutto'].join(';');

        const rows = buchungen.map(b => [
            new Date(b.datum).toLocaleDateString('de-DE'),
            b.typ === 'einnahme' ? 'Einnahme' : 'Ausgabe',
            b.kategorie,
            `"${b.beschreibung}"`,
            b.belegnummer || b.id,
            b.netto.toFixed(2).replace('.', ','),
            (b.ust || b.vorsteuer || 0).toFixed(2).replace('.', ','),
            b.brutto.toFixed(2).replace('.', ',')
        ].join(';'));

        return `${header}\n${rows.join('\n')}`;
    }

    // ============================================
    // CSV Import
    // ============================================
    importFromCSV(csvContent) {
        const lines = csvContent.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
            throw new Error('CSV enthält keine Daten');
        }

        // Parse header to detect format
        const headerLine = lines[0].toLowerCase();
        const separator = headerLine.includes(';') ? ';' : ',';
        const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''));

        // Map common column names
        const columnMap = {
            datum: ['datum', 'date', 'buchungsdatum', 'valuta'],
            typ: ['typ', 'type', 'art', 'buchungsart'],
            kategorie: ['kategorie', 'category', 'konto', 'kontoname'],
            beschreibung: ['beschreibung', 'description', 'verwendungszweck', 'buchungstext', 'text'],
            betrag: ['betrag', 'brutto', 'amount', 'summe', 'wert', 'umsatz'],
            belegnr: ['belegnr', 'belegnr.', 'beleg', 'referenz', 'ref']
        };

        const findColumnIndex = (names) => {
            for (const name of names) {
                const idx = headers.findIndex(h => h.includes(name));
                if (idx >= 0) {return idx;}
            }
            return -1;
        };

        const colIdx = {
            datum: findColumnIndex(columnMap.datum),
            typ: findColumnIndex(columnMap.typ),
            kategorie: findColumnIndex(columnMap.kategorie),
            beschreibung: findColumnIndex(columnMap.beschreibung),
            betrag: findColumnIndex(columnMap.betrag),
            belegnr: findColumnIndex(columnMap.belegnr)
        };

        // Must have at least datum and betrag
        if (colIdx.datum < 0 || colIdx.betrag < 0) {
            throw new Error('CSV muss mindestens Spalten für Datum und Betrag enthalten');
        }

        let imported = 0;
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
            try {
                const values = this.parseCSVLine(lines[i], separator);
                if (values.length < 2) {continue;}

                // Parse betrag (handle German format)
                let betrag = values[colIdx.betrag]?.replace(/"/g, '').replace(/\s/g, '');
                betrag = parseFloat(betrag.replace('.', '').replace(',', '.'));
                if (isNaN(betrag) || betrag === 0) {continue;}

                // Determine typ from betrag sign or column
                let typ = 'ausgabe';
                if (colIdx.typ >= 0) {
                    const typValue = values[colIdx.typ]?.toLowerCase() || '';
                    typ = (typValue.includes('einnahme') || typValue.includes('haben') || typValue.includes('income')) ? 'einnahme' : 'ausgabe';
                } else {
                    typ = betrag > 0 ? 'einnahme' : 'ausgabe';
                }
                betrag = Math.abs(betrag);

                // Parse datum
                let datum = values[colIdx.datum]?.replace(/"/g, '').trim();
                const dateParts = datum.match(/(\d{1,4})[./-](\d{1,2})[./-](\d{2,4})/);
                if (dateParts) {
                    if (dateParts[1].length === 4) {
                        datum = `${dateParts[1]}-${dateParts[2].padStart(2, '0')}-${dateParts[3].padStart(2, '0')}`;
                    } else {
                        datum = `${dateParts[3].length === 2 ? '20' + dateParts[3] : dateParts[3]}-${dateParts[2].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
                    }
                }

                const buchung = {
                    typ,
                    kategorie: colIdx.kategorie >= 0 ? values[colIdx.kategorie]?.replace(/"/g, '') || 'Import' : 'Import',
                    beschreibung: colIdx.beschreibung >= 0 ? values[colIdx.beschreibung]?.replace(/"/g, '') || `Import Zeile ${i}` : `Import Zeile ${i}`,
                    datum,
                    brutto: betrag,
                    belegnummer: colIdx.belegnr >= 0 ? values[colIdx.belegnr]?.replace(/"/g, '') : `IMP-${i}`
                };

                this.addBuchung(buchung);
                imported++;
            } catch (err) {
                errors.push(`Zeile ${i + 1}: ${err.message}`);
            }
        }

        return { imported, errors };
    }

    parseCSVLine(line, separator) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === separator && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }


    // ============================================
    // Helpers
    // ============================================
    getBuchungenForJahr(jahr) {
        return this.buchungen.filter(b => {
            const datum = new Date(b.datum);
            return datum.getFullYear() === jahr;
        });
    }

    getBuchungenForMonat(jahr, monat) {
        return this.buchungen.filter(b => {
            const datum = new Date(b.datum);
            return datum.getFullYear() === jahr && datum.getMonth() + 1 === monat;
        });
    }

    getBuchungenByPeriod(typ, startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return this.buchungen.filter(b => {
            const datum = new Date(b.datum);
            return b.typ === typ && datum >= start && datum <= end;
        });
    }

    getBuchungenByKategorie(kategorie, startDate = null, endDate = null) {
        let filtered = this.buchungen.filter(b => b.kategorie === kategorie);

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            filtered = filtered.filter(b => {
                const datum = new Date(b.datum);
                return datum >= start && datum <= end;
            });
        }

        return filtered;
    }

    getGrossProfit(startDate, endDate) {
        const einnahmen = this.getBuchungenByPeriod('einnahme', startDate, endDate);
        const materialKosten = this.getBuchungenByKategorie('Materialaufwendungen', startDate, endDate);

        const revenue = einnahmen.reduce((sum, b) => sum + (b.brutto || 0), 0);
        const cogs = materialKosten.reduce((sum, b) => sum + (b.brutto || 0), 0);
        const grossProfit = revenue - cogs;
        const margin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0;

        return {
            revenue: revenue,
            cogs: cogs,
            grossProfit: grossProfit,
            margin: margin + '%',
            anzahlEinnahmen: einnahmen.length,
            anzahlMaterialkosten: materialKosten.length
        };
    }

    getProfitByAuftrag(auftragId) {
        const buchungen = this.buchungen.filter(b => b.auftragId === auftragId ||
                                                      (b.rechnungId && this.findRechnungByBuchung(b)));

        const einnahmen = buchungen.filter(b => b.typ === 'einnahme');
        const ausgaben = buchungen.filter(b => b.typ === 'ausgabe');

        const revenue = einnahmen.reduce((sum, b) => sum + (b.brutto || 0), 0);
        const costs = ausgaben.reduce((sum, b) => sum + (b.brutto || 0), 0);
        const profit = revenue - costs;
        const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

        return {
            auftragId: auftragId,
            revenue: revenue,
            costs: costs,
            profit: profit,
            margin: margin + '%'
        };
    }

    getMonthlyBreakdown(year) {
        const months = {};

        for (let m = 1; m <= 12; m++) {
            const monthBuchungen = this.getBuchungenForMonat(year, m);
            const einnahmen = monthBuchungen.filter(b => b.typ === 'einnahme');
            const ausgaben = monthBuchungen.filter(b => b.typ === 'ausgabe');
            const materialKosten = monthBuchungen.filter(b => b.kategorie === 'Materialaufwendungen');

            const revenue = einnahmen.reduce((sum, b) => sum + (b.brutto || 0), 0);
            const totalExpenses = ausgaben.reduce((sum, b) => sum + (b.brutto || 0), 0);
            const cogs = materialKosten.reduce((sum, b) => sum + (b.brutto || 0), 0);

            const monthName = new Date(year, m - 1, 1).toLocaleDateString('de-DE', { month: 'long' });

            months[m] = {
                monat: monthName,
                einnahmen: revenue,
                ausgaben: totalExpenses,
                materialkosten: cogs,
                gewinn: revenue - cogs,
                bruttogewinn: revenue - totalExpenses
            };
        }

        return months;
    }

    findRechnungByBuchung(buchung) {
        // Helper to find invoice associated with a buchung
        return buchung.rechnungId;
    }

    getAllBuchungen() {
        return this.buchungen;
    }

    deleteBuchung(id) {
        this.buchungen = this.buchungen.filter(b => b.id !== id);
        this.save();
    }

    // ============================================
    // Ausgaben-Kategorien
    // ============================================
    getAusgabenKategorien() {
        return [
            'Materialaufwendungen',
            'Wareneinkauf',
            'Material/Rohstoffe',
            'Fremdleistungen',
            'Personal',
            'Miete/Pacht',
            'Versicherungen',
            'Fahrzeugkosten',
            'Reisekosten',
            'Bürobedarf',
            'Telefon/Internet',
            'Werbung/Marketing',
            'Fortbildung',
            'Abschreibungen',
            'Zinsen/Gebühren',
            'Sonstige Ausgaben'
        ];
    }

    // ============================================
    // Settings
    // ============================================
    updateEinstellungen(settings) {
        this.einstellungen = { ...this.einstellungen, ...settings };
        this.saveSettings();
    }

    getEinstellungen() {
        return this.einstellungen;
    }

    // ============================================
    // Persistence
    // ============================================
    save() {
        localStorage.setItem('freyai_buchungen', JSON.stringify(this.buchungen));
    }

    saveSettings() {
        localStorage.setItem('freyai_buchhaltung_settings', JSON.stringify(this.einstellungen));
    }

    // ============================================
    // Formatierung
    // ============================================
    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }
}

// Create global instance
window.bookkeepingService = new BookkeepingService();
