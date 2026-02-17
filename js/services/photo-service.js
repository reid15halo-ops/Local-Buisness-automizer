/* ============================================
   Photo Documentation Service
   Capture and attach photos to jobs
   ============================================ */

class PhotoService {
    constructor() {
        this.photos = JSON.parse(localStorage.getItem('freyai_photos') || '[]');
        this.settings = JSON.parse(localStorage.getItem('freyai_photo_settings') || '{}');

        // Default settings
        if (!this.settings.maxPhotoSize) {this.settings.maxPhotoSize = 1024 * 1024;} // 1MB
        if (!this.settings.compressionQuality) {this.settings.compressionQuality = 0.7;}
        if (!this.settings.defaultCategory) {this.settings.defaultCategory = 'documentation';}
    }

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

            // Save photo
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
                    const result = this.savePhoto(compressedDataUrl, referenceData);
                    resolve(result);
                });
            };

            reader.onerror = () => {
                resolve({ success: false, error: 'File read error' });
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

    // Save photo to storage
    savePhoto(dataUrl, referenceData) {
        const photo = {
            id: 'photo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            dataUrl: dataUrl,
            referenceType: referenceData.type || null, // auftrag, rechnung, termin, kunde
            referenceId: referenceData.id || null,
            category: referenceData.category || this.settings.defaultCategory,
            title: referenceData.title || 'Foto',
            description: referenceData.description || '',
            tags: referenceData.tags || [],
            location: referenceData.location || null,
            timestamp: new Date().toISOString(),
            metadata: {
                size: Math.round(dataUrl.length * 0.75), // Approximate bytes
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

    // Get photos by category
    getPhotosByCategory(category) {
        return this.photos.filter(p => p.category === category);
    }

    // Get photo by ID
    getPhoto(id) {
        return this.photos.find(p => p.id === id);
    }

    // Update photo metadata
    updatePhoto(id, updates) {
        const photo = this.photos.find(p => p.id === id);
        if (!photo) {return { success: false };}

        if (updates.title) {photo.title = updates.title;}
        if (updates.description) {photo.description = updates.description;}
        if (updates.category) {photo.category = updates.category;}
        if (updates.tags) {photo.tags = updates.tags;}

        this.save();
        return { success: true, photo };
    }

    // Delete photo
    deletePhoto(id) {
        const index = this.photos.findIndex(p => p.id === id);
        if (index === -1) {return { success: false };}

        this.photos.splice(index, 1);
        this.save();
        return { success: true };
    }

    // Search photos by tag or title
    searchPhotos(query) {
        const q = query.toLowerCase();
        return this.photos.filter(p =>
            p.title.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.tags.some(t => t.toLowerCase().includes(q))
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

        if (removedCount > 0) {this.save();}
        return removedCount;
    }

    // Persistence
    save() {
        try {
            localStorage.setItem('freyai_photos', JSON.stringify(this.photos));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.error('Storage quota exceeded. Clearing old photos...');
                this.clearOldPhotos(30);
                localStorage.setItem('freyai_photos', JSON.stringify(this.photos));
            }
        }
    }
}

window.photoService = new PhotoService();
