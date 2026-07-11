import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForAbortableDelay } from './abortable-delay';

describe('waitForAbortableDelay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after the requested delay', async () => {
    vi.useFakeTimers();

    const delay = waitForAbortableDelay(100);
    await vi.advanceTimersByTimeAsync(100);

    await expect(delay).resolves.toBeUndefined();
  });

  it('rejects with AbortError when the signal is aborted', async () => {
    const controller = new AbortController();
    const delay = waitForAbortableDelay(100, controller.signal);

    controller.abort();

    await expect(delay).rejects.toMatchObject({ name: 'AbortError' });
  });
});
