import { BudgetSnapshot, InsertRow } from "./dbTypes";
import { createOwnRow, deleteOwnRow, ListFilters, listOwnRows } from "./serviceUtils";

export const listBudgetSnapshots = (filters: ListFilters = {}) =>
  listOwnRows<BudgetSnapshot>("budget_snapshots", filters, "created_at");
export const createBudgetSnapshot = (values: InsertRow<BudgetSnapshot>) =>
  createOwnRow<BudgetSnapshot>("budget_snapshots", values);
export const deleteBudgetSnapshot = (id: string) => deleteOwnRow("budget_snapshots", id);
