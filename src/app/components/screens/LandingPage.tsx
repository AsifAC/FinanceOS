import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import {
  Archive,
  ArrowRight,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  Sparkles,
} from "lucide-react";
import { useFinanceData } from "../../lib/financeStore";

type LandingCtas = {
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
};

type LandingButtonProps = {
  to: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "dark";
  icon?: boolean;
};

const heroKpis = [
  { label: "Income", value: "$8,400", className: "financeos-kpi-income" },
  { label: "Expenses", value: "$3,120", className: "financeos-kpi-expenses" },
  { label: "Savings", value: "$1,250", className: "financeos-kpi-savings" },
  { label: "Debt", value: "$780", className: "financeos-kpi-debt" },
  { label: "Amount Left", value: "$4,820", className: "financeos-kpi-left" },
];

const trustItems = [
  {
    title: "Your data stays organized",
    icon: Database,
  },
  {
    title: "Budget snapshots are saved locally",
    icon: Archive,
  },
  {
    title: "Payment methods are structured cleanly",
    icon: CreditCard,
  },
  {
    title: "Reports help you make better decisions",
    icon: FileText,
  },
];

function LandingButton({ to, children, variant = "primary", icon = false }: LandingButtonProps) {
  return (
    <Link to={to} className={`financeos-landing-button financeos-landing-button-${variant}`}>
      <span>{children}</span>
      {icon && <ArrowRight className="h-4 w-4" />}
    </Link>
  );
}

function AnimatedBudgetBars() {
  return (
    <div className="financeos-budget-bars" aria-hidden="true">
      {Array.from({ length: 36 }, (_, index) => (
        <span key={index} style={{ "--bar-index": index } as CSSProperties} />
      ))}
    </div>
  );
}

function FinanceOS3DCard() {
  return (
    <div className="financeos-hero-product" aria-label="FinanceOS dashboard mockup">
      <div className="financeos-chart-field" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="financeos-dashboard-device">
        <div className="financeos-device-topbar">
          <span>FinanceOS</span>
          <span>June Budget</span>
        </div>
        <div className="financeos-device-grid">
          <div className="financeos-device-panel financeos-device-panel-wide">
            <span>Monthly cash flow</span>
            <strong>$4,820 left</strong>
            <div className="financeos-device-line">
              <i />
            </div>
          </div>
          <div className="financeos-device-panel">
            <span>Income</span>
            <strong>$8.4k</strong>
          </div>
          <div className="financeos-device-panel">
            <span>Expenses</span>
            <strong>$3.1k</strong>
          </div>
          <div className="financeos-device-panel financeos-device-panel-wide">
            <span>Savings progress</span>
            <div className="financeos-progress-track">
              <i />
            </div>
          </div>
        </div>
      </div>
      {heroKpis.map(({ label, value, className }) => (
        <div key={label} className={`financeos-floating-kpi ${className}`}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function LandingHero({ ctas }: { ctas: LandingCtas }) {
  return (
    <section className="financeos-landing-hero">
      <div className="financeos-landing-copy financeos-reveal">
        <div className="financeos-landing-pill">
          <Sparkles className="h-4 w-4" />
          Personal finance command center
        </div>
        <h1>Your financial life, organized in one operating system.</h1>
        <p>
          Track income, expenses, savings, debt, payment methods, reports, and monthly budget snapshots from one modern FinanceOS dashboard.
        </p>
        <div className="financeos-landing-cta-row">
          <LandingButton to={ctas.primary.to} icon>{ctas.primary.label}</LandingButton>
          <LandingButton to={ctas.secondary.to} variant="secondary">{ctas.secondary.label}</LandingButton>
        </div>
      </div>
      <FinanceOS3DCard />
    </section>
  );
}

function BudgetTileVisual() {
  return (
    <div className="financeos-budget-tile-visual" aria-hidden="true">
      {["Income", "Bills", "Goals", "Debt", "Reports", "Left"].map((label, index) => (
        <span key={label} style={{ "--tile-index": index } as CSSProperties}>
          {label}
        </span>
      ))}
    </div>
  );
}

function PaymentCardVisual() {
  return (
    <div className="financeos-payment-card-visual" aria-hidden="true">
      <div className="financeos-payment-card-main">
        <span>FinanceOS Card</span>
        <strong>Budget Method</strong>
        <i>**** 4820</i>
      </div>
      <div className="financeos-payment-card-shadow" />
    </div>
  );
}

function LandingFeatureCards({ ctas }: { ctas: LandingCtas }) {
  return (
    <section className="financeos-feature-section">
      <div className="financeos-section-heading financeos-section-heading-centered financeos-reveal">
        <h2>Send your money plan into motion</h2>
      </div>
      <div className="financeos-feature-card-grid">
        <article className="financeos-cinematic-card financeos-reveal">
          <div className="financeos-cinematic-card-copy">
            <h3>Smart Budget Tracking</h3>
            <p>Track income, expenses, and monthly spending patterns without juggling spreadsheets.</p>
            <LandingButton to={ctas.primary.to} variant="primary">Start budgeting</LandingButton>
          </div>
          <BudgetTileVisual />
        </article>
        <article className="financeos-cinematic-card financeos-reveal">
          <div className="financeos-cinematic-card-copy">
            <h3>Payment Method Overview</h3>
            <p>Organize cash, cards, checking, savings, and future linked accounts in one clean view.</p>
            <LandingButton to={ctas.primary.to} variant="primary">Add payment methods</LandingButton>
          </div>
          <PaymentCardVisual />
        </article>
      </div>
    </section>
  );
}

function LandingDashboardShowcase({ ctas }: { ctas: LandingCtas }) {
  return (
    <section className="financeos-showcase-section">
      <div className="financeos-monitor-visual financeos-reveal" aria-label="FinanceOS reports dashboard mockup">
        <div className="financeos-monitor-screen">
          <div className="financeos-monitor-toolbar">
            <span>Cash flow</span>
            <span>Categories</span>
            <span>Reports</span>
          </div>
          <div className="financeos-monitor-charts">
            <div className="financeos-candles">
              {Array.from({ length: 18 }, (_, index) => (
                <span key={index} style={{ "--candle-index": index } as CSSProperties} />
              ))}
            </div>
            <div className="financeos-donut">
              <span />
            </div>
            <div className="financeos-savings-bars">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
        <div className="financeos-monitor-stand" />
      </div>
      <div className="financeos-showcase-copy financeos-reveal">
        <span>Intuitive budgeting tools</span>
        <h2>Build your monthly strategy and track financial trends seamlessly.</h2>
        <p>Review monthly cash flow, category breakdowns, savings progress, and debt reduction without losing the bigger picture.</p>
        <LandingButton to={ctas.primary.to} variant="primary">View dashboard</LandingButton>
      </div>
    </section>
  );
}

function LandingSnapshotSection() {
  const snapshots = ["January Snapshot", "February Snapshot", "Annual Summary"];

  return (
    <section className="financeos-snapshot-section">
      <div className="financeos-snapshot-copy financeos-reveal">
        <span>Archive view</span>
        <h2>Your budget history, preserved</h2>
        <p>Save monthly and yearly snapshots so you can review where your money went and how your financial habits changed.</p>
      </div>
      <div className="financeos-snapshot-stack financeos-reveal" aria-label="Budget snapshot cards">
        {snapshots.map((snapshot, index) => (
          <article key={snapshot} style={{ "--snapshot-index": index } as CSSProperties}>
            <span>{snapshot}</span>
            <strong>{["$4,120 left", "$4,820 left", "+14% saved"][index]}</strong>
            <i />
          </article>
        ))}
      </div>
    </section>
  );
}

function LandingTrustSection() {
  return (
    <section className="financeos-trust-section">
      <div className="financeos-section-heading financeos-section-heading-centered financeos-reveal">
        <h2>Built for clarity and control</h2>
      </div>
      <div className="financeos-trust-grid">
        {trustItems.map(({ title, icon: Icon }) => (
          <article key={title} className="financeos-trust-card financeos-reveal">
            <span className="financeos-line-icon">
              <Icon className="h-9 w-9" />
            </span>
            <p>{title}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LandingFinalCTA({ ctas }: { ctas: LandingCtas }) {
  return (
    <section className="financeos-final-section">
      <AnimatedBudgetBars />
      <div className="financeos-final-copy financeos-reveal">
        <h2>Join a new generation of budgeters</h2>
        <LandingButton to={ctas.primary.to} icon>{ctas.primary.label}</LandingButton>
      </div>
    </section>
  );
}

export function LandingPage() {
  const { state } = useFinanceData();
  const isAuthenticated = state.setupCompleted;
  const ctas: LandingCtas = {
    primary: isAuthenticated
      ? { label: "Open Dashboard", to: "/dashboard" }
      : { label: "Get started", to: "/setup" },
    secondary: isAuthenticated
      ? { label: "Continue Budgeting", to: "/start" }
      : { label: "Log in", to: "/start" },
  };
  const headerPrimary = isAuthenticated ? ctas.primary : { label: "Sign up", to: "/setup" };
  const headerSecondary = isAuthenticated ? ctas.secondary : { label: "Log in", to: "/start" };

  return (
    <div className="financeos-landing">
      <header className="financeos-landing-header">
        <Link to="/" className="financeos-landing-brand" aria-label="FinanceOS landing page">
          <span className="financeos-landing-logo">
            <DollarSign className="h-5 w-5" />
          </span>
          <span>FinanceOS</span>
        </Link>
        <nav className="financeos-landing-actions" aria-label="Public navigation">
          <LandingButton to={headerSecondary.to} variant="outline">{headerSecondary.label}</LandingButton>
          <LandingButton to={headerPrimary.to} variant="primary">{headerPrimary.label}</LandingButton>
        </nav>
      </header>

      <main>
        <LandingHero ctas={ctas} />
        <LandingFeatureCards ctas={ctas} />
        <LandingDashboardShowcase ctas={ctas} />
        <LandingSnapshotSection />
        <LandingTrustSection />
        <LandingFinalCTA ctas={ctas} />
      </main>
    </div>
  );
}
