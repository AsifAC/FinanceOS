const SESSION_STORAGE_KEYS = [
  "financeos:auth-session",
  "financeos:active-account",
];

export function clearFinanceOSSession() {
  if (typeof window === "undefined") return;

  // TODO(auth): Replace this placeholder with the real auth provider logout call.
  // Keep budget/app data intact until FinanceOS has explicit account-scoped storage.
  SESSION_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

export function getSwitchAccountRoute() {
  // TODO(multi-account): Route to an account picker/login screen when multi-account support exists.
  return "/";
}
