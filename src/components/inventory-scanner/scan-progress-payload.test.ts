import { describe, expect, it } from 'vitest';
import { parseScanRealtimeProgress } from './scan-progress-payload';

describe('parseScanRealtimeProgress', () => {
  it('normalizes valid realtime progress payloads', () => {
    const progress = parseScanRealtimeProgress({
      type: 'scan.progress',
      status: 'running',
      message: 'Pricing items',
      percent: 42,
      detail: {
        priced: 10,
        total: 20,
        ignored: true,
      },
      updatedAt: '2026-07-11T02:00:00.000Z',
    });

    expect(progress).toEqual({
      status: 'running',
      stage: 'running',
      message: 'Pricing items',
      percent: 42,
      detail: {
        priced: 10,
        total: 20,
      },
      error: undefined,
      updatedAt: '2026-07-11T02:00:00.000Z',
    });
  });

  it('preserves explicit stage and error values', () => {
    const progress = parseScanRealtimeProgress({
      type: 'scan.progress',
      status: 'error',
      stage: 'fetchInventory',
      message: 'Cannot scan inventory',
      percent: 100,
      error: 'privateInventoryNoCookie',
    });

    expect(progress).toMatchObject({
      status: 'error',
      stage: 'fetchInventory',
      message: 'Cannot scan inventory',
      percent: 100,
      error: 'privateInventoryNoCookie',
    });
  });

  it('rejects malformed payloads', () => {
    expect(parseScanRealtimeProgress(null)).toBeNull();
    expect(parseScanRealtimeProgress([])).toBeNull();
    expect(parseScanRealtimeProgress({ type: 'other' })).toBeNull();
    expect(
      parseScanRealtimeProgress({
        type: 'scan.progress',
        status: 'done',
        message: 'Done',
        percent: '100',
      })
    ).toBeNull();
  });
});
