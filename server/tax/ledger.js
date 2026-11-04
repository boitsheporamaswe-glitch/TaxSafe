import { estimate, ytdMarginal, taxYearStart, expenseRelief } from './engine.js';

export const KINDS = ['payment', 'expense', 'refund', 'transfer']; // transfer = money moved into your tax savings
export const CATEGORIES = ['Petrol', 'Data & airtime', 'Vehicle & repairs', 'Phone', 'Equipment', 'Other'];

const thisYear = (entries, now) => entries.filter(e => e.at >= taxYearStart(now).getTime());
const sum = (es, kind, f = e => e.amount) => es.filter(e => e.kind === kind).reduce((s, e) => s + f(e), 0);

// Everything is for the current SARS tax year (from 1 March). Expenses lower taxable income, so they release
// money from the tax pot; refunds hand back the tax that was set aside on the money returned.
export function totalsOf(entries, profile, rules, now = new Date()) {
  const es = thisYear(entries, now);
  const income = sum(es, 'payment') - sum(es, 'refund'), expenses = sum(es, 'expense');
  const setAside = sum(es, 'payment', e => e.amount * e.rate) - sum(es, 'refund', e => e.amount * e.rate);
  const relief = expenseRelief(profile, rules, expenses);
  const taxPot = Math.max(0, setAside - relief);
  const saved = sum(es, 'transfer');
  return { income, expenses, relief, taxPot, saved, gap: taxPot - saved, safe: income - expenses - taxPot };
}

// "What if I logged this?" Pure: changes nothing. Shared by the server and the static demo.
export function previewFor(db, rules, { kind = 'payment', amount = 0 }, now = new Date()) {
  const e = estimate(db.profile, rules);
  const before = totalsOf(db.entries, db.profile, rules, now);
  const after = totalsOf([...db.entries, { kind, at: now.getTime(), amount, rate: e.rate }], db.profile, rules, now);
  const out = { kind, rate: e.rate, marginal: e.marginal || 0, safeAfter: after.safe, taxChange: after.taxPot - before.taxPot };
  if (kind === 'payment') {
    const es = thisYear(db.entries, now);
    out.ytd = ytdMarginal({ ytdNet: Math.max(0, before.income - before.expenses), amount, expense: 0 }, rules);
  }
  return out;
}

// Validates and builds an entry. `at`/`rate` are only accepted so an undo or an import can restore the original values.
export function makeEntry(input, rate, now = Date.now()) {
  const kind = input.kind ?? 'payment';
  if (!KINDS.includes(kind)) throw new Error('unknown entry type');
  const amount = +input.amount;
  if (!(amount > 0 && amount < 1e9)) throw new Error('amount must be a positive number');
  let at = now;
  if (input.at !== undefined) {
    at = Math.floor(+input.at);
    if (!(at > 0 && at <= now + 6e4 && at > now - 3 * 365 * 864e5)) throw new Error('invalid date');
  }
  const e = { id: globalThis.crypto.randomUUID(), at, kind, amount, description: String(input.description || '').trim().slice(0, 80) };
  if (kind === 'expense') e.category = CATEGORIES.includes(input.category) ? input.category : 'Other';
  else if (kind !== 'transfer') e.rate = input.rate >= 0 && input.rate <= 0.6 && input.rate !== null && input.rate !== '' ? +input.rate : rate;
  return e;
}

// Income and expenses per month of the current tax year (March to February), for the chart.
export function monthlyOf(entries, now = new Date()) {
  const start = taxYearStart(now);
  const m = Array.from({ length: 12 }, (_, i) => ({ label: new Date(start.getFullYear(), 2 + i, 1).toLocaleDateString('en-ZA', { month: 'short' }), income: 0, expenses: 0 }));
  for (const e of thisYear(entries, now)) {
    const d = new Date(e.at), i = (d.getFullYear() - start.getFullYear()) * 12 + d.getMonth() - 2;
    if (i < 0 || i > 11) continue;
    if (e.kind === 'payment') m[i].income += e.amount; else if (e.kind === 'refund') m[i].income -= e.amount; else if (e.kind === 'expense') m[i].expenses += e.amount;
  }
  return m;
}
