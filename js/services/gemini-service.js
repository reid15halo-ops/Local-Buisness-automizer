/* ============================================
   Gemini API Service
   Real AI Integration for Text Generation

   SECURITY NOTE: API key is now handled server-side through Supabase Edge Functions.
   If Supabase is configured, requests go through ai-proxy function.
   Local dev mode still supports direct API key for backward compatibility.
   ============================================ */

class GeminiService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
        this.isConfigured = !!apiKey;
        this.useProxy = false;
        this.proxyUrl = null;

        // Rate limiting: max 10 calls per minute
        this.rateLimitKey = 'gemini_api_calls';
        this.maxCalls = 10;
        this.windowMs = 60000; // 1 minute

        // Check if Supabase is configured and edge function is available
        if (window.supabaseConfig?.isConfigured?.() && window.supabaseClient) {
            const supabaseUrl = localStorage.getItem('supabase_url');
            if (supabaseUrl) {
                this.proxyUrl = `${supabaseUrl}/functions/v1/ai-proxy`;
                this.useProxy = true;
            }
        }
    }

    /**
     * Helper method to call Gemini API through proxy or direct
     */
    async _callGeminiAPI(payload) {
        // Check rate limit before making API call
        if (window.securityService) {
            const rateLimitCheck = window.securityService.checkRateLimit(
                this.rateLimitKey,
                this.maxCalls,
                this.windowMs
            );

            if (!rateLimitCheck.allowed) {
                const error = new Error(`Rate limit exceeded. Retry after ${rateLimitCheck.retryAfter} seconds`);
                error.retryAfter = rateLimitCheck.retryAfter;
                throw error;
            }
        }

        const headers = {
            'Content-Type': 'application/json',
        };

        let url = this.baseUrl;
        let body = payload;

        if (this.useProxy && window.supabaseClient) {
            // Use proxy through Supabase Edge Function
            url = this.proxyUrl;
            // Get auth token from Supabase
            const { data: { session }, error } = await window.supabaseClient.auth.getSession();
            if (error || !session) {
                console.warn('Supabase session not available, falling back to direct API (if key configured)');
                if (!this.apiKey) {
                    throw new Error('No authentication available and no API key configured');
                }
                // Fallback to direct
                url = `${this.baseUrl}?key=${this.apiKey}`;
            } else {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }
        } else if (this.apiKey) {
            // Direct API call (local dev mode)
            url = `${this.baseUrl}?key=${this.apiKey}`;
            if (!this.proxyUrl) {
                console.warn('[Gemini] Using direct API key - consider configuring Supabase for production');
            }
        } else {
            throw new Error('Gemini not configured: neither proxy nor API key available');
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Gemini API error ${response.status}: ${errorData.error || 'Unknown error'}`);
        }

        return response.json();
    }

    async generateAngebotText(anfrage) {
        if (!this.isConfigured) {
            return this.getFallbackText(anfrage);
        }

        const bizType = this._getBusinessType();
        const companyName = this._getCompanyName();
        const prompt = `Du bist ein professioneller Angebots-Schreiber für einen ${bizType} (${companyName}).

Erstelle einen professionellen, deutschsprachigen Angebots-Text basierend auf folgender Kundenanfrage:

Kunde: ${anfrage.kunde.name}
Leistungsart: ${anfrage.leistungsart}
Beschreibung: ${anfrage.beschreibung}
${anfrage.budget ? `Geschätztes Budget: ${anfrage.budget}€` : ''}
${anfrage.termin ? `Gewünschter Termin: ${anfrage.termin}` : ''}

Der Text soll:
- Professionell und höflich formuliert sein
- Auf die spezifische Anfrage eingehen
- Zahlungsbedingungen und Gültigkeitsdauer des Angebots nennen
- Ca. 150-200 Wörter lang sein

Antworte NUR mit dem Angebots-Text, ohne zusätzliche Erklärungen.`;

        try {
            const data = await this._callGeminiAPI({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500,
                }
            });

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

        const prompt = `Du bist ein Kalkulations-Experte für einen ${this._getBusinessType()}.

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
            const data = await this._callGeminiAPI({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 500,
                }
            });

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
        if (!this.isConfigured) {return null;}

        const context = history.slice(-5).map(m => `${m.role === 'assistant' ? 'Bot' : 'Kunde'}: ${m.content}`).join('\n');

        const companyName = this._getCompanyName();
        const bizType = this._getBusinessType();
        const prompt = `Du bist ein erfahrener Fachberater für die Firma ${companyName} (${bizType}).
Deine Expertise umfasst alle Leistungsbereiche des Unternehmens.

Verhalte dich professionell, höflich und lösungsorientiert.
Antworte präzise auf die Kundenfrage. Wenn technische Details fehlen (z.B. Maße, Material), frage gezielt danach.
Nenne bei Bedarf Richtpreise, aber weise darauf hin, dass ein genaues Angebot erst nach Aufmaß möglich ist.

Bisheriger Verlauf:
${context}

Kunde: "${message}"
Antwort:`;

        try {
            const data = await this._callGeminiAPI({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
            });

            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (e) {
            console.error('Gemini Chat Error:', e);
            return null;
        }
    }

    getFallbackText(anfrage) {
        const companyName = this._getCompanyName();
        const templates = {
            'metallbau': `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage bezüglich ${anfrage.beschreibung.substring(0, 50)}.

Gerne unterbreiten wir Ihnen folgendes Angebot für die gewünschten Arbeiten. Wir garantieren höchste Qualitätsstandards und fachgerechte Ausführung.

Das Angebot umfasst alle notwendigen Materialien und Arbeitsleistungen. Änderungen im Arbeitsumfang werden nach Aufwand berechnet.

Die Arbeiten können nach Auftragserteilung innerhalb von 2-3 Wochen durchgeführt werden.

Dieses Angebot ist 30 Tage gültig. Wir freuen uns auf Ihren Auftrag!

Mit freundlichen Grüßen
${companyName}`,

            'schweissen': `Sehr geehrte Damen und Herren,

bezugnehmend auf Ihre Anfrage übersenden wir Ihnen unser Angebot für die Schweißarbeiten.

Unsere zertifizierten Schweißfachkräfte führen alle gängigen Schweißverfahren (WIG, MAG, MIG) aus. Die Qualität unserer Arbeit entspricht den höchsten Branchenstandards.

Materialien und Schweißzusätze sind im Angebot enthalten. Bei Arbeiten vor Ort wird eine Anfahrtspauschale berechnet.

Gültigkeitsdauer: 30 Tage.

Mit freundlichen Grüßen
${companyName}`,

            'rohrleitungsbau': `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage zum Thema Rohrleitungsbau.

Wir bieten Ihnen die fachgerechte Planung und Umsetzung Ihrer individuellen Rohrleitungslösung. Unsere Expertise umfasst verschiedenste Materialien für den Transport von Druckluft, Dampf, Öl und Rohstoffen.

Das Angebot beinhaltet Material, Montage und Druckprüfung.

Gültigkeit: 30 Tage

Mit freundlichen Grüßen
${companyName}`,

            'default': `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage.

Gerne unterbreiten wir Ihnen für die gewünschten Leistungen folgendes Angebot.

Alle Preise verstehen sich zzgl. 19% MwSt. Das Angebot gilt 30 Tage.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen
${companyName}`
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

    _getBusinessType() {
        const ap = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
        return ap.business_type || window.storeService?.state?.settings?.businessType || 'Handwerksbetrieb';
    }

    _getCompanyName() {
        const ap = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
        return ap.company_name || window.storeService?.state?.settings?.companyName || 'FreyAI Visions';
    }
}

// Create global instance
window.geminiService = new GeminiService(localStorage.getItem('gemini_api_key'));
