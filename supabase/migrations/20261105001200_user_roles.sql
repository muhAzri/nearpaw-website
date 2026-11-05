-- Admins use the same Supabase account as everyone else; the console checks this role after sign-in.
-- Promote an account with: update users set role = 'admin' where email = 'name@example.com';

alter table users
  add column role text not null default 'user' check (role in ('user','admin'));
