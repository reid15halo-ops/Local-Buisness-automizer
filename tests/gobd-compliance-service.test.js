import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

global.localStorage = localStorageMock;

// crypto is available natively in Node/Vitest -- no mock needed

// Mock window globals
global.window = {
  storeService: null,
  authService: null,
  userManager: null,
  supabaseConfig: null
};

// ============================================
// Inline class definition (project pattern)
// ============================================

class GoBDComplianceService {
    constructor() {
        this.STORAGE_KEY = 'freyai_gobd_audit_log';
        this.RETENTION_KEY = 'freyai_gobd_retention';
        try { this.auditLog = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]'); } catch { this.auditLog = []; }
        try { this.retentionRules = JSON.parse(localStorage.getItem(this.RETENTION_KEY) || '{}'); } catch { this.retentionRules = {}; }

        this.RETENTION_PERIODS = {
            rechnungen: 10,
            buchungsbelege: 10,
            jahresabschluss: 10,
            geschaeftsbriefe: 6,
            handelskorrespondenz: 6,
            vertraege: 6,
            lieferscheine: 6,
            angebote: 6,
            auftraege: 6,
            mahnungen: 10,
            lohnunterlagen: 6,
            kassenberichte: 10
        };
    }

    async logChange(objectType, objectId, action, details = {}, userId = null) {
        const entry = {
            id: this._generateId(),
            timestamp: new Date().toISOString(),
            objectType: objectType,
            objectId: objectId,
            action: action,
            details: details,
            userId: userId || this._getCurrentUserId(),
            checksum: null
        };

        if (!this._checksumLock) { this._checksumLock = Promise.resolve(); }
        this._checksumLock = this._checksumLock.then(async () => {
            entry.checksum = await this._calculateChecksum(entry);
            this.auditLog.push(entry);
        });
        await this._checksumLock;

        if (this.auditLog.length > 10000) {
            this._archiveOldEntries();
        }

        this._save();
        return entry;
    }

    async verifyIntegrity(entry, prevHash = 'genesis') {
        const expected = await this._calculateChecksum({
            ...entry,
            checksum: null
        }, prevHash);
        return expected === entry.checksum;
    }

    async verifyFullIntegrity() {
        const results = {
            total: this.auditLog.length,
            valid: 0,
            invalid: 0,
            invalidEntries: []
        };

        let prevHash = 'genesis';
        for (const entry of this.auditLog) {
            if (await this.verifyIntegrity(entry, prevHash)) {
                results.valid++;
            } else {
                results.invalid++;
                results.invalidEntries.push(entry.id);
            }
            prevHash = entry.checksum || '';
        }

        return results;
    }

    getRetentionEndDate(objectType, createdAt) {
        const years = this.RETENTION_PERIODS[objectType];
        if (!years) { return null; }

        const created = new Date(createdAt);
        if (isNaN(created.getTime())) { return null; }

        const yearEnd = new Date(created.getFullYear(), 11, 31);
        const retentionEnd = new Date(yearEnd);
        retentionEnd.setFullYear(retentionEnd.getFullYear() + years);

        return retentionEnd;
    }

    isWithinRetentionPeriod(objectType, createdAt) {
        const endDate = this.getRetentionEndDate(objectType, createdAt);
        if (!endDate) { return true; }
        return new Date() < endDate;
    }

    getExpiredObjects() {
        const expired = [];
        const state = window.storeService?.state;
        if (!state) { return expired; }

        const checkCollection = (items, type) => {
            if (!Array.isArray(items)) { return; }
            for (const item of items) {
                const date = item.createdAt || item.datum || item.date;
                if (date && !this.isWithinRetentionPeriod(type, date)) {
                    expired.push({
                        type: type,
                        id: item.id,
                        name: item.nummer || item.titel || item.id,
                        createdAt: date,
                        retentionEnd: this.getRetentionEndDate(type, date)
                    });
                }
            }
        };

        checkCollection(state.rechnungen, 'rechnungen');
        checkCollection(state.angebote, 'angebote');
        checkCollection(state.auftraege, 'auftraege');
        checkCollection(state.anfragen, 'geschaeftsbriefe');

        return expired;
    }

    validateInvoice(rechnung) {
        const errors = [];
        const warnings = [];

        if (!rechnung.nummer) { errors.push('Rechnungsnummer fehlt'); }
        if (!rechnung.datum) { errors.push('Rechnungsdatum fehlt'); }
        if (!rechnung.leistungsdatum) { warnings.push('Leistungsdatum fehlt (Pflicht nach §14 Abs. 4 Nr. 6 UStG)'); }

        if (!rechnung.firma && !rechnung.absender?.name) {
            errors.push('Name/Firma des Rechnungsausstellers fehlt');
        }
        if (!rechnung.absender?.adresse && !rechnung.absender?.street) {
            warnings.push('Adresse des Rechnungsausstellers fehlt');
        }
        if (!rechnung.absender?.steuernummer && !rechnung.absender?.ustId && !rechnung.isKleinunternehmer) {
            errors.push('Steuernummer oder USt-IdNr. fehlt');
        }

        if (!rechnung.kunde?.name) { errors.push('Name des Rechnungsempfaengers fehlt'); }
        if (!rechnung.kunde?.adresse && !rechnung.kunde?.street) {
            warnings.push('Adresse des Rechnungsempfaengers fehlt');
        }

        if (!rechnung.positionen || rechnung.positionen.length === 0) {
            errors.push('Mindestens eine Rechnungsposition erforderlich');
        } else {
            rechnung.positionen.forEach((pos, i) => {
                if (!pos.beschreibung && !pos.name) {
                    errors.push(`Position ${i + 1}: Leistungsbeschreibung fehlt`);
                }
                if (pos.menge === undefined || pos.menge === null) {
                    errors.push(`Position ${i + 1}: Menge fehlt`);
                }
                if (pos.einzelpreis === undefined && pos.preis === undefined) {
                    errors.push(`Position ${i + 1}: Einzelpreis fehlt`);
                }
            });
        }

        if (rechnung.netto === undefined) { errors.push('Nettobetrag fehlt'); }
        if (rechnung.brutto === undefined) { errors.push('Bruttobetrag fehlt'); }

        if (!rechnung.isKleinunternehmer) {
            if (rechnung.mwst === undefined) { errors.push('MwSt-Betrag fehlt'); }
            if (!rechnung.mwstSatz && rechnung.mwstSatz !== 0) {
                warnings.push('MwSt-Satz nicht angegeben');
            }
        }

        if (rechnung.nummer) {
            const isSequential = this._checkSequentialNumber(rechnung.nummer, 'rechnungen');
            if (!isSequential) {
                warnings.push('Rechnungsnummer moeglicherweise nicht fortlaufend (GoBD-Anforderung)');
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            score: Math.max(0, 100 - (errors.length * 15) - (warnings.length * 5))
        };
    }

    validateBookingEntry(buchung) {
        const errors = [];

        if (!buchung.datum) { errors.push('Buchungsdatum fehlt'); }
        if (!buchung.belegnummer && !buchung.belegNr) { errors.push('Belegnummer fehlt'); }
        if (!buchung.betrag && buchung.betrag !== 0 && !buchung.brutto) { errors.push('Betrag fehlt'); }
        if (!buchung.buchungstext && !buchung.beschreibung) { errors.push('Buchungstext fehlt'); }
        if (!buchung.typ && !buchung.kategorie) { errors.push('Buchungstyp fehlt (Einnahme/Ausgabe)'); }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    checkTimelyRecording(belegDatum, erfassungsDatum) {
        const beleg = new Date(belegDatum);
        const erfassung = new Date(erfassungsDatum);
        if (isNaN(beleg.getTime()) || isNaN(erfassung.getTime())) { return { timely: true }; }

        const diffDays = Math.round((erfassung - beleg) / (1000 * 60 * 60 * 24));
        return {
            timely: diffDays <= 10,
            daysDifference: diffDays,
            warning: diffDays > 10 ? `Beleg ${diffDays} Tage nach Datum erfasst (GoBD empfiehlt max. 10 Tage)` : null
        };
    }

    generateProcessDocumentation() {
        const companyName = window.storeService?.state?.settings?.companyName || 'FreyAI Visions';
        const now = new Date().toLocaleDateString('de-DE');

        return {
            title: `Verfahrensdokumentation gem. GoBD - ${companyName}`,
            date: now,
            sections: [
                {
                    heading: '1. Allgemeine Beschreibung',
                    content: `${companyName} nutzt die Softwareloesung "FreyAI Visions Business Suite" zur digitalen Geschaeftsfuehrung. Die Software umfasst Kundenverwaltung (CRM), Angebots- und Rechnungserstellung, Buchhaltung (EUeR), Zeiterfassung und Dokumentenverwaltung.`
                },
                {
                    heading: '2. Anwenderdokumentation',
                    content: 'Die Anwendung wird ueber den Webbrowser bedient (PWA). Alle Eingaben erfolgen manuell durch autorisierte Benutzer. KI-gestuetzte Funktionen (Textvorschlaege, Kategorisierung) unterliegen einer menschlichen Freigabe (95/5-Modell).'
                },
                {
                    heading: '3. Technische Systemdokumentation',
                    content: 'Frontend: Vanilla JavaScript (ES6+), HTML5, CSS3. Datenhaltung: IndexedDB (lokal) + Supabase PostgreSQL (Cloud, EU-Rechenzentrum). Verschluesselung: PBKDF2 fuer Passwoerter, HTTPS/TLS fuer Datenuebertragung. Authentifizierung: Supabase Auth mit JWT-Tokens.'
                },
                {
                    heading: '4. Betriebsdokumentation',
                    content: 'Datensicherung: Automatischer Export (JSON) + Supabase Auto-Backup. Aufbewahrungsfristen: 10 Jahre fuer Rechnungen und Buchungsbelege, 6 Jahre fuer Geschaeftsbriefe. Zugriffskontrolle: Rollenbasiert (Meister, Geselle, Azubi, Buero) mit individuellen Berechtigungen.'
                },
                {
                    heading: '5. Internes Kontrollsystem (IKS)',
                    content: 'Rechnungsnummern: Fortlaufend, lueckenlos, automatisch vergeben. Audit-Trail: Jede Aenderung an Geschaeftsobjekten wird mit Zeitstempel, Benutzer und Pruefsumme protokolliert. Datenintegritaet: Pruefsummen auf Audit-Log-Eintraegen, regelmaessige Integritaetspruefung.'
                },
                {
                    heading: '6. Datensicherheit',
                    content: 'Lokale Daten: IndexedDB im Browser, geschuetzt durch Betriebssystem-Zugriffskontrolle. Cloud-Daten: Supabase mit Row-Level-Security (RLS), nur eigene Daten sichtbar. Passwoerter: PBKDF2 mit 100.000 Iterationen und zufaelligem Salt. Keine Klartextspeicherung.'
                }
            ]
        };
    }

    async generateComplianceReport() {
        const state = window.storeService?.state;
        const report = {
            generatedAt: new Date().toISOString(),
            overallScore: 100,
            checks: [],
            summary: { passed: 0, warnings: 0, failed: 0 }
        };

        const integrity = await this.verifyFullIntegrity();
        report.checks.push({
            name: 'Audit-Trail Integritaet',
            status: integrity.invalid === 0 ? 'passed' : 'failed',
            details: `${integrity.valid} von ${integrity.total} Eintraegen gueltig`
        });
        if (integrity.invalid > 0) {report.overallScore -= 30;}

        if (state?.rechnungen) {
            const nummern = state.rechnungen.map(r => r.nummer).filter(Boolean).sort();
            const hasGaps = this._checkForGaps(nummern);
            report.checks.push({
                name: 'Fortlaufende Rechnungsnummern',
                status: hasGaps ? 'warning' : 'passed',
                details: hasGaps ? 'Luecken in Rechnungsnummern erkannt' : `${nummern.length} Rechnungen, lueckenlos`
            });
        }

        if (state?.rechnungen) {
            let invoiceErrors = 0;
            for (const r of state.rechnungen) {
                const validation = this.validateInvoice(r);
                if (!validation.valid) { invoiceErrors++; }
            }
            report.checks.push({
                name: 'Rechnungs-Pflichtangaben',
                status: invoiceErrors === 0 ? 'passed' : 'warning',
                details: invoiceErrors > 0 ? `${invoiceErrors} Rechnungen mit fehlenden Pflichtangaben` : 'Alle Rechnungen vollstaendig'
            });
        }

        const expired = this.getExpiredObjects();
        report.checks.push({
            name: 'Aufbewahrungsfristen',
            status: 'passed',
            details: expired.length > 0
                ? `${expired.length} Objekte haben Aufbewahrungsfrist ueberschritten (koennen geloescht werden)`
                : 'Alle Objekte innerhalb der Aufbewahrungsfrist'
        });

        let lastBackup = null;
        try { lastBackup = localStorage.getItem('freyai_last_backup_date'); } catch { /* noop */ }
        const daysSinceBackup = lastBackup
            ? Math.round((new Date() - new Date(lastBackup)) / (1000 * 60 * 60 * 24))
            : 999;
        report.checks.push({
            name: 'Datensicherung',
            status: daysSinceBackup <= 7 ? 'passed' : daysSinceBackup <= 30 ? 'warning' : 'failed',
            details: lastBackup
                ? `Letztes Backup vor ${daysSinceBackup} Tagen`
                : 'Kein Backup-Datum gefunden'
        });

        const hasAuth = !!window.authService?.getUser() || localStorage.getItem('freyai_admin_setup_complete') === 'true';
        report.checks.push({
            name: 'Zugriffsschutz',
            status: hasAuth ? 'passed' : 'warning',
            details: hasAuth ? 'Authentifizierung aktiv' : 'Kein Zugriffsschutz konfiguriert'
        });

        for (const check of report.checks) {
            if (check.status === 'passed') { report.summary.passed++; }
            else if (check.status === 'warning') { report.summary.warnings++; report.overallScore -= 10; }
            else if (check.status === 'failed') { report.summary.failed++; report.overallScore -= 20; }
        }
        report.overallScore = Math.max(0, report.overallScore);

        return report;
    }

    _generateId() {
        if (crypto.randomUUID) {return 'gobd_' + crypto.randomUUID();}
        return 'gobd_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }

    _getCurrentUserId() {
        return window.authService?.getUser()?.id
            || window.userManager?.getCurrentUser()?.id
            || 'local_user';
    }

    async _calculateChecksum(entry, prevHash = null) {
        if (prevHash === null) {
            prevHash = this.auditLog.length > 0
                ? this.auditLog[this.auditLog.length - 1].checksum || ''
                : 'genesis';
        }
        const str = prevHash + '|' + JSON.stringify({
            timestamp: entry.timestamp,
            objectType: entry.objectType,
            objectId: entry.objectId,
            action: entry.action,
            details: entry.details,
            userId: entry.userId
        });
        try {
            const data = new TextEncoder().encode(str);
            const hashBuf = await crypto.subtle.digest('SHA-256', data);
            const hashArr = Array.from(new Uint8Array(hashBuf));
            return 'sha256_' + hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch {
            let hash = 5381;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) + hash) + str.charCodeAt(i);
                hash = hash & hash;
            }
            return 'djb2_' + Math.abs(hash).toString(36);
        }
    }

    _checkSequentialNumber(nummer, type) {
        const numMatch = nummer.match(/(\d+)/);
        if (!numMatch) { return true; }
        const num = parseInt(numMatch[1], 10);
        if (num <= 1) { return true; }

        const state = window.storeService?.state;
        if (!state || !state[type]) { return true; }

        const prevNum = num - 1;
        const prevExists = state[type].some(item => {
            if (!item.nummer) { return false; }
            const m = item.nummer.match(/(\d+)/);
            return m && parseInt(m[1], 10) === prevNum;
        });

        return prevExists;
    }

    _checkForGaps(sortedNumbers) {
        if (sortedNumbers.length < 2) { return false; }

        for (let i = 1; i < sortedNumbers.length; i++) {
            const prev = sortedNumbers[i - 1].match(/(\d+)/);
            const curr = sortedNumbers[i].match(/(\d+)/);
            if (prev && curr) {
                const diff = parseInt(curr[1], 10) - parseInt(prev[1], 10);
                if (diff > 1) { return true; }
            }
        }
        return false;
    }

    _archiveOldEntries() {
        const toArchive = this.auditLog.slice(0, this.auditLog.length - 5000);
        this.auditLog = this.auditLog.slice(-5000);
        this._archiveToSupabase(toArchive);
    }

    async _archiveToSupabase(entries) {
        try {
            const client = window.supabaseConfig?.get();
            if (!client) { return; }

            await client.from('gobd_audit_log').insert(
                entries.map(e => ({
                    user_id: e.userId || this._getCurrentUserId(),
                    action: e.action,
                    entity_type: e.objectType,
                    entity_id: e.objectId,
                    details: e,
                    checksum: e.checksum,
                    created_at: e.timestamp
                }))
            );
        } catch (e) {
            console.warn('GoBD: Archivierung in Supabase fehlgeschlagen:', e.message);
        }
    }

    _save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.auditLog));
        } catch (e) {
            console.error('GoBD: Fehler beim Speichern des Audit-Logs:', e);
        }
    }

    getAuditTrail(objectType, objectId) {
        return this.auditLog.filter(
            e => e.objectType === objectType && e.objectId === objectId
        );
    }

    getRecentAuditEntries(count = 50) {
        return this.auditLog.slice(-count).reverse();
    }
}

// ============================================
// Tests
// ============================================

describe('GoBDComplianceService', () => {
    let service;

    beforeEach(() => {
        localStorage.clear();
        window.storeService = null;
        window.authService = null;
        window.userManager = null;
        window.supabaseConfig = null;
        service = new GoBDComplianceService();
    });

    // ============================================
    // Audit-Trail (Unveraenderbarkeit)
    // ============================================

    describe('Audit-Trail (logChange / Unveraenderbarkeit)', () => {
        it('should create an audit log entry with all required fields', async () => {
            const entry = await service.logChange('rechnung', 'RE-001', 'created', { betrag: 1000 });

            expect(entry).toHaveProperty('id');
            expect(entry).toHaveProperty('timestamp');
            expect(entry).toHaveProperty('checksum');
            expect(entry.objectType).toBe('rechnung');
            expect(entry.objectId).toBe('RE-001');
            expect(entry.action).toBe('created');
            expect(entry.details).toEqual({ betrag: 1000 });
        });

        it('should generate id with gobd_ prefix', async () => {
            const entry = await service.logChange('rechnung', 'RE-001', 'created');
            expect(entry.id).toMatch(/^gobd_/);
        });

        it('should use provided userId when given', async () => {
            const entry = await service.logChange('rechnung', 'RE-001', 'created', {}, 'user-42');
            expect(entry.userId).toBe('user-42');
        });

        it('should fall back to local_user when no auth service is available', async () => {
            const entry = await service.logChange('rechnung', 'RE-001', 'created');
            expect(entry.userId).toBe('local_user');
        });

        it('should use authService user id when available', async () => {
            window.authService = { getUser: () => ({ id: 'auth-user-99' }) };
            const entry = await service.logChange('rechnung', 'RE-001', 'created');
            expect(entry.userId).toBe('auth-user-99');
        });

        it('should generate a SHA-256 checksum for each entry', async () => {
            const entry = await service.logChange('rechnung', 'RE-001', 'created');
            expect(entry.checksum).toMatch(/^sha256_/);
            expect(entry.checksum.length).toBeGreaterThan(10);
        });

        it('should persist audit log to localStorage', async () => {
            await service.logChange('rechnung', 'RE-001', 'created');
            const stored = JSON.parse(localStorage.getItem('freyai_gobd_audit_log'));
            expect(stored.length).toBe(1);
            expect(stored[0].objectId).toBe('RE-001');
        });

        it('should append multiple entries to the audit log', async () => {
            await service.logChange('rechnung', 'RE-001', 'created');
            await service.logChange('rechnung', 'RE-001', 'modified', { feld: 'betrag' });
            await service.logChange('rechnung', 'RE-001', 'exported');

            expect(service.auditLog.length).toBe(3);
            expect(service.auditLog[0].action).toBe('created');
            expect(service.auditLog[1].action).toBe('modified');
            expect(service.auditLog[2].action).toBe('exported');
        });
    });

    // ============================================
    // Integrity Verification
    // ============================================

    describe('Integrity Verification (verifyIntegrity / verifyFullIntegrity)', () => {
        it('should verify a valid single entry', async () => {
            const entry = await service.logChange('rechnung', 'RE-001', 'created');
            const isValid = await service.verifyIntegrity(entry, 'genesis');
            expect(isValid).toBe(true);
        });

        it('should detect a tampered entry', async () => {
            const entry = await service.logChange('rechnung', 'RE-001', 'created');
            // Tamper with the entry
            entry.action = 'deleted';
            const isValid = await service.verifyIntegrity(entry, 'genesis');
            expect(isValid).toBe(false);
        });

        it('should verify full integrity of an untampered log', async () => {
            await service.logChange('rechnung', 'RE-001', 'created');
            await service.logChange('rechnung', 'RE-002', 'created');
            await service.logChange('angebot', 'AN-001', 'modified');

            const results = await service.verifyFullIntegrity();
            expect(results.total).toBe(3);
            expect(results.valid).toBe(3);
            expect(results.invalid).toBe(0);
            expect(results.invalidEntries).toEqual([]);
        });

        it('should detect tampering in full integrity check', async () => {
            await service.logChange('rechnung', 'RE-001', 'created');
            await service.logChange('rechnung', 'RE-002', 'created');

            // Tamper with first entry
            service.auditLog[0].details = { tampered: true };

            const results = await service.verifyFullIntegrity();
            expect(results.invalid).toBeGreaterThan(0);
            expect(results.invalidEntries.length).toBeGreaterThan(0);
        });

        it('should return valid results for empty audit log', async () => {
            const results = await service.verifyFullIntegrity();
            expect(results.total).toBe(0);
            expect(results.valid).toBe(0);
            expect(results.invalid).toBe(0);
        });
    });

    // ============================================
    // Aufbewahrungsfristen (Retention Periods)
    // ============================================

    describe('Aufbewahrungsfristen (Retention Periods)', () => {
        it('should return 10-year retention end date for rechnungen', () => {
            const endDate = service.getRetentionEndDate('rechnungen', '2020-06-15');
            // Retention starts end of 2020 (Dec 31) + 10 years = Dec 31, 2030
            expect(endDate.getFullYear()).toBe(2030);
            expect(endDate.getMonth()).toBe(11); // December
            expect(endDate.getDate()).toBe(31);
        });

        it('should return 6-year retention end date for angebote', () => {
            const endDate = service.getRetentionEndDate('angebote', '2022-03-01');
            expect(endDate.getFullYear()).toBe(2028);
            expect(endDate.getMonth()).toBe(11);
            expect(endDate.getDate()).toBe(31);
        });

        it('should return null for unknown object types', () => {
            const endDate = service.getRetentionEndDate('unknown_type', '2023-01-01');
            expect(endDate).toBeNull();
        });

        it('should return null for invalid dates', () => {
            const endDate = service.getRetentionEndDate('rechnungen', 'not-a-date');
            expect(endDate).toBeNull();
        });

        it('should correctly identify objects within retention period', () => {
            // Created recently -- should be within retention
            const withinPeriod = service.isWithinRetentionPeriod('rechnungen', '2024-01-01');
            expect(withinPeriod).toBe(true);
        });

        it('should correctly identify objects past retention period', () => {
            // Created 15 years ago -- 10-year retention should be expired
            const pastPeriod = service.isWithinRetentionPeriod('rechnungen', '2005-01-01');
            expect(pastPeriod).toBe(false);
        });

        it('should default to retaining objects with unknown type', () => {
            const result = service.isWithinRetentionPeriod('unknown', '2000-01-01');
            expect(result).toBe(true); // Im Zweifel aufbewahren
        });
    });

    // ============================================
    // Expired Objects
    // ============================================

    describe('getExpiredObjects', () => {
        it('should return empty array when no storeService is available', () => {
            const expired = service.getExpiredObjects();
            expect(expired).toEqual([]);
        });

        it('should find expired rechnungen', () => {
            window.storeService = {
                state: {
                    rechnungen: [
                        { id: 'RE-001', nummer: 'RE-001', createdAt: '2005-01-01' },
                        { id: 'RE-002', nummer: 'RE-002', createdAt: '2024-06-01' }
                    ],
                    angebote: [],
                    auftraege: [],
                    anfragen: []
                }
            };

            const expired = service.getExpiredObjects();
            expect(expired.length).toBe(1);
            expect(expired[0].id).toBe('RE-001');
            expect(expired[0].type).toBe('rechnungen');
        });

        it('should check multiple collection types', () => {
            window.storeService = {
                state: {
                    rechnungen: [{ id: 'RE-OLD', createdAt: '2005-01-01' }],
                    angebote: [{ id: 'AN-OLD', datum: '2005-01-01' }],
                    auftraege: [{ id: 'AU-NEW', createdAt: '2024-01-01' }],
                    anfragen: [{ id: 'AF-OLD', date: '2005-01-01' }]
                }
            };

            const expired = service.getExpiredObjects();
            const expiredIds = expired.map(e => e.id);
            expect(expiredIds).toContain('RE-OLD');
            expect(expiredIds).toContain('AN-OLD');
            expect(expiredIds).toContain('AF-OLD');
            expect(expiredIds).not.toContain('AU-NEW');
        });
    });

    // ============================================
    // Invoice Validation (Vollstaendigkeitspruefung)
    // ============================================

    describe('validateInvoice (Vollstaendigkeitspruefung)', () => {
        const validInvoice = {
            nummer: 'RE-2024-001',
            datum: '2024-06-15',
            leistungsdatum: '2024-06-10',
            firma: 'Mustermann GmbH',
            absender: {
                name: 'Mustermann GmbH',
                adresse: 'Musterstr. 1, 12345 Berlin',
                steuernummer: '12/345/67890'
            },
            kunde: {
                name: 'Kunde AG',
                adresse: 'Kundenstr. 5, 54321 Hamburg'
            },
            positionen: [
                { beschreibung: 'Handwerkerleistung', menge: 5, einzelpreis: 80 }
            ],
            netto: 400,
            brutto: 476,
            mwst: 76,
            mwstSatz: 19
        };

        it('should validate a complete invoice as valid', () => {
            const result = service.validateInvoice(validInvoice);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should report error when Rechnungsnummer is missing', () => {
            const inv = { ...validInvoice, nummer: '' };
            const result = service.validateInvoice(inv);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Rechnungsnummer fehlt');
        });

        it('should report error when Rechnungsdatum is missing', () => {
            const inv = { ...validInvoice, datum: '' };
            const result = service.validateInvoice(inv);
            expect(result.errors).toContain('Rechnungsdatum fehlt');
        });

        it('should report warning when Leistungsdatum is missing', () => {
            const inv = { ...validInvoice, leistungsdatum: '' };
            const result = service.validateInvoice(inv);
            expect(result.valid).toBe(true); // Warning only, not an error
            expect(result.warnings.some(w => w.includes('Leistungsdatum'))).toBe(true);
        });

        it('should report error when Rechnungsaussteller name is missing', () => {
            const inv = { ...validInvoice, firma: '', absender: { ...validInvoice.absender, name: '' } };
            const result = service.validateInvoice(inv);
            expect(result.errors).toContain('Name/Firma des Rechnungsausstellers fehlt');
        });

        it('should report error when Steuernummer and USt-IdNr are both missing', () => {
            const inv = {
                ...validInvoice,
                absender: { name: 'Test', adresse: 'Str. 1', steuernummer: '', ustId: '' }
            };
            const result = service.validateInvoice(inv);
            expect(result.errors).toContain('Steuernummer oder USt-IdNr. fehlt');
        });

        it('should accept invoice with USt-IdNr instead of Steuernummer', () => {
            const inv = {
                ...validInvoice,
                absender: { name: 'Test', adresse: 'Str. 1', ustId: 'DE123456789' }
            };
            const result = service.validateInvoice(inv);
            expect(result.errors).not.toContain('Steuernummer oder USt-IdNr. fehlt');
        });

        it('should skip Steuernummer check for Kleinunternehmer', () => {
            const inv = {
                ...validInvoice,
                isKleinunternehmer: true,
                absender: { name: 'Test', adresse: 'Str. 1' },
                mwst: undefined,
                mwstSatz: undefined
            };
            const result = service.validateInvoice(inv);
            expect(result.errors).not.toContain('Steuernummer oder USt-IdNr. fehlt');
            expect(result.errors).not.toContain('MwSt-Betrag fehlt');
        });

        it('should report error when Rechnungsempfaenger name is missing', () => {
            const inv = { ...validInvoice, kunde: { adresse: 'Str. 1' } };
            const result = service.validateInvoice(inv);
            expect(result.errors).toContain('Name des Rechnungsempfaengers fehlt');
        });

        it('should report error when no Positionen are provided', () => {
            const inv = { ...validInvoice, positionen: [] };
            const result = service.validateInvoice(inv);
            expect(result.errors).toContain('Mindestens eine Rechnungsposition erforderlich');
        });

        it('should validate individual position fields', () => {
            const inv = {
                ...validInvoice,
                positionen: [
                    { beschreibung: '', menge: null, einzelpreis: undefined }
                ]
            };
            const result = service.validateInvoice(inv);
            expect(result.errors).toContain('Position 1: Leistungsbeschreibung fehlt');
            expect(result.errors).toContain('Position 1: Menge fehlt');
            expect(result.errors).toContain('Position 1: Einzelpreis fehlt');
        });

        it('should accept position with name instead of beschreibung', () => {
            const inv = {
                ...validInvoice,
                positionen: [{ name: 'Arbeit', menge: 1, preis: 100 }]
            };
            const result = service.validateInvoice(inv);
            expect(result.errors.filter(e => e.includes('Leistungsbeschreibung'))).toEqual([]);
        });

        it('should report error when Netto or Brutto is missing', () => {
            const inv = { ...validInvoice, netto: undefined, brutto: undefined };
            const result = service.validateInvoice(inv);
            expect(result.errors).toContain('Nettobetrag fehlt');
            expect(result.errors).toContain('Bruttobetrag fehlt');
        });

        it('should calculate a compliance score', () => {
            const result = service.validateInvoice(validInvoice);
            expect(result.score).toBeLessThanOrEqual(100);
            expect(result.score).toBeGreaterThanOrEqual(0);

            // An empty invoice should have a low score
            const badResult = service.validateInvoice({});
            expect(badResult.score).toBeLessThan(50);
        });

        it('should never return a negative score', () => {
            // Invoice with maximum errors
            const result = service.validateInvoice({});
            expect(result.score).toBeGreaterThanOrEqual(0);
        });
    });

    // ============================================
    // Booking Entry Validation
    // ============================================

    describe('validateBookingEntry', () => {
        it('should validate a complete booking entry', () => {
            const result = service.validateBookingEntry({
                datum: '2024-06-15',
                belegnummer: 'BL-001',
                betrag: 500,
                buchungstext: 'Materiallieferung',
                typ: 'ausgabe'
            });
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should report all missing fields for empty booking', () => {
            const result = service.validateBookingEntry({});
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Buchungsdatum fehlt');
            expect(result.errors).toContain('Belegnummer fehlt');
            expect(result.errors).toContain('Betrag fehlt');
            expect(result.errors).toContain('Buchungstext fehlt');
            expect(result.errors).toContain('Buchungstyp fehlt (Einnahme/Ausgabe)');
        });

        it('should accept belegNr as alternative to belegnummer', () => {
            const result = service.validateBookingEntry({
                datum: '2024-01-01',
                belegNr: 'BL-001',
                brutto: 100,
                beschreibung: 'Test',
                kategorie: 'Material'
            });
            expect(result.valid).toBe(true);
        });

        it('should accept zero betrag as valid', () => {
            const result = service.validateBookingEntry({
                datum: '2024-01-01',
                belegnummer: 'BL-001',
                betrag: 0,
                buchungstext: 'Nullbuchung',
                typ: 'einnahme'
            });
            expect(result.errors).not.toContain('Betrag fehlt');
        });
    });

    // ============================================
    // Zeitgerechte Erfassung (Timely Recording)
    // ============================================

    describe('checkTimelyRecording (Zeitgerechte Erfassung)', () => {
        it('should accept recording within 10 days', () => {
            const result = service.checkTimelyRecording('2024-06-01', '2024-06-05');
            expect(result.timely).toBe(true);
            expect(result.daysDifference).toBe(4);
            expect(result.warning).toBeNull();
        });

        it('should accept recording exactly on day 10', () => {
            const result = service.checkTimelyRecording('2024-06-01', '2024-06-11');
            expect(result.timely).toBe(true);
            expect(result.daysDifference).toBe(10);
        });

        it('should flag recording after 10 days', () => {
            const result = service.checkTimelyRecording('2024-06-01', '2024-06-20');
            expect(result.timely).toBe(false);
            expect(result.daysDifference).toBe(19);
            expect(result.warning).toContain('19 Tage');
        });

        it('should return timely true for invalid dates', () => {
            const result = service.checkTimelyRecording('invalid', 'also-invalid');
            expect(result.timely).toBe(true);
        });
    });

    // ============================================
    // Verfahrensdokumentation
    // ============================================

    describe('generateProcessDocumentation', () => {
        it('should generate documentation with all 6 sections', () => {
            const doc = service.generateProcessDocumentation();
            expect(doc.sections.length).toBe(6);
            expect(doc.title).toContain('Verfahrensdokumentation');
            expect(doc.date).toBeTruthy();
        });

        it('should use default company name when storeService is unavailable', () => {
            const doc = service.generateProcessDocumentation();
            expect(doc.title).toContain('FreyAI Visions');
        });

        it('should use custom company name from storeService', () => {
            window.storeService = { state: { settings: { companyName: 'Mustermann Bau GmbH' } } };
            const doc = service.generateProcessDocumentation();
            expect(doc.title).toContain('Mustermann Bau GmbH');
            expect(doc.sections[0].content).toContain('Mustermann Bau GmbH');
        });
    });

    // ============================================
    // Compliance Report
    // ============================================

    describe('generateComplianceReport', () => {
        it('should generate a report with all check categories', async () => {
            const report = await service.generateComplianceReport();
            expect(report).toHaveProperty('generatedAt');
            expect(report).toHaveProperty('overallScore');
            expect(report).toHaveProperty('checks');
            expect(report).toHaveProperty('summary');

            const checkNames = report.checks.map(c => c.name);
            expect(checkNames).toContain('Audit-Trail Integritaet');
            expect(checkNames).toContain('Aufbewahrungsfristen');
            expect(checkNames).toContain('Datensicherung');
            expect(checkNames).toContain('Zugriffsschutz');
        });

        it('should report passed backup check when backup is recent', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            localStorage.setItem('freyai_last_backup_date', yesterday.toISOString());

            const report = await service.generateComplianceReport();
            const backupCheck = report.checks.find(c => c.name === 'Datensicherung');
            expect(backupCheck.status).toBe('passed');
        });

        it('should report warning for backup older than 7 days', async () => {
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            localStorage.setItem('freyai_last_backup_date', twoWeeksAgo.toISOString());

            const report = await service.generateComplianceReport();
            const backupCheck = report.checks.find(c => c.name === 'Datensicherung');
            expect(backupCheck.status).toBe('warning');
        });

        it('should report failed for backup older than 30 days', async () => {
            const longAgo = new Date();
            longAgo.setDate(longAgo.getDate() - 60);
            localStorage.setItem('freyai_last_backup_date', longAgo.toISOString());

            const report = await service.generateComplianceReport();
            const backupCheck = report.checks.find(c => c.name === 'Datensicherung');
            expect(backupCheck.status).toBe('failed');
        });

        it('should report passed auth check when admin setup is complete', async () => {
            localStorage.setItem('freyai_admin_setup_complete', 'true');

            const report = await service.generateComplianceReport();
            const authCheck = report.checks.find(c => c.name === 'Zugriffsschutz');
            expect(authCheck.status).toBe('passed');
        });

        it('should deduct score for warnings and failures', async () => {
            // No backup, no auth -> warning for auth, failed for backup
            const report = await service.generateComplianceReport();
            expect(report.overallScore).toBeLessThan(100);
        });

        it('should include invoice checks when rechnungen exist in state', async () => {
            window.storeService = {
                state: {
                    rechnungen: [
                        { nummer: 'RE-001', datum: '2024-01-01' },
                        { nummer: 'RE-002', datum: '2024-02-01' }
                    ],
                    angebote: [],
                    auftraege: [],
                    anfragen: []
                }
            };

            const report = await service.generateComplianceReport();
            const invoiceCheck = report.checks.find(c => c.name === 'Rechnungs-Pflichtangaben');
            expect(invoiceCheck).toBeTruthy();

            const numCheck = report.checks.find(c => c.name === 'Fortlaufende Rechnungsnummern');
            expect(numCheck).toBeTruthy();
        });

        it('should correctly tally passed, warnings, and failed counts', async () => {
            const report = await service.generateComplianceReport();
            const { passed, warnings, failed } = report.summary;
            expect(passed + warnings + failed).toBe(report.checks.length);
        });

        it('should never return a score below 0', async () => {
            // Tamper the audit log to create failures
            service.auditLog = [
                { id: 'fake1', timestamp: 'x', objectType: 'a', objectId: '1', action: 'created', details: {}, userId: 'u', checksum: 'wrong' },
                { id: 'fake2', timestamp: 'y', objectType: 'b', objectId: '2', action: 'created', details: {}, userId: 'u', checksum: 'wrong' }
            ];

            const report = await service.generateComplianceReport();
            expect(report.overallScore).toBeGreaterThanOrEqual(0);
        });
    });

    // ============================================
    // Audit Trail Retrieval
    // ============================================

    describe('getAuditTrail / getRecentAuditEntries', () => {
        it('should filter audit trail by objectType and objectId', async () => {
            await service.logChange('rechnung', 'RE-001', 'created');
            await service.logChange('angebot', 'AN-001', 'created');
            await service.logChange('rechnung', 'RE-001', 'modified');

            const trail = service.getAuditTrail('rechnung', 'RE-001');
            expect(trail.length).toBe(2);
            expect(trail[0].action).toBe('created');
            expect(trail[1].action).toBe('modified');
        });

        it('should return empty array for nonexistent object', () => {
            const trail = service.getAuditTrail('rechnung', 'DOES-NOT-EXIST');
            expect(trail).toEqual([]);
        });

        it('should return recent entries in reverse chronological order', async () => {
            await service.logChange('rechnung', 'RE-001', 'created');
            await service.logChange('rechnung', 'RE-002', 'created');
            await service.logChange('rechnung', 'RE-003', 'created');

            const recent = service.getRecentAuditEntries(2);
            expect(recent.length).toBe(2);
            expect(recent[0].objectId).toBe('RE-003');
            expect(recent[1].objectId).toBe('RE-002');
        });

        it('should return all entries when count exceeds log size', async () => {
            await service.logChange('rechnung', 'RE-001', 'created');
            const recent = service.getRecentAuditEntries(100);
            expect(recent.length).toBe(1);
        });
    });

    // ============================================
    // Helper: _checkForGaps
    // ============================================

    describe('_checkForGaps', () => {
        it('should return false for sequential numbers', () => {
            expect(service._checkForGaps(['RE-001', 'RE-002', 'RE-003'])).toBe(false);
        });

        it('should return true when gaps exist', () => {
            expect(service._checkForGaps(['RE-001', 'RE-003', 'RE-004'])).toBe(true);
        });

        it('should return false for a single number', () => {
            expect(service._checkForGaps(['RE-001'])).toBe(false);
        });

        it('should return false for empty array', () => {
            expect(service._checkForGaps([])).toBe(false);
        });
    });

    // ============================================
    // Data Persistence
    // ============================================

    describe('Data Persistence', () => {
        it('should restore audit log from localStorage on construction', async () => {
            await service.logChange('rechnung', 'RE-001', 'created');

            const service2 = new GoBDComplianceService();
            expect(service2.auditLog.length).toBe(1);
            expect(service2.auditLog[0].objectId).toBe('RE-001');
        });

        it('should handle corrupted localStorage gracefully', () => {
            localStorage.setItem('freyai_gobd_audit_log', 'not-valid-json{{{');
            const safeService = new GoBDComplianceService();
            expect(safeService.auditLog).toEqual([]);
        });
    });
});
