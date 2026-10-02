import { useEffect, useRef, useState, type FormEvent } from "react";
import { ListOrdered, RefreshCw } from "lucide-react";
import { useTransactions } from "../../../hooks/useTransactions";
import { useCategories } from "../../../hooks/useCategories";
import { usePaymentMethods } from "../../../hooks/usePaymentMethods";
import { useAuth } from "../../../hooks/useAuth";
import type { SupabaseTransactionType, Transaction } from "../../../types/supabase";
import { MONTHS } from "../../lib/constants";
import { resolveCategoryLabel } from "../../lib/categoryLabels";
import { resolvePaymentMethodLabel } from "../../lib/paymentMethodLabels";
import { filterTransactionsByMonth, filterTransactionsByYear, transactionYear } from "../../lib/transactionDates";
import { getSelectableCategories } from "../../lib/selectableCategories";
import { getSelectablePaymentMethods } from "../../lib/selectablePaymentMethods";
import { toCreateTransactionInput, validateActualTransactionDraft, type ActualTransactionDraftErrors } from "../../lib/actualTransactionDrafts";
import { Button } from "../ui/button";

const typeLabels: Record<SupabaseTransactionType, string> = {
  income: "Income", expense: "Expense", savings: "Savings", debt: "Debt",
};
const sourceLabels: Record<Transaction["source"], string> = {
  manual: "Manual", recurring: "Recurring", import: "Imported", migration: "Migrated",
};
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function newestFirst(a: Transaction, b: Transaction) {
  return b.transaction_date.localeCompare(a.transaction_date)
    || Date.parse(b.created_at) - Date.parse(a.created_at)
    || b.id.localeCompare(a.id);
}

function safeMutationError(code: string) {
  if (code === "linked_expected_event") return "This actual transaction is linked to a completed expected event and cannot be deleted. Undo completion is not available yet.";
  if (code === "not_authenticated") return "Your session ended. Sign in again before continuing.";
  if (code === "account_changed") return "The active account changed. Reload the ledger before continuing.";
  if (code === "not_found") return "This transaction is no longer available in your account.";
  if (code === "access_denied" || code === "invalid_input") return "Check the transaction details and account-owned category or payment method.";
  return "The transaction could not be changed. Please try again.";
}

type EditFields = { title: string; amount: string; type: SupabaseTransactionType; transaction_date: string; category_id: string | null; payment_method_id: string | null; notes: string };

export function Transactions() {
  const { transactions, isLoading, error, refresh, updateTransaction, deleteTransaction } = useTransactions();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { paymentMethods, isLoading: paymentMethodsLoading, error: paymentMethodsError } = usePaymentMethods();
  const { user } = useAuth();
  const alive = useRef(true);
  const currentOwner = useRef(user?.id);
  currentOwner.current = user?.id;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [currentYear] = useState(() => new Date().getFullYear());
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | null>(null);
  const [type, setType] = useState<SupabaseTransactionType | "all">("all");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editFields, setEditFields] = useState<EditFields | null>(null);
  const [editErrors, setEditErrors] = useState<ActualTransactionDraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null);
  const [mutationMessage, setMutationMessage] = useState("");
  const [mutationError, setMutationError] = useState("");
  const years = [...new Set([currentYear, year, ...transactions.flatMap((row) => {
    const rowYear = transactionYear(row.transaction_date);
    return rowYear === null ? [] : [rowYear];
  })])].sort((a, b) => b - a);
  const periodRows = month === null
    ? filterTransactionsByYear(transactions, year)
    : filterTransactionsByMonth(transactions, year, month);
  const rows = periodRows.filter((row) => type === "all" || row.type === type).sort(newestFirst);

  function startEdit(row: Transaction) {
    setEditing(row);
    setEditFields({ title: row.title, amount: String(row.amount), type: row.type, transaction_date: row.transaction_date, category_id: row.category_id, payment_method_id: row.payment_method_id, notes: row.notes ?? "" });
    setEditErrors({});
    setMutationError("");
    setMutationMessage("");
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !editFields || saving) return;
    const errors = validateActualTransactionDraft(editFields);
    setEditErrors(errors);
    if (Object.keys(errors).length) return;
    const owner = user?.id;
    const rowId = editing.id;
    setSaving(true);
    setMutationError("");
    const result = await updateTransaction(rowId, toCreateTransactionInput(editFields));
    if (!alive.current || !owner || currentOwner.current !== owner) return;
    setSaving(false);
    if (!result.ok) {
      setMutationError(safeMutationError(result.error.code));
      return;
    }
    setEditing(null);
    setEditFields(null);
    setMutationMessage("Transaction updated.");
  }

  async function confirmDeleteRow() {
    if (!confirmDelete || deleting) return;
    const owner = user?.id;
    const row = confirmDelete;
    setDeleting(true);
    setMutationError("");
    const result = await deleteTransaction(row.id);
    if (!alive.current || !owner || currentOwner.current !== owner) return;
    setDeleting(false);
    if (!result.ok) {
      setMutationError(safeMutationError(result.error.code));
      setConfirmDelete(null);
      return;
    }
    setConfirmDelete(null);
    setMutationMessage("Transaction deleted.");
  }

  const activeCategories = editFields ? getSelectableCategories(categories, editFields.type) : [];
  const activeMethods = getSelectablePaymentMethods(paymentMethods);
  const currentCategory = editFields?.category_id ? categories.find((item) => item.id === editFields.category_id) : undefined;
  const currentMethod = editFields?.payment_method_id ? paymentMethods.find((item) => item.id === editFields.payment_method_id) : undefined;
  const categoryOptionCurrentOnly = currentCategory && !activeCategories.some((item) => item.id === currentCategory.id);
  const methodOptionCurrentOnly = currentMethod && !activeMethods.some((item) => item.id === currentMethod.id);

  return (
    <section className="transactions-ledger" aria-labelledby="transactions-title">
      <div className="transactions-heading">
        <div>
          <p className="transactions-eyebrow">Your account · Actual records</p>
          <h1 id="transactions-title">Actual Transactions</h1>
          <p>Completed transactions synced to your FinanceOS account.</p>
        </div>
        <Button variant="outline" className="transactions-refresh" disabled={isLoading} onClick={() => void refresh()}>
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </Button>
      </div>
      {mutationMessage && <p role="status" className="transactions-feedback">{mutationMessage}</p>}
      {mutationError && <p role="alert" className="transactions-feedback transactions-feedback-error">{mutationError}</p>}

      <div className="transactions-filters" aria-label="Transaction filters">
        <label>Year<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        <label>Month<select value={month ?? "all"} onChange={(event) => setMonth(event.target.value === "all" ? null : Number(event.target.value))}><option value="all">All months</option>{MONTHS.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></label>
        <label>Type<select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="all">All types</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <p className="transactions-count" aria-live="polite">{isLoading ? "Loading transactions…" : error ? "Transactions unavailable" : `${rows.length} ${rows.length === 1 ? "transaction" : "transactions"}`}</p>
      </div>

      {isLoading ? (
        <div className="transactions-state" role="status" aria-label="Loading transactions"><span className="sr-only">Loading your account transactions…</span><div className="transactions-skeleton" aria-hidden="true">{[0, 1, 2, 3].map((index) => <div key={index}><span /><span /></div>)}</div></div>
      ) : error ? (
        <div className="transactions-state" role="alert"><h2>Unable to load transactions</h2><p>We couldn’t load your account transactions. Please try again.</p><Button variant="outline" onClick={() => void refresh()}>Retry</Button></div>
      ) : rows.length === 0 ? (
        <div className="transactions-state" role="status"><ListOrdered size={25} aria-hidden="true" /><h2>{transactions.length === 0 ? "No transactions yet" : "No transactions for these filters"}</h2><p>{transactions.length === 0 ? "Your completed income, expenses, savings, and debt transactions will appear here." : "Choose another year, month, or transaction type."}</p></div>
      ) : (
        <div className="transactions-table-wrap">
          <table className="transactions-table">
            <caption className="sr-only">Actual account transactions, newest first. Amounts in USD.</caption>
            <thead><tr>{["Date", "Title", "Type", "Category", "Payment method", "Amount", "Actions"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.id}>
                <td data-label="Date"><time dateTime={row.transaction_date}>{row.transaction_date}</time></td>
                <td className="transactions-description" data-label="Title"><div><strong>{row.title}</strong>{row.notes && <p className="transactions-notes">{row.notes}</p>}<small>Source: {sourceLabels[row.source]}</small></div></td>
                <td data-label="Type"><span className={`transactions-type transactions-type-${row.type}`}>{typeLabels[row.type]}</span></td>
                <td data-label="Category">{resolveCategoryLabel(row.category_id, categories, categoriesLoading)}</td>
                <td data-label="Payment method">{resolvePaymentMethodLabel(row.payment_method_id, paymentMethods, paymentMethodsLoading, paymentMethodsError !== null)}</td>
                <td data-label="Amount" className="transactions-amount">{money.format(row.amount)}</td>
                <td data-label="Actions" className="transactions-actions"><button type="button" onClick={() => startEdit(row)} aria-label={`Edit ${row.title}`}>Edit</button><button type="button" onClick={() => { setConfirmDelete(row); setMutationError(""); }} aria-label={`Delete ${row.title}`}>Delete</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className="transactions-footnote">Amounts shown in USD. Archived categories and payment methods may remain visible on historical transactions.</p>

      {editing && editFields && <div className="transactions-dialog-backdrop"><section className="transactions-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-transaction-title">
        <h2 id="edit-transaction-title">Edit transaction</h2>
        <form onSubmit={(event) => void submitEdit(event)}>
          <label>Title<input autoFocus value={editFields.title} onChange={(event) => setEditFields({ ...editFields, title: event.target.value })} />{editErrors.title && <small role="alert">{editErrors.title}</small>}</label>
          <label>Amount<input inputMode="decimal" value={editFields.amount} onChange={(event) => setEditFields({ ...editFields, amount: event.target.value })} />{editErrors.amount && <small role="alert">{editErrors.amount}</small>}</label>
          <label>Type<select value={editFields.type} onChange={(event) => {
            const nextType = event.target.value as SupabaseTransactionType;
            const nextCategories = getSelectableCategories(categories, nextType);
            const keepCategory = nextCategories.some((category) => category.id === editFields.category_id);
            setEditFields({ ...editFields, type: nextType, category_id: keepCategory ? editFields.category_id : null });
          }}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Date<input type="date" value={editFields.transaction_date} onChange={(event) => setEditFields({ ...editFields, transaction_date: event.target.value })} />{editErrors.transaction_date && <small role="alert">{editErrors.transaction_date}</small>}</label>
          <label>Category<select value={editFields.category_id ?? ""} onChange={(event) => setEditFields({ ...editFields, category_id: event.target.value || null })}><option value="">Not assigned</option>{categoryOptionCurrentOnly && currentCategory && <option value={currentCategory.id}>{currentCategory.name} (current historical reference)</option>}{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>Payment method<select value={editFields.payment_method_id ?? ""} onChange={(event) => setEditFields({ ...editFields, payment_method_id: event.target.value || null })}><option value="">Not assigned</option>{methodOptionCurrentOnly && currentMethod && <option value={currentMethod.id}>{currentMethod.nickname} (current historical reference)</option>}{activeMethods.map((method) => <option key={method.id} value={method.id}>{method.nickname}{method.is_default ? " · Default" : ""}</option>)}</select></label>
          <label>Notes<textarea value={editFields.notes} onChange={(event) => setEditFields({ ...editFields, notes: event.target.value })} /></label>
          {mutationError && <p role="alert" className="transactions-feedback-error">{mutationError}</p>}
          <div className="transactions-dialog-actions"><Button type="button" variant="outline" disabled={saving} onClick={() => { setEditing(null); setEditFields(null); }}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button></div>
        </form>
      </section></div>}

      {confirmDelete && <div className="transactions-dialog-backdrop"><section className="transactions-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-transaction-title" aria-describedby="delete-transaction-description">
        <h2 id="delete-transaction-title">Delete transaction?</h2><p id="delete-transaction-description">This permanently deletes <strong>{confirmDelete.title}</strong>, {money.format(confirmDelete.amount)}, dated {confirmDelete.transaction_date}.</p>
        {mutationError && <p role="alert" className="transactions-feedback-error">{mutationError}</p>}
        <div className="transactions-dialog-actions"><Button variant="outline" disabled={deleting} onClick={() => setConfirmDelete(null)}>Cancel</Button><Button variant="destructive" disabled={deleting} onClick={() => void confirmDeleteRow()}>{deleting ? "Deleting…" : "Delete transaction"}</Button></div>
      </section></div>}
    </section>
  );
}
