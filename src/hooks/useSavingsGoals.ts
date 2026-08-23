import { useCallback } from "react";
import {
  createSavingsContribution,
  createSavingsGoal,
  deleteSavingsContribution,
  deleteSavingsGoal,
  listSavingsContributions,
  listSavingsGoals,
  updateSavingsGoal,
} from "../services/savingsService";
import { ListFilters } from "../services/serviceUtils";
import { useServiceQuery } from "./useServiceQuery";

export function useSavingsGoals(filters: ListFilters = {}) {
  const goalsLoader = useCallback(() => listSavingsGoals(), []);
  const contributionsLoader = useCallback(() => listSavingsContributions(filters), [filters.year, filters.month]);
  return {
    goals: useServiceQuery(goalsLoader),
    contributions: useServiceQuery(contributionsLoader),
    createSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    createSavingsContribution,
    deleteSavingsContribution,
  };
}
