import { supabase } from "../lib/supabaseClient";
import type { Json } from "../types/supabase";
import type { MonthlyBudgetSummary, YearlyBudgetSummary } from "../app/lib/financeStore";

export type SnapshotScope = "month" | "year";
export type SnapshotSummary = MonthlyBudgetSummary | YearlyBudgetSummary;
export type AccountSnapshot = {
  id: string;
  user_id: string;
  snapshot_scope: SnapshotScope;
  snapshot_year: number;
  snapshot_month: number | null;
  snapshot_version: number;
  actual_source: "supabase" | "legacy";
  expected_source: "local";
  summary: SnapshotSummary;
  created_at: string;
  updated_at: string;
};
export type SnapshotServiceError = { code: string; message: string };
export type SnapshotServiceResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: SnapshotServiceError };
export type SaveSnapshotInput = {
  scope: SnapshotScope;
  year: number;
  month?: number;
  summary: SnapshotSummary;
  mode?: "overwrite" | "new";
  targetId?: string;
};

const success = <T,>(data: T): SnapshotServiceResult<T> => ({ ok: true, data, error: null });
const failure = <T,>(code: string, message: string): SnapshotServiceResult<T> => ({
  ok: false, data: null, error: { code, message },
});

function databaseFailure<T>(code?: string): SnapshotServiceResult<T> {
  if (code === "42501") return failure("access_denied", "This archive operation is not allowed.");
  if (["23514", "22P02", "22003"].includes(code ?? "")) return failure("invalid_input", "The saved snapshot data is invalid.");
  return failure("request_failed", "The saved snapshot request could not be completed.");
}

async function authenticated<T>(
  expectedOwnerId: string | undefined,
  operation: (ownerId: string) => Promise<SnapshotServiceResult<T>>,
): Promise<SnapshotServiceResult<T>> {
  if (!supabase) return failure("supabase_not_configured", "Supabase is not configured for saved budgets.");
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return failure("not_authenticated", "Sign in to access saved budgets.");
    if (expectedOwnerId && expectedOwnerId !== data.user.id) {
      return failure("account_changed", "The active account changed before the archive operation completed.");
    }
    return await operation(data.user.id);
  } catch {
    return failure("request_failed", "The saved snapshot request could not be completed.");
  }
}

function validPeriod(scope: SnapshotScope, year: number, month?: number): boolean {
  return Number.isInteger(year) && year >= 1 && year <= 9999
    && (scope === "year" ? month === undefined : Number.isInteger(month) && month! >= 0 && month! <= 11);
}

export function fetchSnapshots(expectedOwnerId?: string): Promise<SnapshotServiceResult<AccountSnapshot[]>> {
  return authenticated(expectedOwnerId, async (ownerId) => {
    const rows: AccountSnapshot[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase!.from("budget_snapshots").select("*")
        .eq("user_id", ownerId).order("snapshot_year", { ascending: false })
        .order("snapshot_month", { ascending: false }).order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) return databaseFailure(error.code);
      rows.push(...((data ?? []) as unknown as AccountSnapshot[]));
      if (!data || data.length < pageSize) return success(rows);
    }
  });
}

export function fetchSnapshotById(id: string, expectedOwnerId?: string): Promise<SnapshotServiceResult<AccountSnapshot | null>> {
  return authenticated(expectedOwnerId, async (ownerId) => {
    const { data, error } = await supabase!.from("budget_snapshots").select("*")
      .eq("id", id).eq("user_id", ownerId).maybeSingle();
    return error ? databaseFailure(error.code) : success(data as unknown as AccountSnapshot | null);
  });
}

export function saveSnapshot(input: SaveSnapshotInput, expectedOwnerId?: string): Promise<SnapshotServiceResult<AccountSnapshot>> {
  if (!validPeriod(input.scope, input.year, input.month)) {
    return Promise.resolve(failure("invalid_input", "Choose a valid snapshot year and period."));
  }
  return authenticated(expectedOwnerId, async (ownerId) => {
    const sourceOwner = (input.summary as SnapshotSummary & { snapshot_owner_id?: string }).snapshot_owner_id;
    if (input.summary.actual_source === "supabase" && sourceOwner && sourceOwner !== ownerId) {
      return failure("account_changed", "Account data changed before the snapshot could be saved.");
    }
    const fields = {
      user_id: ownerId,
      snapshot_scope: input.scope,
      snapshot_year: input.year,
      snapshot_month: input.scope === "month" ? input.month! : null,
      snapshot_version: input.summary.snapshot_version ?? 2,
      actual_source: input.summary.actual_source ?? "supabase",
      expected_source: input.summary.expected_source ?? "local",
      summary: input.summary as unknown as Json,
    };
    let existing: { id: string } | null = null;
    if (input.targetId) {
      const { data, error } = await supabase!.from("budget_snapshots").select("id")
        .eq("id", input.targetId).eq("user_id", ownerId).maybeSingle();
      if (error) return databaseFailure(error.code);
      if (!data) return failure("not_found", "Saved budget was not found.");
      existing = data;
    } else if (input.mode !== "new") {
      let query = supabase!.from("budget_snapshots").select("id").eq("user_id", ownerId)
        .eq("snapshot_scope", input.scope).eq("snapshot_year", input.year);
      query = input.scope === "month" ? query.eq("snapshot_month", input.month!) : query.is("snapshot_month", null);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) return databaseFailure(error.code);
      existing = data;
    }
    if (existing) {
      const { data, error } = await supabase!.from("budget_snapshots").update(fields)
        .eq("id", existing.id).eq("user_id", ownerId).select("*").single();
      return error ? databaseFailure(error.code) : success(data as unknown as AccountSnapshot);
    }
    const { data, error } = await supabase!.from("budget_snapshots").insert(fields).select("*").single();
    return error ? databaseFailure(error.code) : success(data as unknown as AccountSnapshot);
  });
}

export function updateSnapshotNotes(
  id: string,
  notes: string,
  expectedOwnerId?: string,
): Promise<SnapshotServiceResult<AccountSnapshot>> {
  return authenticated(expectedOwnerId, async (ownerId) => {
    const { data: current, error: readError } = await supabase!.from("budget_snapshots").select("summary")
      .eq("id", id).eq("user_id", ownerId).maybeSingle();
    if (readError) return databaseFailure(readError.code);
    if (!current) return failure("not_found", "Saved budget was not found.");
    const summary = { ...(current.summary as Record<string, Json>), notes } as Json;
    const { data, error } = await supabase!.from("budget_snapshots").update({ summary })
      .eq("id", id).eq("user_id", ownerId).select("*").maybeSingle();
    if (error) return databaseFailure(error.code);
    return data ? success(data as unknown as AccountSnapshot) : failure("not_found", "Saved budget was not found.");
  });
}

export function deleteSnapshot(id: string, expectedOwnerId?: string): Promise<SnapshotServiceResult<void>> {
  return authenticated(expectedOwnerId, async (ownerId) => {
    const { data, error } = await supabase!.from("budget_snapshots").delete()
      .eq("id", id).eq("user_id", ownerId).select("id").maybeSingle();
    if (error) return databaseFailure(error.code);
    return data ? success(undefined) : failure("not_found", "Saved budget was not found.");
  });
}
