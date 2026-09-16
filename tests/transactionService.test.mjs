// Offline tests: the real Supabase client is never imported. Run with Node 24:
// node --test tests/transactionService.test.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../src/services/transactionService.ts", import.meta.url), "utf8");
let moduleId = 0;
async function load(client) {
  globalThis.__transactionTestClient = client;
  const isolated = source.replace('import { supabase } from "../lib/supabaseClient";',
    "const supabase = globalThis.__transactionTestClient;");
  const js = stripTypeScriptTypes(isolated);
  const service = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}#${moduleId++}`);
  delete globalThis.__transactionTestClient;
  return service;
}

function mock({ user = { id: "owner-a" }, responses = [{ data: [], error: null }], authThrows = false } = {}) {
  const calls = [];
  let requests = 0;
  const query = {};
  for (const method of ["select", "eq", "order", "range", "gte", "lte", "lt", "insert", "update", "delete", "single", "maybeSingle"]) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  query.then = (resolve, reject) => Promise.resolve(responses[requests++] ?? { data: [], error: null }).then(resolve, reject);
  const client = {
    auth: { getUser: async () => {
      if (authThrows) throw new Error("secret-token");
      return { data: { user }, error: null };
    } },
    from: (table) => { calls.push(["from", table]); return query; },
  };
  return { client, calls };
}

test("missing config, missing user and thrown Auth errors are safe", async () => {
  assert.equal((await (await load(null)).fetchTransactions()).error.code, "supabase_not_configured");
  const guest = mock({ user: null });
  assert.equal((await (await load(guest.client)).fetchTransactions()).error.code, "not_authenticated");
  assert.equal(guest.calls.length, 0);
  const broken = mock({ authThrows: true });
  const result = await (await load(broken.client)).fetchTransactions();
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes("secret-token"), false);
});

test("insert and update strip caller-owned identity and timestamps at runtime", async () => {
  const db = mock({ responses: [{ data: { id: "row" }, error: null }, { data: { id: "row" }, error: null }] });
  const service = await load(db.client);
  const input = { type: "expense", amount: 12.5, title: " Lunch ", transaction_date: "2026-09-16",
    user_id: "victim", id: "spoofed", created_at: "spoofed", updated_at: "spoofed" };
  assert.equal((await service.createTransaction(input)).ok, true);
  const insert = db.calls.find(([method]) => method === "insert")[1];
  assert.equal(insert.user_id, "owner-a");
  assert.equal(insert.title, "Lunch");
  for (const key of ["id", "created_at", "updated_at"]) assert.equal(key in insert, false);
  assert.equal((await service.updateTransaction("row", input)).ok, true);
  const update = db.calls.find(([method]) => method === "update")[1];
  for (const key of ["user_id", "id", "created_at", "updated_at"]) assert.equal(key in update, false);
  assert.ok(db.calls.some(([method, key, value]) => method === "eq" && key === "user_id" && value === "owner-a"));
});

test("month queries use exclusive next-month boundary including December and leap year", async () => {
  for (const [year, month, start, end] of [[2026, 12, "2026-12-01", "2027-01-01"], [2028, 2, "2028-02-01", "2028-03-01"]]) {
    const db = mock();
    assert.equal((await (await load(db.client)).fetchTransactionsForMonth(year, month)).ok, true);
    assert.ok(db.calls.some((call) => JSON.stringify(call) === JSON.stringify(["gte", "transaction_date", start])));
    assert.ok(db.calls.some((call) => JSON.stringify(call) === JSON.stringify(["lt", "transaction_date", end])));
  }
});

test("invalid amounts, blank titles, invalid dates and invalid month are rejected", async () => {
  const db = mock();
  const service = await load(db.client);
  const base = { type: "income", amount: 10, title: "Pay", transaction_date: "2026-09-16" };
  for (const override of [{ amount: -1 }, { amount: 0 }, { amount: NaN }, { amount: Infinity }, { title: " " }, { transaction_date: "2026-02-29" }, { source: "system" }]) {
    assert.equal((await service.createTransaction({ ...base, ...override })).error.code, "invalid_input");
  }
  assert.equal((await service.fetchTransactionsForMonth(2026, 0)).error.code, "invalid_input");
  assert.equal((await service.fetchTransactionsByDateRange("2026-10-01", "2026-09-01")).error.code, "invalid_input");
  assert.equal(db.calls.length, 0);
});

test("date-range ends are inclusive, type/ID/delete requests retain owner filters", async () => {
  for (const [method, args] of [["fetchTransactionsByDateRange", ["2026-01-01", "2026-01-31"]], ["fetchTransactionsByType", ["debt"]], ["fetchTransactionById", ["row"]], ["deleteTransaction", ["row"]]]) {
    const db = mock({ responses: [{ data: method.includes("ByDate") || method.includes("ByType") ? [] : { id: "row" }, error: null }] });
    assert.equal((await (await load(db.client))[method](...args)).ok, true);
    assert.ok(db.calls.some(([op, key, value]) => op === "eq" && key === "user_id" && value === "owner-a"));
    if (method.includes("ByDate")) assert.ok(db.calls.some(([op, key, value]) => op === "lte" && key === "transaction_date" && value === "2026-01-31"));
  }
});

test("history reads paginate and sanitize database failures", async () => {
  const db = mock({ responses: [{ data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }, { data: [{ id: 500 }], error: null }] });
  assert.equal((await (await load(db.client)).fetchTransactions()).data.length, 501);
  assert.deepEqual(db.calls.filter(([op]) => op === "range"), [["range", 0, 499], ["range", 500, 999]]);
  const failing = mock({ responses: [{ data: null, error: { code: "23514", message: "secret-token", details: "private data" } }] });
  const result = await (await load(failing.client)).fetchTransactions();
  assert.equal(result.error.code, "invalid_input");
  assert.equal(JSON.stringify(result).includes("secret-token"), false);
});
