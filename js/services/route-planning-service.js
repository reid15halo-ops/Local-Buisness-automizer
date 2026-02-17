/* ============================================
   Route Planning & Dispatch Service
   Tourenplanung und Disposition fuer Handwerker
   Daily route planning, worker/vehicle assignment,
   postal-code-based distance estimation
   ============================================ */

class RoutePlanningService {
    constructor() {
        this.routes = JSON.parse(localStorage.getItem('mhs_routes_planning') || '[]');
        this.workers = JSON.parse(localStorage.getItem('mhs_workers') || '[]');
        this.vehicles = JSON.parse(localStorage.getItem('mhs_vehicles') || '[]');

        // German PLZ area centroids (first 2 digits) for distance estimation
        // Approximate lat/lng for major PLZ regions
        this._plzRegions = {
            '01': { lat: 51.05, lng: 13.74 }, // Dresden
            '02': { lat: 51.15, lng: 14.97 }, // Goerlitz
            '03': { lat: 51.75, lng: 14.33 }, // Cottbus
            '04': { lat: 51.34, lng: 12.37 }, // Leipzig
            '06': { lat: 51.48, lng: 11.97 }, // Halle
            '07': { lat: 50.93, lng: 11.59 }, // Jena/Gera
            '08': { lat: 50.72, lng: 12.49 }, // Zwickau
            '09': { lat: 50.83, lng: 12.92 }, // Chemnitz
            '10': { lat: 52.52, lng: 13.41 }, // Berlin Mitte
            '12': { lat: 52.45, lng: 13.43 }, // Berlin Sued
            '13': { lat: 52.57, lng: 13.38 }, // Berlin Nord
            '14': { lat: 52.39, lng: 13.07 }, // Potsdam
            '15': { lat: 52.34, lng: 14.55 }, // Frankfurt/Oder
            '16': { lat: 52.97, lng: 13.79 }, // Eberswalde
            '17': { lat: 53.63, lng: 13.37 }, // Neubrandenburg
            '18': { lat: 54.09, lng: 12.13 }, // Rostock
            '19': { lat: 53.63, lng: 11.41 }, // Schwerin
            '20': { lat: 53.55, lng: 9.99  }, // Hamburg
            '21': { lat: 53.47, lng: 9.78  }, // Hamburg Sued
            '22': { lat: 53.60, lng: 10.07 }, // Hamburg Nord
            '23': { lat: 53.87, lng: 10.69 }, // Luebeck
            '24': { lat: 54.32, lng: 10.14 }, // Kiel
            '25': { lat: 54.00, lng: 9.43  }, // Heide
            '26': { lat: 53.15, lng: 8.22  }, // Oldenburg
            '27': { lat: 53.08, lng: 8.81  }, // Bremen
            '28': { lat: 53.08, lng: 8.81  }, // Bremen
            '29': { lat: 52.97, lng: 10.57 }, // Celle
            '30': { lat: 52.37, lng: 9.74  }, // Hannover
            '31': { lat: 52.15, lng: 9.95  }, // Hildesheim
            '32': { lat: 52.02, lng: 8.53  }, // Herford
            '33': { lat: 51.93, lng: 8.57  }, // Bielefeld
            '34': { lat: 51.32, lng: 9.50  }, // Kassel
            '35': { lat: 50.56, lng: 8.67  }, // Giessen
            '36': { lat: 50.55, lng: 9.68  }, // Fulda
            '37': { lat: 51.53, lng: 9.93  }, // Goettingen
            '38': { lat: 52.27, lng: 10.52 }, // Braunschweig
            '39': { lat: 52.13, lng: 11.63 }, // Magdeburg
            '40': { lat: 51.23, lng: 6.78  }, // Duesseldorf
            '41': { lat: 51.19, lng: 6.44  }, // Moenchengladbach
            '42': { lat: 51.26, lng: 7.15  }, // Wuppertal
            '44': { lat: 51.51, lng: 7.47  }, // Dortmund
            '45': { lat: 51.46, lng: 7.01  }, // Essen
            '46': { lat: 51.53, lng: 6.76  }, // Oberhausen
            '47': { lat: 51.44, lng: 6.76  }, // Duisburg
            '48': { lat: 51.96, lng: 7.63  }, // Muenster
            '49': { lat: 52.28, lng: 8.05  }, // Osnabrueck
            '50': { lat: 50.94, lng: 6.96  }, // Koeln
            '51': { lat: 50.93, lng: 7.10  }, // Koeln Ost
            '52': { lat: 50.78, lng: 6.08  }, // Aachen
            '53': { lat: 50.73, lng: 7.10  }, // Bonn
            '54': { lat: 49.75, lng: 6.64  }, // Trier
            '55': { lat: 50.00, lng: 8.27  }, // Mainz
            '56': { lat: 50.36, lng: 7.60  }, // Koblenz
            '57': { lat: 50.87, lng: 8.02  }, // Siegen
            '58': { lat: 51.36, lng: 7.47  }, // Hagen
            '59': { lat: 51.67, lng: 8.38  }, // Hamm
            '60': { lat: 50.11, lng: 8.68  }, // Frankfurt/Main
            '61': { lat: 50.21, lng: 8.62  }, // Bad Homburg
            '63': { lat: 49.98, lng: 9.15  }, // Offenbach/Aschaffenburg
            '64': { lat: 49.87, lng: 8.65  }, // Darmstadt
            '65': { lat: 50.08, lng: 8.24  }, // Wiesbaden
            '66': { lat: 49.23, lng: 7.00  }, // Saarbruecken
            '67': { lat: 49.44, lng: 8.44  }, // Ludwigshafen
            '68': { lat: 49.49, lng: 8.47  }, // Mannheim
            '69': { lat: 49.41, lng: 8.69  }, // Heidelberg
            '70': { lat: 48.78, lng: 9.18  }, // Stuttgart
            '71': { lat: 48.73, lng: 9.12  }, // Boeblingen
            '72': { lat: 48.49, lng: 9.21  }, // Tuebingen
            '73': { lat: 48.80, lng: 9.47  }, // Esslingen
            '74': { lat: 49.14, lng: 9.22  }, // Heilbronn/Schwaebisch Hall
            '75': { lat: 48.89, lng: 8.69  }, // Pforzheim
            '76': { lat: 49.01, lng: 8.40  }, // Karlsruhe
            '77': { lat: 48.47, lng: 7.95  }, // Offenburg
            '78': { lat: 47.66, lng: 8.86  }, // Konstanz
            '79': { lat: 47.99, lng: 7.85  }, // Freiburg
            '80': { lat: 48.14, lng: 11.58 }, // Muenchen
            '81': { lat: 48.11, lng: 11.60 }, // Muenchen Sued
            '82': { lat: 48.07, lng: 11.46 }, // Muenchen West
            '83': { lat: 47.86, lng: 12.13 }, // Rosenheim
            '84': { lat: 48.23, lng: 12.96 }, // Landshut
            '85': { lat: 48.40, lng: 11.74 }, // Freising/Ingolstadt
            '86': { lat: 48.37, lng: 10.90 }, // Augsburg
            '87': { lat: 47.73, lng: 10.31 }, // Kempten
            '88': { lat: 47.72, lng: 9.51  }, // Friedrichshafen
            '89': { lat: 48.40, lng: 10.00 }, // Ulm
            '90': { lat: 49.45, lng: 11.08 }, // Nuernberg
            '91': { lat: 49.59, lng: 11.01 }, // Erlangen
            '92': { lat: 49.42, lng: 11.86 }, // Amberg
            '93': { lat: 49.02, lng: 12.10 }, // Regensburg
            '94': { lat: 48.58, lng: 13.46 }, // Passau
            '95': { lat: 50.00, lng: 11.58 }, // Bayreuth
            '96': { lat: 50.27, lng: 10.96 }, // Bamberg
            '97': { lat: 49.79, lng: 9.95  }, // Wuerzburg
            '98': { lat: 50.68, lng: 10.93 }, // Erfurt/Suhl
            '99': { lat: 50.97, lng: 11.03 }  // Erfurt
        };
    }

    // ============================================
    // ID Generation
    // ============================================

    _generateId(prefix) {
        const ts = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        return `${prefix}-${ts}-${rand}`;
    }

    // ============================================
    // Persistence
    // ============================================

    _saveRoutes() {
        localStorage.setItem('mhs_routes_planning', JSON.stringify(this.routes));
    }

    _saveWorkers() {
        localStorage.setItem('mhs_workers', JSON.stringify(this.workers));
    }

    _saveVehicles() {
        localStorage.setItem('mhs_vehicles', JSON.stringify(this.vehicles));
    }

    // ============================================
    // Routes CRUD
    // ============================================

    /**
     * Create a new route for a given date
     * @param {string} date - 'YYYY-MM-DD'
     * @returns {object} The created RouteDay
     */
    createRoute(date) {
        // Check if route already exists for this date
        const existing = this.routes.find(r => r.date === date);
        if (existing) {
            return existing;
        }

        // Get start address from admin settings or fallback
        const settings = this._getCompanySettings();

        const route = {
            id: this._generateId('RTE'),
            date: date,
            stops: [],
            startAddress: settings.address || 'Firmensitz',
            totalDistance: 0,
            totalDuration: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.routes.push(route);
        this._saveRoutes();
        return route;
    }

    /**
     * Get route for a specific date
     * @param {string} date - 'YYYY-MM-DD'
     * @returns {object|null}
     */
    getRoute(date) {
        return this.routes.find(r => r.date === date) || null;
    }

    /**
     * Get routes within a date range
     * @param {string} startDate - 'YYYY-MM-DD'
     * @param {string} endDate - 'YYYY-MM-DD'
     * @returns {Array}
     */
    getRoutes(startDate, endDate) {
        return this.routes.filter(r => {
            return r.date >= startDate && r.date <= endDate;
        }).sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Add a stop to a route
     * @param {string} routeId
     * @param {object} stopData
     * @returns {object} The created stop
     */
    addStop(routeId, stopData) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) { return null; }

        const stop = {
            id: this._generateId('STP'),
            orderId: stopData.orderId || '',
            customerName: stopData.customerName || '',
            address: stopData.address || '',
            city: stopData.city || '',
            postalCode: stopData.postalCode || '',
            plannedArrival: stopData.plannedArrival || '',
            plannedDuration: stopData.plannedDuration || 60,
            priority: stopData.priority || 'mittel',
            assignedWorkers: stopData.assignedWorkers || [],
            assignedVehicle: stopData.assignedVehicle || '',
            status: stopData.status || 'geplant',
            notes: stopData.notes || '',
            customerPhone: stopData.customerPhone || '',
            lat: stopData.lat || null,
            lng: stopData.lng || null
        };

        route.stops.push(stop);
        this._recalculateRoute(route);
        route.updatedAt = new Date().toISOString();
        this._saveRoutes();
        return stop;
    }

    /**
     * Update a stop within a route
     * @param {string} routeId
     * @param {string} stopId
     * @param {object} data - Partial update
     * @returns {object|null}
     */
    updateStop(routeId, stopId, data) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) { return null; }

        const stop = route.stops.find(s => s.id === stopId);
        if (!stop) { return null; }

        // Merge updates
        const allowedFields = [
            'orderId', 'customerName', 'address', 'city', 'postalCode',
            'plannedArrival', 'plannedDuration', 'priority',
            'assignedWorkers', 'assignedVehicle', 'status',
            'notes', 'customerPhone', 'lat', 'lng'
        ];

        for (const key of allowedFields) {
            if (data[key] !== undefined) {
                stop[key] = data[key];
            }
        }

        this._recalculateRoute(route);
        route.updatedAt = new Date().toISOString();
        this._saveRoutes();
        return stop;
    }

    /**
     * Remove a stop from a route
     * @param {string} routeId
     * @param {string} stopId
     * @returns {boolean}
     */
    removeStop(routeId, stopId) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) { return false; }

        const before = route.stops.length;
        route.stops = route.stops.filter(s => s.id !== stopId);

        if (route.stops.length < before) {
            this._recalculateRoute(route);
            route.updatedAt = new Date().toISOString();
            this._saveRoutes();
            return true;
        }
        return false;
    }

    /**
     * Reorder stops manually by providing new order of IDs
     * @param {string} routeId
     * @param {Array<string>} stopIds - Ordered array of stop IDs
     * @returns {boolean}
     */
    reorderStops(routeId, stopIds) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) { return false; }

        const reordered = [];
        for (const id of stopIds) {
            const stop = route.stops.find(s => s.id === id);
            if (stop) {
                reordered.push(stop);
            }
        }

        // Keep any stops not in the list at the end
        for (const stop of route.stops) {
            if (!stopIds.includes(stop.id)) {
                reordered.push(stop);
            }
        }

        route.stops = reordered;
        this._recalculateRoute(route);
        route.updatedAt = new Date().toISOString();
        this._saveRoutes();
        return true;
    }

    /**
     * Update the status of a specific stop
     * @param {string} routeId
     * @param {string} stopId
     * @param {string} status - 'geplant'|'unterwegs'|'vor_ort'|'erledigt'|'verschoben'
     * @returns {object|null}
     */
    updateStopStatus(routeId, stopId, status) {
        const validStatuses = ['geplant', 'unterwegs', 'vor_ort', 'erledigt', 'verschoben'];
        if (!validStatuses.includes(status)) { return null; }

        return this.updateStop(routeId, stopId, { status });
    }

    // ============================================
    // Auto-Planning
    // ============================================

    /**
     * Pull active Auftraege with addresses and create stops
     * @param {string} date - 'YYYY-MM-DD'
     * @returns {object} The route with auto-assigned stops
     */
    autoAssignFromOrders(date) {
        let route = this.getRoute(date);
        if (!route) {
            route = this.createRoute(date);
        }

        // Get active Auftraege from the store
        const store = this._getStore();
        const auftraege = store.auftraege || [];

        // Filter for active orders that have customer info
        const activeOrders = auftraege.filter(a => {
            const isActive = ['geplant', 'in_bearbeitung', 'material_bestellt'].includes(a.status);
            const hasCustomer = a.kunde && a.kunde.name;
            // Avoid duplicates
            const alreadyInRoute = route.stops.some(s => s.orderId === a.id);
            return isActive && hasCustomer && !alreadyInRoute;
        });

        // Add each order as a stop
        for (const order of activeOrders) {
            const kunde = order.kunde || {};
            const adresse = kunde.adresse || {};

            this.addStop(route.id, {
                orderId: order.id,
                customerName: kunde.name || '',
                address: adresse.strasse || kunde.strasse || order.adresse || '',
                city: adresse.ort || kunde.ort || '',
                postalCode: adresse.plz || kunde.plz || '',
                plannedDuration: order.geschaetzteDauer || 60,
                priority: order.priority || 'mittel',
                customerPhone: kunde.telefon || '',
                notes: order.beschreibung || order.leistungsart || ''
            });
        }

        return route;
    }

    // ============================================
    // Workers CRUD
    // ============================================

    getWorkers() {
        return [...this.workers];
    }

    addWorker(data) {
        const worker = {
            id: this._generateId('WRK'),
            name: data.name || '',
            role: data.role || 'geselle',
            phone: data.phone || '',
            available: data.available !== false,
            color: data.color || this._getNextWorkerColor()
        };

        this.workers.push(worker);
        this._saveWorkers();
        return worker;
    }

    updateWorker(id, data) {
        const index = this.workers.findIndex(w => w.id === id);
        if (index === -1) { return null; }

        const allowedFields = ['name', 'role', 'phone', 'available', 'color'];
        for (const key of allowedFields) {
            if (data[key] !== undefined) {
                this.workers[index][key] = data[key];
            }
        }

        this._saveWorkers();
        return this.workers[index];
    }

    removeWorker(id) {
        const before = this.workers.length;
        this.workers = this.workers.filter(w => w.id !== id);
        if (this.workers.length < before) {
            this._saveWorkers();
            return true;
        }
        return false;
    }

    // ============================================
    // Vehicles CRUD
    // ============================================

    getVehicles() {
        return [...this.vehicles];
    }

    addVehicle(data) {
        const vehicle = {
            id: this._generateId('VHC'),
            name: data.name || '',
            plate: data.plate || '',
            capacity: data.capacity || 3
        };

        this.vehicles.push(vehicle);
        this._saveVehicles();
        return vehicle;
    }

    updateVehicle(id, data) {
        const index = this.vehicles.findIndex(v => v.id === id);
        if (index === -1) { return null; }

        const allowedFields = ['name', 'plate', 'capacity'];
        for (const key of allowedFields) {
            if (data[key] !== undefined) {
                this.vehicles[index][key] = data[key];
            }
        }

        this._saveVehicles();
        return this.vehicles[index];
    }

    removeVehicle(id) {
        const before = this.vehicles.length;
        this.vehicles = this.vehicles.filter(v => v.id !== id);
        if (this.vehicles.length < before) {
            this._saveVehicles();
            return true;
        }
        return false;
    }

    // ============================================
    // Distance Estimation
    // ============================================

    /**
     * Estimate distance between two addresses using German PLZ regions.
     * Falls back to a default if postal codes are not available.
     * @param {string} address1 - Full address or postal code
     * @param {string} address2 - Full address or postal code
     * @returns {number} Estimated distance in km
     */
    estimateDistance(address1, address2) {
        const plz1 = this._extractPLZ(address1);
        const plz2 = this._extractPLZ(address2);

        if (!plz1 || !plz2) {
            // If we cannot extract PLZs, return a default urban distance
            return 15;
        }

        // Same PLZ: very short
        if (plz1 === plz2) {
            return 3;
        }

        // Same 2-digit area
        const region1 = plz1.substring(0, 2);
        const region2 = plz2.substring(0, 2);

        if (region1 === region2) {
            // Within same region: estimate by 3rd digit difference
            const diff = Math.abs(parseInt(plz1.substring(2, 3) || '0') - parseInt(plz2.substring(2, 3) || '0'));
            return 5 + diff * 4; // 5-41 km
        }

        // Different regions: use centroids
        const coord1 = this._plzRegions[region1];
        const coord2 = this._plzRegions[region2];

        if (coord1 && coord2) {
            const straightLine = this._haversine(coord1.lat, coord1.lng, coord2.lat, coord2.lng);
            // Road distance is roughly 1.3x straight line
            return Math.round(straightLine * 1.3);
        }

        // Fallback
        return 25;
    }

    /**
     * Haversine formula for distance between two lat/lng points
     * @returns {number} Distance in km
     */
    _haversine(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Extract a 5-digit German postal code from an address string
     */
    _extractPLZ(str) {
        if (!str) { return null; }
        const match = String(str).match(/\b(\d{5})\b/);
        return match ? match[1] : null;
    }

    // ============================================
    // Sharing / Export
    // ============================================

    /**
     * Generate a shareable text link (data URI) for a route
     * @param {string} routeId
     * @returns {string|null}
     */
    generateShareableLink(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) { return null; }

        const text = this.exportRouteAsText(routeId);
        if (!text) { return null; }

        // Return a data URI that can be shared
        return 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    }

    /**
     * Export route as formatted text suitable for WhatsApp sharing
     * @param {string} routeId
     * @returns {string|null}
     */
    exportRouteAsText(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) { return null; }

        const dateObj = new Date(route.date + 'T00:00:00');
        const dateFormatted = dateObj.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        let text = `\u{1F5FA}\uFE0F Tourenplan ${dateFormatted}\n\n`;

        route.stops.forEach((stop, index) => {
            const num = index + 1;
            const time = stop.plannedArrival || '--:--';
            const addr = [stop.address, stop.postalCode, stop.city].filter(Boolean).join(', ');
            const durationH = stop.plannedDuration ? `~${Math.round(stop.plannedDuration / 60)}h` : '';
            const durationDisplay = stop.plannedDuration < 60
                ? `~${stop.plannedDuration}min`
                : durationH;

            text += `${num}. ${time} \u2014 ${stop.customerName}`;
            if (addr) { text += `, ${addr}`; }
            text += '\n';

            if (stop.notes) {
                text += `   \u2192 ${stop.notes} (${durationDisplay})\n`;
            } else if (stop.plannedDuration) {
                text += `   \u2192 Einsatz (${durationDisplay})\n`;
            }

            if (stop.assignedWorkers && stop.assignedWorkers.length > 0) {
                text += `   \u{1F477} ${stop.assignedWorkers.join(', ')}\n`;
            }

            text += '\n';
        });

        // Stats
        const stopCount = route.stops.length;
        const totalKm = Math.round(route.totalDistance || 0);
        const totalH = route.totalDuration ? `~${Math.round(route.totalDuration / 60)}h` : '?h';

        text += `\u{1F4CA} ${stopCount} Stops | ~${totalKm}km | ${totalH}`;

        return text;
    }

    // ============================================
    // Internal Helpers
    // ============================================

    /**
     * Recalculate total distance and duration for a route
     */
    _recalculateRoute(route) {
        if (!route.stops || route.stops.length === 0) {
            route.totalDistance = 0;
            route.totalDuration = 0;
            return;
        }

        let totalDist = 0;
        let totalDur = 0;

        // Estimate distances between consecutive stops
        const startAddr = route.startAddress || '';

        for (let i = 0; i < route.stops.length; i++) {
            const stop = route.stops[i];
            const stopAddr = [stop.address, stop.postalCode, stop.city].filter(Boolean).join(' ');

            if (i === 0) {
                // Distance from start to first stop
                totalDist += this.estimateDistance(startAddr, stopAddr);
            } else {
                const prevStop = route.stops[i - 1];
                const prevAddr = [prevStop.address, prevStop.postalCode, prevStop.city].filter(Boolean).join(' ');
                totalDist += this.estimateDistance(prevAddr, stopAddr);
            }

            // Add stop duration
            totalDur += (stop.plannedDuration || 60);
        }

        // Add travel time (assume average 40km/h in urban areas)
        const travelMinutes = (totalDist / 40) * 60;
        totalDur += travelMinutes;

        route.totalDistance = Math.round(totalDist);
        route.totalDuration = Math.round(totalDur);
    }

    /**
     * Get color for the next worker (rotating palette)
     */
    _getNextWorkerColor() {
        const colors = [
            '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6',
            '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'
        ];
        const usedColors = this.workers.map(w => w.color);
        const available = colors.filter(c => !usedColors.includes(c));
        return available.length > 0 ? available[0] : colors[this.workers.length % colors.length];
    }

    /**
     * Get store state (Auftraege, etc.)
     */
    _getStore() {
        return window.AppUtils?.store || window.storeService?.state || { auftraege: [] };
    }

    /**
     * Get company settings for default start address
     */
    _getCompanySettings() {
        const store = this._getStore();
        return store.settings || {};
    }
}

window.routePlanningService = new RoutePlanningService();
