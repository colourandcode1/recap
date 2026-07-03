// Cursor-trail capture — sampled mousemove positions batched into polyline events.
// Coordinates only (pageX/pageY); no selectors, labels, or element content.

import type { MoveEvent, MovePoint } from '../types.js';
import { getSessionId, getTimestamp, getWallTime } from './session.js';
import { sanitizeUrl, isExcluded } from '../privacy/sanitize.js';
import { isCaptureSuppressed } from './suppress.js';

type MoveHandler = (event: MoveEvent) => void;

const SAMPLE_INTERVAL_MS = 100; // min gap between sampled points
const MAX_POINTS_PER_BATCH = 20;
const MAX_BATCH_AGE_MS = 2000; // close batch after 2s of movement
const IDLE_TIMEOUT_MS = 500; // close batch when the pointer goes quiet

let _handler: MoveHandler | null = null;
let _stripQuery = true;

// Current batch state
let _batchStart = 0; // timestamp of the first point (event timestamp)
let _batchWallTime = 0;
let _batchUrl = '';
let _points: MovePoint[] = [];
// -Infinity so the very first mousemove always passes the sampling gate
// (performance.now() can legitimately be ~0 at page load)
let _lastSampleAt = -Infinity;
let _idleTimer: ReturnType<typeof setTimeout> | null = null;

function clearIdleTimer(): void {
  if (_idleTimer !== null) {
    clearTimeout(_idleTimer);
    _idleTimer = null;
  }
}

/** Emit the current batch (if any) as a MoveEvent and reset state. */
export function flushMoveBatch(): void {
  clearIdleTimer();
  if (!_handler || _points.length === 0) return;

  const event: MoveEvent = {
    sessionId: getSessionId(),
    timestamp: _batchStart,
    wallTime: _batchWallTime,
    type: 'move',
    url: _batchUrl,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    points: _points,
  };
  _points = [];

  try {
    _handler(event);
  } catch (err) {
    console.error('[Recap] Move event error:', err);
  }
}

function onMouseMove(e: MouseEvent): void {
  try {
    if (!_handler || isCaptureSuppressed()) return;

    const now = getTimestamp();
    if (now - _lastSampleAt < SAMPLE_INTERVAL_MS) return; // sampling gate

    // Privacy: skip movement over excluded elements (.ut-block / data-ut-no-track)
    const target = e.target as Element | null;
    if (target && isExcluded(target)) return;

    _lastSampleAt = now;

    if (_points.length === 0) {
      _batchStart = now;
      _batchWallTime = getWallTime();
      _batchUrl = sanitizeUrl(location.href, _stripQuery);
    }

    _points.push({ t: Math.round(now - _batchStart), x: e.pageX, y: e.pageY });

    clearIdleTimer();
    if (_points.length >= MAX_POINTS_PER_BATCH || now - _batchStart >= MAX_BATCH_AGE_MS) {
      flushMoveBatch();
    } else {
      _idleTimer = setTimeout(flushMoveBatch, IDLE_TIMEOUT_MS);
    }
  } catch (err) {
    console.error('[Recap] Move capture error:', err);
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') flushMoveBatch();
}

export function initMoveCapture(handler: MoveHandler, stripQuery = true): () => void {
  _handler = handler;
  _stripQuery = stripQuery;
  _points = [];
  _lastSampleAt = -Infinity;

  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    flushMoveBatch();
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    _handler = null;
    _points = [];
  };
}
