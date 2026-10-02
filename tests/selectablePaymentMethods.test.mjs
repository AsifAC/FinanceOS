import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = await readFile(new URL('../src/app/lib/selectablePaymentMethods.ts', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
const { getSelectablePaymentMethods } = await import(moduleUrl);
const method = (id, overrides = {}) => ({ id, user_id: 'owner-a', nickname: id, type: 'other', institution_name: null, last4: null, network: null, color_theme: null, is_default: false, is_archived: false, is_linked: false, sort_order: 0, created_at: null, updated_at: null, ...overrides });

test('selectable methods omit archived rows and preserve backend UUID identity', () => {
  const archived = method('archived', { is_archived: true });
  const active = method('active');
  const result = getSelectablePaymentMethods([archived, active]);
  assert.deepEqual(result.map((item) => item.id), ['active']);
  assert.equal(result[0], active);
});

test('selectable methods use default then stable backend order', () => {
  const methods = [
    method('later-default', { is_default: true, sort_order: 9 }),
    method('second', { sort_order: 2 }),
    method('first', { sort_order: 1 }),
    method('earlier-default', { is_default: true, sort_order: 1 }),
  ];
  assert.deepEqual(getSelectablePaymentMethods(methods).map((item) => item.id), [
    'earlier-default', 'later-default', 'first', 'second',
  ]);
});
