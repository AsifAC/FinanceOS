import { useCallback } from "react";
import { createTransaction, deleteTransaction, listTransactions, updateTransaction } from "../services/transactionService";
import { ListFilters } from "../services/serviceUtils";
import { useServiceQuery } from "./useServiceQuery";

export function useTransactions(filters: ListFilters = {}) {
  const loader = useCallback(() => listTransactions(filters), [filters.year, filters.month, filters.type]);
  return { ...useServiceQuery(loader), createTransaction, updateTransaction, deleteTransaction };
}
