import { money } from './util.js';
// A plain SVG bar chart: income and expenses for each month of the tax year (March to February).
export default function Chart({ monthly }) {
  const max = Math.max(1, ...monthly.flatMap(m => [m.income, m.expenses]));
  const h = v => Math.max(0, (Math.max(0, v) / max) * 90);
  const total = monthly.reduce((s, m) => s + Math.abs(m.income) + m.expenses, 0);
  if (!total) return <p className="empty">Your monthly chart appears once you log something.</p>;
  return <svg viewBox="0 0 372 126" className="chart" role="img" aria-label="Income and expenses by month">
    {monthly.map((m, i) => <g key={i} transform={`translate(${i * 31 + 4} 0)`}>
      <title>{`${m.label}: income ${money(m.income)}, expenses ${money(m.expenses)}`}</title>
      <rect className="bar-in" x="2" y={100 - h(m.income)} width="11" height={h(m.income)} rx="2" />
      <rect className="bar-ex" x="15" y={100 - h(m.expenses)} width="11" height={h(m.expenses)} rx="2" />
      <text x="14" y="118" textAnchor="middle">{m.label}</text></g>)}
  </svg>;
}
