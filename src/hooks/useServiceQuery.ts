import { useCallback, useEffect, useState } from "react";
import { ServiceResult } from "../services/serviceUtils";

export interface ServiceQueryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

export function useServiceQuery<T>(loader: () => Promise<ServiceResult<T>>, enabled = true): ServiceQueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled));

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const result = await loader();
    setData(result.data);
    setError(result.error);
    setLoading(false);
  }, [enabled, loader]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
