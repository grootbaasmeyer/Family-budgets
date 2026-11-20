import { useState, type FormEvent } from 'react'
import { supabase } from './supabase'

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(''); setMsg('')
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (!data.session) setMsg('Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMsg('If that email is registered, a reset link is on its way.')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <h1>Meyer Budgets</h1>
        <p className="muted">{mode === 'in' ? 'Sign in to your budget' : mode === 'up' ? 'Create your account (first time only)' : 'Reset your password'}</p>
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        {mode !== 'reset' && (
          <label>Password<input type="password" required minLength={6} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>
        )}
        {err && <p className="error">{err}</p>}
        {msg && <p className="ok">{msg}</p>}
        <button type="submit" disabled={busy}>{busy ? '…' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}</button>
        <div className="links">
          {mode !== 'in' && <a onClick={() => setMode('in')}>Back to sign in</a>}
          {mode === 'in' && <a onClick={() => setMode('up')}>First time? Create account</a>}
          {mode === 'in' && <a onClick={() => setMode('reset')}>Forgot password</a>}
        </div>
      </form>
    </div>
  )
}

export function NewPassword({ done }: { done: () => void }) {
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setErr(error.message)
    else done()
  }
  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <h1>New password</h1>
        <label>Password<input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        {err && <p className="error">{err}</p>}
        <button type="submit">Save password</button>
      </form>
    </div>
  )
}
