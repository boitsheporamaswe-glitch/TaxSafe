import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBankCsv } from './csvImport.js';
test('money in is a payment, money out is an expense, junk rows are skipped', () => {
  const { rows, skipped } = parseBankCsv('Date,Description,Amount\n2026-05-01,Uber payout,"1 250,50"\n2026-05-02,Engen petrol,-300\n2026-05-03,Nothing,\n');
  assert.equal(rows.length, 2); assert.equal(skipped, 1);
  assert.deepEqual([rows[0].kind, rows[0].amount], ['payment', 1250.5]);
  assert.deepEqual([rows[1].kind, rows[1].amount, rows[1].description], ['expense', 300, 'Engen petrol']);
});
test('works without a header row and ignores future dates', () => {
  const { rows } = parseBankCsv('2099-01-01,Later,50', Date.parse('2026-11-01'));
  assert.equal(rows.length, 1); assert.equal(rows[0].at, undefined);
});
