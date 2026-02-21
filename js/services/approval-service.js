/* ============================================
   Approval Workflow Service
   Multi-step approval processes for documents
   ============================================ */

class ApprovalService {
    constructor() {
        this.workflows = JSON.parse(localStorage.getItem('freyai_approval_workflows') || '[]');
        this.requests = JSON.parse(localStorage.getItem('freyai_approval_requests') || '[]');
        this.templates = this.initDefaultTemplates();
    }

    // Initialize default workflow templates
    initDefaultTemplates() {
        return [
            {
                id: 'angebot_freigabe',
                name: 'Angebot Freigabe',
                description: 'Freigabe für Angebote über 5.000€',
                trigger: { type: 'amount', threshold: 5000 },
                steps: [
                    { id: 'step1', role: 'projektleiter', name: 'Projektleiter', timeout: 24 },
                    { id: 'step2', role: 'geschaeftsfuehrer', name: 'Geschäftsführer', timeout: 48 }
                ]
            },
            {
                id: 'ausgabe_freigabe',
                name: 'Ausgaben Freigabe',
                description: 'Freigabe für Ausgaben über 1.000€',
                trigger: { type: 'amount', threshold: 1000 },
                steps: [
                    { id: 'step1', role: 'buchhaltung', name: 'Buchhaltung', timeout: 24 },
                    { id: 'step2', role: 'geschaeftsfuehrer', name: 'Geschäftsführer', timeout: 48 }
                ]
            },
            {
                id: 'rabatt_freigabe',
                name: 'Rabatt Freigabe',
                description: 'Freigabe für Rabatte über 15%',
                trigger: { type: 'discount', threshold: 15 },
                steps: [
                    { id: 'step1', role: 'vertriebsleiter', name: 'Vertriebsleiter', timeout: 12 }
                ]
            },
            {
                id: 'rechnung_storno',
                name: 'Rechnungs-Storno',
                description: 'Freigabe für Stornierung von Rechnungen',
                trigger: { type: 'action', action: 'storno' },
                steps: [
                    { id: 'step1', role: 'buchhaltung', name: 'Buchhaltung', timeout: 24 },
                    { id: 'step2', role: 'geschaeftsfuehrer', name: 'Geschäftsführer', timeout: 48 }
                ]
            }
        ];
    }

    // Create a new approval request
    createRequest(documentType, documentId, documentData, workflowId = null) {
        // Find applicable workflow
        let workflow = workflowId
            ? this.templates.find(t => t.id === workflowId)
            : this.findApplicableWorkflow(documentType, documentData);

        if (!workflow) {
            // No approval needed
            return { required: false };
        }

        const request = {
            id: 'apr-' + Date.now(),
            workflowId: workflow.id,
            workflowName: workflow.name,
            documentType: documentType,
            documentId: documentId,
            documentData: documentData,
            currentStep: 0,
            steps: workflow.steps.map((step, index) => ({
                ...step,
                index: index,
                status: index === 0 ? 'pending' : 'waiting',
                approver: null,
                approvedAt: null,
                rejectedAt: null,
                comment: null
            })),
            status: 'pending', // pending, approved, rejected, escalated
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null,
            escalatedAt: null,
            requestedBy: documentData.requestedBy || 'system'
        };

        this.requests.push(request);
        this.save();

        // Create notification for first approver
        this.notifyApprover(request, request.steps[0]);

        return { required: true, request: request };
    }

    // Find workflow based on document and data
    findApplicableWorkflow(documentType, documentData) {
        for (const template of this.templates) {
            const trigger = template.trigger;

            switch (trigger.type) {
                case 'amount':
                    const amount = documentData.betrag || documentData.amount || 0;
                    if (amount >= trigger.threshold) {return template;}
                    break;
                case 'discount':
                    const discount = documentData.rabatt || documentData.discount || 0;
                    if (discount >= trigger.threshold) {return template;}
                    break;
                case 'action':
                    if (documentData.action === trigger.action) {return template;}
                    break;
            }
        }
        return null;
    }

    // Approve a step
    approve(requestId, stepIndex, approverName, comment = '') {
        const request = this.requests.find(r => r.id === requestId);
        if (!request) {return { success: false, error: 'Request not found' };}

        const step = request.steps[stepIndex];
        if (!step) {return { success: false, error: 'Step not found' };}
        if (step.status !== 'pending') {return { success: false, error: 'Step not pending' };}

        // Approve this step
        step.status = 'approved';
        step.approver = approverName;
        step.approvedAt = new Date().toISOString();
        step.comment = comment;

        request.updatedAt = new Date().toISOString();

        // Check if there's a next step
        if (stepIndex + 1 < request.steps.length) {
            request.currentStep = stepIndex + 1;
            request.steps[stepIndex + 1].status = 'pending';
            this.notifyApprover(request, request.steps[stepIndex + 1]);
        } else {
            // All steps completed
            request.status = 'approved';
            request.completedAt = new Date().toISOString();
            this.onApprovalComplete(request);
        }

        this.save();
        return { success: true, request: request };
    }

    // Reject a step
    reject(requestId, stepIndex, approverName, comment = '') {
        const request = this.requests.find(r => r.id === requestId);
        if (!request) {return { success: false, error: 'Request not found' };}

        const step = request.steps[stepIndex];
        if (!step || step.status !== 'pending') {
            return { success: false, error: 'Invalid step' };
        }

        step.status = 'rejected';
        step.approver = approverName;
        step.rejectedAt = new Date().toISOString();
        step.comment = comment;

        request.status = 'rejected';
        request.completedAt = new Date().toISOString();
        request.updatedAt = new Date().toISOString();

        this.save();

        // Notify requester of rejection
        this.notifyRejection(request, step);

        return { success: true, request: request };
    }

    // Check for timeouts and escalate
    checkTimeouts() {
        const now = new Date();
        const escalated = [];

        this.requests
            .filter(r => r.status === 'pending')
            .forEach(request => {
                const currentStep = request.steps[request.currentStep];
                if (!currentStep || currentStep.status !== 'pending') {return;}

                const stepStart = new Date(currentStep.status === 'pending'
                    ? (request.currentStep === 0 ? request.createdAt : request.steps[request.currentStep - 1].approvedAt)
                    : request.createdAt
                );

                const hoursPassed = (now - stepStart) / (1000 * 60 * 60);

                if (hoursPassed >= currentStep.timeout) {
                    this.escalate(request.id);
                    escalated.push(request.id);
                }
            });

        return escalated;
    }

    // Escalate a request
    escalate(requestId) {
        const request = this.requests.find(r => r.id === requestId);
        if (!request) {return null;}

        request.status = 'escalated';
        request.escalatedAt = new Date().toISOString();
        request.updatedAt = new Date().toISOString();

        // Mark current step as escalated
        const currentStep = request.steps[request.currentStep];
        if (currentStep) {
            currentStep.status = 'escalated';
        }

        this.save();

        // Notify management
        this.notifyEscalation(request);

        return request;
    }

    // Callback when approval complete
    onApprovalComplete(request) {
        console.log(`✅ Freigabe erteilt: ${request.workflowName} für ${request.documentType} ${request.documentId}`);

        // Create task or trigger action
        if (window.taskService) {
            window.taskService.addTask({
                title: `Freigabe erteilt: ${request.workflowName}`,
                description: `Dokument ${request.documentId} wurde freigegeben. Nächste Schritte ausführen.`,
                priority: 'high',
                source: 'approval',
                dueDate: new Date().toISOString().split('T')[0]
            });
        }
    }

    // Notifications
    notifyApprover(request, step) {
        const title = request.workflowName || `${request.documentType} ${request.documentId}`;
        const message = `Neue Freigabe-Anfrage: ${title}`;

        if (typeof window.showToast === 'function') {
            window.showToast(message, 'info');
        } else if (window.UI && typeof window.UI.showToast === 'function') {
            window.UI.showToast(message, 'info');
        }

        // Also log to communication service if available
        if (window.communicationService) {
            window.communicationService.logMessage({
                type: 'system',
                content: message,
                to: step.role,
                metadata: { requestId: request.id }
            });
        }
    }

    notifyRejection(request, step) {
        const title = request.workflowName || `${request.documentType} ${request.documentId}`;
        const message = `Freigabe abgelehnt: ${title}`;

        if (typeof window.showToast === 'function') {
            window.showToast(message, 'error');
        } else if (window.UI && typeof window.UI.showToast === 'function') {
            window.UI.showToast(message, 'error');
        }
    }

    notifyEscalation(request) {
        const title = request.workflowName || request.documentId;
        const message = `Eskalation: Freigabe für ${title} überfällig`;

        if (typeof window.showToast === 'function') {
            window.showToast(message, 'warning');
        } else if (window.UI && typeof window.UI.showToast === 'function') {
            window.UI.showToast(message, 'warning');
        }
    }

    // Get pending requests for a role
    getPendingForRole(role) {
        return this.requests.filter(r => {
            if (r.status !== 'pending') {return false;}
            const currentStep = r.steps[r.currentStep];
            return currentStep && currentStep.status === 'pending' && currentStep.role === role;
        });
    }

    // Get all pending requests
    getAllPending() {
        return this.requests.filter(r => r.status === 'pending');
    }

    // Get request by ID
    getRequest(id) {
        return this.requests.find(r => r.id === id);
    }

    // Get requests by document
    getRequestsByDocument(documentId) {
        return this.requests.filter(r => r.documentId === documentId);
    }

    // Get workflow templates
    getTemplates() {
        return this.templates;
    }

    // Add custom workflow template
    addTemplate(template) {
        if (!template.id) {template.id = 'custom-' + Date.now();}
        this.templates.push(template);
        this.saveTemplates();
        return template;
    }

    // Statistics
    getStatistics() {
        const pending = this.requests.filter(r => r.status === 'pending').length;
        const approved = this.requests.filter(r => r.status === 'approved').length;
        const rejected = this.requests.filter(r => r.status === 'rejected').length;
        const escalated = this.requests.filter(r => r.status === 'escalated').length;

        // Average approval time
        const approvedRequests = this.requests.filter(r => r.status === 'approved' && r.completedAt);
        const avgApprovalTime = approvedRequests.length > 0
            ? approvedRequests.reduce((sum, r) => {
                const start = new Date(r.createdAt);
                const end = new Date(r.completedAt);
                return sum + (end - start) / (1000 * 60 * 60);
            }, 0) / approvedRequests.length
            : 0;

        return {
            pending,
            approved,
            rejected,
            escalated,
            total: this.requests.length,
            avgApprovalTimeHours: avgApprovalTime.toFixed(1),
            approvalRate: this.requests.length > 0
                ? ((approved / (approved + rejected)) * 100).toFixed(1)
                : 0
        };
    }

    // Persistence
    save() {
        localStorage.setItem('freyai_approval_requests', JSON.stringify(this.requests));
    }

    saveTemplates() {
        localStorage.setItem('freyai_approval_templates', JSON.stringify(this.templates));
    }
}

window.approvalService = new ApprovalService();
