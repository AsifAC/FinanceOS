import { ExpectedTransaction, InsertRow, UpdateRow } from "./dbTypes";
import { createOwnRow, deleteOwnRow, ListFilters, listOwnRows, updateOwnRow } from "./serviceUtils";

export const listExpectedTransactions = (filters: ListFilters = {}) =>
  listOwnRows<ExpectedTransaction>("expected_transactions", filters, "expected_date");
export const createExpectedTransaction = (values: InsertRow<ExpectedTransaction>) =>
  createOwnRow<ExpectedTransaction>("expected_transactions", values);
export const updateExpectedTransaction = (id: string, values: UpdateRow<ExpectedTransaction>) =>
  updateOwnRow<ExpectedTransaction>("expected_transactions", id, values);
export const deleteExpectedTransaction = (id: string) => deleteOwnRow("expected_transactions", id);
