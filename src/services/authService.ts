import type {
  AuthChangeEvent,
  AuthError,
  Session,
  User,
} from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

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

function mapAuthError(error: AuthError): AuthServiceError {
  const messages: Record<string, string> = {
    invalid_credentials: "Email or password is incorrect.",
    email_not_confirmed: "Confirm your email address before logging in.",
    user_already_exists: "An account with this email may already exist.",
    email_exists: "An account with this email may already exist.",
    weak_password: "Choose a stronger password that meets the account security requirements.",
    email_address_invalid: "Enter a valid email address.",
    email_address_not_authorized: "This email address cannot be used to sign up right now.",
    signup_disabled: "New accounts are temporarily unavailable. Please try again later.",
    over_email_send_rate_limit: "Too many emails requested. Please wait before trying again.",
    over_request_rate_limit: "Too many attempts. Please wait before trying again.",
  };
  return {
    code: error.code,
    message: messages[error.code] ?? (error.status === 429
      ? "Too many attempts. Please wait before trying again."
      : error.status === 0 || error.status >= 500
        ? "We couldn't connect right now. Please try again."
        : "We couldn't complete your request. Please check your details and try again."),
    status: error.status,
  };
}

// Keep network failures from leaving AuthProvider in a permanent loading state.
async function safely<T>(request: () => Promise<AuthServiceResult<T>>): Promise<AuthServiceResult<T>> {
  try {
    return await request();
  } catch {
    return failure({ code: "connection_error", message: "We couldn't connect right now. Please try again." });
  }
}

export async function getCurrentSession(): Promise<
  AuthServiceResult<Session | null>
> {
  if (!supabase) return supabaseNotConfigured<Session | null>();

  return safely(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) return failure(mapAuthError(error));

    return success(data.session);
  });
}

export async function getCurrentUser(): Promise<AuthServiceResult<User | null>> {
  if (!supabase) return supabaseNotConfigured<User | null>();

  return safely(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) return failure(mapAuthError(error));

    return success(data.user);
  });
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string,
): Promise<AuthServiceResult<EmailAuthResult>> {
  if (!supabase) return supabaseNotConfigured<EmailAuthResult>();

  return safely(async () => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: fullName ? { data: { full_name: fullName.trim() } } : undefined,
    });
    if (error) return failure(mapAuthError(error));

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

  return safely(async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return failure(mapAuthError(error));

    return success({
      session: data.session,
      user: data.user,
    });
  });
}

export async function signOut(): Promise<AuthServiceResult<void>> {
  if (!supabase) return success(undefined);

  return safely(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return failure(mapAuthError(error));

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
