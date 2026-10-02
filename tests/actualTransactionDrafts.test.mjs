import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

let source = await readFile(new URL('../src/app/lib/actualTransactionDrafts.ts', import.meta.url), 'utf8');
source = source.replace('import { isValidTransactionDate } from "./transactionDates";', `
  const isValidTransactionDate = value => {
    const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]) && Number(match[1]) > 0;
  };
`);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
const { validateActualTransactionDraft, toCreateTransactionInput } = await import(moduleUrl);

const draft = (overrides = {}) => ({
  title: 'Recorded item', amount: '12.34', type: 'expense', transaction_date: '2026-09-30',
  category_id: 'category-uuid', payment_method_id: 'method-uuid', notes: 'Paid at the store', ...overrides,
});

test('actual drafts map all backend transaction types and UUID fields without local status fields', () => {
  for (const type of ['income', 'expense', 'savings', 'debt']) {
    const input = toCreateTransactionInput(draft({ type }));
    assert.equal(input.type, type);
    assert.equal(input.title, 'Recorded item');
    assert.equal(input.amount, 12.34);
    assert.equal(input.transaction_date, '2026-09-30');
    assert.equal(input.category_id, 'category-uuid');
    assert.equal(input.payment_method_id, 'method-uuid');
    assert.equal(input.notes, 'Paid at the store');
    for (const unsupported of ['status', 'isFixed', 'expenseKind', 'dueDate', 'user_id', 'source']) {
      assert.equal(unsupported in input, false);
    }
  }
});

test('uncategorized and no-payment drafts submit nullable UUIDs and trim optional notes', () => {
  assert.deepEqual(toCreateTransactionInput(draft({ category_id: null, payment_method_id: null, notes: '  ' })), {
    title: 'Recorded item', amount: 12.34, type: 'expense', transaction_date: '2026-09-30',
    category_id: null, payment_method_id: null, notes: null,
  });
});

test('validation rejects blank title, non-positive/non-finite/excess-precision/oversize amount and invalid dates', () => {
  for (const value of ['', '0', '-1', 'Infinity', 'NaN', '1.234', '1000000000000']) {
    assert.ok(validateActualTransactionDraft(draft({ amount: value })).amount, value);
  }
  assert.ok(validateActualTransactionDraft(draft({ title: '  ' })).title);
  for (const value of ['', '2026-02-29', '2026-02-30', '2026-9-30']) {
    assert.ok(validateActualTransactionDraft(draft({ transaction_date: value })).transaction_date, value);
  }
  assert.deepEqual(validateActualTransactionDraft(draft()), {});
});
