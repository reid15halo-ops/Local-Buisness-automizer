/* ============================================
   Customer Service - CRM / Kundenverwaltung
   ============================================ */

class CustomerService {
    constructor() {
        try { this.customers = JSON.parse(localStorage.getItem('freyai_customers') || '[]'); } catch { this.customers = []; }
        try { this.interactions = JSON.parse(localStorage.getItem('freyai_interactions') || '[]'); } catch { this.interactions = []; }
        this._supabaseLoaded = false;
        this._loading = false;
        // Load from Supabase on init (non-blocking)
        this._loadFromSupabase();
    }

    // ---- Supabase Bridge ----

    /**
     * Convert local customer object → Supabase kunden row.
     * Maps rich fields to the flat kunden schema; extra fields go into notizen JSON block.
     */
    _toRow(c) {
        // Separate extra fields that don't have dedicated columns
        const extra = {};
        if (c.firma) {extra.firma = c.firma;}
        if (c.mobil) {extra.mobil = c.mobil;}
        if (c.tags && c.tags.length) {extra.tags = c.tags;}
        if (c.quelle) {extra.quelle = c.quelle;}
        if (c.kundentyp) {extra.kundentyp = c.kundentyp;}
        if (c.leitwegId) {extra.leitwegId = c.leitwegId;}
        if (c.ustId) {extra.ustId = c.ustId;}
        if (c.zahlungsart) {extra.zahlungsart = c.zahlungsart;}
        if (c.zahlungsziel != null) {extra.zahlungsziel = c.zahlungsziel;}
        if (c.rabatt) {extra.rabatt = c.rabatt;}
        if (c.umsatzGesamt) {extra.umsatzGesamt = c.umsatzGesamt;}
        if (c.anzahlAuftraege) {extra.anzahlAuftraege = c.anzahlAuftraege;}
        if (c.letzterKontakt) {extra.letzterKontakt = c.letzterKontakt;}
        if (c.customFields && Object.keys(c.customFields).length) {extra.customFields = c.customFields;}

        // Build notizen: preserve human-readable text, append JSON metadata
        const humanNotizen = c.notizen || '';
        const notizenWithMeta = humanNotizen + (Object.keys(extra).length ? '\n<!--META:' + JSON.stringify(extra) + '-->' : '');

        return {
            id: c.id,
            name: c.name,
            email: c.email || null,
            telefon: c.telefon || null,
            adresse: c.adresse?.strasse || '',
            stadt: c.adresse?.ort || '',
            plz: c.adresse?.plz || '',
            notizen: notizenWithMeta || null,
            kategorie: c.kundentyp || 'kunde',
            status: c.status || 'aktiv',
            created_at: c.erstelltAm || new Date().toISOString(),
            updated_at: c.aktualisiertAm || new Date().toISOString()
        };
    }

    /**
     * Convert Supabase kunden row → local customer object.
     * Extracts extra fields from the notizen JSON metadata block.
     */
    _fromRow(r) {
        // Extract metadata from notizen
        let humanNotizen = r.notizen || '';
        let extra = {};
        const metaMatch = humanNotizen.match(/\n?<!--META:(.*?)-->/s);
        if (metaMatch) {
            try { extra = JSON.parse(metaMatch[1]); } catch { /* ignore */ }
            humanNotizen = humanNotizen.replace(/\n?<!--META:.*?-->/s, '');
        }

        return {
            id: r.id,
            name: r.name || '',
            firma: extra.firma || '',
            email: r.email || '',
            telefon: r.telefon || '',
            mobil: extra.mobil || '',
            adresse: {
                strasse: r.adresse || '',
                plz: r.plz || '',
                ort: r.stadt || ''
            },
            notizen: humanNotizen,
            tags: extra.tags || [],
            quelle: extra.quelle || 'manual',
            status: r.status || 'aktiv',
            umsatzGesamt: extra.umsatzGesamt || 0,
            anzahlAuftraege: extra.anzahlAuftraege || 0,
            erstelltAm: r.created_at || new Date().toISOString(),
            aktualisiertAm: r.updated_at || new Date().toISOString(),
            letzterKontakt: extra.letzterKontakt || null,
            kundentyp: extra.kundentyp || r.kategorie || 'privat',
            leitwegId: extra.leitwegId || '',
            ustId: extra.ustId || '',
            zahlungsart: extra.zahlungsart || 'rechnung',
            zahlungsziel: extra.zahlungsziel ?? 14,
            rabatt: extra.rabatt || 0,
            customFields: extra.customFields || {}
        };
    }

    /**
     * Load customers from Supabase (via dbService), merge with localStorage cache.
     * Supabase data wins on conflict (by id). Non-blocking on construction.
     */
    async _loadFromSupabase() {
        if (this._loading) {return;}
        this._loading = true;
        try {
            if (!window.dbService) {return;}
            const rows = await window.dbService.getCustomers();
            if (!rows || rows.length === 0) {return;}

            const supabaseCustomers = rows.map(r => this._fromRow(r));

            // Snapshot current local IDs to detect CRUD ops that happened during fetch
            const currentLocalIds = new Set(this.customers.map(c => c.id));
            const supabaseIds = new Set(supabaseCustomers.map(c => c.id));

            // Keep local-only entries (not in Supabase)
            const localOnly = this.customers.filter(c => !supabaseIds.has(c.id));

            // Keep customers added locally during the async fetch (not in original snapshot)
            // These are new CRUD operations that shouldn't be overwritten
            this.customers = [...supabaseCustomers, ...localOnly];
            this.save(); // Update localStorage cache
            this._supabaseLoaded = true;

            // Sync local-only entries up to Supabase
            for (const c of localOnly) {
                this._syncToSupabase(c);
            }

            console.debug(`[CustomerService] Loaded ${supabaseCustomers.length} from Supabase, ${localOnly.length} local-only`);
        } catch (err) {
            console.warn('[CustomerService] Supabase load failed, using localStorage:', err.message);
        } finally {
            this._loading = false;
        }
    }

    /**
     * Fire-and-forget sync of a single customer to Supabase.
     */
    async _syncToSupabase(customer) {
        try {
            if (!window.dbService) {return;}
            const row = this._toRow(customer);
            await window.dbService.saveCustomer(row);
        } catch (err) {
            console.warn('[CustomerService] Supabase sync failed for', customer.id, err.message);
        }
    }

    /**
     * Fire-and-forget delete from Supabase.
     */
    async _deleteFromSupabase(id) {
        try {
            if (!window.dbService) {return;}
            await window.dbService.deleteCustomer(id);
        } catch (err) {
            console.warn('[CustomerService] Supabase delete failed for', id, err.message);
        }
    }

    // Customer CRUD
    addCustomer(customer) {
        // Check for duplicates
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
            quelle: customer.quelle || 'manual', // manual, email, import
            status: customer.status || 'aktiv', // aktiv, inaktiv, gesperrt
            umsatzGesamt: customer.umsatzGesamt || 0,
            anzahlAuftraege: customer.anzahlAuftraege || 0,
            erstelltAm: customer.erstelltAm || new Date().toISOString(),
            aktualisiertAm: new Date().toISOString(),
            letzterKontakt: customer.letzterKontakt || null,
            kundentyp: customer.kundentyp || 'privat', // privat, geschaeftlich, behoerde
            leitwegId: customer.leitwegId || '',
            ustId: customer.ustId || '',
            zahlungsart: customer.zahlungsart || 'rechnung', // rechnung, bar, vorkasse
            zahlungsziel: customer.zahlungsziel ?? 14, // Tage
            rabatt: customer.rabatt || 0, // Prozent
            customFields: customer.customFields || {}
        };

        this.customers.push(newCustomer);
        this.save();
        this._syncToSupabase(newCustomer);
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
            this._syncToSupabase(this.customers[index]);
            return this.customers[index];
        }
        return null;
    }

    deleteCustomer(id) {
        const customer = this.getCustomer(id);
        if (!customer) { return; }

        // Use trash service for soft-delete + undo if available
        if (window.trashService) {
            const result = window.trashService.softDelete('kunde', customer);
            if (result && result.blocked) {
                // Orphan protection: show warning, don't delete
                if (window.confirmDialogService) {
                    window.confirmDialogService.showConfirmDialog({
                        title: 'Kunde kann nicht gelöscht werden',
                        message: result.reason,
                        confirmText: 'Verstanden',
                        cancelText: '',
                        onConfirm: () => {}
                    });
                } else if (window.ErrorDisplay) {
                    window.ErrorDisplay.showWarning(result.reason);
                }
                return;
            }
            // trashService already removed from this.customers and saved
            // Reload from localStorage to stay in sync
            this.customers = StorageUtils.getJSON('freyai_customers', [], { service: 'customerService' });
            this._deleteFromSupabase(id);
            return;
        }

        // Fallback: hard delete (only if trashService not loaded)
        this.customers = this.customers.filter(c => c.id !== id);
        this.save();
        this._deleteFromSupabase(id);
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

    // Duplicate Detection
    findDuplicates(customer) {
        return this.customers.filter(c => {
            if (customer.email && c.email && c.email.toLowerCase() === customer.email.toLowerCase()) {return true;}
            if (customer.telefon && c.telefon && c.telefon.replace(/\D/g, '') === customer.telefon.replace(/\D/g, '')) {return true;}
            if (customer.name && c.name && c.name.toLowerCase() === customer.name.toLowerCase() &&
                customer.firma && c.firma && c.firma.toLowerCase() === customer.firma.toLowerCase()) {return true;}
            return false;
        });
    }

    mergeCustomers(primaryId, secondaryId) {
        const primary = this.getCustomer(primaryId);
        const secondary = this.getCustomer(secondaryId);
        if (!primary || !secondary) {return null;}

        // Merge data: keep primary, fill gaps from secondary
        // Strip META blocks before concatenating notizen (they get regenerated by _toRow)
        const stripMeta = (s) => (s || '').replace(/\n?<!--META:.*?-->/s, '').trim();
        const merged = {
            ...primary,
            telefon: primary.telefon || secondary.telefon,
            mobil: primary.mobil || secondary.mobil,
            email: primary.email || secondary.email,
            notizen: [stripMeta(primary.notizen), stripMeta(secondary.notizen)].filter(Boolean).join('\n---\n'),
            tags: [...new Set([...(primary.tags || []), ...(secondary.tags || [])])],
            umsatzGesamt: primary.umsatzGesamt + secondary.umsatzGesamt,
            anzahlAuftraege: primary.anzahlAuftraege + secondary.anzahlAuftraege
        };

        // Reassign interactions
        this.interactions.forEach(i => {
            if (i.customerId === secondaryId) {i.customerId = primaryId;}
        });

        this.updateCustomer(primaryId, merged);
        this.deleteCustomer(secondaryId);
        this.saveInteractions();
        return merged;
    }

    // Interaction History
    addInteraction(customerId, interaction) {
        const newInteraction = {
            id: 'int-' + Date.now(),
            customerId: customerId,
            type: interaction.type, // call, email, meeting, note, auftrag, rechnung
            subject: interaction.subject || '',
            content: interaction.content || '',
            direction: interaction.direction || 'outbound', // inbound, outbound
            duration: interaction.duration || null, // for calls
            createdAt: new Date().toISOString(),
            createdBy: interaction.createdBy || 'System'
        };

        this.interactions.push(newInteraction);

        // Update last contact
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

    // Import Functions
    importFromCSV(csvContent) {
        const lines = csvContent.split('\n');
        if (lines.length < 2) {return { success: 0, failed: 0 };}

        const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
        const imported = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(';');
            if (values.length < 2) {continue;}

            const customer = {};
            headers.forEach((header, idx) => {
                const value = values[idx]?.trim() || '';
                if (header.includes('name')) {customer.name = value;}
                else if (header.includes('firma') || header.includes('company')) {customer.firma = value;}
                else if (header.includes('email') || header.includes('mail')) {customer.email = value;}
                else if (header.includes('tel') || header.includes('phone')) {customer.telefon = value;}
                else if (header.includes('mobil') || header.includes('handy')) {customer.mobil = value;}
                else if (header.includes('straße') || header.includes('strasse') || header.includes('street')) {customer.strasse = value;}
                else if (header.includes('plz') || header.includes('zip')) {customer.plz = value;}
                else if (header.includes('ort') || header.includes('city') || header.includes('stadt')) {customer.ort = value;}
            });

            if (customer.name || customer.firma) {
                customer.quelle = 'csv-import';
                imported.push(this.addCustomer(customer));
            }
        }

        return { success: imported.length, customers: imported };
    }

    importFromVCard(vcardContent) {
        const contacts = vcardContent.split('BEGIN:VCARD').filter(c => c.trim());
        const imported = [];

        contacts.forEach(vcard => {
            const customer = { quelle: 'vcard-import' };
            const lines = vcard.split('\n');

            lines.forEach(line => {
                if (line.startsWith('FN:')) {customer.name = line.replace('FN:', '').trim();}
                else if (line.startsWith('ORG:')) {customer.firma = line.replace('ORG:', '').trim();}
                else if (line.startsWith('EMAIL')) {customer.email = line.split(':').pop().trim();}
                else if (line.startsWith('TEL;TYPE=CELL')) {customer.mobil = line.split(':').pop().trim();}
                else if (line.startsWith('TEL')) {customer.telefon = line.split(':').pop().trim();}
                else if (line.startsWith('ADR')) {
                    const parts = line.split(':').pop().split(';');
                    customer.strasse = parts[2] || '';
                    customer.ort = parts[3] || '';
                    customer.plz = parts[5] || '';
                }
            });

            if (customer.name || customer.firma) {
                imported.push(this.addCustomer(customer));
            }
        });

        return { success: imported.length, customers: imported };
    }

    // Search
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

    // Statistics
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

    // Update from Auftrag/Rechnung
    updateCustomerFromRechnung(customerId, rechnungsSumme) {
        const customer = this.getCustomer(customerId);
        if (customer) {
            this.updateCustomer(customerId, {
                umsatzGesamt: (customer.umsatzGesamt || 0) + rechnungsSumme,
                anzahlAuftraege: (customer.anzahlAuftraege || 0) + 1
            });
        }
    }

    // Or Create from Anfrage data
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

    // Helpers
    generateId() { return 'cust-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11); }

    formatAddress(customer) {
        const a = customer.adresse || {};
        if (!a.strasse && !a.plz && !a.ort) {return '-';}
        return `${a.strasse}, ${a.plz} ${a.ort}`.trim();
    }

    // Persistence
    save() { this._safeSetItem('freyai_customers', this.customers); }
    saveInteractions() { this._safeSetItem('freyai_interactions', this.interactions); }

    _safeSetItem(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.warn('localStorage quota exceeded for', key);
                if (window.showToast) {window.showToast('Speicher voll — bitte Daten exportieren', 'warning');}
            }
        }
    }
}

window.customerService = new CustomerService();
