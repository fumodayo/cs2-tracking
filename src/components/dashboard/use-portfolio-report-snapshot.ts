'use client';

import { useEffect, useState } from 'react';
import type { PortfolioReportDto } from '@/types/report';
import { readAsyncJson, writeAsyncJson } from '@/lib/async-json-storage';

const SNAPSHOT_PREFIX = 'portfolio-report-snapshot';

function getSnapshotKey(userId: string): string {
  return `${SNAPSHOT_PREFIX}:${userId}`;
}

export function usePortfolioReportSnapshot(
  userId: string | null,
  report: PortfolioReportDto | null
): PortfolioReportDto | null {
  const [snapshot, setSnapshot] = useState<PortfolioReportDto | null>(null);

  useEffect(() => {
    if (!userId) {
      setSnapshot(null);
      return;
    }

    let cancelled = false;

    void readAsyncJson<PortfolioReportDto>(getSnapshotKey(userId))
      .then((cached) => {
        if (!cancelled) {
          setSnapshot(cached);
        }
      })
      .catch((error) => {
        console.error('Failed to load portfolio report snapshot:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !report) return;

    setSnapshot(report);
    void writeAsyncJson(getSnapshotKey(userId), report).catch((error) => {
      console.error('Failed to persist portfolio report snapshot:', error);
    });
  }, [report, userId]);

  return snapshot;
}
