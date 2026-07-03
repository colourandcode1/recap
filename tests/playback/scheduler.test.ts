import { describe, it, expect, beforeEach } from 'vitest';
import type { AnyEvent } from '../../src/types.js';
import { createScheduler, type Scheduler, type SchedulerHandlers } from '../../src/playback/scheduler.js';
import { prepareTimeline } from '../../src/playback/import.js';

function ev(type: AnyEvent['type'], timestamp: number, extra: object = {}): AnyEvent {
  return {
    sessionId: 's1',
    timestamp,
    type,
    url: '/',
    viewport: { width: 1280, height: 800 },
    ...extra,
  } as AnyEvent;
}

/** Deterministic fake clock + rAF: each pump() advances time and runs one frame. */
function fakeTiming(): {
  now: () => number;
  raf: (cb: FrameRequestCallback) => number;
  caf: (id: number) => void;
  pump: (ms: number) => void;
} {
  let time = 0;
  let pending: FrameRequestCallback | null = null;
  return {
    now: () => time,
    raf: (cb) => {
      pending = cb;
      return 1;
    },
    caf: () => {
      pending = null;
    },
    pump: (ms) => {
      time += ms;
      const cb = pending;
      pending = null;
      if (cb) cb(time);
    },
  };
}

describe('replay scheduler', () => {
  let fired: string[];
  let ticks: number[];
  let seeks: Array<{ t: number; state: string[] }>;
  let ended: boolean;
  let handlers: SchedulerHandlers;

  const timeline = prepareTimeline([
    ev('navigation', 0, { from: '', to: '/', method: 'pageload' }),
    ev('click', 500, { pageX: 1, pageY: 1, clientX: 1, clientY: 1, elementX: 0, elementY: 0, selector: 'a', tagName: 'A', label: null, nearestHeading: null, pageRegion: 'center' }),
    ev('scroll', 1000, { depth: 50, maxDepth: 50 }),
    ev('navigation', 1500, { from: '/', to: '/reports', method: 'pushState' }),
    ev('scroll', 2000, { depth: 20, maxDepth: 20 }),
  ]);

  beforeEach(() => {
    fired = [];
    ticks = [];
    seeks = [];
    ended = false;
    handlers = {
      onEvent: (e) => fired.push(`${e.type}@${e.relativeTs}`),
      onTick: (t) => ticks.push(t),
      onSeek: (t, state) => seeks.push({ t, state: state.map((s) => s.type) }),
      onEnd: () => {
        ended = true;
      },
    };
  });

  it('fires events in order exactly once as virtual time passes', () => {
    const timing = fakeTiming();
    const s = createScheduler(timeline, handlers, timing);
    s.play();
    timing.pump(600);
    expect(fired).toEqual(['navigation@0', 'click@500']);
    timing.pump(600); // t=1200
    expect(fired).toEqual(['navigation@0', 'click@500', 'scroll@1000']);
    timing.pump(1000); // t=2200 ≥ duration 2000
    expect(fired).toEqual([
      'navigation@0',
      'click@500',
      'scroll@1000',
      'navigation@1500',
      'scroll@2000',
    ]);
    expect(ended).toBe(true);
    expect(s.isPlaying()).toBe(false);
    s.destroy();
  });

  it('pause stops the virtual clock', () => {
    const timing = fakeTiming();
    const s = createScheduler(timeline, handlers, timing);
    s.play();
    timing.pump(600);
    s.pause();
    const at = s.getTime();
    timing.pump(5000); // no frame scheduled — time should not advance
    expect(s.getTime()).toBe(at);
    expect(fired).toEqual(['navigation@0', 'click@500']);
    s.destroy();
  });

  it('speed multiplies virtual time', () => {
    const timing = fakeTiming();
    const s = createScheduler(timeline, handlers, timing);
    s.setSpeed(4);
    s.play();
    timing.pump(300); // 300ms real = 1200ms virtual
    expect(s.getTime()).toBe(1200);
    expect(fired).toEqual(['navigation@0', 'click@500', 'scroll@1000']);
    s.destroy();
  });

  it('seek hands back state events and does not replay skipped events', () => {
    const timing = fakeTiming();
    const s = createScheduler(timeline, handlers, timing);
    s.seek(1700);
    expect(seeks).toHaveLength(1);
    // last nav at 1500 wins; the scroll at 1000 belongs to the previous page
    expect(seeks[0]!.state).toEqual(['navigation']);
    expect(fired).toEqual([]); // nothing replayed on seek

    s.play();
    timing.pump(400); // t=2100 → only the final scroll fires
    expect(fired).toEqual(['scroll@2000']);
    s.destroy();
  });

  it('seek before a navigation includes the preceding scroll', () => {
    const timing = fakeTiming();
    const s = createScheduler(timeline, handlers, timing);
    s.seek(1200);
    expect(seeks[0]!.state).toEqual(['navigation', 'scroll']);
    s.destroy();
  });

  it('seek clamps to [0, duration]', () => {
    const timing = fakeTiming();
    const s = createScheduler(timeline, handlers, timing);
    s.seek(-500);
    expect(s.getTime()).toBe(0);
    s.seek(99999);
    expect(s.getTime()).toBe(2000);
    s.destroy();
  });

  it('play at the end restarts from zero', () => {
    const timing = fakeTiming();
    const s = createScheduler(timeline, handlers, timing);
    s.play();
    timing.pump(2500);
    expect(ended).toBe(true);
    fired = [];
    s.play();
    timing.pump(100);
    expect(fired).toEqual(['navigation@0']);
    expect(s.isPlaying()).toBe(true);
    s.destroy();
  });

  it('destroy cancels the pending frame', () => {
    const timing = fakeTiming();
    const s = createScheduler(timeline, handlers, timing);
    s.play();
    s.destroy();
    timing.pump(3000);
    expect(fired).toEqual([]);
    expect(ended).toBe(false);
  });

  it('onTick reports current virtual time each frame', () => {
    const timing = fakeTiming();
    const s = createScheduler(timeline, handlers, timing);
    s.play();
    timing.pump(100);
    timing.pump(100);
    expect(ticks).toEqual([100, 200]);
    s.destroy();
  });
});
