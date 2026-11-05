-- Regions, app config, ad placements.

create table regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'inactive' check (status in ('active','inactive')),
  languages text[] not null default '{}' check (languages <@ array['en','id']),
  default_expiry_days int not null default 7 check (default_expiry_days between 1 and 60),
  support_contact text,
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  radius_km double precision not null check (radius_km between 1 and 200),
  updated_at timestamptz not null default now(),
  -- a region can go live only with a support contact and a language
  constraint region_activatable check (status = 'inactive' or (support_contact is not null and cardinality(languages) > 0))
);

create table app_config (
  id boolean primary key default true check (id), -- singleton row
  feature_flags jsonb not null default '{"communityUpdates":true,"nearbyAlerts":true,"listAds":true,"impactBannerAd":true}',
  safety_limits jsonb not null default '{"autoHideAfterFlags":3,"reportsPerUserPerHour":3,"updatesPerUserPerHour":6,"minimumAppVersion":"1.0.0"}'
);
insert into app_config default values;

create table ad_placement_regions (
  placement_id text not null,
  region_id uuid not null references regions(id) on delete cascade,
  primary key (placement_id, region_id)
);
