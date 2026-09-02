import { AppShell } from "./AppShell";
import { FinanceDataProvider } from "../../lib/financeStore";
import { AuthProvider } from "../../../providers/AuthProvider";

export function AppLayout() {
  return (
    <AuthProvider>
      <FinanceDataProvider>
        <AppShell />
      </FinanceDataProvider>
    </AuthProvider>
  );
}
