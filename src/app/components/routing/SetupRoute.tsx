import { Navigate, useSearchParams } from "react-router";
import { useFinanceData } from "../../lib/financeStore";
import { Setup } from "../screens/Setup";

export function SetupRoute() {
  const [searchParams] = useSearchParams();
  const { state } = useFinanceData();

  if (state.setupCompleted && searchParams.get("edit") !== "true") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Setup />;
}
