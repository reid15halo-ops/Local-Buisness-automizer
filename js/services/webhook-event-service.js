/* ============================================
   Webhook Event Service
   n8n Bridge — sendet App-Events an n8n Webhooks
   ============================================ */

class WebhookEventService {
    constructor() {
        // Fester n8n Webhook Endpunkt (via nginx Proxy)
        this.n8nWebhookUrl = 'https://app.freyaivisions.de/n8n-webhook/freyai-events';
        this._enabled = true;
    }

    async init() {
        try {
            // Optional: URL aus Settings überschreiben
            const settingsUrl = window.storeService?.state?.settings?.n8nWebhookUrl;
            if (settingsUrl) {
                this.n8nWebhookUrl = settingsUrl;
            }
            console.debug('[WebhookEvents] Initialisiert. Endpoint:', this.n8nWebhookUrl);
        } catch (e) {
            window.errorHandler?.handle(e, 'WebhookEventService');
        }
    }

    /**
     * Sendet ein Event an den n8n Webhook.
     * Fire-and-forget: Fehler werden nur geloggt, nie geworfen.
     *
     * @param {string} eventType  - z.B. 'invoice.created'
     * @param {Object} payload    - Event-spezifische Daten
     */
    async emit(eventType, payload) {
        if (!this._enabled || !this.n8nWebhookUrl) {return;}

        const body = {
            event: eventType,
            data: payload,
            timestamp: new Date().toISOString(),
            source: 'freyai-app'
        };

        try {
            const response = await fetch(this.n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                console.warn(`[WebhookEvents] ${eventType} → HTTP ${response.status}`);
            } else {
                console.debug(`[WebhookEvents] ${eventType} gesendet`);
            }
        } catch (err) {
            // Nie den App-Flow unterbrechen
            console.warn('[WebhookEvents] Event emit fehlgeschlagen:', err.message);
        }
    }

    // ============================================
    // Convenience-Methoden für App-Events
    // ============================================

    /**
     * Ausgangsrechnung erstellt
     * @param {Object} rechnung - Rechnungs-Objekt
     */
    async invoiceCreated(rechnung) {
        await this.emit('invoice.created', {
            nummer: rechnung.nummer,
            kunde: rechnung.kunde?.name || rechnung.kunde || '',
            brutto: rechnung.brutto,
            netto: rechnung.netto,
            status: rechnung.status,
            datum: rechnung.datum,
            faelligkeitsdatum: rechnung.faelligkeitsdatum,
            id: rechnung.id
        });
    }

    /**
     * Ausgangsrechnung bezahlt
     * @param {Object} rechnung - Rechnungs-Objekt
     */
    async invoicePaid(rechnung) {
        await this.emit('invoice.paid', {
            nummer: rechnung.nummer,
            kunde: rechnung.kunde?.name || rechnung.kunde || '',
            brutto: rechnung.brutto,
            paidAt: rechnung.paidAt,
            paymentMethod: rechnung.paymentMethod,
            id: rechnung.id
        });
    }

    /**
     * Bestellung (PO) erstellt
     * @param {Object} po - Purchase Order Objekt
     */
    async poCreated(po) {
        await this.emit('po.created', {
            nummer: po.nummer,
            lieferant: po.lieferant?.name || po.lieferantName || '',
            netto: po.netto,
            brutto: po.brutto,
            positionen: (po.positionen || []).length,
            status: po.status,
            id: po.id
        });
    }

    /**
     * Bestellung geliefert
     * @param {Object} po - Purchase Order Objekt
     */
    async poDelivered(po) {
        await this.emit('po.delivered', {
            nummer: po.nummer,
            lieferant: po.lieferant?.name || po.lieferantName || '',
            id: po.id
        });
    }

    /**
     * Support-Ticket erstellt
     * @param {Object} ticket - Ticket-Objekt
     */
    async ticketCreated(ticket) {
        await this.emit('ticket.created', {
            ticketNummer: ticket.ticket_number || ticket.ticketNummer,
            betreff: ticket.subject || ticket.betreff || '',
            prioritaet: ticket.priority || ticket.prioritaet || 'normal',
            email: ticket.customer_email || ticket.email || '',
            id: ticket.id
        });
    }
}

window.webhookEventService = new WebhookEventService();
