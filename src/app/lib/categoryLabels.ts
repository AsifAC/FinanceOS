import type { Category } from "../../types/supabase";

export function resolveCategoryLabel(
  categoryId: string | null,
  categories: readonly Category[],
  isLoading = false,
): string {
  if (categoryId === null) return "Not assigned";
  if (isLoading) return "Loading category…";
  return categories.find((category) => category.id === categoryId)?.name ?? "Unknown category";
}
