/* ============================================
   Aufmass Service (Site Measurement)
   Digital room/site measurement with calculations,
   material estimation, and quote integration.
   ============================================ */

class AufmassService {
    constructor() {
        this.projects = [];
        this.STORAGE_KEY = 'mhs_aufmass_data';

        // Room type definitions
        this.ROOM_TYPES = {
            rechteck: { label: 'Rechteck', icon: '▭', fields: ['length', 'width', 'height'] },
            lform: { label: 'L-Form', icon: '⌐', fields: ['length1', 'width1', 'length2', 'width2', 'height'] },
            trapez: { label: 'Trapez', icon: '⏢', fields: ['sideA', 'sideB', 'depth', 'height'] },
            dreieck: { label: 'Dreieck', icon: '△', fields: ['base', 'triHeight', 'height'] },
            kreis: { label: 'Kreis', icon: '○', fields: ['radius', 'height'] },
            frei: { label: 'Frei (Polygon)', icon: '⬠', fields: ['points', 'height'] }
        };

        // Material estimation defaults
        this.MATERIAL_DEFAULTS = {
            farbe: {
                coverage: 10,       // 10 m² per liter
                unit: 'L',
                wasteFactor: 1.1,
                coats: 2,
                label: 'Wandfarbe',
                description: '10 m²/L, 2 Anstriche'
            },
            fliesen: {
                coverage: 1,        // 1 m² per m²
                unit: 'm\u00B2',
                wasteFactor: 1.10,
                label: 'Fliesen',
                description: '+10% Verschnitt'
            },
            tapete: {
                rollWidth: 0.53,    // meters
                rollLength: 10.05,  // meters
                unit: 'Rollen',
                wasteFactor: 1.15,
                label: 'Tapete',
                description: '0,53m x 10,05m Rolle, +15% Verschnitt'
            },
            laminat: {
                coverage: 1,        // 1 m² per m²
                unit: 'm\u00B2',
                wasteFactor: 1.08,
                label: 'Laminat/Parkett',
                description: '+8% Verschnitt'
            },
            estrich: {
                thickness: 0.05,    // 5cm default
                unit: 'm\u00B3',
                wasteFactor: 1.05,
                label: 'Estrich',
                description: '5 cm Dicke, +5% Verschnitt'
            },
            putz: {
                thickness: 0.015,   // 1.5cm default
                coverage: 1,
                unit: 'm\u00B2',
                wasteFactor: 1.1,
                label: 'Putz/Spachtel',
                description: '1,5 cm Dicke, +10% Verschnitt'
            },
            daemmung: {
                thickness: 0.1,     // 10cm default
                unit: 'm\u00B2',
                wasteFactor: 1.05,
                label: 'D\u00E4mmung',
                description: '10 cm Dicke, +5% Verschnitt'
            },
            trockenbau: {
                boardWidth: 1.25,   // meters
                boardHeight: 2.0,   // meters
                boardSize: 2.5,     // m² per board
                unit: 'Platten',
                wasteFactor: 1.12,
                label: 'Trockenbau',
                description: '1,25m x 2,00m Platten, +12% Verschnitt'
            }
        };

        // Deduction type definitions
        this.DEDUCTION_TYPES = {
            fenster: { label: 'Fenster', icon: '🪟', defaultWidth: 1.2, defaultHeight: 1.4 },
            tuer: { label: 'T\u00FCr', icon: '🚪', defaultWidth: 0.9, defaultHeight: 2.1 },
            sonstiges: { label: 'Sonstiges', icon: '✂️', defaultWidth: 1.0, defaultHeight: 1.0 }
        };

        this.load();
    }

    // ============================================
    // Project Management
    // ============================================

    /**
     * Creates a new measurement project.
     * @param {Object} data - { name, customerName, customerEmail, address, notes }
     * @returns {Object} The created project
     */
    createProject(data) {
        const project = {
            id: this._generateId('AUFM'),
            name: data.name || 'Neues Aufma\u00DF',
            customerName: data.customerName || '',
            customerEmail: data.customerEmail || '',
            address: data.address || '',
            notes: data.notes || '',
            rooms: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.projects.push(project);
        this.save();
        return project;
    }

    /**
     * Gets a project by ID.
     * @param {string} id
     * @returns {Object|null}
     */
    getProject(id) {
        return this.projects.find(p => p.id === id) || null;
    }

    /**
     * Updates a project.
     * @param {string} id
     * @param {Object} data
     * @returns {Object|null}
     */
    updateProject(id, data) {
        const project = this.getProject(id);
        if (!project) {return null;}

        const allowed = ['name', 'customerName', 'customerEmail', 'address', 'notes'];
        allowed.forEach(key => {
            if (data[key] !== undefined) {
                project[key] = data[key];
            }
        });
        project.updatedAt = new Date().toISOString();

        this.save();
        return project;
    }

    /**
     * Deletes a project.
     * @param {string} id
     * @returns {boolean}
     */
    deleteProject(id) {
        const index = this.projects.findIndex(p => p.id === id);
        if (index === -1) {return false;}

        this.projects.splice(index, 1);
        this.save();
        return true;
    }

    /**
     * Gets all projects, optionally filtered.
     * @param {Object} [filter] - { search, customerName }
     * @returns {Array}
     */
    getProjects(filter = {}) {
        let results = [...this.projects];

        if (filter.search) {
            const term = filter.search.toLowerCase();
            results = results.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.customerName.toLowerCase().includes(term) ||
                p.address.toLowerCase().includes(term)
            );
        }

        if (filter.customerName) {
            results = results.filter(p =>
                p.customerName.toLowerCase().includes(filter.customerName.toLowerCase())
            );
        }

        // Sort by most recently updated
        results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        return results;
    }

    // ============================================
    // Room Management
    // ============================================

    /**
     * Adds a room to a project.
     * @param {string} projectId
     * @param {Object} roomData - { name, type, ...dimensions }
     * @returns {Object|null} The created room
     */
    addRoom(projectId, roomData) {
        const project = this.getProject(projectId);
        if (!project) {return null;}

        const room = {
            id: this._generateId('RAUM'),
            name: roomData.name || 'Raum ' + (project.rooms.length + 1),
            type: roomData.type || 'rechteck',
            // Dimension fields (type-dependent)
            length: this._toNum(roomData.length),
            width: this._toNum(roomData.width),
            height: this._toNum(roomData.height) || 2.5,
            // L-form additional
            length1: this._toNum(roomData.length1),
            width1: this._toNum(roomData.width1),
            length2: this._toNum(roomData.length2),
            width2: this._toNum(roomData.width2),
            // Trapezoid
            sideA: this._toNum(roomData.sideA),
            sideB: this._toNum(roomData.sideB),
            depth: this._toNum(roomData.depth),
            // Triangle
            base: this._toNum(roomData.base),
            triHeight: this._toNum(roomData.triHeight),
            // Circle
            radius: this._toNum(roomData.radius),
            // Custom polygon
            points: roomData.points || [],
            // Deductions
            deductions: [],
            // Notes
            notes: roomData.notes || '',
            createdAt: new Date().toISOString()
        };

        project.rooms.push(room);
        project.updatedAt = new Date().toISOString();
        this.save();
        return room;
    }

    /**
     * Updates a room in a project.
     * @param {string} projectId
     * @param {string} roomId
     * @param {Object} data
     * @returns {Object|null}
     */
    updateRoom(projectId, roomId, data) {
        const project = this.getProject(projectId);
        if (!project) {return null;}

        const room = project.rooms.find(r => r.id === roomId);
        if (!room) {return null;}

        const allowed = [
            'name', 'type', 'length', 'width', 'height',
            'length1', 'width1', 'length2', 'width2',
            'sideA', 'sideB', 'depth',
            'base', 'triHeight',
            'radius', 'points', 'notes'
        ];

        allowed.forEach(key => {
            if (data[key] !== undefined) {
                if (['points', 'name', 'type', 'notes'].includes(key)) {
                    room[key] = data[key];
                } else {
                    room[key] = this._toNum(data[key]);
                }
            }
        });

        project.updatedAt = new Date().toISOString();
        this.save();
        return room;
    }

    /**
     * Deletes a room from a project.
     * @param {string} projectId
     * @param {string} roomId
     * @returns {boolean}
     */
    deleteRoom(projectId, roomId) {
        const project = this.getProject(projectId);
        if (!project) {return false;}

        const index = project.rooms.findIndex(r => r.id === roomId);
        if (index === -1) {return false;}

        project.rooms.splice(index, 1);
        project.updatedAt = new Date().toISOString();
        this.save();
        return true;
    }

    // ============================================
    // Deductions (Windows, Doors, Other)
    // ============================================

    /**
     * Adds a deduction (window/door/other) to a room.
     * @param {string} projectId
     * @param {string} roomId
     * @param {Object} deduction - { type, width, height, count, name, wall }
     * @returns {Object|null}
     */
    addDeduction(projectId, roomId, deduction) {
        const project = this.getProject(projectId);
        if (!project) {return null;}

        const room = project.rooms.find(r => r.id === roomId);
        if (!room) {return null;}

        const typeDef = this.DEDUCTION_TYPES[deduction.type] || this.DEDUCTION_TYPES.sonstiges;

        const ded = {
            id: this._generateId('DED'),
            type: deduction.type || 'sonstiges',
            name: deduction.name || typeDef.label,
            width: this._toNum(deduction.width) || typeDef.defaultWidth,
            height: this._toNum(deduction.height) || typeDef.defaultHeight,
            count: Math.max(1, parseInt(deduction.count) || 1),
            wall: deduction.wall || '' // optional: which wall
        };

        if (!room.deductions) {room.deductions = [];}
        room.deductions.push(ded);
        project.updatedAt = new Date().toISOString();
        this.save();
        return ded;
    }

    /**
     * Updates a deduction.
     * @param {string} projectId
     * @param {string} roomId
     * @param {string} deductionId
     * @param {Object} data
     * @returns {Object|null}
     */
    updateDeduction(projectId, roomId, deductionId, data) {
        const project = this.getProject(projectId);
        if (!project) {return null;}

        const room = project.rooms.find(r => r.id === roomId);
        if (!room || !room.deductions) {return null;}

        const ded = room.deductions.find(d => d.id === deductionId);
        if (!ded) {return null;}

        if (data.type !== undefined) {ded.type = data.type;}
        if (data.name !== undefined) {ded.name = data.name;}
        if (data.width !== undefined) {ded.width = this._toNum(data.width);}
        if (data.height !== undefined) {ded.height = this._toNum(data.height);}
        if (data.count !== undefined) {ded.count = Math.max(1, parseInt(data.count) || 1);}
        if (data.wall !== undefined) {ded.wall = data.wall;}

        project.updatedAt = new Date().toISOString();
        this.save();
        return ded;
    }

    /**
     * Removes a deduction from a room.
     * @param {string} projectId
     * @param {string} roomId
     * @param {string} deductionId
     * @returns {boolean}
     */
    removeDeduction(projectId, roomId, deductionId) {
        const project = this.getProject(projectId);
        if (!project) {return false;}

        const room = project.rooms.find(r => r.id === roomId);
        if (!room || !room.deductions) {return false;}

        const index = room.deductions.findIndex(d => d.id === deductionId);
        if (index === -1) {return false;}

        room.deductions.splice(index, 1);
        project.updatedAt = new Date().toISOString();
        this.save();
        return true;
    }

    // ============================================
    // Calculations
    // ============================================

    /**
     * Calculates all metrics for a room based on its type.
     * @param {Object} room
     * @returns {Object} { floorArea, ceilingArea, wallArea, perimeter, volume, wallAreas, netWallArea, totalDeductionArea }
     */
    calculateRoom(room) {
        if (!room) {return this._emptyCalc();}

        let floorArea = 0;
        let perimeter = 0;
        let wallAreas = [];

        switch (room.type) {
            case 'rechteck':
                floorArea = this.calculateFloorArea(room.length, room.width);
                perimeter = this.calculatePerimeter(room.length, room.width);
                wallAreas = this._rectangleWallAreas(room.length, room.width, room.height);
                break;

            case 'lform':
                floorArea = this._lFormFloorArea(room);
                perimeter = this._lFormPerimeter(room);
                wallAreas = this._lFormWallAreas(room);
                break;

            case 'trapez':
                floorArea = this._trapezoidFloorArea(room.sideA, room.sideB, room.depth);
                perimeter = this._trapezoidPerimeter(room.sideA, room.sideB, room.depth);
                wallAreas = this._trapezoidWallAreas(room);
                break;

            case 'dreieck':
                floorArea = this._triangleFloorArea(room.base, room.triHeight);
                perimeter = this._trianglePerimeter(room.base, room.triHeight);
                wallAreas = this._triangleWallAreas(room);
                break;

            case 'kreis':
                floorArea = this._circleFloorArea(room.radius);
                perimeter = this._circlePerimeter(room.radius);
                wallAreas = [{ wall: 'Rundwand', area: this._round(perimeter * (room.height || 0)) }];
                break;

            case 'frei':
                floorArea = this._polygonFloorArea(room.points);
                perimeter = this._polygonPerimeter(room.points);
                wallAreas = this._polygonWallAreas(room.points, room.height);
                break;

            default:
                floorArea = this.calculateFloorArea(room.length, room.width);
                perimeter = this.calculatePerimeter(room.length, room.width);
                wallAreas = this._rectangleWallAreas(room.length, room.width, room.height);
        }

        const ceilingArea = floorArea;
        const wallArea = wallAreas.reduce((sum, w) => sum + w.area, 0);
        const volume = this._round(floorArea * (room.height || 0));

        // Calculate deductions
        const totalDeductionArea = this._totalDeductionArea(room);
        const netWallArea = this._round(Math.max(0, wallArea - totalDeductionArea));

        return {
            floorArea: this._round(floorArea),
            ceilingArea: this._round(ceilingArea),
            wallArea: this._round(wallArea),
            perimeter: this._round(perimeter),
            volume: this._round(volume),
            wallAreas,
            netWallArea,
            totalDeductionArea: this._round(totalDeductionArea)
        };
    }

    /**
     * Calculates net wall area (wall area minus deductions).
     * @param {Object} room
     * @returns {number}
     */
    calculateNetArea(room) {
        const calc = this.calculateRoom(room);
        return calc.netWallArea;
    }

    /**
     * Basic floor area for rectangle.
     */
    calculateFloorArea(length, width) {
        return this._round((this._toNum(length)) * (this._toNum(width)));
    }

    /**
     * Basic wall area for rectangle.
     */
    calculateWallArea(length, width, height) {
        const l = this._toNum(length);
        const w = this._toNum(width);
        const h = this._toNum(height);
        return this._round(2 * (l + w) * h);
    }

    /**
     * Basic volume for rectangle.
     */
    calculateVolume(length, width, height) {
        return this._round(this._toNum(length) * this._toNum(width) * this._toNum(height));
    }

    /**
     * Basic perimeter for rectangle.
     */
    calculatePerimeter(length, width) {
        return this._round(2 * (this._toNum(length) + this._toNum(width)));
    }

    // ============================================
    // Shape-specific Calculations (Private)
    // ============================================

    _rectangleWallAreas(length, width, height) {
        const l = this._toNum(length);
        const w = this._toNum(width);
        const h = this._toNum(height);
        return [
            { wall: 'Wand A (L\u00E4nge)', area: this._round(l * h) },
            { wall: 'Wand B (Breite)', area: this._round(w * h) },
            { wall: 'Wand C (L\u00E4nge)', area: this._round(l * h) },
            { wall: 'Wand D (Breite)', area: this._round(w * h) }
        ];
    }

    // L-Form: two rectangles joined
    _lFormFloorArea(room) {
        const a1 = this._toNum(room.length1) * this._toNum(room.width1);
        const a2 = this._toNum(room.length2) * this._toNum(room.width2);
        return this._round(a1 + a2);
    }

    _lFormPerimeter(room) {
        const l1 = this._toNum(room.length1);
        const w1 = this._toNum(room.width1);
        const l2 = this._toNum(room.length2);
        const w2 = this._toNum(room.width2);
        // Outer perimeter of an L-shape
        // Assumes the L is formed by removing a rectangle from a larger one
        return this._round(2 * (l1 + w1) + 2 * (l2 + w2) - 2 * Math.min(w1, w2));
    }

    _lFormWallAreas(room) {
        const h = this._toNum(room.height);
        const l1 = this._toNum(room.length1);
        const w1 = this._toNum(room.width1);
        const l2 = this._toNum(room.length2);
        const w2 = this._toNum(room.width2);

        // Simplified: enumerate the 6 wall segments of an L-shape
        return [
            { wall: 'Wand 1', area: this._round(l1 * h) },
            { wall: 'Wand 2', area: this._round(w1 * h) },
            { wall: 'Wand 3', area: this._round(Math.abs(l1 - l2) * h) },
            { wall: 'Wand 4', area: this._round(Math.abs(w1 - w2) * h) },
            { wall: 'Wand 5', area: this._round(l2 * h) },
            { wall: 'Wand 6', area: this._round(w2 * h) }
        ];
    }

    // Trapezoid
    _trapezoidFloorArea(sideA, sideB, depth) {
        const a = this._toNum(sideA);
        const b = this._toNum(sideB);
        const d = this._toNum(depth);
        return this._round(((a + b) / 2) * d);
    }

    _trapezoidPerimeter(sideA, sideB, depth) {
        const a = this._toNum(sideA);
        const b = this._toNum(sideB);
        const d = this._toNum(depth);
        // Calculate slanted sides using Pythagorean theorem
        const offset = Math.abs(a - b) / 2;
        const slantSide = Math.sqrt(offset * offset + d * d);
        return this._round(a + b + 2 * slantSide);
    }

    _trapezoidWallAreas(room) {
        const a = this._toNum(room.sideA);
        const b = this._toNum(room.sideB);
        const d = this._toNum(room.depth);
        const h = this._toNum(room.height);
        const offset = Math.abs(a - b) / 2;
        const slantSide = Math.sqrt(offset * offset + d * d);
        return [
            { wall: 'Seite A (Parallel)', area: this._round(a * h) },
            { wall: 'Seite B (Parallel)', area: this._round(b * h) },
            { wall: 'Schr\u00E4gseite links', area: this._round(slantSide * h) },
            { wall: 'Schr\u00E4gseite rechts', area: this._round(slantSide * h) }
        ];
    }

    // Triangle
    _triangleFloorArea(base, triHeight) {
        return this._round((this._toNum(base) * this._toNum(triHeight)) / 2);
    }

    _trianglePerimeter(base, triHeight) {
        const b = this._toNum(base);
        const th = this._toNum(triHeight);
        // Assume isosceles triangle for perimeter estimation
        const side = Math.sqrt((b / 2) * (b / 2) + th * th);
        return this._round(b + 2 * side);
    }

    _triangleWallAreas(room) {
        const b = this._toNum(room.base);
        const th = this._toNum(room.triHeight);
        const h = this._toNum(room.height);
        const side = Math.sqrt((b / 2) * (b / 2) + th * th);
        return [
            { wall: 'Basis', area: this._round(b * h) },
            { wall: 'Seite links', area: this._round(side * h) },
            { wall: 'Seite rechts', area: this._round(side * h) }
        ];
    }

    // Circle
    _circleFloorArea(radius) {
        const r = this._toNum(radius);
        return this._round(Math.PI * r * r);
    }

    _circlePerimeter(radius) {
        return this._round(2 * Math.PI * this._toNum(radius));
    }

    // Custom Polygon (Shoelace formula)
    _polygonFloorArea(points) {
        if (!points || points.length < 3) {return 0;}
        let area = 0;
        const n = points.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return this._round(Math.abs(area) / 2);
    }

    _polygonPerimeter(points) {
        if (!points || points.length < 2) {return 0;}
        let perimeter = 0;
        const n = points.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const dx = points[j].x - points[i].x;
            const dy = points[j].y - points[i].y;
            perimeter += Math.sqrt(dx * dx + dy * dy);
        }
        return this._round(perimeter);
    }

    _polygonWallAreas(points, height) {
        if (!points || points.length < 2) {return [];}
        const h = this._toNum(height);
        const walls = [];
        const n = points.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const dx = points[j].x - points[i].x;
            const dy = points[j].y - points[i].y;
            const wallLength = Math.sqrt(dx * dx + dy * dy);
            walls.push({
                wall: `Wand ${i + 1}`,
                area: this._round(wallLength * h)
            });
        }
        return walls;
    }

    // Deductions total
    _totalDeductionArea(room) {
        if (!room || !room.deductions || room.deductions.length === 0) {return 0;}
        return room.deductions.reduce((sum, d) => {
            return sum + (this._toNum(d.width) * this._toNum(d.height) * (d.count || 1));
        }, 0);
    }

    _emptyCalc() {
        return {
            floorArea: 0, ceilingArea: 0, wallArea: 0,
            perimeter: 0, volume: 0, wallAreas: [],
            netWallArea: 0, totalDeductionArea: 0
        };
    }

    // ============================================
    // Material Estimation
    // ============================================

    /**
     * Estimates material required for a room.
     * @param {Object} room
     * @param {string} materialType - key from MATERIAL_DEFAULTS
     * @param {Object} [overrides] - optional overrides for defaults
     * @returns {Object} { materialType, label, quantity, unit, wasteFactor, totalWithWaste, area, description }
     */
    estimateMaterial(room, materialType, overrides = {}) {
        const defaults = this.getMaterialDefaults();
        const mat = { ...defaults[materialType], ...overrides };

        if (!mat) {
            return { materialType, label: 'Unbekannt', quantity: 0, unit: '', wasteFactor: 1, totalWithWaste: 0, area: 0 };
        }

        const calc = this.calculateRoom(room);
        let area = 0;
        let quantity = 0;

        switch (materialType) {
            case 'farbe': {
                // Paint: net wall area, divided by coverage, times coats
                area = calc.netWallArea;
                const coats = mat.coats || 2;
                quantity = (area / (mat.coverage || 10)) * coats;
                break;
            }
            case 'fliesen': {
                // Tiles: can be floor or wall; default to floor
                area = overrides.surface === 'wall' ? calc.netWallArea : calc.floorArea;
                quantity = area;
                break;
            }
            case 'tapete': {
                // Wallpaper: net wall area / roll coverage
                area = calc.netWallArea;
                const rollArea = (mat.rollWidth || 0.53) * (mat.rollLength || 10.05);
                quantity = Math.ceil(area / rollArea);
                break;
            }
            case 'laminat': {
                // Laminate: floor area
                area = calc.floorArea;
                quantity = area;
                break;
            }
            case 'estrich': {
                // Screed: floor area * thickness = volume
                area = calc.floorArea;
                quantity = area * (mat.thickness || 0.05);
                break;
            }
            case 'putz': {
                // Plaster: net wall area
                area = calc.netWallArea;
                quantity = area;
                break;
            }
            case 'daemmung': {
                // Insulation: wall area or floor area
                area = overrides.surface === 'floor' ? calc.floorArea : calc.netWallArea;
                quantity = area;
                break;
            }
            case 'trockenbau': {
                // Drywall: area / board size = number of boards
                area = overrides.surface === 'ceiling' ? calc.ceilingArea : calc.netWallArea;
                quantity = Math.ceil(area / (mat.boardSize || 2.5));
                break;
            }
            default: {
                area = calc.floorArea;
                quantity = area;
            }
        }

        const totalWithWaste = this._round(quantity * (mat.wasteFactor || 1));

        return {
            materialType,
            label: mat.label || materialType,
            description: mat.description || '',
            quantity: this._round(quantity),
            unit: mat.unit || 'm\u00B2',
            wasteFactor: mat.wasteFactor || 1,
            totalWithWaste,
            area: this._round(area)
        };
    }

    /**
     * Returns the default material estimation parameters.
     * @returns {Object}
     */
    getMaterialDefaults() {
        return JSON.parse(JSON.stringify(this.MATERIAL_DEFAULTS));
    }

    /**
     * Estimates all materials for a room.
     * @param {Object} room
     * @returns {Array}
     */
    estimateAllMaterials(room) {
        return Object.keys(this.MATERIAL_DEFAULTS).map(key => this.estimateMaterial(room, key));
    }

    // ============================================
    // Quote Integration
    // ============================================

    /**
     * Generates Angebot-compatible position entries from a project's measurements.
     * Positions match the format: { beschreibung, menge, einheit, preis }
     * @param {string} projectId
     * @param {Object} [options] - { includeFloor, includeWalls, includeCeiling, materialTypes, unitPrice }
     * @returns {Array} Array of position objects
     */
    generateQuotePositions(projectId, options = {}) {
        const project = this.getProject(projectId);
        if (!project) {return [];}

        const positions = [];
        const {
            includeFloor = true,
            includeWalls = true,
            includeCeiling = false,
            materialTypes = [],
            defaultUnitPrice = 0
        } = options;

        project.rooms.forEach(room => {
            const calc = this.calculateRoom(room);
            const roomLabel = room.name || 'Raum';

            if (includeFloor && calc.floorArea > 0) {
                positions.push({
                    beschreibung: `${roomLabel} - Bodenfl\u00E4che`,
                    menge: calc.floorArea,
                    einheit: 'm\u00B2',
                    preis: defaultUnitPrice
                });
            }

            if (includeWalls && calc.netWallArea > 0) {
                positions.push({
                    beschreibung: `${roomLabel} - Wandfl\u00E4che (netto)`,
                    menge: calc.netWallArea,
                    einheit: 'm\u00B2',
                    preis: defaultUnitPrice
                });
            }

            if (includeCeiling && calc.ceilingArea > 0) {
                positions.push({
                    beschreibung: `${roomLabel} - Deckenfl\u00E4che`,
                    menge: calc.ceilingArea,
                    einheit: 'm\u00B2',
                    preis: defaultUnitPrice
                });
            }

            // Material-based positions
            materialTypes.forEach(matType => {
                const est = this.estimateMaterial(room, matType);
                if (est.totalWithWaste > 0) {
                    positions.push({
                        beschreibung: `${roomLabel} - ${est.label}`,
                        menge: est.totalWithWaste,
                        einheit: est.unit,
                        preis: defaultUnitPrice
                    });
                }
            });
        });

        return positions;
    }

    /**
     * Exports calculated positions into an existing Angebot.
     * Compatible with store.angebote[].positionen format.
     * @param {string} projectId
     * @param {string} angebotId
     * @param {Object} [options]
     * @returns {boolean}
     */
    exportToAngebot(projectId, angebotId, options = {}) {
        if (!window.storeService) {
            console.error('StoreService not available');
            return false;
        }

        const positions = this.generateQuotePositions(projectId, options);
        if (positions.length === 0) {return false;}

        const store = window.storeService.state;
        const angebot = store.angebote.find(a => a.id === angebotId);
        if (!angebot) {return false;}

        // Append positions
        if (!angebot.positionen) {angebot.positionen = [];}
        angebot.positionen.push(...positions);

        // Recalculate totals
        const netto = angebot.positionen.reduce((sum, p) => sum + ((p.menge || 0) * (p.preis || 0)), 0);
        angebot.netto = this._round(netto);
        angebot.mwst = this._round(netto * 0.19);
        angebot.brutto = this._round(netto * 1.19);

        window.storeService.save();
        return true;
    }

    /**
     * Creates a new Angebot with positions from the measurement project.
     * @param {string} projectId
     * @param {Object} [options]
     * @returns {Object|null} The created Angebot
     */
    createAngebotFromProject(projectId, options = {}) {
        if (!window.storeService) {
            console.error('StoreService not available');
            return null;
        }

        const project = this.getProject(projectId);
        if (!project) {return null;}

        const positions = this.generateQuotePositions(projectId, options);
        if (positions.length === 0) {return null;}

        const netto = positions.reduce((sum, p) => sum + ((p.menge || 0) * (p.preis || 0)), 0);

        const angebot = {
            id: window.storeService.generateId('ANG'),
            anfrageId: null,
            aufmassProjectId: projectId,
            kunde: {
                name: project.customerName || 'Unbekannt',
                email: project.customerEmail || ''
            },
            leistungsart: 'aufmass',
            positionen: positions,
            netto: this._round(netto),
            mwst: this._round(netto * 0.19),
            brutto: this._round(netto * 1.19),
            status: 'entwurf',
            angebotText: `Aufma\u00DF-basiertes Angebot f\u00FCr ${project.name}`,
            createdAt: new Date().toISOString()
        };

        window.storeService.state.angebote.push(angebot);
        window.storeService.save();

        return angebot;
    }

    // ============================================
    // Project Summary
    // ============================================

    /**
     * Returns a summary of all rooms in a project.
     * @param {string} projectId
     * @returns {Object}
     */
    getProjectSummary(projectId) {
        const project = this.getProject(projectId);
        if (!project) {
            return {
                roomCount: 0, totalFloorArea: 0, totalWallArea: 0,
                totalNetWallArea: 0, totalCeilingArea: 0, totalVolume: 0,
                totalPerimeter: 0, totalDeductionArea: 0, rooms: []
            };
        }

        const roomSummaries = project.rooms.map(room => {
            const calc = this.calculateRoom(room);
            return {
                id: room.id,
                name: room.name,
                type: room.type,
                ...calc
            };
        });

        return {
            roomCount: project.rooms.length,
            totalFloorArea: this._round(roomSummaries.reduce((s, r) => s + r.floorArea, 0)),
            totalWallArea: this._round(roomSummaries.reduce((s, r) => s + r.wallArea, 0)),
            totalNetWallArea: this._round(roomSummaries.reduce((s, r) => s + r.netWallArea, 0)),
            totalCeilingArea: this._round(roomSummaries.reduce((s, r) => s + r.ceilingArea, 0)),
            totalVolume: this._round(roomSummaries.reduce((s, r) => s + r.volume, 0)),
            totalPerimeter: this._round(roomSummaries.reduce((s, r) => s + r.perimeter, 0)),
            totalDeductionArea: this._round(roomSummaries.reduce((s, r) => s + r.totalDeductionArea, 0)),
            rooms: roomSummaries
        };
    }

    // ============================================
    // Import / Export
    // ============================================

    /**
     * Exports a project as JSON.
     * @param {string} projectId
     * @returns {string|null}
     */
    exportProject(projectId) {
        const project = this.getProject(projectId);
        if (!project) {return null;}

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            project: JSON.parse(JSON.stringify(project)),
            summary: this.getProjectSummary(projectId)
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Imports a project from JSON data.
     * @param {string} jsonData
     * @returns {Object|null} The imported project
     */
    importProject(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            const projectData = data.project || data;

            // Assign new ID to avoid conflicts
            projectData.id = this._generateId('AUFM');
            projectData.name = (projectData.name || 'Import') + ' (Import)';
            projectData.updatedAt = new Date().toISOString();

            // Assign new IDs to rooms and deductions
            if (projectData.rooms) {
                projectData.rooms.forEach(room => {
                    room.id = this._generateId('RAUM');
                    if (room.deductions) {
                        room.deductions.forEach(d => {
                            d.id = this._generateId('DED');
                        });
                    }
                });
            }

            this.projects.push(projectData);
            this.save();
            return projectData;
        } catch (e) {
            console.error('Aufma\u00DF Import fehlgeschlagen:', e);
            return null;
        }
    }

    /**
     * Duplicates an existing project.
     * @param {string} projectId
     * @returns {Object|null}
     */
    duplicateProject(projectId) {
        const json = this.exportProject(projectId);
        if (!json) {return null;}
        const data = JSON.parse(json);
        data.project.name = data.project.name + ' (Kopie)';
        return this.importProject(data);
    }

    // ============================================
    // Persistence
    // ============================================

    /**
     * Saves all projects to localStorage.
     */
    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.projects));
        } catch (e) {
            console.error('Aufma\u00DF save failed:', e);
        }
    }

    /**
     * Loads all projects from localStorage.
     */
    load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (data) {
                this.projects = JSON.parse(data);
            }
        } catch (e) {
            console.error('Aufma\u00DF load failed:', e);
            this.projects = [];
        }
    }

    // ============================================
    // Helpers
    // ============================================

    _generateId(prefix) {
        if (window.storeService && window.storeService.generateId) {
            return window.storeService.generateId(prefix);
        }
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${prefix}-${timestamp}-${random}`.toUpperCase();
    }

    _toNum(val) {
        const num = parseFloat(val);
        return isNaN(num) || num < 0 ? 0 : num;
    }

    _round(val, decimals = 2) {
        const factor = Math.pow(10, decimals);
        return Math.round(val * factor) / factor;
    }
}

// Attach to window
window.aufmassService = new AufmassService();
