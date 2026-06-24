import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  CreditCard,
  Download,
  Globe2,
  Moon,
  Palette,
  Shield,
  Sun,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import { MONTHS, currentYear } from "../../lib/constants";
import { PaymentMethod, PaymentMethodType, PaymentNetwork, useFinanceData } from "../../lib/financeStore";
import { useFinanceOSTheme } from "../../lib/theme";
import { DEV_PREVIEW_MODE, DEV_PREVIEW_YEAR } from "../../../config/devPreview";
import { PaymentMethodGrid, paymentMethodTypeOptions, paymentNetworkOptions } from "../common/PaymentMethodCards";
import { TimezoneSelector } from "../common/TimezoneSelector";
import { toast } from "sonner";

export function Settings() {
  const {
    activeYear,
    startDayOfWeek,
    timezone,
    paymentMethods,
    previewModeEnabled,
    setActiveYear,
    updatePreferences,
    addPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    setPreviewModeEnabled,
    resetAppData,
  } = useFinanceData();
  const { theme, setTheme } = useFinanceOSTheme();
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [currency, setCurrency] = useState("USD ($)");
  const [defaultYear, setDefaultYear] = useState(activeYear);
  const [startMonth, setStartMonth] = useState("January");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    id: "",
    nickname: "",
    type: "checking" as PaymentMethodType,
    institutionName: "",
    last4: "",
    network: "" as "" | PaymentNetwork,
  });
  const yearOptions = Array.from(new Set([
    String(Number(activeYear) - 1),
    activeYear,
    String(Number(activeYear) + 1),
    String(currentYear),
  ])).sort();

  useEffect(() => {
    setDefaultYear(activeYear);
  }, [activeYear]);

  function resetPaymentMethodForm() {
    setPaymentMethodForm({ id: "", nickname: "", type: "checking", institutionName: "", last4: "", network: "" });
  }

  function editPaymentMethod(method: PaymentMethod) {
    setPaymentMethodForm({
      id: method.id,
      nickname: method.nickname,
      type: method.type,
      institutionName: method.institutionName ?? "",
      last4: method.last4 ?? "",
      network: method.network ?? "",
    });
  }

  function savePaymentMethod() {
    if (!paymentMethodForm.nickname.trim()) {
      toast.error("Payment method nickname is required.");
      return;
    }
    const payload = {
      nickname: paymentMethodForm.nickname.trim(),
      type: paymentMethodForm.type,
      institutionName: paymentMethodForm.institutionName.trim() || undefined,
      last4: paymentMethodForm.last4.trim() || undefined,
      network: paymentMethodForm.network || undefined,
      isLinked: false,
    };
    if (paymentMethodForm.id) {
      updatePaymentMethod(paymentMethodForm.id, payload);
      toast.success("Payment method updated.");
    } else {
      addPaymentMethod(payload);
      toast.success("Payment method added.");
    }
    resetPaymentMethodForm();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-1 py-4 sm:px-2 lg:px-0">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B5CF6]">Account Center</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-[var(--financeos-text-primary)] sm:text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-[var(--financeos-text-secondary)]">
          Manage your FinanceOS preferences, regional defaults, payment rails, and account controls.
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="financeos-control-card shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="financeos-settings-icon flex h-10 w-10 items-center justify-center rounded-2xl">
                <Palette className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base text-[var(--financeos-text-primary)]">Appearance</CardTitle>
                <p className="text-xs text-[var(--financeos-text-muted)]">Theme, accent color, and UI preferences</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="financeos-settings-icon flex h-9 w-9 items-center justify-center rounded-2xl">
                  {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-500" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--financeos-text-primary)]">{theme === "dark" ? "Dark Mode" : "Light Mode"}</p>
                  <p className="text-xs text-[var(--financeos-text-muted)]">Switch between the premium dark and two-tone light themes</p>
                </div>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(v) => {
                  setTheme(v ? "dark" : "light");
                  toast.success(`${v ? "Dark" : "Light"} mode enabled`);
                }}
              />
            </div>
            <div>
              <Label>Accent color</Label>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[
                  ["Income", "from-[#00D68F] to-[#00C26E]"],
                  ["Savings", "from-[#3B82F6] to-[#2563EB]"],
                  ["Debt", "from-[#F59E0B] to-[#D97706]"],
                  ["Expenses", "from-[#EF4444] to-[#DC2626]"],
                ].map(([label, gradient]) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => toast.info(`${label} accent selected`)}
                    className="flex min-h-14 flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] px-2 text-[11px] font-semibold text-[var(--financeos-text-secondary)] transition-colors hover:border-[#8B5CF6]/50"
                  >
                    <span className={`h-3 w-10 rounded-full bg-gradient-to-r ${gradient}`} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="financeos-control-card shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="financeos-settings-icon flex h-10 w-10 items-center justify-center rounded-2xl">
                <Globe2 className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base text-[var(--financeos-text-primary)]">Regional</CardTitle>
                <p className="text-xs text-[var(--financeos-text-muted)]">Timezone, week start, and budget defaults</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Timezone</Label>
                <TimezoneSelector className="mt-2" value={timezone} onChange={(timezone) => updatePreferences({ timezone })} />
              </div>
              <div>
                <Label>Start week on</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["sunday", "monday"] as const).map((day) => (
                    <button
                      type="button"
                      key={day}
                      onClick={() => updatePreferences({ startDayOfWeek: day })}
                      className={`min-h-12 rounded-2xl border px-3 py-2 text-sm font-semibold capitalize transition-colors ${
                        startDayOfWeek === day
                          ? "border-[#8B5CF6]/60 bg-[#8B5CF6]/15 text-[var(--financeos-text-primary)]"
                          : "border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] text-[var(--financeos-text-muted)] hover:bg-[var(--financeos-surface-hover)]"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Currency</Label>
                <select className="financeos-select mt-2 h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#8B5CF6]/70 focus:ring-[3px] focus:ring-[#8B5CF6]/20" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {["USD ($)", "EUR (EUR)", "GBP (GBP)", "CAD (C$)", "AUD (A$)", "JPY (JPY)"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>Budget Year</Label>
                <select className="financeos-select mt-2 h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#8B5CF6]/70 focus:ring-[3px] focus:ring-[#8B5CF6]/20" value={defaultYear} onChange={(e) => setDefaultYear(e.target.value)}>
                  {yearOptions.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <Label>Start Month</Label>
                <select className="financeos-select mt-2 h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#8B5CF6]/70 focus:ring-[3px] focus:ring-[#8B5CF6]/20" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}>
                  {MONTHS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <Button
              onClick={() => {
                setActiveYear(defaultYear);
                toast.success(`${defaultYear} budget settings saved`);
              }}
              className="bg-blue-600 text-white hover:bg-blue-700"
              size="sm"
            >
              Save Regional Settings
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="financeos-control-card shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="financeos-settings-icon flex h-10 w-10 items-center justify-center rounded-2xl">
              <CreditCard className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-base text-[var(--financeos-text-primary)]">Financial</CardTitle>
              <p className="text-xs text-[var(--financeos-text-muted)]">Payment methods and future bank linking</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Input className="financeos-field" placeholder="Nickname" value={paymentMethodForm.nickname} onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, nickname: e.target.value })} />
            <select className="financeos-select h-10 rounded-xl border px-3 text-sm outline-none focus:border-[#8B5CF6]/70 focus:ring-[3px] focus:ring-[#8B5CF6]/20" value={paymentMethodForm.type} onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, type: e.target.value as PaymentMethodType })}>
              {paymentMethodTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <Input className="financeos-field" placeholder="Institution / bank" value={paymentMethodForm.institutionName} onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, institutionName: e.target.value })} />
            <Input className="financeos-field" placeholder="Last 4 digits" maxLength={4} value={paymentMethodForm.last4} onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, last4: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
            <select className="financeos-select h-10 rounded-xl border px-3 text-sm outline-none focus:border-[#8B5CF6]/70 focus:ring-[3px] focus:ring-[#8B5CF6]/20" value={paymentMethodForm.network} onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, network: e.target.value as "" | PaymentNetwork })}>
              <option value="">Card network</option>
              {paymentNetworkOptions.map((network) => <option key={network} value={network}>{network}</option>)}
            </select>
            <div className="flex gap-2">
              <Button onClick={savePaymentMethod} className="flex-1 bg-blue-600 text-white hover:bg-blue-700">{paymentMethodForm.id ? "Update" : "Add"} Method</Button>
              {paymentMethodForm.id && <Button variant="outline" onClick={resetPaymentMethodForm}>Cancel</Button>}
            </div>
          </div>
          <PaymentMethodGrid paymentMethods={paymentMethods} onEdit={editPaymentMethod} onDelete={deletePaymentMethod} />
          <div className="financeos-muted-panel rounded-2xl border border-dashed p-4 text-sm">
            <div className="flex items-center gap-2 text-[var(--financeos-text-primary)]">
              <Building2 className="h-4 w-4 text-[#8B5CF6]" />
              Future bank linking
            </div>
            <p className="mt-1 text-xs">
              TODO: future Plaid or bank API integration should populate institutionId, institutionLogo, brandColor, linkedAccountId, and isLinked metadata.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="financeos-control-card shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="financeos-settings-icon flex h-10 w-10 items-center justify-center rounded-2xl">
                <User className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base text-[var(--financeos-text-primary)]">Account</CardTitle>
                <p className="text-xs text-[var(--financeos-text-muted)]">Profile and notification preferences</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-4 sm:flex-row sm:items-center">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6]">
                <User className="h-7 w-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--financeos-text-primary)]">{profile.name || "FinanceOS User"}</p>
                <p className="truncate text-sm text-[var(--financeos-text-muted)]">{profile.email || "No email saved"}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => toast.info("Profile photo upload is not connected yet.")}>Change Photo</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Display Name</Label>
                <Input className="financeos-field mt-2" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input className="financeos-field mt-2" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-4">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-[#8B5CF6]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--financeos-text-primary)]">Notifications</p>
                  <p className="text-xs text-[var(--financeos-text-muted)]">Budget reminders and account alerts</p>
                </div>
              </div>
              <Switch checked onCheckedChange={() => toast.info("Notification preferences are not connected yet.")} />
            </div>
            <Button onClick={() => toast.success("Profile saved")} className="bg-blue-600 text-white hover:bg-blue-700" size="sm">Save Profile</Button>
          </CardContent>
        </Card>

        <Card className="financeos-control-card shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="financeos-settings-icon flex h-10 w-10 items-center justify-center rounded-2xl">
                <Shield className="h-4 w-4" />
              </span>
              <div>
                <CardTitle className="text-base text-[var(--financeos-text-primary)]">Data Management</CardTitle>
                <p className="text-xs text-[var(--financeos-text-muted)]">Export, import, and budget year controls</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--financeos-text-primary)]">Export Budget Data</p>
                <p className="text-xs text-[var(--financeos-text-muted)]">Download your {activeYear} budget as CSV or JSON</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.success(`Export started - budget_${activeYear}.csv`)}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </div>
            <Separator />
            <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--financeos-text-primary)]">Import Budget Backup</p>
                <p className="text-xs text-[var(--financeos-text-muted)]">Restore from a previously exported file</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Select a .json or .csv backup file")}>
                <Upload className="h-3.5 w-3.5" /> Import
              </Button>
            </div>
            <Separator />
            <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--financeos-text-primary)]">Delete Budget Year</p>
                <p className="text-xs text-red-500">Permanently remove all {activeYear} budget data</p>
              </div>
              {!showDeleteConfirm ? (
                <Button variant="outline" size="sm" className="financeos-soft-danger gap-2 text-red-600" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-red-500">Are you sure?</span>
                  <Button size="sm" className="h-8 bg-red-600 text-xs text-white hover:bg-red-700" onClick={() => { resetAppData(); setShowDeleteConfirm(false); toast.error("Budget year deleted"); }}>Confirm</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                </div>
              )}
            </div>
            {DEV_PREVIEW_MODE && (
              <>
                <Separator />
                <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--financeos-text-primary)]">Enable Preview Data</p>
                    <p className="text-xs text-[var(--financeos-text-muted)]">Overlay isolated {DEV_PREVIEW_YEAR} mock transactions, reports, charts, and archive snapshots.</p>
                  </div>
                  <Switch
                    checked={previewModeEnabled}
                    onCheckedChange={(enabled) => {
                      setPreviewModeEnabled(enabled);
                      toast.success(enabled ? "Preview data enabled" : "Preview data disabled");
                    }}
                  />
                </div>
                {previewModeEnabled && (
                  <div className="rounded-2xl border border-[#F59E0B]/25 bg-[#F59E0B]/10 px-4 py-3 text-sm text-[#D97706]">
                    Preview Data Enabled. Mock data is merged only for display and is not written into app data storage.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="py-2 text-center text-xs text-[var(--financeos-text-subtle)]">
        <p>FinanceOS v1.0.0 · Your personal operating system for money.</p>
        <p className="mt-0.5 inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" /> {activeYear}
        </p>
      </div>
    </div>
  );
}
