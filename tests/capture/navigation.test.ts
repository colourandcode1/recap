import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initNavigationCapture } from '../../src/capture/navigation.js';

describe('navigation capture', () => {
  beforeEach(() => {
    // Reset location-ish state
    vi.stubGlobal('location', {
      href: 'http://localhost/',
      pathname: '/',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes and returns cleanup', () => {
    const handler = vi.fn();
    const cleanup = initNavigationCapture(handler);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('emits a pageload event on init', () => {
    const handler = vi.fn();
    const cleanup = initNavigationCapture(handler);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'navigation',
        method: 'pageload',
      })
    );
    cleanup();
  });

  it('restores history methods on cleanup', () => {
    const originalPush = history.pushState;
    const handler = vi.fn();
    const cleanup = initNavigationCapture(handler);
    cleanup();
    expect(history.pushState).toBe(originalPush);
  });
});
