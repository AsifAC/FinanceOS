import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  getCurrentUserPreferences,
  updateCurrentUserPreferences,
  type UserPreferencesServiceError,
  type UserPreferencesServiceResult,
  type UserPreferencesUpdates,
} from "../services/userPreferencesService";
import type { UserPreferences } from "../types/supabase";

export function useUserPreferences() {
  const { isAuthenticated, isLoading: authIsLoading, user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<UserPreferencesServiceError | null>(null);

  const refreshPreferences = useCallback(async () => {
    if (authIsLoading) {
      return { ok: true, data: null, error: null } satisfies UserPreferencesServiceResult<UserPreferences | null>;
    }

    if (!isAuthenticated) {
      setPreferences(null);
      setError(null);
      setIsLoading(false);
      return { ok: true, data: null, error: null } satisfies UserPreferencesServiceResult<UserPreferences | null>;
    }

    setIsLoading(true);
    setError(null);

    const result = await getCurrentUserPreferences();
    setIsLoading(false);

    if (!result.ok) {
      setPreferences(null);
      setError(result.error);
      return result;
    }

    setPreferences(result.data);
    return result;
  }, [authIsLoading, isAuthenticated]);

  const updatePreferences = useCallback(
    async (updates: UserPreferencesUpdates) => {
      setIsLoading(true);
      setError(null);

      const result = await updateCurrentUserPreferences(updates);
      setIsLoading(false);

      if (!result.ok) {
        setError(result.error);
        return result;
      }

      setPreferences(result.data);
      return result;
    },
    [],
  );

  useEffect(() => {
    void refreshPreferences();
  }, [refreshPreferences, user?.id]);

  return {
    preferences,
    isLoading: authIsLoading || isLoading,
    error,
    refreshPreferences,
    updatePreferences,
  };
}
