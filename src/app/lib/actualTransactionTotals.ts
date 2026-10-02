import type { MonthlyAmount } from "../data/data";
import type { Transaction as SupabaseTransaction } from "../../types/supabase";
import { parseTransactionDate } from "./transactionDates";

export type ActualTransactionTotals = {
  income: number;
  expense: number;
  savings: number;
  debt: number;
  amountLeft: number;
};

const zeroMonthlyAmounts = (): MonthlyAmount[] => Array.from({ length: 12 }, (_, month) => ({
  month, income: 0, expenses: 0, savings: 0, debt: 0,
}));

/** One pass over authenticated Supabase actual rows; dates stay calendar strings. */
export function getActualTransactionMonths(
  transactions: readonly SupabaseTransaction[],
  year: number,
): MonthlyAmount[] {
  const months = zeroMonthlyAmounts();
  for (const transaction of transactions) {
    const date = parseTransactionDate(transaction.transaction_date);
    if (!date || date.year !== year) continue;
    const totals = months[date.monthIndex];
    if (!totals) continue;
    if (transaction.type === "income") totals.income += transaction.amount;
    if (transaction.type === "expense") totals.expenses += transaction.amount;
    if (transaction.type === "savings") totals.savings += transaction.amount;
    if (transaction.type === "debt") totals.debt += transaction.amount;
  }
  return months;
}

export function getActualTransactionTotals(
  transactions: readonly SupabaseTransaction[],
  year: number,
  monthIndex: number,
): ActualTransactionTotals {
  const month = Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex <= 11
    ? getActualTransactionMonths(transactions, year)[monthIndex]
    : { month: monthIndex, income: 0, expenses: 0, savings: 0, debt: 0 };
  return {
    income: month.income,
    expense: month.expenses,
    savings: month.savings,
    debt: month.debt,
    amountLeft: month.income - month.expenses - month.savings - month.debt,
  };
}

export function amountLeftForActualMonth(month: MonthlyAmount): number {
  return month.income - month.expenses - month.savings - month.debt;
}

/** Annual actuals are reduced from the shared account-backed monthly series. */
export function getActualTransactionYearTotals(months: readonly MonthlyAmount[]): ActualTransactionTotals {
  const totals = months.reduce((result, month) => ({
    income: result.income + month.income,
    expense: result.expense + month.expenses,
    savings: result.savings + month.savings,
    debt: result.debt + month.debt,
  }), { income: 0, expense: 0, savings: 0, debt: 0 });
  return { ...totals, amountLeft: totals.income - totals.expense - totals.savings - totals.debt };
}
