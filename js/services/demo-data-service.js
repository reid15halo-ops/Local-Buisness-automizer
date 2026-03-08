/* ============================================
   Demo Data Service
   Provides rich initial state for the FreyAI Visions application
   ============================================ */

class DemoDataService {
    getDemoData() {
        const now = new Date();
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
        const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

        return {
            anfragen: [
                {
                    id: 'ANF-DEMO-001',
                    kunde: { name: 'Webagentur Digital First', email: 'info@digital-first.de', telefon: '0151-123456' },
                    leistungsart: 'ki-integration',
                    beschreibung: 'KI-Chatbot Integration für Kundenservice-Portal. GPT-basiert mit FAQ-Training.',
                    budget: 4500,
                    termin: '2026-02-10',
                    status: 'neu',
                    createdAt: twoDaysAgo
                },
                {
                    id: 'ANF-DEMO-002',
                    kunde: { name: 'Steuerberater Müller & Partner', email: 'office@mueller-partner.de', telefon: '0231-998877' },
                    leistungsart: 'crm-setup',
                    beschreibung: 'CRM Setup + Schulung für 8 Mitarbeiter. Migration bestehender Excel-Daten.',
                    budget: 3200,
                    termin: '2026-01-20',
                    status: 'neu',
                    createdAt: now.toISOString()
                },
                {
                    id: 'ANF-DEMO-003',
                    kunde: { name: 'Zahnarztpraxis Dr. Weber', email: 'praxis@dr-weber.de', telefon: '0170-554433' },
                    leistungsart: 'automatisierung',
                    beschreibung: 'Prozessautomatisierung Terminverwaltung + automatische Erinnerungen per SMS/Email.',
                    budget: 2800,
                    termin: '2026-03-01',
                    status: 'neu',
                    createdAt: fiveDaysAgo
                },
                {
                    id: 'ANF-DEMO-004',
                    kunde: { name: 'Bäckerei Goldkruste', email: 'info@baeckerei-goldkruste.de', telefon: '069-123000' },
                    leistungsart: 'website',
                    beschreibung: 'Website-Relaunch + SEO-Optimierung. Bestellsystem für Vorbestellungen integrieren.',
                    budget: 5500,
                    termin: '2026-02-15',
                    status: 'neu',
                    createdAt: twoDaysAgo
                },
                {
                    id: 'ANF-DEMO-005',
                    kunde: { name: 'Autohaus Schmidt', email: 'service@autohaus-schmidt.de', telefon: '089-445566' },
                    leistungsart: 'email-marketing',
                    beschreibung: 'Email-Marketing Automation: Newsletter-System, Lead-Nurturing, Kundensegmentierung.',
                    budget: 1800,
                    termin: '2026-01-25',
                    status: 'neu',
                    createdAt: tenDaysAgo
                }
            ],
            angebote: [
                {
                    id: 'ANG-DEMO-101',
                    anfrageId: 'ANF-DEMO-001',
                    kunde: { name: 'Webagentur Digital First', email: 'info@digital-first.de' },
                    leistungsart: 'ki-integration',
                    positionen: [
                        { beschreibung: 'KI-Chatbot Entwicklung + Training', menge: 1, einheit: 'Pauschal', preis: 2800 },
                        { beschreibung: 'FAQ-Datenaufbereitung', menge: 8, einheit: 'Std.', preis: 95 },
                        { beschreibung: 'Integration + Deployment', menge: 1, einheit: 'Pauschal', preis: 650 }
                    ],
                    netto: 4210,
                    mwst: 799.90,
                    brutto: 5009.90,
                    status: 'offen',
                    createdAt: twoDaysAgo
                },
                {
                    id: 'ANG-DEMO-102',
                    anfrageId: 'ANF-DEMO-003',
                    kunde: { name: 'Zahnarztpraxis Dr. Weber', email: 'praxis@dr-weber.de' },
                    leistungsart: 'automatisierung',
                    positionen: [
                        { beschreibung: 'Prozessautomatisierung Terminverwaltung', menge: 1, einheit: 'Pauschal', preis: 1800 },
                        { beschreibung: 'SMS/Email-Erinnerungssystem Setup', menge: 1, einheit: 'Pauschal', preis: 950 }
                    ],
                    netto: 2750,
                    mwst: 522.50,
                    brutto: 3272.50,
                    status: 'offen',
                    createdAt: fiveDaysAgo
                }
            ],
            auftraege: [
                {
                    id: 'AUF-DEMO-201',
                    angebotId: 'ANG-DEMO-101',
                    kunde: { name: 'Webagentur Digital First', email: 'info@digital-first.de', telefon: '0151-123456' },
                    leistungsart: 'ki-integration',
                    angebotsWert: 4210, netto: 4210, mwst: 799.90,
                    status: 'in_bearbeitung',
                    fortschritt: 60,
                    mitarbeiter: ['Jonas G.'],
                    checkliste: [
                        { text: 'Anforderungsanalyse abgeschlossen', erledigt: true },
                        { text: 'FAQ-Daten aufbereitet', erledigt: true },
                        { text: 'Chatbot trainieren + testen', erledigt: false },
                        { text: 'Go-Live + Monitoring', erledigt: false }
                    ],
                    historie: [
                        { aktion: 'status', datum: '2026-02-20T08:00:00Z', details: 'Geplant → In Bearbeitung' },
                        { aktion: 'status', datum: '2026-02-22T10:00:00Z', details: 'Daten-Aufbereitung gestartet' }
                    ],
                    startDatum: '2026-02-19', endDatum: '2026-03-05',
                    createdAt: tenDaysAgo,
                    letzterStatusWechsel: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).getTime()
                },
                {
                    id: 'AUF-DEMO-202',
                    kunde: { name: 'Steuerberater Müller & Partner', email: 'office@mueller-partner.de', telefon: '0231-998877' },
                    leistungsart: 'crm-setup',
                    angebotsWert: 3200, netto: 3200, mwst: 608,
                    status: 'geplant',
                    fortschritt: 0,
                    mitarbeiter: [],
                    checkliste: [
                        { text: 'Kick-Off-Termin vereinbaren', erledigt: false },
                        { text: 'Excel-Daten analysieren', erledigt: false },
                        { text: 'CRM konfigurieren + Datenmigration', erledigt: false }
                    ],
                    historie: [],
                    startDatum: '2026-03-03', endDatum: '2026-03-07',
                    createdAt: fiveDaysAgo,
                    letzterStatusWechsel: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).getTime()
                },
                {
                    id: 'AUF-DEMO-203',
                    angebotId: 'ANG-DEMO-102',
                    kunde: { name: 'Zahnarztpraxis Dr. Weber', email: 'praxis@dr-weber.de', telefon: '0170-554433' },
                    leistungsart: 'automatisierung',
                    angebotsWert: 2750, netto: 2750, mwst: 522.50,
                    status: 'material_bestellt',
                    fortschritt: 25,
                    mitarbeiter: ['Jonas G.'],
                    checkliste: [
                        { text: 'Prozessanalyse abgeschlossen', erledigt: true },
                        { text: 'SMS-Provider Account erstellt', erledigt: true },
                        { text: 'Automatisierung implementieren', erledigt: false },
                        { text: 'Testlauf mit Praxis-Team', erledigt: false },
                        { text: 'Go-Live + Schulung', erledigt: false }
                    ],
                    historie: [
                        { aktion: 'status', datum: '2026-02-25T09:00:00Z', details: 'Geplant → In Vorbereitung' }
                    ],
                    startDatum: '2026-02-24', endDatum: '2026-03-14',
                    createdAt: fiveDaysAgo,
                    letzterStatusWechsel: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).getTime()
                },
                {
                    id: 'AUF-DEMO-204',
                    kunde: { name: 'Bäckerei Goldkruste', email: 'info@baeckerei-goldkruste.de', telefon: '069-123000' },
                    leistungsart: 'website',
                    angebotsWert: 5500, netto: 5500, mwst: 1045,
                    status: 'abnahme',
                    fortschritt: 90,
                    mitarbeiter: ['Jonas G.'],
                    checkliste: [
                        { text: 'Design + Layout fertig', erledigt: true },
                        { text: 'Bestellsystem implementiert', erledigt: true },
                        { text: 'Kunden-Abnahme + Feedback', erledigt: false }
                    ],
                    historie: [
                        { aktion: 'status', datum: '2026-02-18T08:00:00Z', details: 'Geplant → In Bearbeitung' },
                        { aktion: 'status', datum: '2026-02-23T16:00:00Z', details: 'In Bearbeitung → Review' },
                        { aktion: 'status', datum: '2026-02-26T10:00:00Z', details: 'Review → Abnahme' }
                    ],
                    startDatum: '2026-02-18', endDatum: '2026-02-28',
                    createdAt: tenDaysAgo,
                    letzterStatusWechsel: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).getTime()
                },
                {
                    id: 'AUF-DEMO-205',
                    kunde: { name: 'Autohaus Schmidt', email: 'service@autohaus-schmidt.de', telefon: '089-445566' },
                    leistungsart: 'email-marketing',
                    angebotsWert: 1800, netto: 1800, mwst: 342,
                    status: 'abgeschlossen',
                    fortschritt: 100,
                    mitarbeiter: ['Jonas G.'],
                    checkliste: [
                        { text: 'Newsletter-Template erstellt', erledigt: true },
                        { text: 'Kundenlisten segmentiert', erledigt: true },
                        { text: 'Automations-Flows eingerichtet', erledigt: true },
                        { text: 'Schulung durchgeführt', erledigt: true }
                    ],
                    historie: [
                        { aktion: 'status', datum: '2026-02-10T08:00:00Z', details: 'Geplant → In Bearbeitung' },
                        { aktion: 'status', datum: '2026-02-14T15:00:00Z', details: 'In Bearbeitung → Review' },
                        { aktion: 'status', datum: '2026-02-15T09:00:00Z', details: 'Review → Abnahme' },
                        { aktion: 'status', datum: '2026-02-15T14:00:00Z', details: 'Abnahme → Abgeschlossen' }
                    ],
                    startDatum: '2026-02-10', endDatum: '2026-02-15',
                    completedAt: '2026-02-15T14:00:00Z',
                    createdAt: tenDaysAgo,
                    letzterStatusWechsel: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).getTime()
                },
                {
                    id: 'AUF-DEMO-206',
                    kunde: { name: 'Steuerberater Müller & Partner', email: 'office@mueller-partner.de', telefon: '0231-998877' },
                    leistungsart: 'crm-setup',
                    angebotsWert: 1900, netto: 1900, mwst: 361,
                    status: 'qualitaetskontrolle',
                    fortschritt: 80,
                    mitarbeiter: ['Jonas G.'],
                    checkliste: [
                        { text: 'CRM-System konfiguriert', erledigt: true },
                        { text: 'Daten migriert', erledigt: true },
                        { text: 'Abschlusstest + Dokumentation', erledigt: false }
                    ],
                    historie: [
                        { aktion: 'status', datum: '2026-02-24T08:00:00Z', details: 'Geplant → In Bearbeitung' },
                        { aktion: 'status', datum: '2026-02-27T16:00:00Z', details: 'In Bearbeitung → Qualitätskontrolle' }
                    ],
                    startDatum: '2026-02-24', endDatum: '2026-03-01',
                    createdAt: fiveDaysAgo,
                    letzterStatusWechsel: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).getTime()
                }
            ],
            rechnungen: [
                {
                    id: 'RE-DEMO-301',
                    kunde: { name: 'Autohaus Schmidt' },
                    positionen: [
                        { beschreibung: 'Email-Marketing Automation Setup', menge: 1, einheit: 'Pauschal', preis: 1500 },
                        { beschreibung: 'Schulung Marketing-Team (2 Std.)', menge: 2, einheit: 'Std.', preis: 150 }
                    ],
                    netto: 1800.00,
                    mwst: 342.00,
                    brutto: 2142.00,
                    status: 'offen',
                    createdAt: fiveDaysAgo
                },
                {
                    id: 'RE-DEMO-302',
                    kunde: { name: 'Bäckerei Goldkruste' },
                    positionen: [
                        { beschreibung: 'Website-Relaunch inkl. SEO', menge: 1, einheit: 'Pauschal', preis: 4200 },
                        { beschreibung: 'Bestellsystem-Integration', menge: 1, einheit: 'Pauschal', preis: 1300 }
                    ],
                    netto: 5500.00,
                    mwst: 1045.00,
                    brutto: 6545.00,
                    status: 'bezahlt',
                    paidAt: twoDaysAgo,
                    createdAt: tenDaysAgo
                }
            ],
            activities: [
                { icon: '💰', title: 'Zahlung für RE-DEMO-302 erhalten (Bäckerei Goldkruste)', time: twoDaysAgo },
                { icon: '📥', title: 'Neue Anfrage: Steuerberater Müller & Partner', time: now.toISOString() },
                { icon: '📝', title: 'Angebot ANG-DEMO-101 erstellt (KI-Chatbot)', time: twoDaysAgo },
                { icon: '✅', title: 'Auftrag AUF-DEMO-202 bestätigt (CRM Setup)', time: fiveDaysAgo },
                { icon: '💰', title: 'Rechnung RE-DEMO-301 erstellt (Email-Marketing)', time: fiveDaysAgo },
                { icon: '📥', title: 'Anfrage von Autohaus Schmidt empfangen', time: tenDaysAgo },
                { icon: '⚙️', title: 'System-Initialisierung abgeschlossen', time: tenDaysAgo }
            ],
            settings: {
                companyName: 'Demo Firma GmbH',
                owner: 'Max Demo',
                address: 'Musterstraße 1, 12345 Musterstadt',
                taxId: '00/000/00000',
                vatId: 'DE000000000',
                phone: '+49 000 0000000',
                email: 'info@demo-firma.de',
                theme: 'dark'
            }
        };
    }
}

window.demoDataService = new DemoDataService();
