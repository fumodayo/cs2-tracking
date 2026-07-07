import { useEffect, useState } from 'react';
import type { VisibilityState } from '@tanstack/react-table';

const SCANNER_COLUMN_VISIBILITY_STORAGE_KEY = 'cs2t_scanner_columnVisibility';

export function useScannerColumnVisibility() {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    rateAll: false,
    rateLe: false,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SCANNER_COLUMN_VISIBILITY_STORAGE_KEY);
      if (saved) {
        setColumnVisibility(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load scanner column visibility', error);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(SCANNER_COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility, isLoaded]);

  return {
    columnVisibility,
    setColumnVisibility,
  };
}
