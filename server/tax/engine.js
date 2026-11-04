// South Africa, individual under 65, no medical credits (conservative). Swap the rules file for another country/year.
export function bracketTax(taxable, brackets) {
  let tax = 0, prev = 0;
  for (const [cap, rate] of brackets) {
    const top = cap === null ? Infinity : cap;
    if (taxable > prev) tax += (Math.min(taxable, top) - prev) * rate;
    prev = top;
  }
  return tax;
}
const afterRebate = (x, r) => Math.max(0, bracketTax(Math.max(0, x), r.brackets) - r.primaryRebate);
// Tax this one payment adds on top of what you have logged so far this tax year (progressive, rebate applied).
export function ytdMarginal({ ytdNet, amount, expense = 0 }, r) {
  const tax = afterRebate(ytdNet + amount - expense, r) - afterRebate(ytdNet, r);
  return { ytdNet, tax, pct: amount > 0 ? tax / amount : 0 };
}
// South African tax year starts 1 March.
export function taxYearStart(d = new Date()) { return new Date(d.getMonth() >= 2 ? d.getFullYear() : d.getFullYear() - 1, 2, 1); }
export function marginalRate(taxable, brackets) {
  for (const [cap, rate] of brackets) if (cap === null || taxable <= cap) return rate;
}
export function estimate({ annualGross = 0, annualExpenses = 0, annualRA = 0, buffer = 0.02 }, r) {
  const gross = Math.max(0, +annualGross || 0);
  if (!gross) return { rate: 0, gross: 0 };
  const net = Math.max(0, gross - (+annualExpenses || 0));
  const ra = Math.min(Math.max(0, +annualRA || 0), r.retirementPct * net, r.retirementCap);
  const taxBefore = bracketTax(Math.max(0, net - ra), r.brackets);
  const rebate = Math.min(r.primaryRebate, taxBefore);
  const tax = taxBefore - rebate;
  const marginal = taxBefore <= rebate ? 0 : marginalRate(Math.max(0, net - ra), r.brackets); // the rebate covers the first slice
  return { gross, net, ra, taxBefore, rebate, tax, marginal, rate: Math.min(0.6, tax / gross + buffer) };
}

// Tax saved by claiming `logged` rand of business expenses, on top of the projected profit (progressive, rebate applied).
export function expenseRelief(profile, r, logged) {
  const { net = 0, ra = 0 } = estimate(profile, r);
  const base = Math.max(0, net - ra);
  return afterRebate(base, r) - afterRebate(base - Math.max(0, logged), r);
}
