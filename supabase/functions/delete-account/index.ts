// Supabase Edge Function: DSGVO Art. 17 Account Deletion
// Deletes user account and all associated data (CASCADE)
// Optionally exports user data as JSON before deletion
// Deploy: supabase functions deploy delete-account
// Env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://app.freyaivisions.de',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tables that contain user data (for optional export)
const USER_DATA_TABLES = [
    'profiles',
    'kunden',
    'anfragen',
    'angebote',
    'auftraege',
    'rechnungen',
    'positionen',
    'materialien',
    'lager',
    'bestellungen',
    'termine',
    'zahlungen',
    'mahnungen',
    'dokumente',
    'email_log',
    'sms_log',
]

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Authenticate user via Supabase JWT
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: req.headers.get('Authorization')! } },
        })

        const { data: { user }, error: authError } = await userClient.auth.getUser()
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Nicht authentifiziert' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Parse request body
        const body = await req.json().catch(() => ({}))
        const exportData = body.export_data === true

        // 3. Create admin client with service role key
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        })

        // 4. Optional: Export user data before deletion (DSGVO Art. 20 - Datenportabilität)
        let exportedData: Record<string, unknown[]> | null = null
        if (exportData) {
            exportedData = {}
            for (const table of USER_DATA_TABLES) {
                const { data, error } = await adminClient
                    .from(table)
                    .select('*')
                    .eq('user_id', user.id)
                if (!error && data && data.length > 0) {
                    exportedData[table] = data
                }
            }
        }

        // 5. Log the deletion BEFORE deleting the user (service role bypasses RLS)
        await adminClient.from('automation_log').insert({
            user_id: user.id,
            action: 'account.delete',
            target: user.email || user.id,
            metadata: {
                reason: 'DSGVO Art. 17 - Recht auf Löschung',
                timestamp: new Date().toISOString(),
                exported: exportData,
            },
        }).catch(() => {})

        // 6. Delete the user (CASCADE will remove all related data)
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
        if (deleteError) {
            return new Response(
                JSON.stringify({ error: `Kontolöschung fehlgeschlagen: ${deleteError.message}` }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 7. Return success (with optional data export)
        const response: Record<string, unknown> = {
            success: true,
            message: 'Konto und alle zugehörigen Daten wurden unwiderruflich gelöscht.',
        }
        if (exportedData) {
            response.exported_data = exportedData
        }

        return new Response(
            JSON.stringify(response),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Interner Serverfehler'
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
