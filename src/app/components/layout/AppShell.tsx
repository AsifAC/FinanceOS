import { Outlet, useLocation } from "react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { Toaster } from "../ui/sonner";
import { PageTransition } from "./PageTransition";
import { TopNav } from "./TopNav";
import { FinanceOSThemeProvider, useFinanceOSTheme } from "../../lib/theme";
import { patchSonnerToast } from "../../lib/notifications";
import { RequireAuth } from "../auth/RequireAuth";
import { RequireVerified } from "../auth/RequireVerified";
import { FinanceDataProvider } from "../../lib/financeStore";

export function AppShell() {
  const location = useLocation();

  if (location.pathname === "/auth/verify") return <RequireAuth><Outlet /></RequireAuth>;
  if (location.pathname === "/" || /^\/auth\/(login|signup)\/?$/.test(location.pathname)) {
    return <Outlet />;
  }

  return (
    <RequireAuth>
      <RequireVerified>
      <FinanceDataProvider>
        <FinanceOSThemeProvider>
          <AppShellContent />
        </FinanceOSThemeProvider>
      </FinanceDataProvider>
      </RequireVerified>
    </RequireAuth>
  );
}

function AppShellContent() {
  const { theme } = useFinanceOSTheme();

  useEffect(() => {
    patchSonnerToast(toast);
  }, []);

  return (
    <div className="financeos-premium min-h-screen text-slate-100" data-theme={theme}>
      <TopNav />
      <main className="relative mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <p className="mb-5 rounded-xl border border-[var(--financeos-border)] p-4 text-sm text-[var(--financeos-text-secondary)]">
          <strong>Local browser workspace.</strong> Financial records on these pages are saved on this browser, shared between accounts using it, and are not synced to your Supabase account. Signing out preserves these local records.
        </p>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <Toaster />
    </div>
  );
}
