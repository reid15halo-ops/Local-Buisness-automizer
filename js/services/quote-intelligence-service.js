/* ============================================
   Quote Intelligence Service
   KI-gestuetzte Angebotserstellung mit Positionszuordnung,
   Preishistorie und professioneller Textgenerierung.

   Nutzt Gemini API (via Proxy) fuer Analyse und Textgenerierung.
   Fallback-Logik bei fehlender KI-Verfuegbarkeit.
   ============================================ */

(function() {
'use strict';

const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

// ============================================
// Position Template Map (leichtgewichtige Zuordnung)
// ============================================
const POSITION_TEMPLATE_MAP = {
    metallbau: [
        { beschreibung: 'Treppe anfertigen und montieren', einheit: 'Pauschal', defaultPreis: 4500, details: 'Aufmass, Fertigung und Montage einer Stahltreppe inkl. Gelaender, Oberflaechenbehandlung und Abnahme.' },
        { beschreibung: 'Gelaender anfertigen und montieren', einheit: 'Stk', defaultPreis: 1800, details: 'Fertigung und Montage eines Stahl- oder Edelstahlgelaenders nach Zeichnung, inkl. Befestigungsmaterial und Korrosionsschutz.' },
        { beschreibung: 'Tor anfertigen und montieren', einheit: 'Stk', defaultPreis: 3200, details: 'Fertigung und Montage eines Stahltors (Dreh- oder Schiebetor) inkl. Scharniere, Schloss und Oberflaechenbehandlung.' },
        { beschreibung: 'Schweissarbeiten (allgemein)', einheit: 'Std', defaultPreis: 85, details: 'Fachgerechte Schweissarbeiten durch zertifizierte Schweisskraft. Verfahren nach Bedarf (WIG, MAG, MIG). Material separat.' },
        { beschreibung: 'Stahlkonstruktion fertigen und montieren', einheit: 'Pauschal', defaultPreis: 6500, details: 'Planung, Fertigung und Montage einer Stahlkonstruktion nach statischer Berechnung. Inkl. Korrosionsschutz und Abnahmedokumentation.' },
        { beschreibung: 'Reparatur Metallbauteile', einheit: 'Std', defaultPreis: 75, details: 'Instandsetzung beschaedigter Metallbauteile vor Ort oder in der Werkstatt. Inkl. Befundaufnahme.' },
    ],
    schweissen: [
        { beschreibung: 'WIG-Schweissarbeiten', einheit: 'Std', defaultPreis: 95, details: 'WIG-Schweissarbeiten (Wolfram-Inertgas) fuer Edelstahl und Aluminium. Hoechste Nahtqualitaet, zertifiziertes Personal.' },
        { beschreibung: 'MAG-Schweissarbeiten', einheit: 'Std', defaultPreis: 80, details: 'MAG-Schweissarbeiten (Metall-Aktivgas) fuer Baustahl und Stahlkonstruktionen. Effizient und kostenguenstig.' },
        { beschreibung: 'MIG-Schweissarbeiten', einheit: 'Std', defaultPreis: 85, details: 'MIG-Schweissarbeiten (Metall-Inertgas) fuer Aluminium und NE-Metalle. Saubere Naehte, spritzerarm.' },
        { beschreibung: 'Schweisskonstruktion nach Zeichnung', einheit: 'Pauschal', defaultPreis: 2500, details: 'Komplettfertigung einer Schweisskonstruktion nach technischer Zeichnung. Inkl. Materialzuschnitt, Schweissen und Nachbearbeitung.' },
        { beschreibung: 'Schweissnaht-Pruefung (Sichtpruefung)', einheit: 'Stk', defaultPreis: 45, details: 'Visuelle Schweissnahtpruefung nach DIN EN ISO 5817. Dokumentation mit Pruefprotokoll.' },
    ],
    rohrleitungsbau: [
        { beschreibung: 'Druckluftleitung verlegen', einheit: 'm', defaultPreis: 65, details: 'Verlegung von Druckluftleitungen (Aluminium oder Stahl) inkl. Fittings, Halterungen und Druckpruefung.' },
        { beschreibung: 'Dampfleitung verlegen', einheit: 'm', defaultPreis: 95, details: 'Fachgerechte Verlegung von Dampfleitungen inkl. Isolierung, Kompensatoren und Druckpruefung nach DGRL.' },
        { beschreibung: 'Oelleitung verlegen', einheit: 'm', defaultPreis: 75, details: 'Verlegung von Oelleitungen (Hydraulik-/Schmieroel) mit doppelwandiger Ausfuehrung nach WHG. Leckagepruefung inklusive.' },
        { beschreibung: 'Rohrmontage (allgemein)', einheit: 'Std', defaultPreis: 78, details: 'Allgemeine Rohrmontagearbeiten inkl. Zuschnitt, Biegen, Anpassen und Verbinden. Material wird separat berechnet.' },
        { beschreibung: 'Druckpruefung und Dokumentation', einheit: 'Pauschal', defaultPreis: 350, details: 'Druckpruefung der verlegten Rohrleitungen nach Norm inkl. Messprotokoll und Abnahmedokumentation.' },
    ],
    heizung: [
        { beschreibung: 'Heizkessel austauschen', einheit: 'Pauschal', defaultPreis: 4800, details: 'Demontage Altgeraet, Montage und Anschluss des neuen Heizkessels, Inbetriebnahme und Funktionstest. Inkl. Entsorgung.' },
        { beschreibung: 'Heizkoerper montieren', einheit: 'Stk', defaultPreis: 380, details: 'Montage inkl. Wandhalterungen, Thermostatventil, Vor-/Ruecklaufanschluss, Entlueftung und hydraulischer Abgleich.' },
        { beschreibung: 'Fussbodenheizung installieren', einheit: 'm²', defaultPreis: 55, details: 'Verlegung der Heizrohre, Anschluss an Verteiler, Druckpruefung, Inbetriebnahme und hydraulischer Abgleich.' },
        { beschreibung: 'Heizungsanlage warten (Jahresinspektion)', einheit: 'Pauschal', defaultPreis: 280, details: 'Vollstaendige Jahreswartung: Brenner-Reinigung, Sicherheitspruefung, Verbrennungsmessung, Wartungsbericht.' },
        { beschreibung: 'Thermostatventil austauschen', einheit: 'Stk', defaultPreis: 85, details: 'Demontage altes Ventil, Montage neues Thermostatventil mit voreinstellbarer Ruecklaufeinstellung und Funktionstest.' },
    ],
    sanitaer: [
        { beschreibung: 'Wasserleitung verlegen', einheit: 'm', defaultPreis: 48, details: 'Fachgerechte Verlegung von Trinkwasserleitungen inkl. Fittings, Daemmung und Druckpruefung nach DVGW.' },
        { beschreibung: 'WC / Toilette montieren', einheit: 'Stk', defaultPreis: 420, details: 'Komplette Montage der WC-Einheit inkl. Anschluesse, Dichtheitspruefung und Funktionstest.' },
        { beschreibung: 'Dusche installieren', einheit: 'Stk', defaultPreis: 650, details: 'Montage Duschwanne/Duschkabine, Armatur-Anschluss, Abdichtung, Silikonfugen und Funktionstest.' },
        { beschreibung: 'Armatur wechseln', einheit: 'Stk', defaultPreis: 120, details: 'Demontage alte Armatur, Montage neue Armatur mit Dichtungen, Anschlussschlaeuchen und Dichtheitspruefung.' },
        { beschreibung: 'Rohrbruch / Leckage reparieren', einheit: 'Pauschal', defaultPreis: 380, details: 'Lokalisierung, Absperrung, Reparatur und Dichtheitspruefung. Umliegende Bauteile werden auf Folgeschaeden geprueft.' },
    ],
    elektro: [
        { beschreibung: 'Elektroinstallation (Steckdosen/Schalter)', einheit: 'Stk', defaultPreis: 95, details: 'Fachgerechte Installation nach VDE 0100, inkl. Verdrahtung, Absicherung und Messprotokoll.' },
        { beschreibung: 'Kabelverlegung', einheit: 'm', defaultPreis: 18, details: 'Verlegung von Elektrokabeln in Leerrohren oder Kabelkanaelen, inkl. Kennzeichnung und Isolationspruefung.' },
        { beschreibung: 'Sicherungsanlage pruefen', einheit: 'Pauschal', defaultPreis: 280, details: 'Sichtpruefung, FI-Test, Isolationsmessung, Schleifenimpedanz. Vollstaendiges Pruefprotokoll nach DIN VDE 0105.' },
        { beschreibung: 'Beleuchtung installieren', einheit: 'Stk', defaultPreis: 110, details: 'Montage und Verdrahtung der Leuchte, Pruefung der Absicherung, Funktionstest und ggf. Dimmeinstellung.' },
        { beschreibung: 'Verteilerkasten erneuern', einheit: 'Pauschal', defaultPreis: 1800, details: 'Demontage alter Verteiler, Montage neuer Verteilerkasten, Umsetzung aller Stromkreise, FI-Schutzschalter, Pruefprotokoll.' },
    ],
};

// Mapping von Leistungsart-Keywords auf Template-Kategorien
const LEISTUNGSART_CATEGORY_MAP = {
    metallbau: 'metallbau',
    metall: 'metallbau',
    stahl: 'metallbau',
    treppen: 'metallbau',
    gelaender: 'metallbau',
    geländer: 'metallbau',
    tor: 'metallbau',
    zaun: 'metallbau',
    schweiss: 'schweissen',
    schweiß: 'schweissen',
    schweissen: 'schweissen',
    schweißen: 'schweissen',
    wig: 'schweissen',
    mag: 'schweissen',
    mig: 'schweissen',
    rohrleitungsbau: 'rohrleitungsbau',
    rohrleitung: 'rohrleitungsbau',
    druckluft: 'rohrleitungsbau',
    dampf: 'rohrleitungsbau',
    pipeline: 'rohrleitungsbau',
    heizung: 'heizung',
    heizkessel: 'heizung',
    heizkoerper: 'heizung',
    heizkörper: 'heizung',
    fussbodenheizung: 'heizung',
    fußbodenheizung: 'heizung',
    sanitaer: 'sanitaer',
    sanitär: 'sanitaer',
    wasser: 'sanitaer',
    abwasser: 'sanitaer',
    bad: 'sanitaer',
    dusche: 'sanitaer',
    wc: 'sanitaer',
    toilette: 'sanitaer',
    elektro: 'elektro',
    elektrisch: 'elektro',
    strom: 'elektro',
    kabel: 'elektro',
    sicherung: 'elektro',
    beleuchtung: 'elektro',
};

// ============================================
// QuoteIntelligenceService
// ============================================
class QuoteIntelligenceService {
    constructor() {
        this._cache = new Map();
        this._cacheTTL = 30 * 60 * 1000; // 30 Minuten
    }

    // ── Supabase Client Helper ──────────────────────────────────────
    _getDB() {
        const db = window.supabaseClient?.client || window.supabase;
        if (!db) {
            console.warn('[QuoteIntelligence] Kein Supabase-Client verfuegbar');
        }
        return db;
    }

    // ── Input Sanitization ──────────────────────────────────────────
    _sanitizeForPrompt(str) {
        if (!str) {return '';}
        return String(str).replace(/[<>{}]/g, '').substring(0, 2000);
    }

    // ── Business Info Helpers ───────────────────────────────────────
    _getBusinessType() {
        const ap = StorageUtils.getJSON('freyai_admin_settings', {}, { service: 'quoteIntelligenceService' });
        return ap.business_type || window.storeService?.state?.settings?.businessType || 'Handwerksbetrieb';
    }

    _getCompanyName() {
        const ap = StorageUtils.getJSON('freyai_admin_settings', {}, { service: 'quoteIntelligenceService' });
        return ap.company_name || window.storeService?.state?.settings?.companyName || 'FreyAI Visions';
    }

    _isKleinunternehmer() {
        const ap = StorageUtils.getJSON('freyai_admin_settings', {}, { service: 'quoteIntelligenceService' });
        return ap.kleinunternehmer === true || ap.kleinunternehmer === 'true';
    }

    // ── Gemini Response Extraction ──────────────────────────────────
    _extractText(data) {
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    _extractJSON(data) {
        const text = this._extractText(data);
        if (!text) {return null;}
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {return null;}
        try {
            return JSON.parse(jsonMatch[0]);
        } catch {
            console.warn('[QuoteIntelligence] JSON-Parsing fehlgeschlagen');
            return null;
        }
    }

    // ============================================
    // 1. generateSmartQuote(anfrageId) — Haupt-Einstiegspunkt
    // ============================================
    async generateSmartQuote(anfrageId) {
        if (!anfrageId) {
            throw new Error('Anfrage-ID ist erforderlich');
        }

        try {
            // Anfrage und Kundendaten laden
            const anfrage = await this._fetchAnfrage(anfrageId);
            if (!anfrage) {
                throw new Error(`Anfrage ${anfrageId} nicht gefunden`);
            }

            const kunde = await this._fetchKunde(anfrage.kunde_id || anfrage.kunde?.id);

            // KI-Analyse der Anfrage
            const analysis = await this._analyzeAnfrage(anfrage);

            // Passende Positionen finden
            const positionen = this._matchPositions(analysis, anfrage.leistungsart);

            // Preisintelligenz laden
            const priceData = await this._getPriceIntelligence(anfrage.leistungsart, positionen);

            // Preise ggf. anhand Preisintelligenz anpassen
            const adjustedPositionen = this._adjustPrices(positionen, priceData);

            // Summen berechnen
            const totals = this._calculateTotals(adjustedPositionen);

            // Professionellen Angebotstext generieren
            const angebotsText = await this._generateQuoteText(anfrage, kunde, adjustedPositionen, priceData);

            // Gueltig-bis Datum (30 Tage)
            const gueltigBis = new Date();
            gueltigBis.setDate(gueltigBis.getDate() + 30);

            return {
                anfrage_id: anfrageId,
                kunde_name: kunde?.name || anfrage.kunde?.name || 'Unbekannt',
                kunde_email: kunde?.email || anfrage.kunde?.email || '',
                kunde_telefon: kunde?.telefon || anfrage.kunde?.telefon || '',
                leistungsart: anfrage.leistungsart || '',
                positionen: adjustedPositionen,
                angebots_text: angebotsText,
                netto: totals.netto,
                mwst: totals.mwst,
                brutto: totals.brutto,
                gueltig_bis: gueltigBis.toISOString().split('T')[0],
                status: 'entwurf',
                _meta: {
                    analysis,
                    priceIntelligence: priceData,
                    generatedAt: new Date().toISOString(),
                    generatedBy: 'quote-intelligence-service',
                },
            };
        } catch (error) {
            console.error('[QuoteIntelligence] Fehler bei Smart-Quote-Generierung:', error);
            throw error;
        }
    }

    // ── Daten-Loader ────────────────────────────────────────────────

    async _fetchAnfrage(anfrageId) {
        // Erst aus lokalem Store versuchen
        const localAnfrage = window.AppUtils?.store?.anfragen?.find(a => a.id === anfrageId);
        if (localAnfrage) {return localAnfrage;}

        // Dann Supabase
        const db = this._getDB();
        if (!db) {return null;}

        try {
            const { data, error } = await db
                .from('anfragen')
                .select('*')
                .eq('id', anfrageId)
                .single();

            if (error) {
                console.error('[QuoteIntelligence] Anfrage laden fehlgeschlagen:', error);
                return null;
            }
            return data;
        } catch (err) {
            console.error('[QuoteIntelligence] Anfrage-Fetch Fehler:', err);
            return null;
        }
    }

    async _fetchKunde(kundeId) {
        if (!kundeId) {return null;}

        // Erst aus lokalem Store versuchen
        const localKunde = window.AppUtils?.store?.kunden?.find(k => k.id === kundeId);
        if (localKunde) {return localKunde;}

        // Dann Supabase
        const db = this._getDB();
        if (!db) {return null;}

        try {
            const { data, error } = await db
                .from('kunden')
                .select('*')
                .eq('id', kundeId)
                .single();

            if (error) {
                console.warn('[QuoteIntelligence] Kunde laden fehlgeschlagen:', error);
                return null;
            }
            return data;
        } catch (err) {
            console.warn('[QuoteIntelligence] Kunden-Fetch Fehler:', err);
            return null;
        }
    }

    // ============================================
    // 2. _analyzeAnfrage(anfrage) — KI-Analyse
    // ============================================
    async _analyzeAnfrage(anfrage) {
        const gemini = window.geminiService;
        if (!gemini?.isConfigured) {
            return this._getFallbackAnalysis(anfrage);
        }

        const prompt = `Du bist ein erfahrener Kalkulations-Experte fuer einen ${this._getBusinessType()}.
Analysiere folgende Kundenanfrage und extrahiere strukturierte Informationen.

Anfrage:
- Leistungsart: ${this._sanitizeForPrompt(anfrage.leistungsart || 'Nicht angegeben')}
- Beschreibung: ${this._sanitizeForPrompt(anfrage.beschreibung || 'Keine Beschreibung')}
${anfrage.budget ? `- Budget: ${this._sanitizeForPrompt(String(anfrage.budget))} EUR` : ''}
${anfrage.termin ? `- Wunschtermin: ${anfrage.termin}` : ''}

Antworte NUR im JSON-Format:
{
  "leistungsart": "erkannte Leistungsart (z.B. metallbau, schweissen, rohrleitungsbau, heizung, sanitaer, elektro)",
  "scope": {
    "stunden": geschaetzte Arbeitsstunden (Zahl),
    "meter": geschaetzte Meter falls relevant (Zahl oder null),
    "stueck": geschaetzte Stueckzahl falls relevant (Zahl oder null),
    "quadratmeter": geschaetzte Flaeche falls relevant (Zahl oder null)
  },
  "materialien": ["Liste benoetigter Materialien"],
  "komplexitaet": "einfach|mittel|komplex",
  "dringlichkeit": "normal|hoch|sehr_hoch",
  "zusammenfassung": "Kurze Zusammenfassung des Auftrags in 1-2 Saetzen"
}`;

        try {
            const data = await gemini._callGeminiAPI({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 400,
                },
                thinkingConfig: { thinkingBudget: 1024 },
            });

            const parsed = this._extractJSON(data);
            if (parsed && parsed.leistungsart) {
                return parsed;
            }
            return this._getFallbackAnalysis(anfrage);
        } catch (error) {
            console.warn('[QuoteIntelligence] Analyse fehlgeschlagen:', error.message);
            return this._getFallbackAnalysis(anfrage);
        }
    }

    _getFallbackAnalysis(anfrage) {
        const la = (anfrage.leistungsart || '').toLowerCase();
        let category = 'metallbau';

        for (const [keyword, cat] of Object.entries(LEISTUNGSART_CATEGORY_MAP)) {
            if (la.includes(keyword)) {
                category = cat;
                break;
            }
        }

        // Komplexitaet aus Beschreibungslaenge schaetzen
        const descLength = (anfrage.beschreibung || '').length;
        let komplexitaet = 'mittel';
        if (descLength < 50) {komplexitaet = 'einfach';}
        if (descLength > 200) {komplexitaet = 'komplex';}

        return {
            leistungsart: category,
            scope: {
                stunden: komplexitaet === 'einfach' ? 4 : komplexitaet === 'mittel' ? 8 : 16,
                meter: null,
                stueck: null,
                quadratmeter: null,
            },
            materialien: [],
            komplexitaet,
            dringlichkeit: 'normal',
            zusammenfassung: anfrage.beschreibung || anfrage.leistungsart || 'Handwerksleistung',
        };
    }

    // ============================================
    // 3. _matchPositions(analysis, leistungsart)
    // ============================================
    _matchPositions(analysis, leistungsart) {
        const la = (analysis.leistungsart || leistungsart || '').toLowerCase();

        // Kategorie bestimmen
        let category = null;
        for (const [keyword, cat] of Object.entries(LEISTUNGSART_CATEGORY_MAP)) {
            if (la.includes(keyword)) {
                category = cat;
                break;
            }
        }

        const templates = POSITION_TEMPLATE_MAP[category] || POSITION_TEMPLATE_MAP.metallbau;

        // Positionen aus Templates erzeugen
        const positionen = [];
        const scope = analysis.scope || {};

        // Hauptposition(en) basierend auf Scope
        if (scope.meter && scope.meter > 0) {
            // Meter-basierte Position suchen
            const meterTemplate = templates.find(t => t.einheit === 'm');
            if (meterTemplate) {
                positionen.push({
                    beschreibung: meterTemplate.beschreibung,
                    menge: scope.meter,
                    einheit: 'm',
                    einzelpreis: meterTemplate.defaultPreis,
                    details: meterTemplate.details,
                });
            }
        }

        if (scope.stueck && scope.stueck > 0) {
            // Stueck-basierte Position suchen
            const stueckTemplate = templates.find(t => t.einheit === 'Stk');
            if (stueckTemplate) {
                positionen.push({
                    beschreibung: stueckTemplate.beschreibung,
                    menge: scope.stueck,
                    einheit: 'Stk',
                    einzelpreis: stueckTemplate.defaultPreis,
                    details: stueckTemplate.details,
                });
            }
        }

        if (scope.quadratmeter && scope.quadratmeter > 0) {
            const qmTemplate = templates.find(t => t.einheit === 'm²');
            if (qmTemplate) {
                positionen.push({
                    beschreibung: qmTemplate.beschreibung,
                    menge: scope.quadratmeter,
                    einheit: 'm²',
                    einzelpreis: qmTemplate.defaultPreis,
                    details: qmTemplate.details,
                });
            }
        }

        // Arbeitsstunden-Position hinzufuegen (wenn Stunden geschaetzt)
        if (scope.stunden && scope.stunden > 0) {
            const stdTemplate = templates.find(t => t.einheit === 'Std');
            if (stdTemplate) {
                positionen.push({
                    beschreibung: stdTemplate.beschreibung,
                    menge: scope.stunden,
                    einheit: 'Std',
                    einzelpreis: stdTemplate.defaultPreis,
                    details: stdTemplate.details,
                });
            }
        }

        // Falls keine Positionen zugeordnet werden konnten: Pauschal-Fallback
        if (positionen.length === 0) {
            const pauschalTemplate = templates.find(t => t.einheit === 'Pauschal') || templates[0];
            positionen.push({
                beschreibung: pauschalTemplate.beschreibung,
                menge: 1,
                einheit: pauschalTemplate.einheit,
                einzelpreis: pauschalTemplate.defaultPreis,
                details: pauschalTemplate.details,
            });
        }

        // Materialien als separate Position (falls aus Analyse bekannt)
        if (analysis.materialien && analysis.materialien.length > 0) {
            const matBeschreibung = analysis.materialien.slice(0, 5).join(', ');
            positionen.push({
                beschreibung: `Material: ${matBeschreibung}`,
                menge: 1,
                einheit: 'Pauschal',
                einzelpreis: 0, // Wird spaeter durch Preisintelligenz gefuellt
                details: `Benoetigte Materialien: ${analysis.materialien.join(', ')}. Preis nach Aufmass und Materialbedarf.`,
            });
        }

        return positionen;
    }

    // ============================================
    // 4. _getPriceIntelligence(leistungsart, positionen)
    // ============================================
    async _getPriceIntelligence(leistungsart, positionen) {
        const fallback = {
            avgPrice: null,
            acceptanceRate: null,
            minPrice: null,
            maxPrice: null,
            sampleSize: 0,
            confidence: 'niedrig',
            suggestion: null,
        };

        const db = this._getDB();
        if (!db || !leistungsart) {return fallback;}

        try {
            // RPC-Aufruf fuer Preisintelligenz
            const { data, error } = await db.rpc('get_price_intelligence', {
                p_tenant_id: TENANT_ID,
                p_leistungsart: leistungsart,
            });

            if (error) {
                // RPC existiert moeglicherweise noch nicht — kein harter Fehler
                console.warn('[QuoteIntelligence] RPC get_price_intelligence fehlgeschlagen:', error.message);
                return this._getFallbackPriceIntelligence(leistungsart);
            }

            if (!data || (Array.isArray(data) && data.length === 0)) {
                return this._getFallbackPriceIntelligence(leistungsart);
            }

            const result = Array.isArray(data) ? data[0] : data;

            return {
                avgPrice: parseFloat(result.avg_price) || null,
                acceptanceRate: parseFloat(result.acceptance_rate) || null,
                minPrice: parseFloat(result.min_price) || null,
                maxPrice: parseFloat(result.max_price) || null,
                sampleSize: parseInt(result.sample_size, 10) || 0,
                confidence: (result.sample_size || 0) >= 10 ? 'hoch' : (result.sample_size || 0) >= 3 ? 'mittel' : 'niedrig',
                suggestion: result.avg_price ? `Durchschnittspreis: ${parseFloat(result.avg_price).toFixed(2)} EUR` : null,
            };
        } catch (err) {
            console.warn('[QuoteIntelligence] Preisintelligenz Fehler:', err);
            return this._getFallbackPriceIntelligence(leistungsart);
        }
    }

    _getFallbackPriceIntelligence(leistungsart) {
        // Statische Preisschaetzungen basierend auf Leistungsart
        const estimates = {
            metallbau: { avgPrice: 2500, minPrice: 800, maxPrice: 8000 },
            schweissen: { avgPrice: 1200, minPrice: 400, maxPrice: 4000 },
            rohrleitungsbau: { avgPrice: 3000, minPrice: 1000, maxPrice: 10000 },
            heizung: { avgPrice: 2200, minPrice: 500, maxPrice: 6000 },
            sanitaer: { avgPrice: 1500, minPrice: 300, maxPrice: 5000 },
            elektro: { avgPrice: 1000, minPrice: 200, maxPrice: 4000 },
        };

        const la = (leistungsart || '').toLowerCase();
        let match = estimates.metallbau;
        for (const [key, val] of Object.entries(estimates)) {
            if (la.includes(key)) {
                match = val;
                break;
            }
        }

        return {
            avgPrice: match.avgPrice,
            acceptanceRate: null,
            minPrice: match.minPrice,
            maxPrice: match.maxPrice,
            sampleSize: 0,
            confidence: 'niedrig',
            suggestion: `Schaetzung basierend auf Branchendurchschnitt: ${match.avgPrice} EUR`,
        };
    }

    // ── Preisanpassung anhand Preisintelligenz ──────────────────────

    _adjustPrices(positionen, priceData) {
        if (!priceData || !priceData.avgPrice || priceData.confidence === 'niedrig') {
            return positionen;
        }

        // Aktuellen Gesamtpreis berechnen
        const currentTotal = positionen.reduce((sum, p) => sum + (p.menge * p.einzelpreis), 0);
        if (currentTotal <= 0) {return positionen;}

        // Wenn der aktuelle Preis stark vom Durchschnitt abweicht (>30%), moderat anpassen
        const ratio = priceData.avgPrice / currentTotal;
        if (ratio < 0.7 || ratio > 1.3) {
            const adjustFactor = Math.max(0.8, Math.min(1.2, ratio));
            return positionen.map(p => ({
                ...p,
                einzelpreis: Math.round(p.einzelpreis * adjustFactor * 100) / 100,
            }));
        }

        return positionen;
    }

    // ============================================
    // 5. _generateQuoteText(anfrage, kunde, positionen, priceData)
    // ============================================
    async _generateQuoteText(anfrage, kunde, positionen, priceData) {
        const gemini = window.geminiService;
        if (!gemini?.isConfigured) {
            return this._getFallbackQuoteText(anfrage, kunde, positionen);
        }

        const totals = this._calculateTotals(positionen);
        const positionenText = positionen
            .map((p, i) => `${i + 1}. ${p.beschreibung} (${p.menge} ${p.einheit} x ${p.einzelpreis} EUR)`)
            .join('\n');

        const companyName = this._getCompanyName();
        const bizType = this._getBusinessType();
        // DSGVO: Kundenname nicht an Gemini senden — Platzhalter verwenden
        const kundeAnrede = (kunde?.anrede || anfrage.kunde?.anrede || '') === 'Frau' ? 'Sehr geehrte Frau [Kundenname]' : 'Sehr geehrter Herr [Kundenname]';

        const prompt = `Du bist ein professioneller Angebots-Schreiber fuer die Firma ${companyName} (${bizType}).
Erstelle einen professionellen, deutschsprachigen Angebotstext.
Verwende "[Kundenname]" als Platzhalter fuer den Kundennamen — dieser wird spaeter ersetzt.

Kunde: ${kundeAnrede}
Leistungsart: ${this._sanitizeForPrompt(anfrage.leistungsart || 'Handwerksleistung')}
Beschreibung der Anfrage: ${this._sanitizeForPrompt(anfrage.beschreibung || '')}

Geplante Positionen:
${positionenText}

Gesamtbetrag netto: ${totals.netto.toFixed(2)} EUR
MwSt (${this._isKleinunternehmer() ? '0' : '19'}%): ${totals.mwst.toFixed(2)} EUR
Gesamtbetrag brutto: ${totals.brutto.toFixed(2)} EUR

Der Text soll:
- Den Kunden mit Namen ansprechen
- Die geplanten Arbeiten im Detail beschreiben
- Verwendete Materialien erwaehnen
- Zahlungsbedingungen nennen: 30 Tage Zahlungsziel${totals.brutto > 5000 ? ', 50% Anzahlung bei Auftragserteilung' : ''}
- Gueltigkeit des Angebots: 30 Tage
- 200-300 Woerter, professioneller Ton
- Mit freundlichen Gruessen und Firmenname abschliessen

Antworte NUR mit dem Angebotstext, ohne zusaetzliche Erklaerungen.`;

        try {
            const data = await gemini._callGeminiAPI({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500,
                },
                thinkingConfig: { thinkingBudget: 0 },
            });

            let generatedText = this._extractText(data);
            if (generatedText && generatedText.length > 50) {
                // Replace placeholder with actual customer name (DSGVO: name only client-side)
                const realName = kunde?.name || anfrage.kunde?.name || 'Sehr geehrte Damen und Herren';
                generatedText = generatedText.replace(/\[Kundenname\]/g, realName);
                return generatedText;
            }
            return this._getFallbackQuoteText(anfrage, kunde, positionen);
        } catch (error) {
            console.warn('[QuoteIntelligence] Textgenerierung fehlgeschlagen:', error.message);
            return this._getFallbackQuoteText(anfrage, kunde, positionen);
        }
    }

    _getFallbackQuoteText(anfrage, kunde, positionen) {
        const companyName = this._getCompanyName();
        const kundeName = kunde?.name || anfrage.kunde?.name || 'Sehr geehrte Damen und Herren';
        const leistungsart = anfrage.leistungsart || 'die gewuenschten Arbeiten';
        const totals = this._calculateTotals(positionen);
        const isKleinunternehmer = this._isKleinunternehmer();
        const anzahlung = totals.brutto > 5000 ? '\n\nBei Auftragserteilung wird eine Anzahlung in Hoehe von 50% des Gesamtbetrags faellig.' : '';

        const posText = positionen
            .filter(p => p.einzelpreis > 0)
            .map(p => `- ${p.beschreibung}`)
            .join('\n');

        return `Sehr geehrte(r) ${kundeName},

vielen Dank fuer Ihre Anfrage zum Thema "${leistungsart}". Gerne unterbreiten wir Ihnen folgendes Angebot fuer die gewuenschten Leistungen.

Das Angebot umfasst folgende Arbeiten:
${posText}

Alle aufgefuehrten Positionen beinhalten Arbeitsleistung und Kleinmaterial. Groessere Materialposten sind separat ausgewiesen. Die Ausfuehrung erfolgt fachgerecht nach den anerkannten Regeln der Technik.

Gesamtbetrag: ${totals.brutto.toFixed(2)} EUR ${isKleinunternehmer ? '(Kleinunternehmerregelung gemaess §19 UStG, keine MwSt ausgewiesen)' : '(inkl. 19% MwSt)'}

Zahlungsbedingungen: 30 Tage netto ab Rechnungsdatum.${anzahlung}

Dieses Angebot ist 30 Tage gueltig. Aenderungen im Arbeitsumfang werden nach vorheriger Absprache gesondert berechnet.

Bei Fragen stehen wir Ihnen gerne zur Verfuegung. Wir freuen uns auf Ihren Auftrag!

Mit freundlichen Gruessen
${companyName}`;
    }

    // ============================================
    // 6. _calculateTotals(positionen)
    // ============================================
    _calculateTotals(positionen) {
        if (!Array.isArray(positionen) || positionen.length === 0) {
            return { netto: 0, mwst: 0, brutto: 0 };
        }

        const netto = positionen.reduce((sum, p) => {
            const menge = parseFloat(p.menge) || 0;
            const preis = parseFloat(p.einzelpreis) || 0;
            return sum + (menge * preis);
        }, 0);

        const roundedNetto = Math.round(netto * 100) / 100;

        // Kleinunternehmer: 0% MwSt; Standard: 19%
        const isKleinunternehmer = this._isKleinunternehmer();
        const taxRate = isKleinunternehmer ? 0 : 0.19;

        // Ggf. globale Tax-Rate aus App nutzen
        const effectiveRate = (typeof window._getTaxRate === 'function') ? window._getTaxRate() : taxRate;

        const mwst = Math.round(roundedNetto * effectiveRate * 100) / 100;
        const brutto = Math.round((roundedNetto + mwst) * 100) / 100;

        return { netto: roundedNetto, mwst, brutto };
    }
}

// ── Globale Instanz ─────────────────────────────────────────────
window.quoteIntelligenceService = new QuoteIntelligenceService();

})();
