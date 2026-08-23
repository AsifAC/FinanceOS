import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import {
  formatDateInTimezone,
  formatTimeInTimezone,
  getTimezoneAbbreviation,
  getTimezoneOffsetLabel,
} from "../../lib/datePreferences";
import { cn } from "../ui/utils";

export function DateTimeDisplay({
  timezone,
  compact = false,
  className,
}: {
  timezone: string;
  compact?: boolean;
  className?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const date = formatDateInTimezone(now, timezone, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = formatTimeInTimezone(now, timezone);
  const abbreviation = getTimezoneAbbreviation(timezone, now);
  const offset = getTimezoneOffsetLabel(timezone, now);

  return (
    <div className={cn(
      compact
        ? "inline-flex h-11 min-w-0 items-center gap-3 rounded-[20px] border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] px-3 py-0 leading-none shadow-[var(--financeos-shadow-card)]"
        : "inline-flex min-h-12 min-w-0 items-center gap-3 rounded-[20px] border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] px-3 py-2 shadow-[var(--financeos-shadow-card)]",
      className,
    )}>
      <span className="financeos-settings-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[#8B5CF6]">
        <Clock3 className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[var(--financeos-text-primary)]">
          {compact ? `${date} | ${time} ${abbreviation}` : `${date} | ${time} ${abbreviation}`}
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-none text-[var(--financeos-text-muted)]">
          {timezone} · {offset}
        </span>
      </span>
    </div>
  );
}
