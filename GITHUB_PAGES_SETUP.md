# Starbooks Setup: Catalog and Email Checkout

The storefront is hosted on GitHub Pages, books are stored in Supabase, and a no-payment demo checkout emails a receipt to the address entered by the customer. It does **not** store orders or take payment. Resend relays the receipt from a verified `hotspotandco.com` sender; it does not log into GoDaddy SMTP. No GoDaddy web-hosting plan is needed.

## Supabase Books Catalog

1. In Supabase **SQL Editor**, run [schema.sql](supabase/schema.sql). It creates and seeds the `books` table. It also drops the obsolete `demo_orders` table if it exists, including its rows, because checkout no longer saves orders.
2. In **Project Settings > API**, copy the Project URL and **anon/public** key into `github-pages/backend-config.js`.
3. Never put the `service_role` key, Resend API key, Turnstile secret, or GoDaddy mailbox password in the public GitHub repository.
4. Edit catalog rows in **Table Editor > books**. Prices are in cents (`1800` = `$18.00`). Set `active` to false to hide a book.

The storefront uses its embedded books as a local-preview fallback until the Supabase URL and anon key are configured. On the live site it loads active books and prices from the database.

## Email Checkout

1. Create a Cloudflare Turnstile site for `hotspotandco.com` and `www.hotspotandco.com`. Put the **site key** into `turnstileSiteKey` in `github-pages/backend-config.js`.
2. Create a Resend account and verify `hotspotandco.com` as a sending domain. Set up SPF/DKIM using the DNS records Resend provides. Preserve the existing GoDaddy MX and mail-related records; if SPF already exists, merge the required SPF mechanisms rather than adding a second SPF record.
3. In Supabase **Edge Functions > Secrets**, add `RESEND_API_KEY`, `STARBOOKS_FROM_EMAIL` (`hotspot@hotspotandco.com`), and `TURNSTILE_SECRET_KEY`. Supabase supplies its own project URL and anon key to Edge Functions.
4. Deploy `supabase/functions/send-demo-receipt/index.ts` as `send-demo-receipt` using the Supabase CLI from this project folder. Run `npx supabase login`, then `npx supabase link --project-ref YOUR_PROJECT_REF`, then `npx supabase functions deploy send-demo-receipt`. Keep the function's Turnstile verification enabled. The function reads book prices from Supabase and sends email only; it does not save orders.
5. Test with your own customer email first. A successful checkout emails a receipt. No payment is taken or order stored.

## GitHub Pages and Domain

Upload `index.html`, `styles.css`, `app.js`, `backend-config.js`, and `logo.jpg` from `github-pages/` to the root of the public GitHub repository and commit. GitHub Pages redeploys automatically. The `hotspotandco.com` domain already points to GitHub Pages; keep GoDaddy MX, DKIM, and other mail DNS records unchanged.

GitHub's free Pages plan requires a public repository, so its source files are visible. Only the Supabase anon key and Turnstile site key belong in `backend-config.js`; all provider secrets stay in their dashboards.