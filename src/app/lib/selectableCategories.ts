import type { Category, SupabaseCategoryType } from "../../types/supabase";

/** Pass account-backed categories from useCategories; UUIDs remain the identity. */
export function getSelectableCategories(
  categories: readonly Category[],
  type: SupabaseCategoryType,
): Category[] {
  return categories.filter((category) => category.type === type && category.is_archived !== true);
}
