/* ============================================
   DATEV Export Service (Feature #13)
   Tax preparation and DATEV format export
   ============================================ */

class DatevExportService {
    constructor() {
        this.exports = JSON.parse(localStorage.getItem('mhs_datev_exports') || '[]');
        this.settings = JSON.parse(localStorage.getItem('mhs_datev_settings') || '{}');

        // Default DATEV settings
        if (!this.settings.beraterNummer) this.settings.beraterNummer = '12345';
        if (!this.settings.mandantenNummer) this.settings.mandantenNummer = '67890';
        if (!this.settings.wirtschaftsjahr) this.settings.wirtschaftsjahr = new Date().getFullYear();
        if (!this.settings.sachkontenlaenge) this.settings.sachkontenlaenge = 4;
    }

    // DATEV Buchungssatz format
    // Standard DATEV ASCII format for import

    // Generate DATEV export for a period
    generateExport(fromDate, toDate, options = {}) {
        const buchungen = this.getBuchungenForPeriod(fromDate, toDate);

        if (buchungen.length === 0) {
            return { success: false, error: 'Keine Buchungen im Zeitraum' };
        }

        const exportData = {
            id: 'datev-' + Date.now(),
            type: options.format || 'buchungen',
            fromDate,
            toDate,
            createdAt: new Date().toISOString(),
            recordCount: buchungen.length,
            header: this.generateHeader(fromDate, toDate),
            data: []
        };

        // Generate DATEV records
        buchungen.forEach((buchung, index) => {
            const record = this.convertToDatevRecord(buchung, index + 1);
            exportData.data.push(record);
        });

        // Generate CSV content
        exportData.csvContent = this.generateDatevCsv(exportData);

        this.exports.push(exportData);
        this.save();

        return { success: true, export: exportData };
    }

    // Get bookkeeping entries for period
    getBuchungenForPeriod(fromDate, toDate) {
        if (window.bookkeepingService) {
            return (window.bookkeepingService.buchungen || []).filter(b => {
                const datum = b.datum || b.createdAt?.split('T')[0];
                return datum >= fromDate && datum <= toDate;
            });
        }
        return [];
    }

    // Generate DATEV header line
    generateHeader(fromDate, toDate) {
        const now = new Date();
        return {
            formatVersion: '510', // DATEV Format 5.10
            exportTyp: 21, // Buchungsstapel
            formatName: 'Buchungsstapel',
            formatVersion2: 12,
            erzeugtAm: now.toISOString().slice(0, 10).replace(/-/g, ''),
            beraterNummer: this.settings.beraterNummer,
            mandantenNummer: this.settings.mandantenNummer,
            wirtschaftsjahrBeginn: `${this.settings.wirtschaftsjahr}0101`,
            sachkontenlaenge: this.settings.sachkontenlaenge,
            datumVon: fromDate.replace(/-/g, ''),
            datumBis: toDate.replace(/-/g, ''),
            bezeichnung: `Export ${fromDate} bis ${toDate}`,
            waehrung: 'EUR'
        };
    }

    // Convert booking to DATEV record format
    convertToDatevRecord(buchung, recordNumber) {
        const isEinnahme = buchung.typ === 'einnahme';
        const betrag = Math.round(buchung.betrag * 100); // Cents

        // Map category to DATEV Sachkonto (SKR03)
        const sachkonto = this.getSachkonto(buchung.kategorie, buchung.typ);
        const gegenkonto = isEinnahme ? '8400' : '1200'; // Erlöse 19% / Bank

        return {
            satzNr: recordNumber,
            umsatz: betrag,
            sollHaben: isEinnahme ? 'H' : 'S',
            waehrung: 'EUR',
            konto: sachkonto,
            gegenKonto: gegenkonto,
            buchungsSchluessel: isEinnahme ? '3' : '2', // 19% USt
            datum: this.formatDatevDate(buchung.datum),
            belegfeld1: buchung.belegNummer || '',
            belegfeld2: '',
            skonto: 0,
            buchungstext: (buchung.beschreibung || '').slice(0, 60),
            postensperre: 0,
            kost1: '',
            kost2: '',
            ustId: ''
        };
    }

    // Map category to DATEV SKR03 Sachkonto
    getSachkonto(kategorie, typ) {
        // SKR03 Kontenrahmen
        const konten = {
            // Einnahmen
            'einnahme': {
                'Dienstleistung': '8400',
                'Warenverkauf': '8400',
                'Provisionen': '8520',
                'Sonstige Erlöse': '8900',
                'default': '8400'
            },
            // Ausgaben
            'ausgabe': {
                'Wareneinkauf': '3400',
                'Material': '3400',
                'Bürobedarf': '4930',
                'Telefon': '4920',
                'Miete': '4210',
                'Versicherungen': '4360',
                'KFZ-Kosten': '4540',
                'Werbung': '4600',
                'Reisekosten': '4660',
                'Fortbildung': '4945',
                'Bewirtung': '4650',
                'Porto': '4910',
                'Reparaturen': '4805',
                'Zinsen': '2100',
                'Gebühren': '4970',
                'Sonstige Ausgaben': '4900',
                'default': '4900'
            }
        };

        const typKonten = konten[typ] || konten['ausgabe'];
        return typKonten[kategorie] || typKonten['default'];
    }

    // Format date for DATEV (DDMM)
    formatDatevDate(dateString) {
        if (!dateString) return '';
        const parts = dateString.split(/[-./]/);
        if (parts.length >= 2) {
            const day = parts[2] || parts[0];
            const month = parts[1];
            return day.padStart(2, '0') + month.padStart(2, '0');
        }
        return '';
    }

    // Generate DATEV CSV content
    generateDatevCsv(exportData) {
        const lines = [];
        const h = exportData.header;

        // Header row (EXTF format)
        lines.push([
            '"EXTF"', h.formatVersion, h.exportTyp, `"${h.formatName}"`,
            h.formatVersion2, h.erzeugtAm, '', '', '', '', h.beraterNummer,
            h.mandantenNummer, h.wirtschaftsjahrBeginn, h.sachkontenlaenge,
            h.datumVon, h.datumBis, `"${h.bezeichnung}"`, '', `"${h.waehrung}"`
        ].join(';'));

        // Column headers
        lines.push([
            'Umsatz', 'Soll/Haben', 'WKZ', 'Konto', 'Gegenkonto', 'BU-Schlüssel',
            'Datum', 'Belegfeld 1', 'Belegfeld 2', 'Skonto', 'Buchungstext',
            'Postensperre', 'Kost1', 'Kost2', 'USt-IdNr'
        ].join(';'));

        // Data rows
        exportData.data.forEach(record => {
            lines.push([
                record.umsatz,
                `"${record.sollHaben}"`,
                `"${record.waehrung}"`,
                record.konto,
                record.gegenKonto,
                record.buchungsSchluessel,
                record.datum,
                `"${record.belegfeld1}"`,
                `"${record.belegfeld2}"`,
                record.skonto,
                `"${record.buchungstext}"`,
                record.postensperre,
                `"${record.kost1}"`,
                `"${record.kost2}"`,
                `"${record.ustId}"`
            ].join(';'));
        });

        return lines.join('\r\n');
    }

    // Download DATEV export as CSV file
    downloadExport(exportId) {
        const exp = this.exports.find(e => e.id === exportId);
        if (!exp) return { success: false, error: 'Export nicht gefunden' };

        const blob = new Blob([exp.csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DATEV_${exp.fromDate}_${exp.toDate}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return { success: true };
    }

    // Generate EÜR (Einnahmen-Überschuss-Rechnung) report
    generateEuerReport(year) {
        const fromDate = `${year}-01-01`;
        const toDate = `${year}-12-31`;
        const buchungen = this.getBuchungenForPeriod(fromDate, toDate);

        const report = {
            year,
            generatedAt: new Date().toISOString(),
            einnahmen: { total: 0, byCategory: {} },
            ausgaben: { total: 0, byCategory: {} },
            gewinn: 0,
            details: []
        };

        buchungen.forEach(b => {
            const kategorie = b.kategorie || 'Sonstige';
            const betrag = b.betrag || 0;

            if (b.typ === 'einnahme') {
                report.einnahmen.total += betrag;
                report.einnahmen.byCategory[kategorie] = (report.einnahmen.byCategory[kategorie] || 0) + betrag;
            } else {
                report.ausgaben.total += betrag;
                report.ausgaben.byCategory[kategorie] = (report.ausgaben.byCategory[kategorie] || 0) + betrag;
            }

            report.details.push({
                datum: b.datum,
                typ: b.typ,
                kategorie,
                betrag,
                beschreibung: b.beschreibung
            });
        });

        report.gewinn = report.einnahmen.total - report.ausgaben.total;

        return report;
    }

    // Generate EÜR as formatted text
    generateEuerText(year) {
        const report = this.generateEuerReport(year);
        const lines = [];

        lines.push(`EINNAHMEN-ÜBERSCHUSS-RECHNUNG ${year}`);
        lines.push('='.repeat(50));
        lines.push('');

        lines.push('BETRIEBSEINNAHMEN');
        lines.push('-'.repeat(30));
        Object.entries(report.einnahmen.byCategory).forEach(([kat, betrag]) => {
            lines.push(`  ${kat.padEnd(25)} ${this.formatCurrency(betrag).padStart(12)}`);
        });
        lines.push('-'.repeat(30));
        lines.push(`  SUMME EINNAHMEN${' '.repeat(8)} ${this.formatCurrency(report.einnahmen.total).padStart(12)}`);
        lines.push('');

        lines.push('BETRIEBSAUSGABEN');
        lines.push('-'.repeat(30));
        Object.entries(report.ausgaben.byCategory).forEach(([kat, betrag]) => {
            lines.push(`  ${kat.padEnd(25)} ${this.formatCurrency(betrag).padStart(12)}`);
        });
        lines.push('-'.repeat(30));
        lines.push(`  SUMME AUSGABEN${' '.repeat(9)} ${this.formatCurrency(report.ausgaben.total).padStart(12)}`);
        lines.push('');

        lines.push('='.repeat(50));
        lines.push(`  GEWINN/VERLUST${' '.repeat(9)} ${this.formatCurrency(report.gewinn).padStart(12)}`);
        lines.push('');

        lines.push(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`);

        return lines.join('\n');
    }

    // Tax category mapping for deductible expenses
    getTaxCategories() {
        return {
            'vollAbzugsfaehig': ['Wareneinkauf', 'Material', 'Bürobedarf', 'Miete', 'Telefon'],
            'beschraenktAbzugsfaehig': ['Bewirtung', 'Geschenke', 'Reisekosten'],
            'nichtAbzugsfaehig': ['Private Ausgaben', 'Bußgelder'],
            'abschreibung': ['Anlagevermögen', 'GWG']
        };
    }

    // Format currency for display
    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    // Get previous exports
    getExports() {
        return this.exports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('mhs_datev_settings', JSON.stringify(this.settings));
    }

    // Persistence
    save() {
        localStorage.setItem('mhs_datev_exports', JSON.stringify(this.exports));
    }
}

window.datevExportService = new DatevExportService();
