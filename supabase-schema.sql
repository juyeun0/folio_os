-- Run once in Supabase Dashboard → SQL Editor → New query.
-- Every account can sign up, and each authenticated account can only
-- read/write its own complete Folio snapshot.
create table if not exists public.folio_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Private username-to-email map. The Vercel API reads it with the server-only
-- service role key so the browser never needs to expose email addresses.
create table if not exists public.folio_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9._-]{3,24}$'),
  email text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists folio_profiles_username_unique on public.folio_profiles (username);
alter table public.folio_profiles enable row level security;

-- Remove the earlier optional single-owner gate, if the previous draft was run.
drop table if exists public.folio_owner_allowlist;

create or replace function public.handle_new_folio_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.folio_profiles (user_id, username, email)
  values (new.id, lower(new.raw_user_meta_data ->> 'username'), new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_folio_profile on auth.users;
create trigger on_auth_user_created_folio_profile
  after insert on auth.users
  for each row execute function public.handle_new_folio_user();

revoke all on function public.handle_new_folio_user() from public, anon, authenticated;
revoke all on table public.folio_profiles from anon, authenticated;

alter table public.folio_data enable row level security;

revoke all on table public.folio_data from anon;
grant select, insert, update, delete on table public.folio_data to authenticated;

drop policy if exists "Users can access their own Folio data" on public.folio_data;
create policy "Users can access their own Folio data"
  on public.folio_data
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Enable cross-device live sync over Supabase Realtime.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'folio_data'
  ) then
    execute 'alter publication supabase_realtime add table public.folio_data';
  end if;
end
$$;
