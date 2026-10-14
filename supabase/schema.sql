-- 3 Lotus CRM — Supabase schema.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Role levels: CLIENT 1 < DELIVERY 2 < KITCHEN 3 < SALES 4 < MANAGER 5 < ADMIN 6 < DEVELOPER 7

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  role         text not null default 'CLIENT'
               check (role in ('CLIENT','DELIVERY','KITCHEN','SALES','MANAGER','ADMIN','DEVELOPER')),
  font_size    text,
  created_at   timestamptz not null default now()
);

create or replace function public.role_level()
returns int
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select case role
      when 'CLIENT' then 1 when 'DELIVERY' then 2 when 'KITCHEN' then 3
      when 'SALES' then 4 when 'MANAGER' then 5 when 'ADMIN' then 6
      when 'DEVELOPER' then 7 end
    from public.profiles where id = auth.uid()
  ), 0);
$$;

-- Every new auth user gets a profile. The very first user becomes DEVELOPER;
-- later users get the role set server-side via app_metadata (api/admin-users.js).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  assigned text;
begin
  if not exists (select 1 from public.profiles) then
    assigned := 'DEVELOPER';
  else
    assigned := coalesce(new.raw_app_meta_data ->> 'role', 'CLIENT');
  end if;

  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    assigned
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.role_level() >= 6);

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update
  using (public.role_level() >= 6);

-- Users can edit their own name / font size, but never their own role.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete
  using (public.role_level() >= 6);

-- --------------------------------------------------------- document tables
-- Each business collection is a table of JSON documents.
do $$
declare t text;
begin
  foreach t in array array[
    'products','categories','stock_transactions','notifications',
    'clients','orders','employees','finance'
  ] loop
    execute format($f$
      create table if not exists public.%I (
        id         uuid primary key default gen_random_uuid(),
        data       jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )$f$, t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- read / write minimum role level per table
-- products: read 2, write 3        categories: 3 / 3
-- stock_transactions: read 3, insert 3, update+delete 6
-- notifications: insert 3, everything else 6
-- clients: read 2, write 4         orders: 2 / 2
-- employees, finance: 5 / 5
do $$
declare
  r record;
begin
  for r in select * from (values
    ('products',           2, 3),
    ('categories',         3, 3),
    ('clients',            2, 4),
    ('orders',             2, 2),
    ('employees',          5, 5),
    ('finance',            5, 5)
  ) as v(tbl, read_lvl, write_lvl) loop
    execute format('drop policy if exists %I on public.%I', r.tbl || '_read', r.tbl);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_write', r.tbl);
    execute format('create policy %I on public.%I for select using (public.role_level() >= %s)',
                   r.tbl || '_read', r.tbl, r.read_lvl);
    execute format('create policy %I on public.%I for all using (public.role_level() >= %s) with check (public.role_level() >= %s)',
                   r.tbl || '_write', r.tbl, r.write_lvl, r.write_lvl);
  end loop;
end $$;

drop policy if exists stock_transactions_read on public.stock_transactions;
create policy stock_transactions_read on public.stock_transactions for select using (public.role_level() >= 3);
drop policy if exists stock_transactions_insert on public.stock_transactions;
create policy stock_transactions_insert on public.stock_transactions for insert with check (public.role_level() >= 3);
drop policy if exists stock_transactions_admin on public.stock_transactions;
create policy stock_transactions_admin on public.stock_transactions for all
  using (public.role_level() >= 6) with check (public.role_level() >= 6);

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check (public.role_level() >= 3);
drop policy if exists notifications_admin on public.notifications;
create policy notifications_admin on public.notifications for all
  using (public.role_level() >= 6) with check (public.role_level() >= 6);

-- Atomic partial update of a JSON document (runs with the caller's RLS).
create or replace function public.merge_doc(tbl text, doc_id uuid, patch jsonb)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if tbl not in ('products','categories','stock_transactions','notifications',
                 'clients','orders','employees','finance') then
    raise exception 'unknown table %', tbl;
  end if;
  execute format('update public.%I set data = data || $1 where id = $2', tbl)
    using patch, doc_id;
end;
$$;

grant execute on function public.merge_doc(text, uuid, jsonb) to authenticated;

-- ------------------------------------------------------ backfill (safe to re-run)
-- Accounts created before this script ran have no profile. The oldest one becomes
-- DEVELOPER (only when no profile exists yet); the rest become CLIENT.
insert into public.profiles (id, email, display_name, role)
select u.id,
       u.email,
       split_part(u.email, '@', 1),
       case when not exists (select 1 from public.profiles) and u.id = (select id from auth.users order by created_at limit 1)
            then 'DEVELOPER' else 'CLIENT' end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
order by u.created_at;

-- Make PostgREST pick up the new tables right away.
notify pgrst, 'reload schema';
