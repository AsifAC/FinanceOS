import { useCallback } from "react";
import { createBudgetSnapshot, deleteBudgetSnapshot, listBudgetSnapshots } from "../services/snapshotService";
import { ListFilters } from "../services/serviceUtils";
import { useServiceQuery } from "./useServiceQuery";

export function useBudgetSnapshots(filters: ListFilters = {}) {
  const loader = useCallback(() => listBudgetSnapshots(filters), [filters.year, filters.month]);
  return { ...useServiceQuery(loader), createBudgetSnapshot, deleteBudgetSnapshot };
}
