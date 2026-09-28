import { useRef, useState } from "react";
import { useAuth } from "./useAuth";

export function useLogout() {
  const { signOut } = useAuth();
  const pending = useRef(false);
  const [isSigningOut, setSigningOut] = useState(false);
  const [logoutError, setError] = useState<string | null>(null);
  async function logout() {
    if (pending.current) return;
    pending.current = true;
    setSigningOut(true);
    setError(null);
    try {
      const result = await signOut();
      if (!result.ok) setError(result.error.message);
    } catch {
      setError("Couldn't sign out. Please try again.");
    } finally {
      pending.current = false;
      setSigningOut(false);
    }
  }
  return { logout, isSigningOut, logoutError };
}
