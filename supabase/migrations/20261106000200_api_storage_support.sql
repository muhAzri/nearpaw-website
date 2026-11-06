-- Support for the API's Postgres repositories.

-- Flag numbers are drawn by the API before the row is saved (like user public numbers), so the identity column becomes
-- a plain sequence the secret key can call.
alter table flags alter column number drop identity if exists;
create sequence if not exists flag_number_seq start 201;
select setval('flag_number_seq', greatest(coalesce((select max(number) from flags), 0), 200));

create or replace function next_flag_number() returns bigint
language sql
as $$ select nextval('flag_number_seq') $$;

revoke all on function next_flag_number() from public, anon, authenticated;
grant execute on function next_flag_number() to service_role;

-- "Most urgent first" needs a sortable rank (the text values do not sort in urgency order).
alter table reports
  add column if not exists urgency_rank smallint
  generated always as (case urgency when 'high' then 2 when 'medium' then 1 else 0 end) stored;
create index if not exists reports_urgency_idx on reports (urgency_rank desc, created_at desc);
