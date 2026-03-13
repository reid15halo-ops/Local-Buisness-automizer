import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

const mockStorage = {};
globalThis.localStorage = {
    getItem: vi.fn(k => mockStorage[k] || null),
    setItem: vi.fn((k, v) => { mockStorage[k] = v; }),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => {
        const raw = mockStorage[key];
        return raw ? JSON.parse(raw) : fallback;
    }),
};

globalThis.window = globalThis;
window.showToast = vi.fn();
window.taskService = null;
window.automationAPI = null;
window.Notification = null;

vi.useFakeTimers();

await import('../js/services/workflow-service.js');

const svc = () => window.workflowService;

// ============================================
// Tests
// ============================================

describe('WorkflowService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        vi.clearAllTimers();
        window.workflowService = new window.workflowService.constructor();
        window.taskService = null;
        window.automationAPI = null;
    });

    // ── Trigger/Action Types ──

    describe('types', () => {
        it('has trigger types', () => {
            expect(Object.keys(svc().triggerTypes).length).toBeGreaterThan(5);
            expect(svc().triggerTypes['invoice.created']).toBeTruthy();
            expect(svc().triggerTypes['manual']).toBeTruthy();
        });

        it('has action types', () => {
            expect(Object.keys(svc().actionTypes).length).toBeGreaterThan(5);
            expect(svc().actionTypes['email.send']).toBeTruthy();
            expect(svc().actionTypes['task.create']).toBeTruthy();
        });

        it('has operators', () => {
            expect(svc().operators.equals).toBe('=');
            expect(svc().operators.contains).toBe('enthält');
        });
    });

    // ── CRUD ──

    describe('createWorkflow', () => {
        it('creates a workflow', () => {
            const result = svc().createWorkflow({
                name: 'Test Workflow',
                trigger: { type: 'manual', params: {} },
                actions: [{ type: 'log', params: { message: 'test' } }],
            });
            expect(result.success).toBe(true);
            expect(result.workflow.id).toMatch(/^wf-/);
            expect(result.workflow.active).toBe(true);
        });

        it('persists workflow', () => {
            svc().createWorkflow({ name: 'Test' });
            expect(mockStorage['freyai_workflows']).toBeTruthy();
        });
    });

    describe('updateWorkflow', () => {
        it('updates workflow', () => {
            const { workflow } = svc().createWorkflow({ name: 'Original' });
            const result = svc().updateWorkflow(workflow.id, { name: 'Updated' });
            expect(result.success).toBe(true);
            expect(result.workflow.name).toBe('Updated');
        });

        it('returns error for unknown ID', () => {
            const result = svc().updateWorkflow('wf-999', { name: 'X' });
            expect(result.success).toBe(false);
        });
    });

    describe('deleteWorkflow', () => {
        it('deletes workflow', () => {
            const { workflow } = svc().createWorkflow({ name: 'Test' });
            svc().deleteWorkflow(workflow.id);
            expect(svc().workflows).toHaveLength(0);
        });
    });

    describe('toggleWorkflow', () => {
        it('toggles active state', () => {
            const { workflow } = svc().createWorkflow({ name: 'Test' });
            expect(workflow.active).toBe(true);
            const result = svc().toggleWorkflow(workflow.id);
            expect(result.active).toBe(false);
            svc().toggleWorkflow(workflow.id);
            expect(svc().workflows[0].active).toBe(true);
        });

        it('returns failure for unknown ID', () => {
            expect(svc().toggleWorkflow('wf-999').success).toBe(false);
        });
    });

    // ── Conditions ──

    describe('evaluateConditions', () => {
        it('returns true for empty conditions', () => {
            expect(svc().evaluateConditions([], {})).toBe(true);
        });

        it('evaluates equals', () => {
            expect(svc().evaluateConditions(
                [{ field: '{{status}}', operator: 'equals', value: 'active' }],
                { status: 'active' }
            )).toBe(true);
        });

        it('evaluates not_equals', () => {
            expect(svc().evaluateConditions(
                [{ field: '{{status}}', operator: 'not_equals', value: 'active' }],
                { status: 'inactive' }
            )).toBe(true);
        });

        it('evaluates contains', () => {
            expect(svc().evaluateConditions(
                [{ field: '{{name}}', operator: 'contains', value: 'test' }],
                { name: 'test user' }
            )).toBe(true);
        });

        it('evaluates greater_than', () => {
            expect(svc().evaluateConditions(
                [{ field: '{{amount}}', operator: 'greater_than', value: '100' }],
                { amount: 200 }
            )).toBe(true);
        });

        it('evaluates is_empty', () => {
            expect(svc().evaluateConditions(
                [{ field: '{{notes}}', operator: 'is_empty' }],
                { notes: '' }
            )).toBe(true);
        });

        it('returns false when any condition fails (AND logic)', () => {
            expect(svc().evaluateConditions([
                { field: '{{a}}', operator: 'equals', value: '1' },
                { field: '{{b}}', operator: 'equals', value: '2' },
            ], { a: '1', b: '3' })).toBe(false);
        });
    });

    // ── Value Resolution ──

    describe('resolveValue', () => {
        it('replaces template variables', () => {
            expect(svc().resolveValue('Hello {{name}}', { name: 'World' })).toBe('Hello World');
        });

        it('handles nested paths', () => {
            expect(svc().resolveValue('{{customer.name}}', { customer: { name: 'Meier' } })).toBe('Meier');
        });

        it('preserves non-string values', () => {
            expect(svc().resolveValue(42, {})).toBe(42);
        });

        it('keeps unresolved variables', () => {
            expect(svc().resolveValue('{{unknown}}', {})).toBe('{{unknown}}');
        });
    });

    // ── Delay Parsing ──

    describe('parseDelay', () => {
        it('parses minutes', () => {
            expect(svc().parseDelay('5 minute')).toBe(300000);
        });

        it('parses German units', () => {
            expect(svc().parseDelay('2 stunde')).toBe(7200000);
            expect(svc().parseDelay('1 tag')).toBe(86400000);
        });

        it('returns 0 for invalid input', () => {
            expect(svc().parseDelay('invalid')).toBe(0);
        });
    });

    // ── Execution ──

    describe('executeWorkflow', () => {
        it('returns error for unknown workflow', async () => {
            const result = await svc().executeWorkflow('wf-999');
            expect(result.success).toBe(false);
        });

        it('returns error for inactive workflow', async () => {
            const { workflow } = svc().createWorkflow({ name: 'Test' });
            svc().toggleWorkflow(workflow.id);
            const result = await svc().executeWorkflow(workflow.id);
            expect(result.success).toBe(false);
        });

        it('executes workflow with log action', async () => {
            const { workflow } = svc().createWorkflow({
                name: 'Logger',
                actions: [{ type: 'log', params: { message: 'Test log' } }],
            });
            const result = await svc().executeWorkflow(workflow.id);
            expect(result.success).toBe(true);
            expect(workflow.runCount).toBe(1);
        });

        it('skips when conditions not met', async () => {
            const { workflow } = svc().createWorkflow({
                name: 'Conditional',
                conditions: [{ field: '{{status}}', operator: 'equals', value: 'active' }],
                actions: [{ type: 'log', params: { message: 'test' } }],
            });
            const result = await svc().executeWorkflow(workflow.id, { status: 'inactive' });
            expect(result.success).toBe(true);
            expect(result.skipped).toBe(true);
        });

        it('creates task via taskService', async () => {
            const addTask = vi.fn();
            window.taskService = { addTask };
            const { workflow } = svc().createWorkflow({
                name: 'Task Creator',
                actions: [{ type: 'task.create', params: { title: 'New Task', priority: 'high' } }],
            });
            await svc().executeWorkflow(workflow.id);
            expect(addTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Task' }));
        });
    });

    // ── Trigger Event ──

    describe('triggerEvent', () => {
        it('triggers matching workflows', async () => {
            const { workflow } = svc().createWorkflow({
                name: 'On Invoice',
                trigger: { type: 'invoice.created', params: {} },
                actions: [{ type: 'log', params: { message: 'invoice!' } }],
            });
            await svc().triggerEvent('invoice.created', {});
            expect(workflow.runCount).toBe(1);
        });

        it('ignores non-matching events', async () => {
            const { workflow } = svc().createWorkflow({
                name: 'On Invoice',
                trigger: { type: 'invoice.created', params: {} },
                actions: [{ type: 'log', params: { message: 'test' } }],
            });
            await svc().triggerEvent('customer.created', {});
            expect(workflow.runCount).toBe(0);
        });
    });
});
