/**
 * Test-Seed: Erstellt realistische Testdaten für einen End-to-End Test.
 *
 * Ausführen: In der Browser-Konsole auf http://localhost:58919 einfügen
 * ODER: <script src="test-seed.js"></script> temporär in index.html einbinden
 *
 * Testszenario:
 * 1. Firmendaten (Admin-Settings) werden gesetzt
 * 2. Ein Kunde wird angelegt
 * 3. Eine Anfrage → Angebot → Auftrag → Rechnung Kette wird erstellt
 * 4. Eine zweite Rechnung (offen, überfällig) wird erstellt
 *
 * Danach testen:
 * - PDF-Download (Rechnung + Angebot)
 * - XRechnung XML Export
 * - ZUGFeRD PDF Export
 */

(async function seedTestData() {
    console.log('🌱 Starte Test-Seed...');

    // 1. Admin/Firmendaten setzen
    const adminSettings = {
        company_name: 'Müller & Söhne Elektrotechnik GmbH',
        owner_name: 'Hans Müller',
        address_street: 'Industriestraße 42',
        address_postal: '70173',
        address_city: 'Stuttgart',
        company_phone: '+49 711 123456',
        company_email: 'info@mueller-elektro.de',
        tax_number: '99/123/45678',
        vat_id: 'DE123456789',
        bank_name: 'Volksbank Stuttgart',
        bank_iban: 'DE89 3704 0044 0532 0130 00',
        bank_bic: 'COBADEFFXXX'
    };
    localStorage.setItem('freyai_admin_settings', JSON.stringify(adminSettings));
    console.log('✅ Admin-Settings gesetzt');

    // 2. E-Rechnung Settings sync
    if (window.eInvoiceService) {
        window.eInvoiceService.syncFromSettings();
        console.log('✅ E-Rechnung Settings synchronisiert');
    }

    // 3. Store laden / referenzieren
    const store = window.storeService?.state || window.store;
    if (!store) {
        console.error('❌ Store nicht gefunden! Ist die App geladen?');
        return;
    }

    // Kunde 1
    const kunde1 = {
        id: 'KD-TEST-001',
        name: 'Max Mustermann',
        firma: 'Mustermann GmbH',
        strasse: 'Musterweg 7',
        plz: '80331',
        ort: 'München',
        email: 'max@mustermann.de',
        telefon: '+49 89 9876543',
        ustId: 'DE987654321',
        createdAt: new Date('2026-01-15').toISOString()
    };

    // Kunde 2
    const kunde2 = {
        id: 'KD-TEST-002',
        name: 'Sabine Schmidt',
        firma: 'Schmidt & Partner KG',
        strasse: 'Hauptstraße 12',
        plz: '10115',
        ort: 'Berlin',
        email: 'schmidt@partner-kg.de',
        telefon: '+49 30 5551234',
        createdAt: new Date('2026-02-01').toISOString()
    };

    // Positionen für Rechnung 1 (komplett, mit verschiedenen Preisen)
    const positionen1 = [
        {
            beschreibung: 'Elektroinstallation Büroräume EG',
            menge: 8,
            einheit: 'Std.',
            preis: 85.00,
            isMaterial: false
        },
        {
            beschreibung: 'Kabelverlegung CAT7',
            menge: 120,
            einheit: 'm',
            preis: 3.50,
            isMaterial: false
        },
        {
            beschreibung: 'Netzwerkdose UP Cat6a',
            name: 'Netzwerkdose',
            menge: 12,
            einheit: 'Stk.',
            preis: 24.90,
            isMaterial: true,
            artikelnummer: 'NWD-C6A-001'
        },
        {
            beschreibung: 'Sicherungsautomat B16A',
            name: 'Sicherung B16A',
            menge: 6,
            einheit: 'Stk.',
            preis: 8.50,
            isMaterial: true,
            artikelnummer: 'SIA-B16-002'
        }
    ];

    const netto1 = positionen1.reduce((sum, p) => sum + (p.menge * p.preis), 0);
    const mwst1 = netto1 * 0.19;
    const brutto1 = netto1 + mwst1;

    // Positionen für Rechnung 2 (einfacher)
    const positionen2 = [
        {
            beschreibung: 'Wartung & Prüfung Elektroanlage',
            menge: 4,
            einheit: 'Std.',
            preis: 95.00,
            isMaterial: false
        },
        {
            beschreibung: 'Prüfprotokoll nach DIN VDE',
            menge: 1,
            einheit: 'pauschal',
            preis: 120.00,
            isMaterial: false
        }
    ];

    const netto2 = positionen2.reduce((sum, p) => sum + (p.menge * p.preis), 0);
    const mwst2 = netto2 * 0.19;
    const brutto2 = netto2 + mwst2;

    // Positionen für Angebot
    const positionenAngebot = [
        {
            beschreibung: 'Planung & Projektierung Smart-Home Steuerung',
            menge: 16,
            einheit: 'Std.',
            preis: 95.00,
            isMaterial: false
        },
        {
            beschreibung: 'KNX Aktor 8-fach',
            menge: 4,
            einheit: 'Stk.',
            preis: 189.00,
            isMaterial: true
        },
        {
            beschreibung: 'KNX Taster 4-fach mit Display',
            menge: 8,
            einheit: 'Stk.',
            preis: 145.00,
            isMaterial: true
        }
    ];

    const nettoAngebot = positionenAngebot.reduce((sum, p) => sum + (p.menge * p.preis), 0);
    const mwstAngebot = nettoAngebot * 0.19;
    const bruttoAngebot = nettoAngebot + mwstAngebot;

    // Anfrage
    const anfrage = {
        id: 'ANF-2026-001',
        kunde: kunde1,
        beschreibung: 'Komplette Elektroinstallation für Büroräume im EG inkl. Netzwerk',
        leistungsart: 'installation',
        status: 'angebot_erstellt',
        createdAt: new Date('2026-02-01').toISOString()
    };

    // Angebot (verknüpft mit Anfrage)
    const angebot = {
        id: 'ANG-2026-001',
        anfrageId: 'ANF-2026-001',
        kunde: kunde1,
        positionen: positionenAngebot,
        leistungsart: 'installation',
        netto: nettoAngebot,
        mwst: mwstAngebot,
        brutto: bruttoAngebot,
        text: 'Angebot für die Planung und Installation einer KNX Smart-Home Steuerung.\nInklusive Programmierung und Einweisung.',
        gueltigBis: new Date('2026-03-15').toISOString(),
        status: 'angenommen',
        createdAt: new Date('2026-02-03').toISOString()
    };

    // Auftrag (verknüpft mit Angebot)
    const auftrag = {
        id: 'AUF-2026-001',
        angebotId: 'ANG-2026-001',
        kunde: kunde1,
        beschreibung: 'Elektroinstallation Büro EG',
        leistungsart: 'installation',
        status: 'abgeschlossen',
        createdAt: new Date('2026-02-05').toISOString()
    };

    // Rechnung 1 — bezahlt (verknüpft mit Auftrag)
    const rechnung1 = {
        id: 'RE-2026-001',
        auftragId: 'AUF-2026-001',
        kunde: kunde1,
        positionen: positionen1,
        leistungsart: 'installation',
        netto: netto1,
        mwst: mwst1,
        brutto: brutto1,
        status: 'bezahlt',
        paidAt: new Date('2026-02-18').toISOString(),
        createdAt: new Date('2026-02-10').toISOString(),
        datum: '2026-02-10',
        faelligkeitsdatum: new Date('2026-02-24').toISOString()
    };

    // Rechnung 2 — offen/überfällig
    const rechnung2 = {
        id: 'RE-2026-002',
        kunde: kunde2,
        positionen: positionen2,
        leistungsart: 'wartung',
        netto: netto2,
        mwst: mwst2,
        brutto: brutto2,
        status: 'offen',
        createdAt: new Date('2026-02-05').toISOString(),
        datum: '2026-02-05',
        faelligkeitsdatum: new Date('2026-02-19').toISOString() // überfällig!
    };

    // In Store einfügen
    if (!store.anfragen) store.anfragen = [];
    if (!store.angebote) store.angebote = [];
    if (!store.auftraege) store.auftraege = [];
    if (!store.rechnungen) store.rechnungen = [];

    // Duplikate vermeiden
    const pushIfNew = (arr, item) => {
        if (!arr.find(x => x.id === item.id)) arr.push(item);
    };

    pushIfNew(store.anfragen, anfrage);
    pushIfNew(store.angebote, angebot);
    pushIfNew(store.auftraege, auftrag);
    pushIfNew(store.rechnungen, rechnung1);
    pushIfNew(store.rechnungen, rechnung2);

    // Store speichern
    if (window.storeService?.save) {
        await window.storeService.save();
    } else if (window.saveStore) {
        window.saveStore();
    }

    console.log('✅ Testdaten erstellt:');
    console.log('   📥 1 Anfrage (ANF-2026-001)');
    console.log('   📝 1 Angebot (ANG-2026-001) — Smart-Home KNX');
    console.log('   🔧 1 Auftrag (AUF-2026-001)');
    console.log(`   💰 Rechnung RE-2026-001 — bezahlt — ${brutto1.toFixed(2)} €`);
    console.log(`   💰 Rechnung RE-2026-002 — überfällig — ${brutto2.toFixed(2)} €`);
    console.log('');
    console.log('🧪 Jetzt testen:');
    console.log('   1. Rechnungen → PDF-Button klicken');
    console.log('   2. Rechnungen → XRechnung-Button klicken');
    console.log('   3. Rechnungen → ZUGFeRD-Button klicken');
    console.log('   4. Angebote → ANG-2026-001 öffnen → PDF exportieren');
    console.log('');
    console.log('🔄 UI aktualisieren...');

    // UI neu rendern
    if (window.renderRechnungen) window.renderRechnungen();
    if (window.RechnungenModule?.renderRechnungen) window.RechnungenModule.renderRechnungen();
    if (window.renderAngebote) window.renderAngebote();
    if (window.DashboardModule?.updateDashboard) window.DashboardModule.updateDashboard();

    console.log('✅ Fertig! Gehe zu Rechnungen oder Angebote.');
})();
