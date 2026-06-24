import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { getMonthlyAmount } from "../../data/data";
import { useFinanceData } from "../../lib/financeStore";
import { MONTHS, currentMonthIndex } from "../../lib/constants";

interface TrackerCardProps {
  label: string;
  expected: number;
  actual: number;
  color: string;
  isInverse?: boolean;
}

function TrackerCard({ label, expected, actual, color, isInverse }: TrackerCardProps) {
  const pct = expected > 0 ? Math.min(Math.round((actual / expected) * 100), 100) : 0;
  const diff = actual - expected;
  const positive = isInverse ? diff <= 0 : diff >= 0;

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
          <div className={`flex items-center gap-1 text-xs ${positive ? "text-green-600" : "text-red-600"}`}>
            {diff === 0 ? <Minus className="w-3 h-3" /> : positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {diff > 0 ? "+" : ""}${diff.toLocaleString()}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Actual: <span className={color} style={{ fontWeight: 600 }}>${actual.toLocaleString()}</span></span>
            <span>Expected: ${expected.toLocaleString()}</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-white/10 shadow-inner shadow-black/40">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className={`text-xs ${positive ? "text-green-600" : "text-red-600"}`} style={{ fontWeight: 600 }}>
              {pct}%
            </span>
            <span className="text-xs text-slate-400">of target</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RateCard({ label, value, color, desc }: { label: string; value: number; color: string; desc: string }) {
  return (
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="p-4 text-center">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className={`text-3xl ${color}`} style={{ fontWeight: 700 }}>{value}%</p>
        <p className="text-xs text-slate-400 mt-1">{desc}</p>
      </CardContent>
    </Card>
  );
}

export function TrackerUI() {
  const { activeYear, actualAmounts, expectedAmounts } = useFinanceData();
  const current = getMonthlyAmount(actualAmounts, currentMonthIndex);
  const expected = getMonthlyAmount(expectedAmounts, currentMonthIndex);
  const incomeTotal = actualAmounts.slice(0, currentMonthIndex + 1).reduce((s, m) => s + m.income, 0);
  const savingsTotal = actualAmounts.slice(0, currentMonthIndex + 1).reduce((s, m) => s + m.savings, 0);
  const debtTotal = actualAmounts.slice(0, currentMonthIndex + 1).reduce((s, m) => s + m.debt, 0);
  const expensesTotal = actualAmounts.slice(0, currentMonthIndex + 1).reduce((s, m) => s + m.expenses, 0);

  const expIncExpected = expectedAmounts.slice(0, currentMonthIndex + 1).reduce((s, m) => s + m.income, 0);
  const expSavExpected = expectedAmounts.slice(0, currentMonthIndex + 1).reduce((s, m) => s + m.savings, 0);
  const expDebtExpected = expectedAmounts.slice(0, currentMonthIndex + 1).reduce((s, m) => s + m.debt, 0);
  const expExpExpected = expectedAmounts.slice(0, currentMonthIndex + 1).reduce((s, m) => s + m.expenses, 0);

  const savingsRate = incomeTotal > 0 ? Math.round((savingsTotal / incomeTotal) * 100) : 0;
  const expenseRate = incomeTotal > 0 ? Math.round((expensesTotal / incomeTotal) * 100) : 0;
  const debtRate = incomeTotal > 0 ? Math.round((debtTotal / incomeTotal) * 100) : 0;
  const budgetHealth = expIncExpected || expSavExpected || expExpExpected
    ? Math.min(100, Math.max(0, Math.round(
      (((expIncExpected ? incomeTotal / expIncExpected : 0) * 30) +
       ((expSavExpected ? savingsTotal / expSavExpected : 0) * 30) +
       ((expExpExpected ? 1 - expensesTotal / expExpExpected : 0) * 40)) * 100
    )))
    : 0;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-slate-900">Tracker UI</h1>
        <p className="text-slate-500 text-sm">Visual progress tracker — YTD through {MONTHS[currentMonthIndex]}</p>
      </div>

      {/* YTD Progress Cards */}
      <div className="grid grid-cols-2 gap-4">
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
        <h3 className="text-slate-700 mb-3">{MONTHS[currentMonthIndex]} {activeYear} - Current Month</h3>
        <div className="grid grid-cols-4 gap-4">
          <TrackerCard label="Income" expected={expected.income} actual={current.income} color="text-green-600" />
          <TrackerCard label="Savings" expected={expected.savings} actual={current.savings} color="text-blue-600" />
          <TrackerCard label="Debt" expected={expected.debt} actual={current.debt} color="text-red-600" />
          <TrackerCard label="Expenses" expected={expected.expenses} actual={current.expenses} color="text-orange-600" isInverse />
        </div>
      </div>

      {/* Rate Cards */}
      <div>
        <h3 className="text-slate-700 mb-3">Financial Health Metrics</h3>
        <div className="grid grid-cols-4 gap-4">
          <RateCard label="Savings Rate" value={savingsRate} color="text-blue-600" desc={`$${savingsTotal.toLocaleString()} saved`} />
          <RateCard label="Expense Rate" value={expenseRate} color={expenseRate < 60 ? "text-green-600" : "text-orange-600"} desc={`$${expensesTotal.toLocaleString()} spent`} />
          <RateCard label="Debt Rate" value={debtRate} color={debtRate < 20 ? "text-green-600" : "text-red-600"} desc={`$${debtTotal.toLocaleString()} paid`} />
          <Card className="overflow-hidden shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Budget Health Score</p>
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
              <p className="text-xs text-slate-400">
                {budgetHealth >= 75 ? "Excellent" : budgetHealth >= 50 ? "Good" : "Needs Work"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
