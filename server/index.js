import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDb } from './db.js';
import { loadRules } from './rulesLoader.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = process.env.NODE_ENV === 'production';
const dbFile = process.env.DATABASE_PATH || path.join(root, 'data', 'taxsafe.db');

function getSecret() { // the key that signs login tickets
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (production) throw new Error('Set SESSION_SECRET in production (any long random string).');
  const f = path.join(root, 'data', '.secret'); fs.mkdirSync(path.dirname(f), { recursive: true });
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'));
  return fs.readFileSync(f, 'utf8');
}

const db = openDb(dbFile);
const app = createApp({ db, secret: getSecret(), getRules: () => loadRules(), production, distDir: path.join(root, 'client', 'dist') });
const port = process.env.PORT || 4999;
const server = app.listen(port, () => console.log(`TaxSafe on http://localhost:${port}`));
const stop = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGTERM', stop); process.on('SIGINT', stop);
