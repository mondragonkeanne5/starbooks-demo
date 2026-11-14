# Starbooks Admin Setup

The product manager is available at `https://hotspotandco.com/admin.html` after GitHub Pages publishes this branch.

## Authorize an Admin

1. In Supabase **Authentication > Users**, create an individual account for each administrator. Complete email confirmation if it is enabled.
2. In the Supabase **SQL Editor**, authorize only that user's UUID:

   ```sql
   insert into public.admin_users (user_id)
   values ('YOUR-AUTH-USER-UUID'::uuid)
   on conflict (user_id) do nothing;
   ```

3. Sign in at `/admin.html` with that account's own email and password.

Do not use a shared default password. Catalog writes are checked by database Row Level Security, so only accounts explicitly inserted into `admin_users` can add, edit, publish, or hide books. Public visitors can continue to read active books only.

## Supabase Auth URLs

In **Authentication > URL Configuration**, set the Site URL to `https://hotspotandco.com` and add these Redirect URLs:

- `https://hotspotandco.com/**`
- `https://www.hotspotandco.com/**`

Apply the catalog-admin migration in `supabase/migrations` before authorizing an account.