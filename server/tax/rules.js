// Pick the rules file whose dates cover today. If none does (a new tax year started and nobody added its file),
// fall back to the newest one and flag it as stale so the screen can warn the user.
export function pickRules(all, now = new Date()) {
  const sorted = [...all].sort((a, b) => a.from.localeCompare(b.from));
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; // local date, so the tax year turns over at South African midnight
  const current = sorted.find(r => r.from <= iso && iso <= r.to);
  return current ? { ...current, stale: false } : { ...sorted[sorted.length - 1], stale: true };
}
