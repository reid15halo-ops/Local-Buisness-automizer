/* ============================================
   Barcode Scanner Service
   Scan barcodes for inventory management
   ============================================ */

class BarcodeService {
    constructor() {
        this.scanHistory = JSON.parse(localStorage.getItem('freyai_scan_history') || '[]');
        this.productDatabase = JSON.parse(localStorage.getItem('freyai_barcode_products') || '{}');
        this.settings = JSON.parse(localStorage.getItem('freyai_barcode_settings') || '{}');

        // Default settings
        if (!this.settings.soundEnabled) {this.settings.soundEnabled = true;}
        if (!this.settings.vibrationEnabled) {this.settings.vibrationEnabled = true;}
        if (!this.settings.autoAddToInventory) {this.settings.autoAddToInventory = true;}
    }

    // Start camera-based barcode scanning
    async startScanning(videoElement, onScan) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });

            videoElement.srcObject = stream;
            await videoElement.play();

            // Use BarcodeDetector API if available
            if ('BarcodeDetector' in window) {
                const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code'] });

                const scanFrame = async () => {
                    try {
                        const barcodes = await detector.detect(videoElement);
                        if (barcodes.length > 0) {
                            const barcode = barcodes[0];
                            this.handleScan(barcode.rawValue, barcode.format, onScan);
                        }
                    } catch (e) {
                        console.log('Scan error:', e);
                    }

                    if (videoElement.srcObject) {
                        requestAnimationFrame(scanFrame);
                    }
                };

                requestAnimationFrame(scanFrame);
            } else {
                console.warn('BarcodeDetector not available. Manual input required.');
                return { success: false, error: 'BarcodeDetector not supported' };
            }

            return { success: true, stream };

        } catch (error) {
            console.error('Scanner error:', error);
            return { success: false, error: error.message };
        }
    }

    // Stop scanning
    stopScanning(videoElement) {
        if (videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
        }
    }

    // Handle scanned barcode
    handleScan(code, format, callback) {
        // Feedback
        if (this.settings.soundEnabled) {
            this.playBeep();
        }
        if (this.settings.vibrationEnabled && navigator.vibrate) {
            navigator.vibrate(100);
        }

        // Log scan
        const scanRecord = {
            id: 'scan-' + Date.now(),
            code: code,
            format: format,
            timestamp: new Date().toISOString(),
            action: null
        };
        this.scanHistory.push(scanRecord);
        this.saveScanHistory();

        // Look up product
        const product = this.lookupProduct(code);

        // Call callback with result
        if (callback) {
            callback({
                code: code,
                format: format,
                product: product,
                isKnown: !!product
            });
        }

        // Auto-actions
        if (product && this.settings.autoAddToInventory) {
            this.addToInventory(code, 1);
        }

        return { code, format, product };
    }

    // Manual barcode entry
    manualEntry(code) {
        return this.handleScan(code, 'manual', null);
    }

    // Look up product by barcode
    lookupProduct(code) {
        // Check local database
        if (this.productDatabase[code]) {
            return this.productDatabase[code];
        }

        // Check material service
        if (window.materialService) {
            const materials = window.materialService.materials || [];
            const material = materials.find(m => m.barcode === code || m.artikelnummer === code);
            if (material) {
                return {
                    id: material.id,
                    name: material.name,
                    type: 'material',
                    unit: material.einheit,
                    price: material.preis,
                    stock: material.bestand
                };
            }
        }

        return null;
    }

    // Register new product
    registerProduct(code, productData) {
        this.productDatabase[code] = {
            ...productData,
            barcode: code,
            registeredAt: new Date().toISOString()
        };
        this.saveProductDatabase();

        return { success: true, product: this.productDatabase[code] };
    }

    // Add to inventory (increase stock)
    addToInventory(code, quantity = 1) {
        if (window.materialService) {
            const materials = window.materialService.materials || [];
            const material = materials.find(m => m.barcode === code || m.artikelnummer === code);

            if (material) {
                window.materialService.updateStock(material.id, material.bestand + quantity);
                return { success: true, newStock: material.bestand + quantity };
            }
        }
        return { success: false, error: 'Product not found' };
    }

    // Remove from inventory (decrease stock)
    removeFromInventory(code, quantity = 1) {
        if (window.materialService) {
            const materials = window.materialService.materials || [];
            const material = materials.find(m => m.barcode === code || m.artikelnummer === code);

            if (material) {
                const newStock = Math.max(0, material.bestand - quantity);
                window.materialService.updateStock(material.id, newStock);
                return { success: true, newStock };
            }
        }
        return { success: false, error: 'Product not found' };
    }

    // Generate barcode for product
    generateBarcode(productId, type = 'custom') {
        // Generate a custom barcode (FreyAI prefix + timestamp)
        const code = `FREY${Date.now().toString().slice(-10)}`;
        return code;
    }

    // Play beep sound
    playBeep() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 1000;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            console.log('Audio not available');
        }
    }

    // Get scan history
    getScanHistory(limit = 50) {
        return this.scanHistory
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    // Get statistics
    getStatistics() {
        return {
            totalScans: this.scanHistory.length,
            todayScans: this.scanHistory.filter(s =>
                s.timestamp.startsWith(new Date().toISOString().split('T')[0])
            ).length,
            registeredProducts: Object.keys(this.productDatabase).length,
            uniqueBarcodesScanned: [...new Set(this.scanHistory.map(s => s.code))].length
        };
    }

    // Check if barcode detector is supported
    isSupported() {
        return 'BarcodeDetector' in window;
    }

    // Get supported barcode formats
    async getSupportedFormats() {
        if ('BarcodeDetector' in window) {
            return await BarcodeDetector.getSupportedFormats();
        }
        return [];
    }

    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('freyai_barcode_settings', JSON.stringify(this.settings));
    }

    // Persistence
    saveScanHistory() {
        // Keep last 500 scans
        if (this.scanHistory.length > 500) {
            this.scanHistory = this.scanHistory.slice(-500);
        }
        localStorage.setItem('freyai_scan_history', JSON.stringify(this.scanHistory));
    }

    saveProductDatabase() {
        localStorage.setItem('freyai_barcode_products', JSON.stringify(this.productDatabase));
    }
}

window.barcodeService = new BarcodeService();
