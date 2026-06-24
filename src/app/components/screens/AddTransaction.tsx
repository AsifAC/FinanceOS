import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AlertCircle, PlusCircle, Save, Trash2, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { CategoryType, Transaction } from "../../data/data";
import { useFinanceData } from "../../lib/financeStore";
import { currentMonthIndex } from "../../lib/constants";
import { toast } from "sonner";

type TransactionDraft = Omit<Transaction, "id"> & {
  draftId: string;
};

type FormState = {
  name: string;
  amount: string;
  type: CategoryType;
  category: string;
  date: string;
  status: "pending" | "paid" | "cleared";
  expenseKind: "fixed" | "variable";
  notes: string;
  paymentMethodId: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const TYPE_OPTIONS: Array<{ value: CategoryType; label: string; gradient: string; ring: string }> = [
  { value: "income", label: "Income", gradient: "from-[#00D68F] to-[#00C26E]", ring: "border-[#00D68F]/70 bg-[#00D68F]/10 text-[#F8FAFC]" },
  { value: "expense", label: "Expense", gradient: "from-[#EF4444] to-[#DC2626]", ring: "border-[#EF4444]/70 bg-[#EF4444]/10 text-[#F8FAFC]" },
  { value: "savings", label: "Savings", gradient: "from-[#3B82F6] to-[#2563EB]", ring: "border-[#3B82F6]/70 bg-[#3B82F6]/10 text-[#F8FAFC]" },
  { value: "debt", label: "Debt", gradient: "from-[#F59E0B] to-[#D97706]", ring: "border-[#F59E0B]/70 bg-[#F59E0B]/10 text-[#F8FAFC]" },
];

const FILTERS: Array<CategoryType | "all"> = ["all", "income", "expense", "savings", "debt"];

function getInitialType(type: string | null): CategoryType {
  if (type === "income" || type === "savings" || type === "debt" || type === "expense") return type;
  return "expense";
}

function getDefaultTransactionDate(year: string) {
  const today = new Date();
  return new Date(Number(year), currentMonthIndex, today.getDate()).toISOString().slice(0, 10);
}

function makeDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function typeLabel(type: CategoryType | "all") {
  if (type === "all") return "All";
  return TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type;
}

function typeGradient(type: CategoryType) {
  return TYPE_OPTIONS.find((item) => item.value === type)?.gradient ?? "from-slate-500 to-slate-700";
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "Name is required.";
  const amount = Number.parseFloat(form.amount);
  if (!form.amount.trim()) errors.amount = "Amount is required.";
  else if (!Number.isFinite(amount) || amount <= 0) errors.amount = "Amount must be greater than 0.";
  if (!form.date) errors.date = "Date is required.";
  else if (Number.isNaN(new Date(form.date).getTime())) errors.date = "Enter a valid date.";
  return errors;
}

function validateDraft(draft: TransactionDraft) {
  return validateForm({
    name: draft.name,
    amount: String(draft.amount),
    type: draft.type,
    category: draft.category,
    date: draft.date,
    status: draft.status,
    expenseKind: draft.expenseKind ?? "variable",
    notes: draft.notes ?? "",
    paymentMethodId: draft.paymentMethodId ?? "",
  });
}

function toDraft(form: FormState): TransactionDraft {
  const amount = Number.parseFloat(form.amount);
  return {
    draftId: makeDraftId(),
    name: form.name.trim(),
    amount,
    type: form.type,
    category: form.category || "Uncategorized",
    date: form.date,
    status: form.status,
    expenseKind: form.type === "expense" ? form.expenseKind : undefined,
    notes: form.notes.trim(),
    paymentMethodId: form.paymentMethodId || undefined,
    dueDate: form.type === "expense" && form.expenseKind === "fixed" ? form.date : undefined,
    isFixed: form.type === "expense" && form.expenseKind === "fixed",
  };
}

function emptyForm(type: CategoryType, year: string): FormState {
  return {
    name: "",
    amount: "",
    type,
    category: "",
    date: getDefaultTransactionDate(year),
    status: "pending",
    expenseKind: "variable",
    notes: "",
    paymentMethodId: "",
  };
}

function TransactionTypeBadge({ type }: { type: CategoryType }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-gradient-to-r ${typeGradient(type)} px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm`}>
      {typeLabel(type)}
    </span>
  );
}

function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-[#FCA5A5]">{children}</p>;
}

function BatchTransactionForm({
  form,
  errors,
  onChange,
  onAdd,
  onCancel,
  categoryOptions,
  paymentMethods,
}: {
  form: FormState;
  errors: FormErrors;
  onChange(updates: Partial<FormState>): void;
  onAdd(): void;
  onCancel(): void;
  categoryOptions: Array<{ id: string; name: string; icon: string }>;
  paymentMethods: Array<{ id: string; nickname: string }>;
}) {
  return (
    <section className="rounded-[24px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-4 shadow-[var(--financeos-shadow-card)] sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Transaction entry</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--financeos-text-primary)]">Add to preview</h2>
      </div>

      <div className="space-y-5">
        <div>
          <Label className="text-[var(--financeos-text-secondary)]">Type</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {TYPE_OPTIONS.map(({ value, label, ring }) => (
              <button
                type="button"
                key={value}
                onClick={() => onChange({ type: value, category: "" })}
                className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  form.type === value
                    ? ring
                    : "border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] text-[var(--financeos-text-muted)] hover:border-[var(--financeos-border-strong)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-[var(--financeos-text-secondary)]">Name / source / merchant</Label>
            <Input
              className="mt-1"
              placeholder="Payroll, rent, credit card..."
              value={form.name}
              onChange={(event) => onChange({ name: event.target.value })}
            />
            <ErrorText>{errors.name}</ErrorText>
          </div>
          <div>
            <Label className="text-[var(--financeos-text-secondary)]">Amount</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]">$</span>
              <Input
                className="pl-7"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(event) => onChange({ amount: event.target.value })}
              />
            </div>
            <ErrorText>{errors.amount}</ErrorText>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-[var(--financeos-text-secondary)]">Category</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)] px-3 text-sm text-[var(--financeos-text-primary)] outline-none focus:border-[#8B5CF6]/70"
              value={form.category}
              onChange={(event) => onChange({ category: event.target.value })}
            >
              <option value="">Uncategorized</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.name}>{category.icon} {category.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[var(--financeos-text-secondary)]">Date</Label>
            <Input
              className="mt-1"
              type="date"
              value={form.date}
              onChange={(event) => onChange({ date: event.target.value })}
            />
            <ErrorText>{errors.date}</ErrorText>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-[var(--financeos-text-secondary)]">Status</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)] px-3 text-sm text-[var(--financeos-text-primary)] outline-none focus:border-[#8B5CF6]/70"
              value={form.status}
              onChange={(event) => onChange({ status: event.target.value as FormState["status"] })}
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="cleared">Cleared</option>
            </select>
          </div>
          <div>
            <Label className="text-[var(--financeos-text-secondary)]">Payment method</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)] px-3 text-sm text-[var(--financeos-text-primary)] outline-none focus:border-[#8B5CF6]/70"
              value={form.paymentMethodId}
              onChange={(event) => onChange({ paymentMethodId: event.target.value })}
            >
              <option value="">No payment method</option>
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>{method.nickname}</option>
              ))}
            </select>
          </div>
          {form.type === "expense" && (
            <div>
              <Label className="text-[var(--financeos-text-secondary)]">Expense kind</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(["fixed", "variable"] as const).map((kind) => (
                  <button
                    type="button"
                    key={kind}
                    onClick={() => onChange({ expenseKind: kind })}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition-colors ${
                      form.expenseKind === kind
                        ? "border-[#3B82F6]/70 bg-[#3B82F6]/12 text-[var(--financeos-text-primary)]"
                        : "border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] text-[var(--financeos-text-muted)] hover:bg-[var(--financeos-surface-hover)]"
                    }`}
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <Label className="text-[var(--financeos-text-secondary)]">Notes</Label>
          <Textarea
            className="mt-1"
            placeholder="Optional context..."
            rows={3}
            value={form.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
          />
        </div>

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <Button
            onClick={onAdd}
            className="gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] text-white shadow-[0_12px_30px_rgba(59,130,246,0.22)] hover:opacity-95"
          >
            <PlusCircle className="h-4 w-4" />
            Add to preview
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            className="rounded-xl"
          >
            Cancel
          </Button>
        </div>
      </div>
    </section>
  );
}

function TransactionPreviewTable({
  drafts,
  invalidDraftIds,
  onRemove,
}: {
  drafts: TransactionDraft[];
  invalidDraftIds: Set<string>;
  onRemove(draftId: string): void;
}) {
  return (
    <div className="space-y-2">
      {drafts.map((draft) => {
        const invalid = invalidDraftIds.has(draft.draftId);
        return (
          <div
            key={draft.draftId}
            className={`grid gap-3 rounded-2xl border p-3 transition-colors hover:bg-[var(--financeos-surface-hover)] sm:grid-cols-[6.5rem_1fr_auto] sm:items-center ${
              invalid ? "border-[#EF4444]/70 bg-[#EF4444]/10" : "border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)]"
            }`}
          >
            <TransactionTypeBadge type={draft.type} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate text-sm font-semibold text-[var(--financeos-text-primary)]">{draft.name}</p>
                <span className="text-xs text-[#64748B]">{draft.date}</span>
              </div>
              <p className="mt-1 truncate text-xs text-[#94A3B8]">
                {draft.category || "Uncategorized"}{draft.notes ? ` · ${draft.notes}` : ""}
              </p>
              {invalid && (
                <p className="mt-1 flex items-center gap-1 text-xs text-[#FCA5A5]">
                  <AlertCircle className="h-3 w-3" />
                  Fix or remove this draft before saving.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <p className="text-sm font-semibold text-[var(--financeos-text-primary)]">${draft.amount.toLocaleString()}</p>
              <button
                type="button"
                aria-label={`Remove ${draft.name}`}
                onClick={() => onRemove(draft.draftId)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--financeos-border)] text-[var(--financeos-text-muted)] transition-colors hover:border-[#EF4444]/40 hover:bg-[#EF4444]/10 hover:text-[#FCA5A5]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TransactionPreviewPanel({
  drafts,
  filter,
  invalidDraftIds,
  onFilterChange,
  onRemove,
  onClear,
  onSaveAll,
}: {
  drafts: TransactionDraft[];
  filter: CategoryType | "all";
  invalidDraftIds: Set<string>;
  onFilterChange(filter: CategoryType | "all"): void;
  onRemove(draftId: string): void;
  onClear(): void;
  onSaveAll(): void;
}) {
  const totals = useMemo(() => TYPE_OPTIONS.reduce<Record<CategoryType, number>>((sum, option) => {
    sum[option.value] = drafts.filter((draft) => draft.type === option.value).reduce((total, draft) => total + draft.amount, 0);
    return sum;
  }, { income: 0, expense: 0, savings: 0, debt: 0 }), [drafts]);
  const filteredDrafts = filter === "all" ? drafts : drafts.filter((draft) => draft.type === filter);

  return (
    <aside className="rounded-[24px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-4 shadow-[var(--financeos-shadow-card)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Pending preview</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--financeos-text-primary)]">{drafts.length} pending item{drafts.length === 1 ? "" : "s"}</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!drafts.length}
          onClick={onClear}
          className="rounded-xl border-[#EF4444]/25 bg-transparent text-[#FCA5A5] hover:border-[#EF4444]/40 hover:bg-[#EF4444]/10"
        >
          Clear preview
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {TYPE_OPTIONS.map(({ value, label, gradient }) => (
          <div key={value} className="rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Total pending {label.toLowerCase()}</p>
            <p className={`mt-2 bg-gradient-to-r ${gradient} bg-clip-text text-lg font-semibold text-transparent`}>
              ${totals[value].toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => onFilterChange(item)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === item
                ? "border-[#8B5CF6]/70 bg-[#8B5CF6]/16 text-[var(--financeos-text-primary)]"
                : "border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] text-[var(--financeos-text-muted)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]"
            }`}
          >
            {typeLabel(item)}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {!drafts.length ? (
          <div className="rounded-[22px] border border-dashed border-[var(--financeos-border-strong)] bg-[var(--financeos-surface-elevated)] p-8 text-center">
            <p className="text-sm font-semibold text-[var(--financeos-text-primary)]">No preview transactions yet.</p>
            <p className="mt-2 text-sm text-[#94A3B8]">Add income, expenses, savings, or debt on the left before saving.</p>
          </div>
        ) : filteredDrafts.length ? (
          <TransactionPreviewTable drafts={filteredDrafts} invalidDraftIds={invalidDraftIds} onRemove={onRemove} />
        ) : (
          <div className="rounded-[22px] border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-6 text-center text-sm text-[var(--financeos-text-muted)]">
            No {typeLabel(filter).toLowerCase()} drafts in the preview.
          </div>
        )}
      </div>

      <Button
        disabled={!drafts.length}
        onClick={onSaveAll}
        className="mt-5 w-full gap-2 rounded-xl bg-gradient-to-r from-[#00D68F] to-[#3B82F6] text-white shadow-[0_12px_30px_rgba(0,214,143,0.18)] hover:opacity-95 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        Save all
      </Button>
    </aside>
  );
}

export function AddTransaction() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = getInitialType(searchParams.get("type"));
  const { activeYear, categories, paymentMethods, addTransactions } = useFinanceData();
  const [form, setForm] = useState<FormState>(() => emptyForm(initialType, activeYear));
  const [errors, setErrors] = useState<FormErrors>({});
  const [drafts, setDrafts] = useState<TransactionDraft[]>([]);
  const [filter, setFilter] = useState<CategoryType | "all">("all");
  const [invalidDraftIds, setInvalidDraftIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setForm((current) => current.type === initialType ? current : { ...current, type: initialType, category: "" });
  }, [initialType]);

  useEffect(() => {
    setForm((current) => {
      const dateYear = new Date(current.date).getFullYear();
      return String(dateYear) === activeYear
        ? current
        : { ...current, date: getDefaultTransactionDate(activeYear) };
    });
  }, [activeYear]);

  const filteredCategories = categories.filter((category) => category.type === form.type);

  function updateForm(updates: Partial<FormState>) {
    setForm((current) => ({ ...current, ...updates }));
    if (Object.keys(errors).length) {
      setErrors(validateForm({ ...form, ...updates }));
    }
  }

  function addToPreview() {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error("Fix the highlighted fields before adding to preview.");
      return;
    }

    const draft = toDraft(form);
    setDrafts((current) => [...current, draft]);
    setInvalidDraftIds((current) => {
      const next = new Set(current);
      next.delete(draft.draftId);
      return next;
    });
    setFilter(draft.type);
    setForm(emptyForm(form.type, activeYear));
    setErrors({});
    toast.success(`${draft.name} added to preview.`);
  }

  function removeDraft(draftId: string) {
    setDrafts((current) => current.filter((draft) => draft.draftId !== draftId));
    setInvalidDraftIds((current) => {
      const next = new Set(current);
      next.delete(draftId);
      return next;
    });
  }

  function clearPreview() {
    setDrafts([]);
    setInvalidDraftIds(new Set());
    toast.info("Preview cleared.");
  }

  function saveAll() {
    const invalid = drafts
      .filter((draft) => Object.keys(validateDraft(draft)).length)
      .map((draft) => draft.draftId);

    if (invalid.length) {
      setInvalidDraftIds(new Set(invalid));
      toast.error("Fix or remove invalid preview rows before saving.");
      return;
    }

    if (!drafts.length) {
      toast.error("Add at least one transaction to preview.");
      return;
    }

    addTransactions(drafts.map(({ draftId, ...transaction }) => transaction));
    toast.success(`${drafts.length} transaction${drafts.length === 1 ? "" : "s"} saved.`);
    setDrafts([]);
    setInvalidDraftIds(new Set());
    navigate("/dashboard");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Batch workflow</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--financeos-text-primary)]">Add Transactions</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">Build a pending preview, review every row, then save all at once.</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-xl text-[var(--financeos-text-muted)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(26rem,1.1fr)]">
        <BatchTransactionForm
          form={form}
          errors={errors}
          onChange={updateForm}
          onAdd={addToPreview}
          onCancel={() => navigate(-1)}
          categoryOptions={filteredCategories}
          paymentMethods={paymentMethods}
        />
        <TransactionPreviewPanel
          drafts={drafts}
          filter={filter}
          invalidDraftIds={invalidDraftIds}
          onFilterChange={setFilter}
          onRemove={removeDraft}
          onClear={clearPreview}
          onSaveAll={saveAll}
        />
      </div>
    </div>
  );
}
