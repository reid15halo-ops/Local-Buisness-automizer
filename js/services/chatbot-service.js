/* ============================================
   Chatbot Service - Expert Business Consultant
   Comprehensive local knowledge system
   ============================================ */

class ChatbotService {
    constructor() {
        try { this.conversations = JSON.parse(localStorage.getItem('freyai_chatbot_conversations') || '[]'); } catch { this.conversations = []; }
        try { this.settings = JSON.parse(localStorage.getItem('freyai_chatbot_settings') || '{}'); } catch { this.settings = {}; }
        try { this.messageQueue = JSON.parse(localStorage.getItem('freyai_chatbot_queue') || '[]'); } catch { this.messageQueue = []; }
        this.kb = this.initKnowledgeBase();

        // Default settings
        if (!this.settings.enabled) {this.settings.enabled = true;}
        if (!this.settings.businessHours) {
            this.settings.businessHours = { start: '08:00', end: '18:00', weekends: false };
        }
        if (!this.settings.autoReplyDelay) {this.settings.autoReplyDelay = 500;}
        if (!this.settings.language) {this.settings.language = 'de';}
    }

    // =====================================================
    // EXPERT KNOWLEDGE BASE - FreyAI Visions Business Master
    // =====================================================
    initKnowledgeBase() {
        return {
            // COMPANY INFO (reads from admin settings dynamically)
            company: this._loadCompanyInfo(),

            // PRICING GUIDELINES (Richtwerte)
            pricing: {
                hourlyRates: {
                    metallbau: { min: 55, max: 75, unit: '€/Std' },
                    schweissen: { min: 60, max: 85, unit: '€/Std' },
                    hydraulik: { min: 65, max: 90, unit: '€/Std' },
                    montage: { min: 50, max: 70, unit: '€/Std' }
                },
                products: {
                    gelaender: { min: 150, max: 350, unit: '€/lfm', note: 'je nach Design und Material' },
                    treppe: { min: 3500, max: 15000, unit: '€/Stk', note: 'je nach Stufen und Ausführung' },
                    tor: { min: 1200, max: 8000, unit: '€/Stk', note: 'je nach Größe und Antrieb' },
                    zaun: { min: 80, max: 200, unit: '€/lfm', note: 'inkl. Pfosten' },
                    carport: { min: 2500, max: 8000, unit: '€/Stk', note: 'Einzelstellplatz' },
                    balkon: { min: 4000, max: 12000, unit: '€/Stk', note: 'je nach Größe' },
                    vordach: { min: 800, max: 3500, unit: '€/Stk', note: 'inkl. Glas/Polycarbonat' }
                },
                hydraulik: {
                    schlauchAnfertigung: { min: 25, max: 150, unit: '€/Stk', note: 'je nach DN und Länge' },
                    zylinderReparatur: { min: 200, max: 1500, unit: '€/Stk', note: 'ohne Ersatzteile' },
                    anfahrt: { base: 45, perKm: 0.80, unit: '€' }
                },
                // ── FREYAI VISIONS EIGENE PRODUKTPREISE ──────────────────────────
                freyaiProdukte: {
                    beratung: {
                        erstgespraech: { preis: 0, unit: 'kostenlos', note: 'ca. 60-90 Min., vor Ort oder Video-Call' },
                        digitalAudit: { min: 490, max: 890, unit: '€ Pauschal', note: 'ca. 4-6h inkl. Vor-Ort-Termin, schriftliches Audit-Dokument' },
                        strategieSession: { preis: 120, unit: '€/Std', note: 'laufende Beratung, inkl. Protokoll' }
                    },
                    setup: {
                        starter: { min: 1500, max: 2500, unit: '€ Einmalig', note: 'bis 2 Nutzer, Basis-Module, 60 Min. Einweisung' },
                        professional: { min: 3500, max: 5500, unit: '€ Einmalig', note: 'bis 5 Nutzer, E-Mail-Auto, Chatbot, 2h Schulung, 30T Support' },
                        enterprise: { min: 5500, max: 8500, unit: '€ Einmalig', note: 'unbegrenzte Nutzer, Custom-Integration, DSGVO-Paket, 90T Support' },
                        datenmigration: { preis: 95, unit: '€/Std', note: 'Excel/Papier → FreyAI, inkl. Bereinigung und Validierung' },
                        customFeature: { preis: 110, unit: '€/Std', note: 'Sonderentwicklung nach Pflichtenheft, Festpreis auf Anfrage' }
                    },
                    automatisierung: {
                        kiChatbot: { min: 490, max: 990, unit: '€ Einmalig', note: 'Einrichtung inkl. Wissensbasis, 1 Monat Feinabstimmung' },
                        emailAutomatisierung: { min: 390, max: 690, unit: '€ Einmalig', note: 'Angebot, Rechnung, 3-stufiges Mahnwesen, individuelle Texte' },
                        angebotKI: { min: 290, max: 490, unit: '€ Einmalig', note: 'Leistungsvorlagen, Materialintegration, KI-Textvorschläge' },
                        buchhaltungExport: { min: 390, max: 690, unit: '€ Einmalig', note: 'GoBD-konform, DATEV-CSV, monatliche Automatisierung' },
                        mahnwesenVollstaendig: { min: 390, max: 590, unit: '€ Einmalig', note: '3-stufig, Verzugszinsberechnung §288 BGB, Protokoll' },
                        lagerAutomatisierung: { min: 290, max: 490, unit: '€ Einmalig', note: 'Mindestbestand-Alarm, Preisupdate, Bestellliste' }
                    },
                    schulung: {
                        vorOrt: { preis: 120, unit: '€/Std', note: 'inkl. Kurzleitfaden, 2h Grundschulung empfohlen' },
                        online: { preis: 90, unit: '€/Std', note: 'per Video-Call, Aufzeichnung auf Anfrage' },
                        handbuch: { min: 290, max: 490, unit: '€ Pauschal', note: 'individuell, PDF + optional Druck, Lieferzeit 5 Werktage' },
                        prioritySupport: { preis: 120, unit: '€/Std', note: 'Reaktionszeit < 2h, inkl. Incident Report, 15-Min.-Takt' }
                    },
                    retainer: {
                        basis: { preis: 149, unit: '€/Monat', mindestlaufzeit: '12 Monate', note: 'Updates, E-Mail-Support 24h, Server-Backup EU' },
                        professional: { preis: 299, unit: '€/Monat', mindestlaufzeit: '12 Monate', note: 'Telefon-Support 4h, monatl. Optimierungs-Call, 1h Schulung/Monat' },
                        premium: { preis: 499, unit: '€/Monat', mindestlaufzeit: '12 Monate', note: 'Full-Service, Priority-Hotline Mo-Sa, 3h Dev/Monat, Quartal Strategy' }
                    }
                }
            },

            // MATERIALS KNOWLEDGE
            materials: {
                stahl: {
                    'S235JR': { use: 'Allgemeiner Baustahl', tensile: '360-510 MPa', weldability: 'sehr gut' },
                    'S355J2': { use: 'Höher belastbar', tensile: '470-630 MPa', weldability: 'gut' },
                    'CorTen': { use: 'Wetterfest ohne Anstrich', tensile: '470-630 MPa', weldability: 'mittel' }
                },
                edelstahl: {
                    'V2A (1.4301)': { use: 'Innenbereich, überdacht', corrosion: 'gut', price: 'standard' },
                    'V4A (1.4404)': { use: 'Außen, Pool, Küste', corrosion: 'sehr gut', price: '+20-30%' }
                },
                oberflaechen: {
                    feuerverzinkt: { lifetime: '25-50 Jahre', use: 'Außen Standard' },
                    pulverbeschichtet: { lifetime: '15-25 Jahre', use: 'Farbig, Optik' },
                    duplex: { lifetime: '50+ Jahre', use: 'Maximum Schutz' }
                }
            },

            // HYDRAULIK KNOWLEDGE
            hydraulik: {
                schlaeuche: {
                    '1SN': { pressure: '225 bar', use: 'Niederdruck' },
                    '2SN': { pressure: '400 bar', use: 'Mitteldruck, Standard' },
                    '4SP': { pressure: '450 bar', use: 'Hochdruck' },
                    '4SH': { pressure: '500 bar', use: 'Extremdruck' }
                },
                anschluesse: ['DKO', 'DKL', 'DKOL', 'ORFS', 'JIC', 'BSP', 'NPT', 'Flansch SAE'],
                probleme: {
                    'Leckage': 'Dichtungswechsel, Schlauch erneuern, Verschraubung prüfen',
                    'Druckverlust': 'Pumpe, Ventile, Leckstellen prüfen',
                    'Langsam': 'Ölstand, Filter, Pumpenleistung prüfen',
                    'Geräusche': 'Lufteinzug, Kavitation, Lagerschaden',
                    'Überhitzung': 'Ölkühler, Ölmenge, Viskosität prüfen'
                }
            },

            // WELDING KNOWLEDGE
            schweissen: {
                verfahren: {
                    'WIG/TIG': { use: 'Edelstahl, Alu, Sichtnaht', quality: 'höchste' },
                    'MIG/MAG': { use: 'Stahl, Serie, schnell', quality: 'hoch' },
                    'E-Hand': { use: 'Outdoor, Reparatur, flexibel', quality: 'gut' }
                },
                normen: ['DIN EN 1090', 'DIN EN ISO 3834', 'DIN EN ISO 9606-1']
            },

            // NORMS & STANDARDS
            normen: {
                gelaenderhoehe: { privat: '90cm', oeffentlich: '110cm' },
                stabAbstand: 'max. 12cm (Kindersicherung)',
                treppensteigung: '17/29 optimal'
            },

            // SUBTLE MARKETING - Cross-sell & Upsell hints
            marketing: {
                // Cross-sell suggestions based on current topic
                crossSell: {
                    gelaender: ['treppe', 'balkon', 'vordach'],
                    treppe: ['gelaender', 'handlauf', 'beleuchtung'],
                    tor: ['zaun', 'briefkasten', 'klingel'],
                    carport: ['tor', 'zaun', 'beleuchtung'],
                    hydraulik: ['wartungsvertrag', 'ersatzschlaeuche'],
                    schweissen: ['konstruktion', 'reparatur']
                },
                // Seasonal/promotional hooks
                seasonal: {
                    fruehling: 'Perfekte Zeit für Außenprojekte!',
                    sommer: 'Ideales Wetter für Montagearbeiten.',
                    herbst: 'Jetzt noch vor dem Winter fertigstellen!',
                    winter: 'Indoor-Projekte und Planungen für Frühjahr.'
                },
                // Value propositions to weave in
                valueProps: [
                    'Als Meisterbetrieb garantieren wir höchste Qualität',
                    'Über 500 zufriedene Kunden im Raum Main-Kinzig',
                    'Kostenlose Beratung und Aufmaß vor Ort',
                    'Faire Festpreise – keine versteckten Kosten',
                    'Lokaler Familienbetrieb mit persönlichem Service',
                    'Schnelle Reaktionszeiten, auch bei Notfällen',
                    'Qualität made in Germany – keine Billigimporte'
                ],
                // Upsell options per product
                upsells: {
                    gelaender: ['LED-Handlauf', 'Glasfüllung', 'V4A statt V2A'],
                    treppe: ['Podest', 'Glasgeländer', 'LED-Stufenbeleuchtung'],
                    tor: ['Elektrischer Antrieb', 'Funksteuerung', 'Gegensprechanlage'],
                    carport: ['Solarunterkonstruktion', 'Seitenwand', 'Beleuchtung'],
                    hydraulik: ['Wartungsvertrag', 'Reserve-Schläuche', 'Schnellkupplungen']
                },
                // Subtle closing phrases
                closingHooks: [
                    'Soll ich einen unverbindlichen Beratungstermin vorschlagen?',
                    'Darf ich Ihnen ein kostenloses Angebot erstellen?',
                    'Haben Sie Interesse an einer Vor-Ort-Besichtigung?',
                    'Wann passt Ihnen ein Termin für die Beratung?'
                ]
            }
        };
    }

    _loadCompanyInfo() {
        let ap; try { ap = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}'); } catch { ap = {}; }
        const bd = window.eInvoiceService?.settings?.businessData || {};
        const name = ap.company_name || bd.name || 'FreyAI Visions';
        const street = ap.address_street || bd.street || '';
        const postal = ap.address_postal || bd.postalCode || '';
        const city = ap.address_city || bd.city || '';
        const address = (street && city) ? `${street}, ${postal} ${city}` : '';
        return {
            name: name,
            owner: ap.owner_name || 'Inhaber',
            experience: '15+ Jahre Erfahrung',
            team: '5 Fachkräfte inkl. Meister und Gesellen',
            certifications: ['Schweißfachbetrieb nach DIN EN 1090', 'DVS-zertifiziert', 'Hydraulik-Fachbetrieb'],
            serviceArea: '50km Radius',
            address: address,
            phone: ap.company_phone || bd.phone || '',
            email: ap.company_email || bd.email || '',
            hours: { weekday: '08:00-18:00', saturday: 'nach Vereinbarung', emergency: '24/7 Notdienst' }
        };
    }

    // Get current season for marketing
    getCurrentSeason() {
        const month = new Date().getMonth();
        if (month >= 2 && month <= 4) {return 'fruehling';}
        if (month >= 5 && month <= 7) {return 'sommer';}
        if (month >= 8 && month <= 10) {return 'herbst';}
        return 'winter';
    }

    // Get subtle marketing addition based on context
    getSubtleMarketing(topic, includeUpsell = true) {
        const kb = this.kb;
        const marketing = kb.marketing;
        let hint = '';

        // Cross-sell (30% chance)
        if (Math.random() < 0.3 && marketing.crossSell[topic]) {
            const related = marketing.crossSell[topic];
            const suggestion = related[Math.floor(Math.random() * related.length)];
            const crossSellPhrases = [
                `\n\n💡 _Übrigens: Viele Kunden kombinieren das mit einem passenden ${suggestion}._`,
                `\n\n💡 _Tipp: Ein ${suggestion} dazu rundet das Gesamtbild ab._`,
                `\n\n💡 _Passend dazu bieten wir auch ${suggestion} an._`
            ];
            hint = crossSellPhrases[Math.floor(Math.random() * crossSellPhrases.length)];
        }

        // Upsell (20% chance)
        else if (includeUpsell && Math.random() < 0.2 && marketing.upsells[topic]) {
            const upsells = marketing.upsells[topic];
            const upsell = upsells[Math.floor(Math.random() * upsells.length)];
            hint = `\n\n✨ _Upgrade-Option: ${upsell} für noch mehr Komfort._`;
        }

        // Value prop (25% chance, if no cross-sell)
        else if (Math.random() < 0.25) {
            const prop = marketing.valueProps[Math.floor(Math.random() * marketing.valueProps.length)];
            hint = `\n\n✅ _${prop}._`;
        }

        return hint;
    }

    // Generate response
    async generateResponse(message, history, customerData) {
        // 1. Check for Business Relevance (Local Filter)
        const lowerMsg = message.toLowerCase();
        const businessKeywords = [
            'metall', 'stahl', 'hydraulik', 'schweiß', 'geländer', 'treppe', 'tor', 'carport',
            'schlauch', 'zylinder', 'reparatur', 'montage', 'angebot', 'preis', 'kosten',
            'termin', 'anfrage', 'freyai', 'kunde', 'service', 'beratung', 'rohrleitung', 'industriemontage',
            'handwerk', 'auftrag', 'rechnung', 'projekt', 'arbeit', 'material', 'lieferung',
            'wartung', 'sanierung', 'renovierung', 'bau', 'werkstatt', 'fertigung'
        ];

        const isBusinessRelated = businessKeywords.some(kw => lowerMsg.includes(kw)) ||
            /^(hallo|hi|guten tag|moin)/i.test(lowerMsg);

        if (!isBusinessRelated) {
            const companyName = this.kb.company.name;
            return `Entschuldigung, als Fachberater von ${companyName} kann ich Ihnen nur bei Fragen zu unseren Dienstleistungen behilflich sein. Wie kann ich Sie bei Ihrem Projekt unterstützen?`;
        }

        // 2. Try LLM (Ollama/Gemini)
        if (window.llmService && window.llmService.isConfigured) {
            try {
                // Add a small delay for "AI thinking"
                await new Promise(r => setTimeout(r, 800));
                const response = await window.llmService.chat(message, history);
                if (response) {return response;}
            } catch (e) {
                console.error('LLM Error in ChatbotService:', e);
            }
        }

        // 3. Fallback to Local Expert System
        return this.getExpertResponse(message, history, customerData);
    }

    extractDetails(msg) {
        return {
            dn: msg.match(/dn\s?(\d+)/i)?.[1],
            mm: msg.match(/(\d+)\s?mm/i)?.[1],
            len: msg.match(/(\d+)\s?m\b/i)?.[1],
            material: msg.match(/edelstahl|stahl|alu|kunststoff|verzinkt/i)?.[0],
            pressure: msg.match(/(\d+)\s?bar/i)?.[1]
        };
    }

    // Expert response generator with comprehensive knowledge
    getExpertResponse(message, history = [], _customerData = {}) {
        const kb = this.kb;
        const lowerMsg = message.toLowerCase().trim();
        const lastBotMsg = history.filter(m => m.role === 'assistant').slice(-1)[0]?.content || '';
        const details = this.extractDetails(message);

        // Context: User providing contact info
        if (lastBotMsg.includes('Ihren Namen') || lastBotMsg.includes('Kontaktdaten') || lastBotMsg.includes('Telefonnummer')) {
            if (message.match(/[A-ZÄÖÜa-zäöüß]{2,}/) || message.match(/\d{5,}/)) {
                return `Vielen Dank! 📝 Ich habe Ihre Daten aufgenommen.\n\nEin Fachberater wird sich innerhalb von 2 Stunden bei Ihnen melden.\n\nAls Meisterbetrieb mit ${kb.company.experience} garantieren wir kompetente Beratung!\n\nKann ich Ihnen vorab noch technische Fragen beantworten?`;
            }
        }

        // === GREETINGS ===
        if (/^(hallo|hi|guten\s?(tag|morgen|abend)|moin|servus|hey|grüß)/i.test(lowerMsg)) {
            return `Guten Tag! 👋 Willkommen bei **${kb.company.name}**!\n\nIch bin Ihr digitaler Fachberater und helfe Ihnen gerne bei allen Fragen zu unseren Leistungen und Projekten.\n\nWomit kann ich Ihnen helfen?`;
        }

        // === GELÄNDER - DETAILED ===
        if (lowerMsg.match(/geländer|brüstung|handlauf|absturz/)) {
            const p = kb.pricing.products.gelaender;
            if (lowerMsg.match(/preis|kosten|was kostet/)) {
                return `💰 **Geländer-Preise (Richtwerte)**\n\n📊 **${p.min} - ${p.max} ${p.unit}**\n(${p.note})\n\n**Materialoptionen:**\n• Stahl verzinkt: ab 150€/lfm\n• Stahl + Pulverbeschichtung: ab 180€/lfm\n• Edelstahl V2A gebürstet: ab 250€/lfm\n• Edelstahl V4A (Außen/Pool): ab 300€/lfm\n• Mit Glasfüllung: ab 350€/lfm\n\n**Beispiel:** 5m Geländer Edelstahl V2A ≈ 1.250-1.750€\n\n📏 Für ein Angebot brauche ich:\n• Länge in Metern\n• Material-Präferenz\n• Innen oder außen?` + this.getSubtleMarketing('gelaender');
            }
            return `🏗️ **Geländer-Fachberatung**\n\n**Vorschriften (DIN 18065):**\n• Höhe privat: min. ${kb.normen.gelaenderhoehe.privat}\n• Höhe öffentlich: min. ${kb.normen.gelaenderhoehe.oeffentlich}\n• Stabzwischenräume: ${kb.normen.stabAbstand}\n\n**Ausführungen:**\n• Stahl verzinkt – robust, klassisch\n• Stahl pulverbeschichtet – farbig (RAL)\n• Edelstahl V2A – pflegeleicht, modern\n• Edelstahl V4A – für Pool, Salzluft\n• Mit Glas/Seilen – Design\n\n**Preise:** ${p.min}-${p.max} ${p.unit}\n\n📐 Für welchen Bereich suchen Sie ein Geländer?` + this.getSubtleMarketing('gelaender');
        }

        // === TREPPEN - DETAILED ===
        if (lowerMsg.match(/treppe|stufe|aufgang/)) {
            const p = kb.pricing.products.treppe;
            if (lowerMsg.match(/preis|kosten|was kostet/)) {
                return `💰 **Treppen-Preise (Richtwerte)**\n\n📊 **${p.min} - ${p.max} ${p.unit}**\n\n**Nach Typ:**\n• Spindeltreppe Stahl: ab 3.500€\n• Gerade Treppe 10-15 Stufen: 5.000-8.000€\n• Podesttreppe: 8.000-12.000€\n• Designtreppe mit Glas: 10.000-15.000€+\n\n**Inklusive:**\n✅ Beratung + Aufmaß\n✅ Statik-Berechnung\n✅ Fertigung + Oberflächenbehandlung\n✅ Montage vor Ort\n\n📐 Welche Geschosshöhe müssen Sie überbrücken?` + this.getSubtleMarketing('treppe');
            }
            return `🏗️ **Treppen-Fachberatung**\n\n**Treppenarten:**\n• Gerade Treppe – klassisch, wirtschaftlich\n• Viertelgewendelt – platzsparend\n• Halbgewendelt – elegant\n• Spindeltreppe – minimaler Platzbedarf\n• Podesttreppe – großzügig\n\n**Materialien:**\n• Stahlwangen + Holzstufen → wohnlich\n• Stahlwangen + Steinstufen → robust\n• Vollstahl → Industrial Style\n\n**Norm DIN 18065:**\n• Steigung: ${kb.normen.treppensteigung}\n• Mindestbreite: 80cm (Wohnung)\n\n📐 Wie viel Geschosshöhe? Innen oder außen?` + this.getSubtleMarketing('treppe');
        }

        // === TORE - DETAILED ===
        if (lowerMsg.match(/tor|einfahrt/)) {
            const p = kb.pricing.products.tor;
            if (lowerMsg.match(/preis|kosten|was kostet/)) {
                return `💰 **Tor-Preise (Richtwerte)**\n\n📊 **${p.min} - ${p.max} ${p.unit}**\n\n**Nach Typ:**\n• Flügeltor 3m manuell: ab 1.200€\n• Flügeltor mit Antrieb: ab 2.500€\n• Schiebetor bis 5m: 3.000-5.000€\n• Schiebetor 6m+ mit Antrieb: 5.000-8.000€\n\n**Antriebe:** Came, Sommer, Hörmann\nalle auf Lager + Einbau\n\n**Extras:**\n• Funksteuerung, Schlüsselschalter\n• Lichtschranke, Blinklicht\n• Integration Smart Home\n\n📏 Wie breit ist Ihre Einfahrt?` + this.getSubtleMarketing('tor');
            }
            return `🏗️ **Tor-Fachberatung**\n\n**Torarten:**\n• **Flügeltor** – klassisch, günstig\n• **Schiebetor** – platzsparend, elegant\n• **Drehtor** – kompakt, modern\n\n**Materialien:**\n• Stahl verzinkt\n• Stahl pulverbeschichtet (RAL-Farben)\n• Edelstahl\n• Aluminium (leicht)\n\n**Automatisierung:**\n✅ Funk-Handsender\n✅ Code-Tastatur\n✅ Fingerprint\n✅ App-Steuerung möglich\n\n📏 Welche Breite und Art bevorzugen Sie?` + this.getSubtleMarketing('tor');
        }

        // === CARPORT - DETAILED ===
        if (lowerMsg.match(/carport|überdachung|auto/)) {
            const p = kb.pricing.products.carport;
            return `🏗️ **Carport-Fachberatung**\n\n**Preise (Richtwerte):**\n📊 ${p.min} - ${p.max}€ (${p.note})\n\n**Varianten:**\n• Einzelcarport 3x5m: 2.500-4.000€\n• Doppelcarport 6x5m: 4.500-7.000€\n• Mit Solarunterkonstruktion: +1.500-3.000€\n\n**Inklusive:**\n✅ Statik-Berechnung\n✅ Feuerverzinkung\n✅ Dacheindeckung (Trapez/Polycarbonat)\n✅ Montage\n\n**Optional:**\n• Fundamente: ca. 300-600€\n• Seitenwand/Geräteraum\n• LED-Beleuchtung\n\n📏 Welche Stellplatzgröße benötigen Sie?` + this.getSubtleMarketing('carport');
        }

        // === HYDRAULIK - EXPERT ===
        if (lowerMsg.match(/hydraulik|schlauch|zylinder|pumpe|öl|druck|leck|press/)) {
            if (lowerMsg.match(/schlauch|press|anschluss/)) {
                let spec = "";
                if (details.dn) {spec += `\n✅ **Dimension DN${details.dn}** haben wir lagernd.`;}
                if (details.pressure) {spec += `\n✅ **${details.pressure} bar** sind für unsere 4SH-Schläuche kein Problem.`;}

                return `⚙️ **Hydraulikschlauch-Service**${spec}\n\n**Wir fertigen vor Ort:**\n• Durchmesser: DN6 bis DN51\n• Druckstufen: 1SN (225 bar) bis 4SH (500 bar)\n• Anschlüsse: ${kb.hydraulik.anschluesse.slice(0, 5).join(', ')} u.v.m.\n\n**Preise:**\nBsp: DN10, 1m, 2SN → ca. 35€\nBsp: DN16, 2m, 2SN → ca. 55€\nBsp: DN25, 3m, 4SP → ca. 120€\n\n**Ablauf:**\n1. Alten Schlauch bringen/vermessen\n2. Passende Armatur wählen\n3. Pressen (ca. 15 Min.)\n4. Prüfung + Dokumentation\n\n📞 **Notfall?** Mobiler Service: ${kb.company.phone}` + this.getSubtleMarketing('hydraulik');
            }
            if (lowerMsg.match(/zylinder|undicht|kolben|dichtung/)) {
                const rp = kb.pricing.hydraulik.zylinderReparatur;
                return `⚙️ **Zylinder-Reparatur**\n\n**Häufige Probleme:**\n• Kolbenstange undicht → Dichtungssatz\n• Innere Leckage → Kolbendichtungen\n• Stange beschädigt → Hartverchromung\n\n**Preise:** ${rp.min}-${rp.max}€ (${rp.note})\n\n**Wir reparieren alle Hersteller:**\nBosch Rexroth, Parker, HKS, Liebherr...\n\n**Ablauf:**\n1. Zylinder anliefern/Abholung\n2. Befundung + Kostenvoranschlag\n3. Reparatur nach Freigabe\n4. Prüfung + Garantie\n\n💡 Haben Sie Typenschild-Daten?` + this.getSubtleMarketing('hydraulik');
            }
            if (lowerMsg.match(/problem|defekt|geräusch|langsam|heiß|tropf/)) {
                let response = `⚙️ **Hydraulik-Diagnose**\n\n`;
                for (const [problem, loesung] of Object.entries(kb.hydraulik.probleme)) {
                    if (lowerMsg.includes(problem.toLowerCase()) ||
                        (problem === 'Leckage' && lowerMsg.match(/leck|tropf|undicht/)) ||
                        (problem === 'Überhitzung' && lowerMsg.match(/heiß|warm/))) {
                        response += `**${problem}:**\n${loesung}\n\n`;
                    }
                }
                if (response === `⚙️ **Hydraulik-Diagnose**\n\n`) {
                    response += `Beschreiben Sie das Problem genauer:\n• Leckage/Tropfen?\n• Kraftverlust/langsam?\n• Ungewöhnliche Geräusche?\n• Überhitzung?\n\nOder rufen Sie an: ${kb.company.phone}`;
                }
                return response;
            }
            return `⚙️ **Hydraulik-Komplett-Service**\n\n**Schlauchservice:**\n• Mobile Fertigung vor Ort\n• DN6-DN51, bis 500 bar\n• Alle Anschlussarten\n\n**Reparatur:**\n• Zylinder überholen\n• Pumpen, Motoren\n• Ventile, Steuerungen\n\n**Wartung:**\n• Ölwechsel + Filter\n• Systemcheck\n• Lecksuche\n\n**Marken:** Bosch, Parker, Bucher, HKS...\n\n📞 **Notdienst 24/7:** ${kb.company.phone}\n\nWas liegt bei Ihnen an?`;
        }

        // === ROHRLEITUNGSBAU ===
        if (lowerMsg.match(/rohr|leitung|pipeline|trasse|verrohrung|medium|medien/)) {
            return `🔧 **Rohrleitungsbau-Expertise**\n\n**Verfahren:**\n• **Verschraubung:** Ermeto/Schneidring (Hydraulik/Hochdruck)\n• **Presssysteme:** Mapress/Viega (Wasser, Luft, Trennmittel)\n• **Schweißen:** WIG/Orbitalschweißen (Prozessleitungen)\n\n**Medien:**\n• Druckluft, Wasser, Kühlwasser\n• Öl, Schmierstoffe, Emulsionen\n• Trennmittel-Versorgung\n\n**Materialien:**\n• Edelstahl (V2A/V4A) - korrosionsfrei\n• C-Stahl verzinkt - wirtschaftlich\n• Kunststoff (PE/PVC)\n\n📏 Nennen Sie uns Durchmesser (DN), Länge und Medium für ein Angebot!`;
        }

        // === SCHWEISSEN - EXPERT ===
        // Using word boundaries \b for short acronyms to avoid matches like 'benö(tig)e'
        if (lowerMsg.match(/schweiß|schweiss|\bwig\b|\btig\b|\bmig\b|\bmag\b|elektro|e-hand/)) {
            if (lowerMsg.match(/\bwig\b|\btig\b/)) {
                return `🔥 **WIG-Schweißen (TIG)**\n\n**Einsatz:**\n• Edelstahl, Aluminium\n• Dünnwandige Werkstücke\n• Sichtbare Nähte höchster Qualität\n\n**Vorteile:**\n✅ Sauberste Naht\n✅ Spritzerlos\n✅ Flexibel bei Materialdicke\n\n**Typische Arbeiten:**\n• Edelstahl-Geländer\n• Aluminium-Konstruktionen\n• Lebensmittel-/Pharmatechnik\n• Kunstobjekte\n\n**Unsere Expertise:**\n• DVS-zertifizierte Schweißer\n• Schutzgas Argon 4.6+\n• Dokumentation nach ISO\n\nWas soll geschweißt werden?`;
            }
            if (lowerMsg.match(/\bmig\b|\bmag\b/)) {
                return `🔥 **MIG/MAG-Schweißen**\n\n**MAG (CO2/Mischgas):**\n• Für Baustahl, Edelstahl\n• Schnell, wirtschaftlich\n\n**MIG (Argon):**\n• Für Aluminium\n• Sauberes Nahtbild\n\n**Vorteile:**\n✅ Hohe Abschmelzleistung\n✅ Wirtschaftlich für Serien\n✅ Bis zu 30mm Materialstärke\n\n**Typische Arbeiten:**\n• Stahlkonstruktionen\n• Treppen, Geländer\n• Behälter, Tanks\n• Fahrzeugbau\n\nFür welches Material/Projekt benötigen Sie Schweißarbeiten?`;
            }
            return `🔥 **Schweißtechnik bei FreyAI Visions**\n\n**Verfahren:**\n• **WIG/TIG:** Edelstahl, Alu, Sichtnaht (höchste Qualität)\n• **MIG/MAG:** Baustahl, Edelstahl (schnell, wirtschaftlich)\n• **E-Hand:** Outdoor, Reparatur (flexibel)\n• **Autogen:** Brennschneiden, Löten\n\n**Materialien:**\nStahl, Edelstahl, Aluminium, Gusseisen\n\n**Zertifizierung:**\n✅ ${kb.company.certifications[0]}\n✅ DVS-zertifizierte Schweißer\n\n**Stundensatz:** ${kb.pricing.hourlyRates.schweissen.min}-${kb.pricing.hourlyRates.schweissen.max} €/Std\n\nFür welche Arbeit benötigen Sie Schweißen?`;
        }

        // === MATERIALBERATUNG ===
        if (lowerMsg.match(/material|stahl|edelstahl|aluminium|verzink|pulver|rost|v2a|v4a/)) {
            if (lowerMsg.match(/v2a|v4a|edelstahl|inox/)) {
                return `🔬 **Edelstahl-Beratung**\n\n**V2A (1.4301):**\n• Für: Innen, überdacht\n• Korrosion: Gut\n• Preis: Standard-Edelstahl\n\n**V4A (1.4404):**\n• Für: Außen, Pool, Küstennähe\n• Korrosion: Sehr gut (Molybdän)\n• Preis: +20-30%\n\n**Empfehlung:**\n✅ Innen/überdacht → V2A reicht\n✅ Außen ungeschützt → V4A\n✅ Chlor/Salzwasser → V4A Pflicht\n\n**Oberflächenoptionen:**\n• Geschliffen (Korn 240/320)\n• Gebürstet\n• Poliert (Spiegel)\n\nFür welche Anwendung?`;
            }
            if (lowerMsg.match(/verzink|rost|korrosion|wetterfest/)) {
                return `🔬 **Korrosionsschutz-Beratung**\n\n**Feuerverzinkung:**\n• Lebensdauer: ${kb.materials.oberflaechen.feuerverzinkt.lifetime}\n• Selbstheilend bei Kratzern\n• Standard für Außen\n\n**Pulverbeschichtung:**\n• Lebensdauer: ${kb.materials.oberflaechen.pulverbeschichtet.lifetime}\n• RAL-Farben möglich\n• Optisch hochwertig\n\n**Duplex (Verzinken + Pulvern):**\n• Lebensdauer: ${kb.materials.oberflaechen.duplex.lifetime}\n• Maximaler Schutz + Farbe\n\n**Meine Empfehlung:**\n• Ländlich: Feuerverzinkt reicht\n• Industrie/Straße: Duplex ideal\n• Optik wichtig: Pulver auf Verzinkung`;
            }
            return `🔬 **Material-Beratung**\n\n**Stahl:**\n• S235: Allgemein, günstig\n• S355: Höher belastbar\n• CorTen: Rostoptik, wetterfest\n\n**Edelstahl:**\n• V2A: Innen, überdacht\n• V4A: Außen, Chlor, Salzwasser\n\n**Aluminium:**\n• Leicht, korrosionsfest\n• Ideal für Solar, Küste\n\n**Oberflächenschutz:**\n• Verzinken: 25-50 Jahre\n• Pulvern: 15-25 Jahre, farbig\n• Duplex: Maximum\n\nFür welches Projekt?`;
        }

        // === PREISE ALLGEMEIN ===
        if (lowerMsg.match(/preis|kosten|was kostet|teuer|günstig|budget|€|euro/)) {
            const hr = kb.pricing.hourlyRates;
            return `💰 **Preisübersicht FreyAI Visions**\n\n**Stundensätze:**\n• Metallbau: ${hr.metallbau.min}-${hr.metallbau.max} €/Std\n• Schweißen: ${hr.schweissen.min}-${hr.schweissen.max} €/Std\n• Hydraulik: ${hr.hydraulik.min}-${hr.hydraulik.max} €/Std\n• Montage: ${hr.montage.min}-${hr.montage.max} €/Std\n\n**Produkte (Richtwerte):**\n• Geländer: ab 150 €/lfm\n• Treppen: ab 3.500€\n• Tore: ab 1.200€\n• Carports: ab 2.500€\n• Hydraulikschläuche: ab 25€\n\n✅ **Kostenlose Beratung + Aufmaß!**\n\n_Endpreise nach Aufmaß vor Ort._\n\nFür welches Projekt brauchen Sie Preise?`;
        }

        // === ÖFFNUNGSZEITEN ===
        if (lowerMsg.match(/öffnungszeit|geöffnet|wann offen|geschäftszeit/)) {
            const h = kb.company.hours;
            return `🕐 **Geschäftszeiten**\n\n📆 Mo-Fr: ${h.weekday}\n📆 Samstag: ${h.saturday}\n📆 Sonntag: geschlossen\n\n**Notdienst:**\n🚨 ${h.emergency}\n📞 ${kb.company.phone}\n\n**Einsatzgebiet:**\n📍 ${kb.company.serviceArea}`;
        }

        // === TERMIN ===
        if (lowerMsg.match(/termin|vereinbar|kommen|besuch|aufmaß/)) {
            return `📅 **Terminvereinbarung**\n\n**Wir bieten:**\n✅ Kostenlose Beratung vor Ort\n✅ Kostenloses Aufmaß\n✅ Flexible Zeitfenster\n\n**Ablauf:**\n1. Besichtigung durch Meister\n2. Material + Ausführung besprechen\n3. Aufmaß + Fotodokumentation\n4. Angebot innerhalb 3 Werktagen\n\n**Dafür brauche ich:**\n• Ihren Namen\n• Telefonnummer\n• Kurze Projektbeschreibung\n\nWie heißen Sie und worum geht es?`;
        }

        // === NOTFALL ===
        if (lowerMsg.match(/notfall|dringend|sofort|stillstand|ausgefallen|akut/)) {
            return `🚨 **NOTFALL-SERVICE**\n\n📞 **SOFORT ANRUFEN:**\n# ${kb.company.phone}\n\n**24/7 Erreichbar für:**\n• Maschinenausfall\n• Hydraulikschaden\n• Schlauchplatzer\n• Sicherheitsdefekte\n\n**Reaktionszeit:** 2 Std. vor Ort\n\n**Mobile Ausstattung:**\n✅ Schlauchpresse\n✅ Schweißgerät\n✅ Standard-Ersatzteile\n\n⚠️ Bei Notfällen nicht schreiben – ANRUFEN!`;
        }

        // === KONTAKT / ÜBER UNS ===
        if (lowerMsg.match(/kontakt|adresse|telefon|email|wo seid|über euch|wer seid/)) {
            const c = kb.company;
            return `📍 **${c.name}**\n\n**${c.owner}**\n🏆 ${c.experience}\n👥 ${c.team}\n\n**Adresse:**\n📍 ${c.address}\n\n**Kontakt:**\n📞 ${c.phone}\n📧 ${c.email}\n\n**Zertifizierungen:**\n${c.certifications.map(cert => '✅ ' + cert).join('\n')}\n\n**Einsatzgebiet:**\n🗺️ ${c.serviceArea}\n\nWie können wir helfen?`;
        }

        // === LEISTUNGEN ===
        if (lowerMsg.match(/leistung|was macht|was bietet|angebot|service|können sie|könnt ihr/)) {
            return `🔧 **Unser Leistungsspektrum**\n\n**🏗️ METALLBAU:**\n• Geländer & Handläufe\n• Treppen (innen/außen)\n• Tore & Zäune\n• Carports & Vordächer\n• Balkone & Terrassen\n\n**⚙️ HYDRAULIK:**\n• Schlauchkonfektionierung\n• Zylinder-Reparatur\n• Pumpen & Aggregate\n• Notfall-Service 24/7\n\n**🔥 SCHWEISSEN:**\n• WIG, MIG/MAG, E-Hand\n• Stahl, Edelstahl, Alu\n• Reparaturschweißen\n\n**🔨 MONTAGE:**\n• Industriemontage\n• Maschinentransport\n• Wartung\n\n**Qualität:** ${kb.company.certifications[0]}\n\nWofür interessieren Sie sich?`;
        }

        // === DANKE ===
        if (lowerMsg.match(/danke|vielen dank|super|toll|prima|perfekt/)) {
            return `Sehr gern geschehen! 😊\n\nAls Meisterbetrieb liegt uns Qualität am Herzen.\n\nKann ich noch technische Fragen beantworten?\n\n📞 Oder direkt: ${kb.company.phone}`;
        }

        // === TSCHÜSS ===
        if (lowerMsg.match(/tschüss|auf wiedersehen|bye|ciao|bis bald/)) {
            return `Auf Wiedersehen! 👋\n\n**Ihre Vorteile bei ${kb.company.name}:**\n✅ ${kb.company.experience}\n✅ Faire Preise\n✅ Zuverlässig & pünktlich\n\n📞 ${kb.company.phone}\n📧 ${kb.company.email}\n\nWir freuen uns auf Ihren Auftrag!`;
        }

        // === JA/NEIN ===
        if (/^(ja|jo|jep|genau|richtig|ok|okay|klar)$/i.test(lowerMsg)) {
            return `Prima! 👍\n\nSchildern Sie mir gerne Ihr Projekt oder Ihre Frage – ich berate Sie fachkundig!\n\nOder nennen Sie mir Ihre Telefonnummer für einen Rückruf.`;
        }
        if (/^(nein|ne|nö)$/i.test(lowerMsg)) {
            return `Alles klar! Falls später Fragen aufkommen, melden Sie sich jederzeit.\n\n📞 ${kb.company.phone}\n\nSchönen Tag noch! ☀️`;
        }

        // === FRAGEN ALLGEMEIN ===
        if (lowerMsg.match(/^(wie|was|welch|wann|wo|warum|wieviel|können)/)) {
            if (lowerMsg.match(/lange|dauer|zeit/)) {
                return `⏱️ **Projektdauer (Richtwerte)**\n\n• Geländer 5m: 2-3 Tage + 1 Tag Montage\n• Treppe: 2-4 Wochen\n• Tor: 1-2 Wochen\n• Schlauchpresse: 15 Minuten\n• Zylinder-Reparatur: 2-5 Werktage\n\nUm welches Projekt geht es?`;
            }
            if (lowerMsg.match(/garantie|gewährleist/)) {
                return `📜 **Gewährleistung**\n\nUnsere Arbeiten unterliegen den gesetzlichen Gewährleistungsfristen. Details zu Ihrem spezifischen Projekt besprechen wir gerne persönlich.\n\n📞 Rufen Sie uns an: ${kb.company.phone}`;
            }
        }

        // === DEFAULT - SMART ===
        return `Danke für Ihre Nachricht! 📩\n\nIch bin Fachberater bei **${kb.company.name}** und helfe Ihnen gerne bei:\n\n🏗️ **Projekten** – Beratung, Preise, Planung\n📋 **Angeboten** – individuelle Kostenvoranschläge\n🔧 **Technik** – Materialberatung, Verfahren\n\nSchildern Sie einfach Ihr Projekt oder stellen Sie eine Frage!\n\n📞 Direkt: ${kb.company.phone}`;
    }

    // Process incoming message
    async processIncomingMessage(from, message, messageId = null) {
        const conversationId = this.getOrCreateConversation(from);
        const conversation = this.getConversation(conversationId);

        conversation.messages.push({
            id: messageId || 'msg-' + Date.now(),
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });

        const intent = this.detectIntent(message);
        let response = await this.generateResponse(message, conversation.messages, conversation.customerData);

        if (intent.needsHuman) {
            response += '\n\n_Ein Mitarbeiter wurde benachrichtigt._';
            this.notifyStaff(conversation, intent);
        }

        conversation.messages.push({
            id: 'resp-' + Date.now(),
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString()
        });

        this.extractAndSaveCustomerData(conversation, message);
        this.saveConversations();
        this.queueOutgoingMessage(from, response);

        return { response, conversationId, intent };
    }

    detectIntent(message) {
        const lowerMsg = message.toLowerCase();
        return {
            greeting: /^(hallo|hi|guten|moin|servus|hey)/i.test(lowerMsg),
            appointment: /termin|vereinbar|kommen/i.test(lowerMsg),
            price: /preis|kosten|was kostet/i.test(lowerMsg),
            emergency: /notfall|dringend|sofort|ausgefallen/i.test(lowerMsg),
            complaint: /beschwerde|unzufrieden|problem/i.test(lowerMsg),
            needsHuman: /notfall|dringend|beschwerde|reklamation/i.test(lowerMsg)
        };
    }

    extractAndSaveCustomerData(conversation, message) {
        const phoneMatch = message.match(/(\+49|0)[0-9\s\-\/]{8,15}/);
        if (phoneMatch) {conversation.customerData.telefon = phoneMatch[0].replace(/[\s\-\/]/g, '');}
        const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {conversation.customerData.email = emailMatch[0];}
        const nameMatch = message.match(/(?:ich bin|mein name ist|ich heiße|name:?)\s+([A-ZÄÖÜa-zäöüß]+(?:\s+[A-ZÄÖÜa-zäöüß]+)?)/i);
        if (nameMatch) {conversation.customerData.name = nameMatch[1];}
    }

    notifyStaff(conversation, intent) {
        if (window.taskService) {
            let priority = intent.emergency ? 'urgent' : (intent.complaint ? 'high' : 'normal');
            window.taskService.addTask({
                title: `WhatsApp: ${conversation.customerData.name || conversation.phoneNumber}`,
                description: `Anfrage: ${conversation.messages.slice(-2)[0]?.content || ''}`,
                priority,
                source: 'whatsapp',
                dueDate: new Date().toISOString().split('T')[0]
            });
        }
    }

    queueOutgoingMessage(to, message) {
        this.messageQueue.push({
            id: 'out-' + Date.now(),
            to, message,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        this.saveQueue();
    }

    getOrCreateConversation(phoneNumber) {
        let conversation = this.conversations.find(c => c.phoneNumber === phoneNumber);
        if (!conversation) {
            conversation = {
                id: 'conv-' + Date.now(),
                phoneNumber,
                messages: [],
                customerData: {},
                createdAt: new Date().toISOString(),
                lastMessageAt: new Date().toISOString(),
                status: 'active'
            };
            this.conversations.push(conversation);
        }
        conversation.lastMessageAt = new Date().toISOString();
        return conversation.id;
    }

    getConversation(id) { return this.conversations.find(c => c.id === id); }
    getActiveConversations() { return this.conversations.filter(c => c.status === 'active').sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)); }
    getRecentConversations(limit = 20) { return this.conversations.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)).slice(0, limit); }

    async simulateIncomingMessage(phoneNumber, message) {
        return await this.processIncomingMessage(phoneNumber, message);
    }

    getChatUIData(conversationId) {
        const conversation = this.getConversation(conversationId);
        if (!conversation) {return null;}
        return {
            phoneNumber: conversation.phoneNumber,
            customerName: conversation.customerData.name || 'Unbekannt',
            messages: conversation.messages.map(m => ({
                ...m,
                isUser: m.role === 'user',
                time: new Date(m.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            })),
            customerData: conversation.customerData
        };
    }

    getQuickReplies() {
        return [
            { id: 'prices', label: '💰 Preise', message: 'Was kosten Ihre Leistungen?' },
            { id: 'services', label: '🔧 Leistungen', message: 'Welche Leistungen bieten Sie an?' },
            { id: 'appointment', label: '📅 Termin', message: 'Ich möchte einen Termin vereinbaren' },
            { id: 'emergency', label: '🚨 Notfall', message: 'Ich habe einen dringenden Notfall' }
        ];
    }

    getStatistics() {
        const today = new Date().toISOString().split('T')[0];
        return {
            totalConversations: this.conversations.length,
            activeConversations: this.conversations.filter(c => c.status === 'active').length,
            todayMessages: this.conversations.reduce((sum, c) => sum + c.messages.filter(m => m.timestamp.startsWith(today)).length, 0)
        };
    }

    updateSettings(updates) { this.settings = { ...this.settings, ...updates }; this.saveSettings(); }
    getSettings() { return this.settings; }

    saveConversations() { this._safeSetItem('freyai_chatbot_conversations', this.conversations); }
    saveQueue() { this._safeSetItem('freyai_chatbot_queue', this.messageQueue); }
    saveSettings() { this._safeSetItem('freyai_chatbot_settings', this.settings); }

    _safeSetItem(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.warn('localStorage quota exceeded for', key);
                if (window.showToast) window.showToast('Speicher voll — bitte Daten exportieren', 'warning');
            }
        }
    }
}

window.chatbotService = new ChatbotService();
