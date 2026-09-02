import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { MonthSelector } from "../common/MonthSelector";
import { SaveSnapshotActions } from "../archive/SaveSnapshotActions";
import {
  chartAxisTick,
  chartGridStroke,
  chartLegendStyle,
  chartTooltipLabelStyle,
  chartTooltipStyle,
} from "../charts/chartTheme";
import {
  getAmountLeft, getMonthlyAmount, MonthlyAmount,
} from "../../data/data";
import { useFinanceData } from "../../lib/financeStore";
import { MONTHS, MONTH_SHORT, currentMonthIndex } from "../../lib/constants";

const tabs = ["Expected", "Actual", "Compare", "Rankings"] as const;
type Tab = typeof tabs[number];

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

export function AnnualPlanner() {
  const { activeYear, setActiveYear, actualAmounts, expectedAmounts } = useFinanceData();
  const [activeTab, setActiveTab] = useState<Tab>("Expected");
  const [startMonth, setStartMonth] = useState(0);
  const [endMonth, setEndMonth] = useState(11);

  const visibleMonths = MONTHS.slice(startMonth, endMonth + 1);
  const visibleExpected = MONTHS.slice(startMonth, endMonth + 1).map((_, index) => getMonthlyAmount(expectedAmounts, startMonth + index));
  const visibleActual = MONTHS.slice(startMonth, endMonth + 1).map((_, index) => getMonthlyAmount(actualAmounts, startMonth + index));
  const compareData = MONTH_SHORT.map((m, i) => ({
    month: m,
    "Exp. Income": getMonthlyAmount(expectedAmounts, i).income,
    "Act. Income": getMonthlyAmount(actualAmounts, i).income,
    "Exp. Left": getAmountLeft(getMonthlyAmount(expectedAmounts, i)),
    "Act. Left": getAmountLeft(getMonthlyAmount(actualAmounts, i)),
  }));
  const rankingMonths = MONTHS.map((month, i) => {
    const m = getMonthlyAmount(actualAmounts, i);
    return {
      month,
      savings: m.savings,
      income: m.income,
      debt: m.debt,
      expenses: m.expenses,
      left: getAmountLeft(m),
    };
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-slate-900">Annual Planner & Tracker</h1>
          <p className="text-slate-500 text-sm">{activeYear} - 12-month budget view</p>
        </div>
        <SaveSnapshotActions defaultMonth={startMonth} />
      </div>

      {/* Filters */}
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

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === t
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
            style={{ fontWeight: activeTab === t ? 500 : 400 }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Expected / Actual Tab */}
      {(activeTab === "Expected" || activeTab === "Actual") && (
        <Card className="shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-slate-600 sticky left-0 bg-slate-50 min-w-[120px]">Category</th>
                  {visibleMonths.map((m) => (
                    <th key={m} className="py-3 px-3 text-slate-600 text-right whitespace-nowrap">{m.slice(0, 3)}</th>
                  ))}
                  <th className="py-3 px-4 text-right text-slate-600 bg-slate-100">Total</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const data = activeTab === "Expected" ? visibleExpected : visibleActual;
                  const values = data.map((m) => getRowValue(m, row));
                  const total = values.reduce((s, v) => s + v, 0);
                  return (
                    <tr key={row} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className={`py-2.5 px-4 sticky left-0 bg-white ${rowColors[row]}`} style={{ fontWeight: 500 }}>
                        {row}
                      </td>
                      {values.map((v, i) => (
                        <td key={i} className={`py-2.5 px-3 text-right ${v === 0 ? "text-slate-300" : "text-slate-700"}`}>
                          ${v.toLocaleString()}
                        </td>
                      ))}
                      <td className={`py-2.5 px-4 text-right bg-slate-50 ${rowColors[row]}`} style={{ fontWeight: 600 }}>
                        ${total.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Compare Tab */}
      {activeTab === "Compare" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {["Income", "Savings", "Amount Left"].map((metric) => {
              const exp = expectedAmounts.reduce((s, m) => s + (metric === "Income" ? m.income : metric === "Savings" ? m.savings : getAmountLeft(m)), 0);
              const act = actualAmounts.slice(0, 6).reduce((s, m) => s + (metric === "Income" ? m.income : metric === "Savings" ? m.savings : getAmountLeft(m)), 0);
              const diff = act - exp / 2;
              return (
                <Card key={metric} className="shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-600">{metric}</p>
                    <div className="flex items-end gap-3 mt-2">
                      <div>
                        <p className="text-xs text-slate-400">Expected (6mo)</p>
                        <p className="text-lg text-slate-800" style={{ fontWeight: 600 }}>${(exp / 2).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Actual (6mo)</p>
                        <p className={`text-lg ${diff >= 0 ? "text-green-600" : "text-red-600"}`} style={{ fontWeight: 600 }}>${act.toLocaleString()}</p>
                      </div>
                    </div>
                    <Badge className={`mt-2 text-xs ${diff >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} border-0`}>
                      {diff >= 0 ? "+" : ""}${diff.toFixed(0)}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Card>
            <CardHeader className="pb-0">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Planner compare</p>
              <CardTitle className="text-sm">Expected vs Actual — Income & Amount Left</CardTitle>
            </CardHeader>
            <CardContent className="relative pt-3">
              <div className="h-[300px] w-full sm:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData.slice(startMonth, endMonth + 1)} barSize={16} barGap={4} barCategoryGap="16%" margin={{ top: 14, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                  <XAxis dataKey="month" tick={chartAxisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={44} />
                  <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} formatter={(v: number) => [`$${v}`, ""]} />
                  <Legend iconType="circle" iconSize={9} wrapperStyle={chartLegendStyle} />
                  <Bar dataKey="Exp. Income" fill="#14B8A6" radius={[7, 7, 2, 2]} />
                  <Bar dataKey="Act. Income" fill="#2563EB" radius={[7, 7, 2, 2]} />
                  <Bar dataKey="Exp. Left" fill="#8B5CF6" radius={[7, 7, 2, 2]} />
                  <Bar dataKey="Act. Left" fill="#06B6D4" radius={[7, 7, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rankings Tab */}
      {activeTab === "Rankings" && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { title: "Best Months by Savings", key: "savings", color: "text-blue-600" },
            { title: "Highest Income Months", key: "income", color: "text-green-600" },
            { title: "Highest Expense Months", key: "expenses", color: "text-orange-600" },
            { title: "Best Amount Left Months", key: "left", color: "text-purple-600" },
          ].map(({ title, key, color }) => {
            const sorted = [...rankingMonths]
              .filter((m) => (m as any)[key] > 0)
              .sort((a, b) => (b as any)[key] - (a as any)[key]);
            return (
              <Card key={title} className="shadow-sm">
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm">{title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="space-y-2">
                    {sorted.slice(0, 5).map((m, i) => (
                      <div key={m.month} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-xs flex items-center justify-center text-slate-500" style={{ fontWeight: 600 }}>
                          {i + 1}
                        </span>
                        <span className="text-sm text-slate-700 flex-1">{m.month}</span>
                        <span className={`text-sm ${color}`} style={{ fontWeight: 600 }}>
                          ${((m as any)[key]).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
