import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Archive, Check, LoaderCircle, Pencil, Plus, RotateCcw, RefreshCw } from "lucide-react";
import { useCategories } from "../../../hooks/useCategories";
import type { Category, SupabaseCategoryType } from "../../../types/supabase";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { getSelectableCategories } from "../../lib/selectableCategories";
import "../../../styles/categories.css";

const categoryTypes: SupabaseCategoryType[] = ["income", "expense", "savings", "debt"];
const typeLabels: Record<SupabaseCategoryType, string> = {
  income: "Income", expense: "Expense", savings: "Savings", debt: "Debt",
};
type CategoryForm = { name: string; type: SupabaseCategoryType; icon: string; color: string; sortOrder: string };
const emptyForm = (): CategoryForm => ({ name: "", type: "expense", icon: "", color: "#84cc16", sortOrder: "0" });

function errorMessage(code?: string) {
  if (code === "23505") return "A category with this name and type already exists.";
  if (code === "not_authenticated") return "Your session has expired. Sign in again to manage categories.";
  return "We couldn’t save that category. Please try again.";
}

function CategoryRow({ category, onEdit, onArchive, onRestore, busy }: {
  category: Category;
  onEdit(category: Category): void;
  onArchive(category: Category): void;
  onRestore(category: Category): void;
  busy: boolean;
}) {
  const archived = category.is_archived === true;
  return (
    <li className={`account-category-row${archived ? " is-archived" : ""}`} data-category-id={category.id}>
      <span className="account-category-icon" aria-hidden="true">{category.icon || "•"}</span>
      <span className="account-category-copy">
        <strong>{category.name}</strong>
        <span>{typeLabels[category.type]}{category.sort_order != null ? ` · Order ${category.sort_order}` : ""}</span>
      </span>
      <span className="account-category-badges">
        {category.is_default && <span className="account-category-badge is-default">Default</span>}
        {archived && <span className="account-category-badge is-archived">Archived</span>}
      </span>
      <span className="account-category-actions">
        <Button type="button" variant="ghost" size="sm" disabled={busy} aria-label={`Edit category ${category.name}`} onClick={() => onEdit(category)}>
          <Pencil size={14} aria-hidden="true" /> Edit
        </Button>
        {archived ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} aria-label={`Restore category ${category.name}`} onClick={() => onRestore(category)}>
            <RotateCcw size={14} aria-hidden="true" /> Restore
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" disabled={busy} aria-label={`Archive category ${category.name}`} onClick={() => onArchive(category)}>
            <Archive size={14} aria-hidden="true" /> Archive
          </Button>
        )}
      </span>
    </li>
  );
}

export function Categories() {
  const { categories, isLoading, loadError, refreshCategories, createCategory, updateCategory, archiveCategory } = useCategories();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const archivedCategories = categories.filter((category) => category.is_archived === true);
  const activeCount = categories.filter((category) => category.is_archived !== true).length;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setForm({ name: category.name, type: category.type, icon: category.icon ?? "", color: category.color ?? "#84cc16", sortOrder: category.sort_order == null ? "" : String(category.sort_order) });
    setFormError(null);
    setOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    const name = form.name.trim();
    const sortOrder = form.sortOrder.trim() === "" ? undefined : Number(form.sortOrder);
    if (!name) { setFormError("Enter a category name."); return; }
    if (!categoryTypes.includes(form.type)) { setFormError("Choose a valid category type."); return; }
    if (sortOrder !== undefined && !Number.isSafeInteger(sortOrder)) { setFormError("Sort order must be a whole number."); return; }
    if (form.color && !/^#[0-9a-fA-F]{6}$/.test(form.color)) { setFormError("Enter a valid six-digit hex color."); return; }

    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    const payload = { name, icon: form.icon.trim() || null, color: form.color || null, ...(sortOrder === undefined ? {} : { sort_order: sortOrder }) };
    try {
      const result = editing
        ? await updateCategory(editing.id, payload)
        : await createCategory({ ...payload, type: form.type });
      if (!result.ok) {
        if (result.error.code === "account_changed") return;
        setFormError(errorMessage(result.error.code));
        return;
      }
      toast.success(editing ? "Category updated" : "Category created");
      setOpen(false);
    } catch {
      setFormError(errorMessage());
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleArchive(category: Category, archived: boolean) {
    if (busyId) return;
    setBusyId(category.id);
    try {
      const result = archived
        ? await archiveCategory(category.id)
        : await updateCategory(category.id, { is_archived: false });
      if (!result.ok) {
        if (result.error.code === "account_changed") return;
        toast.error(errorMessage(result.error.code));
        return;
      }
      toast.success(archived ? "Category archived" : "Category restored");
    } catch {
      toast.error(errorMessage());
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="account-categories" aria-labelledby="categories-title">
      <header className="account-categories-heading">
        <div>
          <p className="account-categories-eyebrow">Account settings · Supabase synced</p>
          <h1 id="categories-title">Categories</h1>
          <p>Manage the categories linked to your account transactions.</p>
        </div>
        <div className="account-categories-heading-actions">
          <Button type="button" variant="outline" onClick={() => void refreshCategories()} disabled={isLoading} aria-label="Refresh categories">
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </Button>
          <Button type="button" onClick={openCreate} disabled={isLoading}>
            <Plus size={16} aria-hidden="true" /> Add category
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="account-categories-state" role="status" aria-label="Loading categories">
          <LoaderCircle className="animate-spin" size={20} aria-hidden="true" /> Loading your account categories…
          <div className="account-categories-skeleton" aria-hidden="true"><span /><span /><span /></div>
        </div>
      ) : loadError ? (
        <div className="account-categories-state" role="alert">
          <h2>Unable to load categories</h2>
          <p>Your account categories could not be loaded. Your local categories are not shown here.</p>
          <Button type="button" variant="outline" onClick={() => void refreshCategories()}>Retry</Button>
        </div>
      ) : categories.length === 0 ? (
        <div className="account-categories-state" role="status">
          <Check size={22} aria-hidden="true" />
          <h2>No account categories yet</h2>
          <p>Create a category to organize future account-backed transactions. Local categories are kept separate.</p>
          <Button type="button" onClick={openCreate}><Plus size={16} aria-hidden="true" /> Create category</Button>
        </div>
      ) : (
        <>
          <div className="account-categories-summary" aria-live="polite">{activeCount} active · {archivedCategories.length} archived</div>
          <div className="account-categories-grid">
            {categoryTypes.map((type) => {
              const items = getSelectableCategories(categories, type);
              return (
                <section className="account-category-group" key={type} aria-labelledby={`categories-${type}`}>
                  <header><h2 id={`categories-${type}`}>{typeLabels[type]} categories</h2><span>{items.length}</span></header>
                  {items.length === 0 ? <p className="account-category-empty">No active {typeLabels[type].toLowerCase()} categories.</p> : (
                    <ul>{items.map((category) => <CategoryRow key={category.id} category={category} onEdit={openEdit} onArchive={(item) => void handleArchive(item, true)} onRestore={(item) => void handleArchive(item, false)} busy={busyId === category.id || busyId !== null} />)}</ul>
                  )}
                </section>
              );
            })}
          </div>
          {archivedCategories.length > 0 && (
            <section className="account-category-group account-category-archive" aria-labelledby="archived-categories-title">
              <header><h2 id="archived-categories-title">Archived categories</h2><span>{archivedCategories.length}</span></header>
              <ul>{archivedCategories.map((category) => <CategoryRow key={category.id} category={category} onEdit={openEdit} onArchive={(item) => void handleArchive(item, true)} onRestore={(item) => void handleArchive(item, false)} busy={busyId === category.id || busyId !== null} />)}</ul>
              <p className="account-category-hint">Archived categories remain linked to historical transactions and are excluded from future selection.</p>
            </section>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving) setOpen(nextOpen); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit category" : "Create category"}</DialogTitle></DialogHeader>
          <form className="account-category-form" onSubmit={(event) => void handleSave(event)}>
            <div>
              <Label htmlFor="account-category-name">Name</Label>
              <Input id="account-category-name" autoFocus maxLength={80} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </div>
            <div>
              <Label htmlFor="account-category-type">Type</Label>
              <select id="account-category-type" value={form.type} disabled={editing !== null} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as SupabaseCategoryType }))}>
                {categoryTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
              </select>
              {editing && <p className="account-category-hint">Type is fixed after creation to keep historical transaction categories consistent.</p>}
            </div>
            <div className="account-category-form-grid">
              <div><Label htmlFor="account-category-icon">Icon (optional)</Label><Input id="account-category-icon" maxLength={12} value={form.icon} onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))} /></div>
              <div><Label htmlFor="account-category-sort">Sort order (optional)</Label><Input id="account-category-sort" type="number" step="1" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} /></div>
            </div>
            <div className="account-category-color-row">
              <div><Label htmlFor="account-category-color">Color</Label><Input id="account-category-color" type="color" value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} /></div>
              <span className="account-category-color-preview" style={{ background: form.color }} aria-hidden="true" />
              <Input aria-label="Color hex value" value={form.color} maxLength={7} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} />
            </div>
            {formError && <p className="account-category-form-error" role="alert">{formError}</p>}
            <div className="account-category-form-actions">
              <Button type="submit" disabled={saving || !form.name.trim()}>{saving && <LoaderCircle className="animate-spin" size={15} />} {saving ? "Saving…" : editing ? "Save changes" : "Create category"}</Button>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
