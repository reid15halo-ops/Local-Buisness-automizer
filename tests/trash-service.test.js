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
    getElementById: vi.fn(() => null),
    createElement: vi.fn((tag) => ({
        tagName: tag,
        className: '',
        innerHTML: '',
        id: '',
        setAttribute: vi.fn(),
        appendChild: vi.fn(),
        querySelector: vi.fn(() => ({
            addEventListener: vi.fn(),
            style: {},
        })),
        classList: { add: vi.fn() },
        remove: vi.fn(),
        style: {},
    })),
    body: {
        appendChild: vi.fn(),
    },
};

globalThis.requestAnimationFrame = vi.fn(cb => cb());

globalThis.window = globalThis;
window.ErrorDisplay = { showSuccess: vi.fn() };
window.storeService = null;
window.customerService = null;
window.materialService = null;
window.switchView = null;

await import('../js/services/trash-service.js');

const svc = () => window.trashService;

// ============================================
// Tests
// ============================================

describe('TrashService', () => {
    beforeEach(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        vi.clearAllMocks();
        // Reset global services
        window.storeService = null;
        window.customerService = null;
        window.materialService = null;
        window.switchView = null;
        window.ErrorDisplay = { showSuccess: vi.fn() };
        // Re-instantiate the service fresh
        window.trashService = new window.trashService.constructor();
    });

    // ── Constructor & Defaults ──

    describe('Constructor', () => {
        it('initializes with empty trash', () => {
            expect(svc().getTrashCount()).toBe(0);
        });

        it('has default UNDO_TIMEOUT of 10 seconds', () => {
            expect(svc().UNDO_TIMEOUT).toBe(10000);
        });

        it('has default PURGE_DAYS of 30', () => {
            expect(svc().PURGE_DAYS).toBe(30);
        });

        it('loads existing trash from storage', () => {
            const existing = [
                {
                    id: 'trash-existing-1',
                    entityType: 'kunde',
                    originalId: 'k-1',
                    data: { id: 'k-1', name: 'Mueller GmbH' },
                    deletedAt: new Date().toISOString(),
                    deletedBy: 'Unbekannt',
                    description: 'Kunde "Mueller GmbH"',
                },
            ];
            mockStorage['freyai_trash'] = JSON.stringify(existing);
            window.trashService = new window.trashService.constructor();
            expect(svc().getTrashCount()).toBe(1);
        });
    });

    // ── Soft Delete ──

    describe('softDelete', () => {
        it('returns null for item without id', () => {
            const result = svc().softDelete('kunde', {});
            expect(result).toBeNull();
        });

        it('returns null for null item', () => {
            const result = svc().softDelete('kunde', null);
            expect(result).toBeNull();
        });

        it('moves a Kunde to trash and returns trashed item', () => {
            const kunde = { id: 'k-101', name: 'Müller Metallbau GmbH', firma: 'Müller Metallbau' };
            const result = svc().softDelete('kunde', kunde, { skipOrphanCheck: true });

            expect(result).toBeTruthy();
            expect(result.id).toMatch(/^trash-/);
            expect(result.entityType).toBe('kunde');
            expect(result.originalId).toBe('k-101');
            expect(result.data.name).toBe('Müller Metallbau GmbH');
            expect(result.deletedAt).toBeTruthy();
            expect(result.description).toBe('Kunde "Müller Metallbau GmbH"');
        });

        it('increments trash count after soft delete', () => {
            svc().softDelete('angebot', { id: 'a-1', nummer: 'ANG-2024-001' }, { skipOrphanCheck: true });
            svc().softDelete('rechnung', { id: 'r-1', nummer: 'RE-2024-001' }, { skipOrphanCheck: true });
            expect(svc().getTrashCount()).toBe(2);
        });

        it('persists trashed item to localStorage', () => {
            svc().softDelete('material', { id: 'm-1', name: 'Stahlträger IPE 200' }, { skipOrphanCheck: true });
            const stored = JSON.parse(mockStorage['freyai_trash']);
            expect(stored.length).toBe(1);
            expect(stored[0].entityType).toBe('material');
        });

        it('deep clones the item data to prevent mutation', () => {
            const item = { id: 'k-200', name: 'Original' };
            const result = svc().softDelete('kunde', item, { skipOrphanCheck: true });
            item.name = 'Mutated';
            expect(result.data.name).toBe('Original');
        });
    });

    // ── Undo / Restore ──

    describe('undo', () => {
        it('restores an item from trash and returns true', () => {
            const trashed = svc().softDelete('kunde', { id: 'k-300', name: 'Weber Bau' }, { skipOrphanCheck: true });
            const result = svc().undo(trashed.id);
            expect(result).toBe(true);
            expect(svc().getTrashCount()).toBe(0);
        });

        it('returns false for non-existent trash id', () => {
            const result = svc().undo('trash-nonexistent');
            expect(result).toBe(false);
        });

        it('shows success message via ErrorDisplay', () => {
            const trashed = svc().softDelete('rechnung', { id: 'r-500', nummer: 'RE-2024-005' }, { skipOrphanCheck: true });
            svc().undo(trashed.id);
            expect(window.ErrorDisplay.showSuccess).toHaveBeenCalledWith('Rechnung wiederhergestellt ✅');
        });

        it('restores kunde to customerService if available', () => {
            const customers = [];
            window.customerService = {
                customers,
                save: vi.fn(),
            };
            // First softDelete removes from customerService.customers
            window.customerService.customers = [{ id: 'k-400', name: 'Schmidt Elektro' }];
            const trashed = svc().softDelete('kunde', { id: 'k-400', name: 'Schmidt Elektro' }, { skipOrphanCheck: true });
            // Customer was removed
            expect(window.customerService.customers.length).toBe(0);
            // Now undo restores it
            svc().undo(trashed.id);
            expect(window.customerService.customers.length).toBe(1);
            expect(window.customerService.customers[0].name).toBe('Schmidt Elektro');
        });

        it('restores angebot to storeService if available', () => {
            const storeData = { angebote: [{ id: 'ang-1', nummer: 'ANG-001' }] };
            window.storeService = {
                getData: vi.fn(() => storeData),
                save: vi.fn(),
            };
            const trashed = svc().softDelete('angebot', { id: 'ang-1', nummer: 'ANG-001' }, { skipOrphanCheck: true });
            expect(storeData.angebote.length).toBe(0);
            svc().undo(trashed.id);
            expect(storeData.angebote.length).toBe(1);
        });
    });

    // ── Orphan Protection ──

    describe('checkOrphans', () => {
        it('returns null when storeService is not available', () => {
            window.storeService = null;
            expect(svc().checkOrphans('kunde', 'k-1')).toBeNull();
        });

        it('blocks delete of Kunde with linked Angebote', () => {
            window.storeService = {
                getData: vi.fn(() => ({
                    angebote: [{ kundeId: 'k-1', id: 'ang-1' }],
                    auftraege: [],
                    rechnungen: [],
                })),
            };
            const warning = svc().checkOrphans('kunde', 'k-1');
            expect(warning).toBeTruthy();
            expect(warning).toContain('1 Angebot');
        });

        it('blocks delete of Kunde with linked Aufträge and Rechnungen', () => {
            window.storeService = {
                getData: vi.fn(() => ({
                    angebote: [],
                    auftraege: [{ kundeId: 'k-2', id: 'auf-1' }, { kundeId: 'k-2', id: 'auf-2' }],
                    rechnungen: [{ kundeId: 'k-2', id: 'r-1' }],
                })),
            };
            const warning = svc().checkOrphans('kunde', 'k-2');
            expect(warning).toContain('2 Auftr');
            expect(warning).toContain('1 Rechnung');
        });

        it('allows delete of Kunde with no linked records', () => {
            window.storeService = {
                getData: vi.fn(() => ({
                    angebote: [],
                    auftraege: [],
                    rechnungen: [],
                })),
            };
            expect(svc().checkOrphans('kunde', 'k-orphan-free')).toBeNull();
        });

        it('blocks delete of Angebot converted to Auftrag', () => {
            window.storeService = {
                getData: vi.fn(() => ({
                    auftraege: [{ angebotId: 'ang-10', id: 'auf-10' }],
                })),
            };
            const warning = svc().checkOrphans('angebot', 'ang-10');
            expect(warning).toBeTruthy();
            expect(warning).toContain('Auftrag');
        });

        it('allows delete of Angebot not linked to Auftrag', () => {
            window.storeService = {
                getData: vi.fn(() => ({
                    auftraege: [],
                })),
            };
            expect(svc().checkOrphans('angebot', 'ang-free')).toBeNull();
        });

        it('blocks delete of Auftrag with linked Rechnungen', () => {
            window.storeService = {
                getData: vi.fn(() => ({
                    rechnungen: [{ auftragId: 'auf-20', id: 'r-20' }, { auftragId: 'auf-20', id: 'r-21' }],
                })),
            };
            const warning = svc().checkOrphans('auftrag', 'auf-20');
            expect(warning).toBeTruthy();
            expect(warning).toContain('2 Rechnungen');
        });

        it('blocks delete of bezahlte Rechnung', () => {
            window.storeService = {
                getData: vi.fn(() => ({
                    rechnungen: [{ id: 'r-30', status: 'bezahlt' }],
                })),
            };
            const warning = svc().checkOrphans('rechnung', 'r-30');
            expect(warning).toBeTruthy();
            expect(warning).toContain('bezahlt');
            expect(warning).toContain('Stornieren');
        });

        it('allows delete of unbezahlte Rechnung', () => {
            window.storeService = {
                getData: vi.fn(() => ({
                    rechnungen: [{ id: 'r-31', status: 'offen' }],
                })),
            };
            expect(svc().checkOrphans('rechnung', 'r-31')).toBeNull();
        });

        it('softDelete returns blocked result when orphans exist', () => {
            window.storeService = {
                getData: vi.fn(() => ({
                    angebote: [{ kundeId: 'k-blocked', id: 'ang-b1' }],
                    auftraege: [],
                    rechnungen: [],
                })),
            };
            const result = svc().softDelete('kunde', { id: 'k-blocked', name: 'Blocked GmbH' });
            expect(result.blocked).toBe(true);
            expect(result.reason).toContain('Angebot');
            expect(svc().getTrashCount()).toBe(0);
        });
    });

    // ── Trash Management ──

    describe('getTrash / getTrashByType', () => {
        beforeEach(() => {
            svc().softDelete('kunde', { id: 'k-1', name: 'Firma A' }, { skipOrphanCheck: true });
            svc().softDelete('rechnung', { id: 'r-1', nummer: 'RE-001' }, { skipOrphanCheck: true });
            svc().softDelete('kunde', { id: 'k-2', name: 'Firma B' }, { skipOrphanCheck: true });
        });

        it('returns all trashed items sorted by deletedAt desc', () => {
            const trash = svc().getTrash();
            expect(trash.length).toBe(3);
            // Most recent first
            const dates = trash.map(t => new Date(t.deletedAt).getTime());
            expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
            expect(dates[1]).toBeGreaterThanOrEqual(dates[2]);
        });

        it('filters trash by entity type', () => {
            const kunden = svc().getTrashByType('kunde');
            expect(kunden.length).toBe(2);
            const rechnungen = svc().getTrashByType('rechnung');
            expect(rechnungen.length).toBe(1);
        });

        it('returns empty array for type with no trashed items', () => {
            expect(svc().getTrashByType('material').length).toBe(0);
        });
    });

    describe('restoreFromTrash', () => {
        it('is an alias for undo', () => {
            const trashed = svc().softDelete('anfrage', { id: 'anf-1', nummer: 'ANF-001' }, { skipOrphanCheck: true });
            const result = svc().restoreFromTrash(trashed.id);
            expect(result).toBe(true);
            expect(svc().getTrashCount()).toBe(0);
        });
    });

    describe('permanentDelete', () => {
        it('permanently removes item from trash', () => {
            const trashed = svc().softDelete('material', { id: 'm-1', name: 'Schrauben M10' }, { skipOrphanCheck: true });
            const result = svc().permanentDelete(trashed.id);
            expect(result).toBe(true);
            expect(svc().getTrashCount()).toBe(0);
        });

        it('returns false for non-existent trash id', () => {
            expect(svc().permanentDelete('trash-nonexistent')).toBe(false);
        });

        it('persists removal to localStorage', () => {
            const trashed = svc().softDelete('auftrag', { id: 'auf-1', nummer: 'AUF-001' }, { skipOrphanCheck: true });
            svc().permanentDelete(trashed.id);
            const stored = JSON.parse(mockStorage['freyai_trash']);
            expect(stored.length).toBe(0);
        });
    });

    describe('emptyTrash', () => {
        it('removes all items from trash', () => {
            svc().softDelete('kunde', { id: 'k-1', name: 'A' }, { skipOrphanCheck: true });
            svc().softDelete('kunde', { id: 'k-2', name: 'B' }, { skipOrphanCheck: true });
            svc().softDelete('rechnung', { id: 'r-1', nummer: 'RE-001' }, { skipOrphanCheck: true });
            expect(svc().getTrashCount()).toBe(3);

            svc().emptyTrash();
            expect(svc().getTrashCount()).toBe(0);
        });

        it('persists empty state to localStorage', () => {
            svc().softDelete('kunde', { id: 'k-1', name: 'Test' }, { skipOrphanCheck: true });
            svc().emptyTrash();
            const stored = JSON.parse(mockStorage['freyai_trash']);
            expect(stored.length).toBe(0);
        });
    });

    // ── Auto-Purge ──

    describe('purgeOldItems', () => {
        it('removes items older than PURGE_DAYS', () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 31);

            svc().trash.push({
                id: 'trash-old-1',
                entityType: 'kunde',
                originalId: 'k-old',
                data: { id: 'k-old', name: 'Alte Firma' },
                deletedAt: oldDate.toISOString(),
                deletedBy: 'Unbekannt',
                description: 'Kunde "Alte Firma"',
            });
            svc().saveTrash();

            expect(svc().getTrashCount()).toBe(1);
            svc().purgeOldItems();
            expect(svc().getTrashCount()).toBe(0);
        });

        it('keeps items newer than PURGE_DAYS', () => {
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 10);

            svc().trash.push({
                id: 'trash-recent-1',
                entityType: 'rechnung',
                originalId: 'r-recent',
                data: { id: 'r-recent', nummer: 'RE-2024-100' },
                deletedAt: recentDate.toISOString(),
                deletedBy: 'Unbekannt',
                description: 'Rechnung #RE-2024-100',
            });
            svc().saveTrash();

            svc().purgeOldItems();
            expect(svc().getTrashCount()).toBe(1);
        });

        it('purges only old items, keeps recent ones', () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 45);
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 5);

            svc().trash.push(
                {
                    id: 'trash-old',
                    entityType: 'kunde',
                    originalId: 'k-old',
                    data: { id: 'k-old', name: 'Alt' },
                    deletedAt: oldDate.toISOString(),
                    deletedBy: 'Unbekannt',
                    description: 'Kunde "Alt"',
                },
                {
                    id: 'trash-recent',
                    entityType: 'kunde',
                    originalId: 'k-new',
                    data: { id: 'k-new', name: 'Neu' },
                    deletedAt: recentDate.toISOString(),
                    deletedBy: 'Unbekannt',
                    description: 'Kunde "Neu"',
                },
            );
            svc().saveTrash();

            svc().purgeOldItems();
            expect(svc().getTrashCount()).toBe(1);
            expect(svc().trash[0].id).toBe('trash-recent');
        });
    });

    // ── Source Operations ──

    describe('removeFromSource / restoreToSource', () => {
        it('removes kunde from customerService', () => {
            window.customerService = {
                customers: [{ id: 'k-rm', name: 'Zu entfernen' }],
                save: vi.fn(),
            };
            svc().removeFromSource('kunde', 'k-rm');
            expect(window.customerService.customers.length).toBe(0);
            expect(window.customerService.save).toHaveBeenCalled();
        });

        it('removes angebot from storeService', () => {
            const data = { angebote: [{ id: 'ang-rm' }, { id: 'ang-keep' }] };
            window.storeService = { getData: vi.fn(() => data), save: vi.fn() };
            svc().removeFromSource('angebot', 'ang-rm');
            expect(data.angebote.length).toBe(1);
            expect(data.angebote[0].id).toBe('ang-keep');
        });

        it('removes auftrag from storeService', () => {
            const data = { auftraege: [{ id: 'auf-rm' }] };
            window.storeService = { getData: vi.fn(() => data), save: vi.fn() };
            svc().removeFromSource('auftrag', 'auf-rm');
            expect(data.auftraege.length).toBe(0);
        });

        it('removes rechnung from storeService', () => {
            const data = { rechnungen: [{ id: 'r-rm' }] };
            window.storeService = { getData: vi.fn(() => data), save: vi.fn() };
            svc().removeFromSource('rechnung', 'r-rm');
            expect(data.rechnungen.length).toBe(0);
        });

        it('removes material from materialService', () => {
            window.materialService = {
                materials: [{ id: 'm-rm', name: 'Schrauben' }],
                save: vi.fn(),
            };
            svc().removeFromSource('material', 'm-rm');
            expect(window.materialService.materials.length).toBe(0);
            expect(window.materialService.save).toHaveBeenCalled();
        });

        it('restores material to materialService', () => {
            window.materialService = {
                materials: [],
                save: vi.fn(),
            };
            svc().restoreToSource('material', { id: 'm-restored', name: 'Wiederhergestellt' });
            expect(window.materialService.materials.length).toBe(1);
            expect(window.materialService.materials[0].name).toBe('Wiederhergestellt');
        });

        it('does not crash when services are unavailable', () => {
            window.customerService = null;
            window.storeService = null;
            window.materialService = null;
            expect(() => svc().removeFromSource('kunde', 'k-1')).not.toThrow();
            expect(() => svc().removeFromSource('angebot', 'a-1')).not.toThrow();
            expect(() => svc().removeFromSource('material', 'm-1')).not.toThrow();
            expect(() => svc().restoreToSource('kunde', { id: 'k-1' })).not.toThrow();
        });
    });

    // ── Helpers ──

    describe('getItemDescription', () => {
        it('returns Kunde description with name', () => {
            expect(svc().getItemDescription('kunde', { name: 'Bäckerei Hoffmann' }))
                .toBe('Kunde "Bäckerei Hoffmann"');
        });

        it('returns Kunde description with firma fallback', () => {
            expect(svc().getItemDescription('kunde', { firma: 'Hoffmann GmbH' }))
                .toBe('Kunde "Hoffmann GmbH"');
        });

        it('returns Kunde description with Unbekannt fallback', () => {
            expect(svc().getItemDescription('kunde', {}))
                .toBe('Kunde "Unbekannt"');
        });

        it('returns Anfrage description with nummer', () => {
            expect(svc().getItemDescription('anfrage', { nummer: 'ANF-2024-001' }))
                .toBe('Anfrage #ANF-2024-001');
        });

        it('returns Angebot description with nummer', () => {
            expect(svc().getItemDescription('angebot', { nummer: 'ANG-2024-042' }))
                .toBe('Angebot #ANG-2024-042');
        });

        it('returns Auftrag description with nummer', () => {
            expect(svc().getItemDescription('auftrag', { nummer: 'AUF-2024-007' }))
                .toBe('Auftrag #AUF-2024-007');
        });

        it('returns Rechnung description with nummer', () => {
            expect(svc().getItemDescription('rechnung', { nummer: 'RE-2024-100' }))
                .toBe('Rechnung #RE-2024-100');
        });

        it('returns Material description with name', () => {
            expect(svc().getItemDescription('material', { name: 'Edelstahl V2A' }))
                .toBe('Material "Edelstahl V2A"');
        });

        it('returns Material description with bezeichnung fallback', () => {
            expect(svc().getItemDescription('material', { bezeichnung: 'Kupferrohr DN15' }))
                .toBe('Material "Kupferrohr DN15"');
        });

        it('returns generic description for unknown entity type', () => {
            expect(svc().getItemDescription('unknown', { name: 'Foo' }))
                .toBe('Eintrag "Foo"');
        });

        it('uses id slice fallback for entities without nummer', () => {
            const desc = svc().getItemDescription('angebot', { id: 'abcdef123456' });
            expect(desc).toBe('Angebot #123456');
        });
    });

    describe('getEntityLabel', () => {
        it('returns correct German labels', () => {
            expect(svc().getEntityLabel('kunde')).toBe('Kunde');
            expect(svc().getEntityLabel('anfrage')).toBe('Anfrage');
            expect(svc().getEntityLabel('angebot')).toBe('Angebot');
            expect(svc().getEntityLabel('auftrag')).toBe('Auftrag');
            expect(svc().getEntityLabel('rechnung')).toBe('Rechnung');
            expect(svc().getEntityLabel('material')).toBe('Material');
        });

        it('returns Eintrag for unknown type', () => {
            expect(svc().getEntityLabel('unbekannt')).toBe('Eintrag');
        });
    });

    describe('getPluralKey', () => {
        it('returns correct plural keys for entity types', () => {
            expect(svc().getPluralKey('anfrage')).toBe('anfragen');
            expect(svc().getPluralKey('angebot')).toBe('angebote');
            expect(svc().getPluralKey('auftrag')).toBe('auftraege');
            expect(svc().getPluralKey('rechnung')).toBe('rechnungen');
        });

        it('returns entityType as-is for unmapped types', () => {
            expect(svc().getPluralKey('material')).toBe('material');
            expect(svc().getPluralKey('kunde')).toBe('kunde');
        });
    });

    describe('getCurrentUser', () => {
        it('returns name from company profile', () => {
            mockStorage['freyai_company_profile'] = JSON.stringify({ name: 'Hans Zimmermann' });
            expect(svc().getCurrentUser()).toBe('Hans Zimmermann');
        });

        it('returns Unbekannt when no profile exists', () => {
            expect(svc().getCurrentUser()).toBe('Unbekannt');
        });

        it('returns Unbekannt when profile has no name', () => {
            mockStorage['freyai_company_profile'] = JSON.stringify({ email: 'test@example.de' });
            expect(svc().getCurrentUser()).toBe('Unbekannt');
        });
    });

    // ── Full Integration Flow ──

    describe('Full delete-undo cycle', () => {
        it('soft deletes a Kunde, then undoes it, restoring to customerService', () => {
            window.customerService = {
                customers: [{ id: 'k-flow', name: 'Handwerker Schulz' }],
                save: vi.fn(),
            };

            const trashed = svc().softDelete('kunde', { id: 'k-flow', name: 'Handwerker Schulz' }, { skipOrphanCheck: true });
            expect(svc().getTrashCount()).toBe(1);
            expect(window.customerService.customers.length).toBe(0);

            svc().undo(trashed.id);
            expect(svc().getTrashCount()).toBe(0);
            expect(window.customerService.customers.length).toBe(1);
            expect(window.customerService.customers[0].name).toBe('Handwerker Schulz');
        });

        it('soft deletes a Rechnung, permanently deletes it, no restore possible', () => {
            const data = { rechnungen: [{ id: 'r-flow', nummer: 'RE-2024-999' }] };
            window.storeService = { getData: vi.fn(() => data), save: vi.fn() };

            const trashed = svc().softDelete('rechnung', { id: 'r-flow', nummer: 'RE-2024-999' }, { skipOrphanCheck: true });
            expect(data.rechnungen.length).toBe(0);

            svc().permanentDelete(trashed.id);
            expect(svc().getTrashCount()).toBe(0);

            // Undo is no longer possible
            expect(svc().undo(trashed.id)).toBe(false);
        });
    });
});
