// Safe online backup of the SQLite file. Run nightly with cron: 0 2 * * * cd /app && npm run backup
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
const src = process.env.DATABASE_PATH || path.join(import.meta.dirname, '..', 'data', 'taxjar.db');
const dir = path.join(path.dirname(src), 'backups'); fs.mkdirSync(dir, { recursive: true });
const dest = path.join(dir, `taxjar-${new Date().toISOString().slice(0, 10)}.db`);
const db = new Database(src, { readonly: true });
await db.backup(dest); db.close();
for (const f of fs.readdirSync(dir).sort().slice(0, -14)) fs.unlinkSync(path.join(dir, f)); // keep the newest 14
console.log('backup written:', dest);
