import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

async function tsModule(path, replacements = []) {
  let source = await readFile(new URL(path, import.meta.url), 'utf8');
  for (const [search, replace] of replacements) source = source.replace(search, replace);
  return `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
}

const datesUrl = await tsModule('../src/app/lib/transactionDates.ts');
const datesImport = `await import(${JSON.stringify(datesUrl)})`;
const totalsUrl = await tsModule('../src/app/lib/actualTransactionTotals.ts', [
  ['import type { MonthlyAmount } from "../data/data";', ''],
  ['import type { Transaction as SupabaseTransaction } from "../../types/supabase";', ''],
  ['import { parseTransactionDate } from "./transactionDates";', `const { parseTransactionDate } = ${datesImport};`],
]);
const categoriesUrl = await tsModule('../src/app/lib/actualTransactionCategories.ts', [
  ['import type { Category, SupabaseTransactionType, Transaction } from "../../types/supabase";', ''],
  ['import { parseTransactionDate } from "./transactionDates";', `const { parseTransactionDate } = ${datesImport};`],
]);
const snapshotUrl = await tsModule('../src/app/lib/snapshotActuals.ts', [
  ['import type { Category, Transaction } from "../../types/supabase";', ''],
  ['import { getActualCategoryBreakdown } from "./actualTransactionCategories";', `const { getActualCategoryBreakdown } = await import(${JSON.stringify(categoriesUrl)});`],
  ['import { getActualTransactionMonths } from "./actualTransactionTotals";', `const { getActualTransactionMonths } = await import(${JSON.stringify(totalsUrl)});`],
  ['import { filterTransactionsByMonth, filterTransactionsByYear, transactionMonthIndex } from "./transactionDates";', `const { filterTransactionsByMonth, filterTransactionsByYear, transactionMonthIndex } = ${datesImport};`],
]);
const { getSupabaseSnapshotActuals } = await import(snapshotUrl);

const row = (id, type, amount, date, category_id = null) => ({
  id, user_id: 'owner-a', type, amount, title: id, transaction_date: date,
  category_id, payment_method_id: null, notes: null, source: 'manual', is_recurring: false,
  recurring_group_id: null, description: null, created_at: `${date}T12:00:00Z`, updated_at: `${date}T12:00:00Z`,
});

test('snapshot actuals use Supabase types, selected period, UUID labels and actual-only transaction count', () => {
  const rows = [
    row('paycheck', 'income', 5000, '2026-01-01'),
    row('groceries-a', 'expense', 100, '2026-01-31', 'food-id'),
    row('groceries-b', 'expense', 25, '2026-01-05', 'food-id'),
    row('unassigned', 'expense', 10, '2026-02-02'),
    row('savings', 'savings', 800, '2026-02-28'),
    row('debt', 'debt', 400, '2026-12-31'),
    row('prior-year', 'income', 90000, '2025-12-31'),
    { name: 'legacy actual sentinel', amount: 987654, type: 'income', date: '2026-01-10' },
  ];
  const categories = [{ id: 'food-id', user_id: 'owner-a', name: 'Food', type: 'expense', is_archived: true }];
  const actuals = getSupabaseSnapshotActuals(rows, categories, '2026', 'owner-a');
  assert.equal(actuals.snapshot_version, 2);
  assert.equal(actuals.actual_source, 'supabase');
  assert.equal(actuals.expected_source, 'local');
  assert.equal(actuals.snapshot_owner_id, 'owner-a');
  assert.equal(actuals.transactionCount, 6);
  assert.equal(actuals.monthlyTransactionCounts[0], 3);
  assert.equal(actuals.monthlyTransactionCounts[1], 2);
  assert.equal(actuals.monthly[0].income, 5000);
  assert.equal(actuals.monthly[0].expenses, 125);
  assert.equal(actuals.monthly[1].savings, 800);
  assert.equal(actuals.monthly[11].debt, 400);
  assert.equal(actuals.monthly[0].income - actuals.monthly[0].expenses - actuals.monthly[0].savings - actuals.monthly[0].debt, 4875);
  assert.deepEqual(actuals.monthlyCategoryBreakdowns[0], [{ category: 'Food', amount: 125 }]);
  assert.deepEqual(actuals.monthlyCategoryBreakdowns[1], [{ category: 'Not assigned', amount: 10 }]);
  assert.equal(actuals.yearlyCategoryBreakdowns[0].category, 'Food');
  assert.ok(actuals.monthly.every(month => month.income !== 987654));
});

test('empty authenticated account produces valid zero actuals and counts', () => {
  const actuals = getSupabaseSnapshotActuals([], [], 2026, 'owner-empty');
  assert.equal(actuals.transactionCount, 0);
  assert.ok(actuals.monthlyTransactionCounts.every(count => count === 0));
  assert.ok(actuals.monthly.every(month => month.income === 0 && month.expenses === 0 && month.savings === 0 && month.debt === 0));
  assert.ok(actuals.monthlyCategoryBreakdowns.every(breakdown => breakdown.length === 0));
});
