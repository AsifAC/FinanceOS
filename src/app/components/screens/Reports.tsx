import { useMemo } from "react";
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
import { useFinanceData } from "../../lib/financeStore";
import { MONTHS, MONTH_SHORT } from "../../lib/constants";
import { useSnapshotActualData } from "../../../hooks/useSnapshotActualData";
import { getActualTransactionMonths, amountLeftForActualMonth } from "../../lib/actualTransactionTotals";
import { getActualCategoryBreakdown } from "../../lib/actualTransactionCategories";

type ActualStatus = "loading" | "error" | "ready";

function ActualChartState({ status }: { status: ActualStatus }) {
  return <div className="flex h-[300px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-slate-400" role={status === "error" ? "alert" : "status"}>
    {status === "loading" ? "Loading account actuals…" : "Actual report data unavailable. Retry loading account transactions above."}
  </div>;
}

export function Reports() {
  const { activeYear, expectedAmounts } = useFinanceData();
  const snapshotData = useSnapshotActualData();
  const { transactions, categories, transactionsLoading: isLoading, categoriesLoading, error, refresh, categoriesError } = snapshotData;
  const actualStatus: ActualStatus = isLoading ? "loading" : error ? "error" : "ready";
  const actualAmounts = useMemo(() => getActualTransactionMonths(transactions, Number(activeYear)), [transactions, activeYear]);
  const expenseCategoryData = useMemo(() => getActualCategoryBreakdown(transactions, categories, "expense", Number(activeYear)), [transactions, categories, activeYear]);
  const barData = MONTH_SHORT.map((m, i) => ({
    month: m,
    Expected: getMonthlyAmount(expectedAmounts, i).income,
    Actual: getMonthlyAmount(actualAmounts, i).income,
    "Exp. Left": getAmountLeft(getMonthlyAmount(expectedAmounts, i)),
    "Act. Left": amountLeftForActualMonth(getMonthlyAmount(actualAmounts, i)),
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
  const monthsWithIncome = actualAmounts
    .map((m, i) => ({ month: MONTHS[i], left: amountLeftForActualMonth(m), income: m.income }))
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
    <div className="p-6 space-y-5" data-report-actual-status={actualStatus}>
      {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700" role="alert">
        <span>Could not load account transactions. Report actuals are unavailable.</span>
        <button type="button" className="rounded-lg border border-rose-300/50 px-3 py-1.5 hover:bg-rose-500/5" onClick={() => void refresh()}>Retry</button>
      </div>}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-slate-900">Reports</h1>
          <p className="text-slate-500 text-sm">{activeYear} annual insights · actual account data and local planning</p>
        </div>
          <SaveSnapshotActions actualData={snapshotData} />
      </div>
      <p className="text-xs text-slate-500">New snapshots store this account’s actuals and local expected plans in your account archive. Legacy browser-local archives remain separate.</p>

      {/* Best/Worst Month Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-[#00D68F]/20">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 mb-1" style={{ fontWeight: 600 }}>Best Month</p>
            <p className="text-xl text-green-700" style={{ fontWeight: 700 }}>{actualStatus === "loading" ? "Loading…" : actualStatus === "error" ? "Unavailable" : bestMonth?.month ?? "No data"}</p>
            <p className="text-sm text-green-600">{actualStatus !== "ready" ? "Account actuals unavailable." : bestMonth ? `$${bestMonth.left.toLocaleString()} left over` : "No tracked months yet."}</p>
          </CardContent>
        </Card>
        <Card className="border-[#EF4444]/20">
          <CardContent className="p-4">
            <p className="text-xs text-red-600 mb-1" style={{ fontWeight: 600 }}>Worst Month</p>
            <p className="text-xl text-red-700" style={{ fontWeight: 700 }}>{actualStatus === "loading" ? "Loading…" : actualStatus === "error" ? "Unavailable" : worstMonth?.month ?? "No data"}</p>
            <p className="text-sm text-red-600">{actualStatus !== "ready" ? "Account actuals unavailable." : worstMonth ? `$${worstMonth.left.toLocaleString()} left over` : "No tracked months yet."}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">YTD Income</p>
            <p className="text-xl text-green-600" style={{ fontWeight: 700 }}>
              {actualStatus === "loading" ? "Loading…" : actualStatus === "error" ? "Unavailable" : `$${ytdIncome.toLocaleString()}`}
            </p>
            <p className="text-xs text-slate-400">{actualStatus === "ready" ? `${trackedMonthCount} months tracked` : "Account actuals"}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">YTD Savings</p>
            <p className="text-xl text-blue-600" style={{ fontWeight: 700 }}>
              {actualStatus === "loading" ? "Loading…" : actualStatus === "error" ? "Unavailable" : `$${ytdSavings.toLocaleString()}`}
            </p>
            <p className="text-xs text-slate-400">{actualStatus === "ready" ? `avg. $${trackedMonthCount ? Math.round(ytdSavings / trackedMonthCount) : 0}/mo` : "Account actuals"}</p>
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
              <p className="mt-1 text-xs text-slate-500">Actual: account transactions · Expected: local plan</p>
            </div>
          </CardHeader>
          <CardContent className="relative px-3 pb-4 pt-4 sm:px-5 sm:pb-5">
            {actualStatus !== "ready" ? <ActualChartState status={actualStatus} /> : hasBudgetChartData ? (
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

        {actualStatus !== "ready" || categoriesLoading ? (
          <Card><CardContent className="pt-4">{actualStatus !== "ready" ? <ActualChartState status={actualStatus} /> : <div className="flex min-h-[22rem] items-center justify-center text-sm text-slate-400" role="status">Loading account category labels…</div>}</CardContent></Card>
        ) : <div>{categoriesError && <p className="mb-2 text-xs text-slate-500">Some category names are unavailable; unresolved references are shown neutrally.</p>}<ElevatedExpenseDonutChart data={expenseCategoryData} /></div>}
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-0">
            <div><CardTitle className="text-sm">Savings Trend</CardTitle><p className="mt-1 text-xs text-slate-500">Actual: account transactions · Expected: local plan</p></div>
          </CardHeader>
          <CardContent className="relative pt-3">
            {actualStatus !== "ready" ? <ActualChartState status={actualStatus} /> : hasSavingsTrendData ? (
            <div className="h-[260px] w-full sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savingsTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                <XAxis dataKey="month" tick={chartMutedTick} axisLine={false} tickLine={false} />
                <YAxis tick={chartMutedTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={44} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} formatter={(v: number) => [`$${v}`, ""]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={chartLegendStyle} />
                <Line type="monotone" dataKey="Expected" stroke="#8f98a8" strokeWidth={1.8} dot={false} strokeDasharray="4 3" />
                <Line type="monotone" dataKey="Savings" stroke="#2563EB" strokeWidth={2.4} dot={{ r: 3, fill: "#2563EB", stroke: "#16181D", strokeWidth: 2 }} activeDot={{ r: 5 }} />
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
            <div><CardTitle className="text-sm">Income Trend</CardTitle><p className="mt-1 text-xs text-slate-500">Actual: account transactions · Expected: local plan</p></div>
          </CardHeader>
          <CardContent className="relative pt-3">
            {actualStatus !== "ready" ? <ActualChartState status={actualStatus} /> : hasIncomeTrendData ? (
            <div className="h-[260px] w-full sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={incomeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                <XAxis dataKey="month" tick={chartMutedTick} axisLine={false} tickLine={false} />
                <YAxis tick={chartMutedTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={44} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} formatter={(v: number) => [`$${v}`, ""]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={chartLegendStyle} />
                <Line type="monotone" dataKey="Expected" stroke="#8f98a8" strokeWidth={1.8} dot={false} strokeDasharray="4 3" />
                <Line type="monotone" dataKey="Income" stroke="#00A676" strokeWidth={2.4} dot={{ r: 3, fill: "#00A676", stroke: "#16181D", strokeWidth: 2 }} activeDot={{ r: 5 }} />
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
                {actualStatus !== "ready" ? <tr key="actual-state"><td colSpan={7} className="py-8 text-center text-slate-500">{actualStatus === "loading" ? "Loading account actuals…" : "Report actuals unavailable. Retry loading account transactions above."}</td></tr> : MONTHS.map((month, i) => {
                  const m = getMonthlyAmount(actualAmounts, i);
                  const expected = getMonthlyAmount(expectedAmounts, i);
                  const left = amountLeftForActualMonth(m);
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
