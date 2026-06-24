import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MonthSelector } from "../common/MonthSelector";
import { MONTHS, currentMonthIndex } from "../../lib/constants";
import { getAmountLeft, getZeroMonth, useFinanceData } from "../../lib/financeStore";
import { toast } from "sonner";

export function ExpectedAmounts() {
  const { activeYear, setActiveYear, expectedAmounts, updateMonthlyPlan } = useFinanceData();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIndex);
  const [amounts, setAmounts] = useState(
    expectedAmounts.length ? expectedAmounts.map((m) => ({ ...m })) : MONTHS.map((_, month) => getZeroMonth(month))
  );

  const current = amounts[selectedMonth];
  const amountLeft = getAmountLeft(current);

  function update(field: keyof typeof current, value: string) {
    setAmounts(amounts.map((m, i) =>
      i === selectedMonth ? { ...m, [field]: parseFloat(value) || 0 } : m
    ));
  }

  const categories = [
    { key: "income" as const, label: "Income", color: "text-green-600", bg: "bg-green-50", border: "border-l-green-500" },
    { key: "savings" as const, label: "Savings", color: "text-blue-600", bg: "bg-blue-50", border: "border-l-blue-500" },
    { key: "debt" as const, label: "Debt Payments", color: "text-red-600", bg: "bg-red-50", border: "border-l-red-500" },
    { key: "expenses" as const, label: "Expenses", color: "text-orange-600", bg: "bg-orange-50", border: "border-l-orange-500" },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900">Expected Amounts</h1>
          <p className="text-slate-500 text-sm">Plan your monthly budget amounts</p>
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

      {expectedAmounts.length === 0 && (
        <Card className="shadow-sm border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-[var(--financeos-text-primary)]" style={{ fontWeight: 600 }}>No expected amounts set yet.</p>
            <p className="mt-1 text-sm text-slate-400">Use the form below to add your first monthly plan.</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Exp. Income", value: current.income, color: "text-green-600" },
          { label: "Exp. Savings", value: current.savings, color: "text-blue-600" },
          { label: "Exp. Debt", value: current.debt, color: "text-red-600" },
          { label: "Exp. Expenses", value: current.expenses, color: "text-orange-600" },
          { label: "Exp. Amount Left", value: amountLeft, color: amountLeft >= 0 ? "text-purple-600" : "text-red-600" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-xl ${color}`} style={{ fontWeight: 700 }}>${value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Input Form */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">{MONTHS[selectedMonth]} Budget Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categories.map(({ key, label, color, bg, border }) => (
              <div key={key} className={`border-l-4 ${border} ${bg} rounded-r-lg p-3`}>
                <p className={`text-xs mb-1.5 ${color}`} style={{ fontWeight: 600 }}>Expected {label}</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <Input
                    className="pl-7 bg-white"
                    type="number"
                    value={current[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </div>
              </div>
            ))}

            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Amount Left Formula</p>
                  <p className="text-xs text-slate-400 mt-0.5">Income − Savings − Debt − Expenses</p>
                </div>
                <p className={`text-xl ${amountLeft >= 0 ? "text-purple-600" : "text-red-600"}`} style={{ fontWeight: 700 }}>
                  ${amountLeft.toLocaleString()}
                </p>
              </div>
            </div>

            <Button
              onClick={() => {
                updateMonthlyPlan(selectedMonth, current);
                toast.success(`${MONTHS[selectedMonth]} budget saved!`);
              }}
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="w-4 h-4" /> Save {MONTHS[selectedMonth]} Budget
            </Button>
          </CardContent>
        </Card>

        {/* All Months Overview */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Year Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-1.5 px-1 text-slate-500">Month</th>
                    <th className="text-right py-1.5 px-1 text-green-600">Income</th>
                    <th className="text-right py-1.5 px-1 text-blue-600">Savings</th>
                    <th className="text-right py-1.5 px-1 text-red-600">Debt</th>
                    <th className="text-right py-1.5 px-1 text-orange-600">Exp.</th>
                    <th className="text-right py-1.5 px-1 text-purple-600">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {amounts.map((m, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelectedMonth(i)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors ${
                        i === selectedMonth ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-1.5 px-1 text-slate-700" style={{ fontWeight: i === selectedMonth ? 600 : 400 }}>
                        {MONTHS[i].slice(0, 3)}
                      </td>
                      <td className="py-1.5 px-1 text-right text-slate-600">${m.income.toLocaleString()}</td>
                      <td className="py-1.5 px-1 text-right text-slate-600">${m.savings}</td>
                      <td className="py-1.5 px-1 text-right text-slate-600">${m.debt}</td>
                      <td className="py-1.5 px-1 text-right text-slate-600">${m.expenses.toLocaleString()}</td>
                      <td className={`py-1.5 px-1 text-right ${getAmountLeft(m) >= 0 ? "text-green-600" : "text-red-600"}`} style={{ fontWeight: 500 }}>
                        ${getAmountLeft(m).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
