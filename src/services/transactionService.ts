import { InsertRow, Transaction, UpdateRow } from "./dbTypes";
import { createOwnRow, deleteOwnRow, ListFilters, listOwnRows, updateOwnRow } from "./serviceUtils";

export const listTransactions = (filters: ListFilters = {}) => listOwnRows<Transaction>("transactions", filters, "transaction_date");
export const createTransaction = (values: InsertRow<Transaction>) => createOwnRow<Transaction>("transactions", values);
export const updateTransaction = (id: string, values: UpdateRow<Transaction>) =>
  updateOwnRow<Transaction>("transactions", id, values);
export const deleteTransaction = (id: string) => deleteOwnRow("transactions", id);
