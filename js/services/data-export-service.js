/* ============================================
   Data Export/Import Service
   Full backup export and selective CSV/JSON import
   ============================================ */

class DataExportService {
    constructor() {
        this.exportVersion = '1.0';
        this.delimiter = ';'; // German Excel standard

        // CSV column headers in German for each data type
        this.csvHeaders = {
            kunden: ['Name', 'Email', 'Telefon', 'Adresse', 'PLZ', 'Stadt', 'Land'],
            rechnungen: ['Rechnungs-ID', 'Kunde', 'Datum', 'Netto', 'MwSt', 'Brutto', 'Status', 'Zahlungsfrist'],
            buchungen: ['Datum', 'Beschreibung', 'Kategorie', 'Betrag', 'Typ', 'Status'],
            materialien: ['Material-ID', 'Bezeichnung', 'Kategorie', 'Menge', 'Einheit', 'Preis', 'Lagerort']
        };
    }

    /**
     * Export all data as JSON backup
     * @returns {Object} Export data with metadata
     */
    exportAll() {
        const store = window.storeService?.state || {};

        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                version: this.exportVersion,
                exportType: 'full-backup',
                company: store.settings?.companyName || 'MHS',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            data: {
                anfragen: store.anfragen || [],
                angebote: store.angebote || [],
                auftraege: store.auftraege || [],
                rechnungen: store.rechnungen || [],
                activities: store.activities || [],
                settings: store.settings || {}
            }
        };

        return exportData;
    }

    /**
     * Trigger browser download of JSON backup
     */
    async downloadFullBackup() {
        try {
            const exportData = this.exportAll();
            const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;

            this.downloadJSON(exportData, filename);

            if (window.notificationService) {
                window.notificationService.notifySystem(`✅ Backup exportiert: ${filename}`);
            }
        } catch (error) {
            console.error('Failed to download backup:', error);
            this.showError('Fehler beim Exportieren des Backups');
        }
    }

    /**
     * Export specific data type as CSV
     * @param {string} dataType - Type of data to export (kunden, rechnungen, buchungen, materialien)
     * @param {Array} data - Data to export (optional, will be fetched from store if not provided)
     */
    async downloadCSV(dataType, data = null) {
        try {
            if (!data) {
                data = this.getDataByType(dataType);
            }

            if (!data || data.length === 0) {
                this.showError(`Keine ${dataType} zum Exportieren vorhanden`);
                return;
            }

            const csv = this.convertToCSV(dataType, data);
            const filename = `${dataType}_${new Date().toISOString().split('T')[0]}.csv`;

            this.downloadFile(csv, filename, 'text/csv;charset=utf-8-sig');

            if (window.notificationService) {
                window.notificationService.notifySystem(`✅ CSV exportiert: ${filename}`);
            }
        } catch (error) {
            console.error('Failed to download CSV:', error);
            this.showError(`Fehler beim Exportieren von ${dataType}`);
        }
    }

    /**
     * Import from JSON backup file
     * @param {File} file - The JSON backup file
     * @returns {Promise<Object>} Import summary
     */
    async importFromJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (event) => {
                try {
                    const importData = JSON.parse(event.target.result);

                    // Validate structure
                    if (!importData.metadata || !importData.data) {
                        throw new Error('Invalid backup format');
                    }

                    // Show confirmation dialog
                    const recordCount = this.countRecords(importData.data);
                    const confirmed = await this.showConfirmation(
                        `${recordCount} Datensätze werden importiert. Fortfahren?`,
                        'Daten importieren'
                    );

                    if (!confirmed) {
                        resolve({ cancelled: true });
                        return;
                    }

                    // Merge data (skip duplicates by ID)
                    const summary = await this.mergeImportData(importData.data);

                    // Save merged data
                    if (window.storeService) {
                        await window.storeService.save();
                    }

                    if (window.notificationService) {
                        window.notificationService.notifySystem(
                            `✅ ${summary.imported} Datensätze importiert`
                        );
                    }

                    resolve(summary);
                } catch (error) {
                    console.error('Import failed:', error);
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Import from CSV file
     * @param {File} file - The CSV file
     * @param {string} dataType - Type of data being imported
     * @returns {Promise<Object>} Import summary
     */
    async importFromCSV(file, dataType) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (event) => {
                try {
                    const csv = event.target.result;
                    const data = this.parseCSV(csv, dataType);

                    if (!data || data.length === 0) {
                        throw new Error('No valid data found in CSV');
                    }

                    // Show confirmation dialog
                    const confirmed = await this.showConfirmation(
                        `${data.length} Datensätze werden importiert. Fortfahren?`,
                        'CSV importieren'
                    );

                    if (!confirmed) {
                        resolve({ cancelled: true });
                        return;
                    }

                    // Import the data
                    const summary = await this.importDataType(dataType, data);

                    // Save to store
                    if (window.storeService) {
                        await window.storeService.save();
                    }

                    if (window.notificationService) {
                        window.notificationService.notifySystem(
                            `✅ ${summary.imported} ${dataType} importiert`
                        );
                    }

                    resolve(summary);
                } catch (error) {
                    console.error('CSV import failed:', error);
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    // ===== Private Methods =====

    /**
     * Convert data to CSV format with BOM for Excel
     * @private
     */
    convertToCSV(dataType, data) {
        const headers = this.csvHeaders[dataType] || [];
        const rows = [];

        // Add headers
        rows.push(headers.join(this.delimiter));

        // Add data rows
        data.forEach(item => {
            const row = this.mapDataToCSVRow(dataType, item);
            rows.push(row);
        });

        // Join with newlines and add UTF-8 BOM for Excel
        const csv = rows.join('\n');
        return '\uFEFF' + csv; // UTF-8 BOM
    }

    /**
     * Map a data object to CSV row
     * @private
     */
    mapDataToCSVRow(dataType, item) {
        const values = [];

        switch (dataType) {
            case 'kunden':
                values.push(
                    this.escapeCSV(item.name || ''),
                    this.escapeCSV(item.email || ''),
                    this.escapeCSV(item.telefon || ''),
                    this.escapeCSV(item.adresse || ''),
                    this.escapeCSV(item.plz || ''),
                    this.escapeCSV(item.stadt || ''),
                    this.escapeCSV(item.land || '')
                );
                break;

            case 'rechnungen':
                values.push(
                    this.escapeCSV(item.id || ''),
                    this.escapeCSV(item.kunde?.name || ''),
                    this.escapeCSV(item.erstelltAm || ''),
                    this.escapeCSV(item.netto || 0),
                    this.escapeCSV(item.mwst || 0),
                    this.escapeCSV(item.brutto || 0),
                    this.escapeCSV(item.status || ''),
                    this.escapeCSV(item.zahlungsfrist || '')
                );
                break;

            case 'buchungen':
                values.push(
                    this.escapeCSV(item.datum || ''),
                    this.escapeCSV(item.beschreibung || ''),
                    this.escapeCSV(item.kategorie || ''),
                    this.escapeCSV(item.betrag || 0),
                    this.escapeCSV(item.typ || ''),
                    this.escapeCSV(item.status || '')
                );
                break;

            case 'materialien':
                values.push(
                    this.escapeCSV(item.id || ''),
                    this.escapeCSV(item.name || ''),
                    this.escapeCSV(item.kategorie || ''),
                    this.escapeCSV(item.menge || 0),
                    this.escapeCSV(item.einheit || ''),
                    this.escapeCSV(item.preis || 0),
                    this.escapeCSV(item.lagerort || '')
                );
                break;

            default:
                return Object.values(item).map(v => this.escapeCSV(String(v))).join(this.delimiter);
        }

        return values.join(this.delimiter);
    }

    /**
     * Escape CSV values (handle quotes and semicolons)
     * @private
     */
    escapeCSV(value) {
        if (value === null || value === undefined) {return '';}

        value = String(value).trim();

        // If contains delimiter, quotes, or newlines, wrap in quotes and escape quotes
        if (value.includes(this.delimiter) || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }

        return value;
    }

    /**
     * Parse CSV file to data array
     * @private
     */
    parseCSV(csv, dataType) {
        // Remove BOM if present
        csv = csv.replace(/^\uFEFF/, '');

        // Detect delimiter (try semicolon first as German standard)
        let delimiter = this.delimiter;
        const lines = csv.split('\n');
        if (lines.length > 0) {
            // Count occurrences of both delimiters in first row
            const firstLine = lines[0];
            const semiCount = (firstLine.match(/;/g) || []).length;
            const commaCount = (firstLine.match(/,/g) || []).length;
            if (commaCount > semiCount) {
                delimiter = ',';
            }
        }

        // Parse CSV
        const rows = this.parseCSVLines(csv, delimiter);
        if (rows.length < 2) {return [];}

        // First row is header
        const headers = rows[0];
        const data = [];

        for (let i = 1; i < rows.length; i++) {
            const values = rows[i];
            if (values.length === 0 || values.every(v => !v)) {continue;} // Skip empty rows

            const obj = this.mapCSVRowToData(dataType, headers, values);
            if (obj) {
                data.push(obj);
            }
        }

        return data;
    }

    /**
     * Parse CSV lines handling quoted values
     * @private
     */
    parseCSVLines(csv, delimiter) {
        const lines = [];
        let currentLine = [];
        let currentValue = '';
        let insideQuotes = false;

        for (let i = 0; i < csv.length; i++) {
            const char = csv[i];
            const nextChar = csv[i + 1];

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    currentValue += '"';
                    i++; // Skip next quote
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === delimiter && !insideQuotes) {
                currentLine.push(currentValue.trim());
                currentValue = '';
            } else if ((char === '\n' || char === '\r') && !insideQuotes) {
                if (currentValue || currentLine.length > 0) {
                    currentLine.push(currentValue.trim());
                    if (currentLine.length > 0 && currentLine.some(v => v)) {
                        lines.push(currentLine);
                    }
                    currentLine = [];
                    currentValue = '';
                }
                if (char === '\r' && nextChar === '\n') {
                    i++; // Skip \n in \r\n
                }
            } else {
                currentValue += char;
            }
        }

        // Add last line
        if (currentValue || currentLine.length > 0) {
            currentLine.push(currentValue.trim());
            if (currentLine.some(v => v)) {
                lines.push(currentLine);
            }
        }

        return lines;
    }

    /**
     * Map CSV row to data object
     * @private
     */
    mapCSVRowToData(dataType, headers, values) {
        const obj = {};

        headers.forEach((header, index) => {
            const value = values[index] || '';

            switch (dataType) {
                case 'kunden':
                    const kundenMap = {
                        'Name': 'name',
                        'Email': 'email',
                        'Telefon': 'telefon',
                        'Adresse': 'adresse',
                        'PLZ': 'plz',
                        'Stadt': 'stadt',
                        'Land': 'land'
                    };
                    if (kundenMap[header]) {
                        obj[kundenMap[header]] = value;
                    }
                    break;

                case 'rechnungen':
                    const rechnungMap = {
                        'Rechnungs-ID': 'id',
                        'Kunde': 'kunde.name',
                        'Datum': 'erstelltAm',
                        'Netto': 'netto',
                        'MwSt': 'mwst',
                        'Brutto': 'brutto',
                        'Status': 'status',
                        'Zahlungsfrist': 'zahlungsfrist'
                    };
                    if (rechnungMap[header]) {
                        obj[rechnungMap[header]] = value;
                    }
                    break;

                case 'buchungen':
                    const buchungMap = {
                        'Datum': 'datum',
                        'Beschreibung': 'beschreibung',
                        'Kategorie': 'kategorie',
                        'Betrag': 'betrag',
                        'Typ': 'typ',
                        'Status': 'status'
                    };
                    if (buchungMap[header]) {
                        obj[buchungMap[header]] = value;
                    }
                    break;

                case 'materialien':
                    const materialMap = {
                        'Material-ID': 'id',
                        'Bezeichnung': 'name',
                        'Kategorie': 'kategorie',
                        'Menge': 'menge',
                        'Einheit': 'einheit',
                        'Preis': 'preis',
                        'Lagerort': 'lagerort'
                    };
                    if (materialMap[header]) {
                        obj[materialMap[header]] = value;
                    }
                    break;
            }
        });

        // Ensure required fields
        if (Object.keys(obj).length > 0) {
            if (!obj.id) {
                obj.id = this.generateId(dataType);
            }
            return obj;
        }

        return null;
    }

    /**
     * Get data by type from store
     * @private
     */
    getDataByType(dataType) {
        const store = window.storeService?.state || {};
        return store[dataType] || [];
    }

    /**
     * Merge imported data with existing data
     * @private
     */
    async mergeImportData(importedData) {
        const store = window.storeService?.state;
        if (!store) {
            throw new Error('Store service not available');
        }

        let imported = 0;
        let skipped = 0;

        // Merge each data type
        const dataTypes = Object.keys(importedData);
        for (const dataType of dataTypes) {
            if (!Array.isArray(store[dataType])) {
                store[dataType] = [];
            }

            const items = importedData[dataType];
            if (Array.isArray(items)) {
                items.forEach(item => {
                    // Check if item already exists (by ID)
                    const exists = store[dataType].some(existing => existing.id === item.id);
                    if (!exists && item.id) {
                        store[dataType].push(item);
                        imported++;
                    } else {
                        skipped++;
                    }
                });
            }
        }

        return { imported, skipped, total: imported + skipped };
    }

    /**
     * Import specific data type
     * @private
     */
    async importDataType(dataType, data) {
        const store = window.storeService?.state;
        if (!store) {
            throw new Error('Store service not available');
        }

        if (!Array.isArray(store[dataType])) {
            store[dataType] = [];
        }

        let imported = 0;
        let skipped = 0;

        data.forEach(item => {
            const exists = store[dataType].some(existing => existing.id === item.id);
            if (!exists && item.id) {
                store[dataType].push(item);
                imported++;
            } else {
                skipped++;
            }
        });

        return { imported, skipped, total: imported + skipped };
    }

    /**
     * Count records in imported data
     * @private
     */
    countRecords(data) {
        let count = 0;
        for (const key in data) {
            if (Array.isArray(data[key])) {
                count += data[key].length;
            }
        }
        return count;
    }

    /**
     * Generate unique ID
     * @private
     */
    generateId(dataType) {
        const prefix = {
            kunden: 'KD',
            rechnungen: 'RE',
            buchungen: 'BU',
            materialien: 'MAT'
        }[dataType] || 'ID';

        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Download file to user's computer
     * @private
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Download JSON file
     * @private
     */
    downloadJSON(data, filename) {
        const json = JSON.stringify(data, null, 2);
        this.downloadFile(json, filename, 'application/json');
    }

    /**
     * Show confirmation dialog
     * @private
     */
    async showConfirmation(message, title) {
        return new Promise((resolve) => {
            const confirmed = confirm(`${title}\n\n${message}`);
            resolve(confirmed);
        });
    }

    /**
     * Show error message
     * @private
     */
    showError(message) {
        if (window.errorHandler) {
            window.errorHandler.error(message);
        } else {
            alert(`Fehler: ${message}`);
        }
    }
}

// Initialize as global singleton
window.dataExportService = new DataExportService();
