import { useMemo, useState, type FormEvent } from 'react'
import { supabase, money, today, type Entry, type Kind, type Section } from './supabase'
import CategoryPicker from './CategoryPicker'

export interface ListConfig {
  title: string
  hint: string
  kinds?: Exclude<Kind, null>[]
  categories: Record<string, string[]>
  showDate: boolean
  monthFilter: boolean
  amountLabel?: string
  dateLabel?: string
}

const KIND_LABEL: Record<string, string> = { income: 'Income', expense: 'Expense', deposit: 'Deposit', withdrawal: 'Withdrawal' }

interface Props {
  budgetId: string
  section: Section
  config: ListConfig
  entries: Entry[]
  month: string
  setMonth: (m: string) => void
  reload: () => Promise<void>
}

export default function EntryList({ budgetId, section, config, entries, month, setMonth, reload }: Props) {
  const firstKind = config.kinds?.[0] ?? null
  const blank = { kind: firstKind as Kind, category: (config.categories[firstKind ?? '_'] ?? [])[0] ?? 'Other', description: '', amount: '', entry_date: today() }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')

  // Preset categories plus any custom ones already used in this list
  const cats = useMemo(() => {
    const preset = config.categories[form.kind ?? '_'] ?? []
    const used = entries.filter(e => (e.kind ?? null) === (form.kind ?? null)).map(e => e.category)
    return [...new Set([...preset, ...used])]
  }, [config.categories, form.kind, entries])

  const inPeriod = useMemo(() => config.monthFilter ? entries.filter(e => e.entry_date.startsWith(month)) : entries, [entries, month, config.monthFilter])
  const periodCats = useMemo(() => [...new Set(inPeriod.map(e => e.category))].sort(), [inPeriod])
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inPeriod.filter(e =>
      (!catFilter || e.category === catFilter) &&
      (!q || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) ||
        String(e.amount).includes(q) || e.entry_date.includes(q)))
  }, [inPeriod, search, catFilter])
  const filtering = search.trim() !== '' || catFilter !== ''

  async function save(e: FormEvent) {
    e.preventDefault()
    const amount = Number(String(form.amount).replace(',', '.'))
    if (!(amount >= 0)) { setErr('Enter a valid amount'); return }
    setBusy(true); setErr('')
    const row = { budget_id: budgetId, section, kind: form.kind, category: form.category, description: form.description.trim(), amount, entry_date: form.entry_date || today() }
    const { error } = editing
      ? await supabase.from('entries').update(row).eq('id', editing)
      : await supabase.from('entries').insert(row)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setEditing(null)
    setForm({ ...blank, kind: form.kind, category: form.category, entry_date: form.entry_date })
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
    setForm({ kind: e.kind, category: e.category, description: e.description, amount: String(e.amount), entry_date: e.entry_date })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totals = config.kinds
    ? config.kinds.map(k => ({ k, v: shown.filter(e => e.kind === k).reduce((s, e) => s + e.amount, 0) }))
    : [{ k: 'total', v: shown.reduce((s, e) => s + e.amount, 0) }]

  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    inPeriod.forEach(e => m.set(e.category, (m.get(e.category) ?? 0) + (e.kind === 'withdrawal' ? -e.amount : e.amount)))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [inPeriod])

  return (
    <div>
      <div className="row between">
        <div><h2>{config.title}</h2><p className="muted small">{config.hint}</p></div>
        {config.monthFilter && <label className="inline">Month <input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>}
      </div>

      <form className="card entry-form" onSubmit={save}>
        {config.kinds && (
          <label>Type
            <select value={form.kind ?? ''} onChange={e => { const k = e.target.value as Kind; setForm({ ...form, kind: k, category: (config.categories[k ?? '_'] ?? [])[0] ?? 'Other' }) }}>
              {config.kinds.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </label>
        )}
        <label>Category
          <CategoryPicker value={form.category} options={cats} onChange={c => setForm({ ...form, category: c })} />
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
            {periodCats.map(c => <option key={c} value={c}>{c}</option>)}
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

      {byCategory.length > 1 && (
        <div className="chips">{byCategory.map(([c, v]) => <button type="button" className={`chip ${catFilter === c ? 'on' : ''}`} key={c} onClick={() => setCatFilter(catFilter === c ? '' : c)}>{c}: <b>{money(v)}</b></button>)}</div>
      )}

      {shown.length === 0 ? <p className="muted">{filtering ? 'No lines match your search.' : 'Nothing here yet.'}</p> : (
        <div className="card table-wrap">
          <table>
            <thead><tr>
              {config.showDate && <th>{config.dateLabel ?? 'Date'}</th>}
              {config.kinds && <th>Type</th>}
              <th>Category</th><th>Description</th><th className="num">{config.amountLabel ?? 'Amount'}</th><th></th>
            </tr></thead>
            <tbody>{shown.map(e => (
              <tr key={e.id} className={editing === e.id ? 'editing' : ''}>
                {config.showDate && <td className="nowrap">{e.entry_date}</td>}
                {config.kinds && <td>{KIND_LABEL[e.kind ?? '']}</td>}
                <td>{e.category}</td><td>{e.description}</td>
                <td className={`num ${e.kind === 'expense' || e.kind === 'withdrawal' ? 'neg' : ''}`}>{money(e.amount)}</td>
                <td className="nowrap right"><button className="link" onClick={() => edit(e)}>Edit</button><button className="link danger" onClick={() => remove(e.id)}>Delete</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
