import { supabase } from "../lib/supabaseClient";
import type { Profile } from "../types/supabase";

export type ProfileUpdates = Partial<
  Pick<
    Profile,
    | "email"
    | "full_name"
    | "display_name"
    | "avatar_url"
    | "timezone"
    | "currency"
    | "onboarding_completed"
  >
>;

export type ProfileServiceError = {
  message: string;
  code?: string;
};

export type ProfileServiceResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: ProfileServiceError };

const notConfiguredError: ProfileServiceError = {
  code: "supabase_not_configured",
  message:
    "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local to use profiles.",
};

const notAuthenticatedError: ProfileServiceError = {
  code: "not_authenticated",
  message: "Sign in before loading or updating your profile.",
};

function success<T>(data: T): ProfileServiceResult<T> {
  return { ok: true, data, error: null };
}

function failure<T>(error: ProfileServiceError): ProfileServiceResult<T> {
  return { ok: false, data: null, error };
}

function mapError(error: { code?: string; message?: string }): ProfileServiceError {
  return {
    code: error.code,
    message: error.message || "Profile request failed.",
  };
}

async function getCurrentUserId(): Promise<ProfileServiceResult<string>> {
  if (!supabase) return failure(notConfiguredError);

  const { data, error } = await supabase.auth.getUser();
  if (error) return failure(mapError(error));
  if (!data.user) return failure(notAuthenticatedError);

  return success(data.user.id);
}

export async function getCurrentProfile(): Promise<
  ProfileServiceResult<Profile | null>
> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId.data)
    .maybeSingle();

  if (error) return failure(mapError(error));

  return success(data);
}

export async function updateCurrentProfile(
  updates: ProfileUpdates,
): Promise<ProfileServiceResult<Profile>> {
  if (!supabase) return failure(notConfiguredError);

  const userId = await getCurrentUserId();
  if (!userId.ok) return failure(userId.error);

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId.data)
    .select("*")
    .single();

  if (error) return failure(mapError(error));

  return success(data);
}
