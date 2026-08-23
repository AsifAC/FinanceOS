import { Category, ExpectedAmount, PaymentPlan, Transaction } from "../app/data/data";
import type { SavedMonthlyBudget, SavedYearlyBudget } from "../app/lib/financeStore";
import { MONTHS } from "../app/lib/constants";
import { DEV_PREVIEW_YEAR } from "../config/devPreview";

const year = DEV_PREVIEW_YEAR;

export const mockCategories: Category[] = [
  { id: "mock-cat-salary", name: "Software Engineering Salary", type: "income", color: "#00D68F", icon: "$" },
  { id: "mock-cat-tutoring", name: "Tutoring", type: "income", color: "#22C55E", icon: "+" },
  { id: "mock-cat-freelance", name: "Freelance Project", type: "income", color: "#10B981", icon: "F" },
  { id: "mock-cat-interest", name: "Interest Income", type: "income", color: "#84CC16", icon: "%" },
  { id: "mock-cat-rent", name: "Rent", type: "expense", color: "#EF4444", icon: "H" },
  { id: "mock-cat-utilities", name: "Utilities", type: "expense", color: "#F97316", icon: "U" },
  { id: "mock-cat-internet", name: "Internet", type: "expense", color: "#FB7185", icon: "W" },
  { id: "mock-cat-phone", name: "Phone", type: "expense", color: "#F43F5E", icon: "P" },
  { id: "mock-cat-groceries", name: "Groceries", type: "expense", color: "#FB923C", icon: "G" },
  { id: "mock-cat-dining", name: "Dining", type: "expense", color: "#FDBA74", icon: "D" },
  { id: "mock-cat-transport", name: "Transportation", type: "expense", color: "#F59E0B", icon: "T" },
  { id: "mock-cat-entertainment", name: "Entertainment", type: "expense", color: "#A855F7", icon: "E" },
  { id: "mock-cat-shopping", name: "Shopping", type: "expense", color: "#EC4899", icon: "S" },
  { id: "mock-cat-health", name: "Healthcare", type: "expense", color: "#14B8A6", icon: "+" },
  { id: "mock-cat-emergency", name: "Emergency Fund", type: "savings", color: "#3B82F6", icon: "E" },
  { id: "mock-cat-house", name: "House Fund", type: "savings", color: "#2563EB", icon: "H" },
  { id: "mock-cat-vacation", name: "Vacation Fund", type: "savings", color: "#38BDF8", icon: "V" },
  { id: "mock-cat-investing", name: "Investment Contributions", type: "savings", color: "#06B6D4", icon: "I" },
  { id: "mock-cat-student", name: "Student Loan", type: "debt", color: "#F59E0B", icon: "S" },
  { id: "mock-cat-car", name: "Car Loan", type: "debt", color: "#D97706", icon: "C" },
  { id: "mock-cat-card", name: "Credit Card", type: "debt", color: "#FBBF24", icon: "C" },
];

const expectedIncomeByMonth = [6400, 6450, 6500, 6550, 6600, 6650, 6725, 6780, 6825, 6900, 7000, 7150];
const expectedExpensesByMonth = [3650, 3550, 3625, 3700, 3825, 3750, 3900, 3850, 3725, 3800, 4025, 4250];
const expectedSavingsByMonth = [500, 550, 650, 700, 775, 825, 900, 875, 800, 850, 950, 1050];
const expectedDebtByMonth = [520, 500, 490, 480, 470, 460, 450, 440, 425, 410, 390, 375];

export const mockExpectedAmounts: ExpectedAmount[] = MONTHS.map((_, month) => ({
  month,
  income: expectedIncomeByMonth[month],
  savings: expectedSavingsByMonth[month],
  debt: expectedDebtByMonth[month],
  expenses: expectedExpensesByMonth[month],
}));

const variableExpenses = [
  ["Groceries", [620, 570, 610, 640, 690, 660, 720, 700, 630, 680, 740, 790]],
  ["Dining", [260, 220, 310, 280, 340, 390, 420, 360, 300, 330, 410, 520]],
  ["Transportation", [210, 240, 190, 230, 260, 250, 280, 270, 220, 240, 260, 310]],
  ["Entertainment", [140, 120, 160, 180, 210, 240, 260, 230, 170, 190, 220, 280]],
  ["Shopping", [220, 180, 260, 240, 310, 290, 340, 320, 260, 300, 380, 520]],
  ["Healthcare", [90, 120, 80, 110, 140, 100, 160, 130, 95, 115, 150, 180]],
] as const;

const fixedExpenseItems = [
  ["Rent", 2050, 1],
  ["Utilities", 185, 5],
  ["Internet", 78, 8],
  ["Phone", 92, 10],
] as const;

function date(month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function tx(
  id: string,
  month: number,
  day: number,
  name: string,
  amount: number,
  type: Transaction["type"],
  category: string,
  notes?: string,
  status: Transaction["status"] = "paid",
): Transaction {
  return {
    id,
    name,
    amount,
    type,
    category,
    date: date(month, day),
    status,
    expenseKind: type === "expense" ? "variable" : undefined,
    notes,
  };
}

const transactions: Transaction[] = [];

MONTHS.forEach((_, month) => {
  transactions.push(tx(`mock-income-salary-${month}`, month, 1, "Software Engineering Salary", 5200 + month * 45 + (month % 3) * 120, "income", "Software Engineering Salary", "Biweekly salary deposits"));
  transactions.push(tx(`mock-income-tutoring-${month}`, month, 12, "Tutoring", 320 + (month % 4) * 75, "income", "Tutoring", "Weekend tutoring sessions"));
  if (month % 2 === 0) transactions.push(tx(`mock-income-freelance-${month}`, month, 20, "Freelance Project", 700 + month * 35, "income", "Freelance Project", "Client milestone payment"));
  transactions.push(tx(`mock-income-interest-${month}`, month, 28, "Interest Income", 35 + month * 3, "income", "Interest Income", "HYSA interest"));

  fixedExpenseItems.forEach(([name, amount, day]) => {
    transactions.push({
      ...tx(`mock-expense-${name.toLowerCase().replaceAll(" ", "-")}-${month}`, month, day, name, amount + (name === "Utilities" ? (month % 5) * 18 : 0), "expense", name, "Recurring monthly bill"),
      expenseKind: "fixed",
      dueDate: date(month, day),
      isFixed: true,
    });
    transactions.push({
      ...tx(
        `mock-expected-${name.toLowerCase().replaceAll(" ", "-")}-${month}`,
        month,
        Math.min(day + 14, 27),
        `Expected ${name}`,
        amount + (name === "Utilities" ? (month % 5) * 18 : 0),
        "expense",
        name,
        "Expected monthly transaction",
        "pending",
      ),
      expenseKind: "fixed",
      dueDate: date(month, Math.min(day + 14, 27)),
      isFixed: true,
    });
  });

  variableExpenses.forEach(([name, amounts], index) => {
    transactions.push(tx(`mock-expense-${name.toLowerCase()}-${month}`, month, 9 + index * 3, name, amounts[month], "expense", name, "Preview spending trend"));
  });

  transactions.push(tx(`mock-saving-emergency-${month}`, month, 3, "Emergency Fund", 300 + (month % 4) * 50, "savings", "Emergency Fund", "Automatic transfer"));
  transactions.push(tx(`mock-saving-house-${month}`, month, 15, "House Fund", 250 + month * 25, "savings", "House Fund", "Down payment savings"));
  transactions.push(tx(`mock-saving-invest-${month}`, month, 18, "Investment Contributions", 275 + (month % 3) * 75, "savings", "Investment Contributions", "Brokerage contribution"));
  if (month >= 4) transactions.push(tx(`mock-saving-vacation-${month}`, month, 22, "Vacation Fund", 125 + (month % 2) * 50, "savings", "Vacation Fund", "Travel fund"));

  transactions.push(tx(`mock-debt-student-${month}`, month, 6, "Student Loan", Math.max(180, 360 - month * 8), "debt", "Student Loan", "Scheduled loan payment"));
  transactions.push(tx(`mock-debt-car-${month}`, month, 11, "Car Loan", 285, "debt", "Car Loan", "Auto loan payment"));
  if (month < 9) transactions.push(tx(`mock-debt-card-${month}`, month, 24, "Credit Card", Math.max(90, 240 - month * 15), "debt", "Credit Card", "Extra payoff"));
});

export const mockTransactions = transactions;

export const mockPaymentPlans: PaymentPlan[] = [
  { id: "mock-plan-rent", name: "Rent", amount: 2050, category: "Rent", frequency: "monthly", dueDay: 1, status: "active", nextDueDate: `${year}-12-01` },
  { id: "mock-plan-internet", name: "Internet", amount: 78, category: "Internet", frequency: "monthly", dueDay: 8, status: "active", nextDueDate: `${year}-12-08` },
  { id: "mock-plan-student-loan", name: "Student Loan", amount: 275, category: "Student Loan", frequency: "monthly", dueDay: 6, status: "active", nextDueDate: `${year}-12-06` },
];

function amountFor(month: number, type: Transaction["type"]) {
  return mockTransactions
    .filter((transaction) => transaction.type === type && new Date(transaction.date).getMonth() === month)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

function expenseBreakdowns(month?: number) {
  return Object.values(mockTransactions
    .filter((transaction) => transaction.type === "expense")
    .filter((transaction) => month === undefined || new Date(transaction.date).getMonth() === month)
    .reduce<Record<string, { category: string; amount: number }>>((groups, transaction) => {
      groups[transaction.category] ??= { category: transaction.category, amount: 0 };
      groups[transaction.category].amount += transaction.amount;
      return groups;
    }, {})).sort((a, b) => b.amount - a.amount);
}

export const mockSavedMonthlyBudgets: SavedMonthlyBudget[] = [2, 5, 8, 11].map((month) => {
  const income = amountFor(month, "income");
  const savings = amountFor(month, "savings");
  const debt = amountFor(month, "debt");
  const expenses = amountFor(month, "expense");
  const expected = mockExpectedAmounts[month];
  const summary = {
    budget_year_id: `mock-budget-year-${year}`,
    year,
    month,
    month_label: MONTHS[month],
    saved_at: `${year}-${String(month + 1).padStart(2, "0")}-28T18:30:00.000Z`,
    income,
    savings,
    debt,
    expenses,
    amount_left: income - savings - debt - expenses,
    expected_income: expected.income,
    expected_savings: expected.savings,
    expected_debt: expected.debt,
    expected_expenses: expected.expenses,
    expected_amount_left: expected.income - expected.savings - expected.debt - expected.expenses,
    actual_amount_left: income - savings - debt - expenses,
    savings_rate: Math.round((savings / income) * 1000) / 10,
    expense_rate: Math.round((expenses / income) * 1000) / 10,
    debt_payment_rate: Math.round((debt / income) * 1000) / 10,
    category_breakdowns: expenseBreakdowns(month),
    transaction_count: mockTransactions.filter((transaction) => new Date(transaction.date).getMonth() === month).length,
    pending_transaction_count: 0,
    notes: "Developer preview snapshot for archive layout testing.",
  };
  return {
    id: `mock-saved-month-${month}`,
    budget_year_id: summary.budget_year_id,
    year,
    month,
    month_label: summary.month_label,
    saved_at: summary.saved_at,
    summary_json: summary,
    created_at: summary.saved_at,
    updated_at: summary.saved_at,
  };
});

export const mockSavedYearlyBudgets: SavedYearlyBudget[] = [{
  id: "mock-saved-year-2027",
  budget_year_id: `mock-budget-year-${year}`,
  year,
  saved_at: `${year}-12-31T20:00:00.000Z`,
  summary_json: {
    budget_year_id: `mock-budget-year-${year}`,
    year,
    saved_at: `${year}-12-31T20:00:00.000Z`,
    total_income: MONTHS.reduce((sum, _, month) => sum + amountFor(month, "income"), 0),
    total_savings: MONTHS.reduce((sum, _, month) => sum + amountFor(month, "savings"), 0),
    total_debt: MONTHS.reduce((sum, _, month) => sum + amountFor(month, "debt"), 0),
    total_expenses: MONTHS.reduce((sum, _, month) => sum + amountFor(month, "expense"), 0),
    total_amount_left: MONTHS.reduce((sum, _, month) => sum + amountFor(month, "income") - amountFor(month, "savings") - amountFor(month, "debt") - amountFor(month, "expense"), 0),
    expected_yearly_income: mockExpectedAmounts.reduce((sum, month) => sum + month.income, 0),
    expected_yearly_savings: mockExpectedAmounts.reduce((sum, month) => sum + month.savings, 0),
    expected_yearly_debt: mockExpectedAmounts.reduce((sum, month) => sum + month.debt, 0),
    expected_yearly_expenses: mockExpectedAmounts.reduce((sum, month) => sum + month.expenses, 0),
    best_savings_month: "December",
    highest_income_month: "November",
    highest_expense_month: "December",
    highest_debt_payoff_month: "January",
    yearly_category_rankings: expenseBreakdowns(),
    yearly_monthly_breakdown: MONTHS.map((monthLabel, month) => ({
      month,
      month_label: monthLabel,
      income: amountFor(month, "income"),
      savings: amountFor(month, "savings"),
      debt: amountFor(month, "debt"),
      expenses: amountFor(month, "expense"),
      amount_left: amountFor(month, "income") - amountFor(month, "savings") - amountFor(month, "debt") - amountFor(month, "expense"),
    })),
    notes: "Developer preview annual archive snapshot.",
  },
  created_at: `${year}-12-31T20:00:00.000Z`,
  updated_at: `${year}-12-31T20:00:00.000Z`,
}];

export const mockFinanceData = {
  year,
  budgetYears: [{
    id: `mock-budget-year-${year}`,
    name: "Developer Preview Budget",
    year,
    startMonth: "January",
    currency: "USD ($)",
  }],
  categories: mockCategories,
  expectedAmounts: mockExpectedAmounts,
  transactions: mockTransactions,
  paymentPlans: mockPaymentPlans,
  savedMonthlyBudgets: mockSavedMonthlyBudgets,
  savedYearlyBudgets: mockSavedYearlyBudgets,
};
