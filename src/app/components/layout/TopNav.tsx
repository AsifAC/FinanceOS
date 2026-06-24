import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Bell, DollarSign, LogOut, Repeat2, Settings } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DateTimeDisplay } from "../common/DateTimeDisplay";
import { MonthSelector } from "../common/MonthSelector";
import { useFinanceData } from "../../lib/financeStore";
import { MONTHS, currentMonthIndex, currentYear } from "../../lib/constants";
import { useNotifications } from "../../lib/notifications";
import { clearFinanceOSSession, getSwitchAccountRoute } from "../../lib/session";
import { MenuDropdown } from "./MenuDropdown";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/setup": "Budget Setup",
  "/annual-planner": "Annual Planner",
  "/income": "Income",
  "/expenses": "Expenses",
  "/pending-transactions": "Pending",
  "/add-transaction": "Add Transaction",
  "/categories": "Categories",
  "/expected-amounts": "Expected Amounts",
  "/payment-plans": "Debt",
  "/tracker": "Savings",
  "/reports": "Reports",
  "/saved-budgets": "Archives",
  "/notifications": "Notifications",
  "/help": "Help Center",
  "/settings": "Settings",
};

function getInitials(label: string) {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "FO";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeYear,
    selectedMonth,
    timezone,
    previewModeEnabled,
    setActiveYear,
    setSelectedMonth,
    state,
  } = useFinanceData();
  const { unreadCount } = useNotifications();
  const pageTitle = pageTitles[location.pathname] ?? "FinanceOS";
  const profileName = state.setupProfile?.budgetName || "FinanceOS User";
  const profileEmail = "No email connected";
  const initials = getInitials(profileName);
  const yearOptions = Array.from(new Set([
    String(Number(activeYear) - 1),
    activeYear,
    String(Number(activeYear) + 1),
    String(currentYear),
  ])).sort();

  return (
    <header className="sticky top-0 z-40 px-3 py-3 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-3 rounded-[28px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)]/90 px-3 py-3 shadow-[var(--financeos-shadow-card-hover)] backdrop-blur-2xl lg:grid-cols-[minmax(13rem,1fr)_auto_minmax(13rem,1fr)] lg:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="flex min-w-0 origin-left cursor-pointer items-center gap-3 rounded-[20px] transition duration-200 hover:scale-[1.01] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
              aria-label="FinanceOS landing page"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-[var(--financeos-border)] bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                <DollarSign className="h-5 w-5 text-white" />
              </span>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-base font-bold text-[var(--financeos-text-primary)]">FinanceOS</span>
                  <span className="hidden h-1 w-1 rounded-full bg-[#3B82F6] sm:inline-block" />
                  <span className="hidden truncate text-sm font-medium text-[var(--financeos-text-muted)] sm:block">{pageTitle}</span>
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] text-[11px] text-[var(--financeos-text-secondary)]">
                    {activeYear} Budget
                  </Badge>
                  {previewModeEnabled && (
                    <Badge className="border-0 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-[11px] text-white">
                      Preview Data Enabled
                    </Badge>
                  )}
                </span>
              </span>
            </Link>
          </div>

          <div className="order-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(11rem,13rem)_minmax(18rem,auto)] lg:order-none">
            <MonthSelector
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              months={MONTHS}
              year={activeYear}
              onYearChange={setActiveYear}
              yearOptions={yearOptions}
              currentMonth={currentMonthIndex}
              label="Planning period"
              className="min-w-0"
            />
            <DateTimeDisplay timezone={timezone} compact className="min-w-0" />
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2">
            <Button
              asChild
              variant="outline"
              size="icon"
              className="relative h-10 w-10 rounded-full border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] text-[var(--financeos-text-secondary)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]"
            >
              <Link
                to="/notifications"
                aria-label={`${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}`}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--financeos-surface)] bg-[#EF4444] px-1 text-[10px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            </Button>

            <Link
              to="/settings"
              aria-label="Settings"
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] text-[var(--financeos-text-secondary)] shadow-[var(--financeos-shadow-card)] transition-colors hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)] md:flex"
            >
              <Settings className="h-4 w-4" />
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 gap-2 rounded-full border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] px-1.5 pr-3 text-[var(--financeos-text-secondary)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]"
                  aria-label="Profile menu"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-xs font-bold text-white">
                    {initials}
                  </span>
                  <span className="hidden max-w-[8rem] truncate text-sm font-semibold md:inline">{profileName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} className="w-[min(21rem,calc(100vw-1.5rem))] rounded-[20px] p-2">
                <DropdownMenuLabel className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                      {initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--financeos-text-primary)]">{profileName}</span>
                      <span className="mt-0.5 block truncate text-xs font-normal text-[var(--financeos-text-muted)]">{profileEmail}</span>
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="items-start gap-3 rounded-2xl px-3 py-3"
                  onSelect={() => {
                    toast.info("Account switching is not connected yet.");
                    navigate(getSwitchAccountRoute());
                  }}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[var(--financeos-icon-container)] text-[var(--financeos-text-secondary)]">
                    <Repeat2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--financeos-text-primary)]">Switch accounts</span>
                    <span className="mt-0.5 block text-xs leading-5 text-[var(--financeos-text-muted)]">Use a different FinanceOS profile</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="items-start gap-3 rounded-2xl px-3 py-3">
                  <Link to="/">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[var(--financeos-icon-container)] text-[#8B5CF6]">
                      <ArrowLeft className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--financeos-text-primary)]">Back to Landing Page</span>
                      <span className="mt-0.5 block text-xs leading-5 text-[var(--financeos-text-muted)]">Return to product homepage</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="items-start gap-3 rounded-2xl px-3 py-3 focus:bg-[#EF4444]/10"
                  onSelect={() => {
                    clearFinanceOSSession();
                    toast.info("Signed out of the current FinanceOS session.");
                    navigate("/");
                  }}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[#EF4444]/10 text-[#EF4444]">
                    <LogOut className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#EF4444]">Log out</span>
                    <span className="mt-0.5 block text-xs leading-5 text-[var(--financeos-text-muted)]">End your current session</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <MenuDropdown />
          </div>
        </div>
      </div>
    </header>
  );
}
