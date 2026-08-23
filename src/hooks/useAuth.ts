import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getSession, signInWithEmail, signOut, signUpWithEmail } from "../services/authService";

export function useAuth() {
  const [session, setSession] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getSession().then((result) => {
      if (!mounted) return;
      setSession(result.data);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
