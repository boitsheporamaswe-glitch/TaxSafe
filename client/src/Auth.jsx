import { useState } from 'react';
import { api } from './api.js';
export default function Auth({ onDone }) {
  const [mode, setMode] = useState('signup'), [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { onDone(await api[mode](email, pw)); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return <div className="auth"><div className="hero authcard">
    <div className="brand">Tax<b>Jar</b></div>
    <h1>Know what&rsquo;s really yours to spend.</h1>
    <p className="lbl">Set aside the right tax from every payment. Built for drivers, couriers and freelancers in South Africa.</p>
    <form onSubmit={submit}>
      <label className="fld">Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="fld">Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={8}
        value={pw} onChange={e => setPw(e.target.value)} /></label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn wide" disabled={busy}>{busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
    </form>
    <button className="link" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErr(''); }}>
      {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
  </div></div>;
}
