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
    currencyDisplay: "narrowSymbol",
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
        html: `<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f3028;max-width:600px;margin:0 auto;border:1px solid #dfe6dc;background:#fcfdfa">
  <div style="background:#123f2b;color:#ffffff;text-align:center;padding:24px 20px 20px">
    <p style="margin:0 0 8px;font-size:10px;line-height:1;color:#d7e5d2;text-transform:uppercase;letter-spacing:1.8px">A note from your bookseller</p>
    <h1 style="margin:0;font-size:28px;line-height:1.2;color:#ffffff">Starbooks Bookhouse</h1>
    <p style="margin:8px 0 0;font-size:14px;color:#dfe9dc">Your order receipt</p>
  </div>
  <div style="padding:24px 28px 18px">
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#46564d">Thank you for your order. Keep this receipt reference for your records:</p>
    <p style="margin:0 0 22px;color:#123f2b;font-size:16px;font-weight:700">${reference}</p>
    <table style="width:100%;border-collapse:collapse" cellpadding="12">
      <thead>
        <tr style="background:#edf3e5">
          <th align="left" style="font-size:11px;text-transform:uppercase;color:#123f2b;letter-spacing:.6px">Book</th>
          <th align="center" style="width:64px;font-size:11px;text-transform:uppercase;color:#123f2b;letter-spacing:.6px">Qty</th>
          <th align="right" style="width:90px;font-size:11px;text-transform:uppercase;color:#123f2b;letter-spacing:.6px">Amount</th>
        </tr>
      </thead>
      <tbody style="font-size:13px">
        ${rows.replaceAll('<tr>', '<tr style="border-bottom:1px solid #dde4d9">').replaceAll('<td>', '<td style="padding:16px 12px;color:#1f3028">')}
      </tbody>
    </table>
    <div style="text-align:right;padding:22px 12px 18px;border-top:1px solid #e0e5dc;margin-top:4px">
      <span style="font-size:14px;color:#5a685f;margin-right:10px">Order total</span>
      <strong style="font-size:23px;color:#123f2b">${formatPrice(subtotalCents / 100)}</strong>
    </div>
  </div>
  <div style="background:#123f2b;text-align:center;padding:22px 20px 24px;color:#ffffff">
    <p style="margin:0 0 14px;font-size:15px;font-weight:600">Ready for another good read?</p>
    <a href="https://hotspotandco.com/books.html" style="display:inline-block;background:#f1cf78;color:#123f2b;text-decoration:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:15px 24px;border-radius:2px">Explore the bookstore</a>
  </div>
  <div style="text-align:center;padding:16px 20px;border-top:1px solid #e2e8df;font-size:12px;line-height:1.5;color:#5a685f">
    Questions about your receipt? Reply directly to <a href="mailto:${fromEmail}" style="color:#123f2b;font-weight:700;text-decoration:underline">${fromEmail}</a>.
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
