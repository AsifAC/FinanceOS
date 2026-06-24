import { Link } from "react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Clock,
  CreditCard,
  DollarSign,
  LineChart,
  PiggyBank,
  PlusCircle,
  Repeat2,
  Settings,
  Settings2,
  Tag,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  chartAxisTick,
  chartGridStroke,
  chartLegendStyle,
  chartTooltipLabelStyle,
  chartTooltipStyle,
} from "../charts/chartTheme";
import {
  getAmountLeft,
  getMonthlyAmount,
  MonthlyAmount,
  Transaction,
} from "../../data/data";
import { useFinanceData } from "../../lib/financeStore";
import { MONTHS, MONTH_SHORT, currentMonthIndex } from "../../lib/constants";
import { MonthSelector } from "../common/MonthSelector";
import { DateTimeDisplay } from "../common/DateTimeDisplay";

function pct(actual: number, expected: number) {
  if (!expected) return 0;
  return Math.round(((actual - expected) / expected) * 100);
}

type Metric = {
  label: string;
  actual: number;
  expected: number;
  icon: typeof TrendingUp;
  border: string;
  gradient: string;
  path?: string;
};

const quickLinks = [
  { label: "Budget Setup", path: "/setup?edit=true", icon: Settings2 },
  { label: "Add Income", path: "/add-transaction?type=income", icon: TrendingUp },
  { label: "Add Expense", path: "/add-transaction?type=expense", icon: PlusCircle },
  { label: "Payment Plan", path: "/payment-plans", icon: Repeat2 },
  { label: "Category", path: "/categories", icon: Tag },
  { label: "Expected", path: "/expected-amounts", icon: Target },
  { label: "Planner", path: "/annual-planner", icon: CalendarDays },
  { label: "Tracker", path: "/tracker", icon: BarChart3 },
  { label: "Reports", path: "/reports", icon: LineChart },
  { label: "Settings", path: "/settings", icon: Settings },
];

function getDueBadge(dueDate: string) {
  const baseDate = new Date();
  const due = new Date(dueDate);
  const diff = Math.floor((due.getTime() - baseDate.getTime()) / 86400000);
  if (diff < 0) return { label: "Overdue", class: "bg-red-100 text-red-700" };
  if (diff === 0) return { label: "Due Today", class: "bg-purple-100 text-purple-700" };
  return { label: `In ${diff}d`, class: "bg-blue-100 text-blue-700" };
}

function getMetricCards(currentActual: MonthlyAmount, currentExpected: MonthlyAmount): Metric[] {
  return [
    {
      label: "Income",
      actual: currentActual.income,
      expected: currentExpected.income,
      icon: TrendingUp,
      border: "border-[#00D68F]/20",
      gradient: "from-[#00D68F] to-[#00C26E]",
      path: "/income",
    },
    {
      label: "Savings",
      actual: currentActual.savings,
      expected: currentExpected.savings,
      icon: PiggyBank,
      border: "border-[#3B82F6]/20",
      gradient: "from-[#3B82F6] to-[#2563EB]",
    },
    {
      label: "Debt",
      actual: currentActual.debt,
      expected: currentExpected.debt,
      icon: CreditCard,
      border: "border-[#F59E0B]/20",
      gradient: "from-[#F59E0B] to-[#D97706]",
    },
    {
      label: "Expenses",
      actual: currentActual.expenses,
      expected: currentExpected.expenses,
      icon: DollarSign,
      border: "border-[#EF4444]/20",
      gradient: "from-[#EF4444] to-[#DC2626]",
      path: "/expenses",
    },
    {
      label: "Amount Left",
      actual: getAmountLeft(currentActual),
      expected: getAmountLeft(currentExpected),
      icon: Wallet,
      border: "border-[#8B5CF6]/20",
      gradient: "from-[#8B5CF6] to-[#6366F1]",
    },
  ];
}

function MetricCard({ metric }: { metric: Metric }) {
  const { label, actual, expected, icon: Icon, border, gradient, path } = metric;
  const change = pct(actual, expected);
  const isPositive = label === "Amount Left" || label === "Income" || label === "Savings"
    ? change >= 0
    : change <= 0;

  const card = (
    <Card className={`relative overflow-hidden ${border}`}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-slate-300">{label}</span>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        <p className={`bg-gradient-to-r ${gradient} bg-clip-text text-2xl text-transparent`} style={{ fontWeight: 750 }}>
          ${actual.toLocaleString()}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs text-slate-400">vs ${expected.toLocaleString()} expected</span>
          <span className={`ml-auto text-xs ${isPositive ? "text-[#00D68F]" : "text-[#EF4444]"}`}>
            {change > 0 ? "+" : ""}{change}%
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (!path) return card;

  return (
    <Link to={path} className="block rounded-2xl transition-transform hover:-translate-y-0.5 active:translate-y-0">
      {card}
    </Link>
  );
}

function MobileTransactionCard({ transaction }: { transaction: Transaction }) {
  const badge = getDueBadge(transaction.dueDate!);

  return (
    <div className="rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{transaction.name}</p>
          <p className="text-xs text-slate-500">{transaction.category}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>${transaction.amount}</p>
          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs ${badge.class}`}>{badge.label}</span>
        </div>
      </div>
    </div>
  );
}

function PendingTransactionsPanel({ pendingTransactions }: { pendingTransactions: Transaction[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm">Pending Transactions</CardTitle>
          <Link to="/pending-transactions" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="space-y-2">
          {pendingTransactions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
              No pending transactions yet.
            </div>
          ) : (
            pendingTransactions.slice(0, 4).map((transaction) => (
              <MobileTransactionCard key={transaction.id} transaction={transaction} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ currentActual }: { currentActual: MonthlyAmount }) {
  const rows = [
    { label: "Total Income", value: currentActual.income, color: "text-[#00D68F]" },
    { label: "Total Savings", value: currentActual.savings, color: "text-[#3B82F6]" },
    { label: "Total Debt", value: currentActual.debt, color: "text-[#F59E0B]" },
    { label: "Total Expenses", value: currentActual.expenses, color: "text-[#EF4444]" },
    { label: "Amount Left", value: getAmountLeft(currentActual), color: "text-[#8B5CF6]" },
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm">Quick Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        {rows.map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-600">{label}</span>
            <span className={`text-sm ${color}`} style={{ fontWeight: 700 }}>${value.toLocaleString()}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ExpectedTransactionsCard({ currentExpected, selectedMonth, activeYear }: {
  currentExpected: MonthlyAmount;
  selectedMonth: number;
  activeYear: string;
}) {
  const expectedTransactions =
    currentExpected.income + currentExpected.expenses + currentExpected.savings + currentExpected.debt;

  return (
    <Card className="overflow-hidden border-[#8B5CF6]/20 bg-[var(--financeos-surface)] shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Planning</p>
            <h2 className="mt-1 text-sm font-semibold text-[var(--financeos-text-primary)]">Expected Transactions</h2>
            <p className="mt-1 text-xs text-slate-400">
              Planned for {MONTHS[selectedMonth]} {activeYear}
            </p>
          </div>
          <p className="bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] bg-clip-text text-3xl font-semibold text-transparent">
            ${expectedTransactions.toLocaleString()}
          </p>
        </div>
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
          {[
            { label: "Income", value: currentExpected.income, color: "text-[#00D68F]" },
            { label: "Savings", value: currentExpected.savings, color: "text-[#3B82F6]" },
            { label: "Debt", value: currentExpected.debt, color: "text-[#F59E0B]" },
            { label: "Expenses", value: currentExpected.expenses, color: "text-[#EF4444]" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] px-3 py-2">
              <p className="text-slate-500">{label}</p>
              <p className={`mt-1 font-semibold ${color}`}>${value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLinksPanel() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm">Quick Links</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          {quickLinks.map(({ label, path, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className="flex min-h-12 items-center gap-2 rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] px-3 py-2 text-sm text-[var(--financeos-text-muted)] transition-all hover:-translate-y-0.5 hover:border-[var(--financeos-border-strong)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ chartData, hasChartData }: { chartData: Array<{ month: string; Expected: number; Actual: number }>; hasChartData: boolean }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-0">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Cashflow preview</p>
        <CardTitle className="text-sm">Expected vs Actual Preview</CardTitle>
      </CardHeader>
      <CardContent className="relative pt-3">
        {hasChartData ? (
        <div className="h-[260px] w-full sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={20} barGap={6} barCategoryGap="22%" margin={{ top: 12, right: 8, left: 0, bottom: 6 }}>
            <defs>
              <linearGradient id="dashboardExpectedGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#6366F1" />
              </linearGradient>
              <linearGradient id="dashboardActualGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#2563EB" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
            <XAxis dataKey="month" tick={chartAxisTick} axisLine={false} tickLine={false} />
            <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={44} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.06)" }}
              contentStyle={chartTooltipStyle}
              labelStyle={chartTooltipLabelStyle}
              formatter={(v: number) => [`$${v}`, ""]}
            />
            <Legend iconType="circle" iconSize={9} wrapperStyle={chartLegendStyle} />
            <Bar dataKey="Expected" fill="url(#dashboardExpectedGradient)" radius={[8, 8, 2, 2]} />
            <Bar dataKey="Actual" fill="url(#dashboardActualGradient)" radius={[8, 8, 2, 2]} />
          </BarChart>
        </ResponsiveContainer>
        </div>
        ) : (
          <div className="flex h-[260px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-slate-400 sm:h-[300px]">
            No budget data yet. Add expected amounts and transactions to compare your plan.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BestSavingsMonthCard({ bestMonth, actualAmounts }: { bestMonth: number | null; actualAmounts: MonthlyAmount[] }) {
  if (bestMonth === null) {
    return (
      <Card className="border-[#00D68F]/20">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#00D68F]" />
            <span className="text-sm text-slate-200" style={{ fontWeight: 600 }}>Best Savings Month</span>
          </div>
          <p className="text-sm text-slate-400">No savings data yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#00D68F]/20">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#00D68F]" />
          <span className="text-sm text-slate-200" style={{ fontWeight: 600 }}>Best Savings Month</span>
        </div>
        <p className="text-2xl text-[#00D68F]" style={{ fontWeight: 700 }}>{MONTH_SHORT[bestMonth]}</p>
        <p className="mt-1 text-sm text-slate-500">
          ${getAmountLeft(actualAmounts[bestMonth]).toLocaleString()} left over
        </p>
        <p className="mt-0.5 text-xs text-slate-400">${actualAmounts[bestMonth].savings} saved</p>
      </CardContent>
    </Card>
  );
}

function UpcomingPaymentsPanel({ pendingTransactions }: { pendingTransactions: Transaction[] }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#F59E0B]" />
          <span className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Upcoming Payments</span>
        </div>
        <div className="space-y-2">
          {pendingTransactions.length === 0 ? (
            <p className="text-sm text-slate-400">No upcoming payments yet.</p>
          ) : (
            pendingTransactions.slice(0, 3).map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 text-sm last:border-0">
                <span className="text-slate-600">{transaction.name}</span>
                <span className="text-slate-800" style={{ fontWeight: 600 }}>${transaction.amount}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardHero({
  collapsed,
  currentActual,
  metricCards,
  activeYear,
  timezone,
  selectedMonth,
  onMonthChange,
  onYearChange,
}: {
  collapsed: boolean;
  currentActual: MonthlyAmount;
  metricCards: Metric[];
  activeYear: string;
  timezone: string;
  selectedMonth: number;
  onMonthChange(month: number): void;
  onYearChange(year: string): void;
}) {
  const amountLeft = getAmountLeft(currentActual);

  return (
    <section
      className={[
        "sticky top-[4.25rem] z-30 overflow-hidden rounded-[24px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] shadow-[var(--financeos-shadow-card-hover)] backdrop-blur-xl transition-all duration-300",
        collapsed ? "py-3" : "py-5 sm:py-6",
      ].join(" ")}
    >
      <div className="px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <DateTimeDisplay timezone={timezone} className={collapsed ? "mb-2" : "mb-3"} />
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              <h1 className={collapsed ? "text-xl font-semibold text-[var(--financeos-text-primary)] sm:text-2xl" : "text-3xl font-semibold text-[var(--financeos-text-primary)] sm:text-5xl"}>
                FinanceOS
              </h1>
              <p className={collapsed ? "text-sm text-slate-400" : "pb-1 text-sm text-slate-400 sm:text-base"}>
                {MONTHS[selectedMonth]} {activeYear} executive budget view
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] px-4 py-3 sm:min-w-64">
            <MonthSelector
              selectedMonth={selectedMonth}
              onMonthChange={onMonthChange}
              months={MONTHS}
              year={activeYear}
              onYearChange={onYearChange}
              currentMonth={currentMonthIndex}
              label="Dashboard month"
              className="w-full"
            />
            <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">Amount Left</p>
              <p className="text-xl font-semibold text-[var(--financeos-text-primary)]">${amountLeft.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/add-transaction?type=income"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C26E] px-3 text-sm font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <TrendingUp className="h-4 w-4" />
                Income
              </Link>
              <Link
                to="/add-transaction?type=expense"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#EF4444] to-[#DC2626] px-3 text-sm font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <PlusCircle className="h-4 w-4" />
                Expense
              </Link>
            </div>
            </div>
          </div>
        </div>

        <div
          className={[
            "grid gap-3 overflow-hidden transition-all duration-300 sm:grid-cols-2 lg:grid-cols-5",
            collapsed ? "mt-0 max-h-0 opacity-0" : "mt-5 max-h-[32rem] opacity-100",
          ].join(" ")}
        >
          {metricCards.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
        </div>
      </div>
    </section>
  );
}

export function Dashboard() {
  const { activeYear, timezone, selectedMonth, setActiveYear, setSelectedMonth, actualAmounts, expectedAmounts, pendingTransactions } = useFinanceData();
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const currentActual = getMonthlyAmount(actualAmounts, selectedMonth);
  const currentExpected = getMonthlyAmount(expectedAmounts, selectedMonth);
  const metricCards = getMetricCards(currentActual, currentExpected);
  const chartData = MONTH_SHORT.slice(0, selectedMonth + 1).map((m, i) => ({
    month: m,
    Expected: getAmountLeft(getMonthlyAmount(expectedAmounts, i)),
    Actual: getAmountLeft(getMonthlyAmount(actualAmounts, i)),
  }));
  const hasActualData = actualAmounts.some((month) =>
    month.income || month.savings || month.debt || month.expenses
  );
  const hasChartData = chartData.some((month) => month.Expected || month.Actual);
  const bestMonth = hasActualData ? actualAmounts
    .slice(0, selectedMonth + 1)
    .reduce((best, m, i) => getAmountLeft(m) > getAmountLeft(actualAmounts[best]) ? i : best, 0) : null;

  useEffect(() => {
    function handleScroll() {
      setHeroCollapsed(window.scrollY > 84);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="space-y-5 sm:space-y-6">
      <DashboardHero
        collapsed={heroCollapsed}
        currentActual={currentActual}
        metricCards={metricCards}
        activeYear={activeYear}
        timezone={timezone}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        onYearChange={setActiveYear}
      />

      <ExpectedTransactionsCard currentExpected={currentExpected} selectedMonth={selectedMonth} activeYear={activeYear} />

      <div className="grid gap-4 lg:grid-cols-3">
        <PendingTransactionsPanel pendingTransactions={pendingTransactions} />
        <SummaryCard currentActual={currentActual} />
        <QuickLinksPanel />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard chartData={chartData} hasChartData={hasChartData} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <BestSavingsMonthCard bestMonth={bestMonth} actualAmounts={actualAmounts} />
          <UpcomingPaymentsPanel pendingTransactions={pendingTransactions} />
        </div>
      </div>
    </div>
  );
}
