import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { Link } from "react-router";
import { ArrowRight, Check, Eye, EyeOff, Mail } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";

type Fields = "fullName" | "email" | "password" | "confirmation";
type Errors = Partial<Record<Fields, string>>;

function AuthField({ label, error, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; error?: string; hint?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const password = props.type === "password";
  return (
    <div className="auth-field">
      <label htmlFor={props.id}>{label}</label>
      <div className="auth-input-wrap">
        <input {...props} type={password && revealed ? "text" : props.type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${props.id}-error` : hint ? `${props.id}-hint` : undefined} />
        {password && <button type="button" className="auth-reveal" disabled={props.disabled}
          aria-label={`${revealed ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={revealed}
          onClick={() => setRevealed((value) => !value)}>
          {revealed ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>}
      </div>
      {error ? <p id={`${props.id}-error`} className="auth-field-error">{error}</p>
        : hint ? <p id={`${props.id}-hint`} className="auth-field-hint">{hint}</p> : null}
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { signIn, signUp, isLoading } = useAuth();
  const signup = mode === "signup";
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingRef = useRef(false);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const busy = pending || isLoading;

  useEffect(() => {
    mounted.current = true;
    headingRef.current?.focus({ preventScroll: true });
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (confirmationEmail) headingRef.current?.focus();
  }, [confirmationEmail]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current || isLoading) return;
    const fields = new FormData(event.currentTarget);
    const fullName = String(fields.get("fullName") ?? "").trim();
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    const confirmation = String(fields.get("confirmation") ?? "");
    const next: Errors = {};
    if (signup && !fullName) next.fullName = "Enter your full name.";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    if (signup && (!confirmation || confirmation !== password)) next.confirmation = "Passwords must match.";
    setErrors(next);
    setError(null);
    if (Object.keys(next).length) {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${Object.keys(next)[0]}"]`)?.focus();
      return;
    }
    pendingRef.current = true;
    setPending(true);
    try {
      const result = signup ? await signUp(email, password, fullName) : await signIn(email, password);
      if (!mounted.current) return;
      if (!result.ok) {
        setError(result.error.code === "supabase_not_configured"
          ? "Account access is temporarily unavailable. Please try again later."
          : result.error.message);
      } else if (signup && !result.data.session) {
        // Supabase may deliberately conceal whether this address already exists.
        // No session means no authenticated redirect, even when a user is returned.
        formRef.current?.reset();
        setConfirmationEmail(email);
      } else if (!result.data.session) {
        setError("We couldn't start your session. Please try logging in again.");
      }
      // AuthPage redirects only once the provider confirms an authenticated session.
    } catch {
      if (mounted.current) setError("We couldn't connect right now. Please try again.");
    } finally {
      pendingRef.current = false;
      if (mounted.current) setPending(false);
    }
  }

  if (confirmationEmail) return (
    <div className="auth-confirmation auth-form-enter">
      <span className="auth-mail-mark"><Mail size={26} aria-hidden="true" /></span>
      <p className="auth-eyebrow">ONE MORE STEP</p>
      <h1 ref={headingRef} tabIndex={-1}>Check your email</h1>
      <p>Check <strong>{confirmationEmail}</strong> for a confirmation link to activate your account.</p>
      <div className="auth-confirmation-note"><Check size={18} aria-hidden="true" /><p>After confirming your address, log in to open your financial workspace.</p></div>
      <p className="auth-small">No email yet? Check your spam folder. If you already have an account, you can log in with your existing password.</p>
      <Link to="/auth/login" className="auth-submit">Back to log in <ArrowRight size={18} aria-hidden="true" /></Link>
    </div>
  );

  return (
    <div className="auth-form-enter">
      <div className="auth-form-heading">
        <p className="auth-wordmark">FinanceOS<span aria-hidden="true"> /</span></p>
        <h1 ref={headingRef} tabIndex={-1}>{signup ? "Create your FinanceOS account" : "Log in to FinanceOS"}</h1>
        <p>{signup ? "Make room for your next chapter." : "Welcome back. Your financial workspace is ready."}</p>
      </div>
      <form ref={formRef} onSubmit={submit} noValidate aria-busy={busy}>
        <fieldset disabled={busy}>
          <legend className="auth-sr-only">{signup ? "Create account details" : "Login details"}</legend>
          {signup && <AuthField id="auth-full-name" name="fullName" label="Full name" type="text" autoComplete="name" required placeholder="Your full name" error={errors.fullName} />}
          <AuthField id="auth-email" name="email" label="Email address" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required placeholder="you@example.com" error={errors.email} />
          <AuthField id="auth-password" name="password" label="Password" type="password" autoComplete={signup ? "new-password" : "current-password"} required placeholder={signup ? "Create a password" : "Enter your password"} error={errors.password} hint={signup ? "Use a strong, unique password." : undefined} />
          {signup && <AuthField id="auth-confirmation" name="confirmation" label="Confirm password" type="password" autoComplete="new-password" required placeholder="Re-enter your password" error={errors.confirmation} />}
        </fieldset>
        <div aria-live="polite" aria-atomic="true">{error && <p className="auth-request-error">{error}</p>}</div>
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? signup ? "Creating account…" : "Logging in…" : signup ? "Create account" : "Log in"}
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </button>
        <p className="auth-switch">{signup ? "Already have an account? " : "New to FinanceOS? "}
          <Link to={signup ? "/auth/login" : "/auth/signup"}>{signup ? "Log in" : "Create an account"}</Link>
        </p>
      </form>
    </div>
  );
}
