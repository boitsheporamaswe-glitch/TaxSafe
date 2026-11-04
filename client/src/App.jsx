import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useLiveState } from './useLiveState.js';
import Auth from './Auth.jsx';
import Onboarding from './Onboarding.jsx';
import Dashboard from './Dashboard.jsx';

const THEMES = [null, 'light', 'dark'];
export default function App() {
  const { state, setState, live, status, signedIn, signedOut } = useLiveState();
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('ts-theme') || null; } catch { return null; } });
  const [toast, setToast] = useState(null), timer = useRef();
  useEffect(() => {
    const el = document.documentElement; theme ? el.setAttribute('data-theme', theme) : el.removeAttribute('data-theme');
    try { theme ? localStorage.setItem('ts-theme', theme) : localStorage.removeItem('ts-theme'); } catch { /* private mode */ }
  }, [theme]);
  const notify = (msg, undo) => { clearTimeout(timer.current); setToast({ msg, undo }); timer.current = setTimeout(() => setToast(null), 6000); };
  const signOut = async () => { await api.logout(); signedOut(); };

  if (status === 'loading') return <div className="shell"><p className="sub">Loading…</p></div>;
  if (status === 'error') return <div className="shell"><p className="banner" role="alert">Can’t reach the server. Check your connection and refresh.</p></div>;
  if (status === 'anon') return <Auth onDone={signedIn} />;
  if (!state.profile.onboarded) return <Onboarding profile={state.profile} onDone={setState} />;
  return <>
    <Dashboard state={state} setState={setState} live={live} notify={notify} onSignOut={signOut} theme={theme}
      cycleTheme={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % 3])} />
    {toast && <div className="toast" role="status"><span>{toast.msg}</span>
      {toast.undo && <button onClick={() => { toast.undo(); setToast(null); }}>Undo</button>}</div>}
  </>;
}
