import { createContext, ReactNode, useContext, useEffect, useMemo, useReducer, useState } from "react";
import {
  Category,
  CategoryType,
  ExpectedAmount,
  MonthlyAmount,
  PaymentPlan,
  Transaction,
  getAmountLeft,
  getZeroMonth,
} from "../data/data";
import { MONTHS, currentMonthIndex, currentYear } from "./constants";
import { completeSetup as persistSetupComplete, getSetupProfile, resetSetup, SetupProfile } from "./setupState";
import { DEV_PREVIEW_MODE, DEV_PREVIEW_STORAGE_KEY, DEV_PREVIEW_YEAR } from "../../config/devPreview";
import { mockFinanceData } from "../../mock/mockFinanceData";
import { getBrowserTimezone, StartDayOfWeek } from "./datePreferences";

const STORAGE_KEY = "financeos:app-data:v1";

export interface BudgetYear {
  id: string;
  name: string;
  year: string;
  startMonth: string;
  currency: string;
}

export interface MonthlyBudgetSummary {
  budget_year_id: string;
  year: string;
  month: number;
  month_label: string;
  saved_at: string;
  income: number;
  savings: number;
  debt: number;
  expenses: number;
  amount_left: number;
  expected_income: number;
  expected_savings: number;
  expected_debt: number;
  expected_expenses: number;
  expected_amount_left: number;
  actual_amount_left: number;
  savings_rate: number;
  expense_rate: number;
  debt_payment_rate: number;
  category_breakdowns: Array<{ category: string; amount: number }>;
  transaction_count: number;
  pending_transaction_count: number;
  notes: string;
}

export interface YearlyBudgetSummary {
  budget_year_id: string;
  year: string;
  saved_at: string;
  total_income: number;
  total_savings: number;
  total_debt: number;
  total_expenses: number;
  total_amount_left: number;
  expected_yearly_income: number;
  expected_yearly_savings: number;
  expected_yearly_debt: number;
  expected_yearly_expenses: number;
  best_savings_month: string;
  highest_income_month: string;
  highest_expense_month: string;
  highest_debt_payoff_month: string;
  yearly_category_rankings: Array<{ category: string; amount: number }>;
  yearly_monthly_breakdown: Array<{
    month: number;
    month_label: string;
    income: number;
    savings: number;
    debt: number;
    expenses: number;
    amount_left: number;
  }>;
  notes: string;
}

export interface SavedMonthlyBudget {
  id: string;
  budget_year_id: string;
  year: string;
  month: number;
  month_label: string;
  saved_at: string;
  summary_json: MonthlyBudgetSummary;
  created_at: string;
  updated_at: string;
}

export interface SavedYearlyBudget {
  id: string;
  budget_year_id: string;
  year: string;
  saved_at: string;
  summary_json: YearlyBudgetSummary;
  created_at: string;
  updated_at: string;
}

type SnapshotSaveMode = "overwrite" | "new";

export type PaymentMethodType = "checking" | "savings" | "credit_card" | "debit_card" | "cash" | "other";
export type PaymentNetwork = "visa" | "mastercard" | "amex" | "discover" | "other";

export interface PaymentMethod {
  id: string;
  nickname: string;
  type: PaymentMethodType;
  institutionName?: string;
  last4?: string;
  network?: PaymentNetwork;
  colorTheme?: string;
  isLinked?: boolean;
  institutionId?: string;
  institutionLogo?: string;
  brandColor?: string;
  linkedAccountId?: string;
}

export interface FinanceState {
  activeYear: string;
  selectedMonth: number;
  startDayOfWeek: StartDayOfWeek;
  timezone: string;
  paymentMethods: PaymentMethod[];
  budgetYears: BudgetYear[];
  setupCompleted: boolean;
  setupProfile: SetupProfile | null;
  categories: Category[];
  transactions: Transaction[];
  expectedAmounts: ExpectedAmount[];
  paymentPlans: PaymentPlan[];
  savingsGoals: unknown[];
  debtAccounts: unknown[];
  monthlyNotes: Record<number, string>;
  savedMonthlyBudgets: SavedMonthlyBudget[];
  savedYearlyBudgets: SavedYearlyBudget[];
}

type FinanceAction =
  | { type: "SET_ACTIVE_YEAR"; year: string }
  | { type: "SET_SELECTED_MONTH"; month: number }
  | { type: "UPDATE_PREFERENCES"; updates: Partial<Pick<FinanceState, "startDayOfWeek" | "timezone">> }
  | { type: "ADD_PAYMENT_METHOD"; paymentMethod: PaymentMethod }
  | { type: "UPDATE_PAYMENT_METHOD"; id: string; updates: Partial<PaymentMethod> }
  | { type: "DELETE_PAYMENT_METHOD"; id: string }
  | { type: "ADD_CATEGORY"; category: Category }
  | { type: "UPDATE_CATEGORY"; id: string; updates: Partial<Category> }
  | { type: "DELETE_CATEGORY"; id: string }
  | { type: "ADD_TRANSACTION"; transaction: Transaction }
  | { type: "ADD_TRANSACTIONS"; transactions: Transaction[] }
  | { type: "UPDATE_TRANSACTION"; id: string; updates: Partial<Transaction> }
  | { type: "DELETE_TRANSACTION"; id: string }
  | { type: "UPDATE_MONTHLY_PLAN"; month: number; plan: Partial<ExpectedAmount> }
  | { type: "ADD_PAYMENT_PLAN"; plan: PaymentPlan }
  | { type: "UPDATE_PAYMENT_PLAN"; id: string; updates: Partial<PaymentPlan> }
  | { type: "DELETE_PAYMENT_PLAN"; id: string }
  | { type: "MARK_TRANSACTION_PAID"; id: string }
  | { type: "MARK_PAYMENT_PLAN_PAID"; id: string }
  | { type: "SAVE_MONTHLY_BUDGET"; year: string; month: number; mode: SnapshotSaveMode }
  | { type: "SAVE_YEARLY_BUDGET"; year: string; mode: SnapshotSaveMode }
  | { type: "DELETE_SAVED_MONTHLY_BUDGET"; id: string }
  | { type: "DELETE_SAVED_YEARLY_BUDGET"; id: string }
  | { type: "UPDATE_SAVED_MONTHLY_BUDGET_NOTES"; id: string; notes: string }
  | { type: "UPDATE_SAVED_YEARLY_BUDGET_NOTES"; id: string; notes: string }
  | { type: "COMPLETE_SETUP"; profile: SetupProfile }
  | { type: "RESET_PREVIEW_DATA" }
  | { type: "RESET_APP_DATA" };

const emptyState: FinanceState = {
  activeYear: String(currentYear),
  selectedMonth: currentMonthIndex,
  startDayOfWeek: "sunday",
  timezone: getBrowserTimezone(),
  paymentMethods: [],
  budgetYears: [],
  setupCompleted: false,
  setupProfile: null,
  categories: [],
  transactions: [],
  expectedAmounts: [],
  paymentPlans: [],
  savingsGoals: [],
  debtAccounts: [],
  monthlyNotes: {},
  savedMonthlyBudgets: [],
  savedYearlyBudgets: [],
};

function createPreviewState(selectedMonth = emptyState.selectedMonth): FinanceState {
  return {
    ...emptyState,
    activeYear: DEV_PREVIEW_YEAR,
    selectedMonth,
    setupCompleted: true,
    setupProfile: {
      budgetName: "Developer Preview Budget",
      year: DEV_PREVIEW_YEAR,
      startMonth: "January",
      currency: "USD ($)",
      categories: mockFinanceData.categories,
      expectedIncome: "6400",
      expectedSavings: "1200",
      expectedDebt: "520",
      expectedExpenses: "3600",
      startDayOfWeek: emptyState.startDayOfWeek,
      timezone: emptyState.timezone,
      paymentMethods: [],
    },
    budgetYears: mockFinanceData.budgetYears,
    categories: mockFinanceData.categories,
    transactions: mockFinanceData.transactions,
    expectedAmounts: mockFinanceData.expectedAmounts,
    paymentPlans: mockFinanceData.paymentPlans,
    savedMonthlyBudgets: mockFinanceData.savedMonthlyBudgets,
    savedYearlyBudgets: mockFinanceData.savedYearlyBudgets,
  };
}

function loadPreviewEnabled() {
  if (!DEV_PREVIEW_MODE || typeof window === "undefined") return false;
  const saved = window.localStorage.getItem(DEV_PREVIEW_STORAGE_KEY);
  return saved === null ? DEV_PREVIEW_MODE : saved === "true";
}

function toNumber(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMonthlyPlans(plans: ExpectedAmount[]) {
  return MONTHS.map((_, month) => plans.find((plan) => plan.month === month) ?? getZeroMonth(month));
}

function normalizeYear(year: string | number | null | undefined) {
  const parsed = String(year ?? "").trim();
  return parsed || String(currentYear);
}

function dateYear(date: string | undefined) {
  if (!date) return null;
  const isoYear = date.match(/^(\d{4})-\d{2}-\d{2}/)?.[1];
  if (isoYear) return isoYear;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getFullYear()) ? null : String(parsed.getFullYear());
}

function dateMonth(date: string | undefined) {
  if (!date) return null;
  const isoMonth = date.match(/^\d{4}-(\d{2})-\d{2}/)?.[1];
  if (isoMonth) return Number(isoMonth) - 1;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getMonth()) ? null : parsed.getMonth();
}

function filterTransactionsByYear(transactions: Transaction[], year: string) {
  return transactions.filter((transaction) => dateYear(transaction.date) === year);
}

function filterPaymentPlansByYear(paymentPlans: PaymentPlan[], year: string) {
  return paymentPlans.filter((plan) => dateYear(plan.nextDueDate) === year);
}

function rate(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function activeBudgetYear(state: FinanceState, year: string) {
  return state.budgetYears.find((budgetYear) => budgetYear.year === year) ?? {
    id: `budget-year-${year}`,
    name: `${year} Budget`,
    year,
    startMonth: "January",
    currency: "USD ($)",
  };
}

function nextPaymentDate(dueDay: number, year: string) {
  const day = Math.min(Math.max(dueDay || 1, 1), 31);
  return new Date(Number(year), currentMonthIndex + 1, day).toISOString().slice(0, 10);
}

function advancePaymentDate(plan: PaymentPlan) {
  const base = new Date(plan.nextDueDate);
  const date = Number.isNaN(base.getTime()) ? new Date() : base;
  if (plan.frequency === "weekly") date.setDate(date.getDate() + 7);
  else if (plan.frequency === "biweekly") date.setDate(date.getDate() + 14);
  else if (plan.frequency === "quarterly") date.setMonth(date.getMonth() + 3);
  else if (plan.frequency === "yearly") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function buildMonthlySummary(state: FinanceState, year: string, month: number): MonthlyBudgetSummary {
  const yearTransactions = filterTransactionsByYear(state.transactions, year);
  const actualAmounts = deriveActualAmounts(yearTransactions, year);
  const pendingTransactions = derivePendingTransactions(state, year);
  const actual = actualAmounts[month] ?? getZeroMonth(month);
  const expected = normalizeMonthlyPlans(state.expectedAmounts)[month] ?? getZeroMonth(month);
  const budgetYear = activeBudgetYear(state, year);
  const monthTransactions = yearTransactions.filter((transaction) => {
    return dateMonth(transaction.date) === month;
  });
  const monthPendingTransactions = pendingTransactions.filter((transaction) => {
    return dateMonth(transaction.dueDate ?? transaction.date) === month;
  });
  return {
    budget_year_id: budgetYear.id,
    year,
    month,
    month_label: MONTHS[month] ?? `Month ${month + 1}`,
    saved_at: new Date().toISOString(),
    income: actual.income,
    savings: actual.savings,
    debt: actual.debt,
    expenses: actual.expenses,
    amount_left: getAmountLeft(actual),
    expected_income: expected.income,
    expected_savings: expected.savings,
    expected_debt: expected.debt,
    expected_expenses: expected.expenses,
    expected_amount_left: getAmountLeft(expected),
    actual_amount_left: getAmountLeft(actual),
    savings_rate: rate(actual.savings, actual.income),
    expense_rate: rate(actual.expenses, actual.income),
    debt_payment_rate: rate(actual.debt, actual.income),
    category_breakdowns: getExpenseCategoryData(monthTransactions),
    transaction_count: monthTransactions.length,
    pending_transaction_count: monthPendingTransactions.length,
    notes: state.monthlyNotes[month] ?? "",
  };
}

function highestMonth(
  monthlyBreakdown: YearlyBudgetSummary["yearly_monthly_breakdown"],
  field: "income" | "savings" | "debt" | "expenses" | "amount_left",
) {
  const tracked = monthlyBreakdown.filter((month) => month[field] > 0);
  if (!tracked.length) return "No data";
  return [...tracked].sort((a, b) => b[field] - a[field])[0].month_label;
}

function buildYearlySummary(state: FinanceState, year: string): YearlyBudgetSummary {
  const yearTransactions = filterTransactionsByYear(state.transactions, year);
  const actualAmounts = deriveActualAmounts(yearTransactions, year);
  const expectedAmounts = normalizeMonthlyPlans(state.expectedAmounts);
  const budgetYear = activeBudgetYear(state, year);
  const yearly_monthly_breakdown = actualAmounts.map((month, index) => ({
    month: index,
    month_label: MONTHS[index],
    income: month.income,
    savings: month.savings,
    debt: month.debt,
    expenses: month.expenses,
    amount_left: getAmountLeft(month),
  }));
  const totals = actualAmounts.reduce(
    (sum, month) => ({
      income: sum.income + month.income,
      savings: sum.savings + month.savings,
      debt: sum.debt + month.debt,
      expenses: sum.expenses + month.expenses,
    }),
    { income: 0, savings: 0, debt: 0, expenses: 0 },
  );
  const expectedTotals = expectedAmounts.reduce(
    (sum, month) => ({
      income: sum.income + month.income,
      savings: sum.savings + month.savings,
      debt: sum.debt + month.debt,
      expenses: sum.expenses + month.expenses,
    }),
    { income: 0, savings: 0, debt: 0, expenses: 0 },
  );

  return {
    budget_year_id: budgetYear.id,
    year,
    saved_at: new Date().toISOString(),
    total_income: totals.income,
    total_savings: totals.savings,
    total_debt: totals.debt,
    total_expenses: totals.expenses,
    total_amount_left: totals.income - totals.savings - totals.debt - totals.expenses,
    expected_yearly_income: expectedTotals.income,
    expected_yearly_savings: expectedTotals.savings,
    expected_yearly_debt: expectedTotals.debt,
    expected_yearly_expenses: expectedTotals.expenses,
    best_savings_month: highestMonth(yearly_monthly_breakdown, "savings"),
    highest_income_month: highestMonth(yearly_monthly_breakdown, "income"),
    highest_expense_month: highestMonth(yearly_monthly_breakdown, "expenses"),
    highest_debt_payoff_month: highestMonth(yearly_monthly_breakdown, "debt"),
    yearly_category_rankings: getExpenseCategoryData(yearTransactions),
    yearly_monthly_breakdown,
    notes: "",
  };
}

function reducer(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case "SET_ACTIVE_YEAR": {
      const year = normalizeYear(action.year);
      const existing = state.budgetYears.some((budgetYear) => budgetYear.year === year);
      return {
        ...state,
        activeYear: year,
        budgetYears: existing
          ? state.budgetYears
          : [...state.budgetYears, activeBudgetYear(state, year)],
      };
    }
    case "SET_SELECTED_MONTH":
      return { ...state, selectedMonth: Math.min(11, Math.max(0, action.month)) };
    case "UPDATE_PREFERENCES":
      return { ...state, ...action.updates };
    case "ADD_PAYMENT_METHOD":
      return { ...state, paymentMethods: [...state.paymentMethods, action.paymentMethod] };
    case "UPDATE_PAYMENT_METHOD":
      return {
        ...state,
        paymentMethods: state.paymentMethods.map((method) =>
          method.id === action.id ? { ...method, ...action.updates } : method
        ),
      };
    case "DELETE_PAYMENT_METHOD":
      return { ...state, paymentMethods: state.paymentMethods.filter((method) => method.id !== action.id) };
    case "ADD_CATEGORY":
      return { ...state, categories: [...state.categories, action.category] };
    case "UPDATE_CATEGORY":
      return {
        ...state,
        categories: state.categories.map((category) =>
          category.id === action.id ? { ...category, ...action.updates } : category
        ),
      };
    case "DELETE_CATEGORY":
      return { ...state, categories: state.categories.filter((category) => category.id !== action.id) };
    case "ADD_TRANSACTION":
      return { ...state, transactions: [...state.transactions, action.transaction] };
    case "ADD_TRANSACTIONS":
      return { ...state, transactions: [...state.transactions, ...action.transactions] };
    case "UPDATE_TRANSACTION":
      return {
        ...state,
        transactions: state.transactions.map((transaction) =>
          transaction.id === action.id ? { ...transaction, ...action.updates } : transaction
        ),
      };
    case "DELETE_TRANSACTION":
      return { ...state, transactions: state.transactions.filter((transaction) => transaction.id !== action.id) };
    case "UPDATE_MONTHLY_PLAN": {
      const expectedAmounts = normalizeMonthlyPlans(state.expectedAmounts).map((plan) =>
        plan.month === action.month ? { ...plan, ...action.plan, month: action.month } : plan
      );
      return { ...state, expectedAmounts };
    }
    case "ADD_PAYMENT_PLAN":
      return { ...state, paymentPlans: [...state.paymentPlans, action.plan] };
    case "UPDATE_PAYMENT_PLAN":
      return {
        ...state,
        paymentPlans: state.paymentPlans.map((plan) =>
          plan.id === action.id ? { ...plan, ...action.updates } : plan
        ),
      };
    case "DELETE_PAYMENT_PLAN":
      return { ...state, paymentPlans: state.paymentPlans.filter((plan) => plan.id !== action.id) };
    case "MARK_TRANSACTION_PAID":
      return {
        ...state,
        transactions: state.transactions.map((transaction) =>
          transaction.id === action.id ? { ...transaction, status: "paid" } : transaction
        ),
      };
    case "MARK_PAYMENT_PLAN_PAID": {
      const plan = state.paymentPlans.find((item) => item.id === action.id);
      if (!plan) return state;
      const paidTransaction: Transaction = {
        id: makeId("transaction"),
        name: plan.name,
        amount: plan.amount,
        type: "expense",
        category: plan.category,
        date: new Date(Number(state.activeYear), currentMonthIndex, new Date().getDate()).toISOString().slice(0, 10),
        status: "paid",
        expenseKind: "fixed",
        dueDate: plan.nextDueDate,
        isFixed: true,
        notes: "Paid from payment plan",
      };
      return {
        ...state,
        transactions: [...state.transactions, paidTransaction],
        paymentPlans: state.paymentPlans.map((item) =>
          item.id === action.id ? { ...item, nextDueDate: advancePaymentDate(item) } : item
        ),
      };
    }
    case "SAVE_MONTHLY_BUDGET": {
      const summary = buildMonthlySummary(state, action.year, action.month);
      const existing = state.savedMonthlyBudgets.find(
        (snapshot) => snapshot.year === action.year && snapshot.month === action.month
      );
      const now = new Date().toISOString();
      if (existing && action.mode === "overwrite") {
        return {
          ...state,
          savedMonthlyBudgets: state.savedMonthlyBudgets.map((snapshot) =>
            snapshot.id === existing.id
              ? { ...snapshot, saved_at: summary.saved_at, summary_json: summary, updated_at: now }
              : snapshot
          ),
        };
      }
      return {
        ...state,
        savedMonthlyBudgets: [...state.savedMonthlyBudgets, {
          id: makeId("saved-month"),
          budget_year_id: summary.budget_year_id,
          year: summary.year,
          month: summary.month,
          month_label: summary.month_label,
          saved_at: summary.saved_at,
          summary_json: summary,
          created_at: now,
          updated_at: now,
        }],
      };
    }
    case "SAVE_YEARLY_BUDGET": {
      const summary = buildYearlySummary(state, action.year);
      const existing = state.savedYearlyBudgets.find((snapshot) => snapshot.year === action.year);
      const now = new Date().toISOString();
      if (existing && action.mode === "overwrite") {
        return {
          ...state,
          savedYearlyBudgets: state.savedYearlyBudgets.map((snapshot) =>
            snapshot.id === existing.id
              ? { ...snapshot, saved_at: summary.saved_at, summary_json: summary, updated_at: now }
              : snapshot
          ),
        };
      }
      return {
        ...state,
        savedYearlyBudgets: [...state.savedYearlyBudgets, {
          id: makeId("saved-year"),
          budget_year_id: summary.budget_year_id,
          year: summary.year,
          saved_at: summary.saved_at,
          summary_json: summary,
          created_at: now,
          updated_at: now,
        }],
      };
    }
    case "DELETE_SAVED_MONTHLY_BUDGET":
      return { ...state, savedMonthlyBudgets: state.savedMonthlyBudgets.filter((snapshot) => snapshot.id !== action.id) };
    case "DELETE_SAVED_YEARLY_BUDGET":
      return { ...state, savedYearlyBudgets: state.savedYearlyBudgets.filter((snapshot) => snapshot.id !== action.id) };
    case "UPDATE_SAVED_MONTHLY_BUDGET_NOTES":
      return {
        ...state,
        savedMonthlyBudgets: state.savedMonthlyBudgets.map((snapshot) =>
          snapshot.id === action.id
            ? {
              ...snapshot,
              summary_json: { ...snapshot.summary_json, notes: action.notes },
              updated_at: new Date().toISOString(),
            }
            : snapshot
        ),
      };
    case "UPDATE_SAVED_YEARLY_BUDGET_NOTES":
      return {
        ...state,
        savedYearlyBudgets: state.savedYearlyBudgets.map((snapshot) =>
          snapshot.id === action.id
            ? {
              ...snapshot,
              summary_json: { ...snapshot.summary_json, notes: action.notes },
              updated_at: new Date().toISOString(),
            }
            : snapshot
        ),
      };
    case "COMPLETE_SETUP": {
      const profile = action.profile;
      const setupCategories = profile.categories
        .filter((category) => category.name.trim())
        .map((category) => ({ ...category, type: category.type as CategoryType }));
      const repeatedPlan = MONTHS.map((_, month) => ({
        month,
        income: toNumber(profile.expectedIncome),
        savings: toNumber(profile.expectedSavings),
        debt: toNumber(profile.expectedDebt),
        expenses: toNumber(profile.expectedExpenses),
      }));
      return {
        ...state,
        setupCompleted: true,
        activeYear: profile.year,
        startDayOfWeek: profile.startDayOfWeek ?? state.startDayOfWeek,
        timezone: profile.timezone ?? state.timezone,
        paymentMethods: profile.paymentMethods ?? state.paymentMethods,
        setupProfile: profile,
        budgetYears: [{
          id: makeId("budget-year"),
          name: profile.budgetName,
          year: profile.year,
          startMonth: profile.startMonth,
          currency: profile.currency,
        }],
        categories: setupCategories,
        expectedAmounts: repeatedPlan,
      };
    }
    case "RESET_PREVIEW_DATA":
      return createPreviewState(state.selectedMonth);
    case "RESET_APP_DATA":
      resetSetup();
      return emptyState;
    default:
      return state;
  }
}

function loadInitialState(): FinanceState {
  if (typeof window === "undefined") return emptyState;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      const setupProfile = getSetupProfile();
      return setupProfile
        ? reducer(emptyState, { type: "COMPLETE_SETUP", profile: setupProfile })
        : emptyState;
    }
    const parsed = JSON.parse(saved) as Partial<FinanceState>;
    const activeYear = normalizeYear(
      parsed.activeYear ?? parsed.setupProfile?.year ?? parsed.budgetYears?.[0]?.year ?? currentYear
    );
    return {
      ...emptyState,
      ...parsed,
      activeYear,
      selectedMonth: typeof parsed.selectedMonth === "number"
        ? Math.min(11, Math.max(0, parsed.selectedMonth))
        : emptyState.selectedMonth,
      startDayOfWeek: parsed.startDayOfWeek ?? emptyState.startDayOfWeek,
      timezone: parsed.timezone ?? emptyState.timezone,
      paymentMethods: parsed.paymentMethods ?? [],
      categories: parsed.categories ?? [],
      transactions: parsed.transactions ?? [],
      expectedAmounts: parsed.expectedAmounts ?? [],
      paymentPlans: parsed.paymentPlans ?? [],
      savedMonthlyBudgets: parsed.savedMonthlyBudgets ?? [],
      savedYearlyBudgets: parsed.savedYearlyBudgets ?? [],
      budgetYears: parsed.budgetYears ?? [],
      savingsGoals: parsed.savingsGoals ?? [],
      debtAccounts: parsed.debtAccounts ?? [],
      monthlyNotes: parsed.monthlyNotes ?? {},
    };
  } catch {
    return emptyState;
  }
}

export function shouldCountAsActual(transaction: Transaction) {
  if (transaction.type === "expense" && transaction.expenseKind === "fixed") {
    return transaction.status === "paid" || transaction.status === "cleared";
  }
  return true;
}

export function deriveActualAmounts(transactions: Transaction[], year?: string) {
  const months = MONTHS.map((_, month) => getZeroMonth(month));
  transactions
    .filter((transaction) => !year || dateYear(transaction.date) === year)
    .filter(shouldCountAsActual)
    .forEach((transaction) => {
    const month = dateMonth(transaction.date) ?? currentMonthIndex;
    const target = months[month];
    if (!target) return;
    if (transaction.type === "income") target.income += transaction.amount;
    if (transaction.type === "savings") target.savings += transaction.amount;
    if (transaction.type === "debt") target.debt += transaction.amount;
    if (transaction.type === "expense") target.expenses += transaction.amount;
    });
  return months;
}

export function derivePendingTransactions(state: FinanceState, year = state.activeYear): Transaction[] {
  const pendingFixed = state.transactions.filter(
    (transaction) =>
      transaction.type === "expense" &&
      transaction.expenseKind === "fixed" &&
      transaction.status === "pending" &&
      dateYear(transaction.dueDate ?? transaction.date) === year
  );
  const pendingPlans = state.paymentPlans
    .filter((plan) => plan.status === "active" && dateYear(plan.nextDueDate) === year)
    .map<Transaction>((plan) => ({
      id: `payment-plan:${plan.id}`,
      name: plan.name,
      amount: plan.amount,
      type: "expense",
      category: plan.category,
      date: plan.nextDueDate,
      status: "pending",
      expenseKind: "fixed",
      dueDate: plan.nextDueDate,
      isFixed: true,
    }));
  return [...pendingFixed, ...pendingPlans].sort((a, b) =>
    String(a.dueDate ?? a.date).localeCompare(String(b.dueDate ?? b.date))
  );
}

export function getExpenseCategoryData(transactions: Transaction[]) {
  return Object.values(
    transactions
      .filter((transaction) => transaction.type === "expense" && shouldCountAsActual(transaction))
      .reduce<Record<string, { category: string; amount: number }>>((groups, transaction) => {
        const category = transaction.category || "Uncategorized";
        groups[category] ??= { category, amount: 0 };
        groups[category].amount += transaction.amount;
        return groups;
      }, {})
  ).sort((a, b) => b.amount - a.amount);
}

interface FinanceContextValue {
  state: FinanceState;
  activeYear: string;
  selectedMonth: number;
  startDayOfWeek: StartDayOfWeek;
  timezone: string;
  paymentMethods: PaymentMethod[];
  previewModeEnabled: boolean;
  categories: Category[];
  transactions: Transaction[];
  expectedAmounts: ExpectedAmount[];
  actualAmounts: MonthlyAmount[];
  paymentPlans: PaymentPlan[];
  pendingTransactions: Transaction[];
  savedMonthlyBudgets: SavedMonthlyBudget[];
  savedYearlyBudgets: SavedYearlyBudget[];
  setActiveYear(year: string): void;
  setSelectedMonth(month: number): void;
  updatePreferences(updates: Partial<Pick<FinanceState, "startDayOfWeek" | "timezone">>): void;
  addPaymentMethod(paymentMethod: Omit<PaymentMethod, "id">): void;
  updatePaymentMethod(id: string, updates: Partial<PaymentMethod>): void;
  deletePaymentMethod(id: string): void;
  setPreviewModeEnabled(enabled: boolean): void;
  addCategory(category: Omit<Category, "id">): void;
  updateCategory(id: string, updates: Partial<Category>): void;
  deleteCategory(id: string): void;
  addTransaction(transaction: Omit<Transaction, "id">): void;
  addTransactions(transactions: Array<Omit<Transaction, "id">>): void;
  updateTransaction(id: string, updates: Partial<Transaction>): void;
  deleteTransaction(id: string): void;
  updateMonthlyPlan(month: number, plan: Partial<ExpectedAmount>): void;
  addPaymentPlan(plan: Omit<PaymentPlan, "id" | "nextDueDate"> & { nextDueDate?: string }): void;
  updatePaymentPlan(id: string, updates: Partial<PaymentPlan>): void;
  deletePaymentPlan(id: string): void;
  markTransactionPaid(id: string): void;
  saveMonthlyBudgetSnapshot(year: string, month: number, mode?: SnapshotSaveMode): void;
  saveYearlyBudgetSnapshot(year: string, mode?: SnapshotSaveMode): void;
  deleteSavedMonthlyBudget(id: string): void;
  deleteSavedYearlyBudget(id: string): void;
  updateSavedMonthlyBudgetNotes(id: string, notes: string): void;
  updateSavedYearlyBudgetNotes(id: string, notes: string): void;
  completeSetup(profile: SetupProfile): void;
  resetAppData(): void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
  const [previewState, previewDispatch] = useReducer(reducer, undefined, () => createPreviewState());
  const [previewModeEnabled, setPreviewModeEnabledState] = useState(loadPreviewEnabled);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (DEV_PREVIEW_MODE) {
      window.localStorage.setItem(DEV_PREVIEW_STORAGE_KEY, String(previewModeEnabled));
    }
  }, [previewModeEnabled]);

  const readState = previewModeEnabled ? previewState : state;
  const activeDispatch = previewModeEnabled ? previewDispatch : dispatch;

  const activeTransactions = useMemo(
    () => filterTransactionsByYear(readState.transactions, readState.activeYear),
    [readState.activeYear, readState.transactions]
  );
  const actualAmounts = useMemo(() => deriveActualAmounts(readState.transactions, readState.activeYear), [readState.activeYear, readState.transactions]);
  const activePaymentPlans = useMemo(
    () => filterPaymentPlansByYear(readState.paymentPlans, readState.activeYear),
    [readState.activeYear, readState.paymentPlans]
  );
  const pendingTransactions = useMemo(() => derivePendingTransactions(readState), [readState]);

  const value = useMemo<FinanceContextValue>(() => ({
    state: readState,
    activeYear: readState.activeYear,
    selectedMonth: readState.selectedMonth,
    startDayOfWeek: readState.startDayOfWeek,
    timezone: readState.timezone,
    paymentMethods: readState.paymentMethods,
    previewModeEnabled,
    categories: readState.categories,
    transactions: activeTransactions,
    expectedAmounts: readState.expectedAmounts,
    actualAmounts,
    paymentPlans: activePaymentPlans,
    pendingTransactions,
    savedMonthlyBudgets: readState.savedMonthlyBudgets,
    savedYearlyBudgets: readState.savedYearlyBudgets,
    setActiveYear: (year) => activeDispatch({ type: "SET_ACTIVE_YEAR", year }),
    setSelectedMonth: (month) => activeDispatch({ type: "SET_SELECTED_MONTH", month }),
    updatePreferences: (updates) => activeDispatch({ type: "UPDATE_PREFERENCES", updates }),
    addPaymentMethod: (paymentMethod) => activeDispatch({ type: "ADD_PAYMENT_METHOD", paymentMethod: { id: makeId("payment-method"), ...paymentMethod } }),
    updatePaymentMethod: (id, updates) => activeDispatch({ type: "UPDATE_PAYMENT_METHOD", id, updates }),
    deletePaymentMethod: (id) => activeDispatch({ type: "DELETE_PAYMENT_METHOD", id }),
    setPreviewModeEnabled: (enabled) => {
      if (enabled) previewDispatch({ type: "SET_SELECTED_MONTH", month: state.selectedMonth });
      setPreviewModeEnabledState(enabled);
    },
    addCategory: (category) => activeDispatch({ type: "ADD_CATEGORY", category: { id: makeId("category"), ...category } }),
    updateCategory: (id, updates) => activeDispatch({ type: "UPDATE_CATEGORY", id, updates }),
    deleteCategory: (id) => activeDispatch({ type: "DELETE_CATEGORY", id }),
    addTransaction: (transaction) => activeDispatch({ type: "ADD_TRANSACTION", transaction: { id: makeId("transaction"), ...transaction } }),
    addTransactions: (transactions) => activeDispatch({
      type: "ADD_TRANSACTIONS",
      transactions: transactions.map((transaction) => ({ id: makeId("transaction"), ...transaction })),
    }),
    updateTransaction: (id, updates) => activeDispatch({ type: "UPDATE_TRANSACTION", id, updates }),
    deleteTransaction: (id) => activeDispatch({ type: "DELETE_TRANSACTION", id }),
    updateMonthlyPlan: (month, plan) => activeDispatch({ type: "UPDATE_MONTHLY_PLAN", month, plan }),
    addPaymentPlan: (plan) => activeDispatch({
      type: "ADD_PAYMENT_PLAN",
      plan: {
        id: makeId("payment-plan"),
        ...plan,
        nextDueDate: plan.nextDueDate ?? nextPaymentDate(plan.dueDay, readState.activeYear),
      },
    }),
    updatePaymentPlan: (id, updates) => activeDispatch({ type: "UPDATE_PAYMENT_PLAN", id, updates }),
    deletePaymentPlan: (id) => activeDispatch({ type: "DELETE_PAYMENT_PLAN", id }),
    markTransactionPaid: (id) => {
      if (id.startsWith("payment-plan:")) {
        activeDispatch({ type: "MARK_PAYMENT_PLAN_PAID", id: id.replace("payment-plan:", "") });
      } else {
        activeDispatch({ type: "MARK_TRANSACTION_PAID", id });
      }
    },
    saveMonthlyBudgetSnapshot: (year, month, mode = "overwrite") => activeDispatch({ type: "SAVE_MONTHLY_BUDGET", year, month, mode }),
    saveYearlyBudgetSnapshot: (year, mode = "overwrite") => activeDispatch({ type: "SAVE_YEARLY_BUDGET", year, mode }),
    deleteSavedMonthlyBudget: (id) => activeDispatch({ type: "DELETE_SAVED_MONTHLY_BUDGET", id }),
    deleteSavedYearlyBudget: (id) => activeDispatch({ type: "DELETE_SAVED_YEARLY_BUDGET", id }),
    updateSavedMonthlyBudgetNotes: (id, notes) => activeDispatch({ type: "UPDATE_SAVED_MONTHLY_BUDGET_NOTES", id, notes }),
    updateSavedYearlyBudgetNotes: (id, notes) => activeDispatch({ type: "UPDATE_SAVED_YEARLY_BUDGET_NOTES", id, notes }),
    completeSetup: (profile) => {
      if (previewModeEnabled) {
        previewDispatch({ type: "COMPLETE_SETUP", profile });
      } else {
        persistSetupComplete(profile);
        dispatch({ type: "COMPLETE_SETUP", profile });
      }
    },
    resetAppData: () => {
      if (previewModeEnabled) previewDispatch({ type: "RESET_PREVIEW_DATA" });
      else dispatch({ type: "RESET_APP_DATA" });
    },
  }), [activeDispatch, activePaymentPlans, activeTransactions, actualAmounts, pendingTransactions, previewModeEnabled, readState, state.selectedMonth]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinanceData() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error("useFinanceData must be used inside FinanceDataProvider");
  }
  return context;
}

export { getAmountLeft, getZeroMonth };
