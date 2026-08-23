import { useCallback } from "react";
import { createCategory, deleteCategory, listCategories, updateCategory } from "../services/categoryService";
import { useServiceQuery } from "./useServiceQuery";

export function useCategories(type?: string) {
  const loader = useCallback(() => listCategories(type), [type]);
  return { ...useServiceQuery(loader), createCategory, updateCategory, deleteCategory };
}
