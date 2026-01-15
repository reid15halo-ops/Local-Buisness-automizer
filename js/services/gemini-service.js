/* ============================================
   Gemini API Service
   Real AI Integration for Text Generation
   ============================================ */

class GeminiService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
        this.isConfigured = !!apiKey;
    }

    async generateAngebotText(anfrage) {
        if (!this.isConfigured) {
            return this.getFallbackText(anfrage);
        }

        const prompt = `Du bist ein professioneller Angebots-Schreiber für einen Metallbau-Betrieb (MHS Metallbau Hydraulik Service).

Erstelle einen professionellen, deutschsprachigen Angebots-Text basierend auf folgender Kundenanfrage:

Kunde: ${anfrage.kunde.name}
Leistungsart: ${anfrage.leistungsart}
Beschreibung: ${anfrage.beschreibung}
${anfrage.budget ? `Geschätztes Budget: ${anfrage.budget}€` : ''}
${anfrage.termin ? `Gewünschter Termin: ${anfrage.termin}` : ''}

Der Text soll:
- Professionell und höflich formuliert sein
- Auf die spezifische Anfrage eingehen
- Die DIN EN 1090 Zertifizierung erwähnen (falls relevant)
- Zahlungsbedingungen und Gültigkeitsdauer des Angebots nennen
- Ca. 150-200 Wörter lang sein

Antworte NUR mit dem Angebots-Text, ohne zusätzliche Erklärungen.`;

        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 500,
                    }
                })
            });

            if (!response.ok) {
                console.error('Gemini API Error:', response.status);
                return this.getFallbackText(anfrage);
            }

            const data = await response.json();
            const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (generatedText) {
                return generatedText;
            }

            return this.getFallbackText(anfrage);
        } catch (error) {
            console.error('Gemini API Error:', error);
            return this.getFallbackText(anfrage);
        }
    }

    async calculatePriceFromMaterials(positionen, materialBestand) {
        if (!this.isConfigured) {
            return this.calculatePriceFallback(positionen, materialBestand);
        }

        const materialList = materialBestand.map(m =>
            `${m.artikelnummer}: ${m.bezeichnung} - ${m.preis}€/${m.einheit}`
        ).join('\n');

        const positionenText = positionen.map(p => p.beschreibung).join(', ');

        const prompt = `Du bist ein Kalkulations-Experte für einen Metallbau-Betrieb.

Hier ist der Materialbestand mit Preisen:
${materialList}

Der Kunde benötigt folgende Leistungen:
${positionenText}

Welche Materialien werden wahrscheinlich benötigt und in welcher Menge?
Antworte im JSON-Format:
{
  "empfohlene_materialien": [
    {"artikelnummer": "...", "menge": X, "grund": "..."}
  ],
  "geschaetzte_materialkosten": X,
  "empfohlene_arbeitsstunden": X
}`;

        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 500,
                    }
                })
            });

            if (!response.ok) {
                return this.calculatePriceFallback(positionen, materialBestand);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            // Try to parse JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return this.calculatePriceFallback(positionen, materialBestand);
        } catch (error) {
            console.error('Gemini API Error:', error);
            return this.calculatePriceFallback(positionen, materialBestand);
        }
    }

    async chat(message, history) {
        if (!this.isConfigured) return null;

        const context = history.slice(-5).map(m => `${m.role === 'assistant' ? 'Bot' : 'Kunde'}: ${m.content}`).join('\n');

        const prompt = `Du bist ein erfahrener Fachberater für die Firma MHS Metallbau Hydraulik Service (MHS).
Deine Expertise umfasst:
- Metallbau (Geländer, Treppen, Tore, Carports)
- Hydraulik (Schlauchservice, Zylinderreparatur, Aggregate)
- Schweißen (WIG, MIG/MAG, E-Hand, Zertifiziert nach DIN EN 1090)
- Rohrleitungsbau (Ermeto, Presssysteme, Industrie)

Verhalte dich professionell, höflich und lösungsorientiert.
Antworte präzise auf die Kundenfrage. Wenn technische Details fehlen (z.B. Maße, Material), frage gezielt danach.
Nenne bei Bedarf Richtpreise, aber weise darauf hin, dass ein genaues Angebot erst nach Aufmaß möglich ist.

Bisheriger Verlauf:
${context}

Kunde: "${message}"
Antwort:`;

        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
                })
            });

            if (!response.ok) return null;
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (e) {
            console.error('Gemini Chat Error:', e);
            return null;
        }
    }

    getFallbackText(anfrage) {
        const templates = {
            'metallbau': `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage bezüglich ${anfrage.beschreibung.substring(0, 50)}.

Gerne unterbreiten wir Ihnen folgendes Angebot für die gewünschten Metallbauarbeiten. Als zertifizierter Metallbaubetrieb nach DIN EN 1090 garantieren wir höchste Qualitätsstandards und fachgerechte Ausführung.

Das Angebot umfasst alle notwendigen Materialien und Arbeitsleistungen. Änderungen im Arbeitsumfang werden nach Aufwand berechnet.

Die Arbeiten können nach Auftragserteilung innerhalb von 2-3 Wochen durchgeführt werden.

Dieses Angebot ist 30 Tage gültig. Wir freuen uns auf Ihren Auftrag!

Mit freundlichen Grüßen
MHS Metallbau Hydraulik Service`,

            'schweissen': `Sehr geehrte Damen und Herren,

bezugnehmend auf Ihre Anfrage übersenden wir Ihnen unser Angebot für die Schweißarbeiten.

Unsere zertifizierten Schweißfachkräfte führen alle gängigen Schweißverfahren (WIG, MAG, MIG) aus. Die Qualität unserer Arbeit entspricht den höchsten Branchenstandards.

Materialien und Schweißzusätze sind im Angebot enthalten. Bei Arbeiten vor Ort wird eine Anfahrtspauschale berechnet.

Gültigkeitsdauer: 30 Tage.

Mit freundlichen Grüßen
MHS Metallbau Hydraulik Service`,

            'rohrleitungsbau': `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage zum Thema Rohrleitungsbau.

Wir bieten Ihnen die fachgerechte Planung und Umsetzung Ihrer individuellen Rohrleitungslösung. Unsere Expertise umfasst verschiedenste Materialien für den Transport von Druckluft, Dampf, Öl und Rohstoffen.

Das Angebot beinhaltet Material, Montage und Druckprüfung.

Gültigkeit: 30 Tage

Mit freundlichen Grüßen
MHS Metallbau Hydraulik Service`,

            'default': `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage.

Gerne unterbreiten wir Ihnen für die gewünschten Leistungen folgendes Angebot.

Alle Preise verstehen sich zzgl. 19% MwSt. Das Angebot gilt 30 Tage.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
MHS Metallbau Hydraulik Service`
        };

        return templates[anfrage.leistungsart] || templates['default'];
    }

    calculatePriceFallback(positionen, materialBestand) {
        // Simple matching algorithm
        const empfohlene = [];
        let gesamtkosten = 0;

        positionen.forEach(pos => {
            const beschreibung = pos.beschreibung.toLowerCase();

            materialBestand.forEach(mat => {
                const matBez = mat.bezeichnung.toLowerCase();
                // Simple keyword matching
                if (beschreibung.includes(matBez.split(' ')[0]) ||
                    matBez.includes(beschreibung.split(' ')[0])) {
                    const menge = pos.menge || 1;
                    empfohlene.push({
                        artikelnummer: mat.artikelnummer,
                        bezeichnung: mat.bezeichnung,
                        menge: menge,
                        einzelpreis: mat.preis,
                        gesamt: menge * mat.preis
                    });
                    gesamtkosten += menge * mat.preis;
                }
            });
        });

        return {
            empfohlene_materialien: empfohlene,
            geschaetzte_materialkosten: gesamtkosten,
            empfohlene_arbeitsstunden: positionen.length * 2
        };
    }
}

// Create global instance
window.geminiService = new GeminiService(localStorage.getItem('gemini_api_key'));
