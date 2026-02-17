/* ============================================
   Invoice Template Service
   Template management for invoice generation
   ============================================ */

class InvoiceTemplateService {
    constructor() {
        this.templates = this.getDefaultTemplates();
        this.loadCustomTemplates();
    }

    /**
     * Get default invoice templates
     * @returns {Object} Template definitions
     */
    getDefaultTemplates() {
        return {
            'standard-de': {
                id: 'standard-de',
                name: 'Standard Deutsch',
                description: 'Standard-Template mit allen §14 UStG Pflichtangaben',
                locale: 'de-DE',
                currency: 'EUR',
                sections: {
                    header: true,
                    customerAddress: true,
                    positions: true,
                    totals: true,
                    footer: true,
                    paymentTerms: true,
                    legalInfo: true
                },
                variables: {
                    // Company variables (filled from settings)
                    companyName: '{{firma.name}}',
                    companyStreet: '{{firma.strasse}}',
                    companyCity: '{{firma.ort}}',
                    companyPostalCode: '{{firma.plz}}',
                    companyPhone: '{{firma.telefon}}',
                    companyEmail: '{{firma.email}}',
                    companyVatId: '{{firma.ustId}}',
                    companyIban: '{{firma.iban}}',
                    companyBic: '{{firma.bic}}',
                    companyBankName: '{{firma.bank}}',

                    // Invoice variables
                    invoiceNumber: '{{rechnung.nummer}}',
                    invoiceDate: '{{rechnung.datum}}',
                    dueDate: '{{rechnung.faelligkeitsdatum}}',

                    // Customer variables
                    customerName: '{{kunde.name}}',
                    customerCompany: '{{kunde.firma}}',
                    customerStreet: '{{kunde.strasse}}',
                    customerCity: '{{kunde.ort}}',
                    customerPostalCode: '{{kunde.plz}}',

                    // Totals
                    subtotal: '{{summe.netto}}',
                    vatAmount: '{{summe.mwst}}',
                    total: '{{summe.brutto}}',
                    vatRate: '{{summe.mwstSatz}}'
                },
                layout: {
                    pageSize: 'A4',
                    margins: {
                        top: 60,
                        right: 50,
                        bottom: 60,
                        left: 50
                    },
                    fontSize: {
                        normal: 10,
                        small: 8,
                        large: 14,
                        title: 20
                    },
                    colors: {
                        primary: '#2c3e50',
                        secondary: '#7f8c8d',
                        accent: '#3498db'
                    }
                }
            }
        };
    }

    /**
     * Load custom templates from localStorage
     */
    loadCustomTemplates() {
        const custom = localStorage.getItem('freyai_invoice_templates');
        if (custom) {
            try {
                const parsed = JSON.parse(custom);
                this.templates = { ...this.templates, ...parsed };
            } catch (e) {
                console.error('Error loading custom templates:', e);
            }
        }
    }

    /**
     * Save custom templates to localStorage
     */
    saveCustomTemplates() {
        const custom = {};
        Object.keys(this.templates).forEach(key => {
            if (key !== 'standard-de') {
                custom[key] = this.templates[key];
            }
        });
        localStorage.setItem('freyai_invoice_templates', JSON.stringify(custom));
    }

    /**
     * Get template by ID
     * @param {string} templateId - Template ID
     * @returns {Object} Template definition
     */
    getTemplate(templateId = 'standard-de') {
        return this.templates[templateId] || this.templates['standard-de'];
    }

    /**
     * Get all available templates
     * @returns {Array} List of templates
     */
    getAllTemplates() {
        return Object.values(this.templates);
    }

    /**
     * Render template with data
     * @param {string} templateId - Template ID
     * @param {Object} data - Invoice data
     * @returns {Object} Rendered template data for PDF generation
     */
    render(templateId, data) {
        const template = this.getTemplate(templateId);
        const companyData = this.getCompanyData();

        // Prepare variables for replacement
        const variables = {
            firma: companyData,
            rechnung: {
                nummer: data.nummer || data.id,
                datum: this.formatDate(data.datum || new Date().toISOString()),
                faelligkeitsdatum: this.formatDate(data.faelligkeitsdatum || this.addDays(new Date(), 14))
            },
            kunde: data.kunde || {},
            summe: {
                netto: this.formatCurrency(data.netto || 0),
                mwst: this.formatCurrency(data.mwst || 0),
                brutto: this.formatCurrency(data.brutto || 0),
                mwstSatz: '19%'
            }
        };

        // Build document structure for pdfmake
        return {
            template: template,
            variables: variables,
            positions: data.positionen || [],
            companyData: companyData,
            invoiceData: data
        };
    }

    /**
     * Get company data from settings/einvoice service
     * @returns {Object} Company information
     */
    getCompanyData() {
        // Check if eInvoiceService has business data
        if (window.eInvoiceService && window.eInvoiceService.settings.businessData) {
            const bd = window.eInvoiceService.settings.businessData;
            return {
                name: bd.name,
                strasse: bd.street,
                ort: bd.city,
                plz: bd.postalCode,
                telefon: bd.phone,
                email: bd.email,
                ustId: bd.vatId,
                iban: bd.iban,
                bic: bd.bic,
                bank: bd.bankName
            };
        }

        // Fallback to defaults
        return {
            name: 'FreyAI Visions',
            strasse: 'Musterstraße 123',
            ort: 'Musterstadt',
            plz: '63843',
            telefon: '+49 6029 9922964',
            email: 'info@freyai-visions.de',
            ustId: 'DE123456789',
            iban: 'DE89 3704 0044 0532 0130 00',
            bic: 'COBADEFFXXX',
            bank: 'Commerzbank'
        };
    }

    /**
     * Replace template variables
     * @param {string} text - Text with variables
     * @param {Object} data - Data for replacement
     * @returns {string} Text with replaced variables
     */
    replaceVariables(text, data) {
        let result = text;

        const flatten = (obj, prefix = '') => {
            let vars = {};
            Object.keys(obj).forEach(key => {
                const value = obj[key];
                const fullKey = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    Object.assign(vars, flatten(value, fullKey));
                } else {
                    vars[fullKey] = value;
                }
            });
            return vars;
        };

        const flatData = flatten(data);

        Object.keys(flatData).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, flatData[key] || '');
        });

        return result;
    }

    /**
     * Format date for invoice
     * @param {string|Date} date - Date to format
     * @returns {string} Formatted date
     */
    formatDate(date) {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    /**
     * Format currency
     * @param {number} amount - Amount to format
     * @returns {string} Formatted currency
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    /**
     * Add days to date
     * @param {Date} date - Starting date
     * @param {number} days - Days to add
     * @returns {string} ISO date string
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString();
    }

    /**
     * Create custom template
     * @param {Object} templateData - Template definition
     * @returns {string} Template ID
     */
    createTemplate(templateData) {
        const id = 'custom-' + Date.now();
        this.templates[id] = {
            id: id,
            ...templateData
        };
        this.saveCustomTemplates();
        return id;
    }

    /**
     * Update template
     * @param {string} templateId - Template ID
     * @param {Object} updates - Updates to apply
     */
    updateTemplate(templateId, updates) {
        if (templateId === 'standard-de') {
            throw new Error('Cannot modify standard template');
        }

        if (this.templates[templateId]) {
            Object.assign(this.templates[templateId], updates);
            this.saveCustomTemplates();
        }
    }

    /**
     * Delete template
     * @param {string} templateId - Template ID
     */
    deleteTemplate(templateId) {
        if (templateId === 'standard-de') {
            throw new Error('Cannot delete standard template');
        }

        delete this.templates[templateId];
        this.saveCustomTemplates();
    }
}

window.invoiceTemplateService = new InvoiceTemplateService();
