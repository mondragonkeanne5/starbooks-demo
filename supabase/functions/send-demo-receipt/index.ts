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
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? request.headers.get("apikey") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("STARBOOKS_FROM_EMAIL");
  const storefrontUrl = Deno.env.get("SITE_URL") ?? "https://hotspotandco.com";
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
  const rows = items.map((item) =>
    `<tr>
      <td style="padding:16px;border-bottom:1px solid #e4e9e1;color:#243b30;font-size:14px;line-height:1.5">${escapeHtml(item.title)}<br><span style="color:#68776d;font-size:13px">by ${escapeHtml(item.author)}</span></td>
      <td align="center" style="padding:16px;border-bottom:1px solid #e4e9e1;color:#243b30;font-size:14px">${item.quantity}</td>
      <td align="right" style="padding:16px;border-bottom:1px solid #e4e9e1;color:#243b30;font-size:14px;font-weight:600">$${(item.unit_price_cents * item.quantity / 100).toFixed(2)}</td>
    </tr>`
  ).join("");

  let emailResponse: Response;
  const safeStorefrontUrl = escapeHtml(storefrontUrl);
  try {
    emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Starbooks Bookhouse <${fromEmail}>`,
        to: [email],
        subject: `Starbooks receipt ${reference}`,
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f1eb" style="width:100%;background-color:#f2f1eb;font-family:Arial,Helvetica,sans-serif;color:#243b30">
  <tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:620px;background-color:#ffffff;border:1px solid #dce4da">
      <tr><td align="center" bgcolor="#123f2b" style="background-color:#123f2b;padding:30px 20px 26px;color:#ffffff">
        <p style="margin:0 0 9px;color:#e3c985;font-size:11px;line-height:1.3;font-weight:bold;text-transform:uppercase;letter-spacing:2px">A note from your bookseller</p>
        <h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.25;font-weight:bold">Starbooks Bookhouse</h1>
        <p style="margin:7px 0 0;color:#e8eee8;font-size:14px;line-height:1.4">Your order receipt</p>
      </td></tr>
      <tr><td style="padding:26px 28px 12px">
        <p style="margin:0;color:#344a3d;font-size:15px;line-height:1.7">Thank you for your order. Keep this receipt reference for your records:</p>
        <p style="margin:10px 0 0;color:#123f2b;font-size:16px;line-height:1.5;font-weight:bold">${reference}</p>
      </td></tr>
      <tr><td style="padding:12px 28px 4px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
          <tr bgcolor="#edf3e9" style="background-color:#edf3e9">
            <th align="left" style="padding:12px 16px;color:#365342;font-size:11px;line-height:1.3;text-transform:uppercase;letter-spacing:1px">Book</th>
            <th align="center" style="padding:12px 8px;color:#365342;font-size:11px;line-height:1.3;text-transform:uppercase;letter-spacing:1px">Qty</th>
            <th align="right" style="padding:12px 16px;color:#365342;font-size:11px;line-height:1.3;text-transform:uppercase;letter-spacing:1px">Amount</th>
          </tr>
          ${rows}
        </table>
      </td></tr>
      <tr><td align="right" style="padding:22px 44px 24px">
        <span style="color:#586b5e;font-size:14px">Order total&nbsp;&nbsp;</span><strong style="color:#123f2b;font-size:26px;line-height:1.2">$${(subtotalCents / 100).toFixed(2)}</strong>
      </td></tr>
      <tr><td align="center" bgcolor="#f5f7f2" style="background-color:#f5f7f2;padding:22px 20px 24px;border-top:1px solid #e4e9e1">
        <p style="margin:0 0 14px;color:#465b4d;font-size:14px;line-height:1.5">A good book is always worth coming back for.</p>
        <a href="${safeStorefrontUrl}" bgcolor="#123f2b" style="display:inline-block;background-color:#123f2b;color:#ffffff;text-decoration:none;padding:13px 24px;font-size:14px;line-height:1.2;font-weight:bold">Return to Starbooks</a>
      </td></tr>
      <tr><td align="center" style="padding:20px 24px 22px;color:#66756b;font-size:12px;line-height:1.7">
        Questions about your receipt? Reply to this email or contact<br>
        <a href="mailto:${fromEmail}" style="color:#123f2b;font-weight:bold;text-decoration:underline">${fromEmail}</a>.
      </td></tr>
    </table>
  </td></tr>
</table>`,
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
