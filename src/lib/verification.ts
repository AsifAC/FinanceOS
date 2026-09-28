export type VerificationChannel = "email" | "phone";

// Frontend onboarding gate only; bypassing never changes verification state.
export const verificationPolicy = {
  required: import.meta.env.VITE_ACCOUNT_VERIFICATION_REQUIRED === "true",
};

// Deployment readiness switches, not security controls. Enable only after provider/template review.
export const verificationDelivery = {
  email: import.meta.env.VITE_EMAIL_OTP_READY === "true",
  phone: import.meta.env.VITE_PHONE_OTP_READY === "true",
};

export function normalizePhone(value: string): string | null {
  const phone = value.trim().replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function maskEmail(email = "") {
  const [name, domain] = email.split("@");
  return domain ? `${name.slice(0, 1)}••••@${domain}` : "your email address";
}
