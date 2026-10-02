import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import {
  deleteSnapshot as deleteSnapshotRequest,
  fetchSnapshots,
  saveSnapshot as saveSnapshotRequest,
  updateSnapshotNotes as updateSnapshotNotesRequest,
  type AccountSnapshot,
  type SaveSnapshotInput,
  type SnapshotServiceError,
  type SnapshotServiceResult,
} from "../services/snapshotService";

type State = { owner: string | null; snapshots: AccountSnapshot[]; error: SnapshotServiceError | null; loading: boolean };

export function useSnapshots() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const owner = !authLoading && isAuthenticated ? user?.id ?? null : null;
  const [state, setState] = useState<State>({ owner: null, snapshots: [], error: null, loading: false });
  const scope = useRef<{ owner: string | null; generation: number }>({ owner: null, generation: 0 });
  const requestId = useRef(0);

  const refreshSnapshots = useCallback(async (): Promise<SnapshotServiceResult<AccountSnapshot[]>> => {
    if (!owner || scope.current.owner !== owner) return { ok: true, data: [], error: null };
    const generation = scope.current.generation;
    const request = ++requestId.current;
    setState((current) => current.owner === owner ? { ...current, loading: true, error: null } : current);
    const result = await fetchSnapshots(owner);
    if (scope.current.owner === owner && scope.current.generation === generation && request === requestId.current) {
      setState({ owner, snapshots: result.ok ? result.data : [], error: result.error, loading: false });
    }
    return result;
  }, [owner]);

  const runMutation = useCallback(async <T,>(
    operation: (capturedOwner: string) => Promise<SnapshotServiceResult<T>>,
    update: (rows: AccountSnapshot[], data: T) => AccountSnapshot[],
  ): Promise<SnapshotServiceResult<T>> => {
    if (!owner || scope.current.owner !== owner) {
      return { ok: false, data: null, error: { code: "not_authenticated", message: "Sign in to manage saved budgets." } };
    }
    const capturedOwner = owner;
    const generation = scope.current.generation;
    const result = await operation(capturedOwner);
    const stillCurrent = scope.current.owner === capturedOwner && scope.current.generation === generation;
    if (stillCurrent) {
      setState((current) => current.owner === capturedOwner ? {
        ...current,
        snapshots: result.ok ? update(current.snapshots, result.data) : current.snapshots,
        error: result.error,
      } : current);
    }
    return stillCurrent ? result : {
      ok: false,
      data: null,
      error: { code: "account_changed", message: "The active account changed before the archive operation completed." },
    };
  }, [owner]);

  const save = useCallback((input: SaveSnapshotInput) => runMutation(
    (capturedOwner) => saveSnapshotRequest(input, capturedOwner),
    (rows, saved) => {
      // An overwrite replaces one server UUID, not all versions of the period.
      return [saved, ...rows.filter((item) => item.id !== saved.id)];
    },
  ), [runMutation]);

  const updateNotes = useCallback((id: string, notes: string) => runMutation(
    (capturedOwner) => updateSnapshotNotesRequest(id, notes, capturedOwner),
    (rows, updated) => rows.map((item) => item.id === updated.id ? updated : item),
  ), [runMutation]);

  const remove = useCallback((id: string) => runMutation(
    (capturedOwner) => deleteSnapshotRequest(id, capturedOwner),
    (rows) => rows.filter((item) => item.id !== id),
  ), [runMutation]);

  useEffect(() => {
    scope.current = { owner, generation: scope.current.generation + 1 };
    requestId.current += 1;
    setState({ owner, snapshots: [], error: null, loading: Boolean(owner) });
    if (owner) void refreshSnapshots();
    return () => {
      scope.current = { owner: null, generation: scope.current.generation + 1 };
      requestId.current += 1;
    };
  }, [owner, refreshSnapshots]);

  const visible = owner !== null && state.owner === owner;
  return {
    snapshots: visible ? state.snapshots : [],
    isLoading: authLoading || (owner !== null && (!visible || state.loading)),
    error: visible ? state.error : null,
    refreshSnapshots,
    saveSnapshot: save,
    updateSnapshotNotes: updateNotes,
    deleteSnapshot: remove,
  };
}
