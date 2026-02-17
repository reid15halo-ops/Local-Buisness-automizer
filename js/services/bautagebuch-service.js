/* ============================================
   Bautagebuch Service (Construction Diary)
   Legally required documentation for VOB/B
   construction projects in Germany.

   Storage:
   - mhs_bautagebuch_projects  (projects list)
   - mhs_bautagebuch_entries   (diary entries)
   ============================================ */

class BautagebuchService {
    constructor() {
        this.projects = JSON.parse(localStorage.getItem('mhs_bautagebuch_projects') || '[]');
        this.entries = JSON.parse(localStorage.getItem('mhs_bautagebuch_entries') || '[]');
    }

    // ============================================
    // Persistence
    // ============================================

    _saveProjects() {
        localStorage.setItem('mhs_bautagebuch_projects', JSON.stringify(this.projects));
    }

    _saveEntries() {
        localStorage.setItem('mhs_bautagebuch_entries', JSON.stringify(this.entries));
    }

    _generateId(prefix) {
        const ts = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        return `${prefix}-${ts}-${rand}`;
    }

    // ============================================
    // Projects
    // ============================================

    /**
     * Create a new Bautagebuch project.
     * @param {object} data - { auftragId, name, address, client, startDate, endDate, contractType, status }
     * @returns {object} The created project
     */
    createProject(data) {
        const project = {
            id: this._generateId('BTP'),
            auftragId: data.auftragId || '',
            name: data.name || '',
            address: data.address || '',
            client: data.client || '',
            startDate: data.startDate || new Date().toISOString().split('T')[0],
            endDate: data.endDate || '',
            contractType: data.contractType || 'VOB',
            status: data.status || 'aktiv',
            entries: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.projects.push(project);
        this._saveProjects();
        return project;
    }

    /**
     * Get all projects.
     * @returns {Array} All projects sorted by creation date (newest first)
     */
    getProjects() {
        return [...this.projects].sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    /**
     * Get a single project by ID.
     * @param {string} id - Project ID
     * @returns {object|null}
     */
    getProject(id) {
        return this.projects.find(p => p.id === id) || null;
    }

    /**
     * Update a project.
     * @param {string} id - Project ID
     * @param {object} data - Fields to update
     * @returns {object|null} Updated project or null
     */
    updateProject(id, data) {
        const index = this.projects.findIndex(p => p.id === id);
        if (index === -1) { return null; }

        // Do not allow overwriting id, entries array, or createdAt
        const { id: _id, entries: _entries, createdAt: _createdAt, ...safeData } = data;

        this.projects[index] = {
            ...this.projects[index],
            ...safeData,
            updatedAt: new Date().toISOString()
        };

        this._saveProjects();
        return this.projects[index];
    }

    /**
     * Get only active projects.
     * @returns {Array}
     */
    getActiveProjects() {
        return this.getProjects().filter(p => p.status === 'aktiv');
    }

    // ============================================
    // Entries
    // ============================================

    /**
     * Create a new diary entry for a project.
     * @param {string} projectId
     * @param {object} data - Entry fields (see data model)
     * @returns {object} The created entry
     */
    createEntry(projectId, data) {
        const project = this.getProject(projectId);
        if (!project) {
            throw new Error(`Projekt ${projectId} nicht gefunden`);
        }

        const entry = {
            id: this._generateId('BTB'),
            projectId: projectId,
            projectName: project.name,
            date: data.date || new Date().toISOString().split('T')[0],

            // Weather (legally required)
            weather: {
                condition: data.weather?.condition || 'bewölkt',
                tempMorning: data.weather?.tempMorning ?? null,
                tempNoon: data.weather?.tempNoon ?? null,
                tempEvening: data.weather?.tempEvening ?? null,
                wind: data.weather?.wind || 'windstill',
                precipitation: data.weather?.precipitation || false
            },

            // Workers present (legally required)
            workers: Array.isArray(data.workers) ? data.workers.map(w => ({
                name: w.name || '',
                role: w.role || 'geselle',
                hours: parseFloat(w.hours) || 0,
                arrived: w.arrived || '',
                left: w.left || ''
            })) : [],

            // Work performed (legally required)
            workPerformed: data.workPerformed || '',

            // Materials used
            materials: Array.isArray(data.materials) ? data.materials.map(m => ({
                name: m.name || '',
                quantity: parseFloat(m.quantity) || 0,
                unit: m.unit || 'Stk'
            })) : [],

            // Special incidents (legally important)
            incidents: data.incidents || '',

            // Photos
            photos: Array.isArray(data.photos) ? data.photos.map(p => ({
                id: p.id || this._generateId('PH'),
                caption: p.caption || '',
                timestamp: p.timestamp || new Date().toISOString(),
                dataUrl: p.dataUrl || ''
            })) : [],

            // Visitor log
            visitors: Array.isArray(data.visitors) ? data.visitors.map(v => ({
                name: v.name || '',
                role: v.role || 'Sonstiger',
                time: v.time || '',
                notes: v.notes || ''
            })) : [],

            // Instructions received
            instructions: data.instructions || '',

            // Metadata
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: data.createdBy || '',
            signed: false,
            signedBy: '',
            signedAt: ''
        };

        this.entries.push(entry);
        this._saveEntries();

        // Register entry ID on the project
        if (!project.entries.includes(entry.id)) {
            project.entries.push(entry.id);
            project.updatedAt = new Date().toISOString();
            this._saveProjects();
        }

        return entry;
    }

    /**
     * Get all entries for a project, sorted by date descending.
     * @param {string} projectId
     * @returns {Array}
     */
    getEntries(projectId) {
        return this.entries
            .filter(e => e.projectId === projectId)
            .sort((a, b) => b.date.localeCompare(a.date));
    }

    /**
     * Get a single entry by ID.
     * @param {string} id
     * @returns {object|null}
     */
    getEntry(id) {
        return this.entries.find(e => e.id === id) || null;
    }

    /**
     * Update an existing entry.
     * @param {string} id - Entry ID
     * @param {object} data - Fields to update
     * @returns {object|null}
     */
    updateEntry(id, data) {
        const index = this.entries.findIndex(e => e.id === id);
        if (index === -1) { return null; }

        // Protect immutable fields
        const { id: _id, projectId: _pid, createdAt: _ca, ...safeData } = data;

        // Deep-merge weather if provided
        if (safeData.weather) {
            safeData.weather = {
                ...this.entries[index].weather,
                ...safeData.weather
            };
        }

        this.entries[index] = {
            ...this.entries[index],
            ...safeData,
            updatedAt: new Date().toISOString()
        };

        this._saveEntries();
        return this.entries[index];
    }

    /**
     * Delete an entry.
     * @param {string} id - Entry ID
     * @returns {boolean}
     */
    deleteEntry(id) {
        const entry = this.getEntry(id);
        if (!entry) { return false; }

        // Remove from entries array
        this.entries = this.entries.filter(e => e.id !== id);
        this._saveEntries();

        // Remove reference from project
        const project = this.getProject(entry.projectId);
        if (project) {
            project.entries = project.entries.filter(eid => eid !== id);
            project.updatedAt = new Date().toISOString();
            this._saveProjects();
        }

        return true;
    }

    /**
     * Get entry for a specific project on a specific date.
     * @param {string} projectId
     * @param {string} date - 'YYYY-MM-DD'
     * @returns {object|null}
     */
    getEntryByDate(projectId, date) {
        return this.entries.find(e => e.projectId === projectId && e.date === date) || null;
    }

    // ============================================
    // Sign off
    // ============================================

    /**
     * Digitally sign off a diary entry.
     * @param {string} entryId
     * @param {string} signerName
     * @returns {object|null}
     */
    signEntry(entryId, signerName) {
        const index = this.entries.findIndex(e => e.id === entryId);
        if (index === -1) { return null; }

        this.entries[index].signed = true;
        this.entries[index].signedBy = signerName || '';
        this.entries[index].signedAt = new Date().toISOString();
        this.entries[index].updatedAt = new Date().toISOString();

        this._saveEntries();
        return this.entries[index];
    }

    // ============================================
    // Export
    // ============================================

    /**
     * Export all entries for a project as a structured object
     * suitable for PDF generation.
     * @param {string} projectId
     * @returns {object}
     */
    exportProjectPDF(projectId) {
        const project = this.getProject(projectId);
        if (!project) { return null; }

        const entries = this.getEntries(projectId);
        const totalHours = this.getTotalWorkerHours(projectId);
        const materialSummary = this.getMaterialSummary(projectId);

        return {
            project: {
                name: project.name,
                address: project.address,
                client: project.client,
                contractType: project.contractType,
                startDate: project.startDate,
                endDate: project.endDate,
                status: project.status
            },
            entries: entries.map(e => ({
                date: e.date,
                weather: e.weather,
                workers: e.workers,
                workPerformed: e.workPerformed,
                materials: e.materials,
                incidents: e.incidents,
                visitors: e.visitors,
                instructions: e.instructions,
                signed: e.signed,
                signedBy: e.signedBy,
                signedAt: e.signedAt,
                photos: e.photos.map(p => ({
                    caption: p.caption,
                    timestamp: p.timestamp
                }))
            })),
            summary: {
                totalEntries: entries.length,
                totalWorkerHours: totalHours,
                signedEntries: entries.filter(e => e.signed).length,
                unsignedEntries: entries.filter(e => !e.signed).length,
                materialSummary: materialSummary
            },
            generatedAt: new Date().toISOString()
        };
    }

    // ============================================
    // Stats
    // ============================================

    /**
     * Total worker-hours logged across all entries for a project.
     * @param {string} projectId
     * @returns {number}
     */
    getTotalWorkerHours(projectId) {
        const entries = this.getEntries(projectId);
        let total = 0;
        for (const entry of entries) {
            if (Array.isArray(entry.workers)) {
                for (const w of entry.workers) {
                    total += parseFloat(w.hours) || 0;
                }
            }
        }
        return Math.round(total * 100) / 100;
    }

    /**
     * Aggregate materials used across all entries for a project.
     * Groups by material name and unit, summing quantities.
     * @param {string} projectId
     * @returns {Array} [ { name, unit, totalQuantity }, ... ]
     */
    getMaterialSummary(projectId) {
        const entries = this.getEntries(projectId);
        const map = {};

        for (const entry of entries) {
            if (!Array.isArray(entry.materials)) { continue; }
            for (const m of entry.materials) {
                const key = `${m.name}||${m.unit}`;
                if (!map[key]) {
                    map[key] = { name: m.name, unit: m.unit, totalQuantity: 0 };
                }
                map[key].totalQuantity += parseFloat(m.quantity) || 0;
            }
        }

        return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
    }
}

// Create global instance
window.bautagebuchService = new BautagebuchService();
