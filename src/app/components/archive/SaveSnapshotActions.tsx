import { useEffect, useState } from "react";
import { AlertTriangle, Archive, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { MonthSelector } from "../common/MonthSelector";
import { MONTHS, currentMonthIndex } from "../../lib/constants";
import { useFinanceData } from "../../lib/financeStore";

type PendingSave =
  | { kind: "month"; year: string; month: number; duplicate: boolean; hasTransactions: boolean }
  | { kind: "year"; year: string; duplicate: boolean; hasTransactions: boolean };

export function SaveSnapshotActions({ defaultMonth = currentMonthIndex }: { defaultMonth?: number }) {
  const {
    activeYear,
    actualAmounts,
    savedMonthlyBudgets,
    savedYearlyBudgets,
    saveMonthlyBudgetSnapshot,
    saveYearlyBudgetSnapshot,
  } = useFinanceData();
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedYear, setSelectedYear] = useState(activeYear);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);

  useEffect(() => {
    setSelectedYear(activeYear);
  }, [activeYear]);

  function hasMonthTransactions(month: number) {
    const actual = actualAmounts[month];
    return Boolean(actual && (actual.income || actual.savings || actual.debt || actual.expenses));
  }

  function beginMonthSave() {
    setPendingSave({
      kind: "month",
      year: selectedYear,
      month: selectedMonth,
      duplicate: savedMonthlyBudgets.some((snapshot) => snapshot.year === selectedYear && snapshot.month === selectedMonth),
      hasTransactions: hasMonthTransactions(selectedMonth),
    });
  }

  function beginYearSave() {
    setPendingSave({
      kind: "year",
      year: selectedYear,
      duplicate: savedYearlyBudgets.some((snapshot) => snapshot.year === selectedYear),
      hasTransactions: actualAmounts.some((month) => month.income || month.savings || month.debt || month.expenses),
    });
  }

  function save(mode: "overwrite" | "new") {
    if (!pendingSave) return;
    if (pendingSave.kind === "month") {
      saveMonthlyBudgetSnapshot(pendingSave.year, pendingSave.month, mode);
      toast.success(`${MONTHS[pendingSave.month]} ${pendingSave.year} saved to Archived Budgets.`);
    } else {
      saveYearlyBudgetSnapshot(pendingSave.year, mode);
      toast.success(`${pendingSave.year} annual summary saved to Archived Budgets.`);
    }
    setPendingSave(null);
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
        <Button size="sm" className="gap-2" onClick={beginMonthSave}>
          <CalendarDays className="h-4 w-4" />
          Save This Month
        </Button>
        <Button size="sm" variant="secondary" className="gap-2" onClick={beginYearSave}>
          <Archive className="h-4 w-4" />
          Save This Year
        </Button>
      </div>

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
                  A saved snapshot already exists. Do you want to overwrite it or keep both?
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button onClick={() => save("overwrite")}>Overwrite existing</Button>
                  <Button variant="secondary" onClick={() => save("new")}>Save as new version</Button>
                  <Button variant="outline" onClick={() => setPendingSave(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => save("overwrite")} className="flex-1">Confirm Save</Button>
                <Button variant="outline" onClick={() => setPendingSave(null)}>Cancel</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
