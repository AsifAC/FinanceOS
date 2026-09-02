import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  archiveCategory,
  createCategory,
  deleteCategory,
  fetchCategories,
  fetchCategoriesByType,
  updateCategory,
  type CategoryServiceError,
  type CategoryServiceResult,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "../services/categoryService";
import type { Category, SupabaseCategoryType } from "../types/supabase";

export function useCategories() {
  const { isAuthenticated, isLoading: authIsLoading, user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<CategoryServiceError | null>(null);

  const refreshCategories = useCallback(async () => {
    if (authIsLoading) {
      return { ok: true, data: [], error: null } satisfies CategoryServiceResult<Category[]>;
    }

    if (!isAuthenticated) {
      setCategories([]);
      setError(null);
      setIsLoading(false);
      return { ok: true, data: [], error: null } satisfies CategoryServiceResult<Category[]>;
    }

    setIsLoading(true);
    setError(null);

    const result = await fetchCategories();
    setIsLoading(false);

    if (!result.ok) {
      setCategories([]);
      setError(result.error);
      return result;
    }

    setCategories(result.data);
    return result;
  }, [authIsLoading, isAuthenticated]);

  const loadCategoriesByType = useCallback(
    async (type: SupabaseCategoryType) => {
      setIsLoading(true);
      setError(null);

      const result = await fetchCategoriesByType(type);
      setIsLoading(false);

      if (!result.ok) {
        setError(result.error);
        return result;
      }

      return result;
    },
    [],
  );

  const addCategory = useCallback(async (input: CreateCategoryInput) => {
    setIsLoading(true);
    setError(null);

    const result = await createCategory(input);
    setIsLoading(false);

    if (!result.ok) {
      setError(result.error);
      return result;
    }

    setCategories((current) => [...current, result.data]);
    return result;
  }, []);

  const editCategory = useCallback(
    async (id: string, updates: UpdateCategoryInput) => {
      setIsLoading(true);
      setError(null);

      const result = await updateCategory(id, updates);
      setIsLoading(false);

      if (!result.ok) {
        setError(result.error);
        return result;
      }

      setCategories((current) =>
        current.map((category) =>
          category.id === result.data.id ? result.data : category,
        ),
      );
      return result;
    },
    [],
  );

  const archiveExistingCategory = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    const result = await archiveCategory(id);
    setIsLoading(false);

    if (!result.ok) {
      setError(result.error);
      return result;
    }

    setCategories((current) =>
      current.map((category) =>
        category.id === result.data.id ? result.data : category,
      ),
    );
    return result;
  }, []);

  const removeCategory = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    const result = await deleteCategory(id);
    setIsLoading(false);

    if (!result.ok) {
      setError(result.error);
      return result;
    }

    setCategories((current) => current.filter((category) => category.id !== id));
    return result;
  }, []);

  useEffect(() => {
    void refreshCategories();
  }, [refreshCategories, user?.id]);

  return {
    categories,
    isLoading: authIsLoading || isLoading,
    error,
    refreshCategories,
    loadCategoriesByType,
    createCategory: addCategory,
    updateCategory: editCategory,
    archiveCategory: archiveExistingCategory,
    deleteCategory: removeCategory,
  };
}
