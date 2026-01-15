/* ============================================
   Lead Management Service - Sales Pipeline
   ============================================ */

class LeadService {
    constructor() {
        this.leads = JSON.parse(localStorage.getItem('mhs_leads') || '[]');
        this.pipelineStages = [
            { id: 'neu', name: 'Neu', color: '#3b82f6' },
            { id: 'kontaktiert', name: 'Kontaktiert', color: '#8b5cf6' },
            { id: 'qualifiziert', name: 'Qualifiziert', color: '#f59e0b' },
            { id: 'angebot', name: 'Angebot erstellt', color: '#6366f1' },
            { id: 'verhandlung', name: 'Verhandlung', color: '#ec4899' },
            { id: 'gewonnen', name: 'Gewonnen', color: '#22c55e' },
            { id: 'verloren', name: 'Verloren', color: '#ef4444' }
        ];
        this.scoringRules = this.initScoringRules();
    }

    initScoringRules() {
        return {
            hasEmail: 10,
            hasPhone: 10,
            hasCompany: 15,
            budgetOver5000: 20,
            budgetOver10000: 30,
            urgentTimeline: 15,
            returningCustomer: 25,
            referral: 20,
            websiteVisit: 5,
            emailOpened: 10,
            responded: 15
        };
    }

    // Add new lead
    addLead(lead) {
        const newLead = {
            id: 'lead-' + Date.now(),
            name: lead.name,
            email: lead.email || '',
            telefon: lead.telefon || '',
            firma: lead.firma || '',
            quelle: lead.quelle || 'direkt', // direkt, website, empfehlung, messe, etc.
            stage: lead.stage || 'neu',
            score: 0,
            budget: lead.budget || null,
            anforderung: lead.anforderung || '',
            notizen: lead.notizen || '',
            timeline: lead.timeline || '',
            zustaendiger: lead.zustaendiger || null,
            aktivitaeten: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            convertedAt: null,
            lostReason: null
        };

        // Calculate initial score
        newLead.score = this.calculateScore(newLead);

        // Add creation activity
        newLead.aktivitaeten.push({
            id: 'act-' + Date.now(),
            typ: 'erstellt',
            beschreibung: 'Lead erstellt',
            datum: new Date().toISOString()
        });

        this.leads.push(newLead);
        this.save();
        return newLead;
    }

    // Update lead
    updateLead(id, updates) {
        const lead = this.leads.find(l => l.id === id);
        if (!lead) return null;

        // Track stage changes
        if (updates.stage && updates.stage !== lead.stage) {
            lead.aktivitaeten.push({
                id: 'act-' + Date.now(),
                typ: 'stage_change',
                beschreibung: `Status geändert: ${this.getStageName(lead.stage)} → ${this.getStageName(updates.stage)}`,
                datum: new Date().toISOString()
            });

            // Check for won/lost
            if (updates.stage === 'gewonnen') {
                lead.convertedAt = new Date().toISOString();
            } else if (updates.stage === 'verloren') {
                lead.lostReason = updates.lostReason || 'Nicht angegeben';
            }
        }

        Object.assign(lead, updates);
        lead.score = this.calculateScore(lead);
        lead.updatedAt = new Date().toISOString();

        this.save();
        return lead;
    }

    // Calculate lead score
    calculateScore(lead) {
        let score = 0;

        if (lead.email) score += this.scoringRules.hasEmail;
        if (lead.telefon) score += this.scoringRules.hasPhone;
        if (lead.firma) score += this.scoringRules.hasCompany;

        if (lead.budget) {
            if (lead.budget >= 10000) {
                score += this.scoringRules.budgetOver10000;
            } else if (lead.budget >= 5000) {
                score += this.scoringRules.budgetOver5000;
            }
        }

        if (lead.timeline === 'dringend') score += this.scoringRules.urgentTimeline;
        if (lead.quelle === 'empfehlung') score += this.scoringRules.referral;
        if (lead.quelle === 'bestandskunde') score += this.scoringRules.returningCustomer;

        // Activity-based scoring
        const hasResponse = lead.aktivitaeten.some(a => a.typ === 'antwort_erhalten');
        if (hasResponse) score += this.scoringRules.responded;

        return Math.min(score, 100);
    }

    // Get lead by ID
    getLead(id) {
        return this.leads.find(l => l.id === id);
    }

    // Get all leads
    getAllLeads() {
        return this.leads.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    // Get leads by stage
    getLeadsByStage(stage) {
        return this.leads.filter(l => l.stage === stage);
    }

    // Get pipeline data for Kanban view
    getPipelineData() {
        const pipeline = {};
        this.pipelineStages.forEach(stage => {
            pipeline[stage.id] = {
                ...stage,
                leads: this.leads
                    .filter(l => l.stage === stage.id)
                    .sort((a, b) => b.score - a.score)
            };
        });
        return pipeline;
    }

    // Get hot leads (high score, active)
    getHotLeads(limit = 5) {
        return this.leads
            .filter(l => !['gewonnen', 'verloren'].includes(l.stage))
            .filter(l => l.score >= 50)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    // Get cold leads (need follow-up)
    getColdLeads(daysSinceActivity = 7) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysSinceActivity);

        return this.leads
            .filter(l => !['gewonnen', 'verloren'].includes(l.stage))
            .filter(l => new Date(l.updatedAt) < cutoff)
            .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
    }

    // Add activity to lead
    addActivity(leadId, activity) {
        const lead = this.getLead(leadId);
        if (!lead) return null;

        const newActivity = {
            id: 'act-' + Date.now(),
            typ: activity.typ, // anruf, email, meeting, notiz, angebot, etc.
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

    // Convert lead to Anfrage
    convertToAnfrage(leadId) {
        const lead = this.getLead(leadId);
        if (!lead) return null;

        // Create Anfrage object (integrate with existing system)
        const anfrage = {
            id: 'ANF-' + Date.now(),
            kunde: {
                name: lead.name,
                firma: lead.firma,
                email: lead.email,
                telefon: lead.telefon
            },
            beschreibung: lead.anforderung,
            datum: new Date().toISOString(),
            status: 'neu',
            quelle: 'lead_conversion',
            leadId: lead.id
        };

        // Update lead stage
        this.updateLead(leadId, { stage: 'gewonnen' });

        // Add to store if available
        if (typeof store !== 'undefined' && store.anfragen) {
            store.anfragen.push(anfrage);
            if (typeof saveStore === 'function') saveStore();
        }

        return anfrage;
    }

    // Get statistics
    getStatistics() {
        const total = this.leads.length;
        const active = this.leads.filter(l => !['gewonnen', 'verloren'].includes(l.stage)).length;
        const won = this.leads.filter(l => l.stage === 'gewonnen').length;
        const lost = this.leads.filter(l => l.stage === 'verloren').length;

        const conversionRate = total > 0 ? ((won / total) * 100).toFixed(1) : 0;

        // Pipeline value
        const pipelineValue = this.leads
            .filter(l => !['gewonnen', 'verloren'].includes(l.stage))
            .reduce((sum, l) => sum + (l.budget || 0), 0);

        // Average score
        const avgScore = active > 0
            ? (this.leads.filter(l => !['gewonnen', 'verloren'].includes(l.stage))
                .reduce((sum, l) => sum + l.score, 0) / active).toFixed(0)
            : 0;

        // By source
        const bySource = {};
        this.leads.forEach(l => {
            bySource[l.quelle] = (bySource[l.quelle] || 0) + 1;
        });

        return {
            total,
            active,
            won,
            lost,
            conversionRate: parseFloat(conversionRate),
            pipelineValue,
            avgScore: parseInt(avgScore),
            bySource,
            hotLeads: this.getHotLeads().length,
            coldLeads: this.getColdLeads().length
        };
    }

    // Search leads
    searchLeads(query) {
        const q = query.toLowerCase();
        return this.leads.filter(l =>
            l.name.toLowerCase().includes(q) ||
            (l.firma && l.firma.toLowerCase().includes(q)) ||
            (l.email && l.email.toLowerCase().includes(q)) ||
            (l.anforderung && l.anforderung.toLowerCase().includes(q))
        );
    }

    // Get stage name
    getStageName(stageId) {
        const stage = this.pipelineStages.find(s => s.id === stageId);
        return stage ? stage.name : stageId;
    }

    // Get score label
    getScoreLabel(score) {
        if (score >= 80) return { label: 'Heiß', color: '#ef4444', icon: '🔥' };
        if (score >= 60) return { label: 'Warm', color: '#f59e0b', icon: '☀️' };
        if (score >= 40) return { label: 'Lauwarm', color: '#eab308', icon: '🌤️' };
        return { label: 'Kalt', color: '#3b82f6', icon: '❄️' };
    }

    // Delete lead
    deleteLead(id) {
        this.leads = this.leads.filter(l => l.id !== id);
        this.save();
    }

    // Import leads from CSV
    importFromCSV(csvContent) {
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        let imported = 0;

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length < 2) continue;

            const lead = {};
            headers.forEach((header, index) => {
                if (values[index]) {
                    const value = values[index].trim().replace(/^"|"$/g, '');
                    if (header.includes('name')) lead.name = value;
                    else if (header.includes('email')) lead.email = value;
                    else if (header.includes('telefon') || header.includes('phone')) lead.telefon = value;
                    else if (header.includes('firma') || header.includes('company')) lead.firma = value;
                    else if (header.includes('budget')) lead.budget = parseFloat(value) || null;
                    else if (header.includes('quelle') || header.includes('source')) lead.quelle = value;
                }
            });

            if (lead.name) {
                this.addLead(lead);
                imported++;
            }
        }

        return { success: imported, total: lines.length - 1 };
    }

    // Persistence
    save() {
        localStorage.setItem('mhs_leads', JSON.stringify(this.leads));
    }
}

window.leadService = new LeadService();
