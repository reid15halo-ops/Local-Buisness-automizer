/* ============================================
   Call Summary Service - Anruf-Zusammenfassungen
   Supabase CRUD fuer call_summaries Tabelle
   ============================================ */

class CallSummaryService {
    constructor() {
        this.tableName = 'call_summaries';
    }

    _getSupabase() {
        if (window.supabaseClient && window.supabaseClient.isConfigured()) {
            return window.supabaseClient.client;
        }
        return null;
    }

    async _getUserId() {
        const sb = this._getSupabase();
        if (!sb) return null;
        const { data: { user } } = await sb.auth.getUser();
        return user?.id || null;
    }

    async saveSummary(data) {
        const sb = this._getSupabase();
        if (!sb) {
            console.warn('[CallSummary] Supabase nicht konfiguriert');
            return null;
        }

        const userId = await this._getUserId();
        if (!userId) return null;

        const record = {
            id: data.id || ('cs-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)),
            user_id: userId,
            kunde_id: data.kundeId || data.kunde_id || null,
            kunde_name: data.kundeName || data.kunde_name || null,
            phone: data.phone || null,
            direction: data.direction || 'outbound',
            transcript: data.transcript || null,
            summary: data.summary || null,
            keywords: data.keywords || [],
            duration: data.duration || null,
        };

        const { data: result, error } = await sb
            .from(this.tableName)
            .upsert(record)
            .select()
            .single();

        if (error) {
            console.error('[CallSummary] Speichern fehlgeschlagen:', error.message);
            return null;
        }

        return result;
    }

    async getSummariesForCustomer(kundeId, limit = 20) {
        const sb = this._getSupabase();
        if (!sb) return [];

        const { data, error } = await sb
            .from(this.tableName)
            .select('*')
            .eq('kunde_id', kundeId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[CallSummary] Laden fehlgeschlagen:', error.message);
            return [];
        }
        return data || [];
    }

    async getRecentSummaries(limit = 10) {
        const sb = this._getSupabase();
        if (!sb) return [];

        const { data, error } = await sb
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[CallSummary] Laden fehlgeschlagen:', error.message);
            return [];
        }
        return data || [];
    }

    async deleteSummary(id) {
        const sb = this._getSupabase();
        if (!sb) return false;

        const { error } = await sb
            .from(this.tableName)
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[CallSummary] Loeschen fehlgeschlagen:', error.message);
            return false;
        }
        return true;
    }

    async getSummariesByPhone(phone, limit = 10) {
        const sb = this._getSupabase();
        if (!sb) return [];

        const { data, error } = await sb
            .from(this.tableName)
            .select('*')
            .eq('phone', phone)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[CallSummary] Laden fehlgeschlagen:', error.message);
            return [];
        }
        return data || [];
    }
}

window.callSummaryService = new CallSummaryService();
