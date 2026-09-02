import { supabase } from "../lib/supabaseClient";
import type {
  PaymentMethod,
  PaymentMethodInsert,
  PaymentMethodUpdate,
} from "../types/supabase";

export type CreatePaymentMethodInput = Pick<
  PaymentMethodInsert,
  "nickname" | "type"
> &
  Partial<
    Pick<
      PaymentMethodInsert,
      | "institution_name"
      | "last4"
      | "network"
      | "color_theme"
      | "is_default"
      | "is_archived"
      | "is_linked"
      | "sort_order"
    >
  >;

export type UpdatePaymentMethodInput = Partial<
  Pick<
    PaymentMethodUpdate,
    | "nickname"
    | "type"
    | "institution_name"
    | "last4"
    | "network"
    | "color_theme"
    | "is_default"
    | "is_archived"
    | "is_linked"
    | "sort_order"
  >
>;

export type PaymentMethodServiceError = {
  message: string;
  code?: string;
};

export type PaymentMethodServiceResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: PaymentMethodServiceError };

const notConfiguredError: PaymentMethodServiceError = {
  code: "supabase_not_configured",
  message:
    "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to use payment methods.",
};

const notAuthenticatedError: PaymentMethodServiceError = {
  code: "not_authenticated",
  message: "Sign in before loading or updating payment methods.",
};

const notFoundError: PaymentMethodServiceError = {
  code: "payment_method_not_found",
  message: "Payment method was not found.",
};

function success<T>(data: T): PaymentMethodServiceResult<T> {
  return { ok: true, data, error: null };
}

function failure<T>(
  error: PaymentMethodServiceError,
): PaymentMethodServiceResult<T> {
  return { ok: false, data: null, error };
}

function mapError(error: {
  code?: string;
  message?: string;
}): PaymentMethodServiceError {
  return {
    code: error.code,
    message: error.message || "Payment method request failed.",
  };
}

async function getCurrentUserId(): Promise<
  PaymentMethodServiceResult<string>
> {
  if (!supabase) return failure(notConfiguredError);

  const { data, error } = await supabase.auth.getUser();
  if (error) return failure(mapError(error));
  if (!data.user) return failure(notAuthenticatedError);

  return success(data.user.id);
}

function orderPaymentMethods() {
  return supabase!
    .from("payment_methods")
    .select("*")
    .order("is_archived", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("nickname", { ascending: true });
}

function nullableTrim(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function sanitizeCreatePaymentMethodInput(
  input: CreatePaymentMethodInput,
): CreatePaymentMethodInput {
  return {
    ...input,
    nickname: input.nickname.trim(),
    institution_name: nullableTrim(input.institution_name),
    last4: nullableTrim(input.last4),
    network: nullableTrim(input.network),
    color_theme: nullableTrim(input.color_theme),
  };
}

function sanitizeUpdatePaymentMethodInput(
  input: UpdatePaymentMethodInput,
): UpdatePaymentMethodInput {
  const updates: UpdatePaymentMethodInput = { ...input };

  if ("nickname" in input) updates.nickname = input.nickname?.trim();
  if ("institution_name" in input) {
    updates.institution_name = nullableTrim(input.institution_name);
  }
  if ("last4" in input) updates.last4 = nullableTrim(input.last4);
  if ("network" in input) updates.network = nullableTrim(input.network);
  if ("color_theme" in input) {
    updates.color_theme = nullableTrim(input.color_theme);
  }

  return updates;
}

export async function fetchPaymentMethods(): Promise<
  PaymentMethodServiceResult<PaymentMethod[]>
> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { data, error } = await orderPaymentMethods().eq(
    "user_id",
    userId.data,
  );
  if (error) return failure(mapError(error));

  return success(data ?? []);
}

export async function createPaymentMethod(
  input: CreatePaymentMethodInput,
): Promise<PaymentMethodServiceResult<PaymentMethod>> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { data, error } = await supabase
    .from("payment_methods")
    .insert({
      ...sanitizeCreatePaymentMethodInput(input),
      user_id: userId.data,
    })
    .select("*")
    .single();

  if (error) return failure(mapError(error));

  return success(data);
}

export async function updatePaymentMethod(
  id: string,
  updates: UpdatePaymentMethodInput,
): Promise<PaymentMethodServiceResult<PaymentMethod>> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { data, error } = await supabase
    .from("payment_methods")
    .update(sanitizeUpdatePaymentMethodInput(updates))
    .eq("id", id)
    .eq("user_id", userId.data)
    .select("*")
    .single();

  if (error) return failure(mapError(error));

  return success(data);
}

export function archivePaymentMethod(
  id: string,
): Promise<PaymentMethodServiceResult<PaymentMethod>> {
  return updatePaymentMethod(id, { is_archived: true, is_default: false });
}

export async function deletePaymentMethod(
  id: string,
): Promise<PaymentMethodServiceResult<void>> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { error } = await supabase
    .from("payment_methods")
    .delete()
    .eq("id", id)
    .eq("user_id", userId.data);

  if (error) return failure(mapError(error));

  return success(undefined);
}

export async function setDefaultPaymentMethod(
  id: string,
): Promise<PaymentMethodServiceResult<PaymentMethod>> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { data, error } = await supabase
    .rpc("set_default_payment_method", {
      target_payment_method_id: id,
    });

  if (error) return failure(mapError(error));
  if (!data) return failure(notFoundError);

  return success(data);
}
