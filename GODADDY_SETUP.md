# Starbooks on GoDaddy Managed WordPress

> This is an optional paid WordPress route. For the no-extra-hosting GitHub Pages route, use [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md) instead. The plugin ZIP is not used for GitHub Pages.

The storefront package targets a GoDaddy Managed WordPress site. The plugin uses the MySQL database already configured for WordPress, so no database password is added to the browser or this project.

## Install

1. Confirm that your Managed WordPress site is active and that your domain is assigned to it in GoDaddy. GoDaddy's domain or DNS dashboard is where the domain connection must be completed.
2. In WordPress, open **Plugins > Add New Plugin > Upload Plugin** and select `starbooks-storefront.zip` from this project.
3. Activate **Starbooks Storefront**.
4. In **Pages**, create a page named **Starbooks**. In **Settings > Reading**, set the homepage to a static page and select **Starbooks**.
5. Visit the domain root. The plugin serves the bundled storefront on the WordPress homepage. WordPress administration remains available at `/wp-admin`.
6. Submit a test book request, then open **Starbooks Orders** in the WordPress dashboard to confirm it was saved.

On activation, the plugin creates a table using the site's configured table prefix, ending in `starbooks_orders`. It stores the customer's name and email, the requested book snapshots, the server-calculated subtotal, a reference number, status, and timestamp. It does not store payment details.

## Important

- Checkout currently records a book request; it does not charge a card or calculate shipping. Contact the customer to arrange payment and fulfillment.
- The current four-book catalog and authoritative prices are defined in the plugin. They are not yet editable in WordPress admin.
- The request endpoint has basic input validation and per-IP rate limiting. Enable HTTPS on the GoDaddy site before accepting customer details.
- Installing the plugin and assigning the domain requires access to your GoDaddy and WordPress dashboards. Do not send account passwords or database credentials in chat.
- To update the storefront, replace the bundled files under `starbooks-wp-plugin/storefront/`, rebuild the ZIP, and upload it as a plugin update.