/* ============================================
   GoBD Compliance Service
   Grundsaetze zur ordnungsmaessigen Fuehrung und
   Aufbewahrung von Buechern, Aufzeichnungen und
   Unterlagen in elektronischer Form

   Prueft und dokumentiert GoBD-Konformitaet:
   - Nachvollziehbarkeit
   - Unveraenderbarkeit
   - Vollstaendigkeit
   - Zeitgerechte Erfassung
   - Ordnung
   - Aufbewahrungsfristen
   ============================================ */

class GoBDComplianceService {
    constructor() {
        this.STORAGE_KEY = 'freyai_gobd_audit_log';
        this.RETENTION_KEY = 'freyai_gobd_retention';
        try { this.auditLog = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]'); } catch { this.auditLog = []; }
        try { this.retentionRules = JSON.parse(localStorage.getItem(this.RETENTION_KEY) || '{}'); } catch { this.retentionRules = {}; }

        // Deutsche Aufbewahrungsfristen (in Jahren)
        this.RETENTION_PERIODS = {
            rechnungen: 10,          // Ausgangsrechnungen, Eingangsrechnungen
            buchungsbelege: 10,       // Kontoauszuege, Quittungen
            jahresabschluss: 10,      // Bilanz, EUeR, GuV
            geschaeftsbriefe: 6,      // Angebote, Auftragsbestaetigungen, Mahnungen
            handelskorrespondenz: 6,  // Geschaeftliche E-Mails
            vertraege: 6,            // Laufende Vertraege (laenger bei Dauerschuldverhaeltnissen)
            lieferscheine: 6,        // Wenn kein Buchungsbeleg
            angebote: 6,
            auftraege: 6,
            mahnungen: 10,           // Teil der Buchfuehrung
            lohnunterlagen: 6,       // Lohnabrechnungen
            kassenberichte: 10
        };
    }

    // ============================================
    // Audit-Trail (Unveraenderbarkeit)
    // ============================================

    /**
     * Protokolliert eine Aenderung an einem Geschaeftsobjekt.
     * Jede Aenderung wird mit Zeitstempel, Benutzer und Aenderungsdetails gespeichert.
     */
    async logChange(objectType, objectId, action, details = {}, userId = null) {
        const entry = {
            id: this._generateId(),
            timestamp: new Date().toISOString(),
            objectType: objectType, // 'rechnung', 'buchung', 'angebot', etc.
            objectId: objectId,
            action: action, // 'created', 'modified', 'deleted', 'status_changed', 'exported'
            details: details,
            userId: userId || this._getCurrentUserId(),
            checksum: null
        };

        // SHA-256 Pruefsumme mit Hash-Chaining (GoBD Unveraenderbarkeit)
        // Serialize: calculate checksum before push to prevent race conditions
        if (!this._checksumLock) { this._checksumLock = Promise.resolve(); }
        this._checksumLock = this._checksumLock.then(async () => {
            entry.checksum = await this._calculateChecksum(entry);
            this.auditLog.push(entry);
        });
        await this._checksumLock;

        // Begrenzung: max 10.000 Eintraege lokal, aeltere in Supabase archivieren
        if (this.auditLog.length > 10000) {
            this._archiveOldEntries();
        }

        this._save();
        return entry;
    }

    /**
     * Prueft, ob ein Audit-Log-Eintrag manipuliert wurde.
     */
    async verifyIntegrity(entry, prevHash = 'genesis') {
        const expected = await this._calculateChecksum({
            ...entry,
            checksum: null
        }, prevHash);
        return expected === entry.checksum;
    }

    /**
     * Prueft die gesamte Audit-Log-Integritaet (mit Hash-Chain-Verifikation).
     */
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

    // ============================================
    // Aufbewahrungsfristen
    // ============================================

    /**
     * Berechnet das frueheste Loeschdatum fuer ein Objekt.
     */
    getRetentionEndDate(objectType, createdAt) {
        const years = this.RETENTION_PERIODS[objectType];
        if (!years) { return null; }

        const created = new Date(createdAt);
        if (isNaN(created.getTime())) { return null; }

        // Frist beginnt am Ende des Kalenderjahres, in dem das Dokument erstellt wurde
        const yearEnd = new Date(created.getFullYear(), 11, 31);
        const retentionEnd = new Date(yearEnd);
        retentionEnd.setFullYear(retentionEnd.getFullYear() + years);

        return retentionEnd;
    }

    /**
     * Prueft, ob ein Objekt noch aufbewahrt werden muss.
     */
    isWithinRetentionPeriod(objectType, createdAt) {
        const endDate = this.getRetentionEndDate(objectType, createdAt);
        if (!endDate) { return true; } // Im Zweifel aufbewahren
        return new Date() < endDate;
    }

    /**
     * Gibt alle Objekte zurueck, deren Aufbewahrungsfrist abgelaufen ist.
     */
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

    // ============================================
    // Vollstaendigkeitspruefung
    // ============================================

    /**
     * Prueft eine Rechnung auf GoBD-Pflichtangaben.
     */
    validateInvoice(rechnung) {
        const errors = [];
        const warnings = [];

        // Pflichtangaben nach §14 UStG + GoBD
        if (!rechnung.nummer) { errors.push('Rechnungsnummer fehlt'); }
        if (!rechnung.datum) { errors.push('Rechnungsdatum fehlt'); }
        if (!rechnung.leistungsdatum) { warnings.push('Leistungsdatum fehlt (Pflicht nach §14 Abs. 4 Nr. 6 UStG)'); }

        // Rechnungsaussteller
        if (!rechnung.firma && !rechnung.absender?.name) {
            errors.push('Name/Firma des Rechnungsausstellers fehlt');
        }
        if (!rechnung.absender?.adresse && !rechnung.absender?.street) {
            warnings.push('Adresse des Rechnungsausstellers fehlt');
        }
        if (!rechnung.absender?.steuernummer && !rechnung.absender?.ustId && !rechnung.isKleinunternehmer) {
            errors.push('Steuernummer oder USt-IdNr. fehlt');
        }

        // Rechnungsempfaenger
        if (!rechnung.kunde?.name) { errors.push('Name des Rechnungsempfaengers fehlt'); }
        if (!rechnung.kunde?.adresse && !rechnung.kunde?.street) {
            warnings.push('Adresse des Rechnungsempfaengers fehlt');
        }

        // Positionen
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

        // Betraege
        if (rechnung.netto === undefined) { errors.push('Nettobetrag fehlt'); }
        if (rechnung.brutto === undefined) { errors.push('Bruttobetrag fehlt'); }

        // MwSt / Kleinunternehmer
        if (!rechnung.isKleinunternehmer) {
            if (rechnung.mwst === undefined) { errors.push('MwSt-Betrag fehlt'); }
            if (!rechnung.mwstSatz && rechnung.mwstSatz !== 0) {
                warnings.push('MwSt-Satz nicht angegeben');
            }
        }

        // Fortlaufende Nummerierung pruefen
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

    /**
     * Prueft eine Buchung auf Vollstaendigkeit.
     */
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

    // ============================================
    // Zeitgerechte Erfassung
    // ============================================

    /**
     * Prueft, ob ein Beleg zeitnah erfasst wurde (max. 10 Tage nach Belegdatum).
     */
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

    // ============================================
    // Verfahrensdokumentation
    // ============================================

    /**
     * Generiert eine Verfahrensdokumentation als Text.
     * Pflicht nach GoBD Rz. 151-155.
     */
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

    // ============================================
    // Compliance-Report
    // ============================================

    /**
     * Erstellt einen vollstaendigen GoBD-Compliance-Bericht.
     */
    async generateComplianceReport() {
        const state = window.storeService?.state;
        const report = {
            generatedAt: new Date().toISOString(),
            overallScore: 100,
            checks: [],
            summary: { passed: 0, warnings: 0, failed: 0 }
        };

        // 1. Audit-Trail Integritaet
        const integrity = await this.verifyFullIntegrity();
        report.checks.push({
            name: 'Audit-Trail Integritaet',
            status: integrity.invalid === 0 ? 'passed' : 'failed',
            details: `${integrity.valid} von ${integrity.total} Eintraegen gueltig`
        });
        if (integrity.invalid > 0) report.overallScore -= 30;

        // 2. Rechnungsnummern
        if (state?.rechnungen) {
            const nummern = state.rechnungen.map(r => r.nummer).filter(Boolean).sort();
            const hasGaps = this._checkForGaps(nummern);
            report.checks.push({
                name: 'Fortlaufende Rechnungsnummern',
                status: hasGaps ? 'warning' : 'passed',
                details: hasGaps ? 'Luecken in Rechnungsnummern erkannt' : `${nummern.length} Rechnungen, lueckenlos`
            });
        }

        // 3. Vollstaendigkeit der Rechnungen
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

        // 4. Aufbewahrungsfristen
        const expired = this.getExpiredObjects();
        report.checks.push({
            name: 'Aufbewahrungsfristen',
            status: 'passed',
            details: expired.length > 0
                ? `${expired.length} Objekte haben Aufbewahrungsfrist ueberschritten (koennen geloescht werden)`
                : 'Alle Objekte innerhalb der Aufbewahrungsfrist'
        });

        // 5. Datensicherung
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

        // 6. Zugriffsschutz
        const hasAuth = !!window.authService?.getUser() || localStorage.getItem('freyai_admin_setup_complete') === 'true';
        report.checks.push({
            name: 'Zugriffsschutz',
            status: hasAuth ? 'passed' : 'warning',
            details: hasAuth ? 'Authentifizierung aktiv' : 'Kein Zugriffsschutz konfiguriert'
        });

        // Berechne Gesamtscore
        for (const check of report.checks) {
            if (check.status === 'passed') { report.summary.passed++; }
            else if (check.status === 'warning') { report.summary.warnings++; report.overallScore -= 10; }
            else if (check.status === 'failed') { report.summary.failed++; report.overallScore -= 20; }
        }
        report.overallScore = Math.max(0, report.overallScore);

        return report;
    }

    // ============================================
    // Hilfsfunktionen
    // ============================================

    _generateId() {
        if (crypto.randomUUID) return 'gobd_' + crypto.randomUUID();
        return 'gobd_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    }

    _getCurrentUserId() {
        return window.authService?.getUser()?.id
            || window.userManager?.getCurrentUser()?.id
            || 'local_user';
    }

    async _calculateChecksum(entry, prevHash = null) {
        // SHA-256 via SubtleCrypto for GoBD-compliant integrity
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
            // Fallback for contexts without SubtleCrypto (e.g. non-HTTPS)
            let hash = 5381;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) + hash) + str.charCodeAt(i);
                hash = hash & hash;
            }
            return 'djb2_' + Math.abs(hash).toString(36);
        }
    }

    _checkSequentialNumber(nummer, type) {
        // Einfache Pruefung: extrahiere Zahl und pruefe ob vorherige existiert
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
        // Behalte die letzten 5000, archiviere den Rest
        const toArchive = this.auditLog.slice(0, this.auditLog.length - 5000);
        this.auditLog = this.auditLog.slice(-5000);

        // Versuche, in Supabase zu archivieren
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

    /**
     * Holt den Audit-Trail fuer ein bestimmtes Objekt.
     */
    getAuditTrail(objectType, objectId) {
        return this.auditLog.filter(
            e => e.objectType === objectType && e.objectId === objectId
        );
    }

    /**
     * Holt die letzten N Audit-Eintraege.
     */
    getRecentAuditEntries(count = 50) {
        return this.auditLog.slice(-count).reverse();
    }
}

// Globale Instanz
window.gobdService = new GoBDComplianceService();
