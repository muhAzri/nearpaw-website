-- Support messages and privacy requests.

create table support_messages (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  topic text not null check (topic in ('content_abuse','bug','privacy','press','other')),
  email text not null,
  language text not null default 'en' check (language in ('en','id')),
  message text not null check (char_length(message) between 10 and 2000),
  report_ref text,
  status text not null default 'new' check (status in ('new','assigned','resolved')),
  assignee text,
  escalated boolean not null default false,
  replies jsonb not null default '[]',
  notes jsonb not null default '[]',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index support_status_idx on support_messages (status, created_at desc);

create table privacy_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  type text not null check (type in ('access','deletion','correction','other')),
  email text not null,
  account_identifier text,
  details text not null,
  status text not null default 'received' check (status in ('received','verifying','completed','rejected')),
  email_matches_account boolean not null default false,
  extra_proof_received boolean not null default false,
  notes jsonb not null default '[]',
  created_at timestamptz not null default now(),
  due_at timestamptz not null default now() + interval '30 days',
  completed_at timestamptz,
  constraint privacy_complete_needs_verified check (status <> 'completed' or email_matches_account)
);
create index privacy_due_idx on privacy_requests (status, due_at);
