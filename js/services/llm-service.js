/* ============================================
   LLM Service
   Unified AI Handler for Gemini (Cloud) and Ollama/Mistral (Local)
   ============================================ */

class LLMService {
    constructor() {
        this.config = JSON.parse(localStorage.getItem('mhs_llm_config') || '{"provider":"gemini"}');
        // Default configs
        if (!this.config.provider) this.config.provider = 'gemini';
        if (!this.config.ollamaUrl) this.config.ollamaUrl = 'http://localhost:11434';
        if (!this.config.ollamaModel) this.config.ollamaModel = 'mistral';
    }

    saveConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        localStorage.setItem('mhs_llm_config', JSON.stringify(this.config));
    }

    get isConfigured() {
        if (this.config.provider === 'gemini') return !!this.config.apiKey;
        if (this.config.provider === 'ollama') return !!this.config.ollamaUrl; // Url is usually set
        return false;
    }

    async chat(message, history) {
        if (!this.isConfigured) return null;

        const systemPrompt = `Du bist ein erfahrener Fachberater für die Firma MHS Metallbau Hydraulik Service (MHS).
Deine Expertise umfasst:
- Metallbau (Geländer, Treppen, Tore, Carports)
- Hydraulik (Schlauchservice, Zylinderreparatur, Aggregate)
- Schweißen (WIG, MIG/MAG, E-Hand, Zertifiziert nach DIN EN 1090)
- Rohrleitungsbau (Ermeto, Presssysteme, Industrie)

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

            if (!response.ok) throw new Error('Ollama connection failed');
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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.config.apiKey}`;

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

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Gemini API Error: ' + response.status);
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
}

// Global Instance
window.llmService = new LLMService();
