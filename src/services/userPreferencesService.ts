import { supabase } from "../lib/supabaseClient";
import type { UserPreferences } from "../types/supabase";

export type UserPreferencesUpdates = Partial<
  Pick<
    UserPreferences,
    | "theme"
    | "accent_color"
    | "default_view"
    | "week_starts_on"
    | "month_start_day"
    | "number_format"
    | "currency"
    | "timezone"
    | "preview_mode_enabled"
    | "notifications_enabled"
  >
>;

export type UserPreferencesServiceError = {
  message: string;
  code?: string;
};

export type UserPreferencesServiceResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: UserPreferencesServiceError };

const notConfiguredError: UserPreferencesServiceError = {
  code: "supabase_not_configured",
  message:
    "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to use preferences.",
};

const notAuthenticatedError: UserPreferencesServiceError = {
  code: "not_authenticated",
  message: "Sign in before loading or updating your preferences.",
};

function success<T>(data: T): UserPreferencesServiceResult<T> {
  return { ok: true, data, error: null };
}

function failure<T>(
  error: UserPreferencesServiceError,
): UserPreferencesServiceResult<T> {
  return { ok: false, data: null, error };
}

function mapError(error: {
  code?: string;
  message?: string;
}): UserPreferencesServiceError {
  return {
    code: error.code,
    message: error.message || "Preferences request failed.",
  };
}

async function getCurrentUserId(): Promise<
  UserPreferencesServiceResult<string>
> {
  if (!supabase) return failure(notConfiguredError);

  const { data, error } = await supabase.auth.getUser();
  if (error) return failure(mapError(error));
  if (!data.user) return failure(notAuthenticatedError);

  return success(data.user.id);
}

export async function getCurrentUserPreferences(): Promise<
  UserPreferencesServiceResult<UserPreferences | null>
> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId.data)
    .maybeSingle();

  if (error) return failure(mapError(error));

  return success(data);
}

export async function updateCurrentUserPreferences(
  updates: UserPreferencesUpdates,
): Promise<UserPreferencesServiceResult<UserPreferences>> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { data, error } = await supabase
    .from("user_preferences")
    .update(updates)
    .eq("user_id", userId.data)
    .select("*")
    .single();

  if (error) return failure(mapError(error));

  return success(data);
}
