import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => fallback),
};

globalThis.window = globalThis;
window.authService = null;
window.userManager = null;
window.supabaseClient = null;

let jobIdCounter = 0;
const mockJobs = [];

window.dbService = {
    addJob: vi.fn(async (type, payload, priority) => {
        const job = { id: `job-${++jobIdCounter}`, job_type: type, payload, priority, status: 'pending', created_at: new Date().toISOString() };
        mockJobs.push(job);
        return job;
    }),
    getJobsQueue: vi.fn(async (status) => {
        if (status) return mockJobs.filter(j => j.status === status);
        return [...mockJobs];
    }),
    updateJobStatus: vi.fn(async (id, status) => {
        const job = mockJobs.find(j => j.id === id);
        if (job) job.status = status;
        return job;
    }),
    subscribeToJobUpdates: vi.fn(() => vi.fn()),
};

await import('../js/services/job-queue-service.js');

const svc = () => window.jobQueueService;

// ============================================
// Tests
// ============================================

describe('JobQueueService', () => {
    beforeEach(() => {
        mockJobs.length = 0;
        jobIdCounter = 0;
        window.jobQueueService = new window.jobQueueService.constructor();
        vi.clearAllMocks();
    });

    // ── Submit Job ──

    describe('submitJob', () => {
        it('submits a job and returns it', async () => {
            const job = await svc().submitJob('test_job', { data: 'hello' }, 5);
            expect(job.id).toBeTruthy();
            expect(job.job_type).toBe('test_job');
            expect(job.priority).toBe(5);
        });

        it('calls dbService.addJob', async () => {
            await svc().submitJob('ocr', { file: 'test.pdf' }, 3);
            expect(window.dbService.addJob).toHaveBeenCalledWith('ocr', { file: 'test.pdf' }, 3);
        });

        it('throws on error', async () => {
            window.dbService.addJob.mockRejectedValueOnce(new Error('db error'));
            await expect(svc().submitJob('test', {})).rejects.toThrow('db error');
        });
    });

    // ── Specialized Submitters ──

    describe('Specialized Submitters', () => {
        it('submits invoice OCR job with priority 3', async () => {
            const job = await svc().submitInvoiceOCR('https://example.com/file.pdf', 'inv-1');
            expect(job.job_type).toBe('invoice_ocr');
            expect(job.priority).toBe(3);
        });

        it('submits email draft job', async () => {
            const job = await svc().submitEmailDraft('comm-1', {
                customer: { name: 'Meier', email: 'meier@test.de' },
                subject: 'Angebot',
                intent: 'follow_up',
            });
            expect(job.job_type).toBe('email_draft');
        });

        it('submits dunning check job', async () => {
            const job = await svc().submitDunningCheck({ checkDate: '2024-03-15' });
            expect(job.job_type).toBe('dunning_check');
            expect(job.priority).toBe(4);
        });

        it('submits bank sync job', async () => {
            const job = await svc().submitBankSync('acc-1');
            expect(job.job_type).toBe('bank_sync');
        });

        it('submits invoice PDF generation job', async () => {
            const job = await svc().submitInvoicePDFGeneration('inv-1', { template: 'premium' });
            expect(job.job_type).toBe('invoice_pdf');
        });

        it('submits message analysis job', async () => {
            const job = await svc().submitMessageAnalysis('msg-1', 'whatsapp');
            expect(job.job_type).toBe('message_analysis');
        });

        it('submits auto quote job', async () => {
            const job = await svc().submitAutoQuote('inq-1');
            expect(job.job_type).toBe('auto_quote');
        });
    });

    // ── Job Status ──

    describe('Job Status', () => {
        it('gets pending jobs', async () => {
            mockJobs.push({ id: 'j1', status: 'pending', created_at: new Date().toISOString() });
            mockJobs.push({ id: 'j2', status: 'processing', created_at: new Date().toISOString() });
            mockJobs.push({ id: 'j3', status: 'done', created_at: new Date().toISOString() });

            const pending = await svc().getPendingJobs();
            expect(pending).toHaveLength(2);
        });

        it('gets failed jobs', async () => {
            mockJobs.push({ id: 'j1', status: 'failed' });
            const failed = await svc().getFailedJobs();
            expect(failed).toHaveLength(1);
        });

        it('gets completed jobs', async () => {
            mockJobs.push({ id: 'j1', status: 'done' });
            const done = await svc().getCompletedJobs();
            expect(done).toHaveLength(1);
        });

        it('returns empty on error', async () => {
            window.dbService.getJobsQueue.mockRejectedValueOnce(new Error('fail'));
            const pending = await svc().getPendingJobs();
            expect(pending).toEqual([]);
        });
    });

    // ── Cancel Job ──

    describe('cancelJob', () => {
        it('cancels a job', async () => {
            mockJobs.push({ id: 'j1', status: 'pending' });
            await svc().cancelJob('j1');
            expect(window.dbService.updateJobStatus).toHaveBeenCalledWith('j1', 'cancelled');
        });
    });

    // ── Retry Job ──

    describe('retryJob', () => {
        it('retries a failed job', async () => {
            mockJobs.push({ id: 'j1', status: 'failed', job_type: 'ocr', payload: { file: 'test' }, priority: 3 });
            const newJob = await svc().retryJob('j1');
            expect(newJob.job_type).toBe('ocr');
        });

        it('throws for non-existent job', async () => {
            await expect(svc().retryJob('nonexistent')).rejects.toThrow('not found');
        });

        it('throws for non-retryable job', async () => {
            mockJobs.push({ id: 'j1', status: 'pending', job_type: 'test', payload: {} });
            await expect(svc().retryJob('j1')).rejects.toThrow('not in a retryable state');
        });
    });

    // ── Queue Summary ──

    describe('getQueueSummary', () => {
        it('returns summary counts', async () => {
            mockJobs.push({ id: 'j1', status: 'pending' });
            mockJobs.push({ id: 'j2', status: 'pending' });
            mockJobs.push({ id: 'j3', status: 'done' });
            mockJobs.push({ id: 'j4', status: 'failed' });

            const summary = await svc().getQueueSummary();
            expect(summary.total).toBe(4);
            expect(summary.pending).toBe(2);
            expect(summary.done).toBe(1);
            expect(summary.failed).toBe(1);
        });

        it('returns zeros on error', async () => {
            window.dbService.getJobsQueue.mockRejectedValueOnce(new Error('fail'));
            const summary = await svc().getQueueSummary();
            expect(summary.total).toBe(0);
        });
    });

    // ── Destroy ──

    describe('destroy', () => {
        it('cleans up watchers and listener', () => {
            svc()._pendingWatchers.set('j1', [vi.fn()]);
            svc().destroy();
            expect(svc()._pendingWatchers.size).toBe(0);
            expect(svc()._listenerSetup).toBe(false);
        });
    });

    // ── getUserId ──

    describe('_getUserId', () => {
        it('returns default when no auth', () => {
            expect(svc()._getUserId()).toBe('default');
        });

        it('returns user ID from authService', () => {
            window.authService = { getUser: () => ({ id: 'user-1' }) };
            expect(svc()._getUserId()).toBe('user-1');
            window.authService = null;
        });
    });
});
