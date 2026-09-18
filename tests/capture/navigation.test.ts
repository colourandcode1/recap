import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initNavigationCapture,
  pauseNavigationCapture,
  resumeNavigationCapture,
} from '../../src/capture/navigation.js';

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

  it('suppresses capture while paused, and resumes after resumeNavigationCapture', () => {
    const handler = vi.fn();
    const cleanup = initNavigationCapture(handler);
    handler.mockClear(); // drop the initial pageload event

    pauseNavigationCapture();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(handler).not.toHaveBeenCalled();

    resumeNavigationCapture();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(handler).toHaveBeenCalled();

    cleanup();
  });
});
