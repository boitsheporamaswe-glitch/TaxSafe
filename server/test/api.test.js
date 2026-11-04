import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp } from '../app.js';
import { openDb } from '../db.js';
import { pickRules } from '../tax/rules.js';

const rules = pickRules([JSON.parse(fs.readFileSync(new URL('../tax/rules/za-2027.json', import.meta.url), 'utf8'))], new Date(2026, 10, 3));
let server, base, db;
before(async () => {
  db = openDb(':memory:');
  server = createApp({ db, secret: 'test-secret', getRules: () => rules, authLimit: 1000 }).listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(() => { server.close(); db.close(); });

const call = async (method, url, body, cookie) => {
  const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) }, body: body && JSON.stringify(body) });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, cookie: (res.headers.get('set-cookie') || '').split(';')[0], body: type.includes('json') ? await res.json() : await res.text() };
};
const signup = async email => (await call('POST', '/api/auth/signup', { email, password: 'correct horse' })).cookie;

test('data routes need a login', async () => {
  assert.equal((await call('GET', '/api/state')).status, 401);
  assert.equal((await call('POST', '/api/entries', { amount: 5 })).status, 401);
});
test('signup validates input, rejects duplicates, and never stores the password', async () => {
  assert.equal((await call('POST', '/api/auth/signup', { email: 'nope', password: 'correct horse' })).status, 400);
  assert.equal((await call('POST', '/api/auth/signup', { email: 'a@b.co', password: 'short' })).status, 400);
  assert.equal((await call('POST', '/api/auth/signup', { email: 'dup@b.co', password: 'correct horse' })).status, 201);
  assert.equal((await call('POST', '/api/auth/signup', { email: 'DUP@b.co', password: 'correct horse' })).status, 409);
  assert.ok(!db.userByEmail('dup@b.co').pass_hash.includes('correct horse'));
});
test('login works with the right password only', async () => {
  await signup('login@b.co');
  assert.equal((await call('POST', '/api/auth/login', { email: 'login@b.co', password: 'wrong password' })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { email: 'nobody@b.co', password: 'correct horse' })).status, 401);
  const ok = await call('POST', '/api/auth/login', { email: 'login@b.co', password: 'correct horse' });
  assert.equal(ok.status, 200); assert.ok(ok.cookie.startsWith('tj='));
});
test('a forged or edited login ticket is refused', async () => {
  const c = await signup('forge@b.co');
  assert.equal((await call('GET', '/api/state', null, c.slice(0, -3) + 'abc')).status, 401);
});
test('entries: log, preview does not save, undo restores, delete removes', async () => {
  const c = await signup('entries@b.co');
  assert.equal((await call('POST', '/api/preview', { kind: 'payment', amount: 1000 }, c)).body.kind, 'payment');
  assert.equal((await call('GET', '/api/state', null, c)).body.entries.length, 0);
  const added = await call('POST', '/api/entries', { kind: 'payment', amount: 1000, description: 'Uber' }, c);
  assert.equal(added.status, 201); const e = added.body.entries[0];
  const gone = await call('DELETE', `/api/entries/${e.id}`, null, c); assert.equal(gone.body.entries.length, 0);
  const back = await call('POST', '/api/entries', { kind: 'payment', amount: e.amount, at: e.at, rate: e.rate, description: e.description }, c);
  assert.equal(back.body.entries[0].rate, e.rate); assert.equal(back.body.entries[0].at, e.at);
  assert.equal((await call('POST', '/api/entries', { amount: -1 }, c)).status, 400);
});
test('users can never see or delete each other’s data', async () => {
  const a = await signup('alice@b.co'), b = await signup('bob@b.co');
  const id = (await call('POST', '/api/entries', { amount: 700 }, a)).body.entries[0].id;
  assert.equal((await call('GET', '/api/state', null, b)).body.entries.length, 0);
  await call('DELETE', `/api/entries/${id}`, null, b);
  assert.equal((await call('GET', '/api/state', null, a)).body.entries.length, 1);
});
test('bulk import is all-or-nothing', async () => {
  const c = await signup('bulk@b.co');
  assert.equal((await call('POST', '/api/entries/bulk', { entries: [{ amount: 5 }, { amount: -2 }] }, c)).status, 400);
  assert.equal((await call('GET', '/api/state', null, c)).body.entries.length, 0);
  assert.equal((await call('POST', '/api/entries/bulk', { entries: [{ amount: 5 }, { kind: 'expense', amount: 2, category: 'Petrol' }] }, c)).body.entries.length, 2);
});
test('profile saves and onboarding sticks; csv export downloads', async () => {
  const c = await signup('prof@b.co');
  const s = await call('PUT', '/api/profile', { annualGross: 600000, annualExpenses: 60000, onboarded: true }, c);
  assert.equal(Math.round(s.body.estimate.tax), 111307); assert.equal(s.body.profile.onboarded, true);
  await call('POST', '/api/entries', { amount: 10, description: '=cmd' }, c);
  const csv = await call('GET', '/api/export.csv', null, c); assert.ok(csv.body.startsWith('date,type')); assert.ok(csv.body.includes("'=cmd"));
});
test('cross-site writes and bad JSON are rejected; account deletion removes everything', async () => {
  const c = await signup('del@b.co');
  const evil = await fetch(base + '/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', Cookie: c }, body: '{"amount":5}' });
  assert.equal(evil.status, 403);
  const broken = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  assert.equal(broken.status, 400);
  assert.equal((await call('DELETE', '/api/account', null, c)).status, 204);
  assert.equal(db.userByEmail('del@b.co'), undefined);
});
