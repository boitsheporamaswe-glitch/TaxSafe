import { useState } from 'react';
import { api } from './api.js';
import { money } from './util.js';
const STEPS = [
  ['annualGross', 'What do you expect to earn this tax year?', 'Before costs. A rough number is fine, you can change it any time.'],
  ['annualExpenses', 'Any yearly costs you will not log one by one?', 'For example a phone contract. Fuel and repairs you can log as you go, so leave this at 0 if unsure.'],
  ['annualRA', 'Do you pay into a retirement annuity?', 'It lowers your tax. Enter the yearly total, or 0.'],
];
export default function Onboarding({ profile, onDone }) {
  const [i, setI] = useState(0), [v, setV] = useState({ ...profile, annualGross: profile.annualGross || '' }), [busy, setBusy] = useState(false);
  const [key, title, hint] = STEPS[i], last = i === STEPS.length - 1;
  const next = async () => {
    if (!last) return setI(i + 1);
    setBusy(true); try { onDone(await api.saveProfile({ ...v, onboarded: true })); } finally { setBusy(false); }
  };
  return <div className="auth"><div className="hero authcard">
    <p className="lbl">Step {i + 1} of {STEPS.length}</p>
    <div className="dots" aria-hidden="true">{STEPS.map((_, n) => <i key={n} className={n <= i ? 'on' : ''} />)}</div>
    <h1>{title}</h1><p className="lbl">{hint}</p>
    <label className="amt big"><span>R</span><input autoFocus className="num" type="number" inputMode="decimal" min="0" value={v[key]}
      onChange={e => setV({ ...v, [key]: e.target.value })} onKeyDown={e => e.key === 'Enter' && next()} aria-label={title} /></label>
    {last && <p className="hint num">Ready. You can change these any time under &ldquo;Your year&rdquo;.</p>}
    <div className="wizbtns">{i > 0 ? <button className="link" onClick={() => setI(i - 1)}>Back</button> : <span />}
      <button className="btn" disabled={busy} onClick={next}>{last ? 'Start' : 'Next'}</button></div>
  </div></div>;
}
