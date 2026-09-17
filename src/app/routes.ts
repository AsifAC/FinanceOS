import { createElement } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { RouteErrorBoundary } from "./components/routing/RouteErrorBoundary";
import { StartRoute } from "./components/routing/StartRoute";
import { SetupRoute } from "./components/routing/SetupRoute";
import { Dashboard } from "./components/screens/Dashboard";
import { AnnualPlanner } from "./components/screens/AnnualPlanner";
import { ExpenseTracker } from "./components/screens/ExpenseTracker";
import { IncomeTracker } from "./components/screens/IncomeTracker";
import { PendingTransactions } from "./components/screens/PendingTransactions";
import { AddTransaction } from "./components/screens/AddTransaction";
import { Categories } from "./components/screens/Categories";
import { ExpectedAmounts } from "./components/screens/ExpectedAmounts";
import { PaymentPlans } from "./components/screens/PaymentPlans";
import { TrackerUI } from "./components/screens/TrackerUI";
import { Reports } from "./components/screens/Reports";
import { SavedBudgets } from "./components/screens/SavedBudgets";
import { Settings } from "./components/screens/Settings";
import { Notifications } from "./components/screens/Notifications";
import { HelpCenter } from "./components/screens/HelpCenter";
import { LandingPage } from "./components/screens/LandingPage";
import { AuthPage } from "./components/screens/AuthPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppLayout,
    errorElement: createElement(RouteErrorBoundary),
    children: [
      { index: true, Component: LandingPage },
      { path: "auth/login", element: createElement(AuthPage, { mode: "login" }) },
      { path: "auth/signup", element: createElement(AuthPage, { mode: "signup" }) },
      { path: "start", Component: StartRoute },
      { path: "dashboard", Component: Dashboard },
      { path: "setup", Component: SetupRoute },
      { path: "annual-planner", Component: AnnualPlanner },
      { path: "income", Component: IncomeTracker },
      { path: "expenses", Component: ExpenseTracker },
      { path: "transactions", element: createElement(Navigate, { to: "/expenses", replace: true }) },
      { path: "pending-transactions", Component: PendingTransactions },
      { path: "add-transaction", Component: AddTransaction },
      { path: "categories", Component: Categories },
      { path: "expected-amounts", Component: ExpectedAmounts },
      { path: "payment-plans", Component: PaymentPlans },
      { path: "tracker", Component: TrackerUI },
      { path: "reports", Component: Reports },
      { path: "saved-budgets", Component: SavedBudgets },
      { path: "notifications", Component: Notifications },
      { path: "help", Component: HelpCenter },
      { path: "settings", Component: Settings },
      { path: "planner", element: createElement(Navigate, { to: "/annual-planner", replace: true }) },
      { path: "pending", element: createElement(Navigate, { to: "/pending-transactions", replace: true }) },
      { path: "expected", element: createElement(Navigate, { to: "/expected-amounts", replace: true }) },
      { path: "tracker-ui", element: createElement(Navigate, { to: "/tracker", replace: true }) },
    ],
  },
]);
