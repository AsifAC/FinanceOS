import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const source = await readFile(new URL('../src/app/lib/transactionDates.ts', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
const { parseTransactionDate, isValidTransactionDate, transactionYear, transactionMonthIndex, filterTransactionsByYear, filterTransactionsByMonth, localTransactionDate } = await import(moduleUrl);

test('calendar dates retain their year, day, and zero-based month', () => {
  assert.deepEqual(parseTransactionDate('2026-09-29'), { year: 2026, monthIndex: 8, day: 29 });
  assert.equal(transactionYear('2026-01-01'), 2026);
  assert.equal(transactionMonthIndex('2026-01-01'), 0);
  assert.equal(transactionMonthIndex('2026-12-31'), 11);
  assert.equal(isValidTransactionDate('0001-01-01'), true);
  assert.equal(isValidTransactionDate('9999-12-31'), true);
});

test('local calendar date formatter preserves the selected local day without ISO conversion', () => {
  const value = new Date(2026, 0, 2, 23, 30);
  assert.equal(localTransactionDate(value), '2026-01-02');
});

test('leap years include century rules', () => {
  for (const date of ['2024-02-29', '2000-02-29']) assert.equal(isValidTransactionDate(date), true);
  for (const date of ['2026-02-29', '1900-02-29', '2100-02-29']) assert.equal(isValidTransactionDate(date), false);
});

test('invalid dates and timestamp inputs are rejected without normalization', () => {
  for (const date of ['', '2026-2-01', '2026-02-30', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '0000-01-01', ' 2026-01-01', '2026-01-01T00:00:00Z', 'not-a-date']) {
    assert.equal(parseTransactionDate(date), null, date);
    assert.equal(transactionYear(date), null, date);
    assert.equal(transactionMonthIndex(date), null, date);
  }
});

const rows = [
  { id: 'last-year', transaction_date: '2025-12-31' },
  { id: 'jan', transaction_date: '2026-01-01' },
  { id: 'dec', transaction_date: '2026-12-31' },
  { id: 'next-year', transaction_date: '2027-01-01' },
  { id: 'invalid', transaction_date: '2026-02-30' },
];
test('year filtering excludes adjacent years and invalid dates without mutating input', () => {
  const before = JSON.stringify(rows);
  assert.deepEqual(filterTransactionsByYear(rows, 2026).map(row => row.id), ['jan', 'dec']);
  assert.equal(JSON.stringify(rows), before);
  assert.deepEqual(filterTransactionsByYear(rows, NaN), []);
});
test('month filtering uses zero-based months and the specified year', () => {
  assert.deepEqual(filterTransactionsByMonth(rows, 2026, 0).map(row => row.id), ['jan']);
  assert.deepEqual(filterTransactionsByMonth(rows, 2026, 11).map(row => row.id), ['dec']);
  for (const month of [-1, 12, 0.5, NaN]) assert.deepEqual(filterTransactionsByMonth(rows, 2026, month), []);
});
test('date parsing and filtering are identical across timezones', () => {
  const script = `const m = await import(${JSON.stringify(moduleUrl)}); console.log(JSON.stringify([m.parseTransactionDate('2026-01-01'), m.parseTransactionDate('2024-02-29'), m.filterTransactionsByMonth(${JSON.stringify(rows)}, 2026, 0)]));`;
  const results = ['UTC', 'America/New_York', 'Asia/Dhaka', 'Pacific/Kiritimati'].map(TZ =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' }).trim());
  assert.ok(results.every(result => result === results[0]));
});
