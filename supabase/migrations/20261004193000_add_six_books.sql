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
    '9781649374042',
    'Fourth Wing',
    'Rebecca Yarros',
    109500,
    'Fantasy',
    'Fantasy',
    'https://covers.openlibrary.org/b/isbn/9781649374042-L.jpg',
    'coral',
    false,
    true,
    9,
    'PHP'
  ),
  (
    '9780062315007',
    'The Alchemist',
    'Paulo Coelho',
    67500,
    'Fiction',
    'Fiction',
    'https://covers.openlibrary.org/b/isbn/9780062315007-L.jpg',
    'yellow',
    false,
    true,
    10,
    'PHP'
  ),
  (
    '9780399590504',
    'Educated',
    'Tara Westover',
    92500,
    'Nonfiction',
    'Memoir',
    'https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg',
    'teal',
    false,
    true,
    11,
    'PHP'
  ),
  (
    '9780062060624',
    'The Song of Achilles',
    'Madeline Miller',
    79500,
    'Fantasy',
    'Mythology',
    'https://covers.openlibrary.org/b/isbn/9780062060624-L.jpg',
    'blue',
    false,
    true,
    12,
    'PHP'
  ),
  (
    '9780857197689',
    'The Psychology of Money',
    'Morgan Housel',
    82500,
    'Nonfiction',
    'Business',
    'https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg',
    'coral',
    false,
    true,
    13,
    'PHP'
  ),
  (
    '9780593439357',
    'The Very Secret Society of Irregular Witches',
    'Sangu Mandanna',
    87500,
    'Fiction',
    'Fiction',
    'https://covers.openlibrary.org/b/isbn/9780593439357-L.jpg',
    'yellow',
    false,
    true,
    14,
    'PHP'
  )
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
  sort_order = excluded.sort_order,
  currency_code = excluded.currency_code;

commit;
