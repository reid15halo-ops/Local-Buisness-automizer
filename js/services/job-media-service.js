/* ============================================
   Job Media Service
   Photo/Document Management per Job (Auftrag)
   Capture, compress, store and manage media
   linked to orders for Handwerker workflows.

   Storage: mhs_job_media
   ============================================ */

class JobMediaService {
    constructor() {
        this.media = JSON.parse(localStorage.getItem('mhs_job_media') || '[]');
        this.MAX_WIDTH = 800;
        this.JPEG_QUALITY = 0.7;
        this.THUMBNAIL_SIZE = 150;
    }

    // ============================================
    // ID Generation
    // ============================================

    _generateId() {
        const ts = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        return `MED-${ts}-${rand}`;
    }

    // ============================================
    // Persistence
    // ============================================

    _save() {
        try {
            localStorage.setItem('mhs_job_media', JSON.stringify(this.media));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('[JobMediaService] Storage quota exceeded. Cleaning old media...');
                this.cleanupOldMedia(30);
                try {
                    localStorage.setItem('mhs_job_media', JSON.stringify(this.media));
                } catch (e2) {
                    console.error('[JobMediaService] Still exceeding quota after cleanup:', e2);
                }
            } else {
                console.error('[JobMediaService] Save error:', e);
            }
        }
    }

    // ============================================
    // Categories
    // ============================================

    getCategories() {
        return [
            { key: 'vorher',       label: 'Vorher',       icon: '\u{1F4F7}' },
            { key: 'nachher',      label: 'Nachher',      icon: '\u2705'    },
            { key: 'schaden',      label: 'Schaden',      icon: '\u26A0\uFE0F' },
            { key: 'fortschritt',  label: 'Fortschritt',  icon: '\u{1F3D7}\uFE0F' },
            { key: 'material',     label: 'Material',     icon: '\u{1F9F1}' },
            { key: 'abnahme',      label: 'Abnahme',      icon: '\u{1F4CB}' },
            { key: 'rechnung',     label: 'Rechnung',     icon: '\u{1F4C4}' },
            { key: 'sonstiges',    label: 'Sonstiges',    icon: '\u{1F4CE}' }
        ];
    }

    getCategoryLabel(key) {
        const cat = this.getCategories().find(c => c.key === key);
        return cat ? cat.label : key || 'Sonstiges';
    }

    getCategoryIcon(key) {
        const cat = this.getCategories().find(c => c.key === key);
        return cat ? cat.icon : '\u{1F4CE}';
    }

    // ============================================
    // Image Compression (Canvas-based)
    // ============================================

    /**
     * Compress an image data URL to JPEG with max width and quality.
     * @param {string} dataUrl - base64 data URL of the image
     * @param {number} maxWidth - maximum pixel width (default 800)
     * @param {number} quality - JPEG quality 0-1 (default 0.7)
     * @returns {Promise<string>} compressed base64 data URL
     */
    compressImage(dataUrl, maxWidth, quality) {
        maxWidth = maxWidth || this.MAX_WIDTH;
        quality = quality !== undefined ? quality : this.JPEG_QUALITY;

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;
                if (w > maxWidth) {
                    h = h * (maxWidth / w);
                    w = maxWidth;
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => {
                // Return original if compression fails
                resolve(dataUrl);
            };
            img.src = dataUrl;
        });
    }

    /**
     * Create a small thumbnail from an image data URL.
     * @param {string} dataUrl - base64 data URL
     * @param {number} size - max thumbnail dimension in px (default 150)
     * @returns {Promise<string>} thumbnail base64 data URL
     */
    createThumbnail(dataUrl, size) {
        size = size || this.THUMBNAIL_SIZE;

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;
                if (w > h) {
                    if (w > size) { h = h * (size / w); w = size; }
                } else {
                    if (h > size) { w = w * (size / h); h = size; }
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = () => {
                resolve(dataUrl);
            };
            img.src = dataUrl;
        });
    }

    // ============================================
    // Camera Capture
    // ============================================

    /**
     * Opens camera input on mobile (file picker fallback on desktop).
     * Returns a promise that resolves with the captured image data URL.
     * @returns {Promise<string>} data URL of captured/selected image
     */
    captureFromCamera() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment';

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject(new Error('Keine Datei ausgewaehlt'));
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target.result);
                reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
                reader.readAsDataURL(file);
            };

            // Cancel handling
            input.oncancel = () => reject(new Error('Abgebrochen'));

            input.click();
        });
    }

    // ============================================
    // Geolocation Helper
    // ============================================

    _getLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                },
                () => resolve(null),
                { timeout: 5000, maximumAge: 60000 }
            );
        });
    }

    // ============================================
    // Add Media
    // ============================================

    /**
     * Add a photo to an order. Compresses and creates thumbnail automatically.
     * @param {string} orderId - linked Auftrag ID
     * @param {string} imageData - base64 data URL of the image
     * @param {object} metadata - { caption, category, tags, orderName, customerId, customerName }
     * @returns {Promise<object>} the created MediaItem
     */
    async addPhoto(orderId, imageData, metadata) {
        metadata = metadata || {};

        // Compress image
        const compressed = await this.compressImage(imageData);
        const thumbnail = await this.createThumbnail(imageData);

        // Try to get location
        const location = await this._getLocation();

        const item = {
            id: this._generateId(),
            orderId: orderId || '',
            orderName: metadata.orderName || '',
            customerId: metadata.customerId || '',
            customerName: metadata.customerName || '',
            type: 'photo',
            dataUrl: compressed,
            thumbnail: thumbnail,
            fileName: '',
            fileType: 'jpg',
            fileSize: Math.round(compressed.length * 0.75),
            fileData: '',
            caption: metadata.caption || '',
            category: metadata.category || 'sonstiges',
            tags: Array.isArray(metadata.tags) ? metadata.tags : [],
            location: location,
            takenAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            noteText: ''
        };

        this.media.push(item);
        this._save();
        return item;
    }

    /**
     * Add a document (PDF, image, doc) to an order.
     * @param {string} orderId - linked Auftrag ID
     * @param {File} file - the File object from file input
     * @param {object} metadata - { caption, category, tags, orderName, customerId, customerName }
     * @returns {Promise<object>} the created MediaItem
     */
    async addDocument(orderId, file, metadata) {
        metadata = metadata || {};

        const fileData = await this._readFileAsDataUrl(file);

        // Determine file type
        let fileType = 'sonstiges';
        const ext = (file.name || '').split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            fileType = ext === 'jpeg' ? 'jpg' : ext;
        } else if (ext === 'pdf') {
            fileType = 'pdf';
        } else if (['doc', 'docx'].includes(ext)) {
            fileType = 'doc';
        }

        // Create thumbnail for images, empty for other types
        let thumbnail = '';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            thumbnail = await this.createThumbnail(fileData);
        }

        const item = {
            id: this._generateId(),
            orderId: orderId || '',
            orderName: metadata.orderName || '',
            customerId: metadata.customerId || '',
            customerName: metadata.customerName || '',
            type: 'document',
            dataUrl: '',
            thumbnail: thumbnail,
            fileName: file.name || 'Dokument',
            fileType: fileType,
            fileSize: file.size || 0,
            fileData: fileData,
            caption: metadata.caption || file.name || '',
            category: metadata.category || 'sonstiges',
            tags: Array.isArray(metadata.tags) ? metadata.tags : [],
            location: null,
            takenAt: '',
            createdAt: new Date().toISOString(),
            noteText: ''
        };

        this.media.push(item);
        this._save();
        return item;
    }

    /**
     * Add a text note to an order.
     * @param {string} orderId - linked Auftrag ID
     * @param {string} text - the note text
     * @param {object} metadata - { caption, category, tags, orderName, customerId, customerName }
     * @returns {object} the created MediaItem
     */
    addNote(orderId, text, metadata) {
        metadata = metadata || {};

        const item = {
            id: this._generateId(),
            orderId: orderId || '',
            orderName: metadata.orderName || '',
            customerId: metadata.customerId || '',
            customerName: metadata.customerName || '',
            type: 'note',
            dataUrl: '',
            thumbnail: '',
            fileName: '',
            fileType: '',
            fileSize: 0,
            fileData: '',
            caption: metadata.caption || 'Notiz',
            category: metadata.category || 'sonstiges',
            tags: Array.isArray(metadata.tags) ? metadata.tags : [],
            location: null,
            takenAt: '',
            createdAt: new Date().toISOString(),
            noteText: text || ''
        };

        this.media.push(item);
        this._save();
        return item;
    }

    // ============================================
    // File Helpers
    // ============================================

    _readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
            reader.readAsDataURL(file);
        });
    }

    // ============================================
    // Retrieve
    // ============================================

    /**
     * Get all media items for a specific order.
     * @param {string} orderId
     * @returns {Array} media items sorted newest first
     */
    getMediaForOrder(orderId) {
        return this.media
            .filter(m => m.orderId === orderId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Get media items for an order filtered by category.
     * @param {string} orderId
     * @param {string} category
     * @returns {Array}
     */
    getMediaByCategory(orderId, category) {
        return this.media
            .filter(m => m.orderId === orderId && m.category === category)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Get all media items across all orders.
     * @returns {Array} all media sorted newest first
     */
    getAllMedia() {
        return [...this.media].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Get a single media item by ID.
     * @param {string} id
     * @returns {object|null}
     */
    getMediaItem(id) {
        return this.media.find(m => m.id === id) || null;
    }

    // ============================================
    // Update & Delete
    // ============================================

    /**
     * Update a media item's metadata.
     * @param {string} id
     * @param {object} data - fields to update (caption, category, tags, noteText, etc.)
     * @returns {object|null} updated item or null if not found
     */
    updateMedia(id, data) {
        const item = this.media.find(m => m.id === id);
        if (!item) { return null; }

        if (data.caption !== undefined) { item.caption = data.caption; }
        if (data.category !== undefined) { item.category = data.category; }
        if (data.tags !== undefined) { item.tags = data.tags; }
        if (data.noteText !== undefined) { item.noteText = data.noteText; }
        if (data.orderName !== undefined) { item.orderName = data.orderName; }
        if (data.customerId !== undefined) { item.customerId = data.customerId; }
        if (data.customerName !== undefined) { item.customerName = data.customerName; }

        this._save();
        return item;
    }

    /**
     * Delete a media item by ID.
     * @param {string} id
     * @returns {boolean} true if deleted
     */
    deleteMedia(id) {
        const index = this.media.findIndex(m => m.id === id);
        if (index === -1) { return false; }

        this.media.splice(index, 1);
        this._save();
        return true;
    }

    // ============================================
    // Bulk / Storage
    // ============================================

    /**
     * Get approximate total storage used by job media in bytes.
     * @returns {number}
     */
    getStorageUsed() {
        const raw = localStorage.getItem('mhs_job_media') || '';
        return raw.length * 2; // UTF-16 characters = ~2 bytes each
    }

    /**
     * Get total number of media items.
     * @returns {number}
     */
    getMediaCount() {
        return this.media.length;
    }

    /**
     * Remove media items older than a given number of days.
     * @param {number} olderThanDays - threshold in days
     * @returns {number} number of items removed
     */
    cleanupOldMedia(olderThanDays) {
        olderThanDays = olderThanDays || 90;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);
        const cutoffStr = cutoff.toISOString();

        const before = this.media.length;
        this.media = this.media.filter(m => m.createdAt >= cutoffStr);
        const removed = before - this.media.length;

        if (removed > 0) { this._save(); }
        return removed;
    }

    // ============================================
    // Export
    // ============================================

    /**
     * Export all photos and media for a specific order.
     * @param {string} orderId
     * @returns {Array} array of { id, type, dataUrl/fileData, caption, category, createdAt }
     */
    exportOrderPhotos(orderId) {
        const items = this.getMediaForOrder(orderId);
        return items.map(m => ({
            id: m.id,
            type: m.type,
            caption: m.caption,
            category: m.category,
            createdAt: m.createdAt,
            dataUrl: m.type === 'photo' ? m.dataUrl : '',
            fileData: m.type === 'document' ? m.fileData : '',
            fileName: m.fileName,
            noteText: m.noteText
        }));
    }

    // ============================================
    // Search
    // ============================================

    /**
     * Search media by caption, tags, order name, or customer name.
     * @param {string} query
     * @returns {Array}
     */
    searchMedia(query) {
        const q = (query || '').toLowerCase();
        if (!q) { return this.getAllMedia(); }

        return this.media.filter(m =>
            (m.caption || '').toLowerCase().includes(q) ||
            (m.orderName || '').toLowerCase().includes(q) ||
            (m.customerName || '').toLowerCase().includes(q) ||
            (m.noteText || '').toLowerCase().includes(q) ||
            (m.tags || []).some(t => t.toLowerCase().includes(q))
        ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // ============================================
    // Statistics
    // ============================================

    /**
     * Get media statistics.
     * @returns {object} { total, photos, documents, notes, byCategory, storageUsed }
     */
    getStatistics() {
        const byCategory = {};
        this.media.forEach(m => {
            byCategory[m.category] = (byCategory[m.category] || 0) + 1;
        });

        return {
            total: this.media.length,
            photos: this.media.filter(m => m.type === 'photo').length,
            documents: this.media.filter(m => m.type === 'document').length,
            notes: this.media.filter(m => m.type === 'note').length,
            byCategory: byCategory,
            storageUsed: this.getStorageUsed()
        };
    }

    // ============================================
    // Format Helpers
    // ============================================

    /**
     * Format byte size to human readable string.
     * @param {number} bytes
     * @returns {string}
     */
    formatFileSize(bytes) {
        if (!bytes || bytes < 0) { return '0 B'; }
        if (bytes < 1024) { return bytes + ' B'; }
        if (bytes < 1024 * 1024) { return (bytes / 1024).toFixed(1) + ' KB'; }
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

window.jobMediaService = new JobMediaService();
