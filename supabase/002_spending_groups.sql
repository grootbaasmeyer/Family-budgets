-- Spending groups for monthly budget lines, and JP snr's starting budget
alter table public.entries add column if not exists grp text not null default '';

insert into public.entries (budget_id, section, kind, grp, category, amount, created_by)
select b.id, 'plan', v.kind, v.grp, v.category, v.amount, null
from public.budgets b
cross join (values
  ('income',  '',                  'Income',                    101650),
  ('expense', 'Day-to-day',        'Clothing',                     500),
  ('expense', 'Day-to-day',        'Eating Out & Takeaways',      1000),
  ('expense', 'Day-to-day',        'Entertainment',                500),
  ('expense', 'Day-to-day',        'General Purchases',           1000),
  ('expense', 'Day-to-day',        'Groceries',                   8000),
  ('expense', 'Day-to-day',        'Home & Garden',                300),
  ('expense', 'Day-to-day',        'Medical',                      500),
  ('expense', 'Day-to-day',        'Personal Care',                500),
  ('expense', 'Day-to-day',        'Transport & Fuel',            3000),
  ('expense', 'Recurring',         'Anita (Nuwe woonstel)',       3000),
  ('expense', 'Recurring',         'Anita (Huis)',                5000),
  ('expense', 'Recurring',         'Children',                    2000),
  ('expense', 'Recurring',         'Domestic workers',             680),
  ('expense', 'Recurring',         'Entertainment',                180),
  ('expense', 'Recurring',         'Home & Garden',                150),
  ('expense', 'Recurring',         'Home Utility & Service',      1000),
  ('expense', 'Recurring',         'Interest',                     500),
  ('expense', 'Recurring',         'Medical',                    10515),
  ('expense', 'Recurring',         'Other Insurance',                0),
  ('expense', 'Recurring',         'Pets',                        1500),
  ('expense', 'Recurring',         'Policies',                    1500),
  ('expense', 'Recurring',         'Professional Services',        160),
  ('expense', 'Invest-save-repay', 'Interest',                       0),
  ('expense', 'Invest-save-repay', 'Investments',                 2000),
  ('expense', 'Invest-save-repay', 'Nuwe Woonstel',               8354),
  ('expense', 'Invest-save-repay', 'Other Savings',               5000),
  ('expense', 'Invest-save-repay', 'Woonstel nr 2',               8845),
  ('expense', 'Bank Fees',         'Bank Charges',                1000),
  ('expense', 'Communications',    'Cellphone',                   2850),
  ('expense', 'Communications',    'Other Phone & Internet',      1400)
) as v(kind, grp, category, amount)
where b.slug = 'jp-snr'
  and not exists (select 1 from public.entries e where e.budget_id = b.id and e.section = 'plan');

select grp, count(*), sum(amount) from public.entries e join public.budgets b on b.id = e.budget_id
where b.slug = 'jp-snr' and section = 'plan' group by grp order by grp;
