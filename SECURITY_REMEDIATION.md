# Security Remediation Guide

This document provides specific code fixes and recommendations for addressing the security issues identified in the audit report.

---

## 1. NPM Vulnerability Fixes

### Step 1: Update Vulnerable Packages

```bash
# Run the automated fix
npm audit fix

# For breaking changes (esbuild/vitest)
npm audit fix --force

# Verify all vulnerabilities are gone
npm audit
```

**Expected Output:** "0 vulnerabilities" after fixes

**Files to Update in package.json:**
- rollup → update to latest (>4.58.0)
- minimatch → update to latest (>10.2.2)
- esbuild → update to latest (>0.24.2)
- vite → update to latest
- vitest → update to latest

---

## 2. XSS Prevention - innerHTML Sanitization

### Pattern 1: Simple Text Content

**Current Code (BAD):**
```javascript
container.innerHTML = userData.name;  // XSS vulnerability!
```

**Fixed Code:**
```javascript
container.innerHTML = window.sanitize.escapeHtml(userData.name);
// OR use textContent for plain text:
container.textContent = userData.name;  // Auto-escapes
```

### Pattern 2: Template Literals with User Data

**Current Code (BAD):**
```javascript
container.innerHTML = `
    <div class="card">
        <h2>${user.name}</h2>
        <p>${user.email}</p>
    </div>
`;
```

**Fixed Code:**
```javascript
container.innerHTML = `
    <div class="card">
        <h2>${window.sanitize.escapeHtml(user.name)}</h2>
        <p>${window.sanitize.escapeAttr(user.email)}</p>
    </div>
`;
```

### Pattern 3: Dynamic Content Lists

**Current Code (BAD):**
```javascript
container.innerHTML = users.map(u => `
    <div class="user-item">
        <span>${u.name}</span>
    </div>
`).join('');
```

**Fixed Code:**
```javascript
const sanitize = window.sanitize;
container.innerHTML = users.map(u => `
    <div class="user-item">
        <span>${sanitize.escapeHtml(u.name)}</span>
    </div>
`).join('');
```

### Pattern 4: Using textContent Instead

**Best Practice - Use textContent when possible:**
```javascript
// For plain text content, textContent auto-escapes:
container.textContent = userData.name;

// For complex HTML structure, use sanitized innerHTML:
container.innerHTML = sanitize.escapeHtml(userData.name);
```

### Automated Fix Script

Create `fix-xss.js` to find all problematic innerHTML usages:

```javascript
// Run in console or add to test suite
const findXSSVulnerabilities = () => {
    const files = [
        'js/new-features-ui.js',
        'js/excel-import-integration.js',
        'js/app-new.js',
        // ... add all 59 files
    ];

    console.log('Files requiring innerHTML review:');
    files.forEach(file => {
        console.log(`- Check ${file} for unsanitized innerHTML`);
    });
};
```

---

## 3. Credentials Security - Remove from localStorage

### Current Problem

```javascript
// ❌ INSECURE - in js/services/email-service.js
class EmailService {
    setEmailConfig(config) {
        this.emailConfig = {
            email: config.email || '',
            password: config.password || '',  // PLAINTEXT!
        };
        this.saveConfig();  // Saved to localStorage!
    }

    saveConfig() {
        localStorage.setItem('freyai_email_config', JSON.stringify(this.emailConfig));
    }
}
```

### Solution 1: Use Backend for Credential Storage

**Backend (Supabase Edge Function):**
```javascript
// supabase/functions/store-email-config/index.ts
import { serve } from "https://deno.land/std@0.131.0/http/server.ts"

serve(async (req) => {
    const { email, password } = await req.json()

    // Store credentials securely in Supabase encrypted column
    const { data, error } = await supabaseClient
        .from('email_configs')
        .upsert({
            user_id: user.id,
            email: email,
            password: password,  // Will be encrypted by Supabase
            encrypted: true
        })

    return new Response(JSON.stringify({ success: !error }))
})
```

**Frontend:**
```javascript
// ✅ SECURE - Store only session token
class EmailService {
    async setEmailConfig(config) {
        // Send to backend instead of storing locally
        const response = await fetch(
            `${this.supabaseUrl}/functions/v1/store-email-config`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            }
        );

        if (response.ok) {
            this.configStored = true;  // Only mark as stored, don't keep config locally
        }
    }

    // Don't store credentials locally
    saveConfig() {
        // Remove this method or make it a no-op
        // localStorage.removeItem('freyai_email_config');
    }
}
```

### Solution 2: Use Temporary Session Token

**If backend storage not possible:**

```javascript
// ❌ AVOID THIS - Still risky
class EmailService {
    async setEmailConfig(config) {
        // Generate temporary token
        const tempToken = generateTemporaryToken(config);

        // Store only the token, not the credentials
        sessionStorage.setItem('email_config_token', tempToken);
        // sessionStorage clears on browser close
    }
}
```

### Solution 3: Encrypt Sensitive Data (Last Resort)

```javascript
// If you must store credentials locally, encrypt them
import crypto from 'crypto';  // Use TweetNaCl.js in browser

class EncryptedStorage {
    static encrypt(data, password) {
        // Use libsodium/tweetnacl for encryption
        const key = crypto.getRandomValues(new Uint8Array(32));
        const nonce = crypto.getRandomValues(new Uint8Array(24));

        // Encrypt data with key and nonce
        const encrypted = nacl.secretbox(
            nacl.util.decodeUTF8(JSON.stringify(data)),
            nonce,
            key
        );

        // Store: base64(encrypted || nonce)
        return {
            ciphertext: nacl.util.encodeBase64(encrypted),
            nonce: nacl.util.encodeBase64(nonce),
            // Key should be kept in memory only, not stored
        };
    }
}

// ❌ NOT RECOMMENDED - Key storage is still a problem
```

**Recommendation:** Use Solution 1 (backend storage) - it's the most secure.

---

## 4. Input Validation Enhancement

### Current Implementation (Insufficient)

```javascript
// sanitize-service.js
sanitizeEmail(email) {
    return email.trim().toLowerCase().replace(/[^a-z0-9@._+\-]/g, '');
}
// Problem: No validation that it's actually an email format
```

### Enhanced Implementation

```javascript
const SanitizeService = {
    // RFC 5322 Email validation (simplified)
    isValidEmail(email) {
        if (typeof email !== 'string') return false;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return false;

        // Additional checks
        const [localPart, domain] = email.split('@');
        if (localPart.length > 64) return false;  // RFC limit
        if (domain.length > 255) return false;    // RFC limit
        if (email.length > 254) return false;     // RFC limit

        return true;
    },

    // Sanitize with validation
    sanitizeEmail(email) {
        if (!this.isValidEmail(email)) {
            throw new Error('Invalid email format');
        }
        return email.trim().toLowerCase();
    },

    // Phone number with validation
    isValidPhone(phone) {
        // German phone format: +49 or 0, followed by 9-11 digits
        const phoneRegex = /^(\+49|0)[1-9]\d{1,13}$/;
        return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
    },

    sanitizePhone(phone) {
        const cleaned = phone.replace(/[\s\-()]/g, '');
        if (!this.isValidPhone(phone)) {
            throw new Error('Invalid phone format');
        }
        return cleaned;
    },

    // URL validation with whitelist
    sanitizeUrl(url, allowedDomains = []) {
        if (typeof url !== 'string') return '';

        try {
            const parsed = new URL(url);

            // Only allow http and https
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return '';
            }

            // Check whitelist if provided
            if (allowedDomains.length > 0) {
                const isAllowed = allowedDomains.some(domain =>
                    parsed.hostname === domain ||
                    parsed.hostname.endsWith('.' + domain)
                );
                if (!isAllowed) return '';
            }

            return parsed.href;
        } catch {
            return '';
        }
    },

    // New: IBAN validation for multiple countries
    isValidIBAN(iban) {
        if (typeof iban !== 'string') return false;

        const cleaned = iban.replace(/\s/g, '').toUpperCase();

        // IBAN length check (should be 15-34 chars)
        if (cleaned.length < 15 || cleaned.length > 34) return false;

        // Country-specific checks
        const ibanLengths = {
            'DE': 22, 'FR': 27, 'GB': 22, 'IT': 27, 'ES': 24,
            'NL': 18, 'BE': 16, 'AT': 20, 'CH': 21
        };

        const country = cleaned.substring(0, 2);
        if (ibanLengths[country] && cleaned.length !== ibanLengths[country]) {
            return false;
        }

        // Validate checksum (mod-97 algorithm)
        const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
        const numeric = rearranged.replace(/[A-Z]/g, (char) =>
            (char.charCodeAt(0) - 55).toString()
        );

        return (BigInt(numeric) % 97n) === 1n;
    }
};

window.sanitize = SanitizeService;
```

### Server-Side Validation (Backend)

```javascript
// Supabase Edge Function example
serve(async (req) => {
    const { email, phone } = await req.json();

    // Server-side validation (ALWAYS do this)
    if (!isValidEmail(email)) {
        return new Response(
            JSON.stringify({ error: 'Invalid email format' }),
            { status: 400 }
        );
    }

    if (!isValidPhone(phone)) {
        return new Response(
            JSON.stringify({ error: 'Invalid phone format' }),
            { status: 400 }
        );
    }

    // Process valid data...
});

function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email) && email.length <= 254;
}

function isValidPhone(phone) {
    const regex = /^(\+49|0)[1-9]\d{1,13}$/;
    return regex.test(phone.replace(/[\s\-()]/g, ''));
}
```

---

## 5. Authentication & Session Hardening

### Current Implementation Issues

```javascript
// ❌ Problems in auth-service.js
class AuthService {
    getUser() {
        return this.user;  // Exposed to any code
    }

    isLoggedIn() {
        return !!this.user;  // No session validation
    }
    // No timeout, no CSRF, no rate limiting
}
```

### Enhanced Implementation

```javascript
class AuthService {
    constructor() {
        this.user = null;
        this.session = null;
        this.sessionTimeout = 30 * 60 * 1000;  // 30 minutes
        this.lastActivity = Date.now();
        this.listeners = [];
        this.sessionTimer = null;

        // Start session monitor
        this.startSessionMonitor();
    }

    // Session timeout protection
    startSessionMonitor() {
        // Monitor user activity
        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => {
                this.lastActivity = Date.now();
            }, { passive: true });
        });

        // Check for timeout
        this.sessionTimer = setInterval(() => {
            const elapsed = Date.now() - this.lastActivity;
            if (elapsed > this.sessionTimeout && this.user) {
                console.warn('Session timeout - logging out');
                this.logout();
            }
        }, 60000);  // Check every minute
    }

    // Get user safely
    getUser() {
        // Verify session is still valid
        if (!this.session) return null;
        return this.user;
    }

    isLoggedIn() {
        // Check both user and session validity
        if (!this.user || !this.session) return false;

        // Check if session is expired
        if (this.session.expires_at) {
            const expiresAt = new Date(this.session.expires_at);
            if (expiresAt < new Date()) {
                this.logout();
                return false;
            }
        }

        return true;
    }

    // Logout with cleanup
    async logout() {
        const client = this.getClient();
        if (client) {
            await client.auth.signOut();
        }

        this.user = null;
        this.session = null;

        // Clear sensitive data
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
        }

        this._notify();
    }

    // CSRF token generation
    generateCSRFToken() {
        const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        sessionStorage.setItem('csrf_token', token);
        return token;
    }

    // CSRF token validation (use in forms)
    getCSRFToken() {
        let token = sessionStorage.getItem('csrf_token');
        if (!token) {
            token = this.generateCSRFToken();
        }
        return token;
    }
}
```

### CSRF Protection in Forms

```html
<!-- In HTML form -->
<form method="POST" action="/api/update-profile">
    <!-- Add CSRF token -->
    <input type="hidden" name="csrf_token" id="csrf_token" />

    <!-- Form fields -->
    <input type="email" name="email" required />
    <button type="submit">Update</button>
</form>

<script>
// Populate CSRF token
document.getElementById('csrf_token').value = window.authService.getCSRFToken();

// Validate CSRF on submit
document.querySelector('form').addEventListener('submit', (e) => {
    const token = document.getElementById('csrf_token').value;
    const expected = sessionStorage.getItem('csrf_token');

    if (token !== expected) {
        e.preventDefault();
        alert('Security validation failed. Please refresh and try again.');
    }
});
</script>
```

---

## 6. Data Export/Import Security

### Enhanced Validation

```javascript
class DataExportService {
    constructor() {
        this.exportVersion = '2.0';
        this.maxFileSize = 50 * 1024 * 1024;  // 50MB limit
        this.encryptionKey = null;
    }

    /**
     * Enhanced import with validation
     */
    async importFromJSON(file) {
        return new Promise((resolve, reject) => {
            // 1. Check file size
            if (file.size > this.maxFileSize) {
                reject(new Error(`File too large. Max: ${this.maxFileSize / 1024 / 1024}MB`));
                return;
            }

            const reader = new FileReader();

            reader.onload = async (event) => {
                try {
                    const importData = JSON.parse(event.target.result);

                    // 2. Validate structure
                    if (!importData.metadata || !importData.data) {
                        throw new Error('Invalid backup format');
                    }

                    // 3. Validate metadata
                    this.validateMetadata(importData.metadata);

                    // 4. Validate all data deeply
                    await this.validateAllData(importData.data);

                    // 5. Show confirmation
                    const recordCount = this.countRecords(importData.data);
                    const confirmed = await this.showConfirmation(
                        `${recordCount} Datensätze werden importiert. Fortfahren?`,
                        'Daten importieren'
                    );

                    if (!confirmed) {
                        resolve({ cancelled: true });
                        return;
                    }

                    // 6. Transaction-like import (all-or-nothing)
                    const summary = await this.mergeImportDataSafe(importData.data);

                    // 7. Verify import integrity
                    await this.verifyImportIntegrity(importData.data, summary);

                    resolve(summary);
                } catch (error) {
                    console.error('Import failed:', error);
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Validate metadata
     */
    validateMetadata(metadata) {
        if (typeof metadata.exportDate !== 'string') {
            throw new Error('Invalid export date');
        }

        if (!metadata.version) {
            throw new Error('Missing export version');
        }

        // Check export date is not too old (>30 days)
        const exportDate = new Date(metadata.exportDate);
        const daysSinceExport = (Date.now() - exportDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceExport > 30) {
            console.warn(`Export is ${Math.floor(daysSinceExport)} days old`);
        }
    }

    /**
     * Validate all imported data
     */
    async validateAllData(data) {
        const validators = {
            anfragen: this.validateAnfragen.bind(this),
            angebote: this.validateAngebote.bind(this),
            auftraege: this.validateAuftraege.bind(this),
            rechnungen: this.validateRechnungen.bind(this),
            activities: this.validateActivities.bind(this),
            settings: this.validateSettings.bind(this)
        };

        for (const [key, validator] of Object.entries(validators)) {
            if (data[key]) {
                await validator(data[key]);
            }
        }
    }

    validateAnfragen(anfragen) {
        if (!Array.isArray(anfragen)) {
            throw new Error('anfragen must be an array');
        }

        anfragen.forEach((item, index) => {
            if (!item.id || typeof item.id !== 'string') {
                throw new Error(`anfragen[${index}]: missing or invalid id`);
            }
            if (typeof item.kunden_id !== 'string') {
                throw new Error(`anfragen[${index}]: missing or invalid kunden_id`);
            }
            if (typeof item.status !== 'string') {
                throw new Error(`anfragen[${index}]: missing or invalid status`);
            }
        });
    }

    validateRechnungen(rechnungen) {
        if (!Array.isArray(rechnungen)) {
            throw new Error('rechnungen must be an array');
        }

        rechnungen.forEach((item, index) => {
            if (!item.id) {
                throw new Error(`rechnungen[${index}]: missing id`);
            }
            if (typeof item.betrag !== 'number' || item.betrag < 0) {
                throw new Error(`rechnungen[${index}]: invalid betrag`);
            }
            if (!['draft', 'sent', 'paid', 'overdue'].includes(item.status)) {
                throw new Error(`rechnungen[${index}]: invalid status`);
            }
        });
    }

    validateActivities(activities) {
        if (!Array.isArray(activities)) {
            throw new Error('activities must be an array');
        }

        activities.forEach((item, index) => {
            if (typeof item.timestamp !== 'string') {
                throw new Error(`activities[${index}]: invalid timestamp`);
            }
            if (!item.action || typeof item.action !== 'string') {
                throw new Error(`activities[${index}]: missing or invalid action`);
            }
        });
    }

    validateSettings(settings) {
        if (typeof settings !== 'object') {
            throw new Error('settings must be an object');
        }

        // Validate company name is string
        if (settings.companyName && typeof settings.companyName !== 'string') {
            throw new Error('Invalid companyName');
        }
    }

    /**
     * Safe import with rollback capability
     */
    async mergeImportDataSafe(data) {
        // Create backup before import
        const backup = await this.createQuickBackup();

        try {
            const summary = await this.mergeImportData(data);
            return summary;
        } catch (error) {
            // Rollback on error
            await this.restoreFromBackup(backup);
            throw error;
        }
    }

    async createQuickBackup() {
        const store = window.storeService?.state || {};
        return JSON.parse(JSON.stringify(store));  // Deep copy
    }

    async restoreFromBackup(backup) {
        if (window.storeService) {
            window.storeService.state = backup;
            await window.storeService.save();
        }
    }

    /**
     * Export with encryption
     */
    async downloadEncryptedBackup() {
        try {
            const exportData = this.exportAll();

            // Encrypt data
            const encrypted = await this.encryptData(exportData);

            const filename = `backup_${new Date().toISOString().split('T')[0]}.json.enc`;
            this.downloadFile(
                JSON.stringify(encrypted),
                filename,
                'application/json'
            );

            if (window.notificationService) {
                window.notificationService.notifySystem(`✅ Verschlüsseltes Backup exportiert`);
            }
        } catch (error) {
            console.error('Failed to export encrypted backup:', error);
        }
    }

    async encryptData(data) {
        // Use TweetNaCl.js for encryption
        const key = crypto.getRandomValues(new Uint8Array(32));
        const nonce = crypto.getRandomValues(new Uint8Array(24));

        const plaintext = JSON.stringify(data);
        const encrypted = nacl.secretbox(
            nacl.util.decodeUTF8(plaintext),
            nonce,
            key
        );

        return {
            ciphertext: nacl.util.encodeBase64(encrypted),
            nonce: nacl.util.encodeBase64(nonce),
            key: nacl.util.encodeBase64(key),  // User must save this separately!
            algorithm: 'NaCl SecretBox'
        };
    }

    /**
     * Verify import integrity
     */
    async verifyImportIntegrity(originalData, importSummary) {
        // Count records and verify counts match
        const originalCount = this.countRecords(originalData);
        const importedCount = importSummary.imported;

        if (originalCount !== importedCount) {
            console.warn(
                `Import integrity check: expected ${originalCount} ` +
                `records, imported ${importedCount}`
            );
        }
    }
}
```

---

## 7. Content Security Policy (CSP)

Add to your main HTML file:

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="
          default-src 'self';
          script-src 'self' https://cdn.supabase.com;
          style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
          img-src 'self' https: data:;
          font-src 'self' https://fonts.gstatic.com;
          connect-src 'self' https://supabase.io https://api.supabase.io;
          frame-ancestors 'none';
          base-uri 'self';
          form-action 'self';
          ">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Local Business Automizer</title>
</head>
<body>
    <!-- Content -->
</body>
</html>
```

---

## 8. Security Headers (Server Configuration)

### For Nginx:
```nginx
server {
    # HTTPS enforcement
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # CSP
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.supabase.com; style-src 'self' 'unsafe-inline';" always;
}
```

### For Apache:
```apache
<IfModule mod_headers.c>
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Content-Security-Policy "default-src 'self';"
</IfModule>
```

---

## 9. Rate Limiting Implementation

```javascript
class RateLimiter {
    constructor(maxRequests = 60, windowMs = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map();
    }

    isAllowed(key) {
        const now = Date.now();
        const requests = this.requests.get(key) || [];

        // Remove old requests outside window
        const recentRequests = requests.filter(time => now - time < this.windowMs);

        if (recentRequests.length >= this.maxRequests) {
            return false;
        }

        recentRequests.push(now);
        this.requests.set(key, recentRequests);
        return true;
    }

    checkLimit(key) {
        if (!this.isAllowed(key)) {
            throw new Error('Rate limit exceeded');
        }
    }
}

// Usage in AuthService
class AuthService {
    constructor() {
        this.loginLimiter = new RateLimiter(5, 15 * 60 * 1000);  // 5 attempts per 15 min
        // ... rest of init
    }

    async login(email, password) {
        const key = `login:${email}`;

        try {
            this.loginLimiter.checkLimit(key);
        } catch (error) {
            throw new Error('Zu viele Anmeldeversuche. Bitte später versuchen.');
        }

        const client = this.getClient();
        if (!client) throw new Error('Supabase nicht konfiguriert');

        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        this.user = data.user;
        this.session = data.session;
        this._notify();
        return data;
    }
}
```

---

## 10. Audit Logging

```javascript
class AuditLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 10000;
    }

    log(action, details = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            userId: window.authService?.getUser()?.id,
            ipAddress: null,  // Set from server
            userAgent: navigator.userAgent,
            details,
            sessionId: window.authService?.session?.id
        };

        this.logs.push(entry);

        // Keep only recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Send to server for persistent storage
        this.sendToServer(entry);

        console.log(`[AUDIT] ${action}`, details);
    }

    async sendToServer(entry) {
        try {
            await fetch('/api/audit-log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.authService?.session?.access_token}`
                },
                body: JSON.stringify(entry)
            });
        } catch (error) {
            console.warn('Failed to send audit log:', error);
        }
    }

    // Audit critical events
    logLogin(userId) {
        this.log('AUTH_LOGIN', { userId });
    }

    logLogout(userId) {
        this.log('AUTH_LOGOUT', { userId });
    }

    logDataAccess(dataType, recordId) {
        this.log('DATA_ACCESS', { dataType, recordId });
    }

    logDataModification(dataType, recordId, changes) {
        this.log('DATA_MODIFY', { dataType, recordId, changes });
    }

    logAdminAction(action, target) {
        this.log('ADMIN_ACTION', { action, target });
    }
}

window.auditLogger = new AuditLogger();

// Usage:
window.auditLogger.logLogin(user.id);
window.auditLogger.logDataModification('rechnungen', rechnungId, { status: 'paid' });
```

---

## Testing Checklist

- [ ] Run `npm audit` - 0 vulnerabilities
- [ ] Test all XSS fixes with special characters: `<script>alert('xss')</script>`
- [ ] Verify credentials are not stored in localStorage
- [ ] Test session timeout after 30 minutes of inactivity
- [ ] Verify CSRF tokens are validated on form submission
- [ ] Test rate limiting with rapid login attempts
- [ ] Verify audit logs are created for all sensitive actions
- [ ] Check CSP in browser console for errors
- [ ] Test file size limits on import
- [ ] Verify encrypted backup can be created and decrypted

---

## Deployment Checklist

- [ ] All npm vulnerabilities fixed
- [ ] All XSS vulnerabilities patched
- [ ] Credentials moved to secure backend storage
- [ ] Session timeouts enabled
- [ ] CSRF protection enabled
- [ ] CSP headers configured
- [ ] Security headers configured (HSTS, X-Frame-Options, etc.)
- [ ] Rate limiting enabled
- [ ] Audit logging enabled
- [ ] Database RLS policies reviewed
- [ ] HTTPS enforced
- [ ] Security audit completed

---

## References

- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Supabase Security Guide](https://supabase.com/docs/guides/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
