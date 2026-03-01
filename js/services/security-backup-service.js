/* ============================================
   Security & Backup Service (Feature #30)
   Data encryption, backup, and GDPR compliance
   ============================================ */

class SecurityBackupService {
    constructor() {
        this.backups = JSON.parse(localStorage.getItem('freyai_backup_log') || '[]');
        this.settings = JSON.parse(localStorage.getItem('freyai_security_settings') || '{}');
        this.activityLog = JSON.parse(localStorage.getItem('freyai_activity_log') || '[]');

        // Default settings
        if (!this.settings.autoBackup) {this.settings.autoBackup = true;}
        if (!this.settings.backupInterval) {this.settings.backupInterval = 'daily';}
        if (!this.settings.encryptBackups) {this.settings.encryptBackups = true;}
        if (!this.settings.maxBackups) {this.settings.maxBackups = 10;}
        if (!this.settings.gdprRetentionDays) {this.settings.gdprRetentionDays = 365 * 10;} // 10 years

        // Start auto-backup scheduler
        this.startAutoBackup();
    }

    // =====================================================
    // DATA ENCRYPTION
    // =====================================================

    // Generate encryption key from password
    async deriveKey(password) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: crypto.getRandomValues(new Uint8Array(16)),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    // Encrypt data
    async encryptData(data, password) {
        try {
            const key = await this.deriveKey(password);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encoder = new TextEncoder();

            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encoder.encode(JSON.stringify(data))
            );

            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            return {
                success: true,
                data: this.arrayBufferToBase64(combined)
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Decrypt data
    async decryptData(encryptedBase64, password) {
        try {
            const key = await this.deriveKey(password);
            const combined = this.base64ToArrayBuffer(encryptedBase64);

            const iv = combined.slice(0, 12);
            const data = combined.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                data
            );

            const decoder = new TextDecoder();
            return {
                success: true,
                data: JSON.parse(decoder.decode(decrypted))
            };
        } catch (error) {
            return { success: false, error: 'Entschlüsselung fehlgeschlagen - falsches Passwort?' };
        }
    }

    // =====================================================
    // BACKUP SYSTEM
    // =====================================================

    // Get all FreyAI Visions data from localStorage
    getAllData() {
        const data = {};
        const keys = Object.keys(localStorage).filter(k => k.startsWith('freyai_'));

        keys.forEach(key => {
            try {
                data[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
                data[key] = localStorage.getItem(key);
            }
        });

        return data;
    }

    // Create a full backup
    async createBackup(password = null) {
        const data = this.getAllData();

        const backup = {
            id: 'backup-' + Date.now(),
            version: '2.0',
            createdAt: new Date().toISOString(),
            dataKeys: Object.keys(data),
            recordCounts: this.getRecordCounts(data),
            encrypted: !!password,
            data: null
        };

        // Encrypt if password provided
        if (password && this.settings.encryptBackups) {
            const encrypted = await this.encryptData(data, password);
            if (encrypted.success) {
                backup.data = encrypted.data;
            } else {
                return { success: false, error: 'Verschlüsselung fehlgeschlagen' };
            }
        } else {
            backup.data = JSON.stringify(data);
        }

        // Log backup
        this.backups.push({
            id: backup.id,
            createdAt: backup.createdAt,
            encrypted: backup.encrypted,
            recordCounts: backup.recordCounts,
            size: backup.data.length
        });

        // Keep only last X backups in log
        if (this.backups.length > this.settings.maxBackups) {
            this.backups = this.backups.slice(-this.settings.maxBackups);
        }

        this.saveSettings();

        return { success: true, backup };
    }

    // Download backup as file
    async downloadBackup(password = null) {
        const result = await this.createBackup(password);
        if (!result.success) {return result;}

        const backup = result.backup;
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `FreyAI_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.logActivity('backup_created', { encrypted: backup.encrypted });

        return { success: true, message: 'Backup erfolgreich erstellt' };
    }

    // Restore from backup
    async restoreBackup(backupJson, password = null) {
        try {
            const backup = typeof backupJson === 'string' ? JSON.parse(backupJson) : backupJson;

            if (!backup.data || !backup.id) {
                return { success: false, error: 'Ungültiges Backup-Format' };
            }

            let data;
            if (backup.encrypted) {
                if (!password) {
                    return { success: false, error: 'Passwort erforderlich für verschlüsseltes Backup' };
                }
                const decrypted = await this.decryptData(backup.data, password);
                if (!decrypted.success) {
                    return decrypted;
                }
                data = decrypted.data;
            } else {
                data = JSON.parse(backup.data);
            }

            // Restore all data
            for (const [key, value] of Object.entries(data)) {
                localStorage.setItem(key, JSON.stringify(value));
            }

            this.logActivity('backup_restored', { backupId: backup.id });

            return {
                success: true,
                message: 'Backup erfolgreich wiederhergestellt. Seite wird neu geladen...',
                needsReload: true
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get record counts for statistics
    getRecordCounts(data) {
        const counts = {};
        for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value)) {
                counts[key] = value.length;
            } else if (typeof value === 'object') {
                counts[key] = Object.keys(value).length;
            }
        }
        return counts;
    }

    // =====================================================
    // AUTO-BACKUP
    // =====================================================

    startAutoBackup() {
        if (!this.settings.autoBackup) {return;}

        // Check backup status on load
        setTimeout(() => this.checkAutoBackupNeeded(), 10000);

        // Check every hour
        setInterval(() => this.checkAutoBackupNeeded(), 3600000);
    }

    checkAutoBackupNeeded() {
        if (!this.settings.autoBackup) {return;}

        const lastBackup = this.backups[this.backups.length - 1];
        const now = new Date();

        let needsBackup = false;

        if (!lastBackup) {
            needsBackup = true;
        } else {
            const lastDate = new Date(lastBackup.createdAt);
            const hoursSince = (now - lastDate) / (1000 * 60 * 60);

            switch (this.settings.backupInterval) {
                case 'hourly': needsBackup = hoursSince >= 1; break;
                case 'daily': needsBackup = hoursSince >= 24; break;
                case 'weekly': needsBackup = hoursSince >= 168; break;
            }
        }

        if (needsBackup) {
            this.createAutoBackup();
        }
    }

    async createAutoBackup() {
        // Store backup in localStorage (compressed)
        const data = this.getAllData();
        const backup = {
            id: 'auto-' + Date.now(),
            createdAt: new Date().toISOString(),
            data: JSON.stringify(data)
        };

        // Store in IndexedDB if available, otherwise localStorage
        const existingAutoBackups = JSON.parse(localStorage.getItem('freyai_auto_backups') || '[]');
        existingAutoBackups.push(backup);

        // Keep last 3 auto-backups
        while (existingAutoBackups.length > 3) {
            existingAutoBackups.shift();
        }

        localStorage.setItem('freyai_auto_backups', JSON.stringify(existingAutoBackups));
        console.log('Auto-backup created:', backup.id);
    }

    // Get auto backups
    getAutoBackups() {
        return JSON.parse(localStorage.getItem('freyai_auto_backups') || '[]');
    }

    // =====================================================
    // GDPR COMPLIANCE
    // =====================================================

    // Export all customer data (GDPR Article 20 - Data Portability)
    async exportCustomerData(customerId) {
        const data = this.getAllData();
        const customerData = {
            exportedAt: new Date().toISOString(),
            customerId: customerId,
            customer: null,
            invoices: [],
            appointments: [],
            communications: [],
            documents: []
        };

        // Find customer
        if (data.freyai_customers) {
            customerData.customer = data.freyai_customers.find(c => c.id === customerId);
        }

        // Find related invoices
        if (data.freyai_rechnungen) {
            customerData.invoices = data.freyai_rechnungen.filter(r =>
                r.kundeId === customerId || r.kunde === customerId
            );
        }

        // Find appointments
        if (data.freyai_appointments) {
            customerData.appointments = data.freyai_appointments.filter(a =>
                a.customerId === customerId || a.kundeId === customerId
            );
        }

        // Find communications
        if (data.freyai_communications) {
            customerData.communications = data.freyai_communications.filter(c =>
                c.customerId === customerId
            );
        }

        // Also fetch from Supabase if available
        const sb = window.supabaseConfig?.get?.();
        if (sb) {
            try {
                const { data: sbKunde } = await sb.from('kunden').select('*').eq('id', customerId).single();
                if (sbKunde) { customerData.customer = sbKunde; }
                const { data: sbRech } = await sb.from('rechnungen').select('*').or(`kunde_id.eq.${customerId}`);
                if (sbRech) { customerData.invoices = [...customerData.invoices, ...sbRech]; }
                const { data: sbComm } = await sb.from('communication_log').select('*').eq('kunde_id', customerId);
                if (sbComm) { customerData.communications = [...customerData.communications, ...sbComm]; }
            } catch (e) { /* Supabase not available, local data only */ }
        }

        return customerData;
    }

    // Delete all customer data (GDPR Article 17 - Right to Erasure)
    async deleteCustomerData(customerId) {
        const keysToCheck = [
            'freyai_customers',
            'freyai_rechnungen',
            'freyai_appointments',
            'freyai_communications',
            'freyai_leads',
            'freyai_buchungen'
        ];

        let deletedCount = 0;

        // 1. Delete from localStorage
        keysToCheck.forEach(key => {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(data)) {
                const filtered = data.filter(item =>
                    item.id !== customerId &&
                    item.kundeId !== customerId &&
                    item.customerId !== customerId
                );
                deletedCount += data.length - filtered.length;
                localStorage.setItem(key, JSON.stringify(filtered));
            }
        });

        // 2. Delete from Supabase (cascade across all related tables)
        const sb = window.supabaseConfig?.get?.();
        if (sb) {
            const supabaseTables = [
                { table: 'communication_log', field: 'kunde_id' },
                { table: 'zeiteintraege', field: 'auftrag_id' },
                { table: 'rechnungen', field: 'kunde_name' },
                { table: 'auftraege', field: 'kunde_name' },
                { table: 'angebote', field: 'kunde_name' },
                { table: 'anfragen', field: 'kunde_name' },
                { table: 'kunden', field: 'id' }
            ];
            for (const { table, field } of supabaseTables) {
                try {
                    const { error } = await sb.from(table).delete().eq(field, customerId);
                    if (!error) { deletedCount++; }
                } catch (e) { /* table may not exist or field mismatch - continue */ }
            }
        }

        // 3. Delete from IndexedDB via db-service
        if (window.dbService?.deleteCustomer) {
            try { await window.dbService.deleteCustomer(customerId); } catch (e) { /* OK */ }
        }

        this.logActivity('gdpr_delete', { customerId, deletedCount });

        return { success: true, deletedCount };
    }

    // Anonymize customer data (alternative to deletion)
    anonymizeCustomerData(customerId) {
        if (!window.customerService) {return { success: false };}

        const customer = window.customerService.getCustomer(customerId);
        if (!customer) {return { success: false, error: 'Kunde nicht gefunden' };}

        // Anonymize personal data
        const anonymized = {
            name: 'Anonymisiert',
            email: 'anonymized@example.com',
            telefon: '000000000',
            adresse: 'Anonymisiert',
            strasse: '',
            plz: '00000',
            ort: 'Anonymisiert',
            notizen: '[Daten anonymisiert gem. DSGVO]',
            anonymizedAt: new Date().toISOString()
        };

        window.customerService.updateCustomer(customerId, anonymized);
        this.logActivity('gdpr_anonymize', { customerId });

        return { success: true };
    }

    // =====================================================
    // ACTIVITY LOGGING (Audit Trail)
    // =====================================================

    logActivity(action, details = {}) {
        this.activityLog.push({
            id: 'log-' + Date.now(),
            action,
            details,
            timestamp: new Date().toISOString(),
            user: window.adminPanelService?.getRoleLabel?.() || window.authService?.getUser?.()?.email || 'unknown'
        });

        // Keep last 1000 entries
        if (this.activityLog.length > 1000) {
            this.activityLog = this.activityLog.slice(-1000);
        }

        localStorage.setItem('freyai_activity_log', JSON.stringify(this.activityLog));
    }

    getActivityLog(limit = 100, action = null) {
        let log = [...this.activityLog];
        if (action) {
            log = log.filter(l => l.action === action);
        }
        return log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    }

    // =====================================================
    // ACCESS CONTROL (Basic)
    // =====================================================

    // PIN protection with SHA-256 + Salt
    async setPinCode(pin) {
        const salt = this._generatePinSalt();
        const hash = await this._hashPin(pin, salt);
        this.settings.pinHash = hash;
        this.settings.pinSalt = salt;
        this.saveSettings();
        return { success: true };
    }

    async verifyPin(pin) {
        if (!this.settings.pinHash) {return true;} // No PIN set

        // Migrate legacy DJB2 hash (no salt) → SHA-256 + salt
        if (!this.settings.pinSalt) {
            const legacyHash = this._legacyHashPin(pin);
            if (legacyHash === this.settings.pinHash) {
                await this.setPinCode(pin); // Re-hash with SHA-256
                return true;
            }
            return false;
        }

        const hash = await this._hashPin(pin, this.settings.pinSalt);
        return hash === this.settings.pinHash;
    }

    async _hashPin(pin, salt) {
        const encoder = new TextEncoder();
        const data = encoder.encode(salt + pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    _generatePinSalt() {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    _legacyHashPin(pin) {
        let hash = 0;
        for (let i = 0; i < pin.length; i++) {
            const char = pin.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    // =====================================================
    // UTILITIES
    // =====================================================

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // Get storage usage
    getStorageUsage() {
        let total = 0;
        let freyaiTotal = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            const size = (key.length + value.length) * 2; // UTF-16
            total += size;
            if (key.startsWith('freyai_')) {
                freyaiTotal += size;
            }
        }

        return {
            totalBytes: total,
            freyaiBytes: freyaiTotal,
            totalMB: (total / 1024 / 1024).toFixed(2),
            freyaiMB: (freyaiTotal / 1024 / 1024).toFixed(2),
            percentUsed: ((total / (5 * 1024 * 1024)) * 100).toFixed(1) // Assuming 5MB limit
        };
    }

    // Get backup history
    getBackupHistory() {
        return this.backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    saveSettings() {
        localStorage.setItem('freyai_security_settings', JSON.stringify(this.settings));
        localStorage.setItem('freyai_backup_log', JSON.stringify(this.backups));
    }
}

window.securityBackupService = new SecurityBackupService();
