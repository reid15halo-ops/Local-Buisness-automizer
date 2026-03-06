/* ============================================
   Voice Input Service - Spracherkennungs-Wrapper
   Singleton: window.voiceInputService
   Nutzt Web Speech API (de-DE)
   ============================================ */

class VoiceInputService {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.currentText = '';
        this._onResultCallback = null;
        this._onErrorCallback = null;
        this._onStartCallback = null;
        this._onStopCallback = null;
        this._targetInput = null;

        // Check support
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.isSupported = !!SR;
        this.SpeechRecognition = SR || null;
    }

    /**
     * Start voice recognition
     * @param {Object} opts - Options
     * @param {HTMLElement} opts.targetInput - Input/textarea to fill (optional)
     * @param {boolean} opts.continuous - Continuous mode (default true)
     * @param {boolean} opts.append - Append to existing text (default true)
     * @returns {{ success: boolean, error?: string }}
     */
    start(opts = {}) {
        if (!this.isSupported) {
            const msg = 'Mikrofon nicht verfuegbar';
            this._showToast('Mikrofon nicht verfuegbar');
            if (this._onErrorCallback) { this._onErrorCallback(msg); }
            return { success: false, error: msg };
        }

        if (this.isRecording) {
            this.stop();
            return { success: false, error: 'Bereits aktiv' };
        }

        const continuous = opts.continuous !== false;
        const append = opts.append !== false;
        this._targetInput = opts.targetInput || null;

        this.recognition = new this.SpeechRecognition();
        this.recognition.lang = 'de-DE';
        this.recognition.continuous = continuous;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
        this.currentText = '';
        this.isRecording = true;

        // Preserve existing text if appending
        let existingText = '';
        if (append && this._targetInput) {
            existingText = this._targetInput.value || '';
            if (existingText && !existingText.endsWith(' ')) {
                existingText += ' ';
            }
        }

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript = transcript;
                }
            }

            if (finalTranscript) {
                this.currentText += finalTranscript;
            }

            // Update target input if set
            if (this._targetInput) {
                this._targetInput.value = existingText + this.currentText + interimTranscript;
                // Trigger input event for any listeners
                this._targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            if (this._onResultCallback) {
                this._onResultCallback({
                    interim: interimTranscript,
                    final: this.currentText,
                    full: existingText + this.currentText
                });
            }

            window.dispatchEvent(new CustomEvent('voiceInput:interim', {
                detail: { interim: interimTranscript, final: this.currentText }
            }));
        };

        this.recognition.onerror = (event) => {
            console.error('Spracherkennung Fehler:', event.error);
            if (event.error === 'not-allowed') {
                this._showToast('Mikrofon-Zugriff verweigert');
            } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
                this._showToast('Spracherkennungsfehler: ' + event.error);
            }

            if (event.error !== 'no-speech') {
                this.isRecording = false;
                if (this._onErrorCallback) { this._onErrorCallback(event.error); }
                window.dispatchEvent(new CustomEvent('voiceInput:error', {
                    detail: { error: event.error }
                }));
            }
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                // Auto-restart in continuous mode
                try {
                    this.recognition.start();
                } catch {
                    this.isRecording = false;
                    this._fireStopEvent();
                }
            }
        };

        try {
            this.recognition.start();
            this.isRecording = true;
            if (this._onStartCallback) { this._onStartCallback(); }
            window.dispatchEvent(new CustomEvent('voiceInput:started'));
            return { success: true };
        } catch (error) {
            this.isRecording = false;
            this._showToast('Mikrofon nicht verfuegbar');
            if (this._onErrorCallback) { this._onErrorCallback(error.message); }
            return { success: false, error: error.message };
        }
    }

    /**
     * Stop voice recognition
     * @returns {string} - Recognized text
     */
    stop() {
        this.isRecording = false;
        if (this.recognition) {
            try { this.recognition.stop(); } catch { /* already stopped */ }
            this.recognition = null;
        }

        const text = this.currentText.trim();
        this._fireStopEvent();
        return text;
    }

    /**
     * Register result callback
     * @param {Function} callback - fn({ interim, final, full })
     */
    onResult(callback) {
        this._onResultCallback = callback;
        return this;
    }

    /**
     * Register error callback
     * @param {Function} callback - fn(errorString)
     */
    onError(callback) {
        this._onErrorCallback = callback;
        return this;
    }

    /**
     * Register start callback
     * @param {Function} callback
     */
    onStart(callback) {
        this._onStartCallback = callback;
        return this;
    }

    /**
     * Register stop callback
     * @param {Function} callback - fn(finalText)
     */
    onStop(callback) {
        this._onStopCallback = callback;
        return this;
    }

    /**
     * Attach a microphone button next to an input element.
     * Creates a pulsing mic button, returns the button element.
     * @param {HTMLElement} inputElement - The text input or textarea
     * @param {Object} opts - { buttonClass, containerClass }
     * @returns {HTMLElement} - The mic button
     */
    attachMicButton(inputElement, opts = {}) {
        if (!inputElement) { return null; }
        if (!this.isSupported) { return null; }

        // Don't double-attach
        if (inputElement.dataset.voiceMicAttached) { return null; }
        inputElement.dataset.voiceMicAttached = 'true';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = opts.buttonClass || 'voice-mic-btn';
        btn.setAttribute('aria-label', 'Spracheingabe');
        btn.setAttribute('title', 'Spracheingabe starten');
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>`;

        let activeForThisInput = false;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (activeForThisInput) {
                // Stop
                this.stop();
                activeForThisInput = false;
                btn.classList.remove('voice-mic-btn--recording');
                btn.setAttribute('title', 'Spracheingabe starten');
            } else {
                // Stop any other active recording first
                if (this.isRecording) { this.stop(); }

                activeForThisInput = true;
                btn.classList.add('voice-mic-btn--recording');
                btn.setAttribute('title', 'Spracheingabe stoppen');

                const origOnStop = this._onStopCallback;
                this.onStop((text) => {
                    activeForThisInput = false;
                    btn.classList.remove('voice-mic-btn--recording');
                    btn.setAttribute('title', 'Spracheingabe starten');
                    if (origOnStop) { origOnStop(text); }
                });

                this.start({ targetInput: inputElement, continuous: true, append: true });
            }
        });

        // Insert button after input
        if (inputElement.parentNode) {
            const wrapper = inputElement.parentNode;
            // If the parent is a form-group or similar, insert after input
            if (inputElement.nextSibling) {
                wrapper.insertBefore(btn, inputElement.nextSibling);
            } else {
                wrapper.appendChild(btn);
            }
        }

        return btn;
    }

    /**
     * Attach mic buttons to all matching inputs in a container
     * @param {HTMLElement} container
     * @param {string} selector - CSS selector for inputs (default: '[data-voice-input]')
     */
    attachAll(container, selector = '[data-voice-input]') {
        if (!container || !this.isSupported) { return; }
        const inputs = container.querySelectorAll(selector);
        inputs.forEach(input => this.attachMicButton(input));
    }

    // Internal helpers

    _fireStopEvent() {
        const text = this.currentText.trim();
        if (this._onStopCallback) { this._onStopCallback(text); }
        window.dispatchEvent(new CustomEvent('voiceInput:stopped', {
            detail: { text }
        }));
    }

    _showToast(message) {
        // Use app toast system if available, otherwise console
        if (window.UI?.showToast) {
            window.UI.showToast(message, 'warning');
        } else if (window.errorHandler?.warning) {
            window.errorHandler.warning(message);
        } else {
            console.warn('[VoiceInput]', message);
        }
    }
}

// Singleton on window
window.voiceInputService = new VoiceInputService();
