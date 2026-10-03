begin;

-- Frankfurter reference rate for 2026-10-02: USD 1 = PHP 62.597.
alter table public.books
  add column if not exists currency_code text not null default 'USD';

update public.books
set price_cents = round(price_cents::numeric * 62.597)::integer,
    currency_code = 'PHP'
where currency_code = 'USD';

alter table public.books
  alter column currency_code set default 'PHP';

comment on column public.books.price_cents is
  'Book price in the minor unit of currency_code (centavos for PHP).';

comment on column public.books.currency_code is
  'ISO 4217 currency code for price_cents.';

commit;
