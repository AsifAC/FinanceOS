import type { Category, SupabaseTransactionType, Transaction } from "../../types/supabase";
import { parseTransactionDate } from "./transactionDates";

export type ActualTransactionCategoryTotal = {
  categoryId: string | null;
  category: string;
  amount: number;
};

/** Group account actuals by owned backend UUID, retaining a single null bucket. */
export function getActualCategoryBreakdown(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  type: SupabaseTransactionType,
  year: number,
  monthIndex?: number,
  throughMonthIndex?: number,
): ActualTransactionCategoryTotal[] {
  const labels = new Map(categories.map((category) => [category.id, category.name]));
  const groups = new Map<string, ActualTransactionCategoryTotal>();
  for (const transaction of transactions) {
    const date = parseTransactionDate(transaction.transaction_date);
    if (transaction.type !== type || !date || date.year !== year) continue;
    if (monthIndex !== undefined && date.monthIndex !== monthIndex) continue;
    if (throughMonthIndex !== undefined && date.monthIndex > throughMonthIndex) continue;
    const key = transaction.category_id ?? "__not_assigned__";
    const group = groups.get(key) ?? {
      categoryId: transaction.category_id,
      category: transaction.category_id === null
        ? "Not assigned"
        : labels.get(transaction.category_id) ?? "Unknown category",
      amount: 0,
    };
    group.amount += transaction.amount;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount);
}
