import { useState } from "react";
import { PlusCircle, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Category, CategoryType } from "../../data/data";
import { useFinanceData } from "../../lib/financeStore";
import { toast } from "sonner";

const typeConfig: Record<CategoryType, { label: string; color: string; bg: string; border: string }> = {
  income: { label: "Income", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  savings: { label: "Savings", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  debt: { label: "Debt", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  expense: { label: "Expense", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
};

export function Categories() {
  const { categories: cats, addCategory, updateCategory, deleteCategory } = useFinanceData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", type: "expense" as CategoryType, icon: "📦", color: "#f97316" });

  function openAdd() {
    setEditing(null);
    setForm({ name: "", type: "expense", icon: "📦", color: "#f97316" });
    setOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({ name: cat.name, type: cat.type, icon: cat.icon, color: cat.color });
    setOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) { toast.error("Category name is required"); return; }
    if (editing) {
      updateCategory(editing.id, form);
      toast.success("Category updated");
    } else {
      addCategory(form);
      toast.success("Category added");
    }
    setOpen(false);
  }

  function handleDelete(id: string) {
    deleteCategory(id);
    toast.success("Category removed");
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900">Categories</h1>
          <p className="text-slate-500 text-sm">Manage your budget categories</p>
        </div>
        <Button onClick={openAdd} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <PlusCircle className="w-4 h-4" /> Add Category
        </Button>
      </div>

      {cats.length === 0 && (
        <Card className="shadow-sm border-blue-200">
          <CardContent className="p-5">
            <p className="text-sm text-[var(--financeos-text-primary)]" style={{ fontWeight: 600 }}>No categories yet.</p>
            <Button onClick={openAdd} className="mt-3 gap-2">
              <PlusCircle className="w-4 h-4" /> Add Category
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-5">
        {(["income", "savings", "debt", "expense"] as CategoryType[]).map((type) => {
          const config = typeConfig[type];
          const items = cats.filter((c) => c.type === type);
          return (
            <Card key={type} className={`shadow-sm border ${config.border}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-sm ${config.color}`}>{config.label} Categories</CardTitle>
                  <Badge className={`${config.bg} ${config.color} border-0 text-xs`}>{items.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="py-6 text-center text-slate-400">
                    <p className="text-sm">No {type} categories yet.</p>
                    <button type="button" onClick={openAdd} className="text-xs text-blue-600 mt-1 hover:underline">Add one</button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {items.map((cat) => (
                      <div
                        key={cat.id}
                        className="financeos-category-row group flex items-center gap-3 rounded-lg border border-transparent p-2.5 transition-colors hover:bg-slate-50"
                      >
                        <GripVertical className="financeos-category-grip h-3.5 w-3.5 cursor-grab text-slate-300" />
                        <span className="text-base">{cat.icon}</span>
                        <div className="flex-1">
                          <p className="financeos-category-name text-sm text-slate-800">{cat.name}</p>
                        </div>
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: cat.color }}
                        />
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="financeos-category-action h-6 w-6"
                            onClick={() => openEdit(cat)}
                          >
                            <Pencil className="financeos-category-edit-icon h-3 w-3 text-slate-400" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="financeos-category-action h-6 w-6"
                            onClick={() => handleDelete(cat.id)}
                          >
                            <Trash2 className="financeos-category-delete-icon h-3 w-3 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Name</Label>
              <Input
                className="mt-1"
                placeholder="Category name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="mt-1 w-full rounded-xl border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)] px-3 py-2 text-sm text-[var(--financeos-text-primary)] outline-none transition-[color,box-shadow] focus:border-[#8B5CF6]/70 focus:ring-[3px] focus:ring-[#8B5CF6]/20"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as CategoryType })}
              >
                <option value="income">Income</option>
                <option value="savings">Savings</option>
                <option value="debt">Debt</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Icon (emoji)</Label>
                <Input
                  className="mt-1"
                  placeholder="📦"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-9 w-9 cursor-pointer rounded-xl border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)]"
                  />
                  <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                {editing ? "Update" : "Add Category"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
