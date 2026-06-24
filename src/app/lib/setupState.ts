const SETUP_COMPLETED_KEY = "financeos:setup-completed";
const SETUP_PROFILE_KEY = "financeos:setup-profile";
const SETUP_DATA_VERSION_KEY = "financeos:setup-data-version";
const SETUP_DATA_VERSION = "empty-v1";

export interface SetupProfile {
  budgetName: string;
  year: string;
  startMonth: string;
  currency: string;
  startDayOfWeek?: "sunday" | "monday";
  timezone?: string;
  paymentMethods?: Array<{
    id: string;
    nickname: string;
    type: "checking" | "savings" | "credit_card" | "debit_card" | "cash" | "other";
    institutionName?: string;
    last4?: string;
    network?: "visa" | "mastercard" | "amex" | "discover" | "other";
    colorTheme?: string;
    isLinked?: boolean;
    institutionId?: string;
    institutionLogo?: string;
    brandColor?: string;
    linkedAccountId?: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    type: string;
    color: string;
    icon: string;
  }>;
  expectedIncome: string;
  expectedSavings: string;
  expectedDebt: string;
  expectedExpenses: string;
}

export function isSetupCompleted() {
  if (typeof window === "undefined") return false;
  return (
    window.localStorage.getItem(SETUP_COMPLETED_KEY) === "true" &&
    window.localStorage.getItem(SETUP_DATA_VERSION_KEY) === SETUP_DATA_VERSION
  );
}

export function completeSetup(profile: SetupProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETUP_COMPLETED_KEY, "true");
  window.localStorage.setItem(SETUP_DATA_VERSION_KEY, SETUP_DATA_VERSION);
  window.localStorage.setItem(SETUP_PROFILE_KEY, JSON.stringify(profile));
}

export function getSetupProfile() {
  if (typeof window === "undefined" || !isSetupCompleted()) return null;
  try {
    const saved = window.localStorage.getItem(SETUP_PROFILE_KEY);
    return saved ? JSON.parse(saved) as SetupProfile : null;
  } catch {
    return null;
  }
}

export function resetSetup() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SETUP_COMPLETED_KEY);
  window.localStorage.removeItem(SETUP_DATA_VERSION_KEY);
  window.localStorage.removeItem(SETUP_PROFILE_KEY);
}
