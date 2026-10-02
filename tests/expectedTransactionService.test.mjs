import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../src/services/expectedTransactionService.ts", import.meta.url), "utf8");
const datesSource = await readFile(new URL("../src/app/lib/transactionDates.ts", import.meta.url), "utf8");
globalThis.__expectedDateHelpers = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(datesSource)).toString("base64")}`);
let moduleId = 0;

async function load(client) {
  globalThis.__expectedTransactionTestClient = client;
  const isolated = source
    .replace('import { supabase } from "../lib/supabaseClient";',
      "const supabase = globalThis.__expectedTransactionTestClient;")
    .replace('import { isValidTransactionDate } from "../app/lib/transactionDates";',
      "const { isValidTransactionDate } = globalThis.__expectedDateHelpers;");
  const service = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(isolated)).toString("base64")}#${moduleId++}`);
  delete globalThis.__expectedTransactionTestClient;
  return service;
}

function row(overrides = {}) {
  return {
    id: "server-id", user_id: "owner-a", title: "Rent", amount: 100, type: "expense",
    expected_date: "2026-10-01", category_id: null, payment_method_id: null, notes: null,
    status: "planned", actual_transaction_id: null, completed_at: null,
    created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", ...overrides,
  };
}

function mock({ user = { id: "owner-a" }, readResponses = [{ data: [], error: null }], mutationResponses = [], authError = null, authThrows = false } = {}) {
  const calls = [];
  let readIndex = 0;
  let mutationIndex = 0;
  const nextMutation = () => mutationResponses[mutationIndex++] ?? { data: row(), error: null };
  const client = {
    auth: { getUser: async () => {
      if (authThrows) throw new Error("private token");
      return { data: { user }, error: authError };
    } },
    from(table) {
      calls.push(["from", table]);
      const query = { table, action: "select", payload: null };
      for (const method of ["select", "eq", "in", "order", "range"]) query[method] = (...args) => {
        calls.push([method, table, ...args]); return query;
      };
      query.insert = (payload) => { query.action = "insert"; query.payload = payload; calls.push(["insert", table, payload]); return query; };
      query.update = (payload) => { query.action = "update"; query.payload = payload; calls.push(["update", table, payload]); return query; };
      query.delete = () => { query.action = "delete"; calls.push(["delete", table]); return query; };
      query.single = async () => nextMutation();
      query.maybeSingle = async () => nextMutation();
      query.then = (resolve, reject) => Promise.resolve(readResponses[readIndex++] ?? { data: [], error: null }).then(resolve, reject);
      return query;
    },
  };
  return { client, calls };
}

const validInput = {
  title: "  Planned rent  ", amount: 123.45, type: "expense", expected_date: "2026-10-15",
  category_id: null, payment_method_id: null, notes: "  note  ",
};

test("expected-event reads require a configured Supabase client and authenticated owner", async () => {
  assert.equal((await (await load(null)).fetchExpectedTransactions()).error.code, "supabase_not_configured");
  const guest = mock({ user: null });
  const result = await (await load(guest.client)).fetchExpectedTransactions();
  assert.equal(result.error.code, "not_authenticated");
  assert.equal(guest.calls.length, 0);
});

test("configured hosted Supabase can use the deployed expected-event schema", async () => {
  const db = mock();
  const service = await load(db.client);
  for (const result of [
    await service.fetchExpectedTransactions(),
    await service.createExpectedTransaction(validInput, "owner-a"),
    await service.updateExpectedTransaction("id", { title: "x" }, "owner-a"),
    await service.cancelExpectedTransaction("id", "owner-a"),
    await service.reopenExpectedTransaction("id", "owner-a"),
    await service.deleteExpectedTransaction("id", "owner-a"),
  ]) assert.equal(result.ok, true);
  assert.ok(db.calls.length > 0);
});

test("missing hosted table fails safely without local fallback", async () => {
  const db = mock({ readResponses: [{ data: null, error: { code: "42P01", message: "private schema detail" } }] });
  const result = await (await load(db.client)).fetchExpectedTransactions();
  assert.equal(result.ok, false);
  assert.equal(result.error.message, "Expected transaction changes could not be completed. Please try again.");
});

test("read is owner-filtered, stably ordered and paginated", async () => {
  const db = mock({ readResponses: [
    { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null },
    { data: [{ id: 500 }], error: null },
  ] });
  const result = await (await load(db.client)).fetchExpectedTransactions();
  assert.equal(result.data.length, 501);
  assert.deepEqual(db.calls.filter(([op]) => op === "eq"), [
    ["eq", "expected_transactions", "user_id", "owner-a"],
    ["eq", "expected_transactions", "user_id", "owner-a"],
  ]);
});

test("create sends only safe event columns and uses server owner, ID, and planned defaults", async () => {
  const created = row({ id: "server-generated-id", title: "Planned rent", notes: "note" });
  const db = mock({ mutationResponses: [{ data: created, error: null }] });
  const service = await load(db.client);
  const result = await service.createExpectedTransaction({
    ...validInput, id: "forged-id", user_id: "owner-b", status: "completed",
    actual_transaction_id: "actual-id", completed_at: "2026-01-01", created_at: "forged", updated_at: "forged",
  }, "owner-a");
  assert.equal(result.data.id, "server-generated-id");
  const [, , payload] = db.calls.find(([op]) => op === "insert");
  assert.deepEqual(payload, {
    title: "Planned rent", amount: 123.45, type: "expense", expected_date: "2026-10-15",
    category_id: null, payment_method_id: null, notes: "note",
  });
});

test("create rejects invalid title, amount, type and calendar date before database access", async () => {
  for (const changes of [
    { title: " " }, { amount: 0 }, { amount: -1 }, { amount: Number.NaN },
    { amount: Number.POSITIVE_INFINITY }, { amount: 1.001 }, { amount: 1000000000000 },
    { type: "transfer" }, { expected_date: "2026-02-29" },
  ]) {
    const db = mock();
    const result = await (await load(db.client)).createExpectedTransaction({ ...validInput, ...changes }, "owner-a");
    assert.equal(result.error.code, "invalid_input");
    assert.equal(db.calls.length, 0);
  }
});

test("update allowlists editable fields and cannot write lifecycle or completion fields", async () => {
  const updated = row({ title: "Renamed", category_id: "owned-category", notes: null });
  const db = mock({ mutationResponses: [{ data: updated, error: null }] });
  const service = await load(db.client);
  const result = await service.updateExpectedTransaction("server-id", {
    title: " Renamed ", category_id: "owned-category", notes: "",
    status: "completed", actual_transaction_id: "forged", completed_at: "forged", user_id: "owner-b",
  }, "owner-a");
  assert.equal(result.data.title, "Renamed");
  const [, , payload] = db.calls.find(([op]) => op === "update");
  assert.deepEqual(payload, { title: "Renamed", category_id: "owned-category", notes: null });
  assert.deepEqual(db.calls.filter(([op]) => op === "eq"), [["eq", "expected_transactions", "id", "server-id"], ["eq", "expected_transactions", "user_id", "owner-a"]]);
  assert.ok(db.calls.some(([op, table, column, values]) => op === "in" && table === "expected_transactions" && column === "status" && values.join() === "planned,cancelled"));
});

test("cancel and reopen use only the intended lifecycle transition", async () => {
  const cancelled = mock({ mutationResponses: [{ data: row({ status: "cancelled" }), error: null }] });
  const cancel = await (await load(cancelled.client)).cancelExpectedTransaction("server-id", "owner-a");
  assert.equal(cancel.data.status, "cancelled");
  assert.deepEqual(cancelled.calls.find(([op]) => op === "update")[2], { status: "cancelled" });
  assert.ok(cancelled.calls.some(([op, , column, value]) => op === "eq" && column === "status" && value === "planned"));

  const reopened = mock({ mutationResponses: [{ data: row({ status: "planned" }), error: null }] });
  const reopen = await (await load(reopened.client)).reopenExpectedTransaction("server-id", "owner-a");
  assert.equal(reopen.data.status, "planned");
  assert.deepEqual(reopened.calls.find(([op]) => op === "update")[2], { status: "planned" });
  assert.ok(reopened.calls.some(([op, , column, value]) => op === "eq" && column === "status" && value === "cancelled"));
});

test("delete is owner scoped and limited to planned/cancelled rows", async () => {
  const db = mock({ mutationResponses: [{ data: { id: "server-id" }, error: null }] });
  const result = await (await load(db.client)).deleteExpectedTransaction("server-id", "owner-a");
  assert.equal(result.ok, true);
  assert.deepEqual(db.calls.filter(([op]) => ["eq", "in"].includes(op)), [
    ["eq", "expected_transactions", "id", "server-id"],
    ["eq", "expected_transactions", "user_id", "owner-a"],
    ["in", "expected_transactions", "status", ["planned", "cancelled"]],
  ]);
});

test("captured-owner mismatch, local schema guard, and backend failures are safe", async () => {
  const db = mock({ user: { id: "owner-b" }, mutationResponses: [{ data: null, error: { code: "42501", message: "private" } }] });
  const service = await load(db.client);
  const changed = await service.createExpectedTransaction(validInput, "owner-a");
  assert.equal(changed.error.code, "account_changed");
  assert.equal(db.calls.length, 0);
  const failure = await service.createExpectedTransaction(validInput, "owner-b");
  assert.equal(failure.error.code, "access_denied");
  assert.equal(JSON.stringify(failure).includes("private"), false);
  assert.equal("recordAsActual" in service, false);
});

const completionInput = { title: "  Actual rent  ", amount: 101.25, transaction_date: "2024-02-29", category_id: null, payment_method_id: null, notes: " Note " };
const completion = (already = false) => ({ expected_transaction: row({ status: "completed", actual_transaction_id: "actual-id", completed_at: "2026-10-02" }), actual_transaction: { id: "actual-id", user_id: "owner-a" }, already_completed: already });

test("completion calls only the atomic RPC with allowlisted actual overrides", async () => {
  for (const already of [false, true]) {
    const db = mock();
    db.client.rpc = async (name, args) => { db.calls.push(["rpc", name, args]); return { data: completion(already), error: null }; };
    const result = await (await load(db.client)).completeExpectedTransaction("server-id", { ...completionInput, user_id: "owner-b", type: "income", status: "completed", actual_transaction_id: "forged" }, "owner-a");
    assert.equal(result.data.already_completed, already);
    assert.equal(result.data.actual_transaction.id, "actual-id");
    assert.deepEqual(db.calls, [["rpc", "complete_expected_transaction", {
      p_expected_transaction_id: "server-id", p_title: "Actual rent", p_amount: 101.25,
      p_transaction_date: "2024-02-29", p_category_id: null, p_payment_method_id: null, p_notes: "Note",
    }]]);
  }
});

test("completion validates fields, ownership and configuration without direct table writes", async () => {
  const db = mock({ user: { id: "owner-b" } });
  const service = await load(db.client);
  for (const changes of [{ title: " " }, { amount: 0 }, { amount: -1 }, { amount: NaN }, { amount: 1.001 }, { transaction_date: "2026-02-29" }]) {
    assert.equal((await service.completeExpectedTransaction("server-id", { ...completionInput, ...changes })).error.code, "invalid_input");
  }
  assert.equal((await service.completeExpectedTransaction("server-id", completionInput, "owner-a")).error.code, "account_changed");
  assert.equal((await (await load(null)).completeExpectedTransaction("server-id", completionInput)).error.code, "supabase_not_configured");
  assert.equal(db.calls.length, 0);
});

test("configured hosted completion uses the verified RPC and a missing RPC fails safely", async () => {
  const db = mock();
  db.client.supabaseUrl = "https://zmbyqstmgtdbyvczuvki.supabase.co";
  db.client.rpc = async (name, args) => { db.calls.push(["rpc", name, args]); return { data: completion(), error: null }; };
  const service = await load(db.client);
  assert.equal(service.isExpectedCompletionAvailable, true);
  assert.equal((await service.completeExpectedTransaction("server-id", completionInput, "owner-a")).ok, true);
  db.client.rpc = async (name) => { db.calls.push(["rpc", name]); return { data: null, error: { code: "PGRST202", message: "private schema cache details" } }; };
  const failure = await service.completeExpectedTransaction("server-id", completionInput, "owner-a");
  assert.equal(failure.error.code, "completion_failed");
  assert.equal(failure.error.message.includes("private schema"), false);
  assert.deepEqual(db.calls.map(([operation]) => operation), ["rpc", "rpc"]);
});

test("RPC errors remain safe and uncertain completion can be retried idempotently", async () => {
  const db = mock();
  let attempts = 0;
  db.client.rpc = async () => ++attempts === 1 ? { data: null, error: { code: "network", message: "private" } } : { data: completion(true), error: null };
  const service = await load(db.client);
  const failed = await service.completeExpectedTransaction("server-id", completionInput, "owner-a");
  assert.match(failed.error.message, /Retry this same event safely/);
  assert.equal(failed.error.message.includes("private"), false);
  assert.equal((await service.completeExpectedTransaction("server-id", completionInput, "owner-a")).data.already_completed, true);
});

test("completion rejects a mismatched-owner server response", async () => {
  const db = mock();
  const result = completion(); result.actual_transaction.user_id = "owner-b";
  db.client.rpc = async () => ({ data: result, error: null });
  assert.equal((await (await load(db.client)).completeExpectedTransaction("server-id", completionInput, "owner-a")).error.code, "invalid_response");
});
