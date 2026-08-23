import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { SaveSnapshotActions } from "../archive/SaveSnapshotActions";
import { ElevatedExpenseDonutChart } from "../charts/ElevatedExpenseDonutChart";
import {
  ACTUAL_COLOR,
  ACTUAL_HOVER_COLOR,
  chartAxisTick,
  chartGridStroke,
  chartLegendStyle,
  chartMutedTick,
  chartTooltipLabelStyle,
  chartTooltipStyle,
  EXPECTED_COLOR,
  EXPECTED_HOVER_COLOR,
} from "../charts/chartTheme";
import {
  getAmountLeft, getMonthlyAmount,
} from "../../data/data";
import { getExpenseCategoryData, useFinanceData } from "../../lib/financeStore";
import { MONTHS, MONTH_SHORT } from "../../lib/constants";

export function Reports() {
  const { activeYear, actualAmounts, expectedAmounts, transactions } = useFinanceData();
  const barData = MONTH_SHORT.map((m, i) => ({
    month: m,
    Expected: getMonthlyAmount(expectedAmounts, i).income,
    Actual: getMonthlyAmount(actualAmounts, i).income,
    "Exp. Left": getAmountLeft(getMonthlyAmount(expectedAmounts, i)),
    "Act. Left": getAmountLeft(getMonthlyAmount(actualAmounts, i)),
  }));
  const savingsTrend = MONTH_SHORT.map((m, i) => ({
    month: m,
    Savings: getMonthlyAmount(actualAmounts, i).savings,
    Expected: getMonthlyAmount(expectedAmounts, i).savings,
  }));
  const incomeTrend = MONTH_SHORT.map((m, i) => ({
    month: m,
    Income: getMonthlyAmount(actualAmounts, i).income,
    Expected: getMonthlyAmount(expectedAmounts, i).income,
  }));
  const expenseCategoryData = getExpenseCategoryData(transactions);
  const monthsWithIncome = actualAmounts
    .map((m, i) => ({ month: MONTHS[i], left: getAmountLeft(m), income: m.income }))
    .filter((m) => m.income > 0);
  const bestMonth = [...monthsWithIncome].sort((a, b) => b.left - a.left)[0];
  const worstMonth = [...monthsWithIncome].sort((a, b) => a.left - b.left)[0];
  const ytdIncome = actualAmounts.reduce((sum, month) => sum + month.income, 0);
  const ytdSavings = actualAmounts.reduce((sum, month) => sum + month.savings, 0);
  const trackedMonthCount = actualAmounts.filter((month) => month.income || month.savings || month.debt || month.expenses).length;
  const hasBudgetChartData = barData.some((item) => item.Expected || item.Actual || item["Exp. Left"] || item["Act. Left"]);
  const hasSavingsTrendData = savingsTrend.some((item) => item.Savings || item.Expected);
  const hasIncomeTrendData = incomeTrend.some((item) => item.Income || item.Expected);

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-slate-900">Reports</h1>
          <p className="text-slate-500 text-sm">{activeYear} annual financial insights and summaries</p>
        </div>
        <SaveSnapshotActions />
      </div>

      {/* Best/Worst Month Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-[#00D68F]/20">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 mb-1" style={{ fontWeight: 600 }}>Best Month</p>
            <p className="text-xl text-green-700" style={{ fontWeight: 700 }}>{bestMonth?.month ?? "No data"}</p>
            <p className="text-sm text-green-600">{bestMonth ? `$${bestMonth.left.toLocaleString()} left over` : "No tracked months yet."}</p>
          </CardContent>
        </Card>
        <Card className="border-[#EF4444]/20">
          <CardContent className="p-4">
            <p className="text-xs text-red-600 mb-1" style={{ fontWeight: 600 }}>Worst Month</p>
            <p className="text-xl text-red-700" style={{ fontWeight: 700 }}>{worstMonth?.month ?? "No data"}</p>
            <p className="text-sm text-red-600">{worstMonth ? `$${worstMonth.left.toLocaleString()} left over` : "No tracked months yet."}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">YTD Income</p>
            <p className="text-xl text-green-600" style={{ fontWeight: 700 }}>
              ${ytdIncome.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400">{trackedMonthCount} months tracked</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">YTD Savings</p>
            <p className="text-xl text-blue-600" style={{ fontWeight: 700 }}>
              ${ytdSavings.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400">avg. ${trackedMonthCount ? Math.round(ytdSavings / trackedMonthCount) : 0}/mo</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="relative pb-0">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Annual performance</p>
              <CardTitle className="mt-1 text-base text-[var(--financeos-text-primary)]">Expected vs Actual Income</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative px-3 pb-4 pt-4 sm:px-5 sm:pb-5">
            {hasBudgetChartData ? (
            <div className="h-[300px] w-full sm:h-[360px] lg:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barSize={18} barGap={5} barCategoryGap="18%" margin={{ top: 14, right: 10, left: 2, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                <XAxis dataKey="month" tick={chartAxisTick} axisLine={false} tickLine={false} />
                <YAxis tick={chartMutedTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={44} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.06)", radius: 12 }}
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
              <div className="flex h-[300px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-slate-400 sm:h-[360px] lg:h-[400px]">
                No budget data yet. Add expected amounts and transactions to compare your plan.
              </div>
            )}
          </CardContent>
        </Card>

        <ElevatedExpenseDonutChart data={expenseCategoryData} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Savings Trend</CardTitle>
          </CardHeader>
          <CardContent className="relative pt-3">
            {hasSavingsTrendData ? (
            <div className="h-[260px] w-full sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savingsTrend}>
                <defs>
                  <linearGradient id="savingsLineGradient" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#2563EB" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                <XAxis dataKey="month" tick={chartMutedTick} axisLine={false} tickLine={false} />
                <YAxis tick={chartMutedTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={44} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} formatter={(v: number) => [`$${v}`, ""]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={chartLegendStyle} />
                <Line type="monotone" dataKey="Expected" stroke="#8f98a8" strokeWidth={1.8} dot={false} strokeDasharray="4 3" />
                <Line type="monotone" dataKey="Savings" stroke="url(#savingsLineGradient)" strokeWidth={2.4} dot={{ r: 3, fill: "#3B82F6", stroke: "#16181D", strokeWidth: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
            </div>
            ) : (
              <div className="flex h-[260px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-slate-400 sm:h-[300px]">
                No savings data yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">Income Trend</CardTitle>
          </CardHeader>
          <CardContent className="relative pt-3">
            {hasIncomeTrendData ? (
            <div className="h-[260px] w-full sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={incomeTrend}>
                <defs>
                  <linearGradient id="incomeLineGradient" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#00D68F" />
                    <stop offset="100%" stopColor="#00C26E" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                <XAxis dataKey="month" tick={chartMutedTick} axisLine={false} tickLine={false} />
                <YAxis tick={chartMutedTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={44} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} formatter={(v: number) => [`$${v}`, ""]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={chartLegendStyle} />
                <Line type="monotone" dataKey="Expected" stroke="#8f98a8" strokeWidth={1.8} dot={false} strokeDasharray="4 3" />
                <Line type="monotone" dataKey="Income" stroke="url(#incomeLineGradient)" strokeWidth={2.4} dot={{ r: 3, fill: "#00D68F", stroke: "#16181D", strokeWidth: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
            </div>
            ) : (
              <div className="flex h-[260px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-slate-400 sm:h-[300px]">
                No income data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 12-Month Summary Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">12-Month Actual Summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-slate-500">Month</th>
                  <th className="text-right py-2 px-2 text-green-600">Income</th>
                  <th className="text-right py-2 px-2 text-blue-600">Savings</th>
                  <th className="text-right py-2 px-2 text-red-600">Debt</th>
                  <th className="text-right py-2 px-2 text-orange-600">Expenses</th>
                  <th className="text-right py-2 px-2 text-purple-600">Left</th>
                  <th className="text-right py-2 px-2 text-slate-500">Score</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((month, i) => {
                  const m = getMonthlyAmount(actualAmounts, i);
                  const expected = getMonthlyAmount(expectedAmounts, i);
                  const left = getAmountLeft(m);
                  const score = m.income > 0
                    ? Math.min(100, Math.round((left / m.income) * 100 + (expected.savings ? (m.savings / expected.savings) * 30 : 0)))
                    : null;
                  return (
                    <tr key={month} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-2 text-slate-700" style={{ fontWeight: 500 }}>{month}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{m.income ? `$${m.income.toLocaleString()}` : "—"}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{m.savings ? `$${m.savings}` : "—"}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{m.debt ? `$${m.debt}` : "—"}</td>
                      <td className="py-2 px-2 text-right text-slate-600">{m.expenses ? `$${m.expenses.toLocaleString()}` : "—"}</td>
                      <td className={`py-2 px-2 text-right ${left > 0 ? "text-green-600" : left < 0 ? "text-red-600" : "text-slate-300"}`} style={{ fontWeight: left !== 0 ? 600 : 400 }}>
                        {m.income ? `$${left.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {score !== null ? (
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            score >= 75 ? "bg-green-100 text-green-700" :
                            score >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                          }`}>
                            {score}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
