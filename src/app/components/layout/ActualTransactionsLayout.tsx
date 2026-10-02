import { Link, Outlet } from "react-router";
import { LogOut, Settings } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { useLogout } from "../../../hooks/useLogout";
import { useFinanceOSTheme } from "../../lib/theme";
import { FinanceOSLogo } from "../common/FinanceOSLogo";
import { Button } from "../ui/button";
import { MenuDropdown } from "./MenuDropdown";
import "../../../styles/transactions.css";

/** Uses the existing auth/theme/navigation, without a financial-state provider. */
export function ActualTransactionsLayout({ section = "transactions" }: { section?: "transactions" | "expected-transactions" | "categories" | "payment-methods" | "add-transaction" }) {
  const { user } = useAuth();
  const { theme } = useFinanceOSTheme();
  const { logout, isSigningOut, logoutError } = useLogout();

  return (
    <div className="financeos-premium transactions-workspace min-h-screen" data-theme={theme}>
      <a className="transactions-skip" href={`#${section}-content`}>Skip to {section}</a>
      <header className="transactions-nav">
        <div className="transactions-nav-inner">
          <Link to="/" aria-label="FinanceOS home"><FinanceOSLogo variant="compact" decorative /></Link>
          <span className="transactions-account-label">Account workspace</span>
          <div className="transactions-nav-actions">
            <span className="transactions-account-email">{user?.email}</span>
            <Button asChild variant="ghost" size="icon"><Link to="/settings" aria-label="Settings"><Settings size={17} /></Link></Button>
            <Button variant="ghost" size="icon" aria-label={isSigningOut ? "Logging out" : "Log out"} disabled={isSigningOut} onClick={() => void logout()}><LogOut size={17} /></Button>
            <MenuDropdown />
          </div>
        </div>
      </header>
      <main id={`${section}-content`} className="transactions-main" tabIndex={-1}>
        {logoutError && <p role="alert">{logoutError}</p>}
        {/* Reset filters as well as requests when the authenticated account changes. */}
        <Outlet key={user?.id} />
      </main>
    </div>
  );
}
