import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, configured, type Budget, type Profile } from './supabase'
import Login from './Login'
import BudgetView from './BudgetView'
import { NewPassword } from './Login'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((e, s) => { setSession(s); if (e === 'PASSWORD_RECOVERY') setRecovery(true) })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); setBudgets([]); return }
    ;(async () => {
      setLoadError('')
      const { data: p, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      if (error) { setLoadError(error.message); return }
      setProfile(p as Profile | null)
      if (!p) return
      const { data: b } = await supabase.from('budgets').select('*').order('sort_order')
      const list = (b ?? []) as Budget[]
      setBudgets(list)
      setActive(prev => prev && list.some(x => x.id === prev) ? prev : (p as Profile).budget_id)
    })()
  }, [session])

  if (!configured) return <div className="center card"><h2>Setup needed</h2><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p></div>
  if (!ready) return <div className="center muted">Loading…</div>
  if (!session) return <Login />

  const signOut = () => supabase.auth.signOut()
  if (recovery) return <NewPassword done={() => setRecovery(false)} />

  if (loadError) return <div className="center card"><p className="error">{loadError}</p><button onClick={signOut}>Sign out</button></div>
  if (!profile) return (
    <div className="center card">
      <h2>No budget linked</h2>
      <p>{session.user.email} isn't set up for the family budget yet. Ask JP or Madine to add you.</p>
      <button onClick={signOut}>Sign out</button>
    </div>
  )

  const budget = budgets.find(b => b.id === active)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Meyer Budgets</div>
        {profile.role === 'parent' && budgets.length > 1 && (
          <nav className="switcher">
            {budgets.map(b => (
              <button key={b.id} className={b.id === active ? 'pill active' : 'pill'} onClick={() => setActive(b.id)}>{b.name}</button>
            ))}
          </nav>
        )}
        <div className="who">
          <span className="muted">{profile.display_name}</span>
          <button className="ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main>{budget ? <BudgetView key={budget.id} budget={budget} /> : <p className="muted">Loading budget…</p>}</main>
    </div>
  )
}
