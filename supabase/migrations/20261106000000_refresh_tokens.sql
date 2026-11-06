-- Refresh tokens for the app. The token itself is never stored, only its SHA-256.
-- Each sign-in starts a family; every refresh rotates the token inside it. Reusing a rotated token revokes the family.

create table refresh_tokens (
  hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid not null,
  family_started_at timestamptz not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason in ('rotated','signed_out','reuse','account_closed'))
);

create index refresh_tokens_family_idx on refresh_tokens (family_id);
create index refresh_tokens_user_idx on refresh_tokens (user_id);
-- Expired rows can be deleted by a scheduled job: delete from refresh_tokens where expires_at < now() - interval '7 days';
create index refresh_tokens_expires_idx on refresh_tokens (expires_at);

-- Same stance as the other tables: RLS on, no policies; only the server (secret key) reads or writes.
alter table refresh_tokens enable row level security;
