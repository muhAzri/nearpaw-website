-- Rate limits and login lockouts live in Postgres too, so every API instance sees the same counters.

create table rate_limit_hits (
  key text not null,
  at timestamptz not null default now()
);
create index rate_limit_hits_key_idx on rate_limit_hits (key, at);

-- Counts one attempt. Returns true when it is allowed, false when `max_hits` already happened inside the window.
-- The per-key advisory lock keeps two concurrent requests from both slipping under the limit.
create function rate_limit_hit(p_key text, p_max_hits int, p_window_seconds int) returns boolean
language plpgsql
as $$
declare
  hits int;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  delete from rate_limit_hits where key = p_key and at < now() - make_interval(secs => p_window_seconds);
  select count(*) into hits from rate_limit_hits where key = p_key;
  if hits >= p_max_hits then
    return false;
  end if;
  insert into rate_limit_hits (key) values (p_key);
  return true;
end $$;

revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, int, int) to service_role;

-- Housekeeping for keys that are never used again (run from a scheduled job):
--   delete from rate_limit_hits where at < now() - interval '1 day';

create table login_attempts (
  key text primary key,
  failures int not null default 0,
  locked_until timestamptz
);

alter table rate_limit_hits enable row level security;
alter table login_attempts enable row level security;
