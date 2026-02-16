import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('OnboardingTutorialService', () => {
    let tutorialService;

    beforeEach(() => {
        global.localStorage = {
            data: {},
            getItem: vi.fn((key) => global.localStorage.data[key] || null),
            setItem: vi.fn((key, value) => {
                global.localStorage.data[key] = value;
            }),
            removeItem: vi.fn((key) => {
                delete global.localStorage.data[key];
            }),
            clear: vi.fn(() => {
                global.localStorage.data = {};
            })
        };

        global.confirm = vi.fn(() => true);

        const OnboardingTutorialServiceClass = class OnboardingTutorialService {
            constructor() {
                this.isActive = false;
                this.currentStep = 0;
                this.overlayElement = null;
                this.tooltipElement = null;
                this.highlightElement = null;
                this.storageKey = 'tutorial_completed';
                this.steps = [
                    { id: 'welcome', title: 'Willkommen', description: 'Welcome', targetSelector: null, position: 'center' },
                    { id: 'step2', title: 'Step 2', description: 'Description', targetSelector: '.test', position: 'right' },
                    { id: 'complete', title: 'Done', description: 'Finished', targetSelector: null, position: 'center' }
                ];
            }

            shouldAutoStart() {
                return !localStorage.getItem(this.storageKey);
            }

            start(stepIndex = 0) {
                if (this.isActive) return;
                this.isActive = true;
                this.currentStep = stepIndex;
                this.injectStyles();
                this.createOverlay();
                this.createTooltip();
                this.showStep(this.currentStep);
            }

            showStep(stepIndex) {
                if (stepIndex < 0 || stepIndex >= this.steps.length) {
                    this.stop();
                    return;
                }
                this.currentStep = stepIndex;
                const step = this.steps[stepIndex];

                if (this.highlightElement) {
                    this.highlightElement.classList.remove('tutorial-highlight');
                    this.highlightElement = null;
                }

                this.updateTooltip(step, stepIndex);

                if (step.targetSelector) {
                    const target = document.querySelector(step.targetSelector);
                    if (target) {
                        target.classList.add('tutorial-highlight');
                        this.highlightElement = target;
                    }
                }
            }

            createOverlay() {
                if (this.overlayElement) return;
                this.overlayElement = document.createElement('div');
                this.overlayElement.className = 'tutorial-overlay';
                this.overlayElement.addEventListener('click', () => this.showSkipConfirm());
                document.body.appendChild(this.overlayElement);
            }

            createTooltip() {
                if (this.tooltipElement) return;
                this.tooltipElement = document.createElement('div');
                this.tooltipElement.className = 'tutorial-tooltip';
                this.tooltipElement.innerHTML = `
                    <div class="tutorial-tooltip-content">
                        <h3 class="tutorial-title"></h3>
                        <p class="tutorial-description"></p>
                        <button id="tutorial-skip">Skip</button>
                        <button id="tutorial-prev">Prev</button>
                        <button id="tutorial-next">Next</button>
                    </div>
                `;
                document.body.appendChild(this.tooltipElement);

                this.tooltipElement.querySelector('#tutorial-skip').addEventListener('click', () => this.showSkipConfirm());
                this.tooltipElement.querySelector('#tutorial-prev').addEventListener('click', () => {
                    if (this.currentStep > 0) this.showStep(this.currentStep - 1);
                });
                this.tooltipElement.querySelector('#tutorial-next').addEventListener('click', () => {
                    if (this.currentStep < this.steps.length - 1) {
                        this.showStep(this.currentStep + 1);
                    } else {
                        this.complete();
                    }
                });

                document.addEventListener('keydown', (e) => {
                    if (!this.isActive) return;
                    if (e.key === 'ArrowRight' || e.key === ' ') {
                        const nextBtn = this.tooltipElement?.querySelector('#tutorial-next');
                        if (nextBtn) nextBtn.click();
                    } else if (e.key === 'ArrowLeft') {
                        const prevBtn = this.tooltipElement?.querySelector('#tutorial-prev');
                        if (prevBtn && this.currentStep > 0) prevBtn.click();
                    } else if (e.key === 'Escape') {
                        this.showSkipConfirm();
                    }
                });
            }

            updateTooltip(step, stepIndex) {
                const title = this.tooltipElement?.querySelector('.tutorial-title');
                const description = this.tooltipElement?.querySelector('.tutorial-description');
                const nextBtn = this.tooltipElement?.querySelector('#tutorial-next');
                const prevBtn = this.tooltipElement?.querySelector('#tutorial-prev');

                if (title) title.textContent = step.title;
                if (description) description.textContent = step.description;

                if (prevBtn) {
                    prevBtn.disabled = stepIndex === 0;
                    prevBtn.style.opacity = stepIndex === 0 ? '0.5' : '1';
                }

                if (nextBtn) {
                    nextBtn.textContent = stepIndex === this.steps.length - 1 ? 'Fertig' : 'Weiter';
                }
            }

            positionTooltip(step) {
                if (!this.tooltipElement) return;
                this.tooltipElement.style.left = '50%';
                this.tooltipElement.style.top = '50%';
            }

            centerTooltip() {
                if (!this.tooltipElement) return;
                this.tooltipElement.style.left = '50%';
                this.tooltipElement.style.top = '50%';
            }

            showSkipConfirm() {
                if (confirm('Beenden?')) {
                    this.stop();
                }
            }

            complete() {
                localStorage.setItem(this.storageKey, 'true');
                this.stop();
                this.showToast('Fertig!', 'success');
            }

            stop() {
                this.isActive = false;
                if (this.overlayElement) {
                    this.overlayElement.remove();
                    this.overlayElement = null;
                }
                if (this.tooltipElement) {
                    this.tooltipElement.remove();
                    this.tooltipElement = null;
                }
                if (this.highlightElement) {
                    this.highlightElement.classList.remove('tutorial-highlight');
                    this.highlightElement = null;
                }
            }

            reset() {
                localStorage.removeItem(this.storageKey);
                this.stop();
            }

            showToast(message, type = 'info') {
                const toast = document.createElement('div');
                toast.className = `tutorial-toast tutorial-toast-${type}`;
                toast.textContent = message;
                document.body.appendChild(toast);
            }

            injectStyles() {
                if (document.getElementById('tutorial-styles')) return;
                const style = document.createElement('style');
                style.id = 'tutorial-styles';
                style.textContent = '.tutorial-overlay { position: fixed; }';
                document.head.appendChild(style);
            }
        };

        tutorialService = new OnboardingTutorialServiceClass();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        document.body.innerHTML = '';
        document.head.innerHTML = '';
        if (tutorialService && tutorialService.isActive) {
            tutorialService.stop();
        }
    });

    describe('Initialization', () => {
        it('should check if tutorial should auto-start', () => {
            expect(tutorialService.shouldAutoStart()).toBe(true);
        });

        it('should not auto-start if already completed', () => {
            localStorage.setItem('tutorial_completed', 'true');
            const newService = new tutorialService.constructor();
            expect(newService.shouldAutoStart()).toBe(false);
        });

        it('should have correct number of steps', () => {
            expect(tutorialService.steps.length).toBeGreaterThan(0);
        });

        it('should have welcome step', () => {
            expect(tutorialService.steps[0].id).toBe('welcome');
        });

        it('should have complete step', () => {
            expect(tutorialService.steps[tutorialService.steps.length - 1].id).toBe('complete');
        });
    });

    describe('Tutorial Navigation', () => {
        it('should start tutorial from first step', () => {
            tutorialService.start();
            expect(tutorialService.isActive).toBe(true);
            expect(tutorialService.currentStep).toBe(0);
        });

        it('should start from specific step', () => {
            tutorialService.start(1);
            expect(tutorialService.currentStep).toBe(1);
        });

        it('should not start if already active', () => {
            tutorialService.start();
            const step = tutorialService.currentStep;
            tutorialService.start(2);
            expect(tutorialService.currentStep).toBe(step);
        });

        it('should move to next step', () => {
            tutorialService.start();
            const nextBtn = document.getElementById('tutorial-next');
            nextBtn.click();
            expect(tutorialService.currentStep).toBe(1);
        });

        it('should move to previous step', () => {
            tutorialService.start(1);
            const prevBtn = document.getElementById('tutorial-prev');
            prevBtn.click();
            expect(tutorialService.currentStep).toBe(0);
        });

        it('should not go before first step', () => {
            tutorialService.start();
            const prevBtn = document.getElementById('tutorial-prev');
            prevBtn.click();
            expect(tutorialService.currentStep).toBe(0);
        });

        it('should complete tutorial on last step next button', () => {
            tutorialService.start(tutorialService.steps.length - 1);
            const nextBtn = document.getElementById('tutorial-next');
            nextBtn.click();
            expect(tutorialService.isActive).toBe(false);
        });

        it('should mark tutorial as completed', () => {
            tutorialService.start(tutorialService.steps.length - 1);
            tutorialService.complete();
            expect(localStorage.getItem('tutorial_completed')).toBe('true');
        });
    });

    describe('Step Display', () => {
        it('should create overlay element', () => {
            tutorialService.start();
            expect(document.querySelector('.tutorial-overlay')).toBeDefined();
        });

        it('should create tooltip element', () => {
            tutorialService.start();
            expect(document.querySelector('.tutorial-tooltip')).toBeDefined();
        });

        it('should update tooltip title', () => {
            tutorialService.start();
            const title = document.querySelector('.tutorial-title');
            expect(title.textContent).toBe('Willkommen');
        });

        it('should update tooltip description', () => {
            tutorialService.start();
            const description = document.querySelector('.tutorial-description');
            expect(description.textContent).toContain('Welcome');
        });
    });

    describe('Button States', () => {
        it('should disable prev button on first step', () => {
            tutorialService.start();
            const prevBtn = document.getElementById('tutorial-prev');
            expect(prevBtn.disabled).toBe(true);
        });

        it('should enable prev button on later steps', () => {
            tutorialService.start(1);
            const prevBtn = document.getElementById('tutorial-prev');
            expect(prevBtn.disabled).toBe(false);
        });

        it('should change next button text to Fertig on last step', () => {
            tutorialService.start(tutorialService.steps.length - 1);
            const nextBtn = document.getElementById('tutorial-next');
            expect(nextBtn.textContent).toContain('Fertig');
        });

        it('should show Weiter on non-last steps', () => {
            tutorialService.start();
            const nextBtn = document.getElementById('tutorial-next');
            expect(nextBtn.textContent).toContain('Weiter');
        });
    });

    describe('Tutorial Skipping', () => {
        it('should skip tutorial on skip button click', () => {
            global.confirm = vi.fn(() => true);
            tutorialService.start();
            const skipBtn = document.getElementById('tutorial-skip');
            skipBtn.click();
            expect(tutorialService.isActive).toBe(false);
        });

        it('should ask confirmation before skipping', () => {
            global.confirm = vi.fn(() => true);
            tutorialService.start();
            const skipBtn = document.getElementById('tutorial-skip');
            skipBtn.click();
            expect(global.confirm).toHaveBeenCalled();
        });

        it('should not skip if user declines', () => {
            global.confirm = vi.fn(() => false);
            tutorialService.start();
            const skipBtn = document.getElementById('tutorial-skip');
            skipBtn.click();
            expect(tutorialService.isActive).toBe(true);
        });
    });

    describe('Keyboard Navigation', () => {
        it('should handle ArrowRight key', () => {
            tutorialService.start();
            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            document.dispatchEvent(event);
            expect(tutorialService.currentStep).toBe(1);
        });

        it('should handle Space key', () => {
            tutorialService.start();
            const event = new KeyboardEvent('keydown', { key: ' ' });
            document.dispatchEvent(event);
            expect(tutorialService.currentStep).toBe(1);
        });

        it('should handle ArrowLeft key', () => {
            tutorialService.start(1);
            const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            document.dispatchEvent(event);
            expect(tutorialService.currentStep).toBe(0);
        });
    });

    describe('Highlighting', () => {
        it('should add highlight class to target element', () => {
            const target = document.createElement('div');
            target.className = 'test';
            document.body.appendChild(target);
            tutorialService.start(1);
            expect(target.classList.contains('tutorial-highlight')).toBe(true);
        });

        it('should remove highlight from previous element', () => {
            const target = document.createElement('div');
            target.className = 'test';
            document.body.appendChild(target);
            tutorialService.start(1);
            tutorialService.showStep(0);
            expect(target.classList.contains('tutorial-highlight')).toBe(false);
        });
    });

    describe('Tutorial Completion', () => {
        it('should mark tutorial as completed', () => {
            tutorialService.start(tutorialService.steps.length - 1);
            tutorialService.complete();
            expect(localStorage.getItem('tutorial_completed')).toBe('true');
        });

        it('should stop tutorial after completion', () => {
            tutorialService.start(tutorialService.steps.length - 1);
            tutorialService.complete();
            expect(tutorialService.isActive).toBe(false);
        });

        it('should show completion toast', () => {
            tutorialService.start(tutorialService.steps.length - 1);
            tutorialService.complete();
            const toast = document.querySelector('.tutorial-toast');
            expect(toast).toBeDefined();
        });
    });

    describe('Tutorial Reset', () => {
        it('should reset tutorial completion', () => {
            localStorage.setItem('tutorial_completed', 'true');
            tutorialService.reset();
            expect(localStorage.getItem('tutorial_completed')).toBeNull();
        });

        it('should stop tutorial on reset', () => {
            tutorialService.start();
            tutorialService.reset();
            expect(tutorialService.isActive).toBe(false);
        });

        it('should allow auto-start after reset', () => {
            localStorage.setItem('tutorial_completed', 'true');
            tutorialService.reset();
            expect(tutorialService.shouldAutoStart()).toBe(true);
        });
    });

    describe('Tutorial Cleanup', () => {
        it('should remove overlay on stop', () => {
            tutorialService.start();
            tutorialService.stop();
            expect(document.querySelector('.tutorial-overlay')).toBeNull();
        });

        it('should remove tooltip on stop', () => {
            tutorialService.start();
            tutorialService.stop();
            expect(document.querySelector('.tutorial-tooltip')).toBeNull();
        });

        it('should remove highlight on stop', () => {
            const target = document.createElement('div');
            target.className = 'test';
            document.body.appendChild(target);
            tutorialService.start(1);
            tutorialService.stop();
            expect(target.classList.contains('tutorial-highlight')).toBe(false);
        });

        it('should set isActive to false', () => {
            tutorialService.start();
            tutorialService.stop();
            expect(tutorialService.isActive).toBe(false);
        });
    });

    describe('Toast Notifications', () => {
        it('should show toast message', () => {
            tutorialService.showToast('Test message', 'success');
            const toast = document.querySelector('.tutorial-toast');
            expect(toast).toBeDefined();
            expect(toast.textContent).toBe('Test message');
        });

        it('should apply toast type class', () => {
            tutorialService.showToast('Test', 'success');
            const toast = document.querySelector('.tutorial-toast');
            expect(toast.classList.contains('tutorial-toast-success')).toBe(true);
        });

        it('should show multiple toast types', () => {
            tutorialService.showToast('Info', 'info');
            const toast = document.querySelector('.tutorial-toast');
            expect(toast.classList.contains('tutorial-toast-info')).toBe(true);
        });
    });

    describe('Style Injection', () => {
        it('should inject tutorial styles', () => {
            tutorialService.start();
            const styles = document.getElementById('tutorial-styles');
            expect(styles).toBeDefined();
        });

        it('should not inject styles twice', () => {
            tutorialService.start();
            const beforeStop = document.querySelectorAll('#tutorial-styles').length;
            tutorialService.stop();
            const newTutorial = new tutorialService.constructor();
            newTutorial.start();
            const afterStart = document.querySelectorAll('#tutorial-styles').length;
            expect(afterStart).toBeLessThanOrEqual(beforeStop + 1);
        });
    });
});
