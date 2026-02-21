/* ============================================
   LLM Service
   Unified AI Handler for Gemini (Cloud via proxy) and Ollama/Mistral (Local)

   SECURITY NOTE: Gemini API key is now proxied through Supabase Edge Functions.
   Direct API key usage only available for local development fallback.
   ============================================ */

class LLMService {
    constructor() {
        this.config = JSON.parse(localStorage.getItem('freyai_llm_config') || '{"provider":"gemini"}');
        // Default configs
        if (!this.config.provider) {this.config.provider = 'gemini';}
        if (!this.config.ollamaUrl) {this.config.ollamaUrl = 'http://localhost:11434';}
        if (!this.config.ollamaModel) {this.config.ollamaModel = 'mistral';}

        // Setup Gemini proxy
        this.geminiProxyUrl = null;
        this.useGeminiProxy = false;
        if (window.supabaseConfig?.isConfigured?.() && window.supabaseClient) {
            const supabaseUrl = localStorage.getItem('supabase_url');
            if (supabaseUrl) {
                this.geminiProxyUrl = `${supabaseUrl}/functions/v1/ai-proxy`;
                this.useGeminiProxy = true;
            }
        }
    }

    async getAvailableModels() {
        if (this.config.provider !== 'ollama') {return [];}
        try {
            const response = await fetch(`${this.config.ollamaUrl}/api/tags`);
            if (!response.ok) {return [];}
            const data = await response.json();
            return data.models || [];
        } catch (e) {
            console.error('Failed to fetch Ollama models:', e);
            return [];
        }
    }

    saveConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        localStorage.setItem('freyai_llm_config', JSON.stringify(this.config));
    }

    get isConfigured() {
        if (this.config.provider === 'gemini') {return !!this.config.apiKey;}
        if (this.config.provider === 'ollama') {return !!this.config.ollamaUrl;} // Url is usually set
        return false;
    }

    async chat(message, history) {
        if (!this.isConfigured) {return null;}

        const ap = JSON.parse(localStorage.getItem('freyai_admin_settings') || '{}');
        const companyName = ap.company_name || window.storeService?.state?.settings?.companyName || 'FreyAI Visions';
        const bizType = ap.business_type || window.storeService?.state?.settings?.businessType || 'Handwerksbetrieb';

        const systemPrompt = `Du bist ein erfahrener Fachberater für die Firma ${companyName} (${bizType}).
WICHTIG: Antworte AUSSCHLIESSLICH auf Fragen, die einen direkten Bezug zum Unternehmen ${companyName} oder den angebotenen Dienstleistungen haben.

Deine Expertise umfasst alle Leistungsbereiche des Unternehmens.

RESTRIKTIONEN:
- Beantworte keine privaten Fragen.
- Beantworte keine Fragen zu allgemeinem Wissen, Witzen, Wetter oder Politik.
- Wenn eine Frage keinen Bezug zu ${companyName} oder dem Fachgebiet hat, antworte höflich: "Entschuldigung, als Fachberater von ${companyName} kann ich Ihnen nur bei Fragen zu unseren Dienstleistungen behilflich sein. Wie kann ich Sie bei Ihrem Projekt unterstützen?"

Verhalte dich professionell, höflich und lösungsorientiert.
Antworte präzise auf die Kundenfrage. Wenn technische Details fehlen (z.B. Maße, Material), frage gezielt danach.
Nenne bei Bedarf Richtpreise, aber weise darauf hin, dass ein genaues Angebot erst nach Aufmaß möglich ist.
Halte die Antwort kurz (max 3-4 Sätze).`;

        const recentHistory = history.slice(-5).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            content: m.content
        }));

        try {
            if (this.config.provider === 'ollama') {
                return await this._chatOllama(message, recentHistory, systemPrompt);
            } else {
                return await this._chatGemini(message, recentHistory, systemPrompt);
            }
        } catch (e) {
            console.error('LLM Chat Error:', e);
            return null;
        }
    }

    // --- OLLAMA IMPLEMENTATION ---
    async _chatOllama(message, history, systemPrompt) {
        try {
            // Ollama expects messages array
            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.content })),
                { role: 'user', content: message }
            ];

            const response = await fetch(`${this.config.ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.config.ollamaModel,
                    messages: messages,
                    stream: false
                })
            });

            if (!response.ok) {throw new Error('Ollama connection failed');}
            const data = await response.json();
            return data.message?.content || null;
        } catch (e) {
            console.error('Ollama Error:', e);
            // Fallback for CORS issues or network errors
            if (e.name === 'TypeError' && e.message.includes('Failed to fetch')) {
                console.warn('CORS Error likely. Ensure Ollama is started with OLLAMA_ORIGINS="*"');
                return "⚠️ Fehler: Keine Verbindung zu Local Mistral (Ollama). Bitte prüfen Sie, ob Ollama läuft und CORS konfiguriert ist (`set OLLAMA_ORIGINS=*`).";
            }
            throw e;
        }
    }

    // --- GEMINI IMPLEMENTATION ---
    async _chatGemini(message, history, systemPrompt) {
        // Gemini structure
        const contents = history.map(h => ({
            role: h.role,
            parts: [{ text: h.content }]
        }));

        // Add current message
        contents.push({ role: 'user', parts: [{ text: message }] });

        // Add system instruction (Gemini 1.5/2.0 supports systemInstruction, but 2.0-flash might vary via REST.
        // Safer to prepend to first message or use systemInstruction field if supported.
        // We'll use system_instruction for valid models)

        const payload = {
            contents: contents,
            system_instruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.4, maxOutputTokens: 300 }
        };

        // Determine URL and headers based on proxy availability
        let url, headers = { 'Content-Type': 'application/json' };

        if (this.useGeminiProxy && window.supabaseClient) {
            // Use proxy through Supabase Edge Function
            url = this.geminiProxyUrl;
            try {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                if (session) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                } else {
                    throw new Error('No Supabase session');
                }
            } catch (e) {
                console.warn('Supabase session not available for Gemini proxy, falling back to direct API');
                if (!this.config.apiKey) {
                    throw new Error('No Gemini API key configured');
                }
                url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.config.apiKey}`;
            }
        } else if (this.config.apiKey) {
            // Direct API call (local dev mode)
            url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.config.apiKey}`;
            if (!this.useGeminiProxy) {
                console.warn('[LLM] Using direct Gemini API key - consider configuring Supabase for production');
            }
        } else {
            throw new Error('Gemini not configured: neither proxy nor API key available');
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {throw new Error('Gemini API Error: ' + response.status);}
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
}

// Global Instance
window.llmService = new LLMService();
