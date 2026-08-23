import { useCallback } from "react";
import { getProfile, updateProfile } from "../services/profileService";
import { useServiceQuery } from "./useServiceQuery";

export function useProfile() {
  const loader = useCallback(() => getProfile(), []);
  return { ...useServiceQuery(loader), updateProfile };
}
