/* ============================================
   E-Rechnung Service
   XRechnung 3.0.1 (UN/CEFACT CII Syntax) and
   ZUGFeRD 2.1.1 compliant electronic invoices
   for German B2G e-invoicing (legally required since 2025)
   EN 16931 compliant
   ============================================ */

class EInvoiceService {
    constructor() {
        // Default settings; can be overridden via this.settings.businessData
        this.settings = {
            businessData: null
        };
    }

    // ============================================
    // Company Data Helper
    // ============================================

    /**
     * Retrieve seller/company data from admin panel settings or fallback defaults.
     * @returns {Object} company fields
     */
    _getCompanyData() {
        // Try admin panel service
        if (window.adminPanelService && typeof window.adminPanelService.getBusinessSettings === 'function') {
            const bs = window.adminPanelService.getBusinessSettings();
            return {
                name:       bs.company_name    || 'FreyAI Visions',
                street:     bs.address_street  || 'Musterstraße 123',
                postalCode: bs.address_postal  || '63843',
                city:       bs.address_city    || 'Musterstadt',
                countryCode:'DE',
                taxNumber:  bs.tax_number      || '',
                vatId:      '',                // VAT-ID (USt-IdNr.) separate from Steuernummer
                iban:       bs.bank_iban       || '',
                bic:        bs.bank_bic        || '',
                bankName:   bs.bank_name       || '',
                email:      bs.company_email   || '',
                phone:      bs.company_phone   || ''
            };
        }

        // Try eInvoiceService.settings.businessData (set externally)
        if (this.settings.businessData) {
            const bd = this.settings.businessData;
            return {
                name:       bd.name       || 'FreyAI Visions',
                street:     bd.street     || 'Musterstraße 123',
                postalCode: bd.postalCode || '63843',
                city:       bd.city       || 'Musterstadt',
                countryCode:'DE',
                taxNumber:  bd.taxNumber  || '',
                vatId:      bd.vatId      || '',
                iban:       bd.iban       || '',
                bic:        bd.bic        || '',
                bankName:   bd.bankName   || '',
                email:      bd.email      || '',
                phone:      bd.phone      || ''
            };
        }

        // Absolute fallback
        return {
            name:        'FreyAI Visions',
            street:      'Musterstraße 123',
            postalCode:  '63843',
            city:        'Musterstadt',
            countryCode: 'DE',
            taxNumber:   '',
            vatId:       'DE123456789',
            iban:        'DE89370400440532013000',
            bic:         'COBADEFFXXX',
            bankName:    'Commerzbank',
            email:       'info@freyai-visions.de',
            phone:       '+49 6029 9922964'
        };
    }

    // ============================================
    // Map Invoice to EN 16931 / XRechnung Fields
    // ============================================

    /**
     * Map the app's invoice object to a normalized EN 16931 / XRechnung field set.
     * BT = Business Term as per EN 16931 / XRechnung specification.
     *
     * @param {Object} invoice - App invoice object from store.rechnungen
     * @param {string} [leitwegId] - Leitweg-ID for B2G routing (BT-10)
     * @returns {Object} Normalized invoice data for XML generation
     */
    mapInvoiceToXRechnung(invoice, leitwegId) {
        const company = this._getCompanyData();
        const now = new Date();

        // Determine invoice date
        const invoiceDate = invoice.datum
            ? new Date(invoice.datum)
            : (invoice.createdAt ? new Date(invoice.createdAt) : now);

        // Determine due date
        const dueDate = invoice.faelligkeitsdatum
            ? new Date(invoice.faelligkeitsdatum)
            : new Date(invoiceDate.getTime() + 14 * 24 * 60 * 60 * 1000);

        // Format date to YYYYMMDD for XRechnung
        const fmtDate = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}${m}${day}`;
        };

        // Line items (BG-25)
        const positionen = invoice.positionen || [];
        const lineItems = positionen.map((pos, idx) => {
            const qty    = parseFloat(pos.menge)  || 1;
            const price  = parseFloat(pos.preis)  || 0;
            const net    = qty * price;
            // VAT rate: default 19%, kleinunternehmer = 0%
            const vatRate = this._getVatRate();
            return {
                lineId:      String(idx + 1),               // BT-126
                name:        pos.beschreibung || `Position ${idx + 1}`, // BT-153
                quantity:    qty,                            // BT-129
                unitCode:    this._mapUnit(pos.einheit),    // BT-130 (UN/ECE rec 20)
                netPrice:    price,                         // BT-146 (net unit price)
                lineNet:     net,                           // BT-131
                vatCategory: vatRate > 0 ? 'S' : 'Z',      // BT-151 (S=Standard, Z=Zero)
                vatRate:     vatRate,                       // BT-152
                articleNum:  pos.artikelnummer || null      // BT-155
            };
        });

        // Totals
        const netto  = parseFloat(invoice.netto)  || 0;    // BT-106 (sum of line amounts)
        const mwst   = parseFloat(invoice.mwst)   || 0;    // BT-110 (VAT amount)
        const brutto = parseFloat(invoice.brutto) || 0;    // BT-112 (invoice total incl. VAT)

        // Buyer (Kunde)
        const kunde = invoice.kunde || {};
        const buyerName    = kunde.name    || 'Unbekannter Kunde';
        const buyerStreet  = kunde.adresse || kunde.strasse || '';
        const buyerCity    = kunde.ort     || kunde.city    || '';
        const buyerPostal  = kunde.plz     || kunde.postal  || '';
        const buyerCountry = 'DE';
        const buyerEmail   = kunde.email   || '';

        return {
            // Invoice identification
            invoiceNumber: invoice.id,                      // BT-1
            invoiceDate:   fmtDate(invoiceDate),            // BT-2
            dueDate:       fmtDate(dueDate),                // BT-9
            leitwegId:     leitwegId || '',                 // BT-10 (Buyer reference, required for B2G)
            invoiceTypeCode: '380',                         // BT-3 (380=Commercial invoice)
            currency: 'EUR',                                // BT-5

            // Seller (BG-4)
            sellerName:        company.name,                // BT-27
            sellerStreet:      company.street,              // BT-35
            sellerPostalCode:  company.postalCode,          // BT-38
            sellerCity:        company.city,                // BT-37
            sellerCountry:     company.countryCode,         // BT-40
            sellerTaxNumber:   company.taxNumber,           // BT-32 (Steuernummer)
            sellerVatId:       company.vatId,               // BT-31 (USt-IdNr.)
            sellerEmail:       company.email,               // BT-43

            // Buyer (BG-7)
            buyerName:         buyerName,                   // BT-44
            buyerStreet:       buyerStreet,                 // BT-50
            buyerPostalCode:   buyerPostal,                 // BT-53
            buyerCity:         buyerCity,                   // BT-52
            buyerCountry:      buyerCountry,                // BT-55
            buyerEmail:        buyerEmail,                  // BT-58

            // Payment (BG-16)
            iban:    (company.iban || '').replace(/\s/g, ''), // BT-84 (Payment account identifier)
            bic:     company.bic    || '',                    // BT-86
            bankName:company.bankName || '',                  // BT-85

            // Totals (BG-22)
            lineNetTotal:   netto,   // BT-106 (Sum of line amounts)
            taxBasisTotal:  netto,   // BT-116 (Invoice total amount without VAT)
            vatAmount:      mwst,    // BT-110
            grandTotal:     brutto,  // BT-112 (Invoice total amount with VAT)
            duePayable:     brutto,  // BT-115

            // VAT breakdown (BG-23)
            vatRate:    this._getVatRate(),
            vatCategory: this._getVatRate() > 0 ? 'S' : 'Z',

            // Line items
            lineItems
        };
    }

    /**
     * Get the applicable VAT rate (Mehrwertsteuersatz).
     * Checks for Kleinunternehmer exemption.
     * @returns {number} VAT rate as percentage (e.g. 19)
     */
    _getVatRate() {
        // Check Kleinunternehmer (§19 UStG) — no VAT
        if (window.adminPanelService) {
            const bs = window.adminPanelService.getBusinessSettings();
            if (bs.kleinunternehmer) {
                return 0;
            }
            return parseFloat(bs.default_vat_rate) || 19;
        }
        return 19;
    }

    /**
     * Map German unit labels to UN/ECE Recommendation 20 unit codes
     * as required by XRechnung (BT-130).
     * @param {string} einheit
     * @returns {string} UN/ECE unit code
     */
    _mapUnit(einheit) {
        const unitMap = {
            'Stk.':     'C62',  // piece
            'Stk':      'C62',
            'Stück':    'C62',
            'stk':      'C62',
            'h':        'HUR',  // hour
            'Std.':     'HUR',
            'Std':      'HUR',
            'Stunde':   'HUR',
            'Stunden':  'HUR',
            'm':        'MTR',  // metre
            'm²':       'MTK',  // square metre
            'm2':       'MTK',
            'm³':       'MTQ',  // cubic metre
            'm3':       'MTQ',
            'kg':       'KGM',  // kilogram
            'km':       'KMT',  // kilometre
            'l':        'LTR',  // litre
            'L':        'LTR',
            'pauschal': 'LS',   // lump sum
            'Pausch.':  'LS',
            'Pauschal': 'LS',
            'Tag':      'DAY',
            'Tage':     'DAY',
            '%':        'P1',   // percent
        };
        return unitMap[einheit] || 'C62'; // default: piece
    }

    /**
     * Escape XML special characters.
     * @param {string|number} val
     * @returns {string}
     */
    _escXml(val) {
        if (val === null || val === undefined) {return '';}
        return String(val)
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;')
            .replace(/'/g,  '&apos;');
    }

    /**
     * Format decimal number for XRechnung (2 decimal places, period separator).
     * @param {number} n
     * @returns {string}
     */
    _fmtNum(n) {
        return Number(n || 0).toFixed(2);
    }

    // ============================================
    // XRechnung 3.0.1 XML Generation
    // UN/CEFACT CII (Cross Industry Invoice) syntax
    // ============================================

    /**
     * Generate a complete XRechnung 3.0.1 XML string from an invoice object.
     * Uses the UN/CEFACT Cross Industry Invoice (CII) D16B syntax.
     *
     * @param {Object} invoice - App invoice object
     * @param {string} [leitwegId] - Leitweg-ID for B2G routing
     * @returns {string} XRechnung XML string
     */
    generateXRechnung(invoice, leitwegId) {
        const d = this.mapInvoiceToXRechnung(invoice, leitwegId);
        return this._buildXRechnungXml(d);
    }

    /**
     * Build the XRechnung XML from a mapped data object.
     * @param {Object} d - Output of mapInvoiceToXRechnung()
     * @returns {string} Complete XRechnung XML
     */
    _buildXRechnungXml(d) {
        const e = this._escXml.bind(this);
        const n = this._fmtNum.bind(this);

        // Build line items XML (BG-25)
        const lineItemsXml = d.lineItems.map(item => `
        <ram:IncludedSupplyChainTradeLineItem>
            <ram:AssociatedDocumentLineDocument>
                <ram:LineID>${e(item.lineId)}</ram:LineID>
            </ram:AssociatedDocumentLineDocument>
            <ram:SpecifiedTradeProduct>
                <ram:Name>${e(item.name)}</ram:Name>${item.articleNum ? `
                <ram:SellerAssignedID>${e(item.articleNum)}</ram:SellerAssignedID>` : ''}
            </ram:SpecifiedTradeProduct>
            <ram:SpecifiedLineTradeAgreement>
                <ram:NetPriceProductTradePrice>
                    <ram:ChargeAmount>${n(item.netPrice)}</ram:ChargeAmount>
                </ram:NetPriceProductTradePrice>
            </ram:SpecifiedLineTradeAgreement>
            <ram:SpecifiedLineTradeDelivery>
                <ram:BilledQuantity unitCode="${e(item.unitCode)}">${n(item.quantity)}</ram:BilledQuantity>
            </ram:SpecifiedLineTradeDelivery>
            <ram:SpecifiedLineTradeSettlement>
                <ram:ApplicableTradeTax>
                    <ram:TypeCode>VAT</ram:TypeCode>
                    <ram:CategoryCode>${e(item.vatCategory)}</ram:CategoryCode>
                    <ram:RateApplicablePercent>${n(item.vatRate)}</ram:RateApplicablePercent>
                </ram:ApplicableTradeTax>
                <ram:SpecifiedTradeSettlementLineMonetarySummation>
                    <ram:LineTotalAmount>${n(item.lineNet)}</ram:LineTotalAmount>
                </ram:SpecifiedTradeSettlementLineMonetarySummation>
            </ram:SpecifiedLineTradeSettlement>
        </ram:IncludedSupplyChainTradeLineItem>`).join('');

        // Build seller tax registration elements
        let sellerTaxXml = '';
        if (d.sellerVatId) {
            sellerTaxXml += `
            <ram:SpecifiedTaxRegistration>
                <ram:ID schemeID="VA">${e(d.sellerVatId)}</ram:ID>
            </ram:SpecifiedTaxRegistration>`;
        }
        if (d.sellerTaxNumber) {
            sellerTaxXml += `
            <ram:SpecifiedTaxRegistration>
                <ram:ID schemeID="FC">${e(d.sellerTaxNumber)}</ram:ID>
            </ram:SpecifiedTaxRegistration>`;
        }

        // Build payment means (BG-16) — credit transfer
        let paymentMeansXml = '';
        if (d.iban) {
            paymentMeansXml = `
            <ram:SpecifiedTradeSettlementPaymentMeans>
                <ram:TypeCode>58</ram:TypeCode>
                <ram:PayeePartyCreditorFinancialAccount>
                    <ram:IBANID>${e(d.iban)}</ram:IBANID>
                </ram:PayeePartyCreditorFinancialAccount>${d.bic ? `
                <ram:PayeeSpecifiedCreditorFinancialInstitution>
                    <ram:BICID>${e(d.bic)}</ram:BICID>
                </ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
            </ram:SpecifiedTradeSettlementPaymentMeans>`;
        }

        // Build VAT breakdown (BG-23)
        const vatBreakdownXml = `
            <ram:ApplicableTradeTax>
                <ram:CalculatedAmount>${n(d.vatAmount)}</ram:CalculatedAmount>
                <ram:TypeCode>VAT</ram:TypeCode>
                <ram:BasisAmount>${n(d.taxBasisTotal)}</ram:BasisAmount>
                <ram:CategoryCode>${e(d.vatCategory)}</ram:CategoryCode>
                <ram:RateApplicablePercent>${n(d.vatRate)}</ram:RateApplicablePercent>
            </ram:ApplicableTradeTax>`;

        // Build due date
        const dueDateXml = `
            <ram:SpecifiedTradePaymentTerms>
                <ram:DueDateDateTime>
                    <udt:DateTimeString format="102">${e(d.dueDate)}</udt:DateTimeString>
                </ram:DueDateDateTime>
            </ram:SpecifiedTradePaymentTerms>`;

        // Buyer reference (Leitweg-ID, BT-10) — required for B2G
        const buyerRefXml = d.leitwegId
            ? `<ram:BuyerReference>${e(d.leitwegId)}</ram:BuyerReference>`
            : '<!-- BT-10 BuyerReference (Leitweg-ID) not set - required for B2G -->';

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- XRechnung 3.0.1 - UN/CEFACT Cross Industry Invoice (CII) D16B -->
<!-- Generated by FreyAI Visions E-Rechnung Service -->
<!-- EN 16931 compliant | German B2G e-invoicing standard -->
<rsm:CrossIndustryInvoice
    xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
    xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
    xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
    xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

    <!-- ============================
         ExchangedDocumentContext
         Specifies the profile (XRechnung 3.0.1)
         ============================ -->
    <rsm:ExchangedDocumentContext>
        <ram:GuidelineSpecifiedDocumentContextParameter>
            <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</ram:ID>
        </ram:GuidelineSpecifiedDocumentContextParameter>
    </rsm:ExchangedDocumentContext>

    <!-- ============================
         ExchangedDocument
         Invoice header information
         ============================ -->
    <rsm:ExchangedDocument>
        <ram:ID>${e(d.invoiceNumber)}</ram:ID>
        <!-- BT-3: Invoice type code (380 = Commercial Invoice) -->
        <ram:TypeCode>${e(d.invoiceTypeCode)}</ram:TypeCode>
        <!-- BT-2: Invoice issue date -->
        <ram:IssueDateTime>
            <udt:DateTimeString format="102">${e(d.invoiceDate)}</udt:DateTimeString>
        </ram:IssueDateTime>
    </rsm:ExchangedDocument>

    <!-- ============================
         SupplyChainTradeTransaction
         Main trade/invoice data
         ============================ -->
    <rsm:SupplyChainTradeTransaction>

        <!-- ============================
             Line Items (BG-25)
             ============================ -->
        ${lineItemsXml}

        <!-- ============================
             HeaderTradeAgreement
             Seller, Buyer, references
             ============================ -->
        <ram:ApplicableHeaderTradeAgreement>

            <!-- BT-10: Buyer reference / Leitweg-ID (required for B2G) -->
            ${buyerRefXml}

            <!-- BG-4: Seller -->
            <ram:SellerTradeParty>
                <!-- BT-27: Seller name -->
                <ram:Name>${e(d.sellerName)}</ram:Name>
                <ram:PostalTradeAddress>
                    <!-- BT-35: Seller address line 1 -->
                    <ram:LineOne>${e(d.sellerStreet)}</ram:LineOne>
                    <!-- BT-38: Seller post code -->
                    <ram:PostcodeCode>${e(d.sellerPostalCode)}</ram:PostcodeCode>
                    <!-- BT-37: Seller city -->
                    <ram:CityName>${e(d.sellerCity)}</ram:CityName>
                    <!-- BT-40: Seller country code -->
                    <ram:CountryID>${e(d.sellerCountry)}</ram:CountryID>
                </ram:PostalTradeAddress>${d.sellerEmail ? `
                <ram:URIUniversalCommunication>
                    <ram:URIID schemeID="EM">${e(d.sellerEmail)}</ram:URIID>
                </ram:URIUniversalCommunication>` : ''}
                ${sellerTaxXml}
            </ram:SellerTradeParty>

            <!-- BG-7: Buyer -->
            <ram:BuyerTradeParty>
                <!-- BT-44: Buyer name -->
                <ram:Name>${e(d.buyerName)}</ram:Name>
                <ram:PostalTradeAddress>
                    <!-- BT-50: Buyer address line 1 -->
                    <ram:LineOne>${e(d.buyerStreet)}</ram:LineOne>
                    <!-- BT-53: Buyer post code -->
                    <ram:PostcodeCode>${e(d.buyerPostalCode)}</ram:PostcodeCode>
                    <!-- BT-52: Buyer city -->
                    <ram:CityName>${e(d.buyerCity)}</ram:CityName>
                    <!-- BT-55: Buyer country code -->
                    <ram:CountryID>${e(d.buyerCountry)}</ram:CountryID>
                </ram:PostalTradeAddress>${d.buyerEmail ? `
                <ram:URIUniversalCommunication>
                    <ram:URIID schemeID="EM">${e(d.buyerEmail)}</ram:URIID>
                </ram:URIUniversalCommunication>` : ''}
            </ram:BuyerTradeParty>

        </ram:ApplicableHeaderTradeAgreement>

        <!-- ============================
             HeaderTradeDelivery
             ============================ -->
        <ram:ApplicableHeaderTradeDelivery/>

        <!-- ============================
             HeaderTradeSettlement
             Payment, VAT, totals
             ============================ -->
        <ram:ApplicableHeaderTradeSettlement>

            <!-- BT-5: Invoice currency code -->
            <ram:InvoiceCurrencyCode>${e(d.currency)}</ram:InvoiceCurrencyCode>

            <!-- BG-16: Payment means (credit transfer, TypeCode 58) -->
            ${paymentMeansXml}

            <!-- BG-23: VAT breakdown -->
            ${vatBreakdownXml}

            <!-- BT-9/Payment terms and due date -->
            ${dueDateXml}

            <!-- BG-22: Document totals -->
            <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
                <!-- BT-106: Sum of invoice line net amounts -->
                <ram:LineTotalAmount>${n(d.lineNetTotal)}</ram:LineTotalAmount>
                <!-- BT-109: Invoice total amount without VAT -->
                <ram:TaxBasisTotalAmount>${n(d.taxBasisTotal)}</ram:TaxBasisTotalAmount>
                <!-- BT-110: Invoice total VAT amount -->
                <ram:TaxTotalAmount currencyID="${e(d.currency)}">${n(d.vatAmount)}</ram:TaxTotalAmount>
                <!-- BT-112: Invoice total amount with VAT -->
                <ram:GrandTotalAmount>${n(d.grandTotal)}</ram:GrandTotalAmount>
                <!-- BT-115: Amount due for payment -->
                <ram:DuePayableAmount>${n(d.duePayable)}</ram:DuePayableAmount>
            </ram:SpecifiedTradeSettlementHeaderMonetarySummation>

        </ram:ApplicableHeaderTradeSettlement>

    </rsm:SupplyChainTradeTransaction>

</rsm:CrossIndustryInvoice>`;

        return xml;
    }

    // ============================================
    // ZUGFeRD 2.1.1 XML Generation
    // Same CII syntax but with ZUGFeRD profile
    // suitable for embedding in PDF/A-3
    // ============================================

    /**
     * Generate ZUGFeRD 2.1.1 compatible XML.
     * Uses the same CII D16B syntax but the ZUGFeRD EN16931 profile identifier.
     * This XML can be embedded into a PDF/A-3 as file attachment.
     *
     * @param {Object} invoice - App invoice object
     * @param {string} [leitwegId] - Leitweg-ID for B2G routing
     * @returns {string} ZUGFeRD XML string
     */
    generateZugferdXml(invoice, leitwegId) {
        const d = this.mapInvoiceToXRechnung(invoice, leitwegId);

        // ZUGFeRD uses the same CII syntax but with its own profile URN
        // For ZUGFeRD 2.1.1 EN16931 (Comfort) profile
        const zugferdXml = this._buildXRechnungXml(d).replace(
            'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0',
            'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931'
        ).replace(
            '<!-- XRechnung 3.0.1 - UN/CEFACT Cross Industry Invoice (CII) D16B -->',
            '<!-- ZUGFeRD 2.1.1 / Factur-X EN16931 (Comfort) Profile - CII D16B -->'
        );

        return zugferdXml;
    }

    // ============================================
    // Validation
    // ============================================

    /**
     * Validate an XRechnung XML string against key EN 16931 / XRechnung rules.
     * This is a structural/content validation (not full schema validation).
     * Full validation requires the KoSIT Validator (server-side tool).
     *
     * @param {string} xml - XRechnung XML string
     * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
     */
    validateXRechnung(xml) {
        const errors   = [];
        const warnings = [];

        if (!xml || typeof xml !== 'string') {
            return { valid: false, errors: ['Kein XML vorhanden'], warnings };
        }

        // Check root element (CII namespace)
        if (!xml.includes('rsm:CrossIndustryInvoice')) {
            errors.push('Fehlendes Root-Element <rsm:CrossIndustryInvoice> (CII-Syntax erwartet)');
        }

        // Check XRechnung or ZUGFeRD profile URN
        const hasXRechnungProfile = xml.includes('urn:xoev-de:kosit:standard:xrechnung_3.0');
        const hasZugferdProfile   = xml.includes('urn:factur-x.eu:1p0:en16931') ||
                                     xml.includes('urn:cen.eu:en16931:2017');
        if (!hasXRechnungProfile && !hasZugferdProfile) {
            errors.push('Kein gültiger Profilbezeichner (XRechnung 3.0 oder ZUGFeRD/Factur-X EN16931)');
        }

        // BT-1: Invoice number
        if (!xml.includes('<ram:ID>') || xml.match(/<ram:ID>\s*<\/ram:ID>/)) {
            errors.push('BT-1: Rechnungsnummer fehlt oder ist leer');
        }

        // BT-2: Invoice date
        if (!/<udt:DateTimeString format="102">\d{8}<\/udt:DateTimeString>/.test(xml)) {
            errors.push('BT-2: Rechnungsdatum fehlt oder hat falsches Format (erwartet: YYYYMMDD)');
        }

        // BT-3: Invoice type code
        if (!xml.includes('<ram:TypeCode>380</ram:TypeCode>') &&
            !xml.includes('<ram:TypeCode>381</ram:TypeCode>') &&
            !xml.includes('<ram:TypeCode>389</ram:TypeCode>')) {
            warnings.push('BT-3: Unbekannter Rechnungstyp (380=Rechnung, 381=Gutschrift, 389=Selbstfakturierung)');
        }

        // BT-10: Buyer reference (Leitweg-ID) — required for XRechnung B2G
        if (hasXRechnungProfile && !xml.includes('<ram:BuyerReference>')) {
            errors.push('BT-10: Leitweg-ID (BuyerReference) fehlt — für XRechnung B2G zwingend erforderlich');
        } else if (hasXRechnungProfile && xml.includes('<ram:BuyerReference></ram:BuyerReference>')) {
            errors.push('BT-10: Leitweg-ID (BuyerReference) ist leer — für XRechnung B2G zwingend erforderlich');
        }

        // BT-27: Seller name
        if (!xml.includes('<ram:SellerTradeParty>')) {
            errors.push('BT-27: Verkäufer (SellerTradeParty) fehlt');
        }

        // BT-44: Buyer name
        if (!xml.includes('<ram:BuyerTradeParty>')) {
            errors.push('BT-44: Käufer (BuyerTradeParty) fehlt');
        }

        // BT-84: Payment account IBAN (required when payment type 58)
        if (xml.includes('<ram:TypeCode>58</ram:TypeCode>') &&
            !xml.includes('<ram:IBANID>')) {
            errors.push('BT-84: IBAN fehlt bei Zahlungsart "Überweisung" (TypeCode 58)');
        }

        // Check if IBAN is not empty when present
        if (xml.includes('<ram:IBANID></ram:IBANID>')) {
            warnings.push('BT-84: IBAN ist leer — Zahlungsinformationen unvollständig');
        }

        // BT-106: Line total amount
        if (!xml.includes('<ram:LineTotalAmount>')) {
            errors.push('BT-106: Summe der Rechnungspositionsbeträge (LineTotalAmount) fehlt');
        }

        // BT-110: VAT amount
        if (!xml.includes('<ram:TaxTotalAmount')) {
            errors.push('BT-110: Mehrwertsteuerbetrag (TaxTotalAmount) fehlt');
        }

        // BT-112: Grand total
        if (!xml.includes('<ram:GrandTotalAmount>')) {
            errors.push('BT-112: Rechnungsgesamtbetrag inkl. MwSt. (GrandTotalAmount) fehlt');
        }

        // BT-115: Due payable amount
        if (!xml.includes('<ram:DuePayableAmount>')) {
            errors.push('BT-115: Fälliger Zahlungsbetrag (DuePayableAmount) fehlt');
        }

        // Check for at least one line item
        if (!xml.includes('<ram:IncludedSupplyChainTradeLineItem>')) {
            errors.push('BG-25: Mindestens eine Rechnungsposition (LineItem) erforderlich');
        }

        // Currency
        if (!xml.includes('<ram:InvoiceCurrencyCode>')) {
            errors.push('BT-5: Währungscode (InvoiceCurrencyCode) fehlt');
        }

        // VAT breakdown
        if (!xml.includes('<ram:ApplicableTradeTax>')) {
            errors.push('BG-23: Mehrwertsteueraufschlüsselung (ApplicableTradeTax) fehlt');
        }

        // Seller tax registration
        const hasVatId      = xml.includes('schemeID="VA"');
        const hasTaxNumber  = xml.includes('schemeID="FC"');
        if (!hasVatId && !hasTaxNumber) {
            warnings.push('BT-31/BT-32: Weder USt-IdNr. (VA) noch Steuernummer (FC) angegeben — eines ist erforderlich');
        }

        return {
            valid:    errors.length === 0,
            errors,
            warnings
        };
    }

    // ============================================
    // Leitweg-ID (B2G routing)
    // ============================================

    /**
     * Prompt the user for a Leitweg-ID (required for B2G electronic invoices).
     * The Leitweg-ID is assigned by the government buyer and used for routing.
     *
     * Format examples:
     *   04011000-1234567890-06  (Bundesbehörde)
     *   991-12345678-06         (Landesbehörde)
     *
     * @returns {string|null} Leitweg-ID entered by user, or null if cancelled
     */
    promptLeitwegId() {
        const stored = localStorage.getItem('freyai_leitweg_id') || '';

        const input = window.prompt(
            'Leitweg-ID eingeben (BT-10 — Pflichtfeld für XRechnung B2G):\n\n' +
            'Die Leitweg-ID wird vom Auftraggeber (Behörde) mitgeteilt.\n' +
            'Beispiel: 04011000-1234567890-06 oder 991-12345678-06\n\n' +
            'Zuletzt verwendete ID wird für diese Sitzung gespeichert.',
            stored
        );

        if (input !== null && input.trim()) {
            localStorage.setItem('freyai_leitweg_id', input.trim());
        }

        return input !== null ? input.trim() : null;
    }

    // ============================================
    // Download
    // ============================================

    /**
     * Generate and trigger download of an XRechnung XML file.
     * Prompts for Leitweg-ID if not already stored.
     *
     * @param {Object} invoice - App invoice object from store.rechnungen
     */
    downloadXRechnung(invoice) {
        if (!invoice) {
            if (typeof window.showToast === 'function') {
                window.showToast('Keine Rechnung gefunden', 'error');
            } else {
                alert('Keine Rechnung gefunden');
            }
            return;
        }

        // Prompt for Leitweg-ID (B2G routing)
        const leitwegId = this.promptLeitwegId();
        if (leitwegId === null) {
            // User cancelled — optional: allow generating without Leitweg-ID for B2B
            if (!window.confirm(
                'Ohne Leitweg-ID ist die XRechnung nicht für B2G (Behörden) geeignet.\n\n' +
                'Trotzdem als XRechnung ohne Leitweg-ID herunterladen (z.B. für B2B)?'
            )) {
                return;
            }
        }

        try {
            const xml = this.generateXRechnung(invoice, leitwegId || '');

            // Validate before download
            const validation = this.validateXRechnung(xml);
            if (!validation.valid) {
                const errorList = validation.errors.join('\n• ');
                const proceed = window.confirm(
                    `XRechnung-Validierung: ${validation.errors.length} Fehler gefunden:\n\n` +
                    `• ${errorList}\n\n` +
                    'Trotzdem herunterladen?'
                );
                if (!proceed) {return;}
            } else if (validation.warnings.length > 0) {
                console.warn('XRechnung Warnungen:', validation.warnings);
            }

            // Create and trigger download
            const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');

            // File name: RE-2024-001_XRechnung.xml
            const fileName = `${(invoice.id || 'Rechnung').replace(/[^a-zA-Z0-9\-_]/g, '_')}_XRechnung.xml`;
            a.href     = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (typeof window.showToast === 'function') {
                window.showToast(`XRechnung ${fileName} heruntergeladen`, 'success');
            }

            // Log activity
            if (typeof window.addActivity === 'function') {
                window.addActivity('📄', `XRechnung heruntergeladen: ${invoice.id}`);
            }
        } catch (err) {
            console.error('XRechnung-Generierung fehlgeschlagen:', err);
            if (typeof window.showToast === 'function') {
                window.showToast('Fehler bei XRechnung-Erstellung: ' + err.message, 'error');
            } else {
                alert('Fehler bei XRechnung-Erstellung: ' + err.message);
            }
        }
    }

    /**
     * Convenience: download XRechnung for an invoice by its ID.
     * @param {string} invoiceId
     */
    downloadXRechnungById(invoiceId) {
        const store = window.store || (window.AppUtils && window.AppUtils.store);
        const invoice = (store && store.rechnungen || []).find(r => r.id === invoiceId);
        if (!invoice) {
            if (typeof window.showToast === 'function') {
                window.showToast(`Rechnung ${invoiceId} nicht gefunden`, 'error');
            }
            return;
        }
        this.downloadXRechnung(invoice);
    }
}

// ============================================
// Singleton instance
// ============================================
window.eInvoiceService = new EInvoiceService();
