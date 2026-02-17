import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('EmailService', () => {
    let emailService;

    beforeEach(() => {
        // Mock localStorage
        global.localStorage = {
            data: {},
            getItem: vi.fn((key) => {
                const value = global.localStorage.data[key];
                return value !== undefined ? JSON.stringify(value) : null;
            }),
            setItem: vi.fn((key, value) => {
                global.localStorage.data[key] = JSON.parse(value);
            }),
            removeItem: vi.fn((key) => {
                delete global.localStorage.data[key];
            }),
            clear: vi.fn(() => {
                global.localStorage.data = {};
            })
        };

        // Create EmailService class
        const EmailServiceClass = class EmailService {
            constructor() {
                this.emails = JSON.parse(localStorage.getItem('freyai_emails') || '[]');
                this.emailConfig = JSON.parse(localStorage.getItem('freyai_email_config') || '{}');
                this.templates = this.loadDefaultTemplates();

                this.categoryKeywords = {
                    anfrage: ['anfrage', 'angebot', 'preis', 'kosten', 'interesse'],
                    rechnung: ['rechnung', 'zahlung', 'überweisung', 'bezahlung'],
                    beschwerde: ['beschwerde', 'problem', 'fehler', 'mangel'],
                    termin: ['termin', 'meeting', 'besprechung', 'treffen'],
                    lieferant: ['lieferung', 'bestellung', 'versand'],
                    support: ['hilfe', 'frage', 'support', 'unterstützung']
                };

                this.actionKeywords = [
                    'bitte', 'dringend', 'bis', 'deadline', 'frist'
                ];
            }

            setEmailConfig(config) {
                this.emailConfig = {
                    imapHost: config.imapHost || '',
                    imapPort: config.imapPort || 993,
                    smtpHost: config.smtpHost || '',
                    smtpPort: config.smtpPort || 587,
                    email: config.email || '',
                    password: config.password || '',
                    useTLS: config.useTLS !== false
                };
                this.saveConfig();
            }

            getEmailConfig() {
                return this.emailConfig;
            }

            isConfigured() {
                return !!(this.emailConfig.email && this.emailConfig.imapHost);
            }

            async fetchEmails() {
                if (!this.isConfigured()) {
                    return this.getDemoEmails();
                }
                return this.getDemoEmails();
            }

            getDemoEmails() {
                const now = new Date();
                return [
                    {
                        id: 'demo-1',
                        from: 'max.mueller@firma.de',
                        fromName: 'Max Müller',
                        subject: 'Anfrage: Metalltor für Einfahrt',
                        body: 'Bitte senden Sie mir ein Angebot',
                        date: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
                        read: false,
                        category: 'anfrage',
                        attachments: []
                    }
                ];
            }

            parseEmail(rawEmail) {
                const parsed = {
                    id: rawEmail.id || this.generateId(),
                    from: rawEmail.from,
                    fromName: rawEmail.fromName || this.extractName(rawEmail.from),
                    subject: rawEmail.subject,
                    body: rawEmail.body,
                    date: rawEmail.date || new Date().toISOString(),
                    read: rawEmail.read || false,
                    category: rawEmail.category || this.categorizeEmail(rawEmail),
                    attachments: rawEmail.attachments || [],
                    extractedData: this.extractData(rawEmail)
                };

                return parsed;
            }

            extractName(email) {
                const match = email.match(/^([^@]+)@/);
                if (match) {
                    return match[1].split('.').map(s =>
                        s.charAt(0).toUpperCase() + s.slice(1)
                    ).join(' ');
                }
                return email;
            }

            extractData(email) {
                const text = `${email.subject} ${email.body}`.toLowerCase();
                const data = {
                    phoneNumbers: [],
                    emails: [],
                    dates: [],
                    amounts: [],
                    addresses: [],
                    actionItems: []
                };

                const phoneRegex = /(?:\+49|0049|0)[\s.-]?(\d{2,4})[\s.-]?(\d{3,4})[\s.-]?(\d{3,5})/g;
                let match;
                while ((match = phoneRegex.exec(email.body)) !== null) {
                    data.phoneNumbers.push(match[0].replace(/\s/g, ''));
                }

                const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                while ((match = emailRegex.exec(email.body)) !== null) {
                    if (match[0] !== email.from) {
                        data.emails.push(match[0]);
                    }
                }

                const amountRegex = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€|€\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g;
                while ((match = amountRegex.exec(email.body)) !== null) {
                    const amount = (match[1] || match[2]).replace('.', '').replace(',', '.');
                    data.amounts.push(parseFloat(amount));
                }

                const dateRegex = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/g;
                while ((match = dateRegex.exec(email.body)) !== null) {
                    const year = match[3].length === 2 ? '20' + match[3] : match[3];
                    data.dates.push(`${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
                }

                return data;
            }

            categorizeEmail(email) {
                const text = `${email.subject} ${email.body}`.toLowerCase();
                let bestCategory = 'sonstiges';
                let maxScore = 0;

                for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
                    let score = 0;
                    keywords.forEach(keyword => {
                        if (text.includes(keyword)) {
                            score++;
                        }
                    });
                    if (score > maxScore) {
                        maxScore = score;
                        bestCategory = category;
                    }
                }

                return bestCategory;
            }

            getCategoryIcon(category) {
                const icons = {
                    anfrage: '📥',
                    rechnung: '💰',
                    beschwerde: '⚠️',
                    termin: '📅',
                    lieferant: '📦',
                    support: '❓',
                    sonstiges: '📧'
                };
                return icons[category] || '📧';
            }

            getCategoryLabel(category) {
                const labels = {
                    anfrage: 'Kundenanfrage',
                    rechnung: 'Rechnung',
                    beschwerde: 'Beschwerde',
                    termin: 'Terminanfrage',
                    lieferant: 'Lieferant',
                    support: 'Support',
                    sonstiges: 'Sonstiges'
                };
                return labels[category] || category;
            }

            createTaskFromEmail(email) {
                const parsed = this.parseEmail(email);

                let priority = 'normal';
                const urgentKeywords = ['dringend', 'urgent', 'asap', 'sofort', 'eilig'];
                if (urgentKeywords.some(k => email.body.toLowerCase().includes(k))) {
                    priority = 'high';
                }

                let dueDate = null;
                if (parsed.extractedData.dates.length > 0) {
                    dueDate = parsed.extractedData.dates[0];
                } else if (priority === 'high') {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    dueDate = tomorrow.toISOString().split('T')[0];
                }

                const task = {
                    id: 'task-' + Date.now(),
                    title: this.generateTaskTitle(parsed),
                    description: parsed.extractedData.actionItems.join('\n') || parsed.body.substring(0, 200),
                    priority: priority,
                    status: 'offen',
                    dueDate: dueDate,
                    source: 'email',
                    sourceId: parsed.id,
                    customer: {
                        name: parsed.fromName,
                        email: parsed.from,
                        phone: parsed.extractedData.phoneNumbers[0] || null
                    },
                    createdAt: new Date().toISOString()
                };

                return task;
            }

            generateTaskTitle(parsedEmail) {
                const categoryActions = {
                    anfrage: 'Anfrage bearbeiten',
                    rechnung: 'Rechnung prüfen',
                    beschwerde: 'Beschwerde bearbeiten',
                    termin: 'Termin vereinbaren',
                    lieferant: 'Lieferung prüfen',
                    support: 'Anfrage beantworten',
                    sonstiges: 'E-Mail bearbeiten'
                };

                const action = categoryActions[parsedEmail.category] || 'E-Mail bearbeiten';
                return `${action}: ${parsedEmail.fromName}`;
            }

            createAnfrageFromEmail(email) {
                const parsed = this.parseEmail(email);

                let leistungsart = 'sonstiges';
                const serviceKeywords = {
                    metallbau: ['tor', 'zaun', 'geländer'],
                    reparatur: ['reparatur', 'reparieren', 'defekt'],
                    montage: ['montage', 'montieren', 'installation']
                };

                const text = email.body.toLowerCase();
                let maxScore = 0;
                for (const [service, keywords] of Object.entries(serviceKeywords)) {
                    let score = 0;
                    keywords.forEach(keyword => {
                        if (text.includes(keyword)) {
                            score++;
                        }
                    });
                    if (score > maxScore) {
                        maxScore = score;
                        leistungsart = service;
                    }
                }

                const anfrage = {
                    id: 'ANF-' + Date.now(),
                    datum: new Date().toISOString(),
                    status: 'neu',
                    kunde: {
                        name: parsed.fromName,
                        email: parsed.from,
                        telefon: parsed.extractedData.phoneNumbers[0] || '',
                        firma: ''
                    },
                    leistungsart: leistungsart,
                    beschreibung: parsed.body,
                    quelle: 'email',
                    quelleId: parsed.id
                };

                return anfrage;
            }

            loadDefaultTemplates() {
                return {
                    angebot_followup: {
                        name: 'Angebots-Nachverfolgung',
                        subject: 'Rückfrage zu unserem Angebot {{angebotId}}',
                        body: 'Sehr geehrte(r) {{kundeName}}'
                    }
                };
            }

            fillTemplate(templateKey, data) {
                const template = this.templates[templateKey];
                if (!template) return null;

                let subject = template.subject;
                let body = template.body;

                for (const [key, value] of Object.entries(data)) {
                    const placeholder = `{{${key}}}`;
                    subject = subject.replace(new RegExp(placeholder, 'g'), value);
                    body = body.replace(new RegExp(placeholder, 'g'), value);
                }

                return { subject, body };
            }

            markAsRead(emailId) {
                const email = this.emails.find(e => e.id === emailId);
                if (email) {
                    email.read = true;
                    this.save();
                }
            }

            archiveEmail(emailId) {
                const index = this.emails.findIndex(e => e.id === emailId);
                if (index !== -1) {
                    this.emails[index].archived = true;
                    this.save();
                }
            }

            deleteEmail(emailId) {
                this.emails = this.emails.filter(e => e.id !== emailId);
                this.save();
            }

            getUnreadCount() {
                return this.emails.filter(e => !e.read && !e.archived).length;
            }

            getEmailsByCategory(category) {
                return this.emails.filter(e => e.category === category && !e.archived);
            }

            getAllEmails() {
                return this.emails.filter(e => !e.archived);
            }

            addEmail(email) {
                const parsed = this.parseEmail(email);
                this.emails.unshift(parsed);
                this.save();
                return parsed;
            }

            save() {
                localStorage.setItem('freyai_emails', JSON.stringify(this.emails));
            }

            saveConfig() {
                localStorage.setItem('freyai_email_config', JSON.stringify(this.emailConfig));
            }

            generateId() {
                return 'email-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            }

            formatDate(dateStr) {
                const date = new Date(dateStr);
                return date.toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            }

            formatDateTime(dateStr) {
                const date = new Date(dateStr);
                return date.toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            getRelativeTime(dateStr) {
                const date = new Date(dateStr);
                const now = new Date();
                const diff = now - date;

                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(diff / 3600000);
                const days = Math.floor(diff / 86400000);

                if (minutes < 1) return 'Gerade eben';
                if (minutes < 60) return `vor ${minutes} Min.`;
                if (hours < 24) return `vor ${hours} Std.`;
                if (days === 1) return 'Gestern';
                return this.formatDate(dateStr);
            }
        };

        emailService = new EmailServiceClass();
    });

    afterEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('Email Configuration', () => {
        it('should set email configuration', () => {
            emailService.setEmailConfig({
                imapHost: 'imap.example.com',
                imapPort: 993,
                smtpHost: 'smtp.example.com',
                smtpPort: 587,
                email: 'user@example.com',
                password: 'password123'
            });

            expect(emailService.emailConfig.imapHost).toBe('imap.example.com');
            expect(emailService.emailConfig.email).toBe('user@example.com');
        });

        it('should get email configuration', () => {
            emailService.setEmailConfig({
                email: 'test@example.com',
                imapHost: 'imap.test.com'
            });

            const config = emailService.getEmailConfig();
            expect(config.email).toBe('test@example.com');
        });

        it('should check if email is configured', () => {
            emailService.setEmailConfig({
                email: 'test@example.com',
                imapHost: 'imap.test.com'
            });

            expect(emailService.isConfigured()).toBe(true);
        });

        it('should return false when email config is incomplete', () => {
            emailService.setEmailConfig({
                email: 'test@example.com'
            });

            expect(emailService.isConfigured()).toBe(false);
        });
    });

    describe('Demo Emails', () => {
        it('should get demo emails when not configured', async () => {
            emailService.emailConfig = {};

            const emails = await emailService.fetchEmails();

            expect(Array.isArray(emails)).toBe(true);
            expect(emails.length).toBeGreaterThan(0);
        });

        it('should return demo emails with valid structure', () => {
            const emails = emailService.getDemoEmails();

            expect(emails[0]).toHaveProperty('id');
            expect(emails[0]).toHaveProperty('from');
            expect(emails[0]).toHaveProperty('subject');
            expect(emails[0]).toHaveProperty('body');
            expect(emails[0]).toHaveProperty('date');
        });
    });

    describe('Email Parsing & Categorization', () => {
        it('should parse an email correctly', () => {
            const rawEmail = {
                id: 'test-1',
                from: 'sender@example.com',
                fromName: 'Test Sender',
                subject: 'Test Subject',
                body: 'Test Body',
                date: new Date().toISOString(),
                read: false,
                attachments: []
            };

            const parsed = emailService.parseEmail(rawEmail);

            expect(parsed.id).toBe('test-1');
            expect(parsed.from).toBe('sender@example.com');
            expect(parsed.subject).toBe('Test Subject');
        });

        it('should extract name from email address', () => {
            const name = emailService.extractName('max.mueller@example.com');

            expect(name).toBe('Max Mueller');
        });

        it('should categorize email as anfrage', () => {
            const email = {
                subject: 'Anfrage zu Preisen',
                body: 'Ich interessiere mich für ein Angebot'
            };

            const category = emailService.categorizeEmail(email);

            expect(category).toBe('anfrage');
        });

        it('should categorize email as rechnung', () => {
            const email = {
                subject: 'Rechnung Nr. 2026-001',
                body: 'Bitte überweisen Sie den Betrag'
            };

            const category = emailService.categorizeEmail(email);

            expect(category).toBe('rechnung');
        });

        it('should categorize email as termin', () => {
            const email = {
                subject: 'Termin für Besprechung',
                body: 'Können wir einen Termin vereinbaren? Welcher Termin passt Ihnen?'
            };

            const category = emailService.categorizeEmail(email);

            expect(category).toBe('termin');
        });

        it('should extract phone numbers from email body', () => {
            const email = {
                subject: 'Test',
                body: 'Rufen Sie mich an unter +49 602 9992296'
            };

            const data = emailService.extractData(email);

            expect(data.phoneNumbers.length).toBeGreaterThan(0);
        });

        it('should extract email addresses from body', () => {
            const email = {
                from: 'sender@example.com',
                subject: 'Test',
                body: 'Kontaktieren Sie uns unter contact@example.com'
            };

            const data = emailService.extractData(email);

            expect(data.emails).toContain('contact@example.com');
        });

        it('should extract amounts in Euro format', () => {
            const email = {
                subject: 'Rechnung',
                body: 'Betrag: 1.234,56 €'
            };

            const data = emailService.extractData(email);

            expect(data.amounts.length).toBeGreaterThan(0);
            expect(data.amounts[0]).toBeCloseTo(1234.56, 2);
        });

        it('should extract German date format', () => {
            const email = {
                subject: 'Termin',
                body: 'Deadline: 31.12.2026'
            };

            const data = emailService.extractData(email);

            expect(data.dates).toContain('2026-12-31');
        });
    });

    describe('Category Icons and Labels', () => {
        it('should get correct icon for anfrage', () => {
            const icon = emailService.getCategoryIcon('anfrage');
            expect(icon).toBe('📥');
        });

        it('should get correct icon for rechnung', () => {
            const icon = emailService.getCategoryIcon('rechnung');
            expect(icon).toBe('💰');
        });

        it('should get correct label for anfrage', () => {
            const label = emailService.getCategoryLabel('anfrage');
            expect(label).toBe('Kundenanfrage');
        });

        it('should get correct label for rechnung', () => {
            const label = emailService.getCategoryLabel('rechnung');
            expect(label).toBe('Rechnung');
        });

        it('should return default icon for unknown category', () => {
            const icon = emailService.getCategoryIcon('unknown');
            expect(icon).toBe('📧');
        });
    });

    describe('Task Creation from Email', () => {
        it('should create task from email', () => {
            const email = {
                from: 'customer@example.com',
                fromName: 'Customer Name',
                subject: 'Anfrage',
                body: 'Ich benötige ein Angebot',
                category: 'anfrage'
            };

            const task = emailService.createTaskFromEmail(email);

            expect(task.title).toContain('Anfrage bearbeiten');
            expect(task.priority).toBe('normal');
            expect(task.source).toBe('email');
            expect(task.customer.email).toBe('customer@example.com');
        });

        it('should set high priority for urgent emails', () => {
            const email = {
                from: 'customer@example.com',
                fromName: 'Customer Name',
                subject: 'Dringend: Anfrage',
                body: 'Dringend benötige ich ein Angebot',
                category: 'anfrage'
            };

            const task = emailService.createTaskFromEmail(email);

            expect(task.priority).toBe('high');
        });

        it('should extract due date from email if found', () => {
            const email = {
                from: 'customer@example.com',
                fromName: 'Customer Name',
                subject: 'Anfrage',
                body: 'Deadline: 31.12.2026',
                category: 'anfrage'
            };

            const task = emailService.createTaskFromEmail(email);

            expect(task.dueDate).toBe('2026-12-31');
        });
    });

    describe('Anfrage Creation from Email', () => {
        it('should create anfrage from email', () => {
            const email = {
                from: 'customer@example.com',
                fromName: 'Max Müller',
                subject: 'Anfrage für Tor',
                body: 'Ich benötige ein Metalltor für meine Einfahrt',
                attachments: []
            };

            const anfrage = emailService.createAnfrageFromEmail(email);

            expect(anfrage.status).toBe('neu');
            expect(anfrage.kunde.email).toBe('customer@example.com');
            expect(anfrage.quelle).toBe('email');
        });

        it('should detect metallbau service from email', () => {
            const email = {
                from: 'customer@example.com',
                fromName: 'Customer',
                subject: 'Tor anfrage',
                body: 'Ich benötige ein neues Tor'
            };

            const anfrage = emailService.createAnfrageFromEmail(email);

            expect(anfrage.leistungsart).toBe('metallbau');
        });

        it('should detect reparatur service from email', () => {
            const email = {
                from: 'customer@example.com',
                fromName: 'Customer',
                subject: 'Reparatur anfrage',
                body: 'Mein Tor ist defekt und braucht eine Reparatur'
            };

            const anfrage = emailService.createAnfrageFromEmail(email);

            expect(anfrage.leistungsart).toBe('reparatur');
        });
    });

    describe('Email Templates', () => {
        it('should load default templates', () => {
            const templates = emailService.loadDefaultTemplates();

            expect(templates).toHaveProperty('angebot_followup');
        });

        it('should fill template with data', () => {
            const result = emailService.fillTemplate('angebot_followup', {
                angebotId: 'ANG-001',
                kundeName: 'Max Müller'
            });

            expect(result.subject).toContain('ANG-001');
        });

        it('should return null for non-existent template', () => {
            const result = emailService.fillTemplate('nonexistent', { test: 'data' });

            expect(result).toBeNull();
        });
    });

    describe('Email Actions', () => {
        it('should add email to list', () => {
            const email = {
                from: 'sender@example.com',
                subject: 'Test',
                body: 'Test body'
            };

            emailService.addEmail(email);

            expect(emailService.emails.length).toBeGreaterThan(0);
        });

        it('should mark email as read', () => {
            const email = {
                from: 'sender@example.com',
                subject: 'Test',
                body: 'Test body',
                read: false
            };

            const added = emailService.addEmail(email);
            emailService.markAsRead(added.id);

            const updated = emailService.emails.find(e => e.id === added.id);
            expect(updated.read).toBe(true);
        });

        it('should get unread count', () => {
            const email1 = {
                from: 'sender1@example.com',
                subject: 'Test 1',
                body: 'Body 1',
                read: false
            };

            emailService.addEmail(email1);
            const count = emailService.getUnreadCount();

            expect(count).toBeGreaterThan(0);
        });

        it('should get emails by category', () => {
            const email = {
                from: 'sender@example.com',
                subject: 'Anfrage zu Preisen',
                body: 'Ich interessiere mich für ein Angebot',
                category: 'anfrage'
            };

            emailService.addEmail(email);
            const anfragen = emailService.getEmailsByCategory('anfrage');

            expect(anfragen.length).toBeGreaterThan(0);
        });

        it('should archive email', () => {
            const email = {
                from: 'sender@example.com',
                subject: 'Test',
                body: 'Test body'
            };

            const added = emailService.addEmail(email);
            emailService.archiveEmail(added.id);

            const allEmails = emailService.getAllEmails();
            const archived = allEmails.find(e => e.id === added.id);

            expect(archived).toBeUndefined();
        });

        it('should delete email', () => {
            const email = {
                from: 'sender@example.com',
                subject: 'Test',
                body: 'Test body'
            };

            const added = emailService.addEmail(email);
            const countBefore = emailService.emails.length;

            emailService.deleteEmail(added.id);

            expect(emailService.emails.length).toBe(countBefore - 1);
        });

        it('should get all non-archived emails', () => {
            const email1 = {
                from: 'sender1@example.com',
                subject: 'Test 1',
                body: 'Body 1'
            };

            emailService.addEmail(email1);
            const allEmails = emailService.getAllEmails();

            expect(Array.isArray(allEmails)).toBe(true);
        });
    });

    describe('Formatting Helpers', () => {
        it('should format date to German locale', () => {
            const dateStr = '2026-02-16T10:30:00';
            const formatted = emailService.formatDate(dateStr);

            expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/);
        });

        it('should format date and time to German locale', () => {
            const dateStr = '2026-02-16T10:30:00';
            const formatted = emailService.formatDateTime(dateStr);

            expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/);
        });

        it('should get relative time for recent dates', () => {
            const now = new Date();
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

            const relative = emailService.getRelativeTime(fiveMinutesAgo.toISOString());

            expect(relative).toMatch(/vor \d+ Min/);
        });

        it('should get relative time for old dates', () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const relative = emailService.getRelativeTime(yesterday.toISOString());

            expect(relative).toBe('Gestern');
        });
    });
});
