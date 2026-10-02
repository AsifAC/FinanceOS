import type {
  ExpectedTransactionCreateInput,
  ExpectedTransactionUpdateInput,
} from "../../services/expectedTransactionService";
import type { SupabaseTransactionType } from "../../types/supabase";
import { isValidTransactionDate } from "./transactionDates";

export type ExpectedTransactionDraft = {
  title: string;
  amount: string;
  type: SupabaseTransactionType;
  expected_date: string;
  category_id: string;
  payment_method_id: string;
  notes: string;
};

export type ExpectedTransactionDraftErrors = Partial<Record<keyof ExpectedTransactionDraft, string>>;

const amountPattern = /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/;
const maximumAmount = 999999999999.99;

export function validateExpectedTransactionDraft(draft: ExpectedTransactionDraft): ExpectedTransactionDraftErrors {
  const errors: ExpectedTransactionDraftErrors = {};
  if (!draft.title.trim()) errors.title = "Title is required.";
  const rawAmount = draft.amount.trim();
  const amount = Number(rawAmount);
  if (!rawAmount || !amountPattern.test(rawAmount) || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Enter a positive amount with no more than two decimal places.";
  } else if (amount > maximumAmount) errors.amount = "Amount exceeds the supported maximum.";
  if (!isValidTransactionDate(draft.expected_date)) errors.expected_date = "Enter a valid calendar date.";
  if (!["income", "expense", "savings", "debt"].includes(draft.type)) errors.type = "Choose a valid event type.";
  return errors;
}

export function toCreateExpectedTransactionInput(draft: ExpectedTransactionDraft): ExpectedTransactionCreateInput {
  return {
    title: draft.title.trim(), amount: Number(draft.amount), type: draft.type,
    expected_date: draft.expected_date, category_id: draft.category_id || null,
    payment_method_id: draft.payment_method_id || null, notes: draft.notes.trim() || null,
  };
}

export function toUpdateExpectedTransactionInput(draft: ExpectedTransactionDraft): ExpectedTransactionUpdateInput {
  return toCreateExpectedTransactionInput(draft);
}
