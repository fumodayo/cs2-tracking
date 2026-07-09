import { useState } from 'react';

import { usePatternInspect } from '@/components/inventory-scanner/hooks/use-pattern-inspect';
import type { PortfolioTableRow } from '../portfolio-table-model';

type ItemPatternInfo = NonNullable<PortfolioTableRow['patternInfo']>;

type UpdatePatternLot = (
  id: string,
  payload: {
    dopplerPhase?: string;
    patternInfo?: PortfolioTableRow['patternInfo'];
    inspectLink?: string;
  }
) => Promise<void> | void;

export function useItemPatternInspectControls({
  item,
  onUpdateLot,
}: {
  item: PortfolioTableRow;
  onUpdateLot?: UpdatePatternLot;
}) {
  const { inspectingKeys, inspectPattern } = usePatternInspect();
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [manualInspectLink, setManualInspectLink] = useState('');
  const [isFindingLink, setIsFindingLink] = useState(false);
  const [findStatus, setFindStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const isInspecting = inspectingKeys.has(item.case.marketHashName);

  async function applyPatternInspectResult(patternInfo: ItemPatternInfo, inspectLink?: string) {
    const updatePayload = {
      dopplerPhase: patternInfo.dopplerPhase || item.dopplerPhase,
      patternInfo,
      ...(inspectLink ? { inspectLink } : {}),
    };

    if (item.itemIds && item.itemIds.length > 0) {
      for (const id of item.itemIds) {
        await onUpdateLot?.(id, updatePayload);
      }
    } else {
      await onUpdateLot?.(item.id, updatePayload);
    }
  }

  const handleInspect = async () => {
    if (!item.inspectLink) return;
    setInspectError(null);
    const result = await inspectPattern(
      item.inspectLink,
      item.case.marketHashName,
      item.dopplerPhase
    );
    if (result.success && result.data?.patternInfo) {
      await applyPatternInspectResult(result.data.patternInfo);
    } else {
      setInspectError(result.error || 'failedToInspectFromCSFloat');
    }
  };

  const handleManualInspect = async () => {
    const inspectLink = manualInspectLink.trim();
    if (!inspectLink) return;
    setInspectError(null);
    const result = await inspectPattern(inspectLink, item.case.marketHashName, item.dopplerPhase);
    if (result.success && result.data?.patternInfo) {
      await applyPatternInspectResult(result.data.patternInfo, inspectLink);
    } else {
      setInspectError(result.error || 'failedToInspectFromCSFloat');
    }
  };

  const handleAutoFind = async () => {
    setIsFindingLink(true);
    setFindStatus('idle');
    setInspectError(null);
    try {
      const response = await fetch(
        `/api/portfolio/find-inspect-link?marketHashName=${encodeURIComponent(
          item.case.marketHashName
        )}`
      );
      if (!response.ok) throw new Error('failedToFind');
      const data = await response.json();
      if (data.inspectLink) {
        setFindStatus('success');
        setManualInspectLink(data.inspectLink);

        const scanResult = await inspectPattern(
          data.inspectLink,
          item.case.marketHashName,
          item.dopplerPhase
        );
        if (scanResult.success && scanResult.data?.patternInfo) {
          await applyPatternInspectResult(scanResult.data.patternInfo, data.inspectLink);
        } else {
          setInspectError(scanResult.error || 'failedToInspectFromCSFloat');
          setFindStatus('error');
        }
      } else {
        setFindStatus('error');
      }
    } catch {
      setFindStatus('error');
    } finally {
      setIsFindingLink(false);
    }
  };

  return {
    isInspecting,
    inspectError,
    manualInspectLink,
    setManualInspectLink,
    handleInspect,
    handleManualInspect,
    handleAutoFind,
    isFindingLink,
    findStatus,
  };
}
