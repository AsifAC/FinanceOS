import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import * as service from "../services/expectedTransactionService";
import type { ExpectedTransaction } from "../types/supabase";

type State = {
  owner: string | null;
  rows: ExpectedTransaction[];
  error: service.ExpectedTransactionServiceError | null;
  pending: number;
  mutationPending: number;
};

const accountChanged = (message = "The active account changed before the event could be saved.") => ({
  ok: false as const, data: null, error: { code: "account_changed", message },
});

export function useExpectedTransactions() {
  const { user, isAuthenticated, isLoading: authIsLoading } = useAuth();
  const owner = !authIsLoading && isAuthenticated ? user?.id ?? null : null;
  const [state, setState] = useState<State>({ owner: null, rows: [], error: null, pending: 0, mutationPending: 0 });
  const scope = useRef<{ owner: string | null; generation: number }>({ owner: null, generation: 0 });
  const latestRefresh = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latestRefresh.current;
    if (!owner || scope.current.owner !== owner) return;
    const generation = scope.current.generation;
    setState((current) => current.owner === owner
      ? { ...current, pending: current.pending + 1, error: null }
      : current);
    let result: service.ExpectedTransactionServiceResult<ExpectedTransaction[]>;
    try {
      result = await service.fetchExpectedTransactions();
    } catch {
      result = { ok: false, data: null, error: { code: "request_failed", message: "Expected transactions could not be loaded. Please try again." } };
    }
    if (scope.current.owner === owner && scope.current.generation === generation) {
      setState((current) => {
        if (current.owner !== owner) return current;
        const latest = request === latestRefresh.current;
        return {
          ...current,
          rows: latest && result.ok ? result.data : current.rows,
          error: latest ? result.error : current.error,
          pending: Math.max(0, current.pending - 1),
        };
      });
    }
  }, [owner]);

  const mutate = useCallback(async <T,>(
    operation: (ownerId: string) => Promise<service.ExpectedTransactionServiceResult<T>>,
    apply: (rows: ExpectedTransaction[], data: T) => ExpectedTransaction[],
  ): Promise<service.ExpectedTransactionServiceResult<T>> => {
    if (!owner || scope.current.owner !== owner) return accountChanged("Sign in before changing expected transactions.");
    const generation = scope.current.generation;
    setState((current) => current.owner === owner ? { ...current, mutationPending: current.mutationPending + 1, error: null } : current);
    let result: service.ExpectedTransactionServiceResult<T>;
    try {
      result = await operation(owner);
    } catch {
      result = { ok: false, data: null, error: { code: "request_failed", message: "Expected transaction changes could not be completed. Please try again." } };
    }
    if (scope.current.owner !== owner || scope.current.generation !== generation) {
      return accountChanged();
    }
    setState((current) => {
      if (current.owner !== owner) return current;
      return {
        ...current,
        rows: result.ok ? apply(current.rows, result.data) : current.rows,
        mutationPending: Math.max(0, current.mutationPending - 1),
      };
    });
    return result;
  }, [owner]);

  const createExpectedTransaction = useCallback((input: service.ExpectedTransactionCreateInput) =>
    mutate((ownerId) => service.createExpectedTransaction(input, ownerId), (rows, row) => [row, ...rows]), [mutate]);
  const updateExpectedTransaction = useCallback((id: string, input: service.ExpectedTransactionUpdateInput) =>
    mutate((ownerId) => service.updateExpectedTransaction(id, input, ownerId),
      (rows, row) => rows.map((item) => item.id === row.id ? row : item)), [mutate]);
  const cancelExpectedTransaction = useCallback((id: string) =>
    mutate((ownerId) => service.cancelExpectedTransaction(id, ownerId),
      (rows, row) => rows.map((item) => item.id === row.id ? row : item)), [mutate]);
  const reopenExpectedTransaction = useCallback((id: string) =>
    mutate((ownerId) => service.reopenExpectedTransaction(id, ownerId),
      (rows, row) => rows.map((item) => item.id === row.id ? row : item)), [mutate]);
  const deleteExpectedTransaction = useCallback((id: string) =>
    mutate((ownerId) => service.deleteExpectedTransaction(id, ownerId),
      (rows) => rows.filter((row) => row.id !== id)), [mutate]);
  const completeExpectedTransaction = useCallback((id: string, input: service.ExpectedTransactionCompletionInput) =>
    mutate((ownerId) => service.completeExpectedTransaction(id, input, ownerId),
      (rows, result) => rows.map((row) => row.id === result.expected_transaction.id ? result.expected_transaction : row)), [mutate]);

  useEffect(() => {
    scope.current = { owner, generation: scope.current.generation + 1 };
    setState({ owner, rows: [], error: null, pending: 0, mutationPending: 0 });
    if (owner) void refresh();
    return () => {
      scope.current = { owner: null, generation: scope.current.generation + 1 };
      latestRefresh.current += 1;
    };
  }, [owner, refresh]);

  const visible = owner !== null && state.owner === owner;
  return {
    expectedTransactions: visible ? state.rows : [],
    isLoading: authIsLoading || (owner !== null && (!visible || state.pending > 0)),
    error: visible ? state.error : null,
    refresh, createExpectedTransaction, updateExpectedTransaction,
    cancelExpectedTransaction, reopenExpectedTransaction, deleteExpectedTransaction,
    completeExpectedTransaction,
    isMutating: visible && state.mutationPending > 0,
  };
}
