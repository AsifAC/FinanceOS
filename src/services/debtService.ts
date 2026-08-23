import { Debt, DebtPayment, InsertRow, UpdateRow } from "./dbTypes";
import { createOwnRow, deleteOwnRow, ListFilters, listOwnRows, updateOwnRow } from "./serviceUtils";

export const listDebts = () => listOwnRows<Debt>("debts", {}, "created_at");
export const createDebt = (values: InsertRow<Debt>) => createOwnRow<Debt>("debts", values);
export const updateDebt = (id: string, values: UpdateRow<Debt>) => updateOwnRow<Debt>("debts", id, values);
export const deleteDebt = (id: string) => deleteOwnRow("debts", id);

export const listDebtPayments = (filters: ListFilters = {}) => listOwnRows<DebtPayment>("debt_payments", filters, "payment_date");
export const createDebtPayment = (values: InsertRow<DebtPayment>) => createOwnRow<DebtPayment>("debt_payments", values);
export const deleteDebtPayment = (id: string) => deleteOwnRow("debt_payments", id);
