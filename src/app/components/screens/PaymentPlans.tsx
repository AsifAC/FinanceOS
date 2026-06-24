import { useState } from "react";
import { PlusCircle, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { PaymentPlan } from "../../data/data";
import { currentMonthIndex } from "../../lib/constants";
import { useFinanceData } from "../../lib/financeStore";
import { toast } from "sonner";

type Plan = PaymentPlan;

const statusConfig = {
  active: { label: "Active", class: "bg-green-100 text-green-700" },
  paused: { label: "Paused", class: "bg-yellow-100 text-yellow-700" },
  cancelled: { label: "Cancelled", class: "bg-slate-100 text-slate-500" },
};

const freqLabels: Record<Plan["frequency"], string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function PaymentPlans() {
  const { activeYear, paymentPlans: plans, addPaymentPlan, updatePaymentPlan, deletePaymentPlan } = useFinanceData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "",
    frequency: "monthly" as Plan["frequency"],
    dueDay: "1",
  });

  function toggleStatus(id: string) {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    const next = plan.status === "active" ? "paused" : "active";
    updatePaymentPlan(id, { status: next });
    toast.success(`${plan.name} ${next}`);
  }

  function deletePlan(id: string, name: string) {
    deletePaymentPlan(id);
    toast.success(`${name} removed`);
  }

  function addPlan() {
    if (!form.name || !form.amount) { toast.error("Name and amount required"); return; }
    addPaymentPlan({
      name: form.name,
      amount: parseFloat(form.amount),
      category: form.category || "General",
      frequency: form.frequency,
      dueDay: parseInt(form.dueDay),
      status: "active",
      nextDueDate: new Date(Number(activeYear), currentMonthIndex + 1, Number(form.dueDay)).toISOString().slice(0, 10),
    });
    toast.success(`${form.name} added`);
    setOpen(false);
    setForm({ name: "", amount: "", category: "", frequency: "monthly", dueDay: "1" });
  }

  const totalMonthly = plans
    .filter((p) => p.status === "active")
    .reduce((s, p) => {
      const mult = p.frequency === "weekly" ? 4.33 : p.frequency === "biweekly" ? 2.17 :
        p.frequency === "quarterly" ? 1/3 : p.frequency === "yearly" ? 1/12 : 1;
      return s + p.amount * mult;
    }, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900">Payment Plans</h1>
          <p className="text-slate-500 text-sm">Manage recurring bills, subscriptions, and planned payments</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <PlusCircle className="w-4 h-4" /> Add Payment Plan
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Active Plans</p>
            <p className="text-2xl text-slate-900 mt-1" style={{ fontWeight: 700 }}>
              {plans.filter((p) => p.status === "active").length}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Monthly Cost</p>
            <p className="text-2xl text-red-600 mt-1" style={{ fontWeight: 700 }}>
              ${totalMonthly.toFixed(0)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Annual Cost</p>
            <p className="text-2xl text-orange-600 mt-1" style={{ fontWeight: 700 }}>
              ${(totalMonthly * 12).toFixed(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 text-xs text-slate-500">Name</th>
                <th className="text-right py-3 px-3 text-xs text-slate-500">Amount</th>
                <th className="text-left py-3 px-3 text-xs text-slate-500">Category</th>
                <th className="text-left py-3 px-3 text-xs text-slate-500">Frequency</th>
                <th className="text-left py-3 px-3 text-xs text-slate-500">Due Day</th>
                <th className="text-left py-3 px-3 text-xs text-slate-500">Next Due</th>
                <th className="text-left py-3 px-3 text-xs text-slate-500">Status</th>
                <th className="py-3 px-4 text-xs text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 px-4 text-center">
                    <p className="text-sm text-slate-300" style={{ fontWeight: 600 }}>No payment plans yet.</p>
                    <Button onClick={() => setOpen(true)} className="mt-3 gap-2">
                      <PlusCircle className="w-4 h-4" /> Add Payment Plan
                    </Button>
                  </td>
                </tr>
              ) : plans.map((plan) => (
                <tr key={plan.id} className={`border-b border-slate-100 hover:bg-slate-50 ${plan.status === "cancelled" ? "opacity-50" : ""}`}>
                  <td className="py-3 px-4 text-slate-800" style={{ fontWeight: 500 }}>{plan.name}</td>
                  <td className="py-3 px-3 text-right text-slate-800" style={{ fontWeight: 600 }}>${plan.amount.toLocaleString()}</td>
                  <td className="py-3 px-3 text-slate-500">{plan.category}</td>
                  <td className="py-3 px-3 text-slate-500">{freqLabels[plan.frequency]}</td>
                  <td className="py-3 px-3 text-slate-500">{plan.dueDay}{plan.dueDay === 1 ? "st" : plan.dueDay === 2 ? "nd" : plan.dueDay === 3 ? "rd" : "th"}</td>
                  <td className="py-3 px-3 text-slate-500 text-xs">{plan.nextDueDate}</td>
                  <td className="py-3 px-3">
                    <Badge className={`${statusConfig[plan.status].class} border-0 text-xs`}>
                      {statusConfig[plan.status].label}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      {plan.status !== "cancelled" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7"
                          onClick={() => toggleStatus(plan.id)}
                          title={plan.status === "active" ? "Pause" : "Resume"}
                        >
                          {plan.status === "active"
                            ? <Pause className="w-3.5 h-3.5 text-slate-400" />
                            : <Play className="w-3.5 h-3.5 text-green-500" />
                          }
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7"
                        onClick={() => deletePlan(plan.id, plan.name)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Payment Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Name</Label>
              <Input className="mt-1" placeholder="Payment name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount ($)</Label>
                <Input className="mt-1" type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>Due Day</Label>
                <Input className="mt-1" type="number" min="1" max="31" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <Input className="mt-1" placeholder="e.g. Subscriptions" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <Label>Frequency</Label>
              <select
                className="mt-1 w-full rounded-xl border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)] px-3 py-2 text-sm text-[var(--financeos-text-primary)] outline-none transition-[color,box-shadow] focus:border-[#8B5CF6]/70 focus:ring-[3px] focus:ring-[#8B5CF6]/20"
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as Plan["frequency"] })}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={addPlan} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">Add Plan</Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
