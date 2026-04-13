// In-memory event buffer with auto-flush logic.

import type { AnyEvent } from '../types.js';

type FlushTarget = (events: AnyEvent[]) => Promise<void>;

const BUFFER_MAX = 50;
const FLUSH_INTERVAL_MS = 10_000;

let _buffer: AnyEvent[] = [];
let _flushTarget: FlushTarget | null = null;
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _isFlushing = false;

export function push(event: AnyEvent): void {
  _buffer.push(event);
  if (_buffer.length >= BUFFER_MAX) {
    void flush();
  }
}

export async function flush(): Promise<void> {
  if (_isFlushing || _buffer.length === 0 || !_flushTarget) return;
  _isFlushing = true;
  const batch = _buffer.splice(0, _buffer.length);
  try {
    await _flushTarget(batch);
  } catch (err) {
    // Put events back on failure (prepend so order is maintained)
    _buffer.unshift(...batch);
    console.error('[Recap] Buffer flush error:', err);
  } finally {
    _isFlushing = false;
  }
}

export function initBuffer(target: FlushTarget): () => void {
  _flushTarget = target;
  _buffer = [];

  _flushTimer = setInterval(() => {
    void flush();
  }, FLUSH_INTERVAL_MS);

  // Flush on page hide
  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      void flush();
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    if (_flushTimer !== null) {
      clearInterval(_flushTimer);
      _flushTimer = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    _flushTarget = null;
  };
}

/** Get all buffered events without clearing the buffer (for export). */
export function getBuffer(): AnyEvent[] {
  return [..._buffer];
}

/** Clear the buffer (e.g. after a clear-session action). */
export function clearBuffer(): void {
  _buffer = [];
}
