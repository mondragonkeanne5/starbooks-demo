create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  email text unique,
  created_at timestamptz not null default now()
);

alter table public.admin_users add column if not exists username text;
alter table public.admin_users add column if not exists email text;

create unique index if not exists admin_users_username_lower_idx
  on public.admin_users (lower(username))
  where username is not null;

create unique index if not exists admin_users_email_lower_idx
  on public.admin_users (lower(email))
  where email is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_users_username_format'
      and conrelid = 'public.admin_users'::regclass
  ) then
    alter table public.admin_users
      add constraint admin_users_username_format
      check (username is null or username ~ '^[a-z0-9._-]{3,32}$');
  end if;
end;
$$;

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_starbooks_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users as allowed_admin
    where allowed_admin.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_starbooks_admin() from public;
grant execute on function public.is_starbooks_admin() to authenticated;

grant select, insert, update, delete on public.books to authenticated;

drop policy if exists "Admins can manage books" on public.books;
create policy "Admins can manage books"
  on public.books
  for all
  to authenticated
  using ((select public.is_starbooks_admin()))
  with check ((select public.is_starbooks_admin()));

comment on table public.admin_users is 'Accounts explicitly authorized to manage the Starbooks catalog.';