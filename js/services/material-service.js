/* ============================================
   Material Management Service
   Excel Import & Price Calculation
   ============================================ */

class MaterialService {
    constructor() {
        this.bestand = JSON.parse(localStorage.getItem('material_bestand') || '[]');
        this.stundensatz = parseFloat(localStorage.getItem('stundensatz') || '65');
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
        return this.bestand.find(m => m.id === id);
    }

    getMaterialByArtikelnummer(artikelnummer) {
        return this.bestand.find(m => m.artikelnummer === artikelnummer);
    }

    getAllMaterials() {
        return this.bestand;
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
        if (!material) return null;

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
            mwst: (gesamtMaterial + gesamtArbeit) * 0.19,
            brutto: (gesamtMaterial + gesamtArbeit) * 1.19
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
        return this.bestand.filter(m => m.bestand <= m.minBestand && m.minBestand > 0);
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
