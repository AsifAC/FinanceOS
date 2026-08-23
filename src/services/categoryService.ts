import { Category, InsertRow, UpdateRow } from "./dbTypes";
import { createOwnRow, deleteOwnRow, listOwnRows, updateOwnRow } from "./serviceUtils";

export const listCategories = (type?: string) => listOwnRows<Category>("categories", { type }, "name");
export const createCategory = (values: InsertRow<Category>) => createOwnRow<Category>("categories", values);
export const updateCategory = (id: string, values: UpdateRow<Category>) => updateOwnRow<Category>("categories", id, values);
export const deleteCategory = (id: string) => deleteOwnRow("categories", id);
