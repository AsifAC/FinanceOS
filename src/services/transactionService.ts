import { supabase } from "../lib/supabaseClient";
import type {
  SupabaseTransactionType, Transaction, TransactionInsert, TransactionUpdate,
} from "../types/supabase";

export type CreateTransactionInput = Omit<TransactionInsert, "id" | "user_id" | "created_at" | "updated_at">;
export type UpdateTransactionInput = Partial<CreateTransactionInput>;
export type TransactionServiceError = { code: string; message: string };
export type TransactionServiceResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: TransactionServiceError };

const success = <T>(data: T): TransactionServiceResult<T> => ({ ok: true, data, error: null });
const failure = <T>(code: string, message: string): TransactionServiceResult<T> =>
  ({ ok: false, data: null, error: { code, message } });

// Only fixed messages leave this boundary; never forward server details or Auth tokens.
function databaseFailure<T>(code?: string): TransactionServiceResult<T> {
  if (code === "23503" || code === "23514" || code === "22P02" || code === "22003" || code === "22007" || code === "22008") {
    return failure("invalid_input", "Check transaction fields and category/payment method ownership.");
  }
  if (code === "42501") return failure("access_denied", "This transaction operation is not allowed.");
  return failure("request_failed", "The transaction request could not be completed.");
}

async function authenticated<T>(
  operation: (client: NonNullable<typeof supabase>, userId: string) => Promise<TransactionServiceResult<T>>,
): Promise<TransactionServiceResult<T>> {
  if (!supabase) return failure("supabase_not_configured", "Supabase is not configured for transactions.");
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return failure("not_authenticated", "Sign in to access transactions.");
    return await operation(supabase, data.user.id);
  } catch {
    return failure("request_failed", "The transaction request could not be completed.");
  }
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Runtime allowlist also protects callers using casts/plain JavaScript.
// user_id, id and timestamps can never be supplied through this service.
function writableFields(input: UpdateTransactionInput): UpdateTransactionInput {
  return {
    type: input.type, amount: input.amount, title: input.title?.trim(),
    description: input.description, category_id: input.category_id,
    payment_method_id: input.payment_method_id, transaction_date: input.transaction_date,
    notes: input.notes, is_recurring: input.is_recurring,
    recurring_group_id: input.recurring_group_id, source: input.source,
  };
}

function validFields(input: UpdateTransactionInput): boolean {
  return (input.type === undefined || ["income", "expense", "savings", "debt"].includes(input.type))
    && (input.amount === undefined || (Number.isFinite(input.amount) && input.amount > 0 && input.amount <= 999999999999.99))
    && (input.title === undefined || input.title.trim().length > 0)
    && (input.transaction_date === undefined || validDate(input.transaction_date))
    && (input.source === undefined || ["manual", "recurring", "import", "migration"].includes(input.source));
}

type Filters = { type?: SupabaseTransactionType; start?: string; end?: string; endExclusive?: boolean };
function fetchFiltered(filters: Filters = {}): Promise<TransactionServiceResult<Transaction[]>> {
  return authenticated(async (client, userId) => {
    if ((filters.type !== undefined && !validFields({ type: filters.type }))
      || (filters.start !== undefined && !validDate(filters.start))
      || (filters.end !== undefined && !validDate(filters.end))
      || (filters.start !== undefined && filters.end !== undefined && filters.start > filters.end)) {
      return failure("invalid_input", "Provide a valid transaction type and date range.");
    }
    const rows: Transaction[] = [];
    const pageSize = 500;
    // Avoid silently truncating a user's history at the API row limit.
    for (let offset = 0; ; offset += pageSize) {
      let query = client.from("transactions").select("*").eq("user_id", userId)
        .order("transaction_date", { ascending: false }).order("id", { ascending: false });
      if (filters.type) query = query.eq("type", filters.type);
      if (filters.start) query = query.gte("transaction_date", filters.start);
      if (filters.end) query = filters.endExclusive
        ? query.lt("transaction_date", filters.end) : query.lte("transaction_date", filters.end);
      const { data, error } = await query.range(offset, offset + pageSize - 1);
      if (error) return databaseFailure(error.code);
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) return success(rows);
    }
  });
}

export const fetchTransactions = () => fetchFiltered();
export const fetchTransactionsByType = (type: SupabaseTransactionType) => fetchFiltered({ type });
/** Both dates are inclusive, formatted YYYY-MM-DD. */
export const fetchTransactionsByDateRange = (startDate: string, endDate: string) =>
  fetchFiltered({ start: startDate, end: endDate });

/** Month is 1–12 (frontend selectedMonth is 0–11). No timezone conversion. */
export function fetchTransactionsForMonth(year: number, month: number): Promise<TransactionServiceResult<Transaction[]>> {
  if (!Number.isInteger(year) || year < 1 || year > 9998 || !Number.isInteger(month) || month < 1 || month > 12) {
    return Promise.resolve(failure("invalid_input", "Use a year from 1 to 9998 and a month from 1 to 12."));
  }
  const start = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
  return fetchFiltered({ start, end, endExclusive: true });
}

export function fetchTransactionById(id: string): Promise<TransactionServiceResult<Transaction | null>> {
  return authenticated(async (client, userId) => {
    const { data, error } = await client.from("transactions").select("*")
      .eq("id", id).eq("user_id", userId).maybeSingle();
    return error ? databaseFailure(error.code) : success(data);
  });
}

export function createTransaction(input: CreateTransactionInput): Promise<TransactionServiceResult<Transaction>> {
  return authenticated(async (client, userId) => {
    if (!input.type || input.amount === undefined || !input.title || !input.transaction_date || !validFields(input)) {
      return failure("invalid_input", "Provide a type, positive amount, title and valid transaction date.");
    }
    const payload: TransactionInsert = {
      ...writableFields(input), type: input.type, amount: input.amount,
      title: input.title.trim(), transaction_date: input.transaction_date, user_id: userId,
    };
    const { data, error } = await client.from("transactions").insert(payload).select("*").single();
    return error ? databaseFailure(error.code) : success(data);
  });
}

export function updateTransaction(id: string, input: UpdateTransactionInput): Promise<TransactionServiceResult<Transaction>> {
  return authenticated(async (client, userId) => {
    const payload: TransactionUpdate = writableFields(input);
    if (!validFields(input) || !Object.values(payload).some((value) => value !== undefined)) {
      return failure("invalid_input", "Provide valid transaction fields to update.");
    }
    const { data, error } = await client.from("transactions").update(payload)
      .eq("id", id).eq("user_id", userId).select("*").maybeSingle();
    if (error) return databaseFailure(error.code);
    return data ? success(data) : failure("not_found", "Transaction was not found.");
  });
}

export function deleteTransaction(id: string): Promise<TransactionServiceResult<void>> {
  return authenticated(async (client, userId) => {
    const { data, error } = await client.from("transactions").delete()
      .eq("id", id).eq("user_id", userId).select("id").maybeSingle();
    if (error) return databaseFailure(error.code);
    return data ? success(undefined) : failure("not_found", "Transaction was not found.");
  });
}
