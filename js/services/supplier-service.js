/* ============================================
   Supplier Price Comparison Service
   Compare material prices across suppliers
   to find the best deals for Handwerker.
   ============================================ */

class SupplierService {
    constructor() {
        this.suppliers = JSON.parse(localStorage.getItem('mhs_suppliers') || '[]');
        this.prices = JSON.parse(localStorage.getItem('mhs_supplier_prices') || '[]');
    }

    // ============================================
    // ID Generation
    // ============================================

    _generateId(prefix) {
        const ts = Date.now();
        const rand = Math.random().toString(36).substr(2, 9);
        return `${prefix}-${ts}-${rand}`;
    }

    // ============================================
    // Persistence
    // ============================================

    _saveSuppliers() {
        localStorage.setItem('mhs_suppliers', JSON.stringify(this.suppliers));
    }

    _savePrices() {
        localStorage.setItem('mhs_supplier_prices', JSON.stringify(this.prices));
    }

    _save() {
        this._saveSuppliers();
        this._savePrices();
    }

    // ============================================
    // Supplier CRUD
    // ============================================

    /**
     * Add a new supplier
     * @param {Object} data - Supplier data
     * @returns {Object} Created supplier
     */
    addSupplier(data) {
        const supplier = {
            id: this._generateId('SUP'),
            name: data.name || '',
            type: data.type || 'grosshandel',

            // Contact
            contactPerson: data.contactPerson || '',
            phone: data.phone || '',
            email: data.email || '',
            website: data.website || '',

            // Address
            address: data.address || '',
            city: data.city || '',
            postalCode: data.postalCode || '',

            // Business terms
            customerNumber: data.customerNumber || '',
            paymentTerms: data.paymentTerms || '',
            discountPct: parseFloat(data.discountPct) || 0,
            freeShippingMin: parseFloat(data.freeShippingMin) || 0,
            deliveryDays: parseInt(data.deliveryDays) || 0,

            // Rating
            rating: parseInt(data.rating) || 0,
            notes: data.notes || '',

            status: data.status || 'aktiv',
            createdAt: new Date().toISOString()
        };

        this.suppliers.push(supplier);
        this._saveSuppliers();
        return supplier;
    }

    /**
     * Get all suppliers
     * @returns {Array} All suppliers
     */
    getSuppliers() {
        return [...this.suppliers];
    }

    /**
     * Get supplier by ID
     * @param {string} id - Supplier ID
     * @returns {Object|null} Supplier or null
     */
    getSupplier(id) {
        return this.suppliers.find(s => s.id === id) || null;
    }

    /**
     * Update a supplier
     * @param {string} id - Supplier ID
     * @param {Object} data - Fields to update
     * @returns {Object|null} Updated supplier or null
     */
    updateSupplier(id, data) {
        const index = this.suppliers.findIndex(s => s.id === id);
        if (index === -1) { return null; }

        // Preserve id and createdAt
        const existing = this.suppliers[index];
        this.suppliers[index] = {
            ...existing,
            ...data,
            id: existing.id,
            createdAt: existing.createdAt
        };

        // Normalise numeric fields
        const s = this.suppliers[index];
        s.discountPct = parseFloat(s.discountPct) || 0;
        s.freeShippingMin = parseFloat(s.freeShippingMin) || 0;
        s.deliveryDays = parseInt(s.deliveryDays) || 0;
        s.rating = parseInt(s.rating) || 0;

        this._saveSuppliers();
        return this.suppliers[index];
    }

    /**
     * Remove a supplier and all associated prices
     * @param {string} id - Supplier ID
     * @returns {boolean} Success
     */
    removeSupplier(id) {
        const index = this.suppliers.findIndex(s => s.id === id);
        if (index === -1) { return false; }

        this.suppliers.splice(index, 1);
        // Also remove all prices from this supplier
        this.prices = this.prices.filter(p => p.supplierId !== id);
        this._save();
        return true;
    }

    /**
     * Get only active suppliers
     * @returns {Array} Active suppliers
     */
    getActiveSuppliers() {
        return this.suppliers.filter(s => s.status === 'aktiv');
    }

    // ============================================
    // Price CRUD
    // ============================================

    /**
     * Add a price entry
     * @param {Object} data - Price data
     * @returns {Object} Created price entry
     */
    addPrice(data) {
        const supplier = this.getSupplier(data.supplierId);

        const entry = {
            id: this._generateId('PRC'),
            supplierId: data.supplierId || '',
            supplierName: supplier ? supplier.name : (data.supplierName || ''),

            // Product
            productName: data.productName || '',
            productCategory: data.productCategory || '',
            articleNumber: data.articleNumber || '',
            manufacturer: data.manufacturer || '',

            // Pricing
            unitPrice: parseFloat(data.unitPrice) || 0,
            unit: data.unit || 'Stk',
            minOrderQty: parseInt(data.minOrderQty) || 1,
            bulkPrice: parseFloat(data.bulkPrice) || 0,
            bulkMinQty: parseInt(data.bulkMinQty) || 0,

            // Validity
            validFrom: data.validFrom || new Date().toISOString().split('T')[0],
            validUntil: data.validUntil || '',

            // Source
            source: data.source || 'manuell',

            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.prices.push(entry);
        this._savePrices();
        return entry;
    }

    /**
     * Get all prices for a supplier
     * @param {string} supplierId - Supplier ID
     * @returns {Array} Price entries
     */
    getPrices(supplierId) {
        return this.prices.filter(p => p.supplierId === supplierId);
    }

    /**
     * Get all prices for a product across suppliers
     * @param {string} productName - Product name (case-insensitive match)
     * @returns {Array} Price entries
     */
    getPricesByProduct(productName) {
        const query = productName.toLowerCase().trim();
        return this.prices.filter(p =>
            p.productName.toLowerCase().trim() === query
        );
    }

    /**
     * Update a price entry
     * @param {string} id - Price ID
     * @param {Object} data - Fields to update
     * @returns {Object|null} Updated price entry or null
     */
    updatePrice(id, data) {
        const index = this.prices.findIndex(p => p.id === id);
        if (index === -1) { return null; }

        const existing = this.prices[index];
        this.prices[index] = {
            ...existing,
            ...data,
            id: existing.id,
            supplierId: existing.supplierId,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        };

        // Normalise numeric fields
        const p = this.prices[index];
        p.unitPrice = parseFloat(p.unitPrice) || 0;
        p.minOrderQty = parseInt(p.minOrderQty) || 1;
        p.bulkPrice = parseFloat(p.bulkPrice) || 0;
        p.bulkMinQty = parseInt(p.bulkMinQty) || 0;

        // Update supplierName if supplier still exists
        const supplier = this.getSupplier(p.supplierId);
        if (supplier) {
            p.supplierName = supplier.name;
        }

        this._savePrices();
        return this.prices[index];
    }

    /**
     * Remove a price entry
     * @param {string} id - Price ID
     * @returns {boolean} Success
     */
    removePrice(id) {
        const index = this.prices.findIndex(p => p.id === id);
        if (index === -1) { return false; }

        this.prices.splice(index, 1);
        this._savePrices();
        return true;
    }

    // ============================================
    // Comparison
    // ============================================

    /**
     * Compare prices for a product across all suppliers
     * Finds all prices for this product, sorted by unit price ascending (cheapest first)
     * @param {string} productName - Product name
     * @returns {Object} PriceComparison object
     */
    compareProduct(productName) {
        const entries = this.getPricesByProduct(productName);

        // Sort by unit price ascending
        const sorted = [...entries].sort((a, b) => a.unitPrice - b.unitPrice);

        const bestPrice = sorted.length > 0
            ? { supplierId: sorted[0].supplierId, unitPrice: sorted[0].unitPrice }
            : null;

        return {
            id: this._generateId('CMP'),
            productName: productName,
            entries: sorted,
            bestPrice: bestPrice,
            savedAt: new Date().toISOString()
        };
    }

    /**
     * Find the cheapest supplier for a product
     * @param {string} productName - Product name
     * @returns {Object|null} { supplierId, supplierName, unitPrice, priceEntry } or null
     */
    findBestPrice(productName) {
        const comparison = this.compareProduct(productName);
        if (!comparison.entries.length) { return null; }

        const best = comparison.entries[0];
        const supplier = this.getSupplier(best.supplierId);

        return {
            supplierId: best.supplierId,
            supplierName: supplier ? supplier.name : best.supplierName,
            unitPrice: best.unitPrice,
            priceEntry: best
        };
    }

    // ============================================
    // Categories & Products
    // ============================================

    /**
     * Get unique product categories
     * @returns {Array<string>} Category names
     */
    getCategories() {
        const cats = new Set();
        this.prices.forEach(p => {
            if (p.productCategory) {
                cats.add(p.productCategory);
            }
        });
        return [...cats].sort();
    }

    /**
     * Get unique products in a category
     * @param {string} category - Category name
     * @returns {Array<string>} Product names
     */
    getProductsByCategory(category) {
        const products = new Set();
        this.prices
            .filter(p => p.productCategory === category)
            .forEach(p => products.add(p.productName));
        return [...products].sort();
    }

    /**
     * Get all unique product names across all prices
     * @returns {Array<string>} Product names
     */
    getAllProductNames() {
        const names = new Set();
        this.prices.forEach(p => {
            if (p.productName) {
                names.add(p.productName);
            }
        });
        return [...names].sort();
    }

    // ============================================
    // Shopping List / Order Optimizer
    // ============================================

    /**
     * Create an optimised shopping list from requested items.
     * Finds the best supplier for each item and groups by supplier.
     * @param {Array} items - [{productName, quantity}]
     * @returns {Object} { groups: [{supplier, items, subtotal}], grandTotal, savings }
     */
    createShoppingList(items) {
        const supplierGroups = {};
        let grandTotal = 0;
        let worstTotal = 0;

        items.forEach(item => {
            const comparison = this.compareProduct(item.productName);
            if (comparison.entries.length === 0) {
                // No price data available - put in "unknown" group
                if (!supplierGroups['_unknown']) {
                    supplierGroups['_unknown'] = {
                        supplier: null,
                        supplierName: 'Kein Lieferant gefunden',
                        items: [],
                        subtotal: 0
                    };
                }
                supplierGroups['_unknown'].items.push({
                    productName: item.productName,
                    quantity: item.quantity,
                    unitPrice: 0,
                    total: 0,
                    noPriceData: true
                });
                return;
            }

            const best = comparison.entries[0];
            const worst = comparison.entries[comparison.entries.length - 1];
            const total = best.unitPrice * item.quantity;
            const worstItemTotal = worst.unitPrice * item.quantity;

            grandTotal += total;
            worstTotal += worstItemTotal;

            if (!supplierGroups[best.supplierId]) {
                const supplier = this.getSupplier(best.supplierId);
                supplierGroups[best.supplierId] = {
                    supplier: supplier,
                    supplierName: supplier ? supplier.name : best.supplierName,
                    items: [],
                    subtotal: 0
                };
            }

            supplierGroups[best.supplierId].items.push({
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: best.unitPrice,
                unit: best.unit,
                total: total,
                priceEntry: best
            });

            supplierGroups[best.supplierId].subtotal += total;
        });

        const groups = Object.values(supplierGroups);
        const savings = worstTotal - grandTotal;

        return {
            groups: groups,
            grandTotal: grandTotal,
            savings: Math.max(0, savings)
        };
    }

    // ============================================
    // Statistics & Reports
    // ============================================

    /**
     * Get estimated savings from using cheapest suppliers
     * @returns {Object} { totalProducts, productsWithMultipleSuppliers, potentialSavings, details }
     */
    getSavingsReport() {
        const productNames = this.getAllProductNames();
        let potentialSavings = 0;
        const details = [];

        productNames.forEach(name => {
            const comparison = this.compareProduct(name);
            if (comparison.entries.length < 2) { return; }

            const cheapest = comparison.entries[0];
            const mostExpensive = comparison.entries[comparison.entries.length - 1];
            const diff = mostExpensive.unitPrice - cheapest.unitPrice;

            if (diff > 0) {
                potentialSavings += diff;
                details.push({
                    productName: name,
                    cheapestSupplier: cheapest.supplierName,
                    cheapestPrice: cheapest.unitPrice,
                    mostExpensiveSupplier: mostExpensive.supplierName,
                    mostExpensivePrice: mostExpensive.unitPrice,
                    savingsPerUnit: diff,
                    unit: cheapest.unit
                });
            }
        });

        return {
            totalProducts: productNames.length,
            productsWithMultipleSuppliers: details.length,
            potentialSavings: potentialSavings,
            details: details.sort((a, b) => b.savingsPerUnit - a.savingsPerUnit)
        };
    }

    /**
     * Get price history for a product (all price entries sorted by date)
     * @param {string} productName - Product name
     * @returns {Array} Price entries sorted by createdAt
     */
    getPriceHistory(productName) {
        const query = productName.toLowerCase().trim();
        return this.prices
            .filter(p => p.productName.toLowerCase().trim() === query)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    // ============================================
    // Export
    // ============================================

    /**
     * Export all prices from one supplier as CSV
     * @param {string} supplierId - Supplier ID
     * @returns {string} CSV string
     */
    exportPriceList(supplierId) {
        const supplier = this.getSupplier(supplierId);
        const prices = this.getPrices(supplierId);
        const supplierName = supplier ? supplier.name : 'Unbekannt';

        let csv = `Preisliste: ${supplierName}\n`;
        csv += 'Produkt,Kategorie,Artikelnummer,Hersteller,Einzelpreis,Einheit,Mengenpreis,Ab Menge,Gueltig ab,Gueltig bis\n';

        prices.forEach(p => {
            const escapeCsv = (str) => {
                if (!str) { return ''; }
                str = String(str);
                return str.includes(',') || str.includes('"') || str.includes('\n')
                    ? `"${str.replace(/"/g, '""')}"` : str;
            };

            csv += [
                escapeCsv(p.productName),
                escapeCsv(p.productCategory),
                escapeCsv(p.articleNumber),
                escapeCsv(p.manufacturer),
                p.unitPrice.toFixed(2),
                p.unit,
                p.bulkPrice ? p.bulkPrice.toFixed(2) : '',
                p.bulkMinQty || '',
                p.validFrom || '',
                p.validUntil || ''
            ].join(',') + '\n';
        });

        return csv;
    }

    /**
     * Export comparison table for a product as CSV
     * @param {string} productName - Product name
     * @returns {string} CSV string
     */
    exportComparison(productName) {
        const comparison = this.compareProduct(productName);

        let csv = `Preisvergleich: ${productName}\n`;
        csv += 'Lieferant,Einzelpreis,Einheit,Artikelnummer,Mengenpreis,Ab Menge,Gueltig bis,Quelle\n';

        comparison.entries.forEach(p => {
            const escapeCsv = (str) => {
                if (!str) { return ''; }
                str = String(str);
                return str.includes(',') || str.includes('"') || str.includes('\n')
                    ? `"${str.replace(/"/g, '""')}"` : str;
            };

            csv += [
                escapeCsv(p.supplierName),
                p.unitPrice.toFixed(2),
                p.unit,
                escapeCsv(p.articleNumber),
                p.bulkPrice ? p.bulkPrice.toFixed(2) : '',
                p.bulkMinQty || '',
                p.validUntil || '',
                p.source || ''
            ].join(',') + '\n';
        });

        return csv;
    }
}

// Create global instance
window.supplierService = new SupplierService();
