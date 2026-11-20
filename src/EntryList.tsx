import { useMemo, useState, type FormEvent } from 'react'
import { supabase, money, today, type Entry, type Kind, type Section } from './supabase'
import CategoryPicker, { type Opt } from './CategoryPicker'

export interface ListConfig {
  title: string
  hint: string
  kinds?: Exclude<Kind, null>[]
  categories: Record<string, string[]>
  showDate: boolean
  monthFilter: boolean
  amountLabel?: string
  dateLabel?: string
  grouped?: boolean          // lines belong to spending groups (monthly budget)
}

export const DEFAULT_GROUPS = ['Day-to-day', 'Recurring', 'Invest-save-repay', 'Bank Fees', 'Communications']
const k = (g: string, c: string) => `${g}|${c}`
const lbl = (g: string, c: string) => g ? `${c} (${g})` : c

const KIND_LABEL: Record<string, string> = { income: 'Income', expense: 'Expense', deposit: 'Deposit', withdrawal: 'Withdrawal' }

interface Props {
  budgetId: string
  section: Section
  config: ListConfig
  entries: Entry[]
  month: string
  setMonth: (m: string) => void
  reload: () => Promise<void>
  planOpts?: Opt[]           // categories from the monthly budget, used for daily spending
}

export default function EntryList({ budgetId, section, config, entries, month, setMonth, reload, planOpts }: Props) {
  const firstKind = config.kinds?.[0] ?? null
  const firstOpt = planOpts?.[0]
  const blank = { kind: firstKind as Kind, grp: firstOpt?.group ?? (config.grouped ? DEFAULT_GROUPS[0] : ''), category: firstOpt?.name ?? (config.categories[firstKind ?? '_'] ?? [])[0] ?? 'Other', description: '', amount: '', entry_date: today() }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')

  // Preset categories plus any custom ones already used in this list
  const groupedForm = !!config.grouped && form.kind === 'expense'
  const cats: Opt[] = useMemo(() => {
    const seen = new Set<string>(); const out: Opt[] = []
    const add = (o: Opt) => { if (!seen.has(k(o.group, o.name))) { seen.add(k(o.group, o.name)); out.push(o) } }
    const used = entries.filter(e => (e.kind ?? null) === (form.kind ?? null)).map(e => ({ group: e.grp ?? '', name: e.category }))
    if (planOpts && planOpts.length) { planOpts.forEach(add); used.forEach(add) }
    else if (groupedForm) {
      used.filter(o => o.group === form.grp).forEach(add)
      if (!out.length) (config.categories[form.kind ?? '_'] ?? []).forEach(n => add({ group: form.grp, name: n }))
    } else { (config.categories[form.kind ?? '_'] ?? []).forEach(n => add({ group: '', name: n })); used.forEach(add) }
    return out
  }, [config.categories, form.kind, form.grp, entries, planOpts, groupedForm])
  const groupOpts: Opt[] = useMemo(() => {
    const names = [...new Set([...DEFAULT_GROUPS, ...entries.filter(e => e.kind === 'expense' && e.grp).map(e => e.grp)])]
    return names.map(n => ({ group: '', name: n }))
  }, [entries])

  const inPeriod = useMemo(() => config.monthFilter ? entries.filter(e => e.entry_date.startsWith(month)) : entries, [entries, month, config.monthFilter])
  const periodCats = useMemo(() => {
    const m = new Map<string, string>(); inPeriod.forEach(e => m.set(k(e.grp ?? '', e.category), lbl(e.grp ?? '', e.category)))
    return [...m].sort((a, b) => a[1].localeCompare(b[1]))
  }, [inPeriod])
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inPeriod.filter(e =>
      (!catFilter || k(e.grp ?? '', e.category) === catFilter) &&
      (!q || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || (e.grp ?? '').toLowerCase().includes(q) ||
        String(e.amount).includes(q) || e.entry_date.includes(q)))
  }, [inPeriod, search, catFilter])
  const filtering = search.trim() !== '' || catFilter !== ''

  async function save(e: FormEvent) {
    e.preventDefault()
    const amount = Number(String(form.amount).replace(',', '.'))
    if (!(amount >= 0)) { setErr('Enter a valid amount'); return }
    if (!form.category.trim()) { setErr('Choose a category'); return }
    setBusy(true); setErr('')
    const grp = config.grouped && form.kind !== 'expense' ? '' : form.grp
    const row = { budget_id: budgetId, section, kind: form.kind, grp, category: form.category, description: form.description.trim(), amount, entry_date: form.entry_date || today() }
    const { error } = editing
      ? await supabase.from('entries').update(row).eq('id', editing)
      : await supabase.from('entries').insert(row)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setEditing(null)
    setForm({ ...blank, kind: form.kind, grp: form.grp, category: form.category, entry_date: form.entry_date })
    await reload()
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this line?')) return
    const { error } = await supabase.from('entries').delete().eq('id', id)
    if (error) setErr(error.message)
    else await reload()
  }

  function edit(e: Entry) {
    setEditing(e.id)
    setForm({ kind: e.kind, grp: e.grp ?? '', category: e.category, description: e.description, amount: String(e.amount), entry_date: e.entry_date })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totals = config.kinds
    ? config.kinds.map(k => ({ k, v: shown.filter(e => e.kind === k).reduce((s, e) => s + e.amount, 0) }))
    : [{ k: 'total', v: shown.reduce((s, e) => s + e.amount, 0) }]

  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    inPeriod.forEach(e => { const kk = k(e.grp ?? '', e.category); m.set(kk, (m.get(kk) ?? 0) + (e.kind === 'withdrawal' ? -e.amount : e.amount)) })
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [inPeriod])

  // Monthly budget: income first, then each spending group with a subtotal row
  const rows: { head?: string; total?: number; e?: Entry }[] = useMemo(() => {
    if (!config.grouped) return shown.map(e => ({ e }))
    const order = (g: string) => { const i = DEFAULT_GROUPS.indexOf(g); return i < 0 ? 99 : i }
    const label = (e: Entry) => e.kind === 'income' ? 'Income' : (e.grp || 'Other')
    const sorted = [...shown].sort((a, b) =>
      Number(a.kind !== 'income') - Number(b.kind !== 'income') ||
      order(label(a)) - order(label(b)) || label(a).localeCompare(label(b)) || a.category.localeCompare(b.category))
    const out: { head?: string; total?: number; e?: Entry }[] = []
    sorted.forEach((e, i) => {
      if (i === 0 || label(sorted[i - 1]) !== label(e))
        out.push({ head: label(e), total: sorted.filter(x => label(x) === label(e)).reduce((t, x) => t + x.amount, 0) })
      out.push({ e })
    })
    return out
  }, [shown, config.grouped])

  return (
    <div>
      <div className="row between">
        <div><h2>{config.title}</h2><p className="muted small">{config.hint}</p></div>
        {config.monthFilter && <label className="inline">Month <input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>}
      </div>

      <form className="card entry-form" onSubmit={save}>
        {config.kinds && (
          <label>Type
            <select value={form.kind ?? ''} onChange={e => { const kd = e.target.value as Kind; setForm({ ...form, kind: kd, category: (config.categories[kd ?? '_'] ?? [])[0] ?? 'Other' }) }}>
              {config.kinds.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </label>
        )}
        {groupedForm && (
          <label>Spending group
            <CategoryPicker noun="group" value={{ group: '', name: form.grp }} options={groupOpts}
              onChange={g => setForm({ ...form, grp: g.name, category: '' })} />
          </label>
        )}
        <label>Category
          <CategoryPicker value={{ group: form.grp, name: form.category }} options={cats} newGroup={planOpts ? 'Other' : form.grp}
            onChange={c => setForm({ ...form, grp: c.group, category: c.name })} />
        </label>
        <label className="grow">Description<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional" /></label>
        <label>{config.amountLabel ?? 'Amount'} (R)<input inputMode="decimal" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></label>
        {config.showDate && <label>{config.dateLabel ?? 'Date'}<input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} /></label>}
        <div className="actions">
          <button type="submit" disabled={busy}>{editing ? 'Save' : 'Add'}</button>
          {editing && <button type="button" className="ghost" onClick={() => { setEditing(null); setForm(blank) }}>Cancel</button>}
        </div>
        {err && <p className="error full">{err}</p>}
      </form>

      {inPeriod.length > 0 && (
        <div className="filters">
          <input type="search" className="search" placeholder="Search description, category, amount or date…" value={search} onChange={e => setSearch(e.target.value)} />
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {periodCats.map(([kk, l]) => <option key={kk} value={kk}>{l}</option>)}
          </select>
          {filtering && <button type="button" className="ghost" onClick={() => { setSearch(''); setCatFilter('') }}>Clear</button>}
          {filtering && <span className="muted small">{shown.length} of {inPeriod.length} lines</span>}
        </div>
      )}

      <div className="stats">
        {totals.map(t => <div className="stat" key={t.k}><div className="muted small">{t.k === 'total' ? 'Total' : KIND_LABEL[t.k]}</div><div className="big">{money(t.v)}</div></div>)}
        {config.kinds?.includes('deposit') && <div className="stat good"><div className="muted small">Balance</div><div className="big">{money(totals[0].v - (totals[1]?.v ?? 0))}</div></div>}
        {config.kinds?.includes('income') && <div className={`stat ${totals[1].v - totals[0].v < 0 ? 'bad' : 'good'}`}><div className="muted small">Surplus</div><div className="big">{money(totals[1].v - totals[0].v)}</div></div>}
      </div>

      {!config.grouped && byCategory.length > 1 && (
        <div className="chips">{byCategory.map(([c, v]) => <button type="button" className={`chip ${catFilter === c ? 'on' : ''}`} key={c} onClick={() => setCatFilter(catFilter === c ? '' : c)}>{lbl(...(c.split('|') as [string, string]))}: <b>{money(v)}</b></button>)}</div>
      )}

      {shown.length === 0 ? <p className="muted">{filtering ? 'No lines match your search.' : 'Nothing here yet.'}</p> : (
        <div className="card table-wrap">
          <table>
            <thead><tr>
              {config.showDate && <th>{config.dateLabel ?? 'Date'}</th>}
              {config.kinds && <th>Type</th>}
              <th>Category</th><th>Description</th><th className="num">{config.amountLabel ?? 'Amount'}</th><th></th>
            </tr></thead>
            <tbody>{rows.map(r => r.head ? (
              <tr key={'h' + r.head} className="group-row">
                <td colSpan={(config.showDate ? 1 : 0) + (config.kinds ? 1 : 0) + 2}>{r.head}</td>
                <td className="num">{money(r.total ?? 0)}</td><td></td>
              </tr>
            ) : (() => { const e = r.e!; return (
              <tr key={e.id} className={editing === e.id ? 'editing' : ''}>
                {config.showDate && <td className="nowrap">{e.entry_date}</td>}
                {config.kinds && <td>{KIND_LABEL[e.kind ?? '']}</td>}
                <td>{e.category}{!config.grouped && e.grp ? <span className="muted small-inline"> · {e.grp}</span> : null}</td><td>{e.description}</td>
                <td className={`num ${e.kind === 'expense' || e.kind === 'withdrawal' ? 'neg' : ''}`}>{money(e.amount)}</td>
                <td className="nowrap right"><button className="link" onClick={() => edit(e)}>Edit</button><button className="link danger" onClick={() => remove(e.id)}>Delete</button></td>
              </tr>
            ) })())}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
