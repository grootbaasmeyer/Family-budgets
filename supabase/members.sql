-- Fill in the real email addresses, then run.
insert into public.allowed_members (email, display_name, role, budget_slug) values
  ('JP_SNR_EMAIL',  'JP snr', 'parent', 'jp-snr'),
  ('MADINE_EMAIL',  'Madine', 'parent', 'madine'),
  ('MIANE_EMAIL',   'Miané',  'child',  'miane'),
  ('JP_JNR_EMAIL',  'JP jnr', 'child',  'jp-jnr')
on conflict (email) do update set display_name = excluded.display_name,
  role = excluded.role, budget_slug = excluded.budget_slug;

-- Link anyone who already signed up before being added to the list
insert into public.profiles (id, email, display_name, role, budget_id)
select u.id, u.email, m.display_name, m.role, b.id
from auth.users u
join public.allowed_members m on lower(m.email) = lower(u.email)
join public.budgets b on b.slug = m.budget_slug
on conflict (id) do update set role = excluded.role, budget_id = excluded.budget_id,
  display_name = excluded.display_name;
