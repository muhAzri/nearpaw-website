-- The API assigns a user's public number before it saves the row, so it needs to draw from the sequence on its own.
-- Callable only with the secret key (service_role); the publishable key can't run it.

create function next_user_public_number() returns int
language sql
as $$ select nextval('user_public_number_seq')::int $$;

revoke all on function next_user_public_number() from public, anon, authenticated;
grant execute on function next_user_public_number() to service_role;
