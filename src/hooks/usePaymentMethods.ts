import { useCallback, useEffect, useState } from "react";
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

export function usePaymentMethods() {
  const { isAuthenticated, isLoading: authIsLoading, user } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<PaymentMethodServiceError | null>(null);

  const refreshPaymentMethods = useCallback(async () => {
    if (authIsLoading) {
      return { ok: true, data: [], error: null } satisfies PaymentMethodServiceResult<
        PaymentMethod[]
      >;
    }

    if (!isAuthenticated) {
      setPaymentMethods([]);
      setError(null);
      setIsLoading(false);
      return { ok: true, data: [], error: null } satisfies PaymentMethodServiceResult<
        PaymentMethod[]
      >;
    }

    setIsLoading(true);
    setError(null);

    const result = await fetchPaymentMethods();
    setIsLoading(false);

    if (!result.ok) {
      setPaymentMethods([]);
      setError(result.error);
      return result;
    }

    setPaymentMethods(result.data);
    return result;
  }, [authIsLoading, isAuthenticated]);

  const addPaymentMethod = useCallback(
    async (input: CreatePaymentMethodInput) => {
      setIsLoading(true);
      setError(null);

      const result = await createPaymentMethod(input);
      setIsLoading(false);

      if (!result.ok) {
        setError(result.error);
        return result;
      }

      setPaymentMethods((current) => [...current, result.data]);
      return result;
    },
    [],
  );

  const editPaymentMethod = useCallback(
    async (id: string, updates: UpdatePaymentMethodInput) => {
      setIsLoading(true);
      setError(null);

      const result = await updatePaymentMethod(id, updates);
      setIsLoading(false);

      if (!result.ok) {
        setError(result.error);
        return result;
      }

      setPaymentMethods((current) =>
        current.map((paymentMethod) =>
          paymentMethod.id === result.data.id ? result.data : paymentMethod,
        ),
      );
      return result;
    },
    [],
  );

  const archiveExistingPaymentMethod = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    const result = await archivePaymentMethod(id);
    setIsLoading(false);

    if (!result.ok) {
      setError(result.error);
      return result;
    }

    setPaymentMethods((current) =>
      current.map((paymentMethod) =>
        paymentMethod.id === result.data.id ? result.data : paymentMethod,
      ),
    );
    return result;
  }, []);

  const removePaymentMethod = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    const result = await deletePaymentMethod(id);
    setIsLoading(false);

    if (!result.ok) {
      setError(result.error);
      return result;
    }

    setPaymentMethods((current) =>
      current.filter((paymentMethod) => paymentMethod.id !== id),
    );
    return result;
  }, []);

  const chooseDefaultPaymentMethod = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    const result = await setDefaultPaymentMethod(id);
    setIsLoading(false);

    if (!result.ok) {
      setError(result.error);
      return result;
    }

    setPaymentMethods((current) =>
      current.map((paymentMethod) =>
        paymentMethod.id === result.data.id
          ? result.data
          : { ...paymentMethod, is_default: false },
      ),
    );
    return result;
  }, []);

  useEffect(() => {
    void refreshPaymentMethods();
  }, [refreshPaymentMethods, user?.id]);

  return {
    paymentMethods,
    isLoading: authIsLoading || isLoading,
    error,
    refreshPaymentMethods,
    createPaymentMethod: addPaymentMethod,
    updatePaymentMethod: editPaymentMethod,
    archivePaymentMethod: archiveExistingPaymentMethod,
    deletePaymentMethod: removePaymentMethod,
    setDefaultPaymentMethod: chooseDefaultPaymentMethod,
  };
}
