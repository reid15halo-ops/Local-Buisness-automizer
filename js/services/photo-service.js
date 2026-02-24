/* ============================================
   Photo Documentation Service
   Capture and attach photos to jobs
   Job-based folder structure with categories:
     vorher, nachher, fortschritt, dokumentation, maengel
   ============================================ */

class PhotoService {

    // Category constants
    static CATEGORIES = {
        VORHER: 'vorher',
        NACHHER: 'nachher',
        FORTSCHRITT: 'fortschritt',
        DOKUMENTATION: 'dokumentation',
        MAENGEL: 'maengel'
    };

    static CATEGORY_LABELS = {
        vorher: 'Vorher',
        nachher: 'Nachher',
        fortschritt: 'Fortschritt',
        dokumentation: 'Dokumentation',
        maengel: 'M\u00e4ngel'
    };

    constructor() {
        this.photos = JSON.parse(localStorage.getItem('freyai_photos') || '[]');
        this.folders = JSON.parse(localStorage.getItem('freyai_photo_folders') || '{}');
        this.settings = JSON.parse(localStorage.getItem('freyai_photo_settings') || '{}');

        // Default settings
        if (!this.settings.maxPhotoSize) { this.settings.maxPhotoSize = 1024 * 1024; } // 1MB
        if (!this.settings.compressionQuality) { this.settings.compressionQuality = 0.7; }
        if (!this.settings.defaultCategory) { this.settings.defaultCategory = 'dokumentation'; }
        if (!this.settings.thumbnailSize) { this.settings.thumbnailSize = 200; }

        // Migrate flat photos to folder structure on first load
        this._migrateToFolders();
    }

    // ============================================
    //  Migration: flat list -> folder structure
    // ============================================

    _migrateToFolders() {
        try {
            if (this.photos.length === 0) { return; }

            // Check if we already migrated (folders have content)
            const hasFolders = Object.keys(this.folders).length > 0;
            const migrated = localStorage.getItem('freyai_photos_migrated');

            if (hasFolders || migrated) { return; }

            // Group existing photos by referenceId
            const grouped = {};
            const orphaned = [];

            this.photos.forEach(photo => {
                if (photo.referenceId && photo.referenceType === 'auftrag') {
                    if (!grouped[photo.referenceId]) {
                        grouped[photo.referenceId] = [];
                    }
                    grouped[photo.referenceId].push(photo);
                } else if (photo.referenceId && photo.referenceType === 'anfrage') {
                    // Also support anfrage references
                    if (!grouped[photo.referenceId]) {
                        grouped[photo.referenceId] = [];
                    }
                    grouped[photo.referenceId].push(photo);
                } else {
                    orphaned.push(photo);
                }
            });

            // Create folder structures for grouped photos
            Object.keys(grouped).forEach(refId => {
                const photos = grouped[refId];
                // Determine job title from store if available
                let jobTitle = 'Auftrag';
                try {
                    const auftraege = window.storeService?.state?.auftraege || window.storeService?.store?.auftraege || [];
                    const auftrag = auftraege.find(a => a.id === refId);
                    if (auftrag) {
                        jobTitle = auftrag.titel || auftrag.title || auftrag.beschreibung || 'Auftrag';
                    }
                } catch (e) { /* ignore */ }

                this.createJobFolder(refId, jobTitle);

                photos.forEach(photo => {
                    // Map old categories to new ones
                    const categoryMap = {
                        'before': PhotoService.CATEGORIES.VORHER,
                        'after': PhotoService.CATEGORIES.NACHHER,
                        'progress': PhotoService.CATEGORIES.FORTSCHRITT,
                        'documentation': PhotoService.CATEGORIES.DOKUMENTATION,
                        'defect': PhotoService.CATEGORIES.MAENGEL,
                        'defects': PhotoService.CATEGORIES.MAENGEL,
                        'vorher': PhotoService.CATEGORIES.VORHER,
                        'nachher': PhotoService.CATEGORIES.NACHHER,
                        'fortschritt': PhotoService.CATEGORIES.FORTSCHRITT,
                        'dokumentation': PhotoService.CATEGORIES.DOKUMENTATION,
                        'maengel': PhotoService.CATEGORIES.MAENGEL
                    };

                    const category = categoryMap[photo.category] || PhotoService.CATEGORIES.DOKUMENTATION;
                    this._addPhotoToFolder(refId, category, photo);
                });
            });

            // Place orphaned photos in a special '_unassigned' folder
            if (orphaned.length > 0) {
                this.createJobFolder('_unassigned', 'Nicht zugeordnet');
                orphaned.forEach(photo => {
                    const category = this._mapCategoryName(photo.category);
                    this._addPhotoToFolder('_unassigned', category, photo);
                });
            }

            localStorage.setItem('freyai_photos_migrated', 'true');
            this.saveFolders();
        } catch (error) {
            console.error('Photo migration error:', error);
        }
    }

    _mapCategoryName(oldCategory) {
        const categoryMap = {
            'before': PhotoService.CATEGORIES.VORHER,
            'after': PhotoService.CATEGORIES.NACHHER,
            'progress': PhotoService.CATEGORIES.FORTSCHRITT,
            'documentation': PhotoService.CATEGORIES.DOKUMENTATION,
            'defect': PhotoService.CATEGORIES.MAENGEL,
            'defects': PhotoService.CATEGORIES.MAENGEL
        };
        return categoryMap[oldCategory] || oldCategory || PhotoService.CATEGORIES.DOKUMENTATION;
    }

    _addPhotoToFolder(jobId, category, photo) {
        if (!this.folders[jobId]) { return; }
        if (!this.folders[jobId].categories[category]) {
            this.folders[jobId].categories[category] = [];
        }
        // Avoid duplicates
        const exists = this.folders[jobId].categories[category].some(p => p.id === photo.id);
        if (!exists) {
            this.folders[jobId].categories[category].push(photo);
        }
    }

    // ============================================
    //  Job Folder Management
    // ============================================

    /**
     * Create folder structure for a job.
     * @param {string} jobId - The job/Auftrag ID
     * @param {string} jobTitle - Display title for the job
     * @returns {{ success: boolean, folder: object }}
     */
    createJobFolder(jobId, jobTitle) {
        try {
            if (!jobId) { return { success: false, error: 'Job-ID fehlt' }; }

            // If folder already exists, just update title
            if (this.folders[jobId]) {
                this.folders[jobId].jobTitle = jobTitle || this.folders[jobId].jobTitle;
                this.saveFolders();
                return { success: true, folder: this.folders[jobId] };
            }

            const folder = {
                jobId: jobId,
                jobTitle: jobTitle || 'Auftrag',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                categories: {
                    [PhotoService.CATEGORIES.VORHER]: [],
                    [PhotoService.CATEGORIES.NACHHER]: [],
                    [PhotoService.CATEGORIES.FORTSCHRITT]: [],
                    [PhotoService.CATEGORIES.DOKUMENTATION]: [],
                    [PhotoService.CATEGORIES.MAENGEL]: []
                }
            };

            this.folders[jobId] = folder;
            this.saveFolders();

            return { success: true, folder };
        } catch (error) {
            console.error('createJobFolder error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all photos for a job across all categories.
     * @param {string} jobId
     * @returns {Array} Array of photo objects with category attached
     */
    getJobPhotos(jobId) {
        try {
            const folder = this.folders[jobId];
            if (!folder) { return []; }

            const allPhotos = [];
            Object.keys(folder.categories).forEach(category => {
                const photos = folder.categories[category] || [];
                photos.forEach(photo => {
                    allPhotos.push({ ...photo, _category: category });
                });
            });

            return allPhotos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('getJobPhotos error:', error);
            return [];
        }
    }

    /**
     * Get photos for a specific job filtered by category.
     * @param {string} jobId
     * @param {string} category - One of PhotoService.CATEGORIES
     * @returns {Array}
     */
    getJobPhotosByCategory(jobId, category) {
        try {
            const folder = this.folders[jobId];
            if (!folder || !folder.categories[category]) { return []; }

            return [...folder.categories[category]].sort(
                (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
            );
        } catch (error) {
            console.error('getJobPhotosByCategory error:', error);
            return [];
        }
    }

    /**
     * Add a photo to a specific job and category.
     * @param {string} jobId
     * @param {string} category
     * @param {object} photoData - { dataUrl, title, description, tags, location, ... }
     * @returns {{ success: boolean, photo: object }}
     */
    addPhotoToJob(jobId, category, photoData) {
        try {
            if (!jobId) { return { success: false, error: 'Job-ID fehlt' }; }
            if (!category || !Object.values(PhotoService.CATEGORIES).includes(category)) {
                return { success: false, error: 'Ung\u00fcltige Kategorie' };
            }

            // Auto-create folder if it does not exist
            if (!this.folders[jobId]) {
                let jobTitle = 'Auftrag';
                try {
                    const auftraege = window.storeService?.state?.auftraege || window.storeService?.store?.auftraege || [];
                    const auftrag = auftraege.find(a => a.id === jobId);
                    if (auftrag) {
                        jobTitle = auftrag.titel || auftrag.title || auftrag.beschreibung || 'Auftrag';
                    }
                } catch (e) { /* ignore */ }
                this.createJobFolder(jobId, jobTitle);
            }

            const photo = {
                id: 'photo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                dataUrl: photoData.dataUrl || photoData,
                referenceType: 'auftrag',
                referenceId: jobId,
                category: category,
                title: photoData.title || PhotoService.CATEGORY_LABELS[category] || 'Foto',
                description: photoData.description || '',
                notes: photoData.notes || '',
                tags: photoData.tags || [],
                location: photoData.location || null,
                timestamp: new Date().toISOString(),
                metadata: {
                    size: typeof photoData.dataUrl === 'string'
                        ? Math.round(photoData.dataUrl.length * 0.75)
                        : (typeof photoData === 'string' ? Math.round(photoData.length * 0.75) : 0),
                    width: photoData.width || null,
                    height: photoData.height || null
                }
            };

            // Get geolocation if available
            if (navigator.geolocation && !photo.location) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    photo.location = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    };
                    this.saveFolders();
                }, () => { });
            }

            this.folders[jobId].categories[category].push(photo);
            this.folders[jobId].updatedAt = new Date().toISOString();

            // Also keep in flat list for backward compatibility
            this.photos.push(photo);
            this.save();
            this.saveFolders();

            return { success: true, photo };
        } catch (error) {
            console.error('addPhotoToJob error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Move a photo from one job/category to another.
     * @param {string} photoId
     * @param {string} targetJobId
     * @param {string} targetCategory
     * @returns {{ success: boolean }}
     */
    movePhoto(photoId, targetJobId, targetCategory) {
        try {
            if (!targetJobId || !targetCategory) {
                return { success: false, error: 'Ziel-Job oder Kategorie fehlt' };
            }

            // Find the photo in existing folders
            let sourceJobId = null;
            let sourceCategory = null;
            let photoObj = null;
            let photoIndex = -1;

            for (const [jId, folder] of Object.entries(this.folders)) {
                for (const [cat, photos] of Object.entries(folder.categories)) {
                    const idx = photos.findIndex(p => p.id === photoId);
                    if (idx !== -1) {
                        sourceJobId = jId;
                        sourceCategory = cat;
                        photoObj = { ...photos[idx] };
                        photoIndex = idx;
                        break;
                    }
                }
                if (photoObj) { break; }
            }

            if (!photoObj) {
                return { success: false, error: 'Foto nicht gefunden' };
            }

            // Auto-create target folder if needed
            if (!this.folders[targetJobId]) {
                this.createJobFolder(targetJobId, 'Auftrag');
            }

            // Remove from source
            this.folders[sourceJobId].categories[sourceCategory].splice(photoIndex, 1);
            this.folders[sourceJobId].updatedAt = new Date().toISOString();

            // Update photo metadata
            photoObj.referenceId = targetJobId;
            photoObj.category = targetCategory;
            photoObj._category = targetCategory;

            // Add to target
            if (!this.folders[targetJobId].categories[targetCategory]) {
                this.folders[targetJobId].categories[targetCategory] = [];
            }
            this.folders[targetJobId].categories[targetCategory].push(photoObj);
            this.folders[targetJobId].updatedAt = new Date().toISOString();

            // Update flat list too
            const flatPhoto = this.photos.find(p => p.id === photoId);
            if (flatPhoto) {
                flatPhoto.referenceId = targetJobId;
                flatPhoto.category = targetCategory;
            }

            this.save();
            this.saveFolders();

            return { success: true };
        } catch (error) {
            console.error('movePhoto error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get photo count per job (total and per category).
     * @param {string} jobId
     * @returns {{ total: number, byCategory: object }}
     */
    getPhotoCount(jobId) {
        try {
            const folder = this.folders[jobId];
            if (!folder) { return { total: 0, byCategory: {} }; }

            const byCategory = {};
            let total = 0;

            Object.keys(folder.categories).forEach(category => {
                const count = (folder.categories[category] || []).length;
                byCategory[category] = count;
                total += count;
            });

            return { total, byCategory };
        } catch (error) {
            console.error('getPhotoCount error:', error);
            return { total: 0, byCategory: {} };
        }
    }

    /**
     * Delete all photos for a job (remove folder).
     * @param {string} jobId
     * @returns {{ success: boolean, removedCount: number }}
     */
    deleteJobFolder(jobId) {
        try {
            if (!this.folders[jobId]) {
                return { success: false, error: 'Ordner nicht gefunden', removedCount: 0 };
            }

            // Count photos being removed
            let removedCount = 0;
            Object.values(this.folders[jobId].categories).forEach(photos => {
                removedCount += photos.length;
            });

            // Remove photos from flat list too
            this.photos = this.photos.filter(p => p.referenceId !== jobId);

            delete this.folders[jobId];

            this.save();
            this.saveFolders();

            return { success: true, removedCount };
        } catch (error) {
            console.error('deleteJobFolder error:', error);
            return { success: false, error: error.message, removedCount: 0 };
        }
    }

    /**
     * Generate a Baudokumentation HTML report for a job.
     * @param {string} jobId
     * @returns {{ success: boolean, html: string }}
     */
    generateBaudokumentation(jobId) {
        try {
            const folder = this.folders[jobId];
            if (!folder) {
                return { success: false, error: 'Kein Ordner f\u00fcr diesen Auftrag gefunden' };
            }

            const san = window.UI?.sanitize || window.sanitize?.escapeHtml || (s => s);

            const jobTitle = san(folder.jobTitle || 'Auftrag');
            const createdDate = new Date(folder.createdAt).toLocaleDateString('de-DE');
            const now = new Date().toLocaleDateString('de-DE', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Gather company info if available
            let companyName = '';
            let companyAddress = '';
            try {
                const settings = window.storeService?.state?.settings || window.storeService?.store?.settings || {};
                companyName = san(settings.companyName || 'FreyAI Visions');
                companyAddress = san(settings.address || '');
            } catch (e) {
                companyName = 'FreyAI Visions';
            }

            // Build category sections
            const categoryOrder = [
                PhotoService.CATEGORIES.VORHER,
                PhotoService.CATEGORIES.NACHHER,
                PhotoService.CATEGORIES.FORTSCHRITT,
                PhotoService.CATEGORIES.DOKUMENTATION,
                PhotoService.CATEGORIES.MAENGEL
            ];

            let categorySections = '';
            let photoIndex = 0;

            categoryOrder.forEach(category => {
                const photos = folder.categories[category] || [];
                if (photos.length === 0) { return; }

                const label = san(PhotoService.CATEGORY_LABELS[category] || category);
                categorySections += `
                    <div class="baudoku-category">
                        <h2 class="baudoku-category-title">${label}</h2>
                        <div class="baudoku-photo-grid">
                `;

                photos.forEach(photo => {
                    photoIndex++;
                    const title = san(photo.title || 'Foto');
                    const description = san(photo.description || '');
                    const notes = san(photo.notes || '');
                    const date = new Date(photo.timestamp).toLocaleDateString('de-DE', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                    });

                    categorySections += `
                        <div class="baudoku-photo-item">
                            <div class="baudoku-photo-number">${photoIndex}</div>
                            <img src="${photo.dataUrl}" alt="${title}" class="baudoku-photo-img" />
                            <div class="baudoku-photo-meta">
                                <strong>${title}</strong>
                                <span class="baudoku-date">${date}</span>
                                ${description ? `<p class="baudoku-desc">${description}</p>` : ''}
                                ${notes ? `<p class="baudoku-notes"><em>Notiz: ${notes}</em></p>` : ''}
                            </div>
                        </div>
                    `;
                });

                categorySections += `
                        </div>
                    </div>
                `;
            });

            const counts = this.getPhotoCount(jobId);

            const html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Baudokumentation - ${jobTitle}</title>
    <style>
        @media print {
            body { margin: 0; padding: 20px; }
            .baudoku-photo-item { break-inside: avoid; }
            .no-print { display: none !important; }
        }
        body {
            font-family: 'Inter', Arial, sans-serif;
            color: #1a1a1a;
            background: #fff;
            margin: 0;
            padding: 24px;
            line-height: 1.6;
        }
        .baudoku-header {
            border-bottom: 3px solid #6366f1;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .baudoku-header h1 {
            font-size: 24px;
            color: #1a1a1a;
            margin: 0 0 4px 0;
        }
        .baudoku-header .baudoku-subtitle {
            color: #666;
            font-size: 14px;
        }
        .baudoku-company {
            font-size: 12px;
            color: #888;
            margin-top: 8px;
        }
        .baudoku-summary {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            margin-bottom: 24px;
            padding: 12px;
            background: #f5f5f5;
            border-radius: 8px;
        }
        .baudoku-summary-item {
            display: flex;
            flex-direction: column;
            font-size: 13px;
        }
        .baudoku-summary-item strong {
            font-size: 20px;
            color: #6366f1;
        }
        .baudoku-category {
            margin-bottom: 32px;
        }
        .baudoku-category-title {
            font-size: 18px;
            color: #6366f1;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 8px;
            margin-bottom: 16px;
        }
        .baudoku-photo-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
        }
        .baudoku-photo-item {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
            position: relative;
        }
        .baudoku-photo-number {
            position: absolute;
            top: 8px;
            left: 8px;
            background: #6366f1;
            color: #fff;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            z-index: 1;
        }
        .baudoku-photo-img {
            width: 100%;
            height: 200px;
            object-fit: cover;
        }
        .baudoku-photo-meta {
            padding: 12px;
        }
        .baudoku-photo-meta strong {
            display: block;
            font-size: 14px;
            margin-bottom: 4px;
        }
        .baudoku-date {
            font-size: 12px;
            color: #888;
        }
        .baudoku-desc {
            font-size: 13px;
            color: #555;
            margin-top: 6px;
        }
        .baudoku-notes {
            font-size: 12px;
            color: #6366f1;
            margin-top: 4px;
        }
        .baudoku-footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #e0e0e0;
            font-size: 11px;
            color: #999;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="baudoku-header">
        <h1>Baudokumentation</h1>
        <div class="baudoku-subtitle">${jobTitle}</div>
        <div class="baudoku-company">${companyName}${companyAddress ? ' &mdash; ' + companyAddress : ''}</div>
    </div>

    <div class="baudoku-summary">
        <div class="baudoku-summary-item">
            <strong>${counts.total}</strong>
            Fotos gesamt
        </div>
        ${categoryOrder.map(cat => {
            const count = counts.byCategory[cat] || 0;
            if (count === 0) { return ''; }
            const label = san(PhotoService.CATEGORY_LABELS[cat]);
            return `<div class="baudoku-summary-item"><strong>${count}</strong>${label}</div>`;
        }).join('')}
        <div class="baudoku-summary-item">
            <strong>${createdDate}</strong>
            Erstellt am
        </div>
    </div>

    ${categorySections}

    <div class="baudoku-footer">
        Erstellt am ${now} &mdash; ${companyName} &mdash; Generiert mit FreyAI Visions
    </div>

    <script class="no-print">
        // Auto-print button
        document.addEventListener('DOMContentLoaded', function() {
            var btn = document.createElement('button');
            btn.textContent = 'Drucken';
            btn.className = 'no-print';
            btn.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;z-index:9999;';
            btn.onclick = function() { window.print(); };
            document.body.appendChild(btn);
        });
    </script>
</body>
</html>`;

            return { success: true, html };
        } catch (error) {
            console.error('generateBaudokumentation error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get a compressed thumbnail for a photo.
     * @param {string} photoId
     * @returns {Promise<string|null>} thumbnail data URL or null
     */
    getThumbnail(photoId) {
        try {
            // Search across all folders for the photo
            let photo = null;
            for (const folder of Object.values(this.folders)) {
                for (const photos of Object.values(folder.categories)) {
                    const found = photos.find(p => p.id === photoId);
                    if (found) { photo = found; break; }
                }
                if (photo) { break; }
            }

            // Fallback to flat list
            if (!photo) {
                photo = this.photos.find(p => p.id === photoId);
            }

            if (!photo || !photo.dataUrl) { return Promise.resolve(null); }

            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const thumbSize = this.settings.thumbnailSize || 200;

                    let width = img.width;
                    let height = img.height;

                    // Calculate thumbnail dimensions maintaining aspect ratio
                    if (width > height) {
                        height = Math.round(thumbSize * (height / width));
                        width = thumbSize;
                    } else {
                        width = Math.round(thumbSize * (width / height));
                        height = thumbSize;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', 0.5));
                };
                img.onerror = () => {
                    resolve(null);
                };
                img.src = photo.dataUrl;
            });
        } catch (error) {
            console.error('getThumbnail error:', error);
            return Promise.resolve(null);
        }
    }

    /**
     * Get all job folder summaries (for listing in UI).
     * @returns {Array<{ jobId, jobTitle, createdAt, updatedAt, photoCount }>}
     */
    getAllJobFolders() {
        try {
            return Object.values(this.folders).map(folder => {
                const counts = this.getPhotoCount(folder.jobId);
                return {
                    jobId: folder.jobId,
                    jobTitle: folder.jobTitle,
                    createdAt: folder.createdAt,
                    updatedAt: folder.updatedAt,
                    photoCount: counts.total,
                    byCategory: counts.byCategory
                };
            }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        } catch (error) {
            console.error('getAllJobFolders error:', error);
            return [];
        }
    }

    /**
     * Add a note/annotation to an existing photo.
     * @param {string} photoId
     * @param {string} note
     * @returns {{ success: boolean }}
     */
    addPhotoNote(photoId, note) {
        try {
            let found = false;
            for (const folder of Object.values(this.folders)) {
                for (const photos of Object.values(folder.categories)) {
                    const photo = photos.find(p => p.id === photoId);
                    if (photo) {
                        photo.notes = note;
                        found = true;
                        break;
                    }
                }
                if (found) { break; }
            }

            // Also update in flat list
            const flatPhoto = this.photos.find(p => p.id === photoId);
            if (flatPhoto) {
                flatPhoto.notes = note;
                found = true;
            }

            if (found) {
                this.save();
                this.saveFolders();
                return { success: true };
            }
            return { success: false, error: 'Foto nicht gefunden' };
        } catch (error) {
            console.error('addPhotoNote error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete a single photo from folders by ID.
     * @param {string} photoId
     * @returns {{ success: boolean }}
     */
    deletePhotoFromFolder(photoId) {
        try {
            let found = false;
            for (const folder of Object.values(this.folders)) {
                for (const [cat, photos] of Object.entries(folder.categories)) {
                    const idx = photos.findIndex(p => p.id === photoId);
                    if (idx !== -1) {
                        photos.splice(idx, 1);
                        folder.updatedAt = new Date().toISOString();
                        found = true;
                        break;
                    }
                }
                if (found) { break; }
            }

            // Also remove from flat list
            const flatIdx = this.photos.findIndex(p => p.id === photoId);
            if (flatIdx !== -1) {
                this.photos.splice(flatIdx, 1);
            }

            if (found) {
                this.save();
                this.saveFolders();
                return { success: true };
            }
            return { success: false, error: 'Foto nicht gefunden' };
        } catch (error) {
            console.error('deletePhotoFromFolder error:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    //  Original methods (backward compatibility)
    // ============================================

    // Capture photo from camera
    async capturePhoto(referenceData = {}) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' } // Rear camera
            });

            // Create video element
            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            // Capture frame
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);

            // Stop camera
            stream.getTracks().forEach(track => track.stop());

            // Get data URL
            const dataUrl = canvas.toDataURL('image/jpeg', this.settings.compressionQuality);

            // If referenceData includes jobId and category, use folder-based storage
            if (referenceData.jobId && referenceData.category) {
                return this.addPhotoToJob(referenceData.jobId, referenceData.category, {
                    dataUrl: dataUrl,
                    title: referenceData.title,
                    description: referenceData.description,
                    tags: referenceData.tags,
                    location: referenceData.location,
                    width: video.videoWidth,
                    height: video.videoHeight
                });
            }

            // Fallback: Save to flat list
            return this.savePhoto(dataUrl, referenceData);

        } catch (error) {
            console.error('Camera error:', error);
            return { success: false, error: error.message };
        }
    }

    // Upload photo from file
    async uploadPhoto(file, referenceData = {}) {
        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                this.compressImage(e.target.result, (compressedDataUrl) => {
                    // If referenceData includes jobId and category, use folder-based storage
                    if (referenceData.jobId && referenceData.category) {
                        const result = this.addPhotoToJob(referenceData.jobId, referenceData.category, {
                            dataUrl: compressedDataUrl,
                            title: referenceData.title,
                            description: referenceData.description,
                            tags: referenceData.tags,
                            location: referenceData.location
                        });
                        resolve(result);
                    } else {
                        const result = this.savePhoto(compressedDataUrl, referenceData);
                        resolve(result);
                    }
                });
            };

            reader.onerror = () => {
                resolve({ success: false, error: 'Datei konnte nicht gelesen werden' });
            };

            reader.readAsDataURL(file);
        });
    }

    // Compress image
    compressImage(dataUrl, callback) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');

            // Limit dimensions
            let width = img.width;
            let height = img.height;
            const maxDim = 1200;

            if (width > maxDim || height > maxDim) {
                const ratio = Math.min(maxDim / width, maxDim / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);

            callback(canvas.toDataURL('image/jpeg', this.settings.compressionQuality));
        };
        img.src = dataUrl;
    }

    // Save photo to storage (flat list - backward compat)
    savePhoto(dataUrl, referenceData) {
        const photo = {
            id: 'photo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            dataUrl: dataUrl,
            referenceType: referenceData.type || null,
            referenceId: referenceData.id || null,
            category: referenceData.category || this.settings.defaultCategory,
            title: referenceData.title || 'Foto',
            description: referenceData.description || '',
            notes: referenceData.notes || '',
            tags: referenceData.tags || [],
            location: referenceData.location || null,
            timestamp: new Date().toISOString(),
            metadata: {
                size: Math.round(dataUrl.length * 0.75),
                width: referenceData.width || null,
                height: referenceData.height || null
            }
        };

        // Get geolocation if available
        if (navigator.geolocation && !photo.location) {
            navigator.geolocation.getCurrentPosition((pos) => {
                photo.location = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                };
                this.save();
            }, () => { });
        }

        this.photos.push(photo);
        this.save();

        return { success: true, photo };
    }

    // Get photos by reference
    getPhotosByReference(type, id) {
        return this.photos.filter(p => p.referenceType === type && p.referenceId === id);
    }

    // Get photos by category (flat list)
    getPhotosByCategory(category) {
        return this.photos.filter(p => p.category === category);
    }

    // Get photo by ID (searches folders first, then flat list)
    getPhoto(id) {
        // Search folders
        for (const folder of Object.values(this.folders)) {
            for (const photos of Object.values(folder.categories)) {
                const photo = photos.find(p => p.id === id);
                if (photo) { return photo; }
            }
        }
        // Fallback to flat list
        return this.photos.find(p => p.id === id);
    }

    // Update photo metadata
    updatePhoto(id, updates) {
        // Update in folders
        for (const folder of Object.values(this.folders)) {
            for (const photos of Object.values(folder.categories)) {
                const photo = photos.find(p => p.id === id);
                if (photo) {
                    if (updates.title !== undefined) { photo.title = updates.title; }
                    if (updates.description !== undefined) { photo.description = updates.description; }
                    if (updates.notes !== undefined) { photo.notes = updates.notes; }
                    if (updates.category !== undefined) { photo.category = updates.category; }
                    if (updates.tags !== undefined) { photo.tags = updates.tags; }
                    break;
                }
            }
        }

        // Also update in flat list
        const photo = this.photos.find(p => p.id === id);
        if (!photo) { return { success: false }; }

        if (updates.title !== undefined) { photo.title = updates.title; }
        if (updates.description !== undefined) { photo.description = updates.description; }
        if (updates.notes !== undefined) { photo.notes = updates.notes; }
        if (updates.category !== undefined) { photo.category = updates.category; }
        if (updates.tags !== undefined) { photo.tags = updates.tags; }

        this.save();
        this.saveFolders();
        return { success: true, photo };
    }

    // Delete photo
    deletePhoto(id) {
        // Also remove from folders
        this.deletePhotoFromFolder(id);

        const index = this.photos.findIndex(p => p.id === id);
        if (index === -1) { return { success: false }; }

        this.photos.splice(index, 1);
        this.save();
        return { success: true };
    }

    // Search photos by tag or title
    searchPhotos(query) {
        const q = query.toLowerCase();
        return this.photos.filter(p =>
            p.title.toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            (p.notes || '').toLowerCase().includes(q) ||
            (p.tags || []).some(t => t.toLowerCase().includes(q))
        );
    }

    // Get all photos with filters
    getPhotos(filters = {}) {
        let photos = [...this.photos];

        if (filters.referenceType) {
            photos = photos.filter(p => p.referenceType === filters.referenceType);
        }
        if (filters.category) {
            photos = photos.filter(p => p.category === filters.category);
        }
        if (filters.dateFrom) {
            photos = photos.filter(p => p.timestamp >= filters.dateFrom);
        }
        if (filters.dateTo) {
            photos = photos.filter(p => p.timestamp <= filters.dateTo);
        }

        return photos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    // Get recent photos
    getRecentPhotos(limit = 20) {
        return this.photos
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    // Get statistics
    getStatistics() {
        const byCategory = {};
        this.photos.forEach(p => {
            byCategory[p.category] = (byCategory[p.category] || 0) + 1;
        });

        const totalSize = this.photos.reduce((sum, p) => sum + (p.metadata?.size || 0), 0);

        return {
            totalPhotos: this.photos.length,
            totalSize: totalSize,
            byCategory: byCategory,
            totalFolders: Object.keys(this.folders).length,
            todayCount: this.photos.filter(p => {
                const today = new Date().toISOString().split('T')[0];
                return p.timestamp.startsWith(today);
            }).length
        };
    }

    // Create before/after pair
    createBeforeAfterPair(referenceType, referenceId) {
        const beforePhoto = this.capturePhoto({
            type: referenceType,
            id: referenceId,
            category: 'before',
            title: 'Vorher'
        });

        return {
            before: beforePhoto,
            captureAfter: () => this.capturePhoto({
                type: referenceType,
                id: referenceId,
                category: 'after',
                title: 'Nachher'
            })
        };
    }

    // Export photos for job
    exportPhotosForJob(referenceType, referenceId) {
        const photos = this.getPhotosByReference(referenceType, referenceId);
        return {
            count: photos.length,
            photos: photos.map(p => ({
                id: p.id,
                title: p.title,
                category: p.category,
                dataUrl: p.dataUrl,
                timestamp: p.timestamp
            }))
        };
    }

    // Clear old photos (storage management)
    clearOldPhotos(daysOld = 90) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysOld);
        const cutoffStr = cutoff.toISOString();

        const oldCount = this.photos.length;
        this.photos = this.photos.filter(p => p.timestamp >= cutoffStr);
        const removedCount = oldCount - this.photos.length;

        // Also clean up folders
        for (const folder of Object.values(this.folders)) {
            for (const [cat, photos] of Object.entries(folder.categories)) {
                folder.categories[cat] = photos.filter(p => p.timestamp >= cutoffStr);
            }
        }

        if (removedCount > 0) {
            this.save();
            this.saveFolders();
        }
        return removedCount;
    }

    // Persistence - flat photo list
    save() {
        try {
            localStorage.setItem('freyai_photos', JSON.stringify(this.photos));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.error('Storage quota exceeded. Clearing old photos...');
                this.clearOldPhotos(30);
                try {
                    localStorage.setItem('freyai_photos', JSON.stringify(this.photos));
                } catch (e2) {
                    console.error('Still exceeding quota after cleanup:', e2);
                }
            }
        }
    }

    // Persistence - folder structure
    saveFolders() {
        try {
            localStorage.setItem('freyai_photo_folders', JSON.stringify(this.folders));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.error('Storage quota exceeded for folders. Clearing old photos...');
                this.clearOldPhotos(30);
                try {
                    localStorage.setItem('freyai_photo_folders', JSON.stringify(this.folders));
                } catch (e2) {
                    console.error('Still exceeding quota after cleanup:', e2);
                }
            }
        }
    }
}

window.photoService = new PhotoService();
