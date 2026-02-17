/* ============================================
   Trade Calculator Service
   Gewerke-spezifische Kalkulationsvorlagen
   für Angebote und Rechnungen
   ============================================ */

class TradeCalculatorService {
    constructor() {
        this.TEMPLATES_KEY = 'mhs_trade_templates';
        this.TRADE_KEY = 'mhs_user_trade';

        this.customTemplates = JSON.parse(localStorage.getItem(this.TEMPLATES_KEY) || '[]');
        this.userTrade = localStorage.getItem(this.TRADE_KEY) || null;

        // Built-in templates organized by trade
        this.builtInTemplates = this._initBuiltInTemplates();
    }

    // ============================================
    // Built-In Template Definitions
    // ============================================
    _initBuiltInTemplates() {
        const templates = [];

        // ------------------------------------------
        // SHK (Sanitär-Heizung-Klima)
        // ------------------------------------------
        templates.push({
            id: 'BUILTIN-SHK-001',
            trade: 'shk',
            name: 'Heizungsinstallation',
            description: 'Heizkörpermontage inkl. Verrohrung und Arbeitszeit',
            items: [
                { id: 'shk-hz-01', label: 'Heizkörper Typ 22 (600×1000)', type: 'material', unit: 'Stk', defaultQuantity: 5, defaultPrice: 289.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-hz-02', label: 'Heizkörperventil Thermostat', type: 'material', unit: 'Stk', defaultQuantity: 5, defaultPrice: 32.50, wasteFactor: 1.0, optional: false },
                { id: 'shk-hz-03', label: 'Kupferrohr 15mm', type: 'material', unit: 'm', defaultQuantity: 40, defaultPrice: 8.90, wasteFactor: 1.10, optional: false },
                { id: 'shk-hz-04', label: 'Fittings / Verbinder Set', type: 'material', unit: 'Stk', defaultQuantity: 20, defaultPrice: 4.50, wasteFactor: 1.15, optional: false },
                { id: 'shk-hz-05', label: 'Isolierung Rohrleitungen', type: 'material', unit: 'm', defaultQuantity: 40, defaultPrice: 3.80, wasteFactor: 1.05, optional: false },
                { id: 'shk-hz-06', label: 'Montagearbeiten', type: 'arbeit', unit: 'h', defaultQuantity: 16, defaultPrice: 62.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-hz-07', label: 'Anfahrt', type: 'fahrt', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 45.00, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [
                { label: 'Kleinmaterial (Dübel, Schrauben etc.)', type: 'percentage', value: 3 }
            ],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-SHK-002',
            trade: 'shk',
            name: 'Badsanierung',
            description: 'Komplette Badsanierung inkl. Sanitärobjekte und Fliesen',
            items: [
                { id: 'shk-bad-01', label: 'WC-Keramik inkl. Spülkasten', type: 'material', unit: 'Stk', defaultQuantity: 1, defaultPrice: 385.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-bad-02', label: 'Waschbecken mit Unterschrank', type: 'material', unit: 'Stk', defaultQuantity: 1, defaultPrice: 320.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-bad-03', label: 'Duschkabine komplett', type: 'material', unit: 'Stk', defaultQuantity: 1, defaultPrice: 650.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-bad-04', label: 'Badewanne (optional)', type: 'material', unit: 'Stk', defaultQuantity: 0, defaultPrice: 480.00, wasteFactor: 1.0, optional: true },
                { id: 'shk-bad-05', label: 'Armaturen Set', type: 'material', unit: 'Stk', defaultQuantity: 3, defaultPrice: 125.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-bad-06', label: 'Fliesen Boden', type: 'material', unit: 'm²', defaultQuantity: 8, defaultPrice: 42.00, wasteFactor: 1.10, optional: false },
                { id: 'shk-bad-07', label: 'Fliesen Wand', type: 'material', unit: 'm²', defaultQuantity: 25, defaultPrice: 38.00, wasteFactor: 1.10, optional: false },
                { id: 'shk-bad-08', label: 'Fliesenkleber / Fugenmasse', type: 'material', unit: 'kg', defaultQuantity: 40, defaultPrice: 1.80, wasteFactor: 1.0, optional: false },
                { id: 'shk-bad-09', label: 'Sanitär-Installationsarbeiten', type: 'arbeit', unit: 'h', defaultQuantity: 24, defaultPrice: 62.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-bad-10', label: 'Fliesenarbeiten', type: 'arbeit', unit: 'h', defaultQuantity: 20, defaultPrice: 58.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-bad-11', label: 'Demontage/Entsorgung Altbad', type: 'entsorgung', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 450.00, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [
                { label: 'Kleinmaterial / Dichtungen', type: 'percentage', value: 5 }
            ],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-SHK-003',
            trade: 'shk',
            name: 'Wartung/Service Heizung',
            description: 'Jährliche Heizungswartung inkl. Verschleißteile',
            items: [
                { id: 'shk-wt-01', label: 'Wartungspauschale Gasheizung', type: 'pauschale', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 189.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-wt-02', label: 'Brennerdüse (bei Bedarf)', type: 'material', unit: 'Stk', defaultQuantity: 0, defaultPrice: 28.50, wasteFactor: 1.0, optional: true },
                { id: 'shk-wt-03', label: 'Dichtungen Set', type: 'material', unit: 'Stk', defaultQuantity: 1, defaultPrice: 15.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-wt-04', label: 'Abgasmessung / Protokoll', type: 'pauschale', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 65.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-wt-05', label: 'Anfahrt', type: 'fahrt', unit: 'km', defaultQuantity: 25, defaultPrice: 0.60, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-SHK-004',
            trade: 'shk',
            name: 'Rohrleitungsbau',
            description: 'Verlegung von Rohrleitungen (Kupfer/Edelstahl/Kunststoff)',
            items: [
                { id: 'shk-rl-01', label: 'Kupferrohr 22mm', type: 'material', unit: 'm', defaultQuantity: 30, defaultPrice: 12.50, wasteFactor: 1.10, optional: false },
                { id: 'shk-rl-02', label: 'Pressfittings Kupfer', type: 'material', unit: 'Stk', defaultQuantity: 25, defaultPrice: 6.80, wasteFactor: 1.15, optional: false },
                { id: 'shk-rl-03', label: 'Rohrschellen / Befestigung', type: 'material', unit: 'Stk', defaultQuantity: 20, defaultPrice: 2.40, wasteFactor: 1.0, optional: false },
                { id: 'shk-rl-04', label: 'Isolierung', type: 'material', unit: 'm', defaultQuantity: 30, defaultPrice: 3.80, wasteFactor: 1.05, optional: false },
                { id: 'shk-rl-05', label: 'Pressarbeiten / Montage', type: 'arbeit', unit: 'h', defaultQuantity: 12, defaultPrice: 62.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-rl-06', label: 'Druckprüfung', type: 'pauschale', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 85.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-rl-07', label: 'Anfahrt', type: 'fahrt', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 45.00, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [
                { label: 'Kleinmaterial', type: 'percentage', value: 3 }
            ],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-SHK-005',
            trade: 'shk',
            name: 'Notdienst SHK',
            description: 'Notfall-Einsatz (Rohrbruch, Heizungsausfall) mit Zuschlag',
            items: [
                { id: 'shk-nd-01', label: 'Notdienst-Einsatzpauschale', type: 'pauschale', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 95.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-nd-02', label: 'Arbeitszeit Notdienst', type: 'arbeit', unit: 'h', defaultQuantity: 2, defaultPrice: 85.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-nd-03', label: 'Ersatzteile / Material', type: 'material', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 120.00, wasteFactor: 1.0, optional: false },
                { id: 'shk-nd-04', label: 'Anfahrt Notdienst', type: 'fahrt', unit: 'km', defaultQuantity: 20, defaultPrice: 0.80, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [
                { label: 'Notdienstzuschlag (Abend/Wochenende)', type: 'percentage', value: 50 }
            ],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        // ------------------------------------------
        // Elektro (Electrical)
        // ------------------------------------------
        templates.push({
            id: 'BUILTIN-ELEK-001',
            trade: 'elektro',
            name: 'Elektroinstallation Neubau',
            description: 'Komplette Elektroinstallation für Neubau (pro Raum kalkuliert)',
            items: [
                { id: 'el-nb-01', label: 'Steckdosen (UP)', type: 'material', unit: 'Stk', defaultQuantity: 30, defaultPrice: 12.50, wasteFactor: 1.0, optional: false },
                { id: 'el-nb-02', label: 'Lichtschalter (UP)', type: 'material', unit: 'Stk', defaultQuantity: 15, defaultPrice: 14.00, wasteFactor: 1.0, optional: false },
                { id: 'el-nb-03', label: 'Sicherungskasten (3-reihig)', type: 'material', unit: 'Stk', defaultQuantity: 1, defaultPrice: 385.00, wasteFactor: 1.0, optional: false },
                { id: 'el-nb-04', label: 'Sicherungsautomaten', type: 'material', unit: 'Stk', defaultQuantity: 16, defaultPrice: 18.50, wasteFactor: 1.0, optional: false },
                { id: 'el-nb-05', label: 'FI-Schutzschalter', type: 'material', unit: 'Stk', defaultQuantity: 3, defaultPrice: 45.00, wasteFactor: 1.0, optional: false },
                { id: 'el-nb-06', label: 'NYM-J 3×1,5mm² Kabel', type: 'material', unit: 'm', defaultQuantity: 200, defaultPrice: 1.35, wasteFactor: 1.10, optional: false },
                { id: 'el-nb-07', label: 'NYM-J 5×2,5mm² Kabel', type: 'material', unit: 'm', defaultQuantity: 80, defaultPrice: 2.85, wasteFactor: 1.10, optional: false },
                { id: 'el-nb-08', label: 'Leerrohr', type: 'material', unit: 'm', defaultQuantity: 100, defaultPrice: 0.95, wasteFactor: 1.10, optional: false },
                { id: 'el-nb-09', label: 'Elektroinstallation Arbeit', type: 'arbeit', unit: 'h', defaultQuantity: 40, defaultPrice: 58.00, wasteFactor: 1.0, optional: false },
                { id: 'el-nb-10', label: 'Anfahrt', type: 'fahrt', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 45.00, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [
                { label: 'Kleinmaterial (Klemmen, Dosen, Schrauben)', type: 'percentage', value: 5 },
                { label: 'Prüfung / Abnahmeprotokoll', type: 'fixed', value: 120.00 }
            ],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-ELEK-002',
            trade: 'elektro',
            name: 'Altbausanierung Elektro',
            description: 'Elektrosanierung im Altbau mit Schlitzarbeiten',
            items: [
                { id: 'el-ab-01', label: 'Steckdosen (UP)', type: 'material', unit: 'Stk', defaultQuantity: 20, defaultPrice: 12.50, wasteFactor: 1.0, optional: false },
                { id: 'el-ab-02', label: 'Lichtschalter (UP)', type: 'material', unit: 'Stk', defaultQuantity: 10, defaultPrice: 14.00, wasteFactor: 1.0, optional: false },
                { id: 'el-ab-03', label: 'Sicherungskasten (Austausch)', type: 'material', unit: 'Stk', defaultQuantity: 1, defaultPrice: 420.00, wasteFactor: 1.0, optional: false },
                { id: 'el-ab-04', label: 'Sicherungsautomaten', type: 'material', unit: 'Stk', defaultQuantity: 12, defaultPrice: 18.50, wasteFactor: 1.0, optional: false },
                { id: 'el-ab-05', label: 'NYM-J 3×1,5mm² Kabel', type: 'material', unit: 'm', defaultQuantity: 150, defaultPrice: 1.35, wasteFactor: 1.10, optional: false },
                { id: 'el-ab-06', label: 'Stemm-/Schlitzarbeiten', type: 'arbeit', unit: 'm', defaultQuantity: 60, defaultPrice: 18.00, wasteFactor: 1.0, optional: false },
                { id: 'el-ab-07', label: 'Elektroinstallation Arbeit', type: 'arbeit', unit: 'h', defaultQuantity: 32, defaultPrice: 58.00, wasteFactor: 1.0, optional: false },
                { id: 'el-ab-08', label: 'Schuttentsorgung', type: 'entsorgung', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 180.00, wasteFactor: 1.0, optional: false },
                { id: 'el-ab-09', label: 'Anfahrt', type: 'fahrt', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 45.00, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [
                { label: 'Kleinmaterial', type: 'percentage', value: 5 },
                { label: 'Prüfung nach VDE', type: 'fixed', value: 135.00 }
            ],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-ELEK-003',
            trade: 'elektro',
            name: 'Smart Home Installation',
            description: 'Smart Home Komponenten und Programmierung',
            items: [
                { id: 'el-sh-01', label: 'Smart Home Zentrale', type: 'material', unit: 'Stk', defaultQuantity: 1, defaultPrice: 320.00, wasteFactor: 1.0, optional: false },
                { id: 'el-sh-02', label: 'Funk-Schaltaktoren', type: 'material', unit: 'Stk', defaultQuantity: 10, defaultPrice: 65.00, wasteFactor: 1.0, optional: false },
                { id: 'el-sh-03', label: 'Funk-Dimmer', type: 'material', unit: 'Stk', defaultQuantity: 5, defaultPrice: 78.00, wasteFactor: 1.0, optional: false },
                { id: 'el-sh-04', label: 'Bewegungsmelder (innen)', type: 'material', unit: 'Stk', defaultQuantity: 4, defaultPrice: 55.00, wasteFactor: 1.0, optional: false },
                { id: 'el-sh-05', label: 'Raumthermostat Smart', type: 'material', unit: 'Stk', defaultQuantity: 4, defaultPrice: 89.00, wasteFactor: 1.0, optional: true },
                { id: 'el-sh-06', label: 'Programmierung / Konfiguration', type: 'arbeit', unit: 'h', defaultQuantity: 8, defaultPrice: 72.00, wasteFactor: 1.0, optional: false },
                { id: 'el-sh-07', label: 'Installation / Montage', type: 'arbeit', unit: 'h', defaultQuantity: 12, defaultPrice: 58.00, wasteFactor: 1.0, optional: false },
                { id: 'el-sh-08', label: 'Einweisung Kunde', type: 'arbeit', unit: 'h', defaultQuantity: 1, defaultPrice: 58.00, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [
                { label: 'Kleinmaterial / Kabel', type: 'percentage', value: 4 }
            ],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-ELEK-004',
            trade: 'elektro',
            name: 'Photovoltaik-Anlage',
            description: 'PV-Anlage inkl. Wechselrichter und Anmeldung',
            items: [
                { id: 'el-pv-01', label: 'PV-Module (400Wp)', type: 'material', unit: 'Stk', defaultQuantity: 25, defaultPrice: 185.00, wasteFactor: 1.0, optional: false },
                { id: 'el-pv-02', label: 'Wechselrichter 10kW', type: 'material', unit: 'Stk', defaultQuantity: 1, defaultPrice: 1850.00, wasteFactor: 1.0, optional: false },
                { id: 'el-pv-03', label: 'Montagesystem Schrägdach', type: 'material', unit: 'Stk', defaultQuantity: 25, defaultPrice: 32.00, wasteFactor: 1.0, optional: false },
                { id: 'el-pv-04', label: 'DC-Kabel 6mm²', type: 'material', unit: 'm', defaultQuantity: 60, defaultPrice: 2.80, wasteFactor: 1.10, optional: false },
                { id: 'el-pv-05', label: 'AC-Anschluss / Zählerkasten', type: 'material', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 380.00, wasteFactor: 1.0, optional: false },
                { id: 'el-pv-06', label: 'Batterie-Speicher 10kWh (optional)', type: 'material', unit: 'Stk', defaultQuantity: 0, defaultPrice: 5200.00, wasteFactor: 1.0, optional: true },
                { id: 'el-pv-07', label: 'Dachmontage', type: 'arbeit', unit: 'h', defaultQuantity: 16, defaultPrice: 62.00, wasteFactor: 1.0, optional: false },
                { id: 'el-pv-08', label: 'Elektroinstallation', type: 'arbeit', unit: 'h', defaultQuantity: 8, defaultPrice: 62.00, wasteFactor: 1.0, optional: false },
                { id: 'el-pv-09', label: 'Anmeldung Netzbetreiber', type: 'pauschale', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 250.00, wasteFactor: 1.0, optional: false },
                { id: 'el-pv-10', label: 'Anfahrt', type: 'fahrt', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 65.00, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [
                { label: 'Kleinmaterial / Stecker / Klemmen', type: 'percentage', value: 3 }
            ],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        // ------------------------------------------
        // Maler/Lackierer (Painting)
        // ------------------------------------------
        templates.push({
            id: 'BUILTIN-MALER-001',
            trade: 'maler',
            name: 'Innenanstrich',
            description: 'Wand- und Deckenanstrich inkl. Grundierung',
            items: [
                { id: 'ml-ia-01', label: 'Wandfläche streichen', type: 'arbeit', unit: 'm²', defaultQuantity: 80, defaultPrice: 8.50, wasteFactor: 1.0, optional: false },
                { id: 'ml-ia-02', label: 'Deckenfläche streichen', type: 'arbeit', unit: 'm²', defaultQuantity: 25, defaultPrice: 9.50, wasteFactor: 1.0, optional: false },
                { id: 'ml-ia-03', label: 'Grundierung', type: 'material', unit: 'l', defaultQuantity: 10, defaultPrice: 4.20, wasteFactor: 1.10, optional: false },
                { id: 'ml-ia-04', label: 'Wandfarbe (Innen, weiß, Premium)', type: 'material', unit: 'l', defaultQuantity: 25, defaultPrice: 5.80, wasteFactor: 1.10, optional: false },
                { id: 'ml-ia-05', label: 'Abdeckmaterial / Klebeband', type: 'material', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 35.00, wasteFactor: 1.0, optional: false },
                { id: 'ml-ia-06', label: 'Anfahrt', type: 'fahrt', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 40.00, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-MALER-002',
            trade: 'maler',
            name: 'Fassadenanstrich',
            description: 'Außenanstrich Fassade inkl. Gerüst',
            items: [
                { id: 'ml-fa-01', label: 'Fassadenfläche streichen', type: 'arbeit', unit: 'm²', defaultQuantity: 150, defaultPrice: 14.50, wasteFactor: 1.0, optional: false },
                { id: 'ml-fa-02', label: 'Grundierung Fassade', type: 'material', unit: 'l', defaultQuantity: 20, defaultPrice: 6.50, wasteFactor: 1.10, optional: false },
                { id: 'ml-fa-03', label: 'Fassadenfarbe (Silikonharz)', type: 'material', unit: 'l', defaultQuantity: 50, defaultPrice: 8.90, wasteFactor: 1.10, optional: false },
                { id: 'ml-fa-04', label: 'Gerüst Miete (4 Wochen)', type: 'material', unit: 'm²', defaultQuantity: 150, defaultPrice: 8.00, wasteFactor: 1.0, optional: false },
                { id: 'ml-fa-05', label: 'Gerüst Auf-/Abbau', type: 'pauschale', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 650.00, wasteFactor: 1.0, optional: false },
                { id: 'ml-fa-06', label: 'Abdeckung / Folie', type: 'material', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 120.00, wasteFactor: 1.0, optional: false },
                { id: 'ml-fa-07', label: 'Anfahrt', type: 'fahrt', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 55.00, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [
                { label: 'Witterungszuschlag', type: 'percentage', value: 5 }
            ],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-MALER-003',
            trade: 'maler',
            name: 'Tapezierarbeiten',
            description: 'Tapezieren inkl. Altentfernung und Material',
            items: [
                { id: 'ml-tp-01', label: 'Alte Tapete entfernen', type: 'arbeit', unit: 'm²', defaultQuantity: 60, defaultPrice: 5.50, wasteFactor: 1.0, optional: true },
                { id: 'ml-tp-02', label: 'Untergrund vorbereiten/spachteln', type: 'arbeit', unit: 'm²', defaultQuantity: 60, defaultPrice: 4.00, wasteFactor: 1.0, optional: false },
                { id: 'ml-tp-03', label: 'Tapezieren', type: 'arbeit', unit: 'm²', defaultQuantity: 60, defaultPrice: 12.00, wasteFactor: 1.0, optional: false },
                { id: 'ml-tp-04', label: 'Tapete (Vliestapete)', type: 'material', unit: 'm²', defaultQuantity: 60, defaultPrice: 6.80, wasteFactor: 1.15, optional: false },
                { id: 'ml-tp-05', label: 'Tapetenkleister', type: 'material', unit: 'kg', defaultQuantity: 5, defaultPrice: 4.50, wasteFactor: 1.0, optional: false },
                { id: 'ml-tp-06', label: 'Anfahrt', type: 'fahrt', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 40.00, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-MALER-004',
            trade: 'maler',
            name: 'Lackierarbeiten',
            description: 'Türen, Fenster und Heizkörper lackieren',
            items: [
                { id: 'ml-lk-01', label: 'Türen lackieren (beidseitig)', type: 'arbeit', unit: 'Stk', defaultQuantity: 5, defaultPrice: 95.00, wasteFactor: 1.0, optional: false },
                { id: 'ml-lk-02', label: 'Fenster lackieren', type: 'arbeit', unit: 'Stk', defaultQuantity: 8, defaultPrice: 65.00, wasteFactor: 1.0, optional: false },
                { id: 'ml-lk-03', label: 'Heizkörper lackieren', type: 'arbeit', unit: 'Stk', defaultQuantity: 5, defaultPrice: 55.00, wasteFactor: 1.0, optional: true },
                { id: 'ml-lk-04', label: 'Lack (Acryl, weiß)', type: 'material', unit: 'l', defaultQuantity: 10, defaultPrice: 12.50, wasteFactor: 1.10, optional: false },
                { id: 'ml-lk-05', label: 'Grundierung Holz/Metall', type: 'material', unit: 'l', defaultQuantity: 5, defaultPrice: 9.80, wasteFactor: 1.10, optional: false },
                { id: 'ml-lk-06', label: 'Schleifmaterial / Abdeckung', type: 'material', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 45.00, wasteFactor: 1.0, optional: false },
                { id: 'ml-lk-07', label: 'Anfahrt', type: 'fahrt', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 40.00, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-MALER-005',
            trade: 'maler',
            name: 'Spachtelarbeiten',
            description: 'Wand-/Deckenspachtelung in verschiedenen Qualitätsstufen',
            items: [
                { id: 'ml-sp-01', label: 'Spachtelarbeiten Q2 (Standard)', type: 'arbeit', unit: 'm²', defaultQuantity: 50, defaultPrice: 12.00, wasteFactor: 1.0, optional: false },
                { id: 'ml-sp-02', label: 'Spachtelarbeiten Q3 (Erhöht)', type: 'arbeit', unit: 'm²', defaultQuantity: 0, defaultPrice: 18.00, wasteFactor: 1.0, optional: true },
                { id: 'ml-sp-03', label: 'Spachtelarbeiten Q4 (Premium)', type: 'arbeit', unit: 'm²', defaultQuantity: 0, defaultPrice: 28.00, wasteFactor: 1.0, optional: true },
                { id: 'ml-sp-04', label: 'Spachtelmasse', type: 'material', unit: 'kg', defaultQuantity: 30, defaultPrice: 1.50, wasteFactor: 1.10, optional: false },
                { id: 'ml-sp-05', label: 'Grundierung / Tiefengrund', type: 'material', unit: 'l', defaultQuantity: 10, defaultPrice: 3.80, wasteFactor: 1.0, optional: false },
                { id: 'ml-sp-06', label: 'Schleifmaterial', type: 'material', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 25.00, wasteFactor: 1.0, optional: false },
                { id: 'ml-sp-07', label: 'Anfahrt', type: 'fahrt', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 40.00, wasteFactor: 1.0, optional: false }
            ],
            surcharges: [],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        // ------------------------------------------
        // Allgemein (General / All Trades)
        // ------------------------------------------
        templates.push({
            id: 'BUILTIN-ALLG-001',
            trade: 'allgemein',
            name: 'Fahrtkosten',
            description: 'Standard-Fahrtkostenberechnung nach km oder pauschal',
            items: [
                { id: 'allg-fk-01', label: 'Fahrtkosten (km-basiert)', type: 'fahrt', unit: 'km', defaultQuantity: 30, defaultPrice: 0.52, wasteFactor: 1.0, optional: false },
                { id: 'allg-fk-02', label: 'Fahrtkosten (pauschal, alternativ)', type: 'fahrt', unit: 'pauschal', defaultQuantity: 0, defaultPrice: 45.00, wasteFactor: 1.0, optional: true },
                { id: 'allg-fk-03', label: 'Parkgebühren', type: 'fahrt', unit: 'pauschal', defaultQuantity: 0, defaultPrice: 8.00, wasteFactor: 1.0, optional: true }
            ],
            surcharges: [],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-ALLG-002',
            trade: 'allgemein',
            name: 'Entsorgung',
            description: 'Entsorgungskosten für Bauschutt und Abfälle',
            items: [
                { id: 'allg-en-01', label: 'Entsorgungspauschale (klein)', type: 'entsorgung', unit: 'pauschal', defaultQuantity: 1, defaultPrice: 85.00, wasteFactor: 1.0, optional: false },
                { id: 'allg-en-02', label: 'Container 3m³ (Bauschutt)', type: 'entsorgung', unit: 'Stk', defaultQuantity: 0, defaultPrice: 320.00, wasteFactor: 1.0, optional: true },
                { id: 'allg-en-03', label: 'Container 7m³ (Bauschutt)', type: 'entsorgung', unit: 'Stk', defaultQuantity: 0, defaultPrice: 480.00, wasteFactor: 1.0, optional: true },
                { id: 'allg-en-04', label: 'Sondermüll-Entsorgung', type: 'entsorgung', unit: 'kg', defaultQuantity: 0, defaultPrice: 2.50, wasteFactor: 1.0, optional: true }
            ],
            surcharges: [],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-ALLG-003',
            trade: 'allgemein',
            name: 'Aufmaß-Kalkulation',
            description: 'Mengenermittlung mit Verschnittfaktor',
            items: [
                { id: 'allg-am-01', label: 'Fläche (m²)', type: 'material', unit: 'm²', defaultQuantity: 1, defaultPrice: 0.00, wasteFactor: 1.10, optional: false },
                { id: 'allg-am-02', label: 'Volumen (m³)', type: 'material', unit: 'm³', defaultQuantity: 0, defaultPrice: 0.00, wasteFactor: 1.05, optional: true },
                { id: 'allg-am-03', label: 'Stück', type: 'material', unit: 'Stk', defaultQuantity: 0, defaultPrice: 0.00, wasteFactor: 1.0, optional: true },
                { id: 'allg-am-04', label: 'Laufende Meter', type: 'material', unit: 'm', defaultQuantity: 0, defaultPrice: 0.00, wasteFactor: 1.10, optional: true }
            ],
            surcharges: [],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        templates.push({
            id: 'BUILTIN-ALLG-004',
            trade: 'allgemein',
            name: 'Zuschläge / Sonderarbeitszeiten',
            description: 'Berechnung von Zuschlägen für Sonderarbeitszeiten',
            items: [
                { id: 'allg-zu-01', label: 'Reguläre Arbeitsstunden', type: 'arbeit', unit: 'h', defaultQuantity: 8, defaultPrice: 58.00, wasteFactor: 1.0, optional: false },
                { id: 'allg-zu-02', label: 'Samstagsarbeit (+25%)', type: 'arbeit', unit: 'h', defaultQuantity: 0, defaultPrice: 72.50, wasteFactor: 1.0, optional: true },
                { id: 'allg-zu-03', label: 'Sonntagsarbeit (+50%)', type: 'arbeit', unit: 'h', defaultQuantity: 0, defaultPrice: 87.00, wasteFactor: 1.0, optional: true },
                { id: 'allg-zu-04', label: 'Nachtarbeit (+50%)', type: 'arbeit', unit: 'h', defaultQuantity: 0, defaultPrice: 87.00, wasteFactor: 1.0, optional: true },
                { id: 'allg-zu-05', label: 'Feiertagsarbeit (+100%)', type: 'arbeit', unit: 'h', defaultQuantity: 0, defaultPrice: 116.00, wasteFactor: 1.0, optional: true }
            ],
            surcharges: [],
            isCustom: false,
            createdAt: '2025-01-01T00:00:00.000Z'
        });

        return templates;
    }

    // ============================================
    // Template Access
    // ============================================

    /**
     * Get all templates for a specific trade
     * @param {string} trade - Trade identifier
     * @returns {Array} Templates for the trade
     */
    getTemplates(trade) {
        const builtIn = this.builtInTemplates.filter(t => t.trade === trade);
        const custom = this.customTemplates.filter(t => t.trade === trade);
        return [...builtIn, ...custom];
    }

    /**
     * Get all templates across all trades
     * @returns {Array} All templates
     */
    getAllTemplates() {
        return [...this.builtInTemplates, ...this.customTemplates];
    }

    /**
     * Get a single template by ID
     * @param {string} id - Template ID
     * @returns {Object|null} Template or null
     */
    getTemplate(id) {
        return this.builtInTemplates.find(t => t.id === id) ||
               this.customTemplates.find(t => t.id === id) ||
               null;
    }

    /**
     * Create a user-defined custom template
     * @param {Object} data - Template data
     * @returns {Object} Created template
     */
    createCustomTemplate(data) {
        const template = {
            id: `CALC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            trade: data.trade || 'allgemein',
            name: data.name || 'Eigene Vorlage',
            description: data.description || '',
            items: (data.items || []).map((item, idx) => ({
                id: item.id || `custom-${Date.now()}-${idx}`,
                label: item.label || '',
                type: item.type || 'material',
                unit: item.unit || 'Stk',
                defaultQuantity: parseFloat(item.defaultQuantity) || 0,
                defaultPrice: parseFloat(item.defaultPrice) || 0,
                wasteFactor: parseFloat(item.wasteFactor) || 1.0,
                optional: !!item.optional
            })),
            surcharges: (data.surcharges || []).map(s => ({
                label: s.label || '',
                type: s.type || 'fixed',
                value: parseFloat(s.value) || 0
            })),
            isCustom: true,
            createdAt: new Date().toISOString()
        };

        this.customTemplates.push(template);
        this._saveCustomTemplates();
        return template;
    }

    /**
     * Update an existing custom template
     * @param {string} id - Template ID
     * @param {Object} data - Updated fields
     * @returns {Object|null} Updated template or null
     */
    updateTemplate(id, data) {
        const index = this.customTemplates.findIndex(t => t.id === id);
        if (index === -1) { return null; }

        const existing = this.customTemplates[index];
        this.customTemplates[index] = {
            ...existing,
            ...data,
            id: existing.id,
            isCustom: true,
            createdAt: existing.createdAt
        };

        this._saveCustomTemplates();
        return this.customTemplates[index];
    }

    /**
     * Delete a custom template (built-in templates cannot be deleted)
     * @param {string} id - Template ID
     * @returns {boolean} Success
     */
    deleteTemplate(id) {
        const index = this.customTemplates.findIndex(t => t.id === id);
        if (index === -1) { return false; }

        this.customTemplates.splice(index, 1);
        this._saveCustomTemplates();
        return true;
    }

    /**
     * Duplicate an existing template as a custom template
     * @param {string} id - Source template ID
     * @returns {Object} New custom template
     */
    duplicateTemplate(id) {
        const source = this.getTemplate(id);
        if (!source) { return null; }

        const clone = JSON.parse(JSON.stringify(source));
        clone.name = source.name + ' (Kopie)';
        clone.description = source.description;

        return this.createCustomTemplate(clone);
    }

    // ============================================
    // Calculation Engine
    // ============================================

    /**
     * Calculate totals for a template with given quantities
     * @param {string} templateId - Template ID
     * @param {Object} quantities - Map of itemId → { qty, price } overrides
     * @returns {Object} Calculation result
     */
    calculate(templateId, quantities) {
        const template = this.getTemplate(templateId);
        if (!template) { return null; }

        const resultItems = [];
        let subtotal = 0;

        for (const item of template.items) {
            const override = quantities[item.id] || {};
            const qty = override.qty !== undefined ? parseFloat(override.qty) : item.defaultQuantity;
            const unitPrice = override.price !== undefined ? parseFloat(override.price) : item.defaultPrice;
            const wasteFactor = item.wasteFactor || 1.0;

            if (qty <= 0) { continue; }

            const effectiveQty = qty * wasteFactor;
            const total = effectiveQty * unitPrice;

            resultItems.push({
                id: item.id,
                label: item.label,
                qty: qty,
                effectiveQty: Math.round(effectiveQty * 100) / 100,
                unit: item.unit,
                unitPrice: unitPrice,
                wasteFactor: wasteFactor,
                total: Math.round(total * 100) / 100,
                type: item.type,
                optional: item.optional
            });

            subtotal += total;
        }

        subtotal = Math.round(subtotal * 100) / 100;

        // Apply surcharges
        const surchargeResults = [];
        let surchargeTotal = 0;

        for (const surcharge of template.surcharges) {
            let amount;
            if (surcharge.type === 'percentage') {
                amount = subtotal * (surcharge.value / 100);
            } else {
                amount = surcharge.value;
            }
            amount = Math.round(amount * 100) / 100;
            surchargeResults.push({
                label: surcharge.label,
                type: surcharge.type,
                value: surcharge.value,
                amount: amount
            });
            surchargeTotal += amount;
        }

        const netto = Math.round((subtotal + surchargeTotal) * 100) / 100;
        const mwst = Math.round(netto * 0.19 * 100) / 100;
        const brutto = Math.round((netto + mwst) * 100) / 100;

        return {
            templateId: template.id,
            templateName: template.name,
            items: resultItems,
            subtotal: subtotal,
            surcharges: surchargeResults,
            surchargeTotal: surchargeTotal,
            netto: netto,
            mwst: mwst,
            brutto: brutto
        };
    }

    // ============================================
    // Quick Helper Calculations
    // ============================================

    /**
     * Calculate area with optional waste factor
     * @param {number} length - Length in meters
     * @param {number} width - Width in meters
     * @param {number} wasteFactor - Waste factor (e.g., 1.10 for 10%)
     * @returns {number} Area in m²
     */
    calculateArea(length, width, wasteFactor = 1.0) {
        return Math.round(length * width * wasteFactor * 100) / 100;
    }

    /**
     * Calculate volume
     * @param {number} length - Length in meters
     * @param {number} width - Width in meters
     * @param {number} height - Height in meters
     * @returns {number} Volume in m³
     */
    calculateVolume(length, width, height) {
        return Math.round(length * width * height * 1000) / 1000;
    }

    /**
     * Calculate paint needed
     * @param {number} areaSqm - Area in m²
     * @param {number} coveragePerLiter - Coverage in m² per liter
     * @returns {number} Liters needed
     */
    calculatePaintNeeded(areaSqm, coveragePerLiter) {
        if (!coveragePerLiter || coveragePerLiter <= 0) { return 0; }
        return Math.ceil(areaSqm / coveragePerLiter);
    }

    /**
     * Calculate tile count needed
     * @param {number} areaSqm - Area in m²
     * @param {number} tileSize - Single tile area in m² (e.g., 0.09 for 30×30cm)
     * @param {number} wastePct - Waste percentage (e.g., 10)
     * @returns {Object} { tiles, cartons } (assuming ~25 tiles per carton)
     */
    calculateTileNeeded(areaSqm, tileSize, wastePct = 10) {
        if (!tileSize || tileSize <= 0) { return { tiles: 0, cartons: 0 }; }
        const factor = 1 + (wastePct / 100);
        const tiles = Math.ceil((areaSqm * factor) / tileSize);
        const cartons = Math.ceil(tiles / 25);
        return { tiles, cartons };
    }

    /**
     * Calculate cable length needed
     * @param {number} rooms - Number of rooms
     * @param {number} avgDistancePerRoom - Average cable distance per room in meters
     * @returns {number} Total meters needed
     */
    calculateCableLength(rooms, avgDistancePerRoom = 25) {
        return Math.ceil(rooms * avgDistancePerRoom * 1.15); // +15% reserve
    }

    // ============================================
    // Integration — Create Angebot Data
    // ============================================

    /**
     * Create an Angebot-ready data structure from a calculation
     * @param {string} templateId - Template ID
     * @param {Object} quantities - Quantities override
     * @param {Object} customerData - Customer information
     * @returns {Object} Angebot-ready data
     */
    createAngebotFromCalculation(templateId, quantities, customerData = {}) {
        const result = this.calculate(templateId, quantities);
        if (!result) { return null; }

        const template = this.getTemplate(templateId);

        // Build positions for Angebot
        const positionen = result.items.map((item, idx) => ({
            pos: idx + 1,
            bezeichnung: item.label,
            menge: item.qty,
            einheit: item.unit,
            einzelpreis: item.unitPrice,
            gesamtpreis: item.total,
            typ: item.type
        }));

        // Add surcharges as separate positions
        result.surcharges.forEach((s, idx) => {
            positionen.push({
                pos: positionen.length + 1,
                bezeichnung: s.label + (s.type === 'percentage' ? ` (${s.value}%)` : ''),
                menge: 1,
                einheit: 'pauschal',
                einzelpreis: s.amount,
                gesamtpreis: s.amount,
                typ: 'zuschlag'
            });
        });

        return {
            kunde: customerData.name || '',
            kundeEmail: customerData.email || '',
            kundeAdresse: customerData.address || '',
            kundeTelefon: customerData.phone || '',
            betreff: template.name,
            beschreibung: template.description,
            positionen: positionen,
            netto: result.netto,
            mwst: result.mwst,
            brutto: result.brutto,
            erstelltAus: `Kalkulation: ${template.name}`,
            kalkulationsVorlage: template.id,
            erstelltAm: new Date().toISOString()
        };
    }

    // ============================================
    // Trade Configuration
    // ============================================

    /**
     * Get list of available trades
     * @returns {Array} Trade definitions
     */
    getAvailableTrades() {
        return [
            { id: 'shk', name: 'SHK', fullName: 'Sanitär-Heizung-Klima', icon: '\uD83D\uDD27' },
            { id: 'elektro', name: 'Elektro', fullName: 'Elektroinstallation', icon: '\u26A1' },
            { id: 'maler', name: 'Maler/Lackierer', fullName: 'Maler- und Lackiererarbeiten', icon: '\uD83C\uDFA8' },
            { id: 'tischler', name: 'Tischler', fullName: 'Tischler / Schreiner', icon: '\uD83E\uDE9A' },
            { id: 'dachdecker', name: 'Dachdecker', fullName: 'Dachdeckerarbeiten', icon: '\uD83C\uDFD7\uFE0F' },
            { id: 'fliesenleger', name: 'Fliesenleger', fullName: 'Fliesen- und Plattenarbeiten', icon: '\u25FB\uFE0F' },
            { id: 'maurer', name: 'Maurer', fullName: 'Maurer- und Betonarbeiten', icon: '\uD83E\uDDF1' },
            { id: 'allgemein', name: 'Allgemein', fullName: 'Allgemeine Positionen', icon: '\uD83D\uDCC4' }
        ];
    }

    /**
     * Get user's stored trade preference
     * @returns {string|null} Trade id or null
     */
    getUserTrade() {
        return this.userTrade;
    }

    /**
     * Set and persist user's trade preference
     * @param {string} trade - Trade identifier
     */
    setUserTrade(trade) {
        this.userTrade = trade;
        localStorage.setItem(this.TRADE_KEY, trade);
    }

    // ============================================
    // Persistence
    // ============================================

    _saveCustomTemplates() {
        localStorage.setItem(this.TEMPLATES_KEY, JSON.stringify(this.customTemplates));
    }
}

// Initialize as global singleton
window.tradeCalculatorService = new TradeCalculatorService();
