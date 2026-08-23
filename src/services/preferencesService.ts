import { UpdateRow, UserPreferences } from "./dbTypes";
import { getCurrentUserId, getErrorMessage, ServiceResult, updateOwnRow } from "./serviceUtils";
import { supabase } from "../lib/supabaseClient";

export async function getUserPreferences(): Promise<ServiceResult<UserPreferences>> {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase.from("user_preferences").select("*").eq("user_id", userId).single();
    if (error) throw error;
    return { data: data as UserPreferences, error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

export function updateUserPreferences(values: UpdateRow<UserPreferences>) {
  return getUserPreferences().then((result) =>
    result.data ? updateOwnRow<UserPreferences>("user_preferences", result.data.id, values) : result
  );
}
