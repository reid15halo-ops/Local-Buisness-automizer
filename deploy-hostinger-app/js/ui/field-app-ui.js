/* ============================================
   Field App UI - Mobile Außendienst Oberfläche
   Full-screen overlay optimized for on-site use
   ============================================ */

class FieldAppUI {
    constructor() {
        this.overlay = null;
        this.currentScreen = 'jobs'; // jobs, jobDetail, timer, camera, more
        this.currentJobId = null;
        this.timerInterval = null;
        this.signaturePad = null;
        this.fab = null;

        // Wait for DOM and service
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        this._createFAB();
        this._createOverlay();
        this._bindServiceEvents();

        // If field mode was active before page reload, restore it
        if (window.fieldAppService?.isFieldMode) {
            this.show();
        }
    }

    // ============================================
    // Floating Action Button (always visible)
    // ============================================

    _createFAB() {
        if (document.getElementById('field-app-fab')) { return; }

        this.fab = document.createElement('button');
        this.fab.id = 'field-app-fab';
        this.fab.className = 'field-app-fab';
        this.fab.setAttribute('aria-label', 'Feld-Modus öffnen');
        this.fab.setAttribute('title', 'Feld-Modus');
        this.fab.innerHTML = `
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
        `;

        this.fab.addEventListener('click', () => {
            window.fieldAppService?.enterFieldMode();
            this.show();
        });

        document.body.appendChild(this.fab);
    }

    // ============================================
    // Overlay Container
    // ============================================

    _createOverlay() {
        if (document.getElementById('field-app-overlay')) { return; }

        this.overlay = document.createElement('div');
        this.overlay.id = 'field-app-overlay';
        this.overlay.className = 'field-overlay';
        this.overlay.style.display = 'none';

        document.body.appendChild(this.overlay);
    }

    show() {
        if (!this.overlay) { this._createOverlay(); }
        this.overlay.style.display = 'flex';
        if (this.fab) { this.fab.style.display = 'none'; }
        document.body.style.overflow = 'hidden';

        this.currentScreen = 'jobs';
        this.render();
        this._startTimerInterval();
    }

    hide() {
        if (this.overlay) { this.overlay.style.display = 'none'; }
        if (this.fab) { this.fab.style.display = 'flex'; }
        document.body.style.overflow = '';

        window.fieldAppService?.exitFieldMode();
        this._stopTimerInterval();
        this._cleanupSignaturePad();
        window.fieldAppService?.stopCamera();
    }

    // ============================================
    // Main Render
    // ============================================

    render() {
        if (!this.overlay) { return; }

        let content = '';

        switch (this.currentScreen) {
            case 'jobs':
                content = this._renderJobsScreen();
                break;
            case 'jobDetail':
                content = this._renderJobDetailScreen();
                break;
            case 'timer':
                content = this._renderTimerScreen();
                break;
            case 'camera':
                content = this._renderCameraScreen();
                break;
            case 'more':
                content = this._renderMoreScreen();
                break;
            case 'material':
                content = this._renderMaterialScreen();
                break;
            case 'signature':
                content = this._renderSignatureScreen();
                break;
            case 'voice':
                content = this._renderVoiceScreen();
                break;
            default:
                content = this._renderJobsScreen();
        }

        this.overlay.innerHTML = `
            <div class="field-screen">
                ${content}
            </div>
            ${this._renderBottomNav()}
        `;

        this._bindScreenEvents();
    }

    // ============================================
    // Screen: Today's Jobs
    // ============================================

    _renderJobsScreen() {
        const service = window.fieldAppService;
        const jobs = service?.getTodaysJobs() || [];
        const stats = service?.getTodaysStats() || {};
        const timer = service?.getCurrentTimer();

        const today = new Date();
        const dateStr = today.toLocaleDateString('de-DE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });

        let timerBanner = '';
        if (timer) {
            timerBanner = `
                <div class="field-timer-banner" data-action="goTimer">
                    <div class="field-timer-banner-info">
                        <span class="field-timer-banner-label">Aktiv</span>
                        <span class="field-timer-banner-job">${this._escape(timer.jobTitle)}</span>
                    </div>
                    <span class="field-timer-display field-timer-display--small" id="field-banner-timer">${timer.elapsedFormatted}</span>
                </div>
            `;
        }

        const jobCards = jobs.length > 0
            ? jobs.map(job => this._renderJobCard(job)).join('')
            : `<div class="field-empty-state">
                    <div class="field-empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <p>Keine Aufträge für heute</p>
                    <p class="field-empty-sub">Aufträge im Hauptmenü anlegen</p>
               </div>`;

        return `
            <div class="field-header">
                <div class="field-header-top">
                    <div>
                        <h1 class="field-title">Heutige Aufträge</h1>
                        <p class="field-subtitle">${dateStr}</p>
                    </div>
                    <div class="field-header-stats">
                        <span class="field-stat">${stats.totalHours || '0.0'}h</span>
                    </div>
                </div>
            </div>
            ${timerBanner}
            <div class="field-content field-content--scroll">
                ${jobCards}
            </div>
        `;
    }

    _renderJobCard(job) {
        const isActive = window.fieldAppService?.activeTimer?.jobId === job.id;
        const statusInfo = this._getStatusInfo(job.status);

        return `
            <div class="field-job-card ${isActive ? 'field-job-card--active' : ''}" data-action="openJob" data-job-id="${job.id}">
                <div class="field-job-card-header">
                    <span class="field-job-time">${job.time || '--:--'}</span>
                    <span class="field-job-status" style="background: ${statusInfo.bg}; color: ${statusInfo.color}">
                        ${statusInfo.label}
                    </span>
                </div>
                <h3 class="field-job-title">${this._escape(job.title)}</h3>
                <p class="field-job-customer">${this._escape(job.customer)}</p>
                ${job.address ? `<p class="field-job-address">${this._escape(job.address)}</p>` : ''}
            </div>
        `;
    }

    // ============================================
    // Screen: Job Detail
    // ============================================

    _renderJobDetailScreen() {
        const service = window.fieldAppService;
        const job = service?.getJobById(this.currentJobId);
        const timer = service?.getCurrentTimer();
        const isTimerRunning = timer && timer.jobId === this.currentJobId;
        const photos = service?.getPhotos(this.currentJobId) || [];
        const materials = service?.getMaterialLog(this.currentJobId) || [];
        const timeEntries = service?.getTimeEntries(this.currentJobId) || [];
        const voiceNotes = service?.getVoiceNotes(this.currentJobId) || [];

        if (!job) {
            return `
                <div class="field-header">
                    <button class="field-back-btn" data-action="goJobs">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                        Zurück
                    </button>
                </div>
                <div class="field-content">
                    <div class="field-empty-state"><p>Auftrag nicht gefunden</p></div>
                </div>
            `;
        }

        const statusInfo = this._getStatusInfo(job.status);

        return `
            <div class="field-header field-header--compact">
                <button class="field-back-btn" data-action="goJobs">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                    Zurück
                </button>
                <div class="field-job-info">
                    <h2 class="field-job-detail-title">${this._escape(job.title)}</h2>
                    <p class="field-job-detail-customer">${this._escape(job.customer)}</p>
                    ${job.address ? `<p class="field-job-detail-address">${this._escape(job.address)}</p>` : ''}
                </div>
                <div class="field-job-status-row">
                    <span class="field-job-status" style="background: ${statusInfo.bg}; color: ${statusInfo.color}">${statusInfo.label}</span>
                    <div class="field-status-actions">
                        <button class="field-status-btn" data-action="setStatus" data-status="in_arbeit" title="In Arbeit">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </button>
                        <button class="field-status-btn field-status-btn--success" data-action="setStatus" data-status="fertig" title="Fertig">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            <div class="field-content field-content--scroll">
                <!-- Clock In/Out Button -->
                <div class="field-clock-section">
                    ${isTimerRunning ? `
                        <div class="field-timer-display" id="field-detail-timer">${timer.elapsedFormatted}</div>
                        <button class="field-clock-btn field-clock-btn--out" data-action="clockOut">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                            Ausstempeln
                        </button>
                    ` : `
                        <button class="field-clock-btn field-clock-btn--in" data-action="clockIn">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Einstempeln
                        </button>
                    `}
                </div>

                <!-- Quick Actions Grid -->
                <div class="field-actions-grid">
                    <button class="field-action-btn" data-action="takePhoto">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        <span>Foto</span>
                        ${photos.length > 0 ? `<span class="field-action-badge">${photos.length}</span>` : ''}
                    </button>
                    <button class="field-action-btn" data-action="goMaterial">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                        <span>Material</span>
                        ${materials.length > 0 ? `<span class="field-action-badge">${materials.length}</span>` : ''}
                    </button>
                    <button class="field-action-btn" data-action="goVoice">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                        <span>Notiz</span>
                        ${voiceNotes.length > 0 ? `<span class="field-action-badge">${voiceNotes.length}</span>` : ''}
                    </button>
                    <button class="field-action-btn" data-action="goSignature">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        <span>Unterschrift</span>
                    </button>
                </div>

                <!-- Time Entries for this job -->
                ${timeEntries.length > 0 ? `
                    <div class="field-section">
                        <h3 class="field-section-title">Zeiteinträge</h3>
                        ${timeEntries.map(e => `
                            <div class="field-time-entry">
                                <span class="field-time-entry-range">${e.startTime} - ${e.endTime}</span>
                                <span class="field-time-entry-duration">${e.durationHours}h</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Photos for this job -->
                ${photos.length > 0 ? `
                    <div class="field-section">
                        <h3 class="field-section-title">Fotos (${photos.length})</h3>
                        <div class="field-photo-grid">
                            ${photos.map(p => `
                                <div class="field-photo-thumb">
                                    <img src="${p.dataUrl}" alt="Foto" loading="lazy">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Materials for this job -->
                ${materials.length > 0 ? `
                    <div class="field-section">
                        <h3 class="field-section-title">Material</h3>
                        ${materials.map(m => `
                            <div class="field-material-entry">
                                <span class="field-material-name">${this._escape(m.name)}</span>
                                <span class="field-material-qty">${m.quantity} ${this._escape(m.unit)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Voice Notes for this job -->
                ${voiceNotes.length > 0 ? `
                    <div class="field-section">
                        <h3 class="field-section-title">Notizen</h3>
                        ${voiceNotes.map(n => `
                            <div class="field-voice-entry">
                                <p class="field-voice-text">${this._escape(n.text)}</p>
                                <span class="field-voice-time">${new Date(n.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- GPS Check-in -->
                <button class="field-gps-btn" data-action="gpsCheckin">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    GPS Check-in
                </button>
            </div>
        `;
    }

    // ============================================
    // Screen: Timer
    // ============================================

    _renderTimerScreen() {
        const service = window.fieldAppService;
        const timer = service?.getCurrentTimer();
        const todaysEntries = service?.getTodaysTimeEntries() || [];
        const totalHours = service?.getTodaysTotalHours() || 0;
        const jobs = service?.getTodaysJobs() || [];

        return `
            <div class="field-header">
                <h1 class="field-title">Zeiterfassung</h1>
                <p class="field-subtitle">Heute: ${totalHours.toFixed(1)} Stunden</p>
            </div>
            <div class="field-content field-content--scroll">
                <!-- Big Timer Display -->
                <div class="field-timer-big-section">
                    <div class="field-timer-display field-timer-display--big" id="field-screen-timer">
                        ${timer ? timer.elapsedFormatted : '00:00:00'}
                    </div>
                    ${timer ? `
                        <p class="field-timer-job-label">${this._escape(timer.jobTitle)}</p>
                        <button class="field-clock-btn field-clock-btn--out field-clock-btn--large" data-action="clockOut">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                            Ausstempeln
                        </button>
                    ` : `
                        <div class="field-timer-job-selector">
                            <select id="field-timer-job-select" class="field-select">
                                <option value="">Auftrag wählen...</option>
                                ${jobs.map(j => `<option value="${j.id}">${this._escape(j.title)} - ${this._escape(j.customer)}</option>`).join('')}
                            </select>
                            <button class="field-clock-btn field-clock-btn--in field-clock-btn--large" data-action="clockInSelected">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                Einstempeln
                            </button>
                        </div>
                    `}
                </div>

                <!-- Today's Entries -->
                ${todaysEntries.length > 0 ? `
                    <div class="field-section">
                        <h3 class="field-section-title">Heutige Einträge</h3>
                        ${todaysEntries.map(e => `
                            <div class="field-time-entry">
                                <div class="field-time-entry-info">
                                    <span class="field-time-entry-job">${this._escape(e.jobTitle || 'Auftrag')}</span>
                                    <span class="field-time-entry-range">${e.startTime} - ${e.endTime}</span>
                                </div>
                                <span class="field-time-entry-duration">${e.durationHours}h</span>
                            </div>
                        `).join('')}
                        <div class="field-time-total">
                            <span>Gesamt</span>
                            <span>${totalHours.toFixed(1)}h</span>
                        </div>
                    </div>
                ` : `
                    <div class="field-empty-state field-empty-state--small">
                        <p>Noch keine Einträge heute</p>
                    </div>
                `}
            </div>
        `;
    }

    // ============================================
    // Screen: Camera
    // ============================================

    _renderCameraScreen() {
        const service = window.fieldAppService;
        const jobs = service?.getTodaysJobs() || [];
        const allPhotos = service?.getPhotos() || [];
        const todayPhotos = allPhotos.filter(p => p.date === new Date().toISOString().split('T')[0]);
        const currentJobId = this.currentJobId || service?.currentJobId || '';

        return `
            <div class="field-header">
                <h1 class="field-title">Fotos</h1>
                <p class="field-subtitle">${todayPhotos.length} Fotos heute</p>
            </div>
            <div class="field-content field-content--scroll">
                <!-- Job Selector -->
                <div class="field-camera-controls">
                    <select id="field-camera-job-select" class="field-select">
                        <option value="">Auftrag wählen...</option>
                        ${jobs.map(j => `<option value="${j.id}" ${j.id === currentJobId ? 'selected' : ''}>${this._escape(j.title)}</option>`).join('')}
                    </select>
                    <button class="field-capture-btn" data-action="capturePhoto">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                        </svg>
                        Foto aufnehmen
                    </button>
                </div>

                <!-- Photo Gallery -->
                ${todayPhotos.length > 0 ? `
                    <div class="field-section">
                        <h3 class="field-section-title">Heutige Fotos</h3>
                        <div class="field-photo-gallery">
                            ${todayPhotos.map(p => `
                                <div class="field-photo-item">
                                    <img src="${p.dataUrl}" alt="Foto" loading="lazy">
                                    <div class="field-photo-overlay">
                                        <span class="field-photo-time">${new Date(p.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                                        <button class="field-photo-delete" data-action="deletePhoto" data-photo-id="${p.id}" title="Löschen">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="field-empty-state">
                        <div class="field-empty-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </div>
                        <p>Noch keine Fotos heute</p>
                        <p class="field-empty-sub">Auftrag wählen und Foto aufnehmen</p>
                    </div>
                `}
            </div>
        `;
    }

    // ============================================
    // Screen: More
    // ============================================

    _renderMoreScreen() {
        const service = window.fieldAppService;
        const stats = service?.getTodaysStats() || {};
        const queueCount = service?.getOfflineQueueCount() || 0;
        const isOnline = navigator.onLine;

        return `
            <div class="field-header">
                <h1 class="field-title">Weitere Optionen</h1>
            </div>
            <div class="field-content field-content--scroll">
                <!-- Connection Status -->
                <div class="field-connection-status ${isOnline ? 'field-connection--online' : 'field-connection--offline'}">
                    <div class="field-connection-dot"></div>
                    <span>${isOnline ? 'Online' : 'Offline'}</span>
                    ${queueCount > 0 ? `<span class="field-queue-badge">${queueCount} ausstehend</span>` : ''}
                </div>

                <!-- Today's Summary -->
                <div class="field-section">
                    <h3 class="field-section-title">Heute</h3>
                    <div class="field-stats-grid">
                        <div class="field-stat-card">
                            <span class="field-stat-value">${(stats.totalHours || 0).toFixed(1)}</span>
                            <span class="field-stat-label">Stunden</span>
                        </div>
                        <div class="field-stat-card">
                            <span class="field-stat-value">${stats.photos || 0}</span>
                            <span class="field-stat-label">Fotos</span>
                        </div>
                        <div class="field-stat-card">
                            <span class="field-stat-value">${stats.materials || 0}</span>
                            <span class="field-stat-label">Material</span>
                        </div>
                        <div class="field-stat-card">
                            <span class="field-stat-value">${stats.voiceNotes || 0}</span>
                            <span class="field-stat-label">Notizen</span>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="field-section">
                    <h3 class="field-section-title">Aktionen</h3>

                    <button class="field-more-btn" data-action="goVoice">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                        <span>Sprachnotiz aufnehmen</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>

                    <button class="field-more-btn" data-action="goMaterial">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                        <span>Material erfassen</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>

                    <button class="field-more-btn" data-action="gpsCheckinGeneral">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span>GPS Check-in</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>

                    ${queueCount > 0 ? `
                        <button class="field-more-btn field-more-btn--sync" data-action="syncQueue">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            <span>Offline-Daten synchronisieren (${queueCount})</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    ` : ''}
                </div>

                <!-- Exit Button -->
                <div class="field-section">
                    <button class="field-exit-btn" data-action="exitFieldMode">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Feld-Modus beenden
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================
    // Screen: Material Entry
    // ============================================

    _renderMaterialScreen() {
        const service = window.fieldAppService;
        const jobs = service?.getTodaysJobs() || [];
        const currentJobId = this.currentJobId || '';
        const materials = currentJobId ? (service?.getMaterialLog(currentJobId) || []) : [];

        const commonUnits = ['Stk.', 'm', 'm²', 'kg', 'Liter', 'Packung', 'Satz'];

        return `
            <div class="field-header field-header--compact">
                <button class="field-back-btn" data-action="goBack">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                    Zurück
                </button>
                <h2 class="field-title">Material erfassen</h2>
            </div>
            <div class="field-content field-content--scroll">
                <div class="field-form">
                    <div class="field-form-group">
                        <label class="field-label">Auftrag</label>
                        <select id="field-material-job" class="field-select">
                            <option value="">Auftrag wählen...</option>
                            ${jobs.map(j => `<option value="${j.id}" ${j.id === currentJobId ? 'selected' : ''}>${this._escape(j.title)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="field-form-group">
                        <label class="field-label">Material / Bezeichnung</label>
                        <input type="text" id="field-material-name" class="field-input" placeholder="z.B. Rohr DN 50">
                    </div>
                    <div class="field-form-row">
                        <div class="field-form-group field-form-group--half">
                            <label class="field-label">Menge</label>
                            <input type="number" id="field-material-qty" class="field-input" value="1" min="0.1" step="0.1" inputmode="decimal">
                        </div>
                        <div class="field-form-group field-form-group--half">
                            <label class="field-label">Einheit</label>
                            <select id="field-material-unit" class="field-select">
                                ${commonUnits.map(u => `<option value="${u}">${u}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="field-form-group">
                        <label class="field-label">Bemerkung (optional)</label>
                        <input type="text" id="field-material-note" class="field-input" placeholder="z.B. Restposten">
                    </div>
                    <button class="field-submit-btn" data-action="saveMaterial">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Material hinzufügen
                    </button>
                </div>

                <!-- Existing Materials -->
                ${materials.length > 0 ? `
                    <div class="field-section">
                        <h3 class="field-section-title">Erfasste Materialien</h3>
                        ${materials.map(m => `
                            <div class="field-material-entry">
                                <div class="field-material-info">
                                    <span class="field-material-name">${this._escape(m.name)}</span>
                                    ${m.note ? `<span class="field-material-note">${this._escape(m.note)}</span>` : ''}
                                </div>
                                <span class="field-material-qty">${m.quantity} ${this._escape(m.unit)}</span>
                                <button class="field-material-delete" data-action="deleteMaterial" data-material-id="${m.id}">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ============================================
    // Screen: Signature
    // ============================================

    _renderSignatureScreen() {
        const currentJobId = this.currentJobId || '';
        const service = window.fieldAppService;
        const jobs = service?.getTodaysJobs() || [];

        return `
            <div class="field-header field-header--compact">
                <button class="field-back-btn" data-action="goBack">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                    Zurück
                </button>
                <h2 class="field-title">Unterschrift</h2>
            </div>
            <div class="field-content">
                <div class="field-form">
                    <div class="field-form-group">
                        <label class="field-label">Auftrag</label>
                        <select id="field-sig-job" class="field-select">
                            <option value="">Auftrag wählen...</option>
                            ${jobs.map(j => `<option value="${j.id}" ${j.id === currentJobId ? 'selected' : ''}>${this._escape(j.title)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="field-form-group">
                        <label class="field-label">Name des Kunden</label>
                        <input type="text" id="field-sig-name" class="field-input" placeholder="Name eingeben">
                    </div>
                </div>
                <div class="field-signature-area">
                    <p class="field-signature-label">Bitte hier unterschreiben:</p>
                    <canvas id="field-signature-canvas" class="field-signature-canvas"></canvas>
                    <div class="field-signature-actions">
                        <button class="field-btn field-btn--secondary" data-action="clearSignature">Löschen</button>
                        <button class="field-btn field-btn--primary" data-action="saveSignature">Speichern</button>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // Screen: Voice
    // ============================================

    _renderVoiceScreen() {
        const service = window.fieldAppService;
        const jobs = service?.getTodaysJobs() || [];
        const currentJobId = this.currentJobId || '';
        const isRecording = service?.isRecording || false;
        const voiceNotes = currentJobId ? (service?.getVoiceNotes(currentJobId) || []) : (service?.getVoiceNotes() || []);

        return `
            <div class="field-header field-header--compact">
                <button class="field-back-btn" data-action="goBack">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                    Zurück
                </button>
                <h2 class="field-title">Sprachnotiz</h2>
            </div>
            <div class="field-content field-content--scroll">
                <div class="field-form">
                    <div class="field-form-group">
                        <label class="field-label">Auftrag</label>
                        <select id="field-voice-job" class="field-select">
                            <option value="">Auftrag wählen...</option>
                            ${jobs.map(j => `<option value="${j.id}" ${j.id === currentJobId ? 'selected' : ''}>${this._escape(j.title)}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- Voice Recording -->
                <div class="field-voice-recorder">
                    <button class="field-voice-btn ${isRecording ? 'field-voice-btn--recording' : ''}" data-action="toggleVoice">
                        <div class="field-voice-btn-inner">
                            ${isRecording ? `
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                            ` : `
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                            `}
                        </div>
                    </button>
                    <p class="field-voice-status">${isRecording ? 'Aufnahme läuft... Tippen zum Stoppen' : 'Tippen zum Aufnehmen'}</p>
                    <div class="field-voice-text-area" id="field-voice-text">
                        ${service?.currentVoiceText ? this._escape(service.currentVoiceText) : '<span class="field-voice-placeholder">Sprachtext erscheint hier...</span>'}
                    </div>
                    ${!isRecording && service?.currentVoiceText ? `
                        <button class="field-submit-btn" data-action="saveVoiceNote">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                            Notiz speichern
                        </button>
                    ` : ''}
                </div>

                <!-- Existing voice notes -->
                ${voiceNotes.length > 0 ? `
                    <div class="field-section">
                        <h3 class="field-section-title">Gespeicherte Notizen</h3>
                        ${voiceNotes.map(n => `
                            <div class="field-voice-entry">
                                <p class="field-voice-text">${this._escape(n.text)}</p>
                                <span class="field-voice-time">${new Date(n.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ============================================
    // Bottom Navigation
    // ============================================

    _renderBottomNav() {
        const tabs = [
            { id: 'jobs', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', label: 'Aufträge' },
            { id: 'timer', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', label: 'Timer' },
            { id: 'camera', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>', label: 'Foto' },
            { id: 'more', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>', label: 'Mehr' }
        ];

        return `
            <nav class="field-bottom-nav">
                ${tabs.map(tab => `
                    <button class="field-nav-tab ${this._isTabActive(tab.id) ? 'field-nav-tab--active' : ''}" data-action="switchTab" data-tab="${tab.id}">
                        ${tab.icon}
                        <span>${tab.label}</span>
                    </button>
                `).join('')}
            </nav>
        `;
    }

    _isTabActive(tabId) {
        if (this.currentScreen === tabId) { return true; }
        // Sub-screens map to parent tabs
        if (['jobDetail', 'signature'].includes(this.currentScreen) && tabId === 'jobs') { return true; }
        if (['material', 'voice'].includes(this.currentScreen) && tabId === 'more') { return true; }
        return false;
    }

    // ============================================
    // Event Binding
    // ============================================

    _bindScreenEvents() {
        if (!this.overlay) { return; }

        // Delegate all clicks
        this.overlay.addEventListener('click', (e) => {
            const actionEl = e.target.closest('[data-action]');
            if (!actionEl) { return; }

            const action = actionEl.dataset.action;
            this._handleAction(action, actionEl);
        });

        // Initialize signature pad if on that screen
        if (this.currentScreen === 'signature') {
            setTimeout(() => this._initSignaturePad(), 50);
        }
    }

    _handleAction(action, el) {
        const service = window.fieldAppService;

        switch (action) {
            // Navigation
            case 'switchTab':
                this.currentScreen = el.dataset.tab;
                this.render();
                break;

            case 'goJobs':
                this.currentScreen = 'jobs';
                this.currentJobId = null;
                this.render();
                break;

            case 'goTimer':
                this.currentScreen = 'timer';
                this.render();
                break;

            case 'goBack':
                if (this.currentJobId && ['material', 'voice', 'signature'].includes(this.currentScreen)) {
                    this.currentScreen = 'jobDetail';
                } else {
                    this.currentScreen = 'jobs';
                    this.currentJobId = null;
                }
                this.render();
                break;

            case 'goMaterial':
                this.currentScreen = 'material';
                this.render();
                break;

            case 'goSignature':
                this.currentScreen = 'signature';
                this.render();
                break;

            case 'goVoice':
                this.currentScreen = 'voice';
                this.render();
                break;

            // Job actions
            case 'openJob':
                this.currentJobId = el.dataset.jobId;
                this.currentScreen = 'jobDetail';
                this.render();
                break;

            case 'setStatus': {
                const status = el.dataset.status;
                if (this.currentJobId && service) {
                    service.updateJobStatus(this.currentJobId, status);
                    window.errorHandler?.success(`Status aktualisiert: ${status}`);
                    this.render();
                }
                break;
            }

            // Clock in/out
            case 'clockIn':
                if (this.currentJobId && service) {
                    const job = service.getJobById(this.currentJobId);
                    service.clockIn(this.currentJobId, job?.title);
                    window.errorHandler?.success('Eingestempelt');
                    this.render();
                }
                break;

            case 'clockOut':
                if (service) {
                    service.clockOut();
                    window.errorHandler?.success('Ausgestempelt');
                    this.render();
                }
                break;

            case 'clockInSelected': {
                const select = document.getElementById('field-timer-job-select');
                if (select && select.value && service) {
                    const job = service.getJobById(select.value);
                    service.clockIn(select.value, job?.title);
                    window.errorHandler?.success('Eingestempelt');
                    this.render();
                } else {
                    window.errorHandler?.warning('Bitte zuerst einen Auftrag wählen');
                }
                break;
            }

            // Photo
            case 'takePhoto': {
                if (this.currentJobId && service) {
                    service.capturePhoto(this.currentJobId).then(() => this.render());
                }
                break;
            }

            case 'capturePhoto': {
                const jobSelect = document.getElementById('field-camera-job-select');
                const jobId = jobSelect?.value || this.currentJobId;
                if (jobId && service) {
                    service.capturePhoto(jobId).then(() => this.render());
                } else {
                    window.errorHandler?.warning('Bitte zuerst einen Auftrag wählen');
                }
                break;
            }

            case 'deletePhoto': {
                const photoId = el.dataset.photoId;
                if (photoId && service) {
                    service.deletePhoto(photoId);
                    this.render();
                }
                break;
            }

            // Material
            case 'saveMaterial': {
                const jobSelect = document.getElementById('field-material-job');
                const nameInput = document.getElementById('field-material-name');
                const qtyInput = document.getElementById('field-material-qty');
                const unitSelect = document.getElementById('field-material-unit');
                const noteInput = document.getElementById('field-material-note');

                const jobId = jobSelect?.value || this.currentJobId;
                const name = nameInput?.value?.trim();

                if (!jobId) {
                    window.errorHandler?.warning('Bitte einen Auftrag wählen');
                    break;
                }
                if (!name) {
                    window.errorHandler?.warning('Bitte Materialbezeichnung eingeben');
                    break;
                }

                if (service) {
                    service.logMaterial(jobId, {
                        name: name,
                        quantity: parseFloat(qtyInput?.value) || 1,
                        unit: unitSelect?.value || 'Stk.',
                        note: noteInput?.value?.trim() || ''
                    });
                    window.errorHandler?.success('Material erfasst');

                    // Clear inputs
                    if (nameInput) { nameInput.value = ''; }
                    if (qtyInput) { qtyInput.value = '1'; }
                    if (noteInput) { noteInput.value = ''; }

                    this.render();
                }
                break;
            }

            case 'deleteMaterial': {
                const materialId = el.dataset.materialId;
                if (materialId && service) {
                    service.removeMaterial(materialId);
                    this.render();
                }
                break;
            }

            // Signature
            case 'clearSignature':
                if (this.signaturePad) {
                    this.signaturePad.clear();
                }
                break;

            case 'saveSignature': {
                const sigJobSelect = document.getElementById('field-sig-job');
                const sigNameInput = document.getElementById('field-sig-name');
                const jobId = sigJobSelect?.value || this.currentJobId;

                if (!jobId) {
                    window.errorHandler?.warning('Bitte einen Auftrag wählen');
                    break;
                }

                if (this.signaturePad && service) {
                    const dataUrl = this.signaturePad.toDataURL();
                    service.saveSignature(jobId, dataUrl, sigNameInput?.value?.trim() || '');
                    window.errorHandler?.success('Unterschrift gespeichert');

                    // Go back to job detail
                    if (this.currentJobId) {
                        this.currentScreen = 'jobDetail';
                    } else {
                        this.currentScreen = 'jobs';
                    }
                    this.render();
                }
                break;
            }

            // Voice
            case 'toggleVoice': {
                if (service?.isRecording) {
                    service.stopVoiceNote();
                } else {
                    service?.startVoiceNote();
                }
                this.render();
                break;
            }

            case 'saveVoiceNote': {
                const voiceJobSelect = document.getElementById('field-voice-job');
                const jobId = voiceJobSelect?.value || this.currentJobId;

                if (!jobId) {
                    window.errorHandler?.warning('Bitte einen Auftrag wählen');
                    break;
                }

                if (service?.currentVoiceText && service) {
                    service.saveVoiceNote(jobId, service.currentVoiceText);
                    service.currentVoiceText = '';
                    window.errorHandler?.success('Notiz gespeichert');
                    this.render();
                }
                break;
            }

            // GPS
            case 'gpsCheckin':
            case 'gpsCheckinGeneral': {
                const jobId = this.currentJobId || '';
                if (service) {
                    service.checkIn(jobId).then(result => {
                        if (result.success) {
                            window.errorHandler?.success('GPS Check-in erfolgreich');
                        } else {
                            window.errorHandler?.warning(result.error || 'GPS Check-in fehlgeschlagen');
                        }
                    });
                }
                break;
            }

            // Sync
            case 'syncQueue': {
                if (service) {
                    service.syncOfflineQueue().then(result => {
                        window.errorHandler?.success(`${result.synced} Aktionen synchronisiert`);
                        this.render();
                    });
                }
                break;
            }

            // Exit
            case 'exitFieldMode':
                this.hide();
                break;
        }
    }

    // ============================================
    // Signature Pad Init
    // ============================================

    _initSignaturePad() {
        this._cleanupSignaturePad();

        const canvas = document.getElementById('field-signature-canvas');
        if (canvas && window.fieldAppService) {
            this.signaturePad = window.fieldAppService.createSignaturePad(canvas);
        }
    }

    _cleanupSignaturePad() {
        if (this.signaturePad) {
            this.signaturePad.destroy();
            this.signaturePad = null;
        }
    }

    // ============================================
    // Timer Update Interval
    // ============================================

    _startTimerInterval() {
        this._stopTimerInterval();

        this.timerInterval = setInterval(() => {
            const service = window.fieldAppService;
            const timer = service?.getCurrentTimer();
            if (!timer) { return; }

            // Update all timer displays on the current screen
            const timerEls = this.overlay?.querySelectorAll('.field-timer-display, #field-banner-timer');
            if (timerEls) {
                timerEls.forEach(el => {
                    el.textContent = timer.elapsedFormatted;
                });
            }
        }, 1000);
    }

    _stopTimerInterval() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // ============================================
    // Service Event Bindings
    // ============================================

    _bindServiceEvents() {
        // Voice interim results
        window.addEventListener('fieldApp:voiceInterim', (e) => {
            const textArea = document.getElementById('field-voice-text');
            if (textArea) {
                const finalText = e.detail.final || '';
                const interimText = e.detail.interim || '';
                textArea.innerHTML = this._escape(finalText) +
                    (interimText ? `<span class="field-voice-interim">${this._escape(interimText)}</span>` : '');
            }
        });

        // Listen for online/offline changes
        window.addEventListener('online', () => this._updateConnectionStatus());
        window.addEventListener('offline', () => this._updateConnectionStatus());
    }

    _updateConnectionStatus() {
        if (this.currentScreen === 'more') {
            this.render();
        }
    }

    // ============================================
    // Helpers
    // ============================================

    _escape(str) {
        if (!str) { return ''; }
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    _getStatusInfo(status) {
        const statusMap = {
            'offen': { label: 'Offen', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
            'geplant': { label: 'Geplant', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
            'bestaetigt': { label: 'Bestätigt', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
            'in_arbeit': { label: 'In Arbeit', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
            'in_bearbeitung': { label: 'In Bearbeitung', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
            'fertig': { label: 'Fertig', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' },
            'abgeschlossen': { label: 'Abgeschlossen', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' },
            'pausiert': { label: 'Pausiert', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
            'storniert': { label: 'Storniert', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
            'abgesagt': { label: 'Abgesagt', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }
        };

        return statusMap[status] || { label: status || 'Unbekannt', color: '#a1a1aa', bg: 'rgba(161, 161, 170, 0.15)' };
    }
}

// Register on window
window.fieldAppUI = new FieldAppUI();
