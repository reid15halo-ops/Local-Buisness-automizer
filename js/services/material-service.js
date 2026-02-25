/* ============================================
   Material Management Service
   Excel Import & Price Calculation
   ============================================ */

class MaterialService {
    constructor() {
        this.bestand = JSON.parse(localStorage.getItem('material_bestand') || '[]');
        this.stundensatz = window.companySettings?.getStundensatz?.() ?? parseFloat(localStorage.getItem('stundensatz') || '65');
        this.reservierungen = JSON.parse(localStorage.getItem('material_reservations') || '[]');
        this.lagerbewegungen = JSON.parse(localStorage.getItem('stock_movements') || '[]');
    }

    // ============================================
    // Excel Import (XLSX)
    // ============================================
    async importFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    // Parse Excel using SheetJS (loaded via CDN)
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Get first sheet
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];

                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(sheet);

                    // Map to our format
                    const materials = jsonData.map((row, index) => ({
                        id: `MAT-${Date.now()}-${index}`,
                        artikelnummer: row['Artikelnummer'] || row['Art.Nr.'] || row['ArtikelNr'] || `ART-${index + 1}`,
                        bezeichnung: row['Bezeichnung'] || row['Beschreibung'] || row['Name'] || 'Unbekannt',
                        kategorie: row['Kategorie'] || row['Gruppe'] || 'Sonstiges',
                        einheit: row['Einheit'] || row['ME'] || 'Stk.',
                        preis: parseFloat(row['Preis'] || row['EK-Preis'] || row['Einzelpreis'] || 0),
                        vkPreis: parseFloat(row['VK-Preis'] || row['Verkaufspreis'] || 0) || null,
                        bestand: parseInt(row['Bestand'] || row['Menge'] || row['Lagerbestand'] || 0),
                        minBestand: parseInt(row['Mindestbestand'] || row['Min'] || 0),
                        lieferant: row['Lieferant'] || row['Supplier'] || '',
                        importedAt: new Date().toISOString()
                    }));

                    // Calculate VK-Preis if not set (30% Aufschlag)
                    materials.forEach(m => {
                        if (!m.vkPreis && m.preis > 0) {
                            m.vkPreis = Math.round(m.preis * 1.30 * 100) / 100;
                        }
                    });

                    this.bestand = materials;
                    this.save();

                    resolve({
                        success: true,
                        count: materials.length,
                        materials: materials
                    });
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // ============================================
    // Manual Material Management
    // ============================================
    addMaterial(material) {
        material.id = `MAT-${Date.now()}`;
        material.importedAt = new Date().toISOString();
        this.bestand.push(material);
        this.save();
        return material;
    }

    updateMaterial(id, updates) {
        const index = this.bestand.findIndex(m => m.id === id);
        if (index !== -1) {
            this.bestand[index] = { ...this.bestand[index], ...updates };
            this.save();
            return this.bestand[index];
        }
        return null;
    }

    deleteMaterial(id) {
        this.bestand = this.bestand.filter(m => m.id !== id);
        this.save();
    }

    getMaterial(id) {
        const material = this.bestand.find(m => m.id === id);
        return material ? this._ensureReservationFields(material) : null;
    }

    getMaterialById(id) {
        // Alias for getMaterial for backward compatibility
        return this.getMaterial(id);
    }

    getMaterialByArtikelnummer(artikelnummer) {
        const material = this.bestand.find(m => m.artikelnummer === artikelnummer);
        return material ? this._ensureReservationFields(material) : null;
    }

    getAllMaterials() {
        // Ensure all materials have reservation fields
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
        if (!material) {return 0;}
        this._ensureReservationFields(material);
        return material.bestand - material.reserviert;
    }

    getKategorien() {
        return [...new Set(this.bestand.map(m => m.kategorie))];
    }

    searchMaterials(query) {
        const q = query.toLowerCase();
        return this.bestand.filter(m =>
            m.bezeichnung.toLowerCase().includes(q) ||
            m.artikelnummer.toLowerCase().includes(q) ||
            m.kategorie.toLowerCase().includes(q)
        );
    }

    // ============================================
    // Price Calculation
    // ============================================
    calculatePositionPrice(materialId, menge, arbeitsstunden = 0) {
        const material = this.getMaterial(materialId);
        if (!material) {return null;}

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
                // Manual position without material reference
                berechnet.push(pos);
            }
        });

        return {
            positionen: berechnet,
            materialkosten: gesamtMaterial,
            arbeitskosten: gesamtArbeit,
            netto: gesamtMaterial + gesamtArbeit,
            mwst: (gesamtMaterial + gesamtArbeit) * _getTaxRate(),
            brutto: (gesamtMaterial + gesamtArbeit) * (1 + _getTaxRate())
        };
    }

    // Smart suggestion: which materials might be needed for a job description
    suggestMaterials(beschreibung) {
        const keywords = beschreibung.toLowerCase().split(/\s+/);
        const suggestions = [];
        const matchScores = new Map();

        this.bestand.forEach(material => {
            let score = 0;
            const matKeywords = (material.bezeichnung + ' ' + material.kategorie).toLowerCase();

            keywords.forEach(kw => {
                if (kw.length > 2 && matKeywords.includes(kw)) {
                    score += 1;
                }
            });

            if (score > 0) {
                matchScores.set(material.id, score);
            }
        });

        // Sort by score
        const sorted = Array.from(matchScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return sorted.map(([id]) => this.getMaterial(id));
    }

    // ============================================
    // Stock Management
    // ============================================
    updateStock(materialId, change) {
        const material = this.getMaterial(materialId);
        if (material) {
            material.bestand = Math.max(0, material.bestand + change);
            this.save();
        }
    }

    getLowStockItems() {
        // Consider available stock (not just physical stock) when checking low stock
        return this.bestand.filter(m => {
            const verfuegbar = this.getAvailableStock(m.id);
            return verfuegbar <= m.minBestand && m.minBestand > 0;
        });
    }

    // ============================================
    // Stock Reservation System
    // ============================================

    /**
     * Reserve materials for an Auftrag
     * @param {string} auftragId - Order ID
     * @param {Array} items - [{materialId, menge}, ...]
     * @returns {Object} {success: bool, shortages: [{materialId, needed, available}, ...]}
     */
    reserveForAuftrag(auftragId, items) {
        const shortages = [];

        // First check if all items are available
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

                // Record the reservation
                const reservation = {
                    id: `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    auftragId,
                    materialId: item.materialId,
                    menge: item.menge,
                    datum: new Date().toISOString()
                };
                this.reservierungen.push(reservation);

                // Record stock movement
                this._recordStockMovement({
                    materialId: item.materialId,
                    auftragId,
                    type: 'reserved',
                    quantity: item.menge,
                    previousStock: material.bestand,
                    newStock: material.bestand // Physical stock unchanged
                });
            }
        });

        this.save();
        return { success: true, shortages: [] };
    }

    /**
     * Release reservation when order is cancelled
     * @param {string} auftragId - Order ID
     */
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

        // Remove all reservations for this auftrag
        this.reservierungen = this.reservierungen.filter(r => r.auftragId !== auftragId);
        this.save();
    }

    /**
     * Consume reserved stock when order is completed
     * @param {string} auftragId - Order ID
     * @returns {Array} Items that were consumed
     */
    consumeReserved(auftragId) {
        const reservations = this.reservierungen.filter(r => r.auftragId === auftragId);
        const consumed = [];

        reservations.forEach(res => {
            const material = this.getMaterial(res.materialId);
            if (material) {
                this._ensureReservationFields(material);

                // Reduce both bestand and reserviert by the same amount
                material.bestand = Math.max(0, material.bestand - res.menge);
                material.reserviert = Math.max(0, material.reserviert - res.menge);

                this._recordStockMovement({
                    materialId: res.materialId,
                    auftragId,
                    type: 'consumed',
                    quantity: -res.menge,
                    previousStock: material.bestand + res.menge, // Before reduction
                    newStock: material.bestand
                });

                consumed.push({
                    materialId: res.materialId,
                    menge: res.menge,
                    bezeichnung: material.bezeichnung
                });
            }
        });

        // Remove all reservations for this auftrag
        this.reservierungen = this.reservierungen.filter(r => r.auftragId !== auftragId);
        this.save();

        return consumed;
    }

    /**
     * Check if all materials in a list are available
     * @param {Array} items - [{materialId, menge}, ...]
     * @returns {Object} {allAvailable: bool, items: [{materialId, needed, available, shortage}, ...]}
     */
    checkAvailability(items) {
        const details = items.map(item => {
            const material = this.getMaterial(item.materialId);
            const available = this.getAvailableStock(item.materialId);
            const shortage = Math.max(0, item.menge - available);

            return {
                materialId: item.materialId,
                materialName: material ? material.bezeichnung : 'Unbekannt',
                needed: item.menge,
                available: available,
                shortage: shortage
            };
        });

        const allAvailable = details.every(item => item.shortage === 0);
        return { allAvailable, items: details };
    }

    /**
     * Get all reservations for an Auftrag
     * @param {string} auftragId - Order ID
     * @returns {Array} Reservation records
     */
    getReservations(auftragId) {
        return this.reservierungen.filter(r => r.auftragId === auftragId);
    }

    /**
     * Record a stock movement for audit trail
     * @private
     */
    _recordStockMovement(movement) {
        const record = {
            id: `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            materialId: movement.materialId,
            auftragId: movement.auftragId,
            type: movement.type, // 'reserved' | 'released' | 'consumed' | 'received' | 'adjusted'
            quantity: movement.quantity,
            previousStock: movement.previousStock,
            newStock: movement.newStock,
            timestamp: new Date().toISOString()
        };
        this.lagerbewegungen.push(record);
        return record;
    }

    /**
     * Get stock movement history
     * @param {string} materialId - Material ID (optional, get all if not provided)
     * @returns {Array} Stock movement records
     */
    getStockMovements(materialId = null) {
        if (materialId) {
            return this.lagerbewegungen.filter(m => m.materialId === materialId);
        }
        return this.lagerbewegungen;
    }

    /**
     * Get stock movements filtered by date range
     * @param {string} startDate - ISO date string
     * @param {string} endDate - ISO date string
     * @returns {Array} Filtered stock movements
     */
    getMovementsByDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        return this.lagerbewegungen.filter(m => {
            const mDate = new Date(m.timestamp);
            return mDate >= start && mDate <= end;
        });
    }

    /**
     * Get stock movements filtered by type
     * @param {string} type - Movement type (reserved, released, consumed, received, adjusted)
     * @returns {Array} Filtered stock movements
     */
    getMovementsByType(type) {
        return this.lagerbewegungen.filter(m => m.type === type);
    }

    /**
     * Get movement summary for a material
     * @param {string} materialId - Material ID
     * @returns {Object} {totalIn, totalOut, netChange, movementCount}
     */
    getMovementsSummary(materialId) {
        const movements = this.getStockMovements(materialId);

        const summary = {
            materialId: materialId,
            material: this.getMaterial(materialId),
            movementCount: movements.length,
            totalIncoming: 0,
            totalOutgoing: 0,
            netChange: 0,
            byType: {}
        };

        movements.forEach(m => {
            const type = m.type;
            if (!summary.byType[type]) {
                summary.byType[type] = { count: 0, quantity: 0 };
            }
            summary.byType[type].count++;
            summary.byType[type].quantity += m.quantity;

            // Positive = incoming, Negative = outgoing
            if (m.quantity > 0) {
                summary.totalIncoming += m.quantity;
            } else {
                summary.totalOutgoing += Math.abs(m.quantity);
            }
        });

        summary.netChange = summary.totalIncoming - summary.totalOutgoing;
        return summary;
    }

    /**
     * Export stock movements to CSV
     * @returns {string} CSV formatted string
     */
    exportMovementsToCSV() {
        const material = window.materialService.getAllMaterials();
        const materialMap = {};
        material.forEach(m => materialMap[m.id] = m);

        let csv = 'Datum,Material,Artikelnummer,Typ,Menge,Bestand Vorher,Bestand Nachher,Referenz,Referenz ID\n';

        this.lagerbewegungen.forEach(m => {
            const mat = materialMap[m.materialId];
            const matName = mat ? mat.bezeichnung : 'Unbekannt';
            const matArtNr = mat ? mat.artikelnummer : '';
            const refId = m.auftragId || m.id || '';

            // Escape CSV
            const escapeCsv = (str) => {
                if (!str) {return '';}
                if (typeof str !== 'string') {str = str.toString();}
                return str.includes(',') || str.includes('"') || str.includes('\n')
                    ? `"${str.replace(/"/g, '""')}"` : str;
            };

            csv += `${m.timestamp.split('T')[0]},${escapeCsv(matName)},${escapeCsv(matArtNr)},${m.type},${m.quantity},${m.previousStock},${m.newStock},${m.type},${escapeCsv(refId)}\n`;
        });

        return csv;
    }

    /**
     * Get stock movement trend (last N days)
     * @param {number} days - Number of days to analyze
     * @returns {Array} Daily summary [{date, incoming, outgoing, net}, ...]
     */
    getMovementTrend(days = 30) {
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        const trends = {};

        // Initialize all dates
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            trends[dateStr] = { date: dateStr, incoming: 0, outgoing: 0 };
        }

        // Aggregate movements
        this.lagerbewegungen.forEach(m => {
            const dateStr = m.timestamp.split('T')[0];
            if (trends[dateStr]) {
                if (m.quantity > 0) {
                    trends[dateStr].incoming += m.quantity;
                } else {
                    trends[dateStr].outgoing += Math.abs(m.quantity);
                }
            }
        });

        // Calculate net and sort
        return Object.values(trends).map(t => ({
            ...t,
            net: t.incoming - t.outgoing
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // ============================================
    // Settings
    // ============================================
    setStundensatz(satz) {
        this.stundensatz = satz;
        localStorage.setItem('stundensatz', satz.toString());
    }

    getStundensatz() {
        return this.stundensatz;
    }

    // ============================================
    // Persistence
    // ============================================
    save() {
        localStorage.setItem('material_bestand', JSON.stringify(this.bestand));
        localStorage.setItem('material_reservations', JSON.stringify(this.reservierungen));
        localStorage.setItem('stock_movements', JSON.stringify(this.lagerbewegungen));
    }

    exportToJSON() {
        return JSON.stringify(this.bestand, null, 2);
    }

    clear() {
        this.bestand = [];
        this.save();
    }

    // Load demo materials
    loadDemoMaterials() {
        this.bestand = [
            {
                id: 'MAT-DEMO-001',
                artikelnummer: 'ST-IPE-100',
                bezeichnung: 'IPE 100 Stahlträger',
                kategorie: 'Stahlträger',
                einheit: 'm',
                preis: 12.50,
                vkPreis: 18.00,
                bestand: 120,
                minBestand: 20,
                lieferant: 'Stahl AG'
            },
            {
                id: 'MAT-DEMO-002',
                artikelnummer: 'ST-IPE-200',
                bezeichnung: 'IPE 200 Stahlträger',
                kategorie: 'Stahlträger',
                einheit: 'm',
                preis: 24.00,
                vkPreis: 32.00,
                bestand: 80,
                minBestand: 15,
                lieferant: 'Stahl AG'
            },
            {
                id: 'MAT-DEMO-003',
                artikelnummer: 'RR-50x50',
                bezeichnung: 'Rechteckrohr 50x50x3',
                kategorie: 'Rohre',
                einheit: 'm',
                preis: 8.50,
                vkPreis: 12.00,
                bestand: 200,
                minBestand: 30,
                lieferant: 'Rohrstahl GmbH'
            },
            {
                id: 'MAT-DEMO-004',
                artikelnummer: 'RR-100x50',
                bezeichnung: 'Rechteckrohr 100x50x4',
                kategorie: 'Rohre',
                einheit: 'm',
                preis: 14.00,
                vkPreis: 19.00,
                bestand: 150,
                minBestand: 25,
                lieferant: 'Rohrstahl GmbH'
            },
            {
                id: 'MAT-DEMO-005',
                artikelnummer: 'BL-5MM',
                bezeichnung: 'Stahlblech 5mm',
                kategorie: 'Bleche',
                einheit: 'qm',
                preis: 45.00,
                vkPreis: 62.00,
                bestand: 50,
                minBestand: 10,
                lieferant: 'Blech Express'
            },
            {
                id: 'MAT-DEMO-006',
                artikelnummer: 'SCHR-M12',
                bezeichnung: 'Schraube M12x40 8.8',
                kategorie: 'Verbindungsmittel',
                einheit: 'Stk.',
                preis: 0.35,
                vkPreis: 0.55,
                bestand: 500,
                minBestand: 100,
                lieferant: 'Schrauben Müller'
            },
            {
                id: 'MAT-DEMO-007',
                artikelnummer: 'HYD-DN16',
                bezeichnung: 'Hydraulikschlauch DN16',
                kategorie: 'Hydraulik',
                einheit: 'm',
                preis: 15.00,
                vkPreis: 22.00,
                bestand: 100,
                minBestand: 20,
                lieferant: 'Hydraulik Pro'
            },
            {
                id: 'MAT-DEMO-008',
                artikelnummer: 'GIT-50x50',
                bezeichnung: 'Gitterrost 50x50mm',
                kategorie: 'Gitterroste',
                einheit: 'qm',
                preis: 55.00,
                vkPreis: 75.00,
                bestand: 30,
                minBestand: 5,
                lieferant: 'Gitter GmbH'
            },
            {
                id: 'MAT-DEMO-009',
                artikelnummer: 'SCHW-MAG',
                bezeichnung: 'Schweißdraht MAG 1.0mm',
                kategorie: 'Schweißzubehör',
                einheit: 'kg',
                preis: 4.50,
                vkPreis: 6.50,
                bestand: 50,
                minBestand: 15,
                lieferant: 'Schweißtechnik KG'
            },
            {
                id: 'MAT-DEMO-010',
                artikelnummer: 'FAR-RAL7016',
                bezeichnung: 'Farbe RAL 7016 Anthrazit',
                kategorie: 'Farben',
                einheit: 'l',
                preis: 18.00,
                vkPreis: 25.00,
                bestand: 40,
                minBestand: 10,
                lieferant: 'Farben Fischer'
            }
        ];
        this.save();
        return this.bestand;
    }
}

// Create global instance
window.materialService = new MaterialService();
