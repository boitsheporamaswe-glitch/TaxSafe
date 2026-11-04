import { taxYearStart } from './engine.js';
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Provisional tax: two instalments per tax year, due 31 August and the last day of February.
// Assumes the first instalment is paid in full, so each is half of the projected year's tax.
export function provisional(annualTax, now = new Date()) {
  const y = taxYearStart(now).getFullYear();
  const list = [{ label: 'First provisional payment', date: new Date(y, 7, 31) }, { label: 'Second provisional payment', date: new Date(y + 1, 2, 0) }];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = list.map(d => ({ label: d.label, date: iso(d.date), amount: annualTax / 2, days: Math.round((d.date - today) / 864e5) }));
  return { due, next: due.find(d => d.days >= 0) || null };
}
