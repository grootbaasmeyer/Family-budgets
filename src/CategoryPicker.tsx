import { useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  value: string
  options: string[]
  onChange: (v: string) => void
  placeholder?: string
}

// Pick-list with type-to-search. Shows every category when opened; typing filters.
// A name that isn't in the list can still be used as a new category.
export default function CategoryPicker({ value, options, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? options.filter(o => o.toLowerCase().includes(q)) : options
    return [...list].sort((a, b) => {
      if (!q) return 0
      return Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q))
    })
  }, [options, query])

  const exact = options.some(o => o.toLowerCase() === query.trim().toLowerCase())
  const showNew = query.trim() !== '' && !exact
  const items = showNew ? [...filtered, `__new__${query.trim()}`] : filtered

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (wrap.current && !wrap.current.contains(e.target as Node)) close() }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  })

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [hi, open])

  function close() { setOpen(false); setQuery('') }
  function pick(item: string) {
    onChange(item.startsWith('__new__') ? item.slice(7) : item)
    close()
  }

  return (
    <div className="picker" ref={wrap}>
      <input
        role="combobox"
        aria-expanded={open}
        value={open ? query : value}
        placeholder={open ? (value || 'Search categories…') : (placeholder ?? 'Choose…')}
        onFocus={() => { setOpen(true); setQuery(''); setHi(Math.max(0, options.indexOf(value))) }}
        onClick={() => { if (!open) { setOpen(true); setQuery(''); setHi(Math.max(0, options.indexOf(value))) } }}
        onChange={e => {
          const v = e.target.value
          setQuery(open ? v : v.startsWith(value) ? v.slice(value.length) : v)
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
          {items.length === 0 && <li className="muted empty">No categories</li>}
          {items.map((it, i) => (
            <li key={it} data-i={i} role="option" aria-selected={i === hi}
              className={`${i === hi ? 'hi' : ''} ${it === value ? 'sel' : ''}`}
              onMouseEnter={() => setHi(i)}
              onMouseDown={e => { e.preventDefault(); pick(it) }}>
              {it.startsWith('__new__') ? <>Add new category “<b>{it.slice(7)}</b>”</> : it}
              {it === value && <span className="tick">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
