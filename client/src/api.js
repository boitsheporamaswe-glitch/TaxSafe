const call = async (method, url, body) => {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  if (!res.ok) { const err = new Error((await res.json().catch(() => ({}))).error || res.statusText); err.status = res.status; throw err; }
  return res.status === 204 ? null : res.json();
};
export const api = {
  demo: false,
  state: () => call('GET', '/api/state'),
  signup: (email, password) => call('POST', '/api/auth/signup', { email, password }),
  login: (email, password) => call('POST', '/api/auth/login', { email, password }),
  logout: () => call('POST', '/api/auth/logout'),
  deleteAccount: () => call('DELETE', '/api/account'),
  saveProfile: p => call('PUT', '/api/profile', p),
  add: entry => call('POST', '/api/entries', entry),
  bulk: entries => call('POST', '/api/entries/bulk', { entries }),
  remove: id => call('DELETE', `/api/entries/${id}`),
  preview: (kind, amount) => call('POST', '/api/preview', { kind, amount }),
  exportCsv: () => { window.location.href = '/api/export.csv'; },
};
