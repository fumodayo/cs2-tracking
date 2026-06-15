import { useSyncExternalStore } from "react";

export type SyncAccountProgress = {
  steamId64: string;
  accountName: string;
  avatarUrl: string | null;
  status: "scanning" | "done" | "error";
  message: string;
  percent: number;
  scanProgress?: {
    stage: string;
    message: string;
    percent: number;
    detail?: Record<string, number | string>;
  };
};

export type SyncState = {
  isSyncing: boolean;
  syncOverallPercent: number;
  syncOverallMessage: string;
  syncAccountProgresses: Map<string, SyncAccountProgress>;
  singleScanId: string | null;
  error: string | null;
};

const initialMap = new Map<string, SyncAccountProgress>();

let currentState: SyncState = {
  isSyncing: false,
  syncOverallPercent: 0,
  syncOverallMessage: "",
  syncAccountProgresses: initialMap,
  singleScanId: null,
  error: null,
};

const listeners = new Set<() => void>();

export const syncStore = {
  getState() {
    return currentState;
  },
  setState(
    nextState: Partial<SyncState> | ((prev: SyncState) => Partial<SyncState>),
  ) {
    const patch =
      typeof nextState === "function" ? nextState(currentState) : nextState;
    currentState = { ...currentState, ...patch };
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useSyncStore() {
  return useSyncExternalStore(
    syncStore.subscribe,
    syncStore.getState,
    syncStore.getState,
  );
}
