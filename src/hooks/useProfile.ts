import { createContext, createElement, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./useAuth";
import {
  getCurrentProfile,
  updateCurrentProfile,
  type ProfileServiceError,
  type ProfileServiceResult,
  type ProfileUpdates,
} from "../services/profileService";
import type { Profile } from "../types/supabase";

function useProfileState() {
  const { isAuthenticated, isLoading: authIsLoading, user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const generation = useRef(0);
  const [error, setError] = useState<ProfileServiceError | null>(null);

  const refreshProfile = useCallback(async () => {
    if (authIsLoading) {
      return { ok: true, data: null, error: null } satisfies ProfileServiceResult<Profile | null>;
    }

    if (!isAuthenticated) {
      setProfile(null);
      setLoadedFor(null);
      setError(null);
      setIsLoading(false);
      return { ok: true, data: null, error: null } satisfies ProfileServiceResult<Profile | null>;
    }

    setIsLoading(true);
    setError(null);
    const revision = ++generation.current;
    const result = await getCurrentProfile().catch(() => ({ ok: false as const, data: null, error: { message: "Unable to load your account. Please retry." } }));
    if (revision !== generation.current) return result;
    setLoadedFor(user?.id ?? null);
    setIsLoading(false);

    if (!result.ok) {
      setProfile(null);
      setError(result.error);
      return result;
    }

    setProfile(result.data);
    return result;
  }, [authIsLoading, isAuthenticated, user?.id]);

  const updateProfile = useCallback(async (updates: ProfileUpdates) => {
    setIsLoading(true);
    setError(null);
    const revision = ++generation.current;
    const result = await updateCurrentProfile(updates).catch(() => ({ ok: false as const, data: null, error: { message: "Unable to save your account. Please retry." } }));
    if (revision !== generation.current) return result;
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
    return () => { generation.current++; };
  }, [refreshProfile, user?.id]);

  return {
    profile: loadedFor === user?.id ? profile : null,
    isLoading: authIsLoading || isLoading || (isAuthenticated && loadedFor !== user?.id),
    error,
    refreshProfile,
    updateProfile,
  };
}

export const ProfileContext = createContext<ReturnType<typeof useProfileState> | null>(null);
export function ProfileProvider({ children }: { children: ReactNode }) {
  return createElement(ProfileContext.Provider, { value: useProfileState() }, children);
}
export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useProfile requires ProfileProvider");
  return value;
}
