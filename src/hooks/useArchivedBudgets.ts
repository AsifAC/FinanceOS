import { useCallback } from "react";
import { createArchivedBudget, deleteArchivedBudget, listArchivedBudgets, updateArchivedBudget } from "../services/archiveService";
import { useServiceQuery } from "./useServiceQuery";

export function useArchivedBudgets(year?: number) {
  const loader = useCallback(() => listArchivedBudgets({ year }), [year]);
  return { ...useServiceQuery(loader), createArchivedBudget, updateArchivedBudget, deleteArchivedBudget };
}
