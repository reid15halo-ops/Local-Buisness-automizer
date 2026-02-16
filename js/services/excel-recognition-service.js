/* ============================================
   Excel Recognition Service
   Intelligentes Spalten-Mapping & Datenvalidierung
   ============================================ */

class ExcelRecognitionService {
    constructor() {
        // Pattern-Definitionen für Spaltenerkennung
        this.columnPatterns = {
            // Kunden
            name: ['name', 'kundenname', 'kunde', 'firma', 'company', 'firmenname', 'ansprechpartner', 'contact'],
            email: ['email', 'e-mail', 'mail', 'emailadresse', 'e-mailadresse'],
            telefon: ['telefon', 'tel', 'phone', 'fon', 'festnetz', 'telefonnummer', 'tel.', 'tel:'],
            mobil: ['mobil', 'handy', 'mobile', 'cell', 'cellular', 'mobiltelefon'],
            firma: ['firma', 'company', 'unternehmen', 'firmenname', 'betrieb'],
            strasse: ['straße', 'strasse', 'street', 'adresse', 'address', 'str.', 'str'],
            plz: ['plz', 'postleitzahl', 'zip', 'zipcode', 'postal'],
            ort: ['ort', 'city', 'stadt', 'place', 'location'],

            // Material
            artikelnummer: ['artikelnummer', 'art.nr.', 'art.nr', 'artikelnr', 'artikelnummer', 'art-nr', 'artnr', 'sku', 'item', 'itemno'],
            bezeichnung: ['bezeichnung', 'beschreibung', 'name', 'artikel', 'description', 'desc', 'product', 'produktname'],
            kategorie: ['kategorie', 'gruppe', 'category', 'group', 'warengruppe', 'typ', 'type'],
            einheit: ['einheit', 'me', 'mengeneinheit', 'unit', 'uom', 'maßeinheit'],
            preis: ['preis', 'ek-preis', 'ekpreis', 'einzelpreis', 'price', 'cost', 'ek', 'einkaufspreis'],
            vkPreis: ['vk-preis', 'vkpreis', 'verkaufspreis', 'vk', 'sellingprice', 'retail'],
            bestand: ['bestand', 'lagerbestand', 'menge', 'stock', 'quantity', 'qty', 'lager'],
            minBestand: ['mindestbestand', 'min', 'minbestand', 'reorder', 'minstock', 'min.bestand'],
            lieferant: ['lieferant', 'supplier', 'vendor', 'hersteller', 'manufacturer'],

            // Anfragen
            beschreibung: ['beschreibung', 'anfrage', 'description', 'request', 'projektbeschreibung', 'details'],
            budget: ['budget', 'kosten', 'betrag', 'amount', 'preis', 'price', 'summe'],
            termin: ['termin', 'datum', 'date', 'wunschtermin', 'deadline', 'fällig'],
            leistungsart: ['leistungsart', 'service', 'dienstleistung', 'typ', 'type', 'category'],
        };

        // Mapping-Templates für verschiedene Datentypen
        this.mappingTemplates = {
            kunden: {
                required: ['name'],
                optional: ['email', 'telefon', 'mobil', 'firma', 'strasse', 'plz', 'ort'],
                defaults: {
                    status: 'aktiv',
                    quelle: 'excel-import'
                }
            },
            material: {
                required: ['bezeichnung'],
                optional: ['artikelnummer', 'kategorie', 'einheit', 'preis', 'vkPreis', 'bestand', 'minBestand', 'lieferant'],
                defaults: {
                    einheit: 'Stk.',
                    bestand: 0,
                    minBestand: 0,
                    kategorie: 'Sonstiges'
                }
            },
            anfragen: {
                required: ['name', 'beschreibung'],
                optional: ['email', 'telefon', 'firma', 'budget', 'termin', 'leistungsart'],
                defaults: {
                    status: 'neu',
                    quelle: 'excel-import'
                }
            }
        };

        // Speichere Mappings für Wiederverwendung
        this.savedMappings = this.loadSavedMappings();
    }

    // ============================================
    // Spalten-Erkennung
    // ============================================

    /**
     * Analysiert Excel-Datei und schlägt Spalten-Mapping vor
     * @param {File} file - Excel/CSV Datei
     * @param {String} dataType - 'kunden', 'material', 'anfragen'
     * @returns {Promise<Object>} - { headers, preview, suggestedMapping, stats }
     */
    async analyzeFile(file, dataType) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const isCSV = file.name.toLowerCase().endsWith('.csv');

            reader.onload = async (e) => {
                try {
                    let jsonData;
                    let headers;

                    if (isCSV) {
                        // CSV-Parsing
                        const text = e.target.result;
                        const result = this.parseCSV(text);
                        jsonData = result.data;
                        headers = result.headers;
                    } else {
                        // Excel-Parsing
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const sheetName = workbook.SheetNames[0];
                        const sheet = workbook.Sheets[sheetName];
                        jsonData = XLSX.utils.sheet_to_json(sheet);
                        headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
                    }

                    if (jsonData.length === 0) {
                        throw new Error('Datei enthält keine Daten');
                    }

                    // Intelligentes Mapping vorschlagen
                    const suggestedMapping = this.suggestMapping(headers, dataType);

                    // Preview (erste 5 Zeilen)
                    const preview = jsonData.slice(0, 5);

                    // Statistiken
                    const stats = this.analyzeData(jsonData, suggestedMapping);

                    resolve({
                        headers,
                        preview,
                        suggestedMapping,
                        stats,
                        totalRows: jsonData.length,
                        rawData: jsonData
                    });

                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = reject;

            if (isCSV) {
                reader.readAsText(file);
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }

    /**
     * CSV-Parser mit Semikolon und Komma Support
     */
    parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {throw new Error('CSV enthält keine Daten');}

        // Erkenne Delimiter (Semikolon oder Komma)
        const delimiter = lines[0].includes(';') ? ';' : ',';

        const headers = lines[0].split(delimiter).map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(delimiter);
            if (values.length < 2) {continue;}

            const row = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx]?.trim() || '';
            });
            data.push(row);
        }

        return { headers, data };
    }

    /**
     * Schläge Spalten-Mapping vor basierend auf Header-Namen
     */
    suggestMapping(headers, dataType) {
        const mapping = {};
        const template = this.mappingTemplates[dataType];

        if (!template) {
            throw new Error(`Unbekannter Datentyp: ${dataType}`);
        }

        // Prüfe ob gespeichertes Mapping existiert
        const savedMapping = this.savedMappings[dataType];

        headers.forEach(header => {
            const normalized = header.toLowerCase().trim();

            // Erst in gespeicherten Mappings suchen
            if (savedMapping && savedMapping[header]) {
                mapping[header] = savedMapping[header];
                return;
            }

            // Dann Pattern-Matching
            for (const [field, patterns] of Object.entries(this.columnPatterns)) {
                if (patterns.some(pattern => normalized.includes(pattern))) {
                    mapping[header] = field;
                    return;
                }
            }

            // Keine Übereinstimmung gefunden
            mapping[header] = null;
        });

        return mapping;
    }

    // ============================================
    // Datenvalidierung
    // ============================================

    /**
     * Validiert Daten nach Mapping
     */
    validateData(rawData, mapping, dataType) {
        const results = {
            valid: [],
            invalid: [],
            warnings: [],
            errors: []
        };

        const template = this.mappingTemplates[dataType];

        rawData.forEach((row, index) => {
            const validationResult = this.validateRow(row, mapping, template, index);

            if (validationResult.isValid) {
                results.valid.push(validationResult.data);
            } else {
                results.invalid.push({
                    row: index + 2, // +2 weil Excel bei 1 startet und Header bei 1
                    data: row,
                    errors: validationResult.errors
                });
            }

            if (validationResult.warnings.length > 0) {
                results.warnings.push({
                    row: index + 2,
                    warnings: validationResult.warnings
                });
            }
        });

        return results;
    }

    /**
     * Validiert einzelne Zeile
     */
    validateRow(row, mapping, template, rowIndex) {
        const result = {
            isValid: true,
            data: { ...template.defaults },
            errors: [],
            warnings: []
        };

        // Mappe Spalten
        for (const [sourceCol, targetField] of Object.entries(mapping)) {
            if (!targetField) {continue;} // Spalte wird nicht gemappt

            const value = row[sourceCol];

            // Validiere basierend auf Feldtyp
            const validatedValue = this.validateField(targetField, value, result);

            if (validatedValue !== undefined) {
                result.data[targetField] = validatedValue;
            }
        }

        // Prüfe Pflichtfelder
        template.required.forEach(field => {
            if (!result.data[field] || result.data[field] === '') {
                result.errors.push(`Pflichtfeld "${field}" fehlt`);
                result.isValid = false;
            }
        });

        return result;
    }

    /**
     * Validiert einzelnes Feld basierend auf Typ
     */
    validateField(fieldName, value, result) {
        if (!value || value === '') {return undefined;}

        const strValue = String(value).trim();

        switch (fieldName) {
            case 'email':
                return this.validateEmail(strValue, result);

            case 'telefon':
            case 'mobil':
                return this.normalizeTelefon(strValue);

            case 'preis':
            case 'vkPreis':
            case 'budget':
                return this.parsePrice(strValue, result);

            case 'bestand':
            case 'minBestand':
                return this.parseInt(strValue, result);

            case 'termin':
                return this.parseDate(strValue, result);

            case 'plz':
                return this.validatePLZ(strValue, result);

            default:
                return strValue;
        }
    }

    // ============================================
    // Validierungs-Helfer
    // ============================================

    validateEmail(email, result) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(email)) {
            result.warnings.push(`Ungültige E-Mail: ${email}`);
            return email; // Trotzdem importieren, aber warnen
        }
        return email.toLowerCase();
    }

    normalizeTelefon(telefon) {
        // Entferne alle nicht-numerischen Zeichen außer +
        let normalized = telefon.replace(/[^\d+]/g, '');

        // Füge +49 hinzu wenn deutsche Nummer ohne Ländercode
        if (normalized.startsWith('0')) {
            normalized = '+49' + normalized.substring(1);
        }

        return normalized;
    }

    parsePrice(priceStr, result) {
        // Entferne Währungssymbole und Whitespace
        let cleaned = priceStr.replace(/[€$\s]/g, '');

        // Ersetze Komma durch Punkt
        cleaned = cleaned.replace(',', '.');

        const price = parseFloat(cleaned);

        if (isNaN(price)) {
            result.warnings.push(`Ungültiger Preis: ${priceStr}`);
            return 0;
        }

        return Math.round(price * 100) / 100; // 2 Dezimalstellen
    }

    parseInt(valueStr, result) {
        const num = parseInt(valueStr);
        if (isNaN(num)) {
            result.warnings.push(`Ungültige Zahl: ${valueStr}`);
            return 0;
        }
        return num;
    }

    parseDate(dateStr, result) {
        // Versuche verschiedene Formate
        const formats = [
            /(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
            /(\d{4})-(\d{2})-(\d{2})/,   // YYYY-MM-DD
            /(\d{2})\/(\d{2})\/(\d{4})/  // DD/MM/YYYY
        ];

        for (const format of formats) {
            const match = dateStr.match(format);
            if (match) {
                if (format === formats[0] || format === formats[2]) {
                    // DD.MM.YYYY or DD/MM/YYYY
                    return `${match[3]}-${match[2]}-${match[1]}`;
                } else {
                    // YYYY-MM-DD
                    return dateStr;
                }
            }
        }

        result.warnings.push(`Ungültiges Datum: ${dateStr}`);
        return null;
    }

    validatePLZ(plz, result) {
        const cleaned = plz.replace(/\D/g, '');
        if (cleaned.length !== 5) {
            result.warnings.push(`Ungültige PLZ: ${plz}`);
        }
        return cleaned;
    }

    // ============================================
    // Duplikat-Erkennung
    // ============================================

    /**
     * Findet Duplikate basierend auf Datentyp
     */
    findDuplicates(importData, existingData, dataType) {
        const duplicates = [];

        importData.forEach((item, index) => {
            const matches = this.findMatches(item, existingData, dataType);
            if (matches.length > 0) {
                duplicates.push({
                    index,
                    item,
                    matches
                });
            }
        });

        return duplicates;
    }

    findMatches(item, existingData, dataType) {
        return existingData.filter(existing => {
            switch (dataType) {
                case 'kunden':
                    return this.isCustomerDuplicate(item, existing);
                case 'material':
                    return this.isMaterialDuplicate(item, existing);
                case 'anfragen':
                    return this.isAnfrageDuplicate(item, existing);
                default:
                    return false;
            }
        });
    }

    isCustomerDuplicate(item, existing) {
        // Email-Match
        if (item.email && existing.email &&
            item.email.toLowerCase() === existing.email.toLowerCase()) {
            return true;
        }

        // Telefon-Match (normalisiert)
        if (item.telefon && existing.telefon &&
            item.telefon.replace(/\D/g, '') === existing.telefon.replace(/\D/g, '')) {
            return true;
        }

        // Name + Firma Match
        if (item.name && existing.name && item.firma && existing.firma &&
            item.name.toLowerCase() === existing.name.toLowerCase() &&
            item.firma.toLowerCase() === existing.firma.toLowerCase()) {
            return true;
        }

        return false;
    }

    isMaterialDuplicate(item, existing) {
        // Artikelnummer ist eindeutig
        if (item.artikelnummer && existing.artikelnummer &&
            item.artikelnummer.toLowerCase() === existing.artikelnummer.toLowerCase()) {
            return true;
        }

        return false;
    }

    isAnfrageDuplicate(item, existing) {
        // Email + ähnliche Beschreibung
        if (item.email && existing.kunde?.email &&
            item.email.toLowerCase() === existing.kunde.email.toLowerCase()) {

            const desc1 = item.beschreibung?.toLowerCase() || '';
            const desc2 = existing.beschreibung?.toLowerCase() || '';

            if (desc1 && desc2 && this.similarityScore(desc1, desc2) > 0.7) {
                return true;
            }
        }

        return false;
    }

    similarityScore(str1, str2) {
        const words1 = str1.split(/\s+/);
        const words2 = str2.split(/\s+/);
        const intersection = words1.filter(w => words2.includes(w));
        return intersection.length / Math.max(words1.length, words2.length);
    }

    // ============================================
    // Statistiken
    // ============================================

    analyzeData(data, mapping) {
        const stats = {
            totalRows: data.length,
            mappedColumns: Object.values(mapping).filter(v => v !== null).length,
            unmappedColumns: Object.values(mapping).filter(v => v === null).length,
            dataTypes: {}
        };

        // Analysiere Datentypen
        Object.entries(mapping).forEach(([source, target]) => {
            if (!target) {return;}

            const samples = data.slice(0, 10).map(row => row[source]);
            const nonEmpty = samples.filter(v => v && v !== '');

            stats.dataTypes[target] = {
                fillRate: (nonEmpty.length / Math.min(10, data.length) * 100).toFixed(0) + '%',
                samples: nonEmpty.slice(0, 3)
            };
        });

        return stats;
    }

    // ============================================
    // Import-Ausführung
    // ============================================

    /**
     * Führt Import durch mit Batch-Processing
     */
    async executeImport(validData, dataType, options = {}) {
        const {
            batchSize = 100,
            onProgress = () => {},
            skipDuplicates = true,
            updateExisting = false
        } = options;

        const results = {
            imported: 0,
            skipped: 0,
            updated: 0,
            errors: []
        };

        const batches = this.createBatches(validData, batchSize);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            await new Promise(resolve => setTimeout(resolve, 0)); // Nicht blockierend

            for (const item of batch) {
                try {
                    const imported = await this.importItem(item, dataType, skipDuplicates, updateExisting);
                    if (imported.action === 'imported') {results.imported++;}
                    else if (imported.action === 'skipped') {results.skipped++;}
                    else if (imported.action === 'updated') {results.updated++;}
                } catch (error) {
                    results.errors.push({
                        item,
                        error: error.message
                    });
                }
            }

            onProgress({
                current: (i + 1) * batchSize,
                total: validData.length,
                percent: Math.min(100, ((i + 1) / batches.length * 100))
            });
        }

        return results;
    }

    createBatches(array, size) {
        const batches = [];
        for (let i = 0; i < array.length; i += size) {
            batches.push(array.slice(i, i + size));
        }
        return batches;
    }

    async importItem(item, dataType, skipDuplicates, updateExisting) {
        switch (dataType) {
            case 'kunden':
                return this.importCustomer(item, skipDuplicates, updateExisting);
            case 'material':
                return this.importMaterial(item, skipDuplicates, updateExisting);
            case 'anfragen':
                return this.importAnfrage(item, skipDuplicates, updateExisting);
            default:
                throw new Error(`Unbekannter Datentyp: ${dataType}`);
        }
    }

    importCustomer(item, skipDuplicates, updateExisting) {
        const existing = window.customerService?.customers.find(c =>
            this.isCustomerDuplicate(item, c)
        );

        if (existing) {
            if (skipDuplicates) {
                return { action: 'skipped', id: existing.id };
            }
            if (updateExisting) {
                window.customerService?.updateCustomer(existing.id, item);
                return { action: 'updated', id: existing.id };
            }
        }

        const customer = window.customerService?.addCustomer(item);
        return { action: 'imported', id: customer?.id };
    }

    importMaterial(item, skipDuplicates, updateExisting) {
        const existing = window.materialService?.bestand.find(m =>
            this.isMaterialDuplicate(item, m)
        );

        if (existing) {
            if (skipDuplicates) {
                return { action: 'skipped', id: existing.id };
            }
            if (updateExisting) {
                window.materialService?.updateMaterial(existing.id, item);
                return { action: 'updated', id: existing.id };
            }
        }

        const material = window.materialService?.addMaterial(item);
        return { action: 'imported', id: material?.id };
    }

    importAnfrage(item, skipDuplicates, updateExisting) {
        // Anfragen werden immer neu erstellt, da keine direkten Duplikate
        // Aber Kunde wird aus customerService geholt/erstellt

        const anfrage = {
            id: 'anf-' + Date.now(),
            kunde: {
                name: item.name,
                firma: item.firma || '',
                email: item.email || '',
                telefon: item.telefon || ''
            },
            beschreibung: item.beschreibung,
            budget: item.budget || null,
            termin: item.termin || null,
            leistungsart: item.leistungsart || 'sonstiges',
            status: 'neu',
            erstelltAm: new Date().toISOString(),
            quelle: 'excel-import'
        };

        // Speichere in localStorage (wie in demo-data-service.js)
        const anfragen = JSON.parse(localStorage.getItem('anfragen') || '[]');
        anfragen.push(anfrage);
        localStorage.setItem('anfragen', JSON.stringify(anfragen));

        return { action: 'imported', id: anfrage.id };
    }

    // ============================================
    // Mapping-Speicherung
    // ============================================

    // ============================================
    // Template-System: Benannte Mappings speichern/laden
    // ============================================

    saveMapping(dataType, mapping, name = 'default') {
        if (!this.savedMappings[dataType]) {
            this.savedMappings[dataType] = {};
        }

        this.savedMappings[dataType][name] = {
            mapping: mapping,
            createdAt: new Date().toISOString(),
            dataType: dataType
        };

        localStorage.setItem(
            'excel_import_mappings',
            JSON.stringify(this.savedMappings)
        );

        console.log(`Mapping-Template "${name}" für ${dataType} gespeichert`);
    }

    loadSavedMappings() {
        const saved = localStorage.getItem('excel_import_mappings');
        return saved ? JSON.parse(saved) : {};
    }

    getSavedMapping(dataType, name = 'default') {
        if (!this.savedMappings[dataType] || !this.savedMappings[dataType][name]) {
            return null;
        }
        return this.savedMappings[dataType][name].mapping;
    }

    getAllTemplates(dataType) {
        if (!this.savedMappings[dataType]) {
            return [];
        }

        return Object.keys(this.savedMappings[dataType]).map(name => ({
            name: name,
            createdAt: this.savedMappings[dataType][name].createdAt,
            mapping: this.savedMappings[dataType][name].mapping
        }));
    }

    deleteTemplate(dataType, name) {
        if (this.savedMappings[dataType] && this.savedMappings[dataType][name]) {
            delete this.savedMappings[dataType][name];

            localStorage.setItem(
                'excel_import_mappings',
                JSON.stringify(this.savedMappings)
            );

            console.log(`Template "${name}" gelöscht`);
            return true;
        }
        return false;
    }

    // ============================================
    // Template-Download: Excel-Vorlage generieren
    // ============================================

    downloadTemplate(dataType) {
        if (!this.mappingTemplates[dataType]) {
            console.error(`Unbekannter Datentyp: ${dataType}`);
            return;
        }

        const template = this.mappingTemplates[dataType];
        const allFields = [...template.required, ...template.optional];

        // Header-Zeile mit Feldnamen
        const headers = allFields;

        // Beispiel-Zeile mit Beispieldaten
        const exampleData = {
            // Kunden
            'name': 'Max Mustermann',
            'firma': 'Musterfirma GmbH',
            'email': 'max@musterfirma.de',
            'telefon': '+49 123 456789',
            'mobil': '+49 171 1234567',
            'strasse': 'Musterstraße 123',
            'plz': '12345',
            'ort': 'Musterstadt',
            'notizen': 'Wichtiger Kunde',

            // Material
            'artikelnummer': 'ART-12345',
            'bezeichnung': 'Schrauben M8x40',
            'kategorie': 'Befestigungsmaterial',
            'einheit': 'Stk.',
            'preis': '1.50',
            'vkPreis': '2.50',
            'bestand': '500',
            'minBestand': '100',
            'lieferant': 'Schrauben-Express',

            // Anfragen
            'kunde.name': 'Max Mustermann',
            'kunde.email': 'max@musterfirma.de',
            'kunde.telefon': '+49 123 456789',
            'beschreibung': 'Reparatur der Hydraulikanlage',
            'budget': '5000',
            'termin': '2026-03-15',
            'leistungsart': 'Hydraulik'
        };

        const exampleRow = allFields.map(field => exampleData[field] || '');

        // Erstelle Worksheet-Daten
        const worksheetData = [
            headers,      // Zeile 1: Header
            exampleRow    // Zeile 2: Beispiel
        ];

        // Verwende SheetJS (XLSX) zum Erstellen der Datei
        if (!window.XLSX) {
            console.error('SheetJS (XLSX) Library nicht geladen!');
            alert('Excel-Export benötigt die XLSX-Library. Bitte Seite neu laden.');
            return;
        }

        // Erstelle Workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        // Spaltenbreiten anpassen
        worksheet['!cols'] = allFields.map(() => ({ wch: 20 }));

        // Füge Worksheet zum Workbook hinzu
        XLSX.utils.book_append_sheet(workbook, worksheet, dataType.charAt(0).toUpperCase() + dataType.slice(1));

        // Download
        const fileName = `${dataType}_import_vorlage.xlsx`;
        XLSX.writeFile(workbook, fileName);

        console.log(`Template "${fileName}" heruntergeladen`);
    }

    /**
     * Generiert CSV-Vorlage (Alternative zu Excel)
     */
    downloadTemplateCSV(dataType) {
        if (!this.mappingTemplates[dataType]) {
            console.error(`Unbekannter Datentyp: ${dataType}`);
            return;
        }

        const template = this.mappingTemplates[dataType];
        const allFields = [...template.required, ...template.optional];

        // Header-Zeile
        const csvHeader = allFields.join(';');

        // Beispiel-Zeile (leer für manuelle Eingabe)
        const csvExample = allFields.map(() => '').join(';');

        // CSV-Content
        const csvContent = `${csvHeader}\n${csvExample}`;

        // Download als Blob
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${dataType}_import_vorlage.csv`;
        link.click();
        URL.revokeObjectURL(url);

        console.log(`CSV-Template für ${dataType} heruntergeladen`);
    }
}

// Globale Instanz
window.excelRecognitionService = new ExcelRecognitionService();
