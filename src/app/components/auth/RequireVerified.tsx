import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useProfile } from "../../../hooks/useProfile";
import { useLogout } from "../../../hooks/useLogout";

export function RequireVerified({ children }: { children: ReactNode }) {
  const { profile, isLoading, error, refreshProfile } = useProfile();
  const { logout, isSigningOut, logoutError } = useLogout();
  if (isLoading) return <main className="min-h-screen bg-[#050505] p-8 text-[#F8FAFC]" role="status">Loading your account…</main>;
  if (error) return <main className="min-h-screen bg-[#050505] p-8 text-[#F8FAFC]">
    <p role="alert">{error.message}</p>
    <button onClick={() => void refreshProfile()}>Retry</button>{" · "}
    <button disabled={isSigningOut} onClick={() => void logout()}>Log out</button>
    {logoutError && <p role="alert">{logoutError}</p>}
  </main>;
  if (!profile?.account_verified_at) return <Navigate to="/auth/verify" replace />;
  return <>{children}</>;
}
