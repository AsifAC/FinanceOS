export type TransactionDateParts = { year: number; monthIndex: number; day: number };

/** Parse a calendar date, never an instant. No timezone or Date normalization. */
export function parseTransactionDate(value: string): TransactionDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > days[month - 1]) return null;
  return { year, monthIndex: month - 1, day };
}

export const isValidTransactionDate = (value: string) => parseTransactionDate(value) !== null;
export const transactionYear = (value: string) => parseTransactionDate(value)?.year ?? null;
export const transactionMonthIndex = (value: string) => parseTransactionDate(value)?.monthIndex ?? null;

/** Format a local calendar day without converting through UTC. */
export function localTransactionDate(value = new Date()): string {
  const year = String(value.getFullYear()).padStart(4, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type DatedTransaction = { transaction_date: string };

export function filterTransactionsByYear<T extends DatedTransaction>(rows: readonly T[], year: number): T[] {
  return rows.filter((row) => transactionYear(row.transaction_date) === year);
}

/** Month is the UI index (0–11). Include the year to avoid mixing annual periods. */
export function filterTransactionsByMonth<T extends DatedTransaction>(rows: readonly T[], year: number, monthIndex: number): T[] {
  return rows.filter((row) => {
    const date = parseTransactionDate(row.transaction_date);
    return date !== null && date.year === year && date.monthIndex === monthIndex;
  });
}
