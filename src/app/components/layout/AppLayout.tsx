import { AppShell } from "./AppShell";
import { AuthProvider } from "../../../providers/AuthProvider";
import { ProfileProvider } from "../../../hooks/useProfile";

export function AppLayout() {
  return (
    <AuthProvider>
      <ProfileProvider><AppShell /></ProfileProvider>
    </AuthProvider>
  );
}
