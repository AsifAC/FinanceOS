import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Archive, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { MonthSelector } from "../common/MonthSelector";
import { MONTHS, currentMonthIndex } from "../../lib/constants";
import { buildMonthlySummary, buildYearlySummary, useFinanceData } from "../../lib/financeStore";
import type { useSnapshotActualData } from "../../../hooks/useSnapshotActualData";
import { useSnapshots } from "../../../hooks/useSnapshots";

type PendingSave =
  | { kind: "month"; year: string; month: number; duplicate: boolean; hasTransactions: boolean }
  | { kind: "year"; year: string; duplicate: boolean; hasTransactions: boolean };

export function SaveSnapshotActions({
  defaultMonth = currentMonthIndex,
  actualData,
}: { defaultMonth?: number; actualData: ReturnType<typeof useSnapshotActualData> }) {
  const { activeYear, state } = useFinanceData();
  const { snapshots, saveSnapshot } = useSnapshots();
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedYear, setSelectedYear] = useState(activeYear);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveLock = useRef(false);
  const snapshotActuals = actualData.isReady ? actualData.actualsForYear(selectedYear) : null;

  useEffect(() => {
    setSelectedYear(activeYear);
  }, [activeYear]);

  useEffect(() => {
    setPendingSave(null);
  }, [actualData.ownerId]);

  function hasMonthTransactions(month: number) {
    return (snapshotActuals?.monthlyTransactionCounts[month] ?? 0) > 0;
  }

  function beginMonthSave() {
    setPendingSave({
      kind: "month",
      year: selectedYear,
      month: selectedMonth,
      duplicate: snapshots.some((snapshot) => snapshot.snapshot_scope === "month"
        && snapshot.snapshot_year === Number(selectedYear) && snapshot.snapshot_month === selectedMonth),
      hasTransactions: hasMonthTransactions(selectedMonth),
    });
  }

  function beginYearSave() {
    setPendingSave({
      kind: "year",
      year: selectedYear,
      duplicate: snapshots.some((snapshot) => snapshot.snapshot_scope === "year"
        && snapshot.snapshot_year === Number(selectedYear)),
      hasTransactions: (snapshotActuals?.transactionCount ?? 0) > 0,
    });
  }

  async function save(mode: "overwrite" | "new") {
    if (saveLock.current || !pendingSave || !actualData.isReady || !actualData.ownerId) return;
    const actuals = actualData.actualsForYear(pendingSave.year);
    if (!actuals) return;
    saveLock.current = true;
    setIsSaving(true);
    try {
      const result = pendingSave.kind === "month"
        ? await saveSnapshot({ scope: "month", year: Number(pendingSave.year), month: pendingSave.month,
          summary: buildMonthlySummary(state, pendingSave.year, pendingSave.month, actuals), mode })
        : await saveSnapshot({ scope: "year", year: Number(pendingSave.year),
          summary: buildYearlySummary(state, pendingSave.year, actuals), mode });
      if (!result.ok) {
        if (result.error.code === "account_changed") return;
        toast.error(result.error.message);
        return;
      }
      toast.success(pendingSave.kind === "month"
        ? `${MONTHS[pendingSave.month]} ${pendingSave.year} saved to your account archives.`
        : `${pendingSave.year} annual summary saved to your account archives.`);
      setPendingSave(null);
    } finally {
      saveLock.current = false;
      setIsSaving(false);
    }
  }

  const title = pendingSave?.kind === "month"
    ? `Save ${MONTHS[pendingSave.month]} ${pendingSave.year} budget snapshot?`
    : `Save ${pendingSave?.year} yearly budget summary?`;

  return (
    <>
      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-3 sm:flex-row sm:items-center">
        <MonthSelector
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          months={MONTHS}
          year={selectedYear}
          currentMonth={currentMonthIndex}
          label="Month to save"
          className="sm:w-44"
        />
        <select
          className="h-10 rounded-xl border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)] px-3 text-sm text-[var(--financeos-text-primary)]"
          value={selectedYear}
          onChange={(event) => setSelectedYear(event.target.value)}
          aria-label="Year to save"
        >
          {[Number(activeYear) - 1, Number(activeYear), Number(activeYear) + 1].map((year) => <option key={year}>{year}</option>)}
        </select>
        <Button size="sm" className="gap-2" onClick={beginMonthSave} disabled={!actualData.isReady}>
          <CalendarDays className="h-4 w-4" />
          Save This Month
        </Button>
        <Button size="sm" variant="secondary" className="gap-2" onClick={beginYearSave} disabled={!actualData.isReady}>
          <Archive className="h-4 w-4" />
          Save This Year
        </Button>
      </div>

      {!actualData.isReady && <p className="px-1 text-xs text-amber-700" role={actualData.error ? "alert" : "status"}>
        {actualData.error ? "Account actuals could not be loaded. Snapshot saving is unavailable; retry loading transactions." : "Loading account actuals. Snapshot saving is unavailable until they finish loading."}
        {actualData.error && <button type="button" className="ml-2 underline" onClick={() => void actualData.refresh()}>Retry</button>}
      </p>}
      {actualData.isReady && actualData.categoriesError && <p className="px-1 text-xs text-slate-500">Some category labels are unavailable; snapshot category breakdowns use neutral labels.</p>}

      <Dialog open={Boolean(pendingSave)} onOpenChange={(open) => !open && setPendingSave(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {pendingSave && !pendingSave.hasTransactions && (
              <div className="financeos-alert-banner financeos-alert-warning flex gap-3 p-4 text-sm">
                <AlertTriangle className="financeos-alert-warning-icon mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="financeos-alert-warning-title font-semibold">Snapshot may be empty</p>
                  <p className="financeos-alert-warning-text mt-1 leading-6">
                    {pendingSave.kind === "month" ? "This month has no transactions yet." : "This year has no transactions yet."}
                  </p>
                </div>
              </div>
            )}

            {pendingSave?.duplicate ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--financeos-text-secondary)]">
                  A saved snapshot already exists for this period. Overwrite your latest snapshot or keep a separate version?
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button onClick={() => void save("overwrite")} disabled={!actualData.isReady || isSaving}>{isSaving ? "Saving…" : "Overwrite existing"}</Button>
                  <Button variant="secondary" onClick={() => void save("new")} disabled={!actualData.isReady || isSaving}>{isSaving ? "Saving…" : "Save as new version"}</Button>
                  <Button variant="outline" onClick={() => setPendingSave(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => void save("overwrite")} className="flex-1" disabled={!actualData.isReady || isSaving}>{isSaving ? "Saving…" : "Confirm Save"}</Button>
                <Button variant="outline" onClick={() => setPendingSave(null)}>Cancel</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
