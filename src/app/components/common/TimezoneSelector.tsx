import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe2, Search } from "lucide-react";
import {
  FRIENDLY_TIMEZONE_LABELS,
  getBrowserTimezone,
  getTimezoneOffsetLabel,
  TIMEZONE_OPTIONS,
} from "../../lib/datePreferences";
import { cn } from "../ui/utils";

function timezoneLabel(timezone: string) {
  return FRIENDLY_TIMEZONE_LABELS[timezone] ? `${FRIENDLY_TIMEZONE_LABELS[timezone]} — ${timezone}` : timezone;
}

export function TimezoneSelector({
  value,
  onChange,
  label = "Timezone",
  className,
}: {
  value: string;
  onChange(timezone: string): void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const detectedTimezone = getBrowserTimezone();
  const options = useMemo(() => Array.from(new Set([value, detectedTimezone, ...TIMEZONE_OPTIONS])).filter(Boolean), [detectedTimezone, value]);
  const filtered = options.filter((timezone) =>
    `${timezoneLabel(timezone)} ${getTimezoneOffsetLabel(timezone)}`.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function selectTimezone(timezone: string) {
    onChange(timezone);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "financeos-timezone-trigger flex min-h-12 w-full items-center justify-between gap-3 rounded-[20px] border px-3 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/60",
          open && "border-[#8B5CF6]/60",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="financeos-settings-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl">
            <Globe2 className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--financeos-text-primary)]">{timezoneLabel(value)}</span>
            <span className="block text-xs text-[var(--financeos-text-muted)]">
              {value === detectedTimezone ? "Detected" : "Selected"} · {getTimezoneOffsetLabel(value)}
            </span>
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--financeos-text-muted)] transition-transform", open && "rotate-180 text-[var(--financeos-text-primary)]")} />
      </button>

      {open && (
        <div className="financeos-timezone-popover absolute right-0 z-50 mt-2 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-[24px] border p-2 backdrop-blur-xl">
          <div className="financeos-muted-panel mb-2 flex items-center gap-2 rounded-2xl border px-3 py-2">
            <Search className="h-4 w-4 text-[var(--financeos-text-subtle)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search timezone..."
              className="w-full bg-transparent text-sm text-[var(--financeos-text-primary)] outline-none placeholder:text-[var(--financeos-text-subtle)]"
            />
          </div>
          <div role="listbox" className="max-h-80 overflow-y-auto pr-1">
            {filtered.map((timezone) => {
              const selected = timezone === value;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  key={timezone}
                  onClick={() => selectTimezone(timezone)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                    selected ? "bg-[#8B5CF6]/18 text-[var(--financeos-text-primary)]" : "text-[var(--financeos-text-muted)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{timezoneLabel(timezone)}</span>
                    <span className="block text-xs text-[var(--financeos-text-subtle)]">
                      {timezone === detectedTimezone ? "Detected timezone" : "Timezone"} · {getTimezoneOffsetLabel(timezone)}
                    </span>
                  </span>
                  {selected && <Check className="h-4 w-4 text-[#8B5CF6]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
