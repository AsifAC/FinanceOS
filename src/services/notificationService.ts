import { InsertRow, Notification, UpdateRow } from "./dbTypes";
import { createOwnRow, deleteOwnRow, listOwnRows, updateOwnRow } from "./serviceUtils";

export const listNotifications = () => listOwnRows<Notification>("notifications", {}, "created_at");
export const createNotification = (values: InsertRow<Notification>) => createOwnRow<Notification>("notifications", values);
export const updateNotification = (id: string, values: UpdateRow<Notification>) =>
  updateOwnRow<Notification>("notifications", id, values);
export const markNotificationRead = (id: string) => updateNotification(id, { is_read: true });
export const deleteNotification = (id: string) => deleteOwnRow("notifications", id);
