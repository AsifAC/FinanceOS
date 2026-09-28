import { spawn } from 'node:child_process';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Run against npm run dev. Auth behavior is mocked; Supabase requests are blocked.
const dir = await mkdtemp(join(tmpdir(), 'financeos-auth-review-'));
const baseUrl = process.env.AUTH_REVIEW_URL || 'http://127.0.0.1:5173';
await mkdir(dir, { recursive: true });
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9337', `--user-data-dir=${dir}/profile`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let pages;
for (let i = 0; i < 40; i++) {
  try { pages = await (await fetch('http://127.0.0.1:9337/json/list')).json(); if (pages.length) break; } catch {}
  await pause(250);
}
if (!pages) throw new Error('Browser debugging endpoint unavailable');
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') console.log('BROWSER ERROR', message.params.exceptionDetails.exception?.description);
  if (message.id) {
    const p = pending.get(message.id); pending.delete(message.id);
    if (message.error) p.reject(message.error); else p.resolve(message.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const check = (condition, label) => { if (!condition) throw new Error(label); console.log('PASS ' + label); };
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setBlockedURLs', { urls: ['*supabase.co/*', '*supabase.in/*'] });
async function navigate(path, width = 1440, height = 1000) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${baseUrl}${path}` });
  for (let i = 0; i < 80; i++) {
    if (await evaluate(`document.querySelector('${path === '/' ? '.financeos-landing' : '.auth-form-heading'}') !== null`)) break;
    await pause(100);
  }
  await pause(120);
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(`${dir}/${name}.png`, Buffer.from(shot.data, 'base64'));
}
try {
  for (const width of [1440, 1024, 768, 375, 390, 414]) {
    for (const mode of ['login', 'signup']) {
      await navigate(`/auth/${mode}`, width, width < 500 ? 844 : 1000);
      const state = await evaluate(`({ overflow: document.documentElement.scrollWidth > innerWidth, form: !!document.querySelector('form'), bars: [...document.querySelectorAll('.auth-cash-bar')].filter(el => getComputedStyle(el).display !== 'none').length, columns: getComputedStyle(document.querySelector('.financeos-auth')).gridTemplateColumns })`);
      check(state.form && !state.overflow, `${mode} ${width}px layout/no horizontal overflow (${state.bars} bars)`);
      if (width === 1440 || width === 390 || width === 768) await screenshot(`${mode}-${width}`);
    }
  }
  for (const width of [375, 390, 414, 1440]) {
    await navigate('/', width, 844);
    const links = await evaluate(`({ login: document.querySelector('header a[href="/auth/login"]')?.textContent, signup: document.querySelector('header a[href="/auth/signup"]')?.textContent, overflow: document.documentElement.scrollWidth > innerWidth })`);
      check(links.login === 'Login' && links.signup === 'Sign up' && !links.overflow, `landing header links ${width}px`);
      check(await evaluate(`[...document.querySelectorAll('.financeos-landing a')].every(a => ['/', '/auth/login', '/auth/signup'].includes(a.getAttribute('href'))) && [...document.querySelectorAll('main a')].filter(a => !/log in/i.test(a.textContent)).every(a => a.getAttribute('href') === '/auth/signup')`), `every signed-out account CTA uses signup ${width}px`);
      check(await evaluate(`!document.body.textContent.includes('Developer Preview') && !document.querySelector('a[href="/setup"]')`), `landing has no preview or unauthenticated setup entry ${width}px`);
  }
  await navigate('/auth/signup', 390, 844);
  for (const route of ['/dashboard', '/setup', '/settings', '/income', '/expenses', '/reports', '/start', '/annual-planner', '/transactions', '/pending-transactions', '/add-transaction', '/categories', '/expected-amounts', '/payment-plans', '/tracker', '/saved-budgets', '/notifications', '/help', '/planner', '/pending', '/expected', '/tracker-ui']) {
    await navigate(route, 1440, 1000);
    check(await evaluate(`location.pathname === '/auth/login' && !document.querySelector('.financeos-premium')`), `signed-out protection: ${route}`);
  }
  await navigate('/auth/signup', 390, 844);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  check(await evaluate(`[...document.querySelectorAll('.auth-cash-bar')].every(el => getComputedStyle(el).animationName === 'none')`), 'reduced motion stops every bar');
  check(await evaluate(`[...document.querySelectorAll('.auth-cash-bar')].some(el => getComputedStyle(el).display !== 'none')`), 'reduced motion preserves visual');
  await evaluate(`document.documentElement.classList.add('financeos-theme-light')`);
  check(await evaluate(`getComputedStyle(document.querySelector('.financeos-auth')).backgroundColor === 'rgb(5, 5, 5)'`), 'auth stays dark in app light theme');
  await evaluate(`document.querySelector('form').requestSubmit()`);
  check(await evaluate(`document.querySelectorAll('[aria-invalid="true"]').length === 4 && document.activeElement.name === 'fullName'`), 'required fields and first-error focus');
  await evaluate(`document.querySelector('[aria-label="Show password"]').click()`);
  check(await evaluate(`document.querySelector('#auth-password').type === 'text'`), 'password reveal');
  await evaluate(`document.querySelector('[aria-label="Hide password"]').click()`);
  check(await evaluate(`document.querySelector('#auth-password').type === 'password'`), 'password conceal');
  await evaluate(`window.navigationMarker = 'preserved'; document.querySelector('.auth-switch a').click()`);
  await pause(100);
  check(await evaluate(`location.pathname === '/auth/login' && window.navigationMarker === 'preserved'`), 'signup to login uses client routing');
  await evaluate(`document.querySelector('.auth-switch a').click()`); await pause(100);
  check(await evaluate(`location.pathname === '/auth/signup' && window.navigationMarker === 'preserved'`), 'login to signup uses client routing');
  // Reuse the real public UI under a mocked AuthContext. No Auth network calls.
  await evaluate(`(async () => {
    const dependency = name => performance.getEntriesByType('resource').map(entry => entry.name).find(url => url.includes('/node_modules/.vite/deps/' + name + '.js?'));
    const { default: React } = await import(dependency('react'));
    const { default: ReactDOM } = await import(dependency('react-dom_client'));
    const { createRoot } = ReactDOM;
    const { MemoryRouter, Routes, Route, Navigate, useLocation } = await import(dependency('react-router'));
    const hookSource = await (await fetch('/src/hooks/useAuth.ts')).text();
    const providerUrl = hookSource.split('from "').find(part => part.startsWith('/src/providers/AuthProvider')).split('"')[0];
    const { AuthContext } = await import(providerUrl);
    const { AuthPage } = await import('/src/app/components/screens/AuthPage.tsx');
    const { AppShell } = await import('/src/app/components/layout/AppShell.tsx');
    const { LandingPage } = await import('/src/app/components/screens/LandingPage.tsx');
    const { Dashboard } = await import('/src/app/components/screens/Dashboard.tsx');
    const { Settings } = await import('/src/app/components/screens/Settings.tsx');
    const { VerifyAccount } = await import('/src/app/components/screens/VerifyAccount.tsx');
    const gateSource = await (await fetch('/src/app/components/auth/RequireVerified.tsx')).text();
    const profileUrl = gateSource.split('from "').find(part => part.startsWith('/src/hooks/useProfile')).split('"')[0];
    const { ProfileContext } = await import(profileUrl);
    const shellSource = await (await fetch('/src/app/components/layout/AppShell.tsx')).text();
    const storeUrl = shellSource.split('from "').find(part => part.startsWith('/src/app/lib/financeStore')).split('"')[0];
    const { useFinanceData } = await import(storeUrl);
    const host = document.createElement('div'); document.body.append(host);
    document.querySelector('#root').style.display = 'none';
    const root = createRoot(host);
    window.authHarness = (mode, overrides = {}) => {
      const context = { user: null, session: null, isAuthenticated: false, isLoading: false, error: null, signUp: async (...args) => { window.signupArgs = args; return { ok: true, data: { user: { id: 'pending' }, session: null }, error: null }; }, signIn: async () => ({ ok: false, data: null, error: { code: 'invalid_credentials', message: 'Email or password is incorrect.' } }), ...overrides };
      root.render(React.createElement(AuthContext.Provider, { value: context }, React.createElement(MemoryRouter, { key: mode + !!context.isAuthenticated, initialEntries: ['/auth/' + mode] }, React.createElement(Routes, null,
        React.createElement(Route, { path: '/auth/:mode', element: React.createElement(AuthPage, { mode, key: mode }) }),
        React.createElement(Route, { path: '/dashboard', element: React.createElement('p', { id: 'mock-dashboard' }, 'Dashboard') })
      ))));
    };
    window.authHarness('signup');
    window.authHost = host;
    function LocalProbe() {
      const { state } = useFinanceData();
      window.testLocalState = state;
      return null;
    }
    let accessRevision = 0;
    window.accessHarness = (path, authenticated, loading = false, verified = true) => {
      function AccessSession() {
        const location = useLocation();
        const [logoutComplete, setLogoutComplete] = React.useState(false);
        React.useEffect(() => { if (logoutComplete && location.pathname === '/') setLogoutComplete(false); }, [logoutComplete, location.pathname]);
        const [signedIn, setSignedIn] = React.useState(authenticated);
        const context = { user: signedIn ? { id: 'offline-test-user', email: 'account@example.com' } : null, session: null,
          isAuthenticated: signedIn, isLoading: loading, error: null,
          signOut: async () => { window.logoutCalls = (window.logoutCalls || 0) + 1; await new Promise(resolve => setTimeout(resolve, 80)); setSignedIn(false); setLogoutComplete(true); return { ok: true, error: null }; } };
        const [profile, setProfile] = React.useState({ account_verified_at: verified ? new Date().toISOString() : null, verification_channel: null });
        return React.createElement(AuthContext.Provider, { value: context },
          logoutComplete && location.pathname !== '/' ? React.createElement(Navigate, { to: '/', replace: true }) :
          React.createElement(ProfileContext.Provider, { value: { profile, isLoading: false, error: null, refreshProfile: async () => { if (window.dbVerified) setProfile({ ...profile, account_verified_at: new Date().toISOString() }); }, updateProfile: async updates => { window.savedPreference = updates.verification_channel; setProfile({ ...profile, ...updates }); return { ok: true }; } } },
          React.createElement(React.Fragment, null, React.createElement(Routes, null,
            React.createElement(Route, { element: React.createElement(AppShell) },
              React.createElement(Route, { path: '/', element: React.createElement(LandingPage) }),
              React.createElement(Route, { path: '/auth/login', element: React.createElement(AuthPage, { mode: 'login' }) }),
              React.createElement(Route, { path: '/auth/verify', element: React.createElement(VerifyAccount) }),
              React.createElement(Route, { path: '/dashboard', element: React.createElement(React.Fragment, null, React.createElement(LocalProbe), React.createElement(Dashboard)) }),
              React.createElement(Route, { path: '/settings', element: React.createElement(Settings) })
            )
          ))));
      }
      root.render(React.createElement(MemoryRouter, { key: ++accessRevision, initialEntries: [path] }, React.createElement(AccessSession)));
    };
  })()`);
  await pause(200);
  await evaluate(`(() => { const f = window.authHost.querySelector('form'); for (const [name,value] of Object.entries({ fullName: '  Test Person  ', email: 'test@example.com', password: 'a-test-password', confirmation: 'different' })) f.elements.namedItem(name).value = value; f.requestSubmit(); })()`);
  await pause(50);
  check(await evaluate(`window.authHost.textContent.includes('Passwords must match.')`), 'signup rejects mismatched confirmation');
  await evaluate(`window.authHost.querySelector('[name="confirmation"]').value = 'a-test-password'; window.authHost.querySelector('form').requestSubmit()`);
  await pause(100);
  check(await evaluate(`window.authHost.textContent.includes('Check your email') && !window.authHost.querySelector('#mock-dashboard') && window.signupArgs[2] === 'Test Person'`), 'signup confirmation without session and trimmed name');
  await evaluate(`window.authHarness('login')`); await pause(100);
  await evaluate(`const form = window.authHost.querySelector('form'); form.elements.email.value = 'test@example.com'; form.elements.password.value = 'bad-password'; form.requestSubmit()`);
  await pause(100);
  check(await evaluate(`window.authHost.textContent.includes('Email or password is incorrect.')`), 'invalid-login error');
  await evaluate(`window.authHarness('login', { isLoading: true, isAuthenticated: true })`); await pause(100);
  check(await evaluate(`!window.authHost.querySelector('#mock-dashboard')`), 'no redirect while provider is loading');
  await evaluate(`window.authHarness('login', { isLoading: false, isAuthenticated: true })`); await pause(100);
  check(await evaluate(`!!window.authHost.querySelector('#mock-dashboard')`), 'authenticated redirect to existing dashboard');
  await evaluate(`window.authHarness('signup', { isAuthenticated: true })`); await pause(100);
  check(await evaluate(`!!window.authHost.querySelector('#mock-dashboard')`), 'authenticated signup redirect');
  await evaluate(`window.authHarness('login', { signIn: () => { window.signinCount = (window.signinCount || 0) + 1; return new Promise(resolve => { window.finishLogin = resolve; }); } })`); await pause(100);
  await evaluate(`const pendingForm = window.authHost.querySelector('form'); pendingForm.elements.email.value = 'test@example.com'; pendingForm.elements.password.value = 'password'; pendingForm.requestSubmit(); pendingForm.requestSubmit()`); await pause(100);
  check(await evaluate(`window.signinCount === 1 && window.authHost.querySelector('.auth-submit').disabled && window.authHost.querySelector('fieldset').disabled && window.authHost.textContent.includes('Logging in…')`), 'pending state prevents duplicate submission');
  await evaluate(`window.finishLogin({ ok: false, data: null, error: { message: "We couldn't connect right now. Please try again." } })`); await pause(100);
  check(await evaluate(`!window.authHost.querySelector('.auth-submit').disabled && window.authHost.textContent.includes("We couldn't connect")`), 'pending state recovers after failure');
  await evaluate(`window.authHarness('login', { signIn: async () => ({ ok: false, data: null, error: { code: 'supabase_not_configured', message: 'Internal configuration detail' } }) })`); await pause(100);
  await evaluate(`window.authHost.querySelector('form').requestSubmit()`); await pause(100);
  check(await evaluate(`window.authHost.textContent.includes('Account access is temporarily unavailable') && !window.authHost.textContent.includes('Internal configuration detail')`), 'missing configuration shows safe public feedback');
  await evaluate(`window.authHarness('signup', { signUp: async () => ({ ok: false, data: null, error: { code: 'weak_password', message: 'Use a longer password.' } }) })`); await pause(100);
  await evaluate(`(() => { const form = window.authHost.querySelector('form'); for (const [name, value] of Object.entries({ fullName: 'Test Person', email: 'test@example.com', password: 'short', confirmation: 'short' })) form.elements.namedItem(name).value = value; form.requestSubmit(); })()`); await pause(100);
  check(await evaluate(`window.authHost.querySelector('#auth-password').getAttribute('aria-invalid') === 'true' && window.authHost.querySelector('#auth-password-error').textContent === 'Use a longer password.'`), 'server password policy feedback is associated with password field');
  await evaluate(`localStorage.setItem('financeos:dev-preview-enabled', 'true'); window.accessHarness('/dashboard', true, true)`); await pause(100);
  check(await evaluate(`window.authHost.textContent.includes('Loading your session') && !window.authHost.querySelector('.financeos-premium')`), 'protected UI waits for session initialization');
  await evaluate(`window.accessHarness('/dashboard', true, false, false)`); await pause(200);
  check(await evaluate(`window.authHost.textContent.includes('Verify your account') && !window.authHost.querySelector('.financeos-premium') && window.authHost.querySelector('input[value="email"]').checked`), 'unverified account routed to email verification selection');
  check(await evaluate(`window.authHost.textContent.includes('a••••@example.com') && !window.authHost.textContent.includes('account@example.com')`), 'verification masks email');
  check(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'verification mobile layout has no horizontal overflow');
  await screenshot('verification-mobile');
  await evaluate(`window.authHost.querySelector('input[value="phone"]').click()`); await pause(100);
  check(await evaluate(`!!window.authHost.querySelector('#verification-phone') && window.authHost.textContent.includes('SMS verification is currently unavailable')`), 'phone selection discloses unavailable SMS');
  await evaluate(`Array.from(window.authHost.querySelectorAll('button')).find(b => b.textContent === 'Log out').click()`); await pause(500);
  check(await evaluate(`!!window.authHost.querySelector('header a[href="/auth/login"]')`), 'logout accessible from verification onboarding');
  await evaluate(`window.accessHarness('/dashboard', true)`); await pause(300);
  check(await evaluate(`!!window.authHost.querySelector('.financeos-premium') && window.testLocalState.transactions.length === 0 && window.authHost.textContent.includes('Local browser workspace.') && !/Developer Preview|Preview Data Enabled/.test(window.authHost.textContent)`), 'authenticated dashboard is empty, explicitly local, and ignores old preview flag');
  await evaluate(`window.authHost.querySelector('header a[href="/settings"]').click()`); await pause(250);
  check(await evaluate(`!!window.authHost.querySelector('.financeos-premium') && window.authHost.textContent.includes('Settings') && !window.authHost.querySelector('.auth-form-heading')`), 'authenticated client navigation preserves access');
  await evaluate(`window.accessHarness('/', true, true)`); await pause(150);
  check(await evaluate(`!window.authHost.querySelector('a[href="/auth/login"], a[href="/auth/signup"], a[href="/dashboard"]') && window.authHost.textContent.includes('Loading session')`), 'landing waits for session before showing account CTAs');
  await evaluate(`window.accessHarness('/', true)`); await pause(150);
  check(await evaluate(`window.authHost.querySelector('header a[href="/dashboard"]')?.textContent === 'Go to Dashboard' && !window.authHost.querySelector('header a[href="/auth/login"]')`), 'authenticated landing navigation');
  await evaluate(`window.accessHarness('/settings', true)`); await pause(150);
  check(await evaluate(`!!window.authHost.querySelector('.financeos-premium') && !/Enable Preview Data|Preview Data Enabled/.test(window.authHost.textContent)`), 'authenticated settings without preview controls');
  await evaluate(`(() => { const saved = JSON.parse(localStorage.getItem('financeos:app-data:v1')); saved.transactions = [{ id: 'local-preservation-test', name: 'Existing local entry', amount: 123, type: 'income', category: 'Other', date: new Date().toISOString().slice(0,10), status: 'paid' }]; localStorage.setItem('financeos:app-data:v1', JSON.stringify(saved)); window.accessHarness('/dashboard', true); })()`); await pause(150);
  check(await evaluate(`window.testLocalState.transactions.length === 1 && window.testLocalState.transactions[0].id === 'local-preservation-test'`), 'session remount preserves existing local records without mock merging');
  await evaluate(`window.authHost.querySelector('[aria-label="Profile menu"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', ctrlKey: false }))`); await pause(150);
  await evaluate(`window.logoutCalls = 0; const logout = Array.from(document.querySelectorAll('[role="menuitem"]')).find(el => el.textContent.includes('Log out')); logout.click(); logout.click()`); await pause(200);
  check(await evaluate(`window.logoutCalls === 1`), 'dropdown logout prevents duplicate requests');
  check(await evaluate(`!!window.authHost.querySelector('header a[href="/auth/login"]') && !window.authHost.querySelector('.financeos-premium')`), 'profile logout returns to public landing');
  await evaluate(`window.accessHarness('/dashboard', false)`); await pause(150);
  check(await evaluate(`!!window.authHost.querySelector('.auth-form-heading') && !window.authHost.querySelector('.financeos-premium') && JSON.parse(localStorage.getItem('financeos:app-data:v1')).transactions[0].id === 'local-preservation-test'`), 'signed-out access blocked without deleting local records');
  await evaluate(`(async () => {
    const source = await (await fetch('/src/app/components/screens/VerifyAccount.tsx')).text();
    const imported = prefix => source.split('from "').find(part => part.startsWith(prefix)).split('"')[0];
    const { verificationDelivery } = await import(imported('/src/lib/verification'));
    verificationDelivery.email = true; verificationDelivery.phone = true;
    const serviceSource = await (await fetch(imported('/src/services/authService'))).text();
    const clientUrl = serviceSource.split('from "').find(part => part.startsWith('/src/lib/supabaseClient')).split('"')[0];
    const { supabase } = await import(clientUrl);
    supabase.auth.getUser = async () => ({ data: { user: { id: 'offline-test-user', email: 'account@example.com' } }, error: null });
    supabase.auth.signInWithOtp = async args => { window.sendCalls = (window.sendCalls || 0) + 1; window.emailPayload = args; return { error: null }; };
    supabase.auth.updateUser = async args => { window.sendCalls = (window.sendCalls || 0) + 1; window.phonePayload = args; return { error: null }; };
    supabase.auth.verifyOtp = async args => { window.otpPayload = args; return args.token === '123456' ? { data: { user: { id: 'offline-test-user' } }, error: null } : { error: { code: 'otp_expired' } }; };
    supabase.rpc = async (name, args) => { window.dbVerified = true; return { data: { account_verified_at: new Date().toISOString() }, error: null }; };
    window.accessHarness('/auth/verify', true, false, false);
  })()`); await pause(200);
  await evaluate(`window.authHost.querySelector('form').requestSubmit(); window.authHost.querySelector('form').requestSubmit()`); await pause(200);
  check(await evaluate(`window.sendCalls === 1 && window.savedPreference === 'email' && window.emailPayload.options.shouldCreateUser === false && !!window.authHost.querySelector('#verification-code')`), 'email send persists preference and prevents duplicate sends');
  check(await evaluate(`[...window.authHost.querySelectorAll('button')].some(b => b.textContent.startsWith('Resend in') && b.disabled)`), 'resend countdown disables early resend');
  await evaluate(`var input = window.authHost.querySelector('#verification-code'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, '000000'); input.dispatchEvent(new Event('input', { bubbles: true }));`); await pause(50);
  await evaluate(`window.authHost.querySelector('form').requestSubmit()`); await pause(150);
  check(await evaluate(`window.authHost.textContent.includes('invalid or has expired') && !window.dbVerified`), 'invalid OTP stays unverified');
  await evaluate(`var input = window.authHost.querySelector('#verification-code'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '123456'); input.dispatchEvent(new Event('input', { bubbles: true }));`); await pause(50);
  await evaluate(`window.authHost.querySelector('form').requestSubmit()`); await pause(200);
  check(await evaluate(`window.dbVerified && !!window.authHost.querySelector('.financeos-premium')`), 'valid email OTP and persisted account timestamp unlock dashboard');
  await evaluate(`window.dbVerified = false; window.accessHarness('/auth/verify', true, false, false)`); await pause(150);
  await evaluate(`window.authHost.querySelector('input[value="phone"]').click()`); await pause(50);
  await evaluate(`window.authHost.querySelector('form').requestSubmit()`); await pause(150);
  check(await evaluate(`window.authHost.textContent.includes('Include your country code') && !window.phonePayload`), 'invalid phone rejected without sending');
  await evaluate(`var input = window.authHost.querySelector('#verification-phone'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '+1 (212) 555-1234'); input.dispatchEvent(new Event('input', { bubbles: true }));`); await pause(50);
  await evaluate(`window.authHost.querySelector('form').requestSubmit()`); await pause(150);
  check(await evaluate(`window.savedPreference === 'phone' && window.phonePayload.phone === '+12125551234' && !!window.authHost.querySelector('#verification-code')`), 'phone send persists preference and normalizes E.164');
  await evaluate(`var input = window.authHost.querySelector('#verification-code'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '123456'); input.dispatchEvent(new Event('input', { bubbles: true }));`); await pause(50);
  await evaluate(`window.authHost.querySelector('form').requestSubmit()`); await pause(200);
  check(await evaluate(`window.otpPayload.type === 'phone_change' && window.dbVerified && !!window.authHost.querySelector('.financeos-premium')`), 'phone OTP verifies same account and unlocks dashboard');
  console.log('Screenshots: ' + dir);
} finally {
  await send('Browser.close').catch(() => {});
  ws.close(); browser.kill();
}
