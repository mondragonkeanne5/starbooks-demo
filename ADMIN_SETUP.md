# Starbooks Admin Setup

The product manager is available at `https://hotspotandco.com/admin.html` after GitHub Pages publishes this branch.

## Authorize an Admin

1. In Supabase **Authentication > Users**, create an individual account for each administrator. Complete email confirmation if it is enabled.
2. In the Supabase **SQL Editor**, authorize the account and assign a unique lowercase username. Replace all three values:

   ```sql
      insert into public.admin_users (user_id, username, email)
      values ('YOUR-AUTH-USER-UUID'::uuid, 'your-username', 'your-auth-email@example.com')
      on conflict (user_id) do update
      set username = excluded.username,
         email = excluded.email;
   ```

3. Sign in at `/admin.html` with the assigned username and that account's Supabase password.

Do not use a shared default password. Catalog writes are checked by database Row Level Security, so only accounts explicitly inserted into `admin_users` can add, edit, publish, or hide books. Public visitors can continue to read active books only.

## Supabase Auth URLs

In **Authentication > URL Configuration**, set the Site URL to `https://hotspotandco.com` and add these Redirect URLs:

- `https://hotspotandco.com/**`
- `https://www.hotspotandco.com/**`

Apply the migrations in `supabase/migrations` and deploy the `admin-login` Edge Function before authorizing an account. The login function's service role can read only the private username and email mapping columns it needs.