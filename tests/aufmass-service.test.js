import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Mocks
// ============================================

const mockStorage = {};
globalThis.localStorage = {
    getItem: vi.fn(k => mockStorage[k] || null),
    setItem: vi.fn((k, v) => { mockStorage[k] = v; }),
    removeItem: vi.fn(k => { delete mockStorage[k]; }),
    clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
};

globalThis.StorageUtils = {
    getJSON: vi.fn((key, fallback) => {
        const raw = mockStorage[key];
        return raw ? JSON.parse(raw) : fallback;
    }),
    setJSON: vi.fn((key, val) => {
        mockStorage[key] = JSON.stringify(val);
        return true;
    }),
};

globalThis.document = {
    createElement: vi.fn(() => ({})),
    dispatchEvent: vi.fn(),
};

globalThis.window = globalThis;
window.APP_CONFIG = {};
window.showToast = vi.fn();
window.storeService = undefined;
window._getTaxRate = undefined;

// Suppress noisy console output during tests
const _origConsole = { ...console };
globalThis.console = {
    ..._origConsole,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    log: _origConsole.log,
};

await import('../js/services/aufmass-service.js');

const svc = () => window.aufmassService;

// ============================================
// Helpers
// ============================================

function freshService() {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    window.storeService = undefined;
    window._getTaxRate = undefined;
    window.aufmassService = new window.aufmassService.constructor();
}

function createTestProject(data = {}) {
    return svc().createProject({
        name: 'Test Projekt',
        customerName: 'Max Mustermann',
        customerEmail: 'max@example.de',
        address: 'Musterstr. 1, 12345 Berlin',
        notes: 'Testnotes',
        ...data,
    });
}

function addRectRoom(projectId, overrides = {}) {
    return svc().addRoom(projectId, {
        name: 'Wohnzimmer',
        type: 'rechteck',
        length: 5,
        width: 4,
        height: 2.5,
        ...overrides,
    });
}

// ============================================
// Tests
// ============================================

describe('AufmassService', () => {
    beforeEach(() => {
        freshService();
    });

    // ── Constructor & Persistence ──

    describe('constructor & persistence', () => {
        it('initialises with empty projects array', () => {
            expect(svc().projects).toEqual([]);
        });

        it('loads projects from localStorage on construction', () => {
            const proj = createTestProject();
            // Reconstruct — should load from storage
            window.aufmassService = new window.aufmassService.constructor();
            expect(svc().projects.length).toBe(1);
            expect(svc().projects[0].id).toBe(proj.id);
        });

        it('has ROOM_TYPES defined', () => {
            expect(Object.keys(svc().ROOM_TYPES)).toContain('rechteck');
            expect(Object.keys(svc().ROOM_TYPES)).toContain('lform');
            expect(Object.keys(svc().ROOM_TYPES)).toContain('kreis');
            expect(Object.keys(svc().ROOM_TYPES)).toContain('frei');
        });

        it('has MATERIAL_DEFAULTS defined', () => {
            expect(Object.keys(svc().MATERIAL_DEFAULTS)).toContain('farbe');
            expect(Object.keys(svc().MATERIAL_DEFAULTS)).toContain('fliesen');
            expect(Object.keys(svc().MATERIAL_DEFAULTS)).toContain('tapete');
        });

        it('has DEDUCTION_TYPES defined', () => {
            expect(Object.keys(svc().DEDUCTION_TYPES)).toContain('fenster');
            expect(Object.keys(svc().DEDUCTION_TYPES)).toContain('tuer');
            expect(Object.keys(svc().DEDUCTION_TYPES)).toContain('sonstiges');
        });
    });

    // ── Project CRUD ──

    describe('createProject', () => {
        it('creates a project with all fields', () => {
            const p = createTestProject();
            expect(p.id).toMatch(/^AUFM-/);
            expect(p.name).toBe('Test Projekt');
            expect(p.customerName).toBe('Max Mustermann');
            expect(p.customerEmail).toBe('max@example.de');
            expect(p.address).toBe('Musterstr. 1, 12345 Berlin');
            expect(p.notes).toBe('Testnotes');
            expect(p.rooms).toEqual([]);
            expect(p.createdAt).toBeTruthy();
            expect(p.updatedAt).toBeTruthy();
        });

        it('applies defaults for missing fields', () => {
            const p = svc().createProject({});
            expect(p.name).toBe('Neues Aufmaß');
            expect(p.customerName).toBe('');
            expect(p.customerEmail).toBe('');
            expect(p.address).toBe('');
            expect(p.notes).toBe('');
        });

        it('persists to localStorage', () => {
            createTestProject();
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'mhs_aufmass_data',
                expect.any(String)
            );
        });
    });

    describe('getProject', () => {
        it('returns project by id', () => {
            const p = createTestProject();
            expect(svc().getProject(p.id)).toBe(p);
        });

        it('returns null for unknown id', () => {
            expect(svc().getProject('NOPE')).toBeNull();
        });
    });

    describe('updateProject', () => {
        it('updates allowed fields', () => {
            const p = createTestProject();
            const updated = svc().updateProject(p.id, { name: 'Neuer Name', customerName: 'Erika' });
            expect(updated.name).toBe('Neuer Name');
            expect(updated.customerName).toBe('Erika');
        });

        it('ignores non-allowed fields', () => {
            const p = createTestProject();
            svc().updateProject(p.id, { id: 'HACKED', rooms: ['x'] });
            expect(p.id).not.toBe('HACKED');
            expect(p.rooms).toEqual([]);
        });

        it('returns null for unknown project', () => {
            expect(svc().updateProject('NOPE', { name: 'X' })).toBeNull();
        });

        it('updates updatedAt timestamp', () => {
            const p = createTestProject();
            const updated = svc().updateProject(p.id, { name: 'New' });
            expect(updated.updatedAt).toBeTruthy();
        });
    });

    describe('deleteProject', () => {
        it('deletes an existing project', () => {
            const p = createTestProject();
            expect(svc().deleteProject(p.id)).toBe(true);
            expect(svc().getProject(p.id)).toBeNull();
        });

        it('returns false for unknown project', () => {
            expect(svc().deleteProject('NOPE')).toBe(false);
        });
    });

    describe('getProjects', () => {
        it('returns all projects when no filter', () => {
            createTestProject({ name: 'A' });
            createTestProject({ name: 'B' });
            expect(svc().getProjects().length).toBe(2);
        });

        it('filters by search term on name', () => {
            createTestProject({ name: 'Küche Umbau' });
            createTestProject({ name: 'Bad Renovierung' });
            const results = svc().getProjects({ search: 'küche' });
            expect(results.length).toBe(1);
            expect(results[0].name).toBe('Küche Umbau');
        });

        it('filters by search term on customerName', () => {
            createTestProject({ name: 'A', customerName: 'Schmidt' });
            createTestProject({ name: 'B', customerName: 'Müller' });
            const results = svc().getProjects({ search: 'schmidt' });
            expect(results.length).toBe(1);
        });

        it('filters by search term on address', () => {
            createTestProject({ name: 'A', address: 'Berliner Str.' });
            createTestProject({ name: 'B', address: 'Münchner Allee' });
            const results = svc().getProjects({ search: 'berliner' });
            expect(results.length).toBe(1);
        });

        it('filters by customerName', () => {
            createTestProject({ name: 'A', customerName: 'Schmidt' });
            createTestProject({ name: 'B', customerName: 'Müller' });
            const results = svc().getProjects({ customerName: 'müller' });
            expect(results.length).toBe(1);
        });

        it('sorts by updatedAt descending', () => {
            const p1 = createTestProject({ name: 'Old' });
            p1.updatedAt = '2024-01-01T00:00:00.000Z';
            const p2 = createTestProject({ name: 'New' });
            p2.updatedAt = '2025-06-01T00:00:00.000Z';
            const results = svc().getProjects();
            expect(results[0].name).toBe('New');
        });
    });

    // ── Room Management ──

    describe('addRoom', () => {
        it('adds a room with defaults', () => {
            const p = createTestProject();
            const room = svc().addRoom(p.id, { type: 'rechteck', length: 5, width: 4 });
            expect(room.id).toMatch(/^RAUM-/);
            expect(room.name).toBe('Raum 1');
            expect(room.type).toBe('rechteck');
            expect(room.length).toBe(5);
            expect(room.width).toBe(4);
            expect(room.height).toBe(2.5); // default height
            expect(room.deductions).toEqual([]);
            expect(p.rooms.length).toBe(1);
        });

        it('returns null for unknown project', () => {
            expect(svc().addRoom('NOPE', { type: 'rechteck' })).toBeNull();
        });

        it('assigns incremental default name', () => {
            const p = createTestProject();
            svc().addRoom(p.id, {});
            const room2 = svc().addRoom(p.id, {});
            expect(room2.name).toBe('Raum 2');
        });

        it('handles negative dimension values via _toNum', () => {
            const p = createTestProject();
            const room = svc().addRoom(p.id, { length: -5, width: 'abc' });
            expect(room.length).toBe(0);
            expect(room.width).toBe(0);
        });
    });

    describe('updateRoom', () => {
        it('updates room dimensions', () => {
            const p = createTestProject();
            const room = addRectRoom(p.id);
            const updated = svc().updateRoom(p.id, room.id, { length: 10, width: 8 });
            expect(updated.length).toBe(10);
            expect(updated.width).toBe(8);
        });

        it('updates name and notes as strings (not parsed as numbers)', () => {
            const p = createTestProject();
            const room = addRectRoom(p.id);
            const updated = svc().updateRoom(p.id, room.id, { name: 'Schlafzimmer', notes: 'Dachschräge' });
            expect(updated.name).toBe('Schlafzimmer');
            expect(updated.notes).toBe('Dachschräge');
        });

        it('returns null for unknown project or room', () => {
            const p = createTestProject();
            expect(svc().updateRoom('NOPE', 'NOPE', {})).toBeNull();
            expect(svc().updateRoom(p.id, 'NOPE', {})).toBeNull();
        });
    });

    describe('deleteRoom', () => {
        it('deletes a room from a project', () => {
            const p = createTestProject();
            const room = addRectRoom(p.id);
            expect(svc().deleteRoom(p.id, room.id)).toBe(true);
            expect(p.rooms.length).toBe(0);
        });

        it('returns false for unknown project or room', () => {
            const p = createTestProject();
            expect(svc().deleteRoom('NOPE', 'NOPE')).toBe(false);
            expect(svc().deleteRoom(p.id, 'NOPE')).toBe(false);
        });
    });

    // ── Deductions ──

    describe('addDeduction', () => {
        it('adds a window deduction with defaults', () => {
            const p = createTestProject();
            const room = addRectRoom(p.id);
            const ded = svc().addDeduction(p.id, room.id, { type: 'fenster' });
            expect(ded.id).toMatch(/^DED-/);
            expect(ded.type).toBe('fenster');
            expect(ded.name).toBe('Fenster');
            expect(ded.width).toBe(1.2);
            expect(ded.height).toBe(1.4);
            expect(ded.count).toBe(1);
        });

        it('adds a door deduction with custom dimensions', () => {
            const p = createTestProject();
            const room = addRectRoom(p.id);
            const ded = svc().addDeduction(p.id, room.id, {
                type: 'tuer',
                width: 1.0,
                height: 2.2,
                count: 2,
                wall: 'Wand A',
            });
            expect(ded.type).toBe('tuer');
            expect(ded.width).toBe(1.0);
            expect(ded.height).toBe(2.2);
            expect(ded.count).toBe(2);
            expect(ded.wall).toBe('Wand A');
        });

        it('falls back to sonstiges for unknown deduction type', () => {
            const p = createTestProject();
            const room = addRectRoom(p.id);
            const ded = svc().addDeduction(p.id, room.id, { type: 'unknown_type' });
            // Uses sonstiges defaults for name
            expect(ded.name).toBe('Sonstiges');
        });

        it('returns null for unknown project or room', () => {
            const p = createTestProject();
            expect(svc().addDeduction('NOPE', 'NOPE', { type: 'fenster' })).toBeNull();
            expect(svc().addDeduction(p.id, 'NOPE', { type: 'fenster' })).toBeNull();
        });

        it('enforces minimum count of 1', () => {
            const p = createTestProject();
            const room = addRectRoom(p.id);
            const ded = svc().addDeduction(p.id, room.id, { type: 'fenster', count: 0 });
            expect(ded.count).toBe(1);
        });
    });

    describe('updateDeduction', () => {
        it('updates deduction fields', () => {
            const p = createTestProject();
            const room = addRectRoom(p.id);
            const ded = svc().addDeduction(p.id, room.id, { type: 'fenster' });
            const updated = svc().updateDeduction(p.id, room.id, ded.id, {
                width: 2.0,
                height: 1.5,
                count: 3,
                wall: 'Nord',
            });
            expect(updated.width).toBe(2.0);
            expect(updated.height).toBe(1.5);
            expect(updated.count).toBe(3);
            expect(updated.wall).toBe('Nord');
        });

        it('returns null for unknown ids', () => {
            const p = createTestProject();
            const room = addRectRoom(p.id);
            expect(svc().updateDeduction(p.id, room.id, 'NOPE', {})).toBeNull();
            expect(svc().updateDeduction(p.id, 'NOPE', 'NOPE', {})).toBeNull();
            expect(svc().updateDeduction('NOPE', 'NOPE', 'NOPE', {})).toBeNull();
        });
    });

    describe('removeDeduction', () => {
        it('removes a deduction', () => {
            const p = createTestProject();
            const room = addRectRoom(p.id);
            const ded = svc().addDeduction(p.id, room.id, { type: 'fenster' });
            expect(svc().removeDeduction(p.id, room.id, ded.id)).toBe(true);
            expect(room.deductions.length).toBe(0);
        });

        it('returns false for unknown ids', () => {
            const p = createTestProject();
            const room = addRectRoom(p.id);
            expect(svc().removeDeduction(p.id, room.id, 'NOPE')).toBe(false);
            expect(svc().removeDeduction(p.id, 'NOPE', 'NOPE')).toBe(false);
            expect(svc().removeDeduction('NOPE', 'NOPE', 'NOPE')).toBe(false);
        });
    });

    // ── Calculations ──

    describe('calculateRoom', () => {
        it('returns empty calc for null room', () => {
            const calc = svc().calculateRoom(null);
            expect(calc.floorArea).toBe(0);
            expect(calc.wallArea).toBe(0);
            expect(calc.volume).toBe(0);
            expect(calc.perimeter).toBe(0);
            expect(calc.netWallArea).toBe(0);
            expect(calc.totalDeductionArea).toBe(0);
        });

        describe('rechteck', () => {
            it('calculates correctly for a 5x4x2.5 rectangle', () => {
                const room = { type: 'rechteck', length: 5, width: 4, height: 2.5, deductions: [] };
                const calc = svc().calculateRoom(room);
                expect(calc.floorArea).toBe(20);
                expect(calc.ceilingArea).toBe(20);
                expect(calc.perimeter).toBe(18);
                // Wall area = 2*(5+4)*2.5 = 45
                expect(calc.wallArea).toBe(45);
                expect(calc.volume).toBe(50);
                expect(calc.netWallArea).toBe(45);
                expect(calc.totalDeductionArea).toBe(0);
                expect(calc.wallAreas.length).toBe(4);
            });

            it('subtracts deductions from wall area', () => {
                const room = {
                    type: 'rechteck', length: 5, width: 4, height: 2.5,
                    deductions: [
                        { width: 1.2, height: 1.4, count: 2 }, // 2 windows = 3.36
                        { width: 0.9, height: 2.1, count: 1 }, // 1 door = 1.89
                    ],
                };
                const calc = svc().calculateRoom(room);
                // Total deduction: 1.2*1.4*2 + 0.9*2.1*1 = 3.36 + 1.89 = 5.25
                expect(calc.totalDeductionArea).toBe(5.25);
                expect(calc.netWallArea).toBe(45 - 5.25);
            });
        });

        describe('lform', () => {
            it('calculates L-form floor area', () => {
                const room = {
                    type: 'lform',
                    length1: 5, width1: 3,
                    length2: 3, width2: 2,
                    height: 2.5,
                    deductions: [],
                };
                const calc = svc().calculateRoom(room);
                // Floor = 5*3 + 3*2 = 15 + 6 = 21
                expect(calc.floorArea).toBe(21);
                expect(calc.wallAreas.length).toBe(6);
                expect(calc.volume).toBe(52.5); // 21 * 2.5
            });
        });

        describe('trapez', () => {
            it('calculates trapezoid floor area', () => {
                const room = {
                    type: 'trapez',
                    sideA: 6, sideB: 4, depth: 3,
                    height: 2.5,
                    deductions: [],
                };
                const calc = svc().calculateRoom(room);
                // Floor = ((6+4)/2)*3 = 15
                expect(calc.floorArea).toBe(15);
                expect(calc.wallAreas.length).toBe(4);
            });
        });

        describe('dreieck', () => {
            it('calculates triangle floor area', () => {
                const room = {
                    type: 'dreieck',
                    base: 6, triHeight: 4,
                    height: 2.5,
                    deductions: [],
                };
                const calc = svc().calculateRoom(room);
                // Floor = (6*4)/2 = 12
                expect(calc.floorArea).toBe(12);
                expect(calc.wallAreas.length).toBe(3);
            });
        });

        describe('kreis', () => {
            it('calculates circle floor area', () => {
                const room = {
                    type: 'kreis',
                    radius: 3,
                    height: 2.5,
                    deductions: [],
                };
                const calc = svc().calculateRoom(room);
                // Floor = pi * 3^2 = ~28.27
                expect(calc.floorArea).toBeCloseTo(28.27, 1);
                // Perimeter = 2*pi*3 = ~18.85
                expect(calc.perimeter).toBeCloseTo(18.85, 1);
                // Wall = perimeter * height
                expect(calc.wallArea).toBeCloseTo(18.85 * 2.5, 0);
                expect(calc.wallAreas.length).toBe(1);
                expect(calc.wallAreas[0].wall).toBe('Rundwand');
            });
        });

        describe('frei (polygon)', () => {
            it('calculates polygon floor area using shoelace formula', () => {
                // Simple square 0,0 -> 4,0 -> 4,3 -> 0,3
                const room = {
                    type: 'frei',
                    points: [
                        { x: 0, y: 0 },
                        { x: 4, y: 0 },
                        { x: 4, y: 3 },
                        { x: 0, y: 3 },
                    ],
                    height: 2.5,
                    deductions: [],
                };
                const calc = svc().calculateRoom(room);
                expect(calc.floorArea).toBe(12); // 4 * 3
                expect(calc.perimeter).toBe(14); // 4+3+4+3
                expect(calc.wallAreas.length).toBe(4);
            });

            it('returns 0 for polygon with fewer than 3 points', () => {
                const room = {
                    type: 'frei',
                    points: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
                    height: 2.5,
                    deductions: [],
                };
                const calc = svc().calculateRoom(room);
                expect(calc.floorArea).toBe(0);
            });
        });

        describe('default type', () => {
            it('falls back to rectangle calculation for unknown type', () => {
                const room = { type: 'unknown', length: 5, width: 4, height: 2.5, deductions: [] };
                const calc = svc().calculateRoom(room);
                expect(calc.floorArea).toBe(20);
            });
        });
    });

    describe('calculateNetArea', () => {
        it('returns net wall area for a room', () => {
            const room = {
                type: 'rechteck', length: 5, width: 4, height: 2.5,
                deductions: [{ width: 1, height: 2, count: 1 }],
            };
            // Wall = 45, deduction = 2, net = 43
            expect(svc().calculateNetArea(room)).toBe(43);
        });
    });

    describe('basic calculation helpers', () => {
        it('calculateFloorArea', () => {
            expect(svc().calculateFloorArea(5, 4)).toBe(20);
            expect(svc().calculateFloorArea(0, 4)).toBe(0);
            expect(svc().calculateFloorArea('3', '2')).toBe(6);
        });

        it('calculateWallArea', () => {
            // 2*(5+4)*2.5 = 45
            expect(svc().calculateWallArea(5, 4, 2.5)).toBe(45);
        });

        it('calculateVolume', () => {
            expect(svc().calculateVolume(5, 4, 2.5)).toBe(50);
        });

        it('calculatePerimeter', () => {
            expect(svc().calculatePerimeter(5, 4)).toBe(18);
        });
    });

    // ── Material Estimation ──

    describe('getMaterialDefaults', () => {
        it('returns a deep copy of material defaults', () => {
            const defaults = svc().getMaterialDefaults();
            expect(defaults.farbe.coverage).toBe(10);
            // Ensure it is a copy, not a reference
            defaults.farbe.coverage = 999;
            expect(svc().MATERIAL_DEFAULTS.farbe.coverage).toBe(10);
        });
    });

    describe('estimateMaterial', () => {
        const rectRoom = {
            type: 'rechteck', length: 5, width: 4, height: 2.5,
            deductions: [],
        };

        it('estimates farbe (paint)', () => {
            const est = svc().estimateMaterial(rectRoom, 'farbe');
            expect(est.materialType).toBe('farbe');
            expect(est.label).toBe('Wandfarbe');
            expect(est.unit).toBe('L');
            // area = netWallArea = 45, quantity = (45/10)*2 = 9, waste = 9*1.1 = 9.9
            expect(est.area).toBe(45);
            expect(est.quantity).toBe(9);
            expect(est.totalWithWaste).toBe(9.9);
        });

        it('estimates fliesen (tiles) for floor by default', () => {
            const est = svc().estimateMaterial(rectRoom, 'fliesen');
            expect(est.area).toBe(20); // floor area
            expect(est.quantity).toBe(20);
            // totalWithWaste = 20 * 1.10 = 22
            expect(est.totalWithWaste).toBe(22);
        });

        it('estimates fliesen for wall surface via override', () => {
            const est = svc().estimateMaterial(rectRoom, 'fliesen', { surface: 'wall' });
            expect(est.area).toBe(45); // net wall area
        });

        it('estimates tapete (wallpaper) in rolls', () => {
            const est = svc().estimateMaterial(rectRoom, 'tapete');
            // rollArea = 0.53 * 10.05 = 5.3265
            // quantity = ceil(45 / 5.3265) = ceil(8.45) = 9
            expect(est.area).toBe(45);
            expect(est.quantity).toBe(9);
            expect(est.unit).toBe('Rollen');
        });

        it('estimates laminat (floor area)', () => {
            const est = svc().estimateMaterial(rectRoom, 'laminat');
            expect(est.area).toBe(20);
            expect(est.quantity).toBe(20);
            // waste = 20 * 1.08 = 21.6
            expect(est.totalWithWaste).toBe(21.6);
        });

        it('estimates estrich (screed volume)', () => {
            const est = svc().estimateMaterial(rectRoom, 'estrich');
            expect(est.area).toBe(20);
            // quantity = 20 * 0.05 = 1.0
            expect(est.quantity).toBe(1);
            expect(est.unit).toBe('m³');
        });

        it('estimates putz (plaster)', () => {
            const est = svc().estimateMaterial(rectRoom, 'putz');
            expect(est.area).toBe(45);
            expect(est.quantity).toBe(45);
        });

        it('estimates daemmung (insulation) for wall by default', () => {
            const est = svc().estimateMaterial(rectRoom, 'daemmung');
            expect(est.area).toBe(45);
        });

        it('estimates daemmung for floor via override', () => {
            const est = svc().estimateMaterial(rectRoom, 'daemmung', { surface: 'floor' });
            expect(est.area).toBe(20);
        });

        it('estimates trockenbau (drywall) for wall by default', () => {
            const est = svc().estimateMaterial(rectRoom, 'trockenbau');
            // area = 45, boards = ceil(45 / 2.5) = 18
            expect(est.quantity).toBe(18);
            expect(est.unit).toBe('Platten');
        });

        it('estimates trockenbau for ceiling via override', () => {
            const est = svc().estimateMaterial(rectRoom, 'trockenbau', { surface: 'ceiling' });
            // area = 20 (ceiling), boards = ceil(20 / 2.5) = 8
            expect(est.quantity).toBe(8);
        });

        it('handles unknown material type gracefully', () => {
            const est = svc().estimateMaterial(rectRoom, 'unknown_mat');
            // defaults to floorArea
            expect(est.area).toBe(20);
        });
    });

    describe('estimateAllMaterials', () => {
        it('returns estimates for all material types', () => {
            const room = {
                type: 'rechteck', length: 5, width: 4, height: 2.5, deductions: [],
            };
            const all = svc().estimateAllMaterials(room);
            expect(all.length).toBe(Object.keys(svc().MATERIAL_DEFAULTS).length);
            expect(all.every(e => e.materialType)).toBe(true);
        });
    });

    // ── Quote Integration ──

    describe('generateQuotePositions', () => {
        it('generates floor and wall positions by default', () => {
            const p = createTestProject();
            addRectRoom(p.id);
            const positions = svc().generateQuotePositions(p.id);
            expect(positions.length).toBe(2); // floor + wall
            expect(positions[0].beschreibung).toContain('Bodenfläche');
            expect(positions[0].einheit).toBe('m²');
            expect(positions[1].beschreibung).toContain('Wandfläche');
        });

        it('includes ceiling when requested', () => {
            const p = createTestProject();
            addRectRoom(p.id);
            const positions = svc().generateQuotePositions(p.id, { includeCeiling: true });
            expect(positions.length).toBe(3);
            expect(positions[2].beschreibung).toContain('Deckenfläche');
        });

        it('excludes floor or walls when disabled', () => {
            const p = createTestProject();
            addRectRoom(p.id);
            const positions = svc().generateQuotePositions(p.id, {
                includeFloor: false,
                includeWalls: false,
            });
            expect(positions.length).toBe(0);
        });

        it('includes material-based positions', () => {
            const p = createTestProject();
            addRectRoom(p.id);
            const positions = svc().generateQuotePositions(p.id, {
                includeFloor: false,
                includeWalls: false,
                materialTypes: ['farbe', 'laminat'],
            });
            expect(positions.length).toBe(2);
            expect(positions[0].beschreibung).toContain('Wandfarbe');
            expect(positions[1].beschreibung).toContain('Laminat');
        });

        it('returns empty array for unknown project', () => {
            expect(svc().generateQuotePositions('NOPE')).toEqual([]);
        });

        it('uses defaultUnitPrice', () => {
            const p = createTestProject();
            addRectRoom(p.id);
            const positions = svc().generateQuotePositions(p.id, { defaultUnitPrice: 25 });
            expect(positions[0].preis).toBe(25);
        });
    });

    describe('exportToAngebot', () => {
        it('returns false when storeService is not available', () => {
            window.storeService = undefined;
            const p = createTestProject();
            addRectRoom(p.id);
            expect(svc().exportToAngebot(p.id, 'ANG-1')).toBe(false);
        });

        it('appends positions to existing angebot', () => {
            const p = createTestProject();
            addRectRoom(p.id);

            const mockAngebot = { id: 'ANG-1', positionen: [], netto: 0, mwst: 0, brutto: 0 };
            window.storeService = {
                state: { angebote: [mockAngebot] },
                save: vi.fn(),
            };

            const result = svc().exportToAngebot(p.id, 'ANG-1', { defaultUnitPrice: 10 });
            expect(result).toBe(true);
            expect(mockAngebot.positionen.length).toBeGreaterThan(0);
            expect(window.storeService.save).toHaveBeenCalled();
        });

        it('returns false for unknown angebot id', () => {
            const p = createTestProject();
            addRectRoom(p.id);

            window.storeService = {
                state: { angebote: [] },
                save: vi.fn(),
            };

            expect(svc().exportToAngebot(p.id, 'NOPE')).toBe(false);
        });

        it('returns false when no positions generated', () => {
            const p = createTestProject(); // no rooms
            window.storeService = {
                state: { angebote: [{ id: 'ANG-1', positionen: [] }] },
                save: vi.fn(),
            };
            expect(svc().exportToAngebot(p.id, 'ANG-1')).toBe(false);
        });

        it('uses custom _getTaxRate when available', () => {
            const p = createTestProject();
            addRectRoom(p.id);

            const mockAngebot = { id: 'ANG-1', positionen: [], netto: 0, mwst: 0, brutto: 0 };
            window.storeService = {
                state: { angebote: [mockAngebot] },
                save: vi.fn(),
            };
            window._getTaxRate = () => 0.07;

            svc().exportToAngebot(p.id, 'ANG-1', { defaultUnitPrice: 100 });
            // netto = sum(menge*preis), mwst = netto * 0.07
            expect(mockAngebot.mwst).toBeCloseTo(mockAngebot.netto * 0.07, 1);
            expect(mockAngebot.brutto).toBeCloseTo(mockAngebot.netto * 1.07, 1);

            window._getTaxRate = undefined;
        });
    });

    describe('createAngebotFromProject', () => {
        it('returns null when storeService is not available', () => {
            window.storeService = undefined;
            const p = createTestProject();
            addRectRoom(p.id);
            expect(svc().createAngebotFromProject(p.id)).toBeNull();
        });

        it('returns null for unknown project', () => {
            window.storeService = {
                state: { angebote: [] },
                save: vi.fn(),
                generateId: vi.fn(() => 'ANG-NEW'),
            };
            expect(svc().createAngebotFromProject('NOPE')).toBeNull();
        });

        it('returns null when no positions are generated', () => {
            const p = createTestProject(); // no rooms
            window.storeService = {
                state: { angebote: [] },
                save: vi.fn(),
                generateId: vi.fn(() => 'ANG-NEW'),
            };
            expect(svc().createAngebotFromProject(p.id)).toBeNull();
        });

        it('creates a new angebot with positions', () => {
            const p = createTestProject();
            addRectRoom(p.id);

            window.storeService = {
                state: { angebote: [] },
                save: vi.fn(),
                generateId: vi.fn(() => 'ANG-NEW'),
            };

            const angebot = svc().createAngebotFromProject(p.id);
            expect(angebot).not.toBeNull();
            expect(angebot.id).toBe('ANG-NEW');
            expect(angebot.aufmassProjectId).toBe(p.id);
            expect(angebot.kunde.name).toBe('Max Mustermann');
            expect(angebot.kunde.email).toBe('max@example.de');
            expect(angebot.leistungsart).toBe('aufmass');
            expect(angebot.status).toBe('entwurf');
            expect(angebot.positionen.length).toBeGreaterThan(0);
            expect(angebot.createdAt).toBeTruthy();
            expect(window.storeService.save).toHaveBeenCalled();
        });
    });

    // ── Project Summary ──

    describe('getProjectSummary', () => {
        it('returns empty summary for unknown project', () => {
            const summary = svc().getProjectSummary('NOPE');
            expect(summary.roomCount).toBe(0);
            expect(summary.totalFloorArea).toBe(0);
            expect(summary.rooms).toEqual([]);
        });

        it('summarises a project with rooms', () => {
            const p = createTestProject();
            addRectRoom(p.id, { name: 'Raum A', length: 5, width: 4, height: 2.5 });
            addRectRoom(p.id, { name: 'Raum B', length: 3, width: 3, height: 2.5 });

            const summary = svc().getProjectSummary(p.id);
            expect(summary.roomCount).toBe(2);
            expect(summary.totalFloorArea).toBe(20 + 9); // 29
            expect(summary.totalVolume).toBe(50 + 22.5); // 72.5
            expect(summary.rooms.length).toBe(2);
            expect(summary.rooms[0].name).toBe('Raum A');
            expect(summary.rooms[1].name).toBe('Raum B');
        });

        it('includes deduction areas in summary', () => {
            const p = createTestProject();
            const room = addRectRoom(p.id);
            svc().addDeduction(p.id, room.id, { type: 'fenster', width: 1, height: 1, count: 2 });

            const summary = svc().getProjectSummary(p.id);
            expect(summary.totalDeductionArea).toBe(2);
        });
    });

    // ── Import / Export ──

    describe('exportProject', () => {
        it('exports a project as JSON string', () => {
            const p = createTestProject();
            addRectRoom(p.id);

            const json = svc().exportProject(p.id);
            expect(json).toBeTruthy();

            const data = JSON.parse(json);
            expect(data.version).toBe('1.0');
            expect(data.exportedAt).toBeTruthy();
            expect(data.project.name).toBe('Test Projekt');
            expect(data.summary).toBeTruthy();
            expect(data.summary.roomCount).toBe(1);
        });

        it('returns null for unknown project', () => {
            expect(svc().exportProject('NOPE')).toBeNull();
        });
    });

    describe('importProject', () => {
        it('imports a project from JSON string', () => {
            const p = createTestProject();
            addRectRoom(p.id);

            const json = svc().exportProject(p.id);
            freshService(); // clear

            const imported = svc().importProject(json);
            expect(imported).not.toBeNull();
            expect(imported.name).toContain('(Import)');
            expect(imported.id).not.toBe(p.id); // new ID assigned
            expect(imported.rooms.length).toBe(1);
            expect(imported.rooms[0].id).not.toBe(p.rooms[0].id); // new room ID
        });

        it('imports from an object (not just string)', () => {
            const data = {
                project: {
                    name: 'Imported',
                    rooms: [{ name: 'R1', deductions: [{ name: 'D1' }] }],
                },
            };
            const imported = svc().importProject(data);
            expect(imported).not.toBeNull();
            expect(imported.name).toBe('Imported (Import)');
        });

        it('imports bare project data (no wrapper)', () => {
            const data = { name: 'Bare', rooms: [] };
            const imported = svc().importProject(data);
            expect(imported.name).toBe('Bare (Import)');
        });

        it('returns null for invalid JSON', () => {
            const result = svc().importProject('not json{{{');
            expect(result).toBeNull();
        });
    });

    describe('duplicateProject', () => {
        it('duplicates a project with new IDs', () => {
            const p = createTestProject();
            addRectRoom(p.id);

            const dup = svc().duplicateProject(p.id);
            expect(dup).not.toBeNull();
            expect(dup.id).not.toBe(p.id);
            expect(dup.name).toContain('(Kopie)');
            expect(dup.name).toContain('(Import)');
            expect(dup.rooms.length).toBe(1);
        });

        it('returns null for unknown project', () => {
            expect(svc().duplicateProject('NOPE')).toBeNull();
        });
    });

    // ── Persistence Edge Cases ──

    describe('save', () => {
        it('handles QuotaExceededError gracefully', () => {
            const origSetItem = localStorage.setItem;
            localStorage.setItem = vi.fn(() => {
                const err = new Error('quota');
                err.name = 'QuotaExceededError';
                throw err;
            });

            // Should not throw
            expect(() => svc().save()).not.toThrow();
            expect(console.warn).toHaveBeenCalled();

            localStorage.setItem = origSetItem;
        });

        it('handles generic save errors gracefully', () => {
            const origSetItem = localStorage.setItem;
            localStorage.setItem = vi.fn(() => { throw new Error('disk full'); });

            expect(() => svc().save()).not.toThrow();
            expect(console.error).toHaveBeenCalled();

            localStorage.setItem = origSetItem;
        });
    });

    describe('load', () => {
        it('handles corrupt localStorage data gracefully', () => {
            mockStorage['mhs_aufmass_data'] = 'not-json{{{';
            // Reconstruct — should not throw, should reset to empty
            window.aufmassService = new window.aufmassService.constructor();
            expect(svc().projects).toEqual([]);
        });
    });

    // ── Helpers ──

    describe('_toNum', () => {
        it('converts valid numbers', () => {
            expect(svc()._toNum(5)).toBe(5);
            expect(svc()._toNum('3.14')).toBe(3.14);
            expect(svc()._toNum(0)).toBe(0);
        });

        it('returns 0 for negative numbers', () => {
            expect(svc()._toNum(-5)).toBe(0);
        });

        it('returns 0 for NaN values', () => {
            expect(svc()._toNum('abc')).toBe(0);
            expect(svc()._toNum(undefined)).toBe(0);
            expect(svc()._toNum(null)).toBe(0);
        });
    });

    describe('_round', () => {
        it('rounds to 2 decimal places by default', () => {
            expect(svc()._round(3.14159)).toBe(3.14);
            expect(svc()._round(2.005)).toBe(2.01);
        });

        it('rounds to custom decimal places', () => {
            expect(svc()._round(3.14159, 3)).toBe(3.142);
            expect(svc()._round(3.14159, 0)).toBe(3);
        });
    });

    describe('_generateId', () => {
        it('generates an ID with the given prefix', () => {
            const id = svc()._generateId('TEST');
            expect(id).toMatch(/^TEST-/);
        });

        it('uses storeService.generateId when available', () => {
            window.storeService = { generateId: vi.fn(() => 'STORE-123') };
            const id = svc()._generateId('X');
            expect(id).toBe('STORE-123');
            window.storeService = undefined;
        });
    });
});
