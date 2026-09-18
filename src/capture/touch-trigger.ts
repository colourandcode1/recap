// Touch-hold gesture that toggles the researcher panel on touch devices,
// where the Alt+Shift+R keyboard shortcut is unavailable (e.g. an in-person
// mobile usability test). Deliberately requires several simultaneous,
// near-stationary touch points so ordinary single/two-finger tapping and
// scrolling can never trigger it by accident.

export interface TouchTriggerOptions {
  /** Number of simultaneous touch points required. */
  fingerCount: number;
  /** Milliseconds the touch points must be held ~stationary before firing. */
  holdMs: number;
  /** Max px of movement per touch point allowed before the hold is cancelled. */
  moveTolerancePx: number;
}

export const DEFAULT_TOUCH_TRIGGER_OPTIONS: TouchTriggerOptions = {
  fingerCount: 3,
  holdMs: 1500,
  moveTolerancePx: 24,
};

interface Point {
  x: number;
  y: number;
}

/**
 * Registers a document-level touch listener that fires `onTrigger()` once
 * when exactly `fingerCount` touches are held ~stationary for `holdMs`.
 * Returns a cleanup function that removes all listeners.
 */
export function initTouchTrigger(
  onTrigger: () => void,
  options: Partial<TouchTriggerOptions> = {}
): () => void {
  const opts: TouchTriggerOptions = { ...DEFAULT_TOUCH_TRIGGER_OPTIONS, ...options };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startPoints: Point[] = [];

  function clear(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    startPoints = [];
  }

  function onTouchStart(e: TouchEvent): void {
    clear();
    if (e.touches.length !== opts.fingerCount) return;
    startPoints = Array.from(e.touches).map((t) => ({ x: t.clientX, y: t.clientY }));
    timer = setTimeout(() => {
      onTrigger();
      clear();
    }, opts.holdMs);
  }

  function onTouchMove(e: TouchEvent): void {
    if (timer === null) return;
    if (e.touches.length !== opts.fingerCount) {
      clear();
      return;
    }
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]!;
      const start = startPoints[i];
      if (!start) continue;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.sqrt(dx * dx + dy * dy) > opts.moveTolerancePx) {
        clear();
        return;
      }
    }
  }

  function onTouchEndOrCancel(): void {
    clear();
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEndOrCancel, { passive: true });
  document.addEventListener('touchcancel', onTouchEndOrCancel, { passive: true });

  return () => {
    clear();
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEndOrCancel);
    document.removeEventListener('touchcancel', onTouchEndOrCancel);
  };
}
