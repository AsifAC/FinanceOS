export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type FinanceType = "income" | "expense" | "savings" | "debt";

export interface UserOwnedRow {
  id: string;
  user_id: string;
}

export interface Profile extends UserOwnedRow {
  full_name: string | null;
  avatar_url: string | null;
  currency: string | null;
  timezone: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserPreferences extends UserOwnedRow {
  theme: string | null;
  start_day_of_week: string | null;
  preview_mode: boolean | null;
  dashboard_layout: Json;
  notification_settings: Json;
  created_at: string | null;
  updated_at: string | null;
}

export interface Category extends UserOwnedRow {
  name: string;
  type: FinanceType;
  color: string | null;
  icon: string | null;
  is_default: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaymentMethod extends UserOwnedRow {
  name: string;
  type: string;
  institution_name: string | null;
  last4: string | null;
  network: string | null;
  color: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Transaction extends UserOwnedRow {
  category_id: string | null;
  payment_method_id: string | null;
  type: FinanceType;
  title: string;
  amount: number;
  transaction_date: string;
  month: number;
  year: number;
  notes: string | null;
  is_recurring: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ExpectedTransaction extends UserOwnedRow {
  category_id: string | null;
  payment_method_id: string | null;
  type: FinanceType;
  title: string;
  amount: number;
  expected_date: string | null;
  month: number;
  year: number;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SavingsGoal extends UserOwnedRow {
  name: string;
  target_amount: number;
  current_amount: number | null;
  target_date: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SavingsContribution extends UserOwnedRow {
  savings_goal_id: string | null;
  transaction_id: string | null;
  amount: number;
  contribution_date: string;
  month: number;
  year: number;
  created_at: string | null;
}

export interface Debt extends UserOwnedRow {
  name: string;
  lender: string | null;
  original_balance: number | null;
  current_balance: number;
  minimum_payment: number | null;
  interest_rate: number | null;
  due_day: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DebtPayment extends UserOwnedRow {
  debt_id: string | null;
  transaction_id: string | null;
  amount: number;
  payment_date: string;
  month: number;
  year: number;
  created_at: string | null;
}

export interface BudgetSnapshot extends UserOwnedRow {
  month: number | null;
  year: number;
  snapshot_type: "monthly" | "annual";
  total_income: number | null;
  total_expenses: number | null;
  total_savings: number | null;
  total_debt: number | null;
  amount_left: number | null;
  budget_health_score: number | null;
  snapshot_data: Json;
  created_at: string | null;
}

export interface ArchivedBudget extends UserOwnedRow {
  year: number;
  archive_type: string | null;
  title: string;
  annual_report_data: Json;
  pdf_url: string | null;
  archived_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Notification extends UserOwnedRow {
  title: string;
  message: string;
  type: string | null;
  is_read: boolean | null;
  metadata: Json;
  created_at: string | null;
}

export interface ReportCache extends UserOwnedRow {
  month: number | null;
  year: number;
  report_type: string;
  report_data: Json;
  generated_at: string | null;
}

export interface UploadedFile extends UserOwnedRow {
  related_entity_id: string | null;
  related_entity_type: string | null;
  bucket_name: string;
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string | null;
}

export type InsertRow<T extends UserOwnedRow> = Omit<T, "id" | "user_id" | "created_at" | "updated_at"> & Partial<Pick<T, "id" | "user_id">>;
export type UpdateRow<T extends UserOwnedRow> = Partial<Omit<T, "id" | "user_id" | "created_at" | "updated_at">>;
