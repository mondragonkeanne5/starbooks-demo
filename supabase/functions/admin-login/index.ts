import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = (Deno.env.get("SITE_ORIGINS") ?? "https://hotspotandco.com,https://www.hotspotandco.com,https://mondragonkeanne5.github.io")
  .split(",")
  .map((origin) => origin.trim());

function corsHeaders(request: Request) {
  const requestOrigin = request.headers.get("Origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (allowedOrigins.includes(requestOrigin)) headers["Access-Control-Allow-Origin"] = requestOrigin;
  return headers;
}

function jsonResponse(body: unknown, request: Request, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, request, 405);

  const origin = request.headers.get("Origin") ?? "";
  if (!allowedOrigins.includes(origin)) return jsonResponse({ error: "Origin is not allowed." }, request, 403);

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid sign-in request." }, request, 400);
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[a-z0-9._-]{3,32}$/.test(username) || password.length < 1 || password.length > 128) {
    return jsonResponse({ error: "Invalid username or password." }, request, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Username login is missing server configuration.");
    return jsonResponse({ error: "Sign-in is temporarily unavailable." }, request, 503);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: account } = await serviceClient
    .from("admin_users")
    .select("email")
    .eq("username", username)
    .maybeSingle();

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({
    email: account?.email ?? "unknown-admin@invalid.starbooks",
    password,
  });

  if (error || !data.session) {
    const status = error?.status === 429 ? 429 : 401;
    return jsonResponse({ error: "Username or password is incorrect." }, request, status);
  }

  return jsonResponse({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }, request);
});