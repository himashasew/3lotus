-- 3 Lotus CRM - seed: pantry categories and items for a Sri Lankan restaurant & catering service.
-- Run in Supabase SQL Editor AFTER seed-spices.sql (or before - order does not matter).
-- Safe to re-run: skips names that already exist. Quantities start at 0.
-- Base units: mass = grams, volume = ml, count = pieces. reorder = low-stock warning level in base units.

insert into public.categories (data)
select jsonb_build_object('name', v.n)
from (values
  ('Rice & Grains'),
  ('Flour & Baking'),
  ('Lentils, Pulses & Nuts'),
  ('Meat & Poultry'),
  ('Seafood & Dried Fish'),
  ('Vegetables'),
  ('Fruits'),
  ('Dairy & Eggs'),
  ('Oils & Fats'),
  ('Sauces, Sugar & Condiments'),
  ('Beverages'),
  ('Packaging & Disposables'),
  ('Cleaning & Fuel')
) as v(n)
where not exists (
  select 1 from public.categories c where c.data ->> 'name' = v.n
);

insert into public.products (data)
select jsonb_build_object(
         'name', p.name,
         'categoryId', c.id,
         'measureType', p.mtype,
         'reorderLevel', p.reorder,
         'quantity', 0
       )
from (values
  -- Rice & Grains (grams)
  ('Rice & Grains', 'Samba Rice',                          'mass', 25000),
  ('Rice & Grains', 'Nadu Rice',                           'mass', 25000),
  ('Rice & Grains', 'Keeri Samba Rice',                    'mass', 25000),
  ('Rice & Grains', 'Red Raw Rice (Kekulu)',               'mass', 10000),
  ('Rice & Grains', 'Basmati Rice',                        'mass', 10000),
  ('Rice & Grains', 'Dried Noodles',                       'mass', 5000),
  ('Rice & Grains', 'Pasta / Spaghetti',                   'mass', 5000),
  ('Rice & Grains', 'Bread Crumbs',                        'mass', 2000),

  -- Flour & Baking (grams)
  ('Flour & Baking', 'Wheat Flour',                        'mass', 25000),
  ('Flour & Baking', 'Rice Flour',                         'mass', 10000),
  ('Flour & Baking', 'Red Rice Flour',                     'mass', 5000),
  ('Flour & Baking', 'Kurakkan Flour',                     'mass', 3000),
  ('Flour & Baking', 'Semolina (Rawa)',                    'mass', 5000),
  ('Flour & Baking', 'Corn Flour',                         'mass', 3000),
  ('Flour & Baking', 'Baking Powder',                      'mass', 500),
  ('Flour & Baking', 'Baking Soda',                        'mass', 500),
  ('Flour & Baking', 'Yeast',                              'mass', 500),

  -- Lentils, Pulses & Nuts (grams)
  ('Lentils, Pulses & Nuts', 'Red Lentils (Parippu)',      'mass', 10000),
  ('Lentils, Pulses & Nuts', 'Chickpeas (Kadala)',         'mass', 5000),
  ('Lentils, Pulses & Nuts', 'Green Gram (Mung Ata)',      'mass', 5000),
  ('Lentils, Pulses & Nuts', 'Black Gram (Undu)',          'mass', 3000),
  ('Lentils, Pulses & Nuts', 'Cowpea (Latta)',             'mass', 3000),
  ('Lentils, Pulses & Nuts', 'Soya Meat',                  'mass', 2000),
  ('Lentils, Pulses & Nuts', 'Cashew Nuts (Cadju)',        'mass', 2000),
  ('Lentils, Pulses & Nuts', 'Peanuts (Kadala Pol)',       'mass', 3000),
  ('Lentils, Pulses & Nuts', 'Raisins (Sultana)',          'mass', 1000),

  -- Meat & Poultry (grams)
  ('Meat & Poultry', 'Chicken (Whole)',                    'mass', 20000),
  ('Meat & Poultry', 'Chicken Breast',                     'mass', 10000),
  ('Meat & Poultry', 'Chicken Thigh / Drumstick',          'mass', 10000),
  ('Meat & Poultry', 'Beef',                               'mass', 10000),
  ('Meat & Poultry', 'Mutton',                             'mass', 5000),
  ('Meat & Poultry', 'Pork',                               'mass', 5000),
  ('Meat & Poultry', 'Sausages',                           'mass', 3000),

  -- Seafood & Dried Fish (grams)
  ('Seafood & Dried Fish', 'Tuna (Balaya)',                'mass', 10000),
  ('Seafood & Dried Fish', 'Seer Fish (Thora)',            'mass', 5000),
  ('Seafood & Dried Fish', 'Prawns',                       'mass', 5000),
  ('Seafood & Dried Fish', 'Cuttlefish',                   'mass', 3000),
  ('Seafood & Dried Fish', 'Crab',                         'mass', 3000),
  ('Seafood & Dried Fish', 'Maldive Fish',                 'mass', 2000),
  ('Seafood & Dried Fish', 'Dried Sprats (Halmasso)',      'mass', 2000),
  ('Seafood & Dried Fish', 'Canned Fish (Mackerel)',       'mass', 5000),

  -- Vegetables (grams, except coconut = pieces)
  ('Vegetables', 'Red Onion (Rathu Lunu)',                 'mass', 20000),
  ('Vegetables', 'Big Onion',                              'mass', 20000),
  ('Vegetables', 'Garlic (Sudu Lunu)',                     'mass', 5000),
  ('Vegetables', 'Ginger (Inguru)',                        'mass', 3000),
  ('Vegetables', 'Green Chilli (Miris)',                   'mass', 3000),
  ('Vegetables', 'Tomato',                                 'mass', 10000),
  ('Vegetables', 'Potato',                                 'mass', 20000),
  ('Vegetables', 'Carrot',                                 'mass', 10000),
  ('Vegetables', 'Beans',                                  'mass', 5000),
  ('Vegetables', 'Cabbage',                                'mass', 10000),
  ('Vegetables', 'Leeks',                                  'mass', 3000),
  ('Vegetables', 'Brinjal (Wambatu)',                      'mass', 5000),
  ('Vegetables', 'Pumpkin (Wattakka)',                     'mass', 10000),
  ('Vegetables', 'Capsicum',                               'mass', 3000),
  ('Vegetables', 'Cucumber',                               'mass', 5000),
  ('Vegetables', 'Beetroot',                               'mass', 5000),
  ('Vegetables', 'Okra (Bandakka)',                        'mass', 5000),
  ('Vegetables', 'Drumstick (Murunga)',                    'mass', 3000),
  ('Vegetables', 'Bitter Gourd (Karawila)',                'mass', 3000),
  ('Vegetables', 'Raw Jackfruit (Polos)',                  'mass', 10000),
  ('Vegetables', 'Green Banana (Alu Kesel)',               'mass', 5000),
  ('Vegetables', 'Manioc (Mannioca)',                      'mass', 5000),
  ('Vegetables', 'Gotukola / Leafy Greens',                'mass', 2000),
  ('Vegetables', 'Lime (Dehi)',                            'mass', 2000),
  ('Vegetables', 'Coconut (Pol)',                          'count', 50),

  -- Fruits (grams)
  ('Fruits', 'Banana',                                     'mass', 5000),
  ('Fruits', 'Pineapple',                                  'mass', 5000),
  ('Fruits', 'Papaya',                                     'mass', 5000),
  ('Fruits', 'Watermelon',                                 'mass', 5000),
  ('Fruits', 'Mango',                                      'mass', 5000),
  ('Fruits', 'Avocado',                                    'mass', 2000),

  -- Dairy & Eggs
  ('Dairy & Eggs', 'Eggs',                                 'count', 120),
  ('Dairy & Eggs', 'Fresh Milk',                           'volume', 10000),
  ('Dairy & Eggs', 'Milk Powder',                          'mass', 5000),
  ('Dairy & Eggs', 'Curd (Meekiri)',                       'mass', 5000),
  ('Dairy & Eggs', 'Butter',                               'mass', 2000),
  ('Dairy & Eggs', 'Ghee',                                 'mass', 2000),
  ('Dairy & Eggs', 'Cheese',                               'mass', 2000),
  ('Dairy & Eggs', 'Fresh Cream',                          'volume', 3000),
  ('Dairy & Eggs', 'Coconut Milk',                         'volume', 10000),
  ('Dairy & Eggs', 'Coconut Milk Powder',                  'mass', 2000),

  -- Oils & Fats
  ('Oils & Fats', 'Coconut Oil',                           'volume', 20000),
  ('Oils & Fats', 'Vegetable Oil',                         'volume', 20000),
  ('Oils & Fats', 'Palm Oil (Frying)',                     'volume', 20000),
  ('Oils & Fats', 'Sesame Oil',                            'volume', 2000),
  ('Oils & Fats', 'Margarine',                             'mass', 3000),

  -- Sauces, Sugar & Condiments
  ('Sauces, Sugar & Condiments', 'White Sugar',            'mass', 10000),
  ('Sauces, Sugar & Condiments', 'Brown Sugar',            'mass', 3000),
  ('Sauces, Sugar & Condiments', 'Jaggery (Hakuru)',       'mass', 3000),
  ('Sauces, Sugar & Condiments', 'Kithul Treacle',         'volume', 3000),
  ('Sauces, Sugar & Condiments', 'Soy Sauce',              'volume', 3000),
  ('Sauces, Sugar & Condiments', 'Chilli Sauce',           'volume', 3000),
  ('Sauces, Sugar & Condiments', 'Tomato Sauce',           'volume', 5000),
  ('Sauces, Sugar & Condiments', 'Tomato Paste',           'mass', 3000),
  ('Sauces, Sugar & Condiments', 'Vinegar',                'volume', 5000),
  ('Sauces, Sugar & Condiments', 'Mayonnaise',             'mass', 3000),
  ('Sauces, Sugar & Condiments', 'Pickle (Achcharu)',      'mass', 2000),
  ('Sauces, Sugar & Condiments', 'Seeni Sambol Paste',     'mass', 2000),

  -- Beverages
  ('Beverages', 'Tea Leaves',                              'mass', 3000),
  ('Beverages', 'Coffee',                                  'mass', 1000),
  ('Beverages', 'Drinking Water Bottles',                  'count', 48),
  ('Beverages', 'Soft Drinks',                             'count', 48),
  ('Beverages', 'Fruit Juice',                             'volume', 10000),

  -- Packaging & Disposables (pieces)
  ('Packaging & Disposables', 'Lunch Packet Boxes',        'count', 500),
  ('Packaging & Disposables', 'Plastic Food Containers',   'count', 300),
  ('Packaging & Disposables', 'Banana Leaves',             'count', 200),
  ('Packaging & Disposables', 'Lunch Sheets / Paper',      'count', 500),
  ('Packaging & Disposables', 'Aluminium Foil Rolls',      'count', 5),
  ('Packaging & Disposables', 'Cling Wrap Rolls',          'count', 5),
  ('Packaging & Disposables', 'Disposable Plates',         'count', 500),
  ('Packaging & Disposables', 'Disposable Cups',           'count', 500),
  ('Packaging & Disposables', 'Disposable Spoons',         'count', 500),
  ('Packaging & Disposables', 'Tissue Paper Packs',        'count', 20),
  ('Packaging & Disposables', 'Polythene Bags',            'count', 500),
  ('Packaging & Disposables', 'Disposable Gloves (Box)',   'count', 5),

  -- Cleaning & Fuel
  ('Cleaning & Fuel', 'LP Gas Cylinders',                  'count', 2),
  ('Cleaning & Fuel', 'Firewood',                          'mass', 50000),
  ('Cleaning & Fuel', 'Charcoal',                          'mass', 10000),
  ('Cleaning & Fuel', 'Dish Wash Liquid',                  'volume', 5000),
  ('Cleaning & Fuel', 'Detergent Powder',                  'mass', 5000),
  ('Cleaning & Fuel', 'Bleach / Disinfectant',             'volume', 5000),
  ('Cleaning & Fuel', 'Garbage Bags',                      'count', 100)
) as p(cat, name, mtype, reorder)
join public.categories c on c.data ->> 'name' = p.cat
where not exists (
  select 1 from public.products x where lower(x.data ->> 'name') = lower(p.name)
);

notify pgrst, 'reload schema';
