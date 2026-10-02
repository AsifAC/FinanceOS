import { useState } from "react";
import { useNavigate } from "react-router";
import { PlusCircle, CheckSquare } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MonthSelector } from "../common/MonthSelector";
import { ElevatedExpenseDonutChart } from "../charts/ElevatedExpenseDonutChart";
import type { Transaction as LocalTransaction } from "../../data/data";
import { getMonthlyAmount } from "../../data/data";
import { useFinanceData } from "../../lib/financeStore";
import { MONTHS, currentMonthIndex } from "../../lib/constants";
import { useTransactions } from "../../../hooks/useTransactions";
import { useCategories } from "../../../hooks/useCategories";
import { getActualTransactionMonths } from "../../lib/actualTransactionTotals";
import { getActualCategoryBreakdown } from "../../lib/actualTransactionCategories";
import { filterTransactionsByMonth, transactionMonthIndex, transactionYear } from "../../lib/transactionDates";
import { resolveCategoryLabel } from "../../lib/categoryLabels";
import { toast } from "sonner";

export function ExpenseTracker() {
  const navigate = useNavigate();
  const { activeYear, setActiveYear, transactions: legacyTransactions, expectedAmounts, markTransactionPaid } = useFinanceData();
  const actual = useTransactions();
  const categoryState = useCategories();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIndex);
  const year = Number(activeYear);
  const actualMonths = getActualTransactionMonths(actual.transactions, year);
  const actualTotal = getMonthlyAmount(actualMonths, selectedMonth).expenses;
  const expected = getMonthlyAmount(expectedAmounts, selectedMonth).expenses;
  const remaining = expected - actualTotal;
  const actualExpenses = filterTransactionsByMonth(actual.transactions, year, selectedMonth)
    .filter((transaction) => transaction.type === "expense");
  const categoryTotals = getActualCategoryBreakdown(
    actual.transactions,
    categoryState.categories,
    "expense",
    year,
    selectedMonth,
  );
  const fixedPlans = legacyTransactions.filter((transaction) =>
    transaction.type === "expense" && transaction.expenseKind === "fixed"
    && transactionYear(transaction.date) === year && transactionMonthIndex(transaction.date) === selectedMonth,
  );

  function getStatusBadge(transaction: LocalTransaction) {
    if (transaction.status === "paid" || transaction.status === "cleared") return <Badge className="bg-green-100 text-green-700 border-0 text-xs">Marked paid (local plan)</Badge>;
    if (!transaction.dueDate) return <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">Planned</Badge>;
    const dueParts = transaction.dueDate.split("-").map(Number);
    const dueTime = Date.UTC(dueParts[0], dueParts[1] - 1, dueParts[2]);
    const today = new Date();
    const todayTime = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const diff = Math.floor((dueTime - todayTime) / 86400000);
    if (diff < 0) return <Badge className="bg-red-100 text-red-700 border-0 text-xs">Overdue plan</Badge>;
    if (diff === 0) return <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">Due today</Badge>;
    return <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">Upcoming plan</Badge>;
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-slate-900">Monthly Expense Tracker</h1>
          <p className="text-slate-500 text-sm">Account actual expenses and separate local fixed-expense planning</p>
        </div>
        <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} months={MONTHS} year={activeYear} onYearChange={setActiveYear} currentMonth={currentMonthIndex} />
      </div>

      {actual.error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700" role="alert">
        <span>Could not load account expenses. Actual expense values are unavailable.</span>
        <button type="button" className="rounded-lg border border-rose-300/50 px-3 py-1.5" onClick={() => void actual.refresh()}>Retry</button>
      </div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-actual-status={actual.isLoading ? "loading" : actual.error ? "error" : "ready"}>
        {[
          { label: "Actual Expenses", value: actualTotal, color: "text-slate-700", bg: "bg-slate-100" },
          { label: "Expected Budget (local)", value: expected, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Remaining vs Plan", value: remaining, color: remaining >= 0 ? "text-green-600" : "text-red-600", bg: remaining >= 0 ? "bg-green-50" : "bg-red-50" },
        ].map(({ label, value, color, bg }) => (
          <Card key={label} className="shadow-sm"><CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-xl ${color}`} style={{ fontWeight: 700 }}>{label === "Expected Budget (local)" ? `$${value.toLocaleString()}` : actual.isLoading ? "Loading…" : actual.error ? "Unavailable" : `$${value.toLocaleString()}`}</p>
            <div className={`mt-3 h-1 rounded-full ${bg}`} />
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="pb-0"><div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">Actual Expense Transactions</CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => navigate("/add-transaction?type=expense")}><PlusCircle className="w-3.5 h-3.5" /> Add Expense</Button>
          </div></CardHeader>
          <CardContent className="pt-3 overflow-x-auto">
            <table className="w-full text-sm min-w-[38rem]"><thead><tr className="border-b border-slate-200">
              <th className="text-left py-2 px-2 text-xs text-slate-500">Date</th><th className="text-left py-2 px-2 text-xs text-slate-500">Title</th><th className="text-left py-2 px-2 text-xs text-slate-500">Category</th><th className="text-right py-2 px-2 text-xs text-slate-500">Amount</th><th className="text-left py-2 px-2 text-xs text-slate-500">Notes</th>
            </tr></thead><tbody>
              {actual.isLoading ? <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400" role="status">Loading account expenses…</td></tr>
                : actual.error ? <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">Actual expense rows unavailable.</td></tr>
                : actualExpenses.length === 0 ? <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">No actual expenses for this month.</td></tr>
                : actualExpenses.map((transaction) => <tr key={transaction.id} className="border-b border-slate-100">
                  <td className="py-2 px-2 text-slate-500 text-xs">{transaction.transaction_date}</td><td className="py-2 px-2 text-slate-800">{transaction.title}</td>
                  <td className="py-2 px-2 text-slate-500">{resolveCategoryLabel(transaction.category_id, categoryState.categories, categoryState.isLoading)}</td>
                  <td className="py-2 px-2 text-right text-slate-800">${transaction.amount.toLocaleString()}</td><td className="py-2 px-2 text-slate-400 text-xs">{transaction.notes || "—"}</td>
                </tr>)}
            </tbody></table>
            {actual.error && <p className="mt-2 text-xs text-slate-500">Retry the account transaction read to restore actual values.</p>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {actual.isLoading || actual.error ? <Card className="shadow-sm"><CardHeader><CardTitle className="text-sm">Actual expenses by category</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">{actual.isLoading ? "Loading account actuals…" : "Unavailable while account transactions fail to load."}</CardContent></Card>
            : <>
              <ElevatedExpenseDonutChart data={categoryTotals.map((item) => ({ category: item.category, amount: item.amount }))} />
              <Card className="shadow-sm"><CardHeader className="pb-0"><CardTitle className="text-sm">Actual expense categories</CardTitle></CardHeader><CardContent className="pt-3"><div className="space-y-2">
                {categoryTotals.map((item) => <div key={item.categoryId ?? "not-assigned"} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0 bg-[#2563EB]" /><span className="text-xs text-slate-600 flex-1">{item.category}</span><span className="text-xs text-slate-800">${item.amount.toLocaleString()}</span></div>)}
                {categoryTotals.length === 0 && <p className="text-xs text-slate-500">No actual expense categories for this month.</p>}
              </div></CardContent></Card>
            </>}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-0"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-sm">Fixed Expense Plans (browser-local)</CardTitle><p className="mt-1 text-xs text-slate-500">Planning obligations only. Marking paid does not create an actual transaction.</p></div>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => navigate("/add-transaction?type=expense")}><PlusCircle className="w-3.5 h-3.5" /> Add Expense</Button></div></CardHeader>
        <CardContent className="pt-3 overflow-x-auto"><table className="w-full text-sm min-w-[38rem]"><thead><tr className="border-b border-slate-200">
          <th className="text-left py-2 px-2 text-xs text-slate-500">Plan status</th><th className="text-left py-2 px-2 text-xs text-slate-500">Name</th><th className="text-left py-2 px-2 text-xs text-slate-500">Local category</th><th className="text-right py-2 px-2 text-xs text-slate-500">Planned amount</th><th className="text-left py-2 px-2 text-xs text-slate-500">Due</th><th className="text-left py-2 px-2 text-xs text-slate-500">Status</th>
        </tr></thead><tbody>{fixedPlans.length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-400">No fixed expense plans for this month.</td></tr> : fixedPlans.map((plan) => <tr key={plan.id} className="border-b border-slate-100">
          <td className="py-2 px-2"><button type="button" onClick={() => { markTransactionPaid(plan.id); toast.success(`${plan.name} local plan updated`); }} className={`w-5 h-5 rounded border-2 inline-flex items-center justify-center ${plan.status === "paid" || plan.status === "cleared" ? "bg-green-500 border-green-500" : "border-slate-300"}`} aria-label={`Mark local plan ${plan.name} paid`}>{(plan.status === "paid" || plan.status === "cleared") && <CheckSquare className="w-3.5 h-3.5 text-white" />}</button></td>
          <td className="py-2 px-2 text-slate-800">{plan.name}</td><td className="py-2 px-2 text-slate-500">{plan.category}</td><td className="py-2 px-2 text-right">${plan.amount.toLocaleString()}</td><td className="py-2 px-2 text-slate-500 text-xs">{plan.dueDate ?? "—"}</td><td className="py-2 px-2">{getStatusBadge(plan)}</td>
        </tr>)}</tbody></table></CardContent>
      </Card>
    </div>
  );
}
