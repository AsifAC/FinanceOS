// Offline service tests: Supabase requests are mocked; no credentials are read.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../src/services/snapshotService.ts", import.meta.url), "utf8");
let loadId = 0;
async function load(client) {
  globalThis.__snapshotTestClient = client;
  const isolated = source.replace('import { supabase } from "../lib/supabaseClient";', "const supabase = globalThis.__snapshotTestClient;");
  const service = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(isolated)).toString("base64")}#${loadId++}`);
  delete globalThis.__snapshotTestClient;
  return service;
}
function mock({ user = { id: "owner-a" }, responses = [] } = {}) {
  const calls = [];
  let request = 0;
  const query = {};
  for (const method of ["select", "eq", "is", "order", "limit", "range", "insert", "update", "delete", "single", "maybeSingle"]) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  query.then = (resolve, reject) => Promise.resolve(responses[request++] ?? { data: [], error: null }).then(resolve, reject);
  return {
    calls,
    client: { auth: { getUser: async () => ({ data: { user }, error: null }) }, from: (table) => { calls.push(["from", table]); return query; } },
  };
}
const monthlySummary = {
  year: "2026", month: 8, month_label: "September", saved_at: "2026-09-30T10:00:00Z",
  income: 100, savings: 10, debt: 5, expenses: 25, amount_left: 60,
  expected_income: 110, expected_savings: 10, expected_debt: 5, expected_expenses: 30,
  expected_amount_left: 65, actual_amount_left: 60, savings_rate: 10, expense_rate: 25,
  debt_payment_rate: 5, category_breakdowns: [{ category: "Food", amount: 25 }], transaction_count: 2,
  pending_transaction_count: 1, notes: "period note", snapshot_version: 2, actual_source: "supabase",
  expected_source: "local", snapshot_owner_id: "owner-a",
};
const row = { id: "snapshot-a", user_id: "owner-a", snapshot_scope: "month", snapshot_year: 2026,
  snapshot_month: 8, snapshot_version: 2, actual_source: "supabase", expected_source: "local",
  summary: monthlySummary, created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z" };

test("fetch is owner-filtered and paginated rows retain their stored JSON summary", async () => {
  const db = mock({ responses: [{ data: [row], error: null }] });
  const result = await (await load(db.client)).fetchSnapshots("owner-a");
  assert.equal(result.ok, true);
  assert.deepEqual(result.data[0].summary, monthlySummary);
  assert.ok(db.calls.some(([op, key, value]) => op === "eq" && key === "user_id" && value === "owner-a"));
  assert.ok(db.calls.some(([op]) => op === "range"));
});

test("overwrite updates only the current owner's matching period; save-as-new inserts", async () => {
  const db = mock({ responses: [
    { data: { id: "snapshot-a" }, error: null }, { data: row, error: null }, { data: { ...row, id: "snapshot-b" }, error: null },
  ] });
  const service = await load(db.client);
  assert.equal((await service.saveSnapshot({ scope: "month", year: 2026, month: 8, summary: monthlySummary }, "owner-a")).data.id, "snapshot-a");
  const newSave = await service.saveSnapshot({ scope: "month", year: 2026, month: 8, summary: monthlySummary, mode: "new" }, "owner-a");
  assert.equal(newSave.data.id, "snapshot-b");
  assert.ok(db.calls.some(([op, key, value]) => op === "eq" && key === "user_id" && value === "owner-a"));
  const inserted = db.calls.find(([op]) => op === "insert")[1];
  assert.equal(inserted.user_id, "owner-a");
  assert.deepEqual(inserted.summary, monthlySummary);
});

test("caller-supplied ownership is ignored and captured owner mismatch blocks writes", async () => {
  const db = mock({ user: { id: "owner-b" } });
  const service = await load(db.client);
  const result = await service.saveSnapshot({ scope: "month", year: 2026, month: 8, summary: monthlySummary }, "owner-a");
  assert.equal(result.error.code, "account_changed");
  assert.equal(db.calls.some(([op]) => ["insert", "update", "delete"].includes(op)), false);
});

test("notes update only stored summary notes and delete is owner/id scoped", async () => {
  const db = mock({ responses: [
    { data: { summary: monthlySummary }, error: null }, { data: { ...row, summary: { ...monthlySummary, notes: "changed" } }, error: null },
    { data: { id: "snapshot-a" }, error: null },
  ] });
  const service = await load(db.client);
  const changed = await service.updateSnapshotNotes("snapshot-a", "changed", "owner-a");
  assert.equal(changed.data.summary.notes, "changed");
  const updated = db.calls.find(([op]) => op === "update")[1];
  assert.equal(updated.summary.income, monthlySummary.income);
  assert.equal(updated.summary.notes, "changed");
  assert.equal((await service.deleteSnapshot("snapshot-a", "owner-a")).ok, true);
  assert.ok(db.calls.some(([op, key, value]) => op === "eq" && key === "id" && value === "snapshot-a"));
  assert.ok(db.calls.filter(([op, key, value]) => op === "eq" && key === "user_id" && value === "owner-a").length >= 3);
});

test("invalid month/year periods are rejected before any database call", async () => {
  const db = mock();
  const service = await load(db.client);
  for (const input of [
    { scope: "month", year: 2026, month: 12, summary: monthlySummary },
    { scope: "year", year: 2026, month: 0, summary: monthlySummary },
    { scope: "year", year: 0, summary: monthlySummary },
  ]) assert.equal((await service.saveSnapshot(input)).error.code, "invalid_input");
  assert.equal(db.calls.length, 0);
});
