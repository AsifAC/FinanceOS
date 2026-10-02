// Run against Vite. The real app, auth guards, hook and service execute with an
// in-browser client double. All non-local HTTP requests are blocked before load.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseUrl = process.env.TRANSACTIONS_REVIEW_URL || 'http://127.0.0.1:5173';
const chrome = process.env.CHROME_PATH || (process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome');
const dir = await mkdtemp(join(tmpdir(), 'financeos-transactions-review-'));
const profile = join(dir, 'profile');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser, ws, send;
let launchError;
const errors = [];
const check = (condition, label) => { assert.ok(condition, label); console.log('PASS ' + label); };

try {
  browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  browser.on('error', error => { launchError = error; });
  let port;
  for (let i = 0; i < 80; i++) {
    if (launchError) throw launchError;
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch {}
    await pause(100);
  }
  assert.ok(port, 'Chrome debugging endpoint unavailable; check CHROME_PATH and sandbox permissions');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer, method });
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      if (!task) return;
      clearTimeout(task.timer); pending.delete(message.id);
      if (message.error) task.reject(new Error(`${task.method}: ${message.error.message}`)); else task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const url = new URL(request.url);
      let response;
      if (url.origin !== new URL(baseUrl).origin) {
        response = send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      } else if (url.pathname === '/src/lib/supabaseClient.ts') {
        response = send('Fetch.fulfillRequest', { requestId, responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }],
          body: Buffer.from('export const isSupabaseConfigured = true; export const isLocalSupabase = false; export const supabase = window.ledgerClient;').toString('base64') });
      } else if (url.pathname === '/src/lib/verification.ts') {
        response = send('Fetch.fulfillRequest', { requestId, responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }],
          body: Buffer.from(`export const verificationPolicy = { required: location.search.includes('gate-on') }; export const verificationDelivery = { email: false, phone: false }; export function normalizePhone(value) { return value || null; } export function maskEmail(value) { return value || ''; }`).toString('base64') });
      } else response = send('Fetch.continueRequest', { requestId });
      response.catch(error => errors.push(error.message));
    }
  });
  const evaluate = async expression => {
    let result;
    try { result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); }
    catch (error) { throw new Error(`${error.message} while evaluating: ${expression.slice(0, 220)}`); }
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression, label) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await pause(50);
    }
    const state = await evaluate(`({ path: location.pathname, title: document.title, text: document.body.innerText.slice(0, 500), requests: window.ledgerRequests?.length, legacy: window.legacyAccess?.length })`).catch(() => null);
    throw new Error('Timed out: ' + label + ' ' + JSON.stringify({ state, runtimeErrors: errors.slice(-10) }));
  };
  const click = text => evaluate(`[...document.querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(text)}).click()`);
  const setFormValue = (selector, value, tag = 'INPUT') => evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    const prototype = ${tag === 'SELECT' ? 'HTMLSelectElement' : tag === 'TEXTAREA' ? 'HTMLTextAreaElement' : 'HTMLInputElement'}.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(String(value))});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  const choose = (label, value) => evaluate(`(() => {
    const select = [...document.querySelectorAll('.transactions-filters label')].find(el => el.firstChild.textContent === ${JSON.stringify(label)}).querySelector('select');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, ${JSON.stringify(String(value))});
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  const screenshot = async name => {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(join(dir, name + '.png'), Buffer.from(shot.data, 'base64'));
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    (() => {
      window.ledgerUser = location.search.includes('signedout') ? null : 'owner-a';
      window.ledgerVerified = location.search.includes('verified');
      window.ledgerRequests = [];
      window.categoryRequests = [];
      window.categoryWrites = [];
      window.paymentMethodRequests = [];
      window.paymentMethodWrites = [];
      window.expectedTransactionRequests = [];
      window.expectedTransactionWrites = [];
      window.snapshotReads = [];
      window.snapshotWrites = [];
      window.snapshotRows = [];
      window.ledgerWrites = [];
      window.transactionWrites = [];
      window.actualServerRows = [];
      window.legacyAccess = [];
      const keys = ['financeos:app-data:v1', 'financeos:setup-profile', 'financeos:setup-completed', 'financeos:setup-data-version'];
      window.legacyBefore = Object.fromEntries(keys.map(key => [key, key === keys[0]
        ? JSON.stringify({ transactions: [{ name: 'LEGACY_SENTINEL', amount: 987654, type: 'income', date: '2026-01-01' }], expectedAmounts: [{ month: 0, income: 900, expenses: 100, savings: 30, debt: 20 }], categories: [{ id: 'legacy-category', name: 'LEGACY_CATEGORY_SENTINEL' }], paymentMethods: [{ id: 'legacy-method', nickname: 'LEGACY_METHOD_SENTINEL' }] })
        : 'LEGACY_SENTINEL_' + key]));
      for (const [key, value] of Object.entries(window.legacyBefore)) localStorage.setItem(key, value);
      window.confirmMessages = [];
      window.confirm = message => { window.confirmMessages.push(message); return true; };
      window.readLegacy = key => Storage.prototype.getItem.call(localStorage, key);
      for (const method of ['getItem', 'setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function(key, ...args) {
          if (this === localStorage && (keys.includes(key) || method === 'clear')) window.legacyAccess.push({ method, key });
          return original.call(this, key, ...args);
        };
      }
      const listeners = new Set();
      const user = () => window.ledgerUser ? { id: window.ledgerUser, email: window.ledgerUser + '@example.test', user_metadata: {} } : null;
      const session = () => user() ? { user: user() } : null;
      window.setLedgerAccount = id => { window.ledgerUser = id; for (const callback of listeners) callback(id ? 'SIGNED_IN' : 'SIGNED_OUT', session()); };
      const forbidden = () => { window.ledgerWrites.push('write'); throw new Error('Unexpected backend write'); };
      window.ledgerClient = {
        auth: {
          getSession: async () => ({ data: { session: session() }, error: null }),
          getUser: async () => ({ data: { user: user() }, error: null }),
          onAuthStateChange: callback => { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }; },
          signOut: async () => { window.setLedgerAccount(null); return { error: null }; },
        },
        from(table) {
          const query = {
            owner: null, id: null, action: null, payload: null, filters: [],
            select() { return this; },
            eq(column, value) { if (column === 'user_id') this.owner = value; if (column === 'id') this.id = value; this.filters.push([column, value]); return this; },
            in(column, values) { this.filters.push([column, values]); return this; },
            is() { return this; },
            order() { return this; },
            limit() { return this; },
            insert(payload) { if (!['categories', 'payment_methods', 'transactions', 'budget_snapshots', 'expected_transactions'].includes(table)) return forbidden(); this.action = 'insert'; this.payload = payload; return this; },
            update(payload) { if (!['categories', 'payment_methods', 'transactions', 'budget_snapshots', 'expected_transactions'].includes(table)) return forbidden(); this.action = 'update'; this.payload = payload; return this; },
            delete() { if (!['transactions', 'budget_snapshots', 'expected_transactions'].includes(table)) return forbidden(); this.action = 'delete'; return this; },
            then(resolve, reject) {
              if (table === 'categories') return new Promise(done => window.categoryRequests.push({ owner: this.owner, resolve: done, settled: false })).then(resolve, reject);
              if (table === 'payment_methods') return new Promise(done => window.paymentMethodRequests.push({ owner: this.owner, resolve: done, settled: false })).then(resolve, reject);
              if (table === 'budget_snapshots') return new Promise(done => window.snapshotReads.push({ owner: this.owner, kind: 'list', resolve: done, settled: false })).then(resolve, reject);
              return Promise.reject(new Error('Unexpected query table: ' + table)).then(resolve, reject);
            },
            async maybeSingle() {
              if (table === 'expected_transactions' && ['update', 'delete'].includes(this.action)) return new Promise(resolve => window.expectedTransactionWrites.push({ owner: this.owner || window.ledgerUser, id: this.id, action: this.action, payload: this.payload, filters: this.filters, resolve, settled: false }));
              if (table === 'budget_snapshots' && !this.action) return new Promise(resolve => window.snapshotReads.push({ owner: this.owner, kind: 'single', resolve, settled: false }));
              if (table === 'budget_snapshots' && ['update', 'delete'].includes(this.action)) return new Promise(resolve => window.snapshotWrites.push({ owner: this.owner, id: this.id, action: this.action, payload: this.payload, resolve, settled: false }));
              if (table === 'transactions' && ['update', 'delete'].includes(this.action)) return new Promise(resolve => window.transactionWrites.push({ owner: this.owner, id: this.id, action: this.action, payload: this.payload, resolve, settled: false }));
              if (table !== 'profiles') throw new Error('Unexpected single read');
              return { data: { id: this.owner, account_verified_at: window.ledgerVerified ? '2026-01-01T00:00:00Z' : null }, error: null };
            },
            single() {
              if (!this.action) throw new Error('Unexpected single read');
              if (table === 'expected_transactions' && this.action === 'insert') return new Promise(resolve => window.expectedTransactionWrites.push({ owner: window.ledgerUser, action: this.action, payload: this.payload, filters: this.filters, resolve, settled: false }));
              if (table === 'categories') return new Promise(resolve => window.categoryWrites.push({ owner: this.owner ?? this.payload?.user_id ?? null, id: this.id, action: this.action, payload: this.payload, resolve, settled: false }));
              if (table === 'payment_methods') return new Promise(resolve => window.paymentMethodWrites.push({ owner: this.owner ?? this.payload?.user_id ?? null, id: this.id, action: this.action, payload: this.payload, resolve, settled: false }));
              if (table === 'budget_snapshots') return new Promise(resolve => window.snapshotWrites.push({ owner: this.owner ?? this.payload?.user_id ?? null, id: this.id, action: this.action, payload: this.payload, resolve, settled: false }));
              if (table === 'transactions') return new Promise(resolve => window.transactionWrites.push({ owner: this.payload?.user_id ?? null, action: this.action, payload: this.payload, resolve, settled: false }));
              throw new Error('Unexpected single read');
            },
            range(start, end) {
              if (table === 'budget_snapshots') return new Promise(resolve => window.snapshotReads.push({ owner: this.owner, kind: 'list', start, end, resolve, settled: false }));
              if (table === 'expected_transactions') return new Promise(resolve => window.expectedTransactionRequests.push({ owner: this.owner, start, end, resolve, settled: false }));
              if (table !== 'transactions') throw new Error('Unexpected table read');
              return new Promise(resolve => window.ledgerRequests.push({ owner: this.owner, start, end, resolve, settled: false }));
            }
          };
          return query;
        },
        rpc(name, args) {
          if (name === 'complete_expected_transaction') return new Promise(resolve => window.expectedTransactionWrites.push({ owner: window.ledgerUser, id: args.p_expected_transaction_id, action: 'complete', payload: args, resolve, settled: false }));
          if (name !== 'set_default_payment_method') return forbidden();
          return new Promise(resolve => window.paymentMethodWrites.push({ owner: window.ledgerUser, id: args.target_payment_method_id, action: 'default', payload: args, resolve, settled: false }));
        },
      };
      window.resolveLedger = (owner, rows, error = null) => {
        const request = window.ledgerRequests.filter(request => request.owner === owner && !request.settled).at(-1);
        if (!request) throw new Error('No pending read for ' + owner);
        request.settled = true; request.resolve({ data: error ? null : rows, error });
      };
      window.resolveExpectedTransactions = (owner, rows, error = null) => {
        const request = window.expectedTransactionRequests.filter(request => request.owner === owner && !request.settled).at(-1);
        if (!request) throw new Error('No pending expected-transaction read for ' + owner);
        request.settled = true; request.resolve({ data: error ? null : rows, error });
      };
      window.resolveExpectedTransactionWrite = (owner, action, data, error = null) => {
        const request = window.expectedTransactionWrites.filter(request => request.owner === owner && request.action === action && !request.settled).at(-1);
        if (!request) throw new Error('No pending expected-transaction ' + action + ' for ' + owner);
        request.settled = true; request.resolve({ data: error ? null : data, error });
      };
      window.resolveCategories = (owner, rows, error = null) => {
        const request = window.categoryRequests.filter(request => request.owner === owner && !request.settled).at(-1);
        if (!request) throw new Error('No pending category read for ' + owner);
        request.settled = true; request.resolve({ data: error ? null : rows, error });
      };
      window.resolveCategoryWrite = (owner, data, error = null) => {
        const request = window.categoryWrites.find(request => request.owner === owner && !request.settled);
        if (!request) throw new Error('No pending category write for ' + owner);
        request.settled = true; request.resolve({ data: error ? null : data, error });
      };
      window.resolvePaymentMethods = (owner, rows, error = null) => {
        const request = window.paymentMethodRequests.filter(request => request.owner === owner && !request.settled).at(-1);
        if (!request) throw new Error('No pending payment-method read for ' + owner);
        request.settled = true; request.resolve({ data: error ? null : rows, error });
      };
      window.resolveSnapshotRead = (owner, rows = [], kind = 'list', error = null) => {
        const request = window.snapshotReads.filter(request => request.owner === owner && request.kind === kind && !request.settled).at(-1);
        if (!request) throw new Error('No pending snapshot ' + kind + ' read for ' + owner);
        request.settled = true; request.resolve({ data: error ? null : (kind === 'single' ? rows[0] ?? null : rows), error });
      };
      window.resolveSnapshotWrite = (owner, error = null) => {
        const request = window.snapshotWrites.find(request => request.owner === owner && !request.settled);
        if (!request) throw new Error('No pending snapshot write for ' + owner);
        request.settled = true;
        const payload = request.payload || {};
        const prior = window.snapshotRows.find(row => row.id === request.id);
        const result = { ...(prior || {}), id: request.id || 'snapshot-' + owner + '-' + payload.snapshot_scope + '-' + payload.snapshot_year,
          user_id: owner, snapshot_scope: payload.snapshot_scope ?? prior?.snapshot_scope, snapshot_year: payload.snapshot_year ?? prior?.snapshot_year,
          snapshot_month: payload.snapshot_month ?? prior?.snapshot_month ?? null, snapshot_version: payload.snapshot_version ?? prior?.snapshot_version ?? 2,
          actual_source: payload.actual_source ?? prior?.actual_source ?? 'supabase', expected_source: payload.expected_source ?? prior?.expected_source ?? 'local',
          summary: payload.summary ?? prior?.summary, created_at: prior?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString() };
        if (!error && request.action === 'insert') window.snapshotRows.push(result);
        if (!error && request.action === 'update') window.snapshotRows = window.snapshotRows.map(row => row.id === request.id ? result : row);
        if (!error && request.action === 'delete') window.snapshotRows = window.snapshotRows.filter(row => row.id !== request.id);
        request.resolve({ data: error ? null : result, error });
      };
      window.resolvePaymentMethodWrite = (owner, data, error = null) => {
        const request = window.paymentMethodWrites.find(request => request.owner === owner && !request.settled);
        if (!request) throw new Error('No pending payment-method write for ' + owner);
        request.settled = true; request.resolve({ data: error ? null : data, error });
      };
      window.resolveTransactionWrite = (owner, data, error = null) => {
        const request = window.transactionWrites.find(request => request.owner === owner && !request.settled);
        if (!request) throw new Error('No pending transaction write for ' + owner);
        request.settled = true;
        if (!error) window.actualServerRows.push(data);
        request.resolve({ data: error ? null : data, error });
      };
      window.resolveTransactionMutation = (owner, data, error = null) => {
        const request = window.transactionWrites.find(request => request.owner === owner && ['update', 'delete'].includes(request.action) && !request.settled);
        if (!request) throw new Error('No pending transaction mutation for ' + owner);
        request.settled = true;
        if (!error && request.action === 'update') window.actualServerRows = window.actualServerRows.map(row => row.id === request.id ? data : row);
        if (!error && request.action === 'delete') window.actualServerRows = window.actualServerRows.filter(row => row.id !== request.id);
        request.resolve({ data: error ? null : data, error });
      };
    })();
  ` });

  await send('Page.navigate', { url: baseUrl + '/transactions?signedout' });
  await until(`location.pathname === '/auth/login' && !!document.querySelector('form')`, 'signed-out redirect');
  check(await evaluate(`!document.querySelector('.transactions-ledger') && ledgerRequests.length === 0 && legacyAccess.length === 0`), 'signed-out route requires auth without financial storage access');
  await send('Page.navigate', { url: baseUrl + '/expected-transactions?signedout' });
  await until(`location.pathname === '/auth/login' && !!document.querySelector('form')`, 'signed-out expected route redirect');
  check(await evaluate(`expectedTransactionRequests.length === 0 && legacyAccess.length === 0`), 'signed-out expected route does not read account or local financial data');

  await send('Page.navigate', { url: baseUrl + '/transactions' });
  await until(`!!document.querySelector('[aria-label="Loading transactions"]') && ledgerRequests.length === 1`, 'initial loading');
  await until(`categoryRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'authenticated category read');
  await until(`paymentMethodRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'authenticated payment-method read');
  check(await evaluate(`!document.body.textContent.includes('LEGACY_SENTINEL') && legacyAccess.length === 0`), 'loading never hydrates legacy data');
  check(await evaluate(`categoryRequests[0].owner === 'owner-a'`), 'category service reads are scoped to the authenticated owner');
  check(await evaluate(`paymentMethodRequests[0].owner === 'owner-a'`), 'payment-method service reads are scoped to the authenticated owner');
  await evaluate(`(async () => {
    const source = await (await fetch('/src/app/App.tsx')).text();
    const routeUrl = source.split('from "').find(part => part.startsWith('/src/app/routes')).split('"')[0];
    window.ledgerRouter = (await import(routeUrl)).router;
    const gate = await (await fetch('/src/app/components/auth/RequireVerified.tsx')).text();
    const policyUrl = gate.split('from "').find(part => part.startsWith('/src/lib/verification')).split('"')[0];
    window.ledgerPolicy = (await import(policyUrl)).verificationPolicy;
    const year = new Date().getFullYear();
    window.testYear = year;
    window.testRows = ['income', 'expense', 'savings', 'debt'].map((type, index) => ({
      id: '00000000-0000-4000-8000-00000000000' + index, user_id: 'owner-a', type,
      title: 'Account ' + type, amount: index === 0 ? 1234.56 : (index + 1) * 12.34,
      transaction_date: year + '-01-01', created_at: year + '-01-02T0' + index + ':00:00Z', updated_at: year + '-01-02T00:00:00Z',
      category_id: ['10000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-000000000000', '40000000-0000-4000-8000-000000000000', null][index],
      payment_method_id: ['20000000-0000-4000-8000-000000000000', '30000000-0000-4000-8000-000000000000', '40000000-0000-4000-8000-000000000000', null][index],
      notes: index === 0 ? 'Account note <script> is text' : null,
      source: ['manual', 'recurring', 'import', 'migration'][index], description: null, is_recurring: false, recurring_group_id: null,
    }));
    testRows.push({ ...testRows[0], id: 'prior-year', title: 'Prior year record', transaction_date: (year - 1) + '-12-31' });
    testRows.push({ ...testRows[0], id: 'later-month', title: 'Later month record', transaction_date: year + '-02-01' });
    resolveLedger('owner-a', testRows);
  })()`);
  await until(`document.querySelectorAll('.transactions-table tbody tr').length === 5`, 'transaction rows load independently');
  check(await evaluate(`document.querySelector('.transactions-table').textContent.includes('Loading category…') && !document.body.textContent.includes('LEGACY_CATEGORY_SENTINEL')`), 'category loading does not block transactions or use local categories');
  await until(`document.querySelectorAll('.transactions-table tbody tr').length === 5`, 'transaction rows load independently');
  check(await evaluate(`document.querySelector('.transactions-table').textContent.includes('Loading category') && document.querySelector('.transactions-table').textContent.includes('Loading payment method') && !document.body.textContent.includes('LEGACY_CATEGORY_SENTINEL') && !document.body.textContent.includes('LEGACY_METHOD_SENTINEL')`), 'metadata loading does not block rows or use local labels');
  await evaluate(`resolveCategories('owner-a', [
    { id: '10000000-0000-4000-8000-000000000000', user_id: 'owner-a', name: 'Historic Salary', type: 'income', is_archived: true },
    { id: '30000000-0000-4000-8000-000000000000', user_id: 'owner-a', name: 'Income Type Mismatch', type: 'income', is_archived: false }
  ])`);
  await evaluate(`resolvePaymentMethods('owner-a', [
    { id: '20000000-0000-4000-8000-000000000000', user_id: 'owner-a', nickname: 'Historic Checking', type: 'checking', is_archived: true, is_default: false },
    { id: '30000000-0000-4000-8000-000000000000', user_id: 'owner-a', nickname: 'Account Digital Wallet', type: 'digital_wallet', is_archived: false, is_default: true }
  ])`);
  await until(`document.querySelectorAll('.transactions-table tbody tr').length === 5`, 'account rows');
  check(await evaluate(`['Income', 'Expense', 'Savings', 'Debt'].every(label => [...document.querySelectorAll('.transactions-type')].some(el => el.textContent === label))`), 'all four backend transaction types render');
  check(await evaluate(`document.querySelector('.transactions-ledger').textContent.includes('$1,234.56') && document.querySelector('.transactions-ledger').textContent.includes('Account note <script> is text') && !document.querySelector('.transactions-ledger script')`), 'amount precision and notes render safely');
  check(await evaluate(`document.querySelector('.transactions-table').textContent.includes('Historic Salary') && document.querySelector('.transactions-table').textContent.includes('Income Type Mismatch') && document.querySelector('.transactions-table').textContent.includes('Unknown category') && document.querySelector('.transactions-table').textContent.includes('Not assigned') && document.querySelector('.transactions-table').textContent.includes('Historic Checking') && document.querySelector('.transactions-table').textContent.includes('Account Digital Wallet') && document.querySelector('.transactions-table').textContent.includes('Unknown payment method') && !document.querySelector('.transactions-table').textContent.includes('LEGACY_METHOD_SENTINEL') && !document.querySelector('.transactions-table').textContent.includes('Uncategorized')`), 'account-owned archived labels resolve with null and unknown states without backend method type coercion');
  check(await evaluate(`[...document.querySelectorAll('.transactions-description strong')].map(el => el.textContent).join('|') === 'Later month record|Account debt|Account savings|Account expense|Account income'`), 'date descending with created-at secondary ordering');
  check(await evaluate(`document.querySelector('[aria-label="Edit Account income"]') && document.querySelector('[aria-label="Delete Account income"]') && ![...document.querySelectorAll('button')].some(el => ['Mark Paid', 'Save all'].includes(el.textContent.trim())) && ledgerWrites.length === 0`), 'actual ledger exposes edit/delete only for account-backed rows and no status controls');
  await evaluate(`document.querySelector('[aria-label="Edit Account income"]').click()`);
  await until(`!!document.querySelector('[role="dialog"]')`, 'historical transaction editor opens');
  check(await evaluate(`[...document.querySelectorAll('[role="dialog"] option')].some(option => option.textContent.includes('Historic Salary (current historical reference)')) && [...document.querySelectorAll('[role="dialog"] option')].some(option => option.textContent.includes('Historic Checking (current historical reference)'))`), 'archived references stay visible as current-only edit selections');
  await setFormValue('[role="dialog"] label:nth-child(3) select', 'expense', 'SELECT');
  check(await evaluate(`document.querySelector('[role="dialog"] label:nth-child(5) select').value === '' && ![...document.querySelectorAll('[role="dialog"] label:nth-child(5) option')].some(option => option.textContent.includes('Historic Salary'))`), 'changing transaction type clears an incompatible archived category');
  await setFormValue('[role="dialog"] label:nth-child(6) select', '', 'SELECT');
  check(await evaluate(`![...document.querySelectorAll('[role="dialog"] label:nth-child(6) option')].some(option => option.textContent.includes('Historic Checking'))`), 'archived payment method cannot be reselected after clearing');
  await click('Cancel');

  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(100);
    check(await evaluate(`document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.transactions-filters select, .transactions-refresh')].every(el => { const b = el.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth; })`), 'responsive ledger fits ' + width + 'px');
    await screenshot('transactions-' + width);
  }
  await choose('Month', 0);
  await until(`document.querySelectorAll('.transactions-table tbody tr').length === 4`, 'January filter');
  await choose('Type', 'savings');
  await until(`document.querySelectorAll('.transactions-table tbody tr').length === 1`, 'savings filter');
  check(await evaluate(`document.querySelector('.transactions-description strong').textContent === 'Account savings'`), 'month and type filters combine');
  await choose('Year', await evaluate('testYear - 1'));
  await until(`document.body.textContent.includes('No transactions for these filters')`, 'filtered empty state');
  await choose('Month', 'all'); await choose('Type', 'all');
  await until(`document.querySelector('.transactions-description strong')?.textContent === 'Prior year record'`, 'available-year filter');
  check(true, 'year options derive from account history');
  await choose('Year', await evaluate('testYear'));

  await click('Refresh');
  await until(`ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'refresh request');
  check(await evaluate(`!!document.querySelector('[aria-label="Loading transactions"]') && !document.querySelector('.transactions-table')`), 'refresh masks rows while loading');
  await evaluate(`resolveLedger('owner-a', [], { code: 'server_error', message: 'PRIVATE_SERVER_DETAIL' })`);
  await until(`document.body.textContent.includes('Unable to load transactions')`, 'safe fetch error');
  check(await evaluate(`!document.body.textContent.includes('PRIVATE_SERVER_DETAIL') && !document.body.textContent.includes('LEGACY_SENTINEL') && !document.querySelector('.transactions-table')`), 'fetch failure has no raw error or local fallback');
  await click('Retry');
  await until(`ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'retry request');
  await evaluate(`resolveLedger('owner-a', [])`);
  await until(`document.body.textContent.includes('No transactions yet')`, 'empty account');
  check(await evaluate(`document.body.textContent.includes('Your completed income, expenses, savings, and debt transactions will appear here.')`), 'real account empty state without seed data');

  await click('Refresh');
  await until(`ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'restore rows');
  await evaluate(`resolveLedger('owner-a', testRows)`);
  await until(`!!document.querySelector('.transactions-table')`, 'restored rows');
  await evaluate(`setLedgerAccount('owner-b')`);
  await until(`ledgerRequests.some(r => r.owner === 'owner-b' && !r.settled)`, 'new account request');
  await until(`categoryRequests.some(r => r.owner === 'owner-b' && !r.settled)`, 'new account categories');
  await until(`paymentMethodRequests.some(r => r.owner === 'owner-b' && !r.settled)`, 'new account payment methods');
  check(await evaluate(`!!document.querySelector('[aria-label="Loading transactions"]') && !document.body.textContent.includes('Historic Salary') && !document.body.textContent.includes('Historic Checking') && !document.querySelector('.transactions-table')`), 'previous-account rows and metadata labels disappear during account switch');
  await evaluate(`setLedgerAccount('owner-c')`);
  await until(`ledgerRequests.some(r => r.owner === 'owner-c' && !r.settled)`, 'third account request');
  await until(`categoryRequests.some(r => r.owner === 'owner-c' && !r.settled)`, 'third account categories');
  await until(`paymentMethodRequests.some(r => r.owner === 'owner-c' && !r.settled)`, 'third account payment methods');
  await evaluate(`resolveCategories('owner-c', [{ id: '10000000-0000-4000-8000-000000000000', user_id: 'owner-c', name: 'Current account category', type: 'income', is_archived: false }]); resolvePaymentMethods('owner-c', [{ id: '20000000-0000-4000-8000-000000000000', user_id: 'owner-c', nickname: 'Current account method', type: 'checking', is_archived: false }]); resolveLedger('owner-c', [{ ...testRows[0], user_id: 'owner-c', title: 'Current account only' }])`);
  await until(`document.body.textContent.includes('Current account only')`, 'current account response');
  check(await evaluate(`document.body.textContent.includes('Current account category')`), 'current account category resolves to its own label');
  check(await evaluate(`document.body.textContent.includes('Current account method')`), 'current account payment method resolves to its own label');
  await evaluate(`resolveCategories('owner-b', [{ id: '10000000-0000-4000-8000-000000000000', user_id: 'owner-b', name: 'STALE_CATEGORY_LABEL', type: 'income', is_archived: false }])`);
  await evaluate(`resolvePaymentMethods('owner-b', [{ id: '20000000-0000-4000-8000-000000000000', user_id: 'owner-b', nickname: 'STALE_PAYMENT_METHOD_LABEL', type: 'checking', is_archived: false }])`);
  await evaluate(`resolveLedger('owner-b', [{ ...testRows[0], user_id: 'owner-b', title: 'STALE_ACCOUNT_ROW' }])`);
  await pause(150);
  check(await evaluate(`document.body.textContent.includes('Current account only') && !document.body.textContent.includes('STALE_ACCOUNT_ROW') && !document.body.textContent.includes('STALE_CATEGORY_LABEL') && !document.body.textContent.includes('STALE_PAYMENT_METHOD_LABEL')`), 'late previous-account transactions and metadata cannot repopulate ledger');

  await evaluate(`setLedgerAccount('owner-d')`);
  await until(`ledgerRequests.some(r => r.owner === 'owner-d' && !r.settled) && categoryRequests.some(r => r.owner === 'owner-d' && !r.settled) && paymentMethodRequests.some(r => r.owner === 'owner-d' && !r.settled)`, 'metadata error account reads');
  await evaluate(`resolveLedger('owner-d', [{ ...testRows[0], user_id: 'owner-d', title: 'Transactions survive metadata errors' }]); resolveCategories('owner-d', null, { code: 'server_error', message: 'PRIVATE_CATEGORY_DETAIL' }); resolvePaymentMethods('owner-d', null, { code: 'server_error', message: 'PRIVATE_METHOD_DETAIL' })`);
  await until(`document.body.textContent.includes('Transactions survive metadata errors')`, 'transactions after metadata errors');
  check(await evaluate(`document.body.textContent.includes('Unknown category') && document.body.textContent.includes('Payment method unavailable') && document.body.textContent.includes('Transactions survive metadata errors') && !document.body.textContent.includes('PRIVATE_CATEGORY_DETAIL') && !document.body.textContent.includes('PRIVATE_METHOD_DETAIL') && !document.body.textContent.includes('LEGACY_SENTINEL') && !document.body.textContent.includes('LEGACY_METHOD_SENTINEL')`), 'metadata failures leave transactions visible without local fallback');

  await evaluate(`ledgerRouter.navigate('/categories')`);
  await until(`location.pathname === '/categories' && !!document.querySelector('[aria-label="Loading categories"]')`, 'account-backed categories route loading');
  await until(`categoryRequests.some(r => r.owner === 'owner-d' && !r.settled)`, 'categories route read');
  check(await evaluate(`!document.body.textContent.includes('LEGACY_CATEGORY_SENTINEL') && legacyAccess.length === 0`), 'categories route does not hydrate local financial categories');
  await evaluate(`resolveCategories('owner-d', null, { code: 'server_error', message: 'PRIVATE_CATEGORY_READ_DETAIL' })`);
  await until(`document.body.textContent.includes('Unable to load categories')`, 'category fetch error');
  check(await evaluate(`!document.body.textContent.includes('PRIVATE_CATEGORY_READ_DETAIL') && !document.body.textContent.includes('LEGACY_CATEGORY_SENTINEL')`), 'category fetch failure has safe message and no local fallback');
  await click('Retry');
  await until(`categoryRequests.some(r => r.owner === 'owner-d' && !r.settled)`, 'category retry read');
  const ownerCategories = [
    { id: '10000000-0000-4000-8000-000000000101', user_id: 'owner-d', name: 'Salary', type: 'income', icon: '$', color: '#84cc16', sort_order: 10, is_default: true, is_archived: false },
    { id: '10000000-0000-4000-8000-000000000102', user_id: 'owner-d', name: 'Groceries', type: 'expense', icon: 'G', color: '#84cc16', sort_order: 20, is_default: false, is_archived: false },
    { id: '10000000-0000-4000-8000-000000000103', user_id: 'owner-d', name: 'Old Student Loan', type: 'debt', icon: 'D', color: '#84cc16', sort_order: 30, is_default: false, is_archived: true },
  ];
  await evaluate(`resolveCategories('owner-d', ${JSON.stringify(ownerCategories)})`);
  await until(`!!document.querySelector('[data-category-id="${ownerCategories[0].id}"]')`, 'account categories rendered');
  check(await evaluate(`document.querySelector('[data-category-id="${ownerCategories[0].id}"] .account-category-badge.is-default')?.textContent === 'Default' && document.querySelector('[data-category-id="${ownerCategories[2].id}"] .account-category-badge.is-archived')?.textContent === 'Archived' && !document.body.textContent.includes('LEGACY_CATEGORY_SENTINEL')`), 'backend UUID rows, default metadata, and archived status render');
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(80);
    const categoryWidth = await evaluate(`({ scroll: document.documentElement.scrollWidth, inner: innerWidth, offenders: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 5).map(el => ({ tag: el.tagName, className: String(el.className), right: Math.round(el.getBoundingClientRect().right) })) })`);
    check(categoryWidth.scroll <= categoryWidth.inner, 'responsive categories fit ' + width + 'px ' + JSON.stringify(categoryWidth));
  }

  await click('Add category');
  await evaluate(`(() => {
    const set = (selector, value, prototype) => { const element = document.querySelector(selector); Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); };
    set('#account-category-name', 'Contract Work', HTMLInputElement.prototype);
    set('#account-category-type', 'income', HTMLSelectElement.prototype);
    set('#account-category-icon', 'W', HTMLInputElement.prototype);
    set('#account-category-sort', '5', HTMLInputElement.prototype);
  })()`);
  await evaluate(`document.querySelector('.account-category-form').requestSubmit()`);
  await until(`categoryWrites.some(r => r.owner === 'owner-d' && r.action === 'insert' && !r.settled)`, 'category create request');
  await evaluate(`document.querySelector('.account-category-form').requestSubmit()`);
  check(await evaluate(`categoryWrites.filter(r => r.owner === 'owner-d' && r.action === 'insert').length === 1 && categoryWrites.find(r => r.owner === 'owner-d' && r.action === 'insert').payload.user_id === 'owner-d'`), 'create prevents duplicate submissions and uses authenticated ownership');
  const createdCategory = { id: '10000000-0000-4000-8000-000000000104', user_id: 'owner-d', name: 'Contract Work', type: 'income', icon: 'W', color: '#84cc16', sort_order: 5, is_default: false, is_archived: false };
  await evaluate(`resolveCategoryWrite('owner-d', ${JSON.stringify(createdCategory)})`);
  await until(`!!document.querySelector('[data-category-id="${createdCategory.id}"]')`, 'created category appended without reload');
  check(await evaluate(`document.querySelector('[data-category-id="${createdCategory.id}"] .account-category-copy strong').textContent === 'Contract Work' && document.querySelector('[data-slot="dialog-content"]')?.getAttribute('data-state') === 'closed'`), 'successful creation updates account state immediately');

  await click('Add category');
  await evaluate(`(() => { const input = document.querySelector('#account-category-name'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Groceries'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await click('Create category');
  await until(`categoryWrites.some(r => r.owner === 'owner-d' && r.action === 'insert' && !r.settled)`, 'duplicate category create request');
  await evaluate(`resolveCategoryWrite('owner-d', null, { code: '23505', message: 'PRIVATE_UNIQUE_DETAIL' })`);
  await until(`document.body.textContent.includes('A category with this name and type already exists.')`, 'duplicate category error');
  check(await evaluate(`!document.body.textContent.includes('PRIVATE_UNIQUE_DETAIL')`), 'duplicate create failure is presented safely');
  await click('Cancel');

  await evaluate(`document.querySelector('[aria-label="Edit category Groceries"]').click()`);
  check(await evaluate(`document.querySelector('#account-category-type').disabled`), 'existing category type is immutable in the management form');
  await evaluate(`(() => { const input = document.querySelector('#account-category-name'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Food at Home'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await click('Save changes');
  await until(`categoryWrites.some(r => r.owner === 'owner-d' && r.action === 'update' && !r.settled)`, 'category update request');
  check(await evaluate(`categoryWrites.find(r => r.owner === 'owner-d' && r.action === 'update' && !r.settled).id === '${ownerCategories[1].id}' && categoryWrites.find(r => r.owner === 'owner-d' && r.action === 'update' && !r.settled).payload.name === 'Food at Home' && !('type' in categoryWrites.find(r => r.owner === 'owner-d' && r.action === 'update' && !r.settled).payload)`), 'rename updates by stable UUID and leaves type and transaction rows untouched');
  const renamedCategory = { ...ownerCategories[1], name: 'Food at Home' };
  await evaluate(`resolveCategoryWrite('owner-d', ${JSON.stringify(renamedCategory)})`);
  await until(`document.querySelector('[data-category-id="${ownerCategories[1].id}"] .account-category-copy strong')?.textContent === 'Food at Home'`, 'renamed category updates in place');
  await evaluate(`document.querySelector('[aria-label="Archive category Food at Home"]').click()`);
  await until(`categoryWrites.some(r => r.owner === 'owner-d' && r.action === 'update' && !r.settled)`, 'archive category update');
  check(await evaluate(`categoryWrites.find(r => r.owner === 'owner-d' && r.action === 'update' && !r.settled).payload.is_archived === true`), 'archive is reversible metadata update, not delete');
  const archivedCategory = { ...renamedCategory, is_archived: true };
  await evaluate(`resolveCategoryWrite('owner-d', ${JSON.stringify(archivedCategory)})`);
  await until(`!!document.querySelector('#archived-categories-title') && !!document.querySelector('[data-category-id="${ownerCategories[1].id}"] .account-category-badge.is-archived')`, 'archived category remains listed');
  await evaluate(`document.querySelector('[aria-label="Restore category Food at Home"]').click()`);
  await until(`categoryWrites.some(r => r.owner === 'owner-d' && r.action === 'update' && !r.settled)`, 'restore category update');
  check(await evaluate(`categoryWrites.find(r => r.owner === 'owner-d' && r.action === 'update' && !r.settled).payload.is_archived === false`), 'restore unarchives through existing update service');
  await evaluate(`resolveCategoryWrite('owner-d', ${JSON.stringify(renamedCategory)})`);
  await until(`!document.querySelector('[data-category-id="${ownerCategories[1].id}"] .account-category-badge.is-archived')`, 'restored category active');

  await evaluate(`document.querySelector('[aria-label="Refresh categories"]').click()`);
  await until(`categoryRequests.some(r => r.owner === 'owner-d' && !r.settled)`, 'stale category fetch begins');
  await evaluate(`setLedgerAccount('owner-e')`);
  await until(`categoryRequests.some(r => r.owner === 'owner-e' && !r.settled) && !!document.querySelector('[aria-label="Loading categories"]')`, 'new category owner load');
  check(await evaluate(`!document.body.textContent.includes('Contract Work') && !document.body.textContent.includes('Food at Home')`), 'previous owner category labels clear immediately');
  const ownerECategory = { id: '20000000-0000-4000-8000-000000000101', user_id: 'owner-e', name: 'Owner E Category', type: 'expense', icon: null, color: '#84cc16', sort_order: 0, is_default: false, is_archived: false };
  await evaluate(`resolveCategories('owner-e', [${JSON.stringify(ownerECategory)}])`);
  await until(`document.body.textContent.includes('Owner E Category')`, 'new owner category list');
  await evaluate(`resolveCategories('owner-d', [{ ...${JSON.stringify(ownerCategories[0])}, name: 'STALE_CATEGORY_FETCH' }])`);
  await pause(100);
  check(await evaluate(`document.body.textContent.includes('Owner E Category') && !document.body.textContent.includes('STALE_CATEGORY_FETCH')`), 'stale category fetch cannot replace the current owner');
  await evaluate(`document.querySelector('[aria-label="Edit category Owner E Category"]').click()`);
  await evaluate(`(() => { const input = document.querySelector('#account-category-name'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'STALE_CATEGORY_MUTATION'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await click('Save changes');
  await until(`categoryWrites.some(r => r.owner === 'owner-e' && r.action === 'update' && !r.settled)`, 'old owner mutation begins');
  await evaluate(`setLedgerAccount('owner-f')`);
  await until(`categoryRequests.some(r => r.owner === 'owner-f' && !r.settled)`, 'new owner after mutation');
  const ownerFCategory = { ...ownerECategory, id: '30000000-0000-4000-8000-000000000101', user_id: 'owner-f', name: 'Owner F Category' };
  await evaluate(`resolveCategories('owner-f', [${JSON.stringify(ownerFCategory)}])`);
  await until(`document.body.textContent.includes('Owner F Category')`, 'new owner category state after mutation race');
  const staleWrite = { ...ownerECategory, name: 'STALE_CATEGORY_MUTATION' };
  await evaluate(`resolveCategoryWrite('owner-e', ${JSON.stringify(staleWrite)})`);
  await pause(100);
  check(await evaluate(`document.body.textContent.includes('Owner F Category') && !document.body.textContent.includes('STALE_CATEGORY_MUTATION')`), 'stale mutation success cannot populate the new owner');
  await evaluate(`setLedgerAccount('owner-g')`);
  await until(`categoryRequests.some(r => r.owner === 'owner-g' && !r.settled)`, 'empty account category read');
  await evaluate(`resolveCategories('owner-g', [])`);
  await until(`document.body.textContent.includes('No account categories yet')`, 'account category empty state');
  check(await evaluate(`document.body.textContent.includes('Create category') && !document.body.textContent.includes('LEGACY_CATEGORY_SENTINEL')`), 'empty state offers create without local categories');

  const legacySnapshot = await evaluate(`Object.fromEntries(Object.keys(legacyBefore).map(key => [key, readLegacy(key)]))`);
  await evaluate(`ledgerRouter.navigate('/payment-methods')`);
  await until(`location.pathname === '/payment-methods' && !!document.querySelector('[aria-label="Loading payment methods"]')`, 'isolated payment-method management loading');
  await until(`paymentMethodRequests.some(r => r.owner === 'owner-g' && !r.settled)`, 'payment-method management account read');
  await evaluate(`setLedgerAccount('owner-h')`);
  await until(`paymentMethodRequests.some(r => r.owner === 'owner-h' && !r.settled) && !!document.querySelector('[aria-label="Loading payment methods"]')`, 'payment-method owner switch clears old rows');
  await evaluate(`resolvePaymentMethods('owner-h', null, { code: 'server_error', message: 'PRIVATE_METHOD_READ' }); resolvePaymentMethods('owner-g', [{ id: 'old-owner-method', user_id: 'owner-g', nickname: 'STALE_OWNER_METHOD', type: 'checking', is_archived: false }])`);
  await until(`document.body.textContent.includes('Unable to load account payment methods.')`, 'payment-method read error state');
  const methodIsolation = await evaluate(`({ stale: document.body.textContent.includes('STALE_OWNER_METHOD'), legacy: document.body.textContent.includes('LEGACY_METHOD_SENTINEL'), rawError: document.body.textContent.includes('PRIVATE_METHOD_READ'), storageAccess: legacyAccess.length, text: document.body.innerText.slice(-500) })`);
  check(!methodIsolation.stale && !methodIsolation.legacy && !methodIsolation.rawError, 'stale owner and local methods are excluded from management ' + JSON.stringify(methodIsolation));
  await evaluate(`document.querySelector('[aria-label="Retry payment methods"]').click()`);
  await until(`paymentMethodRequests.some(r => r.owner === 'owner-h' && !r.settled)`, 'payment-method read retry');
  await evaluate(`resolvePaymentMethods('owner-h', [])`);
  await until(`document.body.textContent.includes('No account payment methods yet.')`, 'payment-method empty state');
  check(await evaluate(`['cash','checking','savings','credit_card','debit_card','loan','investment','digital_wallet','other'].every(type => [...document.querySelector('#account-method-type').options].some(option => option.value === type))`), 'management selector supports every backend method type');

  await evaluate(`(() => { const input = document.querySelector('#account-method-nickname'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Duplicate Method'); input.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('[aria-label="Payment method form"]').requestSubmit() })()`);
  await until(`paymentMethodWrites.some(r => r.owner === 'owner-h' && r.action === 'insert' && !r.settled)`, 'payment-method create failure request');
  await evaluate(`resolvePaymentMethodWrite('owner-h', null, { code: '23505', message: 'PRIVATE_UNIQUE_ERROR' })`);
  await until(`document.body.textContent.includes('A payment method with that nickname already exists.')`, 'safe payment-method create failure');
  check(await evaluate(`!document.body.textContent.includes('PRIVATE_UNIQUE_ERROR')`), 'payment-method create error does not expose backend details');
  await evaluate(`(() => { const input = document.querySelector('#account-method-nickname'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);

  const ownerHMethod = { id: '50000000-0000-4000-8000-000000000001', user_id: 'owner-h', nickname: 'Mobile Wallet', type: 'digital_wallet', institution_name: 'Provider', last4: null, network: null, color_theme: null, is_default: false, is_archived: false, is_linked: false, sort_order: 0, created_at: null, updated_at: null };
  await evaluate(`(() => { const set = (selector, value, proto) => { const el = document.querySelector(selector); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }; set('#account-method-nickname', 'Mobile Wallet', HTMLInputElement.prototype); set('#account-method-type', 'digital_wallet', HTMLSelectElement.prototype); set('#account-method-institution', 'Provider', HTMLInputElement.prototype); })()`);
  await evaluate(`document.querySelector('[aria-label="Payment method form"]').requestSubmit()`);
  await until(`paymentMethodWrites.some(r => r.owner === 'owner-h' && r.action === 'insert' && !r.settled)`, 'account payment-method create');
  check(await evaluate(`paymentMethodWrites.filter(r => r.owner === 'owner-h' && r.action === 'insert' && !r.settled).length === 1 && paymentMethodWrites.filter(r => r.action === 'insert').at(-1).payload.user_id === 'owner-h' && paymentMethodWrites.filter(r => r.action === 'insert').at(-1).payload.type === 'digital_wallet' && !('is_default' in paymentMethodWrites.filter(r => r.action === 'insert').at(-1).payload)`), 'create uses owner context, exact backend type, and prevents duplicate submission/default assignment');
  await evaluate(`resolvePaymentMethodWrite('owner-h', ${JSON.stringify(ownerHMethod)})`);
  await until(`!!document.querySelector('[data-payment-method-id="${ownerHMethod.id}"]')`, 'created method keeps backend UUID');
  check(await evaluate(`document.querySelector('[data-payment-method-id="${ownerHMethod.id}"]').textContent.includes('Digital wallet') && !document.body.textContent.includes('LEGACY_METHOD_SENTINEL')`), 'backend-specific method type displays honestly');
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(60);
    const methodWidth = await evaluate(`({ scroll: document.documentElement.scrollWidth, inner: innerWidth })`);
    check(methodWidth.scroll <= methodWidth.inner, 'responsive payment methods fit ' + width + 'px ' + JSON.stringify(methodWidth));
  }

  await evaluate(`document.querySelector('[aria-label="Edit Mobile Wallet"]').click()`);
  await evaluate(`(() => { const input = document.querySelector('#account-method-nickname'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Renamed Wallet'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await evaluate(`document.querySelector('[aria-label="Payment method form"]').requestSubmit()`);
  await until(`paymentMethodWrites.some(r => r.owner === 'owner-h' && r.action === 'update' && !r.settled)`, 'payment-method edit request');
  check(await evaluate(`paymentMethodWrites.find(r => r.action === 'update' && !r.settled).id === '${ownerHMethod.id}' && paymentMethodWrites.find(r => r.action === 'update' && !r.settled).payload.nickname === 'Renamed Wallet' && !('user_id' in paymentMethodWrites.find(r => r.action === 'update' && !r.settled).payload)`), 'edit uses UUID and never accepts owner id from UI');
  const renamedMethod = { ...ownerHMethod, nickname: 'Renamed Wallet' };
  await evaluate(`resolvePaymentMethodWrite('owner-h', ${JSON.stringify(renamedMethod)})`);
  await until(`document.querySelector('[data-payment-method-id="${ownerHMethod.id}"] h3')?.textContent === 'Renamed Wallet'`, 'renamed method updates in place');

  await evaluate(`document.querySelector('[aria-label="Archive Renamed Wallet"]').click()`);
  await until(`paymentMethodWrites.some(r => r.owner === 'owner-h' && r.action === 'update' && !r.settled)`, 'payment-method archive request');
  check(await evaluate(`paymentMethodWrites.find(r => r.action === 'update' && !r.settled).payload.is_archived === true && paymentMethodWrites.find(r => r.action === 'update' && !r.settled).payload.is_default === false`), 'archive clears default through backend update fields');
  const archivedMethod = { ...renamedMethod, is_archived: true };
  await evaluate(`resolvePaymentMethodWrite('owner-h', ${JSON.stringify(archivedMethod)})`);
  await until(`document.querySelector('[data-payment-method-id="${ownerHMethod.id}"]').textContent.includes('Archived')`, 'archived payment method remains visible');
  check(await evaluate(`!document.querySelector('[aria-label="Set Renamed Wallet as default"]')`), 'archived method cannot become default');
  await evaluate(`document.querySelector('[aria-label="Restore Renamed Wallet"]').click()`);
  await until(`paymentMethodWrites.some(r => r.owner === 'owner-h' && r.action === 'update' && !r.settled)`, 'payment-method restore request');
  check(await evaluate(`paymentMethodWrites.find(r => r.action === 'update' && !r.settled).payload.is_archived === false`), 'restore uses account-owned update service');
  await evaluate(`resolvePaymentMethodWrite('owner-h', ${JSON.stringify(renamedMethod)})`);
  await until(`!document.querySelector('[data-payment-method-id="${ownerHMethod.id}"]').textContent.includes('Archived')`, 'payment method restored');

  const secondMethod = { ...ownerHMethod, id: '50000000-0000-4000-8000-000000000002', nickname: 'Cash Wallet', type: 'cash', sort_order: 2 };
  await evaluate(`(() => { const set = (selector, value, proto) => { const el = document.querySelector(selector); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }; set('#account-method-nickname', 'Cash Wallet', HTMLInputElement.prototype); set('#account-method-type', 'cash', HTMLSelectElement.prototype); document.querySelector('[aria-label="Payment method form"]').requestSubmit() })()`);
  await until(`paymentMethodWrites.some(r => r.owner === 'owner-h' && r.action === 'insert' && !r.settled)`, 'second method create');
  await evaluate(`resolvePaymentMethodWrite('owner-h', ${JSON.stringify(secondMethod)})`);
  await until(`!!document.querySelector('[data-payment-method-id="${secondMethod.id}"]')`, 'second method appears');
  await evaluate(`document.querySelector('[aria-label="Set Cash Wallet as default"]').click()`);
  await until(`paymentMethodWrites.some(r => r.owner === 'owner-h' && r.action === 'default' && !r.settled)`, 'default RPC request');
  check(await evaluate(`paymentMethodWrites.find(r => r.action === 'default' && !r.settled).id === '${secondMethod.id}' && paymentMethodWrites.find(r => r.action === 'default' && !r.settled).payload.target_payment_method_id === '${secondMethod.id}'`), 'default selection calls the existing RPC with backend UUID');
  await evaluate(`resolvePaymentMethodWrite('owner-h', { ...${JSON.stringify(secondMethod)}, is_default: true })`);
  await until(`document.querySelector('[data-payment-method-id="${secondMethod.id}"]').textContent.includes('Default')`, 'default result updates UI');
  check(await evaluate(`[...document.querySelectorAll('[data-payment-method-id]')].filter(row => row.textContent.includes('Default')).length === 1 && !document.querySelector('[aria-label="Set Cash Wallet as default"]')`), 'only the backend-selected default is represented in account state');

  await evaluate(`document.querySelector('[aria-label="Edit Cash Wallet"]').click()`);
  await evaluate(`(() => { const input = document.querySelector('#account-method-nickname'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'STALE_METHOD_MUTATION'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await evaluate(`document.querySelector('[aria-label="Payment method form"]').requestSubmit()`);
  await until(`paymentMethodWrites.some(r => r.owner === 'owner-h' && r.action === 'update' && !r.settled)`, 'payment-method mutation begins before account switch');
  await evaluate(`setLedgerAccount('owner-i')`);
  await until(`paymentMethodRequests.some(r => r.owner === 'owner-i' && !r.settled) && !!document.querySelector('[aria-label="Loading payment methods"]')`, 'new payment-method owner loading');
  const ownerIMethod = { ...ownerHMethod, id: '60000000-0000-4000-8000-000000000001', user_id: 'owner-i', nickname: 'Owner I Method' };
  await evaluate(`resolvePaymentMethods('owner-i', [${JSON.stringify(ownerIMethod)}])`);
  await until(`document.body.textContent.includes('Owner I Method')`, 'new payment-method account data');
  await evaluate(`resolvePaymentMethodWrite('owner-h', { ...${JSON.stringify(secondMethod)}, nickname: 'STALE_METHOD_MUTATION' })`);
  await pause(100);
  check(await evaluate(`document.body.textContent.includes('Owner I Method') && !document.body.textContent.includes('STALE_METHOD_MUTATION') && !document.body.textContent.includes('Renamed Wallet') && document.querySelectorAll('[data-payment-method-id]').length === 1`), 'old-account mutation result cannot pollute new owner state');
  const storageDiff = await evaluate(`Object.fromEntries(Object.entries(${JSON.stringify(legacySnapshot)}).filter(([key, value]) => readLegacy(key) !== value).map(([key, value]) => [key, { before: value, after: readLegacy(key) }]))`);
  const storageMethods = await evaluate(`legacyAccess.map(entry => entry.method)`);
  check(Object.keys(storageDiff).length === 0 && storageMethods.every(method => method === 'getItem'), 'payment-method management leaves browser-local financial storage byte-for-byte unchanged ' + JSON.stringify(storageDiff));

  await evaluate(`ledgerRouter.navigate('/add-transaction?type=income')`);
  await until(`location.pathname === '/add-transaction' && !!document.querySelector('[aria-label="Actual transaction form"]')`, 'isolated actual-entry route');
  await until(`ledgerRequests.some(r => r.owner === 'owner-i' && !r.settled) && categoryRequests.some(r => r.owner === 'owner-i' && !r.settled) && paymentMethodRequests.some(r => r.owner === 'owner-i' && !r.settled)`, 'actual-entry account-backed data reads');
  const entryCategories = [
    { id: '71000000-0000-4000-8000-000000000001', user_id: 'owner-i', name: 'Work income', type: 'income', icon: '$', is_archived: false },
    { id: '71000000-0000-4000-8000-000000000002', user_id: 'owner-i', name: 'Food', type: 'expense', icon: 'F', is_archived: false },
    { id: '71000000-0000-4000-8000-000000000003', user_id: 'owner-i', name: 'Rainy day', type: 'savings', icon: 'S', is_archived: false },
    { id: '71000000-0000-4000-8000-000000000004', user_id: 'owner-i', name: 'Loan repayment', type: 'debt', icon: 'D', is_archived: false },
    { id: '71000000-0000-4000-8000-000000000005', user_id: 'owner-i', name: 'Old food', type: 'expense', is_archived: true },
  ];
  const entryMethods = [
    { id: '72000000-0000-4000-8000-000000000001', user_id: 'owner-i', nickname: 'Main Wallet', type: 'digital_wallet', is_default: true, is_archived: false, sort_order: 2 },
    { id: '72000000-0000-4000-8000-000000000002', user_id: 'owner-i', nickname: 'Backup Card', type: 'credit_card', is_default: false, is_archived: false, sort_order: 4 },
    { id: '72000000-0000-4000-8000-000000000003', user_id: 'owner-i', nickname: 'Old Card', type: 'credit_card', is_default: false, is_archived: true, sort_order: 1 },
  ];
  await evaluate(`resolveLedger('owner-i', []); resolveCategories('owner-i', ${JSON.stringify(entryCategories)}); resolvePaymentMethods('owner-i', ${JSON.stringify(entryMethods)})`);
  await until(`document.querySelector('#actual-category').options.length === 2 && document.querySelector('#actual-payment-method').options.length === 3`, 'selectable actual-entry options');
  check(await evaluate(`document.querySelector('#actual-payment-method').value === '' && document.querySelector('#actual-payment-method').options[1].value === '${entryMethods[0].id}' && [...document.querySelector('#actual-category').options].every(option => !option.textContent.includes('Old food'))`), 'active UUID choices are filtered, defaults sort first, and a sole/default method is not auto-selected');
  check(await evaluate(`!document.querySelector('#actual-status') && !document.body.textContent.includes('Expense kind') && !document.body.textContent.includes('Due date')`), 'actual entry omits pending status, fixed-expense, and due-date fields');

  const addActualDraft = async (type, title, categoryId, paymentId, notes = '') => {
    const pressed = await evaluate(`[...document.querySelectorAll('[aria-pressed="true"]')].some(button => button.textContent.trim() === ${JSON.stringify(type[0].toUpperCase() + type.slice(1))})`);
    if (!pressed) await click(type[0].toUpperCase() + type.slice(1));
    check(await evaluate(`document.querySelector('#actual-category').options.length === 2 && document.querySelector('#actual-category').options[1].value === '${categoryId}'`), `category options match ${type} UUID only`);
    await setFormValue('#actual-title', title);
    await setFormValue('#actual-amount', '10.25');
    await setFormValue('#actual-date', '2026-09-30');
    await setFormValue('#actual-category', categoryId, 'SELECT');
    await setFormValue('#actual-payment-method', paymentId, 'SELECT');
    await setFormValue('#actual-notes', notes, 'TEXTAREA');
    await click('Add actual to review');
  };

  await addActualDraft('income', 'Recorded salary', entryCategories[0].id, entryMethods[0].id, 'September payroll');
  await addActualDraft('expense', 'Recorded groceries', entryCategories[1].id, '');
  await addActualDraft('savings', 'Recorded deposit', entryCategories[2].id, entryMethods[1].id);
  await addActualDraft('debt', 'Recorded loan payment', entryCategories[3].id, '');
  await click('All');
  check(await evaluate(`document.querySelectorAll('[data-draft-id]').length === 4 && document.querySelector('[data-draft-id]')?.textContent.includes('2026-09-30') && document.body.textContent.includes('September payroll')`), 'four actual transaction types and exact calendar dates enter the review batch');
  await click('Save actual transactions');
  for (let index = 0; index < 4; index++) {
    await until(`transactionWrites.some(r => r.owner === 'owner-i' && !r.settled)`, `actual create ${index + 1}`);
    const request = await evaluate(`transactionWrites.find(r => r.owner === 'owner-i' && !r.settled)`);
    check(request.payload.transaction_date === '2026-09-30' && request.payload.amount === 10.25 && !('status' in request.payload) && !('isFixed' in request.payload) && !('dueDate' in request.payload), `create ${index + 1} sends actual-only backend fields and preserves date`);
    if (index === 0) check(request.payload.category_id === entryCategories[0].id && request.payload.payment_method_id === entryMethods[0].id && request.payload.notes === 'September payroll' && request.payload.user_id === 'owner-i', 'create maps owner-authenticated category/payment UUIDs and notes');
    if (index === 1) check(request.payload.category_id === entryCategories[1].id && request.payload.payment_method_id === null, 'create supports nullable payment method');
    const savedRow = { ...request.payload, id: `81000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, source: 'manual', is_recurring: false, recurring_group_id: null, description: null, created_at: '2026-09-30T12:00:00Z', updated_at: '2026-09-30T12:00:00Z' };
    await evaluate(`resolveTransactionWrite('owner-i', ${JSON.stringify(savedRow)})`);
  }
  await until(`document.body.textContent.includes('Saved 4 actual transactions to your account.') && document.querySelectorAll('[data-draft-id]').length === 0`, 'all-success batch removes saved drafts');
  check(await evaluate(`actualServerRows.length === 4 && !document.body.textContent.includes('LEGACY_SENTINEL')`), 'batch saves server rows without writing a local transaction copy');

  await evaluate(`ledgerRouter.navigate('/transactions')`);
  await until(`location.pathname === '/transactions' && ledgerRequests.some(r => r.owner === 'owner-i' && !r.settled) && categoryRequests.some(r => r.owner === 'owner-i' && !r.settled) && paymentMethodRequests.some(r => r.owner === 'owner-i' && !r.settled)`, 'actual ledger refresh after creation');
  await evaluate(`resolveLedger('owner-i', actualServerRows); resolveCategories('owner-i', ${JSON.stringify(entryCategories)}); resolvePaymentMethods('owner-i', ${JSON.stringify(entryMethods)})`);
  await until(`document.body.textContent.includes('Recorded salary')`, 'created server row appears in ledger');
  check(await evaluate(`document.body.textContent.includes('Recorded salary') && document.body.textContent.includes('Work income') && document.body.textContent.includes('Main Wallet') && document.body.textContent.includes('September payroll')`), 'created UUID-backed transaction renders labels and notes in ledger');

  await evaluate(`document.querySelector('[aria-label="Edit Recorded salary"]').click()`);
  await until(`!!document.querySelector('[role="dialog"] input')`, 'edit dialog opens');
  await setFormValue('[role="dialog"] label:nth-child(1) input', 'Updated salary title');
  await setFormValue('[role="dialog"] label:nth-child(2) input', '1250.75');
  await setFormValue('[role="dialog"] label:nth-child(4) input', '2026-09-29');
  await setFormValue('[role="dialog"] label:nth-child(7) textarea', 'Updated note', 'TEXTAREA');
  await click('Save changes');
  await until(`transactionWrites.some(r => r.owner === 'owner-i' && r.action === 'update' && !r.settled)`, 'update service request');
  const updateRequest = await evaluate(`transactionWrites.find(r => r.owner === 'owner-i' && r.action === 'update' && !r.settled)`);
  check(updateRequest.id === '81000000-0000-4000-8000-000000000001' && updateRequest.payload.title === 'Updated salary title' && updateRequest.payload.amount === 1250.75 && updateRequest.payload.transaction_date === '2026-09-29' && updateRequest.payload.category_id === entryCategories[0].id && updateRequest.payload.payment_method_id === entryMethods[0].id && updateRequest.payload.notes === 'Updated note' && !('status' in updateRequest.payload), 'edit maps validated actual fields through the server UUID');
  const updatedRow = await evaluate(`({ ...actualServerRows.find(row => row.id === ${JSON.stringify(updateRequest.id)}), ...${JSON.stringify(updateRequest.payload)}, updated_at: '2026-09-30T15:00:00Z' })`);
  await evaluate(`resolveTransactionMutation('owner-i', ${JSON.stringify(updatedRow)})`);
  await until(`ledgerRequests.some(r => r.owner === 'owner-i' && !r.settled)`, 'post-update authoritative refresh');
  await evaluate(`resolveLedger('owner-i', actualServerRows)`);
  await until(`document.body.textContent.includes('Updated salary title')`, 'updated row renders without navigation');
  check(await evaluate(`document.body.textContent.includes('Updated note') && document.body.textContent.includes('$1,250.75')`), 'successful update refreshes the row and amount in place');

  await evaluate(`document.querySelector('[aria-label="Edit Updated salary title"]').click()`);
  await setFormValue('[role="dialog"] label:nth-child(1) input', 'Failed update title');
  await click('Save changes');
  await until(`transactionWrites.some(r => r.owner === 'owner-i' && r.action === 'update' && !r.settled)`, 'update failure request');
  await evaluate(`resolveTransactionMutation('owner-i', null, { code: 'server_error', message: 'PRIVATE_UPDATE_DETAIL' })`);
  await until(`document.body.textContent.includes('transaction could not be changed')`, 'safe update failure');
  const failedEditState = await evaluate(`({ oldTitle: document.body.textContent.includes('Updated salary title'), raw: document.body.textContent.includes('PRIVATE_UPDATE_DETAIL'), text: document.body.innerText.slice(-420) })`);
  check(failedEditState.oldTitle && !failedEditState.raw, 'failed update keeps old row visible and hides backend details ' + JSON.stringify(failedEditState));
  await click('Cancel');

  await evaluate(`document.querySelector('[aria-label="Delete Updated salary title"]').click()`);
  check(await evaluate(`document.querySelector('[role="alertdialog"]')?.textContent.includes('Updated salary title') && document.querySelector('[role="alertdialog"]')?.textContent.includes('2026-09-29')`), 'delete confirmation identifies title, amount and date');
  await click('Delete transaction');
  await until(`transactionWrites.some(r => r.owner === 'owner-i' && r.action === 'delete' && !r.settled)`, 'delete service request');
  const deleteRequest = await evaluate(`transactionWrites.find(r => r.owner === 'owner-i' && r.action === 'delete' && !r.settled)`);
  check(deleteRequest.id === updatedRow.id && deleteRequest.payload === null, 'delete uses the transaction server UUID without a local copy');
  await evaluate(`resolveTransactionMutation('owner-i', null, { code: 'server_error', message: 'PRIVATE_DELETE_DETAIL' })`);
  await until(`document.body.textContent.includes('transaction could not be changed')`, 'safe delete failure');
  check(await evaluate(`document.body.textContent.includes('Updated salary title') && !document.body.textContent.includes('PRIVATE_DELETE_DETAIL') && !document.querySelector('[role="alertdialog"]')`), 'failed delete keeps the row and hides backend details');
  await evaluate(`document.querySelector('[aria-label="Delete Updated salary title"]').click()`);
  await click('Delete transaction');
  await until(`transactionWrites.filter(r => r.owner === 'owner-i' && r.action === 'delete' && !r.settled).length === 1`, 'retry delete request');
  await evaluate(`resolveTransactionMutation('owner-i', { id: ${JSON.stringify(updatedRow.id)} })`);
  await until(`ledgerRequests.some(r => r.owner === 'owner-i' && !r.settled)`, 'post-delete authoritative refresh');
  await evaluate(`resolveLedger('owner-i', actualServerRows)`);
  await until(`!document.body.textContent.includes('Updated salary title')`, 'deleted row disappears');
  check(await evaluate(`actualServerRows.length === 3 && !document.body.textContent.includes('Updated salary title')`), 'successful delete removes the actual row from the ledger');

  await evaluate(`document.querySelector('[aria-label="Edit Recorded groceries"]').click()`);
  await setFormValue('[role="dialog"] label:nth-child(1) input', 'Stale update title');
  await click('Save changes');
  await until(`transactionWrites.some(r => r.owner === 'owner-i' && r.action === 'update' && !r.settled)`, 'update begins before owner switch');
  await evaluate(`setLedgerAccount('owner-j')`);
  await until(`location.pathname === '/transactions' && ledgerRequests.some(r => r.owner === 'owner-j' && !r.settled)`, 'ledger remounts for new owner during update');
  const staleUpdate = await evaluate(`transactionWrites.find(r => r.owner === 'owner-i' && r.action === 'update' && !r.settled)`);
  const staleUpdatedRow = await evaluate(`({ ...actualServerRows.find(row => row.id === ${JSON.stringify(staleUpdate.id)}), ...${JSON.stringify(staleUpdate.payload)} })`);
  await evaluate(`resolveTransactionMutation('owner-i', ${JSON.stringify(staleUpdatedRow)})`);
  await evaluate(`resolveLedger('owner-j', []); resolveCategories('owner-j', []); resolvePaymentMethods('owner-j', [])`);
  await until(`document.body.textContent.includes('No transactions yet')`, 'new owner remains empty after stale update');
  check(await evaluate(`!document.body.textContent.includes('Stale update title') && !document.body.textContent.includes('Transaction updated.')`), 'late update response cannot alter the new owner ledger or show stale success');
  await evaluate(`setLedgerAccount('owner-i')`);
  await until(`location.pathname === '/transactions' && ledgerRequests.some(r => r.owner === 'owner-i' && !r.settled) && categoryRequests.some(r => r.owner === 'owner-i' && !r.settled) && paymentMethodRequests.some(r => r.owner === 'owner-i' && !r.settled)`, 'return to previous owner with isolated ledger reload');
  await evaluate(`resolveLedger('owner-i', actualServerRows); resolveCategories('owner-i', ${JSON.stringify(entryCategories)}); resolvePaymentMethods('owner-i', ${JSON.stringify(entryMethods)})`);
  await until(`document.body.textContent.includes('Stale update title')`, 'previous owner rows reload after return');

  await evaluate(`ledgerRouter.navigate('/add-transaction')`);
  await until(`location.pathname === '/add-transaction' && !!document.querySelector('[aria-label="Actual transaction form"]') && ledgerRequests.some(r => r.owner === 'owner-i' && !r.settled) && categoryRequests.some(r => r.owner === 'owner-i' && !r.settled) && paymentMethodRequests.some(r => r.owner === 'owner-i' && !r.settled)`, 'return to account-backed entry');
  await evaluate(`resolveLedger('owner-i', actualServerRows); resolveCategories('owner-i', ${JSON.stringify(entryCategories)}); resolvePaymentMethods('owner-i', ${JSON.stringify(entryMethods)})`);

  await addActualDraft('income', 'Saved bonus', entryCategories[0].id, '');
  await addActualDraft('expense', 'Retry snack', entryCategories[1].id, '');
  await click('Save actual transactions');
  await until(`transactionWrites.some(r => r.owner === 'owner-i' && !r.settled)`, 'partial-success first create');
  let partialRequest = await evaluate(`transactionWrites.find(r => r.owner === 'owner-i' && !r.settled)`);
  const bonusRow = { ...partialRequest.payload, id: '82000000-0000-4000-8000-000000000001', source: 'manual', is_recurring: false, recurring_group_id: null, description: null, created_at: '2026-09-30T13:00:00Z', updated_at: '2026-09-30T13:00:00Z' };
  await evaluate(`resolveTransactionWrite('owner-i', ${JSON.stringify(bonusRow)})`);
  await until(`transactionWrites.some(r => r.owner === 'owner-i' && !r.settled)`, 'partial-success second create');
  await evaluate(`resolveTransactionWrite('owner-i', null, { code: '23503', message: 'PRIVATE_REFERENCE_ERROR' })`);
  await until(`document.body.textContent.includes('Saved 1 transaction; 1 draft remains unsaved.')`, 'partial failure summary');
  check(await evaluate(`document.querySelectorAll('[data-draft-id]').length === 1 && document.body.textContent.includes('Retry snack') && actualServerRows.filter(row => row.title === 'Saved bonus').length === 1 && !document.body.textContent.includes('PRIVATE_REFERENCE_ERROR')`), 'successful batch row disappears, failed row remains, raw backend error stays hidden');
  await click('Save actual transactions');
  await until(`transactionWrites.some(r => r.owner === 'owner-i' && !r.settled)`, 'retry sends remaining draft only');
  partialRequest = await evaluate(`transactionWrites.find(r => r.owner === 'owner-i' && !r.settled)`);
  check(await evaluate(`transactionWrites.filter(r => r.owner === 'owner-i' && !r.settled).length === 1`) && partialRequest.payload.title === 'Retry snack', 'retry cannot duplicate a previously successful row');
  const retryRow = { ...partialRequest.payload, id: '82000000-0000-4000-8000-000000000002', source: 'manual', is_recurring: false, recurring_group_id: null, description: null, created_at: '2026-09-30T13:30:00Z', updated_at: '2026-09-30T13:30:00Z' };
  await evaluate(`resolveTransactionWrite('owner-i', ${JSON.stringify(retryRow)})`);
  await until(`document.body.textContent.includes('Saved 1 actual transaction to your account.') && document.querySelectorAll('[data-draft-id]').length === 0`, 'remaining draft retry succeeds');

  await addActualDraft('expense', 'Retry rent', entryCategories[1].id, '');
  await addActualDraft('debt', 'Retry card payment', entryCategories[3].id, '');
  await click('Save actual transactions');
  for (let index = 0; index < 2; index++) {
    await until(`transactionWrites.some(r => r.owner === 'owner-i' && !r.settled)`, `multiple-failure create ${index + 1}`);
    if (index === 0) check(await evaluate(`transactionWrites.filter(r => r.owner === 'owner-i' && !r.settled).length === 1`), 'duplicate batch submit is blocked while create is pending');
    await evaluate(`resolveTransactionWrite('owner-i', null, { code: 'server_error', message: 'PRIVATE_NETWORK_DETAIL' })`);
  }
  await until(`document.body.textContent.includes('No transactions were saved. 2 drafts remain available to retry.')`, 'multiple failures retain drafts');
  await click('All');
  const multipleFailureState = await evaluate(`({ rows: document.querySelectorAll('[data-draft-id]').length, raw: document.body.textContent.includes('PRIVATE_NETWORK_DETAIL'), text: document.body.innerText.slice(-400) })`);
  check(multipleFailureState.rows === 2 && !multipleFailureState.raw, 'multiple failures remain retryable with safe errors ' + JSON.stringify(multipleFailureState));
  await click('Clear drafts');

  await addActualDraft('income', 'Stale account draft', entryCategories[0].id, '');
  await click('Save actual transactions');
  await until(`transactionWrites.some(r => r.owner === 'owner-i' && !r.settled)`, 'create begins before owner switch');
  await evaluate(`setLedgerAccount('owner-j')`);
  await until(`location.pathname === '/add-transaction' && !!document.querySelector('[aria-label="Actual transaction form"]') && ledgerRequests.some(r => r.owner === 'owner-j' && !r.settled)`, 'new account entry route remounts');
  const staleCreate = await evaluate(`transactionWrites.find(r => r.owner === 'owner-i' && !r.settled)`);
  const staleCreatedRow = { ...staleCreate.payload, id: '83000000-0000-4000-8000-000000000001', source: 'manual', is_recurring: false, recurring_group_id: null, description: null, created_at: '2026-09-30T14:00:00Z', updated_at: '2026-09-30T14:00:00Z' };
  await evaluate(`resolveTransactionWrite('owner-i', ${JSON.stringify(staleCreatedRow)})`);
  await pause(120);
  check(await evaluate(`!document.body.textContent.includes('Stale account draft') && !document.body.textContent.includes('Saved 1 actual transaction') && document.querySelectorAll('[data-draft-id]').length === 0`), 'stale create response cannot add old-owner feedback or drafts to new account');
  const transactionStorageDiff = await evaluate(`Object.fromEntries(Object.entries(${JSON.stringify(legacySnapshot)}).filter(([key, value]) => readLegacy(key) !== value))`);
  check(Object.keys(transactionStorageDiff).length === 0, 'actual transaction creation leaves legacy localStorage byte-for-byte unchanged');
  await evaluate(`ledgerRouter.navigate('/transactions')`);
  await until(`location.pathname === '/transactions' && ledgerRequests.some(r => r.owner === 'owner-j' && !r.settled) && categoryRequests.some(r => r.owner === 'owner-j' && !r.settled) && paymentMethodRequests.some(r => r.owner === 'owner-j' && !r.settled)`, 'new account ledger context');
  await evaluate(`resolveLedger('owner-j', []); resolveCategories('owner-j', []); resolvePaymentMethods('owner-j', [])`);
  await until(`document.body.textContent.includes('No transactions yet')`, 'new account starts with an empty ledger');
  check(await evaluate(`!document.body.textContent.includes('Recorded salary') && !document.body.textContent.includes('Recorded groceries') && !document.body.textContent.includes('Stale account draft')`), 'new account ledger does not inherit prior owner transactions');

  await evaluate(`document.querySelector('[aria-label="Open navigation menu"]').click()`);
  check(await evaluate(`!!document.querySelector('[role="menu"] a[href="/transactions"]') && !!document.querySelector('[role="menu"] a[href="/expenses"]') && !!document.querySelector('[role="menu"] a[href="/payment-methods"]') && !!document.querySelector('[role="menu"] a[href="/add-transaction"]')`), 'Transactions and Expenses remain distinct with account-backed entry and payment routes');
  await send('Page.navigate', { url: baseUrl + '/transactions?gate-on' });
  await until(`location.pathname === '/auth/verify'`, 'verification guard');
  check(await evaluate(`!document.querySelector('.transactions-ledger') && !ledgerRequests.some(r => r.owner === 'owner-a')`), 'fresh verification-required route blocks unverified transaction reads');
  await send('Page.navigate', { url: baseUrl + '/transactions?gate-on&verified' });
  await until(`!!document.querySelector('[aria-label="Loading transactions"]') && ledgerRequests.some(r => r.owner === 'owner-a')`, 'fresh verified account route');
  await evaluate(`resolveLedger('owner-a', [{ id: 'verified-row', user_id: 'owner-a', type: 'income', amount: 42.5, title: 'Verified account transaction', transaction_date: '2026-01-01', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', category_id: null, payment_method_id: null, notes: null, source: 'manual', description: null, is_recurring: false, recurring_group_id: null }])`);
  await until(`document.body.textContent.includes('Verified account transaction')`, 'verified account may access ledger');
  check(await evaluate(`location.pathname === '/transactions' && document.querySelector('.transactions-ledger').textContent.includes('Actual Transactions')`), 'fresh verification-required route allows a verified account');
  check(await evaluate(`legacyAccess.every(entry => entry.method === 'getItem') && ledgerWrites.length === 0`), 'legacy financial storage has no writes and transaction ledger has no unsupported mutation');
  check(await evaluate(`Object.entries(legacyBefore).every(([key, value]) => readLegacy(key) === value)`), 'financial localStorage and setup keys remain byte-for-byte unchanged');

  await send('Page.navigate', { url: baseUrl + '/dashboard' });
  await until(`location.pathname === '/dashboard' && !!document.querySelector('.financeos-dashboard-overview') && ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'dashboard requests account-backed actuals');
  await evaluate(`(async () => {
    const source = await (await fetch('/src/app/App.tsx')).text();
    const routeUrl = source.split('from "').find(part => part.startsWith('/src/app/routes')).split('"')[0];
    window.ledgerRouter = (await import(routeUrl)).router;
  })()`);
  const dashboardLoadingState = await evaluate(`({ loading: document.body.textContent.includes('Loading'), chartLoading: document.body.textContent.includes('Loading account actuals'), income: document.querySelector('[aria-label="Income actual"]')?.textContent, localSentinel: document.body.textContent.includes('$987,654'), text: document.body.innerText.slice(0, 650) })`);
  check(dashboardLoadingState.loading && dashboardLoadingState.chartLoading && dashboardLoadingState.income?.includes('Loading') && !dashboardLoadingState.localSentinel, 'dashboard loading masks local actual rows while preserving separate planning panels ' + JSON.stringify(dashboardLoadingState));
  const dashboardStorageSnapshot = await evaluate(`Object.fromEntries(Object.keys(legacyBefore).map(key => [key, readLegacy(key)]))`);
  const dashboardRows = await evaluate(`(() => {
    const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0');
    return ['income', 'expense', 'savings', 'debt'].map((type, index) => {
      const date = year + '-' + month + '-' + String(index + 1).padStart(2, '0');
      return { id: 'dashboard-' + type, user_id: 'owner-a', type, amount: [1200, 300, 200, 100][index], title: 'Dashboard ' + type,
        transaction_date: date, created_at: date + 'T12:00:00Z', updated_at: date + 'T12:00:00Z', category_id: null, payment_method_id: null,
        notes: null, source: 'manual', description: null, is_recurring: false, recurring_group_id: null };
    });
  })()`);
  await evaluate(`resolveLedger('owner-a', ${JSON.stringify(dashboardRows)})`);
  await until(`document.querySelector('[aria-label="Income actual"]')?.textContent.includes('1,200')`, 'dashboard displays account actual KPIs');
  check(await evaluate(`document.querySelector('[aria-label="Expenses actual"]').textContent.includes('300') && document.querySelector('[aria-label="Savings actual"]').textContent.includes('200') && document.querySelector('[aria-label="Debt actual"]').textContent.includes('100') && document.querySelector('.financeos-overview-balance strong').textContent.includes('600') && document.body.textContent.includes('Quick Summary · Supabase actual') && document.body.textContent.includes('local expected')`), 'dashboard totals and Amount Left use Supabase rows with local expected comparison clearly labeled');
  check(await evaluate(`document.body.textContent.includes('Pending Transactions · local planning') && document.body.textContent.includes('Upcoming Payments · local plans') && !!document.querySelector('.recharts-wrapper')`), 'pending panels remain local and cashflow chart renders from the shared actual monthly series');
  check(await evaluate(`Object.entries(${JSON.stringify(dashboardStorageSnapshot)}).every(([key, value]) => readLegacy(key) === value)`), 'Supabase dashboard actual rows are not copied into legacy browser storage');
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(80);
    check(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'responsive Dashboard fits ' + width + 'px');
  }
  await evaluate(`ledgerRouter.navigate('/settings')`);
  await until(`location.pathname === '/settings'`, 'leave dashboard before error-state check');
  await evaluate(`ledgerRouter.navigate('/dashboard')`);
  await until(`location.pathname === '/dashboard' && ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'dashboard remount loads account actuals');
  await evaluate(`resolveLedger('owner-a', [], { code: 'server_error', message: 'PRIVATE_DASHBOARD_ERROR' })`);
  await until(`document.body.textContent.includes('Could not load account transactions')`, 'dashboard actual error state');
  check(await evaluate(`document.querySelector('[aria-label="Income actual"]').textContent.includes('Unavailable') && document.body.textContent.includes('Actual chart unavailable') && !document.body.textContent.includes('PRIVATE_DASHBOARD_ERROR') && !document.body.textContent.includes('$987,654')`), 'dashboard errors never show local fallback or imply zero actuals');
  await click('Retry');
  await until(`ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'dashboard retry starts a new account read');
  await evaluate(`resolveLedger('owner-a', ${JSON.stringify(dashboardRows)})`);
  await until(`document.querySelector('[aria-label="Income actual"]')?.textContent.includes('1,200')`, 'dashboard retry recovers');

  await evaluate(`ledgerRouter.navigate('/settings')`);
  await until(`location.pathname === '/settings'`, 'leave Dashboard before Annual Planner checks');
  await evaluate(`ledgerRouter.navigate('/annual-planner')`);
  await until(`location.pathname === '/annual-planner' && document.querySelector('[data-annual-actual-status="loading"]') && ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled) && categoryRequests.some(r => r.owner === 'owner-a' && !r.settled) && snapshotReads.some(r => r.owner === 'owner-a' && r.kind === 'list' && !r.settled)`, 'Annual Planner loads account actuals through the shared transaction/snapshot hooks');
  check(await evaluate(`document.body.textContent.includes('Expected values · local planning') && document.body.textContent.includes('Expected') && document.body.textContent.includes('$900') && !document.body.textContent.includes('$987,654') && [...document.querySelectorAll('button')].find(button => button.textContent.includes('Save This Year'))?.disabled`), 'Annual Planner keeps local expected data visible while account actuals and snapshot saving load');
  await click('Actual');
  check(await evaluate(`document.body.textContent.includes('Loading account actuals…') && !document.body.textContent.includes('$987,654') && !document.body.textContent.includes('Annual account actual totals:')`), 'Annual Planner actual table and yearly totals are masked while loading');
  const annualYear = await evaluate(`new Date().getFullYear()`);
  const annualRows = await evaluate(`(() => {
    const year = new Date().getFullYear();
    const make = (id, type, amount, date, rowYear = year) => ({ id, user_id: 'owner-a', type, amount, title: id,
      transaction_date: rowYear + '-' + date, created_at: rowYear + '-01-01T12:00:00Z', updated_at: rowYear + '-01-01T12:00:00Z',
      category_id: null, payment_method_id: null, notes: null, source: 'manual', description: null, is_recurring: false, recurring_group_id: null });
    return [make('Annual Jan income', 'income', 1000, '01-01'), make('Annual Jan expense', 'expense', 200, '01-31'),
      make('Annual February savings', 'savings', 300, '02-28'), make('Annual Dec debt', 'debt', 100, '12-31'),
      make('Prior year excluded', 'income', 987000, '12-31', year - 1), make('Future year excluded', 'income', 765000, '01-01', year + 1)];
  })()`);
  await evaluate(`resolveLedger('owner-a', ${JSON.stringify(annualRows)}); resolveCategories('owner-a', []); resolveSnapshotRead('owner-a', [], 'list')`);
  await until(`document.querySelector('[data-annual-actual-status="ready"]') && document.body.textContent.includes('Annual account actual totals:')`, 'Annual Planner account actual series is ready');
  check(await evaluate(`document.body.textContent.includes('Income $1,000 · Expenses $200 · Savings $300 · Debt $100 · Amount Left $400') && !document.body.textContent.includes('$987,654') && !document.body.textContent.includes('$987,000') && !document.body.textContent.includes('$765,000')`), 'Annual Planner monthly series produces yearly Supabase totals and excludes legacy/adjacent-year rows');
  check(await evaluate(`document.body.textContent.includes('Actual values · authenticated Supabase transactions') && document.body.textContent.includes('Actual: account transactions · Expected: local plan')`), 'Annual Planner labels account actuals and local expected values distinctly');

  await click('Compare');
  await until(`!!document.querySelector('.recharts-wrapper')`, 'Annual Planner comparison chart');
  check(await evaluate(`document.body.textContent.includes('Expected (6mo) · local') && document.body.textContent.includes('Actual (6mo) · account') && document.body.textContent.includes('$450') && document.body.textContent.includes('$1,000')`), 'Annual Planner compares local six-month expectations with selected-year Supabase actuals');
  check(await evaluate(`!!document.querySelector('path[fill="#3B82F6"]') && !!document.querySelector('path[fill="#94A3B8"]')`), 'Annual Planner chart preserves the actual and expected series colors');
  await click('Rankings');
  check(await evaluate(`document.body.textContent.includes('Highest Income Months') && document.body.textContent.includes('January') && document.body.textContent.includes('$1,000') && document.body.textContent.includes('No account actuals to rank') === false`), 'Annual Planner rankings derive from account actual months');

  await evaluate(`document.querySelector('[aria-label="Start month"]').click()`);
  await setFormValue('select[aria-label="Budget year"]', annualYear - 1, 'SELECT');
  await until(`document.querySelector('[data-annual-actual-status="ready"]') && document.body.textContent.includes('Annual account actual totals:')`, 'Annual Planner selected year updates');
  check(await evaluate(`document.querySelector('[aria-label="Start month"]').textContent.includes(String(new Date().getFullYear() - 1)) && document.body.textContent.includes('Income $987,000 · Expenses $0 · Savings $0 · Debt $0 · Amount Left $987,000') && !document.body.textContent.includes('$765,000') && !document.body.textContent.includes('$1,000')`), 'Annual Planner recalculates actual totals for the selected year only');
  await evaluate(`if (!document.querySelector('select[aria-label="Budget year"]')) document.querySelector('[aria-label="Start month"]').click()`);
  await setFormValue('select[aria-label="Budget year"]', annualYear, 'SELECT');
  await click('Actual');
  await until(`document.body.textContent.includes('Income $1,000 · Expenses $200 · Savings $300 · Debt $100 · Amount Left $400')`, 'Annual Planner restores the selected account year');
  const plannerStorageSnapshot = await evaluate(`Object.fromEntries(Object.keys(legacyBefore).map(key => [key, readLegacy(key)]))`);
  check(await evaluate(`JSON.parse(readLegacy('financeos:app-data:v1')).transactions.some(row => row.name === 'LEGACY_SENTINEL') && !document.body.textContent.includes('LEGACY_SENTINEL')`), 'Annual Planner ignores rather than migrates local actual rows');
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(80);
    check(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'responsive Annual Planner fits ' + width + 'px');
  }

  await evaluate(`ledgerRouter.navigate('/settings')`);
  await until(`location.pathname === '/settings'`, 'leave Annual Planner before error test');
  await evaluate(`ledgerRouter.navigate('/annual-planner')`);
  await until(`location.pathname === '/annual-planner' && ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled) && categoryRequests.some(r => r.owner === 'owner-a' && !r.settled) && snapshotReads.some(r => r.owner === 'owner-a' && r.kind === 'list' && !r.settled)`, 'Annual Planner remounts with fresh account reads');
  await click('Actual');
  await evaluate(`resolveLedger('owner-a', [], { code: 'server_error', message: 'PRIVATE_ANNUAL_ERROR' }); resolveCategories('owner-a', []); resolveSnapshotRead('owner-a', [], 'list')`);
  await until(`!!document.querySelector('[data-annual-actual-status="error"]')`, 'Annual Planner displays account actual error');
  check(await evaluate(`document.body.textContent.includes('Annual Planner actuals are unavailable') && document.body.textContent.includes('Account actuals unavailable.') && !document.body.textContent.includes('$987,654') && !document.body.textContent.includes('PRIVATE_ANNUAL_ERROR') && !document.body.textContent.includes('Annual account actual totals:')`), 'Annual Planner errors do not fall back to local actuals or imply zero');
  await click('Retry');
  await until(`ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'Annual Planner retry starts an account read');
  await evaluate(`resolveLedger('owner-a', ${JSON.stringify(annualRows)})`);
  await until(`document.querySelector('[data-annual-actual-status="ready"]') && document.body.textContent.includes('Income $1,000')`, 'Annual Planner retry recovers');

  await evaluate(`setLedgerAccount('owner-b')`);
  await until(`ledgerRequests.some(r => r.owner === 'owner-b' && !r.settled) && categoryRequests.some(r => r.owner === 'owner-b' && !r.settled) && snapshotReads.some(r => r.owner === 'owner-b' && r.kind === 'list' && !r.settled)`, 'Annual Planner reloads after account switch');
  check(await evaluate(`document.querySelector('[data-annual-actual-status="loading"]') && !document.body.textContent.includes('$1,000') && !document.body.textContent.includes('$987,654')`), 'Annual Planner clears previous account actuals during account switch');
  await evaluate(`resolveLedger('owner-b', []); resolveCategories('owner-b', []); resolveSnapshotRead('owner-b', [], 'list')`);
  await until(`!!document.querySelector('[data-annual-actual-status="ready"]') && document.body.textContent.includes('Income $0 · Expenses $0 · Savings $0 · Debt $0 · Amount Left $0')`, 'empty account Annual Planner actuals resolve to zero');
  check(await evaluate(`Object.entries(${JSON.stringify(plannerStorageSnapshot)}).filter(([key]) => key !== 'financeos:app-data:v1').every(([key, value]) => readLegacy(key) === value) && JSON.parse(readLegacy('financeos:app-data:v1')).transactions.some(row => row.name === 'LEGACY_SENTINEL')`), 'Annual Planner account switching leaves local legacy transaction and setup storage intact');

  await evaluate(`setLedgerAccount('owner-a')`);
  await until(`ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled) && categoryRequests.some(r => r.owner === 'owner-a' && !r.settled) && snapshotReads.some(r => r.owner === 'owner-a' && r.kind === 'list' && !r.settled)`, 'Annual Planner restores owner A before Reports checks');
  await evaluate(`resolveLedger('owner-a', ${JSON.stringify(annualRows)}); resolveCategories('owner-a', []); resolveSnapshotRead('owner-a', [], 'list')`);
  await until(`!!document.querySelector('[data-annual-actual-status="ready"]')`, 'owner A Annual Planner state is restored');

  await evaluate(`ledgerRouter.navigate('/settings')`);
  await until(`location.pathname === '/settings'`, 'leave dashboard before Reports checks');
  await evaluate(`ledgerRouter.navigate('/reports')`);
  await until(`location.pathname === '/reports' && document.querySelector('[data-report-actual-status="loading"]') && ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled) && categoryRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'Reports requests account actuals and category labels');
  check(await evaluate(`document.body.textContent.includes('Loading account actuals') && !document.body.textContent.includes('$987,654') && [...document.querySelectorAll('button')].find(button => button.textContent.includes('Save This Year'))?.disabled`), 'Reports loading state masks legacy actual values and disables snapshot saving');
  const reportRows = await evaluate(`(() => {
    const year = new Date().getFullYear();
    const make = (id, type, amount, month, day, category_id, rowYear = year) => ({ id, user_id: 'owner-a', type, amount, title: id,
      transaction_date: rowYear + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
      created_at: rowYear + '-01-01T12:00:00Z', updated_at: rowYear + '-01-01T12:00:00Z', category_id, payment_method_id: null,
      notes: null, source: 'manual', description: null, is_recurring: false, recurring_group_id: null });
    return [make('Report income', 'income', 1000, 1, 3, null), make('Report expense A', 'expense', 100, 1, 4, 'report-food'),
      make('Report expense B', 'expense', 25, 2, 5, 'report-food'), make('Report unassigned', 'expense', 10, 2, 6, null),
      make('Report savings', 'savings', 200, 3, 7, null), make('Report debt', 'debt', 50, 4, 8, null),
      make('Prior year', 'income', 987654, 1, 1, null, year - 1)];
  })()`);
  const reportYear = await evaluate(`new Date().getFullYear()`);
  const reportRowsCurrentYear = reportRows.filter(row => Number(row.transaction_date.slice(0, 4)) === reportYear);
  const reportFoodCategory = [{ id: 'report-food', user_id: 'owner-a', name: 'Report Food', type: 'expense', icon: null, color: null,
    sort_order: 1, is_default: false, is_archived: false, created_at: null, updated_at: null }];
  await evaluate(`resolveLedger('owner-a', ${JSON.stringify(reportRowsCurrentYear)}); resolveCategories('owner-a', ${JSON.stringify(reportFoodCategory)})`);
  await until(`document.querySelector('[data-report-actual-status="ready"]') && document.body.textContent.includes('Report Food')`, 'Reports displays account totals and category labels');
  check(await evaluate(`document.body.textContent.includes('$1,000') && document.body.textContent.includes('$135') && document.body.textContent.includes('$200') && document.body.textContent.includes('$50') && document.body.textContent.includes('Expected: local plan') && document.body.textContent.includes('account archive')`), 'Reports KPIs and actual chart inputs use Supabase while expected stays local and archives are account-backed');
  check(await evaluate(`document.body.textContent.includes('Not assigned') && !!document.querySelector('.recharts-wrapper') && !document.body.textContent.includes('LEGACY_CATEGORY_SENTINEL')`), 'Reports groups actual expenses by account category UUID and handles null categories neutrally');
  const reportStorageSnapshot = await evaluate(`Object.fromEntries(Object.keys(legacyBefore).map(key => [key, readLegacy(key)]))`);
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(80);
    check(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'responsive Reports fits ' + width + 'px');
  }
  await evaluate(`ledgerRouter.navigate('/settings')`);
  await until(`location.pathname === '/settings'`, 'leave Reports before error state');
  await evaluate(`ledgerRouter.navigate('/reports')`);
  await until(`location.pathname === '/reports' && ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'Reports remount loads account actuals');
  await evaluate(`resolveLedger('owner-a', [], { code: 'server_error', message: 'PRIVATE_REPORT_ERROR' })`);
  await until(`!!document.querySelector('[data-report-actual-status="error"]')`, 'Reports actual error state');
  check(await evaluate(`document.body.textContent.includes('Report actuals are unavailable') && document.body.textContent.includes('Unavailable') && [...document.querySelectorAll('button')].find(button => button.textContent.includes('Save This Year'))?.disabled && !document.body.textContent.includes('PRIVATE_REPORT_ERROR') && !document.body.textContent.includes('$987,654')`), 'Reports errors do not fall back to legacy actuals or allow snapshots');
  await click('Retry');
  await until(`ledgerRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'Reports retry starts a new read');
  await until(`categoryRequests.some(r => r.owner === 'owner-a' && !r.settled)`, 'snapshot category labels reload with retry');
  await evaluate(`resolveLedger('owner-a', ${JSON.stringify(reportRowsCurrentYear)}); resolveCategories('owner-a', ${JSON.stringify(reportFoodCategory)})`);
  await until(`document.querySelector('[data-report-actual-status="ready"]') && document.body.textContent.includes('$1,000')`, 'Reports retry recovers');
  await until(`snapshotReads.some(request => request.owner === 'owner-a' && request.kind === 'list' && !request.settled)`, 'Reports loads existing account snapshots');
  await evaluate(`resolveSnapshotRead('owner-a', [], 'list')`);
  await click('Save This Year');
  await click('Confirm Save');
  await until(`snapshotReads.some(request => request.owner === 'owner-a' && request.kind === 'single' && !request.settled)`, 'snapshot overwrite lookup is owner-scoped');
  await evaluate(`resolveSnapshotRead('owner-a', [], 'single')`);
  await until(`snapshotWrites.some(request => request.owner === 'owner-a' && request.action === 'insert' && !request.settled)`, 'new snapshot inserts into the account archive');
  await evaluate(`resolveSnapshotWrite('owner-a')`);
  await until(`snapshotRows.some(snapshot => snapshot.user_id === 'owner-a')`, 'account-backed snapshot save completes');
  const newReportSnapshot = await evaluate(`snapshotRows.find(snapshot => snapshot.user_id === 'owner-a').summary`);
  check(newReportSnapshot.snapshot_version === 2 && newReportSnapshot.actual_source === 'supabase' && newReportSnapshot.expected_source === 'local' && newReportSnapshot.snapshot_owner_id === 'owner-a' && newReportSnapshot.total_income === 1000 && newReportSnapshot.total_expenses === 135 && newReportSnapshot.total_savings === 200 && newReportSnapshot.total_debt === 50 && newReportSnapshot.total_amount_left === 615 && newReportSnapshot.transaction_count === 6, 'snapshot stores Supabase actual totals/count, source and owner metadata while excluding local actual sentinel');
  check(await evaluate(`Object.entries(${JSON.stringify(reportStorageSnapshot)}).every(([key, value]) => readLegacy(key) === value) && snapshotRows.length === 1`), 'snapshot save changes only the account archive and leaves all browser-local finance/setup storage byte-for-byte unchanged');
  await evaluate(`setLedgerAccount('owner-b')`);
  await until(`ledgerRequests.some(r => r.owner === 'owner-b' && !r.settled) && categoryRequests.some(r => r.owner === 'owner-b' && !r.settled)`, 'Reports reloads for switched account');
  await until(`snapshotReads.some(request => request.owner === 'owner-b' && request.kind === 'list' && !request.settled)`, 'account archives reload for switched owner');
  check(await evaluate(`document.querySelector('[data-report-actual-status="loading"]') && !document.body.textContent.includes('$1,000')`), 'Reports clears prior-account actuals immediately during account switch');
  await evaluate(`resolveLedger('owner-b', []); resolveCategories('owner-b', [])`);
  await evaluate(`resolveSnapshotRead('owner-b', [], 'list')`);
  await until(`document.querySelector('[data-report-actual-status="ready"]') && document.body.textContent.includes('$0')`, 'Reports resolves empty new-account actuals');
  check(await evaluate(`!document.body.textContent.includes('Report Food') && !document.body.textContent.includes('$1,000')`), 'Reports does not retain prior-account values or category labels');
  await click('Save This Year');
  await click('Confirm Save');
  await until(`snapshotReads.some(request => request.owner === 'owner-b' && request.kind === 'single' && !request.settled)`, 'empty-account overwrite lookup');
  await evaluate(`resolveSnapshotRead('owner-b', [], 'single')`);
  await until(`snapshotWrites.some(request => request.owner === 'owner-b' && request.action === 'insert' && !request.settled)`, 'empty account saves a zero-actual archive');
  await evaluate(`resolveSnapshotWrite('owner-b')`);
  await until(`snapshotRows.some(snapshot => snapshot.user_id === 'owner-b')`, 'empty account archive save succeeds');
  check(await evaluate(`(() => {
    const rows = snapshotRows;
    const first = rows.find(snapshot => snapshot.user_id === 'owner-a').summary;
    const second = rows.find(snapshot => snapshot.user_id === 'owner-b').summary;
    return rows.length === 2 && first.total_income === 1000
      && second.total_income === 0 && second.total_expenses === 0 && second.total_savings === 0
      && second.total_debt === 0 && second.total_amount_left === 0 && second.transaction_count === 0;
  })()`), 'account switch stores isolated account snapshots including valid zero actuals for the empty account');
  await evaluate(`ledgerRouter.navigate('/saved-budgets')`);
  await until(`location.pathname === '/saved-budgets' && snapshotReads.some(request => request.owner === 'owner-b' && request.kind === 'list' && !request.settled) && ledgerRequests.some(request => request.owner === 'owner-b' && !request.settled) && categoryRequests.some(request => request.owner === 'owner-b' && !request.settled)`, 'archive screen loads account snapshots and independent account metadata');
  const ownerBRows = await evaluate(`(() => {
    const first = snapshotRows.find(snapshot => snapshot.user_id === 'owner-b');
    snapshotRows.push({ ...first, id: '94000000-0000-4000-8000-000000000099', summary: { ...first.summary, notes: 'Separate historical version' } });
    return snapshotRows.filter(snapshot => snapshot.user_id === 'owner-b');
  })()`);
  await evaluate(`resolveSnapshotRead('owner-b', ${JSON.stringify(ownerBRows)}, 'list'); resolveLedger('owner-b', []); resolveCategories('owner-b', [])`);
  await until(`document.body.textContent.includes('Annual Summary') && document.body.textContent.includes('No saved budgets yet') === false`, 'account archive displays only the current owner snapshot');
  await evaluate(`([...document.querySelectorAll('button')].find(button => button.textContent.includes('Annual Summary'))).click()`);
  await until(`document.body.textContent.includes('Total Income') && document.body.textContent.includes('Actual values are stored from Supabase')`, 'stored archive values open without recomputation');
  check(await evaluate(`document.body.textContent.includes('$0') && document.body.textContent.includes('Legacy local archives') && !document.querySelector('details[open]')`), 'account archive is separate from collapsed read-only legacy browser archives');
  await click('Update from current data');
  await until(`snapshotReads.some(request => request.owner === 'owner-b' && request.kind === 'single' && !request.settled)`, 'snapshot resave targets one existing UUID');
  await evaluate(`resolveSnapshotRead('owner-b', [{ id: snapshotRows.find(row => row.user_id === 'owner-b').id }], 'single')`);
  await until(`snapshotWrites.some(request => request.owner === 'owner-b' && request.action === 'update' && !request.settled)`, 'snapshot resave updates the selected version');
  await evaluate(`resolveSnapshotWrite('owner-b')`);
  await until(`[...document.querySelectorAll('button')].filter(button => button.textContent.includes('Annual Summary')).length === 2`, 'overwrite preserves both same-period archive versions in the visible list');
  check(await evaluate(`snapshotRows.filter(row => row.user_id === 'owner-b').length === 2 && snapshotRows.some(row => row.summary.notes === 'Separate historical version')`), 'resave leaves the independent stored historical version intact');
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(80);
    const archiveWidth = await evaluate(`({ fits: document.documentElement.scrollWidth <= innerWidth, scroll: document.documentElement.scrollWidth, inner: innerWidth, offenders: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 6).map(el => ({ tag: el.tagName, cls: String(el.className).slice(0, 100), right: Math.round(el.getBoundingClientRect().right), text: el.textContent.slice(0, 40) })) })`);
    check(archiveWidth.fits, 'responsive account archive fits ' + width + 'px ' + JSON.stringify(archiveWidth));
  }
  await evaluate(`document.querySelector('textarea').focus()`);
  await setFormValue('textarea', 'Persisted account archive note', 'TEXTAREA');
  await click('Save Notes');
  await until(`snapshotReads.some(request => request.owner === 'owner-b' && request.kind === 'single' && !request.settled)`, 'archive note reads its current owner-scoped payload');
  await evaluate(`resolveSnapshotRead('owner-b', [{ summary: snapshotRows.find(snapshot => snapshot.user_id === 'owner-b').summary }], 'single')`);
  await until(`snapshotWrites.some(request => request.owner === 'owner-b' && request.action === 'update' && !request.settled)`, 'archive notes update through owner-scoped backend mutation');
  await evaluate(`resolveSnapshotWrite('owner-b')`);
  await until(`snapshotRows.find(snapshot => snapshot.user_id === 'owner-b')?.summary.notes === 'Persisted account archive note'`, 'account archive notes persist while summary metrics remain stored');
  check(await evaluate(`snapshotRows.find(snapshot => snapshot.user_id === 'owner-b').summary.total_income === 0`), 'notes mutation preserves historical snapshot actual values');
  await evaluate(`window.confirm = () => true; [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Delete').click()`);
  await until(`snapshotWrites.some(request => request.owner === 'owner-b' && request.action === 'delete' && !request.settled)`, 'archive deletion requires confirmation and targets the owned record');
  await evaluate(`setLedgerAccount('owner-a')`);
  await until(`snapshotReads.some(request => request.owner === 'owner-a' && request.kind === 'list' && !request.settled)`, 'account archive clears and reloads after owner change');
  const ownerARows = await evaluate(`snapshotRows.filter(snapshot => snapshot.user_id === 'owner-a')`);
  await evaluate(`resolveSnapshotRead('owner-a', ${JSON.stringify(ownerARows)}, 'list'); resolveLedger('owner-a', []); resolveCategories('owner-a', [])`);
  await pause(100);
  await evaluate(`([...document.querySelectorAll('button')].find(button => button.textContent.includes('Annual Summary'))).click()`);
  await until(`document.body.textContent.includes('Annual Summary') && document.body.textContent.includes('No saved budgets yet') === false`, "new owner's account archive is visible");
  await evaluate(`resolveSnapshotWrite('owner-b')`);
  check(await evaluate(`document.body.textContent.includes('Persisted account archive note') === false && document.body.textContent.includes('Total Income') && document.body.textContent.includes('$1,000')`), 'late prior-account delete response cannot remove or replace the current owner archive');
  check(await evaluate(`!document.body.textContent.includes('The active account changed before the archive operation completed.')`), 'stale archive mutations do not show feedback in the new account');

  const phase7StorageSnapshot = await evaluate(`Object.fromEntries(Object.keys(legacyBefore).map(key => [key, readLegacy(key)]))`);
  await evaluate(`ledgerRouter.navigate('/settings')`);
  await until(`location.pathname === '/settings'`, 'leave archive before Phase 7 screen checks');
  await evaluate(`window.phase7Date = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-15';
    window.phase7Rows = [
      { id: 'phase7-income', user_id: 'owner-a', title: 'Account income current period', amount: 1234, type: 'income', transaction_date: window.phase7Date, category_id: '10000000-0000-4000-8000-000000000000', payment_method_id: null, notes: null, source: 'manual', is_recurring: false, recurring_group_id: null, description: null, created_at: window.phase7Date + 'T12:00:00Z', updated_at: window.phase7Date + 'T12:00:00Z' },
      { id: 'phase7-expense', user_id: 'owner-a', title: 'Account expense current period', amount: 88, type: 'expense', transaction_date: window.phase7Date, category_id: '31000000-0000-4000-8000-000000000000', payment_method_id: null, notes: null, source: 'manual', is_recurring: false, recurring_group_id: null, description: null, created_at: window.phase7Date + 'T12:00:00Z', updated_at: window.phase7Date + 'T12:00:00Z' },
      { id: 'phase7-savings', user_id: 'owner-a', title: 'Account savings current period', amount: 75, type: 'savings', transaction_date: window.phase7Date, category_id: '41000000-0000-4000-8000-000000000000', payment_method_id: null, notes: null, source: 'manual', is_recurring: false, recurring_group_id: null, description: null, created_at: window.phase7Date + 'T12:00:00Z', updated_at: window.phase7Date + 'T12:00:00Z' },
      { id: 'phase7-debt', user_id: 'owner-a', title: 'Account debt current period', amount: 40, type: 'debt', transaction_date: window.phase7Date, category_id: null, payment_method_id: null, notes: null, source: 'manual', is_recurring: false, recurring_group_id: null, description: null, created_at: window.phase7Date + 'T12:00:00Z', updated_at: window.phase7Date + 'T12:00:00Z' },
    ];
    window.phase7Categories = [
      { id: '10000000-0000-4000-8000-000000000000', user_id: 'owner-a', name: 'Phase 7 Income', type: 'income', is_archived: false },
      { id: '31000000-0000-4000-8000-000000000000', user_id: 'owner-a', name: 'Phase 7 Food', type: 'expense', is_archived: false },
      { id: '41000000-0000-4000-8000-000000000000', user_id: 'owner-a', name: 'Phase 7 Goal', type: 'savings', is_archived: false },
    ];`);
  await evaluate(`ledgerRouter.navigate('/income')`);
  await until(`location.pathname === '/income' && document.querySelector('[data-income-actual-status="loading"]') && ledgerRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'Income loads account-backed actuals');
  check(await evaluate(`!document.body.textContent.includes('LEGACY_SENTINEL') && document.body.textContent.includes('Loading…')`), 'Income masks prior/local actuals during load');
  await evaluate(`resolveLedger('owner-a', window.phase7Rows); resolveCategories('owner-a', window.phase7Categories)`);
  await until(`document.querySelector('[data-income-actual-status="ready"]') && document.body.textContent.includes('Account income current period')`, 'Income resolves Supabase rows and category metadata');
  check(await evaluate(`document.body.textContent.includes('$1,234') && document.body.textContent.includes('Expected Income') && document.body.textContent.includes('Phase 7 Income') && !document.body.textContent.includes('LEGACY_SENTINEL')`), 'Income actuals/rows are account-backed while expected income remains local');
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(80);
    check(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'responsive Income fits ' + width + 'px');
  }
  await evaluate(`ledgerRouter.navigate('/settings')`);
  await until(`location.pathname === '/settings'`, 'leave Income before error/retry checks');
  await evaluate(`ledgerRouter.navigate('/income')`);
  await until(`location.pathname === '/income' && ledgerRequests.some(request => request.owner === 'owner-a' && !request.settled) && categoryRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'Income remount fetches account metadata');
  await evaluate(`resolveLedger('owner-a', [], { message: 'PRIVATE_INCOME_ERROR' }); resolveCategories('owner-a', window.phase7Categories)`);
  await until(`!!document.querySelector('[data-income-actual-status="error"]')`, 'Income exposes account read error');
  check(await evaluate(`document.body.textContent.includes('Unavailable') && !document.body.textContent.includes('PRIVATE_INCOME_ERROR') && !document.body.textContent.includes('LEGACY_SENTINEL')`), 'Income error does not expose backend details or fall back locally');
  await click('Retry');
  await until(`ledgerRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'Income retry requests account actuals');
  await evaluate(`resolveLedger('owner-a', [])`);
  await until(`document.querySelector('[data-income-actual-status="ready"]') && document.body.textContent.includes('No income entries yet')`, 'Income valid empty period is distinct from error');
  await evaluate(`setLedgerAccount('owner-b')`);
  await until(`ledgerRequests.some(request => request.owner === 'owner-b' && !request.settled) && categoryRequests.some(request => request.owner === 'owner-b' && !request.settled)`, 'Income reloads for switched account');
  check(await evaluate(`document.querySelector('[data-income-actual-status="loading"]') && !document.body.textContent.includes('Account income current period') && !document.body.textContent.includes('$1,234')`), 'Income clears previous account rows and totals during switch');
  await evaluate(`resolveLedger('owner-b', []); resolveCategories('owner-b', [])`);
  await until(`document.querySelector('[data-income-actual-status="ready"]') && document.body.textContent.includes('No income entries yet')`, 'Income new empty account resolves');
  await evaluate(`setLedgerAccount('owner-a')`);
  await until(`ledgerRequests.some(request => request.owner === 'owner-a' && !request.settled) && categoryRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'Income restores owner A before Expenses test');
  await evaluate(`resolveLedger('owner-a', window.phase7Rows); resolveCategories('owner-a', window.phase7Categories)`);
  await until(`document.querySelector('[data-income-actual-status="ready"]') && document.body.textContent.includes('Account income current period')`, 'Income owner A state restored');

  await evaluate(`ledgerRouter.navigate('/settings')`);
  await until(`location.pathname === '/settings'`, 'leave Income before Expenses check');
  await evaluate(`ledgerRouter.navigate('/expenses')`);
  await until(`location.pathname === '/expenses' && document.querySelector('[data-actual-status="loading"]') && ledgerRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'Expenses loads account actuals independently');
  check(await evaluate(`!document.body.textContent.includes('LEGACY_SENTINEL') && document.body.textContent.includes('Loading…')`), 'Expenses hides legacy actual rows during load');
  await evaluate(`resolveLedger('owner-a', window.phase7Rows); resolveCategories('owner-a', window.phase7Categories)`);
  await until(`document.querySelector('[data-actual-status="ready"]') && document.body.textContent.includes('Account expense current period')`, 'Expenses renders account expense rows');
  check(await evaluate(`document.body.textContent.includes('$88') && document.body.textContent.includes('Phase 7 Food') && document.body.textContent.includes('Fixed Expense Plans (browser-local)') && document.body.textContent.includes('Expected Budget (local)') && !document.body.textContent.includes('LEGACY_SENTINEL')`), 'Expenses totals/category rows use Supabase and fixed plans remain separate local planning');
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(80);
    check(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'responsive Expenses fits ' + width + 'px');
  }
  await evaluate(`ledgerRouter.navigate('/settings')`);
  await until(`location.pathname === '/settings'`, 'leave Expenses before fetch failure check');
  await evaluate(`ledgerRouter.navigate('/expenses')`);
  await until(`location.pathname === '/expenses' && ledgerRequests.some(request => request.owner === 'owner-a' && !request.settled) && categoryRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'Expenses remount loads account data');
  await evaluate(`resolveLedger('owner-a', [], { message: 'PRIVATE_EXPENSE_ERROR' }); resolveCategories('owner-a', window.phase7Categories)`);
  await until(`!!document.querySelector('[data-actual-status="error"]')`, 'Expenses displays safe account error');
  check(await evaluate(`document.body.textContent.includes('Unavailable') && !document.body.textContent.includes('PRIVATE_EXPENSE_ERROR') && !document.body.textContent.includes('LEGACY_SENTINEL')`), 'Expenses failure has no local actual fallback');
  await click('Retry');
  await until(`ledgerRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'Expenses retry reads account actuals');
  await evaluate(`resolveLedger('owner-a', window.phase7Rows)`);
  await until(`document.querySelector('[data-actual-status="ready"]') && document.body.textContent.includes('Account expense current period')`, 'Expenses retry restores Supabase rows');

  await evaluate(`ledgerRouter.navigate('/settings')`);
  await until(`location.pathname === '/settings'`, 'leave Expenses before Savings check');
  await evaluate(`ledgerRouter.navigate('/tracker')`);
  await until(`location.pathname === '/tracker' && document.querySelector('[data-savings-actual-status="loading"]') && ledgerRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'Savings loads account actuals');
  check(await evaluate(`!document.body.textContent.includes('LEGACY_SENTINEL') && document.body.textContent.includes('Loading…')`), 'Savings masks legacy actual values while loading');
  await evaluate(`resolveLedger('owner-a', window.phase7Rows); resolveCategories('owner-a', window.phase7Categories)`);
  await until(`document.querySelector('[data-savings-actual-status="ready"]') && document.body.textContent.includes('Phase 7 Goal')`, 'Savings resolves actual contribution UUID groups');
  check(await evaluate(`document.body.textContent.includes('$75') && document.body.textContent.includes('Expected savings') && !document.body.textContent.includes('LEGACY_SENTINEL')`), 'Savings contributions use account rows while goals/expected targets remain local');
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(80);
    check(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'responsive Savings fits ' + width + 'px');
  }
  await evaluate(`ledgerRouter.navigate('/settings')`);
  await until(`location.pathname === '/settings'`, 'leave Savings before fetch failure check');
  await evaluate(`ledgerRouter.navigate('/tracker')`);
  await until(`location.pathname === '/tracker' && ledgerRequests.some(request => request.owner === 'owner-a' && !request.settled) && categoryRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'Savings remount loads account data');
  await evaluate(`resolveLedger('owner-a', [], { message: 'PRIVATE_SAVINGS_ERROR' }); resolveCategories('owner-a', window.phase7Categories)`);
  await until(`!!document.querySelector('[data-savings-actual-status="error"]')`, 'Savings displays safe account error');
  check(await evaluate(`document.body.textContent.includes('Unavailable') && !document.body.textContent.includes('PRIVATE_SAVINGS_ERROR') && !document.body.textContent.includes('LEGACY_SENTINEL')`), 'Savings failure has no local actual fallback');
  await click('Retry');
  await until(`ledgerRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'Savings retry reads account actuals');
  await evaluate(`resolveLedger('owner-a', window.phase7Rows)`);
  await until(`document.querySelector('[data-savings-actual-status="ready"]') && document.body.textContent.includes('Phase 7 Goal')`, 'Savings retry restores account contributions');
  check(await evaluate(`Object.entries(${JSON.stringify(phase7StorageSnapshot)}).every(([key, value]) => readLegacy(key) === value) && legacyAccess.every(entry => entry.method !== 'removeItem' && entry.method !== 'clear')`), 'migrated actual screens leave local finance/setup storage byte-for-byte unchanged');

  const expectedLegacyAccessBefore = await evaluate(`legacyAccess.length`);
  await evaluate(`ledgerRouter.navigate('/expected-transactions')`);
  await until(`location.pathname === '/expected-transactions' && document.querySelector('[aria-label="Loading expected transactions"]') && expectedTransactionRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'expected ledger loads from account service');
  await until(`categoryRequests.some(request => request.owner === 'owner-a' && !request.settled) && paymentMethodRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'expected ledger loads account-owned labels independently');
  check(await evaluate(`!document.body.textContent.includes('LEGACY_SENTINEL') && !document.body.textContent.includes('LEGACY_CATEGORY_SENTINEL') && !document.body.textContent.includes('LEGACY_METHOD_SENTINEL') && legacyAccess.length === ${expectedLegacyAccessBefore}`), 'expected ledger never reads browser-local financial state');
  await evaluate(`(() => {
    const now = new Date();
    const iso = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
    const past = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate()-1));
    const today = iso(now);
    const future = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate()+1));
    const base = { user_id: 'owner-a', amount: 75.25, category_id: '10000000-0000-4000-8000-000000000000', payment_method_id: '20000000-0000-4000-8000-000000000000', notes: 'Expected note', completed_at: null, actual_transaction_id: null, created_at: today+'T10:00:00Z', updated_at: today+'T10:00:00Z' };
    window.expectedRows = [
      { ...base, id: 'expected-expense', title: 'Expected rent', type: 'expense', expected_date: past, status: 'planned' },
      { ...base, id: 'expected-income', title: 'Expected pay', type: 'income', expected_date: future, status: 'planned' },
      { ...base, id: 'expected-savings', title: 'Expected transfer', type: 'savings', expected_date: today, status: 'completed', completed_at: today+'T12:00:00Z', actual_transaction_id: 'actual-savings' },
      { ...base, id: 'expected-debt', title: 'Expected debt payment', type: 'debt', expected_date: past, status: 'cancelled', category_id: null, payment_method_id: null, notes: null },
    ];
  })()`);
  await evaluate(`resolveCategories('owner-a', [
    { id: '10000000-0000-4000-8000-000000000000', user_id: 'owner-a', name: 'Archived Housing', type: 'expense', is_archived: true },
    { id: '10000000-0000-4000-8000-000000000001', user_id: 'owner-a', name: 'Current Housing', type: 'expense', is_archived: false },
    { id: '10000000-0000-4000-8000-000000000002', user_id: 'owner-a', name: 'Salary', type: 'income', is_archived: false }
  ]); resolvePaymentMethods('owner-a', [
    { id: '20000000-0000-4000-8000-000000000000', user_id: 'owner-a', nickname: 'Archived Checking', type: 'checking', is_archived: true },
    { id: '20000000-0000-4000-8000-000000000001', user_id: 'owner-a', nickname: 'Active Checking', type: 'checking', is_archived: false, is_default: true }
  ]); resolveExpectedTransactions('owner-a', window.expectedRows)`);
  await until(`document.querySelectorAll('.expected-transactions-table tbody tr').length === 4`, 'all expected event types render');
  check(await evaluate(`document.body.textContent.includes('Expected rent') && document.body.textContent.includes('Expected pay') && document.body.textContent.includes('Expected transfer') && document.body.textContent.includes('Expected debt payment') && document.body.textContent.includes('Archived Housing') && document.body.textContent.includes('Archived Checking') && document.body.textContent.includes('Expected note') && document.body.textContent.includes('Recorded as actual') && document.body.textContent.includes('Overdue · Planned')`), 'expected rows show event fields, archived labels, and derived status');
  check(await evaluate(`document.querySelectorAll('.expected-transactions-table tbody tr').length === 4 && !document.body.textContent.includes('Account income current period') && !document.body.textContent.includes('LEGACY_SENTINEL') && document.querySelectorAll('button[aria-label^="Edit "]').length === 3 && document.querySelector('[data-expected-transaction-id="expected-savings"] [aria-label^="Edit "]') === null && document.querySelector('[data-expected-transaction-id="expected-savings"] td[data-label="Actions"]').textContent.includes('Read only')`), 'expected ledger remains separate and completed rows are read-only');
  check(await evaluate(`document.querySelector('.expected-transactions-table tbody tr[data-expected-transaction-id="expected-expense"] td[data-label="Status"]')?.textContent.includes('Overdue') && document.querySelector('.expected-transactions-table tbody tr[data-expected-transaction-id="expected-savings"] td[data-label="Status"]')?.textContent.includes('Recorded as actual')`), 'only planned past events are overdue and completed rows are historical');
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await pause(80);
    check(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'responsive Expected Transactions fits ' + width + 'px');
  }
  await evaluate(`(() => { const el=document.querySelector('[aria-label="Filter expected transactions by type"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'income'); el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await until(`document.querySelectorAll('.expected-transactions-table tbody tr').length === 1 && document.body.textContent.includes('Expected pay')`, 'type filter selects expected income only');
  await evaluate(`(() => { const el=document.querySelector('[aria-label="Filter expected transactions by type"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'all'); el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await evaluate(`(() => { const el=document.querySelector('[aria-label="Filter expected transactions by status"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'overdue'); el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await until(`document.querySelectorAll('.expected-transactions-table tbody tr').length === 1 && document.body.textContent.includes('Expected rent')`, 'overdue filter is derived from planned date');
  await evaluate(`(() => { const el=document.querySelector('[aria-label="Filter expected transactions by status"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'all'); el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await evaluate(`(() => { const el=document.querySelector('[aria-label="Filter expected transactions by type"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'all'); el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await evaluate(`(() => { const el=document.querySelector('[aria-label="Search expected transactions by title"]'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(el,'rent'); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await until(`document.querySelectorAll('.expected-transactions-table tbody tr').length === 1 && document.body.textContent.includes('Expected rent')`, 'title search filters events locally');
  await evaluate(`(() => { const el=document.querySelector('[aria-label="Search expected transactions by title"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,''); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);

  await evaluate(`document.querySelector('[aria-label="Record Expected rent as completed"]').click()`);
  await until(`!!document.querySelector('[role="dialog"]')`, 'completion editor opens');
  check(await evaluate(`document.querySelector('[role="dialog"]').textContent.includes('keeps the expected event as history') && document.querySelector('[aria-label="Expected transaction type"]').disabled && document.querySelector('[aria-label="Actual transaction date"]').value === window.expectedRows[0].expected_date`), 'completion preserves type and defaults to expected calendar date');
  await evaluate(`document.querySelector('[role="dialog"] form').requestSubmit()`);
  await until(`document.querySelector('[role="dialog"]').textContent.includes('Choose an active category') && document.querySelector('[role="dialog"]').textContent.includes('Choose an active payment method')`, 'archived historical defaults require replacement or clearing for new actual');
  check(await evaluate(`!expectedTransactionWrites.some(request=>request.action==='complete') && !document.querySelector('[aria-label="Record Expected debt payment as completed"]') && !document.querySelector('[aria-label="Record Expected transfer as completed"]')`), 'invalid archived selection makes no RPC and cancelled/completed rows offer no completion');
  await click('Close');
  await click('Create Expected Transaction');
  await until(`!!document.querySelector('[role="dialog"]')`, 'expected-event create dialog');
  check(await evaluate(`document.querySelector('[role="dialog"]').textContent.includes('planned event, not an actual transaction') && document.querySelector('[aria-label="Expected transaction status"]') === null`), 'create form clearly distinguishes planned events and has no arbitrary status control');
  await evaluate(`document.querySelector('[role="dialog"] form').requestSubmit()`);
  await until(`document.querySelector('[role="dialog"]').textContent.includes('Title is required')`, 'expected title validation');
  await setFormValue('[aria-label="Expected transaction title"]', 'Planned gift');
  await setFormValue('[aria-label="Expected transaction amount"]', '50.25');
  const expectedCreateDate = await evaluate(`window.expectedRows[1].expected_date`);
  await setFormValue('[aria-label="Expected transaction date"]', expectedCreateDate);
  await setFormValue('[aria-label="Expected transaction category"]', '10000000-0000-4000-8000-000000000001', 'SELECT');
  await setFormValue('[aria-label="Expected transaction payment method"]', '20000000-0000-4000-8000-000000000001', 'SELECT');
  await setFormValue('[aria-label="Expected transaction notes"]', 'Gift planned', 'TEXTAREA');
  const expectedWriteCountBeforeCreate = await evaluate(`expectedTransactionWrites.length`);
  await evaluate(`(() => { const button=document.querySelector('[role="dialog"] button[type="submit"]'); button.click(); button.click(); })()`);
  await until(`expectedTransactionWrites.some(request => request.owner === 'owner-a' && request.action === 'insert' && !request.settled)`, 'expected create mutation');
  check(await evaluate(`expectedTransactionWrites.filter(request => request.action === 'insert').length === ${expectedWriteCountBeforeCreate + 1} && (() => { const p=expectedTransactionWrites.at(-1).payload; return Object.keys(p).sort().join(',') === 'amount,category_id,expected_date,notes,payment_method_id,title,type' && p.title === 'Planned gift' && p.status === undefined && p.user_id === undefined && p.actual_transaction_id === undefined && p.category_id === '10000000-0000-4000-8000-000000000001' && p.payment_method_id === '20000000-0000-4000-8000-000000000001'; })()`), 'create sends only safe fields, owned UUID choices, and blocks duplicate submit');
  await evaluate(`resolveExpectedTransactionWrite('owner-a','insert',{ ...window.expectedRows[0], id:'created-expected', title:'Planned gift', amount:50.25, expected_date:window.expectedRows[1].expected_date, category_id:'10000000-0000-4000-8000-000000000001', payment_method_id:'20000000-0000-4000-8000-000000000001', notes:'Gift planned' })`);
  await until(`document.querySelector('[data-expected-transaction-id="created-expected"]') && document.body.textContent.includes('Expected event created.')`, 'created row appears from server result');

  await evaluate(`document.querySelector('[aria-label="Edit Expected rent"]').click()`);
  await until(`!!document.querySelector('[role="dialog"]')`, 'expected event edit dialog');
  check(await evaluate(`document.querySelector('[aria-label="Expected transaction category"] option[value="10000000-0000-4000-8000-000000000000"]')?.textContent.includes('Archived (existing)') && document.querySelector('[aria-label="Expected transaction payment method"] option[value="20000000-0000-4000-8000-000000000000"]')?.textContent.includes('Archived (existing)')`), 'archived current category and payment method remain visible while editing');
  await setFormValue('[aria-label="Expected transaction type"]', 'income', 'SELECT');
  check(await evaluate(`document.querySelector('[aria-label="Expected transaction category"]').value === ''`), 'changing event type clears incompatible category');
  await setFormValue('[aria-label="Expected transaction type"]', 'expense', 'SELECT');
  check(await evaluate(`!document.querySelector('[aria-label="Expected transaction category"] option[value="10000000-0000-4000-8000-000000000000"]')`), 'archived category cannot be reselected after changing away');
  await setFormValue('[aria-label="Expected transaction category"]', '10000000-0000-4000-8000-000000000001', 'SELECT');
  await setFormValue('[aria-label="Expected transaction payment method"]', '20000000-0000-4000-8000-000000000001', 'SELECT');
  await setFormValue('[aria-label="Expected transaction title"]', 'Updated rent');
  await click('Save changes');
  await until(`expectedTransactionWrites.some(request => request.owner === 'owner-a' && request.action === 'update' && !request.settled)`, 'expected edit mutation');
  check(await evaluate(`(() => { const r=expectedTransactionWrites.filter(r=>r.action==='update').at(-1); return r.id === 'expected-expense' && r.payload.title === 'Updated rent' && r.payload.category_id === '10000000-0000-4000-8000-000000000001' && r.payload.payment_method_id === '20000000-0000-4000-8000-000000000001' && r.payload.status === undefined && r.payload.actual_transaction_id === undefined && r.payload.completed_at === undefined; })()`), 'edit uses server UUID and excludes lifecycle/completion fields');
  await evaluate(`resolveExpectedTransactionWrite('owner-a','update',{ ...window.expectedRows[0], title:'Updated rent', category_id:'10000000-0000-4000-8000-000000000001', payment_method_id:'20000000-0000-4000-8000-000000000001' })`);
  await until(`document.querySelector('[data-expected-transaction-id="expected-expense"]')?.textContent.includes('Updated rent')`, 'edited row reflects server state');

  await evaluate(`document.querySelector('[aria-label="Cancel Updated rent"]').click()`);
  await until(`expectedTransactionWrites.some(request => request.owner === 'owner-a' && request.action === 'update' && request.payload.status === 'cancelled' && !request.settled)`, 'expected cancel mutation');
  await evaluate(`resolveExpectedTransactionWrite('owner-a','update',{ ...window.expectedRows[0], title:'Updated rent', status:'cancelled', category_id:'10000000-0000-4000-8000-000000000001', payment_method_id:'20000000-0000-4000-8000-000000000001' })`);
  await until(`document.querySelector('[data-expected-transaction-id="expected-expense"] td[data-label="Status"]')?.textContent.includes('Cancelled')`, 'cancelled row is no longer overdue');
  await evaluate(`document.querySelector('[aria-label="Reopen Updated rent"]').click()`);
  await until(`expectedTransactionWrites.some(request => request.owner === 'owner-a' && request.action === 'update' && request.payload.status === 'planned' && !request.settled)`, 'expected reopen mutation');
  await evaluate(`resolveExpectedTransactionWrite('owner-a','update',{ ...window.expectedRows[0], title:'Updated rent', status:'planned', category_id:'10000000-0000-4000-8000-000000000001', payment_method_id:'20000000-0000-4000-8000-000000000001' })`);
  await until(`document.querySelector('[data-expected-transaction-id="expected-expense"] td[data-label="Status"]')?.textContent.includes('Overdue')`, 'reopened past event is overdue again');
  await evaluate(`document.querySelector('[aria-label="Cancel Updated rent"]').click()`);
  await until(`expectedTransactionWrites.filter(request => request.action === 'update' && request.payload.status === 'cancelled').length === 2`, 'cancel before delete');
  await evaluate(`resolveExpectedTransactionWrite('owner-a','update',{ ...window.expectedRows[0], title:'Updated rent', status:'cancelled', category_id:'10000000-0000-4000-8000-000000000001', payment_method_id:'20000000-0000-4000-8000-000000000001' })`);
  await until(`!!document.querySelector('[aria-label="Delete Updated rent"]')`, 'cancelled row offers delete');
  await evaluate(`window.confirm = message => { window.confirmMessages.push(message); return true; }`);
  await evaluate(`document.querySelector('[aria-label="Delete Updated rent"]').click()`);
  await until(`expectedTransactionWrites.some(request => request.owner === 'owner-a' && request.action === 'delete' && !request.settled)`, 'expected delete mutation');
  check(await evaluate(`confirmMessages.at(-1).includes('Updated rent') && confirmMessages.at(-1).includes('$75.25') && confirmMessages.at(-1).includes(window.expectedRows[0].expected_date) && expectedTransactionWrites.at(-1).filters.some(([column, values])=>column==='status' && values.includes('planned') && values.includes('cancelled'))`), 'delete confirms title, amount, date and limits server request to planned/cancelled');
  await evaluate(`resolveExpectedTransactionWrite('owner-a','delete',{ id:'expected-expense' })`);
  await until(`!document.querySelector('[data-expected-transaction-id="expected-expense"]')`, 'deleted row disappears without reload');
  check(await evaluate(`document.querySelector('[data-expected-transaction-id="expected-savings"] td[data-label="Actions"]').textContent.includes('Read only') && !document.querySelector('[aria-label="Edit Expected transfer"]') && !document.querySelector('[aria-label="Cancel Expected transfer"]') && !document.querySelector('[aria-label="Reopen Expected transfer"]') && !document.querySelector('[aria-label="Delete Expected transfer"]')`), 'completed rows expose no mutation actions');

  await evaluate(`document.querySelector('[aria-label="Record Planned gift as completed"]').click()`);
  const actualCompletionDate = expectedCreateDate.slice(0, 4) + '-02-28';
  await until(`!!document.querySelector('[role="dialog"]')`, 'planned gift completion dialog');
  for (const width of [375,768,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    check(await evaluate(`document.documentElement.scrollWidth <= innerWidth && document.querySelector('[role="dialog"]').getBoundingClientRect().right <= innerWidth`), 'completion dialog fits ' + width + 'px');
  }
  await setFormValue('[aria-label="Expected transaction amount"]', '0');
  await evaluate(`document.querySelector('[role="dialog"] form').requestSubmit()`);
  await until(`document.querySelector('[role="dialog"]').textContent.includes('Enter a positive amount')`, 'completion reuses actual amount validation');
  await setFormValue('[aria-label="Expected transaction amount"]', '60.75');
  await setFormValue('[aria-label="Actual transaction date"]', actualCompletionDate);
  await setFormValue('[aria-label="Expected transaction title"]', 'Actual gift');
  await setFormValue('[aria-label="Expected transaction notes"]', 'Actual gift note', 'TEXTAREA');
  await evaluate(`document.querySelector('[role="dialog"] form').requestSubmit(); document.querySelector('[role="dialog"] form').requestSubmit()`);
  await until(`expectedTransactionWrites.filter(request=>request.action==='complete').length === 1`, 'completion sends one RPC despite repeated submit');
  check(await evaluate(`(() => { const r=expectedTransactionWrites.at(-1); return r.payload.p_expected_transaction_id==='created-expected' && r.payload.p_amount===60.75 && r.payload.p_transaction_date===${JSON.stringify(actualCompletionDate)} && r.payload.p_category_id==='10000000-0000-4000-8000-000000000001' && r.payload.p_payment_method_id==='20000000-0000-4000-8000-000000000001' && r.payload.p_notes==='Actual gift note' && !('user_id' in r.payload) && !('status' in r.payload); })()`), 'completion RPC has exact adjusted date, overrides and owned UUID selectors');
  await evaluate(`resolveExpectedTransactionWrite('owner-a','complete',null,{code:'network',message:'PRIVATE_RPC_ERROR'})`);
  await until(`document.querySelector('[role="dialog"]').textContent.includes('Retry this same event safely')`, 'uncertain completion retains editor with safe retry');
  await evaluate(`document.querySelector('[role="dialog"] form').requestSubmit()`);
  await until(`expectedTransactionWrites.filter(request=>request.action==='complete').length === 2`, 'retry repeats same RPC');
  await evaluate(`window.completedActual = { ...window.expectedRows[0], id:'completed-actual-id', title:'Actual gift', amount:60.75, transaction_date:${JSON.stringify(actualCompletionDate)}, category_id:'10000000-0000-4000-8000-000000000001', payment_method_id:'20000000-0000-4000-8000-000000000001', notes:'Actual gift note', source:'manual', is_recurring:false }; window.completedExpected={ ...window.expectedRows[0], id:'created-expected', title:'Planned gift', status:'completed', actual_transaction_id:'completed-actual-id', completed_at:new Date().toISOString() }; resolveExpectedTransactionWrite('owner-a','complete',{ expected_transaction:window.completedExpected, actual_transaction:window.completedActual, already_completed:true })`);
  await until(`!document.querySelector('[role="dialog"]') && document.querySelector('[data-expected-transaction-id="created-expected"] td[data-label="Status"]').textContent.includes('Recorded as actual')`, 'idempotent retry updates expected to completed without duplication');
  check(await evaluate(`document.querySelector('[data-expected-transaction-id="created-expected"] td[data-label="Actions"]').textContent.includes('Read only') && !document.querySelector('[data-expected-transaction-id="created-expected"] td[data-label="Status"]').textContent.includes('Overdue')`), 'completed row loses overdue and all mutation controls');
  await evaluate(`document.querySelector('a[href="/transactions"]').click()`);
  await until(`ledgerRequests.some(r=>r.owner==='owner-a'&&!r.settled)`, 'actual ledger fetches authoritative state after completion');
  await evaluate(`resolveLedger('owner-a',[window.completedActual]); resolveCategories('owner-a',[{ id:'10000000-0000-4000-8000-000000000001',user_id:'owner-a',name:'Current Housing',type:'expense',is_archived:false }]); resolvePaymentMethods('owner-a',[{ id:'20000000-0000-4000-8000-000000000001',user_id:'owner-a',nickname:'Active Checking',type:'checking',is_archived:false,is_default:true }])`);
  await until(`document.body.textContent.includes('Actual gift') && document.body.textContent.includes('Actual gift note')`, 'new actual row appears from refreshed server ledger');
  check(await evaluate(`document.querySelectorAll('.transactions-table tbody tr').length===1 && document.body.textContent.includes('Current Housing') && document.body.textContent.includes('Active Checking')`), 'actual completion row uses backend labels and has no duplicate');
  await evaluate(`document.querySelector('[aria-label="Delete Actual gift"]').click()`);
  await click('Delete transaction');
  await until(`transactionWrites.some(r=>r.owner==='owner-a'&&r.action==='delete'&&!r.settled)`, 'linked actual delete reaches owner-scoped service');
  await evaluate(`resolveTransactionMutation('owner-a',null,{code:'23503',message:'PRIVATE_EXPECTED_FK_DETAIL'})`);
  await until(`document.body.textContent.includes('linked to a completed expected event')`, 'linked actual delete explains restriction');
  check(await evaluate(`document.body.textContent.includes('Actual gift') && !document.body.textContent.includes('PRIVATE_EXPECTED_FK_DETAIL') && document.querySelectorAll('.transactions-table tbody tr').length===1`), 'linked delete failure retains actual history safely');
  await evaluate(`document.querySelector('[aria-label="Open navigation menu"]').click()`);
  await until(`!!document.querySelector('a[href="/expected-transactions"]')`, 'navigation menu exposes expected ledger');
  await evaluate(`document.querySelector('a[href="/expected-transactions"]').click()`);
  await until(`expectedTransactionRequests.some(r=>r.owner==='owner-a'&&!r.settled)`, 'return to expected ledger');
  await evaluate(`resolveExpectedTransactions('owner-a',[window.completedExpected]); resolveCategories('owner-a',[]); resolvePaymentMethods('owner-a',[])`);
  await until(`!!document.querySelector('[data-expected-transaction-id="created-expected"]')`, 'stored completed expected history reloads');
  const expectedLegacyAfterCrud = await evaluate(`({ access: legacyAccess, values: Object.fromEntries(Object.keys(legacyBefore).map(key => [key, readLegacy(key)])) })`);
  check(Object.entries(phase7StorageSnapshot).every(([key,value]) => expectedLegacyAfterCrud.values[key] === value) && expectedLegacyAfterCrud.access.slice(expectedLegacyAccessBefore).every(entry => !['setItem','removeItem','clear'].includes(entry.method)), 'expected CRUD leaves browser-local finance and setup storage unchanged');

  await click('Refresh');
  await until(`expectedTransactionRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'expected ledger refresh request');
  await evaluate(`resolveExpectedTransactions('owner-a', [], { code: '42501', message: 'PRIVATE_EXPECTED_ERROR' })`);
  await until(`document.body.textContent.includes('Unable to load expected transactions')`, 'expected ledger displays safe fetch error');
  check(await evaluate(`!document.body.textContent.includes('PRIVATE_EXPECTED_ERROR') && !document.body.textContent.includes('Expected rent')`), 'expected fetch failure has no local or stale fallback');
  await click('Retry');
  await until(`expectedTransactionRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'expected ledger retry request');
  await evaluate(`resolveExpectedTransactions('owner-a', [])`);
  await until(`document.body.textContent.includes('No expected transactions yet')`, 'expected ledger empty state');

  await click('Refresh');
  await until(`expectedTransactionRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'expected stale-account request');
  await evaluate(`setLedgerAccount('owner-b')`);
  await until(`expectedTransactionRequests.some(request => request.owner === 'owner-b' && !request.settled) && categoryRequests.some(request => request.owner === 'owner-b' && !request.settled) && paymentMethodRequests.some(request => request.owner === 'owner-b' && !request.settled)`, 'new account expected events and labels load');
  check(await evaluate(`document.querySelector('[aria-label="Loading expected transactions"]') && !document.body.textContent.includes('Expected rent') && !document.body.textContent.includes('Archived Housing') && !document.body.textContent.includes('Archived Checking')`), 'account switch clears old expected rows and labels immediately');
  await evaluate(`resolveExpectedTransactions('owner-a', [{ ...window.expectedRows[0], title: 'STALE OWNER EXPECTED' }]); resolveCategories('owner-b', [], { code: '42501', message: 'PRIVATE_CATEGORY_ERROR' }); resolvePaymentMethods('owner-b', [], { code: '42501', message: 'PRIVATE_METHOD_ERROR' }); resolveExpectedTransactions('owner-b', [{ ...window.expectedRows[0], id: 'owner-b-event', user_id: 'owner-b', title: 'Current owner expected event', category_id: 'unknown-category', payment_method_id: 'unknown-method' }])`);
  await until(`document.body.textContent.includes('Current owner expected event')`, 'new owner expected event renders');
  check(await evaluate(`!document.body.textContent.includes('STALE OWNER EXPECTED') && document.body.textContent.includes('Unknown category') && document.body.textContent.includes('Payment method unavailable') && !document.body.textContent.includes('PRIVATE_CATEGORY_ERROR') && !document.body.textContent.includes('PRIVATE_METHOD_ERROR') && legacyAccess.slice(${expectedLegacyAccessBefore}).every(entry => !['setItem','removeItem','clear'].includes(entry.method)) && Object.entries(${JSON.stringify(phase7StorageSnapshot)}).every(([key, value]) => readLegacy(key) === value)`), 'stale expected response ignored, metadata errors do not hide rows, and legacy storage is unchanged');

  await evaluate(`document.querySelector('[aria-label="Cancel Current owner expected event"]').click()`);
  await until(`expectedTransactionWrites.some(request => request.owner === 'owner-b' && request.action === 'update' && request.payload.status === 'cancelled' && !request.settled)`, 'expected lifecycle mutation pending for stale-account test');
  await evaluate(`setLedgerAccount('owner-a')`);
  await until(`expectedTransactionRequests.some(request => request.owner === 'owner-a' && !request.settled) && categoryRequests.some(request => request.owner === 'owner-a' && !request.settled) && paymentMethodRequests.some(request => request.owner === 'owner-a' && !request.settled)`, 'new owner data fetch begins during expected mutation');
  check(await evaluate(`document.querySelector('[aria-label="Loading expected transactions"]') && !document.body.textContent.includes('Current owner expected event')`), 'account switch clears rows while a mutation is pending');
  await evaluate(`resolveExpectedTransactionWrite('owner-b','update',{ ...window.expectedRows[0], id:'owner-b-event', user_id:'owner-b', title:'Current owner expected event', status:'cancelled' }); resolveCategories('owner-a', [], { code:'42501', message:'PRIVATE_CATEGORY_ERROR' }); resolvePaymentMethods('owner-a', [], { code:'42501', message:'PRIVATE_METHOD_ERROR' }); resolveExpectedTransactions('owner-a',[{ ...window.expectedRows[1], id:'owner-a-after-mutation', user_id:'owner-a', title:'Current owner unaffected event' }])`);
  await until(`document.body.textContent.includes('Current owner unaffected event')`, 'new owner ledger state appears after stale mutation');
  check(await evaluate(`!document.body.textContent.includes('Current owner expected event') && !document.body.textContent.includes('Expected event cancelled.') && !document.body.textContent.includes('PRIVATE_CATEGORY_ERROR') && !document.body.textContent.includes('PRIVATE_METHOD_ERROR')`), 'stale mutation result and feedback cannot affect new owner');

  await evaluate(`document.querySelector('[aria-label="Record Current owner unaffected event as completed"]').click()`);
  await until(`!!document.querySelector('[role="dialog"]')`, 'stale completion editor');
  await setFormValue('[aria-label="Expected transaction category"]', '', 'SELECT');
  await setFormValue('[aria-label="Expected transaction payment method"]', '', 'SELECT');
  await evaluate(`document.querySelector('[role="dialog"] form').requestSubmit()`);
  await until(`expectedTransactionWrites.some(r=>r.action==='complete'&&!r.settled)`, 'completion in flight during account switch');
  await evaluate(`setLedgerAccount('owner-b')`);
  await until(`expectedTransactionRequests.some(r=>r.owner==='owner-b'&&!r.settled) && !document.querySelector('[role="dialog"]')`, 'account switch immediately clears completion editor and old rows');
  await evaluate(`resolveExpectedTransactionWrite('owner-a','complete',{ expected_transaction: {...window.completedExpected,id:'owner-a-after-mutation'},actual_transaction:window.completedActual,already_completed:false }); resolveExpectedTransactions('owner-b',[]); resolveCategories('owner-b',[]); resolvePaymentMethods('owner-b',[])`);
  await until(`document.body.textContent.includes('No expected transactions yet')`, 'new owner empty state after stale completion');
  check(await evaluate(`!document.body.textContent.includes('Recorded as actual. The expected') && !document.body.textContent.includes('Current owner unaffected event') && Object.entries(${JSON.stringify(phase7StorageSnapshot)}).every(([key,value])=>readLegacy(key)===value)`), 'stale completion success cannot populate new owner and legacy storage stays unchanged');

  check(errors.length === 0, 'no browser runtime exceptions');
  console.log('Screenshots: ' + dir);
} finally {
  if (send && ws?.readyState === WebSocket.OPEN) await send('Browser.close').catch(() => {});
  ws?.close();
  browser?.kill();
}
