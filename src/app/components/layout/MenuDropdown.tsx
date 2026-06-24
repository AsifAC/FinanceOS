import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import {
  Bell,
  CircleHelp,
  CreditCard,
  Archive,
  LayoutDashboard,
  LineChart,
  Menu,
  Settings,
  Tag,
  PiggyBank,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Income", path: "/income", icon: TrendingUp },
  { label: "Expenses", path: "/expenses", icon: CreditCard },
  { label: "Categories", path: "/categories", icon: Tag },
  { label: "Savings", path: "/tracker", icon: PiggyBank },
  { label: "Debt", path: "/payment-plans", icon: TrendingDown },
  { label: "Reports", path: "/reports", icon: LineChart },
  { label: "Archived Budgets", path: "/saved-budgets", icon: Archive },
  { label: "Notifications", path: "/notifications", icon: Bell },
  { label: "Help Center", path: "/help", icon: CircleHelp },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function MenuDropdown() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
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

  return (
    <div className="relative" ref={menuRef}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-0 text-[var(--financeos-text-secondary)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open navigation menu"
      >
        <Menu className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[22px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] shadow-[var(--financeos-shadow-card-hover)] backdrop-blur-xl"
        >
          <div className="grid gap-1 p-2">
            {navItems.map(({ label, path, icon: Icon }, index) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-[#8B5CF6]/15 text-[var(--financeos-text-primary)]"
                      : "text-[var(--financeos-text-muted)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]",
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
                {index === 0 && <span className="ml-auto rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] px-2 py-0.5 text-[10px] font-semibold text-white">Home</span>}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
