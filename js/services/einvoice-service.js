/* ============================================
   E-Rechnung Service (XRechnung / ZUGFeRD)
   Generate legally compliant electronic invoices
   ============================================ */

class EInvoiceService {
    constructor() {
        this.settings = JSON.parse(localStorage.getItem('mhs_einvoice_settings') || '{}');
        this.generatedInvoices = JSON.parse(localStorage.getItem('mhs_einvoice_generated') || '[]');

        // Default business data
        if (!this.settings.businessData) {
            this.settings.businessData = {
                name: 'MHS Metallbau Hydraulik Service',
                street: 'Musterstraße 123',
                city: 'Musterstadt',
                postalCode: '63843',
                country: 'DE',
                vatId: 'DE123456789',
                email: 'info@mhs-service.de',
                phone: '+49 6029 9922964',
                iban: 'DE89 3704 0044 0532 0130 00',
                bic: 'COBADEFFXXX',
                bankName: 'Commerzbank'
            };
        }
    }

    // Generate XRechnung XML
    generateXRechnung(invoice) {
        const xml = this.buildXRechnungXml(invoice);

        const record = {
            id: 'xr-' + Date.now(),
            invoiceId: invoice.id || invoice.nummer,
            format: 'XRechnung',
            version: '3.0.1',
            xml: xml,
            leitwegId: invoice.leitwegId || null,
            createdAt: new Date().toISOString(),
            status: 'generated'
        };

        this.generatedInvoices.push(record);
        this.save();

        return {
            success: true,
            xml: xml,
            recordId: record.id
        };
    }

    // Build XRechnung XML structure (UBL 2.1)
    buildXRechnungXml(invoice) {
        const bd = this.settings.businessData;
        const kunde = invoice.kunde || {};
        const positionen = invoice.positionen || [];

        // Calculate totals
        const nettoTotal = positionen.reduce((sum, p) => sum + (p.menge * p.einzelpreis), 0);
        const ustSatz = 0.19;
        const ustBetrag = nettoTotal * ustSatz;
        const bruttoTotal = nettoTotal + ustBetrag;

        const invoiceDate = invoice.datum || new Date().toISOString().split('T')[0];
        const dueDate = invoice.faelligkeitsdatum || this.addDays(invoiceDate, 14);

        return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    
    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
    <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
    
    <cbc:ID>${invoice.nummer || invoice.id}</cbc:ID>
    <cbc:IssueDate>${invoiceDate}</cbc:IssueDate>
    <cbc:DueDate>${dueDate}</cbc:DueDate>
    <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
    ${invoice.leitwegId ? `<cbc:BuyerReference>${invoice.leitwegId}</cbc:BuyerReference>` : ''}
    
    <!-- Seller (Verkäufer) -->
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>${bd.name}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${bd.street}</cbc:StreetName>
                <cbc:CityName>${bd.city}</cbc:CityName>
                <cbc:PostalZone>${bd.postalCode}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${bd.country}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${bd.vatId}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:Contact>
                <cbc:Telephone>${bd.phone}</cbc:Telephone>
                <cbc:ElectronicMail>${bd.email}</cbc:ElectronicMail>
            </cac:Contact>
        </cac:Party>
    </cac:AccountingSupplierParty>
    
    <!-- Buyer (Käufer) -->
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>${kunde.firma || kunde.name}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${kunde.strasse || 'N/A'}</cbc:StreetName>
                <cbc:CityName>${kunde.ort || 'N/A'}</cbc:CityName>
                <cbc:PostalZone>${kunde.plz || '00000'}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>DE</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            ${kunde.ustId ? `
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${kunde.ustId}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>` : ''}
            <cac:Contact>
                <cbc:ElectronicMail>${kunde.email || ''}</cbc:ElectronicMail>
            </cac:Contact>
        </cac:Party>
    </cac:AccountingCustomerParty>
    
    <!-- Payment Means -->
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
        <cac:PayeeFinancialAccount>
            <cbc:ID>${bd.iban.replace(/\s/g, '')}</cbc:ID>
            <cbc:Name>${bd.name}</cbc:Name>
            <cac:FinancialInstitutionBranch>
                <cbc:ID>${bd.bic}</cbc:ID>
            </cac:FinancialInstitutionBranch>
        </cac:PayeeFinancialAccount>
    </cac:PaymentMeans>
    
    <!-- Tax Total -->
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="EUR">${ustBetrag.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="EUR">${nettoTotal.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="EUR">${ustBetrag.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>19</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    
    <!-- Legal Monetary Total -->
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="EUR">${nettoTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="EUR">${nettoTotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="EUR">${bruttoTotal.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="EUR">${bruttoTotal.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    
    <!-- Invoice Lines -->
${positionen.map((pos, i) => `
    <cac:InvoiceLine>
        <cbc:ID>${i + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="C62">${pos.menge}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="EUR">${(pos.menge * pos.einzelpreis).toFixed(2)}</cbc:LineExtensionAmount>
        <cac:Item>
            <cbc:Description>${pos.beschreibung || pos.name}</cbc:Description>
            <cbc:Name>${pos.name || pos.beschreibung}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>19</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="EUR">${pos.einzelpreis.toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`).join('')}
    
</ubl:Invoice>`;
    }

    // Generate ZUGFeRD PDF with embedded XML
    async generateZugferd(invoice) {
        // Note: Full ZUGFeRD requires PDF library (pdf-lib) + XML embedding
        // This creates the XML portion

        const xml = this.buildZugferdXml(invoice);

        const record = {
            id: 'zf-' + Date.now(),
            invoiceId: invoice.id || invoice.nummer,
            format: 'ZUGFeRD',
            version: '2.1.1',
            profile: 'EXTENDED',
            xml: xml,
            createdAt: new Date().toISOString(),
            status: 'xml_generated' // Would be 'pdf_generated' with actual PDF
        };

        this.generatedInvoices.push(record);
        this.save();

        return {
            success: true,
            xml: xml,
            recordId: record.id,
            note: 'PDF-Einbettung erfordert pdf-lib Integration'
        };
    }

    // Build ZUGFeRD XML (Factur-X / Cross Industry Invoice)
    buildZugferdXml(invoice) {
        const bd = this.settings.businessData;
        const kunde = invoice.kunde || {};
        const positionen = invoice.positionen || [];

        const nettoTotal = positionen.reduce((sum, p) => sum + (p.menge * p.einzelpreis), 0);
        const ustBetrag = nettoTotal * 0.19;
        const bruttoTotal = nettoTotal + ustBetrag;

        return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
                          xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
                          xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
                          xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
    
    <rsm:ExchangedDocumentContext>
        <ram:GuidelineSpecifiedDocumentContextParameter>
            <ram:ID>urn:factur-x.eu:1p0:extended</ram:ID>
        </ram:GuidelineSpecifiedDocumentContextParameter>
    </rsm:ExchangedDocumentContext>
    
    <rsm:ExchangedDocument>
        <ram:ID>${invoice.nummer || invoice.id}</ram:ID>
        <ram:TypeCode>380</ram:TypeCode>
        <ram:IssueDateTime>
            <udt:DateTimeString format="102">${(invoice.datum || new Date().toISOString().split('T')[0]).replace(/-/g, '')}</udt:DateTimeString>
        </ram:IssueDateTime>
    </rsm:ExchangedDocument>
    
    <rsm:SupplyChainTradeTransaction>
        <ram:ApplicableHeaderTradeAgreement>
            <ram:SellerTradeParty>
                <ram:Name>${bd.name}</ram:Name>
                <ram:PostalTradeAddress>
                    <ram:PostcodeCode>${bd.postalCode}</ram:PostcodeCode>
                    <ram:LineOne>${bd.street}</ram:LineOne>
                    <ram:CityName>${bd.city}</ram:CityName>
                    <ram:CountryID>${bd.country}</ram:CountryID>
                </ram:PostalTradeAddress>
                <ram:SpecifiedTaxRegistration>
                    <ram:ID schemeID="VA">${bd.vatId}</ram:ID>
                </ram:SpecifiedTaxRegistration>
            </ram:SellerTradeParty>
            
            <ram:BuyerTradeParty>
                <ram:Name>${kunde.firma || kunde.name}</ram:Name>
                <ram:PostalTradeAddress>
                    <ram:PostcodeCode>${kunde.plz || ''}</ram:PostcodeCode>
                    <ram:LineOne>${kunde.strasse || ''}</ram:LineOne>
                    <ram:CityName>${kunde.ort || ''}</ram:CityName>
                    <ram:CountryID>DE</ram:CountryID>
                </ram:PostalTradeAddress>
            </ram:BuyerTradeParty>
        </ram:ApplicableHeaderTradeAgreement>
        
        <ram:ApplicableHeaderTradeSettlement>
            <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
            
            <ram:SpecifiedTradePaymentTerms>
                <ram:DueDateDateTime>
                    <udt:DateTimeString format="102">${this.addDays(invoice.datum || new Date().toISOString().split('T')[0], 14).replace(/-/g, '')}</udt:DateTimeString>
                </ram:DueDateDateTime>
            </ram:SpecifiedTradePaymentTerms>
            
            <ram:ApplicableTradeTax>
                <ram:CalculatedAmount>${ustBetrag.toFixed(2)}</ram:CalculatedAmount>
                <ram:TypeCode>VAT</ram:TypeCode>
                <ram:BasisAmount>${nettoTotal.toFixed(2)}</ram:BasisAmount>
                <ram:CategoryCode>S</ram:CategoryCode>
                <ram:RateApplicablePercent>19</ram:RateApplicablePercent>
            </ram:ApplicableTradeTax>
            
            <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
                <ram:LineTotalAmount>${nettoTotal.toFixed(2)}</ram:LineTotalAmount>
                <ram:TaxBasisTotalAmount>${nettoTotal.toFixed(2)}</ram:TaxBasisTotalAmount>
                <ram:TaxTotalAmount currencyID="EUR">${ustBetrag.toFixed(2)}</ram:TaxTotalAmount>
                <ram:GrandTotalAmount>${bruttoTotal.toFixed(2)}</ram:GrandTotalAmount>
                <ram:DuePayableAmount>${bruttoTotal.toFixed(2)}</ram:DuePayableAmount>
            </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        </ram:ApplicableHeaderTradeSettlement>
${positionen.map((pos, i) => `
        <ram:IncludedSupplyChainTradeLineItem>
            <ram:AssociatedDocumentLineDocument>
                <ram:LineID>${i + 1}</ram:LineID>
            </ram:AssociatedDocumentLineDocument>
            <ram:SpecifiedTradeProduct>
                <ram:Name>${pos.name || pos.beschreibung}</ram:Name>
            </ram:SpecifiedTradeProduct>
            <ram:SpecifiedLineTradeAgreement>
                <ram:NetPriceProductTradePrice>
                    <ram:ChargeAmount>${pos.einzelpreis.toFixed(2)}</ram:ChargeAmount>
                </ram:NetPriceProductTradePrice>
            </ram:SpecifiedLineTradeAgreement>
            <ram:SpecifiedLineTradeDelivery>
                <ram:BilledQuantity unitCode="C62">${pos.menge}</ram:BilledQuantity>
            </ram:SpecifiedLineTradeDelivery>
            <ram:SpecifiedLineTradeSettlement>
                <ram:ApplicableTradeTax>
                    <ram:TypeCode>VAT</ram:TypeCode>
                    <ram:CategoryCode>S</ram:CategoryCode>
                    <ram:RateApplicablePercent>19</ram:RateApplicablePercent>
                </ram:ApplicableTradeTax>
                <ram:SpecifiedTradeSettlementLineMonetarySummation>
                    <ram:LineTotalAmount>${(pos.menge * pos.einzelpreis).toFixed(2)}</ram:LineTotalAmount>
                </ram:SpecifiedTradeSettlementLineMonetarySummation>
            </ram:SpecifiedLineTradeSettlement>
        </ram:IncludedSupplyChainTradeLineItem>`).join('')}
    </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
    }

    // Validate XML against XRechnung schema
    validateXml(xml) {
        // Basic validation (full validation requires KOSIT validator)
        const errors = [];

        if (!xml.includes('CustomizationID')) {
            errors.push('Missing CustomizationID');
        }
        if (!xml.includes('AccountingSupplierParty')) {
            errors.push('Missing seller information');
        }
        if (!xml.includes('AccountingCustomerParty')) {
            errors.push('Missing buyer information');
        }
        if (!xml.includes('LegalMonetaryTotal')) {
            errors.push('Missing totals');
        }
        if (!xml.includes('InvoiceLine')) {
            errors.push('No invoice lines');
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            note: 'Vollständige Validierung mit KOSIT Validator empfohlen'
        };
    }

    // Download XML file
    downloadXml(recordId) {
        const record = this.generatedInvoices.find(r => r.id === recordId);
        if (!record) {return { success: false, error: 'Record not found' };}

        const blob = new Blob([record.xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${record.format}_${record.invoiceId}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return { success: true };
    }

    // Submit to Peppol (demo)
    async submitToPeppol(recordId) {
        const record = this.generatedInvoices.find(r => r.id === recordId);
        if (!record) {return { success: false, error: 'Record not found' };}

        // In production: Call Peppol access point API
        console.log(`📤 Peppol submission for ${record.invoiceId}`);

        record.status = 'submitted';
        record.submittedAt = new Date().toISOString();
        record.peppolMessageId = 'peppol-' + Date.now();

        this.save();

        return {
            success: true,
            method: 'demo',
            messageId: record.peppolMessageId,
            note: 'Peppol-Einreichung erfordert Access Point Integration'
        };
    }

    // Get generated invoices
    getGeneratedInvoices() {
        return this.generatedInvoices.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    // Helper: Add days to date
    addDays(dateStr, days) {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    // Update business data
    updateBusinessData(data) {
        this.settings.businessData = { ...this.settings.businessData, ...data };
        localStorage.setItem('mhs_einvoice_settings', JSON.stringify(this.settings));
    }

    // Persistence
    save() {
        localStorage.setItem('mhs_einvoice_generated', JSON.stringify(this.generatedInvoices));
    }
}

window.eInvoiceService = new EInvoiceService();
