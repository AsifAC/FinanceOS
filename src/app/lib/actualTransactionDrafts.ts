import type { CreateTransactionInput } from "../../services/transactionService";
import type { SupabaseTransactionType } from "../../types/supabase";
import { isValidTransactionDate } from "./transactionDates";

export type ActualTransactionDraft = {
  draftId: string;
  title: string;
  amount: string;
  type: SupabaseTransactionType;
  transaction_date: string;
  category_id: string | null;
  payment_method_id: string | null;
  notes: string;
};

export type ActualTransactionDraftErrors = Partial<Record<
  "title" | "amount" | "transaction_date" | "category_id" | "payment_method_id",
  string
>>;

const MAX_AMOUNT = 999999999999.99;
const AMOUNT_PATTERN = /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/;

export function validateActualTransactionDraft(
  draft: Omit<ActualTransactionDraft, "draftId">,
): ActualTransactionDraftErrors {
  const errors: ActualTransactionDraftErrors = {};
  if (!draft.title.trim()) errors.title = "Title is required.";

  const amountText = draft.amount.trim();
  const amount = Number(amountText);
  if (!amountText || !AMOUNT_PATTERN.test(amountText) || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Enter a positive amount with no more than two decimal places.";
  } else if (amount > MAX_AMOUNT) {
    errors.amount = "Amount exceeds the supported maximum.";
  }

  if (!isValidTransactionDate(draft.transaction_date)) {
    errors.transaction_date = "Enter a valid calendar date.";
  }
  return errors;
}

export function toCreateTransactionInput(
  draft: Omit<ActualTransactionDraft, "draftId" | "amount"> & { amount: string },
): CreateTransactionInput {
  return {
    title: draft.title.trim(),
    amount: Number(draft.amount),
    type: draft.type,
    transaction_date: draft.transaction_date,
    category_id: draft.category_id || null,
    payment_method_id: draft.payment_method_id || null,
    notes: draft.notes.trim() || null,
  };
}
