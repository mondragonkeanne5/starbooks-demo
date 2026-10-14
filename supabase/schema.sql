drop table if exists public.demo_orders;

create table if not exists public.books (
  isbn text primary key,
  title text not null,
  author text not null,
  price_cents integer not null check (price_cents > 0),
  category text not null check (category in ('Fiction', 'Nonfiction', 'Fantasy')),
  genre_label text not null,
  cover_url text not null,
  cover_tone text not null check (cover_tone in ('blue', 'coral', 'yellow', 'teal')),
  staff_pick boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0
);

insert into public.books (isbn, title, author, price_cents, category, genre_label, cover_url, cover_tone, staff_pick, sort_order)
values
  ('9780525559474', 'The Midnight Library', 'Matt Haig', 1800, 'Fiction', 'Fiction', 'https://covers.openlibrary.org/b/isbn/9780525559474-L.jpg', 'blue', true, 1),
  ('9780593321201', 'Tomorrow, and Tomorrow, and Tomorrow', 'Gabrielle Zevin', 1950, 'Fiction', 'Fiction', 'https://covers.openlibrary.org/b/isbn/9780593321201-L.jpg', 'coral', true, 2),
  ('9780525657743', 'Crying in H Mart', 'Michelle Zauner', 1700, 'Nonfiction', 'Memoir', 'https://covers.openlibrary.org/b/isbn/9780525657743-L.jpg', 'yellow', false, 3),
  ('9781250217288', 'The House in the Cerulean Sea', 'TJ Klune', 1800, 'Fantasy', 'Fantasy', 'https://covers.openlibrary.org/b/isbn/9781250217288-L.jpg', 'teal', false, 4)
on conflict (isbn) do update set
  title = excluded.title,
  author = excluded.author,
  price_cents = excluded.price_cents,
  category = excluded.category,
  genre_label = excluded.genre_label,
  cover_url = excluded.cover_url,
  cover_tone = excluded.cover_tone,
  staff_pick = excluded.staff_pick,
  active = excluded.active,
  sort_order = excluded.sort_order;

alter table public.books enable row level security;

revoke all on public.books from anon, authenticated;
grant select on public.books to anon, authenticated;

drop policy if exists "Public can view active books" on public.books;
create policy "Public can view active books"
  on public.books
  for select
  to anon, authenticated
  using (active = true);

comment on table public.books is 'Book catalog shown on the public Starbooks storefront.';