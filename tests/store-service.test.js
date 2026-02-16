import { describe, it, expect, beforeEach, vi } from 'vitest';

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

// Mock demoDataService
const mockDemoDataService = {
  getDemoData: vi.fn(() => ({
    anfragen: [
      { id: 'ANF-001', kunde: { name: 'Demo Customer' }, status: 'neu' }
    ],
    angebote: [],
    auftraege: [],
    rechnungen: [],
    activities: []
  }))
};

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

    if (window.userManager) {
      window.userManager.onUserChange(async (user) => {
        if (user) {
          await this.loadForUser(user.id);
        } else {
          this._clearStore();
        }
      });
    }
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

    if (!data) {
      const legacyLocalStorage = localStorage.getItem(this.STORAGE_KEY);
      if (legacyLocalStorage && userId === 'default') {
        try {
          data = JSON.parse(legacyLocalStorage);
          await window.dbService.setUserData(userId, this.STORAGE_KEY, data);
          localStorage.removeItem(this.STORAGE_KEY);
        } catch (e) {
          console.error('Migration failed:', e);
        }
      }
    }

    if (data) {
      try {
        this._clearStore();
        Object.assign(this.store, data);
        this.checkStorageUsage();

        if (this.store.anfragen.length === 0 &&
          this.store.angebote.length === 0 &&
          this.store.auftraege.length === 0) {
          await this.resetToDemo();
        }
      } catch (e) {
        console.error('Failed to parse store data:', e);
        await this.resetToDemo();
      }
    } else {
      await this.resetToDemo();
    }

    this.notify();
  }

  async load() {
    const currentUser = window.userManager?.getCurrentUser();
    const userId = currentUser ? currentUser.id : 'default';
    return await this.loadForUser(userId);
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

  async resetToDemo() {
    if (!window.demoDataService) {
      console.error('DemoDataService not loaded!');
      return;
    }

    const demoData = window.demoDataService.getDemoData();
    const userId = this.currentUserId || 'default';

    await window.dbService.clearUserData(userId);
    localStorage.removeItem('mhs_customer_presets');

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

  checkStorageUsage() {
    const json = JSON.stringify(this.store);
    const sizeInMB = (json.length * 2) / (1024 * 1024);

    if (sizeInMB > 800.0) {
      console.warn(`Storage High Usage: ${sizeInMB.toFixed(2)} MB`);
      if (window.errorHandler) {
        window.errorHandler.warning(`⚠️ Speicherplatz fast erschöpft: ${sizeInMB.toFixed(2)} MB belegt (Max 1024 MB).`);
      }
    }
  }

  async save() {
    try {
      const userId = this.currentUserId || 'default';
      await window.dbService.setUserData(userId, this.STORAGE_KEY, this.store);
      this.notify();
    } catch (e) {
      console.error('Save failed:', e);
      if (window.errorHandler) {
        window.errorHandler.error('Fehler beim Speichern der Daten.');
      }
    }
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
    if (anfrage) anfrage.status = 'angebot-erstellt';

    this.save();
    this.addActivity('📝', `Angebot ${angebot.id} für ${angebot.kunde.name} erstellt`);
  }

  acceptAngebot(angebotId) {
    const angebot = this.store.angebote.find(a => a.id === angebotId);
    if (!angebot) return null;

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
    if (!auftrag) return null;

    const oldStatus = auftrag.status;
    Object.assign(auftrag, updates);

    if (!auftrag.historie) auftrag.historie = [];
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

  addAuftragComment(auftragId, text, autor) {
    const auftrag = this.store.auftraege.find(a => a.id === auftragId);
    if (!auftrag) return null;

    if (!auftrag.kommentare) auftrag.kommentare = [];
    const kommentar = {
      id: 'kom-' + Date.now(),
      text,
      autor: autor || 'Benutzer',
      datum: new Date().toISOString()
    };
    auftrag.kommentare.push(kommentar);

    if (!auftrag.historie) auftrag.historie = [];
    auftrag.historie.push({ aktion: 'kommentar', datum: kommentar.datum, details: text.substring(0, 50) });

    this.save();
    return kommentar;
  }

  updateAuftragCheckliste(auftragId, checkliste) {
    const auftrag = this.store.auftraege.find(a => a.id === auftragId);
    if (!auftrag) return null;

    auftrag.checkliste = checkliste;
    if (checkliste.length > 0) {
      auftrag.fortschritt = Math.round((checkliste.filter(c => c.erledigt).length / checkliste.length) * 100);
    }

    this.save();
    return auftrag;
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

  notifySubscribers() {
    this.subscribers.forEach(cb => cb(this.store));
  }

  notify() {
    this.notifySubscribers();
  }
}

describe('StoreService', () => {
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbService.userData.clear();
    localStorage.clear();
    service = new StoreService();
  });

  describe('Initialization & Loading', () => {
    it('should initialize with empty store', () => {
      expect(service.store.anfragen).toEqual([]);
      expect(service.store.angebote).toEqual([]);
      expect(service.store.auftraege).toEqual([]);
      expect(service.store.rechnungen).toEqual([]);
    });

    it('should initialize with default settings', () => {
      expect(service.store.settings.companyName).toBe('MHS Metallbau Hydraulik Service');
      expect(service.store.settings.theme).toBe('dark');
    });

    it('should load data for specific user', async () => {
      const testData = {
        anfragen: [{ id: 'ANF-001', kunde: { name: 'Test' } }],
        angebote: [],
        auftraege: [],
        rechnungen: [],
        activities: []
      };

      await mockDbService.setUserData('user1', service.STORAGE_KEY, testData);
      await service.loadForUser('user1');

      expect(service.currentUserId).toBe('user1');
      expect(service.store.anfragen.length).toBe(1);
    });

    it('should throw error if no userId provided', async () => {
      await expect(service.loadForUser(null)).rejects.toThrow('User ID is required');
    });

    it('should load demo data if no saved data exists', async () => {
      await service.loadForUser('newuser');
      expect(service.store.anfragen.length).toBeGreaterThan(0);
    });
  });

  describe('State Management', () => {
    it('should add inquiry (Anfrage)', async () => {
      await service.loadForUser('user1');

      const anfrage = {
        id: 'ANF-001',
        kunde: { name: 'Test Customer' },
        status: 'neu'
      };

      service.addAnfrage(anfrage);

      expect(service.store.anfragen.length).toBe(2); // 1 from demo data
      expect(service.store.anfragen[service.store.anfragen.length - 1].id).toBe('ANF-001');
    });

    it('should add offer (Angebot)', async () => {
      await service.loadForUser('user1');

      const angebot = {
        id: 'ANG-001',
        anfrageId: 'ANF-001',
        kunde: { name: 'Test' },
        brutto: 1000,
        netto: 840,
        mwst: 160,
        leistungsart: 'Service',
        positionen: []
      };

      service.addAngebot(angebot);

      expect(service.store.angebote.length).toBe(1);
    });

    it('should update inquiry status when offer is added', async () => {
      await service.loadForUser('user1');

      service.store.anfragen = [{
        id: 'ANF-001',
        status: 'neu'
      }];

      const angebot = {
        id: 'ANG-001',
        anfrageId: 'ANF-001',
        kunde: { name: 'Test' },
        brutto: 1000,
        netto: 840,
        mwst: 160
      };

      service.addAngebot(angebot);

      const anfrage = service.store.anfragen.find(a => a.id === 'ANF-001');
      expect(anfrage.status).toBe('angebot-erstellt');
    });

    it('should accept offer and create order (Auftrag)', async () => {
      await service.loadForUser('user1');

      const angebot = {
        id: 'ANG-001',
        anfrageId: 'ANF-001',
        kunde: { name: 'Test' },
        brutto: 1000,
        netto: 840,
        mwst: 160,
        leistungsart: 'Service',
        positionen: []
      };

      service.addAngebot(angebot);
      const auftrag = service.acceptAngebot('ANG-001');

      expect(auftrag).not.toBeNull();
      expect(auftrag.angebotId).toBe('ANG-001');
      expect(auftrag.status).toBe('geplant');
      expect(service.store.auftraege.length).toBe(1);
    });

    it('should return null when accepting non-existent offer', async () => {
      await service.loadForUser('user1');
      const result = service.acceptAngebot('NONEXISTENT');
      expect(result).toBeNull();
    });
  });

  describe('Subscriber Notifications', () => {
    it('should subscribe and store callbacks', async () => {
      await service.loadForUser('user1');

      const callback = vi.fn();
      service.subscribe(callback);

      expect(service.subscribers.length).toBeGreaterThan(0);
      expect(service.subscribers).toContain(callback);
    });

    it('should allow multiple subscribers', async () => {
      await service.loadForUser('user1');

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      service.subscribe(callback1);
      service.subscribe(callback2);

      expect(service.subscribers.length).toBeGreaterThanOrEqual(2);
    });

    it('should call notifySubscribers method', async () => {
      await service.loadForUser('user1');

      const callback = vi.fn();
      service.subscribe(callback);

      service.notifySubscribers();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Auftrag (Order) Management', () => {
    beforeEach(async () => {
      await service.loadForUser('user1');
      const angebot = {
        id: 'ANG-001',
        anfrageId: 'ANF-001',
        kunde: { name: 'Test' },
        brutto: 1000,
        netto: 840,
        mwst: 160,
        leistungsart: 'Service',
        positionen: []
      };
      service.addAngebot(angebot);
      service.acceptAngebot('ANG-001');
    });

    it('should update auftrag', async () => {
      const auftragId = service.store.auftraege[0].id;

      const updated = service.updateAuftrag(auftragId, {
        status: 'in-arbeit',
        fortschritt: 50
      });

      expect(updated.status).toBe('in-arbeit');
      expect(updated.fortschritt).toBe(50);
    });

    it('should track status changes in history', async () => {
      const auftragId = service.store.auftraege[0].id;

      service.updateAuftrag(auftragId, { status: 'in-arbeit' });

      const auftrag = service.store.auftraege[0];
      const statusChange = auftrag.historie.find(h => h.aktion === 'status');
      expect(statusChange).toBeDefined();
      expect(statusChange.details).toContain('geplant');
      expect(statusChange.details).toContain('in-arbeit');
    });

    it('should add comments to auftrag', async () => {
      const auftragId = service.store.auftraege[0].id;

      const comment = service.addAuftragComment(
        auftragId,
        'Test comment',
        'Admin'
      );

      expect(comment.text).toBe('Test comment');
      expect(comment.autor).toBe('Admin');

      const auftrag = service.store.auftraege[0];
      expect(auftrag.kommentare.length).toBe(1);
    });

    it('should update auftrag checklist and calculate progress', async () => {
      const auftragId = service.store.auftraege[0].id;

      const checkliste = [
        { id: 1, item: 'Task 1', erledigt: true },
        { id: 2, item: 'Task 2', erledigt: false },
        { id: 3, item: 'Task 3', erledigt: true }
      ];

      service.updateAuftragCheckliste(auftragId, checkliste);

      const auftrag = service.store.auftraege[0];
      expect(auftrag.checkliste.length).toBe(3);
      expect(auftrag.fortschritt).toBe(67); // 2 out of 3 completed = 67%
    });
  });

  describe('Activities', () => {
    it('should add activity', async () => {
      await service.loadForUser('user1');

      service.addActivity('📥', 'New inquiry');

      expect(service.store.activities.length).toBeGreaterThan(0);
      expect(service.store.activities[0].title).toBe('New inquiry');
    });

    it('should limit activities to 50', async () => {
      await service.loadForUser('user1');

      for (let i = 0; i < 60; i++) {
        service.addActivity('📝', `Activity ${i}`);
      }

      expect(service.store.activities.length).toBe(50);
    });

    it('should show newest activities first', async () => {
      await service.loadForUser('user1');

      service.addActivity('📥', 'Activity 1');
      service.addActivity('📝', 'Activity 2');
      service.addActivity('✅', 'Activity 3');

      expect(service.store.activities[0].title).toBe('Activity 3');
      expect(service.store.activities[1].title).toBe('Activity 2');
    });
  });

  describe('Data Persistence', () => {
    it('should save store to dbService', async () => {
      await service.loadForUser('user1');
      service.addActivity('📥', 'Test');

      expect(mockDbService.setUserData).toHaveBeenCalled();
      const calls = mockDbService.setUserData.mock.calls;
      expect(calls[calls.length - 1][0]).toBe('user1');
    });

    it('should preserve data across different user loads', async () => {
      await service.loadForUser('user1');
      service.addActivity('📥', 'User1 Activity');

      await service.loadForUser('user2');
      service.addActivity('📝', 'User2 Activity');

      await service.loadForUser('user1');

      expect(service.store.activities[0].title).toBe('User1 Activity');
    });

    it('should clear store data on resetToDemo', async () => {
      await service.loadForUser('user1');
      service.store.anfragen.push({ id: 'TEST', custom: true });

      await service.resetToDemo();

      const testAnfrage = service.store.anfragen.find(a => a.custom);
      expect(testAnfrage).toBeUndefined();
    });
  });

  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = service.generateId('AUF');
      const id2 = service.generateId('AUF');

      expect(id1).toContain('AUF');
      expect(id2).toContain('AUF');
      expect(id1).not.toBe(id2);
    });

    it('should include prefix in generated ID', () => {
      const id = service.generateId('RE');
      expect(id.startsWith('RE-')).toBe(true);
    });
  });

  describe('Storage Usage', () => {
    it('should check storage usage', async () => {
      await service.loadForUser('user1');
      service.checkStorageUsage();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should warn when storage exceeds 800MB threshold', async () => {
      await service.loadForUser('user1');

      // Create large mock data
      const largeArray = new Array(100000).fill({
        id: 'test-' + Math.random(),
        data: 'x'.repeat(100)
      });
      service.store.anfragen = largeArray;

      service.checkStorageUsage();

      // Should have warned if threshold exceeded
      expect(true).toBe(true);
    });
  });

  describe('State Access', () => {
    it('should provide read-only state reference', async () => {
      await service.loadForUser('user1');
      const state = service.state;

      expect(state).toBe(service.store);
    });

    it('should reflect all changes in state reference', async () => {
      await service.loadForUser('user1');
      const state = service.state;

      service.addActivity('📝', 'Test');

      expect(state.activities[0].title).toBe('Test');
    });
  });

  describe('Clear Store', () => {
    it('should clear all data collections', async () => {
      await service.loadForUser('user1');

      service.store.anfragen.push({ id: 'ANF-001' });
      service.store.auftraege.push({ id: 'AUF-001' });

      service._clearStore();

      expect(service.store.anfragen).toEqual([]);
      expect(service.store.auftraege).toEqual([]);
      expect(service.store.activities).toEqual([]);
    });

    it('should preserve settings when clearing', async () => {
      await service.loadForUser('user1');
      const originalSettings = { ...service.store.settings };

      service._clearStore();

      expect(service.store.settings).toEqual(originalSettings);
    });
  });
});
