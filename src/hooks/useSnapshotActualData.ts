import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { useCategories } from "./useCategories";
import { useTransactions } from "./useTransactions";
import { getSupabaseSnapshotActuals } from "../app/lib/snapshotActuals";

export function useSnapshotActualData() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { transactions, isLoading: transactionsLoading, error, refresh } = useTransactions();
  const { categories, isLoading: categoriesLoading, loadError: categoriesError } = useCategories();
  const ownerId = !authLoading && isAuthenticated ? user?.id ?? null : null;
  const ownerRowsMatch = ownerId !== null && transactions.every((row) => row.user_id === ownerId)
    && categories.every((category) => category.user_id === ownerId);
  const isLoading = authLoading || transactionsLoading || categoriesLoading;
  const isReady = !isLoading && !error && ownerRowsMatch;
  const actualsForYear = useCallback((year: string | number) => ownerId
    ? getSupabaseSnapshotActuals(transactions, categories, year, ownerId)
    : null, [transactions, categories, ownerId]);

  return {
    transactions,
    categories,
    ownerId,
    transactionsLoading,
    categoriesLoading,
    isLoading,
    isReady,
    error,
    categoriesError,
    refresh,
    actualsForYear,
  };
}
