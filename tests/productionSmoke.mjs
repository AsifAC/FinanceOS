// Read-only production smoke check. No credentials, tokens, or financial values
// are printed. Use --interactive only when the account owner will sign in.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = 'https://finance-os-red-sigma.vercel.app';
const interactive = process.argv.includes('--interactive');
const dir = await mkdtemp(join(tmpdir(), 'financeos-production-smoke-'));
const profile = join(dir, 'profile');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  ...interactive ? [] : ['--headless=new'], '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: !interactive, stdio: 'ignore' });
let ws, send;
const failures = [];
let runtimeErrors = 0, consoleErrors = 0, blockedWrites = 0;
const routes = ['/dashboard', '/transactions', '/expected-transactions', '/categories',
  '/payment-methods', '/reports', '/annual-planner', '/saved-budgets', '/income',
  '/expenses', '/tracker', '/settings', '/add-transaction'];
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch {}
    await pause(100);
  }
  assert.ok(port, 'Chrome did not start');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let seq = 0;
  const pending = new Map();
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id); pending.delete(message.id);
      if (message.error) request.reject(new Error('Browser command failed')); else request.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors++;
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors++;
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
      const { url, status } = message.params.response;
      failures.push({ host: new URL(url).host, path: new URL(url).pathname, status });
    }
    if (message.method === 'Fetch.requestPaused') {
      const { request, requestId } = message.params;
      if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
        void send('Fetch.continueRequest', { requestId });
      } else {
        blockedWrites++; void send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      }
    }
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*supabase.co/rest/v1/*', requestStage: 'Request' }] });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true });
    assert.ok(!result.exceptionDetails, 'Browser evaluation failed'); return result.result.value;
  };
  const navigate = async path => {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, 'Direct route HTTP status: ' + path);
    await send('Page.navigate', { url: origin + path });
    for (let i = 0; i < 150; i++) {
      if (await evaluate(`document.querySelector('h1, .auth-form-heading') !== null`)) break;
      await pause(100);
    }
    await pause(500);
  };
  for (const width of [375, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const path of ['/', '/auth/login', '/auth/signup']) {
      await navigate(path);
      assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth && document.querySelector('h1, .auth-form-heading') !== null`), 'Public layout: ' + path);
    }
    console.log('PASS public production routes at ' + width + 'px');
  }
  for (const path of routes) {
    await navigate(path);
    assert.equal(await evaluate('location.pathname'), '/auth/login', 'Signed-out guard: ' + path);
    assert.ok(await evaluate(`!document.body.textContent.includes('Supabase is not configured')`), 'Browser configuration is present');
  }
  console.log('PASS all protected deep links load and require authentication');
  if (interactive) {
    console.log('Sign in with your existing account in the open browser. Read-only checks will start after login.');
    let signedIn = false;
    for (let i = 0; i < 1800; i++) {
      if (await evaluate(`location.pathname === '/dashboard' && !!document.querySelector('.financeos-premium')`)) { signedIn = true; break; }
      await pause(100);
    }
    assert.ok(signedIn, 'Existing-account sign-in was not completed');
    for (const path of routes.filter(path => path !== '/add-transaction')) {
      await navigate(path); await pause(3000);
      assert.equal(await evaluate('location.pathname'), path, 'Authenticated route: ' + path);
      assert.ok(await evaluate(`!document.querySelector('[role="alert"]') && !/Unable to load|Could not load|couldn’t load|could not load/i.test(document.body.textContent)`), 'Authenticated read: ' + path);
      console.log('PASS existing-account read ' + path);
    }
  } else console.log('NOT RUN existing-account reads: no authenticated session supplied');
  assert.equal(runtimeErrors, 0, 'Production runtime exception');
  assert.equal(consoleErrors, 0, 'Production console error');
  assert.deepEqual(failures, [], 'Production HTTP/API failures');
  assert.equal(blockedWrites, 0, 'A financial write was attempted during read-only smoke');
  console.log('PASS no runtime/console/HTTP errors; no financial mutations');
} finally {
  if (send) await send('Browser.close').catch(() => {});
  ws?.close(); browser.kill();
}
