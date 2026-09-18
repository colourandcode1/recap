import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTouchTrigger } from '../../src/capture/touch-trigger.js';

function touchEvent(type: string, points: { x: number; y: number }[]): Event {
  const e = new Event(type, { bubbles: true });
  Object.defineProperty(e, 'touches', {
    value: points.map((p) => ({ clientX: p.x, clientY: p.y })),
  });
  return e;
}

describe('touch trigger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onTrigger once after holdMs with the configured finger count held stationary', () => {
    const onTrigger = vi.fn();
    const cleanup = initTouchTrigger(onTrigger, { fingerCount: 3, holdMs: 1500 });

    document.dispatchEvent(
      touchEvent('touchstart', [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 30, y: 60 },
      ])
    );
    vi.advanceTimersByTime(1499);
    expect(onTrigger).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onTrigger).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('does not fire with fewer touches than fingerCount', () => {
    const onTrigger = vi.fn();
    const cleanup = initTouchTrigger(onTrigger, { fingerCount: 3, holdMs: 1500 });

    document.dispatchEvent(touchEvent('touchstart', [{ x: 10, y: 10 }, { x: 50, y: 10 }]));
    vi.advanceTimersByTime(2000);

    expect(onTrigger).not.toHaveBeenCalled();
    cleanup();
  });

  it('does not fire with more touches than fingerCount', () => {
    const onTrigger = vi.fn();
    const cleanup = initTouchTrigger(onTrigger, { fingerCount: 3, holdMs: 1500 });

    document.dispatchEvent(
      touchEvent('touchstart', [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 30, y: 60 },
        { x: 80, y: 40 },
      ])
    );
    vi.advanceTimersByTime(2000);

    expect(onTrigger).not.toHaveBeenCalled();
    cleanup();
  });

  it('cancels the hold if a touch moves beyond moveTolerancePx', () => {
    const onTrigger = vi.fn();
    const cleanup = initTouchTrigger(onTrigger, {
      fingerCount: 3,
      holdMs: 1500,
      moveTolerancePx: 24,
    });

    document.dispatchEvent(
      touchEvent('touchstart', [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 30, y: 60 },
      ])
    );
    vi.advanceTimersByTime(500);

    document.dispatchEvent(
      touchEvent('touchmove', [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 30, y: 100 }, // moved 40px, beyond the 24px tolerance
      ])
    );
    vi.advanceTimersByTime(1000);

    expect(onTrigger).not.toHaveBeenCalled();
    cleanup();
  });

  it('does not cancel the hold for movement within moveTolerancePx', () => {
    const onTrigger = vi.fn();
    const cleanup = initTouchTrigger(onTrigger, {
      fingerCount: 3,
      holdMs: 1500,
      moveTolerancePx: 24,
    });

    document.dispatchEvent(
      touchEvent('touchstart', [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 30, y: 60 },
      ])
    );
    vi.advanceTimersByTime(500);

    document.dispatchEvent(
      touchEvent('touchmove', [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 30, y: 70 }, // moved 10px, within tolerance
      ])
    );
    vi.advanceTimersByTime(1000);

    expect(onTrigger).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('cancels the hold on touchend before holdMs elapses', () => {
    const onTrigger = vi.fn();
    const cleanup = initTouchTrigger(onTrigger, { fingerCount: 3, holdMs: 1500 });

    document.dispatchEvent(
      touchEvent('touchstart', [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 30, y: 60 },
      ])
    );
    vi.advanceTimersByTime(500);
    document.dispatchEvent(touchEvent('touchend', []));
    vi.advanceTimersByTime(1000);

    expect(onTrigger).not.toHaveBeenCalled();
    cleanup();
  });

  it('cancels the hold on touchcancel before holdMs elapses', () => {
    const onTrigger = vi.fn();
    const cleanup = initTouchTrigger(onTrigger, { fingerCount: 3, holdMs: 1500 });

    document.dispatchEvent(
      touchEvent('touchstart', [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 30, y: 60 },
      ])
    );
    vi.advanceTimersByTime(500);
    document.dispatchEvent(touchEvent('touchcancel', []));
    vi.advanceTimersByTime(1000);

    expect(onTrigger).not.toHaveBeenCalled();
    cleanup();
  });

  it('cleanup stops a pending timer and removes listeners', () => {
    const onTrigger = vi.fn();
    const cleanup = initTouchTrigger(onTrigger, { fingerCount: 3, holdMs: 1500 });

    document.dispatchEvent(
      touchEvent('touchstart', [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 30, y: 60 },
      ])
    );
    cleanup();
    vi.advanceTimersByTime(2000);

    expect(onTrigger).not.toHaveBeenCalled();

    // A new touch sequence after cleanup should not trigger either
    document.dispatchEvent(
      touchEvent('touchstart', [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 30, y: 60 },
      ])
    );
    vi.advanceTimersByTime(2000);
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('respects a custom fingerCount and holdMs', () => {
    const onTrigger = vi.fn();
    const cleanup = initTouchTrigger(onTrigger, { fingerCount: 2, holdMs: 500 });

    document.dispatchEvent(touchEvent('touchstart', [{ x: 10, y: 10 }, { x: 50, y: 10 }]));
    vi.advanceTimersByTime(499);
    expect(onTrigger).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onTrigger).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
