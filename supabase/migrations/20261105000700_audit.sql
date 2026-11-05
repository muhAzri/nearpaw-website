-- Append-only audit log.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_kind text not null check (actor_kind in ('admin','system')),
  actor_id text not null,
  action text not null,
  target text not null,
  reason text,
  metadata jsonb not null default '{}'
);
create index audit_at_idx on audit_log (at desc);

create function audit_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_immutable();
