import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../../../hooks/useAuth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <main className="min-h-screen bg-[#050505] p-8 text-[#F8FAFC]" role="status">Loading your session…</main>;

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
