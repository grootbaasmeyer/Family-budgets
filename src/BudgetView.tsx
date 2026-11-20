import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, money, thisMonth, type Budget, type Entry, type Section } from './supabase'
import EntryList, { DEFAULT_GROUPS, type ListConfig } from './EntryList'
import type { Opt } from './CategoryPicker'
import MonthNav, { monthName } from './MonthNav'

const EXPENSE_CATS = ['Groceries', 'Housing', 'Transport', 'Fuel', 'Utilities', 'Insurance', 'Medical', 'School', 'Entertainment', 'Eating out', 'Clothing', 'Subscriptions', 'Debt', 'Gifts', 'Other']
const INCOME_CATS = ['Salary', 'Business', 'Interest', 'Other income']
const ASSET_CATS = ['Property', 'Vehicle', 'Investments', 'Retirement', 'Cash', 'Equipment', 'Other']
const SAVINGS_CATS = ['Emergency fund', 'Holiday', 'Education', 'Tax-free savings', 'Other']
const KID_INCOME_CATS = ['Pocket money', 'Chores', 'Gift', 'Job', 'Other']
const KID_EXPENSE_CATS = ['Snacks', 'Clothes', 'Games', 'Outings', 'Airtime / data', 'Gifts', 'School', 'Other']
const KID_SAVINGS_CATS = ['Savings', 'Saving for something', 'Other']

type Tab = { key: string; label: string; section?: Section }

const ADULT_TABS: Tab[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'plan', label: 'Monthly budget', section: 'plan' },
  { key: 'daily', label: 'Daily spending', section: 'daily' },
  { key: 'asset', label: 'Assets', section: 'asset' },
  { key: 'savings', label: 'Savings', section: 'savings' },
]
const KID_TABS: Tab[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'income', label: 'Income', section: 'income' },
  { key: 'expense', label: 'Expenses', section: 'expense' },
  { key: 'savings', label: 'Savings', section: 'savings' },
]

function configFor(section: Section, kid: boolean): ListConfig {
  switch (section) {
    case 'plan': return { title: 'Monthly budget', hint: 'Planned income and expenses for the month. Each month can have its own budget.', kinds: ['expense', 'income'], categories: { expense: EXPENSE_CATS, income: INCOME_CATS }, showDate: false, monthFilter: true, grouped: true }
    case 'daily': return { title: 'Daily spending', hint: 'Log what you actually spend. It is compared with the monthly budget.', categories: { _: EXPENSE_CATS }, showDate: true, monthFilter: true }
    case 'asset': return { title: 'Assets', hint: 'What you own and its current value.', categories: { _: ASSET_CATS }, showDate: true, monthFilter: false, amountLabel: 'Value', dateLabel: 'Valued on' }
    case 'savings': return kid
      ? { title: 'Savings', hint: 'Money put away, or taken out of savings.', kinds: ['deposit', 'withdrawal'], categories: { deposit: KID_SAVINGS_CATS, withdrawal: KID_SAVINGS_CATS }, showDate: true, monthFilter: false }
      : { title: 'Savings', hint: 'Deposits and withdrawals per savings pot.', kinds: ['deposit', 'withdrawal'], categories: { deposit: SAVINGS_CATS, withdrawal: SAVINGS_CATS }, showDate: true, monthFilter: false }
    case 'income': return { title: 'Income', hint: 'Money you received.', categories: { _: KID_INCOME_CATS }, showDate: true, monthFilter: true }
    case 'expense': return { title: 'Expenses', hint: 'Money you spent.', categories: { _: KID_EXPENSE_CATS }, showDate: true, monthFilter: true }
  }
}

export default function BudgetView({ budget }: { budget: Budget }) {
  const kid = budget.kind === 'kid'
  const tabs = kid ? KID_TABS : ADULT_TABS
  const [tab, setTab] = useState('overview')
  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState('')
  const [month, setMonth] = useState(thisMonth())

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('entries').select('*').eq('budget_id', budget.id)
      .order('entry_date', { ascending: false }).order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setEntries((data ?? []).map(e => ({ ...e, amount: Number(e.amount) })) as Entry[])
  }, [budget.id])

  useEffect(() => { load() }, [load])

  const current = tabs.find(t => t.key === tab)!
  const plan = useMemo(() => effectivePlan(entries, month), [entries, month])
  const planOpts: Opt[] = useMemo(() => {
    const order = (g: string) => { const i = DEFAULT_GROUPS.indexOf(g); return i < 0 ? 99 : i }
    const seen = new Set<string>()
    return plan.lines.filter(e => e.kind === 'expense')
      .map(e => ({ group: e.grp || 'Other', name: e.category }))
      .filter(o => !seen.has(o.group + '|' + o.name) && seen.add(o.group + '|' + o.name))
      .sort((a, b) => order(a.group) - order(b.group) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
  }, [plan])

  async function copyPlan() {
    const rows = plan.lines.map(e => ({ budget_id: budget.id, section: 'plan', kind: e.kind, grp: e.grp, category: e.category, description: e.description, amount: e.amount, entry_date: `${month}-01` }))
    const { error } = await supabase.from('entries').insert(rows)
    if (error) setError(error.message); else await load()
  }

  return (
    <div>
      <h1 className="title">{budget.name}</h1>
      <div className="tabs">
        {tabs.map(t => <button key={t.key} className={t.key === tab ? 'tab active' : 'tab'} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>
      {error && <p className="error">{error}</p>}
      {current.section
        ? <EntryList budgetId={budget.id} section={current.section} config={configFor(current.section, kid)}
            entries={current.section === 'plan' ? plan.lines : entries.filter(e => e.section === current.section)} month={month} setMonth={setMonth} reload={load}
            planFrom={current.section === 'plan' ? plan.from : undefined} onCopyPlan={copyPlan}
            planOpts={current.section === 'daily' && planOpts.length ? planOpts : undefined} />
        : kid ? <KidOverview entries={entries} month={month} setMonth={setMonth} />
              : <AdultOverview entries={entries} plan={plan} month={month} setMonth={setMonth} />}
    </div>
  )
}

function sum(list: Entry[]) { return list.reduce((s, e) => s + e.amount, 0) }
function savingsBalance(list: Entry[]) {
  return list.filter(e => e.section === 'savings').reduce((s, e) => s + (e.kind === 'withdrawal' ? -e.amount : e.amount), 0)
}

// Each month has its own budget lines (dated the 1st of that month). A month without
// its own lines uses the most recent earlier month's budget until it is copied.
export interface PlanView { lines: Entry[]; from: string | null; own: boolean }
function effectivePlan(entries: Entry[], month: string): PlanView {
  const all = entries.filter(e => e.section === 'plan')
  const own = all.filter(e => e.entry_date.startsWith(month))
  if (own.length) return { lines: own, from: month, own: true }
  const earlier = [...new Set(all.map(e => e.entry_date.slice(0, 7)))].filter(m => m < month).sort()
  const from = earlier.length ? earlier[earlier.length - 1] : null
  return { lines: from ? all.filter(e => e.entry_date.startsWith(from)) : [], from, own: false }
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'bad' }) {
  return <div className={`stat ${tone ?? ''}`}><div className="muted small">{label}</div><div className="big">{money(value)}</div></div>
}

function AdultOverview({ entries, plan: pv, month, setMonth }: { entries: Entry[]; plan: PlanView; month: string; setMonth: (m: string) => void }) {
  const plan = pv.lines
  const plannedIncome = sum(plan.filter(e => e.kind === 'income'))
  const plannedExpense = sum(plan.filter(e => e.kind === 'expense'))
  const spent = entries.filter(e => e.section === 'daily' && e.entry_date.startsWith(month))
  const spentTotal = sum(spent)
  const assets = sum(entries.filter(e => e.section === 'asset'))
  const savings = savingsBalance(entries)

  const rows = useMemo(() => {
    const order = (g: string) => { const i = DEFAULT_GROUPS.indexOf(g); return i < 0 ? 99 : i }
    const cats = new Map<string, { group: string; cat: string; planned: number; actual: number }>()
    const get = (g: string, c: string) => { const kk = g + '|' + c; let r = cats.get(kk); if (!r) { r = { group: g, cat: c, planned: 0, actual: 0 }; cats.set(kk, r) } return r }
    plan.filter(e => e.kind === 'expense').forEach(e => { get(e.grp || 'Other', e.category).planned += e.amount })
    spent.forEach(e => { get(e.grp || 'Other', e.category).actual += e.amount })
    const list = [...cats.values()].sort((a, b) => order(a.group) - order(b.group) || a.group.localeCompare(b.group) || b.planned - a.planned)
    const out: { head?: string; group: string; cat: string; planned: number; actual: number }[] = []
    list.forEach((r, i) => {
      if (i === 0 || list[i - 1].group !== r.group) {
        const g = list.filter(x => x.group === r.group)
        out.push({ head: r.group, group: r.group, cat: '', planned: g.reduce((t, x) => t + x.planned, 0), actual: g.reduce((t, x) => t + x.actual, 0) })
      }
      out.push(r)
    })
    return out
  }, [plan, spent])

  return (
    <div>
      <div className="row between"><h2>Month at a glance</h2><MonthNav month={month} setMonth={setMonth} /></div>
      {!pv.own && <p className="muted small">{pv.from ? `No budget set for ${monthName(month)} yet, so this uses ${monthName(pv.from)}'s budget.` : `No budget set for ${monthName(month)}.`}</p>}
      <div className="stats">
        <Stat label="Planned income" value={plannedIncome} />
        <Stat label="Planned expenses" value={plannedExpense} />
        <Stat label="Spent" value={spentTotal} />
        <Stat label="Left of budget" value={plannedExpense - spentTotal} tone={plannedExpense - spentTotal < 0 ? 'bad' : 'good'} />
        <Stat label="Planned surplus" value={plannedIncome - plannedExpense} tone={plannedIncome - plannedExpense < 0 ? 'bad' : 'good'} />
      </div>
      <h2>Budget vs spending by category</h2>
      {rows.length === 0 ? <p className="muted">Add lines under Monthly budget and Daily spending to see this.</p> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Category</th><th className="num">Budget</th><th className="num">Spent</th><th className="num">Left</th><th></th></tr></thead>
            <tbody>{rows.map(r => {
              const pct = r.planned ? Math.min(100, (r.actual / r.planned) * 100) : r.actual ? 100 : 0
              const over = r.actual > r.planned
              const bar = <td className="barcell"><div className="bar"><div className={over ? 'fill over' : 'fill'} style={{ width: `${pct}%` }} /></div></td>
              return r.head
                ? <tr key={'h' + r.head} className="group-row"><td>{r.head}</td><td className="num">{money(r.planned)}</td><td className="num">{money(r.actual)}</td>
                    <td className={`num ${over ? 'neg' : ''}`}>{money(r.planned - r.actual)}</td>{bar}</tr>
                : <tr key={r.group + '|' + r.cat}><td className="indent-cell">{r.cat}</td><td className="num">{money(r.planned)}</td><td className="num">{money(r.actual)}</td>
                    <td className={`num ${over ? 'neg' : ''}`}>{money(r.planned - r.actual)}</td>{bar}</tr>
            })}</tbody>
          </table>
        </div>
      )}
      <h2>Assets and savings</h2>
      <div className="stats">
        <Stat label="Total assets" value={assets} />
        <Stat label="Savings balance" value={savings} />
        <Stat label="Net worth (assets + savings)" value={assets + savings} />
      </div>
    </div>
  )
}

function KidOverview({ entries, month, setMonth }: { entries: Entry[]; month: string; setMonth: (m: string) => void }) {
  const inM = (e: Entry) => e.entry_date.startsWith(month)
  const income = sum(entries.filter(e => e.section === 'income' && inM(e)))
  const expense = sum(entries.filter(e => e.section === 'expense' && inM(e)))
  const savedThisMonth = entries.filter(e => e.section === 'savings' && inM(e)).reduce((s, e) => s + (e.kind === 'withdrawal' ? -e.amount : e.amount), 0)
  const allIn = sum(entries.filter(e => e.section === 'income'))
  const allOut = sum(entries.filter(e => e.section === 'expense'))
  const savings = savingsBalance(entries)
  return (
    <div>
      <div className="row between"><h2>Month</h2><MonthNav month={month} setMonth={setMonth} /></div>
      <div className="stats">
        <Stat label="Income" value={income} />
        <Stat label="Expenses" value={expense} />
        <Stat label="Put into savings" value={savedThisMonth} />
        <Stat label="Left over" value={income - expense - savedThisMonth} tone={income - expense - savedThisMonth < 0 ? 'bad' : 'good'} />
      </div>
      <h2>All time</h2>
      <div className="stats">
        <Stat label="Spending money available" value={allIn - allOut - savings} tone={allIn - allOut - savings < 0 ? 'bad' : 'good'} />
        <Stat label="Savings balance" value={savings} tone="good" />
      </div>
    </div>
  )
}
