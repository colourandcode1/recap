// Replay scheduler — a virtual clock driven by rAF, seekable, speed-adjustable.
// Pure logic: no DOM access; timing sources are injected so jsdom tests can
// drive it deterministically.

import type { AnyEvent } from '../types.js';
import type { ReplayTimeline, TimelineEvent } from './import.js';

export type ReplaySpeed = 1 | 2 | 4;

export interface SchedulerHandlers {
  /** Fired in order as virtual time passes each event's relativeTs. */
  onEvent: (event: TimelineEvent) => void;
  /** Fired every frame with the current virtual time (drives cursor + controls UI). */
  onTick: (virtualMs: number) => void;
  /**
   * Fired on seek with the state-bearing events at/before the target
   * (most recent navigation and most recent scroll), so the orchestrator can
   * rebuild page + scroll position without replaying everything in between.
   */
  onSeek: (virtualMs: number, stateEvents: AnyEvent[]) => void;
  onEnd: () => void;
}

export interface SchedulerOptions {
  now?: () => number;
  raf?: (cb: FrameRequestCallback) => number;
  caf?: (id: number) => void;
}

export interface Scheduler {
  play(): void;
  pause(): void;
  seek(virtualMs: number): void;
  setSpeed(speed: ReplaySpeed): void;
  getSpeed(): ReplaySpeed;
  getTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  destroy(): void;
}

export function createScheduler(
  timeline: ReplayTimeline,
  handlers: SchedulerHandlers,
  opts: SchedulerOptions = {}
): Scheduler {
  const now = opts.now ?? (() => performance.now());
  const raf = opts.raf ?? ((cb: FrameRequestCallback) => requestAnimationFrame(cb));
  const caf = opts.caf ?? ((id: number) => cancelAnimationFrame(id));

  const events = timeline.events; // sorted by relativeTs
  const duration = timeline.duration;

  let virtual = 0; // current virtual ms
  let cursor = 0; // index of the next event to fire
  let speed: ReplaySpeed = 1;
  let playing = false;
  let destroyed = false;
  let rafId: number | null = null;
  let lastNow = 0;

  function fireDue(upTo: number): void {
    while (cursor < events.length && events[cursor]!.relativeTs <= upTo) {
      handlers.onEvent(events[cursor]!);
      cursor++;
    }
  }

  function frame(): void {
    if (!playing || destroyed) return;
    const t = now();
    virtual += (t - lastNow) * speed;
    lastNow = t;

    if (virtual >= duration) {
      virtual = duration;
      fireDue(virtual);
      handlers.onTick(virtual);
      playing = false;
      rafId = null;
      handlers.onEnd();
      return;
    }

    fireDue(virtual);
    handlers.onTick(virtual);
    rafId = raf(frame);
  }

  /** Most recent navigation + most recent scroll at/before the target time. */
  function stateEventsAt(virtualMs: number): AnyEvent[] {
    let lastNav: AnyEvent | null = null;
    let lastScroll: AnyEvent | null = null;
    for (const e of events) {
      if (e.relativeTs > virtualMs) break;
      if (e.type === 'navigation') {
        lastNav = e;
        lastScroll = null; // scroll position resets on navigation
      } else if (e.type === 'scroll') {
        lastScroll = e;
      }
    }
    const state: AnyEvent[] = [];
    if (lastNav) state.push(lastNav);
    if (lastScroll) state.push(lastScroll);
    return state;
  }

  return {
    play(): void {
      if (destroyed || playing) return;
      if (virtual >= duration) {
        // Replay from the start when play is hit at the end
        virtual = 0;
        cursor = 0;
      }
      playing = true;
      lastNow = now();
      rafId = raf(frame);
    },

    pause(): void {
      playing = false;
      if (rafId !== null) {
        caf(rafId);
        rafId = null;
      }
    },

    seek(virtualMs: number): void {
      if (destroyed) return;
      const target = Math.max(0, Math.min(duration, virtualMs));
      virtual = target;
      // Reset the cursor to the first event after the target: events at/before
      // it are represented by onSeek's state events, not replayed.
      cursor = 0;
      while (cursor < events.length && events[cursor]!.relativeTs <= target) cursor++;
      handlers.onSeek(target, stateEventsAt(target));
      handlers.onTick(target);
      lastNow = now();
    },

    setSpeed(next: ReplaySpeed): void {
      speed = next;
    },

    getSpeed(): ReplaySpeed {
      return speed;
    },

    getTime(): number {
      return virtual;
    },

    getDuration(): number {
      return duration;
    },

    isPlaying(): boolean {
      return playing;
    },

    destroy(): void {
      destroyed = true;
      playing = false;
      if (rafId !== null) {
        caf(rafId);
        rafId = null;
      }
    },
  };
}
