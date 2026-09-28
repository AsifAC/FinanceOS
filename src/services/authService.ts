import type {
  AuthChangeEvent,
  AuthError,
  Session,
  User,
} from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { normalizePhone, verificationDelivery, type VerificationChannel } from "../lib/verification";

export type AuthServiceError = {
  message: string;
  code?: string;
  status?: number;
};

export type AuthServiceResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: AuthServiceError };

export type EmailAuthResult = {
  session: Session | null;
  user: User | null;
};

export type AuthStateChangeCallback = (
  event: AuthChangeEvent,
  session: Session | null,
) => void;

export type AuthSubscription = {
  unsubscribe: () => void;
};

const notConfiguredError: AuthServiceError = {
  code: "supabase_not_configured",
  message:
    "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to use authentication.",
};

function success<T>(data: T): AuthServiceResult<T> {
  return { ok: true, data, error: null };
}

function failure<T>(error: AuthServiceError): AuthServiceResult<T> {
  return { ok: false, data: null, error };
}

function supabaseNotConfigured<T>(): AuthServiceResult<T> {
  return failure(notConfiguredError);
}

const authErrorMessages: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  email_not_confirmed: "Confirm your email address before logging in.",
  user_already_exists: "An account with this email may already exist.",
  email_exists: "An account with this email may already exist.",
  weak_password: "Choose a stronger password that meets the account security requirements.",
  email_address_invalid: "Enter a valid email address.",
  email_address_not_authorized: "This email address cannot be used to sign up right now.",
  signup_disabled: "New accounts are temporarily unavailable. Please try again later.",
  over_email_send_rate_limit: "Too many emails requested. Please wait before trying again.",
  over_sms_send_rate_limit: "Too many texts requested. Please wait before trying again.",
  over_request_rate_limit: "Too many attempts. Please wait before trying again.",
  otp_expired: "That code is invalid or has expired. Request a new code.",
  otp_disabled: "Code verification is currently unavailable.",
  sms_send_failed: "SMS verification is currently unavailable. Try email or return later.",
  phone_provider_disabled: "SMS verification is currently unavailable.",
  phone_exists: "This phone number is already connected to an account.",
  validation_failed: "Check your phone number or verification code and try again.",
};

function safeAuthMessage(error: AuthError): string {
  if (error.status === 0) return "We couldn't connect to the verification service. Check your connection and try again.";
  if (error.code && authErrorMessages[error.code]) return authErrorMessages[error.code];
  if (error.status === 429) return "Too many attempts. Please wait before trying again.";
  if (error.status !== undefined && error.status >= 500) return "The verification service encountered an error. Please try again later.";
  return "We couldn't complete your request. Please check your details and try again.";
}

function logAuthDiagnostic(operation: string, error: AuthError) {
  if (!import.meta.env?.DEV) return;
  console.warn("FinanceOS Auth request failed", {
    operation,
    status: error.status,
    code: error.code,
    safeMessage: safeAuthMessage(error),
  });
}

function mapAuthError(error: AuthError, operation: string): AuthServiceError {
  logAuthDiagnostic(operation, error);
  const message = safeAuthMessage(error);
  // Use structured policy reasons, never raw server text or a guessed project policy.
  if (error.code === "weak_password" && "reasons" in error && Array.isArray(error.reasons)) {
    const guidance: Record<string, string> = {
      length: "Use a longer password.",
      characters: "Include the character types required by your account's password policy.",
      pwned: "This password has appeared in a data breach. Choose a different, unique password.",
    };
    const messages = [...new Set(error.reasons.filter((reason): reason is string =>
      typeof reason === "string" && Object.hasOwn(guidance, reason)).map(reason => guidance[reason]))];
    if (messages.length) return { code: error.code, status: error.status, message: messages.join(" ") };
  }
  return {
    code: error.code,
    message,
    status: error.status,
  };
}

// Keep network failures from leaving AuthProvider in a permanent loading state.
async function safely<T>(operation: string, request: () => Promise<AuthServiceResult<T>>): Promise<AuthServiceResult<T>> {
  try {
    return await request();
  } catch (error) {
    if (import.meta.env?.DEV) {
      const exceptionCategory = error instanceof TypeError ? "TypeError"
        : typeof DOMException !== "undefined" && error instanceof DOMException ? "DOMException"
          : error instanceof Error ? "Error" : "UnknownThrownValue";
      console.warn("FinanceOS Auth request threw", { operation, exceptionCategory });
    }
    return failure({ code: "connection_error", message: "We couldn't connect to the verification service. Check your connection and try again." });
  }
}

export async function getCurrentSession(): Promise<
  AuthServiceResult<Session | null>
> {
  if (!supabase) return supabaseNotConfigured<Session | null>();

  return safely("get_current_session", async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) return failure(mapAuthError(error, "get_current_session"));

    return success(data.session);
  });
}

export async function getCurrentUser(): Promise<AuthServiceResult<User | null>> {
  if (!supabase) return supabaseNotConfigured<User | null>();

  return safely("get_current_user", async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) return failure(mapAuthError(error, "get_current_user"));

    return success(data.user);
  });
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string,
): Promise<AuthServiceResult<EmailAuthResult>> {
  if (!supabase) return supabaseNotConfigured<EmailAuthResult>();

  return safely("sign_up", async () => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: fullName ? { data: { full_name: fullName.trim() } } : undefined,
    });
    if (error) return failure(mapAuthError(error, "sign_up"));

    return success({
      session: data.session,
      user: data.user,
    });
  });
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthServiceResult<EmailAuthResult>> {
  if (!supabase) return supabaseNotConfigured<EmailAuthResult>();

  return safely("sign_in", async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return failure(mapAuthError(error, "sign_in"));

    return success({
      session: data.session,
      user: data.user,
    });
  });
}

export async function signOut(): Promise<AuthServiceResult<void>> {
  if (!supabase) return success(undefined);

  return safely("sign_out", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return failure(mapAuthError(error, "sign_out"));

    return success(undefined);
  });
}

export function onAuthStateChange(
  callback: AuthStateChangeCallback,
): AuthSubscription {
  if (!supabase) {
    return { unsubscribe: () => undefined };
  }

  const { data } = supabase.auth.onAuthStateChange(callback);

  return {
    unsubscribe: () => data.subscription.unsubscribe(),
  };
}

export async function requestVerification(channel: VerificationChannel, phone?: string): Promise<AuthServiceResult<void>> {
  const operation = channel === "phone" ? "request_phone_verification" : "request_email_verification";
  return safely(operation, async () => {
    const current = await getCurrentUser();
    if (!current.ok) return failure(current.error);
    if (!current.data) return failure({ code: "not_authenticated", message: "Sign in again to verify your account." });
    const normalized = normalizePhone(phone ?? "");
    if (channel === "phone" && !normalized) return failure({ code: "invalid_phone", message: "Include your country code, for example +12125551234." });
    if (!verificationDelivery[channel]) return failure({ code: "delivery_unavailable", message: channel === "phone"
      ? "SMS verification is currently unavailable. Please try again after text delivery is enabled."
      : "Email code verification is currently unavailable. Please try again after code delivery is enabled." });
    if (channel === "email" && !current.data.email) return failure({ message: "Your account has no email address." });
    const { error } = channel === "phone"
      ? await supabase!.auth.updateUser({ phone: normalized! })
      : await supabase!.auth.signInWithOtp({ email: current.data.email!, options: { shouldCreateUser: false } });
    return error ? failure(mapAuthError(error, operation)) : success(undefined);
  });
}

export async function verifyVerificationCode(channel: VerificationChannel, token: string, phone?: string): Promise<AuthServiceResult<void>> {
  const operation = channel === "phone" ? "verify_phone_code" : "verify_email_code";
  return safely(operation, async () => {
    const current = await getCurrentUser();
    if (!current.ok) return failure(current.error);
    if (!current.data) return failure({ code: "not_authenticated", message: "Sign in again to verify your account." });
    if (!/^\d{6}$/.test(token)) return failure({ code: "invalid_otp", message: "Enter the six-digit code." });
    const normalized = normalizePhone(phone ?? "");
    if (channel === "phone" && !normalized) return failure({ code: "invalid_phone", message: "Enter a phone number with its country code." });
    if (channel === "email" && !current.data.email) return failure({ message: "Your account has no email address." });
    const { data, error } = await supabase!.auth.verifyOtp(channel === "phone"
      ? { phone: normalized!, token, type: "phone_change" }
      : { email: current.data.email!, token, type: "email" });
    if (error) return failure(mapAuthError(error, operation));
    if (data.user?.id !== current.data.id) return failure({ message: "Account changed. Sign out and sign in again." });
    return success(undefined);
  });
}
