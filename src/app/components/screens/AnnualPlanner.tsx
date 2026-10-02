import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { MonthSelector } from "../common/MonthSelector";
import { SaveSnapshotActions } from "../archive/SaveSnapshotActions";
import {
  ACTUAL_COLOR,
  chartAxisTick,
  chartGridStroke,
  chartLegendStyle,
  chartTooltipLabelStyle,
  chartTooltipStyle,
  EXPECTED_COLOR,
} from "../charts/chartTheme";
import {
  getAmountLeft, getMonthlyAmount, MonthlyAmount,
} from "../../data/data";
import { useFinanceData } from "../../lib/financeStore";
import { useSnapshotActualData } from "../../../hooks/useSnapshotActualData";
import { getActualTransactionMonths, getActualTransactionYearTotals } from "../../lib/actualTransactionTotals";
import { MONTHS, MONTH_SHORT, currentMonthIndex } from "../../lib/constants";

const tabs = ["Expected", "Actual", "Compare", "Rankings"] as const;
type Tab = typeof tabs[number];
type ActualStatus = "loading" | "error" | "ready";

const ROWS = ["Income", "Savings", "Debt", "Expenses", "Amount Left"] as const;

function getRowValue(data: MonthlyAmount, row: typeof ROWS[number]) {
  if (row === "Income") return data.income;
  if (row === "Savings") return data.savings;
  if (row === "Debt") return data.debt;
  if (row === "Expenses") return data.expenses;
  return getAmountLeft(data);
}

const rowColors: Record<string, string> = {
  Income: "text-green-600",
  Savings: "text-blue-600",
  Debt: "text-red-600",
  Expenses: "text-orange-600",
  "Amount Left": "text-purple-600",
};

function ActualState({ status }: { status: ActualStatus }) {
  return (
    <div className="flex min-h-48 items-center justify-center p-6 text-center text-sm text-slate-500" role={status === "error" ? "alert" : "status"}>
      {status === "loading" ? "Loading account actuals…" : "Account actuals unavailable. Retry loading transactions above."}
    </div>
  );
}

export function AnnualPlanner() {
  const { activeYear, setActiveYear, expectedAmounts } = useFinanceData();
  const snapshotActualData = useSnapshotActualData();
  const { transactions, transactionsLoading: actualLoading, error: actualError, refresh } = snapshotActualData;
  const [activeTab, setActiveTab] = useState<Tab>("Expected");
  const [startMonth, setStartMonth] = useState(0);
  const [endMonth, setEndMonth] = useState(11);

  const actualStatus: ActualStatus = actualLoading ? "loading" : actualError ? "error" : "ready";
  const actualMonths = useMemo(
    () => getActualTransactionMonths(transactions, Number(activeYear)),
    [transactions, activeYear],
  );
  const visibleMonths = MONTHS.slice(startMonth, endMonth + 1);
  const visibleExpected = visibleMonths.map((_, index) => getMonthlyAmount(expectedAmounts, startMonth + index));
  const visibleActual = visibleMonths.map((_, index) => getMonthlyAmount(actualMonths, startMonth + index));
  const yearActualTotals = useMemo(() => getActualTransactionYearTotals(actualMonths), [actualMonths]);
  const hasYearActuals = actualMonths.some((month) => month.income || month.expenses || month.savings || month.debt);

  const compareData = MONTH_SHORT.map((month, index) => {
    const expected = getMonthlyAmount(expectedAmounts, index);
    const actual = getMonthlyAmount(actualMonths, index);
    return {
      month,
      "Exp. Income": expected.income,
      "Act. Income": actual.income,
      "Exp. Left": getAmountLeft(expected),
      "Act. Left": getAmountLeft(actual),
    };
  });
  const rankingMonths = MONTHS.map((month, index) => {
    const data = getMonthlyAmount(actualMonths, index);
    return {
      month,
      savings: data.savings,
      income: data.income,
      debt: data.debt,
      expenses: data.expenses,
      left: getAmountLeft(data),
    };
  });
  const visibleCompareData = compareData.slice(startMonth, endMonth + 1);

  return (
    <div className="space-y-4 p-6" data-annual-actual-status={actualStatus}>
      {actualError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700" role="alert">
          <span>Could not load account transactions. Annual Planner actuals are unavailable.</span>
          <button type="button" className="rounded-lg border border-rose-300/50 px-3 py-1.5 hover:bg-rose-500/5" onClick={() => void refresh()}>Retry</button>
        </div>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-slate-900">Annual Planner &amp; Tracker</h1>
          <p className="text-slate-500 text-sm">{activeYear} · Actual: account transactions · Expected: local plan</p>
        </div>
        <SaveSnapshotActions defaultMonth={startMonth} actualData={snapshotActualData} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">From</span>
          <MonthSelector
            selectedMonth={startMonth}
            onMonthChange={setStartMonth}
            months={MONTHS}
            year={activeYear}
            onYearChange={setActiveYear}
            currentMonth={currentMonthIndex}
            label="Start month"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">To</span>
          <MonthSelector
            selectedMonth={endMonth}
            onMonthChange={setEndMonth}
            months={MONTHS}
            year={activeYear}
            onYearChange={setActiveYear}
            currentMonth={currentMonthIndex}
            label="End month"
          />
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors sm:px-4 ${activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            style={{ fontWeight: activeTab === tab ? 500 : 400 }}
          >
            {tab}
          </button>
        ))}
      </div>

      {(activeTab === "Expected" || activeTab === "Actual") && (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 min-w-[120px] bg-slate-50 px-4 py-3 text-left text-slate-600">Category</th>
                  {visibleMonths.map((month) => (
                    <th key={month} className="whitespace-nowrap px-3 py-3 text-right text-slate-600">{month.slice(0, 3)}</th>
                  ))}
                  <th className="bg-slate-100 px-4 py-3 text-right text-slate-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {activeTab === "Actual" && actualStatus !== "ready" ? (
                  <tr><td colSpan={visibleMonths.length + 2}><ActualState status={actualStatus} /></td></tr>
                ) : ROWS.map((row) => {
                  const data = activeTab === "Expected" ? visibleExpected : visibleActual;
                  const values = data.map((month) => getRowValue(month, row));
                  const total = values.reduce((sum, value) => sum + value, 0);
                  return (
                    <tr key={row} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className={`sticky left-0 bg-white px-4 py-2.5 ${rowColors[row]}`} style={{ fontWeight: 500 }}>{row}</td>
                      {values.map((value, index) => (
                        <td key={index} className={`px-3 py-2.5 text-right ${value === 0 ? "text-slate-300" : "text-slate-700"}`}>${value.toLocaleString()}</td>
                      ))}
                      <td className={`bg-slate-50 px-4 py-2.5 text-right ${rowColors[row]}`} style={{ fontWeight: 600 }}>${total.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {activeTab === "Actual" && actualStatus === "ready" && !hasYearActuals && (
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500" role="status">No account actual transactions for {activeYear}; actual values are $0.</p>
          )}
          <p className="px-4 pb-3 text-xs text-slate-500">{activeTab === "Expected" ? "Expected values · local planning" : "Actual values · authenticated Supabase transactions"}</p>
        </Card>
      )}

      {activeTab === "Compare" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {["Income", "Savings", "Amount Left"].map((metric) => {
              const expectedTotal = expectedAmounts.reduce((sum, month) => sum + (metric === "Income" ? month.income : metric === "Savings" ? month.savings : getAmountLeft(month)), 0);
              const expectedSixMonths = expectedTotal / 2;
              const actualSixMonths = actualMonths.slice(0, 6).reduce((sum, month) => sum + (metric === "Income" ? month.income : metric === "Savings" ? month.savings : getAmountLeft(month)), 0);
              const difference = actualSixMonths - expectedSixMonths;
              return (
                <Card key={metric} className="shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-600">{metric}</p>
                    <div className="mt-2 flex items-end gap-3">
                      <div>
                        <p className="text-xs text-slate-400">Expected (6mo) · local</p>
                        <p className="text-lg text-slate-800" style={{ fontWeight: 600 }}>${expectedSixMonths.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Actual (6mo) · account</p>
                        <p className={`text-lg ${actualStatus === "ready" ? difference >= 0 ? "text-green-600" : "text-red-600" : "text-slate-400"}`} style={{ fontWeight: 600 }}>
                          {actualStatus === "loading" ? "Loading…" : actualStatus === "error" ? "Unavailable" : `$${actualSixMonths.toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                    {actualStatus === "ready" && <Badge className={`mt-2 border-0 text-xs ${difference >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {difference >= 0 ? "+" : ""}${difference.toFixed(0)}
                    </Badge>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Card>
            <CardHeader className="pb-0">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Planner compare</p>
              <CardTitle className="text-sm">Expected vs Actual · Income &amp; Amount Left</CardTitle>
              <p className="text-xs text-slate-500">Actual: account transactions · Expected: local plan</p>
            </CardHeader>
            <CardContent className="relative pt-3">
              {actualStatus !== "ready" ? <ActualState status={actualStatus} /> : (
                <div className="h-[300px] w-full sm:h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visibleCompareData} barSize={16} barGap={4} barCategoryGap="16%" margin={{ top: 14, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                      <XAxis dataKey="month" tick={chartAxisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} width={44} />
                      <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} formatter={(value: number) => [`$${value}`, ""]} />
                      <Legend iconType="circle" iconSize={9} wrapperStyle={chartLegendStyle} />
                      <Bar dataKey="Exp. Income" fill={EXPECTED_COLOR} radius={[7, 7, 2, 2]} />
                      <Bar dataKey="Act. Income" fill={ACTUAL_COLOR} radius={[7, 7, 2, 2]} />
                      <Bar dataKey="Exp. Left" fill={EXPECTED_COLOR} fillOpacity={0.55} radius={[7, 7, 2, 2]} />
                      <Bar dataKey="Act. Left" fill={ACTUAL_COLOR} fillOpacity={0.65} radius={[7, 7, 2, 2]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "Rankings" && (actualStatus !== "ready" ? <Card><ActualState status={actualStatus} /></Card> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { title: "Best Months by Savings", key: "savings", color: "text-blue-600" },
            { title: "Highest Income Months", key: "income", color: "text-green-600" },
            { title: "Highest Expense Months", key: "expenses", color: "text-orange-600" },
            { title: "Best Amount Left Months", key: "left", color: "text-purple-600" },
          ].map(({ title, key, color }) => {
            const sorted = [...rankingMonths]
              .filter((month) => (month as any)[key] > 0)
              .sort((a, b) => (b as any)[key] - (a as any)[key]);
            return (
              <Card key={title} className="shadow-sm">
                <CardHeader className="pb-0"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
                <CardContent className="pt-3">
                  <div className="space-y-2">
                    {sorted.slice(0, 5).map((month, index) => (
                      <div key={month.month} className="flex items-center gap-3">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500" style={{ fontWeight: 600 }}>{index + 1}</span>
                        <span className="flex-1 text-sm text-slate-700">{month.month}</span>
                        <span className={`text-sm ${color}`} style={{ fontWeight: 600 }}>${((month as any)[key]).toLocaleString()}</span>
                      </div>
                    ))}
                    {sorted.length === 0 && <p className="text-sm text-slate-500">No account actuals to rank for {activeYear}.</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}
      {actualStatus === "ready" && <p className="text-xs text-slate-500">Annual account actual totals: Income ${yearActualTotals.income.toLocaleString()} · Expenses ${yearActualTotals.expense.toLocaleString()} · Savings ${yearActualTotals.savings.toLocaleString()} · Debt ${yearActualTotals.debt.toLocaleString()} · Amount Left ${yearActualTotals.amountLeft.toLocaleString()}</p>}
    </div>
  );
}
