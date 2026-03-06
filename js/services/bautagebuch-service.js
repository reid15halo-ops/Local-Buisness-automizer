/* ============================================
   Bautagebuch Service - Bau-Tagesbericht
   Gesetzlich vorgeschrieben nach VOB/B §4 Abs. 3
   Tägliche Dokumentation von Baustellenaktivitäten
   ============================================ */

class BautagebuchService {
    constructor() {
        this.STORAGE_KEY = 'freyai_bautagebuch';
        this.SETTINGS_KEY = 'freyai_bautagebuch_settings';

        // Einträge laden
        try {
            this.entries = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
        } catch {
            this.entries = [];
        }

        // Einstellungen laden (z.B. OpenWeatherMap API Key)
        try {
            this.settings = JSON.parse(localStorage.getItem(this.SETTINGS_KEY) || '{}');
        } catch {
            this.settings = {};
        }

        // Wetterbedingungen (deutsch)
        this.WEATHER_CONDITIONS = [
            'Sonnig', 'Bewölkt', 'Teilweise bewölkt', 'Bedeckt',
            'Leichter Regen', 'Regen', 'Starkregen', 'Gewitter',
            'Schnee', 'Schneeregen', 'Nebel', 'Frost', 'Hagel',
            'Wind', 'Sturm'
        ];

        // Windstärken
        this.WIND_LEVELS = [
            'Windstill', 'Leicht', 'Mäßig', 'Frisch', 'Stark', 'Sturm'
        ];

        // Niederschlag
        this.PRECIPITATION_TYPES = [
            'Kein', 'Leichter Regen', 'Regen', 'Starkregen',
            'Schnee', 'Schneeregen', 'Hagel', 'Nebel'
        ];
    }

    // ============================================
    // CRUD-Operationen
    // ============================================

    /**
     * Eintrag erstellen oder aktualisieren
     * @param {string} jobId - Auftrags-ID
     * @param {string} date - Datum im Format YYYY-MM-DD
     * @param {Object} data - Eintragsdaten
     * @returns {Object} Der erstellte/aktualisierte Eintrag
     */
    createEntry(jobId, date, data = {}) {
        if (!jobId || !date) {
            console.warn('[Bautagebuch] jobId und date sind erforderlich');
            return null;
        }

        // Prüfen ob bereits ein Eintrag für diesen Tag/Auftrag existiert
        const existing = this.entries.find(e => e.jobId === jobId && e.date === date);

        if (existing) {
            // Bestehenden Eintrag aktualisieren
            return this._updateExisting(existing.id, data);
        }

        const now = new Date().toISOString();
        const entry = {
            id: this._generateId('BTB'),
            jobId: jobId,
            date: date,
            weather: data.weather || { condition: '', temperature: null, wind: '', precipitation: '' },
            workersPresent: data.workersPresent || [],
            workDescription: data.workDescription || '',
            materialsUsed: data.materialsUsed || [],
            photos: data.photos || [],
            incidents: data.incidents || '',
            delays: data.delays || '',
            notes: data.notes || '',
            bauleiterSignature: data.bauleiterSignature || null,
            confirmedAt: data.confirmedAt || null,
            createdAt: now,
            updatedAt: now
        };

        this.entries.push(entry);
        this._save();
        return entry;
    }

    /**
     * Einzelnen Eintrag abrufen
     * @param {string} jobId - Auftrags-ID
     * @param {string} date - Datum YYYY-MM-DD
     * @returns {Object|null}
     */
    getEntry(jobId, date) {
        return this.entries.find(e => e.jobId === jobId && e.date === date) || null;
    }

    /**
     * Eintrag per ID abrufen
     * @param {string} entryId
     * @returns {Object|null}
     */
    getEntryById(entryId) {
        return this.entries.find(e => e.id === entryId) || null;
    }

    /**
     * Alle Einträge für einen Auftrag abrufen (chronologisch sortiert)
     * @param {string} jobId
     * @returns {Array}
     */
    getEntriesForJob(jobId) {
        return this.entries
            .filter(e => e.jobId === jobId)
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Eintrag aktualisieren
     * @param {string} entryId
     * @param {Object} updates
     * @returns {Object|null}
     */
    updateEntry(entryId, updates) {
        return this._updateExisting(entryId, updates);
    }

    /**
     * Eintrag löschen
     * @param {string} entryId
     * @returns {boolean}
     */
    deleteEntry(entryId) {
        const before = this.entries.length;
        this.entries = this.entries.filter(e => e.id !== entryId);
        if (this.entries.length < before) {
            this._save();
            return true;
        }
        return false;
    }

    /**
     * Eintrag als bestätigt markieren (Bauleiter-Unterschrift)
     * @param {string} entryId
     * @param {string} signatureDataUrl - Base64 Unterschrift
     * @returns {Object|null}
     */
    confirmEntry(entryId, signatureDataUrl) {
        return this._updateExisting(entryId, {
            bauleiterSignature: signatureDataUrl,
            confirmedAt: new Date().toISOString()
        });
    }

    // ============================================
    // Auto-Befüllung aus bestehenden Services
    // ============================================

    /**
     * Automatisch Daten aus anderen Services zusammentragen
     * @param {string} jobId - Auftrags-ID
     * @param {string} date - Datum YYYY-MM-DD
     * @returns {Object} Vorausgefüllter Eintrag
     */
    autoPopulateEntry(jobId, date) {
        const data = {
            weather: { condition: '', temperature: null, wind: '', precipitation: '' },
            workersPresent: [],
            workDescription: '',
            materialsUsed: [],
            photos: [],
            incidents: '',
            delays: '',
            notes: ''
        };

        // Zeiteinträge aus TimeTrackingService
        data.workersPresent = this._getWorkersFromTimeTracking(jobId, date);

        // Falls keine Zeiteinträge, aus FieldAppService versuchen
        if (data.workersPresent.length === 0) {
            data.workersPresent = this._getWorkersFromFieldApp(jobId, date);
        }

        // Fotos aus FieldAppService
        data.photos = this._getPhotosFromFieldApp(jobId, date);

        // Materialverbrauch aus FieldAppService
        data.materialsUsed = this._getMaterialsFromFieldApp(jobId, date);

        // Team-Mitglieder ergänzen (falls TeamManagementService verfügbar)
        data.workersPresent = this._enrichWithTeamData(data.workersPresent);

        // Bestehenden Eintrag erstellen oder aktualisieren
        return this.createEntry(jobId, date, data);
    }

    /**
     * Wetter von OpenWeatherMap abrufen (opt-in, kostenlose API)
     * @param {number} lat - Breitengrad
     * @param {number} lon - Längengrad
     * @returns {Promise<Object>} Wetterdaten
     */
    async fetchWeather(lat, lon) {
        const apiKey = this.settings.openWeatherMapApiKey;
        if (!apiKey) {
            console.info('[Bautagebuch] Kein OpenWeatherMap API-Key konfiguriert. Manuelle Eingabe erforderlich.');
            return null;
        }

        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=de&appid=${encodeURIComponent(apiKey)}`;
            const response = await fetch(url);
            if (!response.ok) {
                console.warn('[Bautagebuch] Wetter-API Fehler:', response.status);
                return null;
            }

            const result = await response.json();
            return {
                condition: result.weather?.[0]?.description || '',
                temperature: Math.round(result.main?.temp ?? 0),
                wind: this._mapWindSpeed(result.wind?.speed || 0),
                precipitation: result.rain ? 'Regen' : result.snow ? 'Schnee' : 'Kein'
            };
        } catch (err) {
            console.warn('[Bautagebuch] Wetter konnte nicht abgerufen werden:', err.message);
            return null;
        }
    }

    /**
     * Wetter für einen Eintrag automatisch setzen (mit Geolocation)
     * @param {string} entryId
     * @returns {Promise<Object|null>}
     */
    async autoFillWeather(entryId) {
        if (!this.settings.openWeatherMapApiKey) { return null; }
        if (!navigator.geolocation) { return null; }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const weather = await this.fetchWeather(pos.coords.latitude, pos.coords.longitude);
                    if (weather) {
                        const updated = this._updateExisting(entryId, { weather });
                        resolve(updated);
                    } else {
                        resolve(null);
                    }
                },
                () => {
                    console.warn('[Bautagebuch] Standort konnte nicht ermittelt werden');
                    resolve(null);
                },
                { timeout: 10000 }
            );
        });
    }

    // ============================================
    // PDF-Export (pdfmake)
    // ============================================

    /**
     * Bautagebuch als PDF generieren
     * @param {string} jobId - Auftrags-ID
     * @param {Object} options - Zusätzliche Optionen
     * @returns {Promise<void>}
     */
    async generatePDF(jobId, options = {}) {
        // pdfMake laden falls nötig
        await this._ensurePdfMake();

        const entries = this.getEntriesForJob(jobId);
        if (entries.length === 0) {
            console.warn('[Bautagebuch] Keine Einträge für Auftrag', jobId);
            return null;
        }

        // Auftragsinformationen ermitteln
        const jobInfo = this._getJobInfo(jobId);
        const companyInfo = this._getCompanyInfo();

        // PDF-Dokumentdefinition aufbauen
        const docDefinition = this._buildPdfDocument(entries, jobInfo, companyInfo, options);

        // PDF erstellen und herunterladen
        const filename = options.filename ||
            `Bautagebuch_${jobInfo.title || jobId}_${entries[0].date}_bis_${entries[entries.length - 1].date}.pdf`;

        const pdf = pdfMake.createPdf(docDefinition);

        if (options.returnBlob) {
            return new Promise((resolve) => {
                pdf.getBlob((blob) => resolve(blob));
            });
        }

        pdf.download(filename.replace(/[^a-zA-Z0-9äöüÄÖÜß_\-\.]/g, '_'));
    }

    /**
     * PDF-Dokumentdefinition erstellen
     */
    _buildPdfDocument(entries, jobInfo, companyInfo, options) {
        const content = [];

        // === Deckblatt / Kopfbereich ===
        content.push(this._buildPdfHeader(companyInfo, jobInfo, entries));

        // === Tageseinträge ===
        entries.forEach((entry, index) => {
            if (index > 0) {
                // Seitenumbruch vor jedem neuen Tag (außer nach dem Header)
                content.push({ text: '', pageBreak: 'before' });
            } else {
                content.push({ text: '', margin: [0, 10, 0, 0] });
            }

            content.push(this._buildPdfDayEntry(entry, index + 1, entries.length));
        });

        return {
            pageSize: 'A4',
            pageOrientation: 'portrait',
            pageMargins: [40, 40, 40, 60],
            defaultStyle: {
                font: 'Roboto',
                fontSize: 9,
                lineHeight: 1.3
            },
            styles: {
                header: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
                subheader: { fontSize: 12, bold: true, margin: [0, 10, 0, 5] },
                dayHeader: { fontSize: 13, bold: true, margin: [0, 0, 0, 8], color: '#1a5276' },
                sectionLabel: { fontSize: 9, bold: true, color: '#2c3e50', margin: [0, 6, 0, 2] },
                tableHeader: { fontSize: 8, bold: true, fillColor: '#2c3e50', color: '#ffffff' },
                small: { fontSize: 7, color: '#7f8c8d' },
                confirmed: { fontSize: 8, bold: true, color: '#27ae60' }
            },
            footer: (currentPage, pageCount) => ({
                columns: [
                    { text: `Bautagebuch — ${jobInfo.title || jobInfo.id}`, style: 'small', margin: [40, 0, 0, 0] },
                    { text: `Seite ${currentPage} von ${pageCount}`, style: 'small', alignment: 'right', margin: [0, 0, 40, 0] }
                ],
                margin: [0, 20, 0, 0]
            })
        };
    }

    /**
     * PDF-Kopfbereich mit Firmen- und Auftragsinformationen
     */
    _buildPdfHeader(companyInfo, jobInfo, entries) {
        const firstDate = entries[0]?.date || '';
        const lastDate = entries[entries.length - 1]?.date || '';

        return {
            stack: [
                // Firmenname
                { text: companyInfo.name || 'Unternehmen', style: 'header' },
                companyInfo.address ? { text: companyInfo.address, fontSize: 9, color: '#555' } : {},

                // Titel
                { text: 'BAUTAGEBUCH', fontSize: 20, bold: true, margin: [0, 15, 0, 5], color: '#1a5276' },
                { text: '(gemäß VOB/B §4 Abs. 3)', fontSize: 8, color: '#7f8c8d', margin: [0, 0, 0, 10] },

                // Auftragsinformationen
                {
                    table: {
                        widths: ['auto', '*', 'auto', '*'],
                        body: [
                            [
                                { text: 'Auftrag:', bold: true },
                                { text: jobInfo.title || jobInfo.id || '-' },
                                { text: 'Auftrags-Nr.:', bold: true },
                                { text: jobInfo.id || '-' }
                            ],
                            [
                                { text: 'Auftraggeber:', bold: true },
                                { text: jobInfo.customer || '-' },
                                { text: 'Baustelle:', bold: true },
                                { text: jobInfo.address || '-' }
                            ],
                            [
                                { text: 'Zeitraum:', bold: true },
                                { text: `${this._formatDate(firstDate)} – ${this._formatDate(lastDate)}` },
                                { text: 'Einträge:', bold: true },
                                { text: `${entries.length} Tage` }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0,
                        hLineColor: () => '#cccccc',
                        paddingTop: () => 4,
                        paddingBottom: () => 4
                    },
                    margin: [0, 0, 0, 5]
                }
            ]
        };
    }

    /**
     * Einen einzelnen Tageseintrag als PDF-Abschnitt formatieren
     */
    _buildPdfDayEntry(entry, dayNumber, totalDays) {
        const sections = [];

        // Tag-Überschrift
        sections.push({
            text: `Tag ${dayNumber}/${totalDays} — ${this._formatDate(entry.date)} (${this._getDayName(entry.date)})`,
            style: 'dayHeader'
        });

        // Wetter
        const w = entry.weather || {};
        if (w.condition || w.temperature != null || w.wind || w.precipitation) {
            sections.push({ text: 'Wetter', style: 'sectionLabel' });
            const weatherParts = [];
            if (w.condition) weatherParts.push(w.condition);
            if (w.temperature != null) weatherParts.push(`${w.temperature} °C`);
            if (w.wind) weatherParts.push(`Wind: ${w.wind}`);
            if (w.precipitation && w.precipitation !== 'Kein') weatherParts.push(`Niederschlag: ${w.precipitation}`);
            sections.push({ text: weatherParts.join(' | '), margin: [0, 0, 0, 4] });
        }

        // Anwesende Arbeitskräfte
        if (entry.workersPresent && entry.workersPresent.length > 0) {
            sections.push({ text: 'Anwesende Arbeitskräfte', style: 'sectionLabel' });
            const workerBody = [
                [
                    { text: 'Name', style: 'tableHeader' },
                    { text: 'Funktion', style: 'tableHeader' },
                    { text: 'Stunden', style: 'tableHeader', alignment: 'right' }
                ]
            ];
            let totalHours = 0;
            entry.workersPresent.forEach(w => {
                workerBody.push([
                    w.name || '-',
                    w.role || '-',
                    { text: w.hours != null ? w.hours.toFixed(1) : '-', alignment: 'right' }
                ]);
                totalHours += w.hours || 0;
            });
            workerBody.push([
                { text: 'Gesamt', bold: true, colSpan: 2 }, {},
                { text: totalHours.toFixed(1) + ' Std.', bold: true, alignment: 'right' }
            ]);
            sections.push({
                table: { headerRows: 1, widths: ['*', 'auto', 60], body: workerBody },
                layout: {
                    hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.8 : 0.3,
                    vLineWidth: () => 0,
                    hLineColor: (i) => i <= 1 ? '#2c3e50' : '#cccccc',
                    paddingTop: () => 3,
                    paddingBottom: () => 3
                },
                margin: [0, 0, 0, 4]
            });
        }

        // Ausgeführte Arbeiten
        if (entry.workDescription) {
            sections.push({ text: 'Ausgeführte Arbeiten', style: 'sectionLabel' });
            sections.push({ text: entry.workDescription, margin: [0, 0, 0, 4] });
        }

        // Materialverbrauch
        if (entry.materialsUsed && entry.materialsUsed.length > 0) {
            sections.push({ text: 'Verwendetes Material', style: 'sectionLabel' });
            const matBody = [
                [
                    { text: 'Material', style: 'tableHeader' },
                    { text: 'Menge', style: 'tableHeader', alignment: 'right' },
                    { text: 'Einheit', style: 'tableHeader' }
                ]
            ];
            entry.materialsUsed.forEach(m => {
                matBody.push([
                    m.name || '-',
                    { text: m.quantity != null ? String(m.quantity) : '-', alignment: 'right' },
                    m.unit || '-'
                ]);
            });
            sections.push({
                table: { headerRows: 1, widths: ['*', 60, 60], body: matBody },
                layout: {
                    hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.8 : 0.3,
                    vLineWidth: () => 0,
                    hLineColor: (i) => i <= 1 ? '#2c3e50' : '#cccccc',
                    paddingTop: () => 3,
                    paddingBottom: () => 3
                },
                margin: [0, 0, 0, 4]
            });
        }

        // Fotos (nur Referenzen/Notizen, keine Bilder im PDF)
        if (entry.photos && entry.photos.length > 0) {
            sections.push({ text: `Fotos (${entry.photos.length})`, style: 'sectionLabel' });
            entry.photos.forEach((photo, i) => {
                sections.push({
                    text: `  ${i + 1}. ${photo.note || 'Foto ' + (photo.id || '')}`,
                    fontSize: 8,
                    margin: [5, 0, 0, 1]
                });
            });
            sections.push({ text: '', margin: [0, 0, 0, 4] });
        }

        // Vorkommnisse / Störungen
        if (entry.incidents) {
            sections.push({ text: 'Besondere Vorkommnisse / Störungen', style: 'sectionLabel' });
            sections.push({ text: entry.incidents, color: '#c0392b', margin: [0, 0, 0, 4] });
        }

        // Verzögerungen
        if (entry.delays) {
            sections.push({ text: 'Verzögerungen / Behinderungen', style: 'sectionLabel' });
            sections.push({ text: entry.delays, color: '#e67e22', margin: [0, 0, 0, 4] });
        }

        // Bemerkungen
        if (entry.notes) {
            sections.push({ text: 'Bemerkungen', style: 'sectionLabel' });
            sections.push({ text: entry.notes, margin: [0, 0, 0, 4] });
        }

        // Bestätigung / Unterschrift
        if (entry.bauleiterSignature) {
            sections.push({ text: 'Bauleiter-Bestätigung', style: 'sectionLabel' });
            sections.push({
                image: entry.bauleiterSignature,
                width: 150,
                height: 50,
                margin: [0, 2, 0, 2]
            });
            if (entry.confirmedAt) {
                sections.push({
                    text: `Bestätigt am ${this._formatDateTime(entry.confirmedAt)}`,
                    style: 'confirmed'
                });
            }
        } else {
            // Leere Unterschriftszeile für Ausdruck
            sections.push({ text: '', margin: [0, 15, 0, 0] });
            sections.push({
                columns: [
                    {
                        stack: [
                            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 }] },
                            { text: 'Unterschrift Bauleiter', style: 'small', margin: [0, 3, 0, 0] }
                        ],
                        width: 'auto'
                    },
                    { text: '', width: '*' },
                    {
                        stack: [
                            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 120, y2: 0, lineWidth: 0.5 }] },
                            { text: 'Datum', style: 'small', margin: [0, 3, 0, 0] }
                        ],
                        width: 'auto'
                    }
                ]
            });
        }

        return { stack: sections };
    }

    // ============================================
    // Einstellungen
    // ============================================

    /**
     * OpenWeatherMap API-Key setzen (opt-in)
     * @param {string} apiKey
     */
    setWeatherApiKey(apiKey) {
        this.settings.openWeatherMapApiKey = apiKey || '';
        this._saveSettings();
    }

    /**
     * Einstellungen abrufen
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Einstellungen aktualisieren
     * @param {Object} updates
     */
    updateSettings(updates) {
        Object.assign(this.settings, updates);
        this._saveSettings();
    }

    // ============================================
    // Statistiken
    // ============================================

    /**
     * Zusammenfassung für einen Auftrag
     * @param {string} jobId
     * @returns {Object}
     */
    getJobSummary(jobId) {
        const entries = this.getEntriesForJob(jobId);
        if (entries.length === 0) return null;

        let totalWorkerHours = 0;
        let totalWorkerDays = 0;
        const allMaterials = {};
        let incidentCount = 0;
        let delayCount = 0;
        let confirmedCount = 0;

        entries.forEach(e => {
            // Arbeitsstunden summieren
            (e.workersPresent || []).forEach(w => {
                totalWorkerHours += w.hours || 0;
                totalWorkerDays++;
            });

            // Material zusammenführen
            (e.materialsUsed || []).forEach(m => {
                const key = `${m.name}_${m.unit}`;
                if (!allMaterials[key]) {
                    allMaterials[key] = { name: m.name, unit: m.unit, quantity: 0 };
                }
                allMaterials[key].quantity += m.quantity || 0;
            });

            if (e.incidents) incidentCount++;
            if (e.delays) delayCount++;
            if (e.confirmedAt) confirmedCount++;
        });

        return {
            totalDays: entries.length,
            dateRange: {
                from: entries[0].date,
                to: entries[entries.length - 1].date
            },
            totalWorkerHours: Math.round(totalWorkerHours * 100) / 100,
            totalWorkerDays,
            materials: Object.values(allMaterials),
            incidentCount,
            delayCount,
            confirmedCount,
            confirmationRate: entries.length > 0 ? Math.round(confirmedCount / entries.length * 100) : 0
        };
    }

    // ============================================
    // Hilfsfunktionen (private)
    // ============================================

    /**
     * Bestehenden Eintrag aktualisieren
     */
    _updateExisting(entryId, updates) {
        const index = this.entries.findIndex(e => e.id === entryId);
        if (index === -1) return null;

        // Tiefes Merge für verschachtelte Objekte (weather)
        if (updates.weather && this.entries[index].weather) {
            updates.weather = { ...this.entries[index].weather, ...updates.weather };
        }

        const origId = this.entries[index].id;
        const origCreatedAt = this.entries[index].createdAt;
        delete updates.id;
        delete updates.createdAt;

        this.entries[index] = {
            ...this.entries[index],
            ...updates,
            id: origId,
            createdAt: origCreatedAt,
            updatedAt: new Date().toISOString()
        };

        this._save();
        return this.entries[index];
    }

    /**
     * Zeiteinträge aus TimeTrackingService holen
     */
    _getWorkersFromTimeTracking(jobId, date) {
        const workers = [];
        const tts = window.timeTrackingService;
        if (!tts || !tts.entries) return workers;

        // Einträge für den Auftrag und das Datum filtern
        const dayEntries = tts.entries.filter(e =>
            (e.auftragId === jobId || e.projectId === jobId) && e.date === date
        );

        // Nach Mitarbeiter gruppieren
        const byEmployee = {};
        dayEntries.forEach(e => {
            const empId = e.employeeId || 'default';
            if (!byEmployee[empId]) {
                byEmployee[empId] = { name: empId, role: '', hours: 0 };
            }
            byEmployee[empId].hours += e.durationHours || 0;
        });

        return Object.values(byEmployee);
    }

    /**
     * Arbeitskräfte aus FieldAppService holen
     */
    _getWorkersFromFieldApp(jobId, date) {
        const workers = [];
        const fas = window.fieldAppService;
        if (!fas || !fas.timeEntries) return workers;

        const dayEntries = fas.timeEntries.filter(e =>
            e.jobId === jobId && e.date === date
        );

        dayEntries.forEach(e => {
            workers.push({
                name: e.employeeName || e.employeeId || 'Unbekannt',
                role: '',
                hours: e.durationHours || e.hours || 0
            });
        });

        return workers;
    }

    /**
     * Fotos aus FieldAppService holen
     */
    _getPhotosFromFieldApp(jobId, date) {
        const fas = window.fieldAppService;
        if (!fas || typeof fas.getPhotos !== 'function') return [];

        const allPhotos = fas.getPhotos(jobId);
        if (!allPhotos || allPhotos.length === 0) return [];

        // Nach Datum filtern (falls Datum vorhanden)
        return allPhotos
            .filter(p => {
                if (!date) return true;
                const photoDate = (p.timestamp || p.createdAt || '').substring(0, 10);
                return photoDate === date;
            })
            .map(p => ({
                id: p.id,
                note: p.note || p.description || ''
            }));
    }

    /**
     * Materialverbrauch aus FieldAppService holen
     */
    _getMaterialsFromFieldApp(jobId, date) {
        const fas = window.fieldAppService;
        if (!fas || typeof fas.getMaterialLog !== 'function') return [];

        const allMaterials = fas.getMaterialLog(jobId);
        if (!allMaterials || allMaterials.length === 0) return [];

        // Nach Datum filtern
        return allMaterials
            .filter(m => {
                if (!date) return true;
                const matDate = (m.timestamp || m.createdAt || m.date || '').substring(0, 10);
                return matDate === date;
            })
            .map(m => ({
                name: m.name || m.material || 'Unbekannt',
                quantity: m.quantity || m.amount || 0,
                unit: m.unit || 'Stk'
            }));
    }

    /**
     * Arbeitskräfte mit Team-Daten anreichern (Name, Rolle)
     */
    _enrichWithTeamData(workers) {
        const tms = window.teamManagementService;
        if (!tms || typeof tms.getTeamMembers !== 'function') return workers;

        const members = tms.getTeamMembers();
        if (!members || members.length === 0) return workers;

        return workers.map(w => {
            const member = members.find(m =>
                m.id === w.name || m.name === w.name || m.email === w.name
            );
            if (member) {
                return {
                    ...w,
                    name: member.name || w.name,
                    role: member.role || w.role || ''
                };
            }
            return w;
        });
    }

    /**
     * Auftragsinformationen ermitteln
     */
    _getJobInfo(jobId) {
        const store = window.storeService;
        if (!store || !store.store || !store.store.auftraege) {
            return { id: jobId, title: '', customer: '', address: '' };
        }

        const auftrag = store.store.auftraege.find(a => a.id === jobId);
        if (!auftrag) {
            return { id: jobId, title: '', customer: '', address: '' };
        }

        // Kundendaten holen falls vorhanden
        let customerName = auftrag.customerName || auftrag.customer || '';
        let address = auftrag.address || '';

        if (auftrag.customerId && store.store.customers) {
            const customer = store.store.customers.find(c => c.id === auftrag.customerId);
            if (customer) {
                customerName = customerName || customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
                address = address || customer.address || '';
            }
        }

        return {
            id: auftrag.id,
            title: auftrag.title || auftrag.name || '',
            customer: customerName,
            address: address
        };
    }

    /**
     * Firmeninformationen für PDF-Header
     */
    _getCompanyInfo() {
        const css = window.companySettingsService;
        if (!css) {
            return { name: localStorage.getItem('company_name') || '', address: '' };
        }

        const settings = typeof css.getAll === 'function' ? css.getAll() : (css._cache || {});
        return {
            name: settings.company_name || localStorage.getItem('company_name') || '',
            address: [settings.street, `${settings.zip || ''} ${settings.city || ''}`.trim()]
                .filter(Boolean)
                .join(', ')
        };
    }

    /**
     * pdfMake sicherstellen (lazy-load)
     */
    async _ensurePdfMake() {
        if (window.pdfMake) return;

        // Über den bestehenden PDFGenerationService laden
        const pgs = window.pdfGenerationService;
        if (pgs && typeof pgs.loadPdfMake === 'function') {
            await pgs.loadPdfMake();
            return;
        }

        // Fallback: Direkt laden
        await new Promise((resolve, reject) => {
            const script1 = document.createElement('script');
            script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js';
            script1.integrity = 'sha384-VFQrHzqBh5qiJIU0uGU5CIW3+OWpdGGJM9LBnGbuIH2mkICcFZ7lPd/AAtI7SNf7';
            script1.crossOrigin = 'anonymous';
            script1.async = true;
            script1.onload = () => {
                const script2 = document.createElement('script');
                script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.min.js';
                script2.integrity = 'sha384-dWs4+zGqy/KS6giKxiK+6iowhidQwjVFaiE1lMar36QwIulE44VyBSQp0brMCx4D';
                script2.crossOrigin = 'anonymous';
                script2.async = true;
                script2.onload = () => resolve();
                script2.onerror = () => reject(new Error('pdfmake Fonts konnten nicht geladen werden'));
                document.head.appendChild(script2);
            };
            script1.onerror = () => reject(new Error('pdfmake konnte nicht geladen werden'));
            document.head.appendChild(script1);
        });
    }

    /**
     * Windgeschwindigkeit in deutsche Beschreibung umwandeln
     */
    _mapWindSpeed(speedMs) {
        if (speedMs < 0.5) return 'Windstill';
        if (speedMs < 3.4) return 'Leicht';
        if (speedMs < 8.0) return 'Mäßig';
        if (speedMs < 13.9) return 'Frisch';
        if (speedMs < 20.8) return 'Stark';
        return 'Sturm';
    }

    /**
     * Datum formatieren (DD.MM.YYYY)
     */
    _formatDate(dateStr) {
        if (!dateStr) return '-';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    /**
     * Datum + Uhrzeit formatieren
     */
    _formatDateTime(isoStr) {
        if (!isoStr) return '-';
        try {
            const d = new Date(isoStr);
            return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        } catch {
            return isoStr;
        }
    }

    /**
     * Wochentag ermitteln
     */
    _getDayName(dateStr) {
        if (!dateStr) return '';
        const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        try {
            return days[new Date(dateStr + 'T00:00:00').getDay()];
        } catch {
            return '';
        }
    }

    /**
     * ID generieren (konsistent mit anderen Services)
     */
    _generateId(prefix) {
        if (window.storeService && window.storeService.generateId) {
            return window.storeService.generateId(prefix);
        }
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 7);
        return `${prefix}-${timestamp}-${random}`.toUpperCase();
    }

    /**
     * Daten in localStorage speichern
     */
    _save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.entries));
        } catch (err) {
            console.error('[Bautagebuch] Speicherfehler:', err.message);
        }
    }

    /**
     * Einstellungen speichern
     */
    _saveSettings() {
        try {
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
        } catch (err) {
            console.error('[Bautagebuch] Einstellungen konnten nicht gespeichert werden:', err.message);
        }
    }
}

// Global registrieren
window.bautagebuchService = new BautagebuchService();
