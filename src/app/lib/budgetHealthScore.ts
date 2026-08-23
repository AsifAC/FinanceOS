export interface BudgetHealthScoreInput {
  actualIncome?: number;
  expectedIncome?: number;
  actualExpenses?: number;
  expectedExpenses?: number;
  actualSavings?: number;
  expectedSavings?: number;
  actualDebtPayments?: number;
  expectedDebtPayments?: number;
  selectedMonth?: number;
  selectedYear?: string | number;
}

export interface BudgetHealthScoreBreakdown {
  score: number;
  savingsPerformance: number;
  expenseControl: number;
  cashFlowHealth: number;
  debtProgress: number;
  actualAmountLeft: number;
  expectedAmountLeft: number;
  selectedMonth?: number;
  selectedYear?: string | number;
}

function finite(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function progressScore(actualValue: number, expectedValue: number) {
  if (expectedValue <= 0) return 100;
  return clamp((actualValue / expectedValue) * 100);
}

function expenseControlScore(actualValue: number, expectedValue: number) {
  if (expectedValue <= 0) return actualValue <= 0 ? 100 : 0;
  if (actualValue <= expectedValue) return 100;
  return clamp(100 - ((actualValue - expectedValue) / expectedValue) * 100);
}

function amountLeftScore(actualAmountLeft: number, expectedAmountLeft: number) {
  if (expectedAmountLeft > 0) return clamp((actualAmountLeft / expectedAmountLeft) * 100);
  if (expectedAmountLeft === 0) return actualAmountLeft >= 0 ? 100 : 0;
  return actualAmountLeft >= expectedAmountLeft ? 100 : 0;
}

function cashFlowScore(actualIncome: number, actualAmountLeft: number, expectedAmountLeft: number) {
  const cashFlowFloor = actualAmountLeft >= 0
    ? 100
    : actualIncome > 0
      ? clamp(100 + (actualAmountLeft / actualIncome) * 100)
      : 0;

  return Math.round((cashFlowFloor + amountLeftScore(actualAmountLeft, expectedAmountLeft)) / 2);
}

export function calculateBudgetHealthScore(input: BudgetHealthScoreInput): BudgetHealthScoreBreakdown {
  const actualIncome = finite(input.actualIncome);
  const expectedIncome = finite(input.expectedIncome);
  const actualExpenses = finite(input.actualExpenses);
  const expectedExpenses = finite(input.expectedExpenses);
  const actualSavings = finite(input.actualSavings);
  const expectedSavings = finite(input.expectedSavings);
  const actualDebtPayments = finite(input.actualDebtPayments);
  const expectedDebtPayments = finite(input.expectedDebtPayments);

  const actualAmountLeft = actualIncome - actualExpenses - actualSavings - actualDebtPayments;
  const expectedAmountLeft = expectedIncome - expectedExpenses - expectedSavings - expectedDebtPayments;

  const savingsPerformance = Math.round(progressScore(actualSavings, expectedSavings));
  const expenseControl = Math.round(expenseControlScore(actualExpenses, expectedExpenses));
  const debtProgress = Math.round(progressScore(actualDebtPayments, expectedDebtPayments));
  const cashFlowHealth = cashFlowScore(actualIncome, actualAmountLeft, expectedAmountLeft);

  const score = Math.round(clamp(
    savingsPerformance * 0.3 +
    expenseControl * 0.3 +
    cashFlowHealth * 0.25 +
    debtProgress * 0.15
  ));

  return {
    score,
    savingsPerformance,
    expenseControl,
    cashFlowHealth,
    debtProgress,
    actualAmountLeft,
    expectedAmountLeft,
    selectedMonth: input.selectedMonth,
    selectedYear: input.selectedYear,
  };
}
