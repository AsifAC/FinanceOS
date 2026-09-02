import { CreditCard, Landmark, Link2, Pencil, Trash2, Wallet } from "lucide-react";
import { PaymentMethod, PaymentMethodType } from "../../lib/financeStore";

const typeLabels: Record<PaymentMethodType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  cash: "Cash",
  other: "Other",
};

const typeColors: Record<PaymentMethodType, string> = {
  checking: "#2563EB",
  savings: "#00A676",
  credit_card: "#7C3AED",
  debit_card: "#0F766E",
  cash: "#D97706",
  other: "#475569",
};

export const paymentMethodTypeOptions = Object.entries(typeLabels).map(([value, label]) => ({ value: value as PaymentMethodType, label }));
export const paymentNetworkOptions = ["visa", "mastercard", "amex", "discover", "other"] as const;

function networkLabel(network?: string) {
  if (!network) return "";
  if (network === "amex") return "Amex";
  return network.charAt(0).toUpperCase() + network.slice(1);
}

export function PaymentMethodCard({
  method,
  onEdit,
  onDelete,
}: {
  method: PaymentMethod;
  onEdit?: (method: PaymentMethod) => void;
  onDelete?: (id: string) => void;
}) {
  const color = typeColors[method.type];
  const Icon = method.type === "cash" ? Wallet : method.type === "checking" || method.type === "savings" ? Landmark : CreditCard;

  return (
    <div className="financeos-payment-card group relative overflow-hidden rounded-[24px] border p-4 transition-colors">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: color }}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <p className="truncate text-base font-semibold text-[var(--financeos-text-primary)]">{method.nickname || typeLabels[method.type]}</p>
          <p className="mt-1 truncate text-sm text-[var(--financeos-text-muted)]">{method.institutionName || "Manual account"}</p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ backgroundColor: color }}>
          {typeLabels[method.type]}
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--financeos-text-subtle)]">Account</p>
          <p className="mt-1 text-sm font-semibold text-[var(--financeos-text-primary)]">{method.last4 ? `•••• ${method.last4}` : "No digits saved"}</p>
          {method.network && <p className="mt-0.5 text-xs text-[var(--financeos-text-muted)]">{networkLabel(method.network)}</p>}
        </div>
        <div className="flex items-center gap-1">
          {method.isLinked && (
            <span className="mr-1 inline-flex items-center gap-1 rounded-full border border-[#00D68F]/25 bg-[#00D68F]/10 px-2 py-1 text-[11px] text-[#A7F3D0]">
              <Link2 className="h-3 w-3" />
              Linked
            </span>
          )}
          {onEdit && (
            <button type="button" onClick={() => onEdit(method)} className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--financeos-text-muted)] hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6]">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => onDelete(method.id)} className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--financeos-text-muted)] hover:bg-[#EF4444]/10 hover:text-[#EF4444]">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PaymentMethodGrid({
  paymentMethods,
  onEdit,
  onDelete,
}: {
  paymentMethods: PaymentMethod[];
  onEdit?: (method: PaymentMethod) => void;
  onDelete?: (id: string) => void;
}) {
  if (!paymentMethods.length) {
    return (
      <div className="financeos-muted-panel rounded-[24px] border border-dashed p-5 text-sm">
        No payment methods yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {paymentMethods.map((method) => (
        <PaymentMethodCard key={method.id} method={method} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
