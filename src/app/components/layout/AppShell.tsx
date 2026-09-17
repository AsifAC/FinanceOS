import { Outlet, useLocation } from "react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { Toaster } from "../ui/sonner";
import { PageTransition } from "./PageTransition";
import { TopNav } from "./TopNav";
import { FinanceOSThemeProvider, useFinanceOSTheme } from "../../lib/theme";
import { patchSonnerToast } from "../../lib/notifications";

export function AppShell() {
  const location = useLocation();

  if (location.pathname === "/" || location.pathname.startsWith("/auth/")) {
    return <Outlet />;
  }

  return (
    <FinanceOSThemeProvider>
      <AppShellContent />
    </FinanceOSThemeProvider>
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
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <Toaster />
    </div>
  );
}
