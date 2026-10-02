import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const datesSource = await readFile(new URL('../src/app/lib/transactionDates.ts', import.meta.url), 'utf8');
const datesUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(datesSource)).toString('base64')}`;
const source = await readFile(new URL('../src/app/lib/actualTransactionTotals.ts', import.meta.url), 'utf8');
const runnable = source.replace('import { parseTransactionDate } from "./transactionDates";',
  `const { parseTransactionDate } = await import(${JSON.stringify(datesUrl)});`);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(runnable)).toString('base64')}`;
const { getActualTransactionMonths, getActualTransactionTotals, getActualTransactionYearTotals, amountLeftForActualMonth } = await import(moduleUrl);

const tx = (type, amount, date, id = `${type}-${date}`) => ({
  id, user_id: 'owner-a', type, amount, title: id, transaction_date: date,
  category_id: null, payment_method_id: null, notes: null, source: 'manual',
  is_recurring: false, recurring_group_id: null, description: null,
  created_at: `${date}T12:00:00Z`, updated_at: `${date}T12:00:00Z`,
});

test('actual totals use Supabase transaction types and preserve Amount Left rule', () => {
  const rows = [tx('income', 5000, '2026-09-01'), tx('expense', 1100, '2026-09-30'),
    tx('savings', 800, '2026-09-15'), tx('debt', 400, '2026-09-20')];
  assert.deepEqual(getActualTransactionTotals(rows, 2026, 8), {
    income: 5000, expense: 1100, savings: 800, debt: 400, amountLeft: 2700,
  });
});

test('monthly series filters by selected year/month and respects calendar boundaries and leap days', () => {
  const rows = [
    tx('income', 10, '2025-12-31'), tx('income', 20, '2026-01-01'),
    tx('expense', 3, '2026-01-31'), tx('savings', 5, '2026-02-28'),
    tx('debt', 7, '2024-02-29'), tx('income', 11, '2026-12-31'),
    tx('income', 100000, '2026-02-30', 'invalid'),
    { name: 'Legacy local sentinel', amount: 987654, date: '2026-01-15', type: 'income' },
  ];
  const months = getActualTransactionMonths(rows, 2026);
  assert.equal(months.length, 12);
  assert.equal(months[0].income, 20);
  assert.equal(months[0].expenses, 3);
  assert.equal(months[1].savings, 5);
  assert.equal(months[11].income, 11);
  assert.equal(months.reduce((sum, month) => sum + month.income, 0), 31);
  assert.equal(amountLeftForActualMonth(months[0]), 17);
  assert.equal(getActualTransactionTotals(rows, 2024, 1).debt, 7);
});

test('empty authenticated history produces zero-valued totals and 12 zero months', () => {
  const months = getActualTransactionMonths([], 2026);
  assert.equal(months.length, 12);
  assert.ok(months.every(month => month.income === 0 && month.expenses === 0 && month.savings === 0 && month.debt === 0));
  assert.deepEqual(getActualTransactionTotals([], 2026, 0), {
    income: 0, expense: 0, savings: 0, debt: 0, amountLeft: 0,
  });
});

test('annual totals reduce the shared monthly series and preserve the Amount Left formula', () => {
  const rows = [
    tx('income', 1200, '2026-01-01'), tx('expense', 300, '2026-01-31'),
    tx('savings', 200, '2026-02-28'), tx('debt', 100, '2026-12-31'),
    tx('income', 987654, '2025-12-31'),
  ];
  const totals = getActualTransactionYearTotals(getActualTransactionMonths(rows, 2026));
  assert.deepEqual(totals, { income: 1200, expense: 300, savings: 200, debt: 100, amountLeft: 600 });
  assert.deepEqual(getActualTransactionYearTotals(getActualTransactionMonths([], 2026)), {
    income: 0, expense: 0, savings: 0, debt: 0, amountLeft: 0,
  });
});
