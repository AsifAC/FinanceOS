import { useCallback } from "react";
import {
  createNotification,
  deleteNotification,
  listNotifications,
  markNotificationRead,
  updateNotification,
} from "../services/notificationService";
import { useServiceQuery } from "./useServiceQuery";

export function useNotifications() {
  const loader = useCallback(() => listNotifications(), []);
  return { ...useServiceQuery(loader), createNotification, updateNotification, markNotificationRead, deleteNotification };
}
