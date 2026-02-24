/* ============================================
   Field App Mobile UI - Optimierte Mobile Oberfläche
   Full-screen overlay for on-site field work
   Touch-optimized, offline-first, German UI
   ============================================ */

class FieldAppMobileUI {
    constructor() {
        this.overlay = null;
        this.currentScreen = 'jobs'; // jobs, active, photos, notes, more
        this.currentJobId = null;
        this.previousScreen = null;
        this.timerInterval = null;
        this.signaturePad = null;
        this.quickOverlay = null; // for photo/note/signature sub-overlays
        this.descriptionExpanded = false;

        // Swipe state
        this.swipeStartX = 0;
        this.swipeStartY = 0;
        this.swipeThreshold = 80;
        this.isSwiping = false;

        // Material search state
        this.materialSearchQuery = '';

        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    // ============================================
    // Initialization
    // ============================================

    init() {
        try {
            this._createOverlay();
            this._bindGlobalEvents();

            // If field mode was active before page reload, restore
            if (window.fieldAppService?.isFieldMode) {
                this.show();
            }
        } catch (error) {
            console.error('FieldAppMobileUI init Fehler:', error);
        }
    }

    _createOverlay() {
        if (document.getElementById('field-mobile-overlay')) { return; }

        this.overlay = document.createElement('div');
        this.overlay.id = 'field-mobile-overlay';
        this.overlay.className = 'field-mobile-overlay field-mobile-overlay--hidden';
        document.body.appendChild(this.overlay);
    }

    // ============================================
    // Show / Hide
    // ============================================

    show() {
        try {
            if (!this.overlay) { this._createOverlay(); }
            this.overlay.classList.remove('field-mobile-overlay--hidden');
            document.body.style.overflow = 'hidden';

            this.currentScreen = 'jobs';
            this.render();
            this._startTimerInterval();
            this.initSwipeGestures();
        } catch (error) {
            console.error('FieldAppMobileUI show Fehler:', error);
        }
    }

    hide() {
        try {
            if (this.overlay) {
                this.overlay.classList.add('field-mobile-overlay--hidden');
            }
            document.body.style.overflow = '';

            this._stopTimerInterval();
            this._cleanupSignaturePad();
            this._removeQuickOverlay();
            window.fieldAppService?.stopCamera();
        } catch (error) {
            console.error('FieldAppMobileUI hide Fehler:', error);
        }
    }

    // ============================================
    // Field Mode Rendering
    // ============================================

    renderFieldMode(containerId) {
        try {
            const container = containerId ? document.getElementById(containerId) : this.overlay;
            if (!container) { return; }

            this.overlay = container;
            this.show();
        } catch (error) {
            console.error('FieldAppMobileUI renderFieldMode Fehler:', error);
        }
    }

    // ============================================
    // Main Render
    // ============================================

    render() {
        if (!this.overlay) { return; }

        try {
            let content = '';

            switch (this.currentScreen) {
                case 'jobs':
                    content = this._renderJobsScreen();
                    break;
                case 'active':
                    content = this._renderActiveJobScreen();
                    break;
                case 'photos':
                    content = this._renderPhotosScreen();
                    break;
                case 'notes':
                    content = this._renderNotesScreen();
                    break;
                case 'more':
                    content = this._renderMoreScreen();
                    break;
                case 'material':
                    content = this._renderMaterialScreen();
                    break;
                default:
                    content = this._renderJobsScreen();
            }

            this.overlay.innerHTML = `
                <div class="field-mobile-screen">
                    ${this._renderOfflineStatus()}
                    ${content}
                </div>
                ${this.renderBottomNav()}
            `;

            this._bindScreenEvents();
        } catch (error) {
            console.error('FieldAppMobileUI render Fehler:', error);
        }
    }

    // ============================================
    // Screen: Job List
    // ============================================

    renderJobList(jobs) {
        if (!jobs || jobs.length === 0) {
            return `
                <div class="field-mobile-empty">
                    <div class="field-mobile-empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                    </div>
                    <p class="field-mobile-empty-text">Keine Aufträge für heute</p>
                    <p class="field-mobile-empty-subtext">Aufträge im Hauptmenü anlegen</p>
                </div>
            `;
        }

        return jobs.map(job => {
            const isActive = window.fieldAppService?.activeTimer?.jobId === job.id;
            const statusInfo = this._getStatusInfo(job.status);
            const statusClass = (job.status || 'offen').replace(/\s+/g, '_');

            return `
                <div class="field-mobile-job-card ${isActive ? 'field-mobile-job-card--active' : ''}"
                     data-action="openJob" data-job-id="${job.id}">
                    <div class="field-mobile-job-card-status-bar field-mobile-job-card-status-bar--${statusClass}"></div>
                    <div class="field-mobile-job-card-body">
                        <div class="field-mobile-job-card-top">
                            <span class="field-mobile-job-card-time">${job.time || '--:--'}</span>
                            <span class="field-mobile-job-card-badge" style="background: ${statusInfo.bg}; color: ${statusInfo.color}">
                                ${statusInfo.label}
                            </span>
                        </div>
                        <h3 class="field-mobile-job-card-title">${this._escape(job.title)}</h3>
                        <p class="field-mobile-job-card-customer">${this._escape(job.customer)}</p>
                        ${job.address ? `<p class="field-mobile-job-card-address">${this._escape(job.address)}</p>` : ''}
                    </div>
                    <div class="field-mobile-job-card-chevron">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </div>
                </div>
            `;
        }).join('');
    }

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
                <div class="field-mobile-timer-banner" data-action="goActiveJob" data-job-id="${timer.jobId}">
                    <div class="field-mobile-timer-banner-info">
                        <span class="field-mobile-timer-banner-label">Aktiv</span>
                        <span class="field-mobile-timer-banner-job">${this._escape(timer.jobTitle)}</span>
                    </div>
                    <span class="field-mobile-timer-banner-time" id="field-mobile-banner-timer">${timer.elapsedFormatted}</span>
                </div>
            `;
        }

        return `
            <div class="field-mobile-header">
                <div class="field-mobile-header-row">
                    <div>
                        <h1 class="field-mobile-header-title">Heutige Aufträge</h1>
                        <p class="field-mobile-header-subtitle">${dateStr}</p>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 24px; font-weight: 700; color: var(--accent-primary, #6366f1); font-variant-numeric: tabular-nums;">
                            ${(stats.totalHours || 0).toFixed(1)}h
                        </span>
                    </div>
                </div>
            </div>
            ${timerBanner}
            <div class="field-mobile-content">
                ${this.renderJobList(jobs)}
            </div>
        `;
    }

    // ============================================
    // Screen: Active Job View
    // ============================================

    renderActiveJob(job) {
        if (!job) {
            return `
                <div class="field-mobile-empty">
                    <p class="field-mobile-empty-text">Kein aktiver Auftrag</p>
                    <p class="field-mobile-empty-subtext">Wählen Sie einen Auftrag aus der Liste</p>
                </div>
            `;
        }

        const service = window.fieldAppService;
        const timer = service?.getCurrentTimer();
        const isTimerRunning = timer && timer.jobId === job.id;
        const photos = service?.getPhotos(job.id) || [];
        const materials = service?.getMaterialLog(job.id) || [];
        const voiceNotes = service?.getVoiceNotes(job.id) || [];
        const gpsCheckins = service?.getCheckins(job.id) || [];
        const lastCheckin = gpsCheckins.length > 0 ? gpsCheckins[gpsCheckins.length - 1] : null;

        // GPS banner
        let gpsBanner = '';
        if (lastCheckin) {
            const checkinTime = new Date(lastCheckin.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            gpsBanner = `
                <div class="field-mobile-gps-banner" data-action="gpsCheckin">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span class="field-mobile-gps-banner-text">GPS eingecheckt</span>
                    <span class="field-mobile-gps-banner-time">${checkinTime}</span>
                </div>
            `;
        } else {
            gpsBanner = `
                <div class="field-mobile-gps-banner field-mobile-gps-banner--pending" data-action="gpsCheckin">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span class="field-mobile-gps-banner-text">GPS Check-in ausstehend</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </div>
            `;
        }

        // Customer info
        const customerPhone = job.originalData?.telefon || job.originalData?.phone || '';
        let customerSection = '';
        if (job.customer || customerPhone) {
            customerSection = `
                <div class="field-mobile-customer-info">
                    ${job.customer ? `<span class="field-mobile-customer-name">${this._escape(job.customer)}</span>` : ''}
                    ${customerPhone ? `
                        <a href="tel:${this._escape(customerPhone)}" class="field-mobile-customer-phone">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            ${this._escape(customerPhone)}
                        </a>
                    ` : ''}
                    ${job.address ? `<span class="field-mobile-customer-address">${this._escape(job.address)}</span>` : ''}
                </div>
            `;
        }

        // Job description (expandable)
        let descriptionSection = '';
        if (job.description) {
            descriptionSection = `
                <div class="field-mobile-description">
                    <button class="field-mobile-description-toggle ${this.descriptionExpanded ? 'field-mobile-description-toggle--open' : ''}" data-action="toggleDescription">
                        <span>Beschreibung</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                    <div class="field-mobile-description-body ${this.descriptionExpanded ? 'field-mobile-description-body--open' : ''}">
                        ${this._escape(job.description)}
                    </div>
                </div>
            `;
        }

        // Photos section
        let photosSection = '';
        if (photos.length > 0) {
            photosSection = `
                <div class="field-mobile-section">
                    <h4 class="field-mobile-section-title">Fotos (${photos.length})</h4>
                    <div class="field-mobile-photo-grid">
                        ${photos.slice(0, 6).map(p => `
                            <div class="field-mobile-photo-thumb">
                                <img src="${p.dataUrl}" alt="Foto" loading="lazy">
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Notes section
        let notesSection = '';
        if (voiceNotes.length > 0) {
            notesSection = `
                <div class="field-mobile-section">
                    <h4 class="field-mobile-section-title">Notizen (${voiceNotes.length})</h4>
                    ${voiceNotes.slice(0, 3).map(n => `
                        <div class="field-mobile-note-item">
                            <p class="field-mobile-note-item-text">${this._escape(n.text)}</p>
                            <span class="field-mobile-note-item-time">${new Date(n.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        return `
            ${gpsBanner}
            <!-- Timer Display -->
            <div class="field-mobile-timer">
                <div class="field-mobile-timer-display" id="field-mobile-active-timer">
                    ${isTimerRunning ? timer.elapsedFormatted : '00:00:00'}
                </div>
                <p class="field-mobile-timer-label">${this._escape(job.title)}</p>
            </div>

            <!-- Clock In/Out Button -->
            <div style="padding: 0 16px;">
                ${isTimerRunning ? `
                    <button class="field-mobile-clock-btn field-mobile-clock-btn--out" data-action="clockOut">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <rect x="6" y="6" width="12" height="12" rx="1"/>
                        </svg>
                        Ausstempeln
                    </button>
                ` : `
                    <button class="field-mobile-clock-btn field-mobile-clock-btn--in" data-action="clockIn">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        Einstempeln
                    </button>
                `}
            </div>

            <!-- Quick Action Buttons Row -->
            <div class="field-mobile-actions-row">
                <div class="field-mobile-action-wrap">
                    <button class="field-mobile-action-btn field-mobile-action-btn--photo" data-action="quickPhoto">
                        ${photos.length > 0 ? `<span class="field-mobile-action-btn-badge">${photos.length}</span>` : ''}
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                        </svg>
                    </button>
                    <span class="field-mobile-action-btn-label">Foto</span>
                </div>
                <div class="field-mobile-action-wrap">
                    <button class="field-mobile-action-btn field-mobile-action-btn--note" data-action="quickNote">
                        ${voiceNotes.length > 0 ? `<span class="field-mobile-action-btn-badge">${voiceNotes.length}</span>` : ''}
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <span class="field-mobile-action-btn-label">Notiz</span>
                </div>
                <div class="field-mobile-action-wrap">
                    <button class="field-mobile-action-btn field-mobile-action-btn--material" data-action="goMaterial">
                        ${materials.length > 0 ? `<span class="field-mobile-action-btn-badge">${materials.length}</span>` : ''}
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        </svg>
                    </button>
                    <span class="field-mobile-action-btn-label">Material</span>
                </div>
                <div class="field-mobile-action-wrap">
                    <button class="field-mobile-action-btn field-mobile-action-btn--signature" data-action="renderSignature">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                        </svg>
                    </button>
                    <span class="field-mobile-action-btn-label">Unterschrift</span>
                </div>
            </div>

            <!-- Scrollable content below actions -->
            <div class="field-mobile-content">
                ${customerSection}
                ${descriptionSection}
                ${photosSection}
                ${notesSection}
            </div>
        `;
    }

    _renderActiveJobScreen() {
        const service = window.fieldAppService;
        const job = this.currentJobId ? service?.getJobById(this.currentJobId) : null;
        const timer = service?.getCurrentTimer();

        // If no job is selected but timer is running, show the timer's job
        if (!job && timer) {
            this.currentJobId = timer.jobId;
            const timerJob = service?.getJobById(timer.jobId);
            if (timerJob) {
                return `
                    <div class="field-mobile-header">
                        <button class="field-mobile-back-btn" data-action="goJobs">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"/>
                            </svg>
                            Aufträge
                        </button>
                    </div>
                    ${this.renderActiveJob(timerJob)}
                `;
            }
        }

        // If no job selected, prompt selection
        if (!job) {
            const jobs = service?.getTodaysJobs() || [];
            return `
                <div class="field-mobile-header">
                    <h1 class="field-mobile-header-title">Aktiver Auftrag</h1>
                    <p class="field-mobile-header-subtitle">Auftrag auswählen</p>
                </div>
                <div class="field-mobile-content">
                    ${jobs.length > 0 ? this.renderJobList(jobs) : `
                        <div class="field-mobile-empty">
                            <p class="field-mobile-empty-text">Kein aktiver Auftrag</p>
                            <p class="field-mobile-empty-subtext">Wählen Sie einen Auftrag aus der Liste</p>
                        </div>
                    `}
                </div>
            `;
        }

        return `
            <div class="field-mobile-header" style="padding-bottom: 0; border-bottom: none;">
                <button class="field-mobile-back-btn" data-action="goJobs">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Aufträge
                </button>
            </div>
            ${this.renderActiveJob(job)}
        `;
    }

    // ============================================
    // Screen: Photos
    // ============================================

    _renderPhotosScreen() {
        const service = window.fieldAppService;
        const allPhotos = service?.getPhotos() || [];
        const today = new Date().toISOString().split('T')[0];
        const todayPhotos = allPhotos.filter(p => p.date === today);

        return `
            <div class="field-mobile-header">
                <div class="field-mobile-header-row">
                    <div>
                        <h1 class="field-mobile-header-title">Fotos</h1>
                        <p class="field-mobile-header-subtitle">${todayPhotos.length} Fotos heute</p>
                    </div>
                    <button class="field-mobile-action-btn field-mobile-action-btn--photo" data-action="quickPhotoGeneral" style="width: 48px; height: 48px;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="field-mobile-content">
                ${todayPhotos.length > 0 ? `
                    <div class="field-mobile-photo-grid" style="grid-template-columns: repeat(3, 1fr); gap: 8px;">
                        ${todayPhotos.map(p => `
                            <div class="field-mobile-photo-thumb" style="position: relative;">
                                <img src="${p.dataUrl}" alt="Foto" loading="lazy">
                                <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 4px 6px; background: linear-gradient(transparent, rgba(0,0,0,0.7)); border-radius: 0 0 10px 10px;">
                                    <span style="font-size: 11px; color: rgba(255,255,255,0.8);">${new Date(p.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="field-mobile-empty">
                        <div class="field-mobile-empty-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                <circle cx="12" cy="13" r="4"/>
                            </svg>
                        </div>
                        <p class="field-mobile-empty-text">Noch keine Fotos heute</p>
                        <p class="field-mobile-empty-subtext">Tippen Sie auf + um ein Foto aufzunehmen</p>
                    </div>
                `}
            </div>
        `;
    }

    // ============================================
    // Screen: Notes
    // ============================================

    _renderNotesScreen() {
        const service = window.fieldAppService;
        const today = new Date().toISOString().split('T')[0];
        const allNotes = service?.getVoiceNotes() || [];
        const todayNotes = allNotes.filter(n => n.date === today);

        return `
            <div class="field-mobile-header">
                <div class="field-mobile-header-row">
                    <div>
                        <h1 class="field-mobile-header-title">Notizen</h1>
                        <p class="field-mobile-header-subtitle">${todayNotes.length} Notizen heute</p>
                    </div>
                    <button class="field-mobile-action-btn field-mobile-action-btn--note" data-action="quickNoteGeneral" style="width: 48px; height: 48px;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="field-mobile-content">
                ${todayNotes.length > 0 ? todayNotes.map(n => {
                    const jobTitle = this._getJobTitleForNote(n.jobId);
                    return `
                        <div class="field-mobile-note-item">
                            ${jobTitle ? `<span style="font-size: 12px; font-weight: 600; color: var(--accent-primary, #6366f1); text-transform: uppercase; letter-spacing: 0.3px;">${this._escape(jobTitle)}</span>` : ''}
                            <p class="field-mobile-note-item-text">${this._escape(n.text)}</p>
                            <span class="field-mobile-note-item-time">${new Date(n.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    `;
                }).join('') : `
                    <div class="field-mobile-empty">
                        <div class="field-mobile-empty-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </div>
                        <p class="field-mobile-empty-text">Noch keine Notizen heute</p>
                        <p class="field-mobile-empty-subtext">Tippen Sie auf + um eine Notiz zu erstellen</p>
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
        const syncStatus = service?.getSyncStatus() || { pendingCount: 0, lastSyncTime: null, isOnline: navigator.onLine };

        return `
            <div class="field-mobile-header">
                <h1 class="field-mobile-header-title">Weitere Optionen</h1>
            </div>
            <div class="field-mobile-content">
                <!-- Today's Summary -->
                <div class="field-mobile-section">
                    <h4 class="field-mobile-section-title">Heute</h4>
                    <div class="field-mobile-stats-grid">
                        <div class="field-mobile-stat-card">
                            <span class="field-mobile-stat-value">${(stats.totalHours || 0).toFixed(1)}</span>
                            <span class="field-mobile-stat-label">Stunden</span>
                        </div>
                        <div class="field-mobile-stat-card">
                            <span class="field-mobile-stat-value">${stats.photos || 0}</span>
                            <span class="field-mobile-stat-label">Fotos</span>
                        </div>
                        <div class="field-mobile-stat-card">
                            <span class="field-mobile-stat-value">${stats.materials || 0}</span>
                            <span class="field-mobile-stat-label">Material</span>
                        </div>
                        <div class="field-mobile-stat-card">
                            <span class="field-mobile-stat-value">${stats.voiceNotes || 0}</span>
                            <span class="field-mobile-stat-label">Notizen</span>
                        </div>
                    </div>
                </div>

                <!-- Sync Status -->
                <div class="field-mobile-section">
                    <h4 class="field-mobile-section-title">Synchronisation</h4>
                    <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: ${syncStatus.isOnline ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)'}; border-radius: 12px; margin-bottom: 12px;">
                        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${syncStatus.isOnline ? 'var(--accent-success, #22c55e)' : 'var(--accent-warning, #f59e0b)'}; box-shadow: 0 0 6px ${syncStatus.isOnline ? 'rgba(34,197,94,0.5)' : 'rgba(245,158,11,0.5)'};"></div>
                        <span style="font-size: 15px; font-weight: 500; color: ${syncStatus.isOnline ? 'var(--accent-success, #22c55e)' : 'var(--accent-warning, #f59e0b)'};">
                            ${syncStatus.isOnline ? 'Online' : 'Offline'}
                        </span>
                        ${syncStatus.pendingCount > 0 ? `
                            <span style="margin-left: auto; padding: 2px 10px; background: rgba(245,158,11,0.2); border-radius: 10px; font-size: 13px; font-weight: 600; color: var(--accent-warning, #f59e0b);">
                                ${syncStatus.pendingCount} ausstehend
                            </span>
                        ` : ''}
                    </div>
                    ${syncStatus.lastSyncTime ? `
                        <p style="font-size: 13px; color: var(--text-muted, #71717a); margin: 0 0 12px; padding-left: 4px;">
                            Letzte Sync: ${new Date(syncStatus.lastSyncTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    ` : ''}
                    ${syncStatus.pendingCount > 0 ? `
                        <button class="field-mobile-more-item" data-action="syncQueue" style="color: var(--accent-warning, #f59e0b);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="23 4 23 10 17 10"/>
                                <polyline points="1 20 1 14 7 14"/>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                            </svg>
                            <span class="field-mobile-more-item-label">Jetzt synchronisieren</span>
                        </button>
                    ` : ''}
                </div>

                <!-- Quick Actions -->
                <div class="field-mobile-section">
                    <h4 class="field-mobile-section-title">Aktionen</h4>

                    <button class="field-mobile-more-item" data-action="goMaterial">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        </svg>
                        <span class="field-mobile-more-item-label">Material erfassen</span>
                        <span class="field-mobile-more-item-chevron">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </span>
                    </button>

                    <button class="field-mobile-more-item" data-action="gpsCheckinGeneral">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span class="field-mobile-more-item-label">GPS Check-in</span>
                        <span class="field-mobile-more-item-chevron">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </span>
                    </button>

                    <button class="field-mobile-more-item" data-action="renderSignature">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                        </svg>
                        <span class="field-mobile-more-item-label">Unterschrift erfassen</span>
                        <span class="field-mobile-more-item-chevron">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </span>
                    </button>
                </div>

                <!-- Exit -->
                <div class="field-mobile-section">
                    <button class="field-mobile-exit-btn" data-action="exitFieldMode">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Feld-Modus beenden
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================
    // Screen: Material Log
    // ============================================

    renderMaterialLog() {
        return this._renderMaterialScreen();
    }

    _renderMaterialScreen() {
        const service = window.fieldAppService;
        const jobId = this.currentJobId || service?.currentJobId || '';
        const materials = jobId ? (service?.getMaterialLog(jobId) || []) : (service?.getMaterialLog() || []);
        const jobs = service?.getTodaysJobs() || [];

        // Filter materials by search
        const filteredMaterials = this.materialSearchQuery
            ? materials.filter(m => m.name.toLowerCase().includes(this.materialSearchQuery.toLowerCase()))
            : materials;

        const commonUnits = ['Stk.', 'm', 'm\u00B2', 'kg', 'Liter', 'Packung', 'Satz'];

        return `
            <div class="field-mobile-header" style="padding-bottom: 0; border-bottom: none;">
                <button class="field-mobile-back-btn" data-action="goBack">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    Zurück
                </button>
                <h2 class="field-mobile-header-title" style="margin-top: 4px;">Material erfassen</h2>
            </div>
            <div class="field-mobile-content">
                <!-- Add Material Form -->
                <div class="field-mobile-form-group">
                    <label class="field-mobile-form-label">Auftrag</label>
                    <select id="field-mobile-mat-job" class="field-mobile-form-select">
                        <option value="">Auftrag wählen...</option>
                        ${jobs.map(j => `<option value="${j.id}" ${j.id === jobId ? 'selected' : ''}>${this._escape(j.title)}</option>`).join('')}
                    </select>
                </div>

                <div class="field-mobile-form-group">
                    <label class="field-mobile-form-label">Material</label>
                    <input type="text" id="field-mobile-mat-name" class="field-mobile-form-input" placeholder="z.B. Rohr DN 50" autocomplete="off">
                </div>

                <div class="field-mobile-form-row">
                    <div class="field-mobile-form-group">
                        <label class="field-mobile-form-label">Menge</label>
                        <input type="number" id="field-mobile-mat-qty" class="field-mobile-form-input" value="1" min="0.1" step="0.1" inputmode="decimal">
                    </div>
                    <div class="field-mobile-form-group">
                        <label class="field-mobile-form-label">Einheit</label>
                        <select id="field-mobile-mat-unit" class="field-mobile-form-select">
                            ${commonUnits.map(u => `<option value="${u}">${u}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <button class="field-mobile-submit-btn" data-action="saveMaterial">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Material hinzufügen
                </button>

                <!-- Existing Materials -->
                ${filteredMaterials.length > 0 ? `
                    <div class="field-mobile-section">
                        <h4 class="field-mobile-section-title">Erfasst (${filteredMaterials.length})</h4>
                        ${filteredMaterials.map(m => `
                            <div class="field-mobile-material-item">
                                <div class="field-mobile-material-item-info">
                                    <span class="field-mobile-material-item-name">${this._escape(m.name)}</span>
                                    ${m.note ? `<span class="field-mobile-material-item-note">${this._escape(m.note)}</span>` : ''}
                                </div>
                                <div class="field-mobile-material-qty-controls">
                                    <button class="field-mobile-material-qty-btn" data-action="decrementMaterial" data-material-id="${m.id}">-</button>
                                    <div style="text-align: center;">
                                        <span class="field-mobile-material-qty-value">${m.quantity}</span>
                                        <span class="field-mobile-material-qty-unit">${this._escape(m.unit)}</span>
                                    </div>
                                    <button class="field-mobile-material-qty-btn" data-action="incrementMaterial" data-material-id="${m.id}">+</button>
                                </div>
                                <button class="field-mobile-material-delete" data-action="deleteMaterial" data-material-id="${m.id}">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="18" y1="6" x2="6" y2="18"/>
                                        <line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ============================================
    // Quick Photo
    // ============================================

    renderQuickPhoto() {
        try {
            const service = window.fieldAppService;
            const jobId = this.currentJobId || service?.currentJobId || '';

            if (!jobId) {
                window.errorHandler?.warning('Bitte zuerst einen Auftrag wählen');
                return;
            }

            // Use the native file input approach (more reliable on mobile)
            service?.capturePhoto(jobId).then(result => {
                if (result && result.success) {
                    window.errorHandler?.success('Foto gespeichert');
                    this.render();
                } else if (result && result.error && result.error !== 'Abgebrochen') {
                    window.errorHandler?.warning(result.error || 'Foto konnte nicht aufgenommen werden');
                }
            }).catch(error => {
                console.error('Quick photo Fehler:', error);
            });
        } catch (error) {
            console.error('renderQuickPhoto Fehler:', error);
        }
    }

    // ============================================
    // Quick Note
    // ============================================

    renderQuickNote() {
        try {
            const service = window.fieldAppService;
            const jobId = this.currentJobId || service?.currentJobId || '';

            this._removeQuickOverlay();

            this.quickOverlay = document.createElement('div');
            this.quickOverlay.className = 'field-mobile-quick-note';
            this.quickOverlay.innerHTML = `
                <div class="field-mobile-quick-note-header">
                    <button class="field-mobile-back-btn" data-action="closeQuickNote">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        Abbrechen
                    </button>
                    <span style="font-size: 17px; font-weight: 600; color: var(--text-primary, #f4f4f5);">Neue Notiz</span>
                    <div style="width: 90px;"></div>
                </div>
                <textarea class="field-mobile-quick-note-textarea" id="field-mobile-note-text" placeholder="Notiz eingeben..."></textarea>
                <div class="field-mobile-quick-note-footer">
                    <button class="field-mobile-voice-to-text-btn" id="field-mobile-voice-btn" data-action="toggleQuickVoice">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                            <line x1="12" y1="19" x2="12" y2="23"/>
                            <line x1="8" y1="23" x2="16" y2="23"/>
                        </svg>
                    </button>
                    <button class="field-mobile-quick-note-save" data-action="saveQuickNote" data-job-id="${jobId}">
                        Notiz speichern
                    </button>
                </div>
            `;

            document.body.appendChild(this.quickOverlay);

            // Focus the text area
            setTimeout(() => {
                const textarea = document.getElementById('field-mobile-note-text');
                if (textarea) { textarea.focus(); }
            }, 100);

            // Bind quick note events
            this.quickOverlay.addEventListener('click', (e) => {
                const actionEl = e.target.closest('[data-action]');
                if (!actionEl) { return; }
                this._handleQuickNoteAction(actionEl.dataset.action, actionEl);
            });
        } catch (error) {
            console.error('renderQuickNote Fehler:', error);
        }
    }

    _handleQuickNoteAction(action, el) {
        const service = window.fieldAppService;

        switch (action) {
            case 'closeQuickNote':
                if (service?.isRecording) {
                    service.stopVoiceNote();
                }
                this._removeQuickOverlay();
                break;

            case 'toggleQuickVoice':
                if (service?.isRecording) {
                    const text = service.stopVoiceNote();
                    const textarea = document.getElementById('field-mobile-note-text');
                    if (textarea && text) {
                        textarea.value += (textarea.value ? ' ' : '') + text;
                    }
                    const voiceBtn = document.getElementById('field-mobile-voice-btn');
                    if (voiceBtn) {
                        voiceBtn.classList.remove('field-mobile-voice-to-text-btn--recording');
                    }
                } else {
                    const result = service?.startVoiceNote();
                    if (result && result.success) {
                        const voiceBtn = document.getElementById('field-mobile-voice-btn');
                        if (voiceBtn) {
                            voiceBtn.classList.add('field-mobile-voice-to-text-btn--recording');
                        }
                    }
                }
                break;

            case 'saveQuickNote': {
                const textarea = document.getElementById('field-mobile-note-text');
                const text = textarea?.value?.trim();
                const jobId = el?.dataset?.jobId || this.currentJobId || service?.currentJobId || '';

                if (!text) {
                    window.errorHandler?.warning('Bitte Text eingeben');
                    return;
                }

                if (!jobId) {
                    window.errorHandler?.warning('Kein Auftrag ausgewählt');
                    return;
                }

                if (service?.isRecording) {
                    service.stopVoiceNote();
                }

                service?.quickNote(jobId, text);
                window.errorHandler?.success('Notiz gespeichert');
                this._removeQuickOverlay();
                this.render();
                break;
            }
        }
    }

    // ============================================
    // Signature
    // ============================================

    renderSignature() {
        try {
            const service = window.fieldAppService;
            const jobId = this.currentJobId || service?.currentJobId || '';
            const jobs = service?.getTodaysJobs() || [];

            this._removeQuickOverlay();

            this.quickOverlay = document.createElement('div');
            this.quickOverlay.className = 'field-mobile-signature-pad';
            this.quickOverlay.innerHTML = `
                <div class="field-mobile-signature-header">
                    <button class="field-mobile-back-btn" data-action="closeSignature">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        Abbrechen
                    </button>
                    <span class="field-mobile-signature-header-title">Unterschrift</span>
                    <div style="width: 100px;">
                        <select id="field-mobile-sig-job" class="field-mobile-form-select" style="min-height: 40px; padding: 6px 10px; font-size: 14px;">
                            ${jobs.map(j => `<option value="${j.id}" ${j.id === jobId ? 'selected' : ''}>${this._escape(j.title)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="field-mobile-signature-canvas-wrap">
                    <canvas id="field-mobile-sig-canvas" class="field-mobile-signature-canvas"></canvas>
                    <span class="field-mobile-signature-hint">Hier unterschreiben</span>
                </div>
                <div class="field-mobile-signature-name">
                    <input type="text" id="field-mobile-sig-name" placeholder="Name des Unterzeichners" class="field-mobile-form-input" style="min-height: 44px;">
                </div>
                <div class="field-mobile-signature-footer">
                    <button class="field-mobile-signature-clear-btn" data-action="clearSignature">Löschen</button>
                    <button class="field-mobile-signature-save-btn" data-action="saveSignature">Speichern</button>
                </div>
            `;

            document.body.appendChild(this.quickOverlay);

            // Initialize signature pad
            setTimeout(() => {
                const canvas = document.getElementById('field-mobile-sig-canvas');
                if (canvas && service) {
                    this.signaturePad = service.createSignaturePad(canvas);
                }
            }, 100);

            // Bind signature events
            this.quickOverlay.addEventListener('click', (e) => {
                const actionEl = e.target.closest('[data-action]');
                if (!actionEl) { return; }
                this._handleSignatureAction(actionEl.dataset.action);
            });
        } catch (error) {
            console.error('renderSignature Fehler:', error);
        }
    }

    _handleSignatureAction(action) {
        const service = window.fieldAppService;

        switch (action) {
            case 'closeSignature':
                this._cleanupSignaturePad();
                this._removeQuickOverlay();
                break;

            case 'clearSignature':
                if (this.signaturePad) {
                    this.signaturePad.clear();
                }
                break;

            case 'saveSignature': {
                const sigJobSelect = document.getElementById('field-mobile-sig-job');
                const sigNameInput = document.getElementById('field-mobile-sig-name');
                const jobId = sigJobSelect?.value || this.currentJobId || service?.currentJobId || '';

                if (!jobId) {
                    window.errorHandler?.warning('Bitte einen Auftrag wählen');
                    return;
                }

                if (this.signaturePad && service) {
                    const dataUrl = this.signaturePad.toDataURL();
                    const signerName = sigNameInput?.value?.trim() || '';
                    service.captureSignature(jobId, dataUrl, signerName);
                    window.errorHandler?.success('Unterschrift gespeichert');
                    this._cleanupSignaturePad();
                    this._removeQuickOverlay();
                    this.render();
                }
                break;
            }
        }
    }

    // ============================================
    // Bottom Navigation Bar
    // ============================================

    renderBottomNav() {
        const tabs = [
            {
                id: 'jobs',
                icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
                label: 'Aufträge'
            },
            {
                id: 'active',
                icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
                label: 'Aktiv',
                badge: !!window.fieldAppService?.activeTimer
            },
            {
                id: 'photos',
                icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
                label: 'Fotos'
            },
            {
                id: 'notes',
                icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
                label: 'Notizen'
            },
            {
                id: 'more',
                icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
                label: 'Mehr'
            }
        ];

        return `
            <nav class="field-mobile-bottom-nav">
                ${tabs.map(tab => `
                    <button class="field-mobile-nav-tab ${this._isTabActive(tab.id) ? 'field-mobile-nav-tab--active' : ''}"
                            data-action="switchTab" data-tab="${tab.id}">
                        ${tab.badge ? '<span class="field-mobile-nav-tab-badge"></span>' : ''}
                        ${tab.icon}
                        <span>${tab.label}</span>
                    </button>
                `).join('')}
            </nav>
        `;
    }

    _isTabActive(tabId) {
        if (this.currentScreen === tabId) { return true; }
        if (this.currentScreen === 'material' && tabId === 'more') { return true; }
        return false;
    }

    // ============================================
    // Offline Status
    // ============================================

    renderOfflineStatus() {
        return this._renderOfflineStatus();
    }

    _renderOfflineStatus() {
        const isOnline = navigator.onLine;
        const service = window.fieldAppService;
        const pendingCount = service?.getOfflineQueueCount() || 0;

        if (isOnline && pendingCount === 0) {
            return ''; // Do not show banner when online with nothing pending
        }

        if (!isOnline) {
            return `
                <div class="field-mobile-offline-banner">
                    <span class="field-mobile-offline-dot"></span>
                    <span>Offline-Modus</span>
                    ${pendingCount > 0 ? `<span>${pendingCount} ausstehend</span>` : ''}
                </div>
            `;
        }

        // Online but has pending items
        if (pendingCount > 0) {
            return `
                <div class="field-mobile-offline-banner" style="background: rgba(99,102,241,0.08); color: var(--accent-primary, #6366f1);">
                    <span class="field-mobile-offline-dot" style="background: var(--accent-primary, #6366f1); animation: none;"></span>
                    <span>${pendingCount} nicht synchronisiert</span>
                    <button class="field-mobile-offline-sync-btn" data-action="syncQueue" style="background: rgba(99,102,241,0.15); color: var(--accent-primary, #6366f1);">
                        Sync
                    </button>
                </div>
            `;
        }

        return '';
    }

    // ============================================
    // Swipe Gestures
    // ============================================

    initSwipeGestures() {
        if (!this.overlay) { return; }

        // Remove old listeners if any
        this.overlay.removeEventListener('touchstart', this._onSwipeStart);
        this.overlay.removeEventListener('touchend', this._onSwipeEnd);

        this._onSwipeStart = (e) => {
            // Do not intercept swipes on signature canvas or scrollable content mid-scroll
            if (e.target.closest('.field-mobile-signature-canvas') ||
                e.target.closest('.field-mobile-quick-note-textarea') ||
                e.target.closest('.field-mobile-material-qty-controls')) {
                return;
            }
            const touch = e.touches[0];
            this.swipeStartX = touch.clientX;
            this.swipeStartY = touch.clientY;
            this.isSwiping = true;
        };

        this._onSwipeEnd = (e) => {
            if (!this.isSwiping) { return; }
            this.isSwiping = false;

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - this.swipeStartX;
            const deltaY = touch.clientY - this.swipeStartY;

            // Only process horizontal swipes (not vertical scrolling)
            if (Math.abs(deltaX) < this.swipeThreshold || Math.abs(deltaY) > Math.abs(deltaX)) {
                return;
            }

            const screens = ['jobs', 'active', 'photos', 'notes', 'more'];
            const currentIndex = screens.indexOf(this.currentScreen);

            if (deltaX < -this.swipeThreshold && currentIndex < screens.length - 1) {
                // Swipe left -> next tab
                this.currentScreen = screens[currentIndex + 1];
                this.render();
            } else if (deltaX > this.swipeThreshold && currentIndex > 0) {
                // Swipe right -> previous tab
                this.currentScreen = screens[currentIndex - 1];
                this.render();
            }
        };

        this.overlay.addEventListener('touchstart', this._onSwipeStart, { passive: true });
        this.overlay.addEventListener('touchend', this._onSwipeEnd, { passive: true });
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

            e.preventDefault();
            this._handleAction(actionEl.dataset.action, actionEl);
        });
    }

    _bindGlobalEvents() {
        // Voice interim results -> update note textarea
        window.addEventListener('fieldApp:voiceInterim', (e) => {
            try {
                const textarea = document.getElementById('field-mobile-note-text');
                if (textarea) {
                    const finalText = e.detail.final || '';
                    if (finalText) {
                        textarea.value = textarea.value.split('\n')[0] || '';
                        if (textarea.value && !textarea.value.endsWith(' ')) {
                            textarea.value += ' ';
                        }
                        textarea.value += finalText;
                    }
                }
            } catch (error) {
                // Non-critical
            }
        });

        // Online/offline changes
        window.addEventListener('online', () => this.render());
        window.addEventListener('offline', () => this.render());

        // Listen for field mode events
        window.addEventListener('fieldApp:fieldModeActivated', () => {
            this.show();
        });

        window.addEventListener('fieldApp:fieldModeDeactivated', () => {
            this.hide();
        });
    }

    _handleAction(action, el) {
        const service = window.fieldAppService;

        try {
            switch (action) {
                // Navigation
                case 'switchTab':
                    this.previousScreen = this.currentScreen;
                    this.currentScreen = el.dataset.tab;
                    if (this.currentScreen !== 'active') {
                        // Do not clear job ID when switching to active tab
                    }
                    this.descriptionExpanded = false;
                    this.render();
                    break;

                case 'goJobs':
                    this.currentScreen = 'jobs';
                    this.currentJobId = null;
                    this.descriptionExpanded = false;
                    this.render();
                    break;

                case 'goBack':
                    if (this.currentScreen === 'material' && this.currentJobId) {
                        this.currentScreen = 'active';
                    } else if (this.previousScreen) {
                        this.currentScreen = this.previousScreen;
                    } else {
                        this.currentScreen = 'jobs';
                        this.currentJobId = null;
                    }
                    this.descriptionExpanded = false;
                    this.render();
                    break;

                case 'goActiveJob':
                    this.currentJobId = el.dataset.jobId;
                    this.currentScreen = 'active';
                    this.descriptionExpanded = false;
                    this.render();
                    break;

                case 'goMaterial':
                    this.previousScreen = this.currentScreen;
                    this.currentScreen = 'material';
                    this.render();
                    break;

                // Job actions
                case 'openJob':
                    this.currentJobId = el.dataset.jobId;
                    this.currentScreen = 'active';
                    this.descriptionExpanded = false;
                    this.render();
                    break;

                case 'toggleDescription':
                    this.descriptionExpanded = !this.descriptionExpanded;
                    this.render();
                    break;

                // Clock in/out
                case 'clockIn':
                    if (this.currentJobId && service) {
                        const job = service.getJobById(this.currentJobId);
                        service.clockIn(this.currentJobId, job?.title);
                        // Auto GPS check-in on clock in
                        service.gpsCheckIn(this.currentJobId);
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

                // Quick actions
                case 'quickPhoto':
                    this.renderQuickPhoto();
                    break;

                case 'quickPhotoGeneral': {
                    const jobId = this.currentJobId || service?.currentJobId || '';
                    if (jobId) {
                        service?.quickPhoto(jobId).then(result => {
                            if (result && result.success) {
                                window.errorHandler?.success('Foto gespeichert');
                                this.render();
                            }
                        }).catch(() => {});
                    } else {
                        window.errorHandler?.warning('Bitte zuerst einen Auftrag wählen');
                    }
                    break;
                }

                case 'quickNote':
                    this.renderQuickNote();
                    break;

                case 'quickNoteGeneral':
                    this.renderQuickNote();
                    break;

                case 'renderSignature':
                    this.renderSignature();
                    break;

                // Photo actions
                case 'takePhoto':
                    if (this.currentJobId && service) {
                        service.capturePhoto(this.currentJobId).then(() => this.render());
                    }
                    break;

                // Material actions
                case 'saveMaterial': {
                    const matJobSelect = document.getElementById('field-mobile-mat-job');
                    const matNameInput = document.getElementById('field-mobile-mat-name');
                    const matQtyInput = document.getElementById('field-mobile-mat-qty');
                    const matUnitSelect = document.getElementById('field-mobile-mat-unit');
                    const matJobId = matJobSelect?.value || this.currentJobId || '';
                    const matName = matNameInput?.value?.trim();

                    if (!matJobId) {
                        window.errorHandler?.warning('Bitte einen Auftrag wählen');
                        break;
                    }
                    if (!matName) {
                        window.errorHandler?.warning('Bitte Material eingeben');
                        break;
                    }

                    if (service) {
                        service.logMaterial(matJobId, {
                            name: matName,
                            quantity: parseFloat(matQtyInput?.value) || 1,
                            unit: matUnitSelect?.value || 'Stk.',
                            note: ''
                        });
                        window.errorHandler?.success('Material erfasst');
                        if (matNameInput) { matNameInput.value = ''; }
                        if (matQtyInput) { matQtyInput.value = '1'; }
                        this.render();
                    }
                    break;
                }

                case 'incrementMaterial': {
                    const materialId = el.dataset.materialId;
                    if (materialId && service) {
                        const material = service.materialLogs.find(m => m.id === materialId);
                        if (material) {
                            material.quantity = (parseFloat(material.quantity) || 0) + 1;
                            service.save();
                            this.render();
                        }
                    }
                    break;
                }

                case 'decrementMaterial': {
                    const materialId = el.dataset.materialId;
                    if (materialId && service) {
                        const material = service.materialLogs.find(m => m.id === materialId);
                        if (material) {
                            material.quantity = Math.max(0, (parseFloat(material.quantity) || 0) - 1);
                            if (material.quantity <= 0) {
                                service.removeMaterial(materialId);
                            } else {
                                service.save();
                            }
                            this.render();
                        }
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

                // GPS
                case 'gpsCheckin': {
                    const jobId = this.currentJobId || '';
                    if (service) {
                        service.gpsCheckIn(jobId).then(result => {
                            if (result && result.success) {
                                window.errorHandler?.success('GPS Check-in erfolgreich');
                                this.render();
                            } else {
                                window.errorHandler?.warning(result?.error || 'GPS Check-in fehlgeschlagen');
                            }
                        });
                    }
                    break;
                }

                case 'gpsCheckinGeneral': {
                    const jobId = this.currentJobId || service?.currentJobId || '';
                    if (service) {
                        service.gpsCheckIn(jobId).then(result => {
                            if (result && result.success) {
                                window.errorHandler?.success('GPS Check-in erfolgreich');
                            } else {
                                window.errorHandler?.warning(result?.error || 'GPS Check-in fehlgeschlagen');
                            }
                        });
                    }
                    break;
                }

                // Sync
                case 'syncQueue':
                    if (service) {
                        service.syncOfflineQueue().then(result => {
                            window.errorHandler?.success(`${result.synced} Aktionen synchronisiert`);
                            this.render();
                        });
                    }
                    break;

                // Exit
                case 'exitFieldMode':
                    window.fieldAppService?.exitFieldMode();
                    this.hide();
                    break;
            }
        } catch (error) {
            console.error('FieldAppMobileUI action Fehler:', action, error);
        }
    }

    // ============================================
    // Timer Interval
    // ============================================

    _startTimerInterval() {
        this._stopTimerInterval();

        this.timerInterval = setInterval(() => {
            try {
                const service = window.fieldAppService;
                const timer = service?.getCurrentTimer();
                if (!timer) { return; }

                // Update all timer displays
                const timerDisplays = this.overlay?.querySelectorAll(
                    '.field-mobile-timer-display, .field-mobile-timer-banner-time, #field-mobile-banner-timer, #field-mobile-active-timer'
                );
                if (timerDisplays) {
                    timerDisplays.forEach(el => {
                        el.textContent = timer.elapsedFormatted;
                    });
                }
            } catch (error) {
                // Non-critical timer update
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
    // Cleanup Helpers
    // ============================================

    _cleanupSignaturePad() {
        if (this.signaturePad) {
            try {
                this.signaturePad.destroy();
            } catch (e) {
                // Already destroyed
            }
            this.signaturePad = null;
        }
    }

    _removeQuickOverlay() {
        if (this.quickOverlay) {
            try {
                this.quickOverlay.remove();
            } catch (e) {
                // Already removed
            }
            this.quickOverlay = null;
        }
    }

    // ============================================
    // Helper Methods
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

    _getJobTitleForNote(jobId) {
        if (!jobId) { return ''; }
        try {
            const service = window.fieldAppService;
            const job = service?.getJobById(jobId);
            return job?.title || '';
        } catch (e) {
            return '';
        }
    }
}

// Register on window
window.fieldAppMobileUI = new FieldAppMobileUI();
