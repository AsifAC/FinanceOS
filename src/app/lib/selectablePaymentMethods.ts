import type { PaymentMethod } from "../../types/supabase";

/** Active, account-backed methods available to future transaction entry. */
export function getSelectablePaymentMethods(
  methods: readonly PaymentMethod[],
): PaymentMethod[] {
  return methods
    .filter((method) => method.is_archived !== true)
    .map((method, index) => ({ method, index }))
    .sort((a, b) =>
      Number(b.method.is_default === true) - Number(a.method.is_default === true)
      || (a.method.sort_order ?? 0) - (b.method.sort_order ?? 0)
      || a.method.nickname.localeCompare(b.method.nickname)
      || a.index - b.index,
    )
    .map(({ method }) => method);
}
