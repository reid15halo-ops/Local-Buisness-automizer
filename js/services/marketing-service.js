/* ============================================
   Marketing Service - Automatisiertes Marketing
   Google-Bewertungen & Saisonale Kampagnen
   Für Handwerksbetriebe
   ============================================ */

class MarketingService {
    constructor() {
        this.reviewRequests = JSON.parse(localStorage.getItem('mhs_review_requests') || '[]');
        this.campaigns = JSON.parse(localStorage.getItem('mhs_campaigns') || '[]');
        this.googleReviewUrl = localStorage.getItem('mhs_google_review_url') || '';

        // Settings
        this.settings = JSON.parse(localStorage.getItem('mhs_marketing_settings') || '{}');
        if (!this.settings.autoScheduleEnabled) { this.settings.autoScheduleEnabled = false; }
        if (!this.settings.defaultDelayDays) { this.settings.defaultDelayDays = 7; }
        if (!this.settings.defaultChannel) { this.settings.defaultChannel = 'sms'; }

        // Built-in seasonal templates
        this.seasonalTemplates = this._buildSeasonalTemplates();

        // Periodic check for due review requests
        this._startScheduleCheck();
    }

    // ============================================
    // Google Review URL
    // ============================================

    setGoogleReviewUrl(url) {
        this.googleReviewUrl = url;
        localStorage.setItem('mhs_google_review_url', url);
        return url;
    }

    getGoogleReviewUrl() {
        return this.googleReviewUrl;
    }

    // ============================================
    // Review Requests - CRUD
    // ============================================

    scheduleReviewRequest(orderId, delayDays) {
        delayDays = delayDays || this.settings.defaultDelayDays || 7;

        // Try to get order details
        let order = null;
        let customer = null;

        if (window.storeService) {
            const store = window.storeService.getStore();
            order = store.auftraege?.find(a => a.id === orderId);
        }

        if (!order) {
            // Fallback: try global store
            if (typeof store !== 'undefined') {
                order = store.auftraege?.find(a => a.id === orderId);
            }
        }

        if (!order) {
            console.warn('Marketing: Auftrag nicht gefunden:', orderId);
            return null;
        }

        // Get customer info
        if (order.kundeId && window.customerService) {
            customer = window.customerService.getCustomer(order.kundeId);
        }

        const customerName = customer?.name || order.kunde || order.kundenName || 'Kunde';
        const customerPhone = customer?.telefon || customer?.mobil || order.telefon || '';
        const customerEmail = customer?.email || order.email || '';

        // Check if already scheduled for this order
        const existing = this.reviewRequests.find(r =>
            r.orderId === orderId && (r.status === 'geplant' || r.status === 'gesendet')
        );
        if (existing) {
            return existing;
        }

        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + delayDays);

        const request = {
            id: 'RVW-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            customerId: customer?.id || order.kundeId || '',
            customerName: customerName,
            customerPhone: customerPhone,
            customerEmail: customerEmail,
            orderId: orderId,
            orderDescription: order.titel || order.beschreibung || order.leistung || 'Auftrag',
            scheduledDate: scheduledDate.toISOString().split('T')[0],
            sentAt: null,
            channel: this.settings.defaultChannel || 'sms',
            status: 'geplant',
            googleReviewUrl: this.googleReviewUrl,
            createdAt: new Date().toISOString()
        };

        this.reviewRequests.push(request);
        this._saveReviewRequests();
        return request;
    }

    autoScheduleReviewRequests() {
        let auftraege = [];

        if (window.storeService) {
            const store = window.storeService.getStore();
            auftraege = store.auftraege || [];
        } else if (typeof store !== 'undefined') {
            auftraege = store.auftraege || [];
        }

        // Find completed orders without a review request
        const completedOrders = auftraege.filter(a => a.status === 'abgeschlossen');
        const existingOrderIds = new Set(this.reviewRequests.map(r => r.orderId));

        let scheduled = 0;
        completedOrders.forEach(order => {
            if (!existingOrderIds.has(order.id)) {
                const result = this.scheduleReviewRequest(order.id, this.settings.defaultDelayDays);
                if (result) { scheduled++; }
            }
        });

        return { scheduled, total: completedOrders.length };
    }

    getReviewRequests() {
        return [...this.reviewRequests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    getReviewRequest(id) {
        return this.reviewRequests.find(r => r.id === id);
    }

    cancelReviewRequest(id) {
        const request = this.reviewRequests.find(r => r.id === id);
        if (request && request.status === 'geplant') {
            request.status = 'abgelehnt';
            this._saveReviewRequests();
            return true;
        }
        return false;
    }

    markAsAnswered(id) {
        const request = this.reviewRequests.find(r => r.id === id);
        if (request) {
            request.status = 'beantwortet';
            this._saveReviewRequests();
            return true;
        }
        return false;
    }

    // ============================================
    // Review Message Generation
    // ============================================

    generateReviewMessage(customerName, orderDescription) {
        const businessName = this._getBusinessName();
        const reviewUrl = this.googleReviewUrl || 'https://g.page/IHR-BETRIEB/review';

        return `Hallo ${customerName},\n\n` +
            `vielen Dank, dass Sie uns mit "${orderDescription}" beauftragt haben! ` +
            `Wir hoffen, Sie sind mit unserer Arbeit zufrieden.\n\n` +
            `Wenn ja, wuerden wir uns riesig ueber eine Google-Bewertung freuen. ` +
            `Das hilft uns sehr und dauert nur 1 Minute:\n\n` +
            `${reviewUrl}\n\n` +
            `Herzlichen Dank!\n` +
            `Ihr Team von ${businessName}`;
    }

    // ============================================
    // Send Review Request
    // ============================================

    sendReviewRequest(requestId) {
        const request = this.reviewRequests.find(r => r.id === requestId);
        if (!request) { return { success: false, error: 'Anfrage nicht gefunden' }; }
        if (request.status !== 'geplant') { return { success: false, error: 'Anfrage wurde bereits bearbeitet' }; }

        const message = this.generateReviewMessage(request.customerName, request.orderDescription);

        // Log via communication service
        if (window.communicationService) {
            window.communicationService.logMessage({
                type: request.channel,
                direction: 'outbound',
                from: this._getBusinessName(),
                to: request.channel === 'email' ? request.customerEmail : request.customerPhone,
                subject: 'Bewertung - ' + request.orderDescription,
                content: message,
                customerId: request.customerId,
                customerName: request.customerName,
                status: 'sent'
            });
        }

        // Log via SMS service if SMS channel
        if (request.channel === 'sms' && window.smsReminderService) {
            window.smsReminderService.sendSms(
                request.customerPhone,
                message
            );
        }

        request.status = 'gesendet';
        request.sentAt = new Date().toISOString();
        this._saveReviewRequests();

        console.log(`Bewertungsanfrage gesendet an ${request.customerName} via ${request.channel}`);

        return { success: true, message: message };
    }

    // ============================================
    // Campaigns - CRUD
    // ============================================

    createCampaign(data) {
        const campaign = {
            id: 'MKT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
            name: data.name || 'Neue Kampagne',
            type: data.type || 'info',
            targetGroup: data.targetGroup || 'alle',
            subject: data.subject || '',
            message: data.message || '',
            channel: data.channel || 'email',
            scheduledDate: data.scheduledDate || new Date().toISOString().split('T')[0],
            recurring: data.recurring || false,
            recurringInterval: data.recurringInterval || 'jaehrlich',
            status: data.status || 'entwurf',
            sentCount: 0,
            openedCount: 0,
            createdAt: new Date().toISOString()
        };

        this.campaigns.push(campaign);
        this._saveCampaigns();
        return campaign;
    }

    getCampaigns() {
        return [...this.campaigns].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    getCampaign(id) {
        return this.campaigns.find(c => c.id === id);
    }

    updateCampaign(id, data) {
        const index = this.campaigns.findIndex(c => c.id === id);
        if (index === -1) { return null; }

        // Don't overwrite id and createdAt
        const { id: _id, createdAt: _ca, ...updateData } = data;
        this.campaigns[index] = {
            ...this.campaigns[index],
            ...updateData
        };
        this._saveCampaigns();
        return this.campaigns[index];
    }

    deleteCampaign(id) {
        const index = this.campaigns.findIndex(c => c.id === id);
        if (index === -1) { return false; }
        this.campaigns.splice(index, 1);
        this._saveCampaigns();
        return true;
    }

    // ============================================
    // Send Campaign
    // ============================================

    sendCampaign(campaignId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (!campaign) { return { success: false, error: 'Kampagne nicht gefunden' }; }
        if (campaign.status === 'gesendet' || campaign.status === 'abgeschlossen') {
            return { success: false, error: 'Kampagne wurde bereits gesendet' };
        }

        // Get target customers
        const recipients = this._getTargetRecipients(campaign.targetGroup);
        let sentCount = 0;

        recipients.forEach(customer => {
            const personalizedMessage = this.fillTemplate(campaign.message, {
                name: customer.name,
                firma: customer.firma || this._getBusinessName(),
                datum: new Date().toLocaleDateString('de-DE')
            });

            // Log each message
            if (window.communicationService) {
                window.communicationService.logMessage({
                    type: campaign.channel,
                    direction: 'outbound',
                    from: this._getBusinessName(),
                    to: campaign.channel === 'email' ? customer.email : (customer.telefon || customer.mobil),
                    subject: campaign.subject,
                    content: personalizedMessage,
                    customerId: customer.id,
                    customerName: customer.name,
                    status: 'sent'
                });
            }

            sentCount++;
        });

        campaign.status = 'gesendet';
        campaign.sentCount = sentCount;
        campaign.sentAt = new Date().toISOString();
        this._saveCampaigns();

        console.log(`Kampagne "${campaign.name}" gesendet an ${sentCount} Empfaenger`);

        return { success: true, sentCount: sentCount };
    }

    // ============================================
    // Seasonal Templates
    // ============================================

    getSeasonalTemplates() {
        return this.seasonalTemplates;
    }

    _buildSeasonalTemplates() {
        const businessName = '{{firma}}';

        return [
            {
                id: 'tpl-heizungswartung',
                name: 'Heizungswartung',
                season: 'herbst',
                seasonIcon: '\uD83C\uDF42',
                bestMonths: 'September - Oktober',
                type: 'erinnerung',
                subject: 'Zeit fuer die Heizungswartung!',
                message: `Hallo {{name}},\n\ndie Heizperiode steht vor der Tuer! Damit Sie im Winter nicht frieren, empfehlen wir eine rechtzeitige Wartung Ihrer Heizungsanlage.\n\nEine regelmaessige Wartung spart Energie und schuetzt vor teuren Ausfaellen.\n\nVereinbaren Sie jetzt einen Termin bei ${businessName} -- wir kuemmern uns darum!\n\nMit freundlichen Gruessen\n${businessName}`
            },
            {
                id: 'tpl-klimaanlage',
                name: 'Klimaanlagen-Check',
                season: 'fruehling',
                seasonIcon: '\uD83C\uDF38',
                bestMonths: 'Maerz - April',
                type: 'erinnerung',
                subject: 'Ist Ihre Klimaanlage bereit fuer den Sommer?',
                message: `Hallo {{name}},\n\nist Ihre Klimaanlage bereit fuer den Sommer? Nach den Wintermonaten sollte sie gewartet und gereinigt werden.\n\nFilter reinigen, Kuelmittel pruefen, Funktion testen -- wir machen das fuer Sie!\n\nMelden Sie sich bei ${businessName} und bleiben Sie im Sommer cool.\n\nMit freundlichen Gruessen\n${businessName}`
            },
            {
                id: 'tpl-dachcheck',
                name: 'Dachcheck nach Winter',
                season: 'fruehling',
                seasonIcon: '\uD83C\uDF38',
                bestMonths: 'Maerz',
                type: 'erinnerung',
                subject: 'Dachcheck nach dem Winter',
                message: `Hallo {{name}},\n\nder Winter war hart -- lassen Sie Ihr Dach pruefen! Frost, Schnee und Sturm koennen Schaeden hinterlassen, die man von unten nicht sieht.\n\nEin rechtzeitiger Check verhindert teure Folgeschaeden.\n\nKontaktieren Sie ${businessName} fuer einen Dach-Inspektionstermin.\n\nMit freundlichen Gruessen\n${businessName}`
            },
            {
                id: 'tpl-gartenwasser',
                name: 'Aussenwasser & Bewasserung',
                season: 'fruehling',
                seasonIcon: '\u2600\uFE0F',
                bestMonths: 'April',
                type: 'erinnerung',
                subject: 'Aussenanlagen fruehlingsfest machen',
                message: `Hallo {{name}},\n\nder Fruehling ist da! Zeit, die Aussenwasserhaehne und Bewasserungsanlagen wieder in Betrieb zu nehmen.\n\nNach dem Winter sollten Leitungen auf Frostschaeden geprueft und Ventile gewartet werden.\n\nWir von ${businessName} helfen Ihnen gerne dabei.\n\nMit freundlichen Gruessen\n${businessName}`
            },
            {
                id: 'tpl-elektrocheck',
                name: 'Elektrocheck (VDE-Pruefung)',
                season: 'ganzjaehrig',
                seasonIcon: '\u26A1',
                bestMonths: 'Ganzjaehrig',
                type: 'erinnerung',
                subject: 'Wann wurde Ihre Elektroanlage zuletzt geprueft?',
                message: `Hallo {{name}},\n\nwann wurde Ihre Elektroanlage zuletzt geprueft? Eine regelmaessige VDE-Pruefung schuetzt vor Braenden und ist fuer Gewerbetreibende Pflicht.\n\nAuch im Privathaushalt sorgt ein E-Check fuer Sicherheit.\n\nVereinbaren Sie einen Prueftermin bei ${businessName}.\n\nMit freundlichen Gruessen\n${businessName}`
            },
            {
                id: 'tpl-weihnachtsgruss',
                name: 'Weihnachtsgruss',
                season: 'winter',
                seasonIcon: '\u2744\uFE0F',
                bestMonths: 'Dezember',
                type: 'info',
                subject: 'Frohe Weihnachten!',
                message: `Liebe/r {{name}},\n\nfrohe Weihnachten und ein gutes neues Jahr!\n\nWir danken Ihnen herzlich fuer Ihr Vertrauen im vergangenen Jahr. Es war uns eine Freude, fuer Sie taetig zu sein.\n\nWir freuen uns auf die weitere Zusammenarbeit im neuen Jahr!\n\nHerzliche Gruesse\nIhr Team von ${businessName}`
            },
            {
                id: 'tpl-winterdienst',
                name: 'Winterdienst',
                season: 'herbst',
                seasonIcon: '\u2744\uFE0F',
                bestMonths: 'Oktober - November',
                type: 'angebot',
                subject: 'Winterdienst -- Sind Sie vorbereitet?',
                message: `Hallo {{name}},\n\nder Winter kommt! Sind Sie auf Schnee und Glatteis vorbereitet?\n\nAls Eigentuemer sind Sie fuer den Winterdienst auf Ihrem Grundstueck verantwortlich. Wir uebernehmen das gerne fuer Sie:\n\n- Schneeraeumung\n- Streudienst\n- Zuverlaessig & puenktlich\n\nFragen Sie jetzt bei ${businessName} an!\n\nMit freundlichen Gruessen\n${businessName}`
            },
            {
                id: 'tpl-fruehjahrscheck',
                name: 'Fruehjahrscheck Haustechnik',
                season: 'fruehling',
                seasonIcon: '\uD83C\uDF38',
                bestMonths: 'Maerz - April',
                type: 'erinnerung',
                subject: 'Fruehjahrscheck fuer Ihre Haustechnik',
                message: `Hallo {{name}},\n\nzeit fuer den Fruehjahrscheck! Nach dem Winter lohnt es sich, alle technischen Anlagen in Ihrem Haus zu ueberpruefen:\n\n- Heizung auf Sommerbetrieb umstellen\n- Wasserfilter wechseln\n- Rauchmelder testen\n- Aussenbeleuchtung pruefen\n\n${businessName} macht Ihr Haus fruehlingsfest!\n\nMit freundlichen Gruessen\n${businessName}`
            }
        ];
    }

    // ============================================
    // Template Helpers
    // ============================================

    fillTemplate(template, customerData) {
        if (!template) { return ''; }
        let result = template;

        // Replace known placeholders
        if (customerData.name) {
            result = result.replace(/\{\{name\}\}/g, customerData.name);
        }
        if (customerData.firma) {
            result = result.replace(/\{\{firma\}\}/g, customerData.firma);
        }
        if (customerData.datum) {
            result = result.replace(/\{\{datum\}\}/g, customerData.datum);
        }

        // Replace any remaining custom placeholders
        Object.entries(customerData).forEach(([key, value]) => {
            result = result.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), value || '');
        });

        return result;
    }

    // ============================================
    // Maintenance Reminder Templates
    // ============================================

    getMaintenanceReminderTemplate() {
        const businessName = '{{firma}}';
        return {
            subject: 'Erinnerung: Wartung faellig',
            message: `Hallo {{name}},\n\nIhre letzte Wartung bei uns liegt nun einige Monate zurueck. ` +
                `Regelmaessige Wartung schuetzt vor teuren Reparaturen und sorgt fuer zuverlaessigen Betrieb.\n\n` +
                `Vereinbaren Sie jetzt einen neuen Wartungstermin bei ${businessName}.\n\n` +
                `Wir freuen uns auf Sie!\n\nMit freundlichen Gruessen\n${businessName}`
        };
    }

    getSeasonalReminderTemplate(season) {
        const seasonMap = {
            'fruehling': ['tpl-klimaanlage', 'tpl-dachcheck', 'tpl-gartenwasser', 'tpl-fruehjahrscheck'],
            'sommer': ['tpl-klimaanlage', 'tpl-elektrocheck'],
            'herbst': ['tpl-heizungswartung', 'tpl-winterdienst'],
            'winter': ['tpl-weihnachtsgruss', 'tpl-heizungswartung']
        };

        const templateIds = seasonMap[season] || seasonMap['fruehling'];
        const templates = this.seasonalTemplates.filter(t => templateIds.includes(t.id));
        return templates.length > 0 ? templates[0] : this.seasonalTemplates[0];
    }

    // ============================================
    // Statistics
    // ============================================

    getMarketingStats() {
        const requests = this.reviewRequests;
        const campaigns = this.campaigns;

        return {
            reviewRequests: {
                total: requests.length,
                geplant: requests.filter(r => r.status === 'geplant').length,
                gesendet: requests.filter(r => r.status === 'gesendet').length,
                beantwortet: requests.filter(r => r.status === 'beantwortet').length,
                abgelehnt: requests.filter(r => r.status === 'abgelehnt').length
            },
            campaigns: {
                total: campaigns.length,
                entwurf: campaigns.filter(c => c.status === 'entwurf').length,
                geplant: campaigns.filter(c => c.status === 'geplant').length,
                gesendet: campaigns.filter(c => c.status === 'gesendet').length,
                abgeschlossen: campaigns.filter(c => c.status === 'abgeschlossen').length,
                totalSent: campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0),
                totalOpened: campaigns.reduce((sum, c) => sum + (c.openedCount || 0), 0)
            },
            googleReviewConfigured: !!this.googleReviewUrl,
            nextScheduledReview: this._getNextScheduledReview(),
            nextScheduledCampaign: this._getNextScheduledCampaign()
        };
    }

    // ============================================
    // Settings
    // ============================================

    getSettings() {
        return { ...this.settings };
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('mhs_marketing_settings', JSON.stringify(this.settings));
    }

    // ============================================
    // Internal Helpers
    // ============================================

    _getBusinessName() {
        // Try various sources for the business name
        if (window.storeService) {
            const s = window.storeService.getStore();
            if (s?.settings?.companyName) { return s.settings.companyName; }
        }
        if (typeof store !== 'undefined' && store?.settings?.companyName) {
            return store.settings.companyName;
        }
        return 'Ihr Handwerksbetrieb';
    }

    _getTargetRecipients(targetGroup) {
        if (!window.customerService) { return []; }

        const allCustomers = window.customerService.getAllCustomers();

        switch (targetGroup) {
            case 'aktive_kunden':
                return allCustomers.filter(c => c.status === 'aktiv');
            case 'inaktive_kunden':
                return allCustomers.filter(c => c.status === 'inaktiv');
            case 'wartungskunden':
                return allCustomers.filter(c =>
                    c.tags?.includes('wartung') || c.tags?.includes('Wartung') || c.tags?.includes('wartungskunde')
                );
            case 'alle':
            default:
                return allCustomers;
        }
    }

    _getNextScheduledReview() {
        const planned = this.reviewRequests
            .filter(r => r.status === 'geplant')
            .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
        return planned.length > 0 ? planned[0] : null;
    }

    _getNextScheduledCampaign() {
        const planned = this.campaigns
            .filter(c => c.status === 'geplant')
            .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
        return planned.length > 0 ? planned[0] : null;
    }

    _startScheduleCheck() {
        // Check every 5 minutes for due review requests
        setInterval(() => {
            this._processDueReviewRequests();
        }, 5 * 60 * 1000);

        // Initial check after 10 seconds
        setTimeout(() => this._processDueReviewRequests(), 10000);
    }

    _processDueReviewRequests() {
        const today = new Date().toISOString().split('T')[0];
        const due = this.reviewRequests.filter(r =>
            r.status === 'geplant' && r.scheduledDate <= today
        );

        due.forEach(request => {
            if (this.settings.autoScheduleEnabled) {
                this.sendReviewRequest(request.id);
            }
        });
    }

    // Persistence
    _saveReviewRequests() {
        localStorage.setItem('mhs_review_requests', JSON.stringify(this.reviewRequests));
    }

    _saveCampaigns() {
        localStorage.setItem('mhs_campaigns', JSON.stringify(this.campaigns));
    }
}

window.marketingService = new MarketingService();
