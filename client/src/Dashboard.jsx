import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { money, grp, day, longDate } from './util.js';
import { useCountUp } from './useCountUp.js';
import { parseBankCsv } from './csvImport.js';
import Chart from './Chart.jsx';

const FIELDS = [['annualGross', 'Expected income this year'], ['annualExpenses', 'Yearly costs you won’t log one by one'], ['annualRA', 'Retirement annuity contributions']];
const KINDS = [['payment', 'Payment'], ['expense', 'Expense'], ['refund', 'Refund'], ['transfer', 'Saved']];
const PLACEHOLDER = { payment: 'Payment received', expense: 'Amount spent', refund: 'Amount refunded', transfer: 'Moved to tax savings' };
const LABEL = { payment: 'Payment', expense: 'Expense', refund: 'Refund', transfer: 'Moved to tax savings' };

export default function Dashboard({ state, setState, live, notify, onSignOut, theme, cycleTheme }) {
  const [draft, setDraft] = useState(state.profile);
  const [kind, setKind] = useState('payment'), [cat, setCat] = useState('Petrol'), [amt, setAmt] = useState(''), [desc, setDesc] = useState('');
  const [pv, setPv] = useState(null), [error, setError] = useState(''), [plan, setPlan] = useState(null);
  const timer = useRef(), amtRef = useRef();
  const { estimate: est, entries, rules, categories, totals: t, provisional: prov } = state;

  const profileKey = JSON.stringify(state.profile);
  useEffect(() => { if (!timer.current) setDraft(state.profile); }, [profileKey]); // pick up changes from other tabs, but never overwrite what you are typing
  const edit = (k, v) => {
    const next = { ...draft, [k]: v }; setDraft(next);
    clearTimeout(timer.current); // recalculates ~250ms after you stop typing
    timer.current = setTimeout(() => { timer.current = null; api.saveProfile(next).then(setState).catch(e => setError(e.message)); }, 250);
  };
  const add = async () => {
    if (!(+amt > 0)) return;
    try {
      const s = await api.add({ kind, amount: +amt, category: cat, description: desc });
      setState(s); setAmt(''); setDesc(''); setPv(null); setError('');
      notify(`${LABEL[kind]} logged`, () => api.remove(s.entries[0].id).then(setState));
    } catch (e) { setError(e.message); }
  };
  const remove = async x => { setState(await api.remove(x.id)); notify('Entry removed', () => api.add({ kind: x.kind, amount: x.amount, at: x.at, rate: x.rate, category: x.category, description: x.description }).then(setState)); };

  // one-tap repeats of what you log most
  const recent = useMemo(() => { const seen = new Set(), out = [];
    for (const e of entries) { if (e.kind !== 'payment' && e.kind !== 'expense') continue;
      const k = `${e.kind}|${e.category}|${e.description}|${e.amount}`; if (!seen.has(k)) { seen.add(k); out.push(e); } if (out.length === 4) break; }
    return out; }, [entries]);
  const again = async e => {
    const s = await api.add({ kind: e.kind, amount: e.amount, category: e.category, description: e.description });
    setState(s); notify(`Logged ${e.description || e.category || LABEL[e.kind]}`, () => api.remove(s.entries[0].id).then(setState));
  };

  const sig = `${entries.length}:${est.rate}`;
  useEffect(() => { // live "after this entry" numbers, ~150ms after you stop typing
    if (!(+amt > 0)) { setPv(null); return; }
    const id = setTimeout(() => api.preview(kind, +amt).then(setPv).catch(() => {}), 150);
    return () => clearTimeout(id);
  }, [amt, kind, sig]);

  const safe = pv ? pv.safeAfter : t.safe, shown = useCountUp(safe);
  const keepPct = t.income > 0 ? Math.min(100, (t.taxPot / t.income) * 100) : 0;
  const c100 = Math.round(Math.abs(shown) * 100), whole = grp.format(Math.floor(c100 / 100)), cents = String(c100 % 100).padStart(2, '0');
  const top = pv && Math.round(pv.marginal * 100), covered = t.gap <= 0.005, savedPct = t.taxPot > 0 ? Math.min(100, (t.saved / t.taxPot) * 100) : 100;
  const hint = error ? error : !pv ? <>Set aside <b>{(est.rate * 100).toFixed(1)}%</b> of every payment</>
    : kind === 'payment' ? <>Set aside <b>{money(pv.taxChange)}</b> ({(pv.rate * 100).toFixed(1)}%) · your top bracket is {top}%</>
    : kind === 'expense' ? <>Lowers your tax by about <b>{money(-pv.taxChange)}</b> ({top}% bracket), so your safe balance falls by {money(+amt + pv.taxChange)}, not {money(+amt)}</>
    : kind === 'refund' ? <>The refund frees <b>{money(-pv.taxChange)}</b> from your tax pot</>
    : <>Counts toward your tax savings. Your safe balance does not change</>;

  const onFile = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const { rows, skipped } = parseBankCsv(await f.text());
    setPlan({ rows, skipped, payments: rows.filter(r => r.kind === 'payment').length, expenses: rows.filter(r => r.kind === 'expense').length });
  };
  const runImport = async () => {
    try { setState(await api.bulk(plan.rows.slice(0, 500))); notify(`Imported ${Math.min(plan.rows.length, 500)} entries`); setPlan(null); } catch (e) { setError(e.message); setPlan(null); }
  };

  return <div className="shell">
    <header className="top"><div className="brand">Tax<b>Safe</b></div>
      <div className="meta"><small>South Africa · SARS {rules.year} · checked {rules.verifiedOn}</small>
        <span className={'live' + (live ? ' on' : '')}><i />{live ? 'Live' : 'Reconnecting'}</span></div></header>
    {rules.stale && <p className="banner" role="alert">These rates are for the {rules.year} tax year and a newer one may have started. Check SARS before relying on them.</p>}
    <div className="grid">
      <main>
        <div className="hero">
          <p className="lbl">{pv ? 'Safe to spend after this entry' : 'Safe to spend'}</p>
          <div className="fig num" aria-live="polite"><sup>{safe < 0 ? '−' : ''}R</sup>{whole}<sup>.{cents}</sup></div>
          <div className="split" role="img" aria-label={`${(100 - keepPct).toFixed(0)}% yours, ${keepPct.toFixed(0)}% set aside`}>
            <i className="a" style={{ width: 100 - keepPct + '%' }} /><i className="b" style={{ width: keepPct + '%' }} /></div>
          <div className="legend num"><div><b>{money(safe)}</b>Yours to spend</div><div><b>{money(t.taxPot)}</b>Set aside for taxes</div></div>
          <div className="seg" role="group" aria-label="Entry type">{KINDS.map(([k, l]) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}</div>
          <div className="log">
            <label className="amt"><span>R</span><input ref={amtRef} className="num" type="number" inputMode="decimal" min="0" placeholder={PLACEHOLDER[kind]}
              value={amt} onChange={e => setAmt(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} aria-label="Amount" /></label>
            <button className="btn" onClick={add}>Log {kind === 'transfer' ? 'saving' : kind}</button></div>
          <div className="log2">
            {kind === 'expense' && <div className="chips" role="group" aria-label="Expense category">{categories.map(c => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>}
            <input value={desc} maxLength={80} placeholder="Note (optional)" onChange={e => setDesc(e.target.value)} aria-label="Note" /></div>
          <p className="hint num">{hint}</p>
          {pv && !error && kind === 'payment' && <p className="hint2 num">On what you’ve logged this tax year, this payment adds about <b>{money(pv.ytd.tax)}</b> in tax ({(pv.ytd.pct * 100).toFixed(0)}%). Your set-aside uses the steadier yearly rate.</p>}
          {recent.length > 0 && <div className="chips again" aria-label="Log again">{recent.map(e => <button key={e.id} onClick={() => again(e)}>{e.kind === 'expense' ? '−' : '+'} {e.description || e.category || LABEL[e.kind]} · {money(e.amount)}</button>)}</div>}
        </div>
        <div className="ytd num"><div><b>{money(t.income)}</b><small>Income, after refunds</small></div><div><b>{money(t.expenses)}</b><small>Expenses</small></div><div><b>{money(t.taxPot)}</b><small>Tax pot</small></div></div>
        {t.relief > 0 && <p className="sub num" style={{ marginTop: 10 }}>Your logged expenses have already lowered your tax pot by {money(t.relief)}.</p>}
        <section className="card tracker"><h2>Tax savings</h2>
          <p className="sub num">{covered ? <>Your tax pot is fully covered{t.saved > t.taxPot ? ` with ${money(t.saved - t.taxPot)} to spare` : ''}.</> : <><b className="warn">{money(t.gap)}</b> still to move into your tax savings.</>}</p>
          <div className="prog" role="img" aria-label={`${savedPct.toFixed(0)}% of your tax pot is saved`}><i className={covered ? 'ok' : ''} style={{ width: savedPct + '%' }} /></div>
          <p className="sub num">{money(t.saved)} saved of {money(t.taxPot)} <button className="link" onClick={() => { setKind('transfer'); window.scrollTo({ top: 0, behavior: 'smooth' }); amtRef.current?.focus(); }}>Log a saving</button></p></section>
        <section className="ledger"><h2>Activity</h2><p className="sub">Payments and refunds keep the rate that applied when you logged them.</p>
          {entries.length === 0 && <p className="empty">Nothing logged yet. Add your first payment above.</p>}
          {entries.map(x => <div className="row num" key={x.id}><span className="d">{day(x.at)}</span>
            <span className="m">{x.kind === 'payment' ? '+' : x.kind === 'transfer' ? '' : '−'}{money(x.amount)}<small>{x.description || (x.kind === 'expense' ? x.category : LABEL[x.kind])}</small></span>
            <span className="k">{x.kind === 'payment' ? <>set aside <b>{money(x.amount * x.rate)}</b></> : x.kind === 'expense' ? <b>{x.category}</b> : <b>{x.kind === 'refund' ? 'refund' : 'saved'}</b>}</span>
            <button className="x" aria-label="Remove entry" onClick={() => remove(x)}>×</button></div>)}
        </section>
      </main>
      <aside className="side">
        <section><h2>Next tax deadline</h2>
          {prov.next ? <><p className="deadline num"><b>{prov.next.days}</b> days</p>
            <p className="sub">{prov.next.label}, {longDate(prov.next.date)}. About <b className="num">{money(prov.next.amount)}</b>, assuming the first instalment was paid in full.</p></>
            : <p className="sub">Both provisional payments for this tax year are behind you.</p>}</section>
        <section><h2>Your year</h2><p className="sub">Expenses you log lower your tax on top of this.</p>
          <div className="fields">{FIELDS.map(([k, l]) => <div className="f" key={k}><label htmlFor={k}>{l}</label>
            <input id={k} className="num" type="number" inputMode="decimal" min="0" value={draft[k]} onChange={e => edit(k, e.target.value)} /></div>)}</div></section>
        {est.gross > 0 && <section><h2>Where it goes</h2><p className="sub">About {money(est.tax)} in income tax on {money(est.gross)} of income.</p>
          <ul className="parts num"><li><i style={{ background: 'var(--se)' }} /><span>Income tax before rebate</span><span>{money(est.taxBefore)} <em>· {(est.taxBefore / est.gross * 100).toFixed(1)}%</em></span></li>
            <li><i style={{ background: 'var(--fed)' }} /><span>Primary rebate</span><span>{money(-est.rebate)} <em>· {(-est.rebate / est.gross * 100).toFixed(1)}%</em></span></li>
            <li><i style={{ background: 'var(--line)' }} /><span>Safety margin</span><span><em>+2.0%</em></span></li></ul></section>}
        <section><h2>Month by month</h2><p className="sub">Income <i className="key in" /> and expenses <i className="key ex" /> this tax year.</p><Chart monthly={state.monthly} /></section>
        <section><h2>Your data</h2>
          {plan && <div className="card plan"><p className="sub">Found <b>{plan.payments}</b> payments and <b>{plan.expenses}</b> expenses{plan.skipped ? `, skipped ${plan.skipped} blank rows` : ''}. Money in becomes a payment, money out an expense. Check it looks right.</p>
            <div className="wizbtns"><button className="link" onClick={() => setPlan(null)}>Cancel</button><button className="btn sm" disabled={!plan.rows.length} onClick={runImport}>Import</button></div></div>}
          <div className="tools">
            <button className="ghost" onClick={api.exportCsv}>Export CSV</button>
            <label className="ghost">Import CSV<input type="file" accept=".csv,text/csv" hidden onChange={onFile} /></label>
            <button className="ghost" onClick={cycleTheme}>Theme: {theme || 'auto'}</button>
            {!api.demo && <button className="ghost" onClick={onSignOut}>Sign out</button>}</div>
          <p className="sub" style={{ marginTop: 8 }}>{state.user?.email}</p></section>
      </aside>
    </div>
    <p className="fine">An estimate for a South African taxpayer under 65, not tax advice. Provisional tax is due at the end of August and February, so leave your set-aside untouched until then.</p>
  </div>;
}
