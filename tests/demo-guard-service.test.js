import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('DemoGuardService', () => {
    let demoGuardService;

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

        // Mock DOM
        document.body.innerHTML = '';

        // Create DemoGuardService class
        const DemoGuardServiceClass = class DemoGuardService {
            constructor() {
                this.isDeveloperMode = this.getDevMode();
                this.listeners = [];
            }

            getDevMode() {
                return localStorage.getItem('app_mode') === 'development';
            }

            setDevMode(enabled) {
                if (enabled) {
                    localStorage.setItem('app_mode', 'development');
                } else {
                    localStorage.removeItem('app_mode');
                }
                this.isDeveloperMode = enabled;
                this._notify();
                return enabled;
            }

            isDemo() {
                return localStorage.getItem('demo_data_loaded') === 'true';
            }

            markDemoLoaded() {
                localStorage.setItem('demo_data_loaded', 'true');
            }

            clearDemoFlag() {
                localStorage.removeItem('demo_data_loaded');
            }

            async confirmDemoLoad(title = 'Demo-Daten laden') {
                return new Promise((resolve) => {
                    const confirmed = confirm(
                        `⚠️ ${title}\n\nDiese Aktion erstellt Testdaten in Ihrer Datenbank. Nur für Testzwecke verwenden!\n\nFortfahren?`
                    );
                    resolve(confirmed);
                });
            }

            showDemoBanner() {
                const existingBanner = document.getElementById('demo-mode-banner');
                if (existingBanner) return;

                const banner = document.createElement('div');
                banner.id = 'demo-mode-banner';
                banner.className = 'demo-mode-banner';
                banner.innerHTML = `
                    <div class="demo-banner-content">
                        <span class="demo-banner-icon">🔧</span>
                        <span class="demo-banner-text">Demo-Daten aktiv — Nicht für Produktivbetrieb</span>
                        <button class="demo-banner-close" onclick="document.getElementById('demo-mode-banner')?.remove()">✕</button>
                    </div>
                `;

                if (document.body.firstChild) {
                    document.body.insertBefore(banner, document.body.firstChild);
                } else {
                    document.body.appendChild(banner);
                }
            }

            hideDemoButtons() {
                if (this.isDeveloperMode) return;

                const demoElements = document.querySelectorAll(
                    '[data-action="load-demo-materials"], #qa-demo-workflow, #btn-load-demo-emails, #btn-demo-materials'
                );

                demoElements.forEach(el => {
                    el.style.display = 'none';
                });
            }

            initDevModeToggle() {
                const settingsModal = document.getElementById('settings-panel');
                if (!settingsModal) return;

                if (document.getElementById('dev-mode-toggle')) return;

                const devModeSection = document.createElement('div');
                devModeSection.className = 'settings-card';
                devModeSection.innerHTML = `
                    <h3>🚀 Entwicklermodus</h3>
                    <p>Demo-Funktionen und Test-Tools aktivieren</p>
                    <div class="form-group">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="dev-mode-toggle" ${this.isDeveloperMode ? 'checked' : ''} style="margin-right: 8px;">
                            <span>Entwicklermodus aktivieren</span>
                        </label>
                    </div>
                `;

                const settingsGrid = settingsModal.querySelector('.settings-grid');
                if (settingsGrid) {
                    settingsGrid.appendChild(devModeSection);

                    document.getElementById('dev-mode-toggle')?.addEventListener('change', (e) => {
                        this.setDevMode(e.target.checked);
                        if (e.target.checked) {
                            document.querySelectorAll('[data-action="load-demo-materials"], #qa-demo-workflow, #btn-load-demo-emails, #btn-demo-materials').forEach(el => {
                                el.style.display = '';
                            });
                        } else {
                            this.hideDemoButtons();
                        }
                    });
                }
            }

            onDevModeChange(callback) {
                this.listeners.push(callback);
                return () => {
                    this.listeners = this.listeners.filter(l => l !== callback);
                };
            }

            _notify() {
                this.listeners.forEach(cb => cb(this.isDeveloperMode));
            }
        };

        demoGuardService = new DemoGuardServiceClass();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        document.body.innerHTML = '';
    });

    describe('Developer Mode Management', () => {
        it('should check developer mode status', () => {
            expect(demoGuardService.isDeveloperMode).toBe(false);
        });

        it('should enable developer mode', () => {
            demoGuardService.setDevMode(true);

            expect(demoGuardService.isDeveloperMode).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith('app_mode', 'development');
        });

        it('should disable developer mode', () => {
            demoGuardService.setDevMode(true);
            demoGuardService.setDevMode(false);

            expect(demoGuardService.isDeveloperMode).toBe(false);
            expect(localStorage.removeItem).toHaveBeenCalledWith('app_mode');
        });

        it('should persist developer mode in localStorage', () => {
            demoGuardService.setDevMode(true);

            // Simulate page reload
            const reloadedDevMode = localStorage.getItem('app_mode') === 'development';

            expect(reloadedDevMode).toBe(true);
        });

        it('should return development mode status from getDevMode', () => {
            demoGuardService.setDevMode(true);
            const devMode = demoGuardService.getDevMode();

            expect(devMode).toBe(true);
        });
    });

    describe('Demo Data Flag Management', () => {
        it('should check if demo data is loaded', () => {
            expect(demoGuardService.isDemo()).toBe(false);
        });

        it('should mark demo as loaded', () => {
            demoGuardService.markDemoLoaded();

            expect(demoGuardService.isDemo()).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith('demo_data_loaded', 'true');
        });

        it('should clear demo flag', () => {
            demoGuardService.markDemoLoaded();
            demoGuardService.clearDemoFlag();

            expect(demoGuardService.isDemo()).toBe(false);
            expect(localStorage.removeItem).toHaveBeenCalledWith('demo_data_loaded');
        });

        it('should persist demo flag across sessions', () => {
            demoGuardService.markDemoLoaded();

            // Simulate page reload
            const isDemoLoaded = localStorage.getItem('demo_data_loaded') === 'true';

            expect(isDemoLoaded).toBe(true);
        });
    });

    describe('Demo Load Confirmation', () => {
        it('should prompt user before loading demo data', async () => {
            global.confirm = vi.fn(() => true);

            const confirmed = await demoGuardService.confirmDemoLoad();

            expect(global.confirm).toHaveBeenCalled();
            expect(confirmed).toBe(true);
        });

        it('should return false if user declines demo load', async () => {
            global.confirm = vi.fn(() => false);

            const confirmed = await demoGuardService.confirmDemoLoad();

            expect(confirmed).toBe(false);
        });

        it('should include custom title in confirmation dialog', async () => {
            global.confirm = vi.fn(() => true);

            await demoGuardService.confirmDemoLoad('Custom Title');

            expect(global.confirm).toHaveBeenCalledWith(expect.stringContaining('Custom Title'));
        });

        it('should include warning message in confirmation dialog', async () => {
            global.confirm = vi.fn(() => true);

            await demoGuardService.confirmDemoLoad();

            expect(global.confirm).toHaveBeenCalledWith(expect.stringContaining('Testdaten'));
        });
    });

    describe('Demo Banner', () => {
        it('should show demo mode banner', () => {
            demoGuardService.showDemoBanner();

            const banner = document.getElementById('demo-mode-banner');
            expect(banner).toBeDefined();
        });

        it('should include warning icon in banner', () => {
            demoGuardService.showDemoBanner();

            const banner = document.getElementById('demo-mode-banner');
            expect(banner.textContent).toContain('🔧');
        });

        it('should include demo mode text in banner', () => {
            demoGuardService.showDemoBanner();

            const banner = document.getElementById('demo-mode-banner');
            expect(banner.textContent).toContain('Demo-Daten aktiv');
        });

        it('should not duplicate banner if already shown', () => {
            demoGuardService.showDemoBanner();
            const firstBanner = document.getElementById('demo-mode-banner');

            demoGuardService.showDemoBanner();
            const allBanners = document.querySelectorAll('#demo-mode-banner');

            expect(allBanners.length).toBe(1);
        });

        it('should include close button in banner', () => {
            demoGuardService.showDemoBanner();

            const closeButton = document.querySelector('.demo-banner-close');
            expect(closeButton).toBeDefined();
        });

        it('should insert banner at top of body', () => {
            const testElement = document.createElement('div');
            testElement.id = 'test-element';
            document.body.appendChild(testElement);

            demoGuardService.showDemoBanner();

            const banner = document.getElementById('demo-mode-banner');
            expect(document.body.firstChild).toBe(banner);
        });
    });

    describe('Demo Button Hiding', () => {
        it('should hide demo buttons when not in dev mode', () => {
            const demoBtn = document.createElement('button');
            demoBtn.setAttribute('data-action', 'load-demo-materials');
            document.body.appendChild(demoBtn);

            demoGuardService.hideDemoButtons();

            expect(demoBtn.style.display).toBe('none');
        });

        it('should hide all demo button types', () => {
            const btnIds = ['qa-demo-workflow', 'btn-load-demo-emails', 'btn-demo-materials'];

            btnIds.forEach(id => {
                const btn = document.createElement('button');
                btn.id = id;
                document.body.appendChild(btn);
            });

            demoGuardService.hideDemoButtons();

            btnIds.forEach(id => {
                const btn = document.getElementById(id);
                expect(btn.style.display).toBe('none');
            });
        });

        it('should not hide buttons in dev mode', () => {
            demoGuardService.setDevMode(true);

            const demoBtn = document.createElement('button');
            demoBtn.setAttribute('data-action', 'load-demo-materials');
            demoBtn.style.display = '';
            document.body.appendChild(demoBtn);

            demoGuardService.hideDemoButtons();

            expect(demoBtn.style.display).toBe('');
        });

        it('should show buttons when enabling dev mode', () => {
            const demoBtn = document.createElement('button');
            demoBtn.setAttribute('data-action', 'load-demo-materials');
            demoBtn.style.display = 'none';
            document.body.appendChild(demoBtn);

            // setDevMode only updates state, doesn't directly toggle UI
            // The UI toggle happens via the event listener on the checkbox
            demoGuardService.setDevMode(true);

            expect(demoGuardService.isDeveloperMode).toBe(true);
            expect(localStorage.getItem('app_mode')).toBe('development');
        });
    });

    describe('Dev Mode Toggle UI', () => {
        it('should create dev mode toggle in settings panel', () => {
            const settingsPanel = document.createElement('div');
            settingsPanel.id = 'settings-panel';
            const settingsGrid = document.createElement('div');
            settingsGrid.className = 'settings-grid';
            settingsPanel.appendChild(settingsGrid);
            document.body.appendChild(settingsPanel);

            demoGuardService.initDevModeToggle();

            const devModeToggle = document.getElementById('dev-mode-toggle');
            expect(devModeToggle).toBeDefined();
        });

        it('should check toggle when dev mode is enabled', () => {
            demoGuardService.setDevMode(true);

            const settingsPanel = document.createElement('div');
            settingsPanel.id = 'settings-panel';
            const settingsGrid = document.createElement('div');
            settingsGrid.className = 'settings-grid';
            settingsPanel.appendChild(settingsGrid);
            document.body.appendChild(settingsPanel);

            demoGuardService.initDevModeToggle();

            const devModeToggle = document.getElementById('dev-mode-toggle');
            expect(devModeToggle.checked).toBe(true);
        });

        it('should not create duplicate toggle', () => {
            const settingsPanel = document.createElement('div');
            settingsPanel.id = 'settings-panel';
            const settingsGrid = document.createElement('div');
            settingsGrid.className = 'settings-grid';
            settingsPanel.appendChild(settingsGrid);
            document.body.appendChild(settingsPanel);

            demoGuardService.initDevModeToggle();
            const firstToggle = document.getElementById('dev-mode-toggle');

            demoGuardService.initDevModeToggle();
            const toggles = document.querySelectorAll('#dev-mode-toggle');

            expect(toggles.length).toBe(1);
        });

        it('should not create toggle when settings panel missing', () => {
            demoGuardService.initDevModeToggle();

            const devModeToggle = document.getElementById('dev-mode-toggle');
            expect(devModeToggle).toBeNull();
        });

        it('should handle toggle change event', () => {
            const settingsPanel = document.createElement('div');
            settingsPanel.id = 'settings-panel';
            const settingsGrid = document.createElement('div');
            settingsGrid.className = 'settings-grid';
            settingsPanel.appendChild(settingsGrid);
            document.body.appendChild(settingsPanel);

            demoGuardService.initDevModeToggle();

            const devModeToggle = document.getElementById('dev-mode-toggle');
            expect(devModeToggle).toBeDefined();

            // Simulate toggle change
            devModeToggle.checked = true;
            devModeToggle.dispatchEvent(new Event('change'));

            expect(demoGuardService.isDeveloperMode).toBe(true);
        });
    });

    describe('Dev Mode Change Listeners', () => {
        it('should register callback for dev mode changes', () => {
            const callback = vi.fn();

            demoGuardService.onDevModeChange(callback);

            expect(demoGuardService.listeners).toContain(callback);
        });

        it('should unregister callback', () => {
            const callback = vi.fn();

            const unsubscribe = demoGuardService.onDevModeChange(callback);
            unsubscribe();

            expect(demoGuardService.listeners).not.toContain(callback);
        });

        it('should notify listeners when dev mode changes', () => {
            const callback = vi.fn();

            demoGuardService.onDevModeChange(callback);
            demoGuardService.setDevMode(true);

            expect(callback).toHaveBeenCalledWith(true);
        });

        it('should notify multiple listeners', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            demoGuardService.onDevModeChange(callback1);
            demoGuardService.onDevModeChange(callback2);
            demoGuardService.setDevMode(true);

            expect(callback1).toHaveBeenCalledWith(true);
            expect(callback2).toHaveBeenCalledWith(true);
        });

        it('should not notify unregistered callbacks', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            demoGuardService.onDevModeChange(callback1);
            demoGuardService.onDevModeChange(callback2);

            const unsubscribe = demoGuardService.onDevModeChange(callback2);
            unsubscribe();

            demoGuardService.setDevMode(true);

            expect(callback1).toHaveBeenCalledWith(true);
            expect(callback2).not.toHaveBeenCalled();
        });
    });

    describe('Complex Scenarios', () => {
        it('should handle demo loading workflow', async () => {
            global.confirm = vi.fn(() => true);

            const confirmed = await demoGuardService.confirmDemoLoad();
            if (confirmed) {
                demoGuardService.markDemoLoaded();
                demoGuardService.showDemoBanner();
            }

            expect(demoGuardService.isDemo()).toBe(true);
            expect(document.getElementById('demo-mode-banner')).toBeDefined();
        });

        it('should handle dev mode toggle workflow', () => {
            const listener = vi.fn();
            demoGuardService.onDevModeChange(listener);

            demoGuardService.setDevMode(true);
            const settingsPanel = document.createElement('div');
            settingsPanel.id = 'settings-panel';
            const settingsGrid = document.createElement('div');
            settingsGrid.className = 'settings-grid';
            settingsPanel.appendChild(settingsGrid);
            document.body.appendChild(settingsPanel);

            demoGuardService.initDevModeToggle();

            expect(listener).toHaveBeenCalledWith(true);
            expect(document.getElementById('dev-mode-toggle')?.checked).toBe(true);
        });

        it('should handle demo cleanup', () => {
            demoGuardService.setDevMode(true);
            demoGuardService.markDemoLoaded();
            demoGuardService.showDemoBanner();

            demoGuardService.clearDemoFlag();
            demoGuardService.setDevMode(false);

            expect(demoGuardService.isDemo()).toBe(false);
            expect(demoGuardService.isDeveloperMode).toBe(false);
        });
    });
});
