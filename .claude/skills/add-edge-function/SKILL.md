---
name: add-edge-function
description: Create a new Supabase Edge Function (Deno/TypeScript) with proper structure, CORS handling, and Supabase client setup.
argument-hint: [function-name]
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

## Create a Supabase Edge Function

Create a new Edge Function called `$ARGUMENTS`.

### Steps

1. **Read** an existing function in `supabase/functions/` to understand the project pattern (e.g., `supabase/functions/send-email/`).
2. **Create** the directory `supabase/functions/$ARGUMENTS/`.
3. **Write** the `index.ts` file following the template below.

### Edge Function Template

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with the user's JWT
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Verify the user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();

    // TODO: Implement function logic for "$ARGUMENTS"

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### Conventions

- Always handle CORS preflight (`OPTIONS` request)
- Always verify auth via `supabase.auth.getUser()`
- Use the user's JWT to create the Supabase client (so RLS applies)
- Return JSON responses with appropriate status codes
- Keep functions small and focused — one responsibility per function
- Name the directory in kebab-case matching the function name

### After Creation

Remind the user:
- Deploy with: `supabase functions deploy $ARGUMENTS`
- Test locally with: `supabase functions serve $ARGUMENTS`
- Set secrets with: `supabase secrets set KEY=VALUE`
