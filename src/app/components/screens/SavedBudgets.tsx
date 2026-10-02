import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Archive, BarChart3, CalendarDays, Download, FileBarChart, Folder, Pencil, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Textarea } from "../ui/textarea";
import { MONTHS } from "../../lib/constants";
import {
  buildMonthlySummary, buildYearlySummary, type MonthlyBudgetSummary, type SavedMonthlyBudget,
  type SavedYearlyBudget, type YearlyBudgetSummary, useFinanceData,
} from "../../lib/financeStore";
import { formatDateInTimezone } from "../../lib/datePreferences";
import { downloadAnnualReportPdf } from "../../services/generateAnnualReportPdf";
import { useSnapshotActualData } from "../../../hooks/useSnapshotActualData";
import { useSnapshots } from "../../../hooks/useSnapshots";
import type { AccountSnapshot } from "../../../services/snapshotService";

type Selection = { source: "account" | "legacy"; scope: "month" | "year"; id: string };

function money(value: number) { return `$${value.toLocaleString()}`; }
function savedDate(value: string, timezone: string) {
  return formatDateInTimezone(value, timezone, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function asMonth(row: AccountSnapshot): SavedMonthlyBudget {
  const summary = row.summary as MonthlyBudgetSummary;
  return { id: row.id, budget_year_id: summary.budget_year_id, year: summary.year, month: summary.month,
    month_label: summary.month_label, saved_at: summary.saved_at, summary_json: summary,
    created_at: row.created_at, updated_at: row.updated_at };
}
function asYear(row: AccountSnapshot): SavedYearlyBudget {
  const summary = row.summary as YearlyBudgetSummary;
  return { id: row.id, budget_year_id: summary.budget_year_id, year: summary.year, saved_at: summary.saved_at,
    summary_json: summary, created_at: row.created_at, updated_at: row.updated_at };
}

function Stat({ label, value, tone = "text-[var(--financeos-text-primary)]" }: { label: string; value: string; tone?: string }) {
  return <Card className="border-white/10 bg-white/[0.04]"><CardContent className="p-4"><p className="text-xs text-slate-400">{label}</p><p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p></CardContent></Card>;
}

function MonthlyDetail({ snapshot, legacy, timezone, onDelete, onNotes, onResave }: {
  snapshot: SavedMonthlyBudget; legacy: boolean; timezone: string;
  onDelete?: (id: string) => void; onNotes?: (id: string, notes: string) => void;
  onResave?: (snapshot: SavedMonthlyBudget) => void;
}) {
  const summary = snapshot.summary_json;
  const [notes, setNotes] = useState(summary.notes);
  useEffect(() => setNotes(summary.notes), [snapshot.id, summary.notes]);
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Monthly Summary {legacy && "· Legacy local"}</p>
        <h2 className="mt-1 text-2xl font-semibold text-[var(--financeos-text-primary)]">{summary.month_label} {summary.year}</h2>
        <p className="mt-1 text-sm text-slate-400">Saved {savedDate(snapshot.saved_at, timezone)}</p></div>
      <div className="flex flex-wrap gap-2">{onResave && <Button size="sm" variant="secondary" className="gap-2" onClick={() => onResave(snapshot)}><RefreshCcw className="h-4 w-4" />Update from current data</Button>}
        {onDelete && <Button size="sm" variant="destructive" className="gap-2" onClick={() => onDelete(snapshot.id)}><Trash2 className="h-4 w-4" />Delete</Button>}</div>
    </div>
    <p className="text-xs text-slate-400">{legacy ? "Legacy browser-local snapshot. Stored values are shown as saved and are not part of your account archive." : "Actual values are stored from Supabase at capture time; expected values are local planning data. This saved record is not recalculated."}</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Stat label="Income" value={money(summary.income)} tone="text-emerald-300"/><Stat label="Savings" value={money(summary.savings)} tone="text-cyan-300"/>
      <Stat label="Debt" value={money(summary.debt)} tone="text-rose-300"/><Stat label="Expenses" value={money(summary.expenses)} tone="text-orange-300"/>
      <Stat label="Amount Left" value={money(summary.amount_left)} tone={summary.amount_left >= 0 ? "text-violet-200" : "text-rose-300"}/>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-white/10 bg-white/[0.04]"><CardHeader className="pb-2"><CardTitle className="text-sm">Expected vs Actual</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
        {[["Income", summary.expected_income, summary.income], ["Savings", summary.expected_savings, summary.savings], ["Debt", summary.expected_debt, summary.debt], ["Expenses", summary.expected_expenses, summary.expenses]].map(([label, expected, actual]) => <div key={String(label)} className="grid grid-cols-3 gap-2 rounded-xl bg-white/[0.04] px-3 py-2"><span>{label}</span><span className="text-right text-slate-400">Plan {money(Number(expected))}</span><span className="text-right">{money(Number(actual))}</span></div>)}
      </CardContent></Card>
      <Card className="border-white/10 bg-white/[0.04]"><CardHeader className="pb-2"><CardTitle className="text-sm">Rates & Activity</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">
        <Stat label="Savings Rate" value={`${summary.savings_rate}%`}/><Stat label="Expense Rate" value={`${summary.expense_rate}%`}/><Stat label="Debt Rate" value={`${summary.debt_payment_rate}%`}/><Stat label="Actual Transactions" value={`${summary.transaction_count}`}/><Stat label="Pending Plan Items" value={`${summary.pending_transaction_count}`}/>
      </CardContent></Card>
    </div>
    <Card className="border-white/10 bg-white/[0.04]"><CardHeader className="pb-2"><CardTitle className="text-sm">Category Breakdown</CardTitle></CardHeader><CardContent className="space-y-2">
      {summary.category_breakdowns.length ? summary.category_breakdowns.map((item, i) => <div key={`${item.category}-${i}`} className="flex justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm"><span>{item.category}</span><span className="font-semibold">{money(item.amount)}</span></div>) : <p className="text-sm text-slate-400">No category spending in this snapshot.</p>}
    </CardContent></Card>
    <Card className="border-white/10 bg-white/[0.04]"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Pencil className="h-4 w-4"/>Saved Notes</CardTitle></CardHeader><CardContent><Textarea value={notes} placeholder="Add archive notes..." disabled={!onNotes} onChange={(event) => setNotes(event.target.value)}/>{onNotes ? <Button size="sm" className="mt-2" onClick={() => onNotes(snapshot.id, notes)}>Save Notes</Button> : <p className="mt-1 text-xs text-slate-500">Legacy notes are read-only here.</p>}</CardContent></Card>
  </div>;
}

function YearlyDetail({ snapshot, legacy, timezone, budgetName, onDelete, onNotes, onResave }: {
  snapshot: SavedYearlyBudget; legacy: boolean; timezone: string; budgetName?: string;
  onDelete?: (id: string) => void; onNotes?: (id: string, notes: string) => void;
  onResave?: (snapshot: SavedYearlyBudget) => void;
}) {
  const summary = snapshot.summary_json;
  const [notes, setNotes] = useState(summary.notes);
  const [generating, setGenerating] = useState(false);
  useEffect(() => setNotes(summary.notes), [snapshot.id, summary.notes]);
  async function exportPdf() {
    setGenerating(true);
    try { await downloadAnnualReportPdf(snapshot, budgetName); toast.success("Annual report PDF downloaded."); }
    catch { toast.error("Could not generate PDF. Please try again."); }
    finally { setGenerating(false); }
  }
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Annual Summary {legacy && "· Legacy local"}</p><h2 className="mt-1 text-2xl font-semibold">{summary.year} Year Summary</h2><p className="mt-1 text-sm text-slate-400">Saved {savedDate(snapshot.saved_at, timezone)}</p></div>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" className="gap-2" onClick={() => void exportPdf()} disabled={generating}><Download className="h-4 w-4"/>{generating ? "Generating PDF…" : "Download Annual Report PDF"}</Button>{onResave && <Button size="sm" variant="secondary" className="gap-2" onClick={() => onResave(snapshot)}><RefreshCcw className="h-4 w-4"/>Update from current data</Button>}{onDelete && <Button size="sm" variant="destructive" className="gap-2" onClick={() => onDelete(snapshot.id)}><Trash2 className="h-4 w-4"/>Delete</Button>}</div>
    </div>
    <p className="text-xs text-slate-400">{legacy ? "Legacy browser-local snapshot. Stored values are shown as saved and are not part of your account archive." : "Actual values are stored from Supabase at capture time; expected values are local planning data. This saved record is not recalculated."}</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Total Income" value={money(summary.total_income)} tone="text-emerald-300"/><Stat label="Total Savings" value={money(summary.total_savings)} tone="text-cyan-300"/><Stat label="Total Debt Paid" value={money(summary.total_debt)} tone="text-rose-300"/><Stat label="Total Expenses" value={money(summary.total_expenses)} tone="text-orange-300"/><Stat label="Total Left" value={money(summary.total_amount_left)} tone="text-violet-200"/></div>
    <div className="grid gap-4 lg:grid-cols-2"><Card className="border-white/10 bg-white/[0.04]"><CardHeader className="pb-2"><CardTitle className="text-sm">Year Highlights</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2"><Stat label="Best Savings Month" value={summary.best_savings_month}/><Stat label="Highest Income Month" value={summary.highest_income_month}/><Stat label="Highest Expense Month" value={summary.highest_expense_month}/><Stat label="Highest Debt Payoff" value={summary.highest_debt_payoff_month}/><Stat label="Actual Transactions" value={`${summary.transaction_count ?? 0}`}/></CardContent></Card>
      <Card className="border-white/10 bg-white/[0.04]"><CardHeader className="pb-2"><CardTitle className="text-sm">Category Rankings</CardTitle></CardHeader><CardContent className="space-y-2">{summary.yearly_category_rankings.length ? summary.yearly_category_rankings.slice(0, 10).map((item, i) => <div key={`${item.category}-${i}`} className="flex justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm"><span>{i + 1}. {item.category}</span><span>{money(item.amount)}</span></div>) : <p className="text-sm text-slate-400">No category spending in this snapshot.</p>}</CardContent></Card></div>
    <Card className="border-white/10 bg-white/[0.04]"><CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Breakdown</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-white/10 text-slate-400">{["Month", "Income", "Savings", "Debt", "Expenses", "Left"].map((label) => <th key={label} className="px-2 py-2 text-right first:text-left">{label}</th>)}</tr></thead><tbody>{summary.yearly_monthly_breakdown.map((month) => <tr key={month.month} className="border-b border-white/5"><td className="px-2 py-2">{month.month_label}</td><td className="px-2 py-2 text-right">{money(month.income)}</td><td className="px-2 py-2 text-right">{money(month.savings)}</td><td className="px-2 py-2 text-right">{money(month.debt)}</td><td className="px-2 py-2 text-right">{money(month.expenses)}</td><td className="px-2 py-2 text-right">{money(month.amount_left)}</td></tr>)}</tbody></table></div></CardContent></Card>
    <Card className="border-white/10 bg-white/[0.04]"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Pencil className="h-4 w-4"/>Saved Notes</CardTitle></CardHeader><CardContent><Textarea value={notes} placeholder="Add archive notes..." disabled={!onNotes} onChange={(event) => setNotes(event.target.value)}/>{onNotes ? <Button size="sm" className="mt-2" onClick={() => onNotes(snapshot.id, notes)}>Save Notes</Button> : <p className="mt-1 text-xs text-slate-500">Legacy notes are read-only here.</p>}</CardContent></Card>
  </div>;
}

export function SavedBudgets() {
  const { savedMonthlyBudgets: legacyMonths, savedYearlyBudgets: legacyYears, timezone, state } = useFinanceData();
  const { snapshots, isLoading, error, refreshSnapshots, saveSnapshot, updateSnapshotNotes, deleteSnapshot } = useSnapshots();
  const actualData = useSnapshotActualData();
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [selection, setSelection] = useState<Selection | null>(null);
  const accountMonths = useMemo(() => snapshots.filter((row) => row.snapshot_scope === "month").map(asMonth), [snapshots]);
  const accountYears = useMemo(() => snapshots.filter((row) => row.snapshot_scope === "year").map(asYear), [snapshots]);
  const years = Array.from(new Set(snapshots.map((row) => String(row.snapshot_year)))).sort((a, b) => b.localeCompare(a));
  const accountItems = [...accountMonths.map((item) => ({ scope: "month" as const, item, source: "account" as const })),
    ...accountYears.map((item) => ({ scope: "year" as const, item, source: "account" as const }))]
    .filter(({ item }) => (yearFilter === "All" || item.year === yearFilter)
      && `${item.year} ${"month_label" in item ? item.month_label : "Annual Summary"}`.toLowerCase().includes(query.toLowerCase()));

  async function saveAgain(scope: "month" | "year", snapshot: SavedMonthlyBudget | SavedYearlyBudget) {
    if (!actualData.isReady || !actualData.ownerId) { toast.error("Account data is unavailable. Retry before updating this snapshot."); return; }
    const actuals = actualData.actualsForYear(snapshot.year);
    if (!actuals) return;
    const input = scope === "month"
      ? { scope, year: Number(snapshot.year), month: (snapshot as SavedMonthlyBudget).month, summary: buildMonthlySummary(state, snapshot.year, (snapshot as SavedMonthlyBudget).month, actuals) }
      : { scope, year: Number(snapshot.year), summary: buildYearlySummary(state, snapshot.year, actuals) };
    const result = await saveSnapshot({ ...input, mode: "overwrite", targetId: snapshot.id });
    if (!result.ok && result.error.code === "account_changed") return;
    result.ok ? toast.success("Saved budget updated from current data.") : toast.error(result.error.message);
  }
  async function saveNotes(id: string, notes: string) {
    const result = await updateSnapshotNotes(id, notes);
    if (!result.ok && result.error.code !== "account_changed") toast.error(result.error.message);
  }
  async function removeSnapshot(id: string, label: string) {
    if (!window.confirm(`Delete ${label}? This account archive cannot be restored.`)) return;
    const result = await deleteSnapshot(id);
    if (result.ok) { setSelection(null); toast.success("Saved budget deleted."); }
    else if (result.error.code !== "account_changed") toast.error(result.error.message);
  }

  const selectedAccountMonth = selection?.source === "account" && selection.scope === "month" ? accountMonths.find((item) => item.id === selection.id) : undefined;
  const selectedAccountYear = selection?.source === "account" && selection.scope === "year" ? accountYears.find((item) => item.id === selection.id) : undefined;
  const selectedLegacyMonth = selection?.source === "legacy" && selection.scope === "month" ? legacyMonths.find((item) => item.id === selection.id) : undefined;
  const selectedLegacyYear = selection?.source === "legacy" && selection.scope === "year" ? legacyYears.find((item) => item.id === selection.id) : undefined;

  return <div className="space-y-5 p-6">
    <div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Archive</p><h1 className="text-slate-900">Archived Budgets</h1><p className="text-sm text-slate-500">Your account-backed monthly and yearly saved summaries.</p></div>
    {isLoading ? <Card><CardContent className="p-8 text-center" role="status">Loading your saved budgets…</CardContent></Card>
      : error ? <Card><CardContent className="space-y-3 p-8 text-center"><p role="alert">Saved budgets could not be loaded.</p><Button variant="outline" onClick={() => void refreshSnapshots()}>Retry</Button></CardContent></Card>
        : accountItems.length === 0 ? <Card><CardContent className="p-8 text-center"><Archive className="mx-auto mb-4 h-10 w-10 text-slate-400"/><h2 className="text-xl font-semibold">No saved budgets yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Save a month or year from Reports or Annual Planner to build your account archive.</p><div className="mt-5 flex justify-center gap-2"><Button asChild><Link to="/reports">Go to Reports</Link></Button><Button asChild variant="outline"><Link to="/annual-planner">Go to Annual Planner</Link></Button></div></CardContent></Card>
          : <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]"><Card className="min-w-0"><CardHeader className="pb-2"><CardTitle className="text-sm">Account Archive Directory</CardTitle></CardHeader><CardContent className="min-w-0 space-y-2">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]"><input aria-label="Search saved budgets" placeholder="Search months or years…" className="h-10 min-w-0 rounded-xl border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)] px-3 text-sm" value={query} onChange={(event) => setQuery(event.target.value)}/><select aria-label="Archive year" className="h-10 rounded-xl border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)] px-3 text-sm" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option>All</option>{years.map((year) => <option key={year}>{year}</option>)}</select></div>
            {accountItems.map(({ item, scope }) => <button key={`${scope}-${item.id}`} type="button" onClick={() => setSelection({ source: "account", scope, id: item.id })} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${selection?.source === "account" && selection.id === item.id ? "bg-[#8B5CF6]/15" : "hover:bg-white/[0.05]"}`}>
              {scope === "month" ? <CalendarDays className="h-4 w-4"/> : <BarChart3 className="h-4 w-4"/>}<span className="flex-1">{scope === "month" ? (item as SavedMonthlyBudget).month_label : "Annual Summary"} {item.year}</span><FileBarChart className="h-4 w-4 text-slate-500"/>
            </button>)}
            {!accountItems.length && <p className="p-3 text-sm text-slate-500">No saved budgets match this search.</p>}
          </CardContent></Card><Card className="min-w-0"><CardContent className="min-w-0 p-4 sm:p-6">
            {selectedAccountMonth ? <MonthlyDetail key={selectedAccountMonth.id} snapshot={selectedAccountMonth} legacy={false} timezone={timezone} onDelete={(id) => void removeSnapshot(id, `${selectedAccountMonth.month_label} ${selectedAccountMonth.year}`)} onNotes={(id, notes) => void saveNotes(id, notes)} onResave={(item) => void saveAgain("month", item)}/>
              : selectedAccountYear ? <YearlyDetail key={selectedAccountYear.id} snapshot={selectedAccountYear} legacy={false} timezone={timezone} budgetName={state.setupProfile?.budgetName} onDelete={(id) => void removeSnapshot(id, `${selectedAccountYear.year} annual summary`)} onNotes={(id, notes) => void saveNotes(id, notes)} onResave={(item) => void saveAgain("year", item)}/>
                : <div className="flex min-h-[20rem] flex-col items-center justify-center text-center"><Folder className="mb-3 h-9 w-9 text-slate-500"/><h2 className="text-lg font-semibold">Select an account archive</h2><p className="mt-2 text-sm text-slate-400">Stored values are shown as captured and are not recalculated.</p></div>}
          </CardContent></Card></div>}
    <details className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[var(--financeos-text-primary)]">Legacy local archives ({legacyMonths.length + legacyYears.length})</summary>
      <p className="my-3 text-xs text-slate-400">These records remain in this browser’s legacy storage. They are not account archives, are not uploaded, and are read-only here.</p>
      {(legacyMonths.length + legacyYears.length) === 0 ? <p className="text-sm text-slate-500">No legacy local archives.</p> : <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-1">{legacyMonths.map((item) => <button key={item.id} type="button" onClick={() => setSelection({ source: "legacy", scope: "month", id: item.id })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/[0.05]"><CalendarDays className="h-4 w-4"/>{item.month_label} {item.year}</button>)}{legacyYears.map((item) => <button key={item.id} type="button" onClick={() => setSelection({ source: "legacy", scope: "year", id: item.id })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/[0.05]"><BarChart3 className="h-4 w-4"/>Annual Summary {item.year}</button>)}</div>
        <div>{selectedLegacyMonth ? <MonthlyDetail key={selectedLegacyMonth.id} snapshot={selectedLegacyMonth} legacy timezone={timezone}/> : selectedLegacyYear ? <YearlyDetail key={selectedLegacyYear.id} snapshot={selectedLegacyYear} legacy timezone={timezone} budgetName={state.setupProfile?.budgetName}/> : <p className="p-4 text-sm text-slate-500">Select a legacy archive to view its stored values.</p>}</div>
      </div>}
    </details>
  </div>;
}
