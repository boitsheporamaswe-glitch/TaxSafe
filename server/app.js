import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { estimate } from './tax/engine.js';
import { previewFor, makeEntry, KINDS } from './tax/ledger.js';
import { buildSnapshot } from './tax/snapshot.js';
import { toCsv } from './tax/csv.js';
import { hashPassword, verifyPassword, signToken, verifyToken, parseCookies } from './auth.js';

const COOKIE = 'tj';
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export function createApp({ db, secret, getRules, production = false, distDir, authLimit = 20 }) {
  const app = express();
  if (production) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ['https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], upgradeInsecureRequests: null } } }));
  app.use(express.json({ limit: '1mb' }));

  // Block cross-site writes: a browser always tells us where a request came from.
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (req.method !== 'GET' && origin && new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'cross-site request blocked' });
    next();
  });

  const streams = new Map(); // user id -> open live connections
  const snapshotFor = u => buildSnapshot({ user: { email: u.email }, profile: u.profile, entries: db.listEntries(u.id), rules: getRules() });
  const push = u => { const msg = `data: ${JSON.stringify(snapshotFor(u))}\n\n`; streams.get(u.id)?.forEach(r => r.write(msg)); };

  const requireAuth = (req, res, next) => {
    const uid = verifyToken(parseCookies(req.headers.cookie)[COOKIE], secret);
    const user = uid && db.userById(uid);
    if (!user) return res.status(401).json({ error: 'please sign in' });
    req.user = user; next();
  };
  const startSession = (res, user) => res.cookie(COOKIE, signToken(user.id, secret), { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 30 * 864e5 });

  // ---- accounts
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: authLimit, standardHeaders: true, legacyHeaders: false, message: { error: 'too many attempts, try again later' } });
  const dummy = hashPassword('not-a-real-password'); // so a wrong email takes as long as a wrong password
  app.post('/api/auth/signup', limiter, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase(), pw = String(req.body?.password || '');
    if (!EMAIL.test(email)) return res.status(400).json({ error: 'enter a valid email address' });
    if (pw.length < 8 || pw.length > 200) return res.status(400).json({ error: 'password must be at least 8 characters' });
    if (db.userByEmail(email)) return res.status(409).json({ error: 'an account with that email already exists' });
    const user = db.createUser(email, await hashPassword(pw));
    startSession(res, user); res.status(201).json(snapshotFor(user));
  });
  app.post('/api/auth/login', limiter, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase(), pw = String(req.body?.password || '');
    const user = db.userByEmail(email);
    const ok = await verifyPassword(pw, user ? user.pass_hash : await dummy);
    if (!user || !ok) return res.status(401).json({ error: 'wrong email or password' });
    startSession(res, user); res.json(snapshotFor(user));
  });
  app.post('/api/auth/logout', (_q, res) => { res.clearCookie(COOKIE); res.status(204).end(); });
  app.delete('/api/account', requireAuth, (req, res) => { db.deleteUser(req.user.id); streams.delete(req.user.id); res.clearCookie(COOKIE); res.status(204).end(); });

  // ---- data (everything below needs a signed-in user and only ever touches that user's rows)
  app.get('/api/healthz', (_q, res) => res.json({ ok: true }));
  app.get('/api/state', requireAuth, (req, res) => res.json(snapshotFor(req.user)));

  app.get('/api/events', requireAuth, (req, res) => { // Server-Sent Events: changes are pushed to every open tab of this user
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders(); res.write(`data: ${JSON.stringify(snapshotFor(req.user))}\n\n`);
    const set = streams.get(req.user.id) || streams.set(req.user.id, new Set()).get(req.user.id); set.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { set.delete(res); clearInterval(ping); });
  });

  app.put('/api/profile', requireAuth, (req, res) => {
    const n = k => Math.min(1e9, Math.max(0, +req.body?.[k] || 0));
    req.user.profile = { annualGross: n('annualGross'), annualExpenses: n('annualExpenses'), annualRA: n('annualRA'), onboarded: req.body?.onboarded === true || req.user.profile.onboarded };
    db.setProfile(req.user.id, req.user.profile); push(req.user); res.json(snapshotFor(req.user));
  });

  const bad = (res, e) => res.status(400).json({ error: e.message });
  app.post('/api/entries', requireAuth, (req, res) => {
    let entry; try { entry = makeEntry(req.body || {}, estimate(req.user.profile, getRules()).rate); } catch (e) { return bad(res, e); }
    db.addEntries(req.user.id, [entry]); push(req.user); res.status(201).json(snapshotFor(req.user));
  });
  app.post('/api/entries/bulk', requireAuth, (req, res) => { // used by the CSV import
    const list = req.body?.entries;
    if (!Array.isArray(list) || !list.length || list.length > 500) return res.status(400).json({ error: 'send between 1 and 500 entries' });
    const rate = estimate(req.user.profile, getRules()).rate, built = [];
    for (const [i, row] of list.entries()) { try { built.push(makeEntry(row, rate)); } catch (e) { return bad(res, new Error(`row ${i + 1}: ${e.message}`)); } }
    db.addEntries(req.user.id, built); push(req.user); res.status(201).json(snapshotFor(req.user));
  });
  app.delete('/api/entries/:id', requireAuth, (req, res) => { db.deleteEntry(req.user.id, req.params.id); push(req.user); res.json(snapshotFor(req.user)); });

  app.post('/api/preview', requireAuth, (req, res) => { // "what if I logged this?", saves nothing
    const kind = KINDS.includes(req.body?.kind) ? req.body.kind : 'payment';
    res.json(previewFor({ profile: req.user.profile, entries: db.listEntries(req.user.id) }, getRules(), { kind, amount: Math.max(0, +req.body?.amount || 0) }));
  });

  app.get('/api/export.csv', requireAuth, (req, res) => {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="taxsafe-${new Date().toISOString().slice(0, 10)}.csv"` });
    res.send(toCsv(db.listEntries(req.user.id)));
  });

  app.use('/api', (_q, res) => res.status(404).json({ error: 'not found' }));
  if (distDir && fs.existsSync(distDir)) { app.use(express.static(distDir)); app.get('*', (_q, res) => res.sendFile(path.join(distDir, 'index.html'))); }
  app.use((err, _q, res, _n) => { // never leak internals
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON' });
    console.error(err); res.status(500).json({ error: 'something went wrong' });
  });
  return app;
}
