<?php
/**
 * Plugin Name: Starbooks Storefront
 * Description: Serves the Starbooks storefront and stores book requests in the site's WordPress database.
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

function starbooks_orders_table_name()
{
    global $wpdb;
    return $wpdb->prefix . 'starbooks_orders';
}

function starbooks_activate_plugin()
{
    global $wpdb;

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $table = starbooks_orders_table_name();
    $charset_collate = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE {$table} (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        order_number varchar(32) NOT NULL,
        customer_name varchar(120) NOT NULL,
        customer_email varchar(190) NOT NULL,
        items longtext NOT NULL,
        subtotal_cents int(10) unsigned NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'new',
        created_at datetime NOT NULL,
        PRIMARY KEY  (id),
        UNIQUE KEY order_number (order_number),
        KEY created_at (created_at)
    ) {$charset_collate};";

    dbDelta($sql);
}
register_activation_hook(__FILE__, 'starbooks_activate_plugin');

function starbooks_catalog()
{
    return array(
        '9780525559474' => array('title' => 'The Midnight Library', 'author' => 'Matt Haig', 'price_cents' => 1800),
        '9780593321201' => array('title' => 'Tomorrow, and Tomorrow, and Tomorrow', 'author' => 'Gabrielle Zevin', 'price_cents' => 1950),
        '9780525657743' => array('title' => 'Crying in H Mart', 'author' => 'Michelle Zauner', 'price_cents' => 1700),
        '9781250217288' => array('title' => 'The House in the Cerulean Sea', 'author' => 'TJ Klune', 'price_cents' => 1800),
    );
}

function starbooks_create_order(WP_REST_Request $request)
{
    global $wpdb;

    $body = $request->get_json_params();
    if (!is_array($body)) {
        return new WP_Error('starbooks_invalid_request', 'Please check the request details.', array('status' => 400));
    }

    if (!empty($body['website'])) {
        return new WP_REST_Response(array('order_number' => 'SB-RECEIVED'), 201);
    }

    $customer_name = isset($body['customer_name']) ? sanitize_text_field($body['customer_name']) : '';
    $customer_email = isset($body['customer_email']) ? sanitize_email($body['customer_email']) : '';
    if ($customer_name === '' || strlen($customer_name) > 120 || !is_email($customer_email)) {
        return new WP_Error('starbooks_invalid_contact', 'Enter your name and a valid email address.', array('status' => 400));
    }

    $submitted_items = isset($body['items']) ? $body['items'] : null;
    if (!is_array($submitted_items) || count($submitted_items) === 0 || count($submitted_items) > 20) {
        return new WP_Error('starbooks_invalid_items', 'Your bag is empty or contains too many different books.', array('status' => 400));
    }

    $catalog = starbooks_catalog();
    $items_by_isbn = array();
    foreach ($submitted_items as $submitted_item) {
        if (!is_array($submitted_item) || !isset($submitted_item['isbn'], $submitted_item['quantity'])) {
            return new WP_Error('starbooks_invalid_item', 'One of the books in your bag is invalid.', array('status' => 400));
        }

        $isbn = preg_replace('/\D/', '', (string) $submitted_item['isbn']);
        $quantity = filter_var($submitted_item['quantity'], FILTER_VALIDATE_INT);
        if (!isset($catalog[$isbn]) || $quantity === false || $quantity < 1 || $quantity > 10) {
            return new WP_Error('starbooks_invalid_item', 'One of the books in your bag is unavailable.', array('status' => 400));
        }

        if (!isset($items_by_isbn[$isbn])) {
            $items_by_isbn[$isbn] = array(
                'isbn' => $isbn,
                'title' => $catalog[$isbn]['title'],
                'author' => $catalog[$isbn]['author'],
                'quantity' => 0,
                'unit_price_cents' => $catalog[$isbn]['price_cents'],
            );
        }
        $items_by_isbn[$isbn]['quantity'] += $quantity;
        if ($items_by_isbn[$isbn]['quantity'] > 10) {
            return new WP_Error('starbooks_invalid_quantity', 'A maximum of 10 copies per book can be requested.', array('status' => 400));
        }
    }

    $subtotal_cents = 0;
    foreach ($items_by_isbn as $item) {
        $subtotal_cents += $item['unit_price_cents'] * $item['quantity'];
    }

    $client_ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
    $rate_key = 'starbooks_order_' . hash('sha256', $client_ip . wp_salt('auth'));
    $recent_requests = (int) get_transient($rate_key);
    if ($recent_requests >= 8) {
        return new WP_Error('starbooks_rate_limited', 'Please wait a few minutes before sending another request.', array('status' => 429));
    }
    set_transient($rate_key, $recent_requests + 1, 10 * MINUTE_IN_SECONDS);

    $order_number = 'SB-' . gmdate('ymd') . '-' . strtoupper(wp_generate_password(6, false, false));
    $inserted = $wpdb->insert(
        starbooks_orders_table_name(),
        array(
            'order_number' => $order_number,
            'customer_name' => $customer_name,
            'customer_email' => $customer_email,
            'items' => wp_json_encode(array_values($items_by_isbn)),
            'subtotal_cents' => $subtotal_cents,
            'status' => 'new',
            'created_at' => current_time('mysql', true),
        ),
        array('%s', '%s', '%s', '%s', '%d', '%s', '%s')
    );

    if ($inserted === false) {
        return new WP_Error('starbooks_save_failed', 'We could not save your request. Please try again.', array('status' => 500));
    }

    return new WP_REST_Response(
        array(
            'order_number' => $order_number,
            'subtotal' => number_format($subtotal_cents / 100, 2, '.', ''),
        ),
        201
    );
}

function starbooks_register_rest_routes()
{
    register_rest_route(
        'starbooks/v1',
        '/orders',
        array(
            'methods' => WP_REST_Server::CREATABLE,
            'callback' => 'starbooks_create_order',
            'permission_callback' => '__return_true',
        )
    );
}
add_action('rest_api_init', 'starbooks_register_rest_routes');

function starbooks_render_homepage()
{
    if (!is_front_page() || is_admin() || wp_doing_ajax() || is_feed()) {
        return;
    }

    $index_path = plugin_dir_path(__FILE__) . 'storefront/index.html';
    if (!is_readable($index_path)) {
        return;
    }

    $html = file_get_contents($index_path);
    if ($html === false) {
        return;
    }

    $asset_base = trailingslashit(plugins_url('storefront', __FILE__));
    $html = str_replace(
        array('href="styles.css"', 'src="app.js"', 'src="logo.jpg"'),
        array(
            'href="' . esc_url($asset_base . 'styles.css') . '"',
            'src="' . esc_url($asset_base . 'app.js') . '"',
            'src="' . esc_url($asset_base . 'logo.jpg') . '"',
        ),
        $html
    );

    if (!headers_sent()) {
        header('Content-Type: text/html; charset=' . get_bloginfo('charset'));
    }
    echo $html;
    exit;
}
add_action('template_redirect', 'starbooks_render_homepage', 0);

function starbooks_register_admin_page()
{
    add_menu_page(
        'Starbooks Orders',
        'Starbooks Orders',
        'manage_options',
        'starbooks-orders',
        'starbooks_render_admin_page',
        'dashicons-book-alt',
        26
    );
}
add_action('admin_menu', 'starbooks_register_admin_page');

function starbooks_render_admin_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }

    global $wpdb;
    $table = starbooks_orders_table_name();
    $orders = $wpdb->get_results("SELECT order_number, customer_name, customer_email, items, subtotal_cents, status, created_at FROM {$table} ORDER BY id DESC LIMIT 100");

    echo '<div class="wrap"><h1>Starbooks order requests</h1><p>Recent requests are stored in your WordPress database. Payment and fulfillment are handled separately.</p>';
    if (empty($orders)) {
        echo '<p>No book requests yet.</p></div>';
        return;
    }

    echo '<table class="widefat striped"><thead><tr><th>Reference</th><th>Date (UTC)</th><th>Customer</th><th>Books</th><th>Subtotal</th><th>Status</th></tr></thead><tbody>';
    foreach ($orders as $order) {
        $items = json_decode($order->items, true);
        $book_lines = array();
        if (is_array($items)) {
            foreach ($items as $item) {
                $title = isset($item['title']) ? $item['title'] : 'Book';
                $quantity = isset($item['quantity']) ? absint($item['quantity']) : 0;
                $book_lines[] = esc_html($title) . ' × ' . esc_html((string) $quantity);
            }
        }

        echo '<tr>';
        echo '<td>' . esc_html($order->order_number) . '</td>';
        echo '<td>' . esc_html($order->created_at) . '</td>';
        echo '<td>' . esc_html($order->customer_name) . '<br><a href="mailto:' . esc_attr($order->customer_email) . '">' . esc_html($order->customer_email) . '</a></td>';
        echo '<td>' . implode('<br>', $book_lines) . '</td>';
        echo '<td>$' . esc_html(number_format(((int) $order->subtotal_cents) / 100, 2)) . '</td>';
        echo '<td>' . esc_html($order->status) . '</td>';
        echo '</tr>';
    }
    echo '</tbody></table></div>';
}