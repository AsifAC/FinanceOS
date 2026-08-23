import { supabase } from "../lib/supabaseClient";
import { getErrorMessage, ServiceResult } from "./serviceUtils";

export async function getSession(): Promise<ServiceResult<unknown>> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { data: data.session, error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

export async function signInWithEmail(email: string, password: string): Promise<ServiceResult<unknown>> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

export async function signUpWithEmail(email: string, password: string, fullName?: string): Promise<ServiceResult<unknown>> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}

export async function signOut(): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { data: true, error: null };
  } catch (error) {
    return { data: null, error: getErrorMessage(error) };
  }
}
