import "../../../styles/dashboard-header.css";
import { FinanceOSLogo } from "../common/FinanceOSLogo";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Bell, LogOut, Repeat2, Settings } from "lucide-react";
import { toast } from "sonner";
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
import { getSwitchAccountRoute } from "../../lib/session";
import { useLogout } from "../../../hooks/useLogout";
import { useAuth } from "../../../hooks/useAuth";
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
    setActiveYear,
    setSelectedMonth,
  } = useFinanceData();
  const { isAuthenticated, user } = useAuth();
  const { logout, isSigningOut, logoutError } = useLogout();
  const { unreadCount } = useNotifications();
  const pageTitle = pageTitles[location.pathname] ?? "FinanceOS";
  const profileName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "FinanceOS User";
  const profileEmail = user?.email ?? (isAuthenticated ? "Email unavailable" : "No email connected");
  const initials = getInitials(profileName);
  const yearOptions = Array.from(new Set([
    String(Number(activeYear) - 1),
    activeYear,
    String(Number(activeYear) + 1),
    String(currentYear),
  ])).sort();

  return (
    <header className="financeos-topnav">
      <div className="financeos-topnav-inner">
        <div className="financeos-topnav-layout">
          <div className="financeos-topnav-identity">
            <Link to="/" className="financeos-topnav-brand" aria-label="FinanceOS home">
              <FinanceOSLogo variant="compact" decorative />
            </Link>
            <div className="financeos-topnav-context">
              <span className="financeos-topnav-title">{pageTitle}</span>
            </div>
          </div>

          <div className="financeos-topnav-period">
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
          </div>

          <div className="financeos-topnav-actions">
            <DateTimeDisplay timezone={timezone} compact className="financeos-topnav-clock" />
            <Button
              asChild
              variant="outline"
              size="icon"
              className="financeos-topnav-icon relative"
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
              className="financeos-topnav-icon financeos-topnav-settings"
            >
              <Settings className="h-4 w-4" />
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="financeos-topnav-profile"
                  aria-label="Profile menu"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white">
                    {initials}
                  </span>
                  <span className="financeos-topnav-profile-name">{profileName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} className="w-[min(21rem,calc(100vw-1.5rem))] rounded-[20px] p-2">
                <DropdownMenuLabel className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[#2563EB] text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                      {initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--financeos-text-primary)]">{profileName}</span>
                      <span className="mt-0.5 block truncate text-xs font-normal text-[var(--financeos-text-muted)]">{profileEmail}</span>
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/settings">Account / Settings</Link></DropdownMenuItem>
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
                  disabled={isSigningOut}
                  className="items-start gap-3 rounded-2xl px-3 py-3"
                  onSelect={(event) => {
                    event.preventDefault();
                    void logout();
                  }}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[var(--financeos-icon-container)] text-[var(--financeos-text-secondary)]">
                    <LogOut className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{isSigningOut ? "Logging out…" : "Log out"}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-[var(--financeos-text-muted)]">End your current session</span>
                  </span>
                </DropdownMenuItem>
                {logoutError && <p role="alert" className="px-3 py-2 text-sm">{logoutError}</p>}
              </DropdownMenuContent>
            </DropdownMenu>

            <MenuDropdown />
          </div>
        </div>
      </div>
    </header>
  );
}
