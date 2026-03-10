/* ============================================
   PDF Generation Service
   Professional PDF export for invoices, quotes & dunning
   Uses jsPDF (loaded via CDN)
   ============================================ */

class PDFService {
    constructor() {
        this.loaded = false;
        this.logoBase64 = null;
        this.logoLoaded = false;
        this.margin = { top: 20, left: 20, right: 20, bottom: 25 };
        this.pageWidth = 210; // A4 mm
        this.contentWidth = 170; // 210 - 20 - 20
    }

    async ensureLoaded() {
        if (this.loaded && window.jspdf) {return;}
        await new Promise((resolve, reject) => {
            if (window.jspdf) { this.loaded = true; resolve(); return; }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.integrity = 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk';
            script.crossOrigin = 'anonymous';
            script.onload = () => { this.loaded = true; resolve(); };
            script.onerror = () => reject(new Error('jsPDF konnte nicht geladen werden'));
            document.head.appendChild(script);
        });
        await this.loadLogo();
    }

    async loadLogo() {
        if (this.logoLoaded) {return;}
        // Try localStorage first (base64)
        const stored = localStorage.getItem('company_logo');
        if (stored) {
            this.logoBase64 = stored.startsWith('data:') ? stored : `data:image/png;base64,${stored}`;
            this.logoLoaded = true;
            return;
        }
        // Fetch from img/logo.png
        try {
            const resp = await fetch('img/logo.png');
            if (!resp.ok) {throw new Error('Logo not found');}
            const blob = await resp.blob();
            this.logoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            this.logoLoaded = true;
        } catch (e) {
            console.warn('Logo konnte nicht geladen werden:', e.message);
            this.logoLoaded = true; // Don't retry
        }
    }

    // --- Shared PDF helpers ---

    createDoc() {
        const { jsPDF } = window.jspdf;
        return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    }

    getSettings() {
        const store = window.storeService?.state?.settings || {};
        const ap = StorageUtils.getJSON('freyai_admin_settings', {}, { service: 'pdfService' });
        // Also check individual localStorage keys (setup wizard stores them directly)
        const ls = (key) => localStorage.getItem(key) || '';
        return {
            companyName: ap.company_name || store.companyName || ls('company_name') || 'FreyAI Visions',
            owner: ap.owner_name || store.owner || ls('owner_name') || '',
            address: ap.address_street
                ? `${ap.address_street}, ${ap.address_postal || ''} ${ap.address_city || ''}`.trim()
                : (store.address || (ls('address_street') ? `${ls('address_street')}, ${ls('address_postal')} ${ls('address_city')}`.trim() : '')),
            taxId: ap.tax_number || store.taxId || ls('tax_number') || '',
            vatId: ap.vat_id || store.vatId || '',
            phone: ap.company_phone || store.phone || ls('company_phone') || '',
            email: ap.company_email || store.email || ls('company_email') || '',
            iban: ap.bank_iban || store.iban || ls('bank_iban') || ls('iban') || '',
            bic: ap.bank_bic || store.bic || ls('bank_bic') || ls('bic') || '',
            bank: ap.bank_name || store.bank || ls('bank_name') || '',
            kleinunternehmer: ap.kleinunternehmer || store.kleinunternehmer || false,
            taxRate: parseFloat(ap.tax_rate || store.taxRate || '19')
        };
    }

    drawHeader(doc, title, docNumber) {
        const s = this.getSettings();
        const m = this.margin;
        const logoSize = 16; // mm
        let textLeft = m.left;

        // Logo
        if (this.logoBase64) {
            try {
                // Detect image format from data URI
                let fmt = 'PNG';
                if (this.logoBase64.startsWith('data:image/jpeg') || this.logoBase64.startsWith('data:image/jpg')) {
                    fmt = 'JPEG';
                } else if (this.logoBase64.startsWith('data:image/webp')) {
                    fmt = 'WEBP';
                }
                doc.addImage(this.logoBase64, fmt, m.left, m.top, logoSize, logoSize);
                textLeft = m.left + logoSize + 4;
            } catch (e) {
                console.warn('Logo konnte nicht ins PDF eingefügt werden:', e.message);
            }
        }

        // Company name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(s.companyName, textLeft, m.top + 8);

        // Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`${s.address} · Tel: ${s.phone}`, textLeft, m.top + 14);

        // Document type + number (right-aligned)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(title, this.pageWidth - m.right, m.top + 8, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(docNumber, this.pageWidth - m.right, m.top + 14, { align: 'right' });

        // Separator line
        doc.setDrawColor(45, 212, 168); // FreyAI Visions teal accent
        doc.setLineWidth(0.8);
        doc.line(m.left, m.top + 18, this.pageWidth - m.right, m.top + 18);

        return m.top + 24;
    }

    drawAddresses(doc, y, kunde, settings) {
        const m = this.margin;
        const s = settings || this.getSettings();

        // Absender (small line above)
        doc.setFontSize(7);
        doc.setTextColor(130);
        doc.text(`${s.companyName} · ${s.address}`, m.left, y);
        doc.setTextColor(0);

        // Empfänger
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(kunde.name || 'Unbekannt', m.left, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        let addrY = y + 11;
        if (kunde.firma) { doc.text(kunde.firma, m.left, addrY); addrY += 5; }
        if (kunde.adresse || kunde.strasse) { doc.text(kunde.adresse || kunde.strasse || '', m.left, addrY); addrY += 5; }
        if (kunde.plz || kunde.ort) { doc.text(`${kunde.plz || ''} ${kunde.ort || ''}`.trim(), m.left, addrY); addrY += 5; }
        if (kunde.email) { doc.text(kunde.email, m.left, addrY); addrY += 5; }
        if (kunde.telefon) { doc.text(`Tel: ${kunde.telefon}`, m.left, addrY); addrY += 5; }

        return Math.max(addrY + 4, y + 32);
    }

    drawTable(doc, y, headers, rows, colWidths) {
        const m = this.margin;
        const rowHeight = 7;

        // Table header
        doc.setFillColor(240, 240, 245);
        doc.rect(m.left, y, this.contentWidth, rowHeight, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);

        let x = m.left + 2;
        headers.forEach((header, i) => {
            const align = header.align || 'left';
            const textX = align === 'right' ? x + colWidths[i] - 2 : x;
            doc.text(header.label, textX, y + 5, { align });
            x += colWidths[i];
        });

        y += rowHeight;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        // Table rows
        rows.forEach((row, rowIdx) => {
            // Check if we need a new page
            if (y > 260) {
                doc.addPage();
                y = this.margin.top + 10;
            }

            // Section header row
            if (row.isSection) {
                y += 2;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.setDrawColor(150);
                doc.line(m.left, y + 5.5, m.left + this.contentWidth, y + 5.5);
                doc.text(row.label, m.left + 2, y + 4);
                doc.setFont('helvetica', 'normal');
                y += rowHeight + 1;
                return;
            }

            // Zebra striping
            if (rowIdx % 2 === 0) {
                doc.setFillColor(250, 250, 252);
                doc.rect(m.left, y, this.contentWidth, rowHeight, 'F');
            }

            x = m.left + 2;
            row.cells.forEach((cell, i) => {
                const align = headers[i]?.align || 'left';
                const textX = align === 'right' ? x + colWidths[i] - 2 : x;
                const text = String(cell ?? '');
                // Truncate long text
                const maxChars = Math.floor(colWidths[i] / 2);
                const display = text.length > maxChars ? text.substring(0, maxChars - 1) + '…' : text;
                doc.text(display, textX, y + 5, { align });
                x += colWidths[i];
            });
            y += rowHeight;
        });

        // Bottom border
        doc.setDrawColor(200);
        doc.line(m.left, y, m.left + this.contentWidth, y);

        return y + 4;
    }

    drawTotals(doc, y, lines) {
        const rightCol = this.pageWidth - this.margin.right;
        const labelX = rightCol - 70;

        lines.forEach(line => {
            if (line.bold) {
                doc.setFont('helvetica', 'bold');
                doc.setDrawColor(0);
                doc.line(labelX, y - 1, rightCol, y - 1);
            } else {
                doc.setFont('helvetica', 'normal');
            }
            doc.setFontSize(line.bold ? 11 : 10);
            doc.text(line.label, labelX, y + 4);
            doc.text(line.value, rightCol, y + 4, { align: 'right' });
            y += line.bold ? 8 : 6;
        });

        return y + 4;
    }

    drawFooter(doc) {
        const s = this.getSettings();
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(200);
            doc.line(this.margin.left, 280, this.pageWidth - this.margin.right, 280);
            doc.setFontSize(7);
            doc.setTextColor(130);
            doc.text(
                `${s.companyName} · ${s.address} · St.-Nr. ${s.taxId} · USt-IdNr. ${s.vatId}`,
                this.pageWidth / 2, 284, { align: 'center' }
            );
            doc.text(
                `${s.bank} · IBAN: ${s.iban}${s.bic ? ' · BIC: ' + s.bic : ''} · Seite ${i}/${pageCount}`,
                this.pageWidth / 2, 288, { align: 'center' }
            );
            doc.setTextColor(0);
        }
    }

    fmtCurrency(amount) {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0);
    }

    fmtDate(dateStr) {
        if (!dateStr) {return '-';}
        return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    // ============================================
    // Rechnung (Invoice) PDF
    // ============================================
    async generateRechnung(rechnung) {
        if (!rechnung?.kunde) {
            console.error('Rechnung oder Kundendaten fehlen');
            return false;
        }
        await this.ensureLoaded();
        const doc = this.createDoc();

        let y = this.drawHeader(doc, 'Rechnung', rechnung.id);
        y = this.drawAddresses(doc, y, rechnung.kunde);

        // Meta info
        doc.setFontSize(10);
        doc.text(`Rechnungsdatum: ${this.fmtDate(rechnung.createdAt)}`, this.margin.left, y);
        doc.text(`Leistungsart: ${window.getLeistungsartLabel?.(rechnung.leistungsart) || rechnung.leistungsart || '-'}`,
            this.margin.left, y + 5);
        if (rechnung.auftragId) {
            doc.text(`Auftrags-Nr.: ${rechnung.auftragId}`, this.pageWidth - this.margin.right, y, { align: 'right' });
        }
        y += 14;

        // Position table
        const headers = [
            { label: 'Pos.', align: 'left' },
            { label: 'Beschreibung', align: 'left' },
            { label: 'Menge', align: 'right' },
            { label: 'Einzelpreis', align: 'right' },
            { label: 'Gesamt', align: 'right' }
        ];
        const colWidths = [12, 86, 22, 25, 25];

        const leistungen = (rechnung.positionen || []).filter(p => !p.isMaterial);
        const materialien = (rechnung.positionen || []).filter(p => p.isMaterial);

        const rows = [];
        let pos = 0;

        leistungen.forEach(p => {
            pos++;
            rows.push({ cells: [pos, p.beschreibung, `${p.menge} ${p.einheit}`, this.fmtCurrency(p.preis), this.fmtCurrency((p.menge || 0) * (p.preis || 0))] });
        });

        if (materialien.length > 0) {
            rows.push({ isSection: true, label: 'Materialien / Stückliste' });
            materialien.forEach(p => {
                pos++;
                const desc = p.artikelnummer ? `${p.beschreibung} (${p.artikelnummer})` : p.beschreibung;
                rows.push({ cells: [pos, desc, `${p.menge} ${p.einheit}`, this.fmtCurrency(p.preis), this.fmtCurrency((p.menge || 0) * (p.preis || 0))] });
            });
        }

        // Legacy fallback for old invoices
        if (materialien.length === 0 && rechnung.materialKosten > 0) {
            pos++;
            rows.push({ cells: [pos, 'Materialkosten', '1 pauschal', this.fmtCurrency(rechnung.materialKosten), this.fmtCurrency(rechnung.materialKosten)] });
        }

        y = this.drawTable(doc, y, headers, rows, colWidths);

        // Totals
        const pdfSettings = this.getSettings();
        const totalsRows = [
            { label: 'Nettobetrag:', value: this.fmtCurrency(rechnung.netto) },
        ];
        if (pdfSettings.kleinunternehmer) {
            totalsRows.push({ label: 'Gem. §19 UStG keine MwSt.', value: '—' });
        } else {
            totalsRows.push({ label: `MwSt. ${pdfSettings.taxRate}%:`, value: this.fmtCurrency(rechnung.mwst) });
        }
        totalsRows.push({ label: 'Gesamtbetrag:', value: this.fmtCurrency(rechnung.brutto), bold: true });
        y = this.drawTotals(doc, y, totalsRows);

        // Material margin info (internal - only shown if stueckliste exists)
        if (rechnung.stueckliste?.length > 0) {
            doc.setFontSize(8);
            doc.setTextColor(130);
            doc.text(`Materialmarge: EK ${this.fmtCurrency(rechnung.stuecklisteEK)} · VK ${this.fmtCurrency(rechnung.stuecklisteVK)} · Marge ${this.fmtCurrency((rechnung.stuecklisteVK || 0) - (rechnung.stuecklisteEK || 0))}`,
                this.margin.left, y);
            doc.setTextColor(0);
            y += 6;
        }

        // Payment info + EPC QR Code
        const s = this.getSettings();
        y += 4;

        // Check if we need a new page for payment section + QR code
        if (y > 220) {
            doc.addPage();
            y = this.margin.top + 10;
        }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Zahlungsbedingungen:', this.margin.left, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Zahlbar innerhalb von 14 Tagen ohne Abzug.`, this.margin.left, y + 5);
        doc.text(`Bankverbindung: ${s.bank} · IBAN: ${s.iban}`, this.margin.left, y + 10);

        // EPC QR Code (GiroCode) for instant SEPA payment
        const qrY = y;
        try {
            if (window.epcQrService && s.iban && rechnung.brutto > 0) {
                const qrDataUrl = window.epcQrService.generateEpcQrCode({
                    brutto: rechnung.brutto,
                    nummer: rechnung.id || rechnung.nummer
                }, {
                    iban: s.iban,
                    bic: s.bic,
                    recipientName: s.companyName,
                    bank: s.bank
                });

                const qrSize = 30; // mm
                const qrX = this.pageWidth - this.margin.right - qrSize;
                doc.addImage(qrDataUrl, 'PNG', qrX, qrY - 2, qrSize, qrSize);

                // Label under QR code
                doc.setFontSize(7);
                doc.setTextColor(130);
                doc.text('GiroCode scannen', qrX + qrSize / 2, qrY + qrSize + 2, { align: 'center' });
                doc.text('zum Bezahlen', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });
                doc.setTextColor(0);
            }
        } catch (e) {
            console.warn('EPC QR Code konnte nicht generiert werden:', e.message);
            // Continue without QR code — non-critical
        }

        // Notes
        if (rechnung.notizen) {
            y += 18;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Bemerkungen:', this.margin.left, y);
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(rechnung.notizen, this.contentWidth - 40);
            doc.text(lines, this.margin.left, y + 5);
        }

        this.drawFooter(doc);

        doc.save(`Rechnung_${rechnung.id}.pdf`);
        return true;
    }

    // ============================================
    // Angebot (Quote) PDF — Industrial Luxury Edition
    // ============================================

    // --- Angebot-specific drawing helpers ---

    _angebotCheckPageBreak(doc, y, needed) {
        if (y + needed > 270) {
            doc.addPage();
            return this.margin.top + 10;
        }
        return y;
    }

    _angebotDrawHeaderBand(doc, angebot) {
        const m = this.margin;
        const pw = this.pageWidth;

        // Full-width dark header band
        doc.setFillColor(24, 24, 27); // #18181b
        doc.rect(0, 0, pw, 38, 'F');

        let textLeft = m.left;

        // Logo (left side)
        if (this.logoBase64) {
            try {
                let fmt = 'PNG';
                if (this.logoBase64.startsWith('data:image/jpeg') || this.logoBase64.startsWith('data:image/jpg')) {
                    fmt = 'JPEG';
                } else if (this.logoBase64.startsWith('data:image/webp')) {
                    fmt = 'WEBP';
                }
                doc.addImage(this.logoBase64, fmt, m.left, 8, 20, 20);
                textLeft = m.left + 24;
            } catch (e) {
                console.warn('Logo konnte nicht ins PDF eingefügt werden:', e.message);
            }
        }

        // Company name — bold 18pt white
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(250, 250, 250); // #fafafa
        doc.text(this.getSettings().companyName, textLeft, 18);

        // Subtitle line
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        const s = this.getSettings();
        doc.text(`${s.address} · ${s.phone} · ${s.email}`, textLeft, 25);

        // "ANGEBOT" right-aligned, large
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(250, 250, 250);
        doc.text('ANGEBOT', pw - m.right, 18, { align: 'right' });

        // Quote number below title
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(180, 180, 180);
        doc.text(`Nr. ${angebot.id || ''}`, pw - m.right, 25, { align: 'right' });

        // Accent line underneath header band
        doc.setDrawColor(99, 102, 241); // #6366f1
        doc.setLineWidth(1.2);
        doc.line(0, 38, pw, 38);

        doc.setTextColor(0);
        return 46;
    }

    _angebotDrawMetaBlock(doc, y, angebot) {
        const m = this.margin;
        const pw = this.pageWidth;
        const kunde = angebot.kunde || {};
        const midX = pw / 2 + 5;

        // Left column: Customer info
        doc.setFontSize(8);
        doc.setTextColor(130);
        doc.text('KUNDE', m.left, y);
        doc.setTextColor(0);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        let cy = y + 6;
        if (kunde.firma) { doc.text(kunde.firma, m.left, cy); cy += 5; }
        doc.text(kunde.name || 'Unbekannt', m.left, cy);
        cy += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        if (kunde.adresse || kunde.strasse) {
            doc.text(kunde.adresse || kunde.strasse, m.left, cy); cy += 5;
        }
        if (kunde.plz || kunde.ort) {
            doc.text(`${kunde.plz || ''} ${kunde.ort || ''}`.trim(), m.left, cy); cy += 5;
        }
        if (kunde.email) { doc.text(kunde.email, m.left, cy); cy += 5; }
        if (kunde.telefon) { doc.text(`Tel: ${kunde.telefon}`, m.left, cy); cy += 5; }

        // Right column: Quote details
        const rx = midX;
        doc.setFontSize(8);
        doc.setTextColor(130);
        doc.text('ANGEBOTSDETAILS', rx, y);
        doc.setTextColor(0);

        doc.setFontSize(10);
        let ry = y + 6;
        const metaItems = [
            ['Nummer:', angebot.id || '-'],
            ['Datum:', this.fmtDate(angebot.createdAt)],
            ['Gültig bis:', this.fmtDate(angebot.gueltigBis || '')],
            ['Leistungsart:', window.getLeistungsartLabel?.(angebot.leistungsart) || angebot.leistungsart || '-']
        ];
        metaItems.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label, rx, ry);
            doc.setFont('helvetica', 'normal');
            doc.text(value, rx + 30, ry);
            ry += 5.5;
        });

        return Math.max(cy, ry) + 6;
    }

    _angebotDrawPositionsTable(doc, y, positionen) {
        const m = this.margin;
        const cw = this.contentWidth;
        const colWidths = [14, 68, 18, 18, 25, 27];
        const headers = ['Pos.', 'Beschreibung', 'Menge', 'Einheit', 'Einzelpreis', 'Gesamt'];
        const aligns = ['left', 'left', 'right', 'left', 'right', 'right'];
        const rowH = 8;

        y = this._angebotCheckPageBreak(doc, y, 14);

        // Header row — dark background
        doc.setFillColor(24, 24, 27); // #18181b
        doc.rect(m.left, y, cw, rowH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(250, 250, 250);

        let x = m.left;
        headers.forEach((h, i) => {
            const tx = aligns[i] === 'right' ? x + colWidths[i] - 2 : x + 2;
            doc.text(h, tx, y + 5.5, { align: aligns[i] });
            x += colWidths[i];
        });

        doc.setTextColor(0);
        y += rowH;

        // Data rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        let subtotal = 0;

        (positionen || []).forEach((p, idx) => {
            y = this._angebotCheckPageBreak(doc, y, rowH + 6);

            // Alternating row fill
            if (idx % 2 === 0) {
                doc.setFillColor(248, 248, 248); // #f8f8f8
            } else {
                doc.setFillColor(255, 255, 255);
            }
            const einzelpreis = p.einzelpreis || p.preis || 0;
            const lineTotal = (p.menge || 0) * einzelpreis;
            subtotal += lineTotal;

            // Determine row height — support multi-line description
            const descMaxW = colWidths[1] - 4;
            const descLines = doc.splitTextToSize(p.beschreibung || '', descMaxW);
            const currentRowH = Math.max(rowH, descLines.length * 4 + 4);

            doc.rect(m.left, y, cw, currentRowH, 'F');

            x = m.left;
            const cells = [
                String(idx + 1),
                null, // handled separately for multi-line
                String(p.menge || ''),
                p.einheit || '',
                this.fmtCurrency(einzelpreis),
                this.fmtCurrency(lineTotal)
            ];

            cells.forEach((cell, i) => {
                if (i === 1) { x += colWidths[i]; return; } // skip description column here
                const tx = aligns[i] === 'right' ? x + colWidths[i] - 2 : x + 2;
                doc.text(cell, tx, y + 5.5, { align: aligns[i] });
                x += colWidths[i];
            });

            // Description (multi-line support)
            doc.text(descLines, m.left + colWidths[0] + 2, y + 5.5);

            y += currentRowH;

            // Thin separator line
            doc.setDrawColor(230);
            doc.setLineWidth(0.2);
            doc.line(m.left, y, m.left + cw, y);
        });

        // Bottom border
        doc.setDrawColor(24, 24, 27);
        doc.setLineWidth(0.5);
        doc.line(m.left, y, m.left + cw, y);

        return { y: y + 2, subtotal };
    }

    _angebotDrawTotals(doc, y, angebot, subtotal) {
        const m = this.margin;
        const pw = this.pageWidth;
        const settings = this.getSettings();
        const rightEdge = pw - m.right;
        const labelX = rightEdge - 70;
        const netto = angebot.netto ?? subtotal;
        const taxRate = settings.taxRate || 19;
        const mwst = angebot.mwst ?? (settings.kleinunternehmer ? 0 : netto * taxRate / 100);
        const brutto = angebot.brutto ?? (netto + mwst);

        y = this._angebotCheckPageBreak(doc, y, 30);
        y += 2;

        // Netto
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Nettobetrag:', labelX, y + 4);
        doc.text(this.fmtCurrency(netto), rightEdge, y + 4, { align: 'right' });
        y += 7;

        // MwSt or Kleinunternehmer
        if (settings.kleinunternehmer) {
            doc.setFontSize(9);
            doc.setTextColor(130);
            doc.text('Gem. §19 UStG keine MwSt.', labelX, y + 4);
            doc.text('—', rightEdge, y + 4, { align: 'right' });
            doc.setTextColor(0);
        } else {
            doc.text(`MwSt. ${taxRate}%:`, labelX, y + 4);
            doc.text(this.fmtCurrency(mwst), rightEdge, y + 4, { align: 'right' });
        }
        y += 7;

        // Brutto — accent highlight
        doc.setFillColor(99, 102, 241); // #6366f1
        doc.roundedRect(labelX - 2, y, rightEdge - labelX + 4, 10, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text('Angebotssumme:', labelX + 2, y + 7);
        doc.text(this.fmtCurrency(brutto), rightEdge - 2, y + 7, { align: 'right' });
        doc.setTextColor(0);

        return y + 16;
    }

    _angebotDrawTextSection(doc, y, text) {
        if (!text) return y;
        const m = this.margin;

        y = this._angebotCheckPageBreak(doc, y, 20);

        // Left accent bar
        const lines = doc.splitTextToSize(text, this.contentWidth - 10);
        const blockH = lines.length * 4.2 + 6;

        y = this._angebotCheckPageBreak(doc, y, blockH);

        doc.setFillColor(99, 102, 241); // #6366f1 accent bar
        doc.rect(m.left, y, 1.2, blockH, 'F');

        // Light background behind text
        doc.setFillColor(248, 248, 252);
        doc.rect(m.left + 1.2, y, this.contentWidth - 1.2, blockH, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50);
        doc.text(lines, m.left + 6, y + 5);
        doc.setTextColor(0);

        return y + blockH + 6;
    }

    _angebotDrawTrustSection(doc, y, trustItems) {
        const m = this.margin;
        const cw = this.contentWidth;

        // Default trust items
        const defaults = [
            'Festpreisgarantie auf alle angegebenen Positionen',
            'Termingarantie — verbindliche Fertigstellungstermine',
            'Volle Gewährleistung gemäß BGB',
            'Zertifizierter Fachbetrieb mit qualifiziertem Personal'
        ];
        const items = [...defaults, ...(trustItems || [])];

        const blockH = 8 + items.length * 5.5 + 4;
        y = this._angebotCheckPageBreak(doc, y, blockH);

        // Gray background box
        doc.setFillColor(243, 243, 246);
        doc.roundedRect(m.left, y, cw, blockH, 3, 3, 'F');

        // Heading
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(24, 24, 27);
        doc.text('Ihre Vorteile', m.left + 6, y + 7);

        // Checkmark items
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50);
        let iy = y + 13;
        items.forEach(item => {
            // Green checkmark
            doc.setTextColor(34, 197, 94); // #22c55e
            doc.setFont('helvetica', 'bold');
            doc.text('\u2713', m.left + 6, iy);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(50);
            // Wrap long items
            const wrappedLines = doc.splitTextToSize(item, cw - 18);
            doc.text(wrappedLines[0], m.left + 12, iy);
            if (wrappedLines.length > 1) {
                for (let l = 1; l < wrappedLines.length; l++) {
                    iy += 4.5;
                    doc.text(wrappedLines[l], m.left + 12, iy);
                }
            }
            iy += 5.5;
        });

        doc.setTextColor(0);
        return y + blockH + 6;
    }

    _angebotDrawFooter(doc) {
        const s = this.getSettings();
        const pw = this.pageWidth;
        const m = this.margin;
        const pageCount = doc.internal.getNumberOfPages();

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);

            // Thin accent line
            doc.setDrawColor(99, 102, 241); // #6366f1
            doc.setLineWidth(0.6);
            doc.line(m.left, 278, pw - m.right, 278);

            doc.setFontSize(7);
            doc.setTextColor(130);

            // Row 1: Company + contact
            doc.text(
                `${s.companyName} · ${s.address} · Tel: ${s.phone} · ${s.email}`,
                pw / 2, 282, { align: 'center' }
            );

            // Row 2: Bank + tax IDs
            const taxLine = [
                s.taxId ? `St.-Nr. ${s.taxId}` : '',
                s.vatId ? `USt-IdNr. ${s.vatId}` : ''
            ].filter(Boolean).join(' · ');
            const bankLine = [
                s.bank,
                s.iban ? `IBAN: ${s.iban}` : '',
                s.bic ? `BIC: ${s.bic}` : ''
            ].filter(Boolean).join(' · ');
            doc.text(
                `${bankLine}${taxLine ? ' · ' + taxLine : ''}`,
                pw / 2, 286, { align: 'center' }
            );

            // Page number
            doc.text(
                `Seite ${i} von ${pageCount}`,
                pw / 2, 290, { align: 'center' }
            );

            doc.setTextColor(0);
        }
    }

    async generateAngebot(angebot) {
        if (!angebot?.kunde) {
            console.error('Angebot oder Kundendaten fehlen');
            return false;
        }
        await this.ensureLoaded();
        const doc = this.createDoc();

        // 1. Header Band
        let y = this._angebotDrawHeaderBand(doc, angebot);

        // 2. Meta Block (two-column: customer + quote details)
        y = this._angebotDrawMetaBlock(doc, y, angebot);

        // 3. Positions Table
        const { y: tableEndY, subtotal } = this._angebotDrawPositionsTable(doc, y, angebot.positionen);
        y = tableEndY;

        // 4. Totals (Netto, MwSt, Brutto)
        y = this._angebotDrawTotals(doc, y, angebot, subtotal);

        // 5. Angebots-Text Section (with left accent bar)
        if (angebot.text || angebot.angebotText) {
            y = this._angebotDrawTextSection(doc, y, angebot.text || angebot.angebotText);
        }

        // 6. Trust Section
        y = this._angebotDrawTrustSection(doc, y, angebot.trust_items || angebot.trustItems);

        // 7. Closing
        y = this._angebotCheckPageBreak(doc, y, 20);
        doc.setFontSize(9);
        doc.setTextColor(80);
        doc.text('Dieses Angebot ist freibleibend und unverbindlich.', this.margin.left, y);
        doc.text('Wir freuen uns auf Ihre Rückmeldung.', this.margin.left, y + 5);
        y += 14;
        doc.text('Mit freundlichen Grüßen', this.margin.left, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text(this.getSettings().owner, this.margin.left, y + 6);
        doc.setFont('helvetica', 'normal');

        // Footer
        this._angebotDrawFooter(doc);

        doc.save(`Angebot_${angebot.id}.pdf`);
        return true;
    }

    // ============================================
    // Angebot Varianten (3-Column Comparison PDF)
    // ============================================

    async generateAngebotVarianten(variants, angebot) {
        if (!variants || variants.length < 2) {
            console.error('Mindestens 2 Varianten erforderlich');
            return false;
        }
        await this.ensureLoaded();
        const doc = this.createDoc();
        const m = this.margin;
        const pw = this.pageWidth;
        const cw = this.contentWidth;

        // Header band (reuse angebot header)
        const baseAngebot = angebot || variants[1] || variants[0];
        let y = this._angebotDrawHeaderBand(doc, baseAngebot);

        // Customer info (compact)
        if (baseAngebot.kunde) {
            y = this._angebotDrawMetaBlock(doc, y, baseAngebot);
        }

        // Section title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(24, 24, 27);
        doc.text('Angebotsvergleich — Ihre Optionen', m.left, y);
        y += 8;

        // Column layout for up to 3 variants
        const numCols = Math.min(variants.length, 3);
        const colGap = 4;
        const colW = (cw - (numCols - 1) * colGap) / numCols;
        const labels = ['Budget', 'Standard', 'Premium'];
        const recommendedIdx = 1; // Standard is recommended

        // Calculate column heights for consistent sizing
        const colHeights = variants.slice(0, 3).map(variant => {
            const posItems = variant.positionen || [];
            const features = variant.features || variant.merkmale || [];
            return 60 + posItems.length * 5 + features.length * 5;
        });
        const maxColH = Math.max(...colHeights);

        // Draw variant columns
        variants.slice(0, 3).forEach((variant, colIdx) => {
            const colX = m.left + colIdx * (colW + colGap);
            const isRecommended = colIdx === recommendedIdx;
            let cy = y;

            // Column background
            if (isRecommended) {
                doc.setDrawColor(99, 102, 241);
                doc.setLineWidth(1.5);
                doc.setFillColor(248, 247, 255);
            } else {
                doc.setDrawColor(220, 220, 225);
                doc.setLineWidth(0.5);
                doc.setFillColor(250, 250, 252);
            }

            doc.roundedRect(colX, cy, colW, maxColH, 3, 3, 'FD');

            // "Empfohlen" badge on standard
            if (isRecommended) {
                const badgeW = 26;
                const badgeX = colX + (colW - badgeW) / 2;
                doc.setFillColor(99, 102, 241);
                doc.roundedRect(badgeX, cy - 3, badgeW, 7, 2, 2, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.setTextColor(255, 255, 255);
                doc.text('EMPFOHLEN', badgeX + badgeW / 2, cy + 1.5, { align: 'center' });
            }

            cy += 8;

            // Variant label
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(24, 24, 27);
            const varLabel = variant.label || labels[colIdx] || `Option ${colIdx + 1}`;
            doc.text(varLabel, colX + colW / 2, cy, { align: 'center' });
            cy += 7;

            // Price — large
            const brutto = variant.brutto || 0;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(isRecommended ? 14 : 12);
            doc.setTextColor(isRecommended ? 99 : 60, isRecommended ? 102 : 60, isRecommended ? 241 : 60);
            doc.text(this.fmtCurrency(brutto), colX + colW / 2, cy, { align: 'center' });
            cy += 4;
            doc.setFontSize(7);
            doc.setTextColor(130);
            doc.text('inkl. MwSt.', colX + colW / 2, cy, { align: 'center' });
            cy += 6;

            // Divider
            doc.setDrawColor(220);
            doc.setLineWidth(0.3);
            doc.line(colX + 4, cy, colX + colW - 4, cy);
            cy += 4;

            // Positions summary
            const posItems = variant.positionen || [];
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(24, 24, 27);
            doc.text('Leistungen:', colX + 4, cy);
            cy += 4;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(60);
            posItems.forEach(p => {
                const desc = p.beschreibung || '';
                const maxW = colW - 8;
                const truncated = doc.splitTextToSize(desc, maxW)[0];
                doc.text(`• ${truncated}`, colX + 4, cy);
                cy += 4.5;
            });

            cy += 2;

            // Features / key highlights
            const features = variant.features || variant.merkmale || [];
            if (features.length > 0) {
                doc.setDrawColor(220);
                doc.line(colX + 4, cy, colX + colW - 4, cy);
                cy += 4;

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(24, 24, 27);
                doc.text('Highlights:', colX + 4, cy);
                cy += 4;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                features.forEach(f => {
                    doc.setTextColor(34, 197, 94);
                    doc.text('\u2713', colX + 4, cy);
                    doc.setTextColor(60);
                    const fText = doc.splitTextToSize(f, colW - 14)[0];
                    doc.text(fText, colX + 9, cy);
                    cy += 4.5;
                });
            }
        });

        // Footer
        this._angebotDrawFooter(doc);

        const filename = `Angebot_Vergleich_${baseAngebot.id || 'varianten'}.pdf`;
        doc.save(filename);
        return true;
    }

    // ============================================
    // Mahnung (Dunning Letter) PDF
    // ============================================
    async generateMahnung(rechnung, mahnLevel, mahnGebuehr) {
        if (!rechnung?.kunde) {
            console.error('Rechnung oder Kundendaten fehlen');
            return false;
        }
        await this.ensureLoaded();
        const doc = this.createDoc();
        const level = mahnLevel || 1;
        const fee = mahnGebuehr || 0;

        const titles = {
            1: 'Zahlungserinnerung',
            2: '1. Mahnung',
            3: '2. Mahnung',
            4: 'Letzte Mahnung'
        };

        let y = this.drawHeader(doc, titles[level] || `${level}. Mahnung`, rechnung.id);
        y = this.drawAddresses(doc, y, rechnung.kunde);

        // Date + reference
        doc.setFontSize(10);
        doc.text(`Datum: ${this.fmtDate(new Date().toISOString())}`, this.margin.left, y);
        doc.text(`Rechnungsdatum: ${this.fmtDate(rechnung.createdAt)}`, this.pageWidth - this.margin.right, y, { align: 'right' });
        y += 10;

        // Letter body
        const texts = {
            1: [
                'Sehr geehrte Damen und Herren,',
                '',
                `bei Durchsicht unserer Buchhaltung haben wir festgestellt, dass die Rechnung ${rechnung.id}`,
                `vom ${this.fmtDate(rechnung.createdAt)} über ${this.fmtCurrency(rechnung.brutto)} noch nicht beglichen wurde.`,
                '',
                'Sicherlich handelt es sich um ein Versehen. Wir bitten Sie, den offenen Betrag',
                'innerhalb der nächsten 7 Tage auf unser Konto zu überweisen.'
            ],
            2: [
                'Sehr geehrte Damen und Herren,',
                '',
                `trotz unserer Zahlungserinnerung konnten wir bislang keinen Zahlungseingang für die`,
                `Rechnung ${rechnung.id} vom ${this.fmtDate(rechnung.createdAt)} feststellen.`,
                '',
                `Der offene Betrag beträgt: ${this.fmtCurrency(rechnung.brutto)}`,
                fee > 0 ? `Zzgl. Mahngebühren: ${this.fmtCurrency(fee)}` : '',
                fee > 0 ? `Gesamtbetrag: ${this.fmtCurrency(rechnung.brutto + fee)}` : '',
                '',
                'Wir bitten Sie dringend, den Betrag innerhalb von 7 Tagen zu überweisen.'
            ],
            3: [
                'Sehr geehrte Damen und Herren,',
                '',
                `wir müssen Sie erneut an die offene Rechnung ${rechnung.id} erinnern.`,
                `Trotz mehrfacher Mahnung ist bislang kein Zahlungseingang erfolgt.`,
                '',
                `Offener Rechnungsbetrag: ${this.fmtCurrency(rechnung.brutto)}`,
                fee > 0 ? `Mahngebühren: ${this.fmtCurrency(fee)}` : '',
                fee > 0 ? `Gesamtforderung: ${this.fmtCurrency(rechnung.brutto + fee)}` : '',
                '',
                'Sollten wir innerhalb von 5 Werktagen keinen Zahlungseingang verzeichnen,',
                'sehen wir uns gezwungen, ein gerichtliches Mahnverfahren einzuleiten.'
            ],
            4: [
                'Sehr geehrte Damen und Herren,',
                '',
                `dies ist unsere letzte außergerichtliche Mahnung bezüglich der Rechnung ${rechnung.id}.`,
                '',
                `Gesamtforderung inkl. Mahngebühren: ${this.fmtCurrency(rechnung.brutto + fee)}`,
                '',
                'Wir fordern Sie hiermit letztmalig auf, den genannten Betrag innerhalb von',
                '3 Werktagen auf das unten genannte Konto zu überweisen.',
                '',
                'Nach Ablauf dieser Frist werden wir die Forderung ohne weitere Ankündigung',
                'an ein Inkassounternehmen bzw. unseren Rechtsanwalt übergeben.',
                'Die hierdurch entstehenden Kosten gehen zu Ihren Lasten.'
            ]
        };

        const body = texts[Math.min(level, 4)] || texts[1];
        doc.setFontSize(10);
        body.filter(l => l !== undefined).forEach(line => {
            if (y > 255) { doc.addPage(); y = this.margin.top + 10; }
            doc.text(line, this.margin.left, y);
            y += 5;
        });

        // Payment info
        const s = this.getSettings();
        y += 6;
        doc.setFontSize(9);
        doc.text(`Bankverbindung: ${s.bank} · IBAN: ${s.iban}`, this.margin.left, y);
        doc.text(`Verwendungszweck: ${rechnung.id}`, this.margin.left, y + 5);

        // Closing
        y += 16;
        doc.text('Mit freundlichen Grüßen', this.margin.left, y);
        doc.setFont('helvetica', 'bold');
        doc.text(s.owner, this.margin.left, y + 6);
        doc.setFont('helvetica', 'normal');

        this.drawFooter(doc);

        doc.save(`${titles[level] || 'Mahnung'}_${rechnung.id}.pdf`);
        return true;
    }
}

window.pdfService = new PDFService();
