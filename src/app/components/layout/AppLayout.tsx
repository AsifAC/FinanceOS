import { AppShell } from "./AppShell";
import { FinanceDataProvider } from "../../lib/financeStore";

export function AppLayout() {
  return (
    <FinanceDataProvider>
      <AppShell />
    </FinanceDataProvider>
  );
}
