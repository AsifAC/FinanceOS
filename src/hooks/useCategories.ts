import { useCallback, useEffect, useRef, useState } from "react";
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

type CategoryState = {
  owner: string | null;
  categories: Category[];
  error: CategoryServiceError | null;
  loadError: CategoryServiceError | null;
  pending: number;
};

const unauthenticatedError: CategoryServiceError = {
  code: "not_authenticated",
  message: "Sign in before loading or updating categories.",
};

export function useCategories() {
  const { isAuthenticated, isLoading: authIsLoading, user } = useAuth();
  const owner = !authIsLoading && isAuthenticated ? user?.id ?? null : null;
  const [state, setState] = useState<CategoryState>({ owner: null, categories: [], error: null, loadError: null, pending: 0 });
  const scope = useRef<{ owner: string | null; generation: number }>({ owner: null, generation: 0 });
  const latestRefresh = useRef(0);

  const runForOwner = useCallback(async <T,>(
    operation: () => Promise<CategoryServiceResult<T>>,
    onSuccess?: (categories: Category[], data: T) => Category[],
    isLatest?: () => boolean,
    isRead = false,
  ): Promise<CategoryServiceResult<T>> => {
    if (!owner || scope.current.owner !== owner) {
      return { ok: false, data: null, error: unauthenticatedError };
    }
    const generation = scope.current.generation;
    setState((current) => current.owner === owner
      ? { ...current, pending: current.pending + 1, error: null }
      : current);
    let result: CategoryServiceResult<T>;
    try {
      result = await operation();
    } catch {
      result = { ok: false, data: null, error: { code: "request_failed", message: "Category request failed." } };
    }
    if (scope.current.owner === owner && scope.current.generation === generation) {
      setState((current) => {
        if (current.owner !== owner) return current;
        const latest = !isLatest || isLatest();
        return {
          ...current,
          categories: latest && result.ok && onSuccess ? onSuccess(current.categories, result.data) : current.categories,
          pending: Math.max(0, current.pending - 1),
          error: latest ? result.error : current.error,
          loadError: latest && isRead ? result.error : current.loadError,
        };
      });
    }
    return scope.current.owner === owner && scope.current.generation === generation ? result : {
      ok: false, data: null, error: { code: "account_changed", message: "The active account changed during the category request." },
    };
  }, [owner]);

  const refreshCategories = useCallback(() => {
    if (authIsLoading || !owner) {
      return Promise.resolve({ ok: true, data: [], error: null } satisfies CategoryServiceResult<Category[]>);
    }
    const request = ++latestRefresh.current;
    return runForOwner(fetchCategories, (_current, categories) => categories, () => request === latestRefresh.current, true);
  }, [authIsLoading, owner, runForOwner]);

  const loadCategoriesByType = useCallback((type: SupabaseCategoryType) =>
    runForOwner(() => fetchCategoriesByType(type)), [runForOwner]);

  const addCategory = useCallback((input: CreateCategoryInput) =>
    runForOwner(() => createCategory(input, owner ?? undefined), (current, category) => [...current, category]), [owner, runForOwner]);

  const editCategory = useCallback((id: string, updates: UpdateCategoryInput) =>
    runForOwner(() => updateCategory(id, updates, owner ?? undefined), (current, category) =>
      current.map((item) => item.id === category.id ? category : item)), [owner, runForOwner]);

  const archiveExistingCategory = useCallback((id: string) =>
    runForOwner(() => archiveCategory(id, owner ?? undefined), (current, category) =>
      current.map((item) => item.id === category.id ? category : item)), [owner, runForOwner]);

  const removeCategory = useCallback((id: string) =>
    runForOwner(() => deleteCategory(id, owner ?? undefined), (current) => current.filter((item) => item.id !== id)), [owner, runForOwner]);

  useEffect(() => {
    scope.current = { owner, generation: scope.current.generation + 1 };
    setState({ owner, categories: [], error: null, loadError: null, pending: 0 });
    if (owner) void refreshCategories();
    return () => {
      scope.current = { owner: null, generation: scope.current.generation + 1 };
      latestRefresh.current += 1;
    };
  }, [owner, refreshCategories]);

  // Account-scoped rows disappear during render, before effect cleanup/reset.
  const visible = owner !== null && state.owner === owner;
  return {
    categories: visible ? state.categories : [],
    isLoading: authIsLoading || (owner !== null && (!visible || state.pending > 0)),
    error: visible ? state.error : null,
    loadError: visible ? state.loadError : null,
    refreshCategories,
    loadCategoriesByType,
    createCategory: addCategory,
    updateCategory: editCategory,
    archiveCategory: archiveExistingCategory,
    deleteCategory: removeCategory,
  };
}
