/* ============================================
   Bon Scanner Service
   Kassenbon-Erkennung, Lieferanten-CSV-Import
   & automatische Materialzuordnung
   ============================================ */

class BonScannerService {
    constructor() {
        this.wareneingaenge = JSON.parse(localStorage.getItem('freyai_wareneingaenge') || '[]');

        // Regex-Muster für bekannte Baumarkt-/Lieferanten-Bons
        this.supplierPatterns = {
            obi: {
                name: 'OBI',
                pattern: /obi\s*(bau)?markt|obi\s*filiale|obi\s*gmbh/i,
                artikelPattern: /^(\d+)\s+(ST|STK|M|KG|L|PAK|SET)\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/,
                datePattern: /(\d{2}\.\d{2}\.\d{4})\s+\d{2}:\d{2}/,
                totalPattern: /(?:SUMME|GESAMT|TOTAL)\s+(?:EUR\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})/i
            },
            hornbach: {
                name: 'Hornbach',
                pattern: /hornbach|hornbach\s*baumarkt/i,
                artikelPattern: /^(\d+)\s*[xX]?\s*(ST|STK|M|KG|LFM|PAK)\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/,
                datePattern: /Datum[:\s]+(\d{2}\.\d{2}\.\d{4})/i,
                totalPattern: /(?:SUMME|GESAMT|TOTAL|Gesamtbetrag)\s*[:\s]*(?:EUR\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})/i
            },
            bauhaus: {
                name: 'Bauhaus',
                pattern: /bauhaus\s*(ag|gmbh)?|bauhaus\s*fachcentren/i,
                artikelPattern: /^(\d{7,13})?\s*(\d+(?:,\d+)?)\s*(ST|STK|M|KG|L|PAK)\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/,
                datePattern: /(\d{2}\.\d{2}\.\d{4})/,
                totalPattern: /(?:SUMME|TOTAL|Gesamtbetrag|BETRAG)\s*[:\s]*(?:EUR\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})/i
            },
            toom: {
                name: 'toom Baumarkt',
                pattern: /toom\s*baumarkt|toom\s*gmbh/i,
                artikelPattern: /^(\d+)\s+(ST|STK|M|KG|L|PAK)\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/,
                datePattern: /(\d{2}\.\d{2}\.\d{4})/,
                totalPattern: /(?:SUMME|GESAMT|TOTAL)\s*[:\s]*(?:EUR\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})/i
            },
            hagebau: {
                name: 'hagebaumarkt',
                pattern: /hagebau|hagebaumarkt|hage\s*bau/i,
                artikelPattern: /^(\d+)\s+(ST|STK|M|KG|L|PAK)\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/,
                datePattern: /(\d{2}\.\d{2}\.\d{4})/,
                totalPattern: /(?:SUMME|GESAMT|TOTAL)\s*[:\s]*(?:EUR\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})/i
            },
            wuerth: {
                name: 'Würth',
                pattern: /w[üu]rth|adolf\s*w[üu]rth|w[üu]rth\s*gmbh/i,
                artikelPattern: /^(\d{6,10})\s+(.+?)\s+(\d+(?:,\d+)?)\s*(ST|STK|M|KG|PAK|SET)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/,
                datePattern: /(?:Datum|Date)[:\s]+(\d{2}\.\d{2}\.\d{4})/i,
                totalPattern: /(?:Gesamtbetrag|Nettobetrag|SUMME|TOTAL)\s*[:\s]*(?:EUR\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})/i
            },
            kloeckner: {
                name: 'Klöckner',
                pattern: /kl[öo]ckner|kl[öo]ckner\s*(&\s*co|metals)/i,
                artikelPattern: /^(\d{6,12})\s+(.+?)\s+(\d+(?:,\d+)?)\s*(ST|STK|M|KG|T|TO)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/,
                datePattern: /(?:Datum|Lieferdatum|Rechnungsdatum)[:\s]+(\d{2}\.\d{2}\.\d{4})/i,
                totalPattern: /(?:Gesamtbetrag|Nettobetrag|Summe|Rechnungsbetrag)\s*[:\s]*(?:EUR\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})/i
            }
        };
    }

    // ============================================
    // 1. Bon-Text parsen (OCR-Ergebnis)
    // ============================================

    /**
     * OCR-Text eines Kassenbons parsen und Positionen extrahieren
     * @param {string} ocrText - Roher OCR-Text vom Bon
     * @returns {Object} {supplier, date, items[], summe, mwst, belegNummer}
     */
    parseReceiptText(ocrText) {
        if (!ocrText || typeof ocrText !== 'string') {
            return { supplier: null, date: null, items: [], summe: 0, mwst: 0, belegNummer: null };
        }

        const text = ocrText.trim();
        const supplier = this._detectSupplier(text);

        // Lieferanten-spezifischen Parser verwenden, falls vorhanden
        switch (supplier) {
            case 'OBI':
                return this._parseOBIReceipt(text, supplier);
            case 'Hornbach':
                return this._parseHornbachReceipt(text, supplier);
            case 'Bauhaus':
                return this._parseBauhausReceipt(text, supplier);
            case 'Würth':
                return this._parseWuerthReceipt(text, supplier);
            case 'Klöckner':
                return this._parseKloecknerReceipt(text, supplier);
            default:
                return this._parseGenericReceipt(text, supplier);
        }
    }

    /**
     * OBI-Bon parsen
     * Format: Menge Einheit Bezeichnung Preis
     */
    _parseOBIReceipt(text, supplier) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const items = [];
        let summe = 0;
        let mwst = 0;
        let date = null;
        let belegNummer = null;

        // Datum suchen
        const dateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})\s+\d{2}:\d{2}/);
        if (dateMatch) {
            date = this._parseGermanDate(dateMatch[1]);
        }

        // Belegnummer suchen
        const belegMatch = text.match(/(?:Bon|Beleg|Kassenbon)[- ]?(?:Nr\.?|Nummer)?[:\s]*(\S+)/i);
        if (belegMatch) {
            belegNummer = belegMatch[1];
        }

        for (const line of lines) {
            // OBI-Format: "2 ST  Schrauben M8x40     3,49"
            const match = line.match(/^(\d+(?:,\d+)?)\s+(ST|STK|M|KG|L|PAK|SET|PCK|ROL)\s+(.+?)\s{2,}(\d{1,3}(?:\.\d{3})*,\d{2})\s*[AB]?\s*$/i);
            if (match) {
                const menge = this._parseGermanNumber(match[1]);
                const einheit = this._normalizeEinheit(match[2]);
                const bezeichnung = match[3].trim();
                const gesamtpreis = this._parseGermanNumber(match[4]);
                const einzelpreis = menge > 0 ? Math.round((gesamtpreis / menge) * 100) / 100 : gesamtpreis;

                items.push({
                    beschreibung: bezeichnung,
                    menge: menge,
                    einheit: einheit,
                    einzelpreis: einzelpreis,
                    gesamtpreis: gesamtpreis
                });
                continue;
            }

            // Alternative: Artikelnummer vorangestellt
            const altMatch = line.match(/^(\d{6,13})\s+(.+?)\s+(\d+(?:,\d+)?)\s+(ST|STK|M|KG|L)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
            if (altMatch) {
                const artikelnummer = altMatch[1];
                const bezeichnung = altMatch[2].trim();
                const menge = this._parseGermanNumber(altMatch[3]);
                const einheit = this._normalizeEinheit(altMatch[4]);
                const gesamtpreis = this._parseGermanNumber(altMatch[5]);
                const einzelpreis = menge > 0 ? Math.round((gesamtpreis / menge) * 100) / 100 : gesamtpreis;

                items.push({
                    artikelnummer: artikelnummer,
                    beschreibung: bezeichnung,
                    menge: menge,
                    einheit: einheit,
                    einzelpreis: einzelpreis,
                    gesamtpreis: gesamtpreis
                });
            }
        }

        // Summe extrahieren
        const summeMatch = text.match(/(?:SUMME|GESAMT|TOTAL|zu zahlen)\s*(?:EUR)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (summeMatch) {
            summe = this._parseGermanNumber(summeMatch[1]);
        } else if (items.length > 0) {
            summe = items.reduce((s, item) => s + item.gesamtpreis, 0);
        }

        // MwSt extrahieren
        const mwstMatch = text.match(/(?:MwSt|USt|Mwst\.|Mehrwertsteuer)\s*(?:\d+(?:,\d+)?%?)?\s*(?:EUR)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (mwstMatch) {
            mwst = this._parseGermanNumber(mwstMatch[1]);
        }

        return { supplier, date, items, summe, mwst, belegNummer };
    }

    /**
     * Hornbach-Bon parsen
     */
    _parseHornbachReceipt(text, supplier) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const items = [];
        let summe = 0;
        let mwst = 0;
        let date = null;
        let belegNummer = null;

        const dateMatch = text.match(/Datum[:\s]+(\d{2}\.\d{2}\.\d{4})/i) || text.match(/(\d{2}\.\d{2}\.\d{4})/);
        if (dateMatch) {
            date = this._parseGermanDate(dateMatch[1]);
        }

        const belegMatch = text.match(/(?:Bon|Beleg|Kassen)[- ]?(?:Nr\.?|Nummer)?[:\s]*(\S+)/i);
        if (belegMatch) {
            belegNummer = belegMatch[1];
        }

        for (const line of lines) {
            // Hornbach-Format: "2 x ST  Schrauben M8     3,49" oder "1 ST Bezeichnung  12,50"
            const match = line.match(/^(\d+(?:,\d+)?)\s*[xX]?\s*(ST|STK|M|KG|LFM|L|PAK|SET)\s+(.+?)\s{2,}(\d{1,3}(?:\.\d{3})*,\d{2})\s*[AB]?\s*$/i);
            if (match) {
                const menge = this._parseGermanNumber(match[1]);
                const einheit = this._normalizeEinheit(match[2]);
                const bezeichnung = match[3].trim();
                const gesamtpreis = this._parseGermanNumber(match[4]);
                const einzelpreis = menge > 0 ? Math.round((gesamtpreis / menge) * 100) / 100 : gesamtpreis;

                items.push({
                    beschreibung: bezeichnung,
                    menge: menge,
                    einheit: einheit,
                    einzelpreis: einzelpreis,
                    gesamtpreis: gesamtpreis
                });
            }
        }

        const summeMatch = text.match(/(?:SUMME|GESAMT|TOTAL|Gesamtbetrag|zu zahlen)\s*[:\s]*(?:EUR\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (summeMatch) {
            summe = this._parseGermanNumber(summeMatch[1]);
        } else if (items.length > 0) {
            summe = items.reduce((s, item) => s + item.gesamtpreis, 0);
        }

        const mwstMatch = text.match(/(?:MwSt|USt|Mehrwertsteuer)\s*(?:\d+(?:,\d+)?%?)?\s*(?:EUR)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (mwstMatch) {
            mwst = this._parseGermanNumber(mwstMatch[1]);
        }

        return { supplier, date, items, summe, mwst, belegNummer };
    }

    /**
     * Bauhaus-Bon parsen
     * Kann optionale Artikelnummern haben
     */
    _parseBauhausReceipt(text, supplier) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const items = [];
        let summe = 0;
        let mwst = 0;
        let date = null;
        let belegNummer = null;

        const dateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})/);
        if (dateMatch) {
            date = this._parseGermanDate(dateMatch[1]);
        }

        const belegMatch = text.match(/(?:Beleg|Bon|Kasse)[- ]?(?:Nr\.?|Nummer)?[:\s]*(\S+)/i);
        if (belegMatch) {
            belegNummer = belegMatch[1];
        }

        for (const line of lines) {
            // Bauhaus-Format mit optionaler Artikelnummer
            const matchArt = line.match(/^(\d{7,13})\s+(\d+(?:,\d+)?)\s+(ST|STK|M|KG|L|PAK)\s+(.+?)\s{2,}(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
            if (matchArt) {
                const artikelnummer = matchArt[1];
                const menge = this._parseGermanNumber(matchArt[2]);
                const einheit = this._normalizeEinheit(matchArt[3]);
                const bezeichnung = matchArt[4].trim();
                const gesamtpreis = this._parseGermanNumber(matchArt[5]);
                const einzelpreis = menge > 0 ? Math.round((gesamtpreis / menge) * 100) / 100 : gesamtpreis;

                items.push({
                    artikelnummer: artikelnummer,
                    beschreibung: bezeichnung,
                    menge: menge,
                    einheit: einheit,
                    einzelpreis: einzelpreis,
                    gesamtpreis: gesamtpreis
                });
                continue;
            }

            // Bauhaus ohne Artikelnummer
            const matchNoArt = line.match(/^(\d+(?:,\d+)?)\s+(ST|STK|M|KG|L|PAK)\s+(.+?)\s{2,}(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
            if (matchNoArt) {
                const menge = this._parseGermanNumber(matchNoArt[1]);
                const einheit = this._normalizeEinheit(matchNoArt[2]);
                const bezeichnung = matchNoArt[3].trim();
                const gesamtpreis = this._parseGermanNumber(matchNoArt[4]);
                const einzelpreis = menge > 0 ? Math.round((gesamtpreis / menge) * 100) / 100 : gesamtpreis;

                items.push({
                    beschreibung: bezeichnung,
                    menge: menge,
                    einheit: einheit,
                    einzelpreis: einzelpreis,
                    gesamtpreis: gesamtpreis
                });
            }
        }

        const summeMatch = text.match(/(?:SUMME|TOTAL|Gesamtbetrag|BETRAG)\s*[:\s]*(?:EUR\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (summeMatch) {
            summe = this._parseGermanNumber(summeMatch[1]);
        } else if (items.length > 0) {
            summe = items.reduce((s, item) => s + item.gesamtpreis, 0);
        }

        const mwstMatch = text.match(/(?:MwSt|USt|Mehrwertsteuer)\s*(?:\d+(?:,\d+)?%?)?\s*(?:EUR)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (mwstMatch) {
            mwst = this._parseGermanNumber(mwstMatch[1]);
        }

        return { supplier, date, items, summe, mwst, belegNummer };
    }

    /**
     * Würth-Beleg parsen (professioneller Lieferant, hat Artikelnummern)
     * Format: Artikelnr  Bezeichnung  Menge  Einheit  Einzelpreis  Gesamtpreis
     */
    _parseWuerthReceipt(text, supplier) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const items = [];
        let summe = 0;
        let mwst = 0;
        let date = null;
        let belegNummer = null;

        const dateMatch = text.match(/(?:Datum|Date|Rechnungsdatum|Lieferdatum)[:\s]+(\d{2}\.\d{2}\.\d{4})/i);
        if (dateMatch) {
            date = this._parseGermanDate(dateMatch[1]);
        } else {
            const simpleDateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})/);
            if (simpleDateMatch) {
                date = this._parseGermanDate(simpleDateMatch[1]);
            }
        }

        const belegMatch = text.match(/(?:Rechnung|Lieferschein|Beleg|Auftrags)[- ]?(?:Nr\.?|Nummer)?[:\s]*(\S+)/i);
        if (belegMatch) {
            belegNummer = belegMatch[1];
        }

        for (const line of lines) {
            // Würth-Format: "0891234567  Schraube DIN 931 M12x40  10  ST  0,45  4,50"
            const match = line.match(/^(\d{6,15})\s+(.+?)\s+(\d+(?:,\d+)?)\s+(ST|STK|M|KG|PAK|SET|PCK|ROL|DS)\s+(\d{1,3}(?:\.\d{3})*,\d{2,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
            if (match) {
                const artikelnummer = match[1];
                const bezeichnung = match[2].trim();
                const menge = this._parseGermanNumber(match[3]);
                const einheit = this._normalizeEinheit(match[4]);
                const einzelpreis = this._parseGermanNumber(match[5]);
                const gesamtpreis = this._parseGermanNumber(match[6]);

                items.push({
                    artikelnummer: artikelnummer,
                    beschreibung: bezeichnung,
                    menge: menge,
                    einheit: einheit,
                    einzelpreis: einzelpreis,
                    gesamtpreis: gesamtpreis
                });
                continue;
            }

            // Alternatives Würth-Format: "0891234567 Schraube DIN 931 M12x40  10 ST  4,50"
            const altMatch = line.match(/^(\d{6,15})\s+(.+?)\s+(\d+(?:,\d+)?)\s+(ST|STK|M|KG|PAK|SET)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
            if (altMatch) {
                const artikelnummer = altMatch[1];
                const bezeichnung = altMatch[2].trim();
                const menge = this._parseGermanNumber(altMatch[3]);
                const einheit = this._normalizeEinheit(altMatch[4]);
                const gesamtpreis = this._parseGermanNumber(altMatch[5]);
                const einzelpreis = menge > 0 ? Math.round((gesamtpreis / menge) * 100) / 100 : gesamtpreis;

                items.push({
                    artikelnummer: artikelnummer,
                    beschreibung: bezeichnung,
                    menge: menge,
                    einheit: einheit,
                    einzelpreis: einzelpreis,
                    gesamtpreis: gesamtpreis
                });
            }
        }

        const summeMatch = text.match(/(?:Gesamtbetrag|Nettobetrag|SUMME|TOTAL|Rechnungsbetrag)\s*[:\s]*(?:EUR\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (summeMatch) {
            summe = this._parseGermanNumber(summeMatch[1]);
        } else if (items.length > 0) {
            summe = items.reduce((s, item) => s + item.gesamtpreis, 0);
        }

        const mwstMatch = text.match(/(?:MwSt|USt|Mehrwertsteuer)\s*(?:\d+(?:,\d+)?%?)?\s*(?:EUR)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (mwstMatch) {
            mwst = this._parseGermanNumber(mwstMatch[1]);
        }

        return { supplier, date, items, summe, mwst, belegNummer };
    }

    /**
     * Klöckner-Beleg parsen (Stahlhandel, professionell)
     * Format: Artikelnr  Bezeichnung  Menge  Einheit  Einzelpreis  Gesamtpreis
     */
    _parseKloecknerReceipt(text, supplier) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const items = [];
        let summe = 0;
        let mwst = 0;
        let date = null;
        let belegNummer = null;

        const dateMatch = text.match(/(?:Datum|Lieferdatum|Rechnungsdatum)[:\s]+(\d{2}\.\d{2}\.\d{4})/i);
        if (dateMatch) {
            date = this._parseGermanDate(dateMatch[1]);
        } else {
            const simpleDateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})/);
            if (simpleDateMatch) {
                date = this._parseGermanDate(simpleDateMatch[1]);
            }
        }

        const belegMatch = text.match(/(?:Rechnung|Lieferschein|Auftrags|Beleg)[- ]?(?:Nr\.?|Nummer)?[:\s]*(\S+)/i);
        if (belegMatch) {
            belegNummer = belegMatch[1];
        }

        for (const line of lines) {
            // Klöckner-Format: "123456  IPE 100 S235JR  6,000  M  12,50  75,00"
            const match = line.match(/^(\d{5,12})\s+(.+?)\s+(\d+(?:,\d{1,3})?)\s+(ST|STK|M|KG|T|TO|QM|LFM)\s+(\d{1,3}(?:\.\d{3})*,\d{2,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
            if (match) {
                const artikelnummer = match[1];
                const bezeichnung = match[2].trim();
                const menge = this._parseGermanNumber(match[3]);
                const einheit = this._normalizeEinheit(match[4]);
                const einzelpreis = this._parseGermanNumber(match[5]);
                const gesamtpreis = this._parseGermanNumber(match[6]);

                items.push({
                    artikelnummer: artikelnummer,
                    beschreibung: bezeichnung,
                    menge: menge,
                    einheit: einheit,
                    einzelpreis: einzelpreis,
                    gesamtpreis: gesamtpreis
                });
                continue;
            }

            // Vereinfachtes Format ohne Einzelpreis
            const altMatch = line.match(/^(\d{5,12})\s+(.+?)\s+(\d+(?:,\d{1,3})?)\s+(ST|STK|M|KG|T|TO|QM)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
            if (altMatch) {
                const artikelnummer = altMatch[1];
                const bezeichnung = altMatch[2].trim();
                const menge = this._parseGermanNumber(altMatch[3]);
                const einheit = this._normalizeEinheit(altMatch[4]);
                const gesamtpreis = this._parseGermanNumber(altMatch[5]);
                const einzelpreis = menge > 0 ? Math.round((gesamtpreis / menge) * 100) / 100 : gesamtpreis;

                items.push({
                    artikelnummer: artikelnummer,
                    beschreibung: bezeichnung,
                    menge: menge,
                    einheit: einheit,
                    einzelpreis: einzelpreis,
                    gesamtpreis: gesamtpreis
                });
            }
        }

        const summeMatch = text.match(/(?:Gesamtbetrag|Nettobetrag|Summe|Rechnungsbetrag)\s*[:\s]*(?:EUR\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (summeMatch) {
            summe = this._parseGermanNumber(summeMatch[1]);
        } else if (items.length > 0) {
            summe = items.reduce((s, item) => s + item.gesamtpreis, 0);
        }

        const mwstMatch = text.match(/(?:MwSt|USt|Mehrwertsteuer)\s*(?:\d+(?:,\d+)?%?)?\s*(?:EUR)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (mwstMatch) {
            mwst = this._parseGermanNumber(mwstMatch[1]);
        }

        return { supplier, date, items, summe, mwst, belegNummer };
    }

    /**
     * Generischer/Fallback-Parser für unbekannte Bon-Formate
     */
    _parseGenericReceipt(text, supplier) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const items = [];
        let summe = 0;
        let mwst = 0;
        let date = null;
        let belegNummer = null;

        // Datum suchen (verschiedene Formate)
        const dateMatch = text.match(/(?:Datum|Date)?[:\s]*(\d{2}\.\d{2}\.\d{4})/i);
        if (dateMatch) {
            date = this._parseGermanDate(dateMatch[1]);
        }

        // Belegnummer suchen
        const belegMatch = text.match(/(?:Rechnung|Beleg|Bon|Quittung|Lieferschein)[- ]?(?:Nr\.?|Nummer)?[:\s]*([A-Z0-9\-\/]+)/i);
        if (belegMatch) {
            belegNummer = belegMatch[1];
        }

        // Verschiedene Zeilenformate ausprobieren
        for (const line of lines) {
            // Summen-/MwSt-Zeilen überspringen
            if (/^(SUMME|GESAMT|TOTAL|MwSt|USt|Mehrwertsteuer|BAR|EC|KARTE|Kartenzahlung|GEGEBEN|ZURÜCK)/i.test(line)) {
                continue;
            }

            // Format 1: "Menge Einheit Beschreibung   Preis"
            const m1 = line.match(/^(\d+(?:,\d+)?)\s+(ST|STK|M|KG|L|PAK|SET|PCK|ROL|QM|LFM)\s+(.+?)\s{2,}(\d{1,3}(?:\.\d{3})*,\d{2})\s*[AB]?\s*$/i);
            if (m1) {
                const menge = this._parseGermanNumber(m1[1]);
                const einheit = this._normalizeEinheit(m1[2]);
                const bezeichnung = m1[3].trim();
                const gesamtpreis = this._parseGermanNumber(m1[4]);
                const einzelpreis = menge > 0 ? Math.round((gesamtpreis / menge) * 100) / 100 : gesamtpreis;

                items.push({ beschreibung: bezeichnung, menge, einheit, einzelpreis, gesamtpreis });
                continue;
            }

            // Format 2: "ArtNr Beschreibung  Menge Einheit Einzelpreis Gesamtpreis"
            const m2 = line.match(/^(\d{5,15})\s+(.+?)\s+(\d+(?:,\d+)?)\s+(ST|STK|M|KG|L|PAK|SET|QM|LFM|T)\s+(\d{1,3}(?:\.\d{3})*,\d{2,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
            if (m2) {
                items.push({
                    artikelnummer: m2[1],
                    beschreibung: m2[2].trim(),
                    menge: this._parseGermanNumber(m2[3]),
                    einheit: this._normalizeEinheit(m2[4]),
                    einzelpreis: this._parseGermanNumber(m2[5]),
                    gesamtpreis: this._parseGermanNumber(m2[6])
                });
                continue;
            }

            // Format 3: "ArtNr Beschreibung Menge Einheit Gesamtpreis" (kein Einzelpreis)
            const m3 = line.match(/^(\d{5,15})\s+(.+?)\s+(\d+(?:,\d+)?)\s+(ST|STK|M|KG|L|PAK|SET|QM|LFM)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/i);
            if (m3) {
                const menge = this._parseGermanNumber(m3[3]);
                const gesamtpreis = this._parseGermanNumber(m3[5]);
                items.push({
                    artikelnummer: m3[1],
                    beschreibung: m3[2].trim(),
                    menge: menge,
                    einheit: this._normalizeEinheit(m3[4]),
                    einzelpreis: menge > 0 ? Math.round((gesamtpreis / menge) * 100) / 100 : gesamtpreis,
                    gesamtpreis: gesamtpreis
                });
                continue;
            }

            // Format 4: "Beschreibung       Preis" (einfachstes Format)
            const m4 = line.match(/^([A-Za-zÄÖÜäöüß][\w\sÄÖÜäöüß\-\/\.]{3,}?)\s{2,}(\d{1,3}(?:\.\d{3})*,\d{2})\s*[AB]?\s*$/);
            if (m4) {
                const bezeichnung = m4[1].trim();
                const gesamtpreis = this._parseGermanNumber(m4[2]);
                // Nur wenn es nicht nach einer Kopf-/Fußzeile aussieht
                if (gesamtpreis > 0 && bezeichnung.length > 3 &&
                    !/^(Filiale|Markt|Kasse|Datum|Uhrzeit|Bediener|USt|MwSt|IBAN|BIC|Tel|Fax)/i.test(bezeichnung)) {
                    items.push({
                        beschreibung: bezeichnung,
                        menge: 1,
                        einheit: 'Stk.',
                        einzelpreis: gesamtpreis,
                        gesamtpreis: gesamtpreis
                    });
                }
            }
        }

        // Summe extrahieren
        const summeMatch = text.match(/(?:SUMME|GESAMT|TOTAL|Gesamtbetrag|zu zahlen|Betrag)\s*[:\s]*(?:EUR\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (summeMatch) {
            summe = this._parseGermanNumber(summeMatch[1]);
        } else if (items.length > 0) {
            summe = items.reduce((s, item) => s + item.gesamtpreis, 0);
        }

        // MwSt extrahieren
        const mwstMatch = text.match(/(?:MwSt|USt|Mwst\.|Mehrwertsteuer)\s*(?:\d+(?:,\d+)?%?)?\s*(?:EUR)?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
        if (mwstMatch) {
            mwst = this._parseGermanNumber(mwstMatch[1]);
        }

        return { supplier, date, items, summe, mwst, belegNummer };
    }

    // ============================================
    // 2. Material-Zuordnung
    // ============================================

    /**
     * Geparste Bon-Positionen mit vorhandenem Materialstamm abgleichen
     * @param {Array} parsedItems - Array von {artikelnummer?, beschreibung, menge, einheit, ...}
     * @returns {Array} Items mit matchedMaterialId, matchConfidence, matchSuggestions
     */
    matchItemsToMaterials(parsedItems) {
        if (!window.materialService) {
            console.warn('MaterialService nicht verfügbar');
            return parsedItems.map(item => ({
                ...item,
                matchedMaterialId: null,
                matchConfidence: 0,
                matchSuggestions: []
            }));
        }

        const allMaterials = window.materialService.getAllMaterials();

        return parsedItems.map(item => {
            let bestMatch = null;
            let bestConfidence = 0;
            const suggestions = [];

            // 1. Exakter Abgleich per Artikelnummer
            if (item.artikelnummer) {
                const exact = window.materialService.getMaterialByArtikelnummer(item.artikelnummer);
                if (exact) {
                    return {
                        ...item,
                        matchedMaterialId: exact.id,
                        matchConfidence: 1.0,
                        matchSuggestions: [{ materialId: exact.id, bezeichnung: exact.bezeichnung, confidence: 1.0 }]
                    };
                }

                // Teilweise Artikelnummer-Übereinstimmung
                for (const mat of allMaterials) {
                    if (mat.artikelnummer &&
                        (mat.artikelnummer.includes(item.artikelnummer) || item.artikelnummer.includes(mat.artikelnummer))) {
                        const conf = 0.8;
                        suggestions.push({ materialId: mat.id, bezeichnung: mat.bezeichnung, confidence: conf });
                        if (conf > bestConfidence) {
                            bestMatch = mat.id;
                            bestConfidence = conf;
                        }
                    }
                }
            }

            // 2. Fuzzy-Abgleich per Bezeichnung
            for (const mat of allMaterials) {
                const similarity = this._fuzzyMatch(item.beschreibung, mat.bezeichnung);

                // Bonus, wenn Einheit übereinstimmt
                let adjustedSimilarity = similarity;
                if (item.einheit && mat.einheit &&
                    this._normalizeEinheit(item.einheit) === this._normalizeEinheit(mat.einheit)) {
                    adjustedSimilarity = Math.min(1.0, similarity + 0.05);
                }

                // Bonus, wenn Preise ähnlich sind
                if (item.einzelpreis && mat.preis && mat.preis > 0) {
                    const preisDiff = Math.abs(item.einzelpreis - mat.preis) / mat.preis;
                    if (preisDiff < 0.1) {
                        adjustedSimilarity = Math.min(1.0, adjustedSimilarity + 0.1);
                    }
                }

                if (adjustedSimilarity > 0.3) {
                    suggestions.push({
                        materialId: mat.id,
                        bezeichnung: mat.bezeichnung,
                        confidence: Math.round(adjustedSimilarity * 100) / 100
                    });
                }

                if (adjustedSimilarity > bestConfidence) {
                    bestMatch = mat.id;
                    bestConfidence = adjustedSimilarity;
                }
            }

            // Top 3 Vorschläge, absteigend nach Konfidenz
            suggestions.sort((a, b) => b.confidence - a.confidence);
            const top3 = suggestions.slice(0, 3);

            return {
                ...item,
                matchedMaterialId: bestConfidence >= 0.5 ? bestMatch : null,
                matchConfidence: Math.round(bestConfidence * 100) / 100,
                matchSuggestions: top3
            };
        });
    }

    // ============================================
    // 3. Auftrag-Zuordnung vorschlagen
    // ============================================

    /**
     * Versucht einen passenden Auftrag für die eingekauften Materialien zu finden
     * @param {Array} items - Geparste Items mit matchedMaterialId
     * @returns {Array} Sortierte Vorschläge [{auftragId, auftragLabel, matchScore, matchedItems}]
     */
    suggestAuftrag(items) {
        if (typeof store === 'undefined' || !store.auftraege) {
            return [];
        }

        // Nur Aufträge mit passendem Status berücksichtigen
        const relevantStatuses = ['geplant', 'material_bestellt', 'in_bearbeitung', 'in_arbeit'];
        const auftraege = store.auftraege.filter(a => relevantStatuses.includes(a.status));

        if (auftraege.length === 0) {
            return [];
        }

        const materialIds = items
            .filter(i => i.matchedMaterialId)
            .map(i => i.matchedMaterialId);

        const itemBezeichnungen = items.map(i => (i.beschreibung || '').toLowerCase());

        const suggestions = [];

        for (const auftrag of auftraege) {
            let matchScore = 0;
            const matchedItems = [];

            // Stückliste prüfen
            const stueckliste = auftrag.stueckliste || [];
            for (const stItem of stueckliste) {
                // Abgleich per materialId
                if (stItem.materialId && materialIds.includes(stItem.materialId)) {
                    matchScore += 2;
                    matchedItems.push({
                        materialId: stItem.materialId,
                        beschreibung: stItem.beschreibung || stItem.bezeichnung,
                        type: 'materialId'
                    });
                    continue;
                }

                // Abgleich per Bezeichnung
                const stBez = (stItem.beschreibung || stItem.bezeichnung || '').toLowerCase();
                if (stBez) {
                    for (const itemBez of itemBezeichnungen) {
                        if (this._fuzzyMatch(itemBez, stBez) > 0.5) {
                            matchScore += 1;
                            matchedItems.push({
                                beschreibung: stBez,
                                type: 'fuzzy'
                            });
                            break;
                        }
                    }
                }
            }

            // Positionen prüfen
            const positionen = auftrag.positionen || [];
            for (const pos of positionen) {
                const posBez = (pos.beschreibung || '').toLowerCase();
                if (posBez) {
                    for (const itemBez of itemBezeichnungen) {
                        if (this._fuzzyMatch(itemBez, posBez) > 0.4) {
                            matchScore += 0.5;
                            break;
                        }
                    }
                }
            }

            if (matchScore > 0) {
                const auftragLabel = `${auftrag.id} - ${auftrag.kunde?.name || 'Unbekannt'} (${auftrag.leistungsart || ''})`;
                suggestions.push({
                    auftragId: auftrag.id,
                    auftragLabel: auftragLabel,
                    matchScore: Math.round(matchScore * 100) / 100,
                    matchedItems: matchedItems
                });
            }
        }

        // Absteigend nach Score sortieren
        suggestions.sort((a, b) => b.matchScore - a.matchScore);
        return suggestions;
    }

    // ============================================
    // 4. Wareneingang verarbeiten
    // ============================================

    /**
     * Kompletten Wareneingang erfassen und Bestände aktualisieren
     * @param {Object} data - Wareneingangsdaten
     * @returns {Object} Erstellter Wareneingangsbeleg
     */
    processWareneingang(data) {
        try {
            const wareneingang = {
                id: `WE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                source: data.source || 'bon_scan',
                supplier: data.supplier || 'Unbekannt',
                belegNummer: data.belegNummer || null,
                datum: data.datum || new Date().toISOString().split('T')[0],
                items: [],
                summe: data.summe || 0,
                auftragId: data.auftragId || null,
                imageData: data.imageData || null,
                notizen: data.notizen || '',
                erstelltAm: new Date().toISOString()
            };

            // Items verarbeiten und Bestände aktualisieren
            const stockUpdates = [];

            for (const item of (data.items || [])) {
                const weItem = {
                    materialId: item.materialId || null,
                    beschreibung: item.beschreibung || '',
                    menge: item.menge || 0,
                    einheit: item.einheit || 'Stk.',
                    einzelpreis: item.einzelpreis || 0,
                    gesamtpreis: (item.menge || 0) * (item.einzelpreis || 0),
                    bestandAktualisiert: false
                };

                // Bestand aktualisieren, wenn Material zugeordnet
                if (weItem.materialId && weItem.menge > 0 && window.materialService) {
                    const material = window.materialService.getMaterial(weItem.materialId);
                    if (material) {
                        const previousStock = material.bestand;
                        window.materialService.updateStock(weItem.materialId, weItem.menge);

                        // Lagerbewegung aufzeichnen
                        window.materialService._recordStockMovement({
                            materialId: weItem.materialId,
                            auftragId: data.auftragId || null,
                            type: 'received',
                            quantity: weItem.menge,
                            previousStock: previousStock,
                            newStock: previousStock + weItem.menge
                        });

                        weItem.bestandAktualisiert = true;
                        stockUpdates.push({
                            materialId: weItem.materialId,
                            bezeichnung: material.bezeichnung,
                            menge: weItem.menge,
                            neuerBestand: previousStock + weItem.menge
                        });
                    }
                }

                wareneingang.items.push(weItem);
            }

            // Summe ggf. berechnen
            if (!wareneingang.summe || wareneingang.summe === 0) {
                wareneingang.summe = wareneingang.items.reduce((s, i) => s + (i.gesamtpreis || 0), 0);
            }
            // Alias for UI module compatibility
            wareneingang.gesamtwert = wareneingang.summe;

            // Materialservice speichern
            if (window.materialService && stockUpdates.length > 0) {
                window.materialService.save();
            }

            // Bank-Transaktion als verarbeitet markieren
            if (data.transactionId && window.bankingService &&
                typeof window.bankingService.markAsWareneingangProcessed === 'function') {
                window.bankingService.markAsWareneingangProcessed(data.transactionId, wareneingang.id);
            }

            // Wareneingang speichern
            this.wareneingaenge.push(wareneingang);
            this._save();

            console.log(`Wareneingang ${wareneingang.id} erfasst: ${wareneingang.items.length} Positionen, ${stockUpdates.length} Bestände aktualisiert`);

            return {
                success: true,
                wareneingang: wareneingang,
                stockUpdates: stockUpdates
            };

        } catch (error) {
            console.error('Fehler beim Verarbeiten des Wareneingangs:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================
    // 5. Lieferanten-CSV/Excel importieren
    // ============================================

    /**
     * CSV-Daten von Lieferanten parsen
     * @param {string} csvText - CSV-Inhalt als Text
     * @param {string} supplierType - 'wuerth' | 'kloeckner' | 'generic'
     * @returns {Object} {supplier, items[], summe}
     */
    parseSupplierCSV(csvText, supplierType = 'generic') {
        if (!csvText || typeof csvText !== 'string') {
            return { supplier: supplierType, items: [], summe: 0 };
        }

        const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
            return { supplier: supplierType, items: [], summe: 0 };
        }

        // Header-Zeile parsen
        const delimiter = this._detectCSVDelimiter(lines[0]);
        const headers = this._parseCSVLine(lines[0], delimiter).map(h => h.trim().toLowerCase());

        const items = [];

        switch (supplierType.toLowerCase()) {
            case 'wuerth':
            case 'würth':
                return this._parseWuerthCSV(lines, headers, delimiter);
            case 'kloeckner':
            case 'klöckner':
                return this._parseKloecknerCSV(lines, headers, delimiter);
            default:
                return this._parseGenericCSV(lines, headers, delimiter);
        }
    }

    /**
     * Würth-CSV parsen
     * Typische Spalten: Artikelnummer, Bezeichnung, Menge, ME, Einzelpreis, Gesamtpreis
     */
    _parseWuerthCSV(lines, headers, delimiter) {
        const items = [];
        const colMap = this._mapCSVColumns(headers, {
            artikelnummer: ['artikelnummer', 'art.nr.', 'artnr', 'artikel', 'artikelnr', 'article'],
            bezeichnung: ['bezeichnung', 'beschreibung', 'artikelbezeichnung', 'name', 'text'],
            menge: ['menge', 'anzahl', 'qty', 'quantity', 'bestmenge'],
            einheit: ['einheit', 'me', 'mengeneinheit', 'unit', 'vpe'],
            einzelpreis: ['einzelpreis', 'preis', 'ek-preis', 'ekpreis', 'netto', 'ep', 'e-preis'],
            gesamtpreis: ['gesamtpreis', 'gesamt', 'gp', 'total', 'betrag', 'positionspreis']
        });

        for (let i = 1; i < lines.length; i++) {
            const cols = this._parseCSVLine(lines[i], delimiter);
            if (cols.length < 3) {continue;}

            const artikelnummer = this._getCSVValue(cols, colMap.artikelnummer);
            const bezeichnung = this._getCSVValue(cols, colMap.bezeichnung);
            const menge = this._parseGermanNumber(this._getCSVValue(cols, colMap.menge) || '1');
            const einheit = this._normalizeEinheit(this._getCSVValue(cols, colMap.einheit) || 'ST');
            const einzelpreis = this._parseGermanNumber(this._getCSVValue(cols, colMap.einzelpreis) || '0');
            let gesamtpreis = this._parseGermanNumber(this._getCSVValue(cols, colMap.gesamtpreis) || '0');

            if (!bezeichnung) {continue;}

            if (gesamtpreis === 0 && einzelpreis > 0 && menge > 0) {
                gesamtpreis = Math.round(einzelpreis * menge * 100) / 100;
            }

            items.push({
                artikelnummer: artikelnummer || undefined,
                beschreibung: bezeichnung,
                menge: menge,
                einheit: einheit,
                einzelpreis: einzelpreis,
                gesamtpreis: gesamtpreis
            });
        }

        const summe = items.reduce((s, i) => s + i.gesamtpreis, 0);
        return { supplier: 'Würth', items, summe };
    }

    /**
     * Klöckner-CSV parsen
     * Typische Spalten: Materialnr, Werkstoff, Abmessung, Menge, ME, Preis, Betrag
     */
    _parseKloecknerCSV(lines, headers, delimiter) {
        const items = [];
        const colMap = this._mapCSVColumns(headers, {
            artikelnummer: ['materialnr', 'materialnummer', 'artikelnummer', 'art.nr.', 'artnr', 'pos'],
            bezeichnung: ['bezeichnung', 'werkstoff', 'beschreibung', 'material', 'artikelbezeichnung', 'abmessung'],
            abmessung: ['abmessung', 'dimension', 'maße', 'profil'],
            menge: ['menge', 'gewicht', 'qty', 'anzahl', 'stk'],
            einheit: ['einheit', 'me', 'mengeneinheit', 'unit'],
            einzelpreis: ['einzelpreis', 'preis', 'kg-preis', 'ep', 'preis/einheit'],
            gesamtpreis: ['gesamtpreis', 'betrag', 'gesamt', 'total', 'nettobetrag']
        });

        for (let i = 1; i < lines.length; i++) {
            const cols = this._parseCSVLine(lines[i], delimiter);
            if (cols.length < 3) {continue;}

            const artikelnummer = this._getCSVValue(cols, colMap.artikelnummer);
            let bezeichnung = this._getCSVValue(cols, colMap.bezeichnung);
            const abmessung = this._getCSVValue(cols, colMap.abmessung);
            const menge = this._parseGermanNumber(this._getCSVValue(cols, colMap.menge) || '1');
            const einheit = this._normalizeEinheit(this._getCSVValue(cols, colMap.einheit) || 'KG');
            const einzelpreis = this._parseGermanNumber(this._getCSVValue(cols, colMap.einzelpreis) || '0');
            let gesamtpreis = this._parseGermanNumber(this._getCSVValue(cols, colMap.gesamtpreis) || '0');

            if (!bezeichnung) {continue;}

            // Abmessung an Bezeichnung anfügen
            if (abmessung && !bezeichnung.includes(abmessung)) {
                bezeichnung = `${bezeichnung} ${abmessung}`;
            }

            if (gesamtpreis === 0 && einzelpreis > 0 && menge > 0) {
                gesamtpreis = Math.round(einzelpreis * menge * 100) / 100;
            }

            items.push({
                artikelnummer: artikelnummer || undefined,
                beschreibung: bezeichnung.trim(),
                menge: menge,
                einheit: einheit,
                einzelpreis: einzelpreis,
                gesamtpreis: gesamtpreis
            });
        }

        const summe = items.reduce((s, i) => s + i.gesamtpreis, 0);
        return { supplier: 'Klöckner', items, summe };
    }

    /**
     * Generisches CSV parsen
     */
    _parseGenericCSV(lines, headers, delimiter) {
        const items = [];
        const colMap = this._mapCSVColumns(headers, {
            artikelnummer: ['artikelnummer', 'art.nr.', 'artnr', 'artikelnr', 'article', 'nr', 'nummer', 'pos'],
            bezeichnung: ['bezeichnung', 'beschreibung', 'name', 'text', 'artikel', 'material', 'artikelbezeichnung', 'position'],
            menge: ['menge', 'anzahl', 'qty', 'quantity', 'stk', 'stück'],
            einheit: ['einheit', 'me', 'mengeneinheit', 'unit', 'vpe'],
            einzelpreis: ['einzelpreis', 'preis', 'ek-preis', 'ekpreis', 'netto', 'ep', 'e-preis', 'stückpreis'],
            gesamtpreis: ['gesamtpreis', 'gesamt', 'gp', 'total', 'betrag', 'summe', 'positionspreis']
        });

        for (let i = 1; i < lines.length; i++) {
            const cols = this._parseCSVLine(lines[i], delimiter);
            if (cols.length < 2) {continue;}

            const artikelnummer = this._getCSVValue(cols, colMap.artikelnummer);
            const bezeichnung = this._getCSVValue(cols, colMap.bezeichnung);
            const menge = this._parseGermanNumber(this._getCSVValue(cols, colMap.menge) || '1');
            const einheit = this._normalizeEinheit(this._getCSVValue(cols, colMap.einheit) || 'Stk.');
            const einzelpreis = this._parseGermanNumber(this._getCSVValue(cols, colMap.einzelpreis) || '0');
            let gesamtpreis = this._parseGermanNumber(this._getCSVValue(cols, colMap.gesamtpreis) || '0');

            if (!bezeichnung) {continue;}

            if (gesamtpreis === 0 && einzelpreis > 0 && menge > 0) {
                gesamtpreis = Math.round(einzelpreis * menge * 100) / 100;
            }

            items.push({
                artikelnummer: artikelnummer || undefined,
                beschreibung: bezeichnung,
                menge: menge,
                einheit: einheit,
                einzelpreis: einzelpreis,
                gesamtpreis: gesamtpreis
            });
        }

        const summe = items.reduce((s, i) => s + i.gesamtpreis, 0);
        return { supplier: 'Unbekannt', items, summe };
    }

    // ============================================
    // 6. Banktransaktionen scannen
    // ============================================

    /**
     * Nicht zugeordnete Material-Abbuchungen aus Banktransaktionen erkennen
     * @returns {Array} Gruppiert nach Lieferant [{supplier, transactions, suggestedItems}]
     */
    detectBankPurchases() {
        if (!window.bankingService) {
            console.warn('BankingService nicht verfügbar');
            return [];
        }

        // Unzugeordnete Material-Abbuchungen holen
        const transactions = window.bankingService.getTransactions({
            type: 'debit',
            category: 'material',
            matched: false
        });

        if (transactions.length === 0) {
            return [];
        }

        // Nach Lieferant/Empfänger gruppieren
        const bySupplier = {};

        for (const tx of transactions) {
            // Lieferant aus Transaktion erkennen
            const supplierName = this._detectSupplierFromTransaction(tx);
            if (!bySupplier[supplierName]) {
                bySupplier[supplierName] = {
                    supplier: supplierName,
                    transactions: [],
                    totalAmount: 0,
                    suggestedItems: []
                };
            }

            bySupplier[supplierName].transactions.push({
                id: tx.id,
                date: tx.date,
                amount: Math.abs(tx.amount),
                purpose: tx.purpose,
                name: tx.name
            });
            bySupplier[supplierName].totalAmount += Math.abs(tx.amount);
        }

        // Materialvorschläge basierend auf Lieferant generieren
        const result = Object.values(bySupplier);

        if (window.materialService) {
            const allMaterials = window.materialService.getAllMaterials();
            for (const group of result) {
                // Materialien dieses Lieferanten finden
                const supplierMaterials = allMaterials.filter(m =>
                    m.lieferant && this._fuzzyMatch(m.lieferant, group.supplier) > 0.5
                );

                group.suggestedItems = supplierMaterials.map(m => ({
                    materialId: m.id,
                    bezeichnung: m.bezeichnung,
                    artikelnummer: m.artikelnummer,
                    einheit: m.einheit,
                    preis: m.preis
                }));
            }
        }

        return result;
    }

    /**
     * Lieferantenname aus Banktransaktion erkennen
     * @private
     */
    _detectSupplierFromTransaction(tx) {
        const name = (tx.name || '').toLowerCase();
        const purpose = (tx.purpose || '').toLowerCase();
        const combined = `${name} ${purpose}`;

        // Bekannte Lieferanten prüfen
        for (const [, config] of Object.entries(this.supplierPatterns)) {
            if (config.pattern.test(combined)) {
                return config.name;
            }
        }

        // Weitere Baumarkt-/Materialieferanten
        const knownSuppliers = [
            { pattern: /baywa/i, name: 'BayWa' },
            { pattern: /raab\s*karcher/i, name: 'Raab Karcher' },
            { pattern: /reyher/i, name: 'F. Reyher' },
            { pattern: /berner/i, name: 'Berner' },
            { pattern: /hilti/i, name: 'Hilti' },
            { pattern: /fischer/i, name: 'Fischer' },
            { pattern: /sfs/i, name: 'SFS' },
            { pattern: /stahl/i, name: 'Stahlhandel' },
        ];

        for (const s of knownSuppliers) {
            if (s.pattern.test(combined)) {
                return s.name;
            }
        }

        // Fallback: Empfängername verwenden
        return tx.name || 'Unbekannter Lieferant';
    }

    // ============================================
    // 7. Wareneingänge abfragen
    // ============================================

    /**
     * Gespeicherte Wareneingänge mit optionalen Filtern abrufen
     * @param {Object} filters - {dateFrom, dateTo, supplier, auftragId}
     * @returns {Array} Gefilterte Wareneingänge
     */
    getWareneingaenge(filters = {}) {
        let results = [...this.wareneingaenge];

        if (filters.dateFrom) {
            results = results.filter(we => we.datum >= filters.dateFrom);
        }
        if (filters.dateTo) {
            results = results.filter(we => we.datum <= filters.dateTo);
        }
        if (filters.supplier) {
            const q = filters.supplier.toLowerCase();
            results = results.filter(we => (we.supplier || '').toLowerCase().includes(q));
        }
        if (filters.auftragId) {
            results = results.filter(we => we.auftragId === filters.auftragId);
        }
        if (filters.source) {
            results = results.filter(we => we.source === filters.source);
        }

        // Neueste zuerst
        return results.sort((a, b) => new Date(b.erstelltAm) - new Date(a.erstelltAm));
    }

    /**
     * Einzelnen Wareneingang per ID abrufen
     * @param {string} id - Wareneingangs-ID
     * @returns {Object|null} Wareneingang oder null
     */
    getWareneingang(id) {
        return this.wareneingaenge.find(we => we.id === id) || null;
    }

    // ============================================
    // 8. Statistiken
    // ============================================

    /**
     * Statistiken über alle Wareneingänge
     * @returns {Object} {totalWareneingaenge, totalValue, bySupplier, byMonth, lastWareneingang}
     */
    getStatistics() {
        const stats = {
            totalWareneingaenge: this.wareneingaenge.length,
            totalValue: 0,
            bySupplier: {},
            byMonth: {},
            lastWareneingang: null
        };

        for (const we of this.wareneingaenge) {
            // Gesamtwert
            stats.totalValue += we.summe || 0;

            // Nach Lieferant
            const supplier = we.supplier || 'Unbekannt';
            if (!stats.bySupplier[supplier]) {
                stats.bySupplier[supplier] = { count: 0, value: 0 };
            }
            stats.bySupplier[supplier].count++;
            stats.bySupplier[supplier].value += we.summe || 0;

            // Nach Monat
            const monthKey = (we.datum || we.erstelltAm || '').substring(0, 7); // YYYY-MM
            if (monthKey) {
                if (!stats.byMonth[monthKey]) {
                    stats.byMonth[monthKey] = { count: 0, value: 0 };
                }
                stats.byMonth[monthKey].count++;
                stats.byMonth[monthKey].value += we.summe || 0;
            }
        }

        // Letzter Wareneingang
        if (this.wareneingaenge.length > 0) {
            const sorted = [...this.wareneingaenge].sort((a, b) =>
                new Date(b.erstelltAm) - new Date(a.erstelltAm)
            );
            stats.lastWareneingang = sorted[0];
        }

        // Werte runden
        stats.totalValue = Math.round(stats.totalValue * 100) / 100;
        for (const key of Object.keys(stats.bySupplier)) {
            stats.bySupplier[key].value = Math.round(stats.bySupplier[key].value * 100) / 100;
        }
        for (const key of Object.keys(stats.byMonth)) {
            stats.byMonth[key].value = Math.round(stats.byMonth[key].value * 100) / 100;
        }

        return stats;
    }

    // ============================================
    // Vollständiger Bon-Scan-Workflow
    // ============================================

    /**
     * Komplett-Workflow: Datei scannen, parsen, zuordnen
     * @param {File} file - Bilddatei des Bons
     * @returns {Object} {parsed, matchedItems, auftragSuggestions, ocrDocument}
     */
    async scanAndParseReceipt(file) {
        try {
            // 1. OCR durchführen
            if (!window.ocrScannerService) {
                return { success: false, error: 'OCR-Service nicht verfügbar' };
            }

            const ocrResult = await window.ocrScannerService.scanFromFile(file);
            if (!ocrResult.success) {
                return { success: false, error: 'OCR-Erkennung fehlgeschlagen' };
            }

            const ocrText = ocrResult.document.text;
            if (!ocrText || ocrText.includes('[OCR nicht verfügbar')) {
                return {
                    success: false,
                    error: 'Kein Text erkannt. Bitte manuell eingeben.',
                    ocrDocument: ocrResult.document
                };
            }

            // 2. Bon-Text parsen
            const parsed = this.parseReceiptText(ocrText);

            // 3. Materialien zuordnen
            const matchedItems = this.matchItemsToMaterials(parsed.items);

            // 4. Auftrag vorschlagen
            const auftragSuggestions = this.suggestAuftrag(matchedItems);

            return {
                success: true,
                parsed: parsed,
                matchedItems: matchedItems,
                auftragSuggestions: auftragSuggestions,
                ocrDocument: ocrResult.document
            };

        } catch (error) {
            console.error('Fehler beim Bon-Scan:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Komplett-Workflow: Kamera-Scan
     * @param {HTMLVideoElement} videoElement - Video-Element der Kamera
     * @returns {Object} Wie scanAndParseReceipt
     */
    async scanFromCamera(videoElement) {
        try {
            if (!window.ocrScannerService) {
                return { success: false, error: 'OCR-Service nicht verfügbar' };
            }

            const ocrResult = await window.ocrScannerService.scanFromCamera(videoElement);
            if (!ocrResult.success) {
                return { success: false, error: 'OCR-Erkennung fehlgeschlagen' };
            }

            const ocrText = ocrResult.document.text;
            if (!ocrText || ocrText.includes('[OCR nicht verfügbar')) {
                return {
                    success: false,
                    error: 'Kein Text erkannt. Bitte manuell eingeben.',
                    ocrDocument: ocrResult.document
                };
            }

            const parsed = this.parseReceiptText(ocrText);
            const matchedItems = this.matchItemsToMaterials(parsed.items);
            const auftragSuggestions = this.suggestAuftrag(matchedItems);

            return {
                success: true,
                parsed: parsed,
                matchedItems: matchedItems,
                auftragSuggestions: auftragSuggestions,
                ocrDocument: ocrResult.document
            };

        } catch (error) {
            console.error('Fehler beim Kamera-Scan:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // Hilfsfunktionen
    // ============================================

    /**
     * Token-basierter Ähnlichkeitsvergleich (0-1)
     * @param {string} str1 - Erster String
     * @param {string} str2 - Zweiter String
     * @returns {number} Ähnlichkeitswert 0.0 - 1.0
     */
    _fuzzyMatch(str1, str2) {
        if (!str1 || !str2) {return 0;}

        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();

        // Exakte Übereinstimmung
        if (s1 === s2) {return 1.0;}

        // Enthaltensein
        if (s1.includes(s2) || s2.includes(s1)) {
            const longer = Math.max(s1.length, s2.length);
            const shorter = Math.min(s1.length, s2.length);
            return 0.7 + (0.3 * shorter / longer);
        }

        // Token-basierter Vergleich
        const tokens1 = s1.split(/[\s\-_\/\.,:;]+/).filter(t => t.length > 1);
        const tokens2 = s2.split(/[\s\-_\/\.,:;]+/).filter(t => t.length > 1);

        if (tokens1.length === 0 || tokens2.length === 0) {return 0;}

        let matchCount = 0;
        const totalTokens = Math.max(tokens1.length, tokens2.length);

        for (const t1 of tokens1) {
            for (const t2 of tokens2) {
                // Exakter Token-Match
                if (t1 === t2) {
                    matchCount += 1;
                    break;
                }
                // Token enthält den anderen
                if (t1.length >= 3 && t2.length >= 3 && (t1.includes(t2) || t2.includes(t1))) {
                    matchCount += 0.7;
                    break;
                }
                // Levenshtein für kurze Tokens (OCR-Fehler kompensieren)
                if (t1.length >= 3 && t2.length >= 3) {
                    const dist = this._levenshteinDistance(t1, t2);
                    const maxLen = Math.max(t1.length, t2.length);
                    if (dist / maxLen <= 0.3) {
                        matchCount += 0.5;
                        break;
                    }
                }
            }
        }

        return Math.min(1.0, matchCount / totalTokens);
    }

    /**
     * Levenshtein-Distanz zwischen zwei Strings
     * @private
     */
    _levenshteinDistance(a, b) {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = a[j - 1] === b[i - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,       // Einfügen
                    matrix[i][j - 1] + 1,        // Löschen
                    matrix[i - 1][j - 1] + cost  // Ersetzen
                );
            }
        }

        return matrix[b.length][a.length];
    }

    /**
     * Deutsche Zahl parsen: "1.234,56" → 1234.56
     * @param {string} str - Deutsche Zahlenformatierung
     * @returns {number} JavaScript-Zahl
     */
    _parseGermanNumber(str) {
        if (!str || typeof str !== 'string') {return 0;}

        // Whitespace und Währungszeichen entfernen
        let cleaned = str.replace(/[€EUR\s]/gi, '').trim();

        if (!cleaned) {return 0;}

        // Negatives Vorzeichen behandeln
        const isNegative = cleaned.startsWith('-');
        if (isNegative) {cleaned = cleaned.substring(1);}

        // Deutsche Formatierung: Punkt als Tausendertrenner, Komma als Dezimaltrenner
        // Prüfen ob beides vorkommt
        const hasComma = cleaned.includes(',');
        const hasDot = cleaned.includes('.');

        if (hasComma && hasDot) {
            // "1.234,56" → "1234.56"
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else if (hasComma) {
            // "3,49" → "3.49"
            cleaned = cleaned.replace(',', '.');
        }
        // Nur Punkt: könnte Tausendertrenner oder Dezimaltrenner sein
        // "1.500" vs "3.49" - wir nehmen an es ist ein Dezimaltrenner wenn <3 Nachkommastellen
        // Das ist die sicherste Annahme für Bon-Beträge

        const result = parseFloat(cleaned);
        if (isNaN(result)) {return 0;}

        return isNegative ? -result : result;
    }

    /**
     * Deutsches Datum parsen: "17.02.2026" → "2026-02-17"
     * @param {string} str - Datum im Format DD.MM.YYYY oder DD.MM.YY
     * @returns {string|null} ISO-Datum (YYYY-MM-DD) oder null
     */
    _parseGermanDate(str) {
        if (!str) {return null;}

        const match = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
        if (!match) {return null;}

        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        let year = match[3];

        // Zweistelliges Jahr konvertieren
        if (year.length === 2) {
            year = (parseInt(year) > 50 ? '19' : '20') + year;
        }

        // Validierung
        const dateObj = new Date(`${year}-${month}-${day}`);
        if (isNaN(dateObj.getTime())) {return null;}

        return `${year}-${month}-${day}`;
    }

    /**
     * Lieferant aus Bon-Kopftext erkennen
     * @param {string} text - Vollständiger Bon-Text
     * @returns {string|null} Erkannter Lieferantenname oder null
     */
    _detectSupplier(text) {
        if (!text) {return null;}

        // Nur den Anfang des Bons prüfen (Kopfbereich)
        const header = text.substring(0, Math.min(text.length, 500));

        for (const [, config] of Object.entries(this.supplierPatterns)) {
            if (config.pattern.test(header)) {
                return config.name;
            }
        }

        // Weitere bekannte Lieferanten
        const additionalSuppliers = [
            { pattern: /globus\s*baumarkt/i, name: 'Globus Baumarkt' },
            { pattern: /hellweg/i, name: 'Hellweg' },
            { pattern: /baywa/i, name: 'BayWa' },
            { pattern: /raab\s*karcher/i, name: 'Raab Karcher' },
        ];

        for (const s of additionalSuppliers) {
            if (s.pattern.test(header)) {
                return s.name;
            }
        }

        return null;
    }

    /**
     * Einheit normalisieren
     * @private
     */
    _normalizeEinheit(einheit) {
        if (!einheit) {return 'Stk.';}

        const normalized = einheit.trim().toUpperCase();
        const mapping = {
            'ST': 'Stk.',
            'STK': 'Stk.',
            'STK.': 'Stk.',
            'STÜCK': 'Stk.',
            'STUECK': 'Stk.',
            'M': 'm',
            'LFM': 'm',
            'MTR': 'm',
            'METER': 'm',
            'KG': 'kg',
            'KILOGRAMM': 'kg',
            'L': 'l',
            'LTR': 'l',
            'LITER': 'l',
            'PAK': 'Pak.',
            'PCK': 'Pak.',
            'PACK': 'Pak.',
            'PACKUNG': 'Pak.',
            'SET': 'Set',
            'ROL': 'Rol.',
            'ROLLE': 'Rol.',
            'QM': 'qm',
            'M2': 'qm',
            'M²': 'qm',
            'T': 't',
            'TO': 't',
            'TONNE': 't',
            'DS': 'Ds.',
            'DOSE': 'Ds.'
        };

        return mapping[normalized] || einheit.trim();
    }

    /**
     * CSV-Trennzeichen erkennen
     * @private
     */
    _detectCSVDelimiter(headerLine) {
        const semicolonCount = (headerLine.match(/;/g) || []).length;
        const commaCount = (headerLine.match(/,/g) || []).length;
        const tabCount = (headerLine.match(/\t/g) || []).length;

        if (tabCount > 0 && tabCount >= semicolonCount && tabCount >= commaCount) {return '\t';}
        if (semicolonCount > commaCount) {return ';';}
        return ',';
    }

    /**
     * CSV-Zeile parsen (berücksichtigt Anführungszeichen)
     * @private
     */
    _parseCSVLine(line, delimiter) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    /**
     * CSV-Spaltennamen auf bekannte Bezeichnungen mappen
     * @private
     */
    _mapCSVColumns(headers, fieldMappings) {
        const colMap = {};

        for (const [field, aliases] of Object.entries(fieldMappings)) {
            colMap[field] = -1;
            for (let i = 0; i < headers.length; i++) {
                const header = headers[i].toLowerCase().replace(/[^a-zäöüß0-9\-\.\/]/g, '');
                for (const alias of aliases) {
                    if (header === alias || header.includes(alias)) {
                        colMap[field] = i;
                        break;
                    }
                }
                if (colMap[field] >= 0) {break;}
            }
        }

        return colMap;
    }

    /**
     * Wert aus CSV-Spalte holen
     * @private
     */
    _getCSVValue(cols, index) {
        if (index < 0 || index >= cols.length) {return '';}
        return (cols[index] || '').replace(/^["']|["']$/g, '').trim();
    }

    // ============================================
    // Persistenz
    // ============================================

    /**
     * Wareneingänge in localStorage speichern
     * @private
     */
    _save() {
        try {
            localStorage.setItem('freyai_wareneingaenge', JSON.stringify(this.wareneingaenge));
        } catch (error) {
            console.error('Fehler beim Speichern der Wareneingänge:', error);
        }
    }

    /**
     * Wareneingang löschen
     * @param {string} id - Wareneingangs-ID
     * @returns {boolean} Erfolg
     */
    deleteWareneingang(id) {
        const index = this.wareneingaenge.findIndex(we => we.id === id);
        if (index === -1) {return false;}

        this.wareneingaenge.splice(index, 1);
        this._save();
        return true;
    }

    /**
     * Alle Wareneingänge löschen
     */
    clear() {
        this.wareneingaenge = [];
        this._save();
    }
}

// Globale Instanz erstellen
window.bonScannerService = new BonScannerService();
