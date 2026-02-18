/* ============================================
   Voice Command Service
   Hands-free German speech recognition for field use
   Web Speech API (SpeechRecognition + SpeechSynthesis)
   ============================================ */

class VoiceCommandService {
    constructor() {
        this.isListening = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis || null;
        this.commands = [];
        this.micButton = null;
        this.transcriptOverlay = null;
        this.transcriptTimer = null;

        this.settings = JSON.parse(localStorage.getItem('freyai_voice_settings') || '{}');
        this.commandHistory = JSON.parse(localStorage.getItem('freyai_voice_history') || '[]');

        // Default settings
        if (!this.settings.language)           { this.settings.language = 'de-DE'; }
        if (this.settings.speakResponses == null) { this.settings.speakResponses = true; }

        this.init();
    }

    // ----------------------------------------
    // Init
    // ----------------------------------------
    init() {
        this.commands = this.getCommands();

        if (!this._isBrowserSupported()) {
            this._showUnsupportedMessage();
            return;
        }

        this._initRecognition();
        this._buildUI();
    }

    // ----------------------------------------
    // Browser support check
    // ----------------------------------------
    _isBrowserSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    _showUnsupportedMessage() {
        console.warn('[VoiceCommand] Spracherkennung (Web Speech API) wird in diesem Browser nicht unterstützt.');
        // Show a one-time toast when the page loads
        window.addEventListener('load', () => {
            const show = window.showToast || (window.AppUtils && window.AppUtils.showToast);
            if (typeof show === 'function') {
                show(
                    'Sprachsteuerung nicht verfügbar: Ihr Browser unterstützt die Web Speech API nicht. ' +
                    'Bitte verwenden Sie Google Chrome oder Microsoft Edge.',
                    'warning'
                );
            }
        });
    }

    // ----------------------------------------
    // Web Speech API recognition setup
    // ----------------------------------------
    _initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = this.settings.language;
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 3;

        this.recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript
                .toLowerCase()
                .trim();
            this._showTranscript(transcript);
            this.parseCommand(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('[VoiceCommand] Fehler:', event.error);
            this.isListening = false;
            this._updateButtonState();

            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                this._showTranscript('Mikrofon-Zugriff verweigert.');
                const show = window.showToast || (window.AppUtils && window.AppUtils.showToast);
                if (typeof show === 'function') {
                    show('Mikrofon-Zugriff wurde verweigert. Bitte Berechtigung erteilen.', 'error');
                }
            } else if (event.error === 'no-speech') {
                this._showTranscript('Kein Ton erkannt.');
            }
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this._updateButtonState();
        };

        this.recognition.onstart = () => {
            this.isListening = true;
            this._updateButtonState();
        };
    }

    // ----------------------------------------
    // Public API
    // ----------------------------------------
    startListening() {
        if (!this.recognition) {
            console.warn('[VoiceCommand] Spracherkennung nicht initialisiert.');
            return false;
        }
        if (this.isListening) {
            return true;
        }
        try {
            this.recognition.start();
            return true;
        } catch (e) {
            console.error('[VoiceCommand] Konnte Spracherkennung nicht starten:', e);
            return false;
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
        this.isListening = false;
        this._updateButtonState();
    }

    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    // ----------------------------------------
    // Command parsing
    // ----------------------------------------
    parseCommand(transcript) {
        if (!transcript) { return { matched: false }; }

        for (const cmd of this.commands) {
            for (const trigger of cmd.triggers) {
                let matched = false;
                let entities = {};

                if (trigger instanceof RegExp) {
                    const m = transcript.match(trigger);
                    if (m) {
                        matched = true;
                        entities = { match: m };
                    }
                } else {
                    if (transcript.includes(trigger)) {
                        matched = true;
                    }
                }

                if (matched) {
                    this._logCommand(transcript, cmd.intent);
                    this.executeCommand(cmd.intent, entities);
                    if (cmd.response) {
                        this.speak(cmd.response);
                    }
                    return { matched: true, intent: cmd.intent };
                }
            }
        }

        // No match
        this.speak('Befehl nicht erkannt. Sagen Sie "Hilfe" für eine Übersicht.');
        return { matched: false };
    }

    executeCommand(intent, entities) {
        switch (intent) {

            // --- Navigation ---
            case 'navigate_anfragen':
                this._navigate('anfragen');
                break;
            case 'navigate_angebote':
                this._navigate('angebote');
                break;
            case 'navigate_rechnungen':
                this._navigate('rechnungen');
                break;
            case 'navigate_auftraege':
                this._navigate('auftraege');
                break;
            case 'navigate_kunden':
                this._navigate('kunden');
                break;
            case 'navigate_kalender':
                this._navigate('kalender');
                break;
            case 'navigate_dashboard':
                this._navigate('dashboard');
                break;

            // --- Actions ---
            case 'neue_anfrage':
                this._clickNeueAnfrage();
                break;
            case 'hilfe':
                this._showHelp();
                break;
            case 'suche':
                this._focusSearch(entities);
                break;

            default:
                console.warn('[VoiceCommand] Unbekannter Intent:', intent);
        }
    }

    // ----------------------------------------
    // TTS feedback
    // ----------------------------------------
    speak(text) {
        if (!this.settings.speakResponses || !this.synthesis) { return; }
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.settings.language;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Prefer a German voice if available
        const voices = this.synthesis.getVoices();
        const germanVoice = voices.find(v => v.lang.startsWith('de'));
        if (germanVoice) {
            utterance.voice = germanVoice;
        }

        this.synthesis.speak(utterance);
    }

    // ----------------------------------------
    // Command definitions (German)
    // ----------------------------------------
    getCommands() {
        return [
            {
                intent: 'navigate_anfragen',
                triggers: ['zeige anfragen', 'öffne anfragen'],
                response: 'Anfragen werden angezeigt.'
            },
            {
                intent: 'navigate_angebote',
                triggers: ['zeige angebote', 'öffne angebote'],
                response: 'Angebote werden angezeigt.'
            },
            {
                intent: 'navigate_rechnungen',
                triggers: ['zeige rechnungen', 'zeige rechnung', 'öffne rechnungen'],
                response: 'Rechnungen werden angezeigt.'
            },
            {
                intent: 'navigate_auftraege',
                triggers: ['zeige aufträge', 'zeige auftrag', 'öffne aufträge'],
                response: 'Aufträge werden angezeigt.'
            },
            {
                intent: 'navigate_kunden',
                triggers: ['zeige kunden', 'öffne kunden'],
                response: 'Kundenliste wird angezeigt.'
            },
            {
                intent: 'navigate_kalender',
                triggers: ['zeige kalender', 'öffne kalender'],
                response: 'Kalender wird angezeigt.'
            },
            {
                intent: 'navigate_dashboard',
                triggers: ['zeige dashboard', 'öffne dashboard', 'zeige auswertungen'],
                response: 'Dashboard wird angezeigt.'
            },
            {
                intent: 'neue_anfrage',
                triggers: ['neue anfrage', 'anfrage erstellen', 'anfrage anlegen'],
                response: 'Neue Anfrage wird erstellt.'
            },
            {
                intent: 'hilfe',
                triggers: ['hilfe', 'was kannst du', 'sprachbefehle'],
                response: 'Hilfe wird angezeigt.'
            },
            {
                // Matches "suche [beliebiger Begriff]"
                intent: 'suche',
                triggers: [/^suche\s+(.+)$/i],
                response: null  // dynamic – spoken in executeCommand
            }
        ];
    }

    // ----------------------------------------
    // Navigation helper
    // ----------------------------------------
    _navigate(viewId) {
        if (window.navigationController && typeof window.navigationController.navigateTo === 'function') {
            window.navigationController.navigateTo(viewId);
        } else {
            // Fallback: manipulate DOM directly
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const view = document.getElementById(`view-${viewId}`);
            if (view) { view.classList.add('active'); }
            const navItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
            if (navItem) { navItem.classList.add('active'); }
        }
    }

    _clickNeueAnfrage() {
        const btn = document.getElementById('btn-neue-anfrage');
        if (btn) {
            btn.click();
        } else {
            console.warn('[VoiceCommand] btn-neue-anfrage nicht gefunden.');
        }
    }

    _showHelp() {
        // Open the help modal if available
        if (window.UI && typeof window.UI.openModal === 'function') {
            window.UI.openModal('modal-help');
        } else if (typeof window.openModal === 'function') {
            window.openModal('modal-help');
        } else {
            // Fallback: navigate to dashboard
            this._navigate('dashboard');
        }
    }

    _focusSearch(entities) {
        const searchInput = document.getElementById('global-search');
        if (!searchInput) { return; }

        let term = '';
        if (entities.match && entities.match[1]) {
            term = entities.match[1].trim();
        }

        searchInput.focus();
        searchInput.value = term;

        // Dispatch input event so search service reacts
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));

        if (term) {
            this.speak(`Suche nach ${term}`);
        } else {
            this.speak('Suchfeld aktiviert.');
        }
    }

    // ----------------------------------------
    // Floating mic button UI
    // ----------------------------------------
    _buildUI() {
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.id = 'voice-command-ui';

        // Transcript overlay (brief text above button)
        this.transcriptOverlay = document.createElement('div');
        this.transcriptOverlay.id = 'voice-transcript-overlay';
        this.transcriptOverlay.setAttribute('aria-live', 'polite');
        this.transcriptOverlay.setAttribute('aria-atomic', 'true');

        // Microphone button
        this.micButton = document.createElement('button');
        this.micButton.id = 'voice-mic-button';
        this.micButton.type = 'button';
        this.micButton.setAttribute('aria-label', 'Sprachsteuerung starten');
        this.micButton.setAttribute('title', 'Sprachsteuerung (Klicken zum Aktivieren)');
        this.micButton.innerHTML = this._micIconSVG();

        this.micButton.addEventListener('click', () => {
            this.toggleListening();
        });

        wrapper.appendChild(this.transcriptOverlay);
        wrapper.appendChild(this.micButton);
        document.body.appendChild(wrapper);
    }

    _micIconSVG() {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28" aria-hidden="true">
            <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>`;
    }

    _updateButtonState() {
        if (!this.micButton) { return; }

        if (this.isListening) {
            this.micButton.classList.add('voice-listening');
            this.micButton.setAttribute('aria-label', 'Sprachsteuerung stoppen');
            this.micButton.setAttribute('title', 'Sprachsteuerung aktiv – Klicken zum Stoppen');
        } else {
            this.micButton.classList.remove('voice-listening');
            this.micButton.setAttribute('aria-label', 'Sprachsteuerung starten');
            this.micButton.setAttribute('title', 'Sprachsteuerung (Klicken zum Aktivieren)');
        }
    }

    _showTranscript(text) {
        if (!this.transcriptOverlay) { return; }

        this.transcriptOverlay.textContent = text;
        this.transcriptOverlay.classList.add('voice-transcript-visible');

        if (this.transcriptTimer) {
            clearTimeout(this.transcriptTimer);
        }
        this.transcriptTimer = setTimeout(() => {
            if (this.transcriptOverlay) {
                this.transcriptOverlay.classList.remove('voice-transcript-visible');
                this.transcriptOverlay.textContent = '';
            }
        }, 3500);
    }

    // ----------------------------------------
    // History & settings
    // ----------------------------------------
    _logCommand(transcript, intent) {
        this.commandHistory.push({
            transcript,
            intent,
            timestamp: new Date().toISOString()
        });
        if (this.commandHistory.length > 100) {
            this.commandHistory = this.commandHistory.slice(-100);
        }
        try {
            localStorage.setItem('freyai_voice_history', JSON.stringify(this.commandHistory));
        } catch (_) {}
    }

    getHistory() {
        return this.commandHistory;
    }

    isAvailable() {
        return this._isBrowserSupported();
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        try {
            localStorage.setItem('freyai_voice_settings', JSON.stringify(this.settings));
        } catch (_) {}
        if (this.recognition) {
            this.recognition.lang = this.settings.language;
        }
    }
}

// Instantiate globally
window.voiceCommandService = new VoiceCommandService();
