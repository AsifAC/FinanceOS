import { Link } from "react-router";
import { useMemo } from "react";
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
  ACTUAL_COLOR,
  ACTUAL_HOVER_COLOR,
  chartAxisTick,
  chartGridStroke,
  chartLegendStyle,
  chartTooltipLabelStyle,
  chartTooltipStyle,
  EXPECTED_COLOR,
  EXPECTED_HOVER_COLOR,
} from "../charts/chartTheme";
import {
  getAmountLeft,
  getMonthlyAmount,
  MonthlyAmount,
  Transaction,
} from "../../data/data";
import { useFinanceData } from "../../lib/financeStore";
import { MONTHS, MONTH_SHORT } from "../../lib/constants";
import { useTransactions } from "../../../hooks/useTransactions";
import { amountLeftForActualMonth, getActualTransactionMonths } from "../../lib/actualTransactionTotals";


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
  color: string;
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
      color: "#00A676",
      path: "/income",
    },
    {
      label: "Savings",
      actual: currentActual.savings,
      expected: currentExpected.savings,
      icon: PiggyBank,
      border: "border-[#3B82F6]/20",
      color: "#2563EB",
    },
    {
      label: "Debt",
      actual: currentActual.debt,
      expected: currentExpected.debt,
      icon: CreditCard,
      border: "border-[#F59E0B]/20",
      color: "#D97706",
    },
    {
      label: "Expenses",
      actual: currentActual.expenses,
      expected: currentExpected.expenses,
      icon: DollarSign,
      border: "border-[#EF4444]/20",
      color: "#DC2626",
      path: "/expenses",
    },
    {
      label: "Amount Left",
      actual: amountLeftForActualMonth(currentActual),
      expected: getAmountLeft(currentExpected),
      icon: Wallet,
      border: "border-[#8B5CF6]/20",
      color: "#7C3AED",
    },
  ];
}

type ActualStatus = "loading" | "error" | "ready";

function MetricCard({ metric, actualStatus }: { metric: Metric; actualStatus: ActualStatus }) {
  const { label, actual, expected, icon: Icon, border, color, path } = metric;
  const change = pct(actual, expected);
  const isPositive = label === "Amount Left" || label === "Income" || label === "Savings"
    ? change >= 0
    : change <= 0;

  const card = (
    <Card className={`relative overflow-hidden ${border}`}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-slate-300">{label}</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: color }}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        <p className="text-2xl" style={{ color, fontWeight: 750 }} aria-label={`${label} actual`}>
          {actualStatus === "loading" ? <span className="animate-pulse text-slate-500">Loading…</span> : actualStatus === "error" ? "Unavailable" : `$${actual.toLocaleString()}`}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs text-slate-400">${expected.toLocaleString()} local expected</span>
          {actualStatus === "ready" && <span className={`ml-auto text-xs ${isPositive ? "text-[#00D68F]" : "text-[#EF4444]"}`}>
            {change > 0 ? "+" : ""}{change}%
          </span>}
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
          <CardTitle className="text-sm">Pending Transactions · local planning</CardTitle>
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

function SummaryCard({ currentActual, actualStatus }: { currentActual: MonthlyAmount; actualStatus: ActualStatus }) {
  const rows = [
    { label: "Total Income", value: currentActual.income, color: "text-[#00D68F]" },
    { label: "Total Savings", value: currentActual.savings, color: "text-[#3B82F6]" },
    { label: "Total Debt", value: currentActual.debt, color: "text-[#F59E0B]" },
    { label: "Total Expenses", value: currentActual.expenses, color: "text-[#EF4444]" },
    { label: "Amount Left", value: amountLeftForActualMonth(currentActual), color: "text-[#8B5CF6]" },
  ];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm">Quick Summary · Supabase actual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        {rows.map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-600">{label}</span>
            <span className={`text-sm ${color}`} style={{ fontWeight: 700 }}>{actualStatus === "loading" ? "Loading…" : actualStatus === "error" ? "Unavailable" : `$${value.toLocaleString()}`}</span>
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Local planning</p>
            <h2 className="mt-1 text-sm font-semibold text-[var(--financeos-text-primary)]">Monthly Budget Targets · local planning</h2>
            <p className="mt-1 text-xs text-slate-400">
              Planned for {MONTHS[selectedMonth]} {activeYear}
            </p>
          </div>
          <p className="text-3xl font-semibold text-[#2563EB]">
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

function ChartCard({ chartData, hasChartData, actualStatus }: { chartData: Array<{ month: string; Expected: number; Actual: number }>; hasChartData: boolean; actualStatus: ActualStatus }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-0">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Cashflow preview</p>
        <CardTitle className="text-sm">Expected vs Actual Preview</CardTitle>
        <p className="text-xs text-slate-400">Actual: FinanceOS account · Expected: local plan</p>
      </CardHeader>
      <CardContent className="relative pt-3">
        {actualStatus === "loading" ? (
          <div className="flex h-[260px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400 sm:h-[300px]" role="status">Loading account actuals…</div>
        ) : actualStatus === "error" ? (
          <div className="flex h-[260px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-rose-300 sm:h-[300px]" role="alert">Actual chart unavailable. Retry loading account transactions above.</div>
        ) : hasChartData ? (
        <div className="h-[260px] w-full sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={20} barGap={6} barCategoryGap="22%" margin={{ top: 12, right: 8, left: 0, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
            <XAxis dataKey="month" tick={chartAxisTick} axisLine={false} tickLine={false} />
            <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={44} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.06)" }}
              contentStyle={chartTooltipStyle}
              labelStyle={chartTooltipLabelStyle}
              formatter={(v: number, name: string) => [`$${v}`, name]}
            />
            <Legend iconType="circle" iconSize={9} wrapperStyle={chartLegendStyle} />
            <Bar dataKey="Expected" fill={EXPECTED_COLOR} activeBar={{ fill: EXPECTED_HOVER_COLOR }} radius={[8, 8, 2, 2]} />
            <Bar dataKey="Actual" fill={ACTUAL_COLOR} activeBar={{ fill: ACTUAL_HOVER_COLOR }} radius={[8, 8, 2, 2]} />
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

function BestSavingsMonthCard({ bestMonth, actualAmounts, actualStatus }: { bestMonth: number | null; actualAmounts: MonthlyAmount[]; actualStatus: ActualStatus }) {
  if (actualStatus !== "ready") {
    return <Card className="border-[#00D68F]/20"><CardContent className="p-4"><div className="mb-2 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#00D68F]" /><span className="text-sm text-slate-200" style={{ fontWeight: 600 }}>Best Savings Month · actual</span></div><p className="text-sm text-slate-400">{actualStatus === "loading" ? "Loading account actuals…" : "Actual savings data unavailable."}</p></CardContent></Card>;
  }
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
          ${amountLeftForActualMonth(actualAmounts[bestMonth]).toLocaleString()} left over
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
          <span className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Upcoming Payments · local plans</span>
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

function DashboardHero({ currentActual, metricCards, activeYear, selectedMonth, actualStatus }: {
  currentActual: MonthlyAmount;
  metricCards: Metric[];
  activeYear: string;
  selectedMonth: number;
  actualStatus: ActualStatus;
}) {
  const amountLeft = actualStatus === "ready" ? amountLeftForActualMonth(currentActual) : null;

  return (
    <section className="financeos-dashboard-overview" aria-labelledby="dashboard-overview-title">
      <div className="financeos-overview-heading">
        <div>
          <h1 id="dashboard-overview-title">{MONTHS[selectedMonth]} {activeYear} Overview</h1>
          <p>Executive budget view</p>
        </div>
        <div className="financeos-overview-actions">
          <div className="financeos-overview-balance">
            <p>Amount Left</p>
            <strong aria-label="Amount Left actual">{amountLeft === null ? (actualStatus === "loading" ? "Loading…" : "Unavailable") : `$${amountLeft.toLocaleString()}`}</strong>
          </div>
          <div className="financeos-overview-buttons">
            <Link to="/add-transaction?type=income" className="financeos-quick-action financeos-quick-income">
              <TrendingUp size={16} aria-hidden="true" />Income
            </Link>
            <Link to="/add-transaction?type=expense" className="financeos-quick-action financeos-quick-expense">
              <PlusCircle size={16} aria-hidden="true" />Expense
            </Link>
          </div>
        </div>
      </div>
      <div className="financeos-overview-metrics">
        {metricCards.map(metric => <div key={metric.label}><MetricCard metric={metric} actualStatus={actualStatus} /></div>)}
      </div>
    </section>
  );
}

export function Dashboard() {
  const { activeYear, selectedMonth, expectedAmounts, pendingTransactions } = useFinanceData();
  const { transactions: actualTransactions, isLoading: actualLoading, error: actualError, refresh: refreshActuals } = useTransactions();
  const actualStatus: ActualStatus = actualLoading ? "loading" : actualError ? "error" : "ready";
  const actualAmounts = useMemo(() => getActualTransactionMonths(actualTransactions, Number(activeYear)), [actualTransactions, activeYear]);
  const currentActual = actualAmounts[selectedMonth] ?? getMonthlyAmount([], selectedMonth);
  const currentExpected = getMonthlyAmount(expectedAmounts, selectedMonth);
  const metricCards = getMetricCards(currentActual, currentExpected);
  const chartData = MONTH_SHORT.slice(0, selectedMonth + 1).map((m, i) => ({
    month: m,
    Expected: getAmountLeft(getMonthlyAmount(expectedAmounts, i)),
    Actual: amountLeftForActualMonth(actualAmounts[i]),
  }));
  const hasActualData = actualAmounts.some((month) =>
    month.income || month.savings || month.debt || month.expenses
  );
  const hasChartData = chartData.some((month) => month.Expected || month.Actual);
  const bestMonth = hasActualData ? actualAmounts
    .slice(0, selectedMonth + 1)
    .reduce((best, m, i) => amountLeftForActualMonth(m) > amountLeftForActualMonth(actualAmounts[best]) ? i : best, 0) : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      {actualError && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
        <span>Could not load account transactions. Actual dashboard values are unavailable.</span>
        <button type="button" className="rounded-lg border border-rose-300/30 px-3 py-1.5 hover:bg-white/5" onClick={() => void refreshActuals()}>Retry</button>
      </div>}
      <DashboardHero
        currentActual={currentActual}
        metricCards={metricCards}
        activeYear={activeYear}
        selectedMonth={selectedMonth}
        actualStatus={actualStatus}
      />

      <ExpectedTransactionsCard currentExpected={currentExpected} selectedMonth={selectedMonth} activeYear={activeYear} />

      <div className="grid gap-4 lg:grid-cols-3">
        <PendingTransactionsPanel pendingTransactions={pendingTransactions} />
        <SummaryCard currentActual={currentActual} actualStatus={actualStatus} />
        <QuickLinksPanel />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard chartData={chartData} hasChartData={hasChartData} actualStatus={actualStatus} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <BestSavingsMonthCard bestMonth={bestMonth} actualAmounts={actualAmounts} actualStatus={actualStatus} />
          <UpcomingPaymentsPanel pendingTransactions={pendingTransactions} />
        </div>
      </div>
    </div>
  );
}
