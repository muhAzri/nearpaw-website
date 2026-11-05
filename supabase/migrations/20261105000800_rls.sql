-- Lock everything down. Access is server-only (Supabase secret key, which bypasses RLS):
-- RLS on with NO policies means the anon/publishable key can read/write nothing.
-- Any table added in a later migration must also enable RLS.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
