import { InsertRow, SavingsContribution, SavingsGoal, UpdateRow } from "./dbTypes";
import { createOwnRow, deleteOwnRow, ListFilters, listOwnRows, updateOwnRow } from "./serviceUtils";

export const listSavingsGoals = () => listOwnRows<SavingsGoal>("savings_goals", {}, "created_at");
export const createSavingsGoal = (values: InsertRow<SavingsGoal>) => createOwnRow<SavingsGoal>("savings_goals", values);
export const updateSavingsGoal = (id: string, values: UpdateRow<SavingsGoal>) =>
  updateOwnRow<SavingsGoal>("savings_goals", id, values);
export const deleteSavingsGoal = (id: string) => deleteOwnRow("savings_goals", id);

export const listSavingsContributions = (filters: ListFilters = {}) =>
  listOwnRows<SavingsContribution>("savings_contributions", filters, "contribution_date");
export const createSavingsContribution = (values: InsertRow<SavingsContribution>) =>
  createOwnRow<SavingsContribution>("savings_contributions", values);
export const deleteSavingsContribution = (id: string) => deleteOwnRow("savings_contributions", id);
