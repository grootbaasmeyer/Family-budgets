import { useEffect, useMemo, useRef, useState } from 'react'

export interface Opt { group: string; name: string }
const key = (o: Opt) => `${o.group}|${o.name}`

interface Props {
  value: Opt
  options: Opt[]
  onChange: (v: Opt) => void
  placeholder?: string
  newGroup?: string          // group given to a newly typed category
  noun?: string              // "category" or "group"
}

// Pick-list with type-to-search. Opens with the full list (grouped under headings when
// options carry a group); typing filters on name or group. Unknown names can be added.
export default function CategoryPicker({ value, options, onChange, placeholder, newGroup, noun = 'category' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    const hits = options.filter(o => o.name.toLowerCase().includes(q) || o.group.toLowerCase().includes(q))
    return [...hits].sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
  }, [options, query])

  const exact = options.some(o => o.name.toLowerCase() === query.trim().toLowerCase())
  const showNew = query.trim() !== '' && !exact
  const items: (Opt & { isNew?: boolean })[] = showNew
    ? [...filtered, { group: newGroup ?? value.group, name: query.trim(), isNew: true }]
    : filtered
  const grouped = !query.trim() && options.some(o => o.group)
  const dupNames = useMemo(() => {
    const c = new Map<string, number>(); options.forEach(o => c.set(o.name, (c.get(o.name) ?? 0) + 1))
    return new Set([...c].filter(([, n]) => n > 1).map(([n]) => n))
  }, [options])

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (wrap.current && !wrap.current.contains(e.target as Node)) close() }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  })
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [hi, open])

  const label = (o: Opt) => dupNames.has(o.name) && o.group ? `${o.name} (${o.group})` : o.name
  function close() { setOpen(false); setQuery('') }
  function openList() { setOpen(true); setQuery(''); setHi(Math.max(0, options.findIndex(o => key(o) === key(value)))) }
  function pick(o: Opt) { onChange({ group: o.group, name: o.name }); close() }
  const shownValue = value.name ? label(value) : ''

  return (
    <div className="picker" ref={wrap}>
      <input
        role="combobox"
        aria-expanded={open}
        value={open ? query : shownValue}
        placeholder={open ? (shownValue || `Search ${noun}…`) : (placeholder ?? 'Choose…')}
        onFocus={openList}
        onClick={() => { if (!open) openList() }}
        onChange={e => {
          const v = e.target.value
          setQuery(open ? v : v.startsWith(shownValue) ? v.slice(shownValue.length) : v)
          setHi(0); setOpen(true)
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(items.length - 1, h + 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
          else if (e.key === 'Enter' && open) { e.preventDefault(); if (items[hi]) pick(items[hi]) }
          else if (e.key === 'Escape') { close(); (e.target as HTMLInputElement).blur() }
          else if (e.key === 'Tab' && open && query && items[hi]) pick(items[hi])
        }}
      />
      <span className="caret" aria-hidden>▾</span>
      {open && (
        <ul className="picker-list" role="listbox" ref={listRef}>
          {items.length === 0 && <li className="muted empty">Nothing found</li>}
          {items.map((it, i) => {
            const head = grouped && it.group && (i === 0 || items[i - 1].group !== it.group)
            const sel = !it.isNew && key(it) === key(value)
            return [
              head ? <li key={`h-${it.group}`} className="group-head" aria-hidden>{it.group}</li> : null,
              <li key={key(it) + (it.isNew ? '-new' : '')} data-i={i} role="option" aria-selected={i === hi}
                className={`${i === hi ? 'hi' : ''} ${sel ? 'sel' : ''} ${grouped && it.group ? 'indent' : ''}`}
                onMouseEnter={() => setHi(i)}
                onMouseDown={e => { e.preventDefault(); pick(it) }}>
                <span>{it.isNew ? <>Add new {noun} “<b>{it.name}</b>”</> : it.name}
                  {!grouped && it.group && !it.isNew && <span className="muted small-inline"> · {it.group}</span>}</span>
                {sel && <span className="tick">✓</span>}
              </li>,
            ]
          })}
        </ul>
      )}
    </div>
  )
}
