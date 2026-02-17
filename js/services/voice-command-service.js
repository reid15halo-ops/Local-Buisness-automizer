/* ============================================
   Voice Command Service
   Hands-free operation with German speech recognition
   & dictation for the MHS Workflow app.

   Uses Web Speech API (SpeechRecognition + SpeechSynthesis).
   Target user: 57-year-old tiler who types with two fingers.
   ============================================ */

class VoiceCommandService {
    constructor() {
        // --- State ---
        this._listening = false;
        this._dictating = false;
        this._dictationTarget = null;
        this._dictationInterimText = '';
        this._dictationFinalText = '';
        this._recognition = null;
        this._synthesis = window.speechSynthesis || null;
        this._germanVoice = null;

        // --- Settings (persisted) ---
        this._settings = JSON.parse(localStorage.getItem('mhs_voice_settings') || '{}');
        if (!this._settings.language) { this._settings.language = 'de-DE'; }
        if (this._settings.speakResponses === undefined) { this._settings.speakResponses = true; }

        // --- Command history (persisted) ---
        this._commandHistory = JSON.parse(localStorage.getItem('mhs_voice_history') || '[]');

        // --- Commands registry ---
        this._commands = [];
        this._initBuiltInCommands();

        // --- Initialise speech recognition ---
        this._initRecognition();

        // --- Pre-load German voice ---
        this._loadGermanVoice();
    }

    // ========================================================
    //  PUBLIC API
    // ========================================================

    /**
     * Returns true if the Web Speech API is available.
     */
    isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    /**
     * Start listening for voice commands.
     */
    start() {
        if (!this._recognition) {
            console.warn('[Voice] Spracherkennung nicht verfuegbar');
            return false;
        }
        if (this._listening) { return true; }

        try {
            this._recognition.start();
            this._listening = true;
            this._dispatchState();
            console.log('[Voice] Spracherkennung gestartet');
            return true;
        } catch (e) {
            // Already started – swallow InvalidStateError
            if (e.name === 'InvalidStateError') {
                this._listening = true;
                this._dispatchState();
                return true;
            }
            console.error('[Voice] Start fehlgeschlagen:', e);
            return false;
        }
    }

    /**
     * Stop listening for voice commands (and dictation if active).
     */
    stop() {
        if (this._dictating) {
            this.stopDictation();
        }
        this._listening = false;
        if (this._recognition) {
            try { this._recognition.stop(); } catch (_) { /* ignore */ }
        }
        this._dispatchState();
        console.log('[Voice] Spracherkennung gestoppt');
    }

    /**
     * Toggle listening on/off.
     */
    toggle() {
        if (this._listening) {
            this.stop();
        } else {
            this.start();
        }
    }

    /**
     * Returns true when actively listening.
     */
    isListening() {
        return this._listening;
    }

    /**
     * Start dictation into a given input/textarea element.
     * The recognised text is placed into the element's value.
     * @param {HTMLElement} inputElement - an <input> or <textarea>
     */
    startDictation(inputElement) {
        if (!inputElement) {
            console.warn('[Voice] Kein Eingabefeld fuer Diktat angegeben');
            return;
        }
        if (!this._recognition) {
            console.warn('[Voice] Spracherkennung nicht verfuegbar');
            return;
        }

        // If we were command-listening, stop first so we can restart in dictation mode
        const wasListening = this._listening;
        if (wasListening) {
            try { this._recognition.stop(); } catch (_) { /* ignore */ }
        }

        this._dictating = true;
        this._dictationTarget = inputElement;
        this._dictationFinalText = inputElement.value || '';
        this._dictationInterimText = '';

        // Mark the input visually
        inputElement.classList.add('mhs-voice-dictating');

        // Restart recognition (it will pick up dictation mode via the flag)
        try {
            this._recognition.start();
            this._listening = true;
        } catch (e) {
            if (e.name !== 'InvalidStateError') {
                console.error('[Voice] Diktat-Start fehlgeschlagen:', e);
            }
        }

        this._dispatchState();
        this.speak('Diktat gestartet');
    }

    /**
     * Stop dictation and finalise the text in the input.
     */
    stopDictation() {
        if (!this._dictating) { return; }

        // Finalise text
        if (this._dictationTarget) {
            const finalValue = (this._dictationFinalText + ' ' + this._dictationInterimText).trim();
            this._dictationTarget.value = finalValue;
            this._dictationTarget.classList.remove('mhs-voice-dictating');

            // Fire input event so frameworks pick up the change
            this._dictationTarget.dispatchEvent(new Event('input', { bubbles: true }));
            this._dictationTarget.dispatchEvent(new Event('change', { bubbles: true }));
        }

        this._dictating = false;
        this._dictationTarget = null;
        this._dictationInterimText = '';
        this._dictationFinalText = '';

        this._dispatchState();
        this.speak('Diktat beendet');
    }

    /**
     * Speak text aloud using SpeechSynthesis (German).
     * @param {string} text
     */
    speak(text) {
        if (!this._settings.speakResponses) { return; }
        if (!this._synthesis) { return; }

        // Cancel any ongoing speech
        this._synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this._settings.language;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Use cached German voice if available
        if (this._germanVoice) {
            utterance.voice = this._germanVoice;
        }

        this._synthesis.speak(utterance);
    }

    /**
     * Register a custom command.
     * @param {string[]} phrases - array of trigger phrases (lowercase)
     * @param {Function} callback - action to execute
     * @param {string} [category] - optional category for help grouping
     * @param {string} [label] - optional human-readable label
     */
    registerCommand(phrases, callback, category, label) {
        this._commands.push({
            phrases: phrases.map(p => p.toLowerCase()),
            action: callback,
            category: category || 'Benutzerdefiniert',
            label: label || phrases[0],
            isRegex: false
        });
    }

    /**
     * Returns all registered commands grouped by category.
     * @returns {Array<{phrase: string, category: string, label: string}>}
     */
    getAvailableCommands() {
        const list = [];
        for (const cmd of this._commands) {
            list.push({
                phrases: cmd.phrases,
                category: cmd.category,
                label: cmd.label
            });
        }
        return list;
    }

    /**
     * Update persisted settings.
     */
    updateSettings(newSettings) {
        this._settings = { ...this._settings, ...newSettings };
        localStorage.setItem('mhs_voice_settings', JSON.stringify(this._settings));

        if (this._recognition) {
            this._recognition.lang = this._settings.language;
        }
    }

    /**
     * Get the command history.
     */
    getHistory() {
        return this._commandHistory;
    }

    // ========================================================
    //  PRIVATE – Speech Recognition
    // ========================================================

    _initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[Voice] Web Speech API nicht unterstuetzt');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = this._settings.language;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;

        recognition.onresult = (event) => this._onResult(event);
        recognition.onerror = (event) => this._onError(event);
        recognition.onend = () => this._onEnd();

        this._recognition = recognition;
    }

    /**
     * Handle recognition results.
     */
    _onResult(event) {
        // Walk through the new results
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;

            if (this._dictating) {
                // --- Dictation mode ---
                if (result.isFinal) {
                    this._dictationFinalText += (this._dictationFinalText ? ' ' : '') + transcript;
                    this._dictationInterimText = '';
                } else {
                    this._dictationInterimText = transcript;
                }

                // Update the target element live
                if (this._dictationTarget) {
                    const liveValue = (this._dictationFinalText + (this._dictationInterimText ? ' ' + this._dictationInterimText : '')).trim();
                    this._dictationTarget.value = liveValue;
                    this._dictationTarget.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else {
                // --- Command mode: only act on final results ---
                if (result.isFinal) {
                    this._processCommand(transcript.toLowerCase().trim());
                }
            }
        }
    }

    /**
     * Handle recognition errors.
     */
    _onError(event) {
        console.warn('[Voice] Fehler:', event.error);

        // Certain errors should not stop listening
        if (event.error === 'no-speech' || event.error === 'aborted') {
            return;
        }

        // On "not-allowed" or "service-not-allowed" we should stop
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            this._listening = false;
            this._dictating = false;
            this._dispatchState();
        }
    }

    /**
     * Auto-restart recognition when it ends (if still meant to be active).
     */
    _onEnd() {
        if (this._listening) {
            // Restart after a tiny delay to avoid rapid-fire restart loops
            setTimeout(() => {
                if (this._listening && this._recognition) {
                    try {
                        this._recognition.start();
                    } catch (e) {
                        if (e.name !== 'InvalidStateError') {
                            console.error('[Voice] Neustart fehlgeschlagen:', e);
                            this._listening = false;
                            this._dictating = false;
                            this._dispatchState();
                        }
                    }
                }
            }, 250);
        } else {
            this._dispatchState();
        }
    }

    // ========================================================
    //  PRIVATE – Command Processing
    // ========================================================

    /**
     * Match transcript against registered commands.
     */
    _processCommand(transcript) {
        console.log('[Voice] Erkannt:', transcript);

        // Check for the special "Suche ..." command first
        const searchMatch = transcript.match(/^suche\s+(.+)$/i);
        if (searchMatch) {
            const term = searchMatch[1].trim();
            this._activateSearch(term);
            this._logCommand(transcript, 'suche');
            return;
        }

        // Iterate commands and find a match
        for (const cmd of this._commands) {
            for (const phrase of cmd.phrases) {
                let matched = false;

                if (cmd.isRegex) {
                    const regex = new RegExp(phrase, 'i');
                    matched = regex.test(transcript);
                } else {
                    matched = transcript.includes(phrase);
                }

                if (matched) {
                    this._logCommand(transcript, phrase);

                    try {
                        const result = cmd.action(transcript);
                        // Speak confirmation if the command provides one
                        if (cmd.response) {
                            this.speak(cmd.response);
                        } else if (result && typeof result === 'object' && result.response) {
                            this.speak(result.response);
                        }
                    } catch (err) {
                        console.error('[Voice] Befehlsfehler:', err);
                        this.speak('Es ist ein Fehler aufgetreten.');
                    }

                    // Dispatch event so the UI can show a toast
                    document.dispatchEvent(new CustomEvent('mhs:voice-command', {
                        detail: { transcript, matched: phrase, label: cmd.label }
                    }));

                    return;
                }
            }
        }

        // No match
        this.speak('Befehl nicht erkannt. Sagen Sie Hilfe fuer eine Liste der Befehle.');
        document.dispatchEvent(new CustomEvent('mhs:voice-command', {
            detail: { transcript, matched: null, label: null }
        }));
    }

    // ========================================================
    //  PRIVATE – Built-in Commands
    // ========================================================

    _initBuiltInCommands() {
        // ---------- Navigation ----------

        this._commands.push({
            phrases: ['zeige anfragen', 'gehe zu anfragen'],
            action: () => { this._navigate('anfragen'); },
            response: 'Navigiere zu Anfragen',
            category: 'Navigation',
            label: 'Zeige Anfragen'
        });

        this._commands.push({
            phrases: ['zeige angebote', 'gehe zu angebote'],
            action: () => { this._navigate('angebote'); },
            response: 'Navigiere zu Angebote',
            category: 'Navigation',
            label: 'Zeige Angebote'
        });

        this._commands.push({
            phrases: ['zeige auftraege', 'zeige aufträge', 'gehe zu auftraege'],
            action: () => { this._navigate('auftraege'); },
            response: 'Navigiere zu Auftraege',
            category: 'Navigation',
            label: 'Zeige Auftraege'
        });

        this._commands.push({
            phrases: ['zeige rechnungen', 'gehe zu rechnungen'],
            action: () => { this._navigate('rechnungen'); },
            response: 'Navigiere zu Rechnungen',
            category: 'Navigation',
            label: 'Zeige Rechnungen'
        });

        this._commands.push({
            phrases: ['zeige kunden', 'gehe zu kunden', 'kundenliste'],
            action: () => { this._navigate('kunden'); },
            response: 'Navigiere zu Kunden',
            category: 'Navigation',
            label: 'Zeige Kunden'
        });

        this._commands.push({
            phrases: ['startseite', 'nach hause', 'home'],
            action: () => { this._navigate('quick-actions'); },
            response: 'Navigiere zur Startseite',
            category: 'Navigation',
            label: 'Startseite'
        });

        this._commands.push({
            phrases: ['bautagebuch'],
            action: () => { this._navigate('bautagebuch'); },
            response: 'Navigiere zum Bautagebuch',
            category: 'Navigation',
            label: 'Bautagebuch'
        });

        this._commands.push({
            phrases: ['zeige kalender', 'termine', 'kalender'],
            action: () => { this._navigate('kalender'); },
            response: 'Navigiere zum Kalender',
            category: 'Navigation',
            label: 'Zeige Kalender'
        });

        this._commands.push({
            phrases: ['zeige aufgaben', 'aufgaben'],
            action: () => { this._navigate('aufgaben'); },
            response: 'Navigiere zu Aufgaben',
            category: 'Navigation',
            label: 'Zeige Aufgaben'
        });

        this._commands.push({
            phrases: ['zeige zeiterfassung', 'zeiterfassung', 'stempeluhr'],
            action: () => { this._navigate('zeiterfassung'); },
            response: 'Navigiere zur Zeiterfassung',
            category: 'Navigation',
            label: 'Zeige Zeiterfassung'
        });

        this._commands.push({
            phrases: ['zeige dashboard', 'dashboard', 'uebersicht', 'übersicht'],
            action: () => { this._navigate('dashboard'); },
            response: 'Navigiere zum Dashboard',
            category: 'Navigation',
            label: 'Zeige Dashboard'
        });

        // ---------- Erstellen (Create New) ----------

        this._commands.push({
            phrases: ['neue anfrage', 'anfrage erstellen'],
            action: () => {
                this._navigate('anfragen');
                setTimeout(() => {
                    const btn = document.getElementById('btn-neue-anfrage');
                    if (btn) { btn.click(); }
                }, 300);
            },
            response: 'Neue Anfrage wird erstellt',
            category: 'Erstellen',
            label: 'Neue Anfrage'
        });

        this._commands.push({
            phrases: ['neues angebot', 'angebot erstellen'],
            action: () => {
                this._navigate('angebote');
                setTimeout(() => {
                    const btn = document.getElementById('btn-neues-angebot');
                    if (btn) { btn.click(); }
                }, 300);
            },
            response: 'Neues Angebot wird erstellt',
            category: 'Erstellen',
            label: 'Neues Angebot'
        });

        this._commands.push({
            phrases: ['neue rechnung', 'rechnung erstellen'],
            action: () => {
                this._navigate('rechnungen');
                setTimeout(() => {
                    const btn = document.getElementById('btn-neue-rechnung');
                    if (btn) { btn.click(); }
                }, 300);
            },
            response: 'Neue Rechnung wird erstellt',
            category: 'Erstellen',
            label: 'Neue Rechnung'
        });

        this._commands.push({
            phrases: ['neuer kunde', 'kunde erstellen', 'kunde anlegen'],
            action: () => {
                this._navigate('kunden');
                setTimeout(() => {
                    const btn = document.getElementById('btn-neuer-kunde');
                    if (btn) { btn.click(); }
                }, 300);
            },
            response: 'Neuer Kunde wird angelegt',
            category: 'Erstellen',
            label: 'Neuer Kunde'
        });

        this._commands.push({
            phrases: ['neue aufgabe', 'aufgabe erstellen'],
            action: () => {
                this._navigate('aufgaben');
                setTimeout(() => {
                    const btn = document.getElementById('btn-neue-aufgabe');
                    if (btn) { btn.click(); }
                }, 300);
            },
            response: 'Neue Aufgabe wird erstellt',
            category: 'Erstellen',
            label: 'Neue Aufgabe'
        });

        this._commands.push({
            phrases: ['neuer termin', 'termin erstellen', 'termin anlegen'],
            action: () => {
                this._navigate('kalender');
                setTimeout(() => {
                    const btn = document.getElementById('btn-neuer-termin');
                    if (btn) { btn.click(); }
                }, 300);
            },
            response: 'Neuer Termin wird erstellt',
            category: 'Erstellen',
            label: 'Neuer Termin'
        });

        // ---------- Suche ----------

        // "Suche [term]" is handled as a special case in _processCommand
        // We still register it here for the help overlay
        this._commands.push({
            phrases: ['suche ...'],
            action: () => { /* handled in _processCommand */ },
            response: null,
            category: 'Suche',
            label: 'Suche [Begriff]',
            _helpOnly: true // flag to skip matching
        });

        // ---------- Hilfe ----------

        this._commands.push({
            phrases: ['hilfe', 'was kannst du', 'befehle', 'sprachbefehle'],
            action: () => {
                document.dispatchEvent(new CustomEvent('mhs:voice-show-help'));
            },
            response: 'Hier sind die verfuegbaren Sprachbefehle',
            category: 'Hilfe',
            label: 'Hilfe anzeigen'
        });

        // ---------- Zeiterfassung ----------

        this._commands.push({
            phrases: ['einstempeln', 'timer starten', 'arbeit beginnen'],
            action: () => {
                if (window.timeTrackingService) {
                    window.timeTrackingService.clockIn();
                    return { response: 'Sie sind jetzt eingestempelt. Gute Arbeit!' };
                }
                return { response: 'Zeiterfassung nicht verfuegbar' };
            },
            response: null,
            category: 'Zeiterfassung',
            label: 'Einstempeln'
        });

        this._commands.push({
            phrases: ['ausstempeln', 'timer stoppen', 'arbeit beenden', 'feierabend'],
            action: () => {
                if (window.timeTrackingService) {
                    window.timeTrackingService.clockOut();
                    return { response: 'Sie sind ausgestempelt. Schoenen Feierabend!' };
                }
                return { response: 'Zeiterfassung nicht verfuegbar' };
            },
            response: null,
            category: 'Zeiterfassung',
            label: 'Ausstempeln'
        });
    }

    // ========================================================
    //  PRIVATE – Helpers
    // ========================================================

    /**
     * Navigate to a view via the global NavigationController.
     */
    _navigate(viewId) {
        if (window.navigationController && typeof window.navigationController.navigateTo === 'function') {
            window.navigationController.navigateTo(viewId);
        } else {
            // Fallback: manual view switching
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const view = document.getElementById('view-' + viewId);
            if (view) { view.classList.add('active'); }
            const nav = document.querySelector('.nav-item[data-view="' + viewId + '"]');
            if (nav) { nav.classList.add('active'); }
        }
    }

    /**
     * Activate the global search with a given term.
     */
    _activateSearch(term) {
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.value = term;
            searchInput.focus();
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.speak('Suche nach ' + term);
        } else {
            // Fallback: use search service directly
            if (window.searchService) {
                const results = window.searchService.search(term);
                window.searchService.showResults(results, term);
                this.speak('Suche nach ' + term);
            }
        }

        document.dispatchEvent(new CustomEvent('mhs:voice-command', {
            detail: { transcript: 'suche ' + term, matched: 'suche', label: 'Suche: ' + term }
        }));
    }

    /**
     * Pre-load a German voice for TTS.
     */
    _loadGermanVoice() {
        if (!this._synthesis) { return; }

        const findGerman = () => {
            const voices = this._synthesis.getVoices();
            this._germanVoice = voices.find(v => v.lang && v.lang.startsWith('de')) || null;
        };

        findGerman();

        // Voices may load asynchronously
        if (this._synthesis.onvoiceschanged !== undefined) {
            this._synthesis.onvoiceschanged = findGerman;
        }
    }

    /**
     * Dispatch state event for the UI layer.
     */
    _dispatchState() {
        document.dispatchEvent(new CustomEvent('mhs:voice-state', {
            detail: {
                listening: this._listening,
                dictating: this._dictating
            }
        }));
    }

    /**
     * Log a command to persistent history.
     */
    _logCommand(transcript, matchedPattern) {
        this._commandHistory.push({
            transcript: transcript,
            matched: matchedPattern,
            timestamp: new Date().toISOString()
        });

        // Keep last 100
        if (this._commandHistory.length > 100) {
            this._commandHistory = this._commandHistory.slice(-100);
        }

        try {
            localStorage.setItem('mhs_voice_history', JSON.stringify(this._commandHistory));
        } catch (_) { /* quota exceeded – ignore */ }
    }
}

// ============================================================
//  Global Singleton
// ============================================================
window.voiceCommandService = new VoiceCommandService();
