import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initScrollCapture,
  getMaxScrollDepth,
  resetScrollState,
  pauseScrollCapture,
  resumeScrollCapture,
} from '../../src/capture/scroll.js';

describe('scroll capture', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetScrollState();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes and returns a cleanup function', () => {
    const handler = vi.fn();
    const cleanup = initScrollCapture(handler);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('cleanup removes sentinels from DOM', () => {
    const handler = vi.fn();
    const cleanup = initScrollCapture(handler);
    const sentinelsBefore = document.querySelectorAll('[data-recap-sentinel]').length;
    expect(sentinelsBefore).toBe(4);
    cleanup();
    const sentinelsAfter = document.querySelectorAll('[data-recap-sentinel]').length;
    expect(sentinelsAfter).toBe(0);
  });

  it('getMaxScrollDepth returns 0 initially', () => {
    expect(getMaxScrollDepth()).toBe(0);
  });

  it('sentinels have correct percentage values', () => {
    const handler = vi.fn();
    const cleanup = initScrollCapture(handler);
    const sentinels = document.querySelectorAll('[data-recap-sentinel]');
    const pcts = Array.from(sentinels).map((s) =>
      Number(s.getAttribute('data-recap-sentinel'))
    );
    expect(pcts).toEqual(expect.arrayContaining([25, 50, 75, 100]));
    cleanup();
  });

  it('suppresses capture while paused, and resumes after resumeScrollCapture', () => {
    // Mirror real rAF's async ordering: `raf` is only invoked once we call it
    // ourselves, after onScroll's synchronous `ticking = true` has already run.
    // A rAF stub that calls back synchronously would run the callback (which
    // sets `ticking = false`) before that assignment, getting overwritten back
    // to `true` and permanently wedging the tracker after the first scroll.
    let raf: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      raf = cb;
      return 0;
    });
    const handler = vi.fn();
    const cleanup = initScrollCapture(handler);

    pauseScrollCapture();
    window.dispatchEvent(new Event('scroll'));
    raf?.(0);
    expect(handler).not.toHaveBeenCalled();

    resumeScrollCapture();
    window.dispatchEvent(new Event('scroll'));
    raf?.(0);
    expect(handler).toHaveBeenCalled();

    cleanup();
  });
});
