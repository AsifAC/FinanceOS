import { useState } from "react";
import { CheckCircle, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MONTHS, currentMonthIndex } from "../../lib/constants";
import { useFinanceData } from "../../lib/financeStore";
import { getWeekStartOffset } from "../../lib/datePreferences";
import { toast } from "sonner";

type Filter = "All" | "Overdue" | "Due Today" | "Upcoming";

function getDueStatus(dueDate: string): { label: string; class: string; filter: Filter } {
  const today = new Date();
  const due = new Date(dueDate);
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: "Overdue", class: "bg-red-100 text-red-700", filter: "Overdue" };
  if (diff === 0) return { label: "Due Today", class: "bg-purple-100 text-purple-700", filter: "Due Today" };
  return { label: `Due in ${diff}d`, class: "bg-blue-100 text-blue-700", filter: "Upcoming" };
}

const today = new Date();
export function PendingTransactions() {
  const { activeYear, startDayOfWeek, pendingTransactions, markTransactionPaid } = useFinanceData();
  const [filter, setFilter] = useState<Filter>("All");
  const daysInCurrentMonth = new Date(Number(activeYear), currentMonthIndex + 1, 0).getDate();
  const firstDayOffset = getWeekStartOffset(new Date(Number(activeYear), currentMonthIndex, 1).getDay(), startDayOfWeek);
  const weekdayLabels = startDayOfWeek === "monday" ? ["M", "T", "W", "T", "F", "S", "S"] : ["S", "M", "T", "W", "T", "F", "S"];
  const miniCalendar = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  const filtered = pendingTransactions.filter((t) => {
    if (filter === "All") return true;
    return getDueStatus(t.dueDate!).filter === filter;
  });

  function markPaid(id: string, name: string) {
    markTransactionPaid(id);
    toast.success(`${name} marked as paid`);
  }

  const dueDays = pendingTransactions
    .map((t) => ({
      day: new Date(t.dueDate!).getDate(),
      status: getDueStatus(t.dueDate!),
    }));

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-slate-900">Pending Transactions</h1>
        <p className="text-slate-500 text-sm">Fixed expenses and planned payments not yet paid</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Filter buttons */}
          <div className="flex gap-2">
            {(["All", "Overdue", "Due Today", "Upcoming"] as Filter[]).map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  filter === f
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {f}
                {f === "Overdue" && (
                  <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 rounded-full">
                    {pendingTransactions.filter((t) => getDueStatus(t.dueDate!).filter === "Overdue").length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <Card className="shadow-sm">
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-300" />
                  <p className="text-sm">No pending transactions yet.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 text-xs text-slate-500">Name</th>
                      <th className="text-left py-3 px-3 text-xs text-slate-500">Category</th>
                      <th className="text-right py-3 px-3 text-xs text-slate-500">Amount</th>
                      <th className="text-left py-3 px-3 text-xs text-slate-500">Due Date</th>
                      <th className="text-left py-3 px-3 text-xs text-slate-500">Status</th>
                      <th className="py-3 px-4 text-xs text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => {
                      const status = getDueStatus(t.dueDate!);
                      return (
                        <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 text-slate-800" style={{ fontWeight: 500 }}>{t.name}</td>
                          <td className="py-3 px-3 text-slate-500">{t.category}</td>
                          <td className="py-3 px-3 text-right text-slate-800" style={{ fontWeight: 500 }}>${t.amount}</td>
                          <td className="py-3 px-3 text-slate-500 text-xs">{t.dueDate}</td>
                          <td className="py-3 px-3">
                            <Badge className={`${status.class} border-0 text-xs`}>{status.label}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => markPaid(t.id, t.name)}
                              >
                                Mark Paid
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => toast.info("Original transaction details are not available yet.")}
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Mini Calendar */}
        <Card className="shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm">{MONTHS[currentMonthIndex]} {activeYear}</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {weekdayLabels.map((d, i) => (
                <span key={i} className="text-xs text-slate-400">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {Array.from({ length: firstDayOffset }, (_, i) => <div key={`offset-${i}`} />)}
              {miniCalendar.map((day) => {
                const match = dueDays.find((d) => d.day === day);
                const isToday = day === today.getDate();
                return (
                  <div
                    key={day}
                    className={`text-xs w-7 h-7 flex items-center justify-center rounded-full mx-auto
                      ${isToday ? "financeos-today-cell bg-slate-900 text-white" : ""}
                      ${match && !isToday ? match.status.class : ""}
                      ${!match && !isToday ? "text-slate-500" : ""}
                    `}
                    title={match ? `${match.status.label}` : undefined}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full bg-red-200" />
                <span className="text-slate-600">Overdue</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full bg-purple-200" />
                <span className="text-slate-600">Due Today</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full bg-blue-200" />
                <span className="text-slate-600">Upcoming</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
