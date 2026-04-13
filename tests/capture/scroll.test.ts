import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initScrollCapture, getMaxScrollDepth, resetScrollState } from '../../src/capture/scroll.js';

describe('scroll capture', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetScrollState();
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
});
