import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = await readFile(new URL('../src/app/lib/selectableCategories.ts', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
const { getSelectableCategories } = await import(moduleUrl);
const categories = ['income', 'expense', 'savings', 'debt'].flatMap((type) => [
  { id: `${type}-active`, type, is_archived: false },
  { id: `${type}-legacy-null`, type, is_archived: null },
  { id: `${type}-archived`, type, is_archived: true },
]);

test('selectable categories match the requested backend type and exclude archived rows', () => {
  for (const type of ['income', 'expense', 'savings', 'debt']) {
    assert.deepEqual(getSelectableCategories(categories, type).map((category) => category.id), [`${type}-active`, `${type}-legacy-null`]);
    assert.ok(getSelectableCategories(categories, type).every((category) => category.type === type));
  }
});

test('selectable results preserve backend UUID identity', () => {
  const result = getSelectableCategories(categories, 'expense');
  assert.deepEqual(result.map((category) => category.id), ['expense-active', 'expense-legacy-null']);
});
