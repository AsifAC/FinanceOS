import type { PaymentMethod } from "../../types/supabase";

export function resolvePaymentMethodLabel(
  paymentMethodId: string | null,
  paymentMethods: readonly PaymentMethod[],
  isLoading = false,
  hasError = false,
): string {
  if (paymentMethodId === null) return "Not assigned";
  if (isLoading) return "Loading payment method…";
  if (hasError) return "Payment method unavailable";
  return paymentMethods.find((method) => method.id === paymentMethodId)?.nickname
    ?? "Unknown payment method";
}
