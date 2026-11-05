-- Users and blocks.

create sequence user_public_number_seq start 1001;

create table users (
  id uuid primary key default gen_random_uuid(),
  public_number int not null unique default nextval('user_public_number_seq'),
  apple_sub text unique,
  display_name text not null default 'Community member',
  email text,
  status text not null default 'active' check (status in ('active','restricted','suspended','banned','deleted')),
  warnings int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  tombstone_id text
);

create table user_blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on user_blocks (blocked_id);
