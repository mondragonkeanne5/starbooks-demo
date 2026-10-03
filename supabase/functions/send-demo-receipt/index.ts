import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = (Deno.env.get("SITE_ORIGINS") ?? "https://hotspotandco.com,https://www.hotspotandco.com,https://mondragonkeanne5.github.io")
  .split(",")
  .map((origin) => origin.trim());

function corsHeaders(request: Request) {
  const requestOrigin = request.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(requestOrigin) ? requestOrigin : "https://hotspotandco.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(body: unknown, request: Request, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, request, 405);

  let body: { customer_email?: unknown; website?: unknown; turnstile_token?: unknown; items?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "The request was not valid JSON." }, request, 400);
  }

  if (typeof body.website === "string" && body.website.length > 0) {
    return jsonResponse({ ok: true }, request);
  }

  const email = typeof body.customer_email === "string" ? body.customer_email.trim() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Enter a valid email address." }, request, 400);
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) {
    return jsonResponse({ error: "Your bag is empty or contains too many books." }, request, 400);
  }

  const quantities = new Map<string, number>();
  for (const rawItem of body.items) {
    if (typeof rawItem !== "object" || rawItem === null || !("isbn" in rawItem) || !("quantity" in rawItem)) {
      return jsonResponse({ error: "A book in the bag is invalid." }, request, 400);
    }
    const isbn = String(rawItem.isbn);
    const quantity = Number(rawItem.quantity);
    if (!/^\d{10,13}$/.test(isbn) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return jsonResponse({ error: "A book or quantity is unavailable." }, request, 400);
    }
    const nextQuantity = (quantities.get(isbn) ?? 0) + quantity;
    if (nextQuantity > 10) return jsonResponse({ error: "A maximum of 10 copies per book can be requested." }, request, 400);
    quantities.set(isbn, nextQuantity);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = request.headers.get("apikey") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("STARBOOKS_FROM_EMAIL");
  if (!supabaseUrl || !publishableKey || !resendApiKey || !fromEmail) {
    console.error("Email checkout configuration is incomplete.");
    return jsonResponse({ error: "Email checkout is not configured yet." }, request, 503);
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: books, error: catalogError } = await supabase
    .from("books")
    .select("isbn,title,author,price_cents")
    .in("isbn", [...quantities.keys()])
    .eq("active", true);
  if (catalogError || !books || books.length !== quantities.size) {
    console.error("Catalog lookup failed:", catalogError?.message);
    return jsonResponse({ error: "A book in your bag is unavailable. Refresh and try again." }, request, 400);
  }

  const booksByIsbn = new Map(books.map((book) => [book.isbn, book]));
  const items = [...quantities.entries()].map(([isbn, quantity]) => {
    const book = booksByIsbn.get(isbn)!;
    return { title: book.title, author: book.author, quantity, unit_price_cents: book.price_cents };
  });
  const subtotalCents = items.reduce((total, item) => total + item.unit_price_cents * item.quantity, 0);
  const reference = `SB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const formatPrice = (amount: number) => new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  const rows = items.map((item) =>
    `<tr><td>${escapeHtml(item.title)} by ${escapeHtml(item.author)}</td><td>${item.quantity}</td><td>${formatPrice(item.unit_price_cents * item.quantity / 100)}</td></tr>`
  ).join("");

  let emailResponse: Response;
  try {
    emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Starbook <${fromEmail}>`,
        to: [email],
        subject: `Starbook receipt ${reference}`,
        html: `<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f3028;max-width:600px;margin:0 auto;padding:28px 24px;border:1px solid #e2e8df;border-radius:12px;background:#fcfdfa">
  <div style="border-bottom:2px solid #123f2b;padding-bottom:18px;margin-bottom:20px;text-align:center">
    <h1 style="color:#123f2b;margin:0 0 4px;font-size:26px;letter-spacing:-0.5px">Starbook</h1>
    <p style="color:#57685c;margin:0;font-size:14px;font-weight:500">Official Order Receipt</p>
  </div>
  <p style="font-size:15px;line-height:1.5;margin:0 0 16px">Thank you for your order! Your receipt reference number is <strong style="color:#123f2b;font-size:16px;background:#edf5e8;padding:2px 8px;border-radius:4px">${reference}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0" cellpadding="10">
    <thead>
      <tr style="background:#edf3e5;border-bottom:2px solid #d5e4cc">
        <th align="left" style="font-size:12px;text-transform:uppercase;color:#123f2b;letter-spacing:0.5px">Book</th>
        <th align="center" style="font-size:12px;text-transform:uppercase;color:#123f2b;letter-spacing:0.5px">Qty</th>
        <th align="right" style="font-size:12px;text-transform:uppercase;color:#123f2b;letter-spacing:0.5px">Total</th>
      </tr>
    </thead>
    <tbody style="font-size:14px">
      ${rows}
    </tbody>
  </table>
  <div style="text-align:right;padding-top:14px;border-top:1px solid #e0e5dc;margin-bottom:24px">
    <span style="font-size:15px;color:#5a685f;margin-right:12px">Total Amount:</span>
    <strong style="font-size:22px;color:#123f2b">${formatPrice(subtotalCents / 100)}</strong>
  </div>
  <div style="background:#f1f6ed;border:1px solid #d9e6d3;padding:14px;border-radius:8px;font-size:13px;color:#3f5446;text-align:center;line-height:1.4">
    If you have any questions about this receipt, reply directly to this email at <a href="mailto:${fromEmail}" style="color:#123f2b;font-weight:600;text-decoration:underline">${fromEmail}</a>.
  </div>
</div>`,
      }),
    });
  } catch (error) {
    console.error("Receipt email request failed:", error);
    return jsonResponse({ error: "The receipt email could not be sent. Please try again." }, request, 502);
  }

  if (!emailResponse.ok) {
    console.error("Receipt email failed:", await emailResponse.text());
    return jsonResponse({ error: "The receipt email could not be sent. Please try again." }, request, 502);
  }

  return jsonResponse({ sent: true, reference }, request, 200);
});
