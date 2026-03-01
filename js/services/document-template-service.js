/* ============================================
   DocumentTemplateService
   Standardised German business document renderer.

   All customer-facing documents (Angebot, Rechnung,
   Auftragsbestätigung, Mahnung, Email) go through
   this service so layout and legal information
   are consistent and §14 UStG-compliant.

   Usage:
     const html = window.documentTemplateService.renderAngebot(data);
     const html = window.documentTemplateService.renderRechnung(data);
     const html = window.documentTemplateService.renderEmail(subject, bodyHtml, opts);

   Special layouts for individual customers are an
   add-on and generated separately by the customer's
   custom template (not this service).
   ============================================ */

class DocumentTemplateService {

    // ============================================
    // Shared CSS
    // ============================================
    _css() {
        return `
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
                font-size: 13px;
                color: #1d1d1f;
                background: #fff;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            a { color: #0071e3; text-decoration: none; }

            /* Page */
            .page {
                max-width: 794px; /* A4 at 96dpi */
                margin: 0 auto;
                padding: 48px 56px;
                background: #fff;
            }

            /* Header */
            .doc-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                padding-bottom: 24px;
                border-bottom: 2px solid #0f172a;
                margin-bottom: 32px;
            }
            .company-logo { height: 56px; width: auto; object-fit: contain; }
            .company-name-text {
                font-size: 22px;
                font-weight: 700;
                color: #0f172a;
                line-height: 1.2;
            }
            .company-address {
                font-size: 11px;
                color: #6e6e73;
                margin-top: 4px;
                line-height: 1.6;
            }
            .doc-meta {
                text-align: right;
                line-height: 1.7;
            }
            .doc-meta .doc-type {
                font-size: 20px;
                font-weight: 700;
                color: #0f172a;
            }
            .doc-meta .doc-number {
                font-size: 13px;
                color: #6e6e73;
            }

            /* Address block */
            .address-block {
                margin-bottom: 28px;
                line-height: 1.7;
            }
            .address-label {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: .5px;
                color: #6e6e73;
                margin-bottom: 4px;
            }
            .address-name { font-weight: 600; }

            /* Two-column meta row */
            .meta-grid {
                display: flex;
                gap: 32px;
                margin-bottom: 28px;
                font-size: 12px;
            }
            .meta-item { display: flex; flex-direction: column; }
            .meta-item .label { color: #6e6e73; font-size: 11px; margin-bottom: 2px; }
            .meta-item .value { font-weight: 600; }

            /* Subject line */
            .doc-subject {
                font-size: 16px;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 16px;
            }
            .doc-intro {
                margin-bottom: 24px;
                line-height: 1.7;
                color: #374151;
            }

            /* Positions table */
            .pos-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
                font-size: 12px;
            }
            .pos-table thead tr {
                background: #0f172a;
                color: #fff;
            }
            .pos-table thead th {
                padding: 9px 10px;
                text-align: left;
                font-weight: 600;
                font-size: 11px;
                letter-spacing: .3px;
            }
            .pos-table thead th:last-child,
            .pos-table thead th.right { text-align: right; }
            .pos-table tbody tr { border-bottom: 1px solid #e5e7eb; }
            .pos-table tbody tr:last-child { border-bottom: none; }
            .pos-table tbody td {
                padding: 8px 10px;
                vertical-align: top;
                line-height: 1.5;
            }
            .pos-table tbody td.right { text-align: right; }
            .pos-table .pos-desc-secondary {
                font-size: 11px;
                color: #6e6e73;
                margin-top: 2px;
            }

            /* Totals block */
            .totals {
                margin-left: auto;
                margin-right: 0;
                width: 280px;
                margin-bottom: 28px;
            }
            .totals table { width: 100%; border-collapse: collapse; }
            .totals td { padding: 5px 8px; font-size: 12px; }
            .totals td.right { text-align: right; }
            .totals tr.subtotal td { color: #6e6e73; }
            .totals tr.total td {
                font-size: 14px;
                font-weight: 700;
                border-top: 2px solid #0f172a;
                padding-top: 8px;
            }

            /* Notes / payment terms */
            .doc-notes {
                background: #f8fafc;
                border-left: 3px solid #6366f1;
                padding: 12px 16px;
                border-radius: 4px;
                font-size: 12px;
                line-height: 1.7;
                margin-bottom: 24px;
            }

            /* Footer */
            .doc-footer {
                margin-top: 32px;
                padding-top: 16px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                color: #9ca3af;
                line-height: 1.7;
            }

            /* Status badge */
            .status-badge {
                display: inline-block;
                padding: 2px 10px;
                border-radius: 99px;
                font-size: 11px;
                font-weight: 600;
            }
            .status-open     { background: #fef3c7; color: #92400e; }
            .status-sent     { background: #dbeafe; color: #1e40af; }
            .status-accepted { background: #d1fae5; color: #065f46; }
            .status-overdue  { background: #fee2e2; color: #991b1b; }
            .status-paid     { background: #d1fae5; color: #065f46; }

            @media print {
                body { background: #fff; }
                .page { padding: 20mm 20mm; max-width: 100%; }
            }
        </style>`;
    }

    // ============================================
    // Helpers
    // ============================================

    /** Safe HTML escape */
    _esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** Format as EUR currency */
    _eur(n) {
        return Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    }

    /** Format a date string as de-DE */
    _date(s) {
        if (!s) {return '';}
        try {
            return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (_) { return s; }
    }

    /** Render company block for header */
    _companyBlock(c) {
        const logo = c.logoUrl
            ? `<img src="${this._esc(c.logoUrl)}" class="company-logo" alt="${this._esc(c.companyName)}">`
            : `<div class="company-name-text">${this._esc(c.companyName || 'Mein Betrieb')}</div>`;
        const addr = [c.address, c.zip && c.city ? `${c.zip} ${c.city}` : (c.city || '')]
            .filter(Boolean).join('<br>');
        return `
            <div>
                ${logo}
                <div class="company-address">
                    ${addr ? addr + '<br>' : ''}
                    ${c.phone  ? 'Tel.: ' + this._esc(c.phone)  + '<br>' : ''}
                    ${c.email  ? this._esc(c.email)  + '<br>' : ''}
                    ${c.website? this._esc(c.website) + '<br>' : ''}
                </div>
            </div>`;
    }

    /** Legal footer line with tax / registration data */
    _legalFooter(c) {
        const parts = [];
        if (c.companyName) {parts.push(this._esc(c.companyName));}
        if (c.address)     {parts.push(this._esc(c.address));}
        if (c.zip || c.city) {parts.push(this._esc(`${c.zip || ''} ${c.city || ''}`.trim()));}
        if (c.taxId)       {parts.push('Steuernr.: ' + this._esc(c.taxId));}
        if (c.vatId)       {parts.push('USt-IdNr.: ' + this._esc(c.vatId));}
        if (c.hrb)         {parts.push('HRB: '       + this._esc(c.hrb));}
        if (c.iban)        {parts.push('IBAN: '      + this._esc(c.iban));}
        if (c.bic)         {parts.push('BIC: '       + this._esc(c.bic));}
        if (c.bank)        {parts.push(this._esc(c.bank));}
        const col1 = parts.slice(0, Math.ceil(parts.length / 2)).join(' · ');
        const col2 = parts.slice(Math.ceil(parts.length / 2)).join(' · ');
        return `
            <div class="doc-footer">
                <span>${col1}</span>
                <span>${col2}</span>
            </div>`;
    }

    /** Render positions rows for any document type */
    _positionRows(positionen) {
        return (positionen || []).map((p, i) => `
            <tr>
                <td class="right" style="width:36px;color:#9ca3af">${i + 1}</td>
                <td style="width:52px">${this._esc(p.menge || '')} ${this._esc(p.einheit || '')}</td>
                <td>
                    <strong>${this._esc(p.beschreibung || '')}</strong>
                    ${p.notiz ? `<div class="pos-desc-secondary">${this._esc(p.notiz)}</div>` : ''}
                </td>
                <td class="right" style="width:90px">${this._eur(p.preis)}</td>
                <td class="right" style="width:90px">${this._eur((p.menge || 0) * (p.preis || 0))}</td>
            </tr>`).join('');
    }

    /** Render netto/mwst/brutto totals block */
    _totalsBlock(doc) {
        const taxRate = Number(doc.taxRate || 19);
        return `
            <div class="totals">
                <table>
                    <tr class="subtotal">
                        <td>Nettobetrag</td>
                        <td class="right">${this._eur(doc.netto)}</td>
                    </tr>
                    <tr class="subtotal">
                        <td>MwSt. ${taxRate} %</td>
                        <td class="right">${this._eur(doc.mwst)}</td>
                    </tr>
                    <tr class="total">
                        <td>Gesamtbetrag</td>
                        <td class="right">${this._eur(doc.brutto)}</td>
                    </tr>
                </table>
            </div>`;
    }

    /** Fetch company settings from the global service */
    async _getCompany() {
        try {
            if (window.companySettings?.load) {
                return (await window.companySettings.load()) || {};
            }
        } catch (_) {}
        return {};
    }

    // ============================================
    // Public: renderAngebot
    // ============================================
    /**
     * Render a German-standard Angebot (quotation) as a full HTML document.
     * @param {Object} angebot
     * @param {Object} [companyOverride] - Override company settings (optional)
     */
    async renderAngebot(angebot, companyOverride) {
        const c = companyOverride || await this._getCompany();
        const k = angebot.kunde || {};
        const validUntil = angebot.gueltigBis
            ? this._date(angebot.gueltigBis)
            : this._date(new Date(Date.now() + 30 * 86400000).toISOString());

        return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Angebot ${this._esc(angebot.id)}</title>
${this._css()}
</head>
<body>
<div class="page">

    <div class="doc-header">
        ${this._companyBlock(c)}
        <div class="doc-meta">
            <div class="doc-type">Angebot</div>
            <div class="doc-number">Nr. ${this._esc(angebot.id)}</div>
            <div style="margin-top:8px;font-size:12px;color:#374151">
                Datum: ${this._date(angebot.createdAt || new Date().toISOString())}<br>
                Gültig bis: ${validUntil}
            </div>
        </div>
    </div>

    <div class="address-block">
        <div class="address-label">Angebot an</div>
        ${k.firma ? `<div>${this._esc(k.firma)}</div>` : ''}
        <div class="address-name">${this._esc(k.name || k.vorname + ' ' + k.nachname || '')}</div>
        ${k.address ? `<div>${this._esc(k.address)}</div>` : ''}
        ${(k.zip || k.city) ? `<div>${this._esc((k.zip || '') + ' ' + (k.city || '')).trim()}</div>` : ''}
        ${k.email ? `<div>${this._esc(k.email)}</div>` : ''}
    </div>

    <div class="meta-grid">
        <div class="meta-item">
            <span class="label">Angebotsnummer</span>
            <span class="value">${this._esc(angebot.id)}</span>
        </div>
        <div class="meta-item">
            <span class="label">Angebotsdatum</span>
            <span class="value">${this._date(angebot.createdAt)}</span>
        </div>
        <div class="meta-item">
            <span class="label">Gültig bis</span>
            <span class="value">${validUntil}</span>
        </div>
        ${angebot.leistungsart ? `
        <div class="meta-item">
            <span class="label">Leistungsart</span>
            <span class="value">${this._esc(angebot.leistungsart)}</span>
        </div>` : ''}
    </div>

    <div class="doc-subject">Angebot über: ${this._esc(angebot.leistungsart || angebot.beschreibung || 'Handwerksleistungen')}</div>

    <p class="doc-intro">
        Sehr geehrte(r) ${this._esc(k.name || 'Kundin/Kunde')},<br><br>
        vielen Dank für Ihre Anfrage. Wir unterbreiten Ihnen gerne folgendes Angebot:
    </p>

    <table class="pos-table">
        <thead>
            <tr>
                <th class="right">Pos.</th>
                <th>Menge</th>
                <th>Bezeichnung</th>
                <th class="right">Einzelpreis</th>
                <th class="right">Gesamtpreis</th>
            </tr>
        </thead>
        <tbody>
            ${this._positionRows(angebot.positionen)}
        </tbody>
    </table>

    ${this._totalsBlock(angebot)}

    ${angebot.text ? `<div class="doc-notes">${this._esc(angebot.text).replace(/\n/g, '<br>')}</div>` : ''}

    <div class="doc-notes" style="margin-bottom:0;border-left-color:#94a3b8">
        <strong>Zahlungs- &amp; Lieferbedingungen</strong><br>
        Dieses Angebot ist unverbindlich und gilt bis zum oben genannten Datum.
        ${c.paymentTerms || 'Zahlbar innerhalb von 14 Tagen nach Rechnungsstellung ohne Abzug.'}
        ${c.deliveryTerms ? '<br>' + this._esc(c.deliveryTerms) : ''}
    </div>

    ${this._legalFooter(c)}
</div>
</body>
</html>`;
    }

    // ============================================
    // Public: renderRechnung
    // ============================================
    /**
     * Render a §14 UStG-compliant German Rechnung as a full HTML document.
     * @param {Object} rechnung
     * @param {Object} [companyOverride]
     */
    async renderRechnung(rechnung, companyOverride) {
        const c = companyOverride || await this._getCompany();
        const k = rechnung.kunde || {};
        const dueDateStr = rechnung.zahlungsziel
            ? this._date(rechnung.zahlungsziel)
            : this._date(new Date(Date.now() + 14 * 86400000).toISOString());
        const leistungsdatum = rechnung.leistungsdatum
            ? this._date(rechnung.leistungsdatum)
            : this._date(rechnung.createdAt || new Date().toISOString());

        return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rechnung ${this._esc(rechnung.id)}</title>
${this._css()}
</head>
<body>
<div class="page">

    <div class="doc-header">
        ${this._companyBlock(c)}
        <div class="doc-meta">
            <div class="doc-type">Rechnung</div>
            <div class="doc-number">Nr. ${this._esc(rechnung.id)}</div>
            <div style="margin-top:8px;font-size:12px;color:#374151">
                Rechnungsdatum: ${this._date(rechnung.createdAt || new Date().toISOString())}<br>
                Zahlungsziel: ${dueDateStr}
            </div>
        </div>
    </div>

    <div class="address-block">
        <div class="address-label">Rechnungsempfänger</div>
        ${k.firma ? `<div>${this._esc(k.firma)}</div>` : ''}
        <div class="address-name">${this._esc(k.name || '')}</div>
        ${k.address ? `<div>${this._esc(k.address)}</div>` : ''}
        ${(k.zip || k.city) ? `<div>${this._esc((k.zip||'')+' '+(k.city||'')).trim()}</div>` : ''}
    </div>

    <!-- §14 UStG Pflichtangaben -->
    <div class="meta-grid">
        <div class="meta-item">
            <span class="label">Rechnungsnummer</span>
            <span class="value">${this._esc(rechnung.id)}</span>
        </div>
        <div class="meta-item">
            <span class="label">Rechnungsdatum</span>
            <span class="value">${this._date(rechnung.createdAt)}</span>
        </div>
        <div class="meta-item">
            <span class="label">Leistungsdatum / -zeitraum</span>
            <span class="value">${leistungsdatum}</span>
        </div>
        <div class="meta-item">
            <span class="label">Zahlungsziel</span>
            <span class="value">${dueDateStr}</span>
        </div>
    </div>

    ${rechnung.angebotId ? `
    <div style="font-size:12px;color:#6e6e73;margin-bottom:20px">
        Bezugnehmend auf Angebot ${this._esc(rechnung.angebotId)}
    </div>` : ''}

    <div class="doc-subject">Rechnung für: ${this._esc(rechnung.leistungsart || rechnung.beschreibung || 'Handwerksleistungen')}</div>

    <table class="pos-table">
        <thead>
            <tr>
                <th class="right">Pos.</th>
                <th>Menge</th>
                <th>Bezeichnung</th>
                <th class="right">Einzelpreis</th>
                <th class="right">Gesamtpreis</th>
            </tr>
        </thead>
        <tbody>
            ${this._positionRows(rechnung.positionen)}
        </tbody>
    </table>

    ${this._totalsBlock(rechnung)}

    <div class="doc-notes">
        <strong>Zahlungshinweis</strong><br>
        Bitte überweisen Sie den Gesamtbetrag von <strong>${this._eur(rechnung.brutto)}</strong>
        bis zum ${dueDateStr} auf folgendes Konto:<br>
        ${c.iban ? `IBAN: <strong>${this._esc(c.iban)}</strong>` : ''}
        ${c.bic  ? ` · BIC: ${this._esc(c.bic)}`  : ''}
        ${c.bank ? ` · ${this._esc(c.bank)}`        : ''}
        <br>Verwendungszweck: <strong>Rechnungs-Nr. ${this._esc(rechnung.id)}</strong>
        ${c.paymentTerms ? '<br>' + this._esc(c.paymentTerms) : ''}
    </div>

    ${rechnung.text ? `<div class="doc-notes" style="border-left-color:#94a3b8">${this._esc(rechnung.text).replace(/\n/g,'<br>')}</div>` : ''}

    ${this._legalFooter(c)}
</div>
</body>
</html>`;
    }

    // ============================================
    // Public: renderAuftragsbestaetigung
    // ============================================
    async renderAuftragsbestaetigung(auftrag, companyOverride) {
        const c = companyOverride || await this._getCompany();
        const k = auftrag.kunde || {};

        return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Auftragsbestätigung ${this._esc(auftrag.id)}</title>
${this._css()}
</head>
<body>
<div class="page">
    <div class="doc-header">
        ${this._companyBlock(c)}
        <div class="doc-meta">
            <div class="doc-type">Auftragsbestätigung</div>
            <div class="doc-number">Nr. ${this._esc(auftrag.id)}</div>
            <div style="margin-top:8px;font-size:12px;color:#374151">
                Datum: ${this._date(auftrag.createdAt || new Date().toISOString())}
            </div>
        </div>
    </div>

    <div class="address-block">
        <div class="address-label">An</div>
        ${k.firma ? `<div>${this._esc(k.firma)}</div>` : ''}
        <div class="address-name">${this._esc(k.name || '')}</div>
        ${k.address ? `<div>${this._esc(k.address)}</div>` : ''}
        ${(k.zip||k.city) ? `<div>${this._esc((k.zip||'')+' '+(k.city||'')).trim()}</div>` : ''}
    </div>

    <div class="doc-subject">Auftragsbestätigung: ${this._esc(auftrag.leistungsart || 'Handwerksleistungen')}</div>

    <p class="doc-intro">
        Sehr geehrte(r) ${this._esc(k.name || 'Kundin/Kunde')},<br><br>
        wir bestätigen hiermit den Erhalt Ihres Auftrags und die Durchführung
        der folgenden Arbeiten:
    </p>

    <table class="pos-table">
        <thead>
            <tr>
                <th class="right">Pos.</th>
                <th>Menge</th>
                <th>Bezeichnung</th>
                <th class="right">Einzelpreis</th>
                <th class="right">Gesamtpreis</th>
            </tr>
        </thead>
        <tbody>${this._positionRows(auftrag.positionen)}</tbody>
    </table>

    ${this._totalsBlock(auftrag)}

    <div class="meta-grid" style="margin-top:8px">
        ${auftrag.startDate ? `<div class="meta-item">
            <span class="label">Ausführungsbeginn</span>
            <span class="value">${this._date(auftrag.startDate)}</span>
        </div>` : ''}
        ${auftrag.endDate ? `<div class="meta-item">
            <span class="label">Voraussichtliche Fertigstellung</span>
            <span class="value">${this._date(auftrag.endDate)}</span>
        </div>` : ''}
    </div>

    ${auftrag.text ? `<div class="doc-notes">${this._esc(auftrag.text).replace(/\n/g,'<br>')}</div>` : ''}
    ${this._legalFooter(c)}
</div>
</body>
</html>`;
    }

    // ============================================
    // Public: renderMahnung
    // ============================================
    async renderMahnung(rechnung, mahnungNr, companyOverride) {
        const c = companyOverride || await this._getCompany();
        const k = rechnung.kunde || {};
        const level = mahnungNr || 1;
        const titles = ['Zahlungserinnerung', '1. Mahnung', '2. Mahnung', '3. Mahnung — Letzte Mahnung'];
        const title  = titles[Math.min(level, 3)];

        const newDueDate = this._date(
            new Date(Date.now() + (level === 1 ? 7 : 5) * 86400000).toISOString()
        );
        const mahngebuehr = level >= 2 ? 5.00 * (level - 1) : 0;
        const gesamtOffen = (rechnung.brutto || 0) + mahngebuehr;

        return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} zu Rechnung ${this._esc(rechnung.id)}</title>
${this._css()}
</head>
<body>
<div class="page">
    <div class="doc-header">
        ${this._companyBlock(c)}
        <div class="doc-meta">
            <div class="doc-type" style="color:#dc2626">${this._esc(title)}</div>
            <div class="doc-number">zu Rechnung ${this._esc(rechnung.id)}</div>
            <div style="margin-top:8px;font-size:12px;color:#374151">
                Datum: ${this._date(new Date().toISOString())}<br>
                Neues Zahlungsziel: <strong>${newDueDate}</strong>
            </div>
        </div>
    </div>

    <div class="address-block">
        <div class="address-label">An</div>
        ${k.firma ? `<div>${this._esc(k.firma)}</div>` : ''}
        <div class="address-name">${this._esc(k.name || '')}</div>
        ${k.address ? `<div>${this._esc(k.address)}</div>` : ''}
        ${(k.zip||k.city) ? `<div>${this._esc((k.zip||'')+' '+(k.city||'')).trim()}</div>` : ''}
    </div>

    <div class="doc-subject" style="color:#dc2626">${this._esc(title)}</div>

    <p class="doc-intro">
        Sehr geehrte(r) ${this._esc(k.name || 'Kundin/Kunde')},<br><br>
        trotz unserer${level > 1 ? ' vorherigen Mahnungen' : ''} Zahlungserinnerung ist die nachstehende
        Rechnung bislang nicht beglichen worden. Wir bitten Sie dringend,
        den offenen Betrag bis zum <strong>${newDueDate}</strong> zu überweisen.
    </p>

    <table class="pos-table">
        <thead>
            <tr>
                <th>Rechnungs-Nr.</th>
                <th>Rechnungsdatum</th>
                <th>Fällig seit</th>
                <th class="right">Offener Betrag</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>${this._esc(rechnung.id)}</td>
                <td>${this._date(rechnung.createdAt)}</td>
                <td>${this._date(rechnung.zahlungsziel)}</td>
                <td class="right"><strong>${this._eur(rechnung.brutto)}</strong></td>
            </tr>
            ${mahngebuehr > 0 ? `
            <tr>
                <td colspan="3">Mahngebühr (${this._esc(String(level - 1))}. Mahnung)</td>
                <td class="right">${this._eur(mahngebuehr)}</td>
            </tr>` : ''}
        </tbody>
    </table>

    <div class="totals">
        <table>
            <tr class="total">
                <td>Gesamt offen</td>
                <td class="right">${this._eur(gesamtOffen)}</td>
            </tr>
        </table>
    </div>

    <div class="doc-notes" style="border-left-color:#dc2626">
        Bitte überweisen Sie den Betrag von <strong>${this._eur(gesamtOffen)}</strong>
        bis zum <strong>${newDueDate}</strong> auf:<br>
        ${c.iban ? `IBAN: <strong>${this._esc(c.iban)}</strong>` : ''}
        ${c.bic  ? ` · BIC: ${this._esc(c.bic)}` : ''}
        · Verwendungszweck: Rechnungs-Nr. ${this._esc(rechnung.id)}<br>
        ${level >= 3
            ? 'Bei Nichtzahlung sind wir gezwungen, rechtliche Schritte einzuleiten.'
            : 'Sollte Ihre Zahlung unsere Mahnung gekreuzt haben, betrachten Sie dieses Schreiben als gegenstandslos.'}
    </div>

    ${this._legalFooter(c)}
</div>
</body>
</html>`;
    }

    // ============================================
    // Public: renderEmail
    // Email wrapper — used for any outgoing HTML email.
    // Wraps a body HTML fragment in the standard company
    // header, footer, and layout.
    // ============================================
    /**
     * @param {string} subject - Email subject (shown in header)
     * @param {string} bodyHtml - Inner HTML fragment (no <body> tags)
     * @param {Object} [opts]
     *   opts.company         - Company settings override
     *   opts.recipientName   - Customer name for greeting
     *   opts.portalUrl       - If set, renders a CTA button
     *   opts.portalCtaLabel  - Button label (default: 'Im Kundenportal ansehen →')
     * @returns {Promise<string>} Full HTML email string
     */
    async renderEmail(subject, bodyHtml, opts = {}) {
        const c = opts.company || await this._getCompany();
        const name = c.companyName || 'Mein Betrieb';
        const logo = c.logoUrl
            ? `<img src="${this._esc(c.logoUrl)}" alt="${this._esc(name)}" style="height:44px;object-fit:contain">`
            : `<span style="font-size:20px;font-weight:700;color:#fff">${this._esc(name)}</span>`;

        const cta = opts.portalUrl ? `
            <div style="text-align:center;margin:28px 0">
                <a href="${this._esc(opts.portalUrl)}"
                   style="background:#6366f1;color:#fff;padding:13px 30px;border-radius:8px;
                          font-size:15px;font-weight:600;text-decoration:none;display:inline-block">
                    ${this._esc(opts.portalCtaLabel || 'Im Kundenportal ansehen →')}
                </a>
                <p style="font-size:11px;color:#9ca3af;margin-top:6px">
                    Dieser Link ist persönlich und nur für Sie bestimmt.
                </p>
            </div>` : '';

        const footerParts = [
            c.address,
            c.zip && c.city ? `${c.zip} ${c.city}` : c.city,
            c.phone    ? 'Tel.: ' + c.phone    : '',
            c.taxId    ? 'Steuernr.: ' + c.taxId : '',
            c.vatId    ? 'USt-IdNr.: ' + c.vatId  : '',
        ].filter(Boolean);

        return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1d1d1f">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
       style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">

    <!-- Email Header -->
    <tr><td style="background:#0f172a;padding:20px 32px;text-align:center">
        ${logo}
    </td></tr>

    <!-- Subject bar -->
    <tr><td style="background:#f8fafc;padding:14px 32px;border-bottom:1px solid #e5e7eb">
        <span style="font-size:16px;font-weight:600;color:#0f172a">${this._esc(subject)}</span>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:28px 32px;font-size:14px;line-height:1.7;color:#374151">
        ${bodyHtml}
        ${cta}
    </td></tr>

    <!-- Signature -->
    <tr><td style="padding:0 32px 28px;font-size:14px;color:#374151">
        Mit freundlichen Grüßen<br>
        <strong>${this._esc(name)}</strong>
    </td></tr>

    <!-- Legal footer -->
    <tr><td style="background:#f5f5f7;padding:16px 32px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;line-height:1.7">
        ${footerParts.map(p => this._esc(p)).join(' &nbsp;·&nbsp; ')}
        ${c.iban ? `<br>IBAN: ${this._esc(c.iban)}${c.bic ? ' · BIC: ' + this._esc(c.bic) : ''}` : ''}
    </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
    }
}

window.documentTemplateService = new DocumentTemplateService();
