import { supabase } from "../lib/supabaseClient";
import type {
  Category,
  CategoryInsert,
  CategoryUpdate,
  SupabaseCategoryType,
} from "../types/supabase";

export type CreateCategoryInput = Pick<CategoryInsert, "name" | "type"> &
  Partial<
    Pick<
      CategoryInsert,
      "icon" | "color" | "sort_order" | "is_default" | "is_archived"
    >
  >;

export type UpdateCategoryInput = Partial<
  Pick<
    CategoryUpdate,
    | "name"
    | "type"
    | "icon"
    | "color"
    | "sort_order"
    | "is_archived"
  >
>;

export type CategoryServiceError = {
  message: string;
  code?: string;
};

export type CategoryServiceResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: CategoryServiceError };

const notConfiguredError: CategoryServiceError = {
  code: "supabase_not_configured",
  message:
    "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to use categories.",
};

const notAuthenticatedError: CategoryServiceError = {
  code: "not_authenticated",
  message: "Sign in before loading or updating categories.",
};

function success<T>(data: T): CategoryServiceResult<T> {
  return { ok: true, data, error: null };
}

function failure<T>(error: CategoryServiceError): CategoryServiceResult<T> {
  return { ok: false, data: null, error };
}

function mapError(error: { code?: string; message?: string }): CategoryServiceError {
  return {
    code: error.code,
    message: error.message || "Category request failed.",
  };
}

async function getCurrentUserId(): Promise<CategoryServiceResult<string>> {
  if (!supabase) return failure(notConfiguredError);

  const { data, error } = await supabase.auth.getUser();
  if (error) return failure(mapError(error));
  if (!data.user) return failure(notAuthenticatedError);

  return success(data.user.id);
}

function orderCategories() {
  return supabase!
    .from("categories")
    .select("*")
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
}

export async function fetchCategories(): Promise<
  CategoryServiceResult<Category[]>
> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { data, error } = await orderCategories().eq("user_id", userId.data);
  if (error) return failure(mapError(error));

  return success(data ?? []);
}

export async function fetchCategoriesByType(
  type: SupabaseCategoryType,
): Promise<CategoryServiceResult<Category[]>> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { data, error } = await orderCategories()
    .eq("user_id", userId.data)
    .eq("type", type);
  if (error) return failure(mapError(error));

  return success(data ?? []);
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<CategoryServiceResult<Category>> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { data, error } = await supabase
    .from("categories")
    .insert({
      ...input,
      name: input.name.trim(),
      user_id: userId.data,
    })
    .select("*")
    .single();

  if (error) return failure(mapError(error));

  return success(data);
}

export async function updateCategory(
  id: string,
  updates: UpdateCategoryInput,
): Promise<CategoryServiceResult<Category>> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const nextUpdates = {
    ...updates,
    name: updates.name?.trim(),
  };

  const { data, error } = await supabase
    .from("categories")
    .update(nextUpdates)
    .eq("id", id)
    .eq("user_id", userId.data)
    .select("*")
    .single();

  if (error) return failure(mapError(error));

  return success(data);
}

export function archiveCategory(
  id: string,
): Promise<CategoryServiceResult<Category>> {
  return updateCategory(id, { is_archived: true });
}

export async function deleteCategory(
  id: string,
): Promise<CategoryServiceResult<void>> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId.data);

  if (error) return failure(mapError(error));

  return success(undefined);
}
