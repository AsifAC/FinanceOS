import { Link, NavLink } from "react-router";
import {
  LayoutDashboard, Settings2, CalendarDays, CreditCard, Clock,
  PlusCircle, Tag, Target, Repeat2, BarChart3, LineChart, Settings, TrendingUp,
} from "lucide-react";
import { cn } from "../ui/utils";
import { useFinanceData } from "../../lib/financeStore";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Setup", path: "/setup", icon: Settings2 },
  { label: "Annual Planner", path: "/annual-planner", icon: CalendarDays },
  { label: "Income", path: "/income", icon: TrendingUp },
  { label: "Expenses", path: "/expenses", icon: CreditCard },
  { label: "Pending Transactions", path: "/pending-transactions", icon: Clock },
  { label: "Add Transaction", path: "/add-transaction", icon: PlusCircle },
  { label: "Categories", path: "/categories", icon: Tag },
  { label: "Expected Amounts", path: "/expected-amounts", icon: Target },
  { label: "Payment Plans", path: "/payment-plans", icon: Repeat2 },
  { label: "Tracker", path: "/tracker", icon: BarChart3 },
  { label: "Reports", path: "/reports", icon: LineChart },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function Sidebar() {
  const { activeYear } = useFinanceData();

  return (
    <aside className="w-56 shrink-0 h-full bg-white border-r border-slate-200 flex flex-col">
      <div className="px-4 py-5 border-b border-slate-200">
        <Link
          to="/"
          className="flex origin-left cursor-pointer items-center gap-2 rounded-lg transition duration-200 hover:scale-[1.01] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          aria-label="FinanceOS landing page"
        >
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs">$</span>
          </div>
          <div>
            <p className="text-sm leading-none text-slate-900" style={{ fontWeight: 700 }}>FinanceOS</p>
            <p className="text-xs text-slate-500 mt-0.5">{activeYear} Budget</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-slate-200">
        <p className="text-xs text-slate-400">Your personal OS for money.</p>
      </div>
    </aside>
  );
}
