import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { estimate, bracketTax, ytdMarginal, taxYearStart, expenseRelief } from '../tax/engine.js';
import { totalsOf, previewFor, makeEntry, monthlyOf } from '../tax/ledger.js';
import { provisional } from '../tax/provisional.js';
import { pickRules } from '../tax/rules.js';
import { toCsv } from '../tax/csv.js';
const r = JSON.parse(fs.readFileSync(new URL('../tax/rules/za-2027.json', import.meta.url), 'utf8'));
const NOW = new Date(2026, 10, 3), IN_YEAR = new Date(2026, 5, 1).getTime();
const profile = { annualGross: 600000, annualExpenses: 60000, annualRA: 0 };

test('R540 000 profit gives R111 307 tax after the primary rebate', () => {
  assert.equal(Math.round(estimate({ annualGross: 600000, annualExpenses: 60000 }, r).tax), 111307);
});
test('below the tax threshold only the safety margin is set aside', () => {
  const e = estimate({ annualGross: 100000, annualExpenses: 20000 }, r);
  assert.equal(e.tax, 0); assert.ok(Math.abs(e.rate - 0.02) < 1e-9);
});
test('bracket edges are continuous', () => {
  assert.equal(Math.round(bracketTax(383100, r.brackets)), 79998);
  assert.equal(Math.round(bracketTax(695800, r.brackets)), 185215);
});
test('top bracket is 36% at R540 000 profit and 0% under the threshold', () => {
  assert.equal(estimate(profile, r).marginal, 0.36);
  assert.equal(estimate({ annualGross: 100000, annualExpenses: 20000 }, r).marginal, 0);
});
test('retirement annuity lowers tax and is capped at 27.5% of profit', () => {
  const base = estimate({ annualGross: 600000 }, r), ra = estimate({ annualGross: 600000, annualRA: 1e6 }, r);
  assert.ok(ra.tax < base.tax); assert.equal(ra.ra, 0.275 * 600000);
});
test('a first payment is shielded by the rebate; later ones are taxed at the top bracket', () => {
  assert.equal(Math.round(ytdMarginal({ ytdNet: 0, amount: 100000 }, r).tax), 180);
  assert.equal(Math.round(ytdMarginal({ ytdNet: 540000, amount: 10000 }, r).tax), 3600);
});
test('the tax year starts on 1 March', () => {
  for (const [d, y] of [[[2026, 10, 3], 2026], [[2027, 0, 15], 2026], [[2026, 2, 1], 2026], [[2026, 1, 28], 2025]])
    assert.equal(taxYearStart(new Date(...d)).getFullYear(), y);
});
test('R20 000 of expenses saves R6 690 tax, crossing from the 36% into the 31% bracket', () => {
  assert.equal(Math.round(expenseRelief(profile, r, 20000)), 6690);
});
test('petrol lowers the tax pot, so the safe balance falls by less than the amount spent', () => {
  const pay = { kind: 'payment', at: IN_YEAR, amount: 10000, rate: 0.2 };
  const before = totalsOf([pay], profile, r, NOW);
  const after = totalsOf([{ kind: 'expense', at: IN_YEAR, amount: 1000, category: 'Petrol' }, pay], profile, r, NOW);
  assert.equal(Math.round(before.safe), 8000);
  assert.equal(Math.round(after.relief), 360); assert.equal(Math.round(after.safe), 7360);
});
test('a refund hands back the tax set aside on the money returned', () => {
  const t = totalsOf([{ kind: 'refund', at: IN_YEAR, amount: 2000, rate: 0.2 }, { kind: 'payment', at: IN_YEAR, amount: 10000, rate: 0.2 }], profile, r, NOW);
  assert.equal(t.income, 8000); assert.equal(Math.round(t.taxPot), 1600); assert.equal(Math.round(t.safe), 6400);
});
test('entries from earlier tax years are ignored', () => {
  const old = [{ kind: 'payment', at: new Date(2025, 5, 1).getTime(), amount: 900000, rate: 0.2 }];
  assert.equal(totalsOf(old, profile, r, NOW).income, 0);
  assert.equal(previewFor({ profile, entries: old }, r, { kind: 'payment', amount: 1000 }, NOW).ytd.ytdNet, 0);
});

test('provisional tax: two instalments, next one counts down in days', () => {
  const p = provisional(60000, new Date(2026, 10, 3));
  assert.deepEqual(p.due.map(d => d.date), ['2026-08-31', '2027-02-28']);
  assert.equal(p.next.date, '2027-02-28'); assert.equal(p.next.days, 117); assert.equal(p.next.amount, 30000);
});
test('money moved to tax savings shows up as a gap or a surplus', () => {
  const es = [{ kind: 'payment', at: IN_YEAR, amount: 10000, rate: 0.2 }, { kind: 'transfer', at: IN_YEAR, amount: 500 }];
  const t = totalsOf(es, profile, r, NOW);
  assert.equal(t.saved, 500); assert.equal(Math.round(t.gap), 1500); assert.equal(Math.round(t.safe), 8000);
});
test('makeEntry validates input and only accepts a past date', () => {
  assert.throws(() => makeEntry({ amount: -5 }, 0.2), /positive/);
  assert.throws(() => makeEntry({ kind: 'bogus', amount: 5 }, 0.2), /unknown/);
  assert.throws(() => makeEntry({ amount: 5, at: Date.now() + 864e5 * 30 }, 0.2), /date/);
  assert.equal(makeEntry({ amount: 5 }, 0.2).rate, 0.2);
  assert.equal(makeEntry({ amount: 5, rate: 0.31 }, 0.2).rate, 0.31);
  assert.equal(makeEntry({ kind: 'expense', amount: 5, category: 'Nope' }, 0.2).category, 'Other');
});
test('monthly totals group the tax year from March', () => {
  const m = monthlyOf([{ kind: 'payment', at: new Date(2026, 2, 5).getTime(), amount: 100 }, { kind: 'expense', at: new Date(2026, 10, 5).getTime(), amount: 40 }], NOW);
  assert.equal(m[0].income, 100); assert.equal(m[8].expenses, 40); assert.equal(m.length, 12);
});
test('rules: picks the file for today, and flags stale when a new year has no file yet', () => {
  const all = [{ from: '2026-03-01', to: '2027-02-28', year: '2026/27' }];
  assert.equal(pickRules(all, new Date(2026, 10, 3)).stale, false);
  assert.equal(pickRules(all, new Date(2027, 5, 1)).stale, true);
});
test('csv export escapes quotes and blocks spreadsheet formulas', () => {
  const csv = toCsv([{ at: IN_YEAR, kind: 'payment', amount: 10, rate: 0.2, description: '=HYPERLINK("x")' }]);
  assert.ok(csv.includes("\"'=HYPERLINK(\"\"x\"\")\"")); assert.ok(csv.includes('2.00'));
});
