/* ============================================
   Email Template Service
   Professional HTML email templates for invoices, quotes, and notifications
   Responsive design compatible with Outlook, Gmail, Apple Mail
   ============================================ */

class EmailTemplateService {
    constructor() {
        this.company = this.getCompanyInfo();
    }

    /**
     * Get company information from eInvoiceService or localStorage
     */
    getCompanyInfo() {
        // Try to get from eInvoiceService
        if (window.eInvoiceService && window.eInvoiceService.settings.businessData) {
            const bd = window.eInvoiceService.settings.businessData;
            return {
                name: bd.name || 'FreyAI Visions',
                street: bd.street || 'Musterstraße 123',
                city: bd.city || 'Musterstadt',
                postalCode: bd.postalCode || '63843',
                phone: bd.phone || '+49 6029 9922964',
                email: bd.email || 'info@freyai-visions.de',
                vatId: bd.vatId || 'DE123456789',
                iban: bd.iban || 'DE89 3704 0044 0532 0130 00',
                bic: bd.bic || 'COBADEFFXXX',
                bankName: bd.bankName || 'Commerzbank'
            };
        }

        // Fallback to localStorage
        const stored = JSON.parse(localStorage.getItem('freyai_company_info') || '{}');
        return {
            name: stored.name || 'FreyAI Visions',
            street: stored.street || 'Musterstraße 123',
            city: stored.city || 'Musterstadt',
            postalCode: stored.postalCode || '63843',
            phone: stored.phone || '+49 6029 9922964',
            email: stored.email || 'info@freyai-visions.de',
            vatId: stored.vatId || 'DE123456789',
            iban: stored.iban || 'DE89 3704 0044 0532 0130 00',
            bic: stored.bic || 'COBADEFFXXX',
            bankName: stored.bankName || 'Commerzbank'
        };
    }

    /**
     * Base CSS for responsive email templates
     * Uses inline styles for email client compatibility
     */
    getBaseCss() {
        return `
            <style type="text/css">
                @media only screen and (max-width: 600px) {
                    body { width: 100% !important; }
                    .container { width: 100% !important; }
                    .email-body { padding: 10px !important; }
                    table { width: 100% !important; }
                    .positions-table { font-size: 12px !important; }
                    .positions-table td { padding: 6px 4px !important; }
                    .footer-col { display: block !important; width: 100% !important; margin-bottom: 15px !important; }
                }
            </style>
        `;
    }

    /**
     * Header template with company branding
     */
    getHeader() {
        return `
            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #0f172a; color: white; padding: 30px 0; border-bottom: 3px solid #6366f1;">
                <tr>
                    <td style="padding: 20px 40px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px; color: #6366f1;">⚙️</div>
                        <h1 style="margin: 10px 0 5px 0; font-size: 24px; font-family: Arial, sans-serif; font-weight: bold;">${this.company.name}</h1>
                        <p style="margin: 0; font-size: 12px; color: #cbd5e1;">${this.company.street} | ${this.company.postalCode} ${this.company.city}</p>
                    </td>
                </tr>
            </table>
        `;
    }

    /**
     * Footer template with company details
     */
    getFooter() {
        return `
            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #1e293b; color: #cbd5e1; padding: 30px 40px; font-size: 11px;">
                <tr>
                    <td>
                        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                            <tr>
                                <td class="footer-col" style="width: 33%; padding-right: 20px;">
                                    <strong style="color: #f1f5f9;">Kontakt</strong><br>
                                    Telefon: ${this.company.phone}<br>
                                    Email: ${this.company.email}
                                </td>
                                <td class="footer-col" style="width: 33%; padding: 0 20px; border-left: 1px solid #475569; border-right: 1px solid #475569;">
                                    <strong style="color: #f1f5f9;">Bankverbindung</strong><br>
                                    IBAN: ${this.company.iban}<br>
                                    BIC: ${this.company.bic}
                                </td>
                                <td class="footer-col" style="width: 33%; padding-left: 20px;">
                                    <strong style="color: #f1f5f9;">Steuernummer</strong><br>
                                    USt-IdNr: ${this.company.vatId}
                                </td>
                            </tr>
                        </table>
                        <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #475569; font-size: 10px; color: #64748b;">
                            © ${new Date().getFullYear()} ${this.company.name}. Alle Rechte vorbehalten.
                        </p>
                    </td>
                </tr>
            </table>
        `;
    }

    /**
     * Quote Email Template - Angebot per Email
     * @param {Object} angebot - Quote object with positionen array
     * @param {Object} company - Optional company override
     * @returns {Object} { subject, html }
     */
    getAngebotEmail(angebot, company = null) {
        const comp = company || this.company;
        const kunde = angebot.kunde || {};
        const positionen = angebot.positionen || [];

        // Calculate totals
        let netto = 0;
        const posTable = positionen.map((pos, idx) => {
            const gesamtpreis = (pos.menge || 0) * (pos.einzelpreis || 0);
            netto += gesamtpreis;
            return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px 8px; text-align: center; font-family: Arial, sans-serif;">${idx + 1}</td>
                    <td style="padding: 12px 8px; font-family: Arial, sans-serif;">${pos.beschreibung || ''}</td>
                    <td style="padding: 12px 8px; text-align: center; font-family: Arial, sans-serif;">${(pos.menge || 0).toLocaleString('de-DE')}</td>
                    <td style="padding: 12px 8px; text-align: right; font-family: Arial, sans-serif;">€&nbsp;${(pos.einzelpreis || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="padding: 12px 8px; text-align: right; font-family: Arial, sans-serif; font-weight: bold;">€&nbsp;${gesamtpreis.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            `;
        }).join('');

        const mwstSatz = 19;
        const mwst = netto * (mwstSatz / 100);
        const brutto = netto + mwst;

        const html = `
            <!DOCTYPE html>
            <html lang="de">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Angebot</title>
                ${this.getBaseCss()}
            </head>
            <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f8fafc;">
                    <tr>
                        <td style="padding: 20px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <!-- Header -->
                                <tr>
                                    <td>
                                        ${this.getHeader()}
                                    </td>
                                </tr>

                                <!-- Main Content -->
                                <tr>
                                    <td class="email-body" style="padding: 40px; color: #1e293b;">
                                        <!-- Invoice Number & Date -->
                                        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 30px;">
                                            <tr>
                                                <td>
                                                    <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #0f172a;">Angebot Nr. ${angebot.id || angebot.nummer || ''}</h2>
                                                    <p style="margin: 5px 0; font-size: 13px; color: #64748b;">
                                                        Datum: ${this.formatDate(angebot.datum || new Date().toISOString())}
                                                    </p>
                                                </td>
                                                <td style="text-align: right;">
                                                    <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.6;">
                                                        <strong>${comp.name}</strong><br>
                                                        ${comp.street}<br>
                                                        ${comp.postalCode} ${comp.city}
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Customer Address -->
                                        <div style="margin-bottom: 30px;">
                                            <p style="margin: 0 0 5px 0; font-size: 12px; color: #64748b;">Für:</p>
                                            <p style="margin: 0; font-size: 14px; font-weight: bold;">${kunde.name || 'Sehr geehrte/r Kunde'}</p>
                                            ${kunde.firma ? `<p style="margin: 5px 0; font-size: 13px;">${kunde.firma}</p>` : ''}
                                            <p style="margin: 5px 0; font-size: 13px;">${kunde.strasse || ''}</p>
                                            <p style="margin: 5px 0; font-size: 13px;">${kunde.plz || ''} ${kunde.ort || ''}</p>
                                        </div>

                                        <!-- Greeting -->
                                        <p style="margin: 30px 0 20px 0; font-size: 14px; line-height: 1.6;">
                                            Sehr geehrte/r ${kunde.name ? kunde.name.split(' ')[0] : 'Kunde'},
                                        </p>

                                        <!-- Body Text -->
                                        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                                            vielen Dank für Ihre Anfrage. Anbei finden Sie unser Angebot für Ihre gewünschten Leistungen.
                                        </p>

                                        <!-- Positions Table -->
                                        <table role="presentation" cellpadding="0" cellspacing="0" class="positions-table" style="width: 100%; margin: 30px 0; border-collapse: collapse; border: 1px solid #e2e8f0;">
                                            <thead>
                                                <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                                                    <th style="padding: 12px 8px; text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 12px;">Pos</th>
                                                    <th style="padding: 12px 8px; font-family: Arial, sans-serif; font-weight: bold; font-size: 12px;">Beschreibung</th>
                                                    <th style="padding: 12px 8px; text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 12px;">Menge</th>
                                                    <th style="padding: 12px 8px; text-align: right; font-family: Arial, sans-serif; font-weight: bold; font-size: 12px;">Einzelpreis</th>
                                                    <th style="padding: 12px 8px; text-align: right; font-family: Arial, sans-serif; font-weight: bold; font-size: 12px;">Gesamtpreis</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${posTable}
                                            </tbody>
                                        </table>

                                        <!-- Totals -->
                                        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 30px 0; margin-left: auto; max-width: 300px;">
                                            <tr>
                                                <td style="padding: 10px 0; font-size: 13px; color: #475569;">Subtotal (netto):</td>
                                                <td style="padding: 10px 15px; text-align: right; font-size: 13px; color: #475569;">€&nbsp;${netto.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 10px 0; font-size: 13px; color: #475569;">MwSt (${mwstSatz}%):</td>
                                                <td style="padding: 10px 15px; text-align: right; font-size: 13px; color: #475569;">€&nbsp;${mwst.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                            <tr style="border-top: 2px solid #e2e8f0; border-bottom: 2px solid #e2e8f0;">
                                                <td style="padding: 15px 0; font-size: 14px; font-weight: bold; color: #0f172a;">Gesamtbetrag:</td>
                                                <td style="padding: 15px 15px; text-align: right; font-size: 16px; font-weight: bold; color: #6366f1;">€&nbsp;${brutto.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        </table>

                                        <!-- Validity Notice -->
                                        <div style="margin: 30px 0; padding: 15px; background-color: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 4px;">
                                            <p style="margin: 0; font-size: 13px; color: #0c4a6e;">
                                                <strong>Gültigkeitsdauer:</strong> Dieses Angebot ist 30 Tage gültig.
                                            </p>
                                        </div>

                                        <!-- Call to Action -->
                                        <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #475569;">
                                            Haben Sie Fragen zu unserem Angebot? Zögern Sie nicht, uns zu kontaktieren. Wir freuen uns auf Ihre Rückmeldung!
                                        </p>

                                        <p style="margin: 20px 0 0 0; font-size: 14px;">
                                            Mit freundlichen Grüßen<br>
                                            <strong>${comp.name}</strong>
                                        </p>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td>
                                        ${this.getFooter()}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        return {
            subject: `Angebot Nr. ${angebot.id || angebot.nummer || ''} - ${comp.name}`,
            html: html
        };
    }

    /**
     * Invoice Email Template - Rechnung per Email
     * @param {Object} rechnung - Invoice object with positionen array
     * @param {Object} company - Optional company override
     * @returns {Object} { subject, html }
     */
    getRechnungEmail(rechnung, company = null) {
        const comp = company || this.company;
        const kunde = rechnung.kunde || {};
        const positionen = rechnung.positionen || [];

        // Calculate totals
        let netto = 0;
        const posTable = positionen.map((pos, idx) => {
            const gesamtpreis = (pos.menge || 0) * (pos.einzelpreis || 0);
            netto += gesamtpreis;
            return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px 8px; text-align: center; font-family: Arial, sans-serif;">${idx + 1}</td>
                    <td style="padding: 12px 8px; font-family: Arial, sans-serif;">${pos.beschreibung || ''}</td>
                    <td style="padding: 12px 8px; text-align: center; font-family: Arial, sans-serif;">${(pos.menge || 0).toLocaleString('de-DE')}</td>
                    <td style="padding: 12px 8px; text-align: right; font-family: Arial, sans-serif;">€&nbsp;${(pos.einzelpreis || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="padding: 12px 8px; text-align: right; font-family: Arial, sans-serif; font-weight: bold;">€&nbsp;${gesamtpreis.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            `;
        }).join('');

        const mwstSatz = 19;
        const mwst = netto * (mwstSatz / 100);
        const brutto = netto + mwst;

        // Calculate due date
        const invoiceDate = new Date(rechnung.datum || new Date());
        const paymentTerms = rechnung.zahlungsziel || 14;
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + paymentTerms);

        const html = `
            <!DOCTYPE html>
            <html lang="de">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Rechnung</title>
                ${this.getBaseCss()}
            </head>
            <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f8fafc;">
                    <tr>
                        <td style="padding: 20px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <!-- Header -->
                                <tr>
                                    <td>
                                        ${this.getHeader()}
                                    </td>
                                </tr>

                                <!-- Main Content -->
                                <tr>
                                    <td class="email-body" style="padding: 40px; color: #1e293b;">
                                        <!-- Invoice Number & Date -->
                                        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 30px;">
                                            <tr>
                                                <td>
                                                    <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #0f172a;">Rechnung Nr. ${rechnung.id || rechnung.nummer || ''}</h2>
                                                    <p style="margin: 5px 0; font-size: 13px; color: #64748b;">
                                                        Rechnungsdatum: ${this.formatDate(rechnung.datum || new Date().toISOString())}
                                                    </p>
                                                </td>
                                                <td style="text-align: right;">
                                                    <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.6;">
                                                        <strong>${comp.name}</strong><br>
                                                        ${comp.street}<br>
                                                        ${comp.postalCode} ${comp.city}
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Customer Address -->
                                        <div style="margin-bottom: 30px;">
                                            <p style="margin: 0 0 5px 0; font-size: 12px; color: #64748b;">Rechnungsempfänger:</p>
                                            <p style="margin: 0; font-size: 14px; font-weight: bold;">${kunde.name || 'Sehr geehrte/r Kunde'}</p>
                                            ${kunde.firma ? `<p style="margin: 5px 0; font-size: 13px;">${kunde.firma}</p>` : ''}
                                            <p style="margin: 5px 0; font-size: 13px;">${kunde.strasse || ''}</p>
                                            <p style="margin: 5px 0; font-size: 13px;">${kunde.plz || ''} ${kunde.ort || ''}</p>
                                        </div>

                                        <!-- Greeting -->
                                        <p style="margin: 30px 0 20px 0; font-size: 14px; line-height: 1.6;">
                                            Sehr geehrte/r ${kunde.name ? kunde.name.split(' ')[0] : 'Kunde'},
                                        </p>

                                        <!-- Body Text -->
                                        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                                            anbei senden wir Ihnen die Rechnung für unsere erbrachten Leistungen.
                                        </p>

                                        <!-- Positions Table -->
                                        <table role="presentation" cellpadding="0" cellspacing="0" class="positions-table" style="width: 100%; margin: 30px 0; border-collapse: collapse; border: 1px solid #e2e8f0;">
                                            <thead>
                                                <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                                                    <th style="padding: 12px 8px; text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 12px;">Pos</th>
                                                    <th style="padding: 12px 8px; font-family: Arial, sans-serif; font-weight: bold; font-size: 12px;">Beschreibung</th>
                                                    <th style="padding: 12px 8px; text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 12px;">Menge</th>
                                                    <th style="padding: 12px 8px; text-align: right; font-family: Arial, sans-serif; font-weight: bold; font-size: 12px;">Einzelpreis</th>
                                                    <th style="padding: 12px 8px; text-align: right; font-family: Arial, sans-serif; font-weight: bold; font-size: 12px;">Gesamtpreis</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${posTable}
                                            </tbody>
                                        </table>

                                        <!-- Totals -->
                                        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 30px 0; margin-left: auto; max-width: 300px;">
                                            <tr>
                                                <td style="padding: 10px 0; font-size: 13px; color: #475569;">Subtotal (netto):</td>
                                                <td style="padding: 10px 15px; text-align: right; font-size: 13px; color: #475569;">€&nbsp;${netto.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 10px 0; font-size: 13px; color: #475569;">MwSt (${mwstSatz}%):</td>
                                                <td style="padding: 10px 15px; text-align: right; font-size: 13px; color: #475569;">€&nbsp;${mwst.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                            <tr style="border-top: 2px solid #e2e8f0; border-bottom: 2px solid #e2e8f0;">
                                                <td style="padding: 15px 0; font-size: 14px; font-weight: bold; color: #0f172a;">Rechnungsbetrag:</td>
                                                <td style="padding: 15px 15px; text-align: right; font-size: 16px; font-weight: bold; color: #6366f1;">€&nbsp;${brutto.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        </table>

                                        <!-- Payment Terms -->
                                        <div style="margin: 30px 0; padding: 15px; background-color: #fef3c7; border-left: 4px solid #d97706; border-radius: 4px;">
                                            <p style="margin: 0 0 10px 0; font-size: 13px; color: #92400e; font-weight: bold;">Zahlungsanweisung</p>
                                            <p style="margin: 5px 0; font-size: 13px; color: #92400e;">
                                                Zahlbar bis: <strong>${this.formatDate(dueDate)}</strong>
                                            </p>
                                            <p style="margin: 5px 0; font-size: 13px; color: #92400e;">
                                                IBAN: <strong>${comp.iban}</strong><br>
                                                BIC: <strong>${comp.bic}</strong><br>
                                                Bank: ${comp.bankName}
                                            </p>
                                        </div>

                                        <!-- SEPA Payment QR Code placeholder -->
                                        <div style="margin: 20px 0; padding: 15px; background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 4px; text-align: center;">
                                            <p style="margin: 0 0 10px 0; font-size: 12px; color: #15803d;">SEPA QR-Code</p>
                                            <div style="width: 150px; height: 150px; margin: 0 auto; background-color: white; border: 1px solid #dcfce7; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #15803d;">
                                                [QR-Code Placeholder]
                                            </div>
                                        </div>

                                        <!-- Close -->
                                        <p style="margin: 30px 0 0 0; font-size: 14px;">
                                            Mit freundlichen Grüßen<br>
                                            <strong>${comp.name}</strong>
                                        </p>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td>
                                        ${this.getFooter()}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        return {
            subject: `Rechnung Nr. ${rechnung.id || rechnung.nummer || ''} - ${comp.name}`,
            html: html
        };
    }

    /**
     * Dunning Email Templates - Mahnungen with escalating tone
     * @param {Object} mahnung - Dunning object with reference to original invoice
     * @param {number} stufe - Dunning level (1, 2, or 3)
     * @param {Object} company - Optional company override
     * @returns {Object} { subject, html }
     */
    getMahnungEmail(mahnung, stufe = 1, company = null) {
        const comp = company || this.company;
        const kunde = mahnung.kunde || {};
        const originalRechnung = mahnung.originalRechnung || {};

        // Determine tone and content based on level
        const levels = {
            1: {
                title: 'Zahlungserinnerung',
                greeting: 'Sehr geehrte/r',
                tone: 'friendly',
                body: `bei Durchsicht unserer Unterlagen ist uns aufgefallen, dass die Rechnung <strong>Nr. ${originalRechnung.nummer}</strong>
                vom <strong>${this.formatDate(originalRechnung.datum)}</strong> in Höhe von <strong>€&nbsp;${(mahnung.betrag || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                noch nicht beglichen wurde.
                <br><br>
                Wir bitten Sie freundlich, den ausstehenden Betrag baldmöglichst zu überweisen.`,
                backgroundColor: '#e0f2fe',
                borderColor: '#0284c7',
                textColor: '#0c4a6e'
            },
            2: {
                title: 'Zweite Mahnung',
                greeting: 'Sehr geehrte/r',
                tone: 'firm',
                body: `trotz unserer vorangegangenen Zahlungserinnerung ist die Rechnung <strong>Nr. ${originalRechnung.nummer}</strong>
                vom <strong>${this.formatDate(originalRechnung.datum)}</strong> über <strong>€&nbsp;${(mahnung.betrag || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                bis heute nicht bezahlt worden.
                <br><br>
                Wir erwarten die Zahlung des ausstehenden Betrages <strong>unverzüglich</strong>.`,
                backgroundColor: '#fef3c7',
                borderColor: '#d97706',
                textColor: '#92400e'
            },
            3: {
                title: 'Letzte Mahnung vor Inkasso',
                greeting: 'Sehr geehrte/r',
                tone: 'final',
                body: `die Rechnung <strong>Nr. ${originalRechnung.nummer}</strong> vom <strong>${this.formatDate(originalRechnung.datum)}</strong>
                über <strong>€&nbsp;${(mahnung.betrag || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                ist trotz mehrfacher Aufforderung nicht beglichen.
                <br><br>
                <strong>Dies ist unsere letzte Zahlungserinnerung.</strong> Sollte die Zahlung nicht innerhalb von 5 Arbeitstagen erfolgen,
                werden wir die Forderung zur Inkassostelle einreichen und etwaige Inkassokosten in Rechnung stellen.`,
                backgroundColor: '#fee2e2',
                borderColor: '#ef4444',
                textColor: '#991b1b'
            }
        };

        const level = levels[stufe] || levels[1];

        const html = `
            <!DOCTYPE html>
            <html lang="de">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${level.title}</title>
                ${this.getBaseCss()}
            </head>
            <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f8fafc;">
                    <tr>
                        <td style="padding: 20px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <!-- Header -->
                                <tr>
                                    <td>
                                        ${this.getHeader()}
                                    </td>
                                </tr>

                                <!-- Main Content -->
                                <tr>
                                    <td class="email-body" style="padding: 40px; color: #1e293b;">
                                        <!-- Title -->
                                        <h2 style="margin: 0 0 20px 0; font-size: 18px; color: ${level.textColor};">${level.title}</h2>

                                        <!-- Customer Address -->
                                        <div style="margin-bottom: 30px;">
                                            <p style="margin: 0; font-size: 14px; font-weight: bold;">${level.greeting} ${kunde.name || 'Kunde'},</p>
                                        </div>

                                        <!-- Body Text -->
                                        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                                            ${level.body}
                                        </p>

                                        <!-- Invoice Details -->
                                        <div style="margin: 30px 0; padding: 15px; background-color: ${level.backgroundColor}; border-left: 4px solid ${level.borderColor}; border-radius: 4px;">
                                            <p style="margin: 0 0 10px 0; font-size: 13px; color: ${level.textColor}; font-weight: bold;">Rechnungsdetails:</p>
                                            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                                                <tr>
                                                    <td style="font-size: 13px; color: ${level.textColor}; padding: 5px 0;">Rechnungsnummer:</td>
                                                    <td style="font-size: 13px; color: ${level.textColor}; padding: 5px 15px; text-align: right; font-weight: bold;">${originalRechnung.nummer || ''}</td>
                                                </tr>
                                                <tr>
                                                    <td style="font-size: 13px; color: ${level.textColor}; padding: 5px 0;">Rechnungsdatum:</td>
                                                    <td style="font-size: 13px; color: ${level.textColor}; padding: 5px 15px; text-align: right;">${this.formatDate(originalRechnung.datum)}</td>
                                                </tr>
                                                <tr>
                                                    <td style="font-size: 13px; color: ${level.textColor}; padding: 5px 0;">Ausstehender Betrag:</td>
                                                    <td style="font-size: 14px; color: ${level.textColor}; padding: 5px 15px; text-align: right; font-weight: bold;">€&nbsp;${(mahnung.betrag || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                </tr>
                                            </table>
                                        </div>

                                        <!-- Payment Instructions -->
                                        <div style="margin: 30px 0; padding: 15px; background-color: #f1f5f9; border-radius: 4px;">
                                            <p style="margin: 0 0 10px 0; font-size: 13px; color: #0c4a6e; font-weight: bold;">Zahlungsanweisung:</p>
                                            <p style="margin: 5px 0; font-size: 13px; color: #0c4a6e;">
                                                IBAN: <strong>${comp.iban}</strong><br>
                                                BIC: <strong>${comp.bic}</strong><br>
                                                Bank: ${comp.bankName}
                                            </p>
                                        </div>

                                        ${stufe === 3 ? `
                                            <!-- Final warning -->
                                            <div style="margin: 30px 0; padding: 15px; background-color: #fee2e2; border-left: 4px solid #ef4444; border-radius: 4px;">
                                                <p style="margin: 0; font-size: 13px; color: #991b1b; font-weight: bold;">
                                                    ⚠️ Bitte beachten: Falls Sie bereits Zahlung geleistet haben, erkennen Sie diese E-Mail als ungültig an.
                                                    Falls sich Ihre Zahlung in Bearbeitung befindet, informieren Sie uns bitte unter ${comp.email}.
                                                </p>
                                            </div>
                                        ` : ''}

                                        <!-- Close -->
                                        <p style="margin: 30px 0 0 0; font-size: 14px;">
                                            Mit freundlichen Grüßen<br>
                                            <strong>${comp.name}</strong>
                                        </p>

                                        <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b;">
                                            Bei Fragen erreichen Sie uns unter ${comp.phone} oder ${comp.email}
                                        </p>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td>
                                        ${this.getFooter()}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        return {
            subject: `${level.title}: Rechnung Nr. ${originalRechnung.nummer} - ${comp.name}`,
            html: html
        };
    }

    /**
     * Appointment Confirmation Email - Terminbestätigung
     * @param {Object} termin - Appointment object with date, time, location
     * @param {Object} company - Optional company override
     * @returns {Object} { subject, html }
     */
    getTerminEmail(termin, company = null) {
        const comp = company || this.company;
        const kunde = termin.kunde || {};

        // Generate ICS calendar file content for .ics attachment (not embedded)
        const icsContent = this.generateICS(termin, comp);

        const html = `
            <!DOCTYPE html>
            <html lang="de">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Terminbestätigung</title>
                ${this.getBaseCss()}
            </head>
            <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f8fafc;">
                    <tr>
                        <td style="padding: 20px 0;">
                            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <!-- Header -->
                                <tr>
                                    <td>
                                        ${this.getHeader()}
                                    </td>
                                </tr>

                                <!-- Main Content -->
                                <tr>
                                    <td class="email-body" style="padding: 40px; color: #1e293b;">
                                        <!-- Title -->
                                        <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #0f172a;">Terminbestätigung</h2>

                                        <!-- Greeting -->
                                        <p style="margin: 20px 0; font-size: 14px; line-height: 1.6;">
                                            Sehr geehrte/r ${kunde.name ? kunde.name.split(' ')[0] : 'Kunde'},
                                        </p>

                                        <!-- Confirmation -->
                                        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                                            hiermit bestätigen wir Ihren Termin mit den folgenden Details:
                                        </p>

                                        <!-- Appointment Details -->
                                        <div style="margin: 30px 0; padding: 20px; background-color: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 4px;">
                                            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                                                <tr>
                                                    <td style="padding: 10px 0; font-size: 13px; color: #0c4a6e;">📅 Datum:</td>
                                                    <td style="padding: 10px 15px; text-align: right; font-size: 13px; font-weight: bold; color: #0c4a6e;">${this.formatDate(termin.datum)}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 10px 0; font-size: 13px; color: #0c4a6e;">🕐 Uhrzeit:</td>
                                                    <td style="padding: 10px 15px; text-align: right; font-size: 13px; font-weight: bold; color: #0c4a6e;">${termin.uhrzeit || '09:00'} Uhr</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 10px 0; font-size: 13px; color: #0c4a6e;">📍 Ort:</td>
                                                    <td style="padding: 10px 15px; text-align: right; font-size: 13px; font-weight: bold; color: #0c4a6e;">${termin.ort || 'Nach Vereinbarung'}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 10px 0; font-size: 13px; color: #0c4a6e;">Ansprechpartner:</td>
                                                    <td style="padding: 10px 15px; text-align: right; font-size: 13px; font-weight: bold; color: #0c4a6e;">${termin.mitarbeiter || comp.name}</td>
                                                </tr>
                                            </table>
                                        </div>

                                        <!-- Address Info -->
                                        ${termin.adresse ? `
                                            <div style="margin: 20px 0; padding: 15px; background-color: #f1f5f9; border-radius: 4px;">
                                                <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748b; font-weight: bold;">Genaue Adresse:</p>
                                                <p style="margin: 0; font-size: 13px; color: #0c4a6e; line-height: 1.6;">
                                                    ${termin.adresse.replace(/\n/g, '<br>')}
                                                </p>
                                            </div>
                                        ` : ''}

                                        <!-- Contact Instructions -->
                                        <div style="margin: 30px 0; padding: 15px; background-color: #f0fdf4; border-radius: 4px;">
                                            <p style="margin: 0 0 10px 0; font-size: 13px; color: #15803d; font-weight: bold;">Hinweise:</p>
                                            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #15803d;">
                                                <li style="margin: 5px 0;">Bei Verhinderung bitte rechtzeitig absagen (mindestens 24h vorher)</li>
                                                <li style="margin: 5px 0;">Kontakt: ${comp.phone} oder ${comp.email}</li>
                                                <li style="margin: 5px 0;">Termin im Kalender speichern (siehe ICS-Datei)</li>
                                            </ul>
                                        </div>

                                        <!-- Close -->
                                        <p style="margin: 30px 0 0 0; font-size: 14px;">
                                            Wir freuen uns auf Sie!<br><br>
                                            Mit freundlichen Grüßen<br>
                                            <strong>${comp.name}</strong>
                                        </p>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td>
                                        ${this.getFooter()}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        return {
            subject: `Terminbestätigung: ${this.formatDate(termin.datum)} um ${termin.uhrzeit || '09:00'} Uhr`,
            html: html,
            icsContent: icsContent,
            icsFilename: `Termin_${this.formatDate(termin.datum).replace(/\./g, '-')}.ics`
        };
    }

    /**
     * Generate ICS calendar file content
     * @private
     */
    generateICS(termin, company) {
        const now = new Date();
        const dateParts = termin.datum.split('-');
        const [hours, minutes] = (termin.uhrzeit || '09:00').split(':');

        const startDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hours, minutes);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

        const formatICSDate = (date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//${company.name}//Calendar//DE
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:termin-${termin.id || Date.now()}@${company.email}
DTSTAMP:${formatICSDate(now)}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:Termin mit ${company.name}
DESCRIPTION:Terminbestätigung
LOCATION:${termin.ort || 'Nach Vereinbarung'}
ORGANIZER:CN=${company.name};EMAIL=${company.email}
CONTACT:${company.phone}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

        return ics;
    }

    /**
     * Format date in German format (DD.MM.YYYY)
     * @private
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
}

// Create global instance
window.emailTemplateService = new EmailTemplateService();
