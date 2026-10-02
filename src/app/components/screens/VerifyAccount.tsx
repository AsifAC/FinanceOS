import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { Mail, Smartphone } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { useProfile } from "../../../hooks/useProfile";
import { useLogout } from "../../../hooks/useLogout";
import { maskEmail, normalizePhone, verificationDelivery, verificationPolicy, type VerificationChannel } from "../../../lib/verification";
import { requestVerification, verifyVerificationCode } from "../../../services/authService";
import { completeAccountVerification } from "../../../services/profileService";
import { AuthLayout } from "../auth/AuthLayout";

export function VerifyAccount() {
  if (!verificationPolicy.required) return <Navigate to="/dashboard" replace />;
  return <VerificationForm />;
}

function VerificationForm() {
  const { user } = useAuth();
  const { profile, isLoading, error: profileError, refreshProfile, updateProfile } = useProfile();
  const { logout, isSigningOut, logoutError } = useLogout();
  const [channel, setChannel] = useState<VerificationChannel>("email");
  const [phone, setPhone] = useState("");
  const [sentPhone, setSentPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pending = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && profile) {
      initialized.current = true;
      const preferred = profile.verification_channel;
      setChannel(preferred && verificationDelivery[preferred] ? preferred : verificationDelivery.email ? "email" : "phone");
    }
  }, [profile]);
  useEffect(() => { if (sent) codeInput.current?.focus(); }, [sent]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const previous = document.title;
    document.title = "Verify your account | FinanceOS";
    return () => { document.title = previous; };
  }, []);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try { await action(); } catch { setError("Couldn't connect. Please try again."); }
    finally { pending.current = false; setBusy(false); }
  }
  function sendCode() {
    if (Date.now() < retryAt || !verificationDelivery[channel]) return;
    void run(async () => {
      const normalized = normalizePhone(phone);
      if (channel === "phone" && !normalized) { setError("Include your country code, for example +12125551234."); return; }
      const saved = await updateProfile({ verification_channel: channel });
      if (!saved.ok) { setError(saved.error.message); return; }
      // Apply cooldown even to failed delivery attempts; the server enforces authoritative limits.
      setRetryAt(Date.now() + 60000); setNow(Date.now());
      const result = await requestVerification(channel, normalized ?? undefined);
      if (!result.ok) { setError(result.error.message); return; }
      setSentPhone(normalized ?? ""); setSent(true); setCode(""); setConfirmed(false);
    });
  }
  function verify(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (!confirmed) {
        const result = await verifyVerificationCode(channel, code, sentPhone);
        if (!result.ok) { setError(result.error.message); return; }
        setConfirmed(true); setCode("");
      }
      const result = await completeAccountVerification(channel);
      if (!result.ok) { setError("Your code was accepted, but we couldn't save verification. Retry saving within ten minutes, or request a new code."); return; }
      await refreshProfile();
    });
  }
  if (!isLoading && profile?.account_verified_at) return <Navigate to="/dashboard" replace />;
  return <AuthLayout mode="verify">
    <div className="auth-form-heading"><h1>Verify your account</h1>
      <p>{verificationDelivery.email || verificationDelivery.phone
        ? "Choose where you'd like to receive your verification code."
        : "Account verification is currently unavailable. Email and SMS delivery have not been enabled yet."}</p></div>
    {isLoading && !busy ? <p role="status">Loading your account…</p> : <>
      {profileError && <p role="alert" className="auth-request-error">{profileError.message} <button onClick={() => void refreshProfile()}>Retry</button></p>}
      {!sent ? <form onSubmit={event => { event.preventDefault(); sendCode(); }}>
        <fieldset disabled={busy || isSigningOut || !!profileError}>
          <legend className="auth-sr-only">Verification method</legend>
          <div className="verification-options">
            <label className="verification-option"><input type="radio" name="channel" value="email" disabled={!verificationDelivery.email} checked={verificationDelivery.email && channel === "email"} onChange={() => { setChannel("email"); setError(null); }} /><Mail size={20} aria-hidden="true" /><span><strong>Email</strong><small>{verificationDelivery.email ? `Send a code to ${maskEmail(user?.email)}` : "Email verification is currently unavailable"}</small></span></label>
            <label className="verification-option"><input type="radio" name="channel" value="phone" disabled={!verificationDelivery.phone} checked={verificationDelivery.phone && channel === "phone"} onChange={() => { setChannel("phone"); setError(null); }} /><Smartphone size={20} aria-hidden="true" /><span><strong>Phone</strong><small>{verificationDelivery.phone ? "Send a text message to your mobile number" : "SMS verification is currently unavailable"}</small></span></label>
          </div>
          {channel === "phone" && verificationDelivery.phone && <div className="auth-field"><label htmlFor="verification-phone">Mobile number</label><input id="verification-phone" type="tel" autoComplete="tel" placeholder="+12125551234" value={phone} onChange={event => setPhone(event.target.value)} aria-describedby="verification-phone-hint" /><p id="verification-phone-hint" className="auth-small">Include + and your country code.</p></div>}
          {!verificationDelivery[channel] && <p role="status" className="auth-small">{channel === "phone" ? "SMS" : "Email code"} verification is currently unavailable. Code delivery has not been enabled yet.</p>}
          <button className="auth-submit" disabled={busy || remaining > 0 || !verificationDelivery[channel]}>{busy ? "Sending…" : remaining ? `Try again in ${remaining}s` : "Send code"}</button>
        </fieldset>
      </form> : <form onSubmit={verify} aria-busy={busy}>
        <p className="auth-small">{channel === "email" ? `Code sent to ${maskEmail(user?.email)}.` : `Code sent to your mobile ending in ${sentPhone.slice(-4)}.`}</p>
        {!confirmed && <div className="auth-field"><label htmlFor="verification-code">Six-digit verification code</label><input ref={codeInput} id="verification-code" className="verification-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} disabled={busy || isSigningOut} required aria-describedby={error ? "verification-error" : undefined} aria-invalid={!!error} /></div>}
        <button className="auth-submit" disabled={busy || isSigningOut}>{busy ? "Verifying…" : confirmed ? "Retry saving verification" : "Verify"}</button>
        <div className="verification-actions"><button type="button" disabled={busy || remaining > 0 || isSigningOut} onClick={sendCode}>{remaining ? `Resend in ${remaining}s` : "Resend code"}</button>
          <button type="button" disabled={busy || isSigningOut} onClick={() => { setSent(false); setCode(""); setConfirmed(false); setError(null); }}>Change verification method</button></div>
      </form>}
    </>}
    {error && <p id="verification-error" role="alert" className="auth-request-error">{error}</p>}
    <div className="verification-actions"><button disabled={isSigningOut || busy} onClick={() => void logout()}>{isSigningOut ? "Logging out…" : "Log out"}</button></div>
    {logoutError && <p role="alert" className="auth-request-error">{logoutError}</p>}
  </AuthLayout>;
}
