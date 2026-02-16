/* ============================================
   Route Optimization Service
   Optimize technician routes for field service
   ============================================ */

class RouteService {
    constructor() {
        this.routes = JSON.parse(localStorage.getItem('mhs_routes') || '[]');
        this.settings = JSON.parse(localStorage.getItem('mhs_route_settings') || '{}');

        // Default settings
        if (!this.settings.startAddress) {this.settings.startAddress = 'Musterstraße 1, 63843 Niedernberg';}
        if (!this.settings.workStartTime) {this.settings.workStartTime = '08:00';}
        if (!this.settings.workEndTime) {this.settings.workEndTime = '17:00';}
        if (!this.settings.avgServiceDuration) {this.settings.avgServiceDuration = 60;} // minutes
        if (!this.settings.avgTravelSpeed) {this.settings.avgTravelSpeed = 40;} // km/h
    }

    // Create optimized route for a day
    async createRoute(dateStr, appointments) {
        if (!appointments || appointments.length === 0) {
            return { success: false, error: 'No appointments' };
        }

        // Get coordinates for all addresses (demo mode)
        const stops = await Promise.all(appointments.map(async (apt, index) => ({
            id: apt.id,
            title: apt.title || apt.kunde?.name,
            address: apt.adresse || apt.location || apt.kunde?.adresse || 'Unbekannt',
            originalTime: apt.startTime,
            duration: apt.dauer || this.settings.avgServiceDuration,
            priority: apt.priority || 'normal',
            coordinates: await this.geocodeAddress(apt.adresse || apt.location),
            appointment: apt
        })));

        // Optimize order using nearest neighbor algorithm
        const optimizedStops = this.optimizeStopOrder(stops);

        // Calculate route timing
        const routeWithTiming = this.calculateTiming(optimizedStops);

        const route = {
            id: 'route-' + Date.now(),
            date: dateStr,
            stops: routeWithTiming,
            startAddress: this.settings.startAddress,
            totalDistance: this.calculateTotalDistance(optimizedStops),
            totalDuration: this.calculateTotalDuration(routeWithTiming),
            totalTravelTime: routeWithTiming.reduce((sum, s) => sum + (s.travelTimeFromPrevious || 0), 0),
            totalServiceTime: routeWithTiming.reduce((sum, s) => sum + s.duration, 0),
            createdAt: new Date().toISOString(),
            status: 'planned' // planned, in_progress, completed
        };

        this.routes.push(route);
        this.save();

        return { success: true, route };
    }

    // Geocode address (demo - would use Google Maps/OpenStreetMap)
    async geocodeAddress(address) {
        // Demo: Return random coordinates in Germany
        // In production: Use Google Maps Geocoding API or Nominatim
        return {
            lat: 49.8 + Math.random() * 0.5,
            lng: 9.0 + Math.random() * 0.5
        };
    }

    // Optimize stop order using nearest neighbor algorithm
    optimizeStopOrder(stops) {
        if (stops.length <= 1) {return stops;}

        const optimized = [];
        const remaining = [...stops];

        // Start from depot (use first stop as starting point for demo)
        let current = { coordinates: { lat: 49.9, lng: 9.1 } }; // Start location

        while (remaining.length > 0) {
            // Find nearest unvisited stop
            let nearestIndex = 0;
            let nearestDistance = Infinity;

            remaining.forEach((stop, index) => {
                const distance = this.calculateDistance(
                    current.coordinates,
                    stop.coordinates
                );
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = index;
                }
            });

            // Add to optimized route
            const nextStop = remaining.splice(nearestIndex, 1)[0];
            nextStop.distanceFromPrevious = nearestDistance;
            optimized.push(nextStop);
            current = nextStop;
        }

        return optimized;
    }

    // Calculate distance between two points (Haversine formula)
    calculateDistance(coord1, coord2) {
        if (!coord1 || !coord2) {return 10;} // Default 10km

        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(coord2.lat - coord1.lat);
        const dLon = this.toRad(coord2.lng - coord1.lng);
        const lat1 = this.toRad(coord1.lat);
        const lat2 = this.toRad(coord2.lat);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    toRad(deg) {
        return deg * Math.PI / 180;
    }

    // Calculate timing for each stop
    calculateTiming(stops) {
        let currentTime = this.parseTime(this.settings.workStartTime);

        return stops.map((stop, index) => {
            // Travel time from previous
            const distance = stop.distanceFromPrevious || 10;
            const travelTime = (distance / this.settings.avgTravelSpeed) * 60; // minutes

            stop.travelTimeFromPrevious = Math.round(travelTime);

            // Arrival time
            currentTime += travelTime;
            stop.estimatedArrival = this.formatTime(currentTime);

            // Departure time (after service)
            currentTime += stop.duration;
            stop.estimatedDeparture = this.formatTime(currentTime);

            // Check if within work hours
            const endMinutes = this.parseTime(this.settings.workEndTime);
            stop.withinWorkHours = currentTime <= endMinutes;

            return stop;
        });
    }

    // Parse time string to minutes
    parseTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Format minutes to time string
    formatTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }

    // Calculate total distance
    calculateTotalDistance(stops) {
        return stops.reduce((sum, stop) => sum + (stop.distanceFromPrevious || 0), 0);
    }

    // Calculate total duration
    calculateTotalDuration(stops) {
        if (stops.length === 0) {return 0;}
        const lastStop = stops[stops.length - 1];
        return this.parseTime(lastStop.estimatedDeparture) - this.parseTime(this.settings.workStartTime);
    }

    // Get route for date
    getRouteForDate(dateStr) {
        return this.routes.find(r => r.date === dateStr);
    }

    // Generate Google Maps link for route
    getGoogleMapsLink(routeId) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) {return null;}

        const addresses = [
            this.settings.startAddress,
            ...route.stops.map(s => s.address),
            this.settings.startAddress // Return to start
        ];

        const waypoints = addresses.map(a => encodeURIComponent(a)).join('/');
        return `https://www.google.com/maps/dir/${waypoints}`;
    }

    // Generate directions URL for navigation
    getNavigationLink(stopId) {
        for (const route of this.routes) {
            const stop = route.stops.find(s => s.id === stopId);
            if (stop) {
                return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`;
            }
        }
        return null;
    }

    // Update stop status
    updateStopStatus(routeId, stopId, status) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) {return { success: false };}

        const stop = route.stops.find(s => s.id === stopId);
        if (!stop) {return { success: false };}

        stop.status = status; // pending, arrived, in_progress, completed, skipped
        stop.statusUpdatedAt = new Date().toISOString();

        if (status === 'arrived') {
            stop.actualArrival = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        }
        if (status === 'completed') {
            stop.actualDeparture = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        }

        // Update route status
        const allCompleted = route.stops.every(s => s.status === 'completed' || s.status === 'skipped');
        if (allCompleted) {
            route.status = 'completed';
            route.completedAt = new Date().toISOString();
        } else if (route.stops.some(s => s.status && s.status !== 'pending')) {
            route.status = 'in_progress';
        }

        this.save();
        return { success: true };
    }

    // Get today's route
    getTodayRoute() {
        const today = new Date().toISOString().split('T')[0];
        return this.getRouteForDate(today);
    }

    // Get route statistics
    getStatistics() {
        const completedRoutes = this.routes.filter(r => r.status === 'completed');

        return {
            totalRoutes: this.routes.length,
            completedRoutes: completedRoutes.length,
            totalDistance: this.routes.reduce((sum, r) => sum + (r.totalDistance || 0), 0),
            avgStopsPerRoute: this.routes.length > 0
                ? this.routes.reduce((sum, r) => sum + r.stops.length, 0) / this.routes.length
                : 0,
            avgDistancePerRoute: this.routes.length > 0
                ? this.routes.reduce((sum, r) => sum + (r.totalDistance || 0), 0) / this.routes.length
                : 0
        };
    }

    // Update settings
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('mhs_route_settings', JSON.stringify(this.settings));
    }

    // Get all routes
    getRoutes() {
        return this.routes.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Delete route
    deleteRoute(routeId) {
        this.routes = this.routes.filter(r => r.id !== routeId);
        this.save();
    }

    // Persistence
    save() {
        localStorage.setItem('mhs_routes', JSON.stringify(this.routes));
    }
}

window.routeService = new RouteService();
