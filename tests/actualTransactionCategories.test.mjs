import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = await readFile(new URL('../src/app/lib/actualTransactionCategories.ts', import.meta.url), 'utf8');
const runnable = source
  .replace('import { parseTransactionDate } from "./transactionDates";', 'const { parseTransactionDate } = await import("' + new URL('../src/app/lib/transactionDates.ts', import.meta.url).href + '");')
  .replace('import type { Category, SupabaseCategoryType, Transaction } from "../../types/supabase";', '');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(runnable)).toString('base64')}`;
const { getActualCategoryBreakdown } = await import(moduleUrl);

const row = (id, category_id, amount, transaction_date = '2026-04-05', type = 'expense') => ({
  id, user_id: 'owner-a', type, amount, title: id, transaction_date,
  category_id, payment_method_id: null, notes: null, source: 'manual',
  is_recurring: false, recurring_group_id: null, description: null,
  created_at: `${transaction_date}T12:00:00Z`, updated_at: `${transaction_date}T12:00:00Z`,
});

test('expense breakdown groups by category UUID and resolves account category labels', () => {
  const categories = [
    { id: 'uuid-food', user_id: 'owner-a', name: 'Food', type: 'expense' },
    { id: 'uuid-travel', user_id: 'owner-a', name: 'Travel', type: 'expense' },
  ];
  const result = getActualCategoryBreakdown([
    row('one', 'uuid-food', 20), row('two', 'uuid-food', 5),
    row('three', 'uuid-travel', 30), row('four', null, 4),
    row('unknown', 'uuid-missing', 3), row('other-year', 'uuid-food', 100, '2025-04-05'),
  ], categories, 'expense', 2026);
  assert.deepEqual(result, [
    { categoryId: 'uuid-travel', category: 'Travel', amount: 30 },
    { categoryId: 'uuid-food', category: 'Food', amount: 25 },
    { categoryId: null, category: 'Not assigned', amount: 4 },
    { categoryId: 'uuid-missing', category: 'Unknown category', amount: 3 },
  ]);
});

test('breakdown excludes other transaction types and never groups by local category names', () => {
  const localShape = { name: 'Local only', amount: 987654, type: 'expense', date: '2026-04-05', category: 'Food' };
  const result = getActualCategoryBreakdown([row('income', null, 10, '2026-04-05', 'income'), localShape], [], 'expense', 2026);
  assert.deepEqual(result, []);
});

test('breakdown supports selected month and cumulative year through zero-based month indexes', () => {
  const categories = [{ id: 'uuid-food', user_id: 'owner-a', name: 'Food', type: 'expense' }];
  const result = getActualCategoryBreakdown([
    row('jan', 'uuid-food', 10, '2026-01-31'),
    row('feb', 'uuid-food', 20, '2026-02-01'),
    row('mar', 'uuid-food', 30, '2026-03-01'),
    row('next-year', 'uuid-food', 500, '2027-01-01'),
  ], categories, 'expense', 2026, undefined, 1);
  assert.deepEqual(result, [{ categoryId: 'uuid-food', category: 'Food', amount: 30 }]);
});
