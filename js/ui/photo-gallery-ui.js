/* ============================================
   Photo Gallery UI
   Job-based photo gallery with category tabs,
   lightbox, upload, drag-and-drop, annotations,
   and Baudokumentation generation.
   ============================================ */

class PhotoGalleryUI {
    constructor() {
        this.currentJobId = null;
        this.currentCategory = 'alle';
        this.lightboxPhoto = null;
        this.dragState = null;
        this.containerId = null;

        this._boundHandleKeydown = this._handleKeydown.bind(this);
    }

    // ============================================
    //  Main Entry: render gallery into a container
    // ============================================

    /**
     * Render the photo gallery for a specific job inside a container element.
     * @param {string} containerId - DOM id of the container element
     * @param {string} jobId - The job/Auftrag ID
     */
    renderJobGallery(containerId, jobId) {
        try {
            const container = document.getElementById(containerId);
            if (!container) {
                console.error('PhotoGalleryUI: Container not found:', containerId);
                return;
            }

            this.containerId = containerId;
            this.currentJobId = jobId;
            this.currentCategory = 'alle';

            const san = window.UI?.sanitize || window.sanitize?.escapeHtml || (s => s);

            // Ensure folder exists
            if (window.photoService && !window.photoService.folders[jobId]) {
                let jobTitle = 'Auftrag';
                try {
                    const auftraege = window.storeService?.state?.auftraege || window.storeService?.store?.auftraege || [];
                    const auftrag = auftraege.find(a => a.id === jobId);
                    if (auftrag) {
                        jobTitle = auftrag.titel || auftrag.title || auftrag.beschreibung || 'Auftrag';
                    }
                } catch (e) { /* ignore */ }
                window.photoService.createJobFolder(jobId, jobTitle);
            }

            const counts = window.photoService?.getPhotoCount(jobId) || { total: 0, byCategory: {} };
            const categories = PhotoService.CATEGORIES;
            const labels = PhotoService.CATEGORY_LABELS;

            container.innerHTML = `
                <div class="photo-gallery" id="pg-gallery-${san(jobId)}">
                    <!-- Header with title and actions -->
                    <div class="photo-gallery-header">
                        <div class="photo-gallery-header-left">
                            <h3 class="photo-gallery-title">Fotodokumentation</h3>
                            <span class="photo-gallery-count">${counts.total} Foto${counts.total !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="photo-gallery-header-actions">
                            <button class="photo-gallery-btn photo-gallery-btn-secondary" id="pg-btn-baudoku"
                                    title="Baudokumentation erstellen">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="16" y1="13" x2="8" y2="13"/>
                                    <line x1="16" y1="17" x2="8" y2="17"/>
                                    <polyline points="10 9 9 9 8 9"/>
                                </svg>
                                <span class="pg-btn-text">Baudokumentation</span>
                            </button>
                        </div>
                    </div>

                    <!-- Category Tabs -->
                    <div class="photo-category-tabs" id="pg-tabs">
                        <button class="photo-category-tab active" data-category="alle">
                            Alle
                            <span class="photo-category-tab-count">${counts.total}</span>
                        </button>
                        ${Object.entries(categories).map(([key, value]) => {
                            const count = counts.byCategory[value] || 0;
                            const label = san(labels[value] || value);
                            return `
                                <button class="photo-category-tab" data-category="${san(value)}">
                                    ${label}
                                    <span class="photo-category-tab-count">${count}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <!-- Upload Area -->
                    <div class="photo-upload-area" id="pg-upload-area">
                        <div class="photo-upload-content">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="17 8 12 3 7 8"/>
                                <line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                            <p class="photo-upload-text">Fotos hierher ziehen oder klicken</p>
                            <div class="photo-upload-buttons">
                                <button class="photo-gallery-btn photo-gallery-btn-primary" id="pg-btn-camera" title="Kamera">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                        <circle cx="12" cy="13" r="4"/>
                                    </svg>
                                    Kamera
                                </button>
                                <button class="photo-gallery-btn photo-gallery-btn-primary" id="pg-btn-upload" title="Datei hochladen">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="17 8 12 3 7 8"/>
                                        <line x1="12" y1="3" x2="12" y2="15"/>
                                    </svg>
                                    Datei
                                </button>
                            </div>
                            <!-- Category selector for uploads -->
                            <div class="photo-upload-category-select">
                                <label>Kategorie:</label>
                                <select id="pg-upload-category">
                                    ${Object.entries(categories).map(([key, value]) => {
                                        const label = san(labels[value] || value);
                                        const selected = value === 'dokumentation' ? ' selected' : '';
                                        return `<option value="${san(value)}"${selected}>${label}</option>`;
                                    }).join('')}
                                </select>
                            </div>
                        </div>
                        <input type="file" id="pg-file-input" accept="image/*" multiple style="display:none" />
                    </div>

                    <!-- Photo Grid -->
                    <div class="photo-grid" id="pg-photo-grid">
                        <!-- Photos rendered here -->
                    </div>

                    <!-- Empty State -->
                    <div class="photo-gallery-empty" id="pg-empty" style="display:none;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <p>Noch keine Fotos in dieser Kategorie</p>
                        <p class="photo-gallery-empty-hint">Nutzen Sie die Kamera oder laden Sie Dateien hoch</p>
                    </div>
                </div>
            `;

            // Bind events
            this._bindEvents(container, jobId);

            // Render photos
            this._renderPhotos();

        } catch (error) {
            console.error('PhotoGalleryUI renderJobGallery error:', error);
        }
    }

    // ============================================
    //  Event Binding
    // ============================================

    _bindEvents(container, jobId) {
        try {
            // Tab clicks
            const tabs = container.querySelectorAll('.photo-category-tab');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this.currentCategory = tab.dataset.category;
                    this._renderPhotos();
                });
            });

            // Camera button
            const cameraBtn = container.querySelector('#pg-btn-camera');
            if (cameraBtn) {
                cameraBtn.addEventListener('click', () => this._captureFromCamera());
            }

            // File upload button
            const uploadBtn = container.querySelector('#pg-btn-upload');
            const fileInput = container.querySelector('#pg-file-input');
            if (uploadBtn && fileInput) {
                uploadBtn.addEventListener('click', () => fileInput.click());
                fileInput.addEventListener('change', (e) => this._handleFileUpload(e));
            }

            // Drag and drop on upload area
            const uploadArea = container.querySelector('#pg-upload-area');
            if (uploadArea) {
                uploadArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    uploadArea.classList.add('drag-over');
                });
                uploadArea.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    uploadArea.classList.remove('drag-over');
                });
                uploadArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    uploadArea.classList.remove('drag-over');
                    this._handleFileDrop(e);
                });
                // Also allow click to trigger file input
                uploadArea.addEventListener('click', (e) => {
                    // Only if not clicking on a button or select
                    if (e.target.closest('button') || e.target.closest('select') || e.target.closest('label')) {
                        return;
                    }
                    fileInput?.click();
                });
            }

            // Baudokumentation button
            const baudokuBtn = container.querySelector('#pg-btn-baudoku');
            if (baudokuBtn) {
                baudokuBtn.addEventListener('click', () => this._generateBaudokumentation());
            }

            // Keyboard navigation for lightbox
            document.removeEventListener('keydown', this._boundHandleKeydown);
            document.addEventListener('keydown', this._boundHandleKeydown);

        } catch (error) {
            console.error('PhotoGalleryUI _bindEvents error:', error);
        }
    }

    _handleKeydown(e) {
        if (!this.lightboxPhoto) { return; }
        if (e.key === 'Escape') {
            this._closeLightbox();
        } else if (e.key === 'ArrowLeft') {
            this._lightboxNavigate(-1);
        } else if (e.key === 'ArrowRight') {
            this._lightboxNavigate(1);
        }
    }

    // ============================================
    //  Photo Rendering
    // ============================================

    _renderPhotos() {
        try {
            const grid = document.getElementById('pg-photo-grid');
            const emptyState = document.getElementById('pg-empty');
            if (!grid) { return; }

            const san = window.UI?.sanitize || window.sanitize?.escapeHtml || (s => s);
            const labels = PhotoService.CATEGORY_LABELS;

            let photos;
            if (this.currentCategory === 'alle') {
                photos = window.photoService?.getJobPhotos(this.currentJobId) || [];
            } else {
                photos = (window.photoService?.getJobPhotosByCategory(this.currentJobId, this.currentCategory) || [])
                    .map(p => ({ ...p, _category: this.currentCategory }));
            }

            if (photos.length === 0) {
                grid.innerHTML = '';
                grid.style.display = 'none';
                if (emptyState) { emptyState.style.display = 'flex'; }
                return;
            }

            grid.style.display = 'grid';
            if (emptyState) { emptyState.style.display = 'none'; }

            grid.innerHTML = photos.map(photo => {
                const cat = photo._category || photo.category || 'dokumentation';
                const catLabel = san(labels[cat] || cat);
                const title = san(photo.title || 'Foto');
                const date = new Date(photo.timestamp).toLocaleDateString('de-DE', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
                const sizeKB = photo.metadata?.size ? Math.round(photo.metadata.size / 1024) : '?';
                const notes = san(photo.notes || '');
                const photoId = san(photo.id);

                return `
                    <div class="photo-card" data-photo-id="${photoId}" data-category="${san(cat)}"
                         draggable="true">
                        <div class="photo-card-image-wrap" data-action="lightbox" data-photo-id="${photoId}">
                            <img class="photo-card-thumbnail"
                                 src="${photo.dataUrl}"
                                 alt="${title}"
                                 loading="lazy" />
                            <span class="photo-card-category-badge photo-badge-${san(cat)}">${catLabel}</span>
                        </div>
                        <div class="photo-card-info">
                            <div class="photo-card-title">${title}</div>
                            <div class="photo-card-meta">
                                <span class="photo-card-date">${date}</span>
                                <span class="photo-card-size">${sizeKB} KB</span>
                            </div>
                            ${notes ? `<div class="photo-card-notes">${notes}</div>` : ''}
                            <div class="photo-card-actions">
                                <button class="photo-card-action-btn" data-action="note" data-photo-id="${photoId}"
                                        title="Notiz hinzuf\u00fcgen">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                </button>
                                <button class="photo-card-action-btn photo-card-action-delete" data-action="delete" data-photo-id="${photoId}"
                                        title="Foto l\u00f6schen">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Bind photo card events
            this._bindPhotoCardEvents(grid);

        } catch (error) {
            console.error('PhotoGalleryUI _renderPhotos error:', error);
        }
    }

    _bindPhotoCardEvents(grid) {
        try {
            // Lightbox on image click
            grid.querySelectorAll('[data-action="lightbox"]').forEach(el => {
                el.addEventListener('click', () => {
                    const photoId = el.dataset.photoId;
                    this._openLightbox(photoId);
                });
            });

            // Note button
            grid.querySelectorAll('[data-action="note"]').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const photoId = el.dataset.photoId;
                    this._showNoteDialog(photoId);
                });
            });

            // Delete button
            grid.querySelectorAll('[data-action="delete"]').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const photoId = el.dataset.photoId;
                    this._confirmDeletePhoto(photoId);
                });
            });

            // Drag events for moving photos between categories
            grid.querySelectorAll('.photo-card').forEach(card => {
                card.addEventListener('dragstart', (e) => {
                    this.dragState = {
                        photoId: card.dataset.photoId,
                        sourceCategory: card.dataset.category
                    };
                    card.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', card.dataset.photoId);
                });

                card.addEventListener('dragend', () => {
                    card.classList.remove('dragging');
                    this.dragState = null;
                });
            });

            // Allow dropping on category tabs to move photos
            const tabs = document.querySelectorAll('#pg-tabs .photo-category-tab');
            tabs.forEach(tab => {
                tab.addEventListener('dragover', (e) => {
                    if (!this.dragState) { return; }
                    const targetCat = tab.dataset.category;
                    if (targetCat === 'alle') { return; }
                    e.preventDefault();
                    tab.classList.add('drag-target');
                });

                tab.addEventListener('dragleave', () => {
                    tab.classList.remove('drag-target');
                });

                tab.addEventListener('drop', (e) => {
                    e.preventDefault();
                    tab.classList.remove('drag-target');
                    if (!this.dragState) { return; }

                    const targetCat = tab.dataset.category;
                    if (targetCat === 'alle' || targetCat === this.dragState.sourceCategory) { return; }

                    const result = window.photoService?.movePhoto(
                        this.dragState.photoId,
                        this.currentJobId,
                        targetCat
                    );

                    if (result?.success) {
                        this._refreshGallery();
                    }
                    this.dragState = null;
                });
            });

        } catch (error) {
            console.error('PhotoGalleryUI _bindPhotoCardEvents error:', error);
        }
    }

    // ============================================
    //  Lightbox
    // ============================================

    _openLightbox(photoId) {
        try {
            const photo = window.photoService?.getPhoto(photoId);
            if (!photo) { return; }

            this.lightboxPhoto = photo;
            const san = window.UI?.sanitize || window.sanitize?.escapeHtml || (s => s);

            const title = san(photo.title || 'Foto');
            const description = san(photo.description || '');
            const notes = san(photo.notes || '');
            const date = new Date(photo.timestamp).toLocaleDateString('de-DE', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            const sizeKB = photo.metadata?.size ? Math.round(photo.metadata.size / 1024) : '?';
            const catLabel = san(PhotoService.CATEGORY_LABELS[photo.category] || photo.category || '');

            // Remove any existing lightbox
            this._closeLightbox();

            const lightbox = document.createElement('div');
            lightbox.className = 'photo-lightbox';
            lightbox.id = 'pg-lightbox';
            lightbox.innerHTML = `
                <div class="photo-lightbox-backdrop" data-action="close-lightbox"></div>
                <div class="photo-lightbox-container">
                    <div class="photo-lightbox-header">
                        <div class="photo-lightbox-title">${title}</div>
                        <button class="photo-lightbox-close" data-action="close-lightbox" title="Schlie\u00dfen">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    <div class="photo-lightbox-body">
                        <button class="photo-lightbox-nav photo-lightbox-prev" data-action="lightbox-prev" title="Vorheriges Foto">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"/>
                            </svg>
                        </button>
                        <div class="photo-lightbox-image-wrap">
                            <img class="photo-lightbox-image" src="${photo.dataUrl}" alt="${title}" />
                        </div>
                        <button class="photo-lightbox-nav photo-lightbox-next" data-action="lightbox-next" title="N\u00e4chstes Foto">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </button>
                    </div>
                    <div class="photo-lightbox-footer">
                        <div class="photo-lightbox-meta">
                            <span class="photo-lightbox-badge photo-badge-${san(photo.category || 'dokumentation')}">${catLabel}</span>
                            <span class="photo-lightbox-date">${date}</span>
                            <span class="photo-lightbox-size">${sizeKB} KB</span>
                        </div>
                        ${description ? `<p class="photo-lightbox-desc">${description}</p>` : ''}
                        ${notes ? `<p class="photo-lightbox-notes"><strong>Notiz:</strong> ${notes}</p>` : ''}
                        <div class="photo-lightbox-actions">
                            <button class="photo-gallery-btn photo-gallery-btn-secondary photo-lightbox-action-btn"
                                    data-action="lightbox-note" title="Notiz bearbeiten">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                                Notiz
                            </button>
                            <button class="photo-gallery-btn photo-gallery-btn-danger photo-lightbox-action-btn"
                                    data-action="lightbox-delete" title="Foto l\u00f6schen">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                                L\u00f6schen
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(lightbox);
            document.body.style.overflow = 'hidden';

            // Force reflow then add visible class for animation
            requestAnimationFrame(() => {
                lightbox.classList.add('visible');
            });

            // Bind lightbox events
            lightbox.querySelectorAll('[data-action="close-lightbox"]').forEach(el => {
                el.addEventListener('click', () => this._closeLightbox());
            });
            lightbox.querySelector('[data-action="lightbox-prev"]')?.addEventListener('click', () => {
                this._lightboxNavigate(-1);
            });
            lightbox.querySelector('[data-action="lightbox-next"]')?.addEventListener('click', () => {
                this._lightboxNavigate(1);
            });
            lightbox.querySelector('[data-action="lightbox-note"]')?.addEventListener('click', () => {
                this._closeLightbox();
                this._showNoteDialog(photoId);
            });
            lightbox.querySelector('[data-action="lightbox-delete"]')?.addEventListener('click', () => {
                this._closeLightbox();
                this._confirmDeletePhoto(photoId);
            });

            // Touch swipe support
            this._bindLightboxSwipe(lightbox);

        } catch (error) {
            console.error('PhotoGalleryUI _openLightbox error:', error);
        }
    }

    _closeLightbox() {
        const lightbox = document.getElementById('pg-lightbox');
        if (lightbox) {
            lightbox.classList.remove('visible');
            setTimeout(() => {
                lightbox.remove();
            }, 250);
        }
        this.lightboxPhoto = null;
        // Restore scroll only if no other overlays
        if (!document.querySelector('.photo-lightbox.visible')) {
            document.body.style.overflow = '';
        }
    }

    _lightboxNavigate(direction) {
        try {
            if (!this.lightboxPhoto) { return; }

            let photos;
            if (this.currentCategory === 'alle') {
                photos = window.photoService?.getJobPhotos(this.currentJobId) || [];
            } else {
                photos = (window.photoService?.getJobPhotosByCategory(this.currentJobId, this.currentCategory) || [])
                    .map(p => ({ ...p, _category: this.currentCategory }));
            }

            const currentIdx = photos.findIndex(p => p.id === this.lightboxPhoto.id);
            if (currentIdx === -1) { return; }

            const newIdx = currentIdx + direction;
            if (newIdx < 0 || newIdx >= photos.length) { return; }

            this._closeLightbox();
            // Small delay to allow close animation
            setTimeout(() => {
                this._openLightbox(photos[newIdx].id);
            }, 100);

        } catch (error) {
            console.error('PhotoGalleryUI _lightboxNavigate error:', error);
        }
    }

    _bindLightboxSwipe(lightbox) {
        let touchStartX = 0;
        let touchEndX = 0;

        const imageWrap = lightbox.querySelector('.photo-lightbox-image-wrap');
        if (!imageWrap) { return; }

        imageWrap.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        imageWrap.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            const threshold = 60;

            if (Math.abs(diff) > threshold) {
                if (diff > 0) {
                    this._lightboxNavigate(1); // swipe left = next
                } else {
                    this._lightboxNavigate(-1); // swipe right = prev
                }
            }
        }, { passive: true });
    }

    // ============================================
    //  Camera Capture
    // ============================================

    async _captureFromCamera() {
        try {
            const category = this._getSelectedUploadCategory();

            const result = await window.photoService?.capturePhoto({
                jobId: this.currentJobId,
                category: category,
                type: 'auftrag',
                id: this.currentJobId,
                title: PhotoService.CATEGORY_LABELS[category] || 'Foto'
            });

            if (result?.success) {
                this._refreshGallery();
            } else {
                this._showToast('Kamera-Fehler: ' + (result?.error || 'Unbekannt'), 'error');
            }
        } catch (error) {
            console.error('Camera capture error:', error);
            this._showToast('Kamera konnte nicht ge\u00f6ffnet werden', 'error');
        }
    }

    // ============================================
    //  File Upload
    // ============================================

    async _handleFileUpload(e) {
        try {
            const files = e.target?.files;
            if (!files || files.length === 0) { return; }

            const category = this._getSelectedUploadCategory();

            for (const file of files) {
                if (!file.type.startsWith('image/')) { continue; }

                await window.photoService?.uploadPhoto(file, {
                    jobId: this.currentJobId,
                    category: category,
                    type: 'auftrag',
                    id: this.currentJobId,
                    title: PhotoService.CATEGORY_LABELS[category] || 'Foto'
                });
            }

            // Reset file input
            e.target.value = '';

            this._refreshGallery();
            this._showToast(`${files.length} Foto${files.length > 1 ? 's' : ''} hochgeladen`, 'success');

        } catch (error) {
            console.error('File upload error:', error);
            this._showToast('Fehler beim Hochladen', 'error');
        }
    }

    async _handleFileDrop(e) {
        try {
            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) { return; }

            const category = this._getSelectedUploadCategory();
            let uploadCount = 0;

            for (const file of files) {
                if (!file.type.startsWith('image/')) { continue; }

                await window.photoService?.uploadPhoto(file, {
                    jobId: this.currentJobId,
                    category: category,
                    type: 'auftrag',
                    id: this.currentJobId,
                    title: PhotoService.CATEGORY_LABELS[category] || 'Foto'
                });
                uploadCount++;
            }

            if (uploadCount > 0) {
                this._refreshGallery();
                this._showToast(`${uploadCount} Foto${uploadCount > 1 ? 's' : ''} hochgeladen`, 'success');
            }
        } catch (error) {
            console.error('File drop error:', error);
            this._showToast('Fehler beim Hochladen', 'error');
        }
    }

    _getSelectedUploadCategory() {
        const select = document.getElementById('pg-upload-category');
        return select?.value || PhotoService.CATEGORIES.DOKUMENTATION;
    }

    // ============================================
    //  Note / Annotation Dialog
    // ============================================

    _showNoteDialog(photoId) {
        try {
            const photo = window.photoService?.getPhoto(photoId);
            if (!photo) { return; }

            const san = window.UI?.sanitize || window.sanitize?.escapeHtml || (s => s);
            const existingNote = photo.notes || '';

            // Remove existing dialog
            const old = document.getElementById('pg-note-dialog');
            if (old) { old.remove(); }

            const dialog = document.createElement('div');
            dialog.className = 'photo-lightbox'; // reuse overlay styles
            dialog.id = 'pg-note-dialog';
            dialog.innerHTML = `
                <div class="photo-lightbox-backdrop" data-action="close-note"></div>
                <div class="photo-note-dialog">
                    <div class="photo-note-dialog-header">
                        <h4>Notiz bearbeiten</h4>
                        <button class="photo-lightbox-close" data-action="close-note" title="Schlie\u00dfen">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    <div class="photo-note-dialog-body">
                        <textarea id="pg-note-textarea" class="photo-note-textarea"
                                  placeholder="Notiz oder Anmerkung zum Foto..."
                                  rows="4">${san(existingNote)}</textarea>
                    </div>
                    <div class="photo-note-dialog-footer">
                        <button class="photo-gallery-btn photo-gallery-btn-secondary" data-action="close-note">
                            Abbrechen
                        </button>
                        <button class="photo-gallery-btn photo-gallery-btn-primary" data-action="save-note">
                            Speichern
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);
            requestAnimationFrame(() => dialog.classList.add('visible'));

            // Focus textarea
            const textarea = dialog.querySelector('#pg-note-textarea');
            setTimeout(() => textarea?.focus(), 200);

            // Close handlers
            dialog.querySelectorAll('[data-action="close-note"]').forEach(el => {
                el.addEventListener('click', () => {
                    dialog.classList.remove('visible');
                    setTimeout(() => dialog.remove(), 250);
                });
            });

            // Save handler
            dialog.querySelector('[data-action="save-note"]')?.addEventListener('click', () => {
                const note = textarea?.value || '';
                window.photoService?.addPhotoNote(photoId, note);
                dialog.classList.remove('visible');
                setTimeout(() => dialog.remove(), 250);
                this._renderPhotos();
                this._showToast('Notiz gespeichert', 'success');
            });

        } catch (error) {
            console.error('PhotoGalleryUI _showNoteDialog error:', error);
        }
    }

    // ============================================
    //  Delete Confirmation
    // ============================================

    _confirmDeletePhoto(photoId) {
        try {
            // Remove existing dialog
            const old = document.getElementById('pg-delete-dialog');
            if (old) { old.remove(); }

            const dialog = document.createElement('div');
            dialog.className = 'photo-lightbox';
            dialog.id = 'pg-delete-dialog';
            dialog.innerHTML = `
                <div class="photo-lightbox-backdrop" data-action="close-delete"></div>
                <div class="photo-note-dialog photo-delete-dialog">
                    <div class="photo-note-dialog-header">
                        <h4>Foto l\u00f6schen?</h4>
                        <button class="photo-lightbox-close" data-action="close-delete" title="Schlie\u00dfen">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    <div class="photo-note-dialog-body">
                        <p class="photo-delete-message">M\u00f6chten Sie dieses Foto wirklich l\u00f6schen? Diese Aktion kann nicht r\u00fcckg\u00e4ngig gemacht werden.</p>
                    </div>
                    <div class="photo-note-dialog-footer">
                        <button class="photo-gallery-btn photo-gallery-btn-secondary" data-action="close-delete">
                            Abbrechen
                        </button>
                        <button class="photo-gallery-btn photo-gallery-btn-danger" data-action="confirm-delete">
                            Ja, l\u00f6schen
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);
            requestAnimationFrame(() => dialog.classList.add('visible'));

            // Close handlers
            dialog.querySelectorAll('[data-action="close-delete"]').forEach(el => {
                el.addEventListener('click', () => {
                    dialog.classList.remove('visible');
                    setTimeout(() => dialog.remove(), 250);
                });
            });

            // Confirm delete
            dialog.querySelector('[data-action="confirm-delete"]')?.addEventListener('click', () => {
                window.photoService?.deletePhotoFromFolder(photoId);
                dialog.classList.remove('visible');
                setTimeout(() => dialog.remove(), 250);
                this._refreshGallery();
                this._showToast('Foto gel\u00f6scht', 'success');
            });

        } catch (error) {
            console.error('PhotoGalleryUI _confirmDeletePhoto error:', error);
        }
    }

    // ============================================
    //  Baudokumentation
    // ============================================

    _generateBaudokumentation() {
        try {
            const result = window.photoService?.generateBaudokumentation(this.currentJobId);

            if (!result?.success) {
                this._showToast('Fehler: ' + (result?.error || 'Unbekannt'), 'error');
                return;
            }

            // Open in new window for printing
            const newWindow = window.open('', '_blank');
            if (newWindow) {
                newWindow.document.write(result.html);
                newWindow.document.close();
            } else {
                // Fallback: show in a preview overlay
                this._showBaudokuPreview(result.html);
            }

        } catch (error) {
            console.error('Baudokumentation generation error:', error);
            this._showToast('Fehler beim Erstellen der Baudokumentation', 'error');
        }
    }

    _showBaudokuPreview(html) {
        const old = document.getElementById('pg-baudoku-preview');
        if (old) { old.remove(); }

        const overlay = document.createElement('div');
        overlay.className = 'photo-lightbox';
        overlay.id = 'pg-baudoku-preview';
        overlay.innerHTML = `
            <div class="photo-lightbox-backdrop" data-action="close-baudoku"></div>
            <div class="baudokumentation-preview">
                <div class="baudoku-preview-header">
                    <h4>Baudokumentation Vorschau</h4>
                    <button class="photo-lightbox-close" data-action="close-baudoku" title="Schlie\u00dfen">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <iframe class="baudoku-preview-frame" sandbox="allow-same-origin"></iframe>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('visible'));

        const iframe = overlay.querySelector('.baudoku-preview-frame');
        if (iframe) {
            iframe.srcdoc = html;
        }

        overlay.querySelectorAll('[data-action="close-baudoku"]').forEach(el => {
            el.addEventListener('click', () => {
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 250);
            });
        });
    }

    // ============================================
    //  Refresh / Utility
    // ============================================

    _refreshGallery() {
        if (this.containerId && this.currentJobId) {
            this.renderJobGallery(this.containerId, this.currentJobId);
        }
    }

    _showToast(message, type = 'info') {
        try {
            // Use notification service if available
            if (window.notificationService?.show) {
                window.notificationService.show(message, type);
                return;
            }

            // Fallback toast
            const existing = document.getElementById('pg-toast');
            if (existing) { existing.remove(); }

            const toast = document.createElement('div');
            toast.id = 'pg-toast';
            toast.className = `photo-gallery-toast photo-gallery-toast-${type}`;
            toast.textContent = message;

            document.body.appendChild(toast);
            requestAnimationFrame(() => toast.classList.add('visible'));

            setTimeout(() => {
                toast.classList.remove('visible');
                setTimeout(() => toast.remove(), 300);
            }, 3000);

        } catch (error) {
            console.log('Toast:', message);
        }
    }

    /**
     * Cleanup: remove global event listeners.
     */
    destroy() {
        document.removeEventListener('keydown', this._boundHandleKeydown);
        this._closeLightbox();
    }
}

window.photoGalleryUI = new PhotoGalleryUI();
