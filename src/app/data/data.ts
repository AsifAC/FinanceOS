export { MONTHS, MONTH_SHORT, currentMonthIndex, currentYear } from "../lib/constants";

export type CategoryType = "income" | "savings" | "debt" | "expense";

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
}

export interface Transaction {
  id: string;
  name: string;
  amount: number;
  type: CategoryType;
  category: string;
  date: string;
  status: "pending" | "paid" | "cleared";
  expenseKind?: "fixed" | "variable";
  notes?: string;
  dueDate?: string;
  isFixed?: boolean;
  paymentMethodId?: string;
}

export interface MonthlyAmount {
  month: number;
  income: number;
  savings: number;
  debt: number;
  expenses: number;
}

export interface ExpectedAmount extends MonthlyAmount {}

export interface PaymentPlan {
  id: string;
  name: string;
  amount: number;
  category: string;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  dueDay: number;
  status: "active" | "paused" | "cancelled";
  nextDueDate: string;
}

export const categories: Category[] = [];
export const expectedAmounts: ExpectedAmount[] = [];
export const actualAmounts: MonthlyAmount[] = [];
export const transactions: Transaction[] = [];
export const pendingTransactions: Transaction[] = [];
export const paymentPlans: PaymentPlan[] = [];

export function getZeroMonth(month = 0): MonthlyAmount {
  return { month, income: 0, savings: 0, debt: 0, expenses: 0 };
}

export function getMonthlyAmount(data: MonthlyAmount[], month: number) {
  return data.find((item) => item.month === month) ?? getZeroMonth(month);
}

export function getAmountLeft(data: { income: number; savings: number; debt: number; expenses: number }) {
  return data.income - data.savings - data.debt - data.expenses;
}
