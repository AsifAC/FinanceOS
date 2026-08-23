import { ArchivedBudget, InsertRow, UpdateRow } from "./dbTypes";
import { createOwnRow, deleteOwnRow, ListFilters, listOwnRows, updateOwnRow } from "./serviceUtils";

export const listArchivedBudgets = (filters: Pick<ListFilters, "year"> = {}) =>
  listOwnRows<ArchivedBudget>("archived_budgets", filters, "archived_at");
export const createArchivedBudget = (values: InsertRow<ArchivedBudget>) => createOwnRow<ArchivedBudget>("archived_budgets", values);
export const updateArchivedBudget = (id: string, values: UpdateRow<ArchivedBudget>) =>
  updateOwnRow<ArchivedBudget>("archived_budgets", id, values);
export const deleteArchivedBudget = (id: string) => deleteOwnRow("archived_budgets", id);
