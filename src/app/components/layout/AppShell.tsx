import { Outlet, useLocation } from "react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
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
        <aside className="financeos-workspace-note" aria-label="Local workspace information">
          <Info size={15} aria-hidden="true" />
          <p><strong>Local browser workspace.</strong> Records stay on this browser, are shared between accounts using it, and are not synced to your account. Signing out keeps them here.</p>
        </aside>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <Toaster />
    </div>
  );
}
