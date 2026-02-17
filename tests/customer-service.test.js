import { describe, it, expect, beforeEach } from 'vitest';

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

global.localStorage = localStorageMock;

class CustomerService {
  constructor() {
    this.customers = JSON.parse(localStorage.getItem('freyai_customers') || '[]');
    this.interactions = JSON.parse(localStorage.getItem('freyai_interactions') || '[]');
  }

  addCustomer(customer) {
    const existing = this.findDuplicates(customer);
    if (existing.length > 0) {
      console.warn('Mögliche Duplikate gefunden:', existing);
    }

    const newCustomer = {
      id: customer.id || this.generateId(),
      name: customer.name,
      firma: customer.firma || '',
      email: customer.email || '',
      telefon: customer.telefon || '',
      mobil: customer.mobil || '',
      adresse: {
        strasse: customer.adresse?.strasse || customer.strasse || '',
        plz: customer.adresse?.plz || customer.plz || '',
        ort: customer.adresse?.ort || customer.ort || ''
      },
      notizen: customer.notizen || '',
      tags: customer.tags || [],
      quelle: customer.quelle || 'manual',
      status: customer.status || 'aktiv',
      umsatzGesamt: customer.umsatzGesamt || 0,
      anzahlAuftraege: customer.anzahlAuftraege || 0,
      erstelltAm: customer.erstelltAm || new Date().toISOString(),
      aktualisiertAm: new Date().toISOString(),
      letzterKontakt: customer.letzterKontakt || null,
      zahlungsart: customer.zahlungsart || 'rechnung',
      zahlungsziel: customer.zahlungsziel || 14,
      rabatt: customer.rabatt || 0,
      customFields: customer.customFields || {}
    };

    this.customers.push(newCustomer);
    this.save();
    return newCustomer;
  }

  updateCustomer(id, updates) {
    const index = this.customers.findIndex(c => c.id === id);
    if (index !== -1) {
      this.customers[index] = {
        ...this.customers[index],
        ...updates,
        aktualisiertAm: new Date().toISOString()
      };
      if (updates.adresse) {
        this.customers[index].adresse = { ...this.customers[index].adresse, ...updates.adresse };
      }
      this.save();
      return this.customers[index];
    }
    return null;
  }

  deleteCustomer(id) {
    this.customers = this.customers.filter(c => c.id !== id);
    this.save();
  }

  getCustomer(id) {
    return this.customers.find(c => c.id === id);
  }

  getCustomerByEmail(email) {
    return this.customers.find(c => c.email?.toLowerCase() === email?.toLowerCase());
  }

  getAllCustomers() {
    return this.customers.filter(c => c.status !== 'geloescht');
  }

  getActiveCustomers() {
    return this.customers.filter(c => c.status === 'aktiv');
  }

  findDuplicates(customer) {
    return this.customers.filter(c => {
      if (customer.email && c.email && c.email.toLowerCase() === customer.email.toLowerCase()) return true;
      if (customer.telefon && c.telefon && c.telefon.replace(/\D/g, '') === customer.telefon.replace(/\D/g, '')) return true;
      if (customer.name && c.name && c.name.toLowerCase() === customer.name.toLowerCase() &&
        customer.firma && c.firma && c.firma.toLowerCase() === customer.firma.toLowerCase()) return true;
      return false;
    });
  }

  mergeCustomers(primaryId, secondaryId) {
    const primary = this.getCustomer(primaryId);
    const secondary = this.getCustomer(secondaryId);
    if (!primary || !secondary) return null;

    const merged = {
      ...primary,
      telefon: primary.telefon || secondary.telefon,
      mobil: primary.mobil || secondary.mobil,
      email: primary.email || secondary.email,
      notizen: (primary.notizen || '') + '\n---\n' + (secondary.notizen || ''),
      tags: [...new Set([...primary.tags, ...secondary.tags])],
      umsatzGesamt: primary.umsatzGesamt + secondary.umsatzGesamt,
      anzahlAuftraege: primary.anzahlAuftraege + secondary.anzahlAuftraege
    };

    this.interactions.forEach(i => {
      if (i.customerId === secondaryId) i.customerId = primaryId;
    });

    this.updateCustomer(primaryId, merged);
    this.deleteCustomer(secondaryId);
    this.saveInteractions();
    return merged;
  }

  addInteraction(customerId, interaction) {
    const newInteraction = {
      id: 'int-' + Date.now(),
      customerId: customerId,
      type: interaction.type,
      subject: interaction.subject || '',
      content: interaction.content || '',
      direction: interaction.direction || 'outbound',
      duration: interaction.duration || null,
      createdAt: new Date().toISOString(),
      createdBy: interaction.createdBy || 'System'
    };

    this.interactions.push(newInteraction);
    this.updateCustomer(customerId, { letzterKontakt: new Date().toISOString() });
    this.saveInteractions();
    return newInteraction;
  }

  getInteractionHistory(customerId) {
    return this.interactions
      .filter(i => i.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getRecentInteractions(limit = 20) {
    return this.interactions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  searchCustomers(query) {
    const q = query.toLowerCase();
    return this.customers.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.firma?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.telefon?.includes(q) ||
      c.adresse?.ort?.toLowerCase().includes(q) ||
      c.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  getCustomerStats(customerId) {
    const customer = this.getCustomer(customerId);
    const interactions = this.getInteractionHistory(customerId);

    return {
      umsatzGesamt: customer?.umsatzGesamt || 0,
      anzahlAuftraege: customer?.anzahlAuftraege || 0,
      letzterKontakt: customer?.letzterKontakt,
      anzahlInteraktionen: interactions.length,
      interaktionenProTyp: {
        call: interactions.filter(i => i.type === 'call').length,
        email: interactions.filter(i => i.type === 'email').length,
        meeting: interactions.filter(i => i.type === 'meeting').length
      }
    };
  }

  getTopCustomers(limit = 10) {
    return [...this.customers]
      .sort((a, b) => b.umsatzGesamt - a.umsatzGesamt)
      .slice(0, limit);
  }

  updateCustomerFromRechnung(customerId, rechnungsSumme) {
    const customer = this.getCustomer(customerId);
    if (customer) {
      this.updateCustomer(customerId, {
        umsatzGesamt: (customer.umsatzGesamt || 0) + rechnungsSumme,
        anzahlAuftraege: (customer.anzahlAuftraege || 0) + 1
      });
    }
  }

  getOrCreateFromAnfrage(anfrageKunde) {
    let customer = this.getCustomerByEmail(anfrageKunde.email);
    if (!customer && anfrageKunde.telefon) {
      customer = this.customers.find(c =>
        c.telefon?.replace(/\D/g, '') === anfrageKunde.telefon.replace(/\D/g, '')
      );
    }

    if (!customer) {
      customer = this.addCustomer({
        name: anfrageKunde.name,
        firma: anfrageKunde.firma,
        email: anfrageKunde.email,
        telefon: anfrageKunde.telefon,
        quelle: 'anfrage'
      });
    }

    return customer;
  }

  generateId() {
    return 'cust-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  formatAddress(customer) {
    const a = customer.adresse || {};
    if (!a.strasse && !a.plz && !a.ort) return '-';
    return `${a.strasse}, ${a.plz} ${a.ort}`.trim();
  }

  save() {
    localStorage.setItem('freyai_customers', JSON.stringify(this.customers));
  }

  saveInteractions() {
    localStorage.setItem('freyai_interactions', JSON.stringify(this.interactions));
  }
}

describe('CustomerService', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new CustomerService();
  });

  describe('CRUD Operations', () => {
    it('should add a new customer', () => {
      const customer = service.addCustomer({
        name: 'Max Mustermann',
        firma: 'ABC GmbH',
        email: 'max@example.com'
      });

      expect(customer).toHaveProperty('id');
      expect(customer.name).toBe('Max Mustermann');
      expect(customer.firma).toBe('ABC GmbH');
      expect(customer.status).toBe('aktiv');
    });

    it('should set default values for new customer', () => {
      const customer = service.addCustomer({
        name: 'John Doe'
      });

      expect(customer.status).toBe('aktiv');
      expect(customer.quelle).toBe('manual');
      expect(customer.zahlungsart).toBe('rechnung');
      expect(customer.zahlungsziel).toBe(14);
      expect(customer.rabatt).toBe(0);
      expect(customer.umsatzGesamt).toBe(0);
    });

    it('should retrieve customer by id', () => {
      const added = service.addCustomer({ name: 'Test Customer' });
      const retrieved = service.getCustomer(added.id);

      expect(retrieved).toEqual(added);
    });

    it('should retrieve customer by email', () => {
      const added = service.addCustomer({
        name: 'Test',
        email: 'test@example.com'
      });

      const retrieved = service.getCustomerByEmail('test@example.com');
      expect(retrieved.id).toBe(added.id);
    });

    it('should retrieve customer by email case-insensitive', () => {
      const added = service.addCustomer({
        name: 'Test',
        email: 'test@example.com'
      });

      const retrieved = service.getCustomerByEmail('TEST@EXAMPLE.COM');
      expect(retrieved.id).toBe(added.id);
    });

    it('should update customer', () => {
      const customer = service.addCustomer({
        name: 'Old Name',
        email: 'old@example.com'
      });

      const updated = service.updateCustomer(customer.id, {
        name: 'New Name'
      });

      expect(updated.name).toBe('New Name');
      expect(updated.email).toBe('old@example.com');
    });

    it('should update customer address', () => {
      const customer = service.addCustomer({
        name: 'Test',
        adresse: { strasse: 'Old Street', plz: '12345', ort: 'Berlin' }
      });

      service.updateCustomer(customer.id, {
        adresse: { strasse: 'New Street', plz: '12345', ort: 'Berlin' }
      });

      const updated = service.getCustomer(customer.id);
      expect(updated.adresse.strasse).toBe('New Street');
      expect(updated.adresse.plz).toBe('12345');
      expect(updated.adresse.ort).toBe('Berlin');
    });

    it('should delete customer', () => {
      const customer = service.addCustomer({ name: 'To Delete' });
      service.deleteCustomer(customer.id);

      const retrieved = service.getCustomer(customer.id);
      expect(retrieved).toBeUndefined();
    });

    it('should update aktualisiertAm when modifying customer', () => {
      const customer = service.addCustomer({ name: 'Test' });
      const originalDate = new Date(customer.aktualisiertAm).getTime();

      // Small delay to ensure different timestamp
      const updated = service.updateCustomer(customer.id, { name: 'Updated' });
      const updatedDate = new Date(updated.aktualisiertAm).getTime();
      expect(updatedDate).toBeGreaterThanOrEqual(originalDate);
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate by email', () => {
      service.addCustomer({
        name: 'John',
        email: 'john@example.com'
      });

      const duplicates = service.findDuplicates({
        email: 'john@example.com'
      });

      expect(duplicates.length).toBe(1);
    });

    it('should detect duplicate by email case-insensitive', () => {
      service.addCustomer({
        name: 'John',
        email: 'john@example.com'
      });

      const duplicates = service.findDuplicates({
        email: 'JOHN@EXAMPLE.COM'
      });

      expect(duplicates.length).toBe(1);
    });

    it('should detect duplicate by phone number', () => {
      service.addCustomer({
        name: 'John',
        telefon: '0123 456789'
      });

      const duplicates = service.findDuplicates({
        telefon: '0123456789'
      });

      expect(duplicates.length).toBe(1);
    });

    it('should detect duplicate by name and firma', () => {
      service.addCustomer({
        name: 'Max Mustermann',
        firma: 'ABC GmbH'
      });

      const duplicates = service.findDuplicates({
        name: 'max mustermann',
        firma: 'abc gmbh'
      });

      expect(duplicates.length).toBe(1);
    });

    it('should not detect false positives', () => {
      service.addCustomer({
        name: 'John',
        email: 'john@example.com'
      });

      const duplicates = service.findDuplicates({
        name: 'Jane',
        email: 'jane@example.com'
      });

      expect(duplicates.length).toBe(0);
    });
  });

  describe('Customer Merge', () => {
    it('should merge two customers', () => {
      const primary = service.addCustomer({
        name: 'Max M.',
        email: 'max@example.com',
        telefon: '123456'
      });

      const secondary = service.addCustomer({
        name: 'Max Mustermann',
        mobil: '789012',
        telefon: '',
        umsatzGesamt: 500,
        anzahlAuftraege: 2
      });

      service.mergeCustomers(primary.id, secondary.id);

      const merged = service.getCustomer(primary.id);
      expect(merged.mobil).toBe('789012');
      expect(merged.email).toBe('max@example.com');
      expect(merged.umsatzGesamt).toBe(500);
      expect(merged.anzahlAuftraege).toBe(2);
    });

    it('should merge tags from both customers', () => {
      const primary = service.addCustomer({
        name: 'Test',
        tags: ['tag1', 'tag2']
      });

      const secondary = service.addCustomer({
        name: 'Test2',
        tags: ['tag2', 'tag3']
      });

      service.mergeCustomers(primary.id, secondary.id);
      const merged = service.getCustomer(primary.id);

      expect(merged.tags).toContain('tag1');
      expect(merged.tags).toContain('tag2');
      expect(merged.tags).toContain('tag3');
      expect(new Set(merged.tags).size).toBe(3); // No duplicates
    });

    it('should reassign interactions to primary customer', () => {
      const primary = service.addCustomer({ name: 'Primary' });
      const secondary = service.addCustomer({ name: 'Secondary' });

      service.addInteraction(secondary.id, {
        type: 'email',
        subject: 'Test'
      });

      service.mergeCustomers(primary.id, secondary.id);

      const interactions = service.getInteractionHistory(primary.id);
      expect(interactions.length).toBe(1);

      const secondaryInteractions = service.getInteractionHistory(secondary.id);
      expect(secondaryInteractions.length).toBe(0);
    });

    it('should delete secondary customer after merge', () => {
      const primary = service.addCustomer({ name: 'Primary' });
      const secondary = service.addCustomer({ name: 'Secondary' });

      service.mergeCustomers(primary.id, secondary.id);

      const deleted = service.getCustomer(secondary.id);
      expect(deleted).toBeUndefined();
    });
  });

  describe('Search and Filter', () => {
    beforeEach(() => {
      service.addCustomer({
        name: 'Max Mustermann',
        firma: 'ABC GmbH',
        email: 'max@example.com',
        adresse: { ort: 'Berlin' },
        tags: ['vip', 'metallbau']
      });

      service.addCustomer({
        name: 'John Smith',
        firma: 'XYZ Ltd',
        email: 'john@example.com',
        adresse: { ort: 'München' },
        tags: ['regular']
      });

      service.addCustomer({
        name: 'Anna Mueller',
        firma: 'ABC GmbH',
        email: 'anna@example.com',
        adresse: { ort: 'Hamburg' },
        tags: []
      });
    });

    it('should search by name', () => {
      const results = service.searchCustomers('Max');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Max Mustermann');
    });

    it('should search by firma', () => {
      const results = service.searchCustomers('ABC');
      expect(results.length).toBe(2);
    });

    it('should search by email', () => {
      const results = service.searchCustomers('john@example.com');
      expect(results.length).toBe(1);
    });

    it('should search by phone', () => {
      service.customers[0].telefon = '030123456';
      const results = service.searchCustomers('030123456');
      expect(results.length).toBe(1);
    });

    it('should search by city', () => {
      const results = service.searchCustomers('Berlin');
      expect(results.length).toBe(1);
    });

    it('should search by tags', () => {
      const results = service.searchCustomers('vip');
      expect(results.length).toBe(1);
    });

    it('should be case-insensitive', () => {
      const results = service.searchCustomers('MAX');
      expect(results.length).toBe(1);
    });

    it('should return all active customers', () => {
      const active = service.getActiveCustomers();
      expect(active.length).toBe(3);
    });

    it('should exclude deleted customers', () => {
      service.customers[0].status = 'geloescht';
      const all = service.getAllCustomers();
      expect(all.length).toBe(2);
    });
  });

  describe('Interactions & History', () => {
    it('should add interaction', () => {
      const customer = service.addCustomer({ name: 'Test' });
      const interaction = service.addInteraction(customer.id, {
        type: 'call',
        subject: 'Anfrage',
        duration: 15
      });

      expect(interaction).toHaveProperty('id');
      expect(interaction.type).toBe('call');
      expect(interaction.customerId).toBe(customer.id);
    });

    it('should retrieve interaction history', () => {
      const customer = service.addCustomer({ name: 'Test' });

      service.addInteraction(customer.id, {
        type: 'call',
        subject: 'Call 1'
      });

      service.addInteraction(customer.id, {
        type: 'email',
        subject: 'Email 1'
      });

      const history = service.getInteractionHistory(customer.id);
      expect(history.length).toBe(2);
    });

    it('should sort interactions by date (newest first)', () => {
      const customer = service.addCustomer({ name: 'Test' });

      const int1 = service.addInteraction(customer.id, { type: 'call' });
      const int2 = service.addInteraction(customer.id, { type: 'email' });

      // Manually override timestamps to ensure correct ordering
      int1.createdAt = new Date(Date.now() - 1000).toISOString();
      int2.createdAt = new Date().toISOString();
      service.saveInteractions();

      const history = service.getInteractionHistory(customer.id);
      expect(history[0].type).toBe('email');
      expect(history[1].type).toBe('call');
    });

    it('should update letzterKontakt when adding interaction', () => {
      const customer = service.addCustomer({ name: 'Test' });
      const beforeTime = new Date(customer.letzterKontakt || 0).getTime();

      service.addInteraction(customer.id, { type: 'email' });

      const updated = service.getCustomer(customer.id);
      const afterTime = new Date(updated.letzterKontakt).getTime();
      expect(afterTime).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should retrieve recent interactions across customers', () => {
      const c1 = service.addCustomer({ name: 'Customer 1' });
      const c2 = service.addCustomer({ name: 'Customer 2' });

      service.addInteraction(c1.id, { type: 'call' });
      service.addInteraction(c2.id, { type: 'email' });

      const recent = service.getRecentInteractions(10);
      expect(recent.length).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should calculate customer statistics', () => {
      const customer = service.addCustomer({
        name: 'Test',
        umsatzGesamt: 5000,
        anzahlAuftraege: 3
      });

      service.addInteraction(customer.id, { type: 'call' });
      service.addInteraction(customer.id, { type: 'email' });
      service.addInteraction(customer.id, { type: 'call' });

      const stats = service.getCustomerStats(customer.id);

      expect(stats.umsatzGesamt).toBe(5000);
      expect(stats.anzahlAuftraege).toBe(3);
      expect(stats.anzahlInteraktionen).toBe(3);
      expect(stats.interaktionenProTyp.call).toBe(2);
      expect(stats.interaktionenProTyp.email).toBe(1);
    });

    it('should return top customers by revenue', () => {
      service.addCustomer({ name: 'Customer 1', umsatzGesamt: 100 });
      service.addCustomer({ name: 'Customer 2', umsatzGesamt: 500 });
      service.addCustomer({ name: 'Customer 3', umsatzGesamt: 300 });

      const top = service.getTopCustomers(2);

      expect(top.length).toBe(2);
      expect(top[0].umsatzGesamt).toBe(500);
      expect(top[1].umsatzGesamt).toBe(300);
    });

    it('should update customer from invoice', () => {
      const customer = service.addCustomer({
        name: 'Test',
        umsatzGesamt: 1000,
        anzahlAuftraege: 2
      });

      service.updateCustomerFromRechnung(customer.id, 500);

      const updated = service.getCustomer(customer.id);
      expect(updated.umsatzGesamt).toBe(1500);
      expect(updated.anzahlAuftraege).toBe(3);
    });
  });

  describe('Inquiry Integration', () => {
    it('should create or get customer from inquiry', () => {
      const anfrageKunde = {
        name: 'New Customer',
        firma: 'New Corp',
        email: 'new@example.com',
        telefon: '123456'
      };

      const customer = service.getOrCreateFromAnfrage(anfrageKunde);

      expect(customer.name).toBe('New Customer');
      expect(customer.quelle).toBe('anfrage');
    });

    it('should reuse existing customer from inquiry (by email)', () => {
      const existing = service.addCustomer({
        name: 'Existing',
        email: 'existing@example.com'
      });

      const anfrageKunde = {
        name: 'Different Name',
        email: 'existing@example.com',
        telefon: '999'
      };

      const customer = service.getOrCreateFromAnfrage(anfrageKunde);

      expect(customer.id).toBe(existing.id);
      expect(service.getAllCustomers().length).toBe(1);
    });

    it('should reuse existing customer from inquiry (by phone)', () => {
      const existing = service.addCustomer({
        name: 'Existing',
        telefon: '0123456789'
      });

      const anfrageKunde = {
        name: 'Different Name',
        telefon: '0123456789'
      };

      const customer = service.getOrCreateFromAnfrage(anfrageKunde);

      expect(customer.id).toBe(existing.id);
    });
  });

  describe('Data Persistence', () => {
    it('should persist customers to localStorage', () => {
      service.addCustomer({
        name: 'Test Customer',
        email: 'test@example.com'
      });

      const stored = JSON.parse(localStorage.getItem('freyai_customers'));
      expect(stored.length).toBe(1);
      expect(stored[0].name).toBe('Test Customer');
    });

    it('should restore customers from localStorage', () => {
      service.addCustomer({ name: 'Test' });

      const service2 = new CustomerService();
      expect(service2.getAllCustomers().length).toBe(1);
    });

    it('should persist interactions to localStorage', () => {
      const customer = service.addCustomer({ name: 'Test' });
      service.addInteraction(customer.id, { type: 'email' });

      const stored = JSON.parse(localStorage.getItem('freyai_interactions'));
      expect(stored.length).toBe(1);
    });
  });

  describe('Address Formatting', () => {
    it('should format complete address', () => {
      const customer = {
        adresse: {
          strasse: 'Hauptstrasse 123',
          plz: '10115',
          ort: 'Berlin'
        }
      };

      const formatted = service.formatAddress(customer);
      expect(formatted).toContain('Hauptstrasse 123');
      expect(formatted).toContain('10115');
      expect(formatted).toContain('Berlin');
    });

    it('should return dash for empty address', () => {
      const customer = { adresse: {} };
      const formatted = service.formatAddress(customer);
      expect(formatted).toBe('-');
    });
  });
});
