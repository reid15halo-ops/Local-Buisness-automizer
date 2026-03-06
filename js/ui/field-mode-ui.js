/* ============================================
   Field Mode UI - In-Page Baustellen-Ansicht
   Big-button mobile-first craftsman view
   Renders inside #view-field-mode
   ============================================ */

class FieldModeUI {
    constructor() {
        this.container = null;
        this.currentJobId = null;
        this.timerInterval = null;
        this.signaturePad = null;
        this.isPaused = false;
        this.pauseStart = null;
        this.totalPauseMs = 0;
        this.activeTab = 'timer'; // timer | material | fotos | notizen | status
        this._eventsAbort = null;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._init());
        } else {
            this._init();
        }
    }

    _safeDataUrl(url) {
        if (typeof url === 'string' && /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/.test(url)) return url;
        return '';
    }

    _init() {
        this.container = document.getElementById('field-mode-container');

        // Listen for view changes
        document.addEventListener('viewchange', (e) => {
            if (e.detail?.view === 'field-mode') {
                this.render();
            } else {
                this._stopTimerTick();
            }
        });

        // Listen for field service events to re-render
        window.addEventListener('fieldApp:clockIn', () => this._refreshTimer());
        window.addEventListener('fieldApp:clockOut', () => this.render());
        window.addEventListener('fieldApp:materialLogged', () => this._refreshMaterials());
        window.addEventListener('fieldApp:photoCaptured', () => this._refreshPhotos());
        window.addEventListener('fieldApp:voiceNoteSaved', () => this._refreshNotes());
        window.addEventListener('fieldApp:signatureCaptured', () => this._refreshSignatures());
        window.addEventListener('fieldApp:gpsCheckin', () => this._refreshStatus());
        window.addEventListener('fieldApp:jobStatusUpdated', () => this._refreshStatus());
        window.addEventListener('fieldApp:queueSynced', () => this._refreshStatus());
    }

    // ============================================
    // Main Render
    // ============================================

    render() {
        if (!this.container) {
            this.container = document.getElementById('field-mode-container');
        }
        if (!this.container) { return; }

        const service = window.fieldAppService;
        if (!service) {
            this.container.innerHTML = '<p class="empty-state">Feld-Service nicht verfuegbar.</p>';
            return;
        }

        const jobs = service.getTodaysJobs();
        const activeTimer = service.getCurrentTimer();
        const currentJob = this.currentJobId ? service.getJobById(this.currentJobId) : null;

        // If a job is selected, show tabbed job detail view
        if (this.currentJobId && currentJob) {
            this._renderJobDetail(currentJob, activeTimer);
        } else {
            this._renderJobSelection(jobs, activeTimer);
        }

        this._bindEvents();

        // Attach voice mic to note inputs
        if (window.voiceInputService?.isSupported) {
            setTimeout(() => {
                window.voiceInputService.attachAll(this.container);
            }, 50);
        }
    }

    // ============================================
    // Screen: Job Selection
    // ============================================

    _renderJobSelection(jobs, activeTimer) {
        const esc = window.esc || ((s) => { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; });
        const stats = window.fieldAppService?.getTodaysStats() || {};
        const offlineCount = window.fieldAppService?.getOfflineQueueCount() || 0;

        this.container.innerHTML = `
            <div class="fm-header">
                <div class="fm-header-top">
                    <h1 class="fm-title">Feld-Modus</h1>
                    ${offlineCount > 0 ? `
                        <button class="fm-offline-badge" data-action="fm-sync-queue" title="Offline-Warteschlange synchronisieren">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/></svg>
                            <span>${offlineCount}</span>
                        </button>
                    ` : ''}
                </div>
                <p class="fm-subtitle">Heutige Auftraege (${jobs.length})</p>
                ${activeTimer ? `
                    <div class="fm-active-timer-banner" data-action="fm-goto-active">
                        <span class="fm-pulse"></span>
                        <span>Timer laeuft: <strong id="fm-banner-timer">${activeTimer.elapsedFormatted}</strong></span>
                        <span> - ${esc(activeTimer.jobTitle)}</span>
                    </div>
                ` : ''}
            </div>

            <div class="fm-stats-row">
                <div class="fm-stat"><span class="fm-stat-val">${stats.totalHours || '0.00'}</span><span class="fm-stat-label">Stunden</span></div>
                <div class="fm-stat"><span class="fm-stat-val">${stats.photos || 0}</span><span class="fm-stat-label">Fotos</span></div>
                <div class="fm-stat"><span class="fm-stat-val">${stats.materials || 0}</span><span class="fm-stat-label">Material</span></div>
                <div class="fm-stat"><span class="fm-stat-val">${stats.voiceNotes || 0}</span><span class="fm-stat-label">Notizen</span></div>
            </div>

            <div class="fm-jobs-list">
                ${jobs.length === 0 ? `
                    <div class="fm-empty">
                        <p>Keine Auftraege fuer heute</p>
                        <p class="fm-empty-sub">Auftraege in der Hauptansicht anlegen</p>
                    </div>
                ` : jobs.map(job => {
                    const isActive = activeTimer?.jobId === job.id;
                    return `
                        <button class="fm-job-card ${isActive ? 'fm-job-card--active' : ''}"
                                data-action="fm-select-job" data-job-id="${job.id}">
                            <div class="fm-job-card-top">
                                <span class="fm-job-time">${esc(job.time) || '--:--'}</span>
                                <span class="fm-job-status fm-job-status--${(job.status || 'offen').replace(/\s+/g, '_')}">${esc(job.status || 'offen')}</span>
                            </div>
                            <div class="fm-job-title">${esc(job.title)}</div>
                            <div class="fm-job-customer">${esc(job.customer)}</div>
                            ${job.address ? `<div class="fm-job-address">${esc(job.address)}</div>` : ''}
                            ${isActive ? '<div class="fm-job-active-badge">Timer laeuft</div>' : ''}
                        </button>
                    `;
                }).join('')}
            </div>

            <button class="fm-btn fm-btn-secondary fm-btn-fullwidth" data-action="fm-open-overlay">
                Vollbild-Modus oeffnen
            </button>
        `;

        if (activeTimer) { this._startTimerTick(); }
    }

    // ============================================
    // Screen: Job Detail with Tab Navigation
    // ============================================

    _renderJobDetail(job, activeTimer) {
        const esc = window.esc || ((s) => { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; });
        const service = window.fieldAppService;
        const isTimerForThisJob = activeTimer?.jobId === job.id;
        const offlineCount = service?.getOfflineQueueCount() || 0;

        this.container.innerHTML = `
            <!-- Job Header -->
            <div class="fm-job-header">
                <button class="fm-back-btn" data-action="fm-back">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                    Zurueck
                </button>
                <div class="fm-job-info">
                    <h2 class="fm-job-detail-title">${esc(job.title)}</h2>
                    <div class="fm-job-detail-meta">
                        ${job.customer ? `<span>Kunde: <strong>${esc(job.customer)}</strong></span>` : ''}
                        ${job.address ? `<span>${esc(job.address)}</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- Tab Content -->
            <div class="fm-tab-content" id="fm-tab-content" role="tabpanel" aria-labelledby="fm-tab-${this.activeTab}">
                ${this._renderActiveTab(job, activeTimer)}
            </div>

            <!-- Bottom Tab Navigation -->
            <nav class="fm-bottom-nav" aria-label="Feld-Modus Tabs" role="tablist">
                <button class="fm-bottom-nav-item ${this.activeTab === 'timer' ? 'fm-bottom-nav-item--active' : ''}" data-action="fm-switch-tab" data-tab="timer" role="tab" id="fm-tab-timer" aria-selected="${this.activeTab === 'timer'}" aria-controls="fm-tab-content">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>Timer</span>
                    ${isTimerForThisJob ? '<span class="fm-nav-pulse"></span>' : ''}
                </button>
                <button class="fm-bottom-nav-item ${this.activeTab === 'material' ? 'fm-bottom-nav-item--active' : ''}" data-action="fm-switch-tab" data-tab="material" role="tab" id="fm-tab-material" aria-selected="${this.activeTab === 'material'}" aria-controls="fm-tab-content">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/></svg>
                    <span>Material</span>
                </button>
                <button class="fm-bottom-nav-item ${this.activeTab === 'fotos' ? 'fm-bottom-nav-item--active' : ''}" data-action="fm-switch-tab" data-tab="fotos" role="tab" id="fm-tab-fotos" aria-selected="${this.activeTab === 'fotos'}" aria-controls="fm-tab-content">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <span>Foto</span>
                </button>
                <button class="fm-bottom-nav-item ${this.activeTab === 'notizen' ? 'fm-bottom-nav-item--active' : ''}" data-action="fm-switch-tab" data-tab="notizen" role="tab" id="fm-tab-notizen" aria-selected="${this.activeTab === 'notizen'}" aria-controls="fm-tab-content">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                    <span>Notiz</span>
                </button>
                <button class="fm-bottom-nav-item ${this.activeTab === 'status' ? 'fm-bottom-nav-item--active' : ''}" data-action="fm-switch-tab" data-tab="status" role="tab" id="fm-tab-status" aria-selected="${this.activeTab === 'status'}" aria-controls="fm-tab-content">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span>Status</span>
                    ${offlineCount > 0 ? `<span class="fm-nav-badge">${offlineCount}</span>` : ''}
                </button>
            </nav>
        `;

        if (isTimerForThisJob) { this._startTimerTick(); }
    }

    // ============================================
    // Tab Content Renderers
    // ============================================

    _renderActiveTab(job, activeTimer) {
        switch (this.activeTab) {
            case 'timer': return this._renderTimerTab(job, activeTimer);
            case 'material': return this._renderMaterialTab(job);
            case 'fotos': return this._renderPhotosTab(job);
            case 'notizen': return this._renderNotesTab(job);
            case 'status': return this._renderStatusTab(job);
            default: return this._renderTimerTab(job, activeTimer);
        }
    }

    _renderTimerTab(job, activeTimer) {
        const esc = window.esc || ((s) => { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; });
        const service = window.fieldAppService;
        const isTimerForThisJob = activeTimer?.jobId === job.id;
        const todaysEntries = service?.getTodaysTimeEntries() || [];
        const jobEntries = service?.getTimeEntries(job.id) || [];

        return `
            <div class="fm-tab-panel">
                <!-- Timer Section -->
                <div class="fm-timer-section">
                    <div class="fm-timer-display" id="fm-timer-display">
                        ${isTimerForThisJob ? activeTimer.elapsedFormatted : '00:00:00'}
                    </div>
                    <div class="fm-timer-buttons">
                        ${isTimerForThisJob ? `
                            <button class="fm-btn fm-btn-large fm-btn-warning" data-action="fm-pause-timer">
                                ${this.isPaused ? 'Weiter' : 'Pause'}
                            </button>
                            <button class="fm-btn fm-btn-large fm-btn-danger" data-action="fm-stop-timer">
                                Stop
                            </button>
                        ` : `
                            <button class="fm-btn fm-btn-large fm-btn-success" data-action="fm-start-timer" data-job-id="${job.id}">
                                Start
                            </button>
                        `}
                    </div>
                </div>

                <!-- Today's entries for this job -->
                ${jobEntries.length > 0 ? `
                    <div class="fm-section">
                        <h3 class="fm-section-title">Zeiteintraege - dieses Projekt (${jobEntries.length})</h3>
                        <div class="fm-time-entries-list">
                            ${jobEntries.map(e => `
                                <div class="fm-time-entry">
                                    <div class="fm-time-entry-times">
                                        <span class="fm-time-entry-range">${esc(e.startTime)} - ${esc(e.endTime)}</span>
                                        <span class="fm-time-entry-duration">${e.durationHours}h</span>
                                    </div>
                                    ${e.description ? `<div class="fm-time-entry-desc">${esc(e.description)}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Today's total -->
                <div class="fm-section fm-today-summary">
                    <div class="fm-today-summary-row">
                        <span>Heute gesamt:</span>
                        <strong>${service?.getTodaysTotalHours() || '0.00'} Stunden</strong>
                    </div>
                    <div class="fm-today-summary-row">
                        <span>Eintraege heute:</span>
                        <strong>${todaysEntries.length}</strong>
                    </div>
                </div>

                <!-- Job Switch -->
                <div class="fm-job-switch">
                    <label class="fm-label" for="fm-job-switch-select">Auftrag wechseln:</label>
                    <select id="fm-job-switch-select" class="fm-select" data-action="fm-switch-job">
                        ${(window.fieldAppService?.getTodaysJobs() || []).map(j =>
                            `<option value="${esc(j.id)}" ${j.id === job.id ? 'selected' : ''}>${esc(j.title)} - ${esc(j.customer)}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
        `;
    }

    _renderMaterialTab(job) {
        const esc = window.esc || ((s) => { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; });
        const service = window.fieldAppService;
        const materials = service?.getMaterialLog(job.id) || [];
        const storeMaterials = window.storeService?.store?.materialien || [];

        return `
            <div class="fm-tab-panel">
                <!-- Quick-Add Form -->
                <div class="fm-section">
                    <h3 class="fm-section-title">Material erfassen</h3>

                    ${storeMaterials.length > 0 ? `
                        <div class="fm-mat-quick-picks">
                            ${storeMaterials.slice(0, 8).map(m => `
                                <button class="fm-mat-quick-btn" data-action="fm-quick-material"
                                    data-mat-name="${esc(m.name || m.bezeichnung || '')}"
                                    data-mat-unit="${esc(m.einheit || m.unit || 'Stk.')}">
                                    ${esc(m.name || m.bezeichnung || '')}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}

                    <div class="fm-mat-inline-form">
                        <div class="form-group">
                            <input type="text" id="fm-mat-name-inline" class="fm-input" placeholder="Materialname..." data-voice-input>
                        </div>
                        <div class="fm-mat-qty-row">
                            <input type="number" id="fm-mat-qty-inline" class="fm-input" value="1" min="0.1" step="0.1" placeholder="Menge">
                            <select id="fm-mat-unit-inline" class="fm-select fm-select-short">
                                <option value="Stk.">Stk.</option>
                                <option value="m">m</option>
                                <option value="m2">m2</option>
                                <option value="kg">kg</option>
                                <option value="l">l</option>
                                <option value="Pkg.">Pkg.</option>
                                <option value="Rolle">Rolle</option>
                            </select>
                        </div>
                        <button class="fm-btn fm-btn-success fm-btn-fullwidth" data-action="fm-save-material-inline" data-job-id="${job.id}">
                            Material speichern
                        </button>
                    </div>
                </div>

                <!-- Material Log -->
                ${materials.length > 0 ? `
                    <div class="fm-section">
                        <h3 class="fm-section-title">Materialprotokoll (${materials.length})</h3>
                        <div class="fm-material-list">
                            ${materials.map(m => `
                                <div class="fm-material-item">
                                    <span>${esc(m.name)}</span>
                                    <span class="fm-material-qty">${m.quantity} ${esc(m.unit)}</span>
                                    <button class="fm-item-delete" data-action="fm-delete-material" data-material-id="${m.id}" aria-label="Entfernen">x</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="fm-empty-small">
                        <p>Noch kein Material erfasst</p>
                    </div>
                `}
            </div>
        `;
    }

    _renderPhotosTab(job) {
        const service = window.fieldAppService;
        const photos = service?.getPhotos(job.id) || [];

        return `
            <div class="fm-tab-panel">
                <!-- Capture Button -->
                <button class="fm-btn fm-btn-large fm-btn-success fm-btn-fullwidth fm-capture-btn" data-action="fm-capture-photo" data-job-id="${job.id}">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    Foto aufnehmen
                </button>

                <!-- Photo Gallery -->
                ${photos.length > 0 ? `
                    <div class="fm-section">
                        <h3 class="fm-section-title">Fotos (${photos.length})</h3>
                        <div class="fm-photo-grid">
                            ${photos.map(p => `
                                <div class="fm-photo-thumb" data-action="fm-enlarge-photo" data-photo-id="${p.id}">
                                    <img src="${this._safeDataUrl(p.dataUrl)}" alt="Foto" loading="lazy">
                                    <button class="fm-photo-delete" data-action="fm-delete-photo" data-photo-id="${p.id}" aria-label="Foto loeschen">x</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="fm-empty-small">
                        <p>Noch keine Fotos aufgenommen</p>
                    </div>
                `}
            </div>
        `;
    }

    _renderNotesTab(job) {
        const esc = window.esc || ((s) => { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; });
        const service = window.fieldAppService;
        const notes = service?.getVoiceNotes(job.id) || [];
        const hasVoice = window.voiceInputService?.isSupported;

        return `
            <div class="fm-tab-panel">
                <!-- Voice Record Button -->
                ${hasVoice ? `
                    <button class="fm-btn fm-btn-large fm-btn-voice fm-btn-fullwidth fm-voice-big-btn" id="fm-voice-record-tab" data-action="fm-toggle-voice">
                        <span class="fm-voice-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                                <line x1="12" y1="19" x2="12" y2="23"/>
                                <line x1="8" y1="23" x2="16" y2="23"/>
                            </svg>
                        </span>
                        <span id="fm-voice-tab-label">Spracheingabe starten</span>
                    </button>
                    <div id="fm-voice-tab-status" class="fm-voice-status" style="display:none;">
                        <span class="fm-pulse"></span> Aufnahme laeuft...
                        <span id="fm-voice-interim" class="fm-voice-interim"></span>
                    </div>
                ` : ''}

                <!-- Manual Note Input -->
                <div class="fm-section">
                    <div class="form-group">
                        <textarea id="fm-note-text-tab" class="fm-textarea" rows="4" placeholder="Notiz eingeben..." data-voice-input></textarea>
                    </div>
                    <button class="fm-btn fm-btn-success fm-btn-fullwidth" data-action="fm-save-note-tab" data-job-id="${job.id}">
                        Notiz speichern
                    </button>
                </div>

                <!-- Saved Notes -->
                ${notes.length > 0 ? `
                    <div class="fm-section">
                        <h3 class="fm-section-title">Gespeicherte Notizen (${notes.length})</h3>
                        <div class="fm-notes-list">
                            ${notes.map(n => `
                                <div class="fm-note-item">
                                    <span class="fm-note-time">${new Date(n.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span class="fm-note-text">${esc(n.text)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="fm-empty-small">
                        <p>Noch keine Notizen erfasst</p>
                    </div>
                `}
            </div>
        `;
    }

    _renderStatusTab(job) {
        const esc = window.esc || ((s) => { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; });
        const service = window.fieldAppService;
        const checkins = service?.getCheckins(job.id) || [];
        const signatures = service?.getSignatures(job.id) || [];
        const offlineCount = service?.getOfflineQueueCount() || 0;
        const lastCheckin = checkins.length > 0 ? checkins[checkins.length - 1] : null;

        const statusOptions = ['offen', 'in_bearbeitung', 'warten', 'abgeschlossen', 'storniert'];

        return `
            <div class="fm-tab-panel">
                <!-- Job Status -->
                <div class="fm-section">
                    <h3 class="fm-section-title">Auftragsstatus</h3>
                    <div class="fm-status-grid">
                        ${statusOptions.map(s => `
                            <button class="fm-status-btn ${job.status === s ? 'fm-status-btn--active' : ''}"
                                    data-action="fm-update-status" data-job-id="${job.id}" data-status="${s}">
                                ${this._statusLabel(s)}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- GPS Check-in -->
                <div class="fm-section">
                    <h3 class="fm-section-title">GPS Check-in</h3>
                    <button class="fm-btn fm-btn-large fm-btn-fullwidth fm-gps-btn" data-action="fm-gps-checkin" data-job-id="${job.id}" id="fm-gps-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        GPS Check-in
                    </button>
                    ${lastCheckin ? `
                        <div class="fm-gps-status fm-gps-status--ok">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                            <span>Letzter Check-in: ${new Date(lastCheckin.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span class="fm-gps-accuracy">(Genauigkeit: ${Math.round(lastCheckin.accuracy || 0)}m)</span>
                        </div>
                    ` : `
                        <div class="fm-gps-status fm-gps-status--none">
                            <span>Noch kein Check-in</span>
                        </div>
                    `}
                </div>

                <!-- Signature -->
                <div class="fm-section">
                    <h3 class="fm-section-title">Unterschrift (${signatures.length})</h3>
                    <button class="fm-btn fm-btn-large fm-btn-secondary fm-btn-fullwidth" data-action="fm-signature" data-job-id="${job.id}">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        Unterschrift aufnehmen
                    </button>
                    ${signatures.length > 0 ? `
                        <div class="fm-signature-list" style="margin-top:12px;">
                            ${signatures.map(s => `
                                <div class="fm-signature-item">
                                    <img src="${this._safeDataUrl(s.dataUrl)}" alt="Unterschrift" class="fm-signature-img">
                                    ${s.customerName ? `<span class="fm-signature-name">${esc(s.customerName)}</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                <!-- Offline Queue / Sync -->
                <div class="fm-section">
                    <h3 class="fm-section-title">Synchronisation</h3>
                    <div class="fm-sync-info">
                        <span class="fm-sync-status ${offlineCount > 0 ? 'fm-sync-status--pending' : 'fm-sync-status--ok'}">
                            ${offlineCount > 0 ? `${offlineCount} Aktion(en) in Warteschlange` : 'Alles synchronisiert'}
                        </span>
                    </div>
                    <button class="fm-btn fm-btn-secondary fm-btn-fullwidth" data-action="fm-sync-queue" ${offlineCount === 0 ? 'disabled' : ''}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/></svg>
                        Jetzt synchronisieren
                    </button>
                </div>
            </div>
        `;
    }

    _statusLabel(status) {
        const labels = {
            'offen': 'Offen',
            'in_bearbeitung': 'In Bearbeitung',
            'warten': 'Warten',
            'abgeschlossen': 'Abgeschlossen',
            'storniert': 'Storniert'
        };
        return labels[status] || status;
    }

    // ============================================
    // Modal Overlays (Material legacy, Note, Signature)
    // ============================================

    _showMaterialModal(jobId) {
        const esc = window.esc || ((s) => { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; });
        const materials = window.storeService?.store?.materialien || [];

        const overlay = document.createElement('div');
        overlay.className = 'fm-modal-overlay';
        overlay.innerHTML = `
            <div class="fm-modal">
                <div class="fm-modal-header">
                    <h3>Material verbraucht</h3>
                    <button class="fm-modal-close" data-action="fm-close-modal" aria-label="Schliessen">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="fm-modal-body">
                    <div class="form-group">
                        <label for="fm-mat-search">Material suchen</label>
                        <input type="text" id="fm-mat-search" class="fm-input" placeholder="Name eingeben..." autofocus>
                    </div>
                    <div id="fm-mat-suggestions" class="fm-mat-suggestions">
                        ${materials.slice(0, 10).map(m => `
                            <button class="fm-mat-suggestion" data-mat-name="${esc(m.name || m.bezeichnung || '')}" data-mat-unit="${esc(m.einheit || m.unit || 'Stk.')}">
                                ${esc(m.name || m.bezeichnung || '')}
                            </button>
                        `).join('')}
                    </div>
                    <div class="fm-mat-form" style="margin-top: 12px;">
                        <div class="form-group">
                            <label for="fm-mat-name">Bezeichnung</label>
                            <input type="text" id="fm-mat-name" class="fm-input" placeholder="Materialname" data-voice-input>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <div class="form-group" style="flex: 1;">
                                <label for="fm-mat-qty">Menge</label>
                                <input type="number" id="fm-mat-qty" class="fm-input" value="1" min="0.1" step="0.1">
                            </div>
                            <div class="form-group" style="flex: 1;">
                                <label for="fm-mat-unit">Einheit</label>
                                <select id="fm-mat-unit" class="fm-select">
                                    <option value="Stk.">Stk.</option>
                                    <option value="m">m</option>
                                    <option value="m2">m2</option>
                                    <option value="kg">kg</option>
                                    <option value="l">l</option>
                                    <option value="Pkg.">Pkg.</option>
                                    <option value="Rolle">Rolle</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="fm-mat-note">Notiz (optional)</label>
                            <input type="text" id="fm-mat-note" class="fm-input" placeholder="z.B. Restmenge..." data-voice-input>
                        </div>
                        <button class="fm-btn fm-btn-large fm-btn-success fm-btn-fullwidth" id="fm-mat-save">
                            Material speichern
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Attach voice buttons inside modal
        if (window.voiceInputService?.isSupported) {
            setTimeout(() => window.voiceInputService.attachAll(overlay), 50);
        }

        // Bind events
        overlay.querySelector('[data-action="fm-close-modal"]').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        // Suggestion clicks
        overlay.querySelectorAll('.fm-mat-suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                overlay.querySelector('#fm-mat-name').value = btn.dataset.matName;
                const unitSel = overlay.querySelector('#fm-mat-unit');
                if (btn.dataset.matUnit) {
                    for (let opt of unitSel.options) {
                        if (opt.value === btn.dataset.matUnit) { opt.selected = true; break; }
                    }
                }
            });
        });

        // Search filter
        const searchInput = overlay.querySelector('#fm-mat-search');
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase();
            const filtered = materials.filter(m =>
                (m.name || m.bezeichnung || '').toLowerCase().includes(q)
            ).slice(0, 10);
            const sugContainer = overlay.querySelector('#fm-mat-suggestions');
            sugContainer.innerHTML = filtered.map(m => `
                <button class="fm-mat-suggestion" data-mat-name="${esc(m.name || m.bezeichnung || '')}" data-mat-unit="${esc(m.einheit || m.unit || 'Stk.')}">
                    ${esc(m.name || m.bezeichnung || '')}
                </button>
            `).join('');
            sugContainer.querySelectorAll('.fm-mat-suggestion').forEach(btn => {
                btn.addEventListener('click', () => {
                    overlay.querySelector('#fm-mat-name').value = btn.dataset.matName;
                });
            });
        });

        // Save
        overlay.querySelector('#fm-mat-save').addEventListener('click', () => {
            const name = overlay.querySelector('#fm-mat-name').value.trim();
            if (!name) {
                if (window.UI?.showToast) window.UI.showToast('Bitte Materialname eingeben', 'warning');
                return;
            }
            window.fieldAppService?.logMaterial(jobId, {
                name: name,
                quantity: parseFloat(overlay.querySelector('#fm-mat-qty').value) || 1,
                unit: overlay.querySelector('#fm-mat-unit').value,
                note: overlay.querySelector('#fm-mat-note').value.trim()
            });
            overlay.remove();
            if (window.UI?.showToast) window.UI.showToast('Material gespeichert', 'success');
        });
    }

    _showNoteModal(jobId) {
        const overlay = document.createElement('div');
        overlay.className = 'fm-modal-overlay';
        overlay.innerHTML = `
            <div class="fm-modal">
                <div class="fm-modal-header">
                    <h3>Notiz hinzufuegen</h3>
                    <button class="fm-modal-close" data-action="fm-close-modal" aria-label="Schliessen">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="fm-modal-body">
                    <div class="form-group">
                        <label for="fm-note-text">Notiztext</label>
                        <div class="fm-note-input-row">
                            <textarea id="fm-note-text" class="fm-textarea" rows="5" placeholder="Notiz eingeben oder per Sprache diktieren..." data-voice-input></textarea>
                        </div>
                    </div>
                    ${window.voiceInputService?.isSupported ? `
                        <button class="fm-btn fm-btn-large fm-btn-voice" id="fm-voice-record">
                            <span class="fm-voice-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                    <line x1="12" y1="19" x2="12" y2="23"/>
                                    <line x1="8" y1="23" x2="16" y2="23"/>
                                </svg>
                            </span>
                            <span id="fm-voice-label">Spracheingabe starten</span>
                        </button>
                        <div id="fm-voice-status" class="fm-voice-status" style="display:none;">
                            <span class="fm-pulse"></span> Aufnahme laeuft...
                        </div>
                    ` : ''}
                    <button class="fm-btn fm-btn-large fm-btn-success fm-btn-fullwidth" id="fm-note-save" style="margin-top: 12px;">
                        Notiz speichern
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Attach voice inline buttons
        if (window.voiceInputService?.isSupported) {
            setTimeout(() => window.voiceInputService.attachAll(overlay), 50);
        }

        overlay.querySelector('[data-action="fm-close-modal"]').addEventListener('click', () => {
            window.voiceInputService?.stop();
            overlay.remove();
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                window.voiceInputService?.stop();
                overlay.remove();
            }
        });

        // Voice record big button
        const voiceBtn = overlay.querySelector('#fm-voice-record');
        const voiceStatus = overlay.querySelector('#fm-voice-status');
        const textarea = overlay.querySelector('#fm-note-text');
        let voiceActive = false;

        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                if (voiceActive) {
                    window.voiceInputService.stop();
                    voiceActive = false;
                    voiceBtn.classList.remove('fm-btn-voice--recording');
                    overlay.querySelector('#fm-voice-label').textContent = 'Spracheingabe starten';
                    if (voiceStatus) voiceStatus.style.display = 'none';
                } else {
                    voiceActive = true;
                    voiceBtn.classList.add('fm-btn-voice--recording');
                    overlay.querySelector('#fm-voice-label').textContent = 'Spracheingabe stoppen';
                    if (voiceStatus) voiceStatus.style.display = 'flex';

                    window.voiceInputService.start({
                        targetInput: textarea,
                        continuous: true,
                        append: true
                    });
                }
            });
        }

        // Save note
        overlay.querySelector('#fm-note-save').addEventListener('click', () => {
            window.voiceInputService?.stop();
            const text = textarea.value.trim();
            if (!text) {
                if (window.UI?.showToast) window.UI.showToast('Bitte Text eingeben', 'warning');
                return;
            }
            window.fieldAppService?.saveVoiceNote(jobId, text);
            overlay.remove();
            if (window.UI?.showToast) window.UI.showToast('Notiz gespeichert', 'success');
        });
    }

    _showSignatureModal(jobId) {
        const overlay = document.createElement('div');
        overlay.className = 'fm-modal-overlay';
        overlay.innerHTML = `
            <div class="fm-modal fm-modal--wide">
                <div class="fm-modal-header">
                    <h3>Unterschrift</h3>
                    <button class="fm-modal-close" data-action="fm-close-modal" aria-label="Schliessen">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="fm-modal-body">
                    <div class="form-group">
                        <label for="fm-sig-name">Name des Unterzeichners</label>
                        <input type="text" id="fm-sig-name" class="fm-input" placeholder="Kundenname..." data-voice-input>
                    </div>
                    <div class="fm-signature-canvas-wrapper">
                        <canvas id="fm-sig-canvas" class="fm-signature-canvas" width="600" height="200"></canvas>
                    </div>
                    <div class="fm-signature-actions">
                        <button class="fm-btn fm-btn-secondary" id="fm-sig-clear">Loeschen</button>
                        <button class="fm-btn fm-btn-success" id="fm-sig-save">Unterschrift speichern</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Attach voice
        if (window.voiceInputService?.isSupported) {
            setTimeout(() => window.voiceInputService.attachAll(overlay), 50);
        }

        overlay.querySelector('[data-action="fm-close-modal"]').addEventListener('click', () => {
            this._cleanupSignaturePad();
            overlay.remove();
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { this._cleanupSignaturePad(); overlay.remove(); }
        });

        // Init signature pad
        const canvas = overlay.querySelector('#fm-sig-canvas');
        setTimeout(() => {
            this.signaturePad = window.fieldAppService?.createSignaturePad(canvas);
        }, 50);

        overlay.querySelector('#fm-sig-clear').addEventListener('click', () => {
            this.signaturePad?.clear();
        });

        overlay.querySelector('#fm-sig-save').addEventListener('click', () => {
            if (this.signaturePad?.isEmpty()) {
                if (window.UI?.showToast) window.UI.showToast('Bitte unterschreiben', 'warning');
                return;
            }
            const dataUrl = this.signaturePad.toDataURL();
            const name = overlay.querySelector('#fm-sig-name').value.trim();
            window.fieldAppService?.saveSignature(jobId, dataUrl, name);
            this._cleanupSignaturePad();
            overlay.remove();
            if (window.UI?.showToast) window.UI.showToast('Unterschrift gespeichert', 'success');
        });
    }

    _showStopTimerModal() {
        const overlay = document.createElement('div');
        overlay.className = 'fm-modal-overlay';
        overlay.innerHTML = `
            <div class="fm-modal" role="dialog" aria-modal="true" aria-label="Timer stoppen">
                <h3 class="fm-section-title">Timer stoppen</h3>
                <label class="fm-label" for="fm-stop-desc">Beschreibung der Arbeit (optional):</label>
                <input type="text" id="fm-stop-desc" class="fm-input" placeholder="z.B. Fliesen verlegt..." autofocus>
                <div class="fm-modal-actions" style="display:flex;gap:8px;margin-top:12px;">
                    <button class="fm-btn fm-btn-danger" data-action="fm-confirm-stop">Stoppen</button>
                    <button class="fm-btn" data-action="fm-cancel-stop">Abbrechen</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('#fm-stop-desc');
        input.focus();

        const close = () => overlay.remove();
        const confirm = () => {
            const desc = input.value.trim();
            window.fieldAppService?.clockOut(desc);
            this.isPaused = false;
            this.totalPauseMs = 0;
            close();
            this.render();
        };

        overlay.querySelector('[data-action="fm-confirm-stop"]').addEventListener('click', confirm);
        overlay.querySelector('[data-action="fm-cancel-stop"]').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') close(); });
    }

    _showPhotoEnlarged(photoId) {
        const photos = window.fieldAppService?.getPhotos() || [];
        const photo = photos.find(p => p.id === photoId);
        if (!photo) return;

        const overlay = document.createElement('div');
        overlay.className = 'fm-modal-overlay fm-photo-lightbox';
        overlay.innerHTML = `
            <div class="fm-lightbox-content">
                <button class="fm-lightbox-close" data-action="fm-close-lightbox" aria-label="Schliessen">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <img src="${this._safeDataUrl(photo.dataUrl)}" alt="Foto" class="fm-lightbox-img">
                <div class="fm-lightbox-meta">
                    <span>${new Date(photo.timestamp).toLocaleString('de-DE')}</span>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('[data-action="fm-close-lightbox"]').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    // ============================================
    // Event Binding
    // ============================================

    _bindEvents() {
        if (!this.container) { return; }

        // Abort previous listeners to prevent stacking on re-render
        if (this._eventsAbort) this._eventsAbort.abort();
        this._eventsAbort = new AbortController();
        const sig = { signal: this._eventsAbort.signal };

        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) { return; }

            const action = btn.dataset.action;
            const jobId = btn.dataset.jobId;

            switch (action) {
                case 'fm-select-job':
                    this.currentJobId = jobId;
                    this.activeTab = 'timer';
                    this.render();
                    break;

                case 'fm-back':
                    this.currentJobId = null;
                    this._stopTimerTick();
                    this.render();
                    break;

                case 'fm-goto-active': {
                    const timer = window.fieldAppService?.getCurrentTimer();
                    if (timer) {
                        this.currentJobId = timer.jobId;
                        this.activeTab = 'timer';
                        this.render();
                    }
                    break;
                }

                case 'fm-switch-tab':
                    this.activeTab = btn.dataset.tab;
                    this._renderTabContent();
                    this._updateBottomNav();
                    break;

                case 'fm-start-timer':
                    window.fieldAppService?.clockIn(jobId, window.fieldAppService?.getJobById(jobId)?.title);
                    this.render();
                    break;

                case 'fm-pause-timer':
                    this._togglePause();
                    break;

                case 'fm-stop-timer':
                    this._showStopTimerModal();
                    break;

                case 'fm-capture-photo':
                    window.fieldAppService?.capturePhoto(jobId || this.currentJobId).then(() => this.render());
                    break;

                case 'fm-add-material':
                    this._showMaterialModal(jobId);
                    break;

                case 'fm-add-note':
                    this._showNoteModal(jobId);
                    break;

                case 'fm-signature':
                    this._showSignatureModal(jobId || this.currentJobId);
                    break;

                case 'fm-delete-photo':
                    e.stopPropagation();
                    window.fieldAppService?.deletePhoto(btn.dataset.photoId);
                    this.render();
                    break;

                case 'fm-enlarge-photo':
                    this._showPhotoEnlarged(btn.dataset.photoId);
                    break;

                case 'fm-delete-material':
                    window.fieldAppService?.removeMaterial(btn.dataset.materialId);
                    this.render();
                    break;

                case 'fm-save-material-inline': {
                    const nameInput = this.container.querySelector('#fm-mat-name-inline');
                    const name = nameInput?.value.trim();
                    if (!name) {
                        if (window.UI?.showToast) window.UI.showToast('Bitte Materialname eingeben', 'warning');
                        return;
                    }
                    window.fieldAppService?.logMaterial(jobId || this.currentJobId, {
                        name: name,
                        quantity: parseFloat(this.container.querySelector('#fm-mat-qty-inline')?.value) || 1,
                        unit: this.container.querySelector('#fm-mat-unit-inline')?.value || 'Stk.'
                    });
                    nameInput.value = '';
                    this.container.querySelector('#fm-mat-qty-inline').value = '1';
                    if (window.UI?.showToast) window.UI.showToast('Material gespeichert', 'success');
                    this.render();
                    break;
                }

                case 'fm-quick-material': {
                    const matName = this.container.querySelector('#fm-mat-name-inline');
                    if (matName) {
                        matName.value = btn.dataset.matName || '';
                    }
                    const unitSel = this.container.querySelector('#fm-mat-unit-inline');
                    if (unitSel && btn.dataset.matUnit) {
                        for (let opt of unitSel.options) {
                            if (opt.value === btn.dataset.matUnit) { opt.selected = true; break; }
                        }
                    }
                    matName?.focus();
                    break;
                }

                case 'fm-save-note-tab': {
                    const textarea = this.container.querySelector('#fm-note-text-tab');
                    const text = textarea?.value.trim();
                    if (!text) {
                        if (window.UI?.showToast) window.UI.showToast('Bitte Text eingeben', 'warning');
                        return;
                    }
                    window.fieldAppService?.saveVoiceNote(jobId || this.currentJobId, text);
                    textarea.value = '';
                    if (window.UI?.showToast) window.UI.showToast('Notiz gespeichert', 'success');
                    this.render();
                    break;
                }

                case 'fm-toggle-voice': {
                    this._toggleVoiceInTab();
                    break;
                }

                case 'fm-update-status': {
                    const newStatus = btn.dataset.status;
                    window.fieldAppService?.updateJobStatus(jobId || this.currentJobId, newStatus);
                    if (window.UI?.showToast) window.UI.showToast(`Status: ${this._statusLabel(newStatus)}`, 'success');
                    this.render();
                    break;
                }

                case 'fm-gps-checkin': {
                    const gpsBtn = this.container.querySelector('#fm-gps-btn');
                    if (gpsBtn) {
                        gpsBtn.disabled = true;
                        gpsBtn.textContent = 'Position wird ermittelt...';
                    }
                    window.fieldAppService?.checkIn(jobId || this.currentJobId).then(result => {
                        if (result.success) {
                            if (window.UI?.showToast) window.UI.showToast('GPS Check-in erfolgreich', 'success');
                        } else {
                            if (window.UI?.showToast) window.UI.showToast(result.error || 'GPS-Fehler', 'error');
                        }
                        this.render();
                    });
                    break;
                }

                case 'fm-sync-queue': {
                    window.fieldAppService?.syncOfflineQueue().then(result => {
                        if (result.synced > 0) {
                            if (window.UI?.showToast) window.UI.showToast(`${result.synced} Aktion(en) synchronisiert`, 'success');
                        } else {
                            if (window.UI?.showToast) window.UI.showToast('Keine Aktionen zu synchronisieren', 'info');
                        }
                        this.render();
                    });
                    break;
                }

                case 'fm-open-overlay':
                    // Open the full-screen mobile overlay
                    if (window.fieldAppMobileUI) {
                        window.fieldAppService?.enterFieldMode();
                        window.fieldAppMobileUI.show();
                    } else if (window.fieldAppUI) {
                        window.fieldAppService?.enterFieldMode();
                        window.fieldAppUI.show();
                    }
                    break;
            }
        }, sig);

        // Job switch dropdown
        const switchSelect = this.container.querySelector('#fm-job-switch-select');
        if (switchSelect) {
            switchSelect.addEventListener('change', () => {
                this.currentJobId = switchSelect.value;
                this.render();
            }, sig);
        }

        // Arrow key navigation for tabs (WAI-ARIA tabs pattern)
        const tabList = this.container.querySelector('[role="tablist"]');
        if (tabList) {
            const tabs = ['timer', 'material', 'fotos', 'notizen', 'status'];
            tabList.addEventListener('keydown', (e) => {
                const idx = tabs.indexOf(this.activeTab);
                if (idx === -1) return;
                let newIdx = idx;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { newIdx = (idx + 1) % tabs.length; }
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { newIdx = (idx - 1 + tabs.length) % tabs.length; }
                else if (e.key === 'Home') { newIdx = 0; }
                else if (e.key === 'End') { newIdx = tabs.length - 1; }
                else return;
                e.preventDefault();
                this.activeTab = tabs[newIdx];
                this.render();
                const newTab = this.container.querySelector(`#fm-tab-${tabs[newIdx]}`);
                if (newTab) newTab.focus();
            }, sig);
        }
    }

    // ============================================
    // Tab Navigation Helpers
    // ============================================

    _renderTabContent() {
        const tabContent = this.container.querySelector('#fm-tab-content');
        if (!tabContent) return;

        const job = window.fieldAppService?.getJobById(this.currentJobId);
        const activeTimer = window.fieldAppService?.getCurrentTimer();
        if (!job) return;

        tabContent.innerHTML = this._renderActiveTab(job, activeTimer);

        // Rebind inner events and voice
        if (window.voiceInputService?.isSupported) {
            setTimeout(() => window.voiceInputService.attachAll(tabContent), 50);
        }

        // Restart timer tick if on timer tab
        if (this.activeTab === 'timer' && activeTimer?.jobId === job.id) {
            this._startTimerTick();
        } else if (this.activeTab !== 'timer') {
            // keep timer ticking in background for banner
        }
    }

    _updateBottomNav() {
        const navItems = this.container.querySelectorAll('.fm-bottom-nav-item');
        navItems.forEach(item => {
            if (item.dataset.tab === this.activeTab) {
                item.classList.add('fm-bottom-nav-item--active');
            } else {
                item.classList.remove('fm-bottom-nav-item--active');
            }
        });
    }

    // ============================================
    // Voice in Notes Tab
    // ============================================

    _toggleVoiceInTab() {
        const voiceBtn = this.container.querySelector('#fm-voice-record-tab');
        const voiceStatus = this.container.querySelector('#fm-voice-tab-status');
        const voiceLabel = this.container.querySelector('#fm-voice-tab-label');
        const textarea = this.container.querySelector('#fm-note-text-tab');

        if (!voiceBtn || !textarea) return;

        const isRecording = voiceBtn.classList.contains('fm-btn-voice--recording');

        if (isRecording) {
            window.voiceInputService?.stop();
            voiceBtn.classList.remove('fm-btn-voice--recording');
            if (voiceLabel) voiceLabel.textContent = 'Spracheingabe starten';
            if (voiceStatus) voiceStatus.style.display = 'none';
        } else {
            voiceBtn.classList.add('fm-btn-voice--recording');
            if (voiceLabel) voiceLabel.textContent = 'Spracheingabe stoppen';
            if (voiceStatus) voiceStatus.style.display = 'flex';

            window.voiceInputService?.start({
                targetInput: textarea,
                continuous: true,
                append: true
            });
        }
    }

    // ============================================
    // Timer Management
    // ============================================

    _startTimerTick() {
        this._stopTimerTick();
        this.timerInterval = setInterval(() => {
            const timer = window.fieldAppService?.getCurrentTimer();
            const display = document.getElementById('fm-timer-display');
            const banner = document.getElementById('fm-banner-timer');

            if (timer && !this.isPaused) {
                const formatted = timer.elapsedFormatted;
                if (display) display.textContent = formatted;
                if (banner) banner.textContent = formatted;
            }
        }, 1000);
    }

    _stopTimerTick() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    _togglePause() {
        if (this.isPaused) {
            // Resume
            this.totalPauseMs += Date.now() - this.pauseStart;
            this.isPaused = false;
            this.pauseStart = null;
        } else {
            // Pause
            this.isPaused = true;
            this.pauseStart = Date.now();
        }
        this.render();
    }

    // ============================================
    // Partial Refreshes
    // ============================================

    _refreshTimer() {
        if (this.currentJobId) { this.render(); }
    }

    _refreshMaterials() {
        if (this.currentJobId && this.activeTab === 'material') { this.render(); }
    }

    _refreshPhotos() {
        if (this.currentJobId && this.activeTab === 'fotos') { this.render(); }
    }

    _refreshNotes() {
        if (this.currentJobId && this.activeTab === 'notizen') { this.render(); }
    }

    _refreshSignatures() {
        if (this.currentJobId && this.activeTab === 'status') { this.render(); }
    }

    _refreshStatus() {
        if (this.currentJobId && this.activeTab === 'status') { this.render(); }
    }

    _cleanupSignaturePad() {
        if (this.signaturePad) {
            this.signaturePad.destroy?.();
            this.signaturePad = null;
        }
    }
}

// Register globally
window.fieldModeUI = new FieldModeUI();
