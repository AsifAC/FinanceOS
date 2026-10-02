import type { Category, Transaction } from "../../types/supabase";
import { getActualCategoryBreakdown } from "./actualTransactionCategories";
import { getActualTransactionMonths } from "./actualTransactionTotals";
import { filterTransactionsByMonth, filterTransactionsByYear, transactionMonthIndex } from "./transactionDates";

export type SnapshotCategoryAmount = { category: string; amount: number };

/** A serializable calculation bundle for one save operation; raw rows are never persisted. */
export type SupabaseSnapshotActuals = {
  snapshot_version: 2;
  actual_source: "supabase";
  expected_source: "local";
  snapshot_owner_id: string;
  monthly: ReturnType<typeof getActualTransactionMonths>;
  monthlyTransactionCounts: number[];
  transactionCount: number;
  monthlyCategoryBreakdowns: SnapshotCategoryAmount[][];
  yearlyCategoryBreakdowns: SnapshotCategoryAmount[];
};

export function getSupabaseSnapshotActuals(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  year: string | number,
  ownerId: string,
): SupabaseSnapshotActuals {
  const selectedYear = Number(year);
  const yearTransactions = filterTransactionsByYear(transactions, selectedYear);
  const monthly = getActualTransactionMonths(yearTransactions, selectedYear);
  const monthlyTransactionCounts = Array.from({ length: 12 }, () => 0);
  for (const transaction of yearTransactions) {
    const monthIndex = transactionMonthIndex(transaction.transaction_date);
    if (monthIndex !== null) monthlyTransactionCounts[monthIndex] += 1;
  }
  const monthlyCategoryBreakdowns = monthly.map((_, monthIndex) =>
    getActualCategoryBreakdown(filterTransactionsByMonth(yearTransactions, selectedYear, monthIndex), categories, "expense", selectedYear)
      .map(({ category, amount }) => ({ category, amount }))
  );
  const yearlyCategoryBreakdowns = getActualCategoryBreakdown(yearTransactions, categories, "expense", selectedYear)
    .map(({ category, amount }) => ({ category, amount }));
  return {
    snapshot_version: 2,
    actual_source: "supabase",
    expected_source: "local",
    snapshot_owner_id: ownerId,
    monthly,
    monthlyTransactionCounts,
    transactionCount: yearTransactions.length,
    monthlyCategoryBreakdowns,
    yearlyCategoryBreakdowns,
  };
}
