import { useState } from "react";
import { useNavigate } from "react-router";
import { PlusCircle, TrendingUp } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MonthSelector } from "../common/MonthSelector";
import { getMonthlyAmount } from "../../data/data";
import { useFinanceData } from "../../lib/financeStore";
import { MONTHS, currentMonthIndex } from "../../lib/constants";
import { useTransactions } from "../../../hooks/useTransactions";
import { useCategories } from "../../../hooks/useCategories";
import { getActualTransactionMonths } from "../../lib/actualTransactionTotals";
import { filterTransactionsByMonth } from "../../lib/transactionDates";
import { resolveCategoryLabel } from "../../lib/categoryLabels";

export function IncomeTracker() {
  const navigate = useNavigate();
  const { activeYear, setActiveYear, expectedAmounts } = useFinanceData();
  const { transactions, isLoading, error, refresh } = useTransactions();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIndex);

  const actualMonths = getActualTransactionMonths(transactions, Number(activeYear));
  const monthTransactions = filterTransactionsByMonth(transactions, Number(activeYear), selectedMonth)
    .filter((transaction) => transaction.type === "income");
  const expectedIncome = getMonthlyAmount(expectedAmounts, selectedMonth).income;
  const actualIncome = getMonthlyAmount(actualMonths, selectedMonth).income;
  const variance = actualIncome - expectedIncome;
  const yearToDateIncome = actualMonths
    .slice(0, currentMonthIndex + 1)
    .reduce((sum, month) => sum + month.income, 0);

  return (
    <div className="p-6 space-y-5" data-income-actual-status={isLoading ? "loading" : error ? "error" : "ready"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-slate-900">Income</h1>
          <p className="text-slate-500 text-sm">Account actual income compared with the local expected plan</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSelector
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            months={MONTHS}
            year={activeYear}
            onYearChange={setActiveYear}
            currentMonth={currentMonthIndex}
          />
          <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => navigate("/add-transaction?type=income")}>
            <PlusCircle className="w-4 h-4" /> Add Income
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: "Actual Income", value: actualIncome, color: "text-green-600", bg: "bg-green-50" },
          { label: "Expected Income (local)", value: expectedIncome, color: "text-slate-700", bg: "bg-slate-100" },
          { label: "Variance", value: variance, color: variance >= 0 ? "text-green-600" : "text-red-600", bg: variance >= 0 ? "bg-green-50" : "bg-red-50" },
          { label: "Year to Date", value: yearToDateIncome, color: "text-blue-600", bg: "bg-blue-50" },
        ].map(({ label, value, color, bg }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-xl ${color}`} style={{ fontWeight: 700 }}>{label.startsWith("Expected Income") ? `$${value.toLocaleString()}` : isLoading ? "Loading…" : error ? "Unavailable" : `$${value.toLocaleString()}`}</p>
              <div className={`mt-3 h-1 rounded-full ${bg}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700" role="alert">
        <span>Could not load account income transactions. Actual income is unavailable.</span>
        <button type="button" className="rounded-lg border border-rose-300/50 px-3 py-1.5" onClick={() => void refresh()}>Retry</button>
      </div>}

      <Card className="shadow-sm">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Income Entries</CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => navigate("/add-transaction?type=income")}>
              <PlusCircle className="w-3.5 h-3.5" /> Add Income
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2 text-xs text-slate-500">Date</th>
                <th className="text-left py-2 px-2 text-xs text-slate-500">Name</th>
                <th className="text-left py-2 px-2 text-xs text-slate-500">Category</th>
                <th className="text-right py-2 px-2 text-xs text-slate-500">Amount</th>
                <th className="text-left py-2 px-2 text-xs text-slate-500">Notes</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400" role="status">Loading account income…</td></tr>
              ) : error ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">Income rows are unavailable.</td></tr>
              ) : monthTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 px-2 text-center">
                    <TrendingUp className="mx-auto mb-2 h-5 w-5 text-green-500" />
                    <p className="text-sm text-slate-400">No income entries yet.</p>
                    <Button size="sm" className="mt-3 gap-1.5" onClick={() => navigate("/add-transaction?type=income")}>
                      <PlusCircle className="w-3.5 h-3.5" /> Add Income
                    </Button>
                  </td>
                </tr>
              ) : monthTransactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-2 text-slate-500 text-xs">{transaction.transaction_date}</td>
                  <td className="py-2 px-2 text-slate-800">{transaction.title}</td>
                  <td className="py-2 px-2 text-slate-500">{resolveCategoryLabel(transaction.category_id, categories, categoriesLoading)}</td>
                  <td className="py-2 px-2 text-right text-green-600" style={{ fontWeight: 500 }}>${transaction.amount}</td>
                  <td className="py-2 px-2 text-slate-400 text-xs">{transaction.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
