-- Seed: launch regions from the design.

insert into regions (name, status, languages, support_contact, center_lat, center_lng, radius_km) values
  ('South Jakarta', 'active',   '{en,id}', 'Admin', -6.2615, 106.8106, 20),
  ('Bandung',       'active',   '{en,id}', 'Admin', -6.9175, 107.6191, 20),
  ('Surabaya',      'inactive', '{en,id}', null,    -7.2575, 112.7521, 20);
