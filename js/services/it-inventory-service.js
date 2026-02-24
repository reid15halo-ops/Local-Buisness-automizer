/* ============================================
   Home IT Inventory Service
   Track and manage home IT components
   ============================================ */

class ITInventoryService {
    constructor() {
        this.STORAGE_KEY = 'home_it_inventory';
        this.devices = this._load();

        if (this.devices.length === 0) {
            this.devices = this._getDemoData();
            this._save();
        }
    }

    // ── Persistence ────────────────────────────────

    _load() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
        } catch {
            return [];
        }
    }

    _save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.devices));
    }

    // ── CRUD ───────────────────────────────────────

    getAll(filters = {}) {
        let list = [...this.devices];
        if (filters.category) list = list.filter(d => d.category === filters.category);
        if (filters.status)   list = list.filter(d => d.status === filters.status);
        if (filters.location) list = list.filter(d => d.location === filters.location);
        if (filters.query) {
            const q = filters.query.toLowerCase();
            list = list.filter(d =>
                d.name.toLowerCase().includes(q) ||
                (d.brand || '').toLowerCase().includes(q) ||
                (d.model || '').toLowerCase().includes(q)
            );
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }

    getById(id) {
        return this.devices.find(d => d.id === id) || null;
    }

    add(data) {
        const device = {
            id: 'IT-' + Date.now(),
            name: data.name || 'Unnamed Device',
            category: data.category || 'other',
            brand: data.brand || '',
            model: data.model || '',
            serialNumber: data.serialNumber || '',
            purchaseDate: data.purchaseDate || '',
            purchasePrice: parseFloat(data.purchasePrice) || 0,
            warrantyMonths: parseInt(data.warrantyMonths) || 24,
            location: data.location || '',
            status: data.status || 'active',
            ipAddress: data.ipAddress || '',
            macAddress: data.macAddress || '',
            osVersion: data.osVersion || '',
            notes: data.notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        device.warrantyExpiry = this._calcWarrantyExpiry(device.purchaseDate, device.warrantyMonths);
        this.devices.push(device);
        this._save();
        return device;
    }

    update(id, data) {
        const idx = this.devices.findIndex(d => d.id === id);
        if (idx === -1) return null;
        Object.assign(this.devices[idx], data, { updatedAt: new Date().toISOString() });
        this.devices[idx].warrantyExpiry = this._calcWarrantyExpiry(
            this.devices[idx].purchaseDate,
            this.devices[idx].warrantyMonths
        );
        this._save();
        return this.devices[idx];
    }

    remove(id) {
        const before = this.devices.length;
        this.devices = this.devices.filter(d => d.id !== id);
        if (this.devices.length < before) { this._save(); return true; }
        return false;
    }

    // ── Statistics ─────────────────────────────────

    getSummary() {
        const today = new Date().toISOString().split('T')[0];
        const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        const in90Days = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

        const byCategory = {};
        const byStatus = {};
        const byLocation = {};
        let totalValue = 0;
        let warrantyExpiringSoon = 0;
        let warrantyExpired = 0;

        this.devices.forEach(d => {
            byCategory[d.category] = (byCategory[d.category] || 0) + 1;
            byStatus[d.status]     = (byStatus[d.status] || 0) + 1;
            if (d.location) byLocation[d.location] = (byLocation[d.location] || 0) + 1;
            totalValue += d.purchasePrice || 0;

            if (d.warrantyExpiry) {
                if (d.warrantyExpiry < today) warrantyExpired++;
                else if (d.warrantyExpiry <= in90Days) warrantyExpiringSoon++;
            }
        });

        return {
            total: this.devices.length,
            active: byStatus['active'] || 0,
            inactive: byStatus['inactive'] || 0,
            repair: byStatus['repair'] || 0,
            retired: byStatus['retired'] || 0,
            totalValue,
            byCategory,
            byStatus,
            byLocation,
            warrantyExpiringSoon,
            warrantyExpired,
            warrantyExpiringIn30Days: this.devices.filter(d =>
                d.warrantyExpiry && d.warrantyExpiry >= today && d.warrantyExpiry <= in30Days
            ).length
        };
    }

    getWarrantyAlerts() {
        const today = new Date().toISOString().split('T')[0];
        const in90Days = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
        return this.devices.filter(d =>
            d.warrantyExpiry && d.warrantyExpiry >= today && d.warrantyExpiry <= in90Days
        ).sort((a, b) => a.warrantyExpiry.localeCompare(b.warrantyExpiry));
    }

    // ── Helpers ────────────────────────────────────

    _calcWarrantyExpiry(purchaseDate, months) {
        if (!purchaseDate || !months) return '';
        const d = new Date(purchaseDate);
        d.setMonth(d.getMonth() + parseInt(months));
        return d.toISOString().split('T')[0];
    }

    getCategoryLabel(cat) {
        const map = {
            computer: 'Desktop PC',
            laptop: 'Laptop',
            phone: 'Smartphone',
            tablet: 'Tablet',
            router: 'Router / Netzwerk',
            switch: 'Switch / Hub',
            nas: 'NAS / Server',
            'smart-home': 'Smart Home',
            gaming: 'Gaming',
            printer: 'Drucker',
            monitor: 'Monitor',
            other: 'Sonstiges'
        };
        return map[cat] || cat;
    }

    getCategoryIcon(cat) {
        const map = {
            computer: '🖥️',
            laptop: '💻',
            phone: '📱',
            tablet: '📱',
            router: '📡',
            switch: '🔌',
            nas: '🗄️',
            'smart-home': '🏠',
            gaming: '🎮',
            printer: '🖨️',
            monitor: '🖥️',
            other: '🔧'
        };
        return map[cat] || '🔧';
    }

    getStatusLabel(status) {
        const map = {
            active: 'Aktiv',
            inactive: 'Inaktiv',
            repair: 'In Reparatur',
            retired: 'Ausgemustert'
        };
        return map[status] || status;
    }

    getStatusColor(status) {
        const map = {
            active: 'success',
            inactive: 'warning',
            repair: 'warning',
            retired: 'muted'
        };
        return map[status] || 'muted';
    }

    // ── Demo Data ──────────────────────────────────

    _getDemoData() {
        const make = (overrides) => {
            const base = {
                id: 'IT-' + Date.now() + Math.random().toString(36).slice(2, 6),
                purchasePrice: 0,
                warrantyMonths: 24,
                serialNumber: '',
                ipAddress: '',
                macAddress: '',
                osVersion: '',
                notes: '',
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const device = Object.assign(base, overrides);
            device.warrantyExpiry = this._calcWarrantyExpiry(device.purchaseDate, device.warrantyMonths);
            return device;
        };

        return [
            make({
                id: 'IT-demo-001',
                name: 'FritzBox 7590 AX',
                category: 'router',
                brand: 'AVM',
                model: 'FRITZ!Box 7590 AX',
                location: 'Wohnzimmer',
                purchaseDate: '2022-03-15',
                purchasePrice: 249,
                warrantyMonths: 24,
                ipAddress: '192.168.178.1',
                notes: 'Haupt-Router, DSL-Anschluss'
            }),
            make({
                id: 'IT-demo-002',
                name: 'Synology DS923+',
                category: 'nas',
                brand: 'Synology',
                model: 'DiskStation DS923+',
                location: 'Büro',
                purchaseDate: '2023-06-10',
                purchasePrice: 549,
                warrantyMonths: 36,
                ipAddress: '192.168.178.20',
                notes: '4-Bay NAS, 2×4TB, Backup & Medien'
            }),
            make({
                id: 'IT-demo-003',
                name: 'MacBook Pro 14"',
                category: 'laptop',
                brand: 'Apple',
                model: 'MacBook Pro 14" M2 Pro',
                location: 'Büro',
                purchaseDate: '2023-01-20',
                purchasePrice: 2199,
                warrantyMonths: 12,
                osVersion: 'macOS 14 Sonoma',
                serialNumber: 'FVFXYZ123456',
                notes: 'Haupt-Arbeitsgerät'
            }),
            make({
                id: 'IT-demo-004',
                name: 'iPhone 15 Pro',
                category: 'phone',
                brand: 'Apple',
                model: 'iPhone 15 Pro 256GB',
                location: 'Mobil',
                purchaseDate: '2023-09-22',
                purchasePrice: 1299,
                warrantyMonths: 12,
                osVersion: 'iOS 17',
                serialNumber: 'F4GABCDEF012'
            }),
            make({
                id: 'IT-demo-005',
                name: 'iPad Air 5',
                category: 'tablet',
                brand: 'Apple',
                model: 'iPad Air 5th Gen 64GB',
                location: 'Schlafzimmer',
                purchaseDate: '2022-03-18',
                purchasePrice: 799,
                warrantyMonths: 12,
                osVersion: 'iPadOS 17'
            }),
            make({
                id: 'IT-demo-006',
                name: 'Samsung QLED 65"',
                category: 'smart-home',
                brand: 'Samsung',
                model: 'GQ65Q80C',
                location: 'Wohnzimmer',
                purchaseDate: '2022-11-25',
                purchasePrice: 1199,
                warrantyMonths: 24,
                notes: 'Hauptfernseher mit SmartTV'
            }),
            make({
                id: 'IT-demo-007',
                name: 'Philips Hue Bridge',
                category: 'smart-home',
                brand: 'Philips',
                model: 'Hue Bridge v2',
                location: 'Wohnzimmer',
                purchaseDate: '2021-04-12',
                purchasePrice: 59,
                warrantyMonths: 24,
                ipAddress: '192.168.178.30',
                notes: 'Steuert 12 Lampen im Haus'
            }),
            make({
                id: 'IT-demo-008',
                name: 'Raspberry Pi 4',
                category: 'computer',
                brand: 'Raspberry Pi Foundation',
                model: 'Pi 4 Model B 8GB',
                location: 'Büro',
                purchaseDate: '2022-08-05',
                purchasePrice: 89,
                warrantyMonths: 12,
                ipAddress: '192.168.178.10',
                osVersion: 'Raspberry Pi OS 64-bit',
                notes: 'Pi-hole + Home Assistant'
            }),
            make({
                id: 'IT-demo-009',
                name: 'HP LaserJet Pro MFP',
                category: 'printer',
                brand: 'HP',
                model: 'LaserJet Pro MFP M428dw',
                location: 'Büro',
                purchaseDate: '2021-09-14',
                purchasePrice: 349,
                warrantyMonths: 12,
                ipAddress: '192.168.178.40',
                status: 'active'
            }),
            make({
                id: 'IT-demo-010',
                name: 'LG UltraWide 34"',
                category: 'monitor',
                brand: 'LG',
                model: '34WN80C-B',
                location: 'Büro',
                purchaseDate: '2022-05-18',
                purchasePrice: 599,
                warrantyMonths: 36,
                notes: 'Haupt-Monitor, USB-C'
            }),
            make({
                id: 'IT-demo-011',
                name: 'TP-Link TL-SG108',
                category: 'switch',
                brand: 'TP-Link',
                model: 'TL-SG108 8-Port Gigabit Switch',
                location: 'Büro',
                purchaseDate: '2021-07-20',
                purchasePrice: 29,
                warrantyMonths: 36,
                notes: '8-Port Gigabit unmanaged'
            }),
            make({
                id: 'IT-demo-012',
                name: 'PlayStation 5',
                category: 'gaming',
                brand: 'Sony',
                model: 'PlayStation 5 Digital Edition',
                location: 'Wohnzimmer',
                purchaseDate: '2022-01-08',
                purchasePrice: 449,
                warrantyMonths: 12,
                notes: 'Spielkonsole'
            })
        ];
    }
}

window.itInventoryService = new ITInventoryService();
