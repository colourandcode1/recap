import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MoveEvent } from '../../src/types.js';
import { initMoveCapture, flushMoveBatch } from '../../src/capture/moves.js';
import { suppressCapture, resumeCapture, isCaptureSuppressed } from '../../src/capture/suppress.js';

function fireMove(x: number, y: number, target?: Element): void {
  const e = new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y });
  // jsdom doesn't set pageX/pageY from clientX/Y — define them explicitly
  Object.defineProperty(e, 'pageX', { value: x });
  Object.defineProperty(e, 'pageY', { value: y });
  (target ?? document.body).dispatchEvent(e);
}

describe('move capture', () => {
  let cleanup: (() => void) | null = null;
  let events: MoveEvent[];

  beforeEach(() => {
    // getTimestamp() uses performance.now() — must be faked alongside timers
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
    });
    document.body.innerHTML = '';
    events = [];
    resumeCapture();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    vi.useRealTimers();
  });

  it('samples points at most every 100ms', () => {
    cleanup = initMoveCapture((e) => events.push(e));
    fireMove(10, 10);
    fireMove(20, 20); // within 100ms — dropped
    vi.advanceTimersByTime(150);
    fireMove(30, 30);
    flushMoveBatch();
    expect(events).toHaveLength(1);
    expect(events[0]!.points).toHaveLength(2);
    expect(events[0]!.points.map((p) => p.x)).toEqual([10, 30]);
  });

  it('closes the batch after 500ms idle', () => {
    cleanup = initMoveCapture((e) => events.push(e));
    fireMove(10, 10);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(600);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('move');
  });

  it('closes the batch at 20 points', () => {
    cleanup = initMoveCapture((e) => events.push(e));
    for (let i = 0; i < 20; i++) {
      fireMove(i, i);
      vi.advanceTimersByTime(101);
    }
    expect(events).toHaveLength(1);
    expect(events[0]!.points).toHaveLength(20);
  });

  it('point offsets are relative to the batch start timestamp', () => {
    cleanup = initMoveCapture((e) => events.push(e));
    fireMove(1, 1);
    vi.advanceTimersByTime(150);
    fireMove(2, 2);
    flushMoveBatch();
    expect(events[0]!.points[0]!.t).toBe(0);
    expect(events[0]!.points[1]!.t).toBeGreaterThanOrEqual(100);
  });

  it('skips movement over excluded elements', () => {
    const blocked = document.createElement('div');
    blocked.className = 'ut-block';
    document.body.appendChild(blocked);
    cleanup = initMoveCapture((e) => events.push(e));
    fireMove(10, 10, blocked);
    flushMoveBatch();
    expect(events).toHaveLength(0);
  });

  it('records nothing while capture is suppressed', () => {
    cleanup = initMoveCapture((e) => events.push(e));
    suppressCapture();
    fireMove(10, 10);
    vi.advanceTimersByTime(600);
    expect(events).toHaveLength(0);
    resumeCapture();
    fireMove(20, 20);
    flushMoveBatch();
    expect(events).toHaveLength(1);
  });

  it('cleanup flushes the pending batch', () => {
    cleanup = initMoveCapture((e) => events.push(e));
    fireMove(10, 10);
    cleanup();
    cleanup = null;
    expect(events).toHaveLength(1);
  });
});

describe('suppression guard', () => {
  afterEach(() => resumeCapture());

  it('toggles the global flag', () => {
    expect(isCaptureSuppressed()).toBe(false);
    suppressCapture();
    expect(isCaptureSuppressed()).toBe(true);
    resumeCapture();
    expect(isCaptureSuppressed()).toBe(false);
  });
});
