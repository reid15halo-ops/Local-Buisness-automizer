/* ============================================
   Workflow Builder Service (Feature #21)
   Visual workflow automation with triggers,
   conditions, and actions
   ============================================ */

class WorkflowService {
    constructor() {
        this.workflows = JSON.parse(localStorage.getItem('mhs_workflows') || '[]');
        this.executionLog = JSON.parse(localStorage.getItem('mhs_workflow_log') || '[]');
        this.isRunning = true;

        // Available trigger types
        this.triggerTypes = {
            'email.received': { name: 'E-Mail empfangen', icon: '📧', params: ['from', 'subject', 'contains'] },
            'invoice.created': { name: 'Rechnung erstellt', icon: '📄', params: ['customer', 'amount'] },
            'invoice.overdue': { name: 'Rechnung überfällig', icon: '⚠️', params: ['days'] },
            'payment.received': { name: 'Zahlung eingegangen', icon: '💰', params: ['amount', 'customer'] },
            'appointment.created': { name: 'Termin erstellt', icon: '📅', params: ['type'] },
            'appointment.reminder': { name: 'Termin in X Stunden', icon: '⏰', params: ['hours'] },
            'task.created': { name: 'Aufgabe erstellt', icon: '✅', params: ['priority'] },
            'task.completed': { name: 'Aufgabe erledigt', icon: '☑️', params: [] },
            'customer.created': { name: 'Neuer Kunde', icon: '👤', params: [] },
            'schedule.daily': { name: 'Täglich um', icon: '🔄', params: ['time'] },
            'schedule.weekly': { name: 'Wöchentlich am', icon: '📆', params: ['day', 'time'] },
            'schedule.monthly': { name: 'Monatlich am', icon: '🗓️', params: ['dayOfMonth', 'time'] },
            'manual': { name: 'Manuell auslösen', icon: '▶️', params: [] }
        };

        // Available action types
        this.actionTypes = {
            'email.send': { name: 'E-Mail senden', icon: '📤', params: ['to', 'subject', 'body'] },
            'sms.send': { name: 'SMS senden', icon: '📱', params: ['to', 'message'] },
            'task.create': { name: 'Aufgabe erstellen', icon: '➕', params: ['title', 'priority', 'dueDate'] },
            'invoice.create': { name: 'Rechnung erstellen', icon: '📄', params: ['customer', 'items'] },
            'reminder.create': { name: 'Erinnerung setzen', icon: '🔔', params: ['message', 'delay'] },
            'document.generate': { name: 'Dokument erstellen', icon: '📝', params: ['template', 'data'] },
            'notification.show': { name: 'Benachrichtigung', icon: '💬', params: ['message'] },
            'webhook.call': { name: 'Webhook aufrufen', icon: '🌐', params: ['url', 'method', 'data'] },
            'field.update': { name: 'Feld aktualisieren', icon: '✏️', params: ['entity', 'field', 'value'] },
            'wait': { name: 'Warten', icon: '⏳', params: ['duration', 'unit'] },
            'log': { name: 'Protokollieren', icon: '📋', params: ['message'] }
        };

        // Condition operators
        this.operators = {
            'equals': '=',
            'not_equals': '≠',
            'contains': 'enthält',
            'not_contains': 'enthält nicht',
            'greater_than': '>',
            'less_than': '<',
            'is_empty': 'ist leer',
            'is_not_empty': 'ist nicht leer'
        };

        // Start workflow engine
        this.startEngine();
    }

    // Create a new workflow
    createWorkflow(workflowData) {
        const workflow = {
            id: 'wf-' + Date.now(),
            name: workflowData.name || 'Neuer Workflow',
            description: workflowData.description || '',
            trigger: workflowData.trigger || { type: 'manual', params: {} },
            conditions: workflowData.conditions || [],
            actions: workflowData.actions || [],
            active: true,
            createdAt: new Date().toISOString(),
            lastRun: null,
            runCount: 0
        };

        this.workflows.push(workflow);
        this.save();

        return { success: true, workflow };
    }

    // Update workflow
    updateWorkflow(id, updates) {
        const workflow = this.workflows.find(w => w.id === id);
        if (!workflow) return { success: false, error: 'Workflow nicht gefunden' };

        Object.assign(workflow, updates, { updatedAt: new Date().toISOString() });
        this.save();
        return { success: true, workflow };
    }

    // Delete workflow
    deleteWorkflow(id) {
        this.workflows = this.workflows.filter(w => w.id !== id);
        this.save();
        return { success: true };
    }

    // Toggle workflow active state
    toggleWorkflow(id) {
        const workflow = this.workflows.find(w => w.id === id);
        if (workflow) {
            workflow.active = !workflow.active;
            this.save();
            return { success: true, active: workflow.active };
        }
        return { success: false };
    }

    // Execute a workflow
    async executeWorkflow(workflowId, triggerData = {}) {
        const workflow = this.workflows.find(w => w.id === workflowId);
        if (!workflow) return { success: false, error: 'Workflow nicht gefunden' };
        if (!workflow.active) return { success: false, error: 'Workflow ist deaktiviert' };

        const executionId = 'exec-' + Date.now();
        const context = { ...triggerData, _workflowId: workflowId, _executionId: executionId };

        this.log(executionId, workflowId, 'start', `Workflow "${workflow.name}" gestartet`);

        try {
            // Check conditions
            if (workflow.conditions.length > 0) {
                const conditionsMet = this.evaluateConditions(workflow.conditions, context);
                if (!conditionsMet) {
                    this.log(executionId, workflowId, 'skip', 'Bedingungen nicht erfüllt');
                    return { success: true, skipped: true, reason: 'conditions_not_met' };
                }
            }

            // Execute actions in sequence
            for (let i = 0; i < workflow.actions.length; i++) {
                const action = workflow.actions[i];
                this.log(executionId, workflowId, 'action', `Aktion ${i + 1}: ${this.actionTypes[action.type]?.name || action.type}`);

                await this.executeAction(action, context);
            }

            // Update workflow stats
            workflow.lastRun = new Date().toISOString();
            workflow.runCount++;
            this.save();

            this.log(executionId, workflowId, 'complete', 'Workflow erfolgreich abgeschlossen');
            return { success: true, executionId };

        } catch (error) {
            this.log(executionId, workflowId, 'error', error.message);
            return { success: false, error: error.message };
        }
    }

    // Evaluate conditions
    evaluateConditions(conditions, context) {
        for (const condition of conditions) {
            const value = this.resolveValue(condition.field, context);
            const compareValue = condition.value;

            let result = false;
            switch (condition.operator) {
                case 'equals': result = value == compareValue; break;
                case 'not_equals': result = value != compareValue; break;
                case 'contains': result = String(value).includes(compareValue); break;
                case 'not_contains': result = !String(value).includes(compareValue); break;
                case 'greater_than': result = Number(value) > Number(compareValue); break;
                case 'less_than': result = Number(value) < Number(compareValue); break;
                case 'is_empty': result = !value || value === ''; break;
                case 'is_not_empty': result = value && value !== ''; break;
            }

            // AND logic - all conditions must be true
            if (!result) return false;
        }
        return true;
    }

    // Execute a single action
    async executeAction(action, context) {
        const params = this.resolveParams(action.params, context);

        switch (action.type) {
            case 'email.send':
                if (window.emailService) {
                    await window.emailService.sendEmail({
                        to: params.to,
                        subject: params.subject,
                        body: params.body
                    });
                }
                break;

            case 'sms.send':
                if (window.smsReminderService) {
                    await window.smsReminderService.sendSMS(params.to, params.message);
                }
                break;

            case 'task.create':
                if (window.taskService) {
                    window.taskService.addTask({
                        title: params.title,
                        priority: params.priority || 'normal',
                        dueDate: params.dueDate,
                        source: 'workflow'
                    });
                }
                break;

            case 'invoice.create':
                // Would integrate with invoice system
                console.log('Creating invoice:', params);
                break;

            case 'reminder.create':
                const delay = this.parseDelay(params.delay);
                setTimeout(() => {
                    if (window.Notification && Notification.permission === 'granted') {
                        new Notification('MHS Erinnerung', { body: params.message });
                    }
                }, delay);
                break;

            case 'notification.show':
                if (window.Notification && Notification.permission === 'granted') {
                    new Notification('MHS Workflow', { body: params.message });
                } else {
                    alert(params.message);
                }
                break;

            case 'webhook.call':
                await fetch(params.url, {
                    method: params.method || 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(params.data || context)
                });
                break;

            case 'wait':
                const waitMs = this.parseDelay(`${params.duration} ${params.unit}`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
                break;

            case 'log':
                console.log('[Workflow Log]', params.message, context);
                break;
        }
    }

    // Resolve template variables in params
    resolveParams(params, context) {
        const resolved = {};
        for (const [key, value] of Object.entries(params || {})) {
            resolved[key] = this.resolveValue(value, context);
        }
        return resolved;
    }

    // Resolve a single value (supports {{variable}} syntax)
    resolveValue(template, context) {
        if (typeof template !== 'string') return template;
        return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
            const parts = path.split('.');
            let value = context;
            for (const part of parts) {
                value = value?.[part];
            }
            return value !== undefined ? value : match;
        });
    }

    // Parse delay string like "5 minutes"
    parseDelay(delayStr) {
        const match = String(delayStr).match(/(\d+)\s*(sekunde|minute|stunde|tag|second|minute|hour|day)/i);
        if (!match) return 0;
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        const multipliers = {
            'sekunde': 1000, 'second': 1000,
            'minute': 60000,
            'stunde': 3600000, 'hour': 3600000,
            'tag': 86400000, 'day': 86400000
        };
        return value * (multipliers[unit] || 1000);
    }

    // Trigger event (called by other services)
    async triggerEvent(eventType, data = {}) {
        const matchingWorkflows = this.workflows.filter(w =>
            w.active && w.trigger.type === eventType
        );

        for (const workflow of matchingWorkflows) {
            // Check trigger params
            if (this.matchesTriggerParams(workflow.trigger, data)) {
                await this.executeWorkflow(workflow.id, data);
            }
        }
    }

    // Check if event data matches trigger params
    matchesTriggerParams(trigger, data) {
        for (const [key, value] of Object.entries(trigger.params || {})) {
            if (value && data[key] !== undefined) {
                if (typeof value === 'string' && value.startsWith('*')) {
                    // Wildcard/contains match
                    if (!String(data[key]).includes(value.slice(1))) return false;
                } else if (data[key] != value) {
                    return false;
                }
            }
        }
        return true;
    }

    // Start the workflow engine (for scheduled workflows)
    startEngine() {
        // Check scheduled workflows every minute
        setInterval(() => {
            if (!this.isRunning) return;
            this.checkScheduledWorkflows();
        }, 60000);

        // Initial check
        setTimeout(() => this.checkScheduledWorkflows(), 5000);
    }

    // Check and run scheduled workflows
    checkScheduledWorkflows() {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM
        const currentDay = now.getDay(); // 0-6
        const currentDayOfMonth = now.getDate();

        this.workflows.filter(w => w.active).forEach(workflow => {
            const trigger = workflow.trigger;

            if (trigger.type === 'schedule.daily' && trigger.params.time === currentTime) {
                this.executeWorkflow(workflow.id, { scheduled: true });
            }

            if (trigger.type === 'schedule.weekly' &&
                trigger.params.day == currentDay &&
                trigger.params.time === currentTime) {
                this.executeWorkflow(workflow.id, { scheduled: true });
            }

            if (trigger.type === 'schedule.monthly' &&
                trigger.params.dayOfMonth == currentDayOfMonth &&
                trigger.params.time === currentTime) {
                this.executeWorkflow(workflow.id, { scheduled: true });
            }
        });
    }

    // Pre-built workflow templates
    getTemplates() {
        return [
            {
                name: 'Zahlungserinnerung bei Überfälligkeit',
                description: 'Sendet automatisch eine Erinnerung wenn Rechnung 7 Tage überfällig',
                trigger: { type: 'invoice.overdue', params: { days: 7 } },
                conditions: [],
                actions: [
                    {
                        type: 'email.send', params: {
                            to: '{{customer.email}}',
                            subject: 'Zahlungserinnerung Rechnung {{invoice.nummer}}',
                            body: 'Sehr geehrte/r {{customer.name}},\n\nwir möchten Sie freundlich an die offene Rechnung erinnern...'
                        }
                    }
                ]
            },
            {
                name: 'Willkommens-E-Mail für Neukunden',
                description: 'Sendet automatisch eine Willkommens-E-Mail an neue Kunden',
                trigger: { type: 'customer.created', params: {} },
                actions: [
                    {
                        type: 'email.send', params: {
                            to: '{{email}}',
                            subject: 'Willkommen bei MHS!',
                            body: 'Sehr geehrte/r {{name}},\n\nvielen Dank für Ihr Vertrauen...'
                        }
                    },
                    {
                        type: 'task.create', params: {
                            title: 'Neukunde {{name}} kontaktieren',
                            priority: 'high'
                        }
                    }
                ]
            },
            {
                name: 'Terminerinnerung 24h vorher',
                description: 'SMS-Erinnerung einen Tag vor dem Termin',
                trigger: { type: 'appointment.reminder', params: { hours: 24 } },
                actions: [
                    {
                        type: 'sms.send', params: {
                            to: '{{customer.telefon}}',
                            message: 'Erinnerung: Ihr Termin bei MHS morgen um {{time}} Uhr. Bei Fragen: 06029-9922964'
                        }
                    }
                ]
            },
            {
                name: 'Täglicher Umsatzbericht',
                description: 'Erstellt jeden Abend einen Tagesbericht',
                trigger: { type: 'schedule.daily', params: { time: '18:00' } },
                actions: [
                    { type: 'notification.show', params: { message: 'Tagesbericht wird erstellt...' } },
                    { type: 'log', params: { message: 'Täglicher Report generiert' } }
                ]
            }
        ];
    }

    // Create workflow from template
    createFromTemplate(templateIndex) {
        const templates = this.getTemplates();
        if (templateIndex >= 0 && templateIndex < templates.length) {
            return this.createWorkflow(templates[templateIndex]);
        }
        return { success: false, error: 'Template nicht gefunden' };
    }

    // Get all workflows
    getWorkflows() {
        return this.workflows;
    }

    // Get workflow by ID
    getWorkflow(id) {
        return this.workflows.find(w => w.id === id);
    }

    // Get execution log
    getExecutionLog(workflowId = null, limit = 50) {
        let log = [...this.executionLog];
        if (workflowId) {
            log = log.filter(l => l.workflowId === workflowId);
        }
        return log.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    }

    // Log execution event
    log(executionId, workflowId, type, message) {
        this.executionLog.push({
            executionId,
            workflowId,
            type,
            message,
            timestamp: new Date().toISOString()
        });
        // Keep last 500 entries
        if (this.executionLog.length > 500) {
            this.executionLog = this.executionLog.slice(-500);
        }
        localStorage.setItem('mhs_workflow_log', JSON.stringify(this.executionLog));
    }

    // Get statistics
    getStatistics() {
        return {
            totalWorkflows: this.workflows.length,
            activeWorkflows: this.workflows.filter(w => w.active).length,
            totalExecutions: this.executionLog.length,
            todayExecutions: this.executionLog.filter(l =>
                l.timestamp.startsWith(new Date().toISOString().split('T')[0])
            ).length
        };
    }

    // Persistence
    save() {
        localStorage.setItem('mhs_workflows', JSON.stringify(this.workflows));
    }
}

window.workflowService = new WorkflowService();
