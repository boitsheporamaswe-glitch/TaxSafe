import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickRules } from './tax/rules.js';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tax/rules');
// Drop a new za-YYYY.json file in the folder and it is used automatically when its tax year starts.
export const loadRules = (now = new Date()) =>
  pickRules(fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))), now);
