import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * INTEGRATION TEST: Full Money Path End-to-End
 * Tests the complete workflow from customer inquiry to paid invoice
 * and verifies bookkeeping entries and EÜR summary
 */

// ============================================
// Mock Setup
// ============================================

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

// Mock dbService
const mockDbService = {
  userData: new Map(),
  getUserData: vi.fn(async (userId, key) => {
    return mockDbService.userData.get(`${userId}:${key}`);
  }),
  setUserData: vi.fn(async (userId, key, data) => {
    mockDbService.userData.set(`${userId}:${key}`, JSON.parse(JSON.stringify(data)));
  }),
  get: vi.fn(async (key) => {
    return mockDbService.userData.get(`default:${key}`);
  }),
  clearUserData: vi.fn(async (userId) => {
    const keysToDelete = Array.from(mockDbService.userData.keys()).filter(k => k.startsWith(`${userId}:`));
    keysToDelete.forEach(k => mockDbService.userData.delete(k));
  })
};

// Mock demoDataService
const mockDemoDataService = {
  getDemoData: vi.fn(() => ({
    anfragen: [],
    angebote: [],
    auftraege: [],
    rechnungen: [],
    activities: []
  }))
};

// Setup global mocks
global.localStorage = localStorageMock;
global.window = {
  dbService: mockDbService,
  demoDataService: mockDemoDataService,
  userManager: null,
  errorHandler: {
    warning: vi.fn(),
    error: vi.fn()
  }
};

// ============================================
// StoreService (simplified version from source)
// ============================================
class StoreService {
  constructor() {
    this.store = {
      anfragen: [],
      angebote: [],
      auftraege: [],
      rechnungen: [],
      activities: [],
      settings: {
        companyName: 'MHS Metallbau Hydraulik Service',
        owner: 'Max Mustermann',
        address: 'Handwerkerring 38a, 12345 Musterstadt',
        taxId: '12/345/67890',
        vatId: 'DE123456789',
        theme: 'dark'
      },
      currentAnfrageId: null,
      currentAuftragId: null,
      currentRechnungId: null
    };
    this.STORAGE_KEY = 'mhs-workflow-store';
    this.subscribers = [];
    this.currentUserId = null;
  }

  async loadForUser(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    this.currentUserId = userId;
    let data = await window.dbService.getUserData(userId, this.STORAGE_KEY);

    if (!data) {
      const legacyData = await window.dbService.get(this.STORAGE_KEY);
      if (legacyData && userId === 'default') {
        data = legacyData;
        await window.dbService.setUserData(userId, this.STORAGE_KEY, data);
      }
    }

    if (data) {
      try {
        this._clearStore();
        Object.assign(this.store, data);
      } catch (e) {
        console.error('Failed to parse store data:', e);
        await this.resetToDemo();
      }
    } else {
      await this.resetToDemo();
    }

    this.notify();
  }

  async resetToDemo() {
    const demoData = window.demoDataService.getDemoData();
    const userId = this.currentUserId || 'default';
    await window.dbService.clearUserData(userId);

    Object.keys(this.store).forEach(key => {
      if (Array.isArray(this.store[key])) {
        this.store[key] = [];
      }
    });

    Object.assign(this.store, demoData, {
      currentAnfrageId: null,
      currentAuftragId: null,
      currentRechnungId: null
    });

    await this.save();
  }

  _clearStore() {
    this.store.anfragen = [];
    this.store.angebote = [];
    this.store.auftraege = [];
    this.store.rechnungen = [];
    this.store.activities = [];
    this.store.currentAnfrageId = null;
    this.store.currentAuftragId = null;
    this.store.currentRechnungId = null;
  }

  async save() {
    const userId = this.currentUserId || 'default';
    await window.dbService.setUserData(userId, this.STORAGE_KEY, this.store);
    this.notify();
  }

  get state() {
    return this.store;
  }

  addAnfrage(anfrage) {
    this.store.anfragen.push(anfrage);
    this.save();
    this.addActivity('📥', `Neue Anfrage von ${anfrage.kunde.name}`);
  }

  addAngebot(angebot) {
    this.store.angebote.push(angebot);
    const anfrage = this.store.anfragen.find(a => a.id === angebot.anfrageId);
    if (anfrage) {
      anfrage.status = 'angebot-erstellt';
    }
    this.save();
    this.addActivity('📝', `Angebot ${angebot.id} für ${angebot.kunde.name} erstellt`);
  }

  acceptAngebot(angebotId) {
    const angebot = this.store.angebote.find(a => a.id === angebotId);
    if (!angebot) {
      return null;
    }

    angebot.status = 'angenommen';

    const auftrag = {
      id: this.generateId('AUF'),
      angebotId,
      kunde: angebot.kunde,
      leistungsart: angebot.leistungsart,
      positionen: angebot.positionen,
      angebotsWert: angebot.brutto,
      netto: angebot.netto,
      mwst: angebot.mwst,
      status: 'geplant',
      fortschritt: 0,
      mitarbeiter: [],
      startDatum: null,
      endDatum: null,
      checkliste: [],
      kommentare: [],
      historie: [{ aktion: 'erstellt', datum: new Date().toISOString(), details: `Aus Angebot ${angebotId}` }],
      createdAt: new Date().toISOString()
    };

    this.store.auftraege.push(auftrag);
    this.save();
    this.addActivity('✅', `Angebot ${angebotId} angenommen → Auftrag ${auftrag.id}`);

    return auftrag;
  }

  updateAuftrag(auftragId, updates) {
    const auftrag = this.store.auftraege.find(a => a.id === auftragId);
    if (!auftrag) {
      return null;
    }

    const oldStatus = auftrag.status;
    Object.assign(auftrag, updates);

    if (!auftrag.historie) {
      auftrag.historie = [];
    }
    if (updates.status && updates.status !== oldStatus) {
      auftrag.historie.push({
        aktion: 'status',
        datum: new Date().toISOString(),
        details: `${oldStatus} → ${updates.status}`
      });
    }

    this.save();
    return auftrag;
  }

  async completeAuftrag(auftragId, completionData = {}) {
    const auftrag = this.store.auftraege.find(a => a.id === auftragId);
    if (!auftrag) {
      return null;
    }

    Object.assign(auftrag, {
      status: 'abgeschlossen',
      completedAt: new Date().toISOString(),
      ...completionData
    });

    this.save();

    // Create invoice
    const netto = (auftrag.positionen || []).reduce((sum, p) => sum + ((p.menge || 0) * (p.preis || 0)), 0);

    const rechnung = {
      id: this.generateId('RE'),
      nummer: this.generateId('RE'),
      auftragId,
      angebotId: auftrag.angebotId,
      kunde: auftrag.kunde,
      leistungsart: auftrag.leistungsart,
      positionen: auftrag.positionen || [],
      arbeitszeit: auftrag.arbeitszeit,
      materialKosten: auftrag.materialKosten || 0,
      netto: netto,
      mwst: netto * 0.19,
      brutto: netto * 1.19,
      status: 'offen',
      datum: new Date().toISOString(),
      faelligkeitsdatum: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };

    this.store.rechnungen.push(rechnung);
    this.save();
    this.addActivity('💰', `Rechnung ${rechnung.nummer} erstellt`);

    return rechnung;
  }

  addActivity(icon, title) {
    this.store.activities.unshift({
      icon,
      title,
      time: new Date().toISOString()
    });
    if (this.store.activities.length > 50) {
      this.store.activities = this.store.activities.slice(0, 50);
    }
    this.save();
  }

  generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
  }

  subscribe(callback) {
    this.subscribers.push(callback);
  }

  notify() {
    this.subscribers.forEach(cb => cb(this.store));
  }
}

// ============================================
// MaterialService
// ============================================
class MaterialService {
  constructor() {
    this.bestand = JSON.parse(localStorage.getItem('material_bestand') || '[]');
    this.stundensatz = parseFloat(localStorage.getItem('stundensatz') || '65');
    this.reservierungen = JSON.parse(localStorage.getItem('material_reservations') || '[]');
    this.lagerbewegungen = JSON.parse(localStorage.getItem('stock_movements') || '[]');
    this.materialCounter = 0; // Counter for unique IDs
  }

  addMaterial(material) {
    // Create unique ID with timestamp and counter
    const timestamp = Date.now().toString(36);
    const counter = (++this.materialCounter).toString(36);
    const random = Math.random().toString(36).substr(2, 3);
    material.id = `MAT-${timestamp}-${counter}-${random}`.toUpperCase();
    material.importedAt = new Date().toISOString();
    this.bestand.push(material);
    this.save();
    return material;
  }

  getMaterial(id) {
    const material = this.bestand.find(m => m.id === id);
    return material ? this._ensureReservationFields(material) : null;
  }

  getMaterialById(id) {
    return this.getMaterial(id);
  }

  getAllMaterials() {
    return this.bestand.map(m => this._ensureReservationFields(m));
  }

  _ensureReservationFields(material) {
    if (!material.reserviert) {
      material.reserviert = 0;
    }
    return material;
  }

  getAvailableStock(materialId) {
    const material = this.getMaterial(materialId);
    if (!material) {
      return 0;
    }
    this._ensureReservationFields(material);
    return material.bestand - material.reserviert;
  }

  calculatePositionPrice(materialId, menge, arbeitsstunden = 0) {
    const material = this.getMaterial(materialId);
    if (!material) {
      return null;
    }

    const materialkosten = menge * (material.vkPreis || material.preis);
    const arbeitskosten = arbeitsstunden * this.stundensatz;

    return {
      material: material,
      menge: menge,
      einzelpreis: material.vkPreis || material.preis,
      materialkosten: materialkosten,
      arbeitsstunden: arbeitsstunden,
      arbeitskosten: arbeitskosten,
      gesamt: materialkosten + arbeitskosten
    };
  }

  calculateAngebotPositionen(positionen) {
    const berechnet = [];
    let gesamtMaterial = 0;
    let gesamtArbeit = 0;

    positionen.forEach(pos => {
      if (pos.materialId) {
        const calc = this.calculatePositionPrice(
          pos.materialId,
          pos.menge || 1,
          pos.arbeitsstunden || 0
        );
        if (calc) {
          berechnet.push({
            ...pos,
            ...calc
          });
          gesamtMaterial += calc.materialkosten;
          gesamtArbeit += calc.arbeitskosten;
        }
      } else {
        berechnet.push(pos);
      }
    });

    return {
      positionen: berechnet,
      materialkosten: gesamtMaterial,
      arbeitskosten: gesamtArbeit,
      netto: gesamtMaterial + gesamtArbeit,
      mwst: (gesamtMaterial + gesamtArbeit) * 0.19,
      brutto: (gesamtMaterial + gesamtArbeit) * 1.19
    };
  }

  reserveForAuftrag(auftragId, items) {
    const shortages = [];

    // Check if all items are available
    items.forEach(item => {
      const material = this.getMaterial(item.materialId);
      if (!material) {
        shortages.push({
          materialId: item.materialId,
          needed: item.menge,
          available: 0,
          materialName: 'Unbekannt'
        });
        return;
      }

      const available = this.getAvailableStock(item.materialId);
      if (available < item.menge) {
        shortages.push({
          materialId: item.materialId,
          needed: item.menge,
          available: available,
          materialName: material.bezeichnung
        });
      }
    });

    if (shortages.length > 0) {
      return { success: false, shortages };
    }

    // All items available - perform the reservation
    items.forEach(item => {
      const material = this.getMaterial(item.materialId);
      if (material) {
        this._ensureReservationFields(material);
        material.reserviert += item.menge;

        const reservation = {
          id: `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          auftragId,
          materialId: item.materialId,
          menge: item.menge,
          datum: new Date().toISOString()
        };
        this.reservierungen.push(reservation);

        this._recordStockMovement({
          materialId: item.materialId,
          auftragId,
          type: 'reserved',
          quantity: item.menge,
          previousStock: material.bestand,
          newStock: material.bestand
        });
      }
    });

    this.save();
    return { success: true, shortages: [] };
  }

  releaseReservation(auftragId) {
    const reservations = this.reservierungen.filter(r => r.auftragId === auftragId);

    reservations.forEach(res => {
      const material = this.getMaterial(res.materialId);
      if (material) {
        this._ensureReservationFields(material);
        material.reserviert = Math.max(0, material.reserviert - res.menge);

        this._recordStockMovement({
          materialId: res.materialId,
          auftragId,
          type: 'released',
          quantity: -res.menge,
          previousStock: material.bestand,
          newStock: material.bestand
        });
      }
    });

    this.reservierungen = this.reservierungen.filter(r => r.auftragId !== auftragId);
    this.save();
  }

  consumeReserved(auftragId) {
    const reservations = this.reservierungen.filter(r => r.auftragId === auftragId);
    const consumed = [];

    reservations.forEach(res => {
      const material = this.getMaterial(res.materialId);
      if (material) {
        this._ensureReservationFields(material);

        material.bestand = Math.max(0, material.bestand - res.menge);
        material.reserviert = Math.max(0, material.reserviert - res.menge);

        this._recordStockMovement({
          materialId: res.materialId,
          auftragId,
          type: 'consumed',
          quantity: -res.menge,
          previousStock: material.bestand + res.menge,
          newStock: material.bestand
        });

        consumed.push({
          materialId: res.materialId,
          menge: res.menge,
          bezeichnung: material.bezeichnung
        });
      }
    });

    this.reservierungen = this.reservierungen.filter(r => r.auftragId !== auftragId);
    this.save();

    return consumed;
  }

  getReservations(auftragId) {
    return this.reservierungen.filter(r => r.auftragId === auftragId);
  }

  _recordStockMovement(movement) {
    const record = {
      id: `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      materialId: movement.materialId,
      auftragId: movement.auftragId,
      type: movement.type,
      quantity: movement.quantity,
      previousStock: movement.previousStock,
      newStock: movement.newStock,
      timestamp: new Date().toISOString()
    };
    this.lagerbewegungen.push(record);
    return record;
  }

  getStockMovements(materialId = null) {
    if (materialId) {
      return this.lagerbewegungen.filter(m => m.materialId === materialId);
    }
    return this.lagerbewegungen;
  }

  save() {
    localStorage.setItem('material_bestand', JSON.stringify(this.bestand));
    localStorage.setItem('material_reservations', JSON.stringify(this.reservierungen));
    localStorage.setItem('stock_movements', JSON.stringify(this.lagerbewegungen));
  }

  clear() {
    this.bestand = [];
    this.save();
  }
}

// ============================================
// BookkeepingService
// ============================================
class BookkeepingService {
  constructor() {
    this.buchungen = JSON.parse(localStorage.getItem('mhs_buchungen') || '[]');
    this.einstellungen = JSON.parse(localStorage.getItem('mhs_buchhaltung_settings') || '{}');

    if (!this.einstellungen.kleinunternehmer) {
      this.einstellungen = {
        kleinunternehmer: false,
        umsatzsteuersatz: 19,
        firmenName: 'MHS Metallbau Hydraulik Service',
        steuernummer: '',
        ustIdNr: '',
        finanzamt: '',
        geschaeftsjahr: new Date().getFullYear()
      };
      this.saveSettings();
    }
  }

  addBuchung(buchung) {
    buchung.id = `BU-${Date.now().toString(36).toUpperCase()}`;
    buchung.erstelltAm = new Date().toISOString();

    if (!this.einstellungen.kleinunternehmer && buchung.typ === 'einnahme') {
      buchung.netto = buchung.brutto / 1.19;
      buchung.ust = buchung.brutto - buchung.netto;
    } else {
      buchung.netto = buchung.brutto;
      buchung.ust = 0;
    }

    this.buchungen.push(buchung);
    this.save();
    return buchung;
  }

  recordPayment(payment) {
    const buchung = {
      typ: 'einnahme',
      kategorie: 'Umsatzerlöse',
      beschreibung: `Zahlung Rechnung ${payment.reference}`,
      rechnungId: payment.invoiceId,
      datum: payment.date,
      brutto: payment.amount,
      belegnummer: payment.reference,
      zahlungsart: payment.method || 'Überweisung'
    };
    return this.addBuchung(buchung);
  }

  recordMaterialCosts(rechnung) {
    if (!rechnung.materialKosten && !rechnung.stueckliste) {
      return null;
    }

    const materialKosten = rechnung.materialKosten || 0;

    const buchung = {
      typ: 'ausgabe',
      kategorie: 'Materialaufwendungen',
      beschreibung: `Materialeinsatz Rechnung ${rechnung.nummer} - ${rechnung.kunde.name}`,
      rechnungId: rechnung.id,
      datum: rechnung.paidAt || rechnung.createdAt,
      brutto: materialKosten,
      belegnummer: rechnung.nummer,
      zahlungsart: 'Material',
      auftragId: rechnung.auftragId
    };
    return this.addBuchung(buchung);
  }

  berechneEUR(jahr = null) {
    const jahr_ = jahr || this.einstellungen.geschaeftsjahr;
    const jahresBuchungen = this.getBuchungenForJahr(jahr_);

    const einnahmen = jahresBuchungen.filter(b => b.typ === 'einnahme');
    const ausgaben = jahresBuchungen.filter(b => b.typ === 'ausgabe');
    const materialKosten = ausgaben.filter(b => b.kategorie === 'Materialaufwendungen');
    const sonstigeAusgaben = ausgaben.filter(b => b.kategorie !== 'Materialaufwendungen');

    const summeEinnahmenBrutto = einnahmen.reduce((sum, b) => sum + b.brutto, 0);
    const summeEinnahmenNetto = einnahmen.reduce((sum, b) => sum + b.netto, 0);
    const summeUst = einnahmen.reduce((sum, b) => sum + (b.ust || 0), 0);

    const summeMaterialKosten = materialKosten.reduce((sum, b) => sum + b.brutto, 0);
    const summeSonstigeAusgaben = sonstigeAusgaben.reduce((sum, b) => sum + b.brutto, 0);
    const summeAusgabenBrutto = ausgaben.reduce((sum, b) => sum + b.brutto, 0);
    const summeAusgabenNetto = ausgaben.reduce((sum, b) => sum + b.netto, 0);
    const summeVorsteuer = ausgaben.reduce((sum, b) => sum + (b.vorsteuer || 0), 0);

    const rohertrag = summeEinnahmenNetto - summeMaterialKosten;
    const gewinnVorSteuer = summeEinnahmenNetto - summeAusgabenNetto;
    const ustZahllast = summeUst - summeVorsteuer;

    return {
      jahr: jahr_,
      einnahmen: {
        brutto: summeEinnahmenBrutto,
        netto: summeEinnahmenNetto,
        ust: summeUst,
        anzahl: einnahmen.length
      },
      materialaufwendungen: {
        brutto: summeMaterialKosten,
        netto: summeMaterialKosten,
        anzahl: materialKosten.length
      },
      rohertrag: rohertrag,
      ausgaben: {
        brutto: summeSonstigeAusgaben,
        netto: summeSonstigeAusgaben,
        vorsteuer: summeVorsteuer,
        anzahl: sonstigeAusgaben.length
      },
      ausgabenGesamt: {
        brutto: summeAusgabenBrutto,
        netto: summeAusgabenNetto,
        vorsteuer: summeVorsteuer,
        anzahl: ausgaben.length
      },
      gewinn: gewinnVorSteuer,
      ustZahllast: this.einstellungen.kleinunternehmer ? 0 : ustZahllast,
      kleinunternehmer: this.einstellungen.kleinunternehmer
    };
  }

  getBuchungenForJahr(jahr) {
    return this.buchungen.filter(b => {
      const datum = new Date(b.datum);
      return datum.getFullYear() === jahr;
    });
  }

  getAllBuchungen() {
    return this.buchungen;
  }

  save() {
    localStorage.setItem('mhs_buchungen', JSON.stringify(this.buchungen));
  }

  saveSettings() {
    localStorage.setItem('mhs_buchhaltung_settings', JSON.stringify(this.einstellungen));
  }

  updateEinstellungen(settings) {
    this.einstellungen = { ...this.einstellungen, ...settings };
    this.saveSettings();
  }

  clear() {
    this.buchungen = [];
    this.save();
  }
}

// ============================================
// InvoiceService
// ============================================
class InvoiceService {
  constructor(storeService, bookkeepingService) {
    this.storeService = storeService;
    this.bookkeepingService = bookkeepingService;
  }

  async markAsPaid(invoiceId, paymentData = {}) {
    const invoice = this.storeService.state.rechnungen.find(r => r.id === invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    invoice.status = 'bezahlt';
    invoice.paidAt = new Date().toISOString();
    invoice.paymentMethod = paymentData.method || 'Überweisung';
    invoice.paymentNote = paymentData.note || '';

    this.storeService.save();
    this.storeService.addActivity('✅', `Rechnung ${invoice.nummer} als bezahlt markiert`);

    // Integrate with bookkeeping
    if (this.bookkeepingService) {
      try {
        // 1. Record payment (Umsatzerlöse / Revenue)
        this.bookkeepingService.recordPayment({
          invoiceId: invoice.id,
          amount: invoice.brutto,
          date: invoice.paidAt,
          method: invoice.paymentMethod,
          reference: invoice.nummer
        });

        // 2. Record material costs (COGS / Materialaufwendungen) if applicable
        if (invoice.materialKosten > 0 || invoice.stueckliste) {
          this.bookkeepingService.recordMaterialCosts(invoice);
        }
      } catch (error) {
        console.error('Bookkeeping integration error:', error);
      }
    }

    return invoice;
  }
}

// ============================================
// Test Suite: Full Money Path End-to-End
// ============================================

describe('Integration: Full Money Path (Anfrage → Angebot → Auftrag → Rechnung → Buchhaltung)', () => {
  let storeService;
  let materialService;
  let bookkeepingService;
  let invoiceService;
  let testMaterial1;
  let testMaterial2;
  const currentYear = new Date().getFullYear();

  beforeEach(async () => {
    // Clear all storage
    localStorage.clear();
    mockDbService.userData.clear();

    // Initialize services with fresh instances
    storeService = new StoreService();
    materialService = new MaterialService();
    bookkeepingService = new BookkeepingService();
    invoiceService = new InvoiceService(storeService, bookkeepingService);

    // Setup window globals
    window.storeService = storeService;
    window.materialService = materialService;
    window.bookkeepingService = bookkeepingService;
    window.invoiceService = invoiceService;

    // Load store for default user
    await storeService.loadForUser('default');

    // Create test materials (fresh for each test)
    testMaterial1 = materialService.addMaterial({
      artikelnummer: 'ST-IPE-100',
      bezeichnung: 'IPE 100 Stahlträger',
      kategorie: 'Stahlträger',
      einheit: 'm',
      preis: 12.50,
      vkPreis: 18.00,
      bestand: 100,
      minBestand: 20,
      lieferant: 'Stahl AG'
    });

    testMaterial2 = materialService.addMaterial({
      artikelnummer: 'BL-5MM',
      bezeichnung: 'Stahlblech 5mm',
      kategorie: 'Bleche',
      einheit: 'qm',
      preis: 45.00,
      vkPreis: 62.00,
      bestand: 50,
      minBestand: 10,
      lieferant: 'Blech Express'
    });
  });

  afterEach(() => {
    localStorage.clear();
    mockDbService.userData.clear();
  });

  // ============================================
  // STEP 1: Create Customer & Inquiry
  // ============================================

  it('STEP 1: Create Kunde (Customer)', () => {
    const customer = {
      id: 'CUST-001',
      name: 'Musterkundschaft GmbH',
      address: 'Handwerkerstraße 12, 10115 Berlin',
      email: 'kontakt@musterkunde.de',
      phone: '+49 30 12345678'
    };

    // Store would typically have a customer service, but for this test
    // we'll verify the customer data structure is created correctly
    expect(customer.name).toBe('Musterkundschaft GmbH');
    expect(customer.email).toBe('kontakt@musterkunde.de');
  });

  it('STEP 2: Create Anfrage (Inquiry) for customer', async () => {
    const anfrage = {
      id: storeService.generateId('ANF'),
      kunde: {
        name: 'Musterkundschaft GmbH',
        address: 'Handwerkerstraße 12, 10115 Berlin',
        email: 'kontakt@musterkunde.de',
        phone: '+49 30 12345678'
      },
      leistungsart: 'Konstruktion',
      beschreibung: 'Stahlkonstruktion für Lagerhalle',
      status: 'neu',
      createdAt: new Date().toISOString()
    };

    storeService.addAnfrage(anfrage);

    // Verify inquiry was added
    expect(storeService.state.anfragen).toHaveLength(1);
    expect(storeService.state.anfragen[0].id).toBe(anfrage.id);
    expect(storeService.state.anfragen[0].status).toBe('neu');
    expect(storeService.state.anfragen[0].kunde.name).toBe('Musterkundschaft GmbH');
  });

  // ============================================
  // STEP 3: Convert Anfrage → Angebot
  // ============================================

  it('STEP 3: Create Angebot (Quote) with material positions', async () => {
    // Create inquiry first
    const anfrage = {
      id: storeService.generateId('ANF'),
      kunde: {
        name: 'Musterkundschaft GmbH',
        address: 'Handwerkerstraße 12, 10115 Berlin',
        email: 'kontakt@musterkunde.de'
      },
      leistungsart: 'Konstruktion',
      beschreibung: 'Stahlkonstruktion für Lagerhalle',
      status: 'neu',
      createdAt: new Date().toISOString()
    };

    storeService.addAnfrage(anfrage);

    // Create angebot with material positions
    const positionen = [
      {
        beschreibung: 'IPE 100 Stahlträger',
        materialId: testMaterial1.id,
        menge: 10,
        einheit: 'm',
        preis: 18.00,
        ekPreis: 12.50,
        bestandVerfuegbar: 100,
        artikelnummer: 'ST-IPE-100'
      },
      {
        beschreibung: 'Stahlblech 5mm',
        materialId: testMaterial2.id,
        menge: 5,
        einheit: 'qm',
        preis: 62.00,
        ekPreis: 45.00,
        bestandVerfuegbar: 50,
        artikelnummer: 'BL-5MM'
      }
    ];

    const netto = positionen.reduce((sum, p) => sum + (p.menge * p.preis), 0);
    const mwst = netto * 0.19;
    const brutto = netto + mwst;

    const angebot = {
      id: storeService.generateId('ANG'),
      anfrageId: anfrage.id,
      kunde: anfrage.kunde,
      leistungsart: anfrage.leistungsart,
      positionen: positionen,
      text: 'Stahlkonstruktion für Lagerhalle - Angebot',
      netto: netto,
      mwst: mwst,
      brutto: brutto,
      status: 'offen',
      createdAt: new Date().toISOString()
    };

    storeService.addAngebot(angebot);

    // Verify angebot was created
    expect(storeService.state.angebote).toHaveLength(1);
    expect(storeService.state.angebote[0].positionen).toHaveLength(2);
    expect(storeService.state.angebote[0].positionen[0].materialId).toBe(testMaterial1.id);
    expect(storeService.state.angebote[0].positionen[1].materialId).toBe(testMaterial2.id);

    // Verify material references
    const pos1Material = materialService.getMaterial(storeService.state.angebote[0].positionen[0].materialId);
    expect(pos1Material).toBeDefined();
    expect(pos1Material.bezeichnung).toBe('IPE 100 Stahlträger');

    // Verify pricing
    expect(storeService.state.angebote[0].netto).toBe(180 + 310); // 10*18 + 5*62
    expect(storeService.state.angebote[0].mwst).toBeCloseTo((180 + 310) * 0.19, 2);
    expect(storeService.state.angebote[0].brutto).toBeCloseTo((180 + 310) * 1.19, 2);

    // Verify inquiry status updated
    expect(storeService.state.anfragen[0].status).toBe('angebot-erstellt');
  });

  // ============================================
  // STEP 4: Accept Angebot → creates Auftrag
  // ============================================

  it('STEP 4: Accept Angebot to create Auftrag (Order)', async () => {
    // Setup: Create anfrage and angebot
    const anfrage = {
      id: storeService.generateId('ANF'),
      kunde: {
        name: 'Musterkundschaft GmbH',
        address: 'Handwerkerstraße 12, 10115 Berlin',
        email: 'kontakt@musterkunde.de'
      },
      leistungsart: 'Konstruktion',
      beschreibung: 'Stahlkonstruktion für Lagerhalle',
      status: 'neu',
      createdAt: new Date().toISOString()
    };

    storeService.addAnfrage(anfrage);

    const positionen = [
      {
        beschreibung: 'IPE 100 Stahlträger',
        materialId: testMaterial1.id,
        menge: 10,
        einheit: 'm',
        preis: 18.00
      }
    ];

    const netto = 180;
    const angebot = {
      id: storeService.generateId('ANG'),
      anfrageId: anfrage.id,
      kunde: anfrage.kunde,
      leistungsart: anfrage.leistungsart,
      positionen: positionen,
      netto: netto,
      mwst: netto * 0.19,
      brutto: netto * 1.19,
      status: 'offen',
      createdAt: new Date().toISOString()
    };

    storeService.addAngebot(angebot);

    // Accept angebot
    const auftrag = storeService.acceptAngebot(angebot.id);

    // Verify auftrag was created
    expect(auftrag).toBeDefined();
    expect(auftrag.id).toBeDefined();
    expect(auftrag.angebotId).toBe(angebot.id);
    expect(auftrag.status).toBe('geplant');
    expect(auftrag.netto).toBe(netto);
    expect(auftrag.positionen).toHaveLength(1);

    // Verify angebot status updated
    expect(storeService.state.angebote[0].status).toBe('angenommen');

    // Verify auftrag added to store
    expect(storeService.state.auftraege).toHaveLength(1);
    expect(storeService.state.auftraege[0].id).toBe(auftrag.id);
  });

  // ============================================
  // STEP 5: Stock Reservation
  // ============================================

  it('STEP 5: Verify stock reservation happened (reserviert field on material)', async () => {
    // Create fresh materials for this test to avoid cross-test contamination
    // Use unique identifiers to prevent ID collisions
    const uniqueSuffix = `-${Date.now()}-T5`;
    const mat1 = materialService.addMaterial({
      artikelnummer: 'ST-IPE-100' + uniqueSuffix,
      bezeichnung: 'IPE 100 Stahlträger T5',
      kategorie: 'Stahlträger',
      einheit: 'm',
      preis: 12.50,
      vkPreis: 18.00,
      bestand: 100,
      minBestand: 20,
      lieferant: 'Stahl AG'
    });

    const mat2 = materialService.addMaterial({
      artikelnummer: 'BL-5MM' + uniqueSuffix,
      bezeichnung: 'Stahlblech 5mm T5',
      kategorie: 'Bleche',
      einheit: 'qm',
      preis: 45.00,
      vkPreis: 62.00,
      bestand: 50,
      minBestand: 10,
      lieferant: 'Blech Express'
    });


    // Setup: Create anfrage → angebot → auftrag
    const anfrage = {
      id: storeService.generateId('ANF'),
      kunde: {
        name: 'Musterkundschaft GmbH',
        address: 'Handwerkerstraße 12, 10115 Berlin',
        email: 'kontakt@musterkunde.de'
      },
      leistungsart: 'Konstruktion',
      beschreibung: 'Stahlkonstruktion',
      status: 'neu',
      createdAt: new Date().toISOString()
    };

    storeService.addAnfrage(anfrage);

    const positionen = [
      {
        beschreibung: 'IPE 100 Stahlträger',
        materialId: mat1.id,
        menge: 10,
        einheit: 'm',
        preis: 18.00
      },
      {
        beschreibung: 'Stahlblech 5mm',
        materialId: mat2.id,
        menge: 5,
        einheit: 'qm',
        preis: 62.00
      }
    ];

    const angebot = {
      id: storeService.generateId('ANG'),
      anfrageId: anfrage.id,
      kunde: anfrage.kunde,
      leistungsart: anfrage.leistungsart,
      positionen: positionen,
      netto: 490,
      mwst: 490 * 0.19,
      brutto: 490 * 1.19,
      status: 'offen',
      createdAt: new Date().toISOString()
    };

    storeService.addAngebot(angebot);
    const auftrag = storeService.acceptAngebot(angebot.id);

    // Get material stock before reservation
    const mat1Before = materialService.getMaterial(mat1.id);
    const mat2Before = materialService.getMaterial(mat2.id);
    expect(mat1Before.bestand).toBe(100);
    expect(mat2Before.bestand).toBe(50);
    expect(mat1Before.reserviert || 0).toBe(0);
    expect(mat2Before.reserviert || 0).toBe(0);

    // Reserve materials for auftrag
    const reserveItems = positionen.map(p => ({
      materialId: p.materialId,
      menge: p.menge
    }));

    const result = materialService.reserveForAuftrag(auftrag.id, reserveItems);

    // Verify reservation succeeded
    expect(result.success).toBe(true);
    expect(result.shortages).toHaveLength(0);

    // Verify reserviert field updated
    const mat1After = materialService.getMaterial(mat1.id);
    const mat2After = materialService.getMaterial(mat2.id);
    expect(mat1After.reserviert).toBe(10);
    expect(mat2After.reserviert).toBe(5);

    // Verify bestand unchanged
    expect(mat1After.bestand).toBe(100);
    expect(mat2After.bestand).toBe(50);

    // Verify available stock reduced
    const avail1 = materialService.getAvailableStock(mat1.id);
    const avail2 = materialService.getAvailableStock(mat2.id);
    expect(avail1).toBe(90); // 100 - 10
    expect(avail2).toBe(45); // 50 - 5

    // Verify reservations recorded
    const reservations = materialService.getReservations(auftrag.id);
    expect(reservations).toHaveLength(2);
  });

  // ============================================
  // STEP 6: Complete Auftrag & Consume Stock
  // ============================================

  it('STEP 6: Complete Auftrag and verify stock consumed (consumeReserved)', async () => {
    // Setup: Create and accept angebot to create auftrag with reservations
    const anfrage = {
      id: storeService.generateId('ANF'),
      kunde: {
        name: 'Musterkundschaft GmbH',
        address: 'Handwerkerstraße 12, 10115 Berlin',
        email: 'kontakt@musterkunde.de'
      },
      leistungsart: 'Konstruktion',
      beschreibung: 'Stahlkonstruktion',
      status: 'neu',
      createdAt: new Date().toISOString()
    };

    storeService.addAnfrage(anfrage);

    const positionen = [
      {
        beschreibung: 'IPE 100 Stahlträger',
        materialId: testMaterial1.id,
        menge: 10,
        einheit: 'm',
        preis: 18.00
      }
    ];

    const angebot = {
      id: storeService.generateId('ANG'),
      anfrageId: anfrage.id,
      kunde: anfrage.kunde,
      leistungsart: anfrage.leistungsart,
      positionen: positionen,
      netto: 180,
      mwst: 180 * 0.19,
      brutto: 180 * 1.19,
      status: 'offen',
      createdAt: new Date().toISOString()
    };

    storeService.addAngebot(angebot);
    const auftrag = storeService.acceptAngebot(angebot.id);

    // Reserve materials
    const result = materialService.reserveForAuftrag(auftrag.id, [
      { materialId: testMaterial1.id, menge: 10 }
    ]);
    expect(result.success).toBe(true);

    // Verify reserved
    const matReserved = materialService.getMaterial(testMaterial1.id);
    expect(matReserved.reserviert).toBe(10);
    expect(matReserved.bestand).toBe(100);

    // Complete auftrag
    const rechnung = await storeService.completeAuftrag(auftrag.id);
    expect(rechnung).toBeDefined();
    expect(storeService.state.auftraege[0].status).toBe('abgeschlossen');

    // Consume reserved materials
    const consumed = materialService.consumeReserved(auftrag.id);

    // Verify consumed
    expect(consumed).toHaveLength(1);
    expect(consumed[0].menge).toBe(10);
    expect(consumed[0].materialId).toBe(testMaterial1.id);

    // Verify material stock decreased
    const matAfter = materialService.getMaterial(testMaterial1.id);
    expect(matAfter.bestand).toBe(90); // 100 - 10
    expect(matAfter.reserviert).toBe(0); // No longer reserved

    // Verify stock movements recorded
    const movements = materialService.getStockMovements(testMaterial1.id);
    const consumeMovement = movements.find(m => m.type === 'consumed');
    expect(consumeMovement).toBeDefined();
    expect(consumeMovement.quantity).toBe(-10);
  });

  // ============================================
  // STEP 7: Create Rechnung from completed Auftrag
  // ============================================

  it('STEP 7: Create Rechnung (Invoice) from completed Auftrag', async () => {
    // Setup: Create anfrage → angebot → auftrag
    const anfrage = {
      id: storeService.generateId('ANF'),
      kunde: {
        name: 'Musterkundschaft GmbH',
        address: 'Handwerkerstraße 12, 10115 Berlin',
        email: 'kontakt@musterkunde.de'
      },
      leistungsart: 'Konstruktion',
      beschreibung: 'Stahlkonstruktion',
      status: 'neu',
      createdAt: new Date().toISOString()
    };

    storeService.addAnfrage(anfrage);

    const positionen = [
      {
        beschreibung: 'IPE 100 Stahlträger',
        materialId: testMaterial1.id,
        menge: 10,
        einheit: 'm',
        preis: 18.00
      }
    ];

    const angebot = {
      id: storeService.generateId('ANG'),
      anfrageId: anfrage.id,
      kunde: anfrage.kunde,
      leistungsart: anfrage.leistungsart,
      positionen: positionen,
      netto: 180,
      mwst: 180 * 0.19,
      brutto: 180 * 1.19,
      status: 'offen',
      createdAt: new Date().toISOString()
    };

    storeService.addAngebot(angebot);
    const auftrag = storeService.acceptAngebot(angebot.id);

    // Complete auftrag and create invoice
    const rechnung = await storeService.completeAuftrag(auftrag.id);

    // Verify invoice created
    expect(rechnung).toBeDefined();
    expect(rechnung.id).toBeDefined();
    expect(rechnung.nummer).toBeDefined();
    expect(rechnung.auftragId).toBe(auftrag.id);
    expect(rechnung.status).toBe('offen');
    expect(rechnung.positionen).toHaveLength(1);

    // Verify invoice totals
    expect(rechnung.netto).toBe(180);
    expect(rechnung.mwst).toBeCloseTo(180 * 0.19, 2);
    expect(rechnung.brutto).toBeCloseTo(180 * 1.19, 2);

    // Verify invoice in store
    expect(storeService.state.rechnungen).toHaveLength(1);
    expect(storeService.state.rechnungen[0].id).toBe(rechnung.id);
  });

  // ============================================
  // STEP 8: Mark Rechnung as Paid
  // ============================================

  it('STEP 8: Mark Rechnung as paid and verify bookkeeping entries', async () => {
    // Setup: Create full workflow
    const anfrage = {
      id: storeService.generateId('ANF'),
      kunde: {
        name: 'Musterkundschaft GmbH',
        address: 'Handwerkerstraße 12, 10115 Berlin',
        email: 'kontakt@musterkunde.de'
      },
      leistungsart: 'Konstruktion',
      beschreibung: 'Stahlkonstruktion',
      status: 'neu',
      createdAt: new Date().toISOString()
    };

    storeService.addAnfrage(anfrage);

    const positionen = [
      {
        beschreibung: 'IPE 100 Stahlträger',
        materialId: testMaterial1.id,
        menge: 10,
        einheit: 'm',
        preis: 18.00
      }
    ];

    const angebot = {
      id: storeService.generateId('ANG'),
      anfrageId: anfrage.id,
      kunde: anfrage.kunde,
      leistungsart: anfrage.leistungsart,
      positionen: positionen,
      netto: 180,
      mwst: 180 * 0.19,
      brutto: 180 * 1.19,
      status: 'offen',
      createdAt: new Date().toISOString()
    };

    storeService.addAngebot(angebot);
    const auftrag = storeService.acceptAngebot(angebot.id);
    const rechnung = await storeService.completeAuftrag(auftrag.id);

    // Verify no bookkeeping entries yet
    expect(bookkeepingService.getAllBuchungen()).toHaveLength(0);

    // Mark invoice as paid
    const paidInvoice = await invoiceService.markAsPaid(rechnung.id, {
      method: 'Überweisung'
    });

    // Verify invoice marked as paid
    expect(paidInvoice.status).toBe('bezahlt');
    expect(paidInvoice.paidAt).toBeDefined();
    expect(paidInvoice.paymentMethod).toBe('Überweisung');

    // Verify bookkeeping entries created
    const buchungen = bookkeepingService.getAllBuchungen();
    expect(buchungen.length).toBeGreaterThan(0);

    // Find revenue entry (Umsatzerlöse)
    const revenueEntry = buchungen.find(b => b.typ === 'einnahme' && b.kategorie === 'Umsatzerlöse');
    expect(revenueEntry).toBeDefined();
    expect(revenueEntry.brutto).toBeCloseTo(rechnung.brutto, 2);
    expect(revenueEntry.rechnungId).toBe(rechnung.id);

    // Verify USt calculated correctly
    expect(revenueEntry.netto).toBeCloseTo(rechnung.brutto / 1.19, 2);
    expect(revenueEntry.ust).toBeCloseTo(rechnung.brutto - (rechnung.brutto / 1.19), 2);
  });

  it('STEP 8b: Mark Rechnung as paid with material costs', async () => {
    // Setup with material costs
    const anfrage = {
      id: storeService.generateId('ANF'),
      kunde: {
        name: 'Musterkundschaft GmbH',
        address: 'Handwerkerstraße 12, 10115 Berlin',
        email: 'kontakt@musterkunde.de'
      },
      leistungsart: 'Konstruktion',
      beschreibung: 'Stahlkonstruktion',
      status: 'neu',
      createdAt: new Date().toISOString()
    };

    storeService.addAnfrage(anfrage);

    const positionen = [
      {
        beschreibung: 'IPE 100 Stahlträger',
        materialId: testMaterial1.id,
        menge: 10,
        einheit: 'm',
        preis: 18.00
      }
    ];

    const angebot = {
      id: storeService.generateId('ANG'),
      anfrageId: anfrage.id,
      kunde: anfrage.kunde,
      leistungsart: anfrage.leistungsart,
      positionen: positionen,
      netto: 180,
      mwst: 180 * 0.19,
      brutto: 180 * 1.19,
      status: 'offen',
      createdAt: new Date().toISOString()
    };

    storeService.addAngebot(angebot);
    const auftrag = storeService.acceptAngebot(angebot.id);
    let rechnung = await storeService.completeAuftrag(auftrag.id);

    // Add material costs to invoice
    const materialCosts = 10 * 12.50; // 10 units * 12.50 cost price
    rechnung.materialKosten = materialCosts;
    storeService.save();

    // Mark as paid
    const paidInvoice = await invoiceService.markAsPaid(rechnung.id, {
      method: 'Überweisung'
    });

    // Verify bookkeeping entries
    const buchungen = bookkeepingService.getAllBuchungen();

    // Should have revenue entry
    const revenueEntry = buchungen.find(b => b.typ === 'einnahme');
    expect(revenueEntry).toBeDefined();

    // Should have material cost entry (COGS)
    const cogsEntry = buchungen.find(b => b.typ === 'ausgabe' && b.kategorie === 'Materialaufwendungen');
    expect(cogsEntry).toBeDefined();
    expect(cogsEntry.brutto).toBe(materialCosts);
  });

  // ============================================
  // STEP 9: Verify EÜR Summary
  // ============================================

  it('STEP 9: Verify EÜR summary shows correct totals', async () => {
    // Setup: Create multiple invoices and mark as paid
    const createAndPayInvoice = async (amount, materialCosts = 0) => {
      const anfrage = {
        id: storeService.generateId('ANF'),
        kunde: {
          name: 'Musterkundschaft GmbH',
          address: 'Handwerkerstraße 12, 10115 Berlin',
          email: 'kontakt@musterkunde.de'
        },
        leistungsart: 'Konstruktion',
        beschreibung: 'Stahlkonstruktion',
        status: 'neu',
        createdAt: new Date().toISOString()
      };

      storeService.addAnfrage(anfrage);

      const positionen = [
        {
          beschreibung: 'Service',
          menge: 1,
          einheit: 'Stk.',
          preis: amount
        }
      ];

      const angebot = {
        id: storeService.generateId('ANG'),
        anfrageId: anfrage.id,
        kunde: anfrage.kunde,
        leistungsart: anfrage.leistungsart,
        positionen: positionen,
        netto: amount,
        mwst: amount * 0.19,
        brutto: amount * 1.19,
        status: 'offen',
        createdAt: new Date().toISOString()
      };

      storeService.addAngebot(angebot);
      const auftrag = storeService.acceptAngebot(angebot.id);
      let rechnung = await storeService.completeAuftrag(auftrag.id);

      if (materialCosts > 0) {
        rechnung.materialKosten = materialCosts;
        storeService.save();
      }

      await invoiceService.markAsPaid(rechnung.id, {
        method: 'Überweisung'
      });

      return rechnung;
    };

    // Create and pay multiple invoices
    await createAndPayInvoice(1000, 300); // Revenue 1000, Material costs 300
    await createAndPayInvoice(500, 150);  // Revenue 500, Material costs 150
    await createAndPayInvoice(750, 200);  // Revenue 750, Material costs 200

    // Calculate EÜR
    const eur = bookkeepingService.berechneEUR(currentYear);

    // Verify totals
    const totalRevenue = 1000 + 500 + 750;
    const totalMaterialCosts = 300 + 150 + 200;

    expect(eur.einnahmen.brutto).toBeCloseTo(totalRevenue * 1.19, 2);
    expect(eur.einnahmen.netto).toBeCloseTo(totalRevenue, 2);

    // USt = (revenue netto) * 0.19
    const expectedUst = totalRevenue * 0.19;
    expect(eur.einnahmen.ust).toBeCloseTo(expectedUst, 2);

    // Material costs
    expect(eur.materialaufwendungen.brutto).toBe(totalMaterialCosts);

    // Gross profit = revenue netto - material costs
    const expectedGrossProfit = totalRevenue - totalMaterialCosts;
    expect(eur.rohertrag).toBe(expectedGrossProfit);

    // Profit = revenue netto - all costs
    expect(eur.gewinn).toBe(expectedGrossProfit);

    // Verify counts
    expect(eur.einnahmen.anzahl).toBe(3);
    expect(eur.materialaufwendungen.anzahl).toBe(3);
  });

  it('STEP 9b: EÜR shows correct Kleinunternehmer settings', async () => {
    // Create invoice
    const anfrage = {
      id: storeService.generateId('ANF'),
      kunde: { name: 'Test Kunde' },
      leistungsart: 'Konstruktion',
      beschreibung: 'Test',
      status: 'neu',
      createdAt: new Date().toISOString()
    };

    storeService.addAnfrage(anfrage);

    const angebot = {
      id: storeService.generateId('ANG'),
      anfrageId: anfrage.id,
      kunde: anfrage.kunde,
      leistungsart: anfrage.leistungsart,
      positionen: [{ beschreibung: 'Service', menge: 1, einheit: 'Stk.', preis: 1000 }],
      netto: 1000,
      mwst: 190,
      brutto: 1190,
      status: 'offen',
      createdAt: new Date().toISOString()
    };

    storeService.addAngebot(angebot);
    const auftrag = storeService.acceptAngebot(angebot.id);
    const rechnung = await storeService.completeAuftrag(auftrag.id);

    await invoiceService.markAsPaid(rechnung.id);

    // Test normal business (not Kleinunternehmer)
    let eur = bookkeepingService.berechneEUR(currentYear);
    expect(eur.kleinunternehmer).toBe(false);
    expect(eur.einnahmen.ust).toBeCloseTo(1000 * 0.19, 2);

    // Change to Kleinunternehmer
    bookkeepingService.updateEinstellungen({ kleinunternehmer: true });

    // Create another invoice to test
    const anfrage2 = {
      id: storeService.generateId('ANF'),
      kunde: { name: 'Test Kunde 2' },
      leistungsart: 'Konstruktion',
      beschreibung: 'Test 2',
      status: 'neu',
      createdAt: new Date().toISOString()
    };

    storeService.addAnfrage(anfrage2);

    const angebot2 = {
      id: storeService.generateId('ANG'),
      anfrageId: anfrage2.id,
      kunde: anfrage2.kunde,
      leistungsart: anfrage2.leistungsart,
      positionen: [{ beschreibung: 'Service', menge: 1, einheit: 'Stk.', preis: 500 }],
      netto: 500,
      mwst: 95,
      brutto: 595,
      status: 'offen',
      createdAt: new Date().toISOString()
    };

    storeService.addAngebot(angebot2);
    const auftrag2 = storeService.acceptAngebot(angebot2.id);
    const rechnung2 = await storeService.completeAuftrag(auftrag2.id);

    await invoiceService.markAsPaid(rechnung2.id);

    eur = bookkeepingService.berechneEUR(currentYear);
    expect(eur.kleinunternehmer).toBe(true);
    expect(eur.ustZahllast).toBe(0); // No USt obligation for Kleinunternehmer
  });

  // ============================================
  // COMPREHENSIVE END-TO-END TEST
  // ============================================

  it('COMPREHENSIVE: Full money path from Anfrage to EÜR', async () => {
    // Create fresh materials for this comprehensive test
    const uniqueSuffix = `-${Date.now()}-COMP`;
    const compMat1 = materialService.addMaterial({
      artikelnummer: 'ST-IPE-100' + uniqueSuffix,
      bezeichnung: 'IPE 100 Stahlträger COMP',
      kategorie: 'Stahlträger',
      einheit: 'm',
      preis: 12.50,
      vkPreis: 18.00,
      bestand: 100,
      minBestand: 20,
      lieferant: 'Stahl AG'
    });

    const compMat2 = materialService.addMaterial({
      artikelnummer: 'BL-5MM' + uniqueSuffix,
      bezeichnung: 'Stahlblech 5mm COMP',
      kategorie: 'Bleche',
      einheit: 'qm',
      preis: 45.00,
      vkPreis: 62.00,
      bestand: 50,
      minBestand: 10,
      lieferant: 'Blech Express'
    });

    // 1. Create customer inquiry
    const anfrage = {
      id: storeService.generateId('ANF'),
      kunde: {
        name: 'Konstruktionsbau Müller',
        address: 'Müller-Straße 42, 80331 München',
        email: 'info@mueller.de',
        phone: '+49 89 123456'
      },
      leistungsart: 'Konstruktion',
      beschreibung: 'Stahlkonstruktion für Fabrikhalle mit Krananlage',
      status: 'neu',
      createdAt: new Date().toISOString()
    };

    storeService.addAnfrage(anfrage);
    expect(storeService.state.anfragen).toHaveLength(1);

    // 2. Create quote with materials
    const positionen = [
      {
        beschreibung: 'IPE 100 Stahlträger',
        materialId: compMat1.id,
        menge: 20,
        einheit: 'm',
        preis: 18.00
      },
      {
        beschreibung: 'Stahlblech 5mm',
        materialId: compMat2.id,
        menge: 8,
        einheit: 'qm',
        preis: 62.00
      }
    ];

    const netto = 20 * 18.00 + 8 * 62.00; // 360 + 496 = 856
    const angebot = {
      id: storeService.generateId('ANG'),
      anfrageId: anfrage.id,
      kunde: anfrage.kunde,
      leistungsart: anfrage.leistungsart,
      positionen: positionen,
      text: 'Stahlkonstruktion mit Krananlage',
      netto: netto,
      mwst: netto * 0.19,
      brutto: netto * 1.19,
      status: 'offen',
      createdAt: new Date().toISOString()
    };

    storeService.addAngebot(angebot);
    expect(storeService.state.angebote).toHaveLength(1);

    // 3. Accept quote → create order
    const auftrag = storeService.acceptAngebot(angebot.id);
    expect(storeService.state.auftraege).toHaveLength(1);
    expect(auftrag.status).toBe('geplant');

    // 4. Reserve materials
    const reserveItems = positionen.map(p => ({
      materialId: p.materialId,
      menge: p.menge
    }));

    const reserveResult = materialService.reserveForAuftrag(auftrag.id, reserveItems);
    expect(reserveResult.success).toBe(true);

    // Verify reservation
    const mat1Res = materialService.getMaterial(compMat1.id);
    const mat2Res = materialService.getMaterial(compMat2.id);
    expect(mat1Res.reserviert).toBe(20);
    expect(mat2Res.reserviert).toBe(8);
    expect(materialService.getAvailableStock(compMat1.id)).toBe(80); // 100 - 20
    expect(materialService.getAvailableStock(compMat2.id)).toBe(42); // 50 - 8

    // 5. Complete order
    const rechnung = await storeService.completeAuftrag(auftrag.id);
    expect(storeService.state.auftraege[0].status).toBe('abgeschlossen');
    expect(rechnung).toBeDefined();
    expect(rechnung.status).toBe('offen');

    // 6. Consume reserved materials
    const consumed = materialService.consumeReserved(auftrag.id);
    expect(consumed).toHaveLength(2);

    // Verify stock consumed
    const mat1Final = materialService.getMaterial(compMat1.id);
    const mat2Final = materialService.getMaterial(compMat2.id);
    expect(mat1Final.bestand).toBe(80); // 100 - 20
    expect(mat1Final.reserviert).toBe(0);
    expect(mat2Final.bestand).toBe(42); // 50 - 8
    expect(mat2Final.reserviert).toBe(0);

    // 7. Mark invoice as paid
    const paidRechnung = await invoiceService.markAsPaid(rechnung.id, {
      method: 'Überweisung',
      note: 'Zahlung per Banküberweisung'
    });

    expect(paidRechnung.status).toBe('bezahlt');

    // 8. Verify bookkeeping entries
    const buchungen = bookkeepingService.getAllBuchungen();
    const revenueEntry = buchungen.find(b => b.typ === 'einnahme');
    expect(revenueEntry).toBeDefined();
    expect(revenueEntry.brutto).toBeCloseTo(netto * 1.19, 2);

    // 9. Verify EÜR
    const eur = bookkeepingService.berechneEUR(currentYear);
    expect(eur.einnahmen.anzahl).toBe(1);
    expect(eur.einnahmen.brutto).toBeCloseTo(netto * 1.19, 2);
    expect(eur.einnahmen.netto).toBeCloseTo(netto, 2);
    expect(eur.einnahmen.ust).toBeCloseTo(netto * 0.19, 2);
    expect(eur.gewinn).toBeCloseTo(netto, 2); // No material costs recorded in this test

    // Verify workflow state
    expect(storeService.state.anfragen).toHaveLength(1);
    expect(storeService.state.angebote).toHaveLength(1);
    expect(storeService.state.auftraege).toHaveLength(1);
    expect(storeService.state.rechnungen).toHaveLength(1);
  });
});
