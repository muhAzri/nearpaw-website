-- Sign in with Apple is replaced by Supabase Auth (email + password).
-- users.id is the auth.users id of the account; the row is created on first sign-in.

alter table users drop column apple_sub;
