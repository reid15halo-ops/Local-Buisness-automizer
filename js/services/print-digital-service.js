/* ============================================
   Print-to-Digital Bridge Service
   Fax to email, print queue monitoring
   ============================================ */

class PrintDigitalService {
    constructor() {
        this.printQueue = JSON.parse(localStorage.getItem('mhs_print_queue') || '[]');
        this.faxInbox = JSON.parse(localStorage.getItem('mhs_fax_inbox') || '[]');
        this.settings = JSON.parse(localStorage.getItem('mhs_print_settings') || '{}');

        // Default settings
        if (!this.settings.preferDigital) this.settings.preferDigital = true;
        if (!this.settings.autoDigitize) this.settings.autoDigitize = true;
        if (!this.settings.faxEmail) this.settings.faxEmail = '';
    }

    // Add item to print queue
    addToPrintQueue(document, options = {}) {
        const queueItem = {
            id: 'print-' + Date.now(),
            documentId: document.id,
            documentType: document.type, // rechnung, angebot, brief, etc.
            documentTitle: document.title || document.name,
            recipient: document.recipient || {},
            status: 'pending', // pending, processing, printed, failed, digital_sent
            priority: options.priority || 'normal',
            copies: options.copies || 1,
            color: options.color || false,
            duplex: options.duplex || false,
            preferDigital: options.preferDigital ?? this.settings.preferDigital,
            digitalFallback: options.digitalFallback ?? true,
            createdAt: new Date().toISOString(),
            processedAt: null,
            notes: options.notes || ''
        };

        // Check if recipient prefers digital
        if (queueItem.preferDigital && this.canSendDigital(queueItem.recipient)) {
            queueItem.deliveryMethod = 'email';
            queueItem.status = 'digital_pending';
        } else if (queueItem.digitalFallback && this.canSendDigital(queueItem.recipient)) {
            queueItem.deliveryMethod = 'email_fallback';
        } else {
            queueItem.deliveryMethod = 'print';
        }

        this.printQueue.push(queueItem);
        this.save();

        // Auto-process if digital
        if (queueItem.deliveryMethod === 'email') {
            this.sendDigital(queueItem.id);
        }

        return queueItem;
    }

    // Check if digital delivery is possible
    canSendDigital(recipient) {
        return recipient && (recipient.email || recipient.fax);
    }

    // Process print queue item
    processPrintItem(itemId) {
        const item = this.printQueue.find(i => i.id === itemId);
        if (!item) return { success: false, error: 'Item not found' };

        if (item.deliveryMethod === 'print') {
            // Simulate print (in real app, would connect to print service)
            item.status = 'processing';
            this.save();

            // Open print dialog
            setTimeout(() => {
                item.status = 'printed';
                item.processedAt = new Date().toISOString();
                this.save();
                console.log(`🖨️ Gedruckt: ${item.documentTitle}`);
            }, 1000);

            return { success: true, method: 'print' };
        } else {
            return this.sendDigital(itemId);
        }
    }

    // Send digital version
    sendDigital(itemId) {
        const item = this.printQueue.find(i => i.id === itemId);
        if (!item) return { success: false, error: 'Item not found' };

        // Simulate email sending
        item.status = 'digital_sent';
        item.processedAt = new Date().toISOString();
        this.save();

        // Log to communication service
        if (window.communicationService) {
            window.communicationService.logMessage({
                type: 'email',
                direction: 'outbound',
                to: item.recipient.email,
                subject: item.documentTitle,
                content: `Digitale Zustellung: ${item.documentTitle}`,
                status: 'sent'
            });
        }

        console.log(`📧 Digital gesendet: ${item.documentTitle} an ${item.recipient.email}`);
        return { success: true, method: 'email' };
    }

    // Receive fax (simulated - would integrate with fax service)
    receiveFax(faxData) {
        const fax = {
            id: 'fax-' + Date.now(),
            from: faxData.from || 'Unbekannt',
            pages: faxData.pages || 1,
            receivedAt: new Date().toISOString(),
            status: 'unread',
            category: null,
            attachedTo: null,
            ocrText: null,
            thumbnail: faxData.thumbnail || null
        };

        // Auto-digitize if enabled
        if (this.settings.autoDigitize) {
            fax.status = 'digitizing';
            // Simulate OCR
            setTimeout(() => {
                fax.ocrText = faxData.content || 'Gescannter Fax-Inhalt...';
                fax.status = 'digitized';
                fax.category = this.categorizeFax(fax.ocrText);
                this.saveFaxes();
            }, 1000);
        }

        this.faxInbox.push(fax);
        this.saveFaxes();

        // Forward to email if configured
        if (this.settings.faxEmail) {
            this.forwardFaxToEmail(fax);
        }

        return fax;
    }

    // Forward fax to email
    forwardFaxToEmail(fax) {
        if (window.communicationService) {
            window.communicationService.logMessage({
                type: 'email',
                direction: 'outbound',
                to: this.settings.faxEmail,
                subject: `Fax von ${fax.from}`,
                content: `Neues Fax eingegangen\n\nVon: ${fax.from}\nSeiten: ${fax.pages}\nEmpfangen: ${new Date(fax.receivedAt).toLocaleString('de-DE')}\n\n${fax.ocrText || 'OCR wird verarbeitet...'}`,
                status: 'sent'
            });
        }
        console.log(`📠→📧 Fax weitergeleitet an ${this.settings.faxEmail}`);
    }

    // Categorize fax content
    categorizeFax(text) {
        const lower = text.toLowerCase();
        if (lower.includes('rechnung') || lower.includes('invoice')) return 'rechnung';
        if (lower.includes('angebot') || lower.includes('quote')) return 'angebot';
        if (lower.includes('bestellung') || lower.includes('order')) return 'bestellung';
        if (lower.includes('mahnung')) return 'mahnung';
        return 'sonstiges';
    }

    // Get print queue
    getPrintQueue(status = null) {
        let queue = this.printQueue;
        if (status) {
            queue = queue.filter(i => i.status === status);
        }
        return queue.sort((a, b) => {
            // Priority sort
            const priorityOrder = { high: 0, normal: 1, low: 2 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
    }

    // Get fax inbox
    getFaxInbox(status = null) {
        let inbox = this.faxInbox;
        if (status) {
            inbox = inbox.filter(f => f.status === status);
        }
        return inbox.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    }

    // Mark fax as read
    markFaxRead(faxId) {
        const fax = this.faxInbox.find(f => f.id === faxId);
        if (fax) {
            fax.status = 'read';
            this.saveFaxes();
        }
        return fax;
    }

    // Attach fax to document
    attachFaxToDocument(faxId, documentType, documentId) {
        const fax = this.faxInbox.find(f => f.id === faxId);
        if (fax) {
            fax.attachedTo = { type: documentType, id: documentId };
            fax.status = 'attached';
            this.saveFaxes();
        }
        return fax;
    }

    // Get migration statistics (paper to digital)
    getMigrationStats() {
        const queue = this.printQueue;
        const totalItems = queue.length;
        const digitalSent = queue.filter(i => i.deliveryMethod === 'email' || i.status === 'digital_sent').length;
        const printed = queue.filter(i => i.status === 'printed').length;

        const digitalRate = totalItems > 0
            ? ((digitalSent / totalItems) * 100).toFixed(1)
            : 0;

        // Paper savings estimate (pages * cost)
        const paperSaved = digitalSent * 1; // Assume 1 page per document
        const costSaved = paperSaved * 0.05; // €0.05 per page

        return {
            totalDocuments: totalItems,
            digitalDelivered: digitalSent,
            printed: printed,
            digitalRate: parseFloat(digitalRate),
            paperSaved: paperSaved,
            costSaved: costSaved,
            faxesReceived: this.faxInbox.length,
            faxesDigitized: this.faxInbox.filter(f => f.status === 'digitized' || f.status === 'attached').length
        };
    }

    // Cancel print job
    cancelPrintJob(itemId) {
        const item = this.printQueue.find(i => i.id === itemId);
        if (item && item.status === 'pending') {
            item.status = 'cancelled';
            item.processedAt = new Date().toISOString();
            this.save();
            return { success: true };
        }
        return { success: false, error: 'Cannot cancel' };
    }

    // Retry failed item
    retryItem(itemId) {
        const item = this.printQueue.find(i => i.id === itemId);
        if (item && item.status === 'failed') {
            item.status = 'pending';
            item.retryCount = (item.retryCount || 0) + 1;
            this.save();
            return this.processPrintItem(itemId);
        }
        return { success: false, error: 'Cannot retry' };
    }

    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('mhs_print_settings', JSON.stringify(this.settings));
    }

    // Persistence
    save() {
        localStorage.setItem('mhs_print_queue', JSON.stringify(this.printQueue));
    }

    saveFaxes() {
        localStorage.setItem('mhs_fax_inbox', JSON.stringify(this.faxInbox));
    }
}

window.printDigitalService = new PrintDigitalService();
