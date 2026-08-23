import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Archive,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Download,
  FileBarChart,
  Folder,
  Pencil,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { MONTHS } from "../../lib/constants";
import { SavedMonthlyBudget, SavedYearlyBudget, useFinanceData } from "../../lib/financeStore";
import { cn } from "../ui/utils";
import { formatDateInTimezone } from "../../lib/datePreferences";
import { downloadAnnualReportPdf } from "../../services/generateAnnualReportPdf";

type Selection =
  | { type: "month"; id: string }
  | { type: "year"; id: string };

function money(value: number) {
  return `$${value.toLocaleString()}`;
}

function pct(value: number) {
  return `${value.toLocaleString()}%`;
}

function savedDate(value: string, timezone: string) {
  return formatDateInTimezone(value, timezone, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatCard({ label, value, tone = "text-[var(--financeos-text-primary)]" }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="border-white/10 bg-white/[0.04] shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs text-slate-400">{label}</p>
        <p className={cn("mt-1 text-xl font-semibold", tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function MonthSummary({
  snapshot,
}: {
  snapshot: SavedMonthlyBudget;
}) {
  const {
    timezone,
    deleteSavedMonthlyBudget,
    updateSavedMonthlyBudgetNotes,
    saveMonthlyBudgetSnapshot,
  } = useFinanceData();
  const summary = snapshot.summary_json;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Monthly Summary</p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--financeos-text-primary)]">{summary.month_label} {summary.year}</h2>
          <p className="mt-1 text-sm text-slate-400">Saved {savedDate(snapshot.saved_at, timezone)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="gap-2"
            onClick={() => {
              saveMonthlyBudgetSnapshot(summary.year, summary.month, "overwrite");
              toast.success(`${summary.month_label} ${summary.year} snapshot overwritten.`);
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            Re-save
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="gap-2"
            onClick={() => {
              deleteSavedMonthlyBudget(snapshot.id);
              toast.success("Saved month deleted.");
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Income" value={money(summary.income)} tone="text-emerald-300" />
        <StatCard label="Savings" value={money(summary.savings)} tone="text-cyan-300" />
        <StatCard label="Debt" value={money(summary.debt)} tone="text-rose-300" />
        <StatCard label="Expenses" value={money(summary.expenses)} tone="text-orange-300" />
        <StatCard label="Amount Left" value={money(summary.amount_left)} tone={summary.amount_left >= 0 ? "text-violet-200" : "text-rose-300"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expected vs Actual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Income", summary.expected_income, summary.income, summary.income - summary.expected_income],
              ["Savings", summary.expected_savings, summary.savings, summary.savings - summary.expected_savings],
              ["Debt", summary.expected_debt, summary.debt, summary.debt - summary.expected_debt],
              ["Expenses", summary.expected_expenses, summary.expenses, summary.expected_expenses - summary.expenses],
            ].map(([label, expected, actual, diff]) => (
              <div key={String(label)} className="grid grid-cols-4 gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                <span className="text-slate-300">{label}</span>
                <span className="text-right text-slate-400">{money(Number(expected))}</span>
                <span className="text-right text-slate-200">{money(Number(actual))}</span>
                <span className={cn("text-right", Number(diff) >= 0 ? "text-emerald-300" : "text-rose-300")}>{money(Number(diff))}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rates & Activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <StatCard label="Savings Rate" value={pct(summary.savings_rate)} tone="text-cyan-300" />
            <StatCard label="Expense Rate" value={pct(summary.expense_rate)} tone="text-orange-300" />
            <StatCard label="Debt Rate" value={pct(summary.debt_payment_rate)} tone="text-rose-300" />
            <StatCard label="Transactions" value={`${summary.transaction_count}`} />
            <StatCard label="Pending" value={`${summary.pending_transaction_count}`} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {summary.category_breakdowns.length ? summary.category_breakdowns.map((item) => (
            <div key={item.category} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
              <span className="text-slate-300">{item.category}</span>
              <span className="font-semibold text-[var(--financeos-text-primary)]">{money(item.amount)}</span>
            </div>
          )) : <p className="text-sm text-slate-400">No category spending in this snapshot.</p>}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><Pencil className="h-4 w-4" /> Saved Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={summary.notes}
            placeholder="Add archive notes..."
            onChange={(event) => updateSavedMonthlyBudgetNotes(snapshot.id, event.target.value)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function YearSummary({ snapshot }: { snapshot: SavedYearlyBudget }) {
  const {
    state,
    timezone,
    deleteSavedYearlyBudget,
    updateSavedYearlyBudgetNotes,
    saveYearlyBudgetSnapshot,
  } = useFinanceData();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const summary = snapshot.summary_json;

  async function handleDownloadAnnualReport() {
    try {
      setIsGeneratingPdf(true);
      await downloadAnnualReportPdf(snapshot, state.setupProfile?.budgetName);
      toast.success("Annual report PDF downloaded.");
    } catch (error) {
      console.error(error);
      toast.error("Could not generate PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Annual Summary</p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--financeos-text-primary)]">{summary.year} Year Summary</h2>
          <p className="mt-1 text-sm text-slate-400">Saved {savedDate(snapshot.saved_at, timezone)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={handleDownloadAnnualReport}
            disabled={isGeneratingPdf}
          >
            <Download className="h-4 w-4" />
            {isGeneratingPdf ? "Generating PDF..." : "Download Annual Report PDF"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="gap-2"
            onClick={() => {
              saveYearlyBudgetSnapshot(summary.year, "overwrite");
              toast.success(`${summary.year} year summary overwritten.`);
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            Re-save
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="gap-2"
            onClick={() => {
              deleteSavedYearlyBudget(snapshot.id);
              toast.success("Saved year summary deleted.");
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Income" value={money(summary.total_income)} tone="text-emerald-300" />
        <StatCard label="Total Savings" value={money(summary.total_savings)} tone="text-cyan-300" />
        <StatCard label="Total Debt Paid" value={money(summary.total_debt)} tone="text-rose-300" />
        <StatCard label="Total Expenses" value={money(summary.total_expenses)} tone="text-orange-300" />
        <StatCard label="Total Left" value={money(summary.total_amount_left)} tone={summary.total_amount_left >= 0 ? "text-violet-200" : "text-rose-300"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Year Highlights</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <StatCard label="Best Savings Month" value={summary.best_savings_month} tone="text-cyan-300" />
            <StatCard label="Highest Income Month" value={summary.highest_income_month} tone="text-emerald-300" />
            <StatCard label="Highest Expense Month" value={summary.highest_expense_month} tone="text-orange-300" />
            <StatCard label="Highest Debt Payoff" value={summary.highest_debt_payoff_month} tone="text-rose-300" />
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Category Rankings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.yearly_category_rankings.length ? summary.yearly_category_rankings.slice(0, 6).map((item, index) => (
              <div key={item.category} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] text-xs text-slate-200">{index + 1}</span>
                <span className="flex-1 text-slate-300">{item.category}</span>
                <span className="font-semibold text-[var(--financeos-text-primary)]">{money(item.amount)}</span>
              </div>
            )) : <p className="text-sm text-slate-400">No category spending in this snapshot.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2 pr-3 text-left">Month</th>
                  <th className="px-3 py-2 text-right">Income</th>
                  <th className="px-3 py-2 text-right">Savings</th>
                  <th className="px-3 py-2 text-right">Debt</th>
                  <th className="px-3 py-2 text-right">Expenses</th>
                  <th className="py-2 pl-3 text-right">Left</th>
                </tr>
              </thead>
              <tbody>
                {summary.yearly_monthly_breakdown.map((month) => (
                  <tr key={month.month} className="border-b border-white/5">
                    <td className="py-2 pr-3 text-slate-300">{month.month_label}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{money(month.income)}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{money(month.savings)}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{money(month.debt)}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{money(month.expenses)}</td>
                    <td className="py-2 pl-3 text-right text-[var(--financeos-text-primary)]">{money(month.amount_left)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><Pencil className="h-4 w-4" /> Saved Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={summary.notes}
            placeholder="Add archive notes..."
            onChange={(event) => updateSavedYearlyBudgetNotes(snapshot.id, event.target.value)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function SavedBudgets() {
  const { savedMonthlyBudgets, savedYearlyBudgets } = useFinanceData();
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection | null>(null);

  const allSnapshots = [...savedMonthlyBudgets, ...savedYearlyBudgets];
  const years = useMemo(() => {
    const values = Array.from(new Set(allSnapshots.map((snapshot) => snapshot.year))).sort((a, b) => b.localeCompare(a));
    return values;
  }, [allSnapshots]);

  const groups = years
    .filter((year) => yearFilter === "All" || year === yearFilter)
    .map((year) => ({
      year,
      months: savedMonthlyBudgets
        .filter((snapshot) => snapshot.year === year && snapshot.month_label.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.month - b.month),
      yearly: savedYearlyBudgets.filter((snapshot) => snapshot.year === year),
    }))
    .filter((group) => !query || group.months.length || group.yearly.length || group.year.includes(query));

  const selectedMonth = selection?.type === "month"
    ? savedMonthlyBudgets.find((snapshot) => snapshot.id === selection.id)
    : null;
  const selectedYear = selection?.type === "year"
    ? savedYearlyBudgets.find((snapshot) => snapshot.id === selection.id)
    : null;

  function toggleYear(year: string) {
    setExpandedYears((current) => {
      const next = new Set(current);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Archive</p>
        <h1 className="text-slate-900">Archived Budgets</h1>
        <p className="text-slate-500 text-sm">View archived monthly and yearly budget summaries</p>
      </div>

      {allSnapshots.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Archive className="mx-auto mb-4 h-10 w-10 text-slate-400" />
            <h2 className="text-xl font-semibold text-[var(--financeos-text-primary)]">No archived budgets yet.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              Save a month or year from Reports or Annual Planner to build your archive.
            </p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild><Link to="/reports">Go to Reports</Link></Button>
              <Button asChild variant="outline"><Link to="/annual-planner">Go to Annual Planner</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search saved months or years..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              className="h-10 rounded-xl border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)] px-3 text-sm text-[var(--financeos-text-primary)]"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
            >
              <option>All</option>
              {years.map((year) => <option key={year}>{year}</option>)}
            </select>
          </div>

          <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Archive Directory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groups.map((group) => {
                  const expanded = expandedYears.has(group.year);
                  return (
                    <div key={group.year} className="rounded-[20px] border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-2">
                      <button
                        type="button"
                        onClick={() => toggleYear(group.year)}
                        className="flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-left text-sm text-[var(--financeos-text-primary)] transition-colors hover:bg-[var(--financeos-surface-hover)]"
                      >
                        <Folder className="h-4 w-4 text-slate-400" />
                        <span className="flex-1 font-semibold">{group.year}</span>
                        <span className="text-xs text-slate-500">{group.months.length + group.yearly.length}</span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                      </button>

                      {expanded && (
                        <div className="mt-1 space-y-1 border-l border-[var(--financeos-border)] pl-4">
                          {group.months.map((snapshot) => (
                            <button
                              key={snapshot.id}
                              type="button"
                              onClick={() => setSelection({ type: "month", id: snapshot.id })}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition-colors",
                                selection?.type === "month" && selection.id === snapshot.id
                                  ? "bg-[#8B5CF6]/15 text-[var(--financeos-text-primary)]"
                                  : "text-[var(--financeos-text-muted)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]"
                              )}
                            >
                              <CalendarDays className="h-4 w-4" />
                              <span className="flex-1">{snapshot.month_label}</span>
                              <FileBarChart className="h-4 w-4 text-slate-500" />
                            </button>
                          ))}
                          {group.yearly.map((snapshot) => (
                            <button
                              key={snapshot.id}
                              type="button"
                              onClick={() => setSelection({ type: "year", id: snapshot.id })}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition-colors",
                                selection?.type === "year" && selection.id === snapshot.id
                                  ? "bg-[#8B5CF6]/15 text-[var(--financeos-text-primary)]"
                                  : "text-[var(--financeos-text-muted)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]"
                              )}
                            >
                              <BarChart3 className="h-4 w-4" />
                              <span className="flex-1">Annual Summary</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                {selectedMonth ? (
                  <MonthSummary snapshot={selectedMonth} />
                ) : selectedYear ? (
                  <YearSummary snapshot={selectedYear} />
                ) : (
                  <div className="flex min-h-[24rem] flex-col items-center justify-center text-center">
                    <FileBarChart className="mb-4 h-10 w-10 text-slate-500" />
                    <h2 className="text-lg font-semibold text-[var(--financeos-text-primary)]">Select an archived summary</h2>
                    <p className="mt-2 max-w-sm text-sm text-slate-400">Choose a month or annual summary from the archive directory.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
