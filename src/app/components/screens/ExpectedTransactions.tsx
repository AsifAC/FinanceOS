import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { CalendarClock, Plus, RefreshCw, X } from "lucide-react";
import { useExpectedTransactions } from "../../../hooks/useExpectedTransactions";
import { useCategories } from "../../../hooks/useCategories";
import { usePaymentMethods } from "../../../hooks/usePaymentMethods";
import { useAuth } from "../../../hooks/useAuth";
import type { Category, ExpectedTransaction, PaymentMethod, SupabaseTransactionType } from "../../../types/supabase";
import { MONTHS } from "../../lib/constants";
import { resolveCategoryLabel } from "../../lib/categoryLabels";
import { resolvePaymentMethodLabel } from "../../lib/paymentMethodLabels";
import { localTransactionDate, transactionYear } from "../../lib/transactionDates";
import { filterExpectedTransactions, isExpectedTransactionOverdue, sortExpectedTransactions, type ExpectedStatusFilter } from "../../lib/expectedTransactionPresentation";
import { getSelectableCategories } from "../../lib/selectableCategories";
import { getSelectablePaymentMethods } from "../../lib/selectablePaymentMethods";
import { toCreateExpectedTransactionInput, toUpdateExpectedTransactionInput, validateExpectedTransactionDraft, type ExpectedTransactionDraft, type ExpectedTransactionDraftErrors } from "../../lib/expectedTransactionDrafts";
import { Button } from "../ui/button";
import { isExpectedCompletionAvailable } from "../../../services/expectedTransactionService";
import { validateActualTransactionDraft } from "../../lib/actualTransactionDrafts";

const typeLabels: Record<SupabaseTransactionType, string> = {
  income: "Income", expense: "Expense", savings: "Savings", debt: "Debt",
};
const statusLabels = { planned: "Planned", completed: "Recorded as actual", cancelled: "Cancelled" } as const;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const currentYear = Number(localTransactionDate().slice(0, 4));
const emptyDraft = (): ExpectedTransactionDraft => ({
  title: "", amount: "", type: "expense", expected_date: localTransactionDate(),
  category_id: "", payment_method_id: "", notes: "",
});

type Editor = { mode: "create" } | { mode: "edit" | "complete"; row: ExpectedTransaction };

export function ExpectedTransactions() {
  const { user } = useAuth();
  const owner = user?.id ?? null;
  const ownerRef = useRef(owner);
  const ownerGeneration = useRef(0);
  if (ownerRef.current !== owner) ownerGeneration.current += 1;
  ownerRef.current = owner;
  const {
    expectedTransactions, isLoading, error, refresh, isMutating,
    createExpectedTransaction, updateExpectedTransaction, cancelExpectedTransaction,
    reopenExpectedTransaction, deleteExpectedTransaction,
    completeExpectedTransaction,
  } = useExpectedTransactions();
  const { categories, isLoading: categoriesLoading, loadError: categoriesError } = useCategories();
  const { paymentMethods, isLoading: methodsLoading, error: methodsError } = usePaymentMethods();
  const [year, setYear] = useState<number | "all">(currentYear);
  const [monthIndex, setMonthIndex] = useState<number | "all">("all");
  const [type, setType] = useState<SupabaseTransactionType | "all">("all");
  const [status, setStatus] = useState<ExpectedStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draft, setDraft] = useState<ExpectedTransactionDraft>(emptyDraft());
  const [fieldErrors, setFieldErrors] = useState<ExpectedTransactionDraftErrors>({});
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [presentationOwner, setPresentationOwner] = useState(owner);
  const busyRef = useRef(false);
  const today = localTransactionDate();
  const years = useMemo(() => [...new Set([currentYear, ...expectedTransactions.flatMap((row) => {
    const value = transactionYear(row.expected_date);
    return value === null ? [] : [value];
  })])].sort((a, b) => b - a), [expectedTransactions]);
  const rows = useMemo(() => sortExpectedTransactions(filterExpectedTransactions(expectedTransactions,
    { year, monthIndex, type, status, search }, today)),
  [expectedTransactions, year, monthIndex, type, status, search, today]);

  useEffect(() => {
    setPresentationOwner(owner);
    setEditor(null);
    setFeedback(null);
    setFieldErrors({});
    busyRef.current = false;
    setBusy(false);
  }, [owner]);

  const openCreate = () => {
    setDraft(emptyDraft()); setFieldErrors({}); setFeedback(null); setEditor({ mode: "create" });
  };
  const openEdit = (row: ExpectedTransaction, mode: "edit" | "complete" = "edit") => {
    if (row.status === "completed") return;
    if (mode === "complete" && (row.status !== "planned" || !isExpectedCompletionAvailable)) return;
    setDraft({ title: row.title, amount: String(row.amount), type: row.type, expected_date: row.expected_date,
      category_id: row.category_id ?? "", payment_method_id: row.payment_method_id ?? "", notes: row.notes ?? "" });
    setFieldErrors({}); setFeedback(null); setEditor({ mode, row });
  };

  const submitEditor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || busyRef.current || isMutating) return;
    const actualErrors = editor.mode === "complete" ? validateActualTransactionDraft({
      ...draft, transaction_date: draft.expected_date,
      category_id: draft.category_id || null, payment_method_id: draft.payment_method_id || null,
    }) : null;
    const errors: ExpectedTransactionDraftErrors = actualErrors
      ? { title: actualErrors.title, amount: actualErrors.amount, expected_date: actualErrors.transaction_date }
      : validateExpectedTransactionDraft(draft);
    // Omit undefined errors before checking whether validation failed.
    Object.keys(errors).forEach((key) => { if (!errors[key as keyof ExpectedTransactionDraftErrors]) delete errors[key as keyof ExpectedTransactionDraftErrors]; });
    const selectedCategory = draft.category_id ? categories.find((item) => item.id === draft.category_id) : null;
    const historicalCategory = editor.mode === "edit" && editor.row.category_id === draft.category_id;
    if (draft.category_id && selectedCategory && selectedCategory.type !== draft.type) errors.category_id = "Choose a category for this event type.";
    if (draft.category_id && selectedCategory?.is_archived && (!historicalCategory || editor.mode === "complete")) errors.category_id = "Choose an active category or clear this reference.";
    const selectedMethod = draft.payment_method_id ? paymentMethods.find((item) => item.id === draft.payment_method_id) : null;
    const historicalMethod = editor.mode === "edit" && editor.row.payment_method_id === draft.payment_method_id;
    if (draft.payment_method_id && selectedMethod?.is_archived && (!historicalMethod || editor.mode === "complete")) errors.payment_method_id = "Choose an active payment method or clear this reference.";
    if (editor.mode === "complete") {
      if (draft.category_id && !selectedCategory) errors.category_id = "Wait for categories, choose an active category, or clear this reference.";
      if (draft.payment_method_id && !selectedMethod) errors.payment_method_id = "Wait for payment methods, choose an active method, or clear this reference.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    const ownerAtStart = ownerRef.current;
    const generationAtStart = ownerGeneration.current;
    if (!ownerAtStart) { setFeedback({ kind: "error", message: "Sign in before saving expected transactions." }); return; }
    busyRef.current = true; setBusy(true); setFeedback(null);
    const result = editor.mode === "create"
      ? await createExpectedTransaction(toCreateExpectedTransactionInput(draft))
      : editor.mode === "complete"
        ? await completeExpectedTransaction(editor.row.id, {
          title: draft.title.trim(), amount: Number(draft.amount), transaction_date: draft.expected_date,
          category_id: draft.category_id || null, payment_method_id: draft.payment_method_id || null, notes: draft.notes.trim() || null,
        })
        : await updateExpectedTransaction(editor.row.id, toUpdateExpectedTransactionInput(draft));
    if (ownerRef.current === ownerAtStart && ownerGeneration.current === generationAtStart) {
      if (result.ok) {
        setEditor(null); setFeedback({ kind: "success", message: editor.mode === "complete" ? "Recorded as actual. The expected event remains as history." : editor.mode === "create" ? "Expected event created." : "Expected event updated." });
      } else setFeedback({ kind: "error", message: result.error.message });
      busyRef.current = false; setBusy(false);
    }
  };

  const runRowAction = async (row: ExpectedTransaction, action: "cancel" | "reopen" | "delete") => {
    if (busyRef.current || isMutating || row.status === "completed") return;
    if (action === "cancel" && row.status !== "planned") return;
    if (action === "reopen" && row.status !== "cancelled") return;
    if (action === "delete" && !window.confirm(`Delete planned event “${row.title}” for ${money.format(row.amount)} on ${row.expected_date}? This cannot be undone.`)) return;
    const ownerAtStart = ownerRef.current;
    const generationAtStart = ownerGeneration.current;
    if (!ownerAtStart) return;
    busyRef.current = true; setBusy(true); setFeedback(null);
    const result = action === "cancel" ? await cancelExpectedTransaction(row.id)
      : action === "reopen" ? await reopenExpectedTransaction(row.id) : await deleteExpectedTransaction(row.id);
    if (ownerRef.current === ownerAtStart && ownerGeneration.current === generationAtStart) {
      setFeedback(result.ok
        ? { kind: "success", message: action === "cancel" ? "Expected event cancelled." : action === "reopen" ? "Expected event reopened." : "Expected event deleted." }
        : { kind: "error", message: result.error.message });
      busyRef.current = false; setBusy(false);
    }
  };

  const selectableCategories = getSelectableCategories(categories, draft.type);
  const categoryOptions = [...selectableCategories];
  if (editor && editor.mode !== "create" && draft.category_id && !categoryOptions.some((item) => item.id === draft.category_id)) {
    const historical = categories.find((item) => item.id === draft.category_id);
    if (historical && historical.type === draft.type) categoryOptions.push(historical);
  }
  const selectableMethods = getSelectablePaymentMethods(paymentMethods);
  const methodOptions = [...selectableMethods];
  if (editor && editor.mode !== "create" && draft.payment_method_id && !methodOptions.some((item) => item.id === draft.payment_method_id)) {
    const historical = paymentMethods.find((item) => item.id === draft.payment_method_id);
    if (historical) methodOptions.push(historical);
  }
  const setField = <K extends keyof ExpectedTransactionDraft>(key: K, value: ExpectedTransactionDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  return (
    <section className="transactions-ledger expected-transactions-ledger" aria-labelledby="expected-transactions-title">
      <div className="transactions-heading">
        <div>
          <p className="transactions-eyebrow">Your account · Planned events</p>
          <h1 id="expected-transactions-title">Expected Transactions</h1>
          <p>Dated financial events you plan to happen. These are separate from actual transactions and monthly budget targets.</p>
        </div>
        <div className="expected-transactions-heading-actions">
          <Button onClick={openCreate} disabled={isLoading || isMutating}><Plus size={15} aria-hidden="true" />Create Expected Transaction</Button>
          <Button asChild variant="outline"><Link to="/transactions">View Actual Transactions</Link></Button>
          <Button variant="outline" className="transactions-refresh" disabled={isLoading || isMutating} onClick={() => void refresh()}>
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </Button>
        </div>
      </div>

      {feedback && !editor && presentationOwner === owner && <p className={`transactions-feedback ${feedback.kind === "error" ? "transactions-feedback-error" : ""}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}{feedback.kind === "success" && feedback.message.startsWith("Recorded as actual") && <> <Link to="/transactions">View actual ledger</Link></>}</p>}

      <div className="transactions-filters expected-transactions-filters" aria-label="Expected transaction filters">
        <label>Year<select aria-label="Filter expected transactions by year" value={year} onChange={(event) => setYear(event.target.value === "all" ? "all" : Number(event.target.value))}>
          <option value="all">All years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
        <label>Month<select aria-label="Filter expected transactions by month" value={monthIndex} onChange={(event) => setMonthIndex(event.target.value === "all" ? "all" : Number(event.target.value))}>
          <option value="all">All months</option>{MONTHS.map((label, index) => <option key={label} value={index}>{label}</option>)}
        </select></label>
        <label>Type<select aria-label="Filter expected transactions by type" value={type} onChange={(event) => setType(event.target.value as SupabaseTransactionType | "all")}>
          <option value="all">All types</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Status<select aria-label="Filter expected transactions by status" value={status} onChange={(event) => setStatus(event.target.value as ExpectedStatusFilter)}>
          <option value="all">All statuses</option><option value="planned">Planned</option><option value="overdue">Overdue</option><option value="completed">Recorded as actual</option><option value="cancelled">Cancelled</option>
        </select></label>
        <label className="expected-transactions-search">Search<input aria-label="Search expected transactions by title" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title" /></label>
        <p className="transactions-count" aria-live="polite">{isLoading ? "Loading expected events…" : error ? "Expected events unavailable" : `${rows.length} ${rows.length === 1 ? "event" : "events"}`}</p>
      </div>

      {isLoading ? (
        <div className="transactions-state" role="status" aria-label="Loading expected transactions"><span className="sr-only">Loading account expected transactions…</span><div className="transactions-skeleton" aria-hidden="true">{[0, 1, 2, 3].map((index) => <div key={index}><span /><span /></div>)}</div></div>
      ) : error ? (
        <div className="transactions-state" role="alert"><h2>Unable to load expected transactions</h2><p>We couldn’t load your account’s planned events. Please try again.</p><Button variant="outline" onClick={() => void refresh()}>Retry</Button></div>
      ) : rows.length === 0 ? (
        <div className="transactions-state" role="status"><CalendarClock size={25} aria-hidden="true" /><h2>{expectedTransactions.length === 0 ? "No expected transactions yet" : "No expected events for these filters"}</h2><p>{expectedTransactions.length === 0 ? "Dated financial events you plan will appear here. Monthly budget targets and browser-local plans are kept separate." : "Choose another year, month, type, status, or search term."}</p></div>
      ) : (
        <div className="transactions-table-wrap">
          <table className="transactions-table expected-transactions-table">
            <caption className="sr-only">Account expected financial events, planned events first. Amounts in USD.</caption>
            <thead><tr>{["Expected date", "Title", "Type", "Category", "Payment method", "Amount", "Status", "Actions"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{rows.map((row) => {
              const overdue = isExpectedTransactionOverdue(row, today);
              return <tr key={row.id} data-expected-transaction-id={row.id}>
                <td data-label="Expected date"><time dateTime={row.expected_date}>{row.expected_date}</time></td>
                <td className="transactions-description" data-label="Title"><div><strong>{row.title}</strong>{row.notes && <p className="transactions-notes">{row.notes}</p>}{row.status === "completed" && row.actual_transaction_id && <small>Linked actual transaction recorded</small>}</div></td>
                <td data-label="Type"><span className={`transactions-type transactions-type-${row.type}`}>{typeLabels[row.type]}</span></td>
                <td data-label="Category">{resolveCategoryLabel(row.category_id, categories, categoriesLoading)}</td>
                <td data-label="Payment method">{resolvePaymentMethodLabel(row.payment_method_id, paymentMethods, methodsLoading, methodsError !== null)}</td>
                <td data-label="Amount" className="transactions-amount">{money.format(row.amount)}</td>
                <td data-label="Status"><span className={`expected-status expected-status-${overdue ? "overdue" : row.status}`}>{overdue ? "Overdue · Planned" : statusLabels[row.status]}</span></td>
                <td data-label="Actions" className="transactions-actions expected-event-actions">
                  {row.status !== "completed" ? <>
                    {row.status === "planned" && isExpectedCompletionAvailable && <button type="button" disabled={busy || isMutating} aria-label={`Record ${row.title} as completed`} onClick={() => openEdit(row, "complete")}>Record as completed</button>}
                    <button type="button" disabled={busy || isMutating} aria-label={`Edit ${row.title}`} onClick={() => openEdit(row)}>Edit</button>
                    {row.status === "planned" ? <button type="button" disabled={busy || isMutating} aria-label={`Cancel ${row.title}`} onClick={() => void runRowAction(row, "cancel")}>Cancel</button>
                      : <button type="button" disabled={busy || isMutating} aria-label={`Reopen ${row.title}`} onClick={() => void runRowAction(row, "reopen")}>Reopen</button>}
                    <button type="button" disabled={busy || isMutating} aria-label={`Delete ${row.title}`} onClick={() => void runRowAction(row, "delete")}>Delete</button>
                  </> : <span>Read only</span>}
                </td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
      <p className="transactions-footnote">Expected events are not actual financial activity. Monthly targets, fixed local plans, and payment-plan recurrence rules are not included.</p>

      {editor && presentationOwner === owner && <div className="transactions-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditor(null); }}>
        <section className="transactions-dialog expected-event-dialog" role="dialog" aria-modal="true" aria-labelledby="expected-event-dialog-title">
          <div className="expected-event-dialog-heading"><h2 id="expected-event-dialog-title">{editor.mode === "complete" ? "Record as completed" : editor.mode === "create" ? "Create Expected Transaction" : "Edit Expected Transaction"}</h2><button type="button" className="expected-event-close" aria-label="Close expected transaction editor" disabled={busy} onClick={() => setEditor(null)}><X size={18} /></button></div>
          {editor.mode === "complete" ? <><p>Planned event: <strong>{editor.row.title}</strong> · {money.format(editor.row.amount)} · {editor.row.expected_date}</p><p>This creates a new actual transaction and keeps the expected event as history. Confirm the actual fields below.</p></> : <p>This records a planned event, not an actual transaction. Actual activity is recorded separately.</p>}
          {feedback?.kind === "error" && <p className="transactions-feedback-error" role="alert">{feedback.message}</p>}
          <form onSubmit={(event) => void submitEditor(event)} noValidate>
            <label>Title<input autoFocus aria-label="Expected transaction title" value={draft.title} onChange={(event) => setField("title", event.target.value)} />{fieldErrors.title && <small>{fieldErrors.title}</small>}</label>
            <label>Amount<input aria-label="Expected transaction amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.amount} onChange={(event) => setField("amount", event.target.value)} />{fieldErrors.amount && <small>{fieldErrors.amount}</small>}</label>
            <label>Type<select disabled={editor.mode === "complete"} aria-label="Expected transaction type" value={draft.type} onChange={(event) => {
              const nextType = event.target.value as SupabaseTransactionType;
              if (draft.category_id) {
                const selected = categories.find((category) => category.id === draft.category_id);
                if (!selected || selected.type !== nextType) setField("category_id", "");
              }
              setField("type", nextType);
            }}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{fieldErrors.type && <small>{fieldErrors.type}</small>}</label>
            <label>{editor.mode === "complete" ? "Actual date" : "Expected date"}<input aria-label={editor.mode === "complete" ? "Actual transaction date" : "Expected transaction date"} type="date" value={draft.expected_date} onChange={(event) => setField("expected_date", event.target.value)} />{fieldErrors.expected_date && <small>{fieldErrors.expected_date}</small>}</label>
            <label>Category<select aria-label="Expected transaction category" value={draft.category_id} onChange={(event) => setField("category_id", event.target.value)}><option value="">Not assigned</option>{categoryOptions.map((category: Category) => <option key={category.id} value={category.id}>{category.name}{category.is_archived ? " · Archived (existing)" : ""}</option>)}{draft.category_id && !categoryOptions.some((category) => category.id === draft.category_id) && <option value={draft.category_id}>Unknown category · Existing</option>}</select>{fieldErrors.category_id && <small>{fieldErrors.category_id}</small>}{categoriesError && <small>Categories are unavailable; you can save without changing the current category.</small>}</label>
            <label>Payment method<select aria-label="Expected transaction payment method" value={draft.payment_method_id} onChange={(event) => setField("payment_method_id", event.target.value)}><option value="">Not assigned</option>{methodOptions.map((method: PaymentMethod) => <option key={method.id} value={method.id}>{method.nickname}{method.is_archived ? " · Archived (existing)" : ""}{method.is_default ? " · Default" : ""}</option>)}{draft.payment_method_id && !methodOptions.some((method) => method.id === draft.payment_method_id) && <option value={draft.payment_method_id}>Unknown payment method · Existing</option>}</select>{fieldErrors.payment_method_id && <small>{fieldErrors.payment_method_id}</small>}{methodsError && <small>Payment methods are unavailable; you can save without changing the current method.</small>}</label>
            <label>Notes<textarea aria-label="Expected transaction notes" value={draft.notes} onChange={(event) => setField("notes", event.target.value)} /></label>
            <div className="transactions-dialog-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => setEditor(null)}>Close</Button><Button type="submit" disabled={busy || isMutating}>{busy ? "Saving…" : editor.mode === "complete" ? "Record as completed" : editor.mode === "create" ? "Create planned event" : "Save changes"}</Button></div>
          </form>
        </section>
      </div>}
    </section>
  );
}
