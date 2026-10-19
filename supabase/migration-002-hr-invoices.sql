-- 3 Lotus CRM - migration 002: attendance, payroll, invoices, company settings, letters.
-- Run once in the Supabase SQL Editor (after schema.sql). Plain ASCII on purpose.
-- Minimum role level: CLIENT 1, DELIVERY 2, KITCHEN 3, SALES 4, MANAGER 5, ADMIN 6, DEVELOPER 7.

do $$
declare t text;
begin
  foreach t in array array['attendance','payroll','invoices','settings','letterheads'] loop
    execute format($f$
      create table if not exists public.%I (
        id         uuid primary key default gen_random_uuid(),
        data       jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )$f$, t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- attendance, payroll: managers and above
create policy attendance_read  on public.attendance for select using (public.role_level() >= 5);
create policy attendance_write on public.attendance for all
  using (public.role_level() >= 5) with check (public.role_level() >= 5);

create policy payroll_read  on public.payroll for select using (public.role_level() >= 5);
create policy payroll_write on public.payroll for all
  using (public.role_level() >= 5) with check (public.role_level() >= 5);

-- invoices, letters: sales and above
create policy invoices_read  on public.invoices for select using (public.role_level() >= 4);
create policy invoices_write on public.invoices for all
  using (public.role_level() >= 4) with check (public.role_level() >= 4);

create policy letterheads_read  on public.letterheads for select using (public.role_level() >= 4);
create policy letterheads_write on public.letterheads for all
  using (public.role_level() >= 4) with check (public.role_level() >= 4);

-- company settings: sales can read (used on invoices), managers can edit
create policy settings_read  on public.settings for select using (public.role_level() >= 4);
create policy settings_write on public.settings for all
  using (public.role_level() >= 5) with check (public.role_level() >= 5);

-- allow partial updates on the new tables
create or replace function public.merge_doc(tbl text, doc_id uuid, patch jsonb)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if tbl not in ('products','categories','stock_transactions','notifications',
                 'clients','orders','employees','finance',
                 'attendance','payroll','invoices','settings','letterheads') then
    raise exception 'unknown table %', tbl;
  end if;
  execute format('update public.%I set data = data || $1 where id = $2', tbl)
    using patch, doc_id;
end;
$$;

grant execute on function public.merge_doc(text, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
