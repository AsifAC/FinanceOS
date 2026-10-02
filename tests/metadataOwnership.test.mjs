import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

let loadId = 0;
async function load(name, client) {
  const source = await readFile(new URL(`../src/services/${name}.ts`, import.meta.url), 'utf8');
  globalThis.__metadataClient = client;
  const runnable = source.replace('import { supabase } from "../lib/supabaseClient";', 'const supabase = globalThis.__metadataClient;');
  const service = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(runnable)).toString('base64')}#${loadId++}`);
  delete globalThis.__metadataClient;
  return service;
}

for (const name of ['categoryService', 'paymentMethodService']) {
  test(`${name} blocks all mutations when Auth resolves to a different captured owner`, async () => {
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'owner-b' } }, error: null }) },
      from: () => assert.fail('No table request may follow an owner mismatch'),
      rpc: () => assert.fail('No RPC may follow an owner mismatch'),
    };
    const service = await load(name, client);
    const operations = name === 'categoryService' ? [
      () => service.createCategory({ name: 'Old account draft', type: 'expense' }, 'owner-a'),
      () => service.updateCategory('uuid-a', { name: 'Rename' }, 'owner-a'),
      () => service.archiveCategory('uuid-a', 'owner-a'),
      () => service.deleteCategory('uuid-a', 'owner-a'),
    ] : [
      () => service.createPaymentMethod({ nickname: 'Old account draft', type: 'checking' }, 'owner-a'),
      () => service.updatePaymentMethod('uuid-a', { nickname: 'Rename' }, 'owner-a'),
      () => service.archivePaymentMethod('uuid-a', 'owner-a'),
      () => service.deletePaymentMethod('uuid-a', 'owner-a'),
      () => service.setDefaultPaymentMethod('uuid-a', 'owner-a'),
    ];
    for (const operation of operations) assert.equal((await operation()).error.code, 'account_changed');
  });

  test(`${name} derives creation ownership from Auth after checking the captured owner`, async () => {
    let payload;
    const query = {
      insert: (input) => { payload = input; return query; },
      select: () => query,
      single: async () => ({ data: { ...payload, id: 'server-uuid' }, error: null }),
    };
    const service = await load(name, {
      auth: { getUser: async () => ({ data: { user: { id: 'owner-a' } }, error: null }) },
      from: () => query,
    });
    const input = name === 'categoryService'
      ? { name: ' Owned category ', type: 'expense', user_id: 'spoofed' }
      : { nickname: ' Owned method ', type: 'checking', user_id: 'spoofed' };
    const result = name === 'categoryService'
      ? await service.createCategory(input, 'owner-a')
      : await service.createPaymentMethod(input, 'owner-a');
    assert.equal(result.ok, true);
    assert.equal(result.data.id, 'server-uuid');
    assert.equal(payload.user_id, 'owner-a');
  });
}
