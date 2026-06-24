import { useSyncExternalStore } from "react";

export type NotificationType = "success" | "error" | "warning" | "info";

export type FinanceNotification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  actionLink?: string;
  source?: string;
};

type NotificationInput = {
  title: string;
  message?: string;
  type?: NotificationType;
  actionLink?: string;
  source?: string;
  read?: boolean;
};

const STORAGE_KEY = "financeos:notifications:v1";
const MAX_HISTORY = 100;
const DEDUPE_WINDOW_MS = 1500;

let notifications = loadInitialNotifications();
let sonnerPatched = false;
const listeners = new Set<() => void>();

const defaultTitles: Record<NotificationType, string> = {
  success: "Success",
  error: "Error",
  warning: "Warning",
  info: "Info",
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeNotification(value: unknown): FinanceNotification | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<FinanceNotification>;
  if (!item.id || !item.title || !item.createdAt) return null;
  const type = item.type && ["success", "error", "warning", "info"].includes(item.type) ? item.type : "info";
  return {
    id: String(item.id),
    title: String(item.title),
    message: typeof item.message === "string" ? item.message : "",
    type,
    createdAt: String(item.createdAt),
    read: Boolean(item.read),
    actionLink: typeof item.actionLink === "string" ? item.actionLink : undefined,
    source: typeof item.source === "string" ? item.source : undefined,
  };
}

function loadInitialNotifications(): FinanceNotification[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeNotification).filter(Boolean).slice(0, MAX_HISTORY) as FinanceNotification[];
  } catch {
    return [];
  }
}

function persistNotifications() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_HISTORY)));
  } catch {
    // Storage can fail in private browsing or quota-constrained sessions.
  }
}

function emitChange() {
  persistNotifications();
  listeners.forEach((listener) => listener());
}

function getSnapshot() {
  return notifications;
}

function getServerSnapshot() {
  return [];
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isDuplicate(input: Required<Pick<NotificationInput, "title" | "message" | "source">> & { type: NotificationType }) {
  const newest = notifications[0];
  if (!newest) return false;
  const newestTime = new Date(newest.createdAt).getTime();
  return (
    Date.now() - newestTime < DEDUPE_WINDOW_MS &&
    newest.title === input.title &&
    newest.message === input.message &&
    newest.type === input.type &&
    newest.source === input.source
  );
}

export function addNotification(input: NotificationInput) {
  const title = input.title.trim();
  if (!title) return null;
  const type = input.type ?? "info";
  const message = input.message?.trim() ?? "";
  const source = input.source ?? "app";

  if (isDuplicate({ title, message, type, source })) return notifications[0]?.id ?? null;

  const notification: FinanceNotification = {
    id: createId(),
    title,
    message,
    type,
    createdAt: new Date().toISOString(),
    read: input.read ?? false,
    actionLink: input.actionLink,
    source,
  };
  notifications = [notification, ...notifications].slice(0, MAX_HISTORY);
  emitChange();
  return notification.id;
}

export function markNotificationRead(id: string) {
  notifications = notifications.map((notification) =>
    notification.id === id ? { ...notification, read: true } : notification,
  );
  emitChange();
}

export function markAllNotificationsRead() {
  notifications = notifications.map((notification) => ({ ...notification, read: true }));
  emitChange();
}

export function deleteNotification(id: string) {
  notifications = notifications.filter((notification) => notification.id !== id);
  emitChange();
}

export function clearNotifications() {
  notifications = [];
  emitChange();
}

export function getUnreadCount() {
  return notifications.filter((notification) => !notification.read).length;
}

export function useNotifications() {
  const history = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    notifications: history,
    unreadCount: history.filter((notification) => !notification.read).length,
  };
}

function readText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function readDescription(options: unknown) {
  if (!options || typeof options !== "object") return "";
  const description = (options as { description?: unknown }).description;
  return readText(description);
}

function recordToast(type: NotificationType, args: unknown[]) {
  const title = readText(args[0]) || defaultTitles[type];
  const message = readDescription(args[1]);
  addNotification({
    title,
    message,
    type,
    source: "toast",
  });
}

export function patchSonnerToast(toastApi: unknown) {
  if (sonnerPatched || !toastApi || typeof toastApi !== "object") return;
  const api = toastApi as Record<string, unknown>;

  (["success", "error", "warning", "info"] as NotificationType[]).forEach((method) => {
    const original = api[method];
    if (typeof original !== "function") return;
    api[method] = (...args: unknown[]) => {
      recordToast(method, args);
      return original(...args);
    };
  });

  const originalMessage = api.message;
  if (typeof originalMessage === "function") {
    api.message = (...args: unknown[]) => {
      recordToast("info", args);
      return originalMessage(...args);
    };
  }

  sonnerPatched = true;
}
