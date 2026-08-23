import { useCallback } from "react";
import {
  createExpectedTransaction,
  deleteExpectedTransaction,
  listExpectedTransactions,
  updateExpectedTransaction,
} from "../services/expectedTransactionService";
import { ListFilters } from "../services/serviceUtils";
import { useServiceQuery } from "./useServiceQuery";

export function useExpectedTransactions(filters: ListFilters = {}) {
  const loader = useCallback(() => listExpectedTransactions(filters), [filters.year, filters.month, filters.type]);
  return { ...useServiceQuery(loader), createExpectedTransaction, updateExpectedTransaction, deleteExpectedTransaction };
}
