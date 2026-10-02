import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = await readFile(new URL('../src/app/lib/categoryLabels.ts', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
const { resolveCategoryLabel } = await import(moduleUrl);
const category = (overrides = {}) => ({ id: 'category-a', user_id: 'owner-a', name: 'Historic Salary', type: 'income', icon: null, color: null, sort_order: 1, is_default: false, is_archived: true, created_at: null, updated_at: null, ...overrides });

test('null and unresolved category references use neutral labels', () => {
  assert.equal(resolveCategoryLabel(null, []), 'Not assigned');
  assert.equal(resolveCategoryLabel('missing-id', []), 'Unknown category');
  assert.notEqual(resolveCategoryLabel('missing-id', []), 'Uncategorized');
});

test('loaded and archived Supabase category names resolve for historical display', () => {
  assert.equal(resolveCategoryLabel('category-a', [category()]), 'Historic Salary');
});

test('category loading is neutral and does not fabricate a name', () => {
  assert.equal(resolveCategoryLabel('category-a', [], true), 'Loading category…');
});
