import { InsertRow, PaymentMethod, UpdateRow } from "./dbTypes";
import { createOwnRow, deleteOwnRow, listOwnRows, updateOwnRow } from "./serviceUtils";

export const listPaymentMethods = () => listOwnRows<PaymentMethod>("payment_methods", {}, "name");
export const createPaymentMethod = (values: InsertRow<PaymentMethod>) => createOwnRow<PaymentMethod>("payment_methods", values);
export const updatePaymentMethod = (id: string, values: UpdateRow<PaymentMethod>) =>
  updateOwnRow<PaymentMethod>("payment_methods", id, values);
export const deletePaymentMethod = (id: string) => deleteOwnRow("payment_methods", id);
