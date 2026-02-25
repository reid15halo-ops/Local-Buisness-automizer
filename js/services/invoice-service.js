/* ============================================
   Invoice Service
   Orchestrates invoice creation and management
   ============================================ */

class InvoiceService {
    constructor() {
        this.numberingService = null;
        this.templateService = null;
        this.pdfService = null;
        this.eInvoiceService = null;
        this.storeService = null;
        this.bookkeepingService = null;
    }

    /**
     * Initialize service dependencies
     */
    async init() {
        this.numberingService = window.invoiceNumberingService;
        this.templateService = window.invoiceTemplateService;
        this.pdfService = window.pdfGenerationService;
        this.eInvoiceService = window.eInvoiceService;
        this.storeService = window.storeService;
        this.bookkeepingService = window.bookkeepingService;

        // Set current user for numbering service
        if (this.storeService && this.storeService.getCurrentUserId) {
            const userId = this.storeService.getCurrentUserId();
            if (userId) {
                this.numberingService.setUser(userId);
            }
        }
    }

    /**
     * Create invoice from Auftrag
     * @param {Object} auftrag - Auftrag object
     * @param {Object} options - Options
     * @returns {Promise<Object>} Created invoice
     */
    async createInvoice(auftrag, options = {}) {
        await this.init();

        const defaults = {
            generatePDF: false,
            openPDF: false,
            downloadPDF: false,
            generateEInvoice: false,
            paymentTermDays: 14,
            templateId: 'standard-de'
        };

        const opts = { ...defaults, ...options };

        try {
            // 1. Generate invoice number
            const userId = this.storeService?.getCurrentUserId?.() || 'default';
            const invoiceNumber = await this.numberingService.generateNumber(userId);

            // 2. Calculate dates
            const invoiceDate = new Date().toISOString();
            const dueDate = this.addDays(new Date(), opts.paymentTermDays).toISOString();

            // 3. Calculate totals
            const netto = auftrag.netto + (auftrag.materialKosten || 0);
            const mwst = netto * _getTaxRate();
            const brutto = netto * (1 + _getTaxRate());

            // 4. Create invoice object
            const invoice = {
                id: this.storeService.generateId('RE'),
                nummer: invoiceNumber,
                auftragId: auftrag.id,
                angebotId: auftrag.angebotId,
                kunde: auftrag.kunde,
                leistungsart: auftrag.leistungsart,
                positionen: auftrag.positionen || [],
                arbeitszeit: auftrag.arbeitszeit,
                materialKosten: auftrag.materialKosten,
                notizen: auftrag.notizen,
                netto: netto,
                mwst: mwst,
                brutto: brutto,
                status: 'offen',
                datum: invoiceDate,
                faelligkeitsdatum: dueDate,
                createdAt: invoiceDate,
                pdfGenerated: false,
                eInvoiceGenerated: false
            };

            // 5. Save to store
            this.storeService.state.rechnungen.push(invoice);
            this.storeService.save();

            // 6. Activity log
            this.storeService.addActivity('💰', `Rechnung ${invoiceNumber} erstellt`);

            // 7. Optional: Generate PDF
            if (opts.generatePDF || opts.openPDF || opts.downloadPDF) {
                try {
                    if (opts.downloadPDF) {
                        await this.pdfService.downloadPDF(invoice, opts.templateId);
                        invoice.pdfGenerated = true;
                        this.storeService.addActivity('📄', `PDF für ${invoiceNumber} heruntergeladen`);
                    } else if (opts.openPDF) {
                        await this.pdfService.openPDF(invoice, opts.templateId);
                        invoice.pdfGenerated = true;
                        this.storeService.addActivity('📄', `PDF für ${invoiceNumber} geöffnet`);
                    }
                } catch (error) {
                    console.error('PDF generation error:', error);
                    // Continue even if PDF fails
                }
            }

            // 8. Optional: Generate E-Invoice
            if (opts.generateEInvoice) {
                try {
                    const result = this.eInvoiceService.generateXRechnung(invoice);
                    if (result.success) {
                        invoice.eInvoiceGenerated = true;
                        invoice.eInvoiceRecordId = result.recordId;
                        this.storeService.addActivity('🔐', `E-Rechnung für ${invoiceNumber} erstellt`);
                    }
                } catch (error) {
                    console.error('E-Invoice generation error:', error);
                    // Continue even if e-invoice fails
                }
            }

            // 9. Update store if PDF or e-invoice was generated
            if (invoice.pdfGenerated || invoice.eInvoiceGenerated) {
                this.storeService.save();
            }

            return invoice;

        } catch (error) {
            console.error('Invoice creation error:', error);
            throw error;
        }
    }

    /**
     * Mark invoice as paid
     * @param {string} invoiceId - Invoice ID
     * @param {Object} paymentData - Payment information
     * @returns {Promise<Object>} Updated invoice
     */
    async markAsPaid(invoiceId, paymentData = {}) {
        await this.init();

        const invoice = this.storeService.state.rechnungen.find(r => r.id === invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }

        // Update invoice
        invoice.status = 'bezahlt';
        invoice.paidAt = new Date().toISOString();
        invoice.paymentMethod = paymentData.method || 'Überweisung';
        invoice.paymentNote = paymentData.note || '';

        this.storeService.save();
        this.storeService.addActivity('✅', `Rechnung ${invoice.nummer} als bezahlt markiert`);

        // Integrate with bookkeeping if available
        if (this.bookkeepingService) {
            try {
                // 1. Record payment (Umsatzerlöse / Revenue)
                this.bookkeepingService.recordPayment({
                    invoiceId: invoice.id,
                    amount: invoice.brutto,
                    date: invoice.paidAt,
                    method: invoice.paymentMethod,
                    reference: invoice.nummer
                });

                // 2. Record material costs (COGS / Materialaufwendungen) if applicable
                if (invoice.materialKosten > 0 || invoice.stueckliste) {
                    this.bookkeepingService.recordMaterialCosts(invoice);
                }
            } catch (error) {
                console.error('Bookkeeping integration error:', error);
                // Continue even if bookkeeping fails
            }
        }

        return invoice;
    }

    /**
     * Mark invoice as cancelled
     * @param {string} invoiceId - Invoice ID
     * @param {string} reason - Cancellation reason
     * @returns {Promise<Object>} Updated invoice
     */
    async cancelInvoice(invoiceId, reason = '') {
        await this.init();

        const invoice = this.storeService.state.rechnungen.find(r => r.id === invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }

        if (invoice.status === 'bezahlt') {
            throw new Error('Cannot cancel paid invoice');
        }

        invoice.status = 'storniert';
        invoice.cancelledAt = new Date().toISOString();
        invoice.cancellationReason = reason;

        this.storeService.save();
        this.storeService.addActivity('❌', `Rechnung ${invoice.nummer} storniert`);

        return invoice;
    }

    /**
     * Get overdue invoices
     * @returns {Array} Overdue invoices
     */
    getOverdueInvoices() {
        if (!this.storeService) {return [];}

        const now = new Date();
        return this.storeService.state.rechnungen.filter(invoice => {
            if (invoice.status !== 'offen') {return false;}

            const dueDate = new Date(invoice.faelligkeitsdatum || invoice.createdAt);
            return dueDate < now;
        });
    }

    /**
     * Get invoices by status
     * @param {string} status - Status filter
     * @returns {Array} Filtered invoices
     */
    getInvoicesByStatus(status) {
        if (!this.storeService) {return [];}
        return this.storeService.state.rechnungen.filter(r => r.status === status);
    }

    /**
     * Get invoice by number
     * @param {string} nummer - Invoice number
     * @returns {Object|null} Invoice
     */
    getInvoiceByNumber(nummer) {
        if (!this.storeService) {return null;}
        return this.storeService.state.rechnungen.find(r => r.nummer === nummer);
    }

    /**
     * Generate PDF for existing invoice
     * @param {string} invoiceId - Invoice ID
     * @param {Object} options - Options
     * @returns {Promise<Object>} Result
     */
    async generatePDF(invoiceId, options = {}) {
        await this.init();

        const invoice = this.storeService.state.rechnungen.find(r => r.id === invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }

        const defaults = {
            templateId: 'standard-de',
            download: false,
            open: true
        };

        const opts = { ...defaults, ...options };

        try {
            if (opts.download) {
                await this.pdfService.downloadPDF(invoice, opts.templateId);
                this.storeService.addActivity('📄', `PDF für ${invoice.nummer} heruntergeladen`);
            } else if (opts.open) {
                await this.pdfService.openPDF(invoice, opts.templateId);
            }

            invoice.pdfGenerated = true;
            invoice.lastPdfGeneratedAt = new Date().toISOString();
            this.storeService.save();

            return {
                success: true,
                invoiceNumber: invoice.nummer
            };
        } catch (error) {
            console.error('PDF generation error:', error);
            throw error;
        }
    }

    /**
     * Generate e-invoice for existing invoice
     * @param {string} invoiceId - Invoice ID
     * @param {Object} options - Options
     * @returns {Promise<Object>} Result
     */
    async generateEInvoice(invoiceId, options = {}) {
        await this.init();

        const invoice = this.storeService.state.rechnungen.find(r => r.id === invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }

        const defaults = {
            format: 'xrechnung', // or 'zugferd'
            download: true
        };

        const opts = { ...defaults, ...options };

        try {
            let result;
            if (opts.format === 'zugferd') {
                result = await this.eInvoiceService.generateZugferd(invoice);
            } else {
                result = this.eInvoiceService.generateXRechnung(invoice);
            }

            if (result.success) {
                invoice.eInvoiceGenerated = true;
                invoice.eInvoiceRecordId = result.recordId;
                invoice.lastEInvoiceGeneratedAt = new Date().toISOString();

                this.storeService.save();
                this.storeService.addActivity('🔐', `E-Rechnung für ${invoice.nummer} erstellt`);

                // Download if requested
                if (opts.download) {
                    this.eInvoiceService.downloadXml(result.recordId);
                }
            }

            return result;
        } catch (error) {
            console.error('E-Invoice generation error:', error);
            throw error;
        }
    }

    /**
     * Helper: Add days to date
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    /**
     * Get invoice statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        if (!this.storeService) {return {};}

        const invoices = this.storeService.state.rechnungen;

        return {
            total: invoices.length,
            offen: invoices.filter(r => r.status === 'offen').length,
            bezahlt: invoices.filter(r => r.status === 'bezahlt').length,
            ueberfaellig: this.getOverdueInvoices().length,
            storniert: invoices.filter(r => r.status === 'storniert').length,
            summeOffen: invoices
                .filter(r => r.status === 'offen')
                .reduce((sum, r) => sum + (r.brutto || 0), 0),
            summeBezahlt: invoices
                .filter(r => r.status === 'bezahlt')
                .reduce((sum, r) => sum + (r.brutto || 0), 0)
        };
    }
}

window.invoiceService = new InvoiceService();
