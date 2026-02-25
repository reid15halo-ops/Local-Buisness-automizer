/* ============================================
   Workflow Builder Service
   Visual drag-and-drop workflow automation engine
   with triggers, conditions, actions, and execution
   ============================================ */

class WorkflowBuilderService {
    constructor() {
        this.workflows = [];
        this.activeWorkflows = new Map();
        this.executionHistory = [];
        this.STORAGE_KEY = 'mhs_workflow_builder';
        this.HISTORY_KEY = 'mhs_workflow_history';
        this.triggerTypes = {};
        this.actionTypes = {};
        this.conditionTypes = {};
        this._eventListeners = [];
        this._timerIntervals = new Map();

        this.load();
        this.registerTriggers();
        this.registerActions();
        this.registerConditions();
        this._restoreActiveWorkflows();
    }

    // ============================================
    // Node Type Registrations
    // ============================================

    registerTriggers() {
        this.triggerTypes = {
            anfrage_created: {
                id: 'anfrage_created',
                name: 'Neue Anfrage eingegangen',
                category: 'trigger',
                icon: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
                color: '#22c55e',
                description: 'Wird ausgeloest wenn eine neue Anfrage erstellt wird',
                eventType: 'anfrage.created',
                configFields: [
                    { key: 'filterKunde', label: 'Kunde (Filter)', type: 'text', placeholder: 'Alle Kunden' },
                    { key: 'filterLeistungsart', label: 'Leistungsart', type: 'select', options: ['alle', 'metallbau', 'hydraulik', 'schlosserei', 'schweissen', 'montage'] }
                ]
            },
            angebot_approved: {
                id: 'angebot_approved',
                name: 'Angebot angenommen',
                category: 'trigger',
                icon: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z',
                color: '#22c55e',
                description: 'Wird ausgeloest wenn ein Angebot vom Kunden akzeptiert wird',
                eventType: 'angebot.approved',
                configFields: [
                    { key: 'minBetrag', label: 'Mindestbetrag (EUR)', type: 'number', placeholder: '0' }
                ]
            },
            auftrag_status_changed: {
                id: 'auftrag_status_changed',
                name: 'Auftragsstatus geaendert',
                category: 'trigger',
                icon: 'M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z',
                color: '#22c55e',
                description: 'Wird ausgeloest wenn sich der Status eines Auftrags aendert',
                eventType: 'auftrag.status_changed',
                configFields: [
                    { key: 'fromStatus', label: 'Von Status', type: 'select', options: ['alle', 'geplant', 'material_bestellt', 'in_bearbeitung', 'qualitaetskontrolle', 'abnahme'] },
                    { key: 'toStatus', label: 'Zu Status', type: 'select', options: ['alle', 'material_bestellt', 'in_bearbeitung', 'qualitaetskontrolle', 'abnahme', 'abgeschlossen'] }
                ]
            },
            rechnung_overdue: {
                id: 'rechnung_overdue',
                name: 'Rechnung ueberfaellig',
                category: 'trigger',
                icon: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
                color: '#ef4444',
                description: 'Wird ausgeloest wenn eine Rechnung das Zahlungsziel ueberschreitet',
                eventType: 'rechnung.overdue',
                configFields: [
                    { key: 'tageUeberfaellig', label: 'Tage ueberfaellig', type: 'number', placeholder: '14' },
                    { key: 'minBetrag', label: 'Mindestbetrag (EUR)', type: 'number', placeholder: '0' }
                ]
            },
            rechnung_paid: {
                id: 'rechnung_paid',
                name: 'Zahlung eingegangen',
                category: 'trigger',
                icon: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
                color: '#22c55e',
                description: 'Wird ausgeloest wenn eine Zahlung verbucht wird',
                eventType: 'rechnung.paid',
                configFields: []
            },
            termin_approaching: {
                id: 'termin_approaching',
                name: 'Termin steht bevor',
                category: 'trigger',
                icon: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z',
                color: '#f59e0b',
                description: 'Wird ausgeloest X Minuten vor einem Termin',
                eventType: 'termin.approaching',
                configFields: [
                    { key: 'minutenVorher', label: 'Minuten vorher', type: 'number', placeholder: '30' }
                ]
            },
            time_based: {
                id: 'time_based',
                name: 'Zeitgesteuert (Cron)',
                category: 'trigger',
                icon: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z',
                color: '#3b82f6',
                description: 'Wird zu festgelegten Zeiten automatisch ausgeloest',
                eventType: 'schedule',
                configFields: [
                    { key: 'frequency', label: 'Haeufigkeit', type: 'select', options: ['taeglich', 'woechentlich', 'monatlich'] },
                    { key: 'time', label: 'Uhrzeit', type: 'time', placeholder: '09:00' },
                    { key: 'dayOfWeek', label: 'Wochentag', type: 'select', options: ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'] }
                ]
            },
            manual: {
                id: 'manual',
                name: 'Manuell ausloesen',
                category: 'trigger',
                icon: 'M8 5v14l11-7L8 5z',
                color: '#6366f1',
                description: 'Wird manuell per Knopfdruck gestartet',
                eventType: 'manual',
                configFields: []
            }
        };
    }

    registerActions() {
        this.actionTypes = {
            create_angebot: {
                id: 'create_angebot',
                name: 'Angebot erstellen',
                category: 'action',
                icon: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
                color: '#3b82f6',
                description: 'Erstellt ein Angebot aus der Anfrage',
                configFields: [
                    { key: 'rabatt', label: 'Rabatt (%)', type: 'number', placeholder: '0' },
                    { key: 'gueltigkeitTage', label: 'Gueltigkeit (Tage)', type: 'number', placeholder: '30' },
                    { key: 'vorlage', label: 'Vorlage', type: 'select', options: ['standard', 'premium', 'express'] }
                ]
            },
            create_auftrag: {
                id: 'create_auftrag',
                name: 'Auftrag erstellen',
                category: 'action',
                icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
                color: '#3b82f6',
                description: 'Erstellt einen Auftrag aus dem Angebot',
                configFields: [
                    { key: 'prioritaet', label: 'Prioritaet', type: 'select', options: ['normal', 'hoch', 'dringend'] },
                    { key: 'startDatum', label: 'Start-Datum (Tage ab heute)', type: 'number', placeholder: '3' }
                ]
            },
            create_rechnung: {
                id: 'create_rechnung',
                name: 'Rechnung erstellen',
                category: 'action',
                icon: 'M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z',
                color: '#3b82f6',
                description: 'Erstellt eine Rechnung aus dem Auftrag',
                configFields: [
                    { key: 'zahlungsziel', label: 'Zahlungsziel (Tage)', type: 'number', placeholder: '14' },
                    { key: 'skonto', label: 'Skonto (%)', type: 'number', placeholder: '2' },
                    { key: 'skontoTage', label: 'Skonto-Frist (Tage)', type: 'number', placeholder: '7' }
                ]
            },
            send_email: {
                id: 'send_email',
                name: 'E-Mail senden',
                category: 'action',
                icon: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
                color: '#3b82f6',
                description: 'Sendet eine E-Mail an den Kunden',
                configFields: [
                    { key: 'empfaenger', label: 'Empfaenger', type: 'text', placeholder: '{{kunde.email}}' },
                    { key: 'betreff', label: 'Betreff', type: 'text', placeholder: 'Betreff eingeben' },
                    { key: 'vorlage', label: 'E-Mail-Vorlage', type: 'select', options: ['auftragsbestaetigung', 'angebot', 'rechnung', 'erinnerung', 'danke', 'benutzerdefiniert'] },
                    { key: 'nachricht', label: 'Nachricht', type: 'textarea', placeholder: 'Nachrichtentext...' }
                ]
            },
            send_reminder: {
                id: 'send_reminder',
                name: 'Zahlungserinnerung senden',
                category: 'action',
                icon: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
                color: '#f59e0b',
                description: 'Sendet eine automatische Zahlungserinnerung',
                configFields: [
                    { key: 'stufe', label: 'Mahnstufe', type: 'select', options: ['erinnerung', 'mahnung_1', 'mahnung_2', 'letzte_warnung'] },
                    { key: 'mahngebuehr', label: 'Mahngebuehr (EUR)', type: 'number', placeholder: '5' }
                ]
            },
            update_status: {
                id: 'update_status',
                name: 'Status aktualisieren',
                category: 'action',
                icon: 'M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
                color: '#3b82f6',
                description: 'Aktualisiert den Status eines Datensatzes',
                configFields: [
                    { key: 'entitaet', label: 'Entitaet', type: 'select', options: ['anfrage', 'angebot', 'auftrag', 'rechnung'] },
                    { key: 'neuerStatus', label: 'Neuer Status', type: 'text', placeholder: 'z.B. in_bearbeitung' }
                ]
            },
            add_calendar_entry: {
                id: 'add_calendar_entry',
                name: 'Termin anlegen',
                category: 'action',
                icon: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z',
                color: '#3b82f6',
                description: 'Erstellt einen Kalendereintrag',
                configFields: [
                    { key: 'titel', label: 'Titel', type: 'text', placeholder: '{{auftrag.kunde}} - {{auftrag.leistungsart}}' },
                    { key: 'tageAbHeute', label: 'Tage ab heute', type: 'number', placeholder: '1' },
                    { key: 'startZeit', label: 'Startzeit', type: 'time', placeholder: '09:00' },
                    { key: 'dauerMinuten', label: 'Dauer (Minuten)', type: 'number', placeholder: '60' },
                    { key: 'typ', label: 'Termintyp', type: 'select', options: ['termin', 'besichtigung', 'reparatur', 'meeting'] }
                ]
            },
            reserve_material: {
                id: 'reserve_material',
                name: 'Material reservieren',
                category: 'action',
                icon: 'M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 .55.45 1 1 1h14c.55 0 1-.45 1-1V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z',
                color: '#3b82f6',
                description: 'Reserviert Material aus dem Lager fuer den Auftrag',
                configFields: [
                    { key: 'materialListe', label: 'Materialliste (aus Auftrag)', type: 'select', options: ['aus_auftrag', 'manuell'] },
                    { key: 'materialId', label: 'Material-ID (bei manuell)', type: 'text', placeholder: 'MAT-...' },
                    { key: 'menge', label: 'Menge', type: 'number', placeholder: '1' }
                ]
            },
            notify: {
                id: 'notify',
                name: 'Benachrichtigung anzeigen',
                category: 'action',
                icon: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
                color: '#8b5cf6',
                description: 'Zeigt eine In-App-Benachrichtigung an',
                configFields: [
                    { key: 'nachricht', label: 'Nachricht', type: 'text', placeholder: 'Benachrichtigungstext...' },
                    { key: 'typ', label: 'Typ', type: 'select', options: ['info', 'erfolg', 'warnung', 'fehler'] }
                ]
            },
            ai_generate: {
                id: 'ai_generate',
                name: 'KI-Text generieren',
                category: 'action',
                icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 17.93c-3.95.49-7.4-2.95-6.91-6.91.34-2.75 2.57-4.98 5.32-5.32 3.96-.49 7.4 2.96 6.91 6.91-.34 2.75-2.57 4.98-5.32 5.32z',
                color: '#8b5cf6',
                description: 'Generiert Text mit kuenstlicher Intelligenz',
                configFields: [
                    { key: 'prompt', label: 'KI-Prompt', type: 'textarea', placeholder: 'Erstelle eine Auftragsbestaetigung fuer {{kunde.name}}...' },
                    { key: 'zielFeld', label: 'Ergebnis speichern in', type: 'select', options: ['email_text', 'notiz', 'beschreibung'] },
                    { key: 'maxLaenge', label: 'Max. Laenge (Zeichen)', type: 'number', placeholder: '500' }
                ]
            },
            wait: {
                id: 'wait',
                name: 'Warten',
                category: 'action',
                icon: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z',
                color: '#71717a',
                description: 'Wartet eine bestimmte Zeitdauer ab',
                configFields: [
                    { key: 'dauer', label: 'Dauer', type: 'number', placeholder: '5' },
                    { key: 'einheit', label: 'Einheit', type: 'select', options: ['sekunden', 'minuten', 'stunden', 'tage'] }
                ]
            },
            condition: {
                id: 'condition',
                name: 'Bedingung (Wenn/Dann)',
                category: 'condition',
                icon: 'M12 2L1 12l11 10 11-10L12 2zm0 3.27L19.73 12 12 18.73 4.27 12 12 5.27z',
                color: '#f59e0b',
                description: 'Verzweigt den Ablauf basierend auf einer Bedingung',
                configFields: [
                    { key: 'feld', label: 'Feld', type: 'text', placeholder: 'z.B. betrag, status, kunde.name' },
                    { key: 'operator', label: 'Operator', type: 'select', options: ['gleich', 'ungleich', 'groesser', 'kleiner', 'enthaelt', 'ist_leer', 'ist_nicht_leer'] },
                    { key: 'wert', label: 'Vergleichswert', type: 'text', placeholder: 'Wert eingeben' }
                ],
                outputs: ['ja', 'nein']
            }
        };
    }

    registerConditions() {
        this.conditionTypes = {
            field_equals: {
                id: 'field_equals',
                name: 'Feld ist gleich',
                evaluate: (fieldValue, compareValue) => String(fieldValue) === String(compareValue)
            },
            field_not_equals: {
                id: 'field_not_equals',
                name: 'Feld ist ungleich',
                evaluate: (fieldValue, compareValue) => String(fieldValue) !== String(compareValue)
            },
            field_greater: {
                id: 'field_greater',
                name: 'Feld ist groesser als',
                evaluate: (fieldValue, compareValue) => parseFloat(fieldValue) > parseFloat(compareValue)
            },
            field_less: {
                id: 'field_less',
                name: 'Feld ist kleiner als',
                evaluate: (fieldValue, compareValue) => parseFloat(fieldValue) < parseFloat(compareValue)
            },
            field_contains: {
                id: 'field_contains',
                name: 'Feld enthaelt',
                evaluate: (fieldValue, compareValue) => String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase())
            },
            field_is_empty: {
                id: 'field_is_empty',
                name: 'Feld ist leer',
                evaluate: (fieldValue) => !fieldValue || String(fieldValue).trim() === ''
            },
            field_is_not_empty: {
                id: 'field_is_not_empty',
                name: 'Feld ist nicht leer',
                evaluate: (fieldValue) => fieldValue && String(fieldValue).trim() !== ''
            },
            days_since: {
                id: 'days_since',
                name: 'Tage seit Datum',
                evaluate: (dateValue, daysThreshold) => {
                    const date = new Date(dateValue);
                    const now = new Date();
                    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
                    return diffDays > parseInt(daysThreshold);
                }
            },
            amount_threshold: {
                id: 'amount_threshold',
                name: 'Betrag ueber Schwellenwert',
                evaluate: (amount, threshold) => parseFloat(amount) > parseFloat(threshold)
            }
        };
    }

    // ============================================
    // Type Accessors
    // ============================================

    getTriggerTypes() {
        return { ...this.triggerTypes };
    }

    getActionTypes() {
        return { ...this.actionTypes };
    }

    getConditionTypes() {
        return { ...this.conditionTypes };
    }

    getAllNodeTypes() {
        return {
            triggers: this.triggerTypes,
            actions: this.actionTypes,
            conditions: { condition: this.actionTypes.condition }
        };
    }

    // ============================================
    // Workflow CRUD
    // ============================================

    createWorkflow(data = {}) {
        const id = this._generateId('WF');
        const workflow = {
            id,
            name: data.name || 'Neuer Workflow',
            description: data.description || '',
            nodes: data.nodes || [],
            connections: data.connections || [],
            isActive: data.isActive || false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastRun: null,
            runCount: 0,
            version: 1
        };

        this.workflows.push(workflow);
        this.save();
        return workflow;
    }

    getWorkflow(id) {
        return this.workflows.find(w => w.id === id) || null;
    }

    getWorkflows() {
        return [...this.workflows];
    }

    updateWorkflow(id, data) {
        const workflow = this.getWorkflow(id);
        if (!workflow) {
            console.error('Workflow nicht gefunden:', id);
            return null;
        }

        const protectedFields = ['id', 'createdAt'];
        Object.keys(data).forEach(key => {
            if (!protectedFields.includes(key)) {
                workflow[key] = data[key];
            }
        });

        workflow.updatedAt = new Date().toISOString();
        workflow.version = (workflow.version || 0) + 1;
        this.save();
        return workflow;
    }

    deleteWorkflow(id) {
        this.deactivateWorkflow(id);
        const index = this.workflows.findIndex(w => w.id === id);
        if (index === -1) {return false;}

        this.workflows.splice(index, 1);
        this.save();
        return true;
    }

    duplicateWorkflow(id) {
        const original = this.getWorkflow(id);
        if (!original) {return null;}

        const copy = this.createWorkflow({
            name: original.name + ' (Kopie)',
            description: original.description,
            nodes: JSON.parse(JSON.stringify(original.nodes)),
            connections: JSON.parse(JSON.stringify(original.connections)),
            isActive: false
        });
        return copy;
    }

    // ============================================
    // Node Management
    // ============================================

    addNode(workflowId, node) {
        const workflow = this.getWorkflow(workflowId);
        if (!workflow) {return null;}

        const newNode = {
            id: node.id || this._generateId('ND'),
            type: node.type,         // 'trigger', 'action', 'condition'
            action: node.action,     // e.g. 'send_email', 'create_auftrag'
            config: node.config || {},
            position: node.position || { x: 200, y: 200 },
            label: node.label || this._getNodeLabel(node.type, node.action),
            createdAt: new Date().toISOString()
        };

        // Only allow one trigger per workflow
        if (newNode.type === 'trigger') {
            const existingTrigger = workflow.nodes.find(n => n.type === 'trigger');
            if (existingTrigger) {
                console.warn('Workflow hat bereits einen Ausloeser. Ersetze vorhandenen.');
                this.removeNode(workflowId, existingTrigger.id);
            }
        }

        workflow.nodes.push(newNode);
        workflow.updatedAt = new Date().toISOString();
        this.save();
        return newNode;
    }

    updateNode(workflowId, nodeId, data) {
        const workflow = this.getWorkflow(workflowId);
        if (!workflow) {return null;}

        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node) {return null;}

        Object.assign(node, data);
        workflow.updatedAt = new Date().toISOString();
        this.save();
        return node;
    }

    removeNode(workflowId, nodeId) {
        const workflow = this.getWorkflow(workflowId);
        if (!workflow) {return false;}

        // Remove the node
        workflow.nodes = workflow.nodes.filter(n => n.id !== nodeId);

        // Remove all connections referencing this node
        workflow.connections = workflow.connections.filter(
            c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId
        );

        workflow.updatedAt = new Date().toISOString();
        this.save();
        return true;
    }

    getNode(workflowId, nodeId) {
        const workflow = this.getWorkflow(workflowId);
        if (!workflow) {return null;}
        return workflow.nodes.find(n => n.id === nodeId) || null;
    }

    // ============================================
    // Connection Management
    // ============================================

    addConnection(workflowId, connection) {
        const workflow = this.getWorkflow(workflowId);
        if (!workflow) {return null;}

        // Prevent self-connections
        if (connection.fromNodeId === connection.toNodeId) {
            console.warn('Selbstreferenz-Verbindung nicht erlaubt');
            return null;
        }

        // Prevent duplicate connections
        const exists = workflow.connections.find(
            c => c.fromNodeId === connection.fromNodeId &&
                 c.toNodeId === connection.toNodeId &&
                 c.fromPort === connection.fromPort
        );
        if (exists) {
            console.warn('Verbindung existiert bereits');
            return null;
        }

        // Prevent circular connections
        if (this._wouldCreateCycle(workflow, connection.fromNodeId, connection.toNodeId)) {
            console.warn('Zirkulaere Verbindung nicht erlaubt');
            return null;
        }

        const newConnection = {
            id: connection.id || this._generateId('CN'),
            fromNodeId: connection.fromNodeId,
            toNodeId: connection.toNodeId,
            fromPort: connection.fromPort || 'output',
            toPort: connection.toPort || 'input',
            label: connection.label || ''
        };

        workflow.connections.push(newConnection);
        workflow.updatedAt = new Date().toISOString();
        this.save();
        return newConnection;
    }

    removeConnection(workflowId, connectionId) {
        const workflow = this.getWorkflow(workflowId);
        if (!workflow) {return false;}

        workflow.connections = workflow.connections.filter(c => c.id !== connectionId);
        workflow.updatedAt = new Date().toISOString();
        this.save();
        return true;
    }

    getConnectionsForNode(workflowId, nodeId) {
        const workflow = this.getWorkflow(workflowId);
        if (!workflow) {return { incoming: [], outgoing: [] };}

        return {
            incoming: workflow.connections.filter(c => c.toNodeId === nodeId),
            outgoing: workflow.connections.filter(c => c.fromNodeId === nodeId)
        };
    }

    // ============================================
    // Execution Engine
    // ============================================

    async executeWorkflow(workflowId, triggerData = {}) {
        const workflow = this.getWorkflow(workflowId);
        if (!workflow) {
            console.error('Workflow nicht gefunden:', workflowId);
            return { success: false, error: 'Workflow nicht gefunden' };
        }

        const executionId = this._generateId('EX');
        const execution = {
            id: executionId,
            workflowId,
            workflowName: workflow.name,
            startedAt: new Date().toISOString(),
            finishedAt: null,
            status: 'running',
            triggerData,
            nodeResults: [],
            error: null
        };

        console.log(`[WorkflowBuilder] Starte Workflow: "${workflow.name}" (${executionId})`);

        try {
            // Find the trigger node
            const triggerNode = workflow.nodes.find(n => n.type === 'trigger');
            if (!triggerNode) {
                throw new Error('Kein Ausloeser im Workflow definiert');
            }

            // Build execution context
            const context = {
                executionId,
                workflowId,
                triggerData,
                variables: { ...triggerData },
                results: {},
                startedAt: new Date()
            };

            // Execute starting from the trigger node
            await this._executeFromNode(workflow, triggerNode.id, context, execution);

            execution.status = 'completed';
            execution.finishedAt = new Date().toISOString();

            // Update workflow run stats
            workflow.lastRun = new Date().toISOString();
            workflow.runCount = (workflow.runCount || 0) + 1;
            this.save();

            console.log(`[WorkflowBuilder] Workflow abgeschlossen: "${workflow.name}" (${executionId})`);

        } catch (error) {
            execution.status = 'error';
            execution.error = error.message;
            execution.finishedAt = new Date().toISOString();
            console.error(`[WorkflowBuilder] Workflow-Fehler: "${workflow.name}"`, error);
        }

        // Save to execution history
        this.executionHistory.unshift(execution);
        if (this.executionHistory.length > 200) {
            this.executionHistory = this.executionHistory.slice(0, 200);
        }
        this._saveHistory();

        return execution;
    }

    async _executeFromNode(workflow, nodeId, context, execution) {
        const node = workflow.nodes.find(n => n.id === nodeId);
        if (!node) {return;}

        const startTime = Date.now();

        try {
            // Execute the node
            const result = await this.executeNode(node, context);

            execution.nodeResults.push({
                nodeId: node.id,
                nodeLabel: node.label,
                action: node.action,
                status: 'success',
                result,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });

            // Store result in context for downstream nodes
            context.results[node.id] = result;

            // Find outgoing connections
            const outgoing = workflow.connections.filter(c => c.fromNodeId === nodeId);

            if (node.type === 'condition' || node.action === 'condition') {
                // Condition node: follow the correct branch
                const conditionResult = await this.evaluateCondition(node.config, context);
                const branchPort = conditionResult ? 'ja' : 'nein';

                const branchConnection = outgoing.find(c => c.fromPort === branchPort);
                if (branchConnection) {
                    await this._executeFromNode(workflow, branchConnection.toNodeId, context, execution);
                }
            } else {
                // Regular node: execute all outgoing connections
                for (const conn of outgoing) {
                    await this._executeFromNode(workflow, conn.toNodeId, context, execution);
                }
            }
        } catch (error) {
            execution.nodeResults.push({
                nodeId: node.id,
                nodeLabel: node.label,
                action: node.action,
                status: 'error',
                error: error.message,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async executeNode(node, context) {
        switch (node.action) {
        case 'create_angebot':
            return await this._executeCreateAngebot(node.config, context);
        case 'create_auftrag':
            return await this._executeCreateAuftrag(node.config, context);
        case 'create_rechnung':
            return await this._executeCreateRechnung(node.config, context);
        case 'send_email':
            return await this._executeSendEmail(node.config, context);
        case 'send_reminder':
            return await this._executeSendReminder(node.config, context);
        case 'update_status':
            return await this._executeUpdateStatus(node.config, context);
        case 'add_calendar_entry':
            return await this._executeAddCalendarEntry(node.config, context);
        case 'reserve_material':
            return await this._executeReserveMaterial(node.config, context);
        case 'notify':
            return await this._executeNotify(node.config, context);
        case 'ai_generate':
            return await this._executeAiGenerate(node.config, context);
        case 'wait':
            return await this._executeWait(node.config);
        case 'condition':
            return await this.evaluateCondition(node.config, context);
        default:
            // Trigger nodes: pass through
            if (node.type === 'trigger') {
                return { triggered: true, data: context.triggerData };
            }
            console.warn('Unbekannter Aktionstyp:', node.action);
            return { skipped: true };
        }
    }

    // ============================================
    // Action Executors
    // ============================================

    async _executeCreateAngebot(config, context) {
        const store = this._getStore();
        if (!store) {return { success: false, error: 'Store nicht verfuegbar' };}

        const anfrage = context.variables.anfrage || context.triggerData.record;
        if (!anfrage) {return { success: false, error: 'Keine Anfrage im Kontext' };}

        const angebot = {
            id: this._generateId('ANG'),
            anfrageId: anfrage.id,
            kunde: anfrage.kunde,
            leistungsart: anfrage.leistungsart || anfrage.kategorie || '',
            beschreibung: anfrage.beschreibung || '',
            positionen: anfrage.positionen || [],
            rabatt: parseFloat(config.rabatt) || 0,
            gueltigBis: this._addDays(new Date(), parseInt(config.gueltigkeitTage) || 30).toISOString(),
            status: 'entwurf',
            createdAt: new Date().toISOString()
        };

        store.angebote = store.angebote || [];
        store.angebote.push(angebot);
        this._saveStore();

        context.variables.angebot = angebot;
        console.log('[WorkflowBuilder] Angebot erstellt:', angebot.id);
        return { success: true, angebotId: angebot.id, angebot };
    }

    async _executeCreateAuftrag(config, context) {
        const store = this._getStore();
        if (!store) {return { success: false, error: 'Store nicht verfuegbar' };}

        const angebot = context.variables.angebot || context.triggerData.record;
        if (!angebot) {return { success: false, error: 'Kein Angebot im Kontext' };}

        const startOffset = parseInt(config.startDatum) || 3;
        const auftrag = {
            id: this._generateId('AUF'),
            angebotId: angebot.id,
            kunde: angebot.kunde,
            leistungsart: angebot.leistungsart || '',
            beschreibung: angebot.beschreibung || '',
            positionen: angebot.positionen || [],
            prioritaet: config.prioritaet || 'normal',
            status: 'geplant',
            startDatum: this._addDays(new Date(), startOffset).toISOString().split('T')[0],
            createdAt: new Date().toISOString()
        };

        store.auftraege = store.auftraege || [];
        store.auftraege.push(auftrag);
        this._saveStore();

        context.variables.auftrag = auftrag;
        console.log('[WorkflowBuilder] Auftrag erstellt:', auftrag.id);
        return { success: true, auftragId: auftrag.id, auftrag };
    }

    async _executeCreateRechnung(config, context) {
        const store = this._getStore();
        if (!store) {return { success: false, error: 'Store nicht verfuegbar' };}

        const auftrag = context.variables.auftrag || context.triggerData.record;
        if (!auftrag) {return { success: false, error: 'Kein Auftrag im Kontext' };}

        const positionen = auftrag.positionen || [];
        const netto = positionen.reduce((sum, p) => sum + ((p.menge || 1) * (p.preis || 0)), 0);
        const mwst = netto * _getTaxRate();
        const brutto = netto + mwst;

        const rechnung = {
            id: this._generateId('RE'),
            nummer: this._generateId('RE'),
            auftragId: auftrag.id,
            angebotId: auftrag.angebotId || '',
            kunde: auftrag.kunde,
            positionen,
            netto: Math.round(netto * 100) / 100,
            mwst: Math.round(mwst * 100) / 100,
            brutto: Math.round(brutto * 100) / 100,
            zahlungsziel: parseInt(config.zahlungsziel) || 14,
            skonto: parseFloat(config.skonto) || 0,
            skontoTage: parseInt(config.skontoTage) || 7,
            status: 'offen',
            createdAt: new Date().toISOString()
        };

        store.rechnungen = store.rechnungen || [];
        store.rechnungen.push(rechnung);
        this._saveStore();

        context.variables.rechnung = rechnung;
        console.log('[WorkflowBuilder] Rechnung erstellt:', rechnung.id);
        return { success: true, rechnungId: rechnung.id, rechnung };
    }

    async _executeSendEmail(config, context) {
        const empfaenger = this._resolveTemplate(config.empfaenger || '', context);
        const betreff = this._resolveTemplate(config.betreff || '', context);
        const nachricht = this._resolveTemplate(config.nachricht || '', context);

        console.log(`[WorkflowBuilder] E-Mail senden an: ${empfaenger}, Betreff: ${betreff}`);

        // Use email service if available
        if (window.emailService && typeof window.emailService.sendEmail === 'function') {
            try {
                await window.emailService.sendEmail({
                    to: empfaenger,
                    subject: betreff,
                    body: nachricht,
                    template: config.vorlage
                });
            } catch (e) {
                console.warn('[WorkflowBuilder] E-Mail-Service Fehler:', e.message);
            }
        }

        // Log the email
        context.variables.lastEmail = { empfaenger, betreff, nachricht };
        return { success: true, empfaenger, betreff };
    }

    async _executeSendReminder(config, context) {
        const rechnung = context.variables.rechnung || context.triggerData.record;
        if (!rechnung) {return { success: false, error: 'Keine Rechnung im Kontext' };}

        const stufe = config.stufe || 'erinnerung';
        const gebuehr = parseFloat(config.mahngebuehr) || 0;

        console.log(`[WorkflowBuilder] Zahlungserinnerung (${stufe}) fuer Rechnung: ${rechnung.id}`);

        // Use dunning service if available
        if (window.dunningService) {
            try {
                window.dunningService.createMahnung(rechnung.id, stufe, gebuehr);
            } catch (e) {
                console.warn('[WorkflowBuilder] Mahnwesen-Service Fehler:', e.message);
            }
        }

        return { success: true, stufe, rechnungId: rechnung.id };
    }

    async _executeUpdateStatus(config, context) {
        const store = this._getStore();
        if (!store) {return { success: false, error: 'Store nicht verfuegbar' };}

        const entitaet = config.entitaet || 'auftrag';
        const neuerStatus = config.neuerStatus || '';
        const record = context.triggerData.record || context.variables[entitaet];

        if (!record || !record.id) {return { success: false, error: 'Kein Datensatz im Kontext' };}

        const collectionMap = {
            anfrage: 'anfragen',
            angebot: 'angebote',
            auftrag: 'auftraege',
            rechnung: 'rechnungen'
        };

        const collection = store[collectionMap[entitaet]];
        if (!collection) {return { success: false, error: 'Unbekannte Entitaet: ' + entitaet };}

        const item = collection.find(i => i.id === record.id);
        if (!item) {return { success: false, error: 'Datensatz nicht gefunden: ' + record.id };}

        const alterStatus = item.status;
        item.status = neuerStatus;
        item.updatedAt = new Date().toISOString();
        this._saveStore();

        console.log(`[WorkflowBuilder] Status aktualisiert: ${entitaet} ${record.id}: ${alterStatus} -> ${neuerStatus}`);
        return { success: true, entitaet, recordId: record.id, alterStatus, neuerStatus };
    }

    async _executeAddCalendarEntry(config, context) {
        const tageOffset = parseInt(config.tageAbHeute) || 1;
        const datum = this._addDays(new Date(), tageOffset);
        const datumStr = datum.toISOString().split('T')[0];

        const titel = this._resolveTemplate(config.titel || 'Workflow-Termin', context);
        const startZeit = config.startZeit || '09:00';
        const dauerMinuten = parseInt(config.dauerMinuten) || 60;
        const endHour = parseInt(startZeit.split(':')[0]) + Math.floor(dauerMinuten / 60);
        const endMin = parseInt(startZeit.split(':')[1] || '0') + (dauerMinuten % 60);
        const endZeit = `${String(endHour).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

        const appointment = {
            title: titel,
            date: datumStr,
            startTime: startZeit,
            endTime: endZeit,
            type: config.typ || 'termin',
            description: `Automatisch erstellt durch Workflow`,
            customerId: context.variables.kunde?.id || context.triggerData.record?.kunde?.id || null,
            customerName: context.variables.kunde?.name || context.triggerData.record?.kunde?.name || ''
        };

        if (window.calendarService && typeof window.calendarService.addAppointment === 'function') {
            const result = window.calendarService.addAppointment(appointment);
            context.variables.termin = result;
            console.log('[WorkflowBuilder] Termin angelegt:', result.id);
            return { success: true, terminId: result.id };
        }

        console.log('[WorkflowBuilder] Kalender-Service nicht verfuegbar, Termin simuliert');
        return { success: true, simulated: true, appointment };
    }

    async _executeReserveMaterial(config, context) {
        const auftrag = context.variables.auftrag || context.triggerData.record;

        if (config.materialListe === 'aus_auftrag' && auftrag && auftrag.positionen) {
            const reservierungen = [];
            for (const pos of auftrag.positionen) {
                if (window.materialService && typeof window.materialService.reserveMaterial === 'function') {
                    try {
                        const result = window.materialService.reserveMaterial(pos.materialId || pos.artikelnummer, pos.menge || 1, auftrag.id);
                        reservierungen.push(result);
                    } catch (e) {
                        console.warn('[WorkflowBuilder] Material-Reservierung fehlgeschlagen:', e.message);
                    }
                }
            }
            console.log(`[WorkflowBuilder] ${reservierungen.length} Materialien reserviert`);
            return { success: true, reservierungen };
        }

        // Manual material reservation
        if (config.materialId && window.materialService) {
            try {
                const result = window.materialService.reserveMaterial(config.materialId, parseInt(config.menge) || 1, auftrag?.id);
                return { success: true, reservierung: result };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }

        return { success: true, simulated: true };
    }

    async _executeNotify(config, context) {
        const nachricht = this._resolveTemplate(config.nachricht || 'Workflow-Benachrichtigung', context);
        const typ = config.typ || 'info';

        console.log(`[WorkflowBuilder] Benachrichtigung (${typ}): ${nachricht}`);

        if (window.notificationService) {
            try {
                window.notificationService.send({
                    type: 'system',
                    title: 'Workflow-Automatisierung',
                    message: nachricht,
                    icon: typ === 'erfolg' ? 'check_circle' : typ === 'warnung' ? 'warning' : typ === 'fehler' ? 'error' : 'info'
                });
            } catch (e) {
                console.warn('[WorkflowBuilder] Benachrichtigungs-Service Fehler:', e.message);
            }
        }

        return { success: true, nachricht, typ };
    }

    async _executeAiGenerate(config, context) {
        const prompt = this._resolveTemplate(config.prompt || '', context);
        const maxLaenge = parseInt(config.maxLaenge) || 500;

        console.log(`[WorkflowBuilder] KI-Text generieren: "${prompt.substring(0, 80)}..."`);

        // Try LLM service
        if (window.llmService && typeof window.llmService.generate === 'function') {
            try {
                const result = await window.llmService.generate(prompt, { maxTokens: Math.ceil(maxLaenge / 4) });
                const text = result.text || result;
                context.variables[config.zielFeld || 'ai_text'] = text;
                return { success: true, text };
            } catch (e) {
                console.warn('[WorkflowBuilder] LLM-Service Fehler:', e.message);
            }
        }

        // Try Gemini service
        if (window.geminiService && typeof window.geminiService.generateText === 'function') {
            try {
                const text = await window.geminiService.generateText(prompt);
                context.variables[config.zielFeld || 'ai_text'] = text;
                return { success: true, text };
            } catch (e) {
                console.warn('[WorkflowBuilder] Gemini-Service Fehler:', e.message);
            }
        }

        // No AI service available - throw so the caller records a proper error state
        // instead of silently storing a placeholder that looks like real content
        throw new Error(`AI service unavailable for context: ${prompt.substring(0, 100)}. Please check your Gemini API key configuration.`);
    }

    async _executeWait(config) {
        const dauer = parseInt(config.dauer) || 1;
        const einheit = config.einheit || 'sekunden';

        const multipliers = {
            sekunden: 1000,
            minuten: 60 * 1000,
            stunden: 60 * 60 * 1000,
            tage: 24 * 60 * 60 * 1000
        };

        const ms = dauer * (multipliers[einheit] || 1000);
        // Cap at 30 seconds for demo purposes to avoid blocking
        const cappedMs = Math.min(ms, 30000);

        console.log(`[WorkflowBuilder] Warte ${dauer} ${einheit} (${cappedMs}ms)`);
        await new Promise(resolve => setTimeout(resolve, cappedMs));
        return { success: true, waited: `${dauer} ${einheit}` };
    }

    // ============================================
    // Condition Evaluation
    // ============================================

    async evaluateCondition(config, context) {
        const feld = config.feld || '';
        const operator = config.operator || 'gleich';
        const wert = config.wert || '';

        // Resolve the field value from context
        const fieldValue = this._resolveFieldValue(feld, context);

        switch (operator) {
        case 'gleich':
            return String(fieldValue) === String(wert);
        case 'ungleich':
            return String(fieldValue) !== String(wert);
        case 'groesser':
            return parseFloat(fieldValue) > parseFloat(wert);
        case 'kleiner':
            return parseFloat(fieldValue) < parseFloat(wert);
        case 'enthaelt':
            return String(fieldValue).toLowerCase().includes(String(wert).toLowerCase());
        case 'ist_leer':
            return !fieldValue || String(fieldValue).trim() === '';
        case 'ist_nicht_leer':
            return fieldValue && String(fieldValue).trim() !== '';
        default:
            console.warn('Unbekannter Operator:', operator);
            return false;
        }
    }

    // ============================================
    // Activation / Deactivation
    // ============================================

    activateWorkflow(workflowId) {
        const workflow = this.getWorkflow(workflowId);
        if (!workflow) {return false;}

        workflow.isActive = true;
        workflow.updatedAt = new Date().toISOString();
        this.activeWorkflows.set(workflowId, true);
        this.save();

        console.log(`[WorkflowBuilder] Workflow aktiviert: "${workflow.name}"`);
        return true;
    }

    deactivateWorkflow(workflowId) {
        const workflow = this.getWorkflow(workflowId);
        if (!workflow) {return false;}

        workflow.isActive = false;
        workflow.updatedAt = new Date().toISOString();
        this.activeWorkflows.delete(workflowId);

        // Clear any scheduled timers
        if (this._timerIntervals.has(workflowId)) {
            clearInterval(this._timerIntervals.get(workflowId));
            this._timerIntervals.delete(workflowId);
        }

        this.save();
        console.log(`[WorkflowBuilder] Workflow deaktiviert: "${workflow.name}"`);
        return true;
    }

    _restoreActiveWorkflows() {
        this.workflows.forEach(wf => {
            if (wf.isActive) {
                this.activeWorkflows.set(wf.id, true);
            }
        });
    }

    // ============================================
    // Event Handler - called by other services
    // ============================================

    handleEvent(eventType, eventData = {}) {
        const matchingWorkflows = this.workflows.filter(wf => {
            if (!wf.isActive) {return false;}
            const triggerNode = wf.nodes.find(n => n.type === 'trigger');
            if (!triggerNode) {return false;}

            const triggerDef = this.triggerTypes[triggerNode.action];
            if (!triggerDef) {return false;}

            return triggerDef.eventType === eventType;
        });

        matchingWorkflows.forEach(wf => {
            console.log(`[WorkflowBuilder] Event "${eventType}" loest Workflow aus: "${wf.name}"`);
            this.executeWorkflow(wf.id, eventData).catch(err => {
                console.error(`[WorkflowBuilder] Fehler bei Workflow "${wf.name}":`, err);
            });
        });

        return matchingWorkflows.length;
    }

    // ============================================
    // Templates
    // ============================================

    getTemplates() {
        return [
            {
                id: 'tmpl_standard_ablauf',
                name: 'Standard Auftragsablauf',
                description: 'Anfrage -> Angebot -> Auftrag -> Rechnung',
                icon: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z',
                color: '#22c55e',
                nodes: [
                    { id: 'n1', type: 'trigger', action: 'anfrage_created', config: {}, position: { x: 80, y: 200 }, label: 'Neue Anfrage' },
                    { id: 'n2', type: 'action', action: 'create_angebot', config: { gueltigkeitTage: '30' }, position: { x: 340, y: 200 }, label: 'Angebot erstellen' },
                    { id: 'n3', type: 'action', action: 'send_email', config: { vorlage: 'angebot', betreff: 'Ihr Angebot von FreyAI Visions' }, position: { x: 600, y: 200 }, label: 'Angebot senden' },
                    { id: 'n4', type: 'action', action: 'create_auftrag', config: { prioritaet: 'normal' }, position: { x: 860, y: 200 }, label: 'Auftrag anlegen' },
                    { id: 'n5', type: 'action', action: 'create_rechnung', config: { zahlungsziel: '14' }, position: { x: 1120, y: 200 }, label: 'Rechnung erstellen' }
                ],
                connections: [
                    { id: 'c1', fromNodeId: 'n1', toNodeId: 'n2', fromPort: 'output', toPort: 'input' },
                    { id: 'c2', fromNodeId: 'n2', toNodeId: 'n3', fromPort: 'output', toPort: 'input' },
                    { id: 'c3', fromNodeId: 'n3', toNodeId: 'n4', fromPort: 'output', toPort: 'input' },
                    { id: 'c4', fromNodeId: 'n4', toNodeId: 'n5', fromPort: 'output', toPort: 'input' }
                ]
            },
            {
                id: 'tmpl_mahnwesen',
                name: 'Mahnwesen Eskalation',
                description: 'Ueberfaellig -> Erinnerung -> Mahnung 1 -> Mahnung 2 -> Letzte Warnung',
                icon: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
                color: '#ef4444',
                nodes: [
                    { id: 'n1', type: 'trigger', action: 'rechnung_overdue', config: { tageUeberfaellig: '14' }, position: { x: 80, y: 200 }, label: 'Rechnung ueberfaellig' },
                    { id: 'n2', type: 'action', action: 'send_reminder', config: { stufe: 'erinnerung', mahngebuehr: '0' }, position: { x: 340, y: 200 }, label: 'Zahlungserinnerung' },
                    { id: 'n3', type: 'action', action: 'wait', config: { dauer: '14', einheit: 'tage' }, position: { x: 600, y: 200 }, label: '14 Tage warten' },
                    { id: 'n4', type: 'action', action: 'send_reminder', config: { stufe: 'mahnung_1', mahngebuehr: '5' }, position: { x: 860, y: 200 }, label: '1. Mahnung' },
                    { id: 'n5', type: 'action', action: 'wait', config: { dauer: '14', einheit: 'tage' }, position: { x: 1120, y: 200 }, label: '14 Tage warten' },
                    { id: 'n6', type: 'action', action: 'send_reminder', config: { stufe: 'letzte_warnung', mahngebuehr: '15' }, position: { x: 1380, y: 200 }, label: 'Letzte Warnung' }
                ],
                connections: [
                    { id: 'c1', fromNodeId: 'n1', toNodeId: 'n2', fromPort: 'output', toPort: 'input' },
                    { id: 'c2', fromNodeId: 'n2', toNodeId: 'n3', fromPort: 'output', toPort: 'input' },
                    { id: 'c3', fromNodeId: 'n3', toNodeId: 'n4', fromPort: 'output', toPort: 'input' },
                    { id: 'c4', fromNodeId: 'n4', toNodeId: 'n5', fromPort: 'output', toPort: 'input' },
                    { id: 'c5', fromNodeId: 'n5', toNodeId: 'n6', fromPort: 'output', toPort: 'input' }
                ]
            },
            {
                id: 'tmpl_nachfass',
                name: 'Nachfass-Automatik',
                description: 'Neue Anfrage -> 3 Tage warten -> Keine Antwort? -> Nachfass-Email',
                icon: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
                color: '#f59e0b',
                nodes: [
                    { id: 'n1', type: 'trigger', action: 'anfrage_created', config: {}, position: { x: 80, y: 200 }, label: 'Neue Anfrage' },
                    { id: 'n2', type: 'action', action: 'wait', config: { dauer: '3', einheit: 'tage' }, position: { x: 340, y: 200 }, label: '3 Tage warten' },
                    { id: 'n3', type: 'action', action: 'condition', config: { feld: 'anfrage.status', operator: 'gleich', wert: 'offen' }, position: { x: 600, y: 200 }, label: 'Noch offen?' },
                    { id: 'n4', type: 'action', action: 'send_email', config: { vorlage: 'benutzerdefiniert', betreff: 'Nachfrage zu Ihrer Anfrage', nachricht: 'Sehr geehrte(r) {{kunde.name}}, wir moechten nachfragen ob Sie noch Interesse an unserem Angebot haben.' }, position: { x: 860, y: 120 }, label: 'Nachfass-Email' },
                    { id: 'n5', type: 'action', action: 'notify', config: { nachricht: 'Anfrage {{anfrage.id}} bereits beantwortet', typ: 'info' }, position: { x: 860, y: 320 }, label: 'Info: Beantwortet' }
                ],
                connections: [
                    { id: 'c1', fromNodeId: 'n1', toNodeId: 'n2', fromPort: 'output', toPort: 'input' },
                    { id: 'c2', fromNodeId: 'n2', toNodeId: 'n3', fromPort: 'output', toPort: 'input' },
                    { id: 'c3', fromNodeId: 'n3', toNodeId: 'n4', fromPort: 'ja', toPort: 'input', label: 'Ja' },
                    { id: 'c4', fromNodeId: 'n3', toNodeId: 'n5', fromPort: 'nein', toPort: 'input', label: 'Nein' }
                ]
            },
            {
                id: 'tmpl_auftragsbestaetigung',
                name: 'Auftragsbestaetigung',
                description: 'Angebot angenommen -> Auftrag erstellen -> Bestaetigung senden -> Termin planen',
                icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
                color: '#3b82f6',
                nodes: [
                    { id: 'n1', type: 'trigger', action: 'angebot_approved', config: {}, position: { x: 80, y: 200 }, label: 'Angebot angenommen' },
                    { id: 'n2', type: 'action', action: 'create_auftrag', config: { prioritaet: 'normal', startDatum: '5' }, position: { x: 340, y: 200 }, label: 'Auftrag erstellen' },
                    { id: 'n3', type: 'action', action: 'send_email', config: { vorlage: 'auftragsbestaetigung', betreff: 'Auftragsbestaetigung - FreyAI Visions' }, position: { x: 600, y: 120 }, label: 'Bestaetigung senden' },
                    { id: 'n4', type: 'action', action: 'reserve_material', config: { materialListe: 'aus_auftrag' }, position: { x: 600, y: 320 }, label: 'Material reservieren' },
                    { id: 'n5', type: 'action', action: 'add_calendar_entry', config: { tageAbHeute: '5', startZeit: '09:00', dauerMinuten: '120', typ: 'termin' }, position: { x: 860, y: 200 }, label: 'Termin planen' }
                ],
                connections: [
                    { id: 'c1', fromNodeId: 'n1', toNodeId: 'n2', fromPort: 'output', toPort: 'input' },
                    { id: 'c2', fromNodeId: 'n2', toNodeId: 'n3', fromPort: 'output', toPort: 'input' },
                    { id: 'c3', fromNodeId: 'n2', toNodeId: 'n4', fromPort: 'output', toPort: 'input' },
                    { id: 'c4', fromNodeId: 'n3', toNodeId: 'n5', fromPort: 'output', toPort: 'input' }
                ]
            },
            {
                id: 'tmpl_zahlungseingang',
                name: 'Zahlungseingang',
                description: 'Zahlung eingegangen -> Bezahlt markieren -> Danke-Email -> Auftrag abschliessen',
                icon: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
                color: '#22c55e',
                nodes: [
                    { id: 'n1', type: 'trigger', action: 'rechnung_paid', config: {}, position: { x: 80, y: 200 }, label: 'Zahlung eingegangen' },
                    { id: 'n2', type: 'action', action: 'update_status', config: { entitaet: 'rechnung', neuerStatus: 'bezahlt' }, position: { x: 340, y: 200 }, label: 'Als bezahlt markieren' },
                    { id: 'n3', type: 'action', action: 'send_email', config: { vorlage: 'danke', betreff: 'Vielen Dank fuer Ihre Zahlung' }, position: { x: 600, y: 200 }, label: 'Danke-Email senden' },
                    { id: 'n4', type: 'action', action: 'update_status', config: { entitaet: 'auftrag', neuerStatus: 'abgeschlossen' }, position: { x: 860, y: 200 }, label: 'Auftrag abschliessen' },
                    { id: 'n5', type: 'action', action: 'notify', config: { nachricht: 'Zahlung fuer {{rechnung.nummer}} eingegangen!', typ: 'erfolg' }, position: { x: 1120, y: 200 }, label: 'Benachrichtigung' }
                ],
                connections: [
                    { id: 'c1', fromNodeId: 'n1', toNodeId: 'n2', fromPort: 'output', toPort: 'input' },
                    { id: 'c2', fromNodeId: 'n2', toNodeId: 'n3', fromPort: 'output', toPort: 'input' },
                    { id: 'c3', fromNodeId: 'n3', toNodeId: 'n4', fromPort: 'output', toPort: 'input' },
                    { id: 'c4', fromNodeId: 'n4', toNodeId: 'n5', fromPort: 'output', toPort: 'input' }
                ]
            }
        ];
    }

    loadTemplate(templateId) {
        const template = this.getTemplates().find(t => t.id === templateId);
        if (!template) {
            console.error('Vorlage nicht gefunden:', templateId);
            return null;
        }

        const workflow = this.createWorkflow({
            name: template.name,
            description: template.description,
            nodes: JSON.parse(JSON.stringify(template.nodes)),
            connections: JSON.parse(JSON.stringify(template.connections)),
            isActive: false
        });

        console.log(`[WorkflowBuilder] Vorlage geladen: "${template.name}"`);
        return workflow;
    }

    // ============================================
    // Execution History
    // ============================================

    getExecutionHistory(workflowId = null) {
        if (workflowId) {
            return this.executionHistory.filter(e => e.workflowId === workflowId);
        }
        return [...this.executionHistory];
    }

    clearExecutionHistory(workflowId = null) {
        if (workflowId) {
            this.executionHistory = this.executionHistory.filter(e => e.workflowId !== workflowId);
        } else {
            this.executionHistory = [];
        }
        this._saveHistory();
    }

    // ============================================
    // Validation
    // ============================================

    validateWorkflow(workflowId) {
        const workflow = this.getWorkflow(workflowId);
        if (!workflow) {return { valid: false, errors: ['Workflow nicht gefunden'] };}

        const errors = [];
        const warnings = [];

        // Must have at least one trigger
        const triggers = workflow.nodes.filter(n => n.type === 'trigger');
        if (triggers.length === 0) {
            errors.push('Workflow benoetigt mindestens einen Ausloeser');
        }
        if (triggers.length > 1) {
            warnings.push('Workflow hat mehrere Ausloeser - nur der erste wird verwendet');
        }

        // Must have at least one action
        const actions = workflow.nodes.filter(n => n.type === 'action' || n.type === 'condition');
        if (actions.length === 0) {
            errors.push('Workflow benoetigt mindestens eine Aktion');
        }

        // Check for orphan nodes (no connections)
        workflow.nodes.forEach(node => {
            if (node.type === 'trigger') {return;} // Triggers may not have incoming
            const hasIncoming = workflow.connections.some(c => c.toNodeId === node.id);
            const hasOutgoing = workflow.connections.some(c => c.fromNodeId === node.id);
            if (!hasIncoming && !hasOutgoing) {
                warnings.push(`Knoten "${node.label}" ist nicht verbunden`);
            } else if (!hasIncoming && node.type !== 'trigger') {
                warnings.push(`Knoten "${node.label}" hat keine eingehende Verbindung`);
            }
        });

        // Check that trigger has at least one outgoing connection
        triggers.forEach(trigger => {
            const hasOutgoing = workflow.connections.some(c => c.fromNodeId === trigger.id);
            if (!hasOutgoing) {
                errors.push(`Ausloeser "${trigger.label}" hat keine ausgehende Verbindung`);
            }
        });

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    // ============================================
    // Persistence
    // ============================================

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.workflows));
        } catch (e) {
            console.error('[WorkflowBuilder] Speichern fehlgeschlagen:', e);
        }
    }

    load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                this.workflows = JSON.parse(data);
            }
        } catch (e) {
            console.error('[WorkflowBuilder] Laden fehlgeschlagen:', e);
            this.workflows = [];
        }

        try {
            const historyData = localStorage.getItem(this.HISTORY_KEY);
            if (historyData) {
                this.executionHistory = JSON.parse(historyData);
            }
        } catch (e) {
            this.executionHistory = [];
        }
    }

    _saveHistory() {
        try {
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.executionHistory));
        } catch (e) {
            console.error('[WorkflowBuilder] History-Speichern fehlgeschlagen:', e);
        }
    }

    // ============================================
    // Helpers
    // ============================================

    _generateId(prefix) {
        if (window.storeService && typeof window.storeService.generateId === 'function') {
            return window.storeService.generateId(prefix);
        }
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${prefix}-${timestamp}-${random}`.toUpperCase();
    }

    _getStore() {
        if (window.storeService && window.storeService.state) {
            return window.storeService.state;
        }
        return null;
    }

    _saveStore() {
        if (window.storeService && typeof window.storeService.save === 'function') {
            window.storeService.save();
        }
    }

    _getNodeLabel(type, action) {
        if (type === 'trigger' && this.triggerTypes[action]) {
            return this.triggerTypes[action].name;
        }
        if (this.actionTypes[action]) {
            return this.actionTypes[action].name;
        }
        return action || 'Unbekannt';
    }

    _resolveTemplate(template, context) {
        if (!template) {return '';}
        return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const value = this._resolveFieldValue(path.trim(), context);
            return value !== undefined && value !== null ? String(value) : match;
        });
    }

    _resolveFieldValue(fieldPath, context) {
        if (!fieldPath) {return undefined;}

        const parts = fieldPath.split('.');
        let current = context.variables;

        for (const part of parts) {
            if (current === undefined || current === null) {return undefined;}
            current = current[part];
        }

        if (current === undefined) {
            // Try trigger data
            current = context.triggerData;
            for (const part of parts) {
                if (current === undefined || current === null) {return undefined;}
                current = current[part];
            }
        }

        return current;
    }

    _addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    _wouldCreateCycle(workflow, fromNodeId, toNodeId) {
        // BFS from toNodeId to see if we can reach fromNodeId
        const visited = new Set();
        const queue = [toNodeId];

        while (queue.length > 0) {
            const current = queue.shift();
            if (current === fromNodeId) {return true;}
            if (visited.has(current)) {continue;}
            visited.add(current);

            const outgoing = workflow.connections.filter(c => c.fromNodeId === current);
            outgoing.forEach(c => {
                if (!visited.has(c.toNodeId)) {
                    queue.push(c.toNodeId);
                }
            });
        }

        return false;
    }

    // ============================================
    // Statistics
    // ============================================

    getStats() {
        const total = this.workflows.length;
        const active = this.workflows.filter(w => w.isActive).length;
        const totalRuns = this.workflows.reduce((sum, w) => sum + (w.runCount || 0), 0);
        const recentErrors = this.executionHistory.filter(
            e => e.status === 'error' && new Date(e.startedAt) > this._addDays(new Date(), -7)
        ).length;

        return { total, active, totalRuns, recentErrors };
    }
}

// Attach to window
window.workflowBuilderService = new WorkflowBuilderService();
