import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft, DollarSign } from "lucide-react";
import { AuthVisual } from "./AuthVisual";
import "../../../styles/auth.css";

export function AuthLayout({ mode, children }: { mode: "login" | "signup"; children: ReactNode }) {
  return (
    <main className={`financeos-auth financeos-auth-${mode}`}>
      <a href="#auth-content" className="auth-skip-link">Skip to form</a>
      <section className="auth-brand-panel" aria-label="FinanceOS">
        <Link to="/" className="auth-brand" aria-label="FinanceOS home">
          <span className="auth-brand-mark"><DollarSign size={22} aria-hidden="true" /></span>
          FinanceOS
        </Link>
        <AuthVisual variant={mode} />
        <div className="auth-brand-copy">
          <p className="auth-eyebrow">YOUR FINANCIAL LIFE, ORGANIZED</p>
          <h2>{mode === "login" ? <>Your money.<br /><span>One operating system.</span></> : <>Create your<br /><span>account.</span></>}</h2>
          <p>{mode === "login" ? "A little clarity. A lot more possibility." : "Build your financial workspace in one place."}</p>
        </div>
        <div className="auth-brand-footer" aria-hidden="true"><span>CLARITY STARTS HERE</span><span>01 / FINANCEOS</span></div>
      </section>
      <section className="auth-form-panel" aria-label={mode === "login" ? "Log in" : "Create an account"}>
        <Link to="/" className="auth-back"><ArrowLeft size={16} aria-hidden="true" /> Back to home</Link>
        <div id="auth-content" className="auth-form-content" tabIndex={-1}>{children}</div>
        <p className="auth-panel-footer">Your money. Your next chapter.</p>
      </section>
    </main>
  );
}
