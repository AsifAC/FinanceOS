import { type CSSProperties, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { cn } from "../ui/utils";

type MonthSelectorProps = {
  selectedMonth: number;
  onMonthChange(month: number): void;
  months: string[];
  year?: number | string;
  onYearChange?(year: string): void;
  yearOptions?: string[];
  currentMonth?: number;
  label?: string;
  className?: string;
};

export function MonthSelector({
  selectedMonth,
  onMonthChange,
  months,
  year,
  onYearChange,
  yearOptions,
  currentMonth,
  label = "Select month",
  className,
}: MonthSelectorProps) {
  const [open, setOpen] = useState(false);
  const [focusedMonth, setFocusedMonth] = useState(selectedMonth);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedLabel = [months[selectedMonth], year].filter(Boolean).join(" ");
  const normalizedYear = year ? String(year) : "";
  const availableYears = yearOptions?.length
    ? yearOptions
    : normalizedYear
      ? [String(Number(normalizedYear) - 1), normalizedYear, String(Number(normalizedYear) + 1)]
      : [];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
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

  useEffect(() => {
    if (open) setFocusedMonth(selectedMonth);
  }, [open, selectedMonth]);

  useEffect(() => {
    if (!open) return;

    function updatePopoverPosition() {
      const trigger = rootRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const margin = 12;
      const gap = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const panelWidth = Math.min(336, viewportWidth - margin * 2);
      const left = Math.min(Math.max(rect.left, margin), viewportWidth - panelWidth - margin);
      const availableBelow = viewportHeight - rect.bottom - gap - margin;
      const availableAbove = rect.top - gap - margin;
      const preferredHeight = normalizedYear ? 300 : 240;
      const openBelow = availableBelow >= preferredHeight || availableBelow >= availableAbove;
      const availableHeight = openBelow ? availableBelow : availableAbove;
      const maxHeight = Math.max(140, Math.min(360, availableHeight));
      const rawTop = openBelow ? rect.bottom + gap : rect.top - gap - maxHeight;
      const top = Math.min(Math.max(rawTop, margin), viewportHeight - margin - maxHeight);

      setPopoverStyle({
        left,
        top,
        width: panelWidth,
        maxHeight,
      });
    }

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [normalizedYear, open]);

  function selectMonth(month: number) {
    onMonthChange(month);
    setOpen(false);
  }

  function handleKeyboardNavigation(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) selectMonth(focusedMonth);
      else setOpen(true);
      return;
    }

    const nextByKey: Record<string, number> = {
      ArrowDown: 3,
      ArrowUp: -3,
      ArrowRight: 1,
      ArrowLeft: -1,
    };
    const delta = nextByKey[event.key];
    if (delta) {
      event.preventDefault();
      setOpen(true);
      setFocusedMonth((month) => Math.min(months.length - 1, Math.max(0, month + delta)));
    }
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) selectMonth(focusedMonth);
      else setOpen(true);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!open) {
        event.preventDefault();
        setFocusedMonth(selectedMonth);
        setOpen(true);
        return;
      }
    }

    handleKeyboardNavigation(event);
  }

  return (
    <div ref={rootRef} className={cn("relative flex min-w-[11rem] items-center", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "group flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface)] px-3 py-0 text-left leading-none shadow-[var(--financeos-shadow-card)] backdrop-blur-xl transition-all",
          "hover:border-[var(--financeos-border-strong)] hover:bg-[var(--financeos-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/60",
          open && "border-[#8B5CF6]/60 bg-[var(--financeos-surface-hover)]",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="financeos-settings-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[#8B5CF6]">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--financeos-text-primary)]">{selectedLabel}</span>
            <span className="block text-[11px] text-[var(--financeos-text-muted)]">{label}</span>
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--financeos-text-muted)] transition-transform", open && "rotate-180 text-[var(--financeos-text-primary)]")} />
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={handleKeyboardNavigation}
          style={popoverStyle}
          className="financeos-month-selector-popover fixed z-[9999] overflow-y-auto overscroll-contain rounded-[22px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-2 shadow-[var(--financeos-shadow-card-hover)] backdrop-blur-xl"
        >
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {months.map((month, index) => {
              const selected = index === selectedMonth;
              const focused = index === focusedMonth;
              const current = index === currentMonth;

              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  key={month}
                  onMouseEnter={() => setFocusedMonth(index)}
                  onClick={() => selectMonth(index)}
                  className={cn(
                    "flex min-h-10 items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-sm transition-colors",
                    selected
                      ? "border-[#8B5CF6]/60 bg-[#8B5CF6]/18 text-[var(--financeos-text-primary)]"
                      : "border-transparent text-[var(--financeos-text-muted)] hover:border-[var(--financeos-border)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]",
                    focused && !selected && "border-[var(--financeos-border)] bg-[var(--financeos-surface-hover)] text-[var(--financeos-text-primary)]",
                  )}
                >
                  <span>{month.slice(0, 3)}</span>
                  {selected ? <Check className="h-3.5 w-3.5 text-[#8B5CF6]" /> : current ? <span className="h-1.5 w-1.5 rounded-full bg-[#8B5CF6]" /> : null}
                </button>
              );
            })}
          </div>
          {onYearChange && normalizedYear && (
            <div className="mt-2 border-t border-[var(--financeos-border)] pt-2">
              <label className="mb-1 block px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--financeos-text-muted)]">
                Budget year
              </label>
              <select
                aria-label="Budget year"
                className="h-10 w-full rounded-2xl border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)] px-3 text-sm font-semibold text-[var(--financeos-text-primary)] outline-none transition-colors focus:border-[#8B5CF6]/60"
                value={normalizedYear}
                onChange={(event) => onYearChange(event.target.value)}
              >
                {availableYears.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        , document.body
      )}
    </div>
  );
}
