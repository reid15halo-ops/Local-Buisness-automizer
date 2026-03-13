import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────
const StorageUtils = {
    getJSON: vi.fn((key, defaultVal) => defaultVal),
    setJSON: vi.fn(() => true),
    safeDate: vi.fn(str => str ? new Date(str) : null)
};
global.StorageUtils = StorageUtils;

const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn(k => store[k] || null),
        setItem: vi.fn((k, v) => { store[k] = v; }),
        removeItem: vi.fn(k => { delete store[k]; }),
        clear: vi.fn(() => { store = {}; })
    };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

// ── Inline Class ───────────────────────────────────────────────────
class LeadService {
    constructor() {
        this.leads = StorageUtils.getJSON('freyai_leads', [], { service: 'leadService' });
        this.pipelineStages = [
            { id: 'neu', name: 'Neu', color: '#3b82f6' },
            { id: 'kontaktiert', name: 'Kontaktiert', color: '#8b5cf6' },
            { id: 'qualifiziert', name: 'Qualifiziert', color: '#f59e0b' },
            { id: 'angebot', name: 'Angebot erstellt', color: '#c8956c' },
            { id: 'verhandlung', name: 'Verhandlung', color: '#ec4899' },
            { id: 'gewonnen', name: 'Gewonnen', color: '#22c55e' },
            { id: 'verloren', name: 'Verloren', color: '#ef4444' }
        ];
        this.scoringRules = this.initScoringRules();
    }

    initScoringRules() {
        return {
            hasEmail: 10, hasPhone: 10, hasCompany: 15,
            budgetOver5000: 20, budgetOver10000: 30,
            urgentTimeline: 15, returningCustomer: 25, referral: 20,
            websiteVisit: 5, emailOpened: 10, responded: 15
        };
    }

    addLead(lead) {
        const newLead = {
            id: 'lead-' + Date.now(),
            name: lead.name, email: lead.email || '', telefon: lead.telefon || '',
            firma: lead.firma || '', quelle: lead.quelle || 'direkt',
            stage: lead.stage || 'neu', score: 0, budget: lead.budget || null,
            anforderung: lead.anforderung || '', notizen: lead.notizen || '',
            timeline: lead.timeline || '', zustaendiger: lead.zustaendiger || null,
            aktivitaeten: [], createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(), convertedAt: null, lostReason: null
        };
        newLead.score = this.calculateScore(newLead);
        newLead.aktivitaeten.push({
            id: 'act-' + Date.now(), typ: 'erstellt',
            beschreibung: 'Lead erstellt', datum: new Date().toISOString()
        });
        this.leads.push(newLead);
        this.save();
        return newLead;
    }

    updateLead(id, updates) {
        const lead = this.leads.find(l => l.id === id);
        if (!lead) { return null; }
        if (updates.stage && updates.stage !== lead.stage) {
            lead.aktivitaeten.push({
                id: 'act-' + Date.now(), typ: 'stage_change',
                beschreibung: `Status geändert: ${this.getStageName(lead.stage)} → ${this.getStageName(updates.stage)}`,
                datum: new Date().toISOString()
            });
            if (updates.stage === 'gewonnen') { lead.convertedAt = new Date().toISOString(); }
            else if (updates.stage === 'verloren') { lead.lostReason = updates.lostReason || 'Nicht angegeben'; }
        }
        Object.assign(lead, updates);
        lead.score = this.calculateScore(lead);
        lead.updatedAt = new Date().toISOString();
        this.save();
        return lead;
    }

    calculateScore(lead) {
        let score = 0;
        if (lead.email) { score += this.scoringRules.hasEmail; }
        if (lead.telefon) { score += this.scoringRules.hasPhone; }
        if (lead.firma) { score += this.scoringRules.hasCompany; }
        if (lead.budget) {
            if (lead.budget >= 10000) { score += this.scoringRules.budgetOver10000; }
            else if (lead.budget >= 5000) { score += this.scoringRules.budgetOver5000; }
        }
        if (lead.timeline === 'dringend') { score += this.scoringRules.urgentTimeline; }
        if (lead.quelle === 'empfehlung') { score += this.scoringRules.referral; }
        if (lead.quelle === 'bestandskunde') { score += this.scoringRules.returningCustomer; }
        const hasResponse = lead.aktivitaeten.some(a => a.typ === 'antwort_erhalten');
        if (hasResponse) { score += this.scoringRules.responded; }
        return Math.min(score, 100);
    }

    getLead(id) { return this.leads.find(l => l.id === id); }
    getAllLeads() { return this.leads.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)); }
    getLeadsByStage(stage) { return this.leads.filter(l => l.stage === stage); }

    getPipelineData() {
        const pipeline = {};
        this.pipelineStages.forEach(stage => {
            pipeline[stage.id] = { ...stage, leads: this.leads.filter(l => l.stage === stage.id).sort((a, b) => b.score - a.score) };
        });
        return pipeline;
    }

    getHotLeads(limit = 5) {
        return this.leads.filter(l => !['gewonnen', 'verloren'].includes(l.stage))
            .filter(l => l.score >= 50).sort((a, b) => b.score - a.score).slice(0, limit);
    }

    getColdLeads(daysSinceActivity = 7) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysSinceActivity);
        return this.leads.filter(l => !['gewonnen', 'verloren'].includes(l.stage))
            .filter(l => new Date(l.updatedAt) < cutoff)
            .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
    }

    addActivity(leadId, activity) {
        const lead = this.getLead(leadId);
        if (!lead) { return null; }
        const newActivity = {
            id: 'act-' + Date.now(), typ: activity.typ,
            beschreibung: activity.beschreibung,
            ergebnis: activity.ergebnis || null,
            naechsteAktion: activity.naechsteAktion || null,
            datum: new Date().toISOString()
        };
        lead.aktivitaeten.push(newActivity);
        lead.updatedAt = new Date().toISOString();
        lead.score = this.calculateScore(lead);
        this.save();
        return newActivity;
    }

    convertToAnfrage(leadId) {
        const lead = this.getLead(leadId);
        if (!lead) { return null; }
        const anfrage = {
            id: 'ANF-' + Date.now(),
            kunde: { name: lead.name, firma: lead.firma, email: lead.email, telefon: lead.telefon },
            beschreibung: lead.anforderung, datum: new Date().toISOString(),
            status: 'neu', quelle: 'lead_conversion', leadId: lead.id
        };
        this.updateLead(leadId, { stage: 'gewonnen' });
        return anfrage;
    }

    getStatistics() {
        const total = this.leads.length;
        const active = this.leads.filter(l => !['gewonnen', 'verloren'].includes(l.stage)).length;
        const won = this.leads.filter(l => l.stage === 'gewonnen').length;
        const lost = this.leads.filter(l => l.stage === 'verloren').length;
        const conversionRate = total > 0 ? ((won / total) * 100).toFixed(1) : 0;
        const pipelineValue = this.leads.filter(l => !['gewonnen', 'verloren'].includes(l.stage))
            .reduce((sum, l) => sum + (l.budget || 0), 0);
        const avgScore = active > 0
            ? (this.leads.filter(l => !['gewonnen', 'verloren'].includes(l.stage))
                .reduce((sum, l) => sum + l.score, 0) / active).toFixed(0) : 0;
        const bySource = {};
        this.leads.forEach(l => { bySource[l.quelle] = (bySource[l.quelle] || 0) + 1; });
        return { total, active, won, lost, conversionRate: parseFloat(conversionRate), pipelineValue,
            avgScore: parseInt(avgScore), bySource, hotLeads: this.getHotLeads().length, coldLeads: this.getColdLeads().length };
    }

    searchLeads(query) {
        const q = query.toLowerCase();
        return this.leads.filter(l => l.name.toLowerCase().includes(q) ||
            (l.firma && l.firma.toLowerCase().includes(q)) ||
            (l.email && l.email.toLowerCase().includes(q)) ||
            (l.anforderung && l.anforderung.toLowerCase().includes(q)));
    }

    getStageName(stageId) {
        const stage = this.pipelineStages.find(s => s.id === stageId);
        return stage ? stage.name : stageId;
    }

    getScoreLabel(score) {
        if (score >= 80) { return { label: 'Heiß', color: '#ef4444', icon: '🔥' }; }
        if (score >= 60) { return { label: 'Warm', color: '#f59e0b', icon: '☀️' }; }
        if (score >= 40) { return { label: 'Lauwarm', color: '#eab308', icon: '🌤️' }; }
        return { label: 'Kalt', color: '#3b82f6', icon: '❄️' };
    }

    deleteLead(id) { this.leads = this.leads.filter(l => l.id !== id); this.save(); }

    importFromCSV(csvContent) {
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length < 2) { continue; }
            const lead = {};
            headers.forEach((header, index) => {
                if (values[index]) {
                    const value = values[index].trim().replace(/^"|"$/g, '');
                    if (header.includes('name')) { lead.name = value; }
                    else if (header.includes('email')) { lead.email = value; }
                    else if (header.includes('telefon') || header.includes('phone')) { lead.telefon = value; }
                    else if (header.includes('firma') || header.includes('company')) { lead.firma = value; }
                    else if (header.includes('budget')) { lead.budget = parseFloat(value) || null; }
                    else if (header.includes('quelle') || header.includes('source')) { lead.quelle = value; }
                }
            });
            if (lead.name) { this.addLead(lead); imported++; }
        }
        return { success: imported, total: lines.length - 1 };
    }

    save() { localStorage.setItem('freyai_leads', JSON.stringify(this.leads)); }
}

// ── Tests ──────────────────────────────────────────────────────────
describe('LeadService', () => {
    let svc;

    beforeEach(() => {
        vi.restoreAllMocks();
        StorageUtils.getJSON.mockImplementation((key, defaultVal) => defaultVal);
        localStorageMock.clear();
        svc = new LeadService();
    });

    // ─── Constructor ───────────────────────────────────────────────
    describe('constructor', () => {
        it('should start with empty leads', () => {
            expect(svc.leads).toEqual([]);
        });

        it('should have 7 pipeline stages', () => {
            expect(svc.pipelineStages).toHaveLength(7);
            expect(svc.pipelineStages[0].id).toBe('neu');
            expect(svc.pipelineStages[5].id).toBe('gewonnen');
            expect(svc.pipelineStages[6].id).toBe('verloren');
        });

        it('should initialize scoring rules', () => {
            expect(svc.scoringRules.hasEmail).toBe(10);
            expect(svc.scoringRules.budgetOver10000).toBe(30);
            expect(svc.scoringRules.returningCustomer).toBe(25);
        });
    });

    // ─── addLead ───────────────────────────────────────────────────
    describe('addLead', () => {
        it('should create a lead with defaults', () => {
            const lead = svc.addLead({ name: 'Max Müller' });
            expect(lead.name).toBe('Max Müller');
            expect(lead.stage).toBe('neu');
            expect(lead.email).toBe('');
            expect(lead.quelle).toBe('direkt');
            expect(lead.aktivitaeten).toHaveLength(1);
            expect(lead.aktivitaeten[0].typ).toBe('erstellt');
        });

        it('should calculate score on creation', () => {
            const lead = svc.addLead({ name: 'Test', email: 'a@b.de', telefon: '123', firma: 'GmbH' });
            expect(lead.score).toBe(35); // 10+10+15
        });

        it('should persist to localStorage', () => {
            svc.addLead({ name: 'Test' });
            expect(localStorageMock.setItem).toHaveBeenCalledWith('freyai_leads', expect.any(String));
        });

        it('should add to leads array', () => {
            svc.addLead({ name: 'A' });
            svc.addLead({ name: 'B' });
            expect(svc.leads).toHaveLength(2);
        });
    });

    // ─── calculateScore ────────────────────────────────────────────
    describe('calculateScore', () => {
        it('should score 0 for minimal lead', () => {
            expect(svc.calculateScore({ name: 'X', email: '', telefon: '', firma: '', budget: null, timeline: '', quelle: 'direkt', aktivitaeten: [] })).toBe(0);
        });

        it('should add budget scoring (>=5000)', () => {
            const score = svc.calculateScore({ name: 'X', email: '', telefon: '', firma: '', budget: 5000, timeline: '', quelle: 'direkt', aktivitaeten: [] });
            expect(score).toBe(20);
        });

        it('should add higher budget scoring (>=10000)', () => {
            const score = svc.calculateScore({ name: 'X', email: '', telefon: '', firma: '', budget: 15000, timeline: '', quelle: 'direkt', aktivitaeten: [] });
            expect(score).toBe(30);
        });

        it('should add referral bonus', () => {
            const score = svc.calculateScore({ name: 'X', email: '', telefon: '', firma: '', budget: null, timeline: '', quelle: 'empfehlung', aktivitaeten: [] });
            expect(score).toBe(20);
        });

        it('should add returning customer bonus', () => {
            const score = svc.calculateScore({ name: 'X', email: '', telefon: '', firma: '', budget: null, timeline: '', quelle: 'bestandskunde', aktivitaeten: [] });
            expect(score).toBe(25);
        });

        it('should add responded bonus', () => {
            const score = svc.calculateScore({ name: 'X', email: '', telefon: '', firma: '', budget: null, timeline: '', quelle: 'direkt', aktivitaeten: [{ typ: 'antwort_erhalten' }] });
            expect(score).toBe(15);
        });

        it('should cap at 100', () => {
            const score = svc.calculateScore({
                name: 'X', email: 'a@b.de', telefon: '123', firma: 'GmbH',
                budget: 20000, timeline: 'dringend', quelle: 'bestandskunde',
                aktivitaeten: [{ typ: 'antwort_erhalten' }]
            });
            expect(score).toBe(100); // 10+10+15+30+15+25+15 = 120 → capped
        });
    });

    // ─── updateLead ────────────────────────────────────────────────
    describe('updateLead', () => {
        it('should update fields', () => {
            const lead = svc.addLead({ name: 'Test' });
            const updated = svc.updateLead(lead.id, { firma: 'NewCo' });
            expect(updated.firma).toBe('NewCo');
        });

        it('should return null for unknown ID', () => {
            expect(svc.updateLead('nope', {})).toBeNull();
        });

        it('should track stage changes in aktivitaeten', () => {
            const lead = svc.addLead({ name: 'Test' });
            svc.updateLead(lead.id, { stage: 'kontaktiert' });
            const stageActivity = lead.aktivitaeten.find(a => a.typ === 'stage_change');
            expect(stageActivity).toBeDefined();
            expect(stageActivity.beschreibung).toContain('Neu');
            expect(stageActivity.beschreibung).toContain('Kontaktiert');
        });

        it('should set convertedAt when won', () => {
            const lead = svc.addLead({ name: 'Test' });
            svc.updateLead(lead.id, { stage: 'gewonnen' });
            expect(lead.convertedAt).toBeTruthy();
        });

        it('should set lostReason when lost', () => {
            const lead = svc.addLead({ name: 'Test' });
            svc.updateLead(lead.id, { stage: 'verloren', lostReason: 'Zu teuer' });
            expect(lead.lostReason).toBe('Zu teuer');
        });

        it('should default lostReason', () => {
            const lead = svc.addLead({ name: 'Test' });
            svc.updateLead(lead.id, { stage: 'verloren' });
            expect(lead.lostReason).toBe('Nicht angegeben');
        });
    });

    // ─── Queries ───────────────────────────────────────────────────
    describe('queries', () => {
        it('should get lead by ID', () => {
            const lead = svc.addLead({ name: 'Find me' });
            expect(svc.getLead(lead.id).name).toBe('Find me');
        });

        it('should filter by stage', () => {
            svc.addLead({ name: 'A', stage: 'neu' });
            svc.addLead({ name: 'B', stage: 'kontaktiert' });
            expect(svc.getLeadsByStage('neu')).toHaveLength(1);
        });

        it('should return all leads sorted by updatedAt', () => {
            svc.addLead({ name: 'A' });
            svc.addLead({ name: 'B' });
            const all = svc.getAllLeads();
            expect(all).toHaveLength(2);
        });
    });

    // ─── getHotLeads / getColdLeads ────────────────────────────────
    describe('hot and cold leads', () => {
        it('should return leads with score >= 50 as hot', () => {
            svc.addLead({ name: 'Hot', email: 'a@b.de', telefon: '1', firma: 'X', budget: 10000 });
            svc.addLead({ name: 'Cold' });
            const hot = svc.getHotLeads();
            expect(hot).toHaveLength(1);
            expect(hot[0].name).toBe('Hot');
        });

        it('should exclude won/lost from hot leads', () => {
            const lead = svc.addLead({ name: 'Hot', email: 'a@b.de', telefon: '1', firma: 'X', budget: 10000 });
            svc.updateLead(lead.id, { stage: 'gewonnen' });
            expect(svc.getHotLeads()).toHaveLength(0);
        });

        it('should respect limit', () => {
            for (let i = 0; i < 10; i++) {
                svc.addLead({ name: `Lead${i}`, email: 'a@b.de', telefon: '1', firma: 'X', budget: 10000 });
            }
            expect(svc.getHotLeads(3)).toHaveLength(3);
        });
    });

    // ─── addActivity ───────────────────────────────────────────────
    describe('addActivity', () => {
        it('should add activity to lead', () => {
            const lead = svc.addLead({ name: 'Test' });
            const act = svc.addActivity(lead.id, { typ: 'anruf', beschreibung: 'Angerufen' });
            expect(act.typ).toBe('anruf');
            expect(lead.aktivitaeten).toHaveLength(2); // erstellt + anruf
        });

        it('should return null for unknown lead', () => {
            expect(svc.addActivity('nope', { typ: 'x', beschreibung: 'y' })).toBeNull();
        });

        it('should recalculate score after activity', () => {
            const lead = svc.addLead({ name: 'Test' });
            svc.addActivity(lead.id, { typ: 'antwort_erhalten', beschreibung: 'Reply' });
            expect(lead.score).toBe(15); // responded bonus
        });
    });

    // ─── convertToAnfrage ──────────────────────────────────────────
    describe('convertToAnfrage', () => {
        it('should create Anfrage from lead', () => {
            const lead = svc.addLead({ name: 'Convert', email: 'c@d.de', firma: 'Firma', anforderung: 'Dach' });
            const anfrage = svc.convertToAnfrage(lead.id);
            expect(anfrage.kunde.name).toBe('Convert');
            expect(anfrage.kunde.email).toBe('c@d.de');
            expect(anfrage.beschreibung).toBe('Dach');
            expect(anfrage.quelle).toBe('lead_conversion');
        });

        it('should mark lead as gewonnen', () => {
            const lead = svc.addLead({ name: 'Convert' });
            svc.convertToAnfrage(lead.id);
            expect(lead.stage).toBe('gewonnen');
        });

        it('should return null for unknown lead', () => {
            expect(svc.convertToAnfrage('nope')).toBeNull();
        });
    });

    // ─── getPipelineData ───────────────────────────────────────────
    describe('getPipelineData', () => {
        it('should return all stages with leads', () => {
            svc.addLead({ name: 'A', stage: 'neu' });
            svc.addLead({ name: 'B', stage: 'angebot' });
            const pipeline = svc.getPipelineData();
            expect(Object.keys(pipeline)).toHaveLength(7);
            expect(pipeline.neu.leads).toHaveLength(1);
            expect(pipeline.angebot.leads).toHaveLength(1);
            expect(pipeline.verloren.leads).toHaveLength(0);
        });
    });

    // ─── getStatistics ─────────────────────────────────────────────
    describe('getStatistics', () => {
        it('should return zeros when empty', () => {
            const stats = svc.getStatistics();
            expect(stats.total).toBe(0);
            expect(stats.conversionRate).toBe(0);
        });

        it('should calculate conversion rate', () => {
            svc.addLead({ name: 'A' });
            const b = svc.addLead({ name: 'B' });
            svc.updateLead(b.id, { stage: 'gewonnen' });
            const stats = svc.getStatistics();
            expect(stats.total).toBe(2);
            expect(stats.won).toBe(1);
            expect(stats.conversionRate).toBe(50.0);
        });

        it('should calculate pipeline value', () => {
            svc.addLead({ name: 'A', budget: 5000 });
            svc.addLead({ name: 'B', budget: 3000 });
            expect(svc.getStatistics().pipelineValue).toBe(8000);
        });
    });

    // ─── searchLeads ───────────────────────────────────────────────
    describe('searchLeads', () => {
        it('should search by name', () => {
            svc.addLead({ name: 'Max Müller' });
            svc.addLead({ name: 'Anna Schmidt' });
            expect(svc.searchLeads('max')).toHaveLength(1);
        });

        it('should search by firma', () => {
            svc.addLead({ name: 'Test', firma: 'Dach GmbH' });
            expect(svc.searchLeads('dach')).toHaveLength(1);
        });

        it('should be case insensitive', () => {
            svc.addLead({ name: 'Test', email: 'MAX@test.de' });
            expect(svc.searchLeads('max')).toHaveLength(1);
        });
    });

    // ─── getStageName / getScoreLabel ──────────────────────────────
    describe('helpers', () => {
        it('should return stage name', () => {
            expect(svc.getStageName('neu')).toBe('Neu');
            expect(svc.getStageName('gewonnen')).toBe('Gewonnen');
        });

        it('should return stageId for unknown stage', () => {
            expect(svc.getStageName('unknown')).toBe('unknown');
        });

        it('should return score labels', () => {
            expect(svc.getScoreLabel(85).label).toBe('Heiß');
            expect(svc.getScoreLabel(65).label).toBe('Warm');
            expect(svc.getScoreLabel(45).label).toBe('Lauwarm');
            expect(svc.getScoreLabel(20).label).toBe('Kalt');
        });
    });

    // ─── deleteLead ────────────────────────────────────────────────
    describe('deleteLead', () => {
        it('should remove lead', () => {
            const lead = svc.addLead({ name: 'Delete me' });
            svc.deleteLead(lead.id);
            expect(svc.leads).toHaveLength(0);
        });
    });

    // ─── importFromCSV ─────────────────────────────────────────────
    describe('importFromCSV', () => {
        it('should import valid CSV', () => {
            const csv = 'Name,Email,Telefon,Firma\nMax,max@test.de,123,GmbH\nAnna,anna@b.de,456,AG';
            const result = svc.importFromCSV(csv);
            expect(result.success).toBe(2);
            expect(result.total).toBe(2);
            expect(svc.leads).toHaveLength(2);
        });

        it('should skip rows without name', () => {
            const csv = 'Email,Firma\ntest@a.de,Co';
            const result = svc.importFromCSV(csv);
            expect(result.success).toBe(0);
        });

        it('should skip short rows', () => {
            const csv = 'Name,Email\nMax,max@test.de\nshort';
            const result = svc.importFromCSV(csv);
            expect(result.success).toBe(1);
        });

        it('should parse budget as number', () => {
            const csv = 'Name,Budget\nMax,5000';
            svc.importFromCSV(csv);
            expect(svc.leads[0].budget).toBe(5000);
        });

        it('should handle phone header', () => {
            const csv = 'Name,Phone\nMax,0171-123';
            svc.importFromCSV(csv);
            expect(svc.leads[0].telefon).toBe('0171-123');
        });
    });
});
