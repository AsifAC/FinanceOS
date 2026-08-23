import { supabase } from "../lib/supabaseClient";
import { InsertRow, UpdateRow, UserOwnedRow } from "./dbTypes";

export type ServiceResult<T> = {
  data: T | null;
  error: string | null;
};

export type ListFilters = {
  year?: number;
  month?: number;
  type?: string;
};

export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("User is not authenticated.");
  return data.user.id;
}

export async function listOwnRows<T extends UserOwnedRow>(
  table: string,
  filters: ListFilters = {},
  orderBy = "created_at",
): Promise<ServiceResult<T[]>> {
  try {
    const userId = await getCurrentUserId();
    let query = supabase.from(table).select("*").eq("user_id", userId);
    if (filters.year !== undefined) query = query.eq("year", filters.year);
    if (filters.month !== undefined) query = query.eq("month", filters.month);
    if (filters.type !== undefined) query = query.eq("type", filters.type);
    const { data, error } = await query.order(orderBy, { ascending: false });
    if (error) throw error;
    return { data: (data ?? []) as T[], error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

export async function getOwnRow<T extends UserOwnedRow>(table: string, id: string): Promise<ServiceResult<T>> {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase.from(table).select("*").eq("user_id", userId).eq("id", id).single();
    if (error) throw error;
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

export async function createOwnRow<T extends UserOwnedRow>(
  table: string,
  values: InsertRow<T>,
): Promise<ServiceResult<T>> {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase.from(table).insert({ ...values, user_id: userId }).select("*").single();
    if (error) throw error;
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

export async function updateOwnRow<T extends UserOwnedRow>(
  table: string,
  id: string,
  values: UpdateRow<T>,
): Promise<ServiceResult<T>> {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from(table)
      .update(values)
      .eq("user_id", userId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

export async function deleteOwnRow(table: string, id: string): Promise<ServiceResult<boolean>> {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from(table).delete().eq("user_id", userId).eq("id", id);
    if (error) throw error;
    return { data: true, error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected Supabase error.";
}
