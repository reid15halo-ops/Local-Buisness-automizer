/* ============================================
   Quote Variants Service
   Generates Budget / Standard / Premium quote
   variants for German craftsmen (Handwerker).

   Depends on: geminiService, supabaseClient (optional)
   ============================================ */

;(function () {
    'use strict';

    // ── Constants ──────────────────────────────────
    const BUDGET_LABOR_FACTOR = 0.80;
    const BUDGET_DISCOUNT_MIN = 0.75;
    const BUDGET_DISCOUNT_MAX = 0.85;
    const PREMIUM_FACTOR = 1.25;
    // Dynamic tax rate: respect Kleinunternehmer setting
    function _getTaxRate() {
        if (typeof window._getTaxRate === 'function') { return window._getTaxRate(); }
        const settings = typeof StorageUtils !== 'undefined'
            ? StorageUtils.getJSON('freyai_admin_settings', {}, { service: 'quoteVariants' })
            : {};
        if (settings.kleinunternehmer === true) { return 0; }
        return 0.19;
    }

    const VARIANT_TYPES = {
        BUDGET: 'budget',
        STANDARD: 'standard',
        PREMIUM: 'premium',
    };

    /**
     * Premium extras keyed by leistungsart.
     * Each entry: { beschreibung, einheit, einzelpreis }
     */
    const PREMIUM_EXTRAS = {
        metallbau: [
            { beschreibung: 'Korrosionsschutz (Premium-Beschichtung)', menge: 1, einheit: 'pauschal', einzelpreis: 480, optional: false },
            { beschreibung: 'TÜV-Abnahme inkl. Prüfprotokoll', menge: 1, einheit: 'pauschal', einzelpreis: 350, optional: false },
            { beschreibung: 'Garantieverlängerung auf 5 Jahre', menge: 1, einheit: 'pauschal', einzelpreis: 290, optional: false },
        ],
        schweissen: [
            { beschreibung: 'Röntgenprüfung der Schweißnähte', menge: 1, einheit: 'pauschal', einzelpreis: 520, optional: false },
            { beschreibung: 'Dokumentation mit Fotodokumentation', menge: 1, einheit: 'pauschal', einzelpreis: 180, optional: false },
            { beschreibung: 'Schweißzertifikat nach DIN EN 1090', menge: 1, einheit: 'pauschal', einzelpreis: 240, optional: false },
        ],
        sanitaer: [
            { beschreibung: 'Markenhersteller-Armaturen (Hansgrohe/Grohe)', menge: 1, einheit: 'pauschal', einzelpreis: 650, optional: false },
            { beschreibung: 'Dichtheitsprüfung mit Protokoll', menge: 1, einheit: 'pauschal', einzelpreis: 220, optional: false },
            { beschreibung: 'Garantieverlängerung auf 5 Jahre', menge: 1, einheit: 'pauschal', einzelpreis: 290, optional: false },
        ],
        heizung: [
            { beschreibung: 'Premium-Kessel (höchste Effizienzklasse)', menge: 1, einheit: 'pauschal', einzelpreis: 1200, optional: false },
            { beschreibung: 'Smart-Thermostat mit App-Steuerung', menge: 1, einheit: 'Stück', einzelpreis: 380, optional: false },
            { beschreibung: '5-Jahres-Wartungsvertrag', menge: 1, einheit: 'pauschal', einzelpreis: 590, optional: false },
        ],
        elektro: [
            { beschreibung: 'KNX/Smart-Home Ready Verkabelung', menge: 1, einheit: 'pauschal', einzelpreis: 780, optional: false },
            { beschreibung: 'Überspannungsschutz Typ 1+2', menge: 1, einheit: 'pauschal', einzelpreis: 340, optional: false },
            { beschreibung: 'Garantieverlängerung auf 5 Jahre', menge: 1, einheit: 'pauschal', einzelpreis: 290, optional: false },
        ],
    };

    /** Generic premium extras when leistungsart is unknown */
    const DEFAULT_PREMIUM_EXTRAS = [
        { beschreibung: 'Garantieverlängerung auf 5 Jahre', menge: 1, einheit: 'pauschal', einzelpreis: 290, optional: false },
        { beschreibung: 'Express-Termin (Prioritätsplanung)', menge: 1, einheit: 'pauschal', einzelpreis: 350, optional: false },
        { beschreibung: 'Nachkontrolle & Wartung (1 Jahr)', menge: 1, einheit: 'pauschal', einzelpreis: 280, optional: false },
        { beschreibung: 'Dokumentation mit Fotos', menge: 1, einheit: 'pauschal', einzelpreis: 180, optional: false },
    ];

    // Keywords that flag a position as "nice-to-have" / optional
    const OPTIONAL_KEYWORDS = [
        'optional', 'zusatz', 'extra', 'upgrade', 'sonder', 'deko',
        'verzierung', 'beschriftung', 'beleuchtung', 'zubehör',
    ];

    // ── Service Class ──────────────────────────────

    class QuoteVariantsService {
        constructor() {
            this._ready = true;
        }

        // ── Public API ─────────────────────────────

        /**
         * Generate 3 quote variants from a base quote.
         *
         * @param {Object} baseQuote
         *   - positionen {Array}  line items
         *   - leistungsart {string}
         *   - kunde {Object}  { name, email, ... }
         *   - anfrage {Object} original inquiry (optional)
         * @returns {Promise<Array>} [budget, standard, premium]
         */
        async generateVariants(baseQuote) {
            if (!baseQuote || !Array.isArray(baseQuote.positionen)) {
                throw new Error('baseQuote mit positionen[] erforderlich');
            }

            const positionen = baseQuote.positionen;
            const leistungsart = (baseQuote.leistungsart || '').toLowerCase();
            const kunde = baseQuote.kunde || {};

            // Build raw variant structures
            const budget = this._createBudgetVariant(positionen, leistungsart);
            const standard = this._createStandardVariant(positionen);
            const premium = this._createPremiumVariant(positionen, leistungsart);

            // Calculate totals for each variant
            this.calculateVariantTotals(budget);
            this.calculateVariantTotals(standard);
            this.calculateVariantTotals(premium);

            // Try to generate AI descriptions, fall back to static texts
            try {
                const texts = await this._generateVariantTexts(
                    [budget, standard, premium],
                    kunde,
                    leistungsart
                );
                budget.beschreibung = texts[0] || budget.beschreibung;
                standard.beschreibung = texts[1] || standard.beschreibung;
                premium.beschreibung = texts[2] || premium.beschreibung;
            } catch (err) {
                console.warn('[QuoteVariants] AI-Text-Generierung fehlgeschlagen, nutze Fallback:', err.message);
                // Static fallback texts already assigned in create methods
            }

            return [budget, standard, premium];
        }

        // ── Variant Builders ───────────────────────

        /**
         * Budget variant: only core positions, cheaper labor.
         */
        _createBudgetVariant(basePositionen, leistungsart) {
            const corePositionen = basePositionen
                .filter(p => !this._isOptionalPosition(p))
                .map(p => {
                    const clone = { ...p };
                    // Reduce reserve / auxiliary quantities by ~20 %
                    if (this._isReserveMaterial(p)) {
                        clone.menge = Math.max(1, Math.round((p.menge || 1) * 0.8));
                    }
                    // Flexible scheduling discount on labor
                    if (this._isLaborPosition(p)) {
                        clone.einzelpreis = Math.round((p.einzelpreis || 0) * BUDGET_LABOR_FACTOR * 100) / 100;
                    }
                    return clone;
                });

            // Ensure at least one position survives filtering
            const positionen = corePositionen.length > 0 ? corePositionen : basePositionen.map(p => ({ ...p }));

            return {
                typ: VARIANT_TYPES.BUDGET,
                label: 'Sparpaket',
                badge: null,
                positionen,
                beschreibung: 'Solide Basisleistung zum fairen Preis',
                highlight: 'Solide Basisleistung zum fairen Preis',
                netto: 0,
                mwst: 0,
                brutto: 0,
            };
        }

        /**
         * Standard variant: base quote as-is, recommended.
         */
        _createStandardVariant(basePositionen) {
            const positionen = basePositionen.map(p => ({ ...p }));

            return {
                typ: VARIANT_TYPES.STANDARD,
                label: 'Empfohlen',
                badge: 'EMPFOHLEN',
                positionen,
                beschreibung: 'Unser Bestseller — optimales Preis-Leistungs-Verhältnis',
                highlight: 'Unser Bestseller — optimales Preis-Leistungs-Verhältnis',
                netto: 0,
                mwst: 0,
                brutto: 0,
            };
        }

        /**
         * Premium variant: standard + extras, higher price tier.
         */
        _createPremiumVariant(basePositionen, leistungsart) {
            const positionen = basePositionen.map(p => ({ ...p }));

            // Determine extras for this trade
            const extras = this._getPremiumExtras(leistungsart);
            positionen.push(...extras.map(e => ({ ...e })));

            // Apply premium factor to all original positions (material upgrades, etc.)
            positionen.forEach((p, i) => {
                if (i < basePositionen.length) {
                    p.einzelpreis = Math.round((p.einzelpreis || 0) * PREMIUM_FACTOR * 100) / 100;
                }
            });

            return {
                typ: VARIANT_TYPES.PREMIUM,
                label: 'Komplettpaket',
                badge: null,
                positionen,
                beschreibung: 'Rundum-Sorglos — inklusive Garantieverlängerung und Premium-Service',
                highlight: 'Rundum-Sorglos — inklusive Garantieverlängerung und Premium-Service',
                netto: 0,
                mwst: 0,
                brutto: 0,
            };
        }

        // ── Totals ─────────────────────────────────

        /**
         * Calculate netto / mwst / brutto for a variant (mutates in place & returns).
         */
        calculateVariantTotals(variant) {
            if (!variant || !Array.isArray(variant.positionen)) return variant;

            const netto = variant.positionen.reduce((sum, p) => {
                const menge = Number(p.menge) || 1;
                const preis = Number(p.einzelpreis) || 0;
                return sum + menge * preis;
            }, 0);

            const taxRate = _getTaxRate();
            variant.netto = Math.round(netto * 100) / 100;
            variant.mwst = Math.round(netto * taxRate * 100) / 100;
            variant.brutto = Math.round((variant.netto + variant.mwst) * 100) / 100;

            return variant;
        }

        // ── Comparison Formatter ───────────────────

        /**
         * Return a structured object suited for a comparison UI.
         *
         * @param {Array} variants  [budget, standard, premium]
         * @returns {Object}
         */
        formatForComparison(variants) {
            if (!Array.isArray(variants) || variants.length !== 3) {
                throw new Error('formatForComparison erwartet ein Array mit 3 Varianten');
            }

            const [budget, standard, premium] = variants;

            return {
                columns: [
                    this._formatColumn(budget),
                    this._formatColumn(standard),
                    this._formatColumn(premium),
                ],
                einsparungBudget: this._pctDiff(budget.brutto, standard.brutto),
                aufpreisPremium: this._pctDiff(premium.brutto, standard.brutto),
                empfohlenerIndex: 1, // Standard is always the recommended column
            };
        }

        // ── AI Text Generation ─────────────────────

        /**
         * Use Gemini to produce 3 short German descriptions in a single call.
         * Falls back gracefully if AI is unavailable.
         */
        async _generateVariantTexts(variants, kunde, leistungsart) {
            const gemini = window.geminiService;
            if (!gemini || !gemini.isConfigured) {
                return [null, null, null];
            }

            // DSGVO: Kundennamen nicht an Gemini senden
            const art = this._sanitize(leistungsart || 'Handwerksleistung');

            const variantSummaries = variants.map(v => {
                const posText = v.positionen.map(p =>
                    `- ${this._sanitize(p.beschreibung)} (${p.menge || 1} ${p.einheit || 'Stk'}, ${this._currency(p.einzelpreis)})`
                ).join('\n');
                return `### ${v.label} (${this._currency(v.brutto)} brutto)\n${posText}`;
            }).join('\n\n');

            const prompt = `Du bist ein professioneller Angebots-Texter für einen deutschen Handwerksbetrieb (${art}).

Erstelle drei kurze Angebots-Beschreibungen (je 80-120 Wörter) für folgende Angebotsvarianten.
Verwende "[Kundenname]" als Platzhalter für den Kundennamen.

${variantSummaries}

Regeln:
- Jede Beschreibung soll den Kundennutzen hervorheben
- Sprache: professionell, direkt, auf Deutsch
- Sparpaket: betone Preis-Effizienz und solide Grundleistung
- Empfohlen: betone das beste Preis-Leistungs-Verhältnis
- Komplettpaket: betone Rundum-Sorglos, Garantie und Premium-Service

Antworte NUR im folgenden JSON-Format (kein Markdown, kein Fließtext):
{"budget":"...","standard":"...","premium":"..."}`;

            try {
                const data = await gemini._callGeminiAPI({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.6,
                        maxOutputTokens: 500,
                    },
                    thinkingConfig: { thinkingBudget: 0 },
                });

                const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!raw) return [null, null, null];

                const jsonMatch = raw.match(/\{[\s\S]*\}/);
                if (!jsonMatch) return [null, null, null];

                try {
                    const parsed = JSON.parse(jsonMatch[0]);
                    return [
                        parsed.budget || null,
                        parsed.standard || null,
                        parsed.premium || null,
                    ];
                } catch {
                    return [null, null, null];
                }
            } catch (err) {
                console.warn('[QuoteVariants] Gemini-Texte fehlgeschlagen:', err.message);
                return [null, null, null];
            }
        }

        // ── Helpers ────────────────────────────────

        _isOptionalPosition(pos) {
            const desc = (pos.beschreibung || '').toLowerCase();
            if (pos.optional === true) return true;
            return OPTIONAL_KEYWORDS.some(kw => desc.includes(kw));
        }

        _isReserveMaterial(pos) {
            const desc = (pos.beschreibung || '').toLowerCase();
            return /reserve|vorrat|puffer|überschuss|sicherheit/i.test(desc);
        }

        _isLaborPosition(pos) {
            const desc = (pos.beschreibung || '').toLowerCase();
            const einheit = (pos.einheit || '').toLowerCase();
            return (
                einheit === 'stunde' || einheit === 'std' || einheit === 'h' ||
                /arbeitszeit|montage|lohn|stunden/i.test(desc)
            );
        }

        _getPremiumExtras(leistungsart) {
            const la = (leistungsart || '').toLowerCase();
            // Try exact match first, then keyword match
            if (PREMIUM_EXTRAS[la]) return PREMIUM_EXTRAS[la];

            for (const [key, extras] of Object.entries(PREMIUM_EXTRAS)) {
                if (la.includes(key)) return extras;
            }
            return DEFAULT_PREMIUM_EXTRAS;
        }

        _formatColumn(variant) {
            return {
                typ: variant.typ,
                label: variant.label,
                badge: variant.badge,
                beschreibung: variant.beschreibung,
                highlight: variant.highlight,
                positionenCount: variant.positionen.length,
                positionen: variant.positionen,
                netto: variant.netto,
                mwst: variant.mwst,
                brutto: variant.brutto,
                bruttoFormatted: this._currency(variant.brutto),
            };
        }

        _pctDiff(value, reference) {
            if (!reference) return 0;
            return Math.round(((value - reference) / reference) * 100);
        }

        _currency(amount) {
            const num = Number(amount) || 0;
            return num.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        }

        _sanitize(str) {
            if (!str) return '';
            return String(str).replace(/[<>{}]/g, '').substring(0, 2000);
        }
    }

    // ── Singleton ──────────────────────────────────
    window.quoteVariantsService = new QuoteVariantsService();
})();
