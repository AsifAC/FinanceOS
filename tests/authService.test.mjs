// Offline checks; never import the configured Supabase client or make Auth requests.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../src/services/authService.ts", import.meta.url), "utf8");
let sequence = 0;
async function load(auth) {
  globalThis.__authTestClient = auth ? { auth } : null;
  const js = stripTypeScriptTypes(source.replace('import { supabase } from "../lib/supabaseClient";', "const supabase = globalThis.__authTestClient;").replace(/import \{ normalizePhone[^\n]+\n/, 'const normalizePhone = value => value; const verificationDelivery = { email: false, phone: false };\n'));
  const service = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}#${sequence++}`);
  delete globalThis.__authTestClient;
  return service;
}

test("signup trims email/name, preserves password and forwards full_name metadata", async () => {
  let payload;
  const service = await load({ signUp: async (input) => {
    payload = input;
    return { data: { session: null, user: { id: "pending" } }, error: null };
  } });
  const result = await service.signUpWithEmail(" test@example.com ", " password with spaces ", " Test Person ");
  assert.deepEqual(payload, { email: "test@example.com", password: " password with spaces ", options: { data: { full_name: "Test Person" } } });
  assert.equal(result.ok, true);
  assert.equal(result.data.session, null);
});

test("immediate sessions are retained for the existing provider", async () => {
  const session = { user: { id: "signed-in" } };
  const service = await load({ signInWithPassword: async () => ({ data: { session, user: session.user }, error: null }) });
  assert.deepEqual((await service.signInWithEmail("test@example.com", "password")).data.session, session);
});

test("known and unknown Auth errors do not expose raw server messages", async () => {
  for (const [code, message] of [["invalid_credentials", "Email or password is incorrect."], ["user_already_exists", "An account with this email may already exist."], ["unknown", "We couldn't complete your request. Please check your details and try again."]]) {
    const service = await load({ signInWithPassword: async () => ({ data: null, error: { code, status: 400, message: "private server detail" } }) });
    const result = await service.signInWithEmail("test@example.com", "password");
    assert.equal(result.error.message, message);
    assert.equal(JSON.stringify(result).includes("private server detail"), false);
  }
});

test("Auth transport, server and rate-limit statuses have distinct safe messages and preserve status/code", async () => {
  const cases = [
    [0, "network_error", "We couldn't connect to the verification service. Check your connection and try again."],
    [500, "unexpected_failure", "The verification service encountered an error. Please try again later."],
    [503, "unexpected_failure", "The verification service encountered an error. Please try again later."],
    [429, "over_request_rate_limit", "Too many attempts. Please wait before trying again."],
  ];
  for (const [status, code, message] of cases) {
    const service = await load({ getUser: async () => ({ data: null, error: { status, code, message: "private server detail" } }) });
    const result = await service.getCurrentUser();
    assert.equal(result.ok, false);
    assert.equal(result.error.status, status);
    assert.equal(result.error.code, code);
    assert.equal(result.error.message, message);
    assert.equal(JSON.stringify(result).includes("private server detail"), false);
  }
});

test("known SMS provider failures retain their safe mapping, Auth code and status", async () => {
  const service = await load({ getUser: async () => ({ data: null, error: { status: 500, code: "sms_send_failed", message: "provider secret detail" } }) });
  const result = await service.getCurrentUser();
  assert.equal(result.error.status, 500);
  assert.equal(result.error.code, "sms_send_failed");
  assert.equal(result.error.message, "SMS verification is currently unavailable. Try email or return later.");
  assert.equal(JSON.stringify(result).includes("provider secret detail"), false);
});

test("thrown network errors resolve safely for session, login, signup and signout", async () => {
  const fail = async () => { throw new Error("private network detail"); };
  const service = await load({ getSession: fail, getUser: fail, signInWithPassword: fail, signUp: fail, signOut: fail });
  for (const method of ["getCurrentSession", "getCurrentUser", "signInWithEmail", "signUpWithEmail", "signOut"]) {
    const result = await service[method]("test@example.com", "password");
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "connection_error");
    assert.equal(JSON.stringify(result).includes("private network detail"), false);
  }
});

test("unconfigured Auth returns a typed failure", async () => {
  const service = await load(null);
  assert.equal((await service.signInWithEmail("test@example.com", "password")).error.code, "supabase_not_configured");
});

test("password policy feedback uses only known structured reasons", async () => {
  const service = await load({ signUp: async () => ({ data: null, error: {
    code: "weak_password", status: 422, message: "private server detail",
    reasons: ["length", "pwned", "length", "private reason", "__proto__"],
  } }) });
  const result = await service.signUpWithEmail("test@example.com", "password");
  assert.equal(result.ok, false);
  assert.equal(result.error.message, "Use a longer password. This password has appeared in a data breach. Choose a different, unique password.");
  assert.equal(result.error.code, "weak_password");
});

test("signup preserves an immediate authenticated session", async () => {
  const session = { user: { id: "signed-up" } };
  const service = await load({ signUp: async () => ({ data: { session, user: session.user }, error: null }) });
  assert.deepEqual((await service.signUpWithEmail("test@example.com", "password")).data.session, session);
});
