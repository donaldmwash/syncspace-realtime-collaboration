import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Sign in before using an invitation." }), { status: 401, headers: corsHeaders });
    }

    const { token } = await req.json();
    if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) {
      return new Response(JSON.stringify({ error: "Invalid invitation token." }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Required Supabase function secrets are not configured.");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Your session is invalid. Sign in again." }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: conversationId, error: joinError } = await adminClient.rpc("redeem_conversation_invite", {
      p_token: token,
      p_user_id: authData.user.id,
    });
    if (joinError) {
      return new Response(JSON.stringify({ error: joinError.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ conversation_id: conversationId }), { status: 200, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected invitation error.";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
