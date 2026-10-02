import { Link } from "react-router";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "../ui/button";
import { PaymentMethodManagement } from "./PaymentMethodManagement";

export function PaymentMethods() {
  return (
    <section className="transactions-ledger" aria-labelledby="payment-methods-title">
      <div className="transactions-heading">
        <div>
          <p className="transactions-eyebrow">Your account · Managed by Supabase</p>
          <h1 id="payment-methods-title">Payment Methods</h1>
          <p>Manage account-owned methods and defaults for future transaction entry.</p>
        </div>
        <Button asChild variant="outline"><Link to="/settings"><ArrowLeft size={15} className="mr-2" />Settings</Link></Button>
      </div>
      <div className="mb-4 flex items-center gap-2 text-xs text-[var(--financeos-text-muted)]"><CreditCard size={14} /> Account-backed records · UUID identity · no browser-local method fallback</div>
      <PaymentMethodManagement />
    </section>
  );
}
