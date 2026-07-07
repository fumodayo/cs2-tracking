import { useState } from 'react';
import type { PatternInfo } from '@/domain/pattern-info';

export type InspectPatternResult = {
  patternInfo: PatternInfo;
  overpay: {
    estimatedMin: number;
    estimatedMax: number;
    estimatedTypical: number;
    multiplierSource: string;
  } | null;
};

export function usePatternInspect() {
  const [inspectingKeys, setInspectingKeys] = useState<Set<string>>(new Set());
  const [patternResults, setPatternResults] = useState<Record<string, InspectPatternResult>>({});

  const inspectPattern = async (
    inspectLink: string,
    marketHashName: string,
    dopplerPhase?: string
  ): Promise<{ success: boolean; data?: InspectPatternResult; error?: string }> => {
    setInspectingKeys((prev) => {
      const next = new Set(prev);
      next.add(marketHashName);
      return next;
    });

    try {
      const res = await fetch('/api/inventory/inspect-pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectLink, marketHashName, dopplerPhase }),
      });

      if (!res.ok) {
        let errMsg = 'failedToInspectFromCSFloat';
        try {
          const errData = await res.json();
          if (errData && errData.message) {
            errMsg = errData.message;
          }
        } catch {
          /* ignore invalid error payload */
        }
        return { success: false, error: errMsg };
      }

      const data = (await res.json()) as {
        source: string;
        patternInfo: PatternInfo;
        overpay: InspectPatternResult['overpay'];
      };

      const result = {
        patternInfo: data.patternInfo,
        overpay: data.overpay,
      };

      setPatternResults((prev) => ({
        ...prev,
        [marketHashName]: result,
      }));

      return { success: true, data: result };
    } catch (err) {
      console.error('Error inspecting pattern:', err);
      return { success: false, error: 'unknownError' };
    } finally {
      setInspectingKeys((prev) => {
        const next = new Set(prev);
        next.delete(marketHashName);
        return next;
      });
    }
  };

  return { inspectingKeys, patternResults, inspectPattern };
}
