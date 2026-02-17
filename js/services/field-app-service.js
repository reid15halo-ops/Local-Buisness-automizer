/* ============================================
   Field App Service - Mobile Außendienst
   Companion mode for on-site craftsmen
   ============================================ */

class FieldAppService {
    constructor() {
        // State
        this.isFieldMode = false;
        this.currentJobId = null;
        this.activeTimer = null; // { jobId, startedAt, jobTitle }
        this.timeEntries = [];
        this.photoCaptures = [];
        this.materialLogs = [];
        this.voiceNotes = [];
        this.signatures = [];
        this.gpsCheckins = [];
        this.offlineQueue = [];

        // Voice recognition
        this.recognition = null;
        this.isRecording = false;
        this.currentVoiceText = '';

        // Camera stream reference
        this.cameraStream = null;

        // Storage keys
        this.STORAGE_PREFIX = 'mhs_field_';

        // Load persisted data
        this.load();

        // Restore active timer if app was closed mid-timer
        this._restoreActiveTimer();
    }

    // ============================================
    // Field Mode Toggle
    // ============================================

    toggleFieldMode() {
        this.isFieldMode = !this.isFieldMode;
        localStorage.setItem(this.STORAGE_PREFIX + 'mode', JSON.stringify(this.isFieldMode));

        if (this.isFieldMode) {
            document.body.classList.add('field-mode-active');
            this._dispatchEvent('fieldModeActivated');
        } else {
            document.body.classList.remove('field-mode-active');
            this.stopCamera();
            this._dispatchEvent('fieldModeDeactivated');
        }

        return this.isFieldMode;
    }

    enterFieldMode() {
        if (!this.isFieldMode) {
            this.toggleFieldMode();
        }
    }

    exitFieldMode() {
        if (this.isFieldMode) {
            this.toggleFieldMode();
        }
    }

    // ============================================
    // Time Tracking
    // ============================================

    clockIn(jobId, jobTitle = '') {
        if (this.activeTimer) {
            // Auto clock-out previous job
            this.clockOut();
        }

        const now = new Date();
        this.activeTimer = {
            jobId: jobId,
            jobTitle: jobTitle || this._getJobTitle(jobId),
            startedAt: now.toISOString(),
            date: now.toISOString().split('T')[0]
        };
        this.currentJobId = jobId;

        localStorage.setItem(this.STORAGE_PREFIX + 'active_timer', JSON.stringify(this.activeTimer));
        this._dispatchEvent('clockIn', { jobId, timer: this.activeTimer });

        return this.activeTimer;
    }

    clockOut(description = '') {
        if (!this.activeTimer) { return null; }

        const now = new Date();
        const startedAt = new Date(this.activeTimer.startedAt);
        const durationMs = now - startedAt;
        const durationMinutes = Math.round(durationMs / 60000);
        const durationHours = Math.round(durationMinutes / 60 * 100) / 100;

        const entry = {
            id: this._generateId('TIME'),
            jobId: this.activeTimer.jobId,
            jobTitle: this.activeTimer.jobTitle,
            date: this.activeTimer.date,
            startTime: this._formatTime(startedAt),
            endTime: this._formatTime(now),
            startedAt: this.activeTimer.startedAt,
            endedAt: now.toISOString(),
            durationMinutes: durationMinutes,
            durationHours: durationHours,
            description: description,
            createdAt: now.toISOString()
        };

        this.timeEntries.push(entry);
        this.activeTimer = null;
        this.currentJobId = null;

        localStorage.removeItem(this.STORAGE_PREFIX + 'active_timer');
        this.save();

        // Also add to main time tracking service if available
        this._syncTimeEntryToMainService(entry);

        this._dispatchEvent('clockOut', { entry });

        return entry;
    }

    getCurrentTimer() {
        if (!this.activeTimer) { return null; }

        const now = new Date();
        const startedAt = new Date(this.activeTimer.startedAt);
        const elapsedMs = now - startedAt;

        return {
            ...this.activeTimer,
            elapsedMs: elapsedMs,
            elapsedFormatted: this._formatElapsed(elapsedMs)
        };
    }

    getTimeEntries(jobId = null) {
        if (jobId) {
            return this.timeEntries.filter(e => e.jobId === jobId);
        }
        return this.timeEntries;
    }

    getTodaysTimeEntries() {
        const today = new Date().toISOString().split('T')[0];
        return this.timeEntries.filter(e => e.date === today);
    }

    getTodaysTotalHours() {
        const todaysEntries = this.getTodaysTimeEntries();
        const totalMinutes = todaysEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

        // Add current running timer if active
        let runningMinutes = 0;
        if (this.activeTimer) {
            const now = new Date();
            const startedAt = new Date(this.activeTimer.startedAt);
            runningMinutes = Math.round((now - startedAt) / 60000);
        }

        return Math.round((totalMinutes + runningMinutes) / 60 * 100) / 100;
    }

    // ============================================
    // Material Logging
    // ============================================

    logMaterial(jobId, material) {
        const entry = {
            id: this._generateId('MAT'),
            jobId: jobId,
            name: material.name || '',
            quantity: parseFloat(material.quantity) || 1,
            unit: material.unit || 'Stk.',
            note: material.note || '',
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0]
        };

        this.materialLogs.push(entry);
        this.save();

        this._dispatchEvent('materialLogged', { entry });

        return entry;
    }

    getMaterialLog(jobId = null) {
        if (jobId) {
            return this.materialLogs.filter(e => e.jobId === jobId);
        }
        return this.materialLogs;
    }

    removeMaterial(materialId) {
        this.materialLogs = this.materialLogs.filter(e => e.id !== materialId);
        this.save();
    }

    // ============================================
    // Photo Capture
    // ============================================

    async capturePhoto(jobId) {
        try {
            // Try to use file input (more reliable across devices)
            return await this._capturePhotoViaInput(jobId);
        } catch (error) {
            window.errorHandler?.handle(error, 'FieldApp:Photo');
            return { success: false, error: error.message };
        }
    }

    async _capturePhotoViaInput(jobId) {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment'; // Rear camera

            input.onchange = (event) => {
                const file = event.target.files[0];
                if (!file) {
                    resolve({ success: false, error: 'Kein Foto ausgewählt' });
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    this._compressAndSavePhoto(e.target.result, jobId)
                        .then(resolve);
                };
                reader.onerror = () => {
                    resolve({ success: false, error: 'Fehler beim Lesen der Datei' });
                };
                reader.readAsDataURL(file);
            };

            input.oncancel = () => {
                resolve({ success: false, error: 'Abgebrochen' });
            };

            input.click();
        });
    }

    async startCameraPreview(videoElement) {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Kamera nicht verfügbar');
            }

            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            if (videoElement) {
                videoElement.srcObject = this.cameraStream;
                await videoElement.play();
            }

            return { success: true, stream: this.cameraStream };
        } catch (error) {
            window.errorHandler?.handle(error, 'FieldApp:Camera', false);
            return { success: false, error: error.message };
        }
    }

    async captureFromPreview(videoElement, jobId) {
        if (!videoElement || !this.cameraStream) {
            return { success: false, error: 'Kamera nicht aktiv' };
        }

        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        canvas.getContext('2d').drawImage(videoElement, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        return await this._compressAndSavePhoto(dataUrl, jobId);
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
    }

    async _compressAndSavePhoto(dataUrl, jobId) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1200;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                const compressed = canvas.toDataURL('image/jpeg', 0.7);

                const photo = {
                    id: this._generateId('PHOTO'),
                    jobId: jobId,
                    dataUrl: compressed,
                    timestamp: new Date().toISOString(),
                    date: new Date().toISOString().split('T')[0],
                    note: ''
                };

                this.photoCaptures.push(photo);
                this.save();

                this._dispatchEvent('photoCaptured', { photo });
                resolve({ success: true, photo: photo });
            };

            img.onerror = () => {
                resolve({ success: false, error: 'Bild konnte nicht verarbeitet werden' });
            };

            img.src = dataUrl;
        });
    }

    getPhotos(jobId = null) {
        if (jobId) {
            return this.photoCaptures.filter(p => p.jobId === jobId);
        }
        return this.photoCaptures;
    }

    deletePhoto(photoId) {
        this.photoCaptures = this.photoCaptures.filter(p => p.id !== photoId);
        this.save();
    }

    // ============================================
    // Customer Signature
    // ============================================

    createSignaturePad(canvasElement) {
        if (!canvasElement) { return null; }

        const ctx = canvasElement.getContext('2d');
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;

        // High-DPI support
        const dpr = window.devicePixelRatio || 1;
        const rect = canvasElement.getBoundingClientRect();
        canvasElement.width = rect.width * dpr;
        canvasElement.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        // Style
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // White background
        ctx.fillStyle = '#1c1c21';
        ctx.fillRect(0, 0, rect.width, rect.height);

        const getPos = (e) => {
            const touch = e.touches ? e.touches[0] : e;
            const canvasRect = canvasElement.getBoundingClientRect();
            return {
                x: touch.clientX - canvasRect.left,
                y: touch.clientY - canvasRect.top
            };
        };

        const startDrawing = (e) => {
            e.preventDefault();
            isDrawing = true;
            const pos = getPos(e);
            lastX = pos.x;
            lastY = pos.y;
        };

        const draw = (e) => {
            e.preventDefault();
            if (!isDrawing) { return; }
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            lastX = pos.x;
            lastY = pos.y;
        };

        const stopDrawing = (e) => {
            if (e) { e.preventDefault(); }
            isDrawing = false;
        };

        // Touch events
        canvasElement.addEventListener('touchstart', startDrawing, { passive: false });
        canvasElement.addEventListener('touchmove', draw, { passive: false });
        canvasElement.addEventListener('touchend', stopDrawing, { passive: false });

        // Mouse events (for testing on desktop)
        canvasElement.addEventListener('mousedown', startDrawing);
        canvasElement.addEventListener('mousemove', draw);
        canvasElement.addEventListener('mouseup', stopDrawing);
        canvasElement.addEventListener('mouseleave', stopDrawing);

        return {
            clear: () => {
                ctx.fillStyle = '#1c1c21';
                ctx.fillRect(0, 0, rect.width, rect.height);
            },
            toDataURL: () => {
                return canvasElement.toDataURL('image/png');
            },
            isEmpty: () => {
                // Simple check: see if canvas has only the background
                const imageData = ctx.getImageData(0, 0, 1, 1);
                // If it is just the background, it is "empty"
                return true; // Simplified: user must confirm
            },
            destroy: () => {
                canvasElement.removeEventListener('touchstart', startDrawing);
                canvasElement.removeEventListener('touchmove', draw);
                canvasElement.removeEventListener('touchend', stopDrawing);
                canvasElement.removeEventListener('mousedown', startDrawing);
                canvasElement.removeEventListener('mousemove', draw);
                canvasElement.removeEventListener('mouseup', stopDrawing);
                canvasElement.removeEventListener('mouseleave', stopDrawing);
            }
        };
    }

    saveSignature(jobId, dataUrl, customerName = '') {
        const signature = {
            id: this._generateId('SIG'),
            jobId: jobId,
            dataUrl: dataUrl,
            customerName: customerName,
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0]
        };

        this.signatures.push(signature);
        this.save();

        this._dispatchEvent('signatureCaptured', { signature });
        return signature;
    }

    getSignatures(jobId = null) {
        if (jobId) {
            return this.signatures.filter(s => s.jobId === jobId);
        }
        return this.signatures;
    }

    // ============================================
    // Voice Notes (Web Speech API)
    // ============================================

    startVoiceNote() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            window.errorHandler?.warning('Spracherkennung nicht verfügbar in diesem Browser');
            return { success: false, error: 'Spracherkennung nicht verfügbar' };
        }

        if (this.isRecording) {
            this.stopVoiceNote();
            return { success: false, error: 'Aufnahme läuft bereits' };
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'de-DE';
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
        this.currentVoiceText = '';
        this.isRecording = true;

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript = transcript;
                }
            }

            if (finalTranscript) {
                this.currentVoiceText += finalTranscript;
            }

            this._dispatchEvent('voiceInterim', {
                interim: interimTranscript,
                final: this.currentVoiceText
            });
        };

        this.recognition.onerror = (event) => {
            console.error('Spracherkennung Fehler:', event.error);
            if (event.error !== 'no-speech') {
                this.isRecording = false;
                this._dispatchEvent('voiceError', { error: event.error });
            }
        };

        this.recognition.onend = () => {
            // If still supposed to be recording, restart
            if (this.isRecording) {
                try {
                    this.recognition.start();
                } catch (e) {
                    this.isRecording = false;
                    this._dispatchEvent('voiceStopped', { text: this.currentVoiceText });
                }
            }
        };

        try {
            this.recognition.start();
            this._dispatchEvent('voiceStarted');
            return { success: true };
        } catch (error) {
            this.isRecording = false;
            window.errorHandler?.handle(error, 'FieldApp:Voice');
            return { success: false, error: error.message };
        }
    }

    stopVoiceNote() {
        this.isRecording = false;
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {
                // Already stopped
            }
            this.recognition = null;
        }

        const text = this.currentVoiceText.trim();
        this._dispatchEvent('voiceStopped', { text: text });

        return text;
    }

    saveVoiceNote(jobId, text) {
        if (!text || !text.trim()) { return null; }

        const note = {
            id: this._generateId('VOICE'),
            jobId: jobId,
            text: text.trim(),
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0]
        };

        this.voiceNotes.push(note);
        this.save();

        this._dispatchEvent('voiceNoteSaved', { note });
        return note;
    }

    getVoiceNotes(jobId = null) {
        if (jobId) {
            return this.voiceNotes.filter(n => n.jobId === jobId);
        }
        return this.voiceNotes;
    }

    // ============================================
    // Quick Status Updates
    // ============================================

    updateJobStatus(jobId, status) {
        try {
            const store = window.storeService?.store;
            if (!store) { return false; }

            const auftrag = store.auftraege.find(a => a.id === jobId);
            if (auftrag) {
                auftrag.status = status;
                auftrag.lastUpdated = new Date().toISOString();
                window.storeService.save();

                this._dispatchEvent('jobStatusUpdated', { jobId, status });
                return true;
            }

            // If not found in store, queue for sync
            this.queueAction({
                type: 'updateJobStatus',
                jobId: jobId,
                status: status
            });

            return true;
        } catch (error) {
            window.errorHandler?.handle(error, 'FieldApp:Status');
            return false;
        }
    }

    // ============================================
    // GPS Check-in
    // ============================================

    async checkIn(jobId) {
        if (!navigator.geolocation) {
            return {
                success: false,
                error: 'GPS nicht verfügbar'
            };
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const checkin = {
                        id: this._generateId('GPS'),
                        jobId: jobId,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date().toISOString(),
                        date: new Date().toISOString().split('T')[0]
                    };

                    this.gpsCheckins.push(checkin);
                    this.save();

                    this._dispatchEvent('gpsCheckin', { checkin });
                    resolve({ success: true, checkin: checkin });
                },
                (error) => {
                    let message = 'GPS-Fehler';
                    switch (error.code) {
                        case 1: message = 'GPS-Zugriff verweigert'; break;
                        case 2: message = 'Position nicht verfügbar'; break;
                        case 3: message = 'Zeitüberschreitung'; break;
                    }
                    resolve({ success: false, error: message });
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }

    getCheckins(jobId = null) {
        if (jobId) {
            return this.gpsCheckins.filter(c => c.jobId === jobId);
        }
        return this.gpsCheckins;
    }

    // ============================================
    // Offline Queue
    // ============================================

    queueAction(action) {
        const queuedAction = {
            id: this._generateId('Q'),
            ...action,
            queuedAt: new Date().toISOString(),
            synced: false
        };

        this.offlineQueue.push(queuedAction);
        this._saveOfflineQueue();

        return queuedAction;
    }

    async syncOfflineQueue() {
        const unsynced = this.offlineQueue.filter(a => !a.synced);
        if (unsynced.length === 0) { return { synced: 0 }; }

        let syncedCount = 0;

        for (const action of unsynced) {
            try {
                await this._processQueuedAction(action);
                action.synced = true;
                action.syncedAt = new Date().toISOString();
                syncedCount++;
            } catch (error) {
                console.error('Sync-Fehler für Aktion:', action.id, error);
            }
        }

        // Remove synced items
        this.offlineQueue = this.offlineQueue.filter(a => !a.synced);
        this._saveOfflineQueue();

        this._dispatchEvent('queueSynced', { synced: syncedCount });
        return { synced: syncedCount };
    }

    async _processQueuedAction(action) {
        switch (action.type) {
            case 'updateJobStatus':
                this.updateJobStatus(action.jobId, action.status);
                break;
            case 'logMaterial':
                this.logMaterial(action.jobId, action.material);
                break;
            default:
                console.warn('Unbekannter Queue-Aktionstyp:', action.type);
        }
    }

    getOfflineQueueCount() {
        return this.offlineQueue.filter(a => !a.synced).length;
    }

    // ============================================
    // Today's Jobs
    // ============================================

    getTodaysJobs() {
        const today = new Date().toISOString().split('T')[0];
        const jobs = [];

        // Get from store auftraege
        const store = window.storeService?.store;
        if (store && store.auftraege) {
            const activeAuftraege = store.auftraege.filter(a => {
                // Active auftraege (not completed/cancelled)
                const isActive = !['abgeschlossen', 'storniert'].includes(a.status);
                // Check if scheduled for today or has no specific date (ongoing)
                const isToday = !a.scheduledDate || a.scheduledDate === today || a.date === today;
                return isActive && isToday;
            });

            activeAuftraege.forEach(a => {
                jobs.push({
                    id: a.id,
                    type: 'auftrag',
                    title: a.title || a.beschreibung || 'Auftrag',
                    customer: a.kunde || a.customerName || '',
                    address: a.adresse || a.address || '',
                    status: a.status || 'offen',
                    time: a.startTime || '',
                    description: a.beschreibung || a.description || '',
                    priority: a.priority || 'normal',
                    originalData: a
                });
            });
        }

        // Get from calendar appointments
        if (window.calendarService) {
            const todaysAppointments = window.calendarService.getAppointmentsForDay(today);
            todaysAppointments.forEach(apt => {
                // Avoid duplicates if already linked via auftragId
                if (apt.auftragId && jobs.find(j => j.id === apt.auftragId)) {
                    // Update time info on existing job
                    const existingJob = jobs.find(j => j.id === apt.auftragId);
                    if (existingJob) {
                        existingJob.time = apt.startTime || existingJob.time;
                    }
                    return;
                }

                jobs.push({
                    id: apt.id,
                    type: 'appointment',
                    title: apt.title || 'Termin',
                    customer: apt.customerName || '',
                    address: apt.location || '',
                    status: apt.status || 'geplant',
                    time: apt.startTime || '',
                    endTime: apt.endTime || '',
                    description: apt.description || '',
                    priority: 'normal',
                    originalData: apt
                });
            });
        }

        // Sort by time
        jobs.sort((a, b) => {
            if (!a.time && !b.time) { return 0; }
            if (!a.time) { return 1; }
            if (!b.time) { return -1; }
            return a.time.localeCompare(b.time);
        });

        return jobs;
    }

    getJobById(jobId) {
        const allJobs = this.getTodaysJobs();
        return allJobs.find(j => j.id === jobId) || null;
    }

    // ============================================
    // Persistence
    // ============================================

    save() {
        try {
            localStorage.setItem(this.STORAGE_PREFIX + 'time_entries', JSON.stringify(this.timeEntries));
            localStorage.setItem(this.STORAGE_PREFIX + 'material_logs', JSON.stringify(this.materialLogs));
            localStorage.setItem(this.STORAGE_PREFIX + 'voice_notes', JSON.stringify(this.voiceNotes));
            localStorage.setItem(this.STORAGE_PREFIX + 'signatures', JSON.stringify(this.signatures));
            localStorage.setItem(this.STORAGE_PREFIX + 'gps_checkins', JSON.stringify(this.gpsCheckins));

            // Photos stored separately to handle size
            this._savePhotos();
        } catch (error) {
            // localStorage might be full
            console.error('Speicherfehler:', error);
            if (error.name === 'QuotaExceededError') {
                window.errorHandler?.warning('Speicher voll. Bitte alte Fotos löschen.');
            }
        }
    }

    load() {
        try {
            this.timeEntries = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'time_entries') || '[]');
            this.materialLogs = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'material_logs') || '[]');
            this.voiceNotes = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'voice_notes') || '[]');
            this.signatures = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'signatures') || '[]');
            this.gpsCheckins = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'gps_checkins') || '[]');
            this.offlineQueue = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'offline_queue') || '[]');

            this._loadPhotos();

            // Restore field mode state
            this.isFieldMode = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'mode') || 'false');
        } catch (error) {
            console.error('Fehler beim Laden der Felddaten:', error);
        }
    }

    _savePhotos() {
        // Store photo metadata and data separately
        // This helps manage localStorage limits
        try {
            const photoMeta = this.photoCaptures.map(p => ({
                id: p.id,
                jobId: p.jobId,
                timestamp: p.timestamp,
                date: p.date,
                note: p.note
            }));
            localStorage.setItem(this.STORAGE_PREFIX + 'photo_meta', JSON.stringify(photoMeta));

            // Store each photo's data individually
            this.photoCaptures.forEach(p => {
                localStorage.setItem(this.STORAGE_PREFIX + 'photo_data_' + p.id, p.dataUrl);
            });
        } catch (error) {
            console.error('Foto-Speicherfehler:', error);
        }
    }

    _loadPhotos() {
        try {
            const photoMeta = JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'photo_meta') || '[]');
            this.photoCaptures = photoMeta.map(meta => {
                const dataUrl = localStorage.getItem(this.STORAGE_PREFIX + 'photo_data_' + meta.id);
                return { ...meta, dataUrl: dataUrl || '' };
            }).filter(p => p.dataUrl); // Only include photos with data
        } catch (error) {
            console.error('Foto-Ladefehler:', error);
            this.photoCaptures = [];
        }
    }

    _saveOfflineQueue() {
        try {
            localStorage.setItem(this.STORAGE_PREFIX + 'offline_queue', JSON.stringify(this.offlineQueue));
        } catch (error) {
            console.error('Offline-Queue Speicherfehler:', error);
        }
    }

    _restoreActiveTimer() {
        try {
            const savedTimer = localStorage.getItem(this.STORAGE_PREFIX + 'active_timer');
            if (savedTimer) {
                this.activeTimer = JSON.parse(savedTimer);
                this.currentJobId = this.activeTimer.jobId;
            }
        } catch (error) {
            console.error('Timer-Wiederherstellung fehlgeschlagen:', error);
            this.activeTimer = null;
        }
    }

    // ============================================
    // Helper Methods
    // ============================================

    _generateId(prefix = 'F') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    _formatTime(date) {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    _formatElapsed(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    _getJobTitle(jobId) {
        const store = window.storeService?.store;
        if (store && store.auftraege) {
            const auftrag = store.auftraege.find(a => a.id === jobId);
            if (auftrag) {
                return auftrag.title || auftrag.beschreibung || 'Auftrag';
            }
        }

        if (window.calendarService) {
            const apt = window.calendarService.getAppointment(jobId);
            if (apt) {
                return apt.title || 'Termin';
            }
        }

        return 'Auftrag';
    }

    _syncTimeEntryToMainService(entry) {
        try {
            if (window.timeTrackingService) {
                window.timeTrackingService.addEntry({
                    date: entry.date,
                    startTime: entry.startTime,
                    endTime: entry.endTime,
                    auftragId: entry.jobId,
                    description: entry.description || 'Über Feld-App erfasst',
                    type: 'arbeit',
                    billable: true
                });
            }
        } catch (error) {
            console.error('Sync zu TimeTracking fehlgeschlagen:', error);
        }
    }

    _dispatchEvent(eventName, detail = {}) {
        window.dispatchEvent(new CustomEvent(`fieldApp:${eventName}`, { detail }));
    }

    // ============================================
    // Data Cleanup
    // ============================================

    clearOldData(daysToKeep = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysToKeep);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        this.timeEntries = this.timeEntries.filter(e => e.date >= cutoffStr);
        this.materialLogs = this.materialLogs.filter(e => e.date >= cutoffStr);
        this.voiceNotes = this.voiceNotes.filter(e => e.date >= cutoffStr);
        this.gpsCheckins = this.gpsCheckins.filter(e => e.date >= cutoffStr);

        // Clean old photo data from localStorage
        const oldPhotos = this.photoCaptures.filter(p => p.date < cutoffStr);
        oldPhotos.forEach(p => {
            localStorage.removeItem(this.STORAGE_PREFIX + 'photo_data_' + p.id);
        });
        this.photoCaptures = this.photoCaptures.filter(p => p.date >= cutoffStr);

        this.save();
    }

    // Get stats for today
    getTodaysStats() {
        const today = new Date().toISOString().split('T')[0];
        return {
            totalHours: this.getTodaysTotalHours(),
            timeEntries: this.getTodaysTimeEntries().length,
            photos: this.photoCaptures.filter(p => p.date === today).length,
            materials: this.materialLogs.filter(m => m.date === today).length,
            voiceNotes: this.voiceNotes.filter(v => v.date === today).length,
            isTimerRunning: !!this.activeTimer,
            offlineQueue: this.getOfflineQueueCount()
        };
    }
}

// Register on window
window.fieldAppService = new FieldAppService();
