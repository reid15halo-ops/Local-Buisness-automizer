/* ============================================
   Voice Command Service
   Hands-free operation with German speech recognition
   ============================================ */

class VoiceCommandService {
    constructor() {
        this.isListening = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.settings = JSON.parse(localStorage.getItem('mhs_voice_settings') || '{}');
        this.commandHistory = JSON.parse(localStorage.getItem('mhs_voice_history') || '[]');

        // Default settings
        if (!this.settings.language) this.settings.language = 'de-DE';
        if (!this.settings.speakResponses) this.settings.speakResponses = true;
        if (!this.settings.wakeWord) this.settings.wakeWord = 'okay mhs';
        if (!this.settings.continuousListening) this.settings.continuousListening = false;

        // Initialize speech recognition
        this.initRecognition();

        // Command definitions
        this.commands = this.initCommands();
    }

    // Initialize Web Speech API
    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('Spracherkennung nicht verfügbar');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = this.settings.language;
        this.recognition.continuous = this.settings.continuousListening;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 3;

        this.recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
            this.processCommand(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                this.speak('Ich habe Sie nicht verstanden. Bitte wiederholen Sie.');
            }
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (this.settings.continuousListening) {
                this.startListening();
            }
        };
    }

    // Initialize command definitions
    initCommands() {
        return [
            // Navigation commands
            {
                patterns: ['zeige dashboard', 'öffne dashboard', 'startseite', 'übersicht'],
                action: () => this.navigate('dashboard'),
                response: 'Dashboard wird angezeigt'
            },
            {
                patterns: ['zeige anfragen', 'offene anfragen', 'anfragen'],
                action: () => this.navigate('anfragen'),
                response: 'Anfragen werden angezeigt'
            },
            {
                patterns: ['zeige angebote', 'offene angebote', 'angebote'],
                action: () => this.navigate('angebote'),
                response: 'Angebote werden angezeigt'
            },
            {
                patterns: ['zeige aufträge', 'offene aufträge', 'aufträge'],
                action: () => this.navigate('auftraege'),
                response: 'Aufträge werden angezeigt'
            },
            {
                patterns: ['zeige rechnungen', 'offene rechnungen', 'rechnungen'],
                action: () => this.navigate('rechnungen'),
                response: 'Rechnungen werden angezeigt'
            },
            {
                patterns: ['zeige mahnungen', 'offene mahnungen', 'mahnwesen'],
                action: () => this.navigate('mahnungen'),
                response: 'Mahnungen werden angezeigt'
            },
            {
                patterns: ['zeige kalender', 'termine', 'kalender'],
                action: () => this.navigate('kalender'),
                response: 'Kalender wird angezeigt'
            },
            {
                patterns: ['zeige aufgaben', 'tasks', 'aufgaben'],
                action: () => this.navigate('aufgaben'),
                response: 'Aufgaben werden angezeigt'
            },
            {
                patterns: ['zeige kunden', 'kundenliste', 'kunden'],
                action: () => this.navigate('kunden'),
                response: 'Kundenliste wird angezeigt'
            },
            {
                patterns: ['zeige zeiterfassung', 'stempeluhr', 'zeiterfassung'],
                action: () => this.navigate('zeiterfassung'),
                response: 'Zeiterfassung wird angezeigt'
            },
            {
                patterns: ['zeige buchhaltung', 'finanzen', 'buchhaltung'],
                action: () => this.navigate('buchhaltung'),
                response: 'Buchhaltung wird angezeigt'
            },

            // Time tracking
            {
                patterns: ['einstempeln', 'timer starten', 'arbeit beginnen', 'stempel ein'],
                action: () => this.clockIn(),
                response: 'Sie sind jetzt eingestempelt'
            },
            {
                patterns: ['ausstempeln', 'timer stoppen', 'arbeit beenden', 'stempel aus'],
                action: () => this.clockOut(),
                response: 'Sie sind jetzt ausgestempelt'
            },

            // Create actions
            {
                patterns: ['neue anfrage', 'anfrage erstellen'],
                action: () => this.openModal('modal-anfrage'),
                response: 'Neue Anfrage wird erstellt'
            },
            {
                patterns: ['neuer termin', 'termin erstellen', 'termin anlegen'],
                action: () => this.openModal('modal-termin'),
                response: 'Neuer Termin wird erstellt'
            },
            {
                patterns: ['neue aufgabe', 'aufgabe erstellen', 'task anlegen'],
                action: () => this.createQuickTask(),
                response: 'Neue Aufgabe wird erstellt'
            },

            // Queries
            {
                patterns: ['umsatz heute', 'was haben wir heute verdient', 'heutiger umsatz'],
                action: () => this.queryRevenueToday(),
                response: null // Dynamic response
            },
            {
                patterns: ['umsatz diese woche', 'wochenumsatz', 'umsatz woche'],
                action: () => this.queryRevenueWeek(),
                response: null
            },
            {
                patterns: ['umsatz diesen monat', 'monatsumsatz', 'umsatz monat'],
                action: () => this.queryRevenueMonth(),
                response: null
            },
            {
                patterns: ['wie viele offene rechnungen', 'offene rechnungen anzahl'],
                action: () => this.queryOpenInvoices(),
                response: null
            },
            {
                patterns: ['wie viele termine heute', 'termine heute'],
                action: () => this.queryTodayAppointments(),
                response: null
            },

            // Call customer
            {
                patterns: ['rufe .* an', 'anrufen .*'],
                action: (match) => this.callCustomer(match),
                response: null,
                isRegex: true
            },

            // Help
            {
                patterns: ['hilfe', 'was kannst du', 'befehle'],
                action: () => this.showHelp(),
                response: 'Ich kann Navigation, Zeiterfassung, Abfragen und mehr. Sagen Sie zum Beispiel: Zeige Dashboard, Einstempeln, oder Umsatz heute.'
            }
        ];
    }

    // Start listening
    startListening() {
        if (!this.recognition) {
            console.error('Recognition not available');
            return false;
        }

        try {
            this.recognition.start();
            this.isListening = true;
            console.log('🎤 Spracherkennung aktiv');
            return true;
        } catch (e) {
            console.error('Could not start recognition:', e);
            return false;
        }
    }

    // Stop listening
    stopListening() {
        if (this.recognition) {
            this.recognition.stop();
            this.isListening = false;
        }
    }

    // Process recognized speech
    processCommand(transcript) {
        console.log('🗣️ Erkannt:', transcript);

        // Check for wake word if required
        if (this.settings.wakeWord && !transcript.startsWith(this.settings.wakeWord)) {
            return { matched: false, reason: 'no_wake_word' };
        }

        // Remove wake word
        let command = transcript.replace(this.settings.wakeWord, '').trim();

        // Find matching command
        for (const cmd of this.commands) {
            for (const pattern of cmd.patterns) {
                let matched = false;
                let match = null;

                if (cmd.isRegex) {
                    const regex = new RegExp(pattern, 'i');
                    match = command.match(regex);
                    matched = !!match;
                } else {
                    matched = command.includes(pattern);
                }

                if (matched) {
                    // Log to history
                    this.logCommand(transcript, pattern);

                    // Execute action
                    const result = cmd.action(match);

                    // Speak response
                    if (cmd.response) {
                        this.speak(cmd.response);
                    } else if (result?.response) {
                        this.speak(result.response);
                    }

                    return { matched: true, command: pattern, result };
                }
            }
        }

        // No match found
        this.speak('Ich habe den Befehl nicht verstanden. Sagen Sie Hilfe für verfügbare Befehle.');
        return { matched: false };
    }

    // Text-to-speech
    speak(text) {
        if (!this.settings.speakResponses || !this.synthesis) return;

        // Cancel any ongoing speech
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.settings.language;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Try to use German voice
        const voices = this.synthesis.getVoices();
        const germanVoice = voices.find(v => v.lang.startsWith('de'));
        if (germanVoice) {
            utterance.voice = germanVoice;
        }

        this.synthesis.speak(utterance);
    }

    // Navigation helper
    navigate(viewId) {
        if (typeof switchView === 'function') {
            switchView(viewId);
        } else {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.getElementById(`view-${viewId}`)?.classList.add('active');
            document.querySelector(`[data-view="${viewId}"]`)?.classList.add('active');
        }
    }

    // Open modal
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }

    // Clock in
    clockIn() {
        if (window.timeTrackingService) {
            window.timeTrackingService.clockIn();
            return { response: 'Sie sind jetzt eingestempelt. Gute Arbeit!' };
        }
    }

    // Clock out
    clockOut() {
        if (window.timeTrackingService) {
            window.timeTrackingService.clockOut();
            return { response: 'Sie sind ausgestempelt. Schönen Feierabend!' };
        }
    }

    // Create quick task
    createQuickTask() {
        // Prompt for task title via speech
        this.speak('Wie soll die Aufgabe heißen?');
        // Would need async handling for follow-up speech
        if (window.taskService) {
            window.taskService.addTask({
                title: 'Neue Sprachaufgabe',
                priority: 'normal',
                source: 'voice'
            });
        }
    }

    // Query revenue today
    queryRevenueToday() {
        if (window.bookkeepingService) {
            const today = new Date().toISOString().split('T')[0];
            const buchungen = window.bookkeepingService.buchungen.filter(b =>
                b.datum === today && b.typ === 'einnahme'
            );
            const total = buchungen.reduce((sum, b) => sum + b.betrag, 0);
            const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(total);
            return { response: `Der Umsatz heute beträgt ${formatted}` };
        }
        return { response: 'Buchhaltung nicht verfügbar' };
    }

    // Query revenue week
    queryRevenueWeek() {
        if (window.bookkeepingService) {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekStart = weekAgo.toISOString().split('T')[0];

            const buchungen = window.bookkeepingService.buchungen.filter(b =>
                b.datum >= weekStart && b.typ === 'einnahme'
            );
            const total = buchungen.reduce((sum, b) => sum + b.betrag, 0);
            const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(total);
            return { response: `Der Wochenumsatz beträgt ${formatted}` };
        }
        return { response: 'Buchhaltung nicht verfügbar' };
    }

    // Query revenue month
    queryRevenueMonth() {
        if (window.bookkeepingService) {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

            const buchungen = window.bookkeepingService.buchungen.filter(b =>
                b.datum >= monthStart && b.typ === 'einnahme'
            );
            const total = buchungen.reduce((sum, b) => sum + b.betrag, 0);
            const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(total);
            return { response: `Der Monatsumsatz beträgt ${formatted}` };
        }
        return { response: 'Buchhaltung nicht verfügbar' };
    }

    // Query open invoices
    queryOpenInvoices() {
        const rechnungen = store?.rechnungen || [];
        const open = rechnungen.filter(r => r.status === 'offen' || r.status === 'versendet');
        const total = open.reduce((sum, r) => sum + (r.betrag || 0), 0);
        const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(total);
        return { response: `Sie haben ${open.length} offene Rechnungen im Wert von ${formatted}` };
    }

    // Query today's appointments
    queryTodayAppointments() {
        if (window.calendarService) {
            const today = new Date().toISOString().split('T')[0];
            const appointments = window.calendarService.getAppointmentsForDay(today);
            if (appointments.length === 0) {
                return { response: 'Sie haben heute keine Termine' };
            }
            return { response: `Sie haben heute ${appointments.length} Termine. Der erste ist um ${appointments[0].startTime} Uhr.` };
        }
        return { response: 'Kalender nicht verfügbar' };
    }

    // Call customer
    callCustomer(match) {
        const customerName = match[0].replace(/rufe|anrufen/gi, '').replace(/an$/i, '').trim();

        if (window.customerService && window.phoneService) {
            const customers = window.customerService.searchCustomers(customerName);
            if (customers.length > 0 && customers[0].telefon) {
                window.phoneService.makeCall(customers[0].telefon, customers[0]);
                return { response: `Rufe ${customers[0].name} an` };
            }
        }
        return { response: `Kunde ${customerName} nicht gefunden` };
    }

    // Show help
    showHelp() {
        this.navigate('dashboard');
        // Could show a help modal
    }

    // Log command to history
    logCommand(transcript, matchedPattern) {
        this.commandHistory.push({
            transcript: transcript,
            matched: matchedPattern,
            timestamp: new Date().toISOString()
        });

        // Keep last 100 commands
        if (this.commandHistory.length > 100) {
            this.commandHistory = this.commandHistory.slice(-100);
        }

        localStorage.setItem('mhs_voice_history', JSON.stringify(this.commandHistory));
    }

    // Get command history
    getHistory() {
        return this.commandHistory;
    }

    // Check if speech is available
    isAvailable() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('mhs_voice_settings', JSON.stringify(this.settings));

        if (this.recognition) {
            this.recognition.lang = this.settings.language;
            this.recognition.continuous = this.settings.continuousListening;
        }
    }
}

window.voiceCommandService = new VoiceCommandService();
