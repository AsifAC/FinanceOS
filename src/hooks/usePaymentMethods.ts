import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import {
  archivePaymentMethod,
  createPaymentMethod,
  deletePaymentMethod,
  fetchPaymentMethods,
  setDefaultPaymentMethod,
  updatePaymentMethod,
  type CreatePaymentMethodInput,
  type PaymentMethodServiceError,
  type PaymentMethodServiceResult,
  type UpdatePaymentMethodInput,
} from "../services/paymentMethodService";
import type { PaymentMethod } from "../types/supabase";

type PaymentMethodState = {
  owner: string | null;
  paymentMethods: PaymentMethod[];
  error: PaymentMethodServiceError | null;
  pending: number;
};

const unauthenticatedError: PaymentMethodServiceError = {
  code: "not_authenticated",
  message: "Sign in before loading or updating payment methods.",
};

export function usePaymentMethods() {
  const { isAuthenticated, isLoading: authIsLoading, user } = useAuth();
  const owner = !authIsLoading && isAuthenticated ? user?.id ?? null : null;
  const [state, setState] = useState<PaymentMethodState>({ owner: null, paymentMethods: [], error: null, pending: 0 });
  const scope = useRef<{ owner: string | null; generation: number }>({ owner: null, generation: 0 });
  const latestRefresh = useRef(0);

  const runForOwner = useCallback(async <T,>(
    operation: () => Promise<PaymentMethodServiceResult<T>>,
    onSuccess?: (methods: PaymentMethod[], data: T) => PaymentMethod[],
    isLatest?: () => boolean,
  ): Promise<PaymentMethodServiceResult<T>> => {
    if (!owner || scope.current.owner !== owner) {
      return { ok: false, data: null, error: unauthenticatedError };
    }
    const generation = scope.current.generation;
    setState((current) => current.owner === owner
      ? { ...current, pending: current.pending + 1, error: null }
      : current);
    const result = await operation();
    if (scope.current.owner === owner && scope.current.generation === generation) {
      setState((current) => {
        if (current.owner !== owner) return current;
        const latest = !isLatest || isLatest();
        return {
          ...current,
          paymentMethods: latest && result.ok && onSuccess ? onSuccess(current.paymentMethods, result.data) : current.paymentMethods,
          pending: Math.max(0, current.pending - 1),
          error: latest ? result.error : current.error,
        };
      });
    }
    return scope.current.owner === owner && scope.current.generation === generation ? result : {
      ok: false, data: null, error: { code: "account_changed", message: "The active account changed during the payment method request." },
    };
  }, [owner]);

  const refreshPaymentMethods = useCallback(() => {
    if (authIsLoading || !owner) {
      return Promise.resolve({ ok: true, data: [], error: null } satisfies PaymentMethodServiceResult<PaymentMethod[]>);
    }
    const request = ++latestRefresh.current;
    return runForOwner(fetchPaymentMethods, (_current, methods) => methods, () => request === latestRefresh.current);
  }, [authIsLoading, owner, runForOwner]);

  const addPaymentMethod = useCallback((input: CreatePaymentMethodInput) =>
    runForOwner(() => createPaymentMethod(input, owner ?? undefined), (current, method) => [...current, method]), [owner, runForOwner]);

  const editPaymentMethod = useCallback((id: string, updates: UpdatePaymentMethodInput) =>
    runForOwner(() => updatePaymentMethod(id, updates, owner ?? undefined), (current, method) =>
      current.map((item) => item.id === method.id ? method : item)), [owner, runForOwner]);

  const archiveExistingPaymentMethod = useCallback((id: string) =>
    runForOwner(() => archivePaymentMethod(id, owner ?? undefined), (current, method) =>
      current.map((item) => item.id === method.id ? method : item)), [owner, runForOwner]);

  const setPaymentMethodArchived = useCallback((id: string, isArchived: boolean) =>
    runForOwner(() => isArchived ? archivePaymentMethod(id, owner ?? undefined) : updatePaymentMethod(id, { is_archived: false }, owner ?? undefined), (current, method) =>
      current.map((item) => item.id === method.id ? method : item)), [owner, runForOwner]);

  const removePaymentMethod = useCallback((id: string) =>
    runForOwner(() => deletePaymentMethod(id, owner ?? undefined), (current) => current.filter((item) => item.id !== id),
    ), [owner, runForOwner]);

  const chooseDefaultPaymentMethod = useCallback((id: string) =>
    runForOwner(() => setDefaultPaymentMethod(id, owner ?? undefined), (current, method) =>
      current.map((item) => item.id === method.id ? method : { ...item, is_default: false })), [owner, runForOwner]);

  useEffect(() => {
    scope.current = { owner, generation: scope.current.generation + 1 };
    setState({ owner, paymentMethods: [], error: null, pending: 0 });
    if (owner) void refreshPaymentMethods();
    return () => {
      scope.current = { owner: null, generation: scope.current.generation + 1 };
      latestRefresh.current += 1;
    };
  }, [owner, refreshPaymentMethods]);

  // Account-scoped rows disappear during render, before effect cleanup/reset.
  const visible = owner !== null && state.owner === owner;
  return {
    paymentMethods: visible ? state.paymentMethods : [],
    isLoading: authIsLoading || (owner !== null && (!visible || state.pending > 0)),
    error: visible ? state.error : null,
    refreshPaymentMethods,
    createPaymentMethod: addPaymentMethod,
    updatePaymentMethod: editPaymentMethod,
    archivePaymentMethod: archiveExistingPaymentMethod,
    setPaymentMethodArchived,
    deletePaymentMethod: removePaymentMethod,
    setDefaultPaymentMethod: chooseDefaultPaymentMethod,
  };
}
