import { thisMonth } from './supabase'

const fmt = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric' })
export const monthName = (m: string) => fmt.format(new Date(`${m}-01T12:00:00`))
export function addMonths(m: string, n: number) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ‹ November 2026 › — arrows step a month; clicking the name opens a month picker.
export default function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return (
    <div className="monthnav">
      <button type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
      <span className="mlabel">{monthName(month)}
        <input type="month" aria-label="Choose month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} />
      </span>
      <button type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>›</button>
      {month !== thisMonth() && <button type="button" className="today" onClick={() => setMonth(thisMonth())}>This month</button>}
    </div>
  )
}
