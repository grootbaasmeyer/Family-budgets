# Meyer Budgets

One web app with four budgets: **JP snr (Family)**, **Madine**, **Miané** and **JP jnr**.

- JP snr and Madine (parents) can open all four budgets.
- Miané and JP jnr only ever see their own budget. This is enforced in the database with Supabase row level security, not just hidden in the app.
- Family / adult budgets: Overview, Monthly budget (planned income and expenses), Daily spending (compared with the plan per category), Assets, Savings.
- Kids' budgets: Overview, Income, Expenses, Savings.
- Amounts in South African rand (R).

Stack: Vite + React + TypeScript, Supabase (auth + Postgres), hosted on Vercel.

Live site: deployed from `main` on Vercel (project `family-budgets`).

## Setup

1. In the Supabase project, open **SQL editor** and run `supabase/schema.sql`.
2. Put the four real email addresses in `supabase/members.sql` and run it.
3. Optional, recommended: **Authentication → Hooks → Before user created** → Postgres function `public.check_allowed_signup`. This stops anyone else from creating an account.
4. **Authentication → URL configuration**: set Site URL to the Vercel address.
5. On Vercel, import this repo and add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase → Project settings → API).

## Logging in the first time

Each person opens the site, taps **First time? Create account**, and uses their own email and a password they choose. Their email decides which budget they get. An email that is not on the list gets no access.

To change who sees what, edit the `allowed_members` table and re-run the second half of `members.sql`.

## Local development

```
cp .env.example .env.local   # fill in values
npm install
npm run dev
```
