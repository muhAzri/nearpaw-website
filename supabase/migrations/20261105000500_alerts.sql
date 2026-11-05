-- Alert settings, feed and devices.

create table alert_settings (
  user_id uuid primary key references users(id) on delete cascade,
  enabled boolean not null default false,
  area_label text,
  area_lat double precision,
  area_lng double precision,
  radius_km int not null default 5 check (radius_km in (2,5,10,25)),
  animals text[] not null default '{}',
  check (not enabled or area_label is not null)
);

create table alert_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  report_ref text not null,
  title text not null,
  urgency text not null,
  location_label text,
  distance_km double precision not null,
  read boolean not null default false,
  delivery text not null check (delivery in ('sent','failed','skipped')),
  created_at timestamptz not null default now()
);
create index alert_items_user_idx on alert_items (user_id, created_at desc);

create table devices (
  user_id uuid not null references users(id) on delete cascade,
  token text not null,
  platform text not null default 'ios',
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);
