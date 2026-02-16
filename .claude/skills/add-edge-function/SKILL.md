---
name: add-edge-function
description: Create a new Supabase Edge Function (Deno/TypeScript) with CORS, auth, and Supabase client setup.
argument-hint: [function-name]
context: fork
agent: general-purpose
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

## Create a Supabase Edge Function

Create `supabase/functions/$ARGUMENTS/index.ts`.

### Steps

1. Read an existing function in `supabase/functions/` for project patterns.
2. Create `supabase/functions/$ARGUMENTS/index.ts` using the template.

### Template

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const body = await req.json();
    // TODO: implement $ARGUMENTS logic
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

### Conventions
- Always handle CORS preflight
- Always verify auth via `supabase.auth.getUser()`
- Use user's JWT so RLS applies
- kebab-case directory name
