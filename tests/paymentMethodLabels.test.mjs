import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = await readFile(new URL('../src/app/lib/paymentMethodLabels.ts', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`;
const { resolvePaymentMethodLabel } = await import(moduleUrl);
const method = (overrides = {}) => ({ id: 'method-a', user_id: 'owner-a', nickname: 'Archive Checking', type: 'checking', institution_name: null, last4: null, network: null, color_theme: null, is_default: true, is_archived: true, is_linked: false, sort_order: 1, created_at: null, updated_at: null, ...overrides });

test('resolved payment methods display the backend nickname without legacy type coercion', () => {
  assert.equal(resolvePaymentMethodLabel('method-a', [method({ type: 'digital_wallet' })]), 'Archive Checking');
});

test('null and unresolved payment-method IDs use neutral labels', () => {
  assert.equal(resolvePaymentMethodLabel(null, []), 'Not assigned');
  assert.equal(resolvePaymentMethodLabel('missing-id', []), 'Unknown payment method');
});

test('payment-method loading and errors use neutral non-fabricated labels', () => {
  assert.equal(resolvePaymentMethodLabel('method-a', [], true), 'Loading payment method…');
  assert.equal(resolvePaymentMethodLabel('method-a', [], false, true), 'Payment method unavailable');
});

test('archived status and default metadata do not hide or rewrite a historical label', () => {
  assert.equal(resolvePaymentMethodLabel('method-a', [method()]), 'Archive Checking');
});
