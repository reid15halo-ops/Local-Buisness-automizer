/* ============================================
   PDF Generation Service
   Generate invoice PDFs using pdfmake
   ============================================ */

class PDFGenerationService {
    constructor() {
        this.pdfmakeLoaded = false;
        this.loadingPromise = null;
        this.templateService = null;
    }

    /**
     * Initialize service
     */
    async init() {
        if (!this.pdfmakeLoaded) {
            await this.loadPdfMake();
        }
        if (!this.templateService) {
            this.templateService = window.invoiceTemplateService;
        }
    }

    /**
     * Lazy-load pdfmake from CDN
     * @returns {Promise<void>}
     */
    async loadPdfMake() {
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        if (window.pdfMake) {
            this.pdfmakeLoaded = true;
            return Promise.resolve();
        }

        this.loadingPromise = new Promise((resolve, reject) => {
            const script1 = document.createElement('script');
            script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js';
            script1.integrity = 'sha384-VFQrHzqBh5qiJIU0uGU5CIW3+OWpdGGJM9LBnGbuIH2mkICcFZ7lPd/AAtI7SNf7';
            script1.crossOrigin = 'anonymous';
            script1.async = true;

            script1.onload = () => {
                const script2 = document.createElement('script');
                script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.min.js';
                script2.integrity = 'sha384-dWs4+zGqy/KS6giKxiK+6iowhidQwjVFaiE1lMar36QwIulE44VyBSQp0brMCx4D';
                script2.crossOrigin = 'anonymous';
                script2.async = true;

                script2.onload = () => {
                    this.pdfmakeLoaded = true;
                    console.log('✅ pdfmake loaded');
                    resolve();
                };

                script2.onerror = () => {
                    console.error('❌ Failed to load pdfmake fonts');
                    reject(new Error('Failed to load pdfmake fonts'));
                };

                document.head.appendChild(script2);
            };

            script1.onerror = () => {
                console.error('❌ Failed to load pdfmake');
                reject(new Error('Failed to load pdfmake'));
            };

            document.head.appendChild(script1);
        });

        return this.loadingPromise;
    }

    /**
     * Generate invoice PDF
     * @param {Object} invoice - Invoice data
     * @param {string} templateId - Template ID to use
     * @returns {Promise<Object>} pdfmake document object
     */
    async generateInvoicePDF(invoice, templateId = 'standard-de') {
        await this.init();

        const rendered = this.templateService.render(templateId, invoice);
        const docDefinition = this.buildPdfDefinition(rendered);

        return pdfMake.createPdf(docDefinition);
    }

    /**
     * Download invoice PDF
     * @param {Object} invoice - Invoice data
     * @param {string} templateId - Template ID
     * @param {string} filename - Custom filename (optional)
     */
    async downloadPDF(invoice, templateId = 'standard-de', filename = null) {
        const pdf = await this.generateInvoicePDF(invoice, templateId);
        const invoiceNumber = invoice.nummer || invoice.id;
        const finalFilename = filename || `Rechnung_${invoiceNumber}.pdf`;

        pdf.download(finalFilename);

        return {
            success: true,
            filename: finalFilename
        };
    }

    /**
     * Open PDF in new tab
     * @param {Object} invoice - Invoice data
     * @param {string} templateId - Template ID
     */
    async openPDF(invoice, templateId = 'standard-de') {
        const pdf = await this.generateInvoicePDF(invoice, templateId);
        pdf.open();

        return {
            success: true
        };
    }

    /**
     * Get PDF as base64 (for email attachments)
     * @param {Object} invoice - Invoice data
     * @param {string} templateId - Template ID
     * @returns {Promise<string>} Base64 encoded PDF
     */
    async getPDFBase64(invoice, templateId = 'standard-de') {
        const pdf = await this.generateInvoicePDF(invoice, templateId);

        return new Promise((resolve, reject) => {
            pdf.getBase64((data) => {
                resolve(data);
            });
        });
    }

    /**
     * Get PDF as Blob
     * @param {Object} invoice - Invoice data
     * @param {string} templateId - Template ID
     * @returns {Promise<Blob>} PDF blob
     */
    async getPDFBlob(invoice, templateId = 'standard-de') {
        const pdf = await this.generateInvoicePDF(invoice, templateId);

        return new Promise((resolve, reject) => {
            pdf.getBlob((blob) => {
                resolve(blob);
            });
        });
    }

    /**
     * Build pdfmake document definition
     * @param {Object} rendered - Rendered template data
     * @returns {Object} pdfmake document definition
     */
    buildPdfDefinition(rendered) {
        const { template, variables, positions, companyData, invoiceData } = rendered;
        const layout = template.layout;

        return {
            pageSize: layout.pageSize,
            pageMargins: [
                layout.margins.left,
                layout.margins.top,
                layout.margins.right,
                layout.margins.bottom
            ],

            content: [
                // Header with company info
                this.buildHeader(companyData, layout),

                // Spacing
                { text: '', margin: [0, 20] },

                // Customer address
                this.buildCustomerAddress(variables.kunde, layout),

                // Spacing
                { text: '', margin: [0, 30] },

                // Invoice title and details
                this.buildInvoiceDetails(variables.rechnung, layout),

                // Spacing
                { text: '', margin: [0, 20] },

                // Positions table
                this.buildPositionsTable(positions, layout),

                // Totals
                this.buildTotals(variables.summe, layout),

                // Spacing
                { text: '', margin: [0, 30] },

                // Payment terms
                this.buildPaymentTerms(companyData, variables.rechnung, layout),

                // Spacing
                { text: '', margin: [0, 20] },

                // Footer / Legal info
                this.buildLegalInfo(companyData, layout)
            ],

            styles: {
                header: {
                    fontSize: layout.fontSize.large,
                    bold: true,
                    color: layout.colors.primary
                },
                title: {
                    fontSize: layout.fontSize.title,
                    bold: true,
                    color: layout.colors.primary
                },
                normal: {
                    fontSize: layout.fontSize.normal,
                    color: layout.colors.primary
                },
                small: {
                    fontSize: layout.fontSize.small,
                    color: layout.colors.secondary
                },
                tableHeader: {
                    bold: true,
                    fontSize: layout.fontSize.normal,
                    color: 'white',
                    fillColor: layout.colors.primary
                }
            },

            defaultStyle: {
                font: 'Roboto'
            }
        };
    }

    /**
     * Build header section
     */
    buildHeader(company, layout) {
        return {
            columns: [
                {
                    width: '*',
                    stack: [
                        { text: company.name, style: 'header' },
                        { text: company.strasse, style: 'small' },
                        { text: `${company.plz} ${company.ort}`, style: 'small' }
                    ]
                },
                {
                    width: 'auto',
                    stack: [
                        { text: company.telefon, style: 'small', alignment: 'right' },
                        { text: company.email, style: 'small', alignment: 'right' }
                    ]
                }
            ]
        };
    }

    /**
     * Build customer address
     */
    buildCustomerAddress(kunde, layout) {
        return {
            stack: [
                { text: kunde.firma || kunde.name, bold: true },
                { text: kunde.strasse || '' },
                { text: `${kunde.plz || ''} ${kunde.ort || ''}` }
            ],
            margin: [0, 0, 0, 0]
        };
    }

    /**
     * Build invoice details section
     */
    buildInvoiceDetails(rechnung, layout) {
        return {
            columns: [
                {
                    width: '*',
                    text: 'RECHNUNG',
                    style: 'title'
                },
                {
                    width: 'auto',
                    stack: [
                        {
                            columns: [
                                { width: 100, text: 'Rechnungs-Nr.:', bold: true },
                                { width: '*', text: rechnung.nummer }
                            ]
                        },
                        {
                            columns: [
                                { width: 100, text: 'Datum:', bold: true },
                                { width: '*', text: rechnung.datum }
                            ],
                            margin: [0, 5, 0, 0]
                        },
                        {
                            columns: [
                                { width: 100, text: 'Fällig am:', bold: true },
                                { width: '*', text: rechnung.faelligkeitsdatum }
                            ],
                            margin: [0, 5, 0, 0]
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Build positions table
     */
    buildPositionsTable(positions, layout) {
        const tableBody = [
            [
                { text: 'Pos.', style: 'tableHeader' },
                { text: 'Beschreibung', style: 'tableHeader' },
                { text: 'Menge', style: 'tableHeader', alignment: 'right' },
                { text: 'Einzelpreis', style: 'tableHeader', alignment: 'right' },
                { text: 'Gesamt', style: 'tableHeader', alignment: 'right' }
            ]
        ];

        positions.forEach((pos, index) => {
            const menge = pos.menge || 1;
            const einzelpreis = pos.einzelpreis || 0;
            const gesamt = menge * einzelpreis;

            tableBody.push([
                { text: (index + 1).toString(), alignment: 'center' },
                { text: pos.beschreibung || pos.name || '' },
                { text: menge.toString(), alignment: 'right' },
                { text: this.formatCurrency(einzelpreis), alignment: 'right' },
                { text: this.formatCurrency(gesamt), alignment: 'right' }
            ]);
        });

        return {
            table: {
                headerRows: 1,
                widths: [30, '*', 50, 80, 80],
                body: tableBody
            },
            layout: {
                fillColor: function (rowIndex, node, columnIndex) {
                    return (rowIndex === 0) ? layout.colors.primary : (rowIndex % 2 === 0 ? '#f9f9f9' : null);
                }
            }
        };
    }

    /**
     * Build totals section
     */
    buildTotals(summe, layout) {
        return {
            columns: [
                { width: '*', text: '' },
                {
                    width: 200,
                    stack: [
                        {
                            columns: [
                                { width: '*', text: 'Netto:', alignment: 'right' },
                                { width: 80, text: summe.netto, alignment: 'right' }
                            ]
                        },
                        {
                            columns: [
                                { width: '*', text: `MwSt. (${summe.mwstSatz}):`, alignment: 'right' },
                                { width: 80, text: summe.mwst, alignment: 'right' }
                            ],
                            margin: [0, 5, 0, 0]
                        },
                        {
                            columns: [
                                { width: '*', text: 'Brutto:', alignment: 'right', bold: true, fontSize: 12 },
                                { width: 80, text: summe.brutto, alignment: 'right', bold: true, fontSize: 12 }
                            ],
                            margin: [0, 10, 0, 0]
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Build payment terms section
     */
    buildPaymentTerms(company, rechnung, layout) {
        return {
            stack: [
                { text: 'Zahlungsbedingungen', bold: true, margin: [0, 0, 0, 5] },
                { text: `Bitte überweisen Sie den Betrag bis zum ${rechnung.faelligkeitsdatum} auf folgendes Konto:`, style: 'small' },
                { text: '', margin: [0, 5] },
                {
                    columns: [
                        { width: 80, text: 'IBAN:', style: 'small', bold: true },
                        { width: '*', text: company.iban, style: 'small' }
                    ]
                },
                {
                    columns: [
                        { width: 80, text: 'BIC:', style: 'small', bold: true },
                        { width: '*', text: company.bic, style: 'small' }
                    ]
                },
                {
                    columns: [
                        { width: 80, text: 'Bank:', style: 'small', bold: true },
                        { width: '*', text: company.bank, style: 'small' }
                    ]
                },
                { text: `Verwendungszweck: ${rechnung.nummer}`, style: 'small', margin: [0, 5, 0, 0] }
            ]
        };
    }

    /**
     * Build legal info / footer
     */
    buildLegalInfo(company, layout) {
        return {
            stack: [
                { text: 'Angaben gemäß §14 UStG', bold: true, style: 'small', margin: [0, 0, 0, 5] },
                { text: `${company.name} | ${company.strasse} | ${company.plz} ${company.ort}`, style: 'small' },
                { text: `USt-IdNr.: ${company.ustId}`, style: 'small' },
                { text: `Tel.: ${company.telefon} | E-Mail: ${company.email}`, style: 'small' }
            ],
            margin: [0, 20, 0, 0]
        };
    }

    /**
     * Format currency
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }
}

window.pdfGenerationService = new PDFGenerationService();
