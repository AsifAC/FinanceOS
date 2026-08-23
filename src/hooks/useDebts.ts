import { useCallback } from "react";
import {
  createDebt,
  createDebtPayment,
  deleteDebt,
  deleteDebtPayment,
  listDebtPayments,
  listDebts,
  updateDebt,
} from "../services/debtService";
import { ListFilters } from "../services/serviceUtils";
import { useServiceQuery } from "./useServiceQuery";

export function useDebts(filters: ListFilters = {}) {
  const debtsLoader = useCallback(() => listDebts(), []);
  const paymentsLoader = useCallback(() => listDebtPayments(filters), [filters.year, filters.month]);
  return {
    debts: useServiceQuery(debtsLoader),
    payments: useServiceQuery(paymentsLoader),
    createDebt,
    updateDebt,
    deleteDebt,
    createDebtPayment,
    deleteDebtPayment,
  };
}
