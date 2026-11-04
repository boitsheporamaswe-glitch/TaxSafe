// Turns a bank-statement CSV into entries: money in becomes a payment, money out becomes an expense.
const split = line => { const out = []; let cur = '', q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
  return [...out, cur].map(s => s.trim()); };
const toNumber = s => { s = String(s).replace(/[R\s]/g, ''); if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.'); return parseFloat(s.replace(/,/g, '')); };

export function parseBankCsv(text, now = Date.now()) {
  const lines = String(text).split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { rows: [], skipped: 0 };
  const head = split(lines[0]).map(h => h.toLowerCase());
  const has = head.some(h => /date|desc|amount/.test(h));
  const col = (re, fallback) => { const i = head.findIndex(h => re.test(h)); return has && i >= 0 ? i : fallback; };
  const [iDate, iDesc, iAmt] = [col(/date/, 0), col(/desc|narr|detail|reference/, 1), col(/amount/, 2)];
  const rows = []; let skipped = 0;
  for (const line of lines.slice(has ? 1 : 0)) {
    const c = split(line), n = toNumber(c[iAmt]);
    if (!Number.isFinite(n) || n === 0) { skipped++; continue; }
    const row = { kind: n > 0 ? 'payment' : 'expense', amount: Math.abs(n), description: (c[iDesc] || '').slice(0, 80) };
    const t = Date.parse(c[iDate]); if (Number.isFinite(t) && t <= now) row.at = t;
    rows.push(row);
  }
  return { rows, skipped };
}
