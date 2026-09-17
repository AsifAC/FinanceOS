import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../../../hooks/useAuth";
import { AuthLayout } from "../auth/AuthLayout";
import { AuthForm } from "../auth/AuthForm";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [sessionReady, setSessionReady] = useState(!isLoading);
  useEffect(() => {
    if (!isLoading) setSessionReady(true);
  }, [isLoading]);
  useEffect(() => {
    const previous = document.title;
    document.title = `${mode === "login" ? "Log in" : "Create an account"} | FinanceOS`;
    return () => { document.title = previous; };
  }, [mode]);

  if (!isLoading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <AuthLayout mode={mode}>
      {sessionReady ? <AuthForm key={mode} mode={mode} /> : (
        <p className="auth-session-status" role="status">Getting your workspace ready…</p>
      )}
    </AuthLayout>
  );
}
