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
        subject: `Starbooks receipt ${reference}`,
        html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#edf1ec;margin:0;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;font-family:Arial,Helvetica,sans-serif;color:#26352d;background:#ffffff;border:1px solid #d9e1d6">
  <tr><td align="center" style="background:#123f2b;padding:22px 24px 18px;border-bottom:4px solid #d8c58a">
    <div style="font-size:10px;line-height:14px;text-transform:uppercase;letter-spacing:2px;color:#dce8d8">A note from your bookseller</div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:38px;font-weight:700;color:#ffffff;padding-top:4px">Starbooks Bookhouse</div>
    <div style="font-size:13px;line-height:18px;color:#dce8d8;padding-top:3px">Your order receipt</div>
  </td></tr>
  <tr><td style="padding:26px 30px 8px">
    <div style="font-size:14px;line-height:22px;color:#56655d;padding-bottom:10px">Thank you for your order. Keep this receipt reference for your records:</div>
    <div style="font-size:17px;line-height:24px;font-weight:700;color:#123f2b;padding-bottom:22px">${reference}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse">
      <tr style="background:#edf3e5">
        <td align="left" style="padding:12px 10px;font-size:11px;line-height:14px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#123f2b">Book</td>
        <td align="center" width="52" style="padding:12px 8px;font-size:11px;line-height:14px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#123f2b">Qty</td>
        <td align="right" width="112" style="padding:12px 10px;font-size:11px;line-height:14px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#123f2b">Amount</td>
      </tr>
      ${items.map((item) => `<tr><td style="padding:15px 10px;border-bottom:1px solid #dde4d9;font-size:14px;line-height:20px;color:#26352d"><strong style="font-weight:700">${escapeHtml(item.title)}</strong><div style="font-size:12px;line-height:18px;color:#6c766f">by ${escapeHtml(item.author)}</div></td><td align="center" style="padding:15px 8px;border-bottom:1px solid #dde4d9;font-size:14px;color:#26352d">${item.quantity}</td><td align="right" style="padding:15px 10px;border-bottom:1px solid #dde4d9;font-size:14px;font-weight:700;color:#26352d">${formatPrice(item.unit_price_cents * item.quantity / 100)}</td></tr>`).join("")}
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="right" style="padding:20px 10px 22px"><span style="font-size:13px;color:#637168">Order total</span>&nbsp;&nbsp;<strong style="font-size:24px;line-height:30px;color:#123f2b">${formatPrice(subtotalCents / 100)}</strong></td></tr></table>
  </td></tr>
  <tr><td align="center" style="background:#123f2b;padding:22px 20px 24px">
    <div style="font-size:16px;line-height:22px;font-weight:700;color:#ffffff;padding-bottom:13px">Ready for another good read?</div>
    <!--[if mso]>
    <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://hotspotandco.com/books.html" style="height:46px;v-text-anchor:middle;width:190px" arcsize="8%" strokecolor="#f1cf78" fillcolor="#f1cf78">
        <w:anchorlock/>
        <center style="color:#123f2b;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px">EXPLORE THE BOOKSTORE</center>
      </v:roundrect>
    </td></tr></table>
    <![endif]-->
    <!--[if !mso]><!-->
    <a href="https://hotspotandco.com/books.html" style="display:inline-block;background:#f1cf78;border:1px solid #f1cf78;border-radius:2px;color:#123f2b;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;line-height:16px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:14px 24px">EXPLORE THE BOOKSTORE</a>
    <!--<![endif]-->
  </td></tr>
  <tr><td align="center" style="padding:16px 20px;font-size:12px;line-height:18px;color:#647168;border-top:1px solid #e1e6de">Questions about your receipt? Reply directly to <a href="mailto:${fromEmail}" style="color:#123f2b;font-weight:700;text-decoration:underline">${fromEmail}</a>.</td></tr>
</table>
</td></tr></table>`,
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
