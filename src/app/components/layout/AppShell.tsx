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
import { ActualTransactionsLayout } from "./ActualTransactionsLayout";
import { useAuth } from "../../../hooks/useAuth";

export function AppShell() {
  const location = useLocation();

  if (location.pathname === "/auth/verify") return <RequireAuth><Outlet /></RequireAuth>;
  if (location.pathname === "/" || /^\/auth\/(login|signup)\/?$/.test(location.pathname)) {
    return <Outlet />;
  }

  // Account-backed transaction metadata screens must never hydrate or persist the legacy financial store.
  if (/^\/(transactions|expected-transactions|categories|payment-methods|add-transaction)\/?$/i.test(location.pathname)) {
    return (
      <RequireAuth>
        <RequireVerified>
          <FinanceOSThemeProvider><ActualTransactionsLayout section={location.pathname.toLowerCase().includes("expected-transactions") ? "expected-transactions" : location.pathname.toLowerCase().includes("categories") ? "categories" : location.pathname.toLowerCase().includes("payment-methods") ? "payment-methods" : location.pathname.toLowerCase().includes("add-transaction") ? "add-transaction" : "transactions"} /></FinanceOSThemeProvider>
        </RequireVerified>
      </RequireAuth>
    );
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
  const { user } = useAuth();

  useEffect(() => {
    patchSonnerToast(toast);
  }, []);

  return (
    <div className="financeos-premium min-h-screen text-slate-100" data-theme={theme}>
      <TopNav />
      <main className="relative mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <aside className="financeos-workspace-note" aria-label="Local workspace information">
          <Info size={15} aria-hidden="true" />
          <p><strong>Account finances, local planning.</strong> Actual transactions, expected events, and saved budgets belong to your account. Budget targets and legacy plans stay in this browser and are shared between accounts.</p>
        </aside>
        <PageTransition>
          <Outlet key={user?.id} />
        </PageTransition>
      </main>
      <Toaster />
    </div>
  );
}
