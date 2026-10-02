import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { AlertCircle, ArrowLeft, CheckCircle2, PlusCircle, Save, Trash2 } from "lucide-react";
import { useCategories } from "../../../hooks/useCategories";
import { usePaymentMethods } from "../../../hooks/usePaymentMethods";
import { useTransactions } from "../../../hooks/useTransactions";
import { useAuth } from "../../../hooks/useAuth";
import type { SupabaseTransactionType } from "../../../types/supabase";
import { getSelectableCategories } from "../../lib/selectableCategories";
import { getSelectablePaymentMethods } from "../../lib/selectablePaymentMethods";
import { localTransactionDate } from "../../lib/transactionDates";
import { validateActualTransactionDraft, toCreateTransactionInput, type ActualTransactionDraft, type ActualTransactionDraftErrors } from "../../lib/actualTransactionDrafts";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

const transactionTypes: { value: SupabaseTransactionType; label: string; color: string }[] = [
  { value: "income", label: "Income", color: "#00A676" },
  { value: "expense", label: "Expense", color: "#DC2626" },
  { value: "savings", label: "Savings", color: "#2563EB" },
  { value: "debt", label: "Debt", color: "#D97706" },
];

type DraftFields = Omit<ActualTransactionDraft, "draftId">;
type FormErrors = ActualTransactionDraftErrors;
type DraftError = { message: string };

function initialType(value: string | null): SupabaseTransactionType {
  return transactionTypes.some((item) => item.value === value) ? value as SupabaseTransactionType : "expense";
}

function emptyFields(type: SupabaseTransactionType): DraftFields {
  return { title: "", amount: "", type, transaction_date: localTransactionDate(), category_id: null, payment_method_id: null, notes: "" };
}

function makeDraftId() {
  return `actual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeError(code: string) {
  if (code === "not_authenticated") return "Your session ended. Sign in again before saving.";
  if (code === "account_changed") return "The active account changed. Review this draft before saving again.";
  if (code === "access_denied" || code === "invalid_input") return "Check the transaction details and confirm the selected account category and payment method are still available.";
  return "This transaction could not be saved. The draft is still here so you can retry.";
}

function typeName(type: SupabaseTransactionType) {
  return transactionTypes.find((item) => item.value === type)?.label ?? type;
}

function formatAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value;
}

function ErrorMessage({ children }: { children?: string }) {
  return children ? <p className="mt-1 text-xs text-[#FCA5A5]" role="alert">{children}</p> : null;
}

export function AddTransaction() {
  const [searchParams] = useSearchParams();
  const queryType = initialType(searchParams.get("type"));
  const { user } = useAuth();
  const owner = user?.id ?? null;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const mounted = useRef(true);
  const saveLock = useRef(false);
  const { categories, isLoading: categoriesLoading, error: categoriesError } = useCategories();
  const { paymentMethods, isLoading: methodsLoading, error: methodsError } = usePaymentMethods();
  const { createTransaction } = useTransactions();
  const [form, setForm] = useState<DraftFields>(() => emptyFields(queryType));
  const [drafts, setDrafts] = useState<ActualTransactionDraft[]>([]);
  const [draftErrors, setDraftErrors] = useState<Record<string, DraftError>>({});
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error" | "info"; message: string } | null>(null);
  const [filter, setFilter] = useState<SupabaseTransactionType | "all">("all");

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    setForm((current) => current.type === queryType ? current : { ...current, type: queryType, category_id: null });
  }, [queryType]);

  const selectableCategories = useMemo(() => getSelectableCategories(categories, form.type), [categories, form.type]);
  const selectableMethods = useMemo(() => getSelectablePaymentMethods(paymentMethods), [paymentMethods]);
  const shownDrafts = filter === "all" ? drafts : drafts.filter((draft) => draft.type === filter);
  const totals = useMemo(() => transactionTypes.reduce<Record<SupabaseTransactionType, number>>((result, item) => {
    result[item.value] = drafts.filter((draft) => draft.type === item.value).reduce((sum, draft) => sum + Number(draft.amount), 0);
    return result;
  }, { income: 0, expense: 0, savings: 0, debt: 0 }), [drafts]);

  function changeForm(updates: Partial<DraftFields>) {
    setForm((current) => ({ ...current, ...updates }));
    setFieldErrors(Object.keys(fieldErrors).length ? validateActualTransactionDraft({ ...form, ...updates }) : {});
  }

  function addDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateActualTransactionDraft(form);
    if (form.category_id && !selectableCategories.some((category) => category.id === form.category_id)) {
      errors.category_id = "Choose an active category for this transaction type.";
    }
    if (form.payment_method_id && !selectableMethods.some((method) => method.id === form.payment_method_id)) {
      errors.payment_method_id = "Choose an active payment method.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setDrafts((current) => [...current, { ...form, title: form.title.trim(), notes: form.notes.trim(), draftId: makeDraftId() }]);
    setFilter(form.type);
    setForm(emptyFields(form.type));
    setFeedback({ kind: "info", message: "Added for review. Saving records this as an actual completed event in your account." });
  }

  function removeDraft(draftId: string) {
    setDrafts((current) => current.filter((draft) => draft.draftId !== draftId));
    setDraftErrors((current) => { const next = { ...current }; delete next[draftId]; return next; });
  }

  async function saveAll() {
    if (saveLock.current || saving) return;
    if (!owner) {
      setFeedback({ kind: "error", message: "Your session is unavailable. Sign in before saving actual transactions." });
      return;
    }
    if (!drafts.length) {
      setFeedback({ kind: "error", message: "Add at least one actual transaction to review." });
      return;
    }

    const ownerAtSubmit = owner;
    const errorsByDraft = new Map<string, string>();
    for (const draft of drafts) {
      const errors = validateActualTransactionDraft(draft);
      if (draft.category_id && !getSelectableCategories(categories, draft.type).some((item) => item.id === draft.category_id)) {
        errors.category_id = "Choose an active category for this transaction type.";
      }
      if (draft.payment_method_id && !selectableMethods.some((item) => item.id === draft.payment_method_id)) {
        errors.payment_method_id = "Choose an active payment method.";
      }
      if (Object.keys(errors).length) errorsByDraft.set(draft.draftId, Object.values(errors)[0] ?? "Review this transaction.");
    }
    if (errorsByDraft.size) {
      setDraftErrors(Object.fromEntries([...errorsByDraft].map(([id, message]) => [id, { message }])));
      setFeedback({ kind: "error", message: "Some drafts are invalid or reference metadata that is no longer selectable. Review them and retry." });
      return;
    }

    saveLock.current = true;
    setSaving(true);
    setFeedback(null);
    setDraftErrors({});
    let savedCount = 0;
    let failedCount = 0;
    const batch = [...drafts];
    try {
      for (const draft of batch) {
        if (!mounted.current || ownerRef.current !== ownerAtSubmit) return;
        setSavingDraft(draft.draftId);
        const result = await createTransaction(toCreateTransactionInput(draft));
        if (!mounted.current || ownerRef.current !== ownerAtSubmit) return;
        if (result.ok) {
          savedCount += 1;
          setDrafts((current) => current.filter((item) => item.draftId !== draft.draftId));
          setDraftErrors((current) => { const next = { ...current }; delete next[draft.draftId]; return next; });
        } else {
          failedCount += 1;
          setDraftErrors((current) => ({ ...current, [draft.draftId]: { message: safeError(result.error.code) } }));
        }
      }
      if (savedCount && failedCount) {
        setFeedback({ kind: "error", message: `Saved ${savedCount} transaction${savedCount === 1 ? "" : "s"}; ${failedCount} draft${failedCount === 1 ? " remains" : "s remain"} unsaved. Retry only the remaining drafts.` });
      } else if (savedCount) {
        setFeedback({ kind: "success", message: `Saved ${savedCount} actual transaction${savedCount === 1 ? "" : "s"} to your account.` });
      } else {
        setFeedback({ kind: "error", message: `No transactions were saved. ${failedCount} draft${failedCount === 1 ? " remains" : "s remain"} available to retry.` });
      }
    } catch {
      if (mounted.current && ownerRef.current === ownerAtSubmit) {
        setFeedback({ kind: "error", message: "The batch stopped unexpectedly. Unconfirmed drafts remain for review; verify your ledger before retrying." });
      }
    } finally {
      saveLock.current = false;
      if (mounted.current && ownerRef.current === ownerAtSubmit) {
        setSaving(false);
        setSavingDraft(null);
      }
    }
  }

  return (
    <section className="transactions-ledger" aria-labelledby="actual-entry-title">
      <div className="transactions-heading">
        <div>
          <p className="transactions-eyebrow">Your account · Actual records only</p>
          <h1 id="actual-entry-title">Record Transactions</h1>
          <p>Save completed income, expenses, savings, or debt events to your account.</p>
        </div>
        <Button asChild variant="outline"><Link to="/transactions"><ArrowLeft size={15} className="mr-2" />Transactions</Link></Button>
      </div>

      <div className="mb-5 rounded-2xl border border-[#84cc16]/20 bg-[#84cc16]/[0.06] p-3 text-sm text-[var(--financeos-text-secondary)]">
        Only record an event that has already happened. Planned amounts, pending obligations, fixed-expense schedules, and payment-plan projections are not saved here.
      </div>

      {feedback && <p className={`mb-4 rounded-xl border p-3 text-sm ${feedback.kind === "error" ? "border-red-500/30 text-red-300" : feedback.kind === "success" ? "border-lime-500/30 text-lime-300" : "border-[var(--financeos-border)] text-[var(--financeos-text-secondary)]"}`} role="status">{feedback.message}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(26rem,1.1fr)]">
        <form className="space-y-5 rounded-[24px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-4 shadow-[var(--financeos-shadow-card)] sm:p-6" onSubmit={addDraft} aria-label="Actual transaction form">
          <fieldset disabled={saving} className="space-y-5 disabled:opacity-70">
            <div>
              <Label className="text-[var(--financeos-text-secondary)]">Transaction type</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {transactionTypes.map((item) => <button key={item.value} type="button" aria-pressed={form.type === item.value} onClick={() => changeForm({ type: item.value, category_id: null })} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${form.type === item.value ? "text-white" : "border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] text-[var(--financeos-text-muted)]"}`} style={form.type === item.value ? { backgroundColor: item.color, borderColor: item.color } : undefined}>{item.label}</button>)}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="actual-title">Title</Label><Input id="actual-title" required maxLength={240} className="mt-1" placeholder="Payroll, groceries, loan payment…" value={form.title} onChange={(event) => changeForm({ title: event.target.value })} /><ErrorMessage>{fieldErrors.title}</ErrorMessage></div>
              <div><Label htmlFor="actual-amount">Amount</Label><Input id="actual-amount" required type="number" inputMode="decimal" min="0.01" max="999999999999.99" step="0.01" className="mt-1" placeholder="0.00" value={form.amount} onChange={(event) => changeForm({ amount: event.target.value })} /><ErrorMessage>{fieldErrors.amount}</ErrorMessage></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="actual-category">Category</Label><select id="actual-category" className="financeos-select mt-1 h-10 w-full rounded-md border px-3 text-sm" value={form.category_id ?? ""} onChange={(event) => changeForm({ category_id: event.target.value || null })}><option value="">Not assigned</option>{selectableCategories.map((category) => <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ""}{category.name}</option>)}</select><ErrorMessage>{fieldErrors.category_id}</ErrorMessage>{categoriesError && <p className="mt-1 text-xs text-amber-500">Categories are unavailable; no local categories are used.</p>}</div>
              <div><Label htmlFor="actual-date">Transaction date</Label><Input id="actual-date" required type="date" className="mt-1" value={form.transaction_date} onChange={(event) => changeForm({ transaction_date: event.target.value })} /><ErrorMessage>{fieldErrors.transaction_date}</ErrorMessage></div>
            </div>

            <div><Label htmlFor="actual-payment-method">Payment method</Label><select id="actual-payment-method" className="financeos-select mt-1 h-10 w-full rounded-md border px-3 text-sm" value={form.payment_method_id ?? ""} onChange={(event) => changeForm({ payment_method_id: event.target.value || null })}><option value="">No payment method</option>{selectableMethods.map((method) => <option key={method.id} value={method.id}>{method.nickname}{method.is_default ? " · Default" : ""}</option>)}</select><ErrorMessage>{fieldErrors.payment_method_id}</ErrorMessage>{methodsError && <p className="mt-1 text-xs text-amber-500">Payment methods are unavailable; no local methods are used.</p>}</div>

            <div><Label htmlFor="actual-notes">Notes (optional)</Label><Textarea id="actual-notes" rows={3} className="mt-1" placeholder="Optional context…" value={form.notes} onChange={(event) => changeForm({ notes: event.target.value })} /></div>
          </fieldset>
          <Button type="submit" disabled={saving} className="gap-2 bg-[#00A676] text-white hover:bg-[#008F66]"><PlusCircle className="h-4 w-4" />Add actual to review</Button>
          {(categoriesLoading || methodsLoading) && <p className="text-xs text-[var(--financeos-text-muted)]" role="status">Loading account categories and payment methods…</p>}
        </form>

        <aside className="rounded-[24px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-4 shadow-[var(--financeos-shadow-card)] sm:p-6" aria-label="Actual transaction review">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="transactions-eyebrow">Review before saving</p><h2 className="mt-1 text-xl font-semibold text-[var(--financeos-text-primary)]">{drafts.length} draft{drafts.length === 1 ? "" : "s"}</h2></div><Button variant="outline" size="sm" disabled={!drafts.length || saving} onClick={() => { setDrafts([]); setDraftErrors({}); setFeedback({ kind: "info", message: "Unsaved drafts cleared." }); }}>Clear drafts</Button></div>

          <div className="mt-4 grid grid-cols-2 gap-2">{transactionTypes.map((item) => <div key={item.value} className="rounded-xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-3"><p className="text-[11px] font-semibold uppercase text-[var(--financeos-text-muted)]">{item.label}</p><p className="mt-1 font-semibold" style={{ color: item.color }}>${totals[item.value].toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>)}</div>

          <div className="mt-4 flex flex-wrap gap-2">{(["all", ...transactionTypes.map((item) => item.value)] as Array<SupabaseTransactionType | "all">).map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === item ? "border-[#8B5CF6]/70 bg-[#8B5CF6]/15 text-[var(--financeos-text-primary)]" : "border-[var(--financeos-border)] text-[var(--financeos-text-muted)]"}`}>{item === "all" ? "All" : typeName(item)}</button>)}</div>

          <div className="mt-4 space-y-2">
            {!drafts.length ? <div className="rounded-2xl border border-dashed border-[var(--financeos-border)] p-6 text-center text-sm text-[var(--financeos-text-muted)]">No drafts yet. Add a completed event to review it here.</div> : shownDrafts.length ? shownDrafts.map((draft) => {
              const categoryName = draft.category_id ? categories.find((item) => item.id === draft.category_id)?.name ?? "Category unavailable" : "Not assigned";
              const paymentName = draft.payment_method_id ? paymentMethods.find((item) => item.id === draft.payment_method_id)?.nickname ?? "Payment method unavailable" : "No payment method";
              return <article key={draft.draftId} className="rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-3" data-draft-id={draft.draftId}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="text-xs font-semibold" style={{ color: transactionTypes.find((item) => item.value === draft.type)?.color }}>{typeName(draft.type)}</span><h3 className="truncate text-sm font-semibold text-[var(--financeos-text-primary)]">{draft.title}</h3><p className="mt-1 text-xs text-[var(--financeos-text-muted)]">{draft.transaction_date} · {categoryName} · {paymentName}</p>{draft.notes && <p className="mt-1 text-xs text-[var(--financeos-text-secondary)]">{draft.notes}</p>}{draftErrors[draft.draftId] && <p role="alert" className="mt-2 flex gap-1 text-xs text-[#FCA5A5]"><AlertCircle size={13} />{draftErrors[draft.draftId].message}</p>}{savingDraft === draft.draftId && <p role="status" className="mt-2 text-xs">Saving…</p>}</div><div className="flex shrink-0 items-center gap-2"><strong className="text-sm text-[var(--financeos-text-primary)]">${formatAmount(draft.amount)}</strong><button type="button" aria-label={`Remove ${draft.title}`} disabled={saving} onClick={() => removeDraft(draft.draftId)} className="rounded-lg p-2 text-[var(--financeos-text-muted)] hover:text-red-400 disabled:opacity-50"><Trash2 size={15} /></button></div></div></article>;
            }) : <div className="rounded-2xl border border-[var(--financeos-border)] p-5 text-center text-sm text-[var(--financeos-text-muted)]">No {filter === "all" ? "" : `${typeName(filter).toLowerCase()} `}drafts.</div>}
          </div>

          <Button disabled={!drafts.length || saving} onClick={() => void saveAll()} className="mt-5 w-full gap-2 bg-[#00A676] text-white hover:bg-[#008F66] disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Saving actual transactions…" : "Save actual transactions"}</Button>
          {feedback?.kind === "success" && <p className="mt-3 text-center text-sm text-lime-300"><CheckCircle2 className="mr-1 inline h-4 w-4" />Saved. <Link className="underline" to="/transactions">View transactions</Link></p>}
        </aside>
      </div>
    </section>
  );
}
