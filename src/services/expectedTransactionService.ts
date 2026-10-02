import { supabase } from "../lib/supabaseClient";
import type { ExpectedTransaction, Transaction, SupabaseTransactionType } from "../types/supabase";
import { isValidTransactionDate } from "../app/lib/transactionDates";

export type ExpectedTransactionServiceError = { code: string; message: string };
export type ExpectedTransactionServiceResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: ExpectedTransactionServiceError };

export type ExpectedTransactionCreateInput = {
  title: string;
  amount: number;
  type: SupabaseTransactionType;
  expected_date: string;
  category_id?: string | null;
  payment_method_id?: string | null;
  notes?: string | null;
};

export type ExpectedTransactionUpdateInput = Partial<ExpectedTransactionCreateInput>;

// Step 8G verified the deployed atomic RPC. All configured clients use it;
// a missing RPC fails safely, without a browser multi-call fallback.
export const isExpectedCompletionAvailable = Boolean(supabase);
export type ExpectedTransactionCompletionInput = Omit<ExpectedTransactionCreateInput, "type" | "expected_date"> & { transaction_date: string };
export type ExpectedTransactionCompletion = {
  expected_transaction: ExpectedTransaction;
  actual_transaction: Transaction;
  already_completed: boolean;
};
const optionalString = (value: unknown) => value == null || typeof value === "string";

export function completeExpectedTransaction(id: string, input: ExpectedTransactionCompletionInput, expectedOwnerId?: string): Promise<ExpectedTransactionServiceResult<ExpectedTransactionCompletion>> {
  if (!isExpectedCompletionAvailable) return Promise.resolve(failure("supabase_not_configured", "Supabase is not configured for completion."));
  if (typeof input.title !== "string" || !input.title.trim() || !validAmount(input.amount)
    || !isValidTransactionDate(input.transaction_date)
    || !optionalString(input.category_id) || !optionalString(input.payment_method_id) || !optionalString(input.notes)) {
    return Promise.resolve(failure("invalid_input", "Check the actual title, positive amount, calendar date, and references."));
  }
  return authenticated(expectedOwnerId, async (client, owner) => {
    const { data, error } = await client.rpc("complete_expected_transaction", {
      p_expected_transaction_id: id, p_title: input.title.trim(), p_amount: input.amount,
      p_transaction_date: input.transaction_date, p_category_id: input.category_id || null,
      p_payment_method_id: input.payment_method_id || null, p_notes: input.notes?.trim() || null,
    }).then((response) => response, () => ({ data: null, error: { code: "network" } }));
    if (error) {
      if (error.code === "P0001") return failure("cancelled_event", "Reopen the cancelled event before recording it as completed.");
      if (error.code === "P0002") return failure("not_found", "This expected event is unavailable for the active account.");
      if (error.code === "22023") return failure("invalid_input", "Check actual fields and choose active owned category/payment references, or clear them.");
      return failure("completion_failed", "Completion could not be confirmed. Retry this same event safely; a retry will not create a second actual transaction.");
    }
    const result = data as unknown as ExpectedTransactionCompletion;
    if (!result || result.expected_transaction?.user_id !== owner || result.actual_transaction?.user_id !== owner
      || result.expected_transaction.id !== id || result.expected_transaction.status !== "completed"
      || result.expected_transaction.actual_transaction_id !== result.actual_transaction.id || typeof result.already_completed !== "boolean") {
      return failure("invalid_response", "Completion could not be confirmed. Retry this same event safely.");
    }
    return success(result);
  });
}

const success = <T,>(data: T): ExpectedTransactionServiceResult<T> => ({ ok: true, data, error: null });
const failure = <T,>(code: string, message: string): ExpectedTransactionServiceResult<T> =>
  ({ ok: false, data: null, error: { code, message } });
const safeError = "Expected transaction changes could not be completed. Please try again.";

function databaseFailure<T>(code?: string): ExpectedTransactionServiceResult<T> {
  if (["22P02", "22003", "22007", "22008", "23503", "23514"].includes(code ?? "")) {
    return failure("invalid_data", "Check the event details, date, and category or payment method.");
  }
  if (code === "42501") return failure("access_denied", "This expected transaction change is not allowed.");
  return failure("request_failed", safeError);
}

function validAmount(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0
    && amount <= 999999999999.99 && Number(amount.toFixed(2)) === amount;
}

function validType(type: unknown): type is SupabaseTransactionType {
  return type === "income" || type === "expense" || type === "savings" || type === "debt";
}

function validCreate(input: ExpectedTransactionCreateInput): boolean {
  return typeof input.title === "string" && !!input.title.trim() && validAmount(input.amount)
    && validType(input.type) && isValidTransactionDate(input.expected_date)
    && (input.category_id == null || typeof input.category_id === "string")
    && (input.payment_method_id == null || typeof input.payment_method_id === "string")
    && (input.notes == null || typeof input.notes === "string");
}

function safeCreatePayload(input: ExpectedTransactionCreateInput) {
  return {
    title: input.title.trim(), amount: input.amount, type: input.type,
    expected_date: input.expected_date, category_id: input.category_id || null,
    payment_method_id: input.payment_method_id || null, notes: input.notes?.trim() || null,
  };
}

function safeUpdatePayload(input: ExpectedTransactionUpdateInput) {
  const fields = {
    title: input.title === undefined ? undefined : input.title.trim(),
    amount: input.amount,
    type: input.type,
    expected_date: input.expected_date,
    category_id: input.category_id,
    payment_method_id: input.payment_method_id,
    notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<typeof fields>;
}

function validUpdate(input: ExpectedTransactionUpdateInput, payload: ReturnType<typeof safeUpdatePayload>): boolean {
  return Object.values(payload).some((value) => value !== undefined)
    && (input.title === undefined || (typeof input.title === "string" && !!input.title.trim()))
    && (input.amount === undefined || validAmount(input.amount))
    && (input.type === undefined || validType(input.type))
    && (input.expected_date === undefined || isValidTransactionDate(input.expected_date))
    && (input.category_id === undefined || input.category_id === null || typeof input.category_id === "string")
    && (input.payment_method_id === undefined || input.payment_method_id === null || typeof input.payment_method_id === "string")
    && (input.notes === undefined || input.notes === null || typeof input.notes === "string");
}

async function authenticated<T>(
  expectedOwnerId: string | undefined,
  operation: (client: NonNullable<typeof supabase>, ownerId: string) => Promise<ExpectedTransactionServiceResult<T>>,
): Promise<ExpectedTransactionServiceResult<T>> {
  if (!supabase) return failure("supabase_not_configured", "Supabase is not configured for expected transactions.");
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return failure("not_authenticated", "Sign in to manage expected transactions.");
    if (expectedOwnerId && expectedOwnerId !== data.user.id) {
      return failure("account_changed", "The active account changed before the event could be updated.");
    }
    return await operation(supabase, data.user.id);
  } catch {
    return failure("request_failed", safeError);
  }
}

/** Read-only, owner-scoped read; full history is paginated to avoid API row truncation. */
export async function fetchExpectedTransactions(): Promise<ExpectedTransactionServiceResult<ExpectedTransaction[]>> {
  if (!supabase) return failure("supabase_not_configured", "Supabase is not configured for expected transactions.");
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return failure("not_authenticated", "Sign in to view expected transactions.");

    const rows: ExpectedTransaction[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from("expected_transactions").select("*")
        .eq("user_id", authData.user.id)
        .order("expected_date", { ascending: true })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) return databaseFailure(error.code);
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) return success(rows);
    }
  } catch {
    return failure("request_failed", "Expected transactions could not be loaded. Please try again.");
  }
}

export function createExpectedTransaction(
  input: ExpectedTransactionCreateInput,
  expectedOwnerId?: string,
): Promise<ExpectedTransactionServiceResult<ExpectedTransaction>> {
  if (!validCreate(input)) return Promise.resolve(failure("invalid_input", "Enter a title, positive amount, valid type, and valid calendar date."));
  const payload = safeCreatePayload(input);
  return authenticated(expectedOwnerId, async (client) => {
    const { data, error } = await client.from("expected_transactions").insert(payload).select("*").single();
    return error ? databaseFailure(error.code) : success(data);
  });
}

export function updateExpectedTransaction(
  id: string,
  input: ExpectedTransactionUpdateInput,
  expectedOwnerId?: string,
): Promise<ExpectedTransactionServiceResult<ExpectedTransaction>> {
  const payload = safeUpdatePayload(input);
  if (!id || !validUpdate(input, payload)) return Promise.resolve(failure("invalid_input", "Provide valid expected transaction fields to update."));
  return authenticated(expectedOwnerId, async (client, ownerId) => {
    const { data, error } = await client.from("expected_transactions").update(payload)
      .eq("id", id).eq("user_id", ownerId).in("status", ["planned", "cancelled"]).select("*").maybeSingle();
    if (error) return databaseFailure(error.code);
    return data ? success(data) : failure("not_found", "Editable expected transaction was not found.");
  });
}

export function cancelExpectedTransaction(
  id: string,
  expectedOwnerId?: string,
): Promise<ExpectedTransactionServiceResult<ExpectedTransaction>> {
  if (!id) return Promise.resolve(failure("invalid_input", "Expected transaction ID is required."));
  return authenticated(expectedOwnerId, async (client, ownerId) => {
    const { data, error } = await client.from("expected_transactions").update({ status: "cancelled" })
      .eq("id", id).eq("user_id", ownerId).eq("status", "planned").select("*").maybeSingle();
    if (error) return databaseFailure(error.code);
    return data ? success(data) : failure("not_found", "Planned expected transaction was not found.");
  });
}

export function reopenExpectedTransaction(
  id: string,
  expectedOwnerId?: string,
): Promise<ExpectedTransactionServiceResult<ExpectedTransaction>> {
  if (!id) return Promise.resolve(failure("invalid_input", "Expected transaction ID is required."));
  return authenticated(expectedOwnerId, async (client, ownerId) => {
    const { data, error } = await client.from("expected_transactions").update({ status: "planned" })
      .eq("id", id).eq("user_id", ownerId).eq("status", "cancelled").select("*").maybeSingle();
    if (error) return databaseFailure(error.code);
    return data ? success(data) : failure("not_found", "Cancelled expected transaction was not found.");
  });
}

export function deleteExpectedTransaction(
  id: string,
  expectedOwnerId?: string,
): Promise<ExpectedTransactionServiceResult<void>> {
  if (!id) return Promise.resolve(failure("invalid_input", "Expected transaction ID is required."));
  return authenticated(expectedOwnerId, async (client, ownerId) => {
    const { data, error } = await client.from("expected_transactions").delete()
      .eq("id", id).eq("user_id", ownerId).in("status", ["planned", "cancelled"]).select("id").maybeSingle();
    if (error) return databaseFailure(error.code);
    return data ? success(undefined) : failure("not_found", "Deletable expected transaction was not found.");
  });
}
