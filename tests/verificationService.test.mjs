import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

let sequence = 0;
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}#${sequence++}`);
const utils = await importSource((await readFile(new URL('../src/lib/verification.ts', import.meta.url), 'utf8')).replaceAll('import.meta.env.VITE_EMAIL_OTP_READY', '"true"').replaceAll('import.meta.env.VITE_PHONE_OTP_READY', '"true"'));
async function authService(auth, delivery = { email: true, phone: true }) {
  globalThis.verificationMock = { auth };
  globalThis.verificationUtils = { ...utils, verificationDelivery: delivery };
  const source = await readFile(new URL('../src/services/authService.ts', import.meta.url), 'utf8');
  const service = await importSource(source.replace('import { supabase } from "../lib/supabaseClient";', 'const supabase = globalThis.verificationMock;').replace(/import \{ normalizePhone[^\n]+\n/, 'const { normalizePhone, verificationDelivery } = globalThis.verificationUtils;\n'));
  delete globalThis.verificationMock; delete globalThis.verificationUtils;
  return service;
}
const user = { id: 'owner', email: 'owner@example.com' };
const getUser = async () => ({ data: { user }, error: null });
test('E.164 normalization rejects ambiguous local numbers and invalid lengths', () => {
  assert.equal(utils.normalizePhone('+1 (212) 555-1234'), '+12125551234');
  for (const value of ['2125551234', '+0123456789', '+123', '+1234567890123456', '+1abc23456789']) assert.equal(utils.normalizePhone(value), null);
  assert.equal(utils.maskEmail(user.email), 'o••••@example.com');
});
test('email OTP uses current identity and cannot create another account', async () => {
  let payload;
  const service = await authService({ getUser, signInWithOtp: async p => { payload = p; return { error: null }; } });
  assert.equal((await service.requestVerification('email')).ok, true);
  assert.deepEqual(payload, { email: user.email, options: { shouldCreateUser: false } });
});
test('phone change requests use updateUser and reject invalid input before sending', async () => {
  const calls = [];
  const service = await authService({ getUser, updateUser: async p => { calls.push(p); return { error: null }; } });
  assert.equal((await service.requestVerification('phone', '2125551234')).error.code, 'invalid_phone');
  assert.equal((await service.requestVerification('phone', '+1 (212) 555-1234')).ok, true);
  assert.deepEqual(calls, [{ phone: '+12125551234' }]);
});
test('unconfigured delivery and missing sessions cannot send codes', async () => {
  const service = await authService({ getUser }, { email: false, phone: false });
  assert.equal((await service.requestVerification('email')).error.code, 'delivery_unavailable');
  assert.equal((await service.requestVerification('phone', '+12125551234')).error.code, 'delivery_unavailable');
  const signedOut = await authService({ getUser: async () => ({ data: { user: null }, error: null }) });
  assert.equal((await signedOut.requestVerification('email')).error.code, 'not_authenticated');
});
test('OTP submission uses email/phone_change and retains the same user', async () => {
  const calls = [];
  const service = await authService({ getUser, verifyOtp: async p => { calls.push(p); return { data: { user }, error: null }; } });
  assert.equal((await service.verifyVerificationCode('email', '123456')).ok, true);
  assert.equal((await service.verifyVerificationCode('phone', '123456', '+12125551234')).ok, true);
  assert.deepEqual(calls, [{ email: user.email, token: '123456', type: 'email' }, { phone: '+12125551234', token: '123456', type: 'phone_change' }]);
});
test('invalid/expired OTP, rate limits, mismatched identity and network errors are safe', async () => {
  let service = await authService({ getUser });
  assert.equal((await service.verifyVerificationCode('email', '12')).error.code, 'invalid_otp');
  for (const code of ['otp_expired', 'over_sms_send_rate_limit', 'sms_send_failed']) {
    service = await authService({ getUser, verifyOtp: async () => ({ error: { code, message: 'SECRET' } }) });
    const result = await service.verifyVerificationCode('email', '123456');
    assert.equal(result.ok, false); assert.ok(!result.error.message.includes('SECRET'));
  }
  service = await authService({ getUser, verifyOtp: async () => ({ data: { user: { id: 'different' } }, error: null }) });
  assert.equal((await service.verifyVerificationCode('email', '123456')).ok, false);
  service = await authService({ getUser: async () => { throw Error('SECRET'); } });
  assert.equal((await service.requestVerification('email')).error.code, 'connection_error');
});
test('profile writes strip verification timestamps/owner and completion uses owner-derived RPC', async () => {
  let payload, filter, rpc;
  const query = { update: p => { payload = p; return query; }, eq: (...args) => { filter = args; return query; }, select: () => query, single: async () => ({ data: { id: user.id }, error: null }) };
  globalThis.profileMock = { auth: { getUser }, from: () => query, rpc: async (...args) => { rpc = args; return { data: { id: user.id, account_verified_at: 'now' }, error: null }; } };
  const source = await readFile(new URL('../src/services/profileService.ts', import.meta.url), 'utf8');
  const service = await importSource(source.replace('import { supabase } from "../lib/supabaseClient";', 'const supabase = globalThis.profileMock;'));
  delete globalThis.profileMock;
  await service.updateCurrentProfile({ id: 'victim', account_verified_at: 'forged', phone_verified_at: 'forged', phone_number: '+12125551234', verification_channel: 'phone' });
  assert.deepEqual(payload, { verification_channel: 'phone' }); assert.deepEqual(filter, ['id', user.id]);
  assert.equal((await service.completeAccountVerification('phone')).data.account_verified_at, 'now');
  assert.deepEqual(rpc, ['complete_account_verification', { channel: 'phone' }]);
});
