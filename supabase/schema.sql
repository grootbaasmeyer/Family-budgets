-- Family Budgets: schema + row level security
-- Run once in the Supabase SQL editor (or via migration).

create extension if not exists pgcrypto;

-- One row per budget
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,          -- 'jp-snr', 'madine', 'miane', 'jp-jnr'
  name text not null,
  kind text not null check (kind in ('family','personal','kid')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Who is allowed to use the app, and what they can see.
-- Edit this table to change logins. Nobody else gets access.
create table if not exists public.allowed_members (
  email text primary key,
  display_name text not null,
  role text not null check (role in ('parent','child')),
  budget_slug text not null references public.budgets(slug)
);

-- Profile linked to a Supabase auth user
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null check (role in ('parent','child')),
  budget_id uuid not null references public.budgets(id),
  created_at timestamptz not null default now()
);

-- All money lines.
-- section: family/personal -> 'plan' (monthly budget lines), 'daily' (day-to-day spending),
--          'asset', 'savings'
--          kid -> 'income', 'expense', 'savings'
-- kind: 'income' or 'expense' for plan lines; 'deposit'/'withdrawal' for savings
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  section text not null check (section in ('plan','daily','asset','savings','income','expense')),
  kind text check (kind in ('income','expense','deposit','withdrawal')),
  category text not null default 'Other',
  description text not null default '',
  amount numeric(14,2) not null check (amount >= 0),
  entry_date date not null default current_date,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists entries_budget_section_idx on public.entries(budget_id, section, entry_date);

-- Helpers (security definer so policies don't recurse through profiles RLS)
create or replace function public.is_parent() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'parent');
$$;

create or replace function public.can_access_budget(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.role = 'parent' or p.budget_id = bid)
  );
$$;

-- Link new sign-ups to their budget, only if their email is on the allowed list
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.allowed_members%rowtype;
begin
  select * into m from public.allowed_members where lower(email) = lower(new.email);
  if found then
    insert into public.profiles (id, email, display_name, role, budget_id)
    select new.id, new.email, m.display_name, m.role, b.id
    from public.budgets b where b.slug = m.budget_slug
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Optional: block sign-ups from emails not on the list
create or replace function public.check_allowed_signup(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.allowed_members where lower(email) = lower(event->'user'->>'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'This email is not part of the family budget.'));
end;
$$;
grant execute on function public.check_allowed_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.check_allowed_signup(jsonb) from authenticated, anon, public;
grant select on public.allowed_members to supabase_auth_admin;

-- Row level security
alter table public.budgets enable row level security;
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.allowed_members enable row level security;  -- no policies: invisible to app users

drop policy if exists "budgets readable by members" on public.budgets;
create policy "budgets readable by members" on public.budgets
  for select to authenticated using (public.can_access_budget(id));

drop policy if exists "own profile or parent" on public.profiles;
create policy "own profile or parent" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_parent());

drop policy if exists "entries select" on public.entries;
drop policy if exists "entries insert" on public.entries;
drop policy if exists "entries update" on public.entries;
drop policy if exists "entries delete" on public.entries;
create policy "entries select" on public.entries for select to authenticated
  using (public.can_access_budget(budget_id));
create policy "entries insert" on public.entries for insert to authenticated
  with check (public.can_access_budget(budget_id));
create policy "entries update" on public.entries for update to authenticated
  using (public.can_access_budget(budget_id)) with check (public.can_access_budget(budget_id));
create policy "entries delete" on public.entries for delete to authenticated
  using (public.can_access_budget(budget_id));

-- Seed the four budgets
insert into public.budgets (slug, name, kind, sort_order) values
  ('jp-snr', 'JP snr (Family)', 'family', 1),
  ('madine', 'Madine', 'personal', 2),
  ('miane',  'Miané', 'kid', 3),
  ('jp-jnr', 'JP jnr', 'kid', 4)
on conflict (slug) do nothing;
