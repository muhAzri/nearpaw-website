-- Reports, community updates, flags.

create table reports (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique check (ref ~ '^RPT-[A-Z0-9]{6}$'),
  reporter_id uuid not null references users(id),
  animal text not null check (animal in ('cat','dog','wildlife','other')),
  condition text not null check (condition in ('injured','sick','abandoned','trapped','suspected_abuse','other')),
  urgency text not null check (urgency in ('low','medium','high')),
  description text not null check (char_length(description) between 5 and 500),
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location_label text,
  region_id uuid not null references regions(id),
  region_name text not null,
  language text not null default 'en' check (language in ('en','id')),
  state text not null default 'live' check (state in ('live','hidden','closed','expired','removed')),
  hidden_by text check (hidden_by in ('auto','admin','owner')),
  moderation_reason text,
  duplicate_of_ref text,
  open_flags int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  closed_at timestamptz
);
create index reports_reporter_idx on reports (reporter_id, created_at desc);
create index reports_feed_idx on reports (state, created_at desc);
create index reports_geo_idx on reports (lat, lng);
create index reports_region_idx on reports (region_id);

create table community_updates (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  report_id uuid not null references reports(id) on delete cascade,
  report_ref text not null,
  author_id uuid not null references users(id),
  type text not null check (type in ('still_there','not_found','condition_changed','possibly_helped')),
  note text check (char_length(note) <= 140),
  photos text[] not null default '{}' check (cardinality(photos) <= 1),
  state text not null default 'live' check (state in ('live','hidden')),
  hidden_by text check (hidden_by in ('auto','admin','owner')),
  open_flags int not null default 0,
  created_at timestamptz not null default now()
);
create index updates_report_idx on community_updates (report_id, created_at desc);
create index updates_author_idx on community_updates (author_id, created_at desc);

create table flags (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 201) unique,
  target_type text not null check (target_type in ('report','update','user')),
  target_id uuid not null,
  target_ref text not null,
  flagger_id uuid not null references users(id),
  reason text not null check (reason in ('inaccurate','duplicate','abusive','graphic','spam','private_info','other')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','resolved')),
  outcome text check (outcome in ('none','hide','warn','restrict')),
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (flagger_id, target_type, target_id) -- one flag per person per target
);
create index flags_open_idx on flags (status, created_at);
create index flags_target_idx on flags (target_type, target_id);
