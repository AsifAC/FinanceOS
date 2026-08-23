import { useCallback } from "react";
import { getUserPreferences, updateUserPreferences } from "../services/preferencesService";
import { useServiceQuery } from "./useServiceQuery";

export function useUserPreferences() {
  const loader = useCallback(() => getUserPreferences(), []);
  return { ...useServiceQuery(loader), updateUserPreferences };
}
