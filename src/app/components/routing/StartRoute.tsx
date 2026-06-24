import { Navigate } from "react-router";
import { useFinanceData } from "../../lib/financeStore";

export function StartRoute() {
  const { state } = useFinanceData();

  return <Navigate to={state.setupCompleted ? "/dashboard" : "/setup"} replace />;
}
