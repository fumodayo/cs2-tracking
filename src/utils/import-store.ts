import { useSyncExternalStore } from "react";

export type ImportPhase = "idle" | "reading" | "uploading" | "done" | "error";

export type ImportState = {
  phase: ImportPhase;
  fileName?: string;
  rowsCount?: number;
  importedCount?: number;
  importedIds?: string[];
  message?: string;
};

let currentState: ImportState = { phase: "idle" };
const listeners = new Set<() => void>();

export const importStore = {
  getState() {
    return currentState;
  },
  setState(nextState: ImportState) {
    currentState = nextState;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useImportStore() {
  return useSyncExternalStore(
    importStore.subscribe,
    importStore.getState,
    importStore.getState,
  );
}
