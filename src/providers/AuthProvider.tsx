import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import {
  getCurrentSession,
  onAuthStateChange,
  signInWithEmail,
  signOut as signOutWithSupabase,
  signUpWithEmail,
  type AuthServiceError,
  type AuthServiceResult,
  type EmailAuthResult,
} from "../services/authService";

type AuthState = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: AuthServiceError | null;
};

export type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  signUp: (
    email: string,
    password: string,
  ) => Promise<AuthServiceResult<EmailAuthResult>>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<AuthServiceResult<EmailAuthResult>>;
  signOut: () => Promise<AuthServiceResult<void>>;
  refreshSession: () => Promise<AuthServiceResult<Session | null>>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

function stateFromSession(session: Session | null): Pick<AuthState, "session" | "user"> {
  return {
    session,
    user: session?.user ?? null,
  };
}

function isMissingConfig(error: AuthServiceError | null) {
  return error?.code === "supabase_not_configured";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    error: null,
  });

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured) {
      const result = await getCurrentSession();

      setAuthState({
        user: null,
        session: null,
        isLoading: false,
        error: isMissingConfig(result.error) ? null : result.error,
      });

      return result;
    }

    setAuthState((current) => ({ ...current, isLoading: true, error: null }));

    const result = await getCurrentSession();
    if (!result.ok) {
      setAuthState((current) => ({
        ...current,
        isLoading: false,
        error: isMissingConfig(result.error) ? null : result.error,
      }));
      return result;
    }

    setAuthState({
      ...stateFromSession(result.data),
      isLoading: false,
      error: null,
    });

    return result;
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const result = await getCurrentSession();
      if (!isMounted) return;

      if (!result.ok) {
        setAuthState({
          user: null,
          session: null,
          isLoading: false,
          error: isMissingConfig(result.error) ? null : result.error,
        });
        return;
      }

      setAuthState({
        ...stateFromSession(result.data),
        isLoading: false,
        error: null,
      });
    }

    void restoreSession();

    const subscription = onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      setAuthState({
        ...stateFromSession(session),
        isLoading: false,
        error: null,
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setAuthState((current) => ({ ...current, isLoading: true, error: null }));

    const result = await signUpWithEmail(email, password);
    if (!result.ok) {
      setAuthState((current) => ({
        ...current,
        isLoading: false,
        error: result.error,
      }));
      return result;
    }

    setAuthState({
      session: result.data.session,
      user: result.data.user,
      isLoading: false,
      error: null,
    });

    return result;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthState((current) => ({ ...current, isLoading: true, error: null }));

    const result = await signInWithEmail(email, password);
    if (!result.ok) {
      setAuthState((current) => ({
        ...current,
        isLoading: false,
        error: result.error,
      }));
      return result;
    }

    setAuthState({
      session: result.data.session,
      user: result.data.user,
      isLoading: false,
      error: null,
    });

    return result;
  }, []);

  const signOut = useCallback(async () => {
    setAuthState((current) => ({ ...current, isLoading: true, error: null }));

    const result = await signOutWithSupabase();
    if (!result.ok) {
      setAuthState((current) => ({
        ...current,
        isLoading: false,
        error: result.error,
      }));
      return result;
    }

    setAuthState({
      user: null,
      session: null,
      isLoading: false,
      error: null,
    });

    return result;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...authState,
      isAuthenticated: Boolean(authState.session?.user),
      signUp,
      signIn,
      signOut,
      refreshSession,
    }),
    [authState, refreshSession, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
