import { useState } from "react";
import { useNavigate } from "react-router";
import { PlusCircle, CheckSquare } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MonthSelector } from "../common/MonthSelector";
import { ElevatedExpenseDonutChart } from "../charts/ElevatedExpenseDonutChart";
import { Transaction, getMonthlyAmount } from "../../data/data";
import { getExpenseCategoryData, shouldCountAsActual, useFinanceData } from "../../lib/financeStore";
import { MONTHS, currentMonthIndex } from "../../lib/constants";
import { toast } from "sonner";

export function ExpenseTracker() {
  const navigate = useNavigate();
  const { activeYear, setActiveYear, transactions, expectedAmounts, markTransactionPaid } = useFinanceData();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIndex);

  const monthTransactions = transactions.filter((transaction) => {
    const month = Number(transaction.date.slice(5, 7)) - 1;
    return month === selectedMonth;
  });
  const fixed = monthTransactions.filter((t) => t.type === "expense" && t.expenseKind === "fixed");
  const variable = monthTransactions.filter((t) => t.type === "expense" && t.expenseKind !== "fixed");

  const totalFixed = fixed.filter(shouldCountAsActual).reduce((s, t) => s + t.amount, 0);
  const totalVariable = variable.filter(shouldCountAsActual).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = totalFixed + totalVariable;
  const remaining = getMonthlyAmount(expectedAmounts, selectedMonth).expenses - totalExpenses;

  const categoryTotals = getExpenseCategoryData(monthTransactions);

  const categoryChartData = categoryTotals.map((category) => ({
    category: category.category,
    amount: category.amount,
  }));

  function getStatusBadge(t: Transaction) {
    if (t.status === "paid" || t.status === "cleared") return <Badge className="bg-green-100 text-green-700 border-0 text-xs">Paid</Badge>;
    if (!t.dueDate) return <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">Pending</Badge>;
    const today = new Date();
    const due = new Date(t.dueDate);
    const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return <Badge className="bg-red-100 text-red-700 border-0 text-xs">Overdue</Badge>;
    if (diff === 0) return <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">Due Today</Badge>;
    return <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">Upcoming</Badge>;
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900">Monthly Expense Tracker</h1>
          <p className="text-slate-500 text-sm">Track fixed and variable expenses</p>
        </div>
        <MonthSelector
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          months={MONTHS}
          year={activeYear}
          onYearChange={setActiveYear}
          currentMonth={currentMonthIndex}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Fixed Expenses Paid", value: totalFixed, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Variable Expenses", value: totalVariable, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Total Expenses", value: totalExpenses, color: "text-slate-700", bg: "bg-slate-100" },
          { label: "Remaining Budget", value: remaining, color: remaining >= 0 ? "text-green-600" : "text-red-600", bg: remaining >= 0 ? "bg-green-50" : "bg-red-50" },
        ].map(({ label, value, color, bg }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-xl ${color}`} style={{ fontWeight: 700 }}>${value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Fixed Expenses */}
          <Card className="shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Fixed Expenses</CardTitle>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => navigate("/add-transaction?type=expense")}>
                  <PlusCircle className="w-3.5 h-3.5" /> Add Fixed
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 text-xs text-slate-500">Paid</th>
                    <th className="text-left py-2 px-2 text-xs text-slate-500">Name</th>
                    <th className="text-left py-2 px-2 text-xs text-slate-500">Category</th>
                    <th className="text-right py-2 px-2 text-xs text-slate-500">Amount</th>
                    <th className="text-left py-2 px-2 text-xs text-slate-500">Due</th>
                    <th className="text-left py-2 px-2 text-xs text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fixed.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 px-2 text-center">
                        <p className="text-sm text-slate-400">No transactions yet.</p>
                        <Button size="sm" className="mt-3 gap-1.5" onClick={() => navigate("/add-transaction?type=expense")}>
                          <PlusCircle className="w-3.5 h-3.5" /> Add Transaction
                        </Button>
                      </td>
                    </tr>
                  ) : fixed.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 ${shouldCountAsActual(t) ? "opacity-60" : ""}`}
                    >
                      <td className="py-2 px-2">
                        <button
                          type="button"
                          onClick={() => {
                            markTransactionPaid(t.id);
                            toast.success(`${t.name} marked as paid`);
                          }}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            shouldCountAsActual(t) ? "bg-green-500 border-green-500" : "border-slate-300 hover:border-green-400"
                          }`}
                        >
                          {shouldCountAsActual(t) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                        </button>
                      </td>
                      <td className="py-2 px-2 text-slate-800">{t.name}</td>
                      <td className="py-2 px-2 text-slate-500">{t.category}</td>
                      <td className="py-2 px-2 text-right text-slate-800" style={{ fontWeight: 500 }}>${t.amount}</td>
                      <td className="py-2 px-2 text-slate-500 text-xs">{t.dueDate ? t.dueDate.split("-")[2] + "th" : "—"}</td>
                      <td className="py-2 px-2">{getStatusBadge(t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Variable Expenses */}
          <Card className="shadow-sm">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Variable Expenses</CardTitle>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => navigate("/add-transaction?type=expense")}>
                  <PlusCircle className="w-3.5 h-3.5" /> Add Variable
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <table className="w-full text-sm">
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
                  {variable.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 px-2 text-center">
                        <p className="text-sm text-slate-400">No transactions yet.</p>
                        <Button size="sm" className="mt-3 gap-1.5" onClick={() => navigate("/add-transaction?type=expense")}>
                          <PlusCircle className="w-3.5 h-3.5" /> Add Transaction
                        </Button>
                      </td>
                    </tr>
                  ) : variable.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 px-2 text-slate-500 text-xs">{t.date}</td>
                      <td className="py-2 px-2 text-slate-800">{t.name}</td>
                      <td className="py-2 px-2 text-slate-500">{t.category}</td>
                      <td className="py-2 px-2 text-right text-slate-800" style={{ fontWeight: 500 }}>${t.amount}</td>
                      <td className="py-2 px-2 text-slate-400 text-xs">{t.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Category Chart */}
        <div className="space-y-4">
          <ElevatedExpenseDonutChart data={categoryChartData} />
          <Card className="shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">Category Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="space-y-2">
                {categoryTotals.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0 bg-gradient-to-br from-[#3B82F6] to-[#2563EB]" />
                    <span className="text-xs text-slate-600 flex-1">{c.category}</span>
                    <span className="text-xs text-slate-800" style={{ fontWeight: 500 }}>${c.amount}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
