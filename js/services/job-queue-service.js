/* ============================================
   Job Queue Service
   Async buffer between frontend and backend
   FreyAI Visions - 95/5 Architecture
   
   This is the CRITICAL component that enables
   the 95/5 model: AI handles 95% of work by
   processing jobs asynchronously. The human
   only reviews the 5% that needs approval.
   
   All heavy operations (OCR, email drafts,
   dunning calculations, etc.) are submitted
   as jobs. The backend processes them and
   pushes results back via Realtime.
   ============================================ */

class JobQueueService {
    constructor() {
        /** @type {Map<string, Function[]>} jobId -> resolve callbacks for waitForJob */
        this._pendingWatchers = new Map();
        /** @type {Function|null} unsubscribe function for realtime */
        this._realtimeUnsub = null;
        /** @type {boolean} */
        this._listenerSetup = false;
    }

    /**
     * Initialize realtime listener for job updates.
     * Called lazily on first use.
     */
    _ensureRealtimeListener() {
        if (this._listenerSetup) { return; }
        this._listenerSetup = true;

        const userId = this._getUserId();
        if (!userId) { return; }

        // Listen for job updates via dbService (which uses RealtimeService internally)
        this._realtimeUnsub = window.dbService.subscribeToJobUpdates((payload) => {
            const job = payload.new || payload;
            if (!job || !job.id) { return; }

            // Notify any waiters for this job
            const watchers = this._pendingWatchers.get(job.id);
            if (watchers && (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled')) {
                watchers.forEach(resolve => {
                    try { resolve(job); } catch (e) {}
                });
                this._pendingWatchers.delete(job.id);
            }
        });
    }

    _getUserId() {
        if (window.authService && window.authService.getUser()) {
            return window.authService.getUser().id;
        }
        if (window.userManager && window.userManager.getCurrentUser()) {
            return window.userManager.getCurrentUser().id;
        }
        return 'default';
    }

    // ========================================
    // Core Job Operations
    // ========================================

    /**
     * Submit a job to the queue.
     * Jobs are processed by the backend (Supabase Edge Functions / n8n).
     * 
     * @param {string} jobType - Job type identifier
     * @param {Object} payload - Job-specific data
     * @param {number} priority - 1 (highest) to 10 (lowest), default 5
     * @returns {Promise<Object>} Created job with ID
     */
    async submitJob(jobType, payload, priority = 5) {
        this._ensureRealtimeListener();

        try {
            const job = await window.dbService.addJob(jobType, payload, priority);
            console.info(`[JobQueue] Submitted job: ${jobType} (id: ${job.id}, priority: ${priority})`);

            // If running offline, mark job as 'local' so UI can show it
            if (!window.supabaseClient || !window.supabaseClient.isConfigured()) {
                console.info(`[JobQueue] Offline mode: job ${job.id} stored locally.`);
            }

            return job;
        } catch (err) {
            console.error('[JobQueue] submitJob error:', err);
            throw err;
        }
    }

    /**
     * Wait for a job to complete (polls + realtime).
     * Returns the completed job or throws on timeout.
     * 
     * @param {string} jobId - Job ID to wait for
     * @param {number} timeoutMs - Max wait time (default 30s)
     * @returns {Promise<Object>} Completed job
     */
    async waitForJob(jobId, timeoutMs = 30000) {
        this._ensureRealtimeListener();

        return new Promise(async (resolve, reject) => {
            let settled = false;
            const settle = (result) => {
                if (settled) { return; }
                settled = true;
                clearTimeout(timer);
                clearInterval(pollInterval);
                if (result.status === 'failed') {
                    reject(new Error(result.error || 'Job failed'));
                } else if (result.status === 'cancelled') {
                    reject(new Error('Job was cancelled'));
                } else {
                    // Parse result if it's a JSON string
                    if (result.result && typeof result.result === 'string') {
                        try { result.result = JSON.parse(result.result); } catch (e) {}
                    }
                    resolve(result);
                }
            };

            // Register as watcher
            if (!this._pendingWatchers.has(jobId)) {
                this._pendingWatchers.set(jobId, []);
            }
            this._pendingWatchers.get(jobId).push(settle);

            // Timeout
            const timer = setTimeout(() => {
                this._pendingWatchers.delete(jobId);
                if (!settled) {
                    settled = true;
                    clearInterval(pollInterval);
                    reject(new Error(`Job ${jobId} timed out after ${timeoutMs}ms`));
                }
            }, timeoutMs);

            // Polling fallback (every 2s) in case Realtime misses an update
            const pollInterval = setInterval(async () => {
                if (settled) { clearInterval(pollInterval); return; }
                try {
                    const jobs = await window.dbService.getJobsQueue();
                    const job = jobs.find(j => j.id === jobId);
                    if (job && (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled')) {
                        const watchers = this._pendingWatchers.get(jobId) || [];
                        watchers.forEach(cb => { try { cb(job); } catch (e) {} });
                        this._pendingWatchers.delete(jobId);
                    }
                } catch (e) {
                    console.error('[JobQueueService] Unhandled error:', e);
                }
            }, 2000);

            // Check immediately if job already done
            try {
                const jobs = await window.dbService.getJobsQueue();
                const job = jobs.find(j => j.id === jobId);
                if (job && (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled')) {
                    settle(job);
                }
            } catch (e) {
                console.error('[JobQueueService] Unhandled error:', e);
            }
        });
    }

    // ========================================
    // Specialized Job Submitters
    // ========================================

    /**
     * Submit an invoice OCR job.
     * Backend extracts invoice data from a file and creates a pending_approval invoice.
     * 
     * @param {string} fileUrl - URL or base64 of the file to OCR
     * @param {string} invoiceId - Existing invoice ID to attach OCR result to (optional)
     * @returns {Promise<Object>} Job object
     */
    async submitInvoiceOCR(fileUrl, invoiceId = null) {
        return this.submitJob('invoice_ocr', {
            file_url: fileUrl,
            invoice_id: invoiceId,
            requested_at: new Date().toISOString()
        }, 3); // Higher priority for OCR
    }

    /**
     * Submit an email draft job.
     * Backend uses AI to draft an email based on context.
     * Result will have status='pending_approval' in communications table.
     * 
     * @param {string} communicationId - Communication thread ID
     * @param {Object} context - { customer, subject, previousMessages, intent }
     * @returns {Promise<Object>} Job object
     */
    async submitEmailDraft(communicationId, context) {
        return this.submitJob('email_draft', {
            communication_id: communicationId,
            context: {
                customer_name: context.customer?.name || context.customerName || '',
                customer_email: context.customer?.email || context.customerEmail || '',
                subject: context.subject || '',
                intent: context.intent || 'follow_up',
                previous_messages: context.previousMessages || [],
                language: context.language || 'de',
                tone: context.tone || 'professional'
            }
        }, 5);
    }

    /**
     * Submit a dunning check job.
     * Backend evaluates all open invoices and prepares dunning actions.
     * Results appear as action_required_dunning items.
     * 
     * @param {Object} options - { userId, checkDate }
     * @returns {Promise<Object>} Job object
     */
    async submitDunningCheck(options = {}) {
        return this.submitJob('dunning_check', {
            check_date: options.checkDate || new Date().toISOString().split('T')[0],
            send_reminders: options.sendReminders !== false,
            escalate_overdue: options.escalateOverdue !== false
        }, 4); // Slightly higher priority
    }

    /**
     * Submit a bank sync job.
     * Backend syncs transactions from the connected bank account.
     * 
     * @param {string} bankAccountId
     * @returns {Promise<Object>} Job object
     */
    async submitBankSync(bankAccountId) {
        return this.submitJob('bank_sync', {
            bank_account_id: bankAccountId,
            sync_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }, 6);
    }

    /**
     * Submit an invoice PDF generation job.
     * Backend generates a GoBD-compliant PDF.
     * 
     * @param {string} invoiceId
     * @param {Object} options - { template, language }
     * @returns {Promise<Object>} Job object
     */
    async submitInvoicePDFGeneration(invoiceId, options = {}) {
        return this.submitJob('invoice_pdf', {
            invoice_id: invoiceId,
            template: options.template || 'standard-de',
            language: options.language || 'de',
            include_einvoice: options.includeEInvoice !== false
        }, 5);
    }

    /**
     * Submit a customer communication AI analysis job.
     * Backend analyzes incoming messages and prepares responses.
     * 
     * @param {string} messageId - Incoming message ID
     * @param {string} channel - 'email' | 'sms' | 'whatsapp'
     * @returns {Promise<Object>} Job object
     */
    async submitMessageAnalysis(messageId, channel = 'email') {
        return this.submitJob('message_analysis', {
            message_id: messageId,
            channel,
            requested_at: new Date().toISOString()
        }, 3);
    }

    /**
     * Submit an auto-quote generation job.
     * Backend uses inquiry data to generate a quote draft.
     * 
     * @param {string} inquiryId
     * @returns {Promise<Object>} Job object
     */
    async submitAutoQuote(inquiryId) {
        return this.submitJob('auto_quote', {
            inquiry_id: inquiryId,
            requested_at: new Date().toISOString()
        }, 4);
    }

    // ========================================
    // Job Status & Management
    // ========================================

    /**
     * Get all pending (not yet done) jobs for the current user.
     * @returns {Promise<Object[]>}
     */
    async getPendingJobs() {
        try {
            const [pending, processing] = await Promise.all([
                window.dbService.getJobsQueue('pending'),
                window.dbService.getJobsQueue('processing')
            ]);
            return [...pending, ...processing].sort((a, b) =>
                new Date(b.created_at) - new Date(a.created_at)
            );
        } catch (err) {
            console.error('[JobQueue] getPendingJobs error:', err);
            return [];
        }
    }

    /**
     * Get all failed jobs for the current user.
     * @returns {Promise<Object[]>}
     */
    async getFailedJobs() {
        try {
            return await window.dbService.getJobsQueue('failed');
        } catch (err) {
            return [];
        }
    }

    /**
     * Get all completed jobs.
     * @returns {Promise<Object[]>}
     */
    async getCompletedJobs() {
        try {
            return await window.dbService.getJobsQueue('done');
        } catch (err) {
            return [];
        }
    }

    /**
     * Cancel a pending or processing job.
     * @param {string} jobId
     * @returns {Promise<Object>}
     */
    async cancelJob(jobId) {
        try {
            const result = await window.dbService.updateJobStatus(jobId, 'cancelled');
            console.info(`[JobQueue] Job ${jobId} cancelled.`);

            // Notify watchers
            const watchers = this._pendingWatchers.get(jobId) || [];
            watchers.forEach(cb => { try { cb({ id: jobId, status: 'cancelled' }); } catch (e) {} });
            this._pendingWatchers.delete(jobId);

            return result;
        } catch (err) {
            console.error('[JobQueue] cancelJob error:', err);
            throw err;
        }
    }

    /**
     * Retry a failed job by re-submitting it.
     * @param {string} jobId
     * @returns {Promise<Object>} New job
     */
    async retryJob(jobId) {
        const jobs = await window.dbService.getJobsQueue();
        const job = jobs.find(j => j.id === jobId);

        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }

        if (job.status !== 'failed' && job.status !== 'cancelled') {
            throw new Error(`Job ${jobId} is not in a retryable state (status: ${job.status})`);
        }

        const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
        return this.submitJob(job.job_type, payload, job.priority || 5);
    }

    /**
     * Get a summary of the current job queue.
     * @returns {Promise<Object>}
     */
    async getQueueSummary() {
        try {
            const allJobs = await window.dbService.getJobsQueue();
            const summary = {
                total: allJobs.length,
                pending: 0,
                processing: 0,
                done: 0,
                failed: 0,
                cancelled: 0
            };

            allJobs.forEach(job => {
                if (summary.hasOwnProperty(job.status)) {
                    summary[job.status]++;
                }
            });

            return summary;
        } catch (err) {
            return { total: 0, pending: 0, processing: 0, done: 0, failed: 0, cancelled: 0 };
        }
    }

    /**
     * Cleanup: remove the realtime listener.
     */
    destroy() {
        if (this._realtimeUnsub) {
            try { this._realtimeUnsub(); } catch (e) {
                console.error('[JobQueueService] Unhandled error:', e);
            }
            this._realtimeUnsub = null;
        }
        this._pendingWatchers.clear();
        this._listenerSetup = false;
    }
}

window.jobQueueService = new JobQueueService();
