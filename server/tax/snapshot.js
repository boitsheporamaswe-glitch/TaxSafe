import { estimate } from './engine.js';
import { totalsOf, monthlyOf, CATEGORIES } from './ledger.js';
import { provisional } from './provisional.js';
// Everything the screen needs, in one object. Shared by the server and the static demo so they cannot drift apart.
export function buildSnapshot({ user, profile, entries, rules, now = new Date() }) {
  const est = estimate(profile, rules);
  return { user, profile, entries: entries.slice(0, 200), estimate: est, totals: totalsOf(entries, profile, rules, now),
    monthly: monthlyOf(entries, now), provisional: provisional(est.tax || 0, now), categories: CATEGORIES,
    rules: { country: rules.country, year: rules.year, verifiedOn: rules.verifiedOn, stale: !!rules.stale, changelog: rules.changelog || [] } };
}
