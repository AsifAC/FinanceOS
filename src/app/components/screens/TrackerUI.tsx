import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "../ui/card";
import { getMonthlyAmount } from "../../data/data";
import { calculateBudgetHealthScore } from "../../lib/budgetHealthScore";
import { useFinanceData } from "../../lib/financeStore";
import { MONTHS, MONTH_SHORT } from "../../lib/constants";
import {
  chartGridStroke,
  chartLegendStyle,
  chartMutedTick,
  chartTooltipLabelStyle,
  chartTooltipStyle,
} from "../charts/chartTheme";
import type { Transaction } from "../../data/data";

interface TrackerCardProps {
  label: string;
  expected: number;
  actual: number;
  color: string;
  isInverse?: boolean;
}

function money(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return safeValue.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function percent(actual: number, expected: number) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected <= 0) return 0;
  return Math.round((actual / expected) * 100);
}

function statusFor(actual: number, expected: number, isInverse = false) {
  if (expected <= 0) {
    return {
      label: actual > 0 ? "No target set" : "No data",
      tone: "text-[var(--financeos-text-muted)]",
      bg: "bg-[var(--financeos-surface-elevated)]",
    };
  }
  const diff = actual - expected;
  if (diff === 0) {
    return { label: "On track", tone: "text-[var(--financeos-success-icon)]", bg: "bg-[var(--financeos-success-bg)]" };
  }
  const positive = isInverse ? diff < 0 : diff > 0;
  return positive
    ? { label: isInverse ? "Under target" : "Ahead", tone: "text-[var(--financeos-success-icon)]", bg: "bg-[var(--financeos-success-bg)]" }
    : { label: isInverse ? "Over target" : "Behind", tone: "text-[var(--financeos-warning-icon)]", bg: "bg-[var(--financeos-warning-bg)]" };
}

function dateYear(date: string | undefined) {
  return date?.match(/^(\d{4})-\d{2}-\d{2}/)?.[1] ?? null;
}

function dateMonth(date: string | undefined) {
  const month = date?.match(/^\d{4}-(\d{2})-\d{2}/)?.[1];
  return month ? Number(month) - 1 : null;
}

function TrackerCard({ label, expected, actual, color, isInverse }: TrackerCardProps) {
  const pct = percent(actual, expected);
  const visualPct = clamp(pct);
  const diff = actual - expected;
  const positive = isInverse ? diff <= 0 : diff >= 0;
  const status = statusFor(actual, expected, isInverse);

  const gradient =
    label.includes("Income") ? "from-[#00D68F] to-[#00C26E]" :
    label.includes("Savings") ? "from-[#3B82F6] to-[#2563EB]" :
    label.includes("Debt") ? "from-[#F59E0B] to-[#D97706]" :
    label.includes("Expense") ? "from-[#EF4444] to-[#DC2626]" :
    "from-[#8B5CF6] to-[#6366F1]";

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className={`text-sm ${color}`} style={{ fontWeight: 600 }}>{label}</p>
          <div className={`flex items-center gap-1 text-xs ${positive ? "text-[var(--financeos-success-icon)]" : "text-[var(--financeos-warning-icon)]"}`}>
            {diff === 0 ? <Minus className="w-3 h-3" /> : positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {diff > 0 ? "+" : ""}{money(diff)}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between gap-3 text-xs text-[var(--financeos-text-muted)]">
            <span>Actual: <span className={color} style={{ fontWeight: 600 }}>{money(actual)}</span></span>
            <span>Expected: {money(expected)}</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-white/10 shadow-inner shadow-black/40" aria-label={`${label} progress`}>
            <div
              className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
              style={{ width: `${visualPct}%` }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className={`text-xs ${status.tone}`} style={{ fontWeight: 600 }}>
              {pct}%
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${status.bg} ${status.tone}`} style={{ fontWeight: 600 }}>{status.label}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RateCard({ label, value, color, desc }: { label: string; value: number; color: string; desc: string }) {
  const safeValue = clamp(Math.round(value), 0, 999);
  return (
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="p-4 text-center">
        <p className="text-xs text-[var(--financeos-text-muted)] mb-1">{label}</p>
        <p className={`text-3xl ${color}`} style={{ fontWeight: 700 }}>{safeValue}%</p>
        <p className="text-xs text-[var(--financeos-text-muted)] mt-1">{desc}</p>
      </CardContent>
    </Card>
  );
}

function savingsTransactionsByCategory(transactions: Transaction[], activeYear: string, selectedMonth: number) {
  return Object.values(transactions
    .filter((transaction) => transaction.type === "savings")
    .filter((transaction) => dateYear(transaction.date) === activeYear)
    .filter((transaction) => {
      const month = dateMonth(transaction.date);
      return month !== null && month <= selectedMonth;
    })
    .reduce<Record<string, { category: string; amount: number }>>((groups, transaction) => {
      const category = transaction.category || "Uncategorized";
      groups[category] ??= { category, amount: 0 };
      groups[category].amount += Number.isFinite(transaction.amount) ? transaction.amount : 0;
      return groups;
    }, {}))
    .sort((a, b) => b.amount - a.amount);
}

export function TrackerUI() {
  const { activeYear, selectedMonth, actualAmounts, expectedAmounts, previewModeEnabled, transactions, categories } = useFinanceData();
  const current = getMonthlyAmount(actualAmounts, selectedMonth);
  const expected = getMonthlyAmount(expectedAmounts, selectedMonth);
  const incomeTotal = actualAmounts.slice(0, selectedMonth + 1).reduce((s, m) => s + m.income, 0);
  const savingsTotal = actualAmounts.slice(0, selectedMonth + 1).reduce((s, m) => s + m.savings, 0);
  const debtTotal = actualAmounts.slice(0, selectedMonth + 1).reduce((s, m) => s + m.debt, 0);
  const expensesTotal = actualAmounts.slice(0, selectedMonth + 1).reduce((s, m) => s + m.expenses, 0);

  const expIncExpected = expectedAmounts.slice(0, selectedMonth + 1).reduce((s, m) => s + m.income, 0);
  const expSavExpected = expectedAmounts.slice(0, selectedMonth + 1).reduce((s, m) => s + m.savings, 0);
  const expDebtExpected = expectedAmounts.slice(0, selectedMonth + 1).reduce((s, m) => s + m.debt, 0);
  const expExpExpected = expectedAmounts.slice(0, selectedMonth + 1).reduce((s, m) => s + m.expenses, 0);

  const savingsRate = incomeTotal > 0 ? Math.round((savingsTotal / incomeTotal) * 100) : 0;
  const expenseRate = incomeTotal > 0 ? Math.round((expensesTotal / incomeTotal) * 100) : 0;
  const debtRate = incomeTotal > 0 ? Math.round((debtTotal / incomeTotal) * 100) : 0;
  const monthlySavingsPct = percent(current.savings, expected.savings);
  const monthlySavingsStatus = statusFor(current.savings, expected.savings);
  const expectedSavingsTotal = expectedAmounts.slice(0, selectedMonth + 1).reduce((s, m) => s + m.savings, 0);
  const hasSavingsData = savingsTotal > 0 || expectedSavingsTotal > 0;
  const savingsTrendData = MONTH_SHORT.slice(0, selectedMonth + 1).map((month, index) => ({
    month,
    Actual: getMonthlyAmount(actualAmounts, index).savings,
    Expected: getMonthlyAmount(expectedAmounts, index).savings,
  }));
  const savingsCategories = categories.filter((category) => category.type === "savings");
  const savingsByCategory = savingsTransactionsByCategory(transactions, activeYear, selectedMonth);
  const goalTarget = savingsCategories.length ? expectedSavingsTotal / savingsCategories.length : 0;
  const savingsGoals = (savingsByCategory.length ? savingsByCategory : savingsCategories.map((category) => ({ category: category.name, amount: 0 })))
    .slice(0, 4)
    .map((goal) => ({
      ...goal,
      target: goalTarget,
      pct: percent(goal.amount, goalTarget),
      status: statusFor(goal.amount, goalTarget),
    }));
  const budgetHealthBreakdown = calculateBudgetHealthScore({
    actualIncome: current.income,
    expectedIncome: expected.income,
    actualExpenses: current.expenses,
    expectedExpenses: expected.expenses,
    actualSavings: current.savings,
    expectedSavings: expected.savings,
    actualDebtPayments: current.debt,
    expectedDebtPayments: expected.debt,
    selectedMonth,
    selectedYear: activeYear,
  });
  const budgetHealth = budgetHealthBreakdown.score;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-[var(--financeos-text-primary)]">Savings</h1>
        <p className="text-[var(--financeos-text-muted)] text-sm">Visual progress tracker — YTD through {MONTHS[selectedMonth]} {activeYear}</p>
      </div>

      {/* YTD Progress Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TrackerCard
          label="Income Progress"
          expected={expIncExpected}
          actual={incomeTotal}
          color="text-green-600"
        />
        <TrackerCard
          label="Savings Progress"
          expected={expSavExpected}
          actual={savingsTotal}
          color="text-blue-600"
        />
        <TrackerCard
          label="Debt Payment Progress"
          expected={expDebtExpected}
          actual={debtTotal}
          color="text-red-600"
        />
        <TrackerCard
          label="Expense Limit Progress"
          expected={expExpExpected}
          actual={expensesTotal}
          color="text-orange-600"
          isInverse
        />
      </div>

      {/* This Month */}
      <div>
        <h3 className="text-[var(--financeos-text-primary)] mb-3">{MONTHS[selectedMonth]} {activeYear} - Selected Month</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TrackerCard label="Income" expected={expected.income} actual={current.income} color="text-green-600" />
          <TrackerCard label="Savings" expected={expected.savings} actual={current.savings} color="text-blue-600" />
          <TrackerCard label="Debt" expected={expected.debt} actual={current.debt} color="text-red-600" />
          <TrackerCard label="Expenses" expected={expected.expenses} actual={current.expenses} color="text-orange-600" isInverse />
        </div>
      </div>

      {/* Rate Cards */}
      <div>
        <h3 className="text-[var(--financeos-text-primary)] mb-3">Financial Health Metrics</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RateCard label="Savings Rate" value={savingsRate} color="text-blue-600" desc={`${money(savingsTotal)} saved`} />
          <RateCard label="Expense Rate" value={expenseRate} color={expenseRate < 60 ? "text-green-600" : "text-orange-600"} desc={`${money(expensesTotal)} spent`} />
          <RateCard label="Debt Rate" value={debtRate} color={debtRate < 20 ? "text-green-600" : "text-red-600"} desc={`${money(debtTotal)} paid`} />
          <Card className="overflow-hidden shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-[var(--financeos-text-muted)] mb-1">Budget Health Score</p>
              <div className="relative w-20 h-20 mx-auto my-1">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <defs>
                    <linearGradient id="budgetHealthGradient" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="50%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#6366F1" />
                    </linearGradient>
                  </defs>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9"
                    fill="none"
                    stroke={budgetHealth >= 75 ? "url(#budgetHealthGradient)" : budgetHealth >= 50 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="3"
                    strokeDasharray={`${budgetHealth} ${100 - budgetHealth}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  className={`absolute inset-0 flex items-center justify-center text-sm ${
                    budgetHealth >= 75 ? "text-green-600" : budgetHealth >= 50 ? "text-amber-600" : "text-red-600"
                  }`}
                  style={{ fontWeight: 700 }}
                >
                  {budgetHealth}
                </span>
              </div>
              <p className="text-xs text-[var(--financeos-text-muted)]">
                {budgetHealth >= 75 ? "Excellent" : budgetHealth >= 50 ? "Good" : "Needs Work"}
              </p>
              {previewModeEnabled ? (
                <div className="mt-3 border-t border-[var(--financeos-border)] pt-3 text-left text-[11px] text-[var(--financeos-text-muted)]">
                  <p className="mb-1 text-center text-[var(--financeos-text-secondary)]" style={{ fontWeight: 600 }}>Preview score inputs</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <span>Actual Savings</span><span className="text-right">{money(current.savings)}</span>
                    <span>Expected Savings</span><span className="text-right">{money(expected.savings)}</span>
                    <span>Actual Expenses</span><span className="text-right">{money(current.expenses)}</span>
                    <span>Expected Expenses</span><span className="text-right">{money(expected.expenses)}</span>
                    <span>Actual Debt</span><span className="text-right">{money(current.debt)}</span>
                    <span>Expected Debt</span><span className="text-right">{money(expected.debt)}</span>
                    <span>Final Score</span><span className="text-right">{budgetHealth}</span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--financeos-text-muted)]">Savings trend</p>
                <h3 className="text-base text-[var(--financeos-text-primary)]" style={{ fontWeight: 700 }}>Actual vs Expected Savings</h3>
              </div>
              {previewModeEnabled ? (
                <span className="rounded-full bg-[var(--financeos-warning-bg)] px-3 py-1 text-xs text-[var(--financeos-warning-icon)]" style={{ fontWeight: 700 }}>Preview data</span>
              ) : null}
            </div>
            {hasSavingsData ? (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={savingsTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                    <XAxis dataKey="month" tick={chartMutedTick} axisLine={false} tickLine={false} />
                    <YAxis tick={chartMutedTick} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} width={44} />
                    <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} formatter={(value: number) => [money(value), ""]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={chartLegendStyle} />
                    <Line type="monotone" dataKey="Expected" stroke="#8f98a8" strokeWidth={1.8} dot={false} strokeDasharray="4 3" />
                    <Line type="monotone" dataKey="Actual" stroke="#3B82F6" strokeWidth={2.4} dot={{ r: 3, fill: "#3B82F6", stroke: "var(--financeos-surface)", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[260px] items-center justify-center rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-6 text-center text-sm text-[var(--financeos-text-muted)]">
                No savings data yet. Add expected savings or savings transactions to populate this tracker.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--financeos-text-muted)]">Monthly summary</p>
            <h3 className="mt-1 text-base text-[var(--financeos-text-primary)]" style={{ fontWeight: 700 }}>{MONTHS[selectedMonth]} Savings</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--financeos-text-muted)]">Actual savings</span>
                <span className="text-blue-600" style={{ fontWeight: 700 }}>{money(current.savings)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--financeos-text-muted)]">Expected savings</span>
                <span className="text-[var(--financeos-text-primary)]" style={{ fontWeight: 700 }}>{money(expected.savings)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#2563EB]" style={{ width: `${clamp(monthlySavingsPct)}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${monthlySavingsStatus.tone}`} style={{ fontWeight: 700 }}>{monthlySavingsPct}%</span>
                <span className={`rounded-full px-2 py-1 text-xs ${monthlySavingsStatus.bg} ${monthlySavingsStatus.tone}`} style={{ fontWeight: 700 }}>{monthlySavingsStatus.label}</span>
              </div>
              <div className="rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-3 text-xs text-[var(--financeos-text-muted)]">
                {expected.savings > 0
                  ? `${money(current.savings - expected.savings)} versus the selected-month savings target.`
                  : "No expected savings target is set for this month."}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--financeos-text-muted)]">Savings goals</p>
            <h3 className="text-base text-[var(--financeos-text-primary)]" style={{ fontWeight: 700 }}>Goal Progress Through {MONTHS[selectedMonth]}</h3>
          </div>
          {savingsGoals.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {savingsGoals.map((goal) => (
                <div key={goal.category} className="rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-[var(--financeos-text-primary)]" style={{ fontWeight: 700 }}>{goal.category}</p>
                      <p className="mt-1 text-xs text-[var(--financeos-text-muted)]">{money(goal.amount)} saved</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[11px] ${goal.status.bg} ${goal.status.tone}`} style={{ fontWeight: 700 }}>{goal.status.label}</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#2563EB]" style={{ width: `${clamp(goal.pct)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-[var(--financeos-text-muted)]">
                    <span>{goal.pct}%</span>
                    <span>Target {money(goal.target)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-6 text-center text-sm text-[var(--financeos-text-muted)]">
              No savings goals yet. Add savings categories and expected savings to populate goal progress.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
