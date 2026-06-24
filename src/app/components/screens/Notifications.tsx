import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Info,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  FinanceNotification,
  NotificationType,
  clearNotifications,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
} from "../../lib/notifications";
import { cn } from "../ui/utils";

type FilterKey = "all" | "unread" | NotificationType;

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "success", label: "Success" },
  { key: "warning", label: "Warning" },
  { key: "error", label: "Error" },
  { key: "info", label: "Info" },
];

const typeStyles: Record<
  NotificationType,
  {
    accent: string;
    soft: string;
    label: string;
    icon: typeof CheckCircle2;
  }
> = {
  success: {
    accent: "#00D68F",
    soft: "rgba(0, 214, 143, 0.14)",
    label: "Success",
    icon: CheckCircle2,
  },
  error: {
    accent: "#EF4444",
    soft: "rgba(239, 68, 68, 0.14)",
    label: "Error",
    icon: XCircle,
  },
  warning: {
    accent: "#F59E0B",
    soft: "rgba(245, 158, 11, 0.16)",
    label: "Warning",
    icon: AlertTriangle,
  },
  info: {
    accent: "#8B5CF6",
    soft: "rgba(139, 92, 246, 0.16)",
    label: "Info",
    icon: Info,
  },
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function filterNotifications(notifications: FinanceNotification[], filter: FilterKey) {
  if (filter === "all") return notifications;
  if (filter === "unread") return notifications.filter((notification) => !notification.read);
  return notifications.filter((notification) => notification.type === filter);
}

function NotificationCard({ notification }: { notification: FinanceNotification }) {
  const styles = typeStyles[notification.type];
  const Icon = styles.icon;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[22px] border bg-[var(--financeos-surface)] p-4 shadow-[var(--financeos-shadow-card)] transition-colors sm:p-5",
        notification.read
          ? "border-[var(--financeos-border)]"
          : "border-[#8B5CF6]/45 bg-[linear-gradient(135deg,var(--financeos-surface)_0%,var(--financeos-surface-elevated)_100%)]",
      )}
    >
      {!notification.read && (
        <span className="absolute left-0 top-5 h-10 w-1 rounded-r-full bg-gradient-to-b from-[#8B5CF6] to-[#6366F1]" />
      )}
      <div className="flex gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-[var(--financeos-border)]"
          style={{ backgroundColor: styles.soft, color: styles.accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-[var(--financeos-text-primary)] sm:text-base">
                  {notification.title}
                </h2>
                {!notification.read && (
                  <span className="rounded-full bg-[#8B5CF6]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8B5CF6]">
                    Unread
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--financeos-text-muted)]">
                <span>{styles.label}</span>
                {notification.source && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-[var(--financeos-border-strong)]" />
                    <span className="capitalize">{notification.source}</span>
                  </>
                )}
                <span className="h-1 w-1 rounded-full bg-[var(--financeos-border-strong)]" />
                <time dateTime={notification.createdAt}>{formatTimestamp(notification.createdAt)}</time>
              </div>
            </div>
            <button
              type="button"
              onClick={() => deleteNotification(notification.id)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--financeos-border)] bg-[var(--financeos-icon-container)] text-[var(--financeos-text-muted)] transition-colors hover:bg-[var(--financeos-icon-container-hover)] hover:text-[#EF4444]"
              aria-label={`Delete notification: ${notification.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {notification.message && (
            <p className="mt-3 text-sm leading-6 text-[var(--financeos-text-secondary)]">{notification.message}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!notification.read && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => markNotificationRead(notification.id)}
                className="rounded-full"
              >
                <CheckCheck className="h-4 w-4" />
                Mark read
              </Button>
            )}
            {notification.actionLink && (
              <Button asChild size="sm" variant="ghost" className="rounded-full">
                <Link to={notification.actionLink}>
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function Notifications() {
  const { notifications, unreadCount } = useNotifications();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const filteredNotifications = useMemo(
    () => filterNotifications(notifications, activeFilter),
    [activeFilter, notifications],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-1 py-4 sm:px-2 lg:px-0">
      <header className="flex flex-col gap-4 rounded-[28px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-5 shadow-[var(--financeos-shadow-card)] sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B5CF6]">Notification History</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-[var(--financeos-text-primary)] sm:text-4xl">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-[var(--financeos-text-secondary)]">Recent app activity and alerts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={markAllNotificationsRead}
            disabled={!unreadCount}
            className="rounded-full"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={clearNotifications}
            disabled={!notifications.length}
            className="rounded-full text-[var(--financeos-text-secondary)]"
          >
            <Trash2 className="h-4 w-4" />
            Clear all
          </Button>
        </div>
      </header>

      <section className="rounded-[24px] border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-2 shadow-[var(--financeos-shadow-card)]">
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const active = activeFilter === filter.key;
            return (
              <button
                type="button"
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={cn(
                  "min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors",
                  active
                    ? "border-[#8B5CF6]/60 bg-[#8B5CF6]/15 text-[var(--financeos-text-primary)]"
                    : "border-[var(--financeos-border)] bg-[var(--financeos-surface)] text-[var(--financeos-text-muted)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]",
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))
        ) : (
          <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-8 text-center shadow-[var(--financeos-shadow-card)]">
            <span className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-[var(--financeos-border)] bg-[var(--financeos-icon-container)] text-[#8B5CF6]">
              <Bell className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-[var(--financeos-text-primary)]">No notifications</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--financeos-text-muted)]">
              New app alerts, save confirmations, and activity updates will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
