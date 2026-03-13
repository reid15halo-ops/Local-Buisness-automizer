/* ============================================
   Bookkeeping Service - EÜR & DATEV Export
   Einnahmen-Überschuss-Rechnung für KMUs
   Supabase-first — no localStorage
   ============================================ */

class BookkeepingService {
    constructor() {
        this.buchungen = [];
        this.einstellungen = {
            kleinunternehmer: false,
            umsatzsteuersatz: 19,
            firmenName: window.storeService?.state?.settings?.companyName || '',
            steuernummer: '',
            ustIdNr: '',
            finanzamt: '',
            geschaeftsjahr: new Date().getFullYear()
        };
        this._ready = false;
        this._localOnly = false;
    }

    async init() {
        try {
            const { data } = await this._supabase()?.auth?.getUser() || {};
            if (!data?.user) {
                console.warn('BookkeepingService: No authenticated user, using local-only mode');
                this._userId = 'local-' + crypto.randomUUID();
                this._localOnly = true;
            } else {
                this._userId = data.user.id;
            }
        } catch {
            console.warn('BookkeepingService: Auth failed, using local-only mode');
            this._userId = 'local-' + crypto.randomUUID();
            this._localOnly = true;
        }
        await this._loadFromSupabase();

        // Load Kleinunternehmer setting from company settings
        const isKU = window.companySettings?.isKleinunternehmer?.() ||
                     localStorage.getItem('kleinunternehmer') === 'true';
        this.einstellungen.kleinunternehmer = isKU;
        if (isKU) {
            this.einstellungen.umsatzsteuersatz = 0;
        }

        this._ready = true;
    }

    _supabase() {
        return window.supabaseClient?.client;
    }

    _isOnline() {
        return !!(this._supabase() && window.supabaseClient?.isConfigured());
    }

    _toSupabaseRow(b) {
        return {
            id: b.id,
            user_id: this._userId,
            tenant_id: 'a0000000-0000-0000-0000-000000000001',
            typ: b.typ,
            kategorie: b.kategorie,
            beschreibung: b.beschreibung || '',
            belegnummer: b.belegnummer || '',
            netto: b.netto || 0,
            ust: b.ust || 0,
            brutto: b.brutto || 0,
            vorsteuer: b.vorsteuer || 0,
            zahlungsart: b.zahlungsart || 'Überweisung',
            datum: b.datum,
            rechnung_id: b.rechnungId || null,
            po_id: b.poId || null,
            auftrag_id: b.auftragId || null
        };
    }

    _fromSupabaseRow(r) {
        return {
            id: r.id,
            typ: r.typ,
            kategorie: r.kategorie,
            beschreibung: r.beschreibung || '',
            belegnummer: r.belegnummer || '',
            netto: parseFloat(r.netto) || 0,
            ust: parseFloat(r.ust) || 0,
            brutto: parseFloat(r.brutto) || 0,
            vorsteuer: parseFloat(r.vorsteuer) || 0,
            zahlungsart: r.zahlungsart || 'Überweisung',
            datum: r.datum,
            rechnungId: r.rechnung_id || null,
            poId: r.po_id || null,
            auftragId: r.auftrag_id || null,
            erstelltAm: r.created_at
        };
    }

    async _loadFromSupabase() {
        if (!this._isOnline()) {return;}
        try {
            const { data, error } = await this._supabase()
                .from('buchungen')
                .select('*')
                .eq('tenant_id', 'a0000000-0000-0000-0000-000000000001')
                .order('datum', { ascending: false });
            if (error) {
                console.error('[Buchhaltung] Supabase load error:', error.message);
                return;
            }
            this.buchungen = (data || []).map(r => this._fromSupabaseRow(r));
            console.debug(`[Buchhaltung] Loaded ${this.buchungen.length} buchungen from Supabase`);
        } catch (err) {
            console.error('[Buchhaltung] Supabase load failed:', err.message);
        }
    }

    async _upsertToSupabase(buchung) {
        if (this._localOnly || !this._isOnline()) {return;}
        try {
            const row = this._toSupabaseRow(buchung);
            const { error } = await this._supabase()
                .from('buchungen')
                .upsert(row, { onConflict: 'id' });
            if (error) {console.error('[Buchhaltung] Supabase upsert error:', error.message);}
        } catch (err) {
            console.error('[Buchhaltung] Supabase upsert failed:', err.message);
        }
    }

    async _deleteFromSupabase(id) {
        if (this._localOnly || !this._isOnline()) {return;}
        try {
            const { error } = await this._supabase()
                .from('buchungen')
                .delete()
                .eq('id', id);
            if (error) {console.error('[Buchhaltung] Supabase delete error:', error.message);}
        } catch (err) {
            console.error('[Buchhaltung] Supabase delete failed:', err.message);
        }
    }

    // ============================================
    // Buchungen
    // ============================================
    async addBuchung(buchung) {
        buchung.id = `BU-${Date.now().toString(36).toUpperCase()}`;
        buchung.erstelltAm = new Date().toISOString();

        // Only calculate if not already set by caller (e.g. addFromPurchaseOrder)
        if (buchung.netto == null) {
            if (!this.einstellungen.kleinunternehmer && buchung.typ === 'einnahme') {
                const rate = this.einstellungen.umsatzsteuersatz || 19;
                buchung.netto = Math.round(buchung.brutto / (1 + rate / 100) * 100) / 100;
                buchung.ust = Math.round((buchung.brutto - buchung.netto) * 100) / 100;
            } else {
                buchung.netto = buchung.brutto;
                buchung.ust = 0;
            }
        }

        this.buchungen.push(buchung);
        await this._upsertToSupabase(buchung);
        return buchung;
    }

    // Automatisch aus Rechnung erstellen
async addFromRechnung(rechnung) {
        const kundenName = StorageUtils.getCustomerName(rechnung, 'financial');
        if (!kundenName) {
            console.error('[Bookkeeping] Skipping entry: missing customer for Rechnung', rechnung.id);
            return null;
        }

        const buchung = {
            typ: 'einnahme',
            kategorie: 'Umsatzerlöse',
            beschreibung: `Rechnung ${rechnung.id} - ${kundenName}`,
            rechnungId: rechnung.id,
            datum: rechnung.paidAt || rechnung.createdAt,
            brutto: rechnung.brutto,
            belegnummer: rechnung.id,
            zahlungsart: 'Überweisung'
        };
        return await this.addBuchung(buchung);
    }

    // Record payment when invoice is paid (creates Umsatzerlöse entry)
    async recordPayment(payment) {
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
        return await this.addBuchung(buchung);
    }

    // Record material costs (COGS) for an invoice
    async recordMaterialCosts(rechnung) {
        if (!rechnung.materialKosten && !rechnung.stueckliste) {
            return null;
        }

        const materialKosten = rechnung.materialKosten || 0;

        const kundenName = StorageUtils.getCustomerName(rechnung, 'financial');
        if (!kundenName) {
            console.error('[Bookkeeping] Skipping material cost entry: missing customer for Rechnung', rechnung.id);
            return null;
        }

        const buchung = {
            typ: 'ausgabe',
            kategorie: 'Materialaufwendungen',
            beschreibung: `Materialeinsatz Rechnung ${rechnung.nummer} - ${kundenName}`,
            rechnungId: rechnung.id,
            datum: rechnung.paidAt || rechnung.createdAt,
            brutto: materialKosten,
            belegnummer: rechnung.nummer,
            zahlungsart: 'Material',
            auftragId: rechnung.auftragId
        };
        return await this.addBuchung(buchung);
    }

    // Ausgabe aus Eingangsrechnung (Purchase Order) erstellen
    async addFromPurchaseOrder(po) {
        if (this.buchungen.some(b => b.poId === po.id)) {return null;}

        const buchung = {
            typ: 'ausgabe',
            kategorie: 'Wareneinkauf',
            beschreibung: `Eingangsrechnung ${po.eingangsrechnungNr || po.nummer} - ${po.lieferant?.name || 'Unbekannt'}`,
            poId: po.id,
            rechnungId: po.eingangsrechnungNr || po.nummer,
            datum: po.bestelldatum || po.erstelltAm,
            brutto: po.brutto || 0,
            netto: po.netto || 0,
            vorsteuer: po.mwst || 0,
            ust: 0,
            belegnummer: po.eingangsrechnungNr || po.nummer,
            zahlungsart: 'Überweisung'
        };
        return await this.addBuchung(buchung);
    }

    // Sync alle POs als Buchungen
    async syncFromPurchaseOrders() {
        if (!window.purchaseOrderService) {return;}
        const pos = window.purchaseOrderService.getAllPOs();
        let added = 0;
        for (const po of pos) {
            if (po.status === 'entwurf' || po.status === 'storniert') {continue;}
            if (this.buchungen.some(b => b.poId === po.id)) {continue;}
            await this.addFromPurchaseOrder(po);
            added++;
        }
        if (added > 0) {console.debug(`[Buchhaltung] ${added} Eingangsrechnungen als Buchungen erfasst`);}
    }

    // Ausgabe hinzufügen
    async addAusgabe(daten) {
        const rate = this.einstellungen.kleinunternehmer ? 0 : (this.einstellungen.umsatzsteuersatz || 19);
        const divisor = 1 + rate / 100;
        const buchung = {
            typ: 'ausgabe',
            kategorie: daten.kategorie || 'Sonstige Ausgaben',
            beschreibung: daten.beschreibung,
            datum: daten.datum || new Date().toISOString(),
            brutto: daten.betrag,
            netto: rate > 0 ? Math.round(daten.betrag / divisor * 100) / 100 : daten.betrag,
            vorsteuer: rate > 0 ? Math.round((daten.betrag - (daten.betrag / divisor)) * 100) / 100 : 0,
            belegnummer: daten.belegnummer || '',
            zahlungsart: daten.zahlungsart || 'Überweisung'
        };
        return await this.addBuchung(buchung);
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
            const datum = StorageUtils.safeDate(b.datum);
            if (!datum || datum.getFullYear() !== jahr) {return false;}

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
    async exportDATEV(options = {}) {
        // Delegate to the canonical DatevExportService implementation
        if (window.datevExportService) {
            return window.datevExportService.exportAndDownload(options);
        }
        throw new Error('DatevExportService nicht verfügbar. Bitte Seite neu laden.');
    }

    // CSV Export (einfacheres Format)
    exportCSV(jahr) {
        const buchungen = this.getBuchungenForJahr(jahr);

        const header = ['Datum', 'Typ', 'Kategorie', 'Beschreibung', 'Belegnr.', 'Netto', 'USt/VSt', 'Brutto'].join(';');

        const rows = buchungen.map(b => [
            (StorageUtils.safeDate(b.datum) || new Date()).toLocaleDateString('de-DE'),
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
    async importFromCSV(csvContent) {
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
                betrag = parseFloat(betrag.replace(/\./g, '').replace(',', '.'));
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

                await this.addBuchung(buchung);
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
            const datum = StorageUtils.safeDate(b.datum);
            return datum && datum.getFullYear() === jahr;
        });
    }

    getBuchungenForMonat(jahr, monat) {
        return this.buchungen.filter(b => {
            const datum = StorageUtils.safeDate(b.datum);
            return datum && datum.getFullYear() === jahr && datum.getMonth() + 1 === monat;
        });
    }

    getBuchungenByPeriod(typ, startDate, endDate) {
        const start = StorageUtils.safeDate(startDate);
        const end = StorageUtils.safeDate(endDate);
        if (!start || !end) {return [];}
        return this.buchungen.filter(b => {
            const datum = StorageUtils.safeDate(b.datum);
            return datum && b.typ === typ && datum >= start && datum <= end;
        });
    }

    getBuchungenByKategorie(kategorie, startDate = null, endDate = null) {
        let filtered = this.buchungen.filter(b => b.kategorie === kategorie);

        if (startDate && endDate) {
            const start = StorageUtils.safeDate(startDate);
            const end = StorageUtils.safeDate(endDate);
            if (!start || !end) {return filtered;}
            filtered = filtered.filter(b => {
                const datum = StorageUtils.safeDate(b.datum);
                return datum && datum >= start && datum <= end;
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
        const buchungen = this.buchungen.filter(b => b.auftragId === auftragId);

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

    async deleteBuchung(id) {
        this.buchungen = this.buchungen.filter(b => b.id !== id);
        await this._deleteFromSupabase(id);
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
    async save() {
        // Buchungen are persisted individually via _upsertToSupabase in addBuchung
    }

    saveSettings() {
        // Settings stored in-memory; persisted via Supabase settings table if available
    }

    async refresh() {
        await this._loadFromSupabase();
    }

    // ============================================
    // Formatierung
    // ============================================
    formatCurrency(amount) {
        return window.formatCurrency(amount);
    }
}

// Create global instance
window.bookkeepingService = new BookkeepingService();

// Init after Supabase is ready
window.addEventListener('DOMContentLoaded', () => {
    let attempts = 0;
    const MAX_ATTEMPTS = 30;
    const tryInit = () => {
        attempts++;
        if (window.supabaseClient?.isConfigured()) {
            window.bookkeepingService.init().then(() => {
                console.debug('[Buchhaltung] Service initialized');
            });
        } else if (attempts > MAX_ATTEMPTS) {
            console.warn('BookkeepingService: Supabase not available after 30s, running local-only');
            window.bookkeepingService.init();
        } else {
            setTimeout(tryInit, 1000);
        }
    };
    setTimeout(tryInit, 1500);
});
