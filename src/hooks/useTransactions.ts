import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import * as service from "../services/transactionService";
import type { Transaction } from "../types/supabase";

/** Isolated real-data hook. Future Preview Mode callers must pass enabled: false. */
export function useTransactions({ enabled = true }: { enabled?: boolean } = {}) {
  const { user, isAuthenticated, isLoading: authIsLoading } = useAuth();
  const owner = enabled && isAuthenticated && !authIsLoading ? user?.id ?? null : null;
  const [state, setState] = useState<{
    owner: string | null;
    transactions: Transaction[];
    error: service.TransactionServiceError | null;
    pending: number;
  }>({ owner: null, transactions: [], error: null, pending: 0 });
  const scope = useRef<{ owner: string | null; generation: number }>({ owner: null, generation: 0 });
  const latestRefresh = useRef(0);

  const run = useCallback(async <T,>(
    operation: () => Promise<service.TransactionServiceResult<T>>,
    onSuccess?: (data: T) => void,
  ): Promise<service.TransactionServiceResult<T>> => {
    const generation = scope.current.generation;
    if (!owner || scope.current.owner !== owner) {
      return { ok: false, data: null, error: {
        code: "not_authenticated", message: "Enable real transactions and sign in before continuing.",
      } };
    }
    setState((current) => ({ ...current, pending: current.pending + 1, error: null }));
    const result = await operation();
    if (scope.current.generation === generation && scope.current.owner === owner) {
      setState((current) => ({ ...current, pending: Math.max(0, current.pending - 1), error: result.error }));
      if (result.ok) onSuccess?.(result.data);
    }
    return result;
  }, [owner]);

  const refresh = useCallback(() => {
    const request = ++latestRefresh.current;
    return run(service.fetchTransactions, (transactions) => {
      if (request === latestRefresh.current) {
        setState((current) => ({ ...current, transactions }));
      }
    });
  }, [run]);

  useEffect(() => {
    scope.current = { owner, generation: scope.current.generation + 1 };
    setState({ owner, transactions: [], error: null, pending: 0 });
    if (owner) void refresh();
    return () => {
      scope.current = { owner: null, generation: scope.current.generation + 1 };
      latestRefresh.current += 1;
    };
  }, [owner, refresh]);

  const createTransaction = useCallback((input: service.CreateTransactionInput) =>
    run(() => service.createTransaction(input), () => { void refresh(); }), [run, refresh]);
  const updateTransaction = useCallback((id: string, input: service.UpdateTransactionInput) =>
    run(() => service.updateTransaction(id, input), () => { void refresh(); }), [run, refresh]);
  const deleteTransaction = useCallback((id: string) =>
    run(() => service.deleteTransaction(id), () => { void refresh(); }), [run, refresh]);

  // Hide previous-account data immediately, even before effect cleanup runs.
  const visible = owner !== null && state.owner === owner;
  return {
    transactions: visible ? state.transactions : [],
    isLoading: enabled && (authIsLoading || (owner !== null && (!visible || state.pending > 0))),
    error: visible ? state.error : null,
    refresh, createTransaction, updateTransaction, deleteTransaction,
  };
}
