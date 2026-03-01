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
                    kunde: { name: 'Bauunternehmen Müller', email: 'mueller@bau-mueller.de', telefon: '0151-123456' },
                    leistungsart: 'metallbau',
                    beschreibung: 'Edelstahlgeländer für 3 Balkone, ca. 15 lfm, satiniert.',
                    budget: 4500,
                    termin: '2026-02-10',
                    status: 'neu',
                    createdAt: twoDaysAgo
                },
                {
                    id: 'ANF-DEMO-002',
                    kunde: { name: 'Getränke Logistik West', email: 'service@glw.de', telefon: '0231-998877' },
                    leistungsart: 'hydraulik',
                    beschreibung: 'Defekter Hubzylinder an Laderampe 4. Ölverlust an der Kolbenstange.',
                    budget: 800,
                    termin: '2026-01-20',
                    status: 'neu',
                    createdAt: now.toISOString()
                },
                {
                    id: 'ANF-DEMO-003',
                    kunde: { name: 'Privatkunde Schmidt', email: 'h.schmidt@web.de', telefon: '0170-554433' },
                    leistungsart: 'metallbau',
                    beschreibung: 'Hoftor (2-flügelig) verzinkt und pulverbeschichtet (RAL 7016).',
                    budget: 3200,
                    termin: '2026-03-01',
                    status: 'neu',
                    createdAt: fiveDaysAgo
                },
                {
                    id: 'ANF-DEMO-004',
                    kunde: { name: 'Industrie Instandhaltung GmbH', email: 'info@ii-gmbh.net', telefon: '069-123000' },
                    leistungsart: 'rohrleitungsbau',
                    beschreibung: 'Druckluftleitung in neuer Werkshalle verlegen (Ermeto/Edelstahl).',
                    budget: 12000,
                    termin: '2026-02-15',
                    status: 'neu',
                    createdAt: twoDaysAgo
                },
                {
                    id: 'ANF-DEMO-005',
                    kunde: { name: 'Logistikzentrum Süd', email: 'wartung@lz-sued.com', telefon: '089-445566' },
                    leistungsart: 'reparatur',
                    beschreibung: 'Sicherheitsprüfung (UVV) an 5 Hebebühnen.',
                    budget: 1500,
                    termin: '2026-01-25',
                    status: 'neu',
                    createdAt: tenDaysAgo
                }
            ],
            angebote: [
                {
                    id: 'ANG-DEMO-101',
                    anfrageId: 'ANF-DEMO-001',
                    kunde: { name: 'Bauunternehmen Müller', email: 'mueller@bau-mueller.de' },
                    leistungsart: 'metallbau',
                    positionen: [
                        { beschreibung: 'Geländerpfosten Edelstahl', menge: 12, einheit: 'Stk.', preis: 125 },
                        { beschreibung: 'Handlauf Edelstahl Ø42mm', menge: 15, einheit: 'lfm', preis: 45 },
                        { beschreibung: 'Montage Kleinmaterial', menge: 1, einheit: 'Paush.', preis: 350 }
                    ],
                    netto: 2525,
                    mwst: 479.75,
                    brutto: 3004.75,
                    status: 'offen',
                    createdAt: twoDaysAgo
                },
                {
                    id: 'ANG-DEMO-102',
                    anfrageId: 'ANF-DEMO-003',
                    kunde: { name: 'Privatkunde Schmidt', email: 'h.schmidt@web.de' },
                    leistungsart: 'metallbau',
                    positionen: [
                        { beschreibung: 'Doppelflügel-Tor Set complete', menge: 1, einheit: 'Set', preis: 2800 },
                        { beschreibung: 'Elektrischer Antrieb inkl. Funk', menge: 1, einheit: 'Set', preis: 1200 }
                    ],
                    netto: 4000,
                    mwst: 760,
                    brutto: 4760,
                    status: 'offen',
                    createdAt: fiveDaysAgo
                }
            ],
            auftraege: [
                {
                    id: 'AUF-DEMO-201',
                    angebotId: 'ANG-DEMO-101',
                    kunde: { name: 'Auto-Service Weber', email: 'weber@autoservice.de', telefon: '06021-554433' },
                    leistungsart: 'reparatur',
                    angebotsWert: 1250, netto: 1250, mwst: 237.50,
                    status: 'in_bearbeitung',
                    fortschritt: 60,
                    mitarbeiter: ['Jonas G.'],
                    checkliste: [
                        { text: 'Diagnose durchgeführt', erledigt: true },
                        { text: 'Ersatzteile bestellt', erledigt: true },
                        { text: 'Reparatur durchführen', erledigt: false },
                        { text: 'Funktionstest', erledigt: false }
                    ],
                    historie: [
                        { aktion: 'status', datum: '2026-02-20T08:00:00Z', details: 'Geplant → Material bestellt' },
                        { aktion: 'status', datum: '2026-02-22T10:00:00Z', details: 'Material bestellt → In Bearbeitung' }
                    ],
                    startDatum: '2026-02-19', endDatum: '2026-03-05',
                    createdAt: tenDaysAgo,
                    letzterStatusWechsel: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).getTime()
                },
                {
                    id: 'AUF-DEMO-202',
                    kunde: { name: 'Stadtwerke Musterstadt', email: 'technik@stadtwerke-ms.de', telefon: '06022-887766' },
                    leistungsart: 'hydraulik',
                    angebotsWert: 850, netto: 850, mwst: 161.50,
                    status: 'geplant',
                    fortschritt: 0,
                    mitarbeiter: [],
                    checkliste: [
                        { text: 'Vor-Ort-Termin vereinbaren', erledigt: false },
                        { text: 'Hydrauliköl beschaffen', erledigt: false },
                        { text: 'Dichtungen prüfen', erledigt: false }
                    ],
                    historie: [],
                    startDatum: '2026-03-03', endDatum: '2026-03-07',
                    createdAt: fiveDaysAgo,
                    letzterStatusWechsel: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).getTime()
                },
                {
                    id: 'AUF-DEMO-203',
                    angebotId: 'ANG-DEMO-102',
                    kunde: { name: 'Bauunternehmen Müller', email: 'mueller@bau-mueller.de', telefon: '0151-123456' },
                    leistungsart: 'metallbau',
                    angebotsWert: 4500, netto: 4500, mwst: 855,
                    status: 'material_bestellt',
                    fortschritt: 25,
                    mitarbeiter: ['Jonas G.', 'Extern: Schlosser Braun'],
                    checkliste: [
                        { text: 'Aufmaß genommen', erledigt: true },
                        { text: 'Material bestellt (V2A Rohr)', erledigt: true },
                        { text: 'Fertigung Geländer', erledigt: false },
                        { text: 'Montage vor Ort', erledigt: false },
                        { text: 'Abnahme mit Kunde', erledigt: false }
                    ],
                    historie: [
                        { aktion: 'status', datum: '2026-02-25T09:00:00Z', details: 'Geplant → Material bestellt' }
                    ],
                    startDatum: '2026-02-24', endDatum: '2026-03-14',
                    createdAt: fiveDaysAgo,
                    letzterStatusWechsel: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).getTime()
                },
                {
                    id: 'AUF-DEMO-204',
                    kunde: { name: 'Schreinerei Holzmann', email: 'holzmann@schreinerei.de', telefon: '06028-112233' },
                    leistungsart: 'schweissen',
                    angebotsWert: 420, netto: 420, mwst: 79.80,
                    status: 'abnahme',
                    fortschritt: 90,
                    mitarbeiter: ['Jonas G.'],
                    checkliste: [
                        { text: 'Schweißarbeiten erledigt', erledigt: true },
                        { text: 'Nachbearbeitung', erledigt: true },
                        { text: 'Kunde zur Abnahme einladen', erledigt: false }
                    ],
                    historie: [
                        { aktion: 'status', datum: '2026-02-18T08:00:00Z', details: 'Geplant → In Bearbeitung' },
                        { aktion: 'status', datum: '2026-02-23T16:00:00Z', details: 'In Bearbeitung → Qualitätskontrolle' },
                        { aktion: 'status', datum: '2026-02-26T10:00:00Z', details: 'Qualitätskontrolle → Abnahme' }
                    ],
                    startDatum: '2026-02-18', endDatum: '2026-02-28',
                    createdAt: tenDaysAgo,
                    letzterStatusWechsel: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).getTime()
                },
                {
                    id: 'AUF-DEMO-205',
                    kunde: { name: 'Spedition Schnell', email: 'technik@spedition-schnell.de', telefon: '0171-445566' },
                    leistungsart: 'hydraulik',
                    angebotsWert: 1335, netto: 1335, mwst: 253.65,
                    status: 'abgeschlossen',
                    fortschritt: 100,
                    mitarbeiter: ['Jonas G.'],
                    checkliste: [
                        { text: 'Ladebordwand demontiert', erledigt: true },
                        { text: 'Hydraulikzylinder getauscht', erledigt: true },
                        { text: 'System entlüftet', erledigt: true },
                        { text: 'Funktionstest bestanden', erledigt: true }
                    ],
                    historie: [
                        { aktion: 'status', datum: '2026-02-10T08:00:00Z', details: 'Geplant → In Bearbeitung' },
                        { aktion: 'status', datum: '2026-02-14T15:00:00Z', details: 'In Bearbeitung → Qualitätskontrolle' },
                        { aktion: 'status', datum: '2026-02-15T09:00:00Z', details: 'Qualitätskontrolle → Abnahme' },
                        { aktion: 'status', datum: '2026-02-15T14:00:00Z', details: 'Abnahme → Abgeschlossen' }
                    ],
                    startDatum: '2026-02-10', endDatum: '2026-02-15',
                    completedAt: '2026-02-15T14:00:00Z',
                    createdAt: tenDaysAgo,
                    letzterStatusWechsel: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).getTime()
                },
                {
                    id: 'AUF-DEMO-206',
                    kunde: { name: 'Getränke Logistik West', email: 'service@glw.de', telefon: '0231-998877' },
                    leistungsart: 'hydraulik',
                    angebotsWert: 780, netto: 780, mwst: 148.20,
                    status: 'qualitaetskontrolle',
                    fortschritt: 80,
                    mitarbeiter: ['Jonas G.'],
                    checkliste: [
                        { text: 'Hubzylinder ausgebaut', erledigt: true },
                        { text: 'Dichtung ersetzt', erledigt: true },
                        { text: 'Drucktest durchführen', erledigt: false }
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
                    kunde: { name: 'Spedition Schnell' },
                    positionen: [
                        { beschreibung: 'Hydraulik-Instandsetzung LKW-Ladebordwand', menge: 1, einheit: 'Pauschal', preis: 1250 },
                        { beschreibung: 'Anfahrtspauschale Zone 2', menge: 1, einheit: 'Stk.', preis: 85 }
                    ],
                    netto: 1335.00,
                    mwst: 253.65,
                    brutto: 1588.65,
                    status: 'offen',
                    createdAt: fiveDaysAgo
                },
                {
                    id: 'RE-DEMO-302',
                    kunde: { name: 'Schreinerei Holzmann' },
                    positionen: [
                        { beschreibung: 'Schweißarbeiten Gestell Buche-Trockner', menge: 4, einheit: 'Std.', preis: 65 },
                        { beschreibung: 'Materialzulage S235JR', menge: 1, einheit: 'Pauschal', preis: 160 }
                    ],
                    netto: 420.00,
                    mwst: 79.80,
                    brutto: 499.80,
                    status: 'bezahlt',
                    paidAt: twoDaysAgo,
                    createdAt: tenDaysAgo
                }
            ],
            activities: [
                { icon: '💰', title: 'Zahlung für RE-DEMO-302 erhalten', time: twoDaysAgo },
                { icon: '📥', title: 'Neue Anfrage: Getränke Logistik West', time: now.toISOString() },
                { icon: '📝', title: 'Angebot ANG-DEMO-101 erstellt', time: twoDaysAgo },
                { icon: '✅', title: 'Auftrag AUF-DEMO-202 bestätigt', time: fiveDaysAgo },
                { icon: '💰', title: 'Rechnung RE-DEMO-301 erstellt', time: fiveDaysAgo },
                { icon: '📥', title: 'Anfrage von Logistikzentrum Süd empfangen', time: tenDaysAgo },
                { icon: '⚙️', title: 'System-Initialisierung abgeschlossen', time: tenDaysAgo }
            ],
            settings: {
                companyName: 'FreyAI Visions',
                owner: 'Max Mustermann',
                address: 'Handwerkerring 38a, 63776 Mömbris',
                taxId: '12/345/67890',
                vatId: 'DE123456789',
                phone: '+49 6029 9922964',
                email: 'info@freyai-visions.de',
                theme: 'dark'
            }
        };
    }
}

window.demoDataService = new DemoDataService();
