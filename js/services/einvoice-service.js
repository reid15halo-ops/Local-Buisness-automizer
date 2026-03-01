/* ============================================
   E-Rechnung Service (XRechnung / ZUGFeRD)
   Generate legally compliant electronic invoices

   Supports:
   - XRechnung 3.0 (UBL 2.1 format)
   - ZUGFeRD 2.2 COMFORT (UN/CEFACT CII format)
   - Leitweg-ID management
   - XML validation against XRechnung spec
   - PDF/A-3 with embedded XML (ZUGFeRD)
   ============================================ */

class EInvoiceService {
    constructor() {
        this.settings = JSON.parse(localStorage.getItem('freyai_einvoice_settings') || '{}');
        this.generatedInvoices = JSON.parse(localStorage.getItem('freyai_einvoice_generated') || '[]');

        // Default business data
        if (!this.settings.businessData) {
            this.settings.businessData = {
                name: 'FreyAI Visions',
                street: '',
                city: '',
                postalCode: '',
                country: 'DE',
                vatId: '',
                email: '',
                phone: '',
                iban: '',
                bic: '',
                bankName: ''
            };
        }

        // Initialize Leitweg-ID storage
        if (!this.settings.defaultLeitwegId) {
            this.settings.defaultLeitwegId = '';
        }
        if (!this.settings.customerLeitwegIds) {
            this.settings.customerLeitwegIds = {};
        }

        // Sync from admin panel / store settings on init
        this.syncFromSettings();
    }

    // ============================================
    // Settings & Sync
    // ============================================

    // Sync business data from admin panel settings and store settings
    syncFromSettings() {
        const ap = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
        const storeSettings = window.storeService?.state?.settings || {};

        const name = ap.company_name || storeSettings.companyName || storeSettings.firmenname || '';
        const street = ap.address_street || storeSettings.address || '';
        const city = ap.address_city || '';
        const postalCode = ap.address_postal || '';
        const vatId = ap.tax_number || storeSettings.vatId || storeSettings.taxId || '';
        const email = ap.company_email || '';
        const phone = ap.company_phone || '';
        const iban = ap.bank_iban || storeSettings.iban || '';
        const bic = ap.bank_bic || storeSettings.bic || '';
        const bankName = ap.bank_name || storeSettings.bank || '';

        // Only update fields that have actual values (don't overwrite with empty)
        const bd = this.settings.businessData;
        if (name) {bd.name = name;}
        if (street) {bd.street = street;}
        if (city) {bd.city = city;}
        if (postalCode) {bd.postalCode = postalCode;}
        if (vatId) {bd.vatId = vatId;}
        if (email) {bd.email = email;}
        if (phone) {bd.phone = phone;}
        if (iban) {bd.iban = iban;}
        if (bic) {bd.bic = bic;}
        if (bankName) {bd.bankName = bankName;}

        localStorage.setItem('freyai_einvoice_settings', JSON.stringify(this.settings));
    }

    // Update business data
    updateBusinessData(data) {
        this.settings.businessData = { ...this.settings.businessData, ...data };
        this._saveSettings();
    }

    // ============================================
    // Leitweg-ID Management
    // ============================================

    /**
     * Validate Leitweg-ID format.
     * Format: XXX-XXXXX-XX where X are digits, separated by hyphens.
     * More relaxed: at least pattern like NNN-NNNNN-NN but allows varying lengths.
     * @param {string} id - The Leitweg-ID to validate
     * @returns {{ valid: boolean, error: string|null }}
     */
    validateLeitwegId(id) {
        if (!id || typeof id !== 'string') {
            return { valid: false, error: 'Leitweg-ID darf nicht leer sein' };
        }

        const trimmed = id.trim();

        // Must contain at least two hyphens separating three groups
        const parts = trimmed.split('-');
        if (parts.length < 3) {
            return { valid: false, error: 'Leitweg-ID muss mindestens 3 Teile haben (z.B. 991-12345-67)' };
        }

        // Each part must be alphanumeric (digits primarily, some allow letters)
        for (let i = 0; i < parts.length; i++) {
            if (!/^[A-Za-z0-9]+$/.test(parts[i])) {
                return { valid: false, error: `Teil ${i + 1} enthaelt ungueltige Zeichen: "${parts[i]}"` };
            }
        }

        // First part (Grobadressat) should be 2-12 characters
        if (parts[0].length < 2 || parts[0].length > 12) {
            return { valid: false, error: 'Grobadressat (erster Teil) muss 2-12 Zeichen lang sein' };
        }

        // Second part (Feinadressat) should be 1-30 characters
        if (parts[1].length < 1 || parts[1].length > 30) {
            return { valid: false, error: 'Feinadressat (zweiter Teil) muss 1-30 Zeichen lang sein' };
        }

        // Last part is the check digit (2 characters)
        const lastPart = parts[parts.length - 1];
        if (lastPart.length < 2 || lastPart.length > 2) {
            return { valid: false, error: 'Pruefziffer (letzter Teil) muss genau 2 Zeichen lang sein' };
        }

        return { valid: true, error: null };
    }

    /**
     * Set the default Leitweg-ID for the business.
     * @param {string} id - The Leitweg-ID
     * @returns {{ success: boolean, error: string|null }}
     */
    setDefaultLeitwegId(id) {
        if (id && id.trim()) {
            const validation = this.validateLeitwegId(id);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }
            this.settings.defaultLeitwegId = id.trim();
        } else {
            this.settings.defaultLeitwegId = '';
        }
        this._saveSettings();
        return { success: true, error: null };
    }

    /**
     * Get the default Leitweg-ID.
     * @returns {string}
     */
    getDefaultLeitwegId() {
        return this.settings.defaultLeitwegId || '';
    }

    /**
     * Set a per-customer Leitweg-ID.
     * @param {string} customerId - Customer ID
     * @param {string} leitwegId - The Leitweg-ID for this customer
     * @returns {{ success: boolean, error: string|null }}
     */
    setCustomerLeitwegId(customerId, leitwegId) {
        if (!customerId) {
            return { success: false, error: 'Kunden-ID erforderlich' };
        }

        if (leitwegId && leitwegId.trim()) {
            const validation = this.validateLeitwegId(leitwegId);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }
            this.settings.customerLeitwegIds[customerId] = leitwegId.trim();
        } else {
            delete this.settings.customerLeitwegIds[customerId];
        }

        this._saveSettings();
        return { success: true, error: null };
    }

    /**
     * Get the Leitweg-ID for a specific customer (falls back to default).
     * @param {string} customerId - Customer ID
     * @returns {string}
     */
    getCustomerLeitwegId(customerId) {
        if (customerId && this.settings.customerLeitwegIds[customerId]) {
            return this.settings.customerLeitwegIds[customerId];
        }
        return this.settings.defaultLeitwegId || '';
    }

    /**
     * Get all customer Leitweg-ID mappings.
     * @returns {Object}
     */
    getAllCustomerLeitwegIds() {
        return { ...this.settings.customerLeitwegIds };
    }

    /**
     * Remove a customer's Leitweg-ID.
     * @param {string} customerId
     */
    removeCustomerLeitwegId(customerId) {
        delete this.settings.customerLeitwegIds[customerId];
        this._saveSettings();
    }

    // ============================================
    // XRechnung Generation (UBL 2.1)
    // ============================================

    /**
     * Generate XRechnung XML from an invoice and store the record.
     * @param {Object} invoice - Invoice data object
     * @returns {{ success: boolean, xml: string, recordId: string, validation: Object }}
     */
    generateXRechnung(invoice) {
        const xml = this.buildXRechnungXml(invoice);
        const validation = this.validateXRechnung(xml);

        const record = {
            id: 'xr-' + Date.now(),
            invoiceId: invoice.id || invoice.nummer,
            invoiceNummer: invoice.nummer || invoice.id,
            format: 'XRechnung',
            version: '3.0',
            xml: xml,
            leitwegId: invoice.leitwegId || this.getCustomerLeitwegId(invoice.kunde?.id) || null,
            createdAt: new Date().toISOString(),
            status: validation.valid ? 'generated' : 'generated_with_warnings',
            validation: validation
        };

        this.generatedInvoices.push(record);
        this._saveGenerated();

        return {
            success: true,
            xml: xml,
            recordId: record.id,
            validation: validation
        };
    }

    // Tax category mapping: S=Standard, AA=Reduced, E=Exempt (Kleinunternehmer par. 19)
    _getTaxCategory(satz) {
        if (satz === 0) {return 'E';}
        if (satz === 7) {return 'AA';}
        return 'S';
    }

    // Tax category scheme name
    _getTaxCategoryName(satz) {
        if (satz === 0) {return 'Not subject to VAT';}
        if (satz === 7) {return 'Reduced rate';}
        return 'Standard rate';
    }

    // Escape XML special characters
    _escXml(str) {
        if (!str) {return '';}
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // Group positions by tax rate for multi-rate support
    _groupByTaxRate(positionen) {
        const groups = {};
        for (const p of positionen) {
            const rate = p.mwstSatz ?? p.ustSatz ?? 19;
            const einzelpreis = p.einzelpreis ?? p.preis ?? 0;
            const menge = p.menge ?? 1;
            if (!groups[rate]) {groups[rate] = { rate, netto: 0, positionen: [] };}
            groups[rate].netto += menge * einzelpreis;
            groups[rate].positionen.push(p);
        }
        return Object.values(groups);
    }

    // Normalize date to ISO YYYY-MM-DD
    _normalizeDate(dateStr) {
        if (!dateStr) {return new Date().toISOString().split('T')[0];}
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {return new Date().toISOString().split('T')[0];}
        return d.toISOString().split('T')[0];
    }

    // Get unit code for a position
    _getUnitCode(pos) {
        if (pos.einheit) {
            const unitMap = {
                'Stk': 'C62', 'Stk.': 'C62', 'Stueck': 'C62', 'Stck': 'C62',
                'Std': 'HUR', 'Std.': 'HUR', 'Stunde': 'HUR', 'Stunden': 'HUR', 'h': 'HUR',
                'm': 'MTR', 'Meter': 'MTR', 'lfm': 'MTR',
                'm2': 'MTK', 'qm': 'MTK',
                'm3': 'MTQ', 'cbm': 'MTQ',
                'kg': 'KGM', 'Kg': 'KGM',
                'l': 'LTR', 'Liter': 'LTR',
                'pauschal': 'C62', 'Pauschal': 'C62', 'psch': 'C62',
                't': 'TNE', 'Tonne': 'TNE'
            };
            return unitMap[pos.einheit] || 'C62';
        }
        return 'C62';
    }

    /**
     * Build XRechnung XML structure (UBL 2.1 compliant).
     * Conforms to XRechnung 3.0 / EN 16931.
     * @param {Object} invoice - Invoice data
     * @returns {string} UBL 2.1 XML string
     */
    buildXRechnungXml(invoice) {
        const bd = this.settings.businessData;
        const kunde = invoice.kunde || {};
        const positionen = invoice.positionen || [];

        // Resolve Leitweg-ID: explicit > customer-specific > default
        const leitwegId = invoice.leitwegId
            || this.getCustomerLeitwegId(kunde.id)
            || this.getDefaultLeitwegId()
            || '';

        // Calculate totals with per-position tax rates
        const taxGroups = this._groupByTaxRate(positionen);
        const nettoTotal = positionen.reduce((sum, p) => {
            const preis = p.einzelpreis ?? p.preis ?? 0;
            const menge = p.menge ?? 1;
            return sum + (menge * preis);
        }, 0);
        const ustBetrag = taxGroups.reduce((sum, g) => sum + (g.netto * g.rate / 100), 0);
        const bruttoTotal = nettoTotal + ustBetrag;

        const invoiceDate = this._normalizeDate(invoice.datum);
        const dueDate = invoice.faelligkeitsdatum
            ? this._normalizeDate(invoice.faelligkeitsdatum)
            : this.addDays(invoiceDate, 14);

        // Payment terms text
        const paymentDays = this._daysBetween(invoiceDate, dueDate);
        const paymentTermsNote = invoice.zahlungsbedingungen
            || `Zahlbar innerhalb von ${paymentDays} Tagen ohne Abzug.`;

        // Build note if present
        const noteXml = invoice.notizen
            ? `    <cbc:Note>${this._escXml(invoice.notizen)}</cbc:Note>\n`
            : '';

        return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">

    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
    <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>

    <cbc:ID>${this._escXml(invoice.nummer || invoice.id)}</cbc:ID>
    <cbc:IssueDate>${invoiceDate}</cbc:IssueDate>
    <cbc:DueDate>${dueDate}</cbc:DueDate>
    <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
${noteXml}    <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
    <cbc:BuyerReference>${this._escXml(leitwegId || kunde.leitwegId || 'N/A')}</cbc:BuyerReference>

    <!-- Seller / Verkaeufer -->
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:EndpointID schemeID="EM">${this._escXml(bd.email)}</cac:EndpointID>
            <cac:PartyName>
                <cbc:Name>${this._escXml(bd.name)}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${this._escXml(bd.street)}</cbc:StreetName>
                <cbc:CityName>${this._escXml(bd.city)}</cbc:CityName>
                <cbc:PostalZone>${this._escXml(bd.postalCode)}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${this._escXml(bd.country)}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${this._escXml(bd.vatId)}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${this._escXml(bd.name)}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
            <cac:Contact>
                <cbc:Telephone>${this._escXml(bd.phone)}</cbc:Telephone>
                <cbc:ElectronicMail>${this._escXml(bd.email)}</cbc:ElectronicMail>
            </cac:Contact>
        </cac:Party>
    </cac:AccountingSupplierParty>

    <!-- Buyer / Kaeufer -->
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:EndpointID schemeID="EM">${this._escXml(kunde.email || '')}</cac:EndpointID>
            <cac:PartyName>
                <cbc:Name>${this._escXml(kunde.firma || kunde.name || '')}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${this._escXml(kunde.strasse || kunde.street || '')}</cbc:StreetName>
                <cbc:CityName>${this._escXml(kunde.ort || kunde.city || '')}</cbc:CityName>
                <cbc:PostalZone>${this._escXml(kunde.plz || kunde.postalCode || '00000')}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${this._escXml(kunde.land || 'DE')}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>${kunde.ustId ? `
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${this._escXml(kunde.ustId)}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>` : ''}
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${this._escXml(kunde.firma || kunde.name || '')}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
            <cac:Contact>
                <cbc:ElectronicMail>${this._escXml(kunde.email || '')}</cbc:ElectronicMail>
            </cac:Contact>
        </cac:Party>
    </cac:AccountingCustomerParty>

    <!-- Payment Means -->
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
        <cbc:PaymentID>${this._escXml(invoice.nummer || invoice.id)}</cbc:PaymentID>
        <cac:PayeeFinancialAccount>
            <cbc:ID>${this._escXml((bd.iban || '').replace(/\s/g, ''))}</cbc:ID>
            <cbc:Name>${this._escXml(bd.name)}</cbc:Name>
            <cac:FinancialInstitutionBranch>
                <cbc:ID>${this._escXml(bd.bic)}</cbc:ID>
            </cac:FinancialInstitutionBranch>
        </cac:PayeeFinancialAccount>
    </cac:PaymentMeans>

    <!-- Payment Terms -->
    <cac:PaymentTerms>
        <cbc:Note>${this._escXml(paymentTermsNote)}</cbc:Note>
    </cac:PaymentTerms>

    <!-- Tax Total -->
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="EUR">${ustBetrag.toFixed(2)}</cbc:TaxAmount>
${taxGroups.map(g => `        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="EUR">${g.netto.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="EUR">${(g.netto * g.rate / 100).toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>${this._getTaxCategory(g.rate)}</cbc:ID>
                <cbc:Percent>${g.rate}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`).join('\n')}
    </cac:TaxTotal>

    <!-- Legal Monetary Total -->
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="EUR">${nettoTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="EUR">${nettoTotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="EUR">${bruttoTotal.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="EUR">${bruttoTotal.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>

    <!-- Invoice Lines -->
${positionen.map((pos, i) => {
    const rate = pos.mwstSatz ?? pos.ustSatz ?? 19;
    const einzelpreis = pos.einzelpreis ?? pos.preis ?? 0;
    const menge = pos.menge ?? 1;
    const lineTotal = menge * einzelpreis;
    const unitCode = this._getUnitCode(pos);
    const itemName = pos.name || pos.beschreibung || `Position ${i + 1}`;
    const itemDesc = pos.beschreibung || pos.name || '';
    return `    <cac:InvoiceLine>
        <cbc:ID>${i + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${unitCode}">${menge}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="EUR">${lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:Item>
            <cbc:Description>${this._escXml(itemDesc)}</cbc:Description>
            <cbc:Name>${this._escXml(itemName)}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>${this._getTaxCategory(rate)}</cbc:ID>
                <cbc:Percent>${rate}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="EUR">${einzelpreis.toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`;
}).join('\n')}

</ubl:Invoice>`;
    }

    // ============================================
    // ZUGFeRD Generation (CII format)
    // ============================================

    // Load pdf-lib from CDN
    async _loadPdfLib() {
        if (window.PDFLib) {return window.PDFLib;}
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
            script.integrity = 'sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI';
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve(window.PDFLib);
            script.onerror = () => reject(new Error('pdf-lib konnte nicht geladen werden'));
            document.head.appendChild(script);
        });
    }

    /**
     * Generate ZUGFeRD 2.2 COMFORT invoice with optional PDF embedding.
     * @param {Object} invoice - Invoice data object
     * @returns {Promise<{ success: boolean, xml: string, pdfBytes: Uint8Array|null, recordId: string, status: string, validation: Object }>}
     */
    async generateZugferd(invoice) {
        const xml = this.buildZugferdXml(invoice);
        const validation = this.validateZugferd(xml);

        // Try to create a real ZUGFeRD PDF with embedded XML
        let pdfBytes = null;
        let status = 'xml_generated';

        try {
            const PDFLib = await this._loadPdfLib();

            // Get the visual PDF from pdfGenerationService if available
            let basePdfBytes;
            if (window.pdfGenerationService && typeof window.pdfGenerationService.getPDFBlob === 'function') {
                const blob = await window.pdfGenerationService.getPDFBlob(invoice);
                basePdfBytes = new Uint8Array(await blob.arrayBuffer());
            } else {
                // Create a minimal PDF as fallback
                const doc = await PDFLib.PDFDocument.create();
                const page = doc.addPage();
                const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
                const fontBold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
                const bd = this.settings.businessData;

                page.drawText(bd.name || 'Rechnung', { x: 50, y: 780, size: 14, font: fontBold });
                page.drawText(`Rechnung Nr. ${invoice.nummer || invoice.id}`, { x: 50, y: 750, size: 18, font: fontBold });
                page.drawText(`Datum: ${this._normalizeDate(invoice.datum)}`, { x: 50, y: 725, size: 10, font });
                page.drawText('ZUGFeRD 2.2 COMFORT - XML-Daten eingebettet', { x: 50, y: 705, size: 9, font });

                basePdfBytes = await doc.save();
            }

            // Load the base PDF and embed the XML
            const pdfDoc = await PDFLib.PDFDocument.load(basePdfBytes);

            // Set PDF metadata for ZUGFeRD
            pdfDoc.setTitle(`Rechnung ${invoice.nummer || invoice.id}`);
            pdfDoc.setSubject('ZUGFeRD 2.2 COMFORT');
            pdfDoc.setProducer('FreyAI Visions E-Rechnung');
            pdfDoc.setCreator('FreyAI Visions');

            // Embed the XML as a file attachment (ZUGFeRD standard filename)
            const xmlBytes = new TextEncoder().encode(xml);
            await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
                mimeType: 'text/xml',
                description: 'Factur-X/ZUGFeRD 2.2 COMFORT invoice data',
                creationDate: new Date(),
                modificationDate: new Date()
            });

            pdfBytes = await pdfDoc.save();
            status = 'pdf_generated';
        } catch (err) {
            console.warn('ZUGFeRD PDF-Einbettung fehlgeschlagen, nur XML generiert:', err.message);
        }

        const record = {
            id: 'zf-' + Date.now(),
            invoiceId: invoice.id || invoice.nummer,
            invoiceNummer: invoice.nummer || invoice.id,
            format: 'ZUGFeRD',
            version: '2.2',
            profile: 'COMFORT',
            xml: xml,
            pdfBytes: pdfBytes ? Array.from(pdfBytes) : null,
            createdAt: new Date().toISOString(),
            status: status,
            validation: validation
        };

        this.generatedInvoices.push(record);
        this._saveGenerated();

        return {
            success: true,
            xml: xml,
            pdfBytes: pdfBytes,
            recordId: record.id,
            status: status,
            validation: validation
        };
    }

    /**
     * Build ZUGFeRD 2.2 COMFORT XML (UN/CEFACT CII CrossIndustryInvoice).
     * @param {Object} invoice - Invoice data
     * @returns {string} CII XML string
     */
    buildZugferdXml(invoice) {
        const bd = this.settings.businessData;
        const kunde = invoice.kunde || {};
        const positionen = invoice.positionen || [];

        const leitwegId = invoice.leitwegId
            || this.getCustomerLeitwegId(kunde.id)
            || this.getDefaultLeitwegId()
            || '';

        const taxGroups = this._groupByTaxRate(positionen);
        const nettoTotal = positionen.reduce((sum, p) => {
            const preis = p.einzelpreis ?? p.preis ?? 0;
            const menge = p.menge ?? 1;
            return sum + (menge * preis);
        }, 0);
        const ustBetrag = taxGroups.reduce((sum, g) => sum + (g.netto * g.rate / 100), 0);
        const bruttoTotal = nettoTotal + ustBetrag;

        const invoiceDate = this._normalizeDate(invoice.datum);
        const dueDate = invoice.faelligkeitsdatum
            ? this._normalizeDate(invoice.faelligkeitsdatum)
            : this.addDays(invoiceDate, 14);

        // CII uses format 102 (YYYYMMDD)
        const issueDateCII = invoiceDate.replace(/-/g, '');
        const dueDateCII = dueDate.replace(/-/g, '');

        const paymentDays = this._daysBetween(invoiceDate, dueDate);
        const paymentTermsNote = invoice.zahlungsbedingungen
            || `Zahlbar innerhalb von ${paymentDays} Tagen ohne Abzug.`;

        return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
                          xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
                          xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
                          xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
                          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

    <rsm:ExchangedDocumentContext>
        <ram:GuidelineSpecifiedDocumentContextParameter>
            <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:comfort</ram:ID>
        </ram:GuidelineSpecifiedDocumentContextParameter>
    </rsm:ExchangedDocumentContext>

    <rsm:ExchangedDocument>
        <ram:ID>${this._escXml(invoice.nummer || invoice.id)}</ram:ID>
        <ram:TypeCode>380</ram:TypeCode>
        <ram:IssueDateTime>
            <udt:DateTimeString format="102">${issueDateCII}</udt:DateTimeString>
        </ram:IssueDateTime>${invoice.notizen ? `
        <ram:IncludedNote>
            <ram:Content>${this._escXml(invoice.notizen)}</ram:Content>
        </ram:IncludedNote>` : ''}
    </rsm:ExchangedDocument>

    <rsm:SupplyChainTradeTransaction>

        <!-- Trade Agreement -->
        <ram:ApplicableHeaderTradeAgreement>${leitwegId ? `
            <ram:BuyerReference>${this._escXml(leitwegId)}</ram:BuyerReference>` : ''}

            <ram:SellerTradeParty>
                <ram:Name>${this._escXml(bd.name)}</ram:Name>
                <ram:PostalTradeAddress>
                    <ram:PostcodeCode>${this._escXml(bd.postalCode)}</ram:PostcodeCode>
                    <ram:LineOne>${this._escXml(bd.street)}</ram:LineOne>
                    <ram:CityName>${this._escXml(bd.city)}</ram:CityName>
                    <ram:CountryID>${this._escXml(bd.country)}</ram:CountryID>
                </ram:PostalTradeAddress>
                <ram:URIUniversalCommunication>
                    <ram:URIID schemeID="EM">${this._escXml(bd.email)}</ram:URIID>
                </ram:URIUniversalCommunication>
                <ram:SpecifiedTaxRegistration>
                    <ram:ID schemeID="VA">${this._escXml(bd.vatId)}</ram:ID>
                </ram:SpecifiedTaxRegistration>
            </ram:SellerTradeParty>

            <ram:BuyerTradeParty>
                <ram:Name>${this._escXml(kunde.firma || kunde.name || '')}</ram:Name>
                <ram:PostalTradeAddress>
                    <ram:PostcodeCode>${this._escXml(kunde.plz || kunde.postalCode || '')}</ram:PostcodeCode>
                    <ram:LineOne>${this._escXml(kunde.strasse || kunde.street || '')}</ram:LineOne>
                    <ram:CityName>${this._escXml(kunde.ort || kunde.city || '')}</ram:CityName>
                    <ram:CountryID>${this._escXml(kunde.land || 'DE')}</ram:CountryID>
                </ram:PostalTradeAddress>
                <ram:URIUniversalCommunication>
                    <ram:URIID schemeID="EM">${this._escXml(kunde.email || '')}</ram:URIID>
                </ram:URIUniversalCommunication>${kunde.ustId ? `
                <ram:SpecifiedTaxRegistration>
                    <ram:ID schemeID="VA">${this._escXml(kunde.ustId)}</ram:ID>
                </ram:SpecifiedTaxRegistration>` : ''}
            </ram:BuyerTradeParty>
        </ram:ApplicableHeaderTradeAgreement>

        <!-- Trade Delivery -->
        <ram:ApplicableHeaderTradeDelivery>
            <ram:ActualDeliverySupplyChainEvent>
                <ram:OccurrenceDateTime>
                    <udt:DateTimeString format="102">${issueDateCII}</udt:DateTimeString>
                </ram:OccurrenceDateTime>
            </ram:ActualDeliverySupplyChainEvent>
        </ram:ApplicableHeaderTradeDelivery>

        <!-- Trade Settlement -->
        <ram:ApplicableHeaderTradeSettlement>
            <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>

            <ram:SpecifiedTradeSettlementPaymentMeans>
                <ram:TypeCode>58</ram:TypeCode>
                <ram:PayeePartyCreditorFinancialAccount>
                    <ram:IBANID>${this._escXml((bd.iban || '').replace(/\s/g, ''))}</ram:IBANID>
                    <ram:AccountName>${this._escXml(bd.name)}</ram:AccountName>
                </ram:PayeePartyCreditorFinancialAccount>
                <ram:PayeeSpecifiedCreditorFinancialInstitution>
                    <ram:BICID>${this._escXml(bd.bic)}</ram:BICID>
                </ram:PayeeSpecifiedCreditorFinancialInstitution>
            </ram:SpecifiedTradeSettlementPaymentMeans>

${taxGroups.map(g => `            <ram:ApplicableTradeTax>
                <ram:CalculatedAmount>${(g.netto * g.rate / 100).toFixed(2)}</ram:CalculatedAmount>
                <ram:TypeCode>VAT</ram:TypeCode>
                <ram:BasisAmount>${g.netto.toFixed(2)}</ram:BasisAmount>
                <ram:CategoryCode>${this._getTaxCategory(g.rate)}</ram:CategoryCode>
                <ram:RateApplicablePercent>${g.rate}</ram:RateApplicablePercent>
            </ram:ApplicableTradeTax>`).join('\n')}

            <ram:SpecifiedTradePaymentTerms>
                <ram:Description>${this._escXml(paymentTermsNote)}</ram:Description>
                <ram:DueDateDateTime>
                    <udt:DateTimeString format="102">${dueDateCII}</udt:DateTimeString>
                </ram:DueDateDateTime>
            </ram:SpecifiedTradePaymentTerms>

            <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
                <ram:LineTotalAmount>${nettoTotal.toFixed(2)}</ram:LineTotalAmount>
                <ram:TaxBasisTotalAmount>${nettoTotal.toFixed(2)}</ram:TaxBasisTotalAmount>
                <ram:TaxTotalAmount currencyID="EUR">${ustBetrag.toFixed(2)}</ram:TaxTotalAmount>
                <ram:GrandTotalAmount>${bruttoTotal.toFixed(2)}</ram:GrandTotalAmount>
                <ram:DuePayableAmount>${bruttoTotal.toFixed(2)}</ram:DuePayableAmount>
            </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        </ram:ApplicableHeaderTradeSettlement>

        <!-- Line Items -->
${positionen.map((pos, i) => {
    const rate = pos.mwstSatz ?? pos.ustSatz ?? 19;
    const einzelpreis = pos.einzelpreis ?? pos.preis ?? 0;
    const menge = pos.menge ?? 1;
    const lineTotal = menge * einzelpreis;
    const unitCode = this._getUnitCode(pos);
    const itemName = pos.name || pos.beschreibung || `Position ${i + 1}`;
    return `        <ram:IncludedSupplyChainTradeLineItem>
            <ram:AssociatedDocumentLineDocument>
                <ram:LineID>${i + 1}</ram:LineID>
            </ram:AssociatedDocumentLineDocument>
            <ram:SpecifiedTradeProduct>
                <ram:Name>${this._escXml(itemName)}</ram:Name>
            </ram:SpecifiedTradeProduct>
            <ram:SpecifiedLineTradeAgreement>
                <ram:NetPriceProductTradePrice>
                    <ram:ChargeAmount>${einzelpreis.toFixed(2)}</ram:ChargeAmount>
                </ram:NetPriceProductTradePrice>
            </ram:SpecifiedLineTradeAgreement>
            <ram:SpecifiedLineTradeDelivery>
                <ram:BilledQuantity unitCode="${unitCode}">${menge}</ram:BilledQuantity>
            </ram:SpecifiedLineTradeDelivery>
            <ram:SpecifiedLineTradeSettlement>
                <ram:ApplicableTradeTax>
                    <ram:TypeCode>VAT</ram:TypeCode>
                    <ram:CategoryCode>${this._getTaxCategory(rate)}</ram:CategoryCode>
                    <ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent>
                </ram:ApplicableTradeTax>
                <ram:SpecifiedTradeSettlementLineMonetarySummation>
                    <ram:LineTotalAmount>${lineTotal.toFixed(2)}</ram:LineTotalAmount>
                </ram:SpecifiedTradeSettlementLineMonetarySummation>
            </ram:SpecifiedLineTradeSettlement>
        </ram:IncludedSupplyChainTradeLineItem>`;
}).join('\n')}

    </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
    }

    // ============================================
    // Validation
    // ============================================

    /**
     * Validate XRechnung XML against required fields and business rules.
     * @param {string} xml - The XRechnung XML string
     * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
     */
    validateXRechnung(xml) {
        const errors = [];
        const warnings = [];

        if (!xml || typeof xml !== 'string') {
            return { valid: false, errors: ['XML ist leer oder ungueltig'], warnings: [] };
        }

        // ---- Structural checks (required elements) ----

        // BT-24 CustomizationID
        if (!xml.includes('CustomizationID')) {
            errors.push('[BT-24] CustomizationID fehlt');
        } else if (!xml.includes('urn:cen.eu:en16931:2017')) {
            warnings.push('[BT-24] CustomizationID enthaelt nicht die erwartete EN 16931 Kennung');
        }

        // BT-23 ProfileID
        if (!xml.includes('ProfileID')) {
            errors.push('[BT-23] ProfileID fehlt');
        }

        // BT-1 Invoice number
        if (!xml.includes('<cbc:ID>') && !xml.includes('<cbc:ID ')) {
            errors.push('[BT-1] Rechnungsnummer (ID) fehlt');
        }

        // BT-2 IssueDate
        if (!xml.includes('IssueDate')) {
            errors.push('[BT-2] Rechnungsdatum (IssueDate) fehlt');
        } else {
            // Validate ISO format
            const issueDateMatch = xml.match(/<cbc:IssueDate>(\d{4}-\d{2}-\d{2})<\/cbc:IssueDate>/);
            if (!issueDateMatch) {
                errors.push('[BT-2] IssueDate nicht im ISO-Format (YYYY-MM-DD)');
            }
        }

        // BT-9 DueDate
        if (!xml.includes('DueDate')) {
            warnings.push('[BT-9] Faelligkeitsdatum (DueDate) fehlt');
        }

        // BT-3 InvoiceTypeCode
        if (!xml.includes('InvoiceTypeCode')) {
            errors.push('[BT-3] InvoiceTypeCode fehlt');
        }

        // BT-5 DocumentCurrencyCode
        if (!xml.includes('DocumentCurrencyCode')) {
            errors.push('[BT-5] DocumentCurrencyCode fehlt');
        } else if (!xml.includes('>EUR<')) {
            warnings.push('[BT-5] Waehrung ist nicht EUR');
        }

        // BT-10 BuyerReference (mandatory for XRechnung)
        if (!xml.includes('BuyerReference')) {
            errors.push('[BT-10] BuyerReference (Leitweg-ID) fehlt - bei XRechnung Pflichtfeld');
        } else {
            // Extract and validate BuyerReference content
            const buyerRefMatch = xml.match(/<cbc:BuyerReference>(.*?)<\/cbc:BuyerReference>/);
            if (buyerRefMatch) {
                const refValue = buyerRefMatch[1].trim();
                if (!refValue || refValue === 'N/A') {
                    warnings.push('[BT-10] BuyerReference ist leer oder N/A - Leitweg-ID sollte angegeben werden');
                } else {
                    // Validate Leitweg-ID format
                    const leitwegValidation = this.validateLeitwegId(refValue);
                    if (!leitwegValidation.valid) {
                        warnings.push(`[BT-10] Leitweg-ID Format: ${leitwegValidation.error}`);
                    }
                }
            }
        }

        // BG-4 Seller
        if (!xml.includes('AccountingSupplierParty')) {
            errors.push('[BG-4] Verkaeufer (AccountingSupplierParty) fehlt');
        } else {
            // Check seller details
            if (!this._xmlHasContent(xml, 'AccountingSupplierParty', 'Name')) {
                errors.push('[BT-27] Verkaeufer-Name fehlt');
            }
            if (!this._xmlHasContent(xml, 'AccountingSupplierParty', 'StreetName')) {
                warnings.push('[BT-35] Verkaeufer-Strasse fehlt');
            }
            if (!this._xmlHasContent(xml, 'AccountingSupplierParty', 'CityName')) {
                warnings.push('[BT-37] Verkaeufer-Stadt fehlt');
            }
            if (!this._xmlHasContent(xml, 'AccountingSupplierParty', 'PostalZone')) {
                warnings.push('[BT-38] Verkaeufer-PLZ fehlt');
            }
            if (!this._xmlHasContent(xml, 'AccountingSupplierParty', 'CompanyID')) {
                warnings.push('[BT-31] Verkaeufer USt-ID fehlt');
            }
        }

        // BG-7 Buyer
        if (!xml.includes('AccountingCustomerParty')) {
            errors.push('[BG-7] Kaeufer (AccountingCustomerParty) fehlt');
        } else {
            if (!this._xmlHasContent(xml, 'AccountingCustomerParty', 'Name')) {
                errors.push('[BT-44] Kaeufer-Name fehlt');
            }
        }

        // BG-16 PaymentMeans
        if (!xml.includes('PaymentMeans')) {
            warnings.push('[BG-16] Zahlungsinformationen (PaymentMeans) fehlen');
        }

        // BG-20 PaymentTerms (recommended)
        if (!xml.includes('PaymentTerms')) {
            warnings.push('[BT-20] Zahlungsbedingungen (PaymentTerms) fehlen');
        }

        // BG-22 TaxTotal
        if (!xml.includes('TaxTotal')) {
            errors.push('[BG-22] Steuerbetrag (TaxTotal) fehlt');
        }

        // BG-22 LegalMonetaryTotal
        if (!xml.includes('LegalMonetaryTotal')) {
            errors.push('[BG-22] Gesamtbetraege (LegalMonetaryTotal) fehlen');
        }

        // BG-25 InvoiceLine (at least one required)
        if (!xml.includes('InvoiceLine')) {
            errors.push('[BG-25] Keine Rechnungspositionen (InvoiceLine) vorhanden');
        }

        // ---- Tax calculation checks ----
        this._validateTaxCalculations(xml, errors, warnings);

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    }

    /**
     * Validate ZUGFeRD XML (CII format).
     * @param {string} xml - ZUGFeRD CII XML
     * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
     */
    validateZugferd(xml) {
        const errors = [];
        const warnings = [];

        if (!xml || typeof xml !== 'string') {
            return { valid: false, errors: ['XML ist leer oder ungueltig'], warnings: [] };
        }

        // Root element
        if (!xml.includes('CrossIndustryInvoice')) {
            errors.push('Kein CrossIndustryInvoice-Root-Element gefunden');
        }

        // GuidelineSpecifiedDocumentContextParameter
        if (!xml.includes('GuidelineSpecifiedDocumentContextParameter')) {
            errors.push('GuidelineSpecifiedDocumentContextParameter fehlt');
        }

        // ExchangedDocument
        if (!xml.includes('ExchangedDocument')) {
            errors.push('ExchangedDocument fehlt');
        }

        // Invoice ID
        const idMatch = xml.match(/<ram:ID>([^<]*)<\/ram:ID>/);
        if (!idMatch || !idMatch[1].trim()) {
            errors.push('Rechnungsnummer (ID) fehlt');
        }

        // TypeCode
        if (!xml.includes('<ram:TypeCode>380</ram:TypeCode>')) {
            warnings.push('TypeCode sollte 380 (Rechnung) sein');
        }

        // IssueDateTime
        if (!xml.includes('IssueDateTime')) {
            errors.push('Rechnungsdatum (IssueDateTime) fehlt');
        }

        // Seller
        if (!xml.includes('SellerTradeParty')) {
            errors.push('Verkaeufer (SellerTradeParty) fehlt');
        }

        // Buyer
        if (!xml.includes('BuyerTradeParty')) {
            errors.push('Kaeufer (BuyerTradeParty) fehlt');
        }

        // Settlement
        if (!xml.includes('ApplicableHeaderTradeSettlement')) {
            errors.push('Abrechnungsdaten (ApplicableHeaderTradeSettlement) fehlen');
        }

        // Currency
        if (!xml.includes('<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>')) {
            warnings.push('Waehrung ist nicht EUR');
        }

        // Monetary summation
        if (!xml.includes('SpecifiedTradeSettlementHeaderMonetarySummation')) {
            errors.push('Gesamtbetraege (MonetarySummation) fehlen');
        }

        // Line items
        if (!xml.includes('IncludedSupplyChainTradeLineItem')) {
            errors.push('Keine Rechnungspositionen vorhanden');
        }

        // Tax
        if (!xml.includes('ApplicableTradeTax')) {
            errors.push('Steuerinformationen fehlen');
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    }

    // Helper: Check if a section of XML has non-empty content in a child element
    _xmlHasContent(xml, parentTag, childTag) {
        // Extract parent section
        const parentRegex = new RegExp(`<[^>]*${parentTag}[^>]*>([\\s\\S]*?)<\\/[^>]*${parentTag}>`);
        const parentMatch = xml.match(parentRegex);
        if (!parentMatch) {return false;}

        const parentContent = parentMatch[1];
        const childRegex = new RegExp(`<[^>]*${childTag}[^>]*>([^<]+)<\\/`);
        const childMatch = parentContent.match(childRegex);
        return childMatch && childMatch[1].trim().length > 0;
    }

    // Validate tax calculations in UBL XML
    _validateTaxCalculations(xml, errors, warnings) {
        // Extract PayableAmount
        const payableMatch = xml.match(/<cbc:PayableAmount[^>]*>([\d.]+)<\/cbc:PayableAmount>/);
        const taxExclMatch = xml.match(/<cbc:TaxExclusiveAmount[^>]*>([\d.]+)<\/cbc:TaxExclusiveAmount>/);
        const taxTotalMatch = xml.match(/<cbc:TaxAmount[^>]*>([\d.]+)<\/cbc:TaxAmount>/);
        const lineExtMatch = xml.match(/<cbc:LineExtensionAmount[^>]*>([\d.]+)<\/cbc:LineExtensionAmount>/);

        if (payableMatch && taxExclMatch && taxTotalMatch) {
            const payable = parseFloat(payableMatch[1]);
            const taxExcl = parseFloat(taxExclMatch[1]);
            const taxTotal = parseFloat(taxTotalMatch[1]);

            const expectedPayable = taxExcl + taxTotal;
            if (Math.abs(payable - expectedPayable) > 0.02) {
                errors.push(`Steuerpruefung: PayableAmount (${payable}) != TaxExclusiveAmount (${taxExcl}) + TaxAmount (${taxTotal})`);
            }
        }

        // Check that line totals sum to LineExtensionAmount
        const lineAmounts = [];
        const lineRegex = /<cac:InvoiceLine>[\s\S]*?<cbc:LineExtensionAmount[^>]*>([\d.]+)<\/cbc:LineExtensionAmount>/g;
        let match;
        while ((match = lineRegex.exec(xml)) !== null) {
            lineAmounts.push(parseFloat(match[1]));
        }

        if (lineAmounts.length > 0 && lineExtMatch) {
            const lineSum = lineAmounts.reduce((a, b) => a + b, 0);
            const lineExt = parseFloat(lineExtMatch[1]);
            if (Math.abs(lineSum - lineExt) > 0.02) {
                warnings.push(`Positionssumme (${lineSum.toFixed(2)}) weicht von LineExtensionAmount (${lineExt.toFixed(2)}) ab`);
            }
        }

        // Validate each TaxSubtotal
        const subtotalRegex = /<cac:TaxSubtotal>[\s\S]*?<cbc:TaxableAmount[^>]*>([\d.]+)<[\s\S]*?<cbc:TaxAmount[^>]*>([\d.]+)<[\s\S]*?<cbc:Percent>([\d.]+)<[\s\S]*?<\/cac:TaxSubtotal>/g;
        while ((match = subtotalRegex.exec(xml)) !== null) {
            const taxable = parseFloat(match[1]);
            const taxAmt = parseFloat(match[2]);
            const pct = parseFloat(match[3]);
            const expected = taxable * pct / 100;
            if (Math.abs(taxAmt - expected) > 0.02) {
                warnings.push(`Steuerberechnung: ${taxable} x ${pct}% = ${expected.toFixed(2)}, aber ${taxAmt} angegeben`);
            }
        }
    }

    // ============================================
    // Download & File Operations
    // ============================================

    /**
     * Download XML file for a given invoice.
     * @param {string} invoiceId - Invoice ID or record ID
     * @param {string} [format] - 'XRechnung' or 'ZUGFeRD' (optional filter)
     * @returns {{ success: boolean, error?: string }}
     */
    downloadXml(invoiceId, format) {
        let record;

        // Try to find by record ID first
        record = this.generatedInvoices.find(r => r.id === invoiceId);

        // If not found, search by invoiceId + format
        if (!record) {
            const candidates = this.generatedInvoices.filter(r =>
                (r.invoiceId === invoiceId || r.invoiceNummer === invoiceId)
            );
            if (format) {
                record = candidates.find(r => r.format === format);
            }
            if (!record && candidates.length > 0) {
                record = candidates[0];
            }
        }

        if (!record) {
            return { success: false, error: 'Kein E-Rechnungs-Datensatz gefunden' };
        }

        const blob = new Blob([record.xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${record.format}_${record.invoiceNummer || record.invoiceId}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return { success: true };
    }

    /**
     * Download ZUGFeRD PDF for a given record.
     * @param {string} recordId - Record ID
     * @returns {{ success: boolean, error?: string }}
     */
    downloadZugferdPdf(recordId) {
        const record = this.generatedInvoices.find(r => r.id === recordId);
        if (!record || !record.pdfBytes) {
            return { success: false, error: 'Kein ZUGFeRD-PDF vorhanden' };
        }

        const bytes = new Uint8Array(record.pdfBytes);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ZUGFeRD_${record.invoiceNummer || record.invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return { success: true };
    }

    /**
     * Copy XML to clipboard.
     * @param {string} recordId - Record ID
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async copyXmlToClipboard(recordId) {
        const record = this.generatedInvoices.find(r => r.id === recordId);
        if (!record) {
            return { success: false, error: 'Datensatz nicht gefunden' };
        }

        try {
            await navigator.clipboard.writeText(record.xml);
            return { success: true };
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = record.xml;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return { success: true };
            } catch (e) {
                document.body.removeChild(textarea);
                return { success: false, error: 'Kopieren fehlgeschlagen' };
            }
        }
    }

    // ============================================
    // History & Record Management
    // ============================================

    /**
     * Get the complete e-invoice history, sorted newest first.
     * @returns {Array}
     */
    getEInvoiceHistory() {
        return this.generatedInvoices
            .map(r => ({
                id: r.id,
                invoiceId: r.invoiceId,
                invoiceNummer: r.invoiceNummer || r.invoiceId,
                format: r.format,
                version: r.version,
                profile: r.profile || null,
                leitwegId: r.leitwegId || null,
                createdAt: r.createdAt,
                status: r.status,
                hasPdf: !!(r.pdfBytes && r.pdfBytes.length > 0),
                validation: r.validation || null
            }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Get generated invoices (alias for backward compatibility).
     * @returns {Array}
     */
    getGeneratedInvoices() {
        return this.generatedInvoices.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    /**
     * Get a single e-invoice record by its ID.
     * @param {string} id - Record ID
     * @returns {Object|null}
     */
    getEInvoiceById(id) {
        return this.generatedInvoices.find(r => r.id === id) || null;
    }

    /**
     * Get all e-invoice records for a specific invoice.
     * @param {string} invoiceId - Invoice ID or nummer
     * @returns {Array}
     */
    getEInvoicesForInvoice(invoiceId) {
        return this.generatedInvoices.filter(r =>
            r.invoiceId === invoiceId || r.invoiceNummer === invoiceId
        );
    }

    /**
     * Delete an e-invoice record.
     * @param {string} id - Record ID
     * @returns {{ success: boolean, error?: string }}
     */
    deleteEInvoice(id) {
        const index = this.generatedInvoices.findIndex(r => r.id === id);
        if (index === -1) {
            return { success: false, error: 'Datensatz nicht gefunden' };
        }

        this.generatedInvoices.splice(index, 1);
        this._saveGenerated();

        return { success: true };
    }

    /**
     * Re-generate an e-invoice from the original invoice data.
     * @param {string} recordId - Existing record ID
     * @returns {Promise<{ success: boolean, newRecordId?: string, error?: string }>}
     */
    async regenerateEInvoice(recordId) {
        const oldRecord = this.getEInvoiceById(recordId);
        if (!oldRecord) {
            return { success: false, error: 'Datensatz nicht gefunden' };
        }

        // Find the original invoice in the store
        const rechnungen = window.storeService?.state?.rechnungen || [];
        const invoice = rechnungen.find(r =>
            r.id === oldRecord.invoiceId || r.nummer === oldRecord.invoiceNummer
        );

        if (!invoice) {
            return { success: false, error: 'Originalrechnung nicht gefunden' };
        }

        // Preserve Leitweg-ID
        if (oldRecord.leitwegId) {
            invoice.leitwegId = oldRecord.leitwegId;
        }

        // Delete old record
        this.deleteEInvoice(recordId);

        // Generate new one
        if (oldRecord.format === 'ZUGFeRD') {
            const result = await this.generateZugferd(invoice);
            return { success: true, newRecordId: result.recordId };
        } else {
            const result = this.generateXRechnung(invoice);
            return { success: true, newRecordId: result.recordId };
        }
    }

    // ============================================
    // Peppol Submission (Demo)
    // ============================================

    /**
     * Submit to Peppol network (demo/placeholder).
     * @param {string} recordId - Record ID
     * @returns {Promise<Object>}
     */
    async submitToPeppol(recordId) {
        const record = this.generatedInvoices.find(r => r.id === recordId);
        if (!record) {
            return { success: false, error: 'Record not found' };
        }

        // In production: Call Peppol access point API
        console.log('Peppol submission for', record.invoiceId);

        record.status = 'submitted';
        record.submittedAt = new Date().toISOString();
        record.peppolMessageId = 'peppol-' + Date.now();

        this._saveGenerated();

        return {
            success: true,
            method: 'demo',
            messageId: record.peppolMessageId,
            note: 'Peppol-Einreichung erfordert Access Point Integration'
        };
    }

    // ============================================
    // Helper Methods
    // ============================================

    /**
     * Add days to a date string and return ISO date.
     * @param {string} dateStr - ISO date string
     * @param {number} days - Number of days to add
     * @returns {string} ISO date string
     */
    addDays(dateStr, days) {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    /**
     * Calculate days between two date strings.
     * @param {string} from - Start date
     * @param {string} to - End date
     * @returns {number}
     */
    _daysBetween(from, to) {
        const d1 = new Date(from);
        const d2 = new Date(to);
        const diff = d2 - d1;
        return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
    }

    /**
     * Format a date for display (DD.MM.YYYY).
     * @param {string} dateStr - ISO date string
     * @returns {string}
     */
    formatDate(dateStr) {
        if (!dateStr) {return '';}
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {return dateStr;}
        return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    /**
     * Format currency for display.
     * @param {number} amount
     * @returns {string}
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    // ============================================
    // Persistence
    // ============================================

    _saveSettings() {
        localStorage.setItem('freyai_einvoice_settings', JSON.stringify(this.settings));
    }

    _saveGenerated() {
        localStorage.setItem('freyai_einvoice_generated', JSON.stringify(this.generatedInvoices));
    }

    // Legacy alias
    save() {
        this._saveGenerated();
    }
}

window.eInvoiceService = new EInvoiceService();
