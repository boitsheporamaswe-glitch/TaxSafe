import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DEFAULT_PROFILE = { annualGross: 360000, annualExpenses: 0, annualRA: 0, onboarded: false };

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, profile TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      at INTEGER NOT NULL, kind TEXT NOT NULL, amount REAL NOT NULL, rate REAL, category TEXT, description TEXT NOT NULL DEFAULT '');
    CREATE INDEX IF NOT EXISTS idx_entries_user_at ON entries(user_id, at DESC);`);

  const parse = u => u && { ...u, profile: JSON.parse(u.profile) };
  const q = {
    insertUser: db.prepare('INSERT INTO users (id, email, pass_hash, profile, created_at) VALUES (?, ?, ?, ?, ?)'),
    byEmail: db.prepare('SELECT * FROM users WHERE email = ?'), byId: db.prepare('SELECT * FROM users WHERE id = ?'),
    setProfile: db.prepare('UPDATE users SET profile = ? WHERE id = ?'),
    list: db.prepare('SELECT id, at, kind, amount, rate, category, description FROM entries WHERE user_id = ? ORDER BY at DESC'),
    insertEntry: db.prepare('INSERT INTO entries (id, user_id, at, kind, amount, rate, category, description) VALUES (@id, @user_id, @at, @kind, @amount, @rate, @category, @description)'),
    delEntry: db.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?'), delUser: db.prepare('DELETE FROM users WHERE id = ?'),
  };
  const insertMany = db.transaction((uid, es) => { for (const e of es) q.insertEntry.run({ rate: null, category: null, ...e, user_id: uid }); });
  const clean = r => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null));
  return {
    createUser: (email, passHash) => { const id = globalThis.crypto.randomUUID(); q.insertUser.run(id, email, passHash, JSON.stringify(DEFAULT_PROFILE), Date.now()); return parse(q.byId.get(id)); },
    userByEmail: email => parse(q.byEmail.get(email)), userById: id => parse(q.byId.get(id)),
    setProfile: (id, profile) => q.setProfile.run(JSON.stringify(profile), id),
    listEntries: uid => q.list.all(uid).map(clean),
    addEntries: (uid, es) => insertMany(uid, es),
    deleteEntry: (uid, id) => q.delEntry.run(id, uid).changes > 0,
    deleteUser: id => q.delUser.run(id),
    close: () => db.close(),
  };
}
