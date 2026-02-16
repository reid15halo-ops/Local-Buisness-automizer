/* ============================================
   Customer Service - CRM / Kundenverwaltung
   ============================================ */

class CustomerService {
    constructor() {
        this.customers = JSON.parse(localStorage.getItem('mhs_customers') || '[]');
        this.interactions = JSON.parse(localStorage.getItem('mhs_interactions') || '[]');
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
            zahlungsart: customer.zahlungsart || 'rechnung', // rechnung, bar, vorkasse
            zahlungsziel: customer.zahlungsziel || 14, // Tage
            rabatt: customer.rabatt || 0, // Prozent
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
            this.customers = JSON.parse(localStorage.getItem('mhs_customers') || '[]');
            return;
        }

        // Fallback: hard delete (only if trashService not loaded)
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
    generateId() { return 'cust-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9); }

    formatAddress(customer) {
        const a = customer.adresse || {};
        if (!a.strasse && !a.plz && !a.ort) {return '-';}
        return `${a.strasse}, ${a.plz} ${a.ort}`.trim();
    }

    // Persistence
    save() { localStorage.setItem('mhs_customers', JSON.stringify(this.customers)); }
    saveInteractions() { localStorage.setItem('mhs_interactions', JSON.stringify(this.interactions)); }
}

window.customerService = new CustomerService();
