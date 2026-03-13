import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] !== undefined ? store[key] : null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

globalThis.localStorage = localStorageMock;

// Mock StorageUtils
globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => {
        const raw = localStorageMock.getItem(key);
        if (raw) {
            try { return JSON.parse(raw); } catch { return fallback; }
        }
        return fallback;
    })
};

// Mock window
globalThis.window = globalThis.window || {};
window.showToast = vi.fn();
window.taskService = null;
window.communicationService = null;
window.UI = null;

// Mock document
globalThis.document = globalThis.document || {};

// Mock console.warn to capture calls
console.warn = vi.fn();

let service;

describe('ApprovalService', () => {
    beforeEach(async () => {
        localStorageMock.clear();
        vi.clearAllMocks();
        vi.resetModules();

        StorageUtils.getJSON.mockImplementation((key, fallback) => {
            const raw = localStorageMock.getItem(key);
            if (raw) {
                try { return JSON.parse(raw); } catch { return fallback; }
            }
            return fallback;
        });
        window.showToast = vi.fn();
        window.taskService = null;
        window.communicationService = null;
        window.UI = null;
        delete window.approvalService;

        await import('../js/services/approval-service.js');
        service = window.approvalService;
    });

    describe('constructor / initialization', () => {
        it('should attach service to window.approvalService', () => {
            expect(service).toBeDefined();
            expect(window.approvalService).toBe(service);
        });

        it('should initialize with empty requests array', () => {
            expect(service.requests).toEqual([]);
        });

        it('should initialize with empty workflows array', () => {
            expect(service.workflows).toEqual([]);
        });

        it('should initialize default templates', () => {
            expect(service.templates).toBeInstanceOf(Array);
            expect(service.templates.length).toBe(4);
        });

        it('should load persisted requests from storage', async () => {
            // Prepare persisted data before re-importing
            const persistedRequests = [{ id: 'apr-111', status: 'pending' }];
            localStorageMock.setItem('freyai_approval_requests', JSON.stringify(persistedRequests));
            StorageUtils.getJSON.mockImplementation((key, fallback) => {
                const raw = localStorageMock.getItem(key);
                if (raw) {
                    try { return JSON.parse(raw); } catch { return fallback; }
                }
                return fallback;
            });

            vi.resetModules();
            delete window.approvalService;
            await import('../js/services/approval-service.js');
            const svc = window.approvalService;

            expect(svc.requests).toEqual(persistedRequests);
        });
    });

    describe('initDefaultTemplates', () => {
        it('should include angebot_freigabe template', () => {
            const t = service.templates.find(t => t.id === 'angebot_freigabe');
            expect(t).toBeDefined();
            expect(t.trigger.type).toBe('amount');
            expect(t.trigger.threshold).toBe(5000);
            expect(t.steps.length).toBe(2);
        });

        it('should include ausgabe_freigabe template', () => {
            const t = service.templates.find(t => t.id === 'ausgabe_freigabe');
            expect(t).toBeDefined();
            expect(t.trigger.type).toBe('amount');
            expect(t.trigger.threshold).toBe(1000);
        });

        it('should include rabatt_freigabe template', () => {
            const t = service.templates.find(t => t.id === 'rabatt_freigabe');
            expect(t).toBeDefined();
            expect(t.trigger.type).toBe('discount');
            expect(t.trigger.threshold).toBe(15);
            expect(t.steps.length).toBe(1);
        });

        it('should include rechnung_storno template', () => {
            const t = service.templates.find(t => t.id === 'rechnung_storno');
            expect(t).toBeDefined();
            expect(t.trigger.type).toBe('action');
            expect(t.trigger.action).toBe('storno');
        });
    });

    describe('findApplicableWorkflow', () => {
        it('should match amount trigger when betrag exceeds threshold', () => {
            const result = service.findApplicableWorkflow('angebot', { betrag: 6000 });
            expect(result).toBeDefined();
            expect(result.id).toBe('angebot_freigabe');
        });

        it('should match amount trigger using "amount" field', () => {
            const result = service.findApplicableWorkflow('angebot', { amount: 6000 });
            expect(result).toBeDefined();
            expect(result.id).toBe('angebot_freigabe');
        });

        it('should match ausgabe_freigabe for amounts between 1000 and 4999', () => {
            const result = service.findApplicableWorkflow('ausgabe', { betrag: 2000 });
            expect(result).toBeDefined();
            expect(result.id).toBe('ausgabe_freigabe');
        });

        it('should match discount trigger when rabatt exceeds threshold', () => {
            const result = service.findApplicableWorkflow('angebot', { rabatt: 20 });
            expect(result).toBeDefined();
            expect(result.id).toBe('rabatt_freigabe');
        });

        it('should match discount trigger using "discount" field', () => {
            const result = service.findApplicableWorkflow('angebot', { discount: 20 });
            expect(result).toBeDefined();
            expect(result.id).toBe('rabatt_freigabe');
        });

        it('should match action trigger for storno', () => {
            const result = service.findApplicableWorkflow('rechnung', { action: 'storno' });
            expect(result).toBeDefined();
            expect(result.id).toBe('rechnung_storno');
        });

        it('should return null when no workflow matches', () => {
            const result = service.findApplicableWorkflow('angebot', { betrag: 100 });
            expect(result).toBeNull();
        });

        it('should return null for empty documentData', () => {
            const result = service.findApplicableWorkflow('angebot', {});
            expect(result).toBeNull();
        });

        it('should return first matching workflow (amount checked first)', () => {
            const result = service.findApplicableWorkflow('anything', { betrag: 6000 });
            expect(result.id).toBe('angebot_freigabe');
        });
    });

    describe('createRequest', () => {
        it('should return required: false when no workflow applies', () => {
            const result = service.createRequest('angebot', 'doc-1', { betrag: 100 });
            expect(result).toEqual({ required: false });
        });

        it('should create a request when amount triggers workflow', () => {
            const result = service.createRequest('angebot', 'doc-1', { betrag: 6000, requestedBy: 'user1' });
            expect(result.required).toBe(true);
            expect(result.request).toBeDefined();
            expect(result.request.documentType).toBe('angebot');
            expect(result.request.documentId).toBe('doc-1');
            expect(result.request.status).toBe('pending');
            expect(result.request.currentStep).toBe(0);
        });

        it('should generate an id starting with apr-', () => {
            const result = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            expect(result.request.id).toMatch(/^apr-\d+$/);
        });

        it('should set first step to pending and rest to waiting', () => {
            const result = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const steps = result.request.steps;
            expect(steps[0].status).toBe('pending');
            expect(steps[1].status).toBe('waiting');
        });

        it('should set step metadata correctly', () => {
            const result = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const step = result.request.steps[0];
            expect(step.approver).toBeNull();
            expect(step.approvedAt).toBeNull();
            expect(step.rejectedAt).toBeNull();
            expect(step.comment).toBeNull();
            expect(step.index).toBe(0);
        });

        it('should use specified workflowId when provided', () => {
            const result = service.createRequest('rechnung', 'doc-2', { betrag: 100 }, 'rechnung_storno');
            expect(result.required).toBe(true);
            expect(result.request.workflowId).toBe('rechnung_storno');
            expect(result.request.workflowName).toBe('Rechnungs-Storno');
        });

        it('should return required: false when explicit workflowId is not found', () => {
            const result = service.createRequest('doc', 'doc-1', {}, 'nonexistent_workflow');
            expect(result).toEqual({ required: false });
        });

        it('should set requestedBy from documentData or default to system', () => {
            const result1 = service.createRequest('angebot', 'doc-1', { betrag: 6000, requestedBy: 'hans' });
            expect(result1.request.requestedBy).toBe('hans');

            const result2 = service.createRequest('angebot', 'doc-2', { betrag: 6000 });
            expect(result2.request.requestedBy).toBe('system');
        });

        it('should persist the request to localStorage', () => {
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const stored = JSON.parse(localStorageMock.getItem('freyai_approval_requests'));
            expect(stored).toBeInstanceOf(Array);
            expect(stored.length).toBe(1);
        });

        it('should add request to internal requests array', () => {
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            expect(service.requests.length).toBe(1);
        });

        it('should call notifyApprover for the first step', () => {
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            expect(window.showToast).toHaveBeenCalled();
        });

        it('should set createdAt and updatedAt timestamps', () => {
            const result = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            expect(result.request.createdAt).toBeDefined();
            expect(result.request.updatedAt).toBeDefined();
            expect(result.request.completedAt).toBeNull();
            expect(result.request.escalatedAt).toBeNull();
        });

        it('should store documentData on the request', () => {
            const data = { betrag: 6000, requestedBy: 'user1', extra: 'info' };
            const result = service.createRequest('angebot', 'doc-1', data);
            expect(result.request.documentData).toEqual(data);
        });
    });

    describe('approve', () => {
        let requestId;

        beforeEach(() => {
            const result = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            requestId = result.request.id;
            vi.clearAllMocks();
        });

        it('should approve the first step', () => {
            const result = service.approve(requestId, 0, 'Hans Meier', 'Looks good');
            expect(result.success).toBe(true);
            expect(result.request.steps[0].status).toBe('approved');
            expect(result.request.steps[0].approver).toBe('Hans Meier');
            expect(result.request.steps[0].comment).toBe('Looks good');
            expect(result.request.steps[0].approvedAt).toBeDefined();
        });

        it('should advance to next step after first approval', () => {
            const result = service.approve(requestId, 0, 'Hans');
            expect(result.request.currentStep).toBe(1);
            expect(result.request.steps[1].status).toBe('pending');
            expect(result.request.status).toBe('pending');
        });

        it('should mark request as approved when last step is approved', () => {
            service.approve(requestId, 0, 'Hans');
            const result = service.approve(requestId, 1, 'Chef');
            expect(result.request.status).toBe('approved');
            expect(result.request.completedAt).toBeDefined();
        });

        it('should call onApprovalComplete when all steps approved', () => {
            service.approve(requestId, 0, 'Hans');
            service.approve(requestId, 1, 'Chef');
            expect(console.warn).toHaveBeenCalled();
        });

        it('should create a task via taskService when approval completes', () => {
            const addTaskMock = vi.fn();
            window.taskService = { addTask: addTaskMock };

            service.approve(requestId, 0, 'Hans');
            service.approve(requestId, 1, 'Chef');

            expect(addTaskMock).toHaveBeenCalledWith(expect.objectContaining({
                priority: 'high',
                source: 'approval'
            }));
        });

        it('should notify the next approver after advancing', () => {
            service.approve(requestId, 0, 'Hans');
            expect(window.showToast).toHaveBeenCalled();
        });

        it('should return error for non-existent request', () => {
            const result = service.approve('nonexistent', 0, 'Hans');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Request not found');
        });

        it('should return error for non-existent step', () => {
            const result = service.approve(requestId, 99, 'Hans');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Step not found');
        });

        it('should return error for step not in pending status', () => {
            service.approve(requestId, 0, 'Hans');
            const result = service.approve(requestId, 0, 'Hans again');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Step not pending');
        });

        it('should persist changes to localStorage', () => {
            service.approve(requestId, 0, 'Hans');
            const stored = JSON.parse(localStorageMock.getItem('freyai_approval_requests'));
            expect(stored[0].steps[0].status).toBe('approved');
        });

        it('should update updatedAt timestamp', () => {
            service.approve(requestId, 0, 'Hans');
            expect(service.requests[0].updatedAt).toBeDefined();
        });

        it('should use empty string as default comment', () => {
            const result = service.approve(requestId, 0, 'Hans');
            expect(result.request.steps[0].comment).toBe('');
        });
    });

    describe('reject', () => {
        let requestId;

        beforeEach(() => {
            const result = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            requestId = result.request.id;
            vi.clearAllMocks();
        });

        it('should reject the step and mark request as rejected', () => {
            const result = service.reject(requestId, 0, 'Hans', 'Too expensive');
            expect(result.success).toBe(true);
            expect(result.request.steps[0].status).toBe('rejected');
            expect(result.request.steps[0].approver).toBe('Hans');
            expect(result.request.steps[0].rejectedAt).toBeDefined();
            expect(result.request.steps[0].comment).toBe('Too expensive');
            expect(result.request.status).toBe('rejected');
            expect(result.request.completedAt).toBeDefined();
        });

        it('should call notifyRejection with showToast', () => {
            window.showToast = vi.fn();
            service.reject(requestId, 0, 'Hans', 'Nein');
            expect(window.showToast).toHaveBeenCalledWith(
                expect.stringContaining('abgelehnt'),
                'error'
            );
        });

        it('should return error for non-existent request', () => {
            const result = service.reject('nonexistent', 0, 'Hans');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Request not found');
        });

        it('should return error for invalid step index', () => {
            const result = service.reject(requestId, 99, 'Hans');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid step');
        });

        it('should return error for step not in pending status', () => {
            service.reject(requestId, 0, 'Hans');
            const result = service.reject(requestId, 0, 'Hans again');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid step');
        });

        it('should persist rejection to localStorage', () => {
            service.reject(requestId, 0, 'Hans');
            const stored = JSON.parse(localStorageMock.getItem('freyai_approval_requests'));
            expect(stored[0].status).toBe('rejected');
        });

        it('should use empty string as default comment', () => {
            const result = service.reject(requestId, 0, 'Hans');
            expect(result.request.steps[0].comment).toBe('');
        });
    });

    describe('escalate', () => {
        let requestId;

        beforeEach(() => {
            const result = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            requestId = result.request.id;
            vi.clearAllMocks();
        });

        it('should mark request as escalated', () => {
            const result = service.escalate(requestId);
            expect(result).toBeDefined();
            expect(result.status).toBe('escalated');
            expect(result.escalatedAt).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });

        it('should mark current step as escalated', () => {
            const result = service.escalate(requestId);
            expect(result.steps[0].status).toBe('escalated');
        });

        it('should return null for non-existent request', () => {
            const result = service.escalate('nonexistent');
            expect(result).toBeNull();
        });

        it('should persist escalation to localStorage', () => {
            service.escalate(requestId);
            const stored = JSON.parse(localStorageMock.getItem('freyai_approval_requests'));
            expect(stored[0].status).toBe('escalated');
        });

        it('should call notifyEscalation with showToast', () => {
            window.showToast = vi.fn();
            service.escalate(requestId);
            expect(window.showToast).toHaveBeenCalledWith(
                expect.stringContaining('Eskalation'),
                'warning'
            );
        });
    });

    describe('checkTimeouts', () => {
        it('should return empty array when no requests exist', () => {
            const result = service.checkTimeouts();
            expect(result).toEqual([]);
        });

        it('should not escalate requests within timeout', () => {
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const result = service.checkTimeouts();
            expect(result).toEqual([]);
        });

        it('should escalate requests past timeout', () => {
            const createResult = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const request = createResult.request;
            // Set createdAt to 25 hours ago (timeout for step1 is 24 hours)
            request.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

            const result = service.checkTimeouts();
            expect(result.length).toBe(1);
            expect(result[0]).toBe(request.id);
            expect(request.status).toBe('escalated');
        });

        it('should only check pending requests', () => {
            const createResult = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const request = createResult.request;
            request.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
            request.status = 'approved';

            const result = service.checkTimeouts();
            expect(result).toEqual([]);
        });

        it('should use previous step approvedAt for non-first steps', () => {
            const createResult = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const request = createResult.request;
            service.approve(request.id, 0, 'Hans');
            // Backdate step 0 approvedAt to 49 hours ago (step 2 timeout is 48 hours)
            request.steps[0].approvedAt = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();

            const result = service.checkTimeouts();
            expect(result.length).toBe(1);
        });
    });

    describe('getPendingForRole', () => {
        it('should return requests where current step matches role', () => {
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const result = service.getPendingForRole('projektleiter');
            expect(result.length).toBe(1);
        });

        it('should return empty for non-matching role', () => {
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const result = service.getPendingForRole('geschaeftsfuehrer');
            expect(result.length).toBe(0);
        });

        it('should return requests for second step role after first step approved', () => {
            const createResult = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            service.approve(createResult.request.id, 0, 'Hans');

            const result = service.getPendingForRole('geschaeftsfuehrer');
            expect(result.length).toBe(1);
        });

        it('should not return rejected requests', () => {
            const createResult = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            service.reject(createResult.request.id, 0, 'Hans');

            const result = service.getPendingForRole('projektleiter');
            expect(result.length).toBe(0);
        });
    });

    describe('getAllPending', () => {
        it('should return empty array when no requests', () => {
            expect(service.getAllPending()).toEqual([]);
        });

        it('should return all pending requests', () => {
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            service.createRequest('angebot', 'doc-2', { betrag: 7000 });
            expect(service.getAllPending().length).toBe(2);
        });

        it('should exclude rejected and approved requests', () => {
            const r1 = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            service.createRequest('angebot', 'doc-2', { betrag: 7000 });
            service.reject(r1.request.id, 0, 'Hans');

            expect(service.getAllPending().length).toBe(1);
        });
    });

    describe('getRequest', () => {
        it('should return request by id', () => {
            const createResult = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const found = service.getRequest(createResult.request.id);
            expect(found).toBeDefined();
            expect(found.id).toBe(createResult.request.id);
        });

        it('should return undefined for non-existent id', () => {
            const result = service.getRequest('nonexistent');
            expect(result).toBeUndefined();
        });
    });

    describe('getRequestsByDocument', () => {
        it('should return requests matching documentId', () => {
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            service.createRequest('angebot', 'doc-2', { betrag: 7000 });

            const result = service.getRequestsByDocument('doc-1');
            expect(result.length).toBe(1);
            expect(result[0].documentId).toBe('doc-1');
        });

        it('should return empty array for unknown documentId', () => {
            const result = service.getRequestsByDocument('nonexistent');
            expect(result).toEqual([]);
        });
    });

    describe('getTemplates', () => {
        it('should return all templates', () => {
            const templates = service.getTemplates();
            expect(templates.length).toBe(4);
        });

        it('should return the same array reference as service.templates', () => {
            expect(service.getTemplates()).toBe(service.templates);
        });
    });

    describe('addTemplate', () => {
        it('should add a custom template with provided id', () => {
            const template = {
                id: 'custom-test',
                name: 'Test Template',
                trigger: { type: 'amount', threshold: 500 },
                steps: [{ id: 's1', role: 'tester', name: 'Tester', timeout: 12 }]
            };

            const result = service.addTemplate(template);
            expect(result.id).toBe('custom-test');
            expect(service.templates.length).toBe(5);
        });

        it('should auto-generate id when not provided', () => {
            const template = {
                name: 'No ID Template',
                trigger: { type: 'amount', threshold: 100 },
                steps: []
            };

            const result = service.addTemplate(template);
            expect(result.id).toMatch(/^custom-\d+$/);
        });

        it('should persist templates to localStorage', () => {
            service.addTemplate({ name: 'Test', trigger: {}, steps: [] });
            const stored = JSON.parse(localStorageMock.getItem('freyai_approval_templates'));
            expect(stored.length).toBe(5);
        });

        it('should return the added template', () => {
            const template = { id: 'my-template', name: 'Mine', trigger: {}, steps: [] };
            const result = service.addTemplate(template);
            expect(result).toBe(template);
        });
    });

    describe('getStatistics', () => {
        it('should return zeroes for empty requests', () => {
            const stats = service.getStatistics();
            expect(stats.pending).toBe(0);
            expect(stats.approved).toBe(0);
            expect(stats.rejected).toBe(0);
            expect(stats.escalated).toBe(0);
            expect(stats.total).toBe(0);
            expect(stats.avgApprovalTimeHours).toBe('0.0');
            expect(stats.approvalRate).toBe('0.0');
        });

        it('should count pending requests', () => {
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            service.createRequest('angebot', 'doc-2', { betrag: 7000 });

            const stats = service.getStatistics();
            expect(stats.pending).toBe(2);
            expect(stats.total).toBe(2);
        });

        it('should count approved and rejected requests', () => {
            // Manually create two requests with distinct IDs to avoid Date.now() collision
            const r1 = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const r1Id = r1.request.id;

            // Force a different ID for the second request
            const origDateNow = Date.now;
            Date.now = () => origDateNow() + 1000;

            const r2 = service.createRequest('rechnung', 'doc-2', { action: 'storno' }, 'rechnung_storno');
            const r2Id = r2.request.id;
            Date.now = origDateNow;

            // Approve r1 fully
            service.approve(r1Id, 0, 'Hans');
            service.approve(r1Id, 1, 'Chef');

            // Reject r2
            service.reject(r2Id, 0, 'Hans');

            const stats = service.getStatistics();
            expect(stats.approved).toBe(1);
            expect(stats.rejected).toBe(1);
            expect(stats.pending).toBe(0);
            expect(stats.total).toBe(2);
        });

        it('should calculate approval rate', () => {
            const r1 = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const r1Id = r1.request.id;

            // Force a different ID for the second request
            const origDateNow = Date.now;
            Date.now = () => origDateNow() + 2000;

            const r2 = service.createRequest('rechnung', 'doc-2', { action: 'storno' }, 'rechnung_storno');
            const r2Id = r2.request.id;
            Date.now = origDateNow;

            // Approve r1 fully
            service.approve(r1Id, 0, 'Hans');
            service.approve(r1Id, 1, 'Chef');

            // Reject r2
            service.reject(r2Id, 0, 'Hans');

            const stats = service.getStatistics();
            // 1 approved / (1 approved + 1 rejected) = 50%
            expect(stats.approvalRate).toBe('50.0');
        });

        it('should count escalated requests', () => {
            const r1 = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            service.escalate(r1.request.id);

            const stats = service.getStatistics();
            expect(stats.escalated).toBe(1);
        });

        it('should calculate average approval time', () => {
            const r1 = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            r1.request.createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

            service.approve(r1.request.id, 0, 'Hans');
            service.approve(r1.request.id, 1, 'Chef');

            const stats = service.getStatistics();
            const avgHours = parseFloat(stats.avgApprovalTimeHours);
            expect(avgHours).toBeGreaterThan(1.5);
            expect(avgHours).toBeLessThan(3);
        });
    });

    describe('notifications', () => {
        it('should call window.showToast for notifyApprover', () => {
            window.showToast = vi.fn();
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            expect(window.showToast).toHaveBeenCalledWith(
                expect.stringContaining('Freigabe-Anfrage'),
                'info'
            );
        });

        it('should fall back to window.UI.showToast if window.showToast is not a function', () => {
            window.showToast = null;
            window.UI = { showToast: vi.fn() };
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            expect(window.UI.showToast).toHaveBeenCalledWith(
                expect.stringContaining('Freigabe-Anfrage'),
                'info'
            );
        });

        it('should log to communicationService if available', () => {
            const logMock = vi.fn();
            window.communicationService = { logMessage: logMock };
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            expect(logMock).toHaveBeenCalledWith(expect.objectContaining({
                type: 'system',
                to: 'projektleiter'
            }));
        });

        it('should call showToast with error on rejection', () => {
            window.showToast = vi.fn();
            const r = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            vi.clearAllMocks();
            service.reject(r.request.id, 0, 'Hans');
            expect(window.showToast).toHaveBeenCalledWith(
                expect.stringContaining('abgelehnt'),
                'error'
            );
        });

        it('should call showToast with warning on escalation', () => {
            window.showToast = vi.fn();
            const r = service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            vi.clearAllMocks();
            service.escalate(r.request.id);
            expect(window.showToast).toHaveBeenCalledWith(
                expect.stringContaining('Eskalation'),
                'warning'
            );
        });
    });

    describe('save / saveTemplates', () => {
        it('should persist requests via save()', () => {
            service.createRequest('angebot', 'doc-1', { betrag: 6000 });
            const stored = JSON.parse(localStorageMock.getItem('freyai_approval_requests'));
            expect(stored.length).toBe(1);
        });

        it('should persist templates via saveTemplates()', () => {
            service.saveTemplates();
            const stored = JSON.parse(localStorageMock.getItem('freyai_approval_templates'));
            expect(stored.length).toBe(4);
        });
    });

    describe('full approval workflow end-to-end', () => {
        it('should process a complete two-step approval workflow', () => {
            const result = service.createRequest('angebot', 'doc-1', {
                betrag: 10000,
                requestedBy: 'sachbearbeiter'
            });
            expect(result.required).toBe(true);
            const id = result.request.id;

            expect(service.getPendingForRole('projektleiter').length).toBe(1);
            expect(service.getPendingForRole('geschaeftsfuehrer').length).toBe(0);

            service.approve(id, 0, 'Projektleiter Schmidt', 'Geprüft');
            expect(service.getPendingForRole('projektleiter').length).toBe(0);
            expect(service.getPendingForRole('geschaeftsfuehrer').length).toBe(1);

            const addTaskMock = vi.fn();
            window.taskService = { addTask: addTaskMock };
            service.approve(id, 1, 'Geschäftsführer Müller', 'Freigegeben');

            const request = service.getRequest(id);
            expect(request.status).toBe('approved');
            expect(request.completedAt).toBeDefined();
            expect(request.steps[0].status).toBe('approved');
            expect(request.steps[1].status).toBe('approved');
            expect(addTaskMock).toHaveBeenCalled();

            const stats = service.getStatistics();
            expect(stats.approved).toBe(1);
            expect(stats.approvalRate).toBe('100.0');
        });

        it('should handle rejection at second step', () => {
            const result = service.createRequest('angebot', 'doc-1', { betrag: 8000 });
            const id = result.request.id;

            service.approve(id, 0, 'Projektleiter');
            service.reject(id, 1, 'Geschäftsführer', 'Budget zu hoch');

            const request = service.getRequest(id);
            expect(request.status).toBe('rejected');
            expect(request.steps[0].status).toBe('approved');
            expect(request.steps[1].status).toBe('rejected');
        });

        it('should handle single-step workflow (rabatt_freigabe)', () => {
            const result = service.createRequest('angebot', 'doc-1', { rabatt: 25 });
            expect(result.required).toBe(true);
            expect(result.request.steps.length).toBe(1);

            const addTaskMock = vi.fn();
            window.taskService = { addTask: addTaskMock };

            service.approve(result.request.id, 0, 'Vertriebsleiter');

            const request = service.getRequest(result.request.id);
            expect(request.status).toBe('approved');
            expect(addTaskMock).toHaveBeenCalled();
        });
    });
});
