import { useState } from "react";
import { useNavigate } from "react-router";
import { PlusCircle, TrendingUp } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MonthSelector } from "../common/MonthSelector";
import { getMonthlyAmount } from "../../data/data";
import { useFinanceData } from "../../lib/financeStore";
import { MONTHS, currentMonthIndex } from "../../lib/constants";

export function IncomeTracker() {
  const navigate = useNavigate();
  const { activeYear, setActiveYear, transactions, expectedAmounts, actualAmounts } = useFinanceData();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIndex);

  const monthTransactions = transactions.filter((transaction) => {
    const month = Number(transaction.date.slice(5, 7)) - 1;
    return transaction.type === "income" && month === selectedMonth;
  });
  const expectedIncome = getMonthlyAmount(expectedAmounts, selectedMonth).income;
  const actualIncome = getMonthlyAmount(actualAmounts, selectedMonth).income;
  const variance = actualIncome - expectedIncome;
  const yearToDateIncome = actualAmounts
    .slice(0, currentMonthIndex + 1)
    .reduce((sum, month) => sum + month.income, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-slate-900">Income</h1>
          <p className="text-slate-500 text-sm">Track income entries and compare them with expected income</p>
        </div>
        <div className="flex items-center gap-2">
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
          { label: "Expected Income", value: expectedIncome, color: "text-slate-700", bg: "bg-slate-100" },
          { label: "Variance", value: variance, color: variance >= 0 ? "text-green-600" : "text-red-600", bg: variance >= 0 ? "bg-green-50" : "bg-red-50" },
          { label: "Year to Date", value: yearToDateIncome, color: "text-blue-600", bg: "bg-blue-50" },
        ].map(({ label, value, color, bg }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-xl ${color}`} style={{ fontWeight: 700 }}>${value.toLocaleString()}</p>
              <div className={`mt-3 h-1 rounded-full ${bg}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Income Entries</CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => navigate("/add-transaction?type=income")}>
              <PlusCircle className="w-3.5 h-3.5" /> Add Income
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
              {monthTransactions.length === 0 ? (
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
                  <td className="py-2 px-2 text-slate-500 text-xs">{transaction.date}</td>
                  <td className="py-2 px-2 text-slate-800">{transaction.name}</td>
                  <td className="py-2 px-2 text-slate-500">{transaction.category}</td>
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
