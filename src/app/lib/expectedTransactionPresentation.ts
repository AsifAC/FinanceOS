import { isValidTransactionDate, localTransactionDate, transactionMonthIndex, transactionYear } from "./transactionDates";
import type { ExpectedTransaction, SupabaseExpectedTransactionStatus, SupabaseTransactionType } from "../../types/supabase";

export type ExpectedStatusFilter = "all" | SupabaseExpectedTransactionStatus | "overdue";
export type ExpectedTransactionFilters = {
  year: number | "all";
  monthIndex: number | "all";
  type: SupabaseTransactionType | "all";
  status: ExpectedStatusFilter;
  search: string;
};

export function isExpectedTransactionOverdue(row: Pick<ExpectedTransaction, "status" | "expected_date">, today = localTransactionDate()): boolean {
  return row.status === "planned" && isValidTransactionDate(row.expected_date)
    && isValidTransactionDate(today) && row.expected_date < today;
}

export function filterExpectedTransactions(
  rows: readonly ExpectedTransaction[],
  filters: ExpectedTransactionFilters,
  today = localTransactionDate(),
): ExpectedTransaction[] {
  const needle = filters.search.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (filters.year !== "all" && transactionYear(row.expected_date) !== filters.year) return false;
    if (filters.monthIndex !== "all" && transactionMonthIndex(row.expected_date) !== filters.monthIndex) return false;
    if (filters.type !== "all" && row.type !== filters.type) return false;
    if (filters.status === "overdue" ? !isExpectedTransactionOverdue(row, today)
      : filters.status !== "all" && row.status !== filters.status) return false;
    return !needle || row.title.toLocaleLowerCase().includes(needle);
  });
}

/** Planned rows (including derived overdue rows) come first by nearest date. */
export function sortExpectedTransactions(rows: readonly ExpectedTransaction[]): ExpectedTransaction[] {
  return [...rows].sort((a, b) => {
    const aPlanned = a.status === "planned";
    const bPlanned = b.status === "planned";
    if (aPlanned !== bPlanned) return aPlanned ? -1 : 1;
    const dateOrder = aPlanned
      ? a.expected_date.localeCompare(b.expected_date)
      : b.expected_date.localeCompare(a.expected_date);
    return dateOrder || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
  });
}
