import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent } from "../ui/card";
import { categories, Category, CategoryType } from "../../data/data";
import { MONTHS, currentMonthIndex, currentYear } from "../../lib/constants";
import { toast } from "sonner";
import { PaymentMethod, PaymentMethodType, PaymentNetwork, useFinanceData } from "../../lib/financeStore";
import { getBrowserTimezone } from "../../lib/datePreferences";
import { PaymentMethodGrid, paymentMethodTypeOptions, paymentNetworkOptions } from "../common/PaymentMethodCards";
import { TimezoneSelector } from "../common/TimezoneSelector";

const STEPS = [
  { id: 1, title: "Budget Year", desc: "Choose year and start month" },
  { id: 2, title: "Categories", desc: "Customize default categories" },
  { id: 3, title: "Expected Amounts", desc: "Add expected monthly amounts" },
  { id: 4, title: "Start Tracking", desc: "Review and launch" },
];

const currencies = ["USD ($)", "EUR (€)", "GBP (£)", "CAD (C$)", "AUD (A$)", "JPY (¥)"];
const setupYearOptions = Array.from({ length: 5 }, (_, index) => String(currentYear - 2 + index));
const categoryTypeConfig: Record<CategoryType, { label: string; color: string; icon: string }> = {
  income: { label: "income", color: "#22c55e", icon: "$" },
  savings: { label: "savings", color: "#38bdf8", icon: "+" },
  debt: { label: "debt", color: "#f43f5e", icon: "!" },
  expense: { label: "expense", color: "#f97316", icon: "-" },
};

export function Setup() {
  const navigate = useNavigate();
  const { state, completeSetup } = useFinanceData();
  const [step, setStep] = useState(1);
  const [isLaunching, setIsLaunching] = useState(false);
  const [form, setForm] = useState({
    budgetName: "",
    year: String(currentYear),
    startMonth: MONTHS[currentMonthIndex],
    currency: "USD ($)",
    startDayOfWeek: state.startDayOfWeek,
    timezone: state.timezone || getBrowserTimezone(),
  });
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    nickname: "",
    type: "checking" as PaymentMethodType,
    institutionName: "",
    last4: "",
    network: "" as "" | PaymentNetwork,
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(state.paymentMethods);
  const [expectedIncome, setExpectedIncome] = useState("");
  const [expectedSavings, setExpectedSavings] = useState("");
  const [expectedDebt, setExpectedDebt] = useState("");
  const [expectedExpenses, setExpectedExpenses] = useState("");
  const [setupCategories, setSetupCategories] = useState<Category[]>(categories);

  const grouped = {
    income: setupCategories.filter((c) => c.type === "income"),
    savings: setupCategories.filter((c) => c.type === "savings"),
    debt: setupCategories.filter((c) => c.type === "debt"),
    expense: setupCategories.filter((c) => c.type === "expense"),
  };

  const amountLeft =
    (parseFloat(expectedIncome) || 0) -
    (parseFloat(expectedSavings) || 0) -
    (parseFloat(expectedDebt) || 0) -
    (parseFloat(expectedExpenses) || 0);

  function finishSetup() {
    completeSetup({
      ...form,
      startDayOfWeek: form.startDayOfWeek,
      timezone: form.timezone,
      paymentMethods,
      categories: setupCategories,
      expectedIncome,
      expectedSavings,
      expectedDebt,
      expectedExpenses,
    });
    setIsLaunching(true);
    toast.success("Budget created! Loading your dashboard.");
    window.setTimeout(() => navigate("/dashboard", { replace: true }), 900);
  }

  function addCategory(type: CategoryType) {
    const config = categoryTypeConfig[type];
    setSetupCategories((current) => [
      ...current,
      {
        id: `setup-category-${Date.now()}-${type}`,
        name: "",
        type,
        color: config.color,
        icon: config.icon,
      },
    ]);
  }

  function updateCategory(id: string, updates: Partial<Category>) {
    setSetupCategories((current) =>
      current.map((category) => category.id === id ? { ...category, ...updates } : category)
    );
  }

  function removeCategory(id: string) {
    setSetupCategories((current) => current.filter((category) => category.id !== id));
  }

  function addPaymentMethod() {
    if (!paymentMethodForm.nickname.trim()) {
      toast.error("Payment method nickname is required.");
      return;
    }
    setPaymentMethods((current) => [
      ...current,
      {
        id: `setup-payment-method-${Date.now()}`,
        nickname: paymentMethodForm.nickname.trim(),
        type: paymentMethodForm.type,
        institutionName: paymentMethodForm.institutionName.trim() || undefined,
        last4: paymentMethodForm.last4.trim() || undefined,
        network: paymentMethodForm.network || undefined,
        isLinked: false,
      },
    ]);
    setPaymentMethodForm({ nickname: "", type: "checking", institutionName: "", last4: "", network: "" });
  }

  if (isLaunching) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center px-2">
        <Card className="w-full max-w-md border-blue-100 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
            <h1 className="text-slate-950">Preparing your dashboard</h1>
            <p className="mt-2 text-sm text-slate-500">
              FinanceOS is turning your setup into a working budget overview.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-blue-600" style={{ fontWeight: 600 }}>FinanceOS onboarding</p>
        <h1 className="text-slate-900">Budget Setup</h1>
        <p className="text-slate-500 text-sm">Set up your annual budget once, then land in your dashboard automatically.</p>
      </div>

      {/* Step indicators */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-0">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center sm:flex-1">
            <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white p-2 shadow-sm sm:flex-col sm:bg-transparent sm:p-0 sm:shadow-none">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                step > s.id ? "bg-green-500 text-white" :
                step === s.id ? "bg-blue-600 text-white" :
                "bg-slate-200 text-slate-500"
              }`} style={{ fontWeight: 600 }}>
                {step > s.id ? <CheckCircle className="w-4 h-4" /> : s.id}
              </div>
              <div className="min-w-0 sm:text-center">
                <p className="text-xs text-slate-700" style={{ fontWeight: step === s.id ? 700 : 500 }}>{s.title}</p>
                <p className="hidden text-xs text-slate-400 sm:block">{s.desc}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 hidden h-0.5 flex-1 sm:block ${step > s.id ? "bg-green-500" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4 sm:p-6">
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-slate-900">Budget Year Setup</h2>
              <div className="space-y-4">
                <div>
                  <Label>Budget Name</Label>
                  <Input
                    className="mt-1"
                    value={form.budgetName}
                    onChange={(e) => setForm({ ...form, budgetName: e.target.value })}
                    placeholder="Budget year name"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Year</Label>
                    <select
                      className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                      value={form.year}
                      onChange={(e) => setForm({ ...form, year: e.target.value })}
                    >
                      {setupYearOptions.map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Start Month</Label>
                    <select
                      className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                      value={form.startMonth}
                      onChange={(e) => setForm({ ...form, startMonth: e.target.value })}
                    >
                      {MONTHS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Currency</Label>
                  <select
                    className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  >
                    {currencies.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Start week on</Label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {(["sunday", "monday"] as const).map((day) => (
                        <button
                          type="button"
                          key={day}
                          onClick={() => setForm({ ...form, startDayOfWeek: day })}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition-colors ${
                            form.startDayOfWeek === day
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Timezone</Label>
                    <TimezoneSelector
                      className="mt-1"
                      value={form.timezone}
                      onChange={(timezone) => setForm({ ...form, timezone })}
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-[var(--financeos-text-primary)]">Payment Methods</h3>
                    <p className="mt-1 text-xs text-[var(--financeos-text-muted)]">Add accounts and cards now, or manage them later in Settings.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Nickname"
                      value={paymentMethodForm.nickname}
                      onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, nickname: e.target.value })}
                    />
                    <select
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={paymentMethodForm.type}
                      onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, type: e.target.value as PaymentMethodType })}
                    >
                      {paymentMethodTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <Input
                      placeholder="Institution / bank"
                      value={paymentMethodForm.institutionName}
                      onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, institutionName: e.target.value })}
                    />
                    <Input
                      placeholder="Last 4 digits"
                      maxLength={4}
                      value={paymentMethodForm.last4}
                      onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, last4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    />
                    <select
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={paymentMethodForm.network}
                      onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, network: e.target.value as "" | PaymentNetwork })}
                    >
                      <option value="">Card network</option>
                      {paymentNetworkOptions.map((network) => <option key={network} value={network}>{network}</option>)}
                    </select>
                    <Button type="button" onClick={addPaymentMethod} className="bg-blue-600 text-white hover:bg-blue-700">
                      Add Payment Method
                    </Button>
                  </div>
                  <div className="mt-4">
                    <PaymentMethodGrid
                      paymentMethods={paymentMethods}
                      onDelete={(id) => setPaymentMethods((current) => current.filter((method) => method.id !== id))}
                    />
                  </div>
                  <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400">
                    Coming soon: Bank linking. Future Plaid/bank API integration can populate institution metadata, logos, and brand colors automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-slate-900">Customize Categories</h2>
              <p className="text-sm text-slate-500">No categories are created automatically. Add categories now or continue with an empty budget.</p>
              <div className="space-y-4">
                {(["income", "savings", "debt", "expense"] as const).map((type) => (
                  <div key={type}>
                    <h4 className="capitalize text-slate-700 mb-2 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        type === "income" ? "bg-green-500" :
                        type === "savings" ? "bg-blue-500" :
                        type === "debt" ? "bg-red-500" : "bg-orange-500"
                      }`} />
                      {type} Categories
                    </h4>
                    <div className="space-y-2">
                      {grouped[type].length === 0 && (
                        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-400">
                          No {type} categories yet.
                        </p>
                      )}
                      {grouped[type].map((cat) => (
                        <div key={cat.id} className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-3 sm:grid-cols-[3.5rem_1fr_2.25rem_auto] sm:items-center">
                          <Input
                            aria-label={`${type} category icon`}
                            value={cat.icon}
                            onChange={(e) => updateCategory(cat.id, { icon: e.target.value })}
                          />
                          <Input
                            aria-label={`${type} category name`}
                            placeholder="Category name"
                            value={cat.name}
                            onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
                          />
                          <input
                            aria-label={`${type} category color`}
                            type="color"
                            value={cat.color}
                            onChange={(e) => updateCategory(cat.id, { color: e.target.value })}
                            className="h-10 w-full rounded-xl border border-white/10 bg-white/10 p-1"
                          />
                          <button
                            type="button"
                            onClick={() => removeCategory(cat.id)}
                            className="px-3 py-2 text-sm text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addCategory(type)}
                        className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-slate-900">Expected Monthly Amounts</h2>
              <p className="text-sm text-slate-500">Set your planned monthly budget. These will apply to all months by default.</p>
              <div className="space-y-4">
                {[
                  { label: "Expected Income", value: expectedIncome, set: setExpectedIncome, color: "text-green-600" },
                  { label: "Expected Savings", value: expectedSavings, set: setExpectedSavings, color: "text-blue-600" },
                  { label: "Expected Debt Payments", value: expectedDebt, set: setExpectedDebt, color: "text-red-600" },
                  { label: "Expected Expenses", value: expectedExpenses, set: setExpectedExpenses, color: "text-orange-600" },
                ].map(({ label, value, set, color }) => (
                  <div key={label} className="grid gap-1.5 sm:grid-cols-[12rem_1fr] sm:items-center sm:gap-4">
                    <Label className={color}>{label}</Label>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <Input
                        className="pl-7"
                        type="number"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-slate-600" style={{ fontWeight: 500 }}>Amount Left = Income − Savings − Debt − Expenses</span>
                  <span className={`text-lg ${amountLeft >= 0 ? "text-green-600" : "text-red-600"}`} style={{ fontWeight: 700 }}>
                    ${amountLeft.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-slate-900">Ready to Start Tracking!</h2>
              <p className="text-sm text-slate-500">Your budget is set up. Here's a summary:</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <h4 className="text-slate-700">Budget Details</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Name</span>
                      <span className="text-slate-800">{form.budgetName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Year</span>
                      <span className="text-slate-800">{form.year}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Start Month</span>
                      <span className="text-slate-800">{form.startMonth}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Currency</span>
                      <span className="text-slate-800">{form.currency}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Week Starts</span>
                      <span className="text-slate-800 capitalize">{form.startDayOfWeek}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Timezone</span>
                      <span className="text-slate-800">{form.timezone}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Payment Methods</span>
                      <span className="text-slate-800">{paymentMethods.length}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <h4 className="text-slate-700">Monthly Budget</h4>
                  <div className="space-y-1">
                    {[
                      { label: "Income", value: expectedIncome, color: "text-green-600" },
                      { label: "Savings", value: expectedSavings, color: "text-blue-600" },
                      { label: "Debt", value: expectedDebt, color: "text-red-600" },
                      { label: "Expenses", value: expectedExpenses, color: "text-orange-600" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-slate-500">{label}</span>
                        <span className={color}>${parseFloat(value || "0").toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm pt-1 border-t border-slate-200">
                      <span className="text-slate-700" style={{ fontWeight: 500 }}>Amount Left</span>
                      <span className={amountLeft >= 0 ? "text-green-600" : "text-red-600"} style={{ fontWeight: 600 }}>
                        ${amountLeft.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <p className="text-sm text-green-700">Everything looks good! Click "Start Tracking" to launch your budget dashboard.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => step > 1 ? setStep(step - 1) : navigate("/")}
          className="h-11 flex-1 gap-2 sm:flex-none"
        >
          <ChevronLeft className="w-4 h-4" />
          {step === 1 ? "Cancel" : "Back"}
        </Button>
        <Button
          onClick={() => {
            if (step < 4) {
              setStep(step + 1);
            } else {
              finishSetup();
            }
          }}
          className="h-11 flex-1 gap-2 bg-blue-600 text-white hover:bg-blue-700 sm:flex-none"
        >
          {step === 4 ? "Start Tracking" : "Continue"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
