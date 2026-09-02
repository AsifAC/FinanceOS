import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  getCurrentProfile,
  updateCurrentProfile,
  type ProfileServiceError,
  type ProfileServiceResult,
  type ProfileUpdates,
} from "../services/profileService";
import type { Profile } from "../types/supabase";

export function useProfile() {
  const { isAuthenticated, isLoading: authIsLoading, user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ProfileServiceError | null>(null);

  const refreshProfile = useCallback(async () => {
    if (authIsLoading) {
      return { ok: true, data: null, error: null } satisfies ProfileServiceResult<Profile | null>;
    }

    if (!isAuthenticated) {
      setProfile(null);
      setError(null);
      setIsLoading(false);
      return { ok: true, data: null, error: null } satisfies ProfileServiceResult<Profile | null>;
    }

    setIsLoading(true);
    setError(null);

    const result = await getCurrentProfile();
    setIsLoading(false);

    if (!result.ok) {
      setProfile(null);
      setError(result.error);
      return result;
    }

    setProfile(result.data);
    return result;
  }, [authIsLoading, isAuthenticated]);

  const updateProfile = useCallback(async (updates: ProfileUpdates) => {
    setIsLoading(true);
    setError(null);

    const result = await updateCurrentProfile(updates);
    setIsLoading(false);

    if (!result.ok) {
      setError(result.error);
      return result;
    }

    setProfile(result.data);
    return result;
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile, user?.id]);

  return {
    profile,
    isLoading: authIsLoading || isLoading,
    error,
    refreshProfile,
    updateProfile,
  };
}
