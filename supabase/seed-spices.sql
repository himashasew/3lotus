-- 3 Lotus CRM - seed: main spices used in Sri Lankan catering.
-- Run in Supabase SQL Editor. Safe to re-run (skips names that already exist).
-- Quantities start at 0; reorder level (low-stock warning) is in grams.

insert into public.categories (data)
select jsonb_build_object('name', v.n)
from (values
  ('Spices'),
  ('Curry Powders & Blends'),
  ('Leaves & Herbs')
) as v(n)
where not exists (
  select 1 from public.categories c where c.data ->> 'name' = v.n
);

insert into public.products (data)
select jsonb_build_object(
         'name', p.name,
         'categoryId', c.id,
         'measureType', 'mass',
         'reorderLevel', p.reorder,
         'quantity', 0
       )
from (values
  -- Whole & ground spices
  ('Chilli Powder (Miris Kudu)',            'Spices', 5000),
  ('Chilli Flakes / Crushed Chilli',        'Spices', 2000),
  ('Dried Red Chilli (Whole)',              'Spices', 3000),
  ('Turmeric Powder (Kaha Kudu)',           'Spices', 3000),
  ('Coriander Seeds (Koththamalli)',        'Spices', 3000),
  ('Coriander Powder',                      'Spices', 3000),
  ('Cumin Seeds (Suduru)',                  'Spices', 2000),
  ('Cumin Powder',                          'Spices', 1000),
  ('Fennel Seeds (Maduru)',                 'Spices', 2000),
  ('Fenugreek Seeds (Uluhal)',              'Spices', 1000),
  ('Mustard Seeds (Aba)',                   'Spices', 1000),
  ('Black Pepper (Whole)',                  'Spices', 2000),
  ('Black Pepper Powder',                   'Spices', 1000),
  ('White Pepper Powder',                   'Spices', 500),
  ('Cinnamon Sticks (Kurundu)',             'Spices', 1000),
  ('Cinnamon Powder',                       'Spices', 500),
  ('Cardamom (Enasal)',                     'Spices', 500),
  ('Cloves (Karabu Nati)',                  'Spices', 500),
  ('Nutmeg (Sadikka)',                      'Spices', 300),
  ('Mace (Wasawasi)',                       'Spices', 200),
  ('Star Anise',                            'Spices', 300),
  ('Saffron',                               'Spices', 20),
  ('Dried Ginger Powder (Inguru)',          'Spices', 1000),
  ('Garlic Powder',                         'Spices', 1000),
  ('Tamarind (Siyambala)',                  'Spices', 2000),
  ('Goraka (Garcinia Cambogia)',            'Spices', 1000),
  ('Salt (Cooking)',                        'Spices', 10000),
  ('Rock Salt',                             'Spices', 2000),
  -- Curry powders & blends
  ('Roasted Curry Powder (Thuna Paha)',     'Curry Powders & Blends', 5000),
  ('Raw Curry Powder (Amu Kudu)',           'Curry Powders & Blends', 3000),
  ('Jaffna Curry Powder',                   'Curry Powders & Blends', 2000),
  ('Garam Masala',                          'Curry Powders & Blends', 1500),
  ('Biryani Masala',                        'Curry Powders & Blends', 1000),
  ('Meat Curry Powder',                     'Curry Powders & Blends', 2000),
  ('Fish Curry Powder',                     'Curry Powders & Blends', 2000),
  ('Chicken Curry Powder',                  'Curry Powders & Blends', 2000),
  -- Leaves & herbs
  ('Curry Leaves (Karapincha)',             'Leaves & Herbs', 1000),
  ('Pandan Leaves (Rampe)',                 'Leaves & Herbs', 500),
  ('Lemongrass (Sera)',                     'Leaves & Herbs', 500),
  ('Bay Leaves',                            'Leaves & Herbs', 200),
  ('Mint Leaves',                           'Leaves & Herbs', 500),
  ('Coriander Leaves (Fresh)',              'Leaves & Herbs', 1000)
) as p(name, cat, reorder)
join public.categories c on c.data ->> 'name' = p.cat
where not exists (
  select 1 from public.products x where lower(x.data ->> 'name') = lower(p.name)
);

notify pgrst, 'reload schema';
