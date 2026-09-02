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
  return {
    code: error.code,
    message: error.message || "Authentication request failed.",
    status: error.status,
  };
}

export async function getCurrentSession(): Promise<
  AuthServiceResult<Session | null>
> {
  if (!supabase) return supabaseNotConfigured<Session | null>();

  const { data, error } = await supabase.auth.getSession();
  if (error) return failure(mapAuthError(error));

  return success(data.session);
}

export async function getCurrentUser(): Promise<AuthServiceResult<User | null>> {
  if (!supabase) return supabaseNotConfigured<User | null>();

  const { data, error } = await supabase.auth.getUser();
  if (error) return failure(mapAuthError(error));

  return success(data.user);
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<AuthServiceResult<EmailAuthResult>> {
  if (!supabase) return supabaseNotConfigured<EmailAuthResult>();

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return failure(mapAuthError(error));

  return success({
    session: data.session,
    user: data.user,
  });
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthServiceResult<EmailAuthResult>> {
  if (!supabase) return supabaseNotConfigured<EmailAuthResult>();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return failure(mapAuthError(error));

  return success({
    session: data.session,
    user: data.user,
  });
}

export async function signOut(): Promise<AuthServiceResult<void>> {
  if (!supabase) return success(undefined);

  const { error } = await supabase.auth.signOut();
  if (error) return failure(mapAuthError(error));

  return success(undefined);
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
