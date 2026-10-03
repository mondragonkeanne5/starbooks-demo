begin;

insert into public.books (
  isbn,
  title,
  author,
  price_cents,
  category,
  genre_label,
  cover_url,
  cover_tone,
  staff_pick,
  active,
  sort_order,
  currency_code
)
values
  (
    '9780593135204',
    'Project Hail Mary',
    'Andy Weir',
    125000,
    'Fiction',
    'Science Fiction',
    'https://covers.openlibrary.org/b/isbn/9780593135204-L.jpg',
    'blue',
    false,
    true,
    5,
    'PHP'
  ),
  (
    '9780735211292',
    'Atomic Habits',
    'James Clear',
    85000,
    'Nonfiction',
    'Nonfiction',
    'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg',
    'coral',
    false,
    true,
    6,
    'PHP'
  ),
  (
    '9780547928227',
    'The Hobbit',
    'J.R.R. Tolkien',
    75000,
    'Fantasy',
    'Fantasy',
    'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg',
    'yellow',
    false,
    true,
    7,
    'PHP'
  ),
  (
    '9781524763138',
    'Becoming',
    'Michelle Obama',
    95000,
    'Nonfiction',
    'Memoir',
    'https://covers.openlibrary.org/b/isbn/9781524763138-L.jpg',
    'teal',
    false,
    true,
    8,
    'PHP'
  )
on conflict (isbn) do nothing;

commit;
