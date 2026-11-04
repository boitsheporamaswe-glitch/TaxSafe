const cell = v => { v = String(v ?? ''); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }; // ' stops spreadsheet formula injection
export function toCsv(entries) {
  const rows = [['date', 'type', 'category', 'description', 'amount_rand', 'rate_percent', 'tax_set_aside_rand']];
  for (const e of [...entries].sort((a, b) => a.at - b.at))
    rows.push([new Date(e.at).toISOString().slice(0, 10), e.kind, e.category || '', e.description, e.amount.toFixed(2),
      e.rate != null ? (e.rate * 100).toFixed(2) : '', e.rate != null && (e.kind === 'payment' || e.kind === 'refund') ? (e.amount * e.rate * (e.kind === 'refund' ? -1 : 1)).toFixed(2) : '']);
  return rows.map(r => r.map(cell).join(',')).join('\n') + '\n';
}
