import { Profile, UpdateRow } from "./dbTypes";
import { getCurrentUserId, getErrorMessage, ServiceResult, updateOwnRow } from "./serviceUtils";
import { supabase } from "../lib/supabaseClient";

export async function getProfile(): Promise<ServiceResult<Profile>> {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
    if (error) throw error;
    return { data: data as Profile, error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

export function updateProfile(values: UpdateRow<Profile>) {
  return getProfile().then((result) => result.data ? updateOwnRow<Profile>("profiles", result.data.id, values) : result);
}
