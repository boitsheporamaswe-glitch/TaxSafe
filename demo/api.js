// Copied over client/src/api.js by demo/build.mjs. Same rules and maths as the server, running in the browser.
import rules from '../../server/tax/rules/za-2027.json';
import { estimate } from '../../server/tax/engine.js';
import { previewFor, makeEntry } from '../../server/tax/ledger.js';
import { buildSnapshot } from '../../server/tax/snapshot.js';
import { toCsv } from '../../server/tax/csv.js';
const KEY = 'taxsafe-demo-v4', R = { ...rules, stale: false };
const def = () => ({ profile: { annualGross: 360000, annualExpenses: 0, annualRA: 0, onboarded: false }, entries: [] });
const read = () => { try { return { ...def(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch (e) { return def(); } };
let db = read();
const subs = new Set();
export const snapshot = () => buildSnapshot({ user: { email: 'Demo mode: saved in this browser only' }, profile: db.profile,
  entries: [...db.entries].sort((a, b) => b.at - a.at), rules: R });
const commit = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} subs.forEach(f => f(snapshot())); return snapshot(); };
export const subscribe = f => { subs.add(f); return () => subs.delete(f); };
export const reload = () => { db = read(); subs.forEach(f => f(snapshot())); };
const n = v => Math.min(1e9, Math.max(0, +v || 0));
export const api = {
  demo: true, KEY,
  state: async () => snapshot(),
  saveProfile: async p => { db.profile = { annualGross: n(p.annualGross), annualExpenses: n(p.annualExpenses), annualRA: n(p.annualRA), onboarded: p.onboarded === true || db.profile.onboarded }; return commit(); },
  add: async e => { db.entries.unshift(makeEntry(e, estimate(db.profile, R).rate)); return commit(); },
  bulk: async es => { const rate = estimate(db.profile, R).rate; db.entries.unshift(...es.map(e => makeEntry(e, rate))); return commit(); },
  remove: async id => { db.entries = db.entries.filter(e => e.id !== id); return commit(); },
  preview: async (kind, amount) => previewFor({ profile: db.profile, entries: db.entries }, R, { kind, amount }),
  exportCsv: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([toCsv(db.entries)], { type: 'text/csv' })); a.download = 'taxsafe-demo.csv'; a.click(); },
};
