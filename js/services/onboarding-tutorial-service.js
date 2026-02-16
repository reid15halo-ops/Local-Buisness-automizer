/* ============================================
   Onboarding Tutorial Service
   Interactive step-by-step tutorial overlay for first-time users
   ============================================ */

class OnboardingTutorialService {
    constructor() {
        this.isActive = false;
        this.currentStep = 0;
        this.overlayElement = null;
        this.tooltipElement = null;
        this.highlightElement = null;
        this.storageKey = 'tutorial_completed';

        this.steps = [
            {
                id: 'welcome',
                title: 'Willkommen bei MHS Workflow!',
                description: 'Diese App hilft dir, deine Handwerksfirma zu organisieren. Von Anfragen über Angebote bis zu Rechnungen – alles an einem Ort.',
                targetSelector: null, // Full screen for welcome
                highlightClass: null,
                position: 'center'
            },
            {
                id: 'sidebar-nav',
                title: 'Sidebar Navigation',
                description: 'In der linken Seitenleiste findest du alle Hauptfunktionen: Anfragen, Angebote, Aufträge und Rechnungen. Klicke auf einen Punkt, um ihn zu öffnen.',
                targetSelector: '.sidebar nav.nav-menu',
                highlightClass: 'highlight-nav',
                position: 'right'
            },
            {
                id: 'neue-anfrage',
                title: 'Neue Anfrage erstellen',
                description: 'Hier kannst du eine neue Kundenanfrage erfassen. Mit "+ Neue Anfrage" geht es sofort los. Später kannst du diese in ein Angebot umwandeln.',
                targetSelector: '.btn-new-anfrage',
                highlightClass: 'highlight-button',
                position: 'top'
            },
            {
                id: 'anfragen-view',
                title: 'Anfragen verwalten',
                description: 'Alle eingehenden Anfragen findest du hier. Du kannst sie akzeptieren, ablehnen oder in Angebote umwandeln.',
                targetSelector: '[data-view="anfragen"]',
                highlightClass: 'highlight-nav-item',
                position: 'right'
            },
            {
                id: 'angebote-view',
                title: 'Angebot generieren',
                description: 'Aus jeder Anfrage erstellst du ein Angebot. Die App hilft dir dabei, Preise zu kalkulieren und Angebote zu generieren.',
                targetSelector: '[data-view="angebote"]',
                highlightClass: 'highlight-nav-item',
                position: 'right'
            },
            {
                id: 'auftraege-view',
                title: 'Auftrag verwalten',
                description: 'Wenn ein Kunde dein Angebot annimmt, wird es zum Auftrag. Hier verfolgst du den Status aller laufenden Arbeiten.',
                targetSelector: '[data-view="auftraege"]',
                highlightClass: 'highlight-nav-item',
                position: 'right'
            },
            {
                id: 'rechnungen-view',
                title: 'Rechnung erstellen',
                description: 'Nach Abschluss eines Auftrags erstellst du eine Rechnung. Diese wird automatisch nummeriert und kann direkt versendet werden.',
                targetSelector: '[data-view="rechnungen"]',
                highlightClass: 'highlight-nav-item',
                position: 'right'
            },
            {
                id: 'dashboard',
                title: 'Dashboard nutzen',
                description: 'Das Dashboard zeigt dir alle wichtigen Kennzahlen: offene Rechnungen, laufende Aufträge, und eine Aktivitätsübersicht.',
                targetSelector: '[data-view="dashboard"]',
                highlightClass: 'highlight-nav-item',
                position: 'right'
            },
            {
                id: 'einstellungen',
                title: 'Einstellungen & Hilfe',
                description: 'In den Einstellungen konfigurierst du API-Keys für KI-Funktionen, Email-Versand und weitere Integrationen. Bei Fragen findest du hier auch Links zur Hilfe.',
                targetSelector: '[data-view="einstellungen"]',
                highlightClass: 'highlight-nav-item',
                position: 'right'
            },
            {
                id: 'complete',
                title: 'Tutorial abgeschlossen! 🎉',
                description: 'Du bist bereit! Starte jetzt deine erste Anfrage oder importiere Daten. Dieses Tutorial kannst du jederzeit in den Einstellungen erneut öffnen.',
                targetSelector: null,
                highlightClass: null,
                position: 'center'
            }
        ];
    }

    /**
     * Check if tutorial should auto-start
     */
    shouldAutoStart() {
        return !localStorage.getItem(this.storageKey);
    }

    /**
     * Start or resume the tutorial
     */
    async start(stepIndex = 0) {
        if (this.isActive) {return;}

        this.isActive = true;
        this.currentStep = stepIndex;

        // Inject styles if not already present
        this.injectStyles();

        // Create overlay and tooltip
        this.createOverlay();
        this.createTooltip();

        // Show current step
        this.showStep(this.currentStep);
    }

    /**
     * Show a specific step
     */
    showStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.steps.length) {
            this.stop();
            return;
        }

        this.currentStep = stepIndex;
        const step = this.steps[stepIndex];

        // Clear previous highlight
        if (this.highlightElement) {
            this.highlightElement.classList.remove('tutorial-highlight');
            this.highlightElement = null;
        }

        // Update tooltip content
        this.updateTooltip(step, stepIndex);

        // Highlight target element
        if (step.targetSelector) {
            const target = document.querySelector(step.targetSelector);
            if (target) {
                target.classList.add('tutorial-highlight');
                this.highlightElement = target;

                // Scroll target into view
                target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        // Fade in tooltip
        if (this.tooltipElement) {
            this.tooltipElement.style.opacity = '0';
            setTimeout(() => {
                this.tooltipElement.style.opacity = '1';
            }, 50);
        }
    }

    /**
     * Create the overlay element
     */
    createOverlay() {
        if (this.overlayElement) {return;}

        this.overlayElement = document.createElement('div');
        this.overlayElement.className = 'tutorial-overlay';
        this.overlayElement.addEventListener('click', (e) => {
            // Only close if clicking outside the tooltip
            if (e.target === this.overlayElement) {
                this.showSkipConfirm();
            }
        });

        document.body.appendChild(this.overlayElement);
    }

    /**
     * Create the tooltip element
     */
    createTooltip() {
        if (this.tooltipElement) {return;}

        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'tutorial-tooltip';
        this.tooltipElement.innerHTML = `
            <div class="tutorial-tooltip-content">
                <div class="tutorial-progress">
                    <div class="tutorial-progress-bar"></div>
                    <div class="tutorial-progress-text"></div>
                </div>
                <h3 class="tutorial-title"></h3>
                <p class="tutorial-description"></p>
                <div class="tutorial-actions">
                    <button class="tutorial-btn tutorial-btn-secondary" id="tutorial-skip">Überspringen</button>
                    <button class="tutorial-btn tutorial-btn-secondary" id="tutorial-prev">← Zurück</button>
                    <button class="tutorial-btn tutorial-btn-primary" id="tutorial-next">Weiter →</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.tooltipElement);

        // Attach button listeners
        this.tooltipElement.querySelector('#tutorial-skip').addEventListener('click', () => {
            this.showSkipConfirm();
        });

        this.tooltipElement.querySelector('#tutorial-prev').addEventListener('click', () => {
            if (this.currentStep > 0) {
                this.showStep(this.currentStep - 1);
            }
        });

        this.tooltipElement.querySelector('#tutorial-next').addEventListener('click', () => {
            if (this.currentStep < this.steps.length - 1) {
                this.showStep(this.currentStep + 1);
            } else {
                this.complete();
            }
        });

        // Allow keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.isActive) {return;}

            if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                const nextBtn = this.tooltipElement.querySelector('#tutorial-next');
                if (nextBtn) {nextBtn.click();}
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const prevBtn = this.tooltipElement.querySelector('#tutorial-prev');
                if (prevBtn && this.currentStep > 0) {prevBtn.click();}
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.showSkipConfirm();
            }
        });
    }

    /**
     * Update tooltip content for current step
     */
    updateTooltip(step, stepIndex) {
        const title = this.tooltipElement.querySelector('.tutorial-title');
        const description = this.tooltipElement.querySelector('.tutorial-description');
        const progressText = this.tooltipElement.querySelector('.tutorial-progress-text');
        const progressBar = this.tooltipElement.querySelector('.tutorial-progress-bar');
        const nextBtn = this.tooltipElement.querySelector('#tutorial-next');
        const prevBtn = this.tooltipElement.querySelector('#tutorial-prev');

        title.textContent = step.title;
        description.textContent = step.description;
        progressText.textContent = `Schritt ${stepIndex + 1} von ${this.steps.length}`;
        progressBar.style.width = `${((stepIndex + 1) / this.steps.length) * 100}%`;

        // Update button states
        if (stepIndex === 0) {
            prevBtn.disabled = true;
            prevBtn.style.opacity = '0.5';
        } else {
            prevBtn.disabled = false;
            prevBtn.style.opacity = '1';
        }

        if (stepIndex === this.steps.length - 1) {
            nextBtn.textContent = 'Fertig ✓';
        } else {
            nextBtn.textContent = 'Weiter →';
        }

        // Position tooltip near highlighted element
        this.positionTooltip(step);
    }

    /**
     * Position tooltip relative to highlighted element
     */
    positionTooltip(step) {
        if (!step.targetSelector || !this.tooltipElement) {return;}

        const target = document.querySelector(step.targetSelector);
        if (!target) {
            this.centerTooltip();
            return;
        }

        const rect = target.getBoundingClientRect();
        const tooltip = this.tooltipElement;
        const gap = 20;
        const tooltipWidth = 380;
        const tooltipHeight = 280;

        let top = 0;
        let left = 0;

        // Determine position based on step config
        switch (step.position) {
            case 'top':
                left = rect.left + rect.width / 2 - tooltipWidth / 2;
                top = rect.top - tooltipHeight - gap;
                if (top < 20) {
                    top = rect.bottom + gap;
                }
                break;

            case 'bottom':
                left = rect.left + rect.width / 2 - tooltipWidth / 2;
                top = rect.bottom + gap;
                if (top + tooltipHeight > window.innerHeight - 20) {
                    top = rect.top - tooltipHeight - gap;
                }
                break;

            case 'left':
                left = rect.left - tooltipWidth - gap;
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
                if (left < 20) {
                    left = rect.right + gap;
                }
                break;

            case 'right':
            default:
                left = rect.right + gap;
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
                if (left + tooltipWidth > window.innerWidth - 20) {
                    left = rect.left - tooltipWidth - gap;
                }
                break;

            case 'center':
                this.centerTooltip();
                return;
        }

        // Clamp to viewport
        left = Math.max(20, Math.min(left, window.innerWidth - tooltipWidth - 20));
        top = Math.max(20, Math.min(top, window.innerHeight - tooltipHeight - 20));

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    /**
     * Center tooltip on screen
     */
    centerTooltip() {
        if (!this.tooltipElement) {return;}

        const tooltipWidth = 400;
        const tooltipHeight = 300;

        const left = (window.innerWidth - tooltipWidth) / 2;
        const top = (window.innerHeight - tooltipHeight) / 2;

        this.tooltipElement.style.left = `${left}px`;
        this.tooltipElement.style.top = `${top}px`;
    }

    /**
     * Show skip confirmation dialog
     */
    showSkipConfirm() {
        const message = 'Möchtest du das Tutorial wirklich beenden? Du kannst es später in den Einstellungen erneut starten.';
        if (confirm(message)) {
            this.stop();
        }
    }

    /**
     * Complete the tutorial
     */
    complete() {
        localStorage.setItem(this.storageKey, 'true');
        this.stop();

        // Show completion toast
        this.showToast('🎉 Tutorial abgeschlossen! Viel Spaß mit MHS Workflow!', 'success');
    }

    /**
     * Stop the tutorial
     */
    stop() {
        this.isActive = false;

        // Remove overlay
        if (this.overlayElement) {
            this.overlayElement.remove();
            this.overlayElement = null;
        }

        // Remove tooltip
        if (this.tooltipElement) {
            this.tooltipElement.remove();
            this.tooltipElement = null;
        }

        // Remove highlight
        if (this.highlightElement) {
            this.highlightElement.classList.remove('tutorial-highlight');
            this.highlightElement = null;
        }

        // Remove listener
        document.removeEventListener('keydown', this.handleKeydown);
    }

    /**
     * Reset tutorial progress
     */
    reset() {
        localStorage.removeItem(this.storageKey);
        this.stop();
    }

    /**
     * Show a toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `tutorial-toast tutorial-toast-${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * Inject all required CSS styles
     */
    injectStyles() {
        // Check if styles already injected
        if (document.getElementById('tutorial-styles')) {return;}

        const style = document.createElement('style');
        style.id = 'tutorial-styles';
        style.textContent = `
            /* Tutorial Overlay */
            .tutorial-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(15, 15, 18, 0.85);
                backdrop-filter: blur(2px);
                z-index: 9998;
                animation: fadeIn 0.3s ease-out;
            }

            @keyframes fadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }

            /* Tutorial Tooltip */
            .tutorial-tooltip {
                position: fixed;
                background: #1c1c21;
                border: 2px solid #6366f1;
                border-radius: 12px;
                padding: 24px;
                max-width: 400px;
                z-index: 9999;
                box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 0 32px rgba(99, 102, 241, 0.15);
                opacity: 0;
                transition: opacity 0.3s ease-out;
                animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .tutorial-tooltip-content {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            /* Progress Bar */
            .tutorial-progress {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .tutorial-progress-text {
                font-size: 12px;
                color: #a1a1aa;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .tutorial-progress-bar {
                height: 4px;
                background: #27272a;
                border-radius: 2px;
                overflow: hidden;
                width: 100%;
            }

            .tutorial-progress-bar::after {
                content: '';
                display: block;
                height: 100%;
                background: linear-gradient(90deg, #6366f1, #818cf8);
                border-radius: 2px;
                width: 10%;
                transition: width 0.4s ease-out;
            }

            /* Title and Description */
            .tutorial-title {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #ffffff;
                letter-spacing: -0.5px;
            }

            .tutorial-description {
                margin: 0;
                font-size: 14px;
                color: #a1a1aa;
                line-height: 1.6;
            }

            /* Actions */
            .tutorial-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .tutorial-btn {
                flex: 1;
                min-width: 100px;
                padding: 10px 16px;
                border: none;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
                text-transform: capitalize;
                letter-spacing: 0.3px;
            }

            .tutorial-btn:disabled {
                cursor: not-allowed;
                opacity: 0.5;
            }

            .tutorial-btn-primary {
                background: #6366f1;
                color: #ffffff;
                flex: 1.5;
                font-weight: 600;
            }

            .tutorial-btn-primary:hover:not(:disabled) {
                background: #818cf8;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            }

            .tutorial-btn-primary:active:not(:disabled) {
                transform: translateY(0);
            }

            .tutorial-btn-secondary {
                background: #27272a;
                color: #a1a1aa;
                border: 1px solid #36363c;
            }

            .tutorial-btn-secondary:hover:not(:disabled) {
                background: #36363c;
                color: #ffffff;
                border-color: #4a4a52;
            }

            /* Highlight Effect */
            .tutorial-highlight {
                position: relative;
                box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.4), 0 0 0 8px rgba(99, 102, 241, 0.2) !important;
                border-radius: 8px;
                animation: pulse 2s ease-in-out infinite;
                z-index: 9997;
            }

            @keyframes pulse {
                0%, 100% {
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.4), 0 0 0 8px rgba(99, 102, 241, 0.2);
                }
                50% {
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2), 0 0 0 12px rgba(99, 102, 241, 0.1);
                }
            }

            /* Toast Notification */
            .tutorial-toast {
                position: fixed;
                bottom: 24px;
                right: 24px;
                background: #1c1c21;
                color: #a1a1aa;
                padding: 16px 24px;
                border-radius: 8px;
                border-left: 4px solid #6366f1;
                font-size: 14px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
                z-index: 10000;
                animation: slideInRight 0.3s ease-out;
                opacity: 1;
                transition: opacity 0.3s ease;
            }

            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            .tutorial-toast-success {
                border-left-color: #22c55e;
                color: #22c55e;
            }

            .tutorial-toast-warning {
                border-left-color: #f59e0b;
                color: #f59e0b;
            }

            .tutorial-toast-error {
                border-left-color: #ef4444;
                color: #ef4444;
            }

            /* Responsive */
            @media (max-width: 640px) {
                .tutorial-tooltip {
                    max-width: calc(100% - 32px);
                    padding: 16px;
                }

                .tutorial-toast {
                    left: 16px;
                    right: 16px;
                    bottom: 16px;
                }
            }
        `;

        document.head.appendChild(style);
    }
}

// Create global instance
window.OnboardingTutorialService = OnboardingTutorialService;
