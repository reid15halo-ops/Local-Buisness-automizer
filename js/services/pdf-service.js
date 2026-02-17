/* ============================================
   PDF Generation Service
   Professional PDF export for invoices, quotes & dunning
   Uses jsPDF (loaded via CDN)
   ============================================ */

class PDFService {
    constructor() {
        this.loaded = false;
        this.margin = { top: 20, left: 20, right: 20, bottom: 25 };
        this.pageWidth = 210; // A4 mm
        this.contentWidth = 170; // 210 - 20 - 20
    }

    async ensureLoaded() {
        if (this.loaded && window.jspdf) {return;}
        await new Promise((resolve, reject) => {
            if (window.jspdf) { this.loaded = true; resolve(); return; }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
            script.onload = () => { this.loaded = true; resolve(); };
            script.onerror = () => reject(new Error('jsPDF konnte nicht geladen werden'));
            document.head.appendChild(script);
        });
    }

    // --- Shared PDF helpers ---

    createDoc() {
        const { jsPDF } = window.jspdf;
        return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    }

    getSettings() {
        const store = window.storeService?.state?.settings || {};
        return {
            companyName: store.companyName || 'FreyAI Visions',
            owner: store.owner || 'Max Mustermann',
            address: store.address || 'Handwerkerring 38a, 63776 Mömbris-Rothengrund',
            taxId: store.taxId || '12/345/67890',
            vatId: store.vatId || 'DE123456789',
            phone: store.phone || '+49 6029 99 22 96 4',
            email: store.email || 'info@freyai-visions.de',
            iban: store.iban || 'DE00 0000 0000 0000 0000 00',
            bank: store.bank || 'Sparkasse Aschaffenburg'
        };
    }

    drawHeader(doc, title, docNumber) {
        const s = this.getSettings();
        const m = this.margin;

        // Company name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(s.companyName, m.left, m.top + 8);

        // Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`${s.address} · Tel: ${s.phone}`, m.left, m.top + 14);

        // Document type + number (right-aligned)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(title, this.pageWidth - m.right, m.top + 8, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(docNumber, this.pageWidth - m.right, m.top + 14, { align: 'right' });

        // Separator line
        doc.setDrawColor(100, 102, 241); // accent color
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
                `${s.bank} · IBAN: ${s.iban} · Seite ${i}/${pageCount}`,
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
        y = this.drawTotals(doc, y, [
            { label: 'Nettobetrag:', value: this.fmtCurrency(rechnung.netto) },
            { label: 'MwSt. 19%:', value: this.fmtCurrency(rechnung.mwst) },
            { label: 'Gesamtbetrag:', value: this.fmtCurrency(rechnung.brutto), bold: true }
        ]);

        // Material margin info (internal - only shown if stueckliste exists)
        if (rechnung.stueckliste?.length > 0) {
            doc.setFontSize(8);
            doc.setTextColor(130);
            doc.text(`Materialmarge: EK ${this.fmtCurrency(rechnung.stuecklisteEK)} · VK ${this.fmtCurrency(rechnung.stuecklisteVK)} · Marge ${this.fmtCurrency((rechnung.stuecklisteVK || 0) - (rechnung.stuecklisteEK || 0))}`,
                this.margin.left, y);
            doc.setTextColor(0);
            y += 6;
        }

        // Payment info
        const s = this.getSettings();
        y += 4;
        doc.setFontSize(9);
        doc.text('Zahlungsbedingungen:', this.margin.left, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Zahlbar innerhalb von 14 Tagen ohne Abzug.`, this.margin.left, y + 5);
        doc.text(`Bankverbindung: ${s.bank} · IBAN: ${s.iban}`, this.margin.left, y + 10);

        // Notes
        if (rechnung.notizen) {
            y += 18;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Bemerkungen:', this.margin.left, y);
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(rechnung.notizen, this.contentWidth);
            doc.text(lines, this.margin.left, y + 5);
        }

        this.drawFooter(doc);

        doc.save(`Rechnung_${rechnung.id}.pdf`);
        return true;
    }

    // ============================================
    // Angebot (Quote) PDF
    // ============================================
    async generateAngebot(angebot) {
        await this.ensureLoaded();
        const doc = this.createDoc();

        let y = this.drawHeader(doc, 'Angebot', angebot.id);
        y = this.drawAddresses(doc, y, angebot.kunde);

        // Meta
        doc.setFontSize(10);
        doc.text(`Angebotsdatum: ${this.fmtDate(angebot.createdAt)}`, this.margin.left, y);
        doc.text(`Leistungsart: ${window.getLeistungsartLabel?.(angebot.leistungsart) || angebot.leistungsart || '-'}`,
            this.margin.left, y + 5);
        doc.text(`Gültig bis: ${this.fmtDate(angebot.gueltigBis || '')}`,
            this.pageWidth - this.margin.right, y, { align: 'right' });
        y += 14;

        // Intro text
        doc.setFontSize(10);
        doc.text('Sehr geehrte Damen und Herren,', this.margin.left, y);
        doc.text('wir erlauben uns, Ihnen folgendes Angebot zu unterbreiten:', this.margin.left, y + 5);
        y += 14;

        // Positions table
        const headers = [
            { label: 'Pos.', align: 'left' },
            { label: 'Beschreibung', align: 'left' },
            { label: 'Menge', align: 'right' },
            { label: 'Einzelpreis', align: 'right' },
            { label: 'Gesamt', align: 'right' }
        ];
        const colWidths = [12, 86, 22, 25, 25];

        const rows = (angebot.positionen || []).map((p, i) => ({
            cells: [i + 1, p.beschreibung, `${p.menge} ${p.einheit}`, this.fmtCurrency(p.preis), this.fmtCurrency((p.menge || 0) * (p.preis || 0))]
        }));

        y = this.drawTable(doc, y, headers, rows, colWidths);

        // Totals
        y = this.drawTotals(doc, y, [
            { label: 'Nettobetrag:', value: this.fmtCurrency(angebot.netto) },
            { label: 'MwSt. 19%:', value: this.fmtCurrency(angebot.mwst) },
            { label: 'Angebotssumme:', value: this.fmtCurrency(angebot.brutto), bold: true }
        ]);

        // Closing
        y += 6;
        doc.setFontSize(9);
        doc.text('Dieses Angebot ist freibleibend und unverbindlich.', this.margin.left, y);
        doc.text('Wir freuen uns auf Ihre Rückmeldung.', this.margin.left, y + 5);
        y += 14;
        doc.text('Mit freundlichen Grüßen', this.margin.left, y);
        doc.setFont('helvetica', 'bold');
        doc.text(this.getSettings().owner, this.margin.left, y + 6);
        doc.setFont('helvetica', 'normal');

        this.drawFooter(doc);

        doc.save(`Angebot_${angebot.id}.pdf`);
        return true;
    }

    // ============================================
    // Mahnung (Dunning Letter) PDF
    // ============================================
    async generateMahnung(rechnung, mahnLevel, mahnGebuehr) {
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
