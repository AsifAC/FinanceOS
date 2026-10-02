import { useRef, useState, type FormEvent } from "react";
import { Check, CreditCard, Pencil, RefreshCw, Star } from "lucide-react";
import { usePaymentMethods } from "../../../hooks/usePaymentMethods";
import type { SupabasePaymentMethodType, PaymentMethod } from "../../../types/supabase";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { getSelectablePaymentMethods } from "../../lib/selectablePaymentMethods";

const methodTypes: { value: SupabasePaymentMethodType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit_card", label: "Credit card" },
  { value: "debit_card", label: "Debit card" },
  { value: "loan", label: "Loan" },
  { value: "investment", label: "Investment" },
  { value: "digital_wallet", label: "Digital wallet" },
  { value: "other", label: "Other" },
];

type MethodForm = {
  id: string;
  nickname: string;
  type: SupabasePaymentMethodType;
  institutionName: string;
  last4: string;
  network: string;
  colorTheme: string;
};

const emptyForm = (): MethodForm => ({
  id: "", nickname: "", type: "checking", institutionName: "", last4: "", network: "", colorTheme: "",
});

function typeLabel(type: SupabasePaymentMethodType) {
  return methodTypes.find((item) => item.value === type)?.label ?? type;
}

function toForm(method: PaymentMethod): MethodForm {
  return {
    id: method.id,
    nickname: method.nickname,
    type: method.type,
    institutionName: method.institution_name ?? "",
    last4: method.last4 ?? "",
    network: method.network ?? "",
    colorTheme: method.color_theme ?? "",
  };
}

function safeError(errorCode?: string) {
  return errorCode === "23505"
    ? "A payment method with that nickname already exists."
    : "The payment method could not be saved. Please try again.";
}

export function PaymentMethodManagement() {
  const {
    paymentMethods,
    isLoading,
    error,
    refreshPaymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    setPaymentMethodArchived,
    setDefaultPaymentMethod,
  } = usePaymentMethods();
  const [form, setForm] = useState<MethodForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const saveLock = useRef(false);
  const actionLock = useRef(false);
  const methods = [...paymentMethods].sort((a, b) =>
    Number(a.is_archived === true) - Number(b.is_archived === true)
    || (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || a.nickname.localeCompare(b.nickname),
  );
  const selectableIds = new Set(getSelectablePaymentMethods(paymentMethods).map((method) => method.id));

  function edit(method: PaymentMethod) {
    setForm(toForm(method));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveLock.current) return;
    const nickname = form.nickname.trim();
    const last4 = form.last4.trim();
    const colorTheme = form.colorTheme.trim();
    if (!nickname) return;
    if (last4 && !/^\d{4}$/.test(last4)) return;
    if (colorTheme && !(/^(#[\da-f]{6}|[a-z][a-z\d_-]{0,31})$/i.test(colorTheme))) return;

    saveLock.current = true;
    setSaving(true);
    setFeedback("");
    const input = {
      nickname,
      type: form.type,
      institution_name: form.institutionName.trim() || null,
      last4: last4 || null,
      network: form.network || null,
      color_theme: colorTheme || null,
    };
    try {
      const result = form.id
        ? await updatePaymentMethod(form.id, input)
        : await createPaymentMethod(input);
      if (!result.ok) {
        if (result.error.code === "account_changed") return;
        setFeedback(safeError(result.error.code));
        return;
      }
      setForm(emptyForm());
      setFeedback(form.id ? "Payment method updated." : "Payment method added.");
    } catch {
      setFeedback(safeError());
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  async function updateAction(id: string, action: "archive" | "restore" | "default") {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusyId(id);
    setFeedback("");
    try {
      const result = action === "default"
        ? await setDefaultPaymentMethod(id)
        : await setPaymentMethodArchived(id, action === "archive");
      if (!result.ok) {
        if (result.error.code === "account_changed") return;
        setFeedback(safeError(result.error.code));
      } else {
        setFeedback(action === "default" ? "Default payment method updated." : action === "archive" ? "Payment method archived." : "Payment method restored.");
      }
    } catch {
      setFeedback(safeError());
    } finally {
      actionLock.current = false;
      setBusyId(null);
    }
  }

  return (
    <Card className="financeos-control-card shadow-sm" aria-label="Account payment methods">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="financeos-settings-icon flex h-10 w-10 items-center justify-center rounded-2xl"><CreditCard className="h-4 w-4" /></span>
          <div>
            <CardTitle className="text-base text-[var(--financeos-text-primary)]">Payment Methods</CardTitle>
            <p className="text-xs text-[var(--financeos-text-muted)]">Account-backed methods used for future transaction entry.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {feedback && <p role="status" className="text-sm text-[var(--financeos-text-secondary)]">{feedback}</p>}
        <form className="grid gap-3 md:grid-cols-3" aria-label="Payment method form" onSubmit={(event) => void submit(event)}>
          <div><Label htmlFor="account-method-nickname">Nickname</Label><Input id="account-method-nickname" required maxLength={80} className="financeos-field mt-1" value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} /></div>
          <div><Label htmlFor="account-method-type">Type</Label><select id="account-method-type" className="financeos-select mt-1 h-10 w-full rounded-xl border px-3 text-sm" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as SupabasePaymentMethodType })}>{methodTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
          <div><Label htmlFor="account-method-institution">Institution / provider</Label><Input id="account-method-institution" className="financeos-field mt-1" value={form.institutionName} onChange={(event) => setForm({ ...form, institutionName: event.target.value })} /></div>
          <div><Label htmlFor="account-method-last4">Last four digits</Label><Input id="account-method-last4" inputMode="numeric" maxLength={4} className="financeos-field mt-1" value={form.last4} onChange={(event) => setForm({ ...form, last4: event.target.value.replace(/\D/g, "").slice(0, 4) })} /></div>
          <div><Label htmlFor="account-method-network">Network</Label><select id="account-method-network" className="financeos-select mt-1 h-10 w-full rounded-xl border px-3 text-sm" value={form.network} onChange={(event) => setForm({ ...form, network: event.target.value })}><option value="">Not specified</option>{["visa", "mastercard", "amex", "discover", "other"].map((network) => <option key={network} value={network}>{network}</option>)}</select></div>
          <div><Label htmlFor="account-method-color">Color theme (optional)</Label><Input id="account-method-color" className="financeos-field mt-1" value={form.colorTheme} onChange={(event) => setForm({ ...form, colorTheme: event.target.value })} /></div>
          <div className="flex items-end gap-2 md:col-span-3">
            <Button type="submit" disabled={saving || isLoading} className="bg-blue-600 text-white hover:bg-blue-700">{saving ? "Saving…" : form.id ? "Save changes" : "Add payment method"}</Button>
            {form.id && <Button type="button" variant="outline" disabled={saving} onClick={() => setForm(emptyForm())}>Cancel edit</Button>}
          </div>
        </form>

        {error && <p className="text-sm text-amber-600" role="alert">Payment methods could not be loaded or updated. Your transaction history is not affected.</p>}
        {isLoading && paymentMethods.length === 0 ? (
          <div className="space-y-2" role="status" aria-label="Loading payment methods"><div className="h-14 animate-pulse rounded-xl bg-[var(--financeos-surface-elevated)]" /><div className="h-14 animate-pulse rounded-xl bg-[var(--financeos-surface-elevated)]" /></div>
        ) : error && paymentMethods.length === 0 ? (
          <div className="financeos-muted-panel flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm"><span>Unable to load account payment methods.</span><Button variant="outline" size="sm" aria-label="Retry payment methods" onClick={() => void refreshPaymentMethods()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Retry</Button></div>
        ) : methods.length === 0 ? (
          <div className="financeos-muted-panel rounded-2xl border border-dashed p-5 text-sm">No account payment methods yet. Add one above to prepare for future transaction entry.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2" aria-label="Payment method list">
            {methods.map((method) => (
              <article key={method.id} data-payment-method-id={method.id} className={`rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-4 ${method.is_archived ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="truncate font-semibold text-[var(--financeos-text-primary)]">{method.nickname}</h3><p className="mt-1 text-xs text-[var(--financeos-text-muted)]">{typeLabel(method.type)}{method.institution_name ? ` · ${method.institution_name}` : ""}{method.last4 ? ` · •••• ${method.last4}` : ""}{method.network ? ` · ${method.network}` : ""}</p></div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">{method.is_default && !method.is_archived && <span className="rounded-full border px-2 py-1 text-[11px]">Default</span>}{method.is_archived && <span className="rounded-full border px-2 py-1 text-[11px]">Archived</span>}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" aria-label={`Edit ${method.nickname}`} disabled={!!busyId || saving} onClick={() => edit(method)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                  {selectableIds.has(method.id) && !method.is_default && <Button size="sm" variant="outline" aria-label={`Set ${method.nickname} as default`} disabled={!!busyId || saving} onClick={() => void updateAction(method.id, "default")}><Star className="mr-1.5 h-3.5 w-3.5" />Set default</Button>}
                  <Button size="sm" variant="outline" aria-label={`${method.is_archived ? "Restore" : "Archive"} ${method.nickname}`} disabled={!!busyId || saving} onClick={() => void updateAction(method.id, method.is_archived ? "restore" : "archive")}>
                    {method.is_archived ? <><Check className="mr-1.5 h-3.5 w-3.5" />Restore</> : "Archive"}
                  </Button>
                  {busyId === method.id && <span className="self-center text-xs text-[var(--financeos-text-muted)]" role="status">Saving…</span>}
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="text-xs text-[var(--financeos-text-muted)]">Archived methods remain attached to historical labels and are excluded from future selection. Defaults are managed by your account service. Permanent deletion is unavailable because it would clear transaction references.</p>
      </CardContent>
    </Card>
  );
}
