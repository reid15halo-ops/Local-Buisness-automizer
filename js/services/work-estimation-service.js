/* ============================================
   Work Hours Estimation Service
   KI-gestützte Arbeitsstunden-Schätzung
   ============================================ */

class WorkEstimationService {
    constructor() {
        this.historischeArbeiten = JSON.parse(localStorage.getItem('freyai_historische_arbeiten') || '[]');

        // Basis-Richtwerte pro Leistungsart (Stunden)
        this.basisRichtwerte = {
            'metallbau': {
                basis: 8,
                proPortion: 4,
                komplexitaetsFaktor: { einfach: 0.7, mittel: 1.0, komplex: 1.5 },
                beschreibung: 'Metallbau / Stahlkonstruktion'
            },
            'schweissen': {
                basis: 2,
                proPortion: 2,
                komplexitaetsFaktor: { einfach: 0.6, mittel: 1.0, komplex: 1.4 },
                beschreibung: 'Schweißarbeiten'
            },
            'rohrleitungsbau': {
                basis: 4,
                proPortion: 3,
                komplexitaetsFaktor: { einfach: 0.8, mittel: 1.0, komplex: 1.3 },
                beschreibung: 'Rohrleitungsbau'
            },
            'industriemontage': {
                basis: 6,
                proPortion: 4,
                komplexitaetsFaktor: { einfach: 0.8, mittel: 1.0, komplex: 1.5 },
                beschreibung: 'Industriemontage'
            },
            'hydraulik': {
                basis: 1,
                proPortion: 0.5,
                komplexitaetsFaktor: { einfach: 0.7, mittel: 1.0, komplex: 1.3 },
                beschreibung: 'Hydraulikschläuche'
            },
            'reparatur': {
                basis: 2,
                proPortion: 1.5,
                komplexitaetsFaktor: { einfach: 0.6, mittel: 1.0, komplex: 2.0 },
                beschreibung: 'Reparatur / Wartung'
            },
            'sonstiges': {
                basis: 4,
                proPortion: 2,
                komplexitaetsFaktor: { einfach: 0.7, mittel: 1.0, komplex: 1.4 },
                beschreibung: 'Sonstiges'
            }
        };

        // Keyword-basierte Komplexitätsanalyse
        this.komplexitaetsKeywords = {
            einfach: ['einfach', 'standard', 'klein', 'kurz', 'schnell', 'basic', 'einzeln', 'simpel'],
            komplex: ['komplex', 'groß', 'umfangreich', 'schwierig', 'spezial', 'maßanfertigung',
                'mehrere', 'mehrteilig', 'aufwendig', 'DIN', 'zertifiziert', 'Prüfung',
                'Berechnung', 'Statik', 'Dokumentation', 'Abnahme']
        };
    }

    // ============================================
    // Basis-Schätzung
    // ============================================
    schaetzeArbeitsstunden(anfrage) {
        const leistungsart = anfrage.leistungsart || 'sonstiges';
        const richtwert = this.basisRichtwerte[leistungsart] || this.basisRichtwerte['sonstiges'];

        // Komplexität aus Beschreibung ermitteln
        const komplexitaet = this.analysiereKomplexitaet(anfrage.beschreibung);

        // Basis-Berechnung
        let stunden = richtwert.basis;

        // Faktor für Komplexität
        stunden *= richtwert.komplexitaetsFaktor[komplexitaet];

        // Budget als Anhaltspunkt (wenn vorhanden)
        if (anfrage.budget && anfrage.budget > 0) {
            const stundensatz = parseFloat(localStorage.getItem('stundensatz') || '65');
            const budgetStunden = anfrage.budget / stundensatz;
            // Gewichteter Durchschnitt
            stunden = (stunden * 0.3) + (budgetStunden * 0.7);
        }

        // Historische Daten einbeziehen
        const historisch = this.findeAehnlicheArbeiten(anfrage);
        if (historisch.length > 0) {
            const durchschnitt = historisch.reduce((sum, h) => sum + h.stunden, 0) / historisch.length;
            stunden = (stunden * 0.4) + (durchschnitt * 0.6);
        }

        return {
            geschaetzteStunden: Math.round(stunden * 2) / 2, // Auf halbe Stunden runden
            komplexitaet: komplexitaet,
            konfidenz: this.berechneKonfidenz(anfrage, historisch),
            richtwert: richtwert,
            historischeDaten: historisch.length,
            details: this.erstelleDetails(anfrage, stunden, komplexitaet, richtwert)
        };
    }

    // ============================================
    // Komplexitätsanalyse
    // ============================================
    analysiereKomplexitaet(beschreibung) {
        if (!beschreibung) {return 'mittel';}

        const text = beschreibung.toLowerCase();
        let punkteEinfach = 0;
        let punkteKomplex = 0;

        this.komplexitaetsKeywords.einfach.forEach(kw => {
            if (text.includes(kw)) {punkteEinfach++;}
        });

        this.komplexitaetsKeywords.komplex.forEach(kw => {
            if (text.includes(kw)) {punkteKomplex++;}
        });

        if (punkteKomplex > punkteEinfach + 1) {return 'komplex';}
        if (punkteEinfach > punkteKomplex + 1) {return 'einfach';}
        return 'mittel';
    }

    // ============================================
    // KI-gestützte Schätzung mit Gemini
    // ============================================
    async schaetzeMitGemini(anfrage, materialien = []) {
        if (!window.geminiService?.isConfigured) {
            return this.schaetzeArbeitsstunden(anfrage);
        }

        const ap = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
        const bizType = ap.business_type || window.storeService?.state?.settings?.businessType || 'Handwerks-Meister';
        const prompt = `Du bist ein erfahrener ${bizType}. Schätze die benötigten Arbeitsstunden für folgendes Projekt:

Leistungsart: ${this.basisRichtwerte[anfrage.leistungsart]?.beschreibung || anfrage.leistungsart}
Beschreibung: ${anfrage.beschreibung}
${anfrage.budget ? `Kundenbudget: ${anfrage.budget}€` : ''}
${materialien.length > 0 ? `Geplante Materialien: ${materialien.map(m => m.bezeichnung).join(', ')}` : ''}

Berücksichtige:
- Vorbereitung und Materialbeschaffung
- Fertigung/Montage
- Qualitätskontrolle
- Dokumentation (falls DIN EN 1090 relevant)

Antworte NUR im JSON-Format:
{
  "geschaetzteStunden": X,
  "aufschluesselung": {
    "vorbereitung": X,
    "fertigung": X,
    "montage": X,
    "dokumentation": X
  },
  "komplexitaet": "einfach|mittel|komplex",
  "begruendung": "Kurze Erklärung"
}`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${localStorage.getItem('gemini_api_key')}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3 }
                })
            });

            if (!response.ok) {throw new Error('API Error');}

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                return {
                    ...result,
                    quelle: 'gemini',
                    konfidenz: 'hoch'
                };
            }
        } catch (error) {
            console.error('Gemini estimation error:', error);
        }

        return this.schaetzeArbeitsstunden(anfrage);
    }

    // ============================================
    // Historische Daten
    // ============================================
    speichereHistorischeArbeit(auftrag) {
        const eintrag = {
            id: auftrag.id,
            leistungsart: auftrag.leistungsart,
            beschreibung: auftrag.positionen?.map(p => p.beschreibung).join(', ') || '',
            stunden: auftrag.arbeitszeit || 0,
            materialKosten: auftrag.materialKosten || 0,
            gesamtWert: auftrag.angebotsWert || 0,
            datum: new Date().toISOString()
        };

        this.historischeArbeiten.push(eintrag);
        if (this.historischeArbeiten.length > 100) {
            this.historischeArbeiten = this.historischeArbeiten.slice(-100);
        }
        localStorage.setItem('freyai_historische_arbeiten', JSON.stringify(this.historischeArbeiten));
    }

    findeAehnlicheArbeiten(anfrage) {
        return this.historischeArbeiten.filter(h => {
            // Gleiche Leistungsart
            if (h.leistungsart === anfrage.leistungsart) {return true;}

            // Ähnliche Beschreibung
            if (anfrage.beschreibung && h.beschreibung) {
                const worte = anfrage.beschreibung.toLowerCase().split(/\s+/);
                const matches = worte.filter(w =>
                    w.length > 3 && h.beschreibung.toLowerCase().includes(w)
                );
                return matches.length >= 2;
            }
            return false;
        }).slice(-5); // Letzte 5 relevante
    }

    // ============================================
    // Helpers
    // ============================================
    berechneKonfidenz(anfrage, historisch) {
        if (historisch.length >= 5) {return 'hoch';}
        if (historisch.length >= 2) {return 'mittel';}
        if (anfrage.budget) {return 'mittel';}
        return 'niedrig';
    }

    erstelleDetails(anfrage, stunden, komplexitaet, richtwert) {
        return {
            basisStunden: richtwert.basis,
            komplexitaetsFaktor: richtwert.komplexitaetsFaktor[komplexitaet],
            ermittelteKomplexitaet: komplexitaet,
            leistungsart: richtwert.beschreibung,
            empfehlung: this.getEmpfehlung(stunden, komplexitaet)
        };
    }

    getEmpfehlung(stunden, komplexitaet) {
        if (komplexitaet === 'komplex') {
            return 'Bei komplexen Arbeiten empfehlen wir einen Puffer von 20-30% einzuplanen.';
        }
        if (stunden > 40) {
            return 'Bei umfangreichen Projekten sollte eine detaillierte Vor-Ort-Besichtigung erfolgen.';
        }
        return 'Standardschätzung basierend auf Erfahrungswerten.';
    }

    // Materialaufwand einbeziehen
    schaetzeMitMaterial(anfrage, materialien) {
        const basisSchaetzung = this.schaetzeArbeitsstunden(anfrage);

        // Material-Handling Zeit hinzufügen
        const materialZeit = materialien.reduce((sum, m) => {
            // Ca. 0.5 Stunden pro größerer Materialposition
            return sum + (m.menge > 10 ? 1 : 0.5);
        }, 0);

        basisSchaetzung.geschaetzteStunden += materialZeit;
        basisSchaetzung.details.materialHandling = materialZeit;

        return basisSchaetzung;
    }
}

// Create global instance
window.workEstimationService = new WorkEstimationService();
