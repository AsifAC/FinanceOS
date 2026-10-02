import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const dates = await readFile(new URL("../src/app/lib/transactionDates.ts", import.meta.url), "utf8");
const presentation = await readFile(new URL("../src/app/lib/expectedTransactionPresentation.ts", import.meta.url), "utf8");
globalThis.__expectedDates = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(dates)).toString("base64")}`);
const isolated = presentation.replace(
  /import \{[^}]+\} from "\.\/transactionDates";/,
  "const { isValidTransactionDate, localTransactionDate, transactionYear, transactionMonthIndex } = globalThis.__expectedDates;",
);
const helpers = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(isolated)).toString("base64")}`);
delete globalThis.__expectedDates;

function row(id, status, expected_date, overrides = {}) {
  return { id, user_id: "owner", title: id, amount: 10, type: "expense", expected_date,
    category_id: null, payment_method_id: null, notes: null, status,
    actual_transaction_id: status === "completed" ? `actual-${id}` : null,
    completed_at: status === "completed" ? "2026-01-01T00:00:00Z" : null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...overrides };
}

test("only past planned events are overdue using date-only local-calendar comparison", () => {
  assert.equal(helpers.isExpectedTransactionOverdue(row("past-plan", "planned", "2026-09-29"), "2026-09-30"), true);
  assert.equal(helpers.isExpectedTransactionOverdue(row("today-plan", "planned", "2026-09-30"), "2026-09-30"), false);
  assert.equal(helpers.isExpectedTransactionOverdue(row("future-plan", "planned", "2026-10-01"), "2026-09-30"), false);
  assert.equal(helpers.isExpectedTransactionOverdue(row("past-completed", "completed", "2026-09-01"), "2026-09-30"), false);
  assert.equal(helpers.isExpectedTransactionOverdue(row("past-cancelled", "cancelled", "2026-09-01"), "2026-09-30"), false);
  assert.equal(helpers.isExpectedTransactionOverdue(row("invalid", "planned", "2026-02-30"), "2026-09-30"), false);
});

test("presentation filters year, zero-based month, type, status and title locally", () => {
  const rows = [
    row("oct-expense", "planned", "2026-10-04", { type: "expense" }),
    row("oct-income", "planned", "2026-10-10", { type: "income" }),
    row("sep-debt", "planned", "2026-09-29", { type: "debt" }),
    row("old-completed", "completed", "2025-10-10", { type: "savings" }),
  ];
  const result = helpers.filterExpectedTransactions(rows, {
    year: 2026, monthIndex: 9, type: "income", status: "planned", search: "OCT-",
  }, "2026-09-30");
  assert.deepEqual(result.map((item) => item.id), ["oct-income"]);
  assert.deepEqual(helpers.filterExpectedTransactions(rows, {
    year: 2026, monthIndex: 8, type: "all", status: "overdue", search: "",
  }, "2026-09-30").map((item) => item.id), ["sep-debt"]);
});

test("planned rows sort first by nearest date, then historical rows newest first", () => {
  const rows = [row("cancelled", "cancelled", "2026-10-10"), row("later", "planned", "2026-10-08"),
    row("completed", "completed", "2026-10-12"), row("sooner", "planned", "2026-10-01")];
  assert.deepEqual(helpers.sortExpectedTransactions(rows).map((item) => item.id), ["sooner", "later", "completed", "cancelled"]);
});
