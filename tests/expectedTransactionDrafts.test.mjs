import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const dates = await readFile(new URL("../src/app/lib/transactionDates.ts", import.meta.url), "utf8");
const source = await readFile(new URL("../src/app/lib/expectedTransactionDrafts.ts", import.meta.url), "utf8");
globalThis.__expectedDates = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(dates)).toString("base64")}`);
const isolated = source
  .replace('import { isValidTransactionDate } from "./transactionDates";', "const { isValidTransactionDate } = globalThis.__expectedDates;")
  .replace(/import type \{[\s\S]*?\} from "\.\.\/\.\.\/services\/expectedTransactionService";/, "type ExpectedTransactionCreateInput = any; type ExpectedTransactionUpdateInput = any;")
  .replace('import type { SupabaseTransactionType } from "../../types/supabase";', "type SupabaseTransactionType = string;");
const helper = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(isolated)).toString("base64")}`);
delete globalThis.__expectedDates;

const draft = { title: " Rent ", amount: "1200.50", type: "expense", expected_date: "2028-02-29", category_id: "cat-uuid", payment_method_id: "", notes: " note " };

test("expected draft validates positive amount, title and exact date-only values", () => {
  assert.deepEqual(helper.validateExpectedTransactionDraft(draft), {});
  assert.deepEqual(helper.toCreateExpectedTransactionInput(draft), {
    title: "Rent", amount: 1200.5, type: "expense", expected_date: "2028-02-29",
    category_id: "cat-uuid", payment_method_id: null, notes: "note",
  });
});

test("expected draft rejects blank title, non-positive/invalid/excess precision/oversize amounts and invalid dates", () => {
  for (const changes of [
    { title: " " }, { amount: "0" }, { amount: "-1" }, { amount: "abc" },
    { amount: "1.001" }, { amount: "1000000000000" }, { expected_date: "2026-02-29" },
  ]) assert.ok(Object.keys(helper.validateExpectedTransactionDraft({ ...draft, ...changes })).length > 0);
});

test("update mapping contains editable event fields only", () => {
  assert.deepEqual(helper.toUpdateExpectedTransactionInput(draft), helper.toCreateExpectedTransactionInput(draft));
});
