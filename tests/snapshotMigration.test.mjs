import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrations = (await import("node:fs/promises")).readdir(new URL("../supabase/migrations/", import.meta.url));
const filename = (await migrations).find((name) => name.endsWith("_budget_snapshots.sql"));
const sql = await readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8");

test("budget snapshot schema retains period and summary fields with owner RLS", () => {
  for (const fragment of [
    "create table public.budget_snapshots", "summary jsonb not null", "snapshot_scope text not null",
    "snapshot_year integer not null", "snapshot_month integer", "user_id uuid not null references auth.users(id)",
    "alter table public.budget_snapshots enable row level security", "for select to authenticated",
    "for insert to authenticated", "for update to authenticated", "for delete to authenticated",
    "(select auth.uid()) = user_id", "with check ((select auth.uid()) = user_id)",
    "grant select, insert, update, delete on table public.budget_snapshots to authenticated",
  ]) assert.ok(sql.includes(fragment), `Expected migration to include: ${fragment}`);
});
