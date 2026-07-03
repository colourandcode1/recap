// Replay orchestrator — wires the scheduler to event application and visuals.
// Replays a recorded session on top of the live prototype: capture is fully
// suppressed for the duration so neither synthetic actions nor the
// facilitator's own input are recorded.

import type { AnyEvent, ClickEvent, NavigationEvent, ScrollEvent } from '../types.js';
import { suppressCapture, resumeCapture } from '../capture/suppress.js';
import { prepareTimeline, cursorPositionAt, type ReplayTimeline } from './import.js';
import {
  createScheduler,
  type Scheduler,
  type SchedulerOptions,
  type ReplaySpeed,
} from './scheduler.js';
import {
  initVisuals,
  destroyVisuals,
  moveCursor,
  hideCursor,
  showRipple,
  flashTarget,
  showBanner,
} from './visuals.js';

export interface ReplaySession {
  play(): void;
  pause(): void;
  seek(virtualMs: number): void;
  setSpeed(speed: ReplaySpeed): void;
  getSpeed(): ReplaySpeed;
  getTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  getWarnings(): string[];
  /** Subscribe to per-frame time updates (drives the controls UI). */
  onTick(cb: (virtualMs: number) => void): void;
  onEnd(cb: () => void): void;
  stop(): void;
}

let _active: ReplaySession | null = null;

export function isReplaying(): boolean {
  return _active !== null;
}

export function getActiveReplay(): ReplaySession | null {
  return _active;
}

export function stopReplay(): void {
  _active?.stop();
}

const VIEWPORT_WARN_RATIO = 0.1;

// --- Event application ---

function applyNavigation(e: NavigationEvent): void {
  if (e.method === 'pageload') {
    if (e.from !== '') showBanner('Participant reloaded the page');
    return;
  }
  if (location.pathname !== e.to) {
    // Capture is suppressed, so the (patched) pushState records nothing.
    history.pushState(null, '', e.to);
    // Synthetic popstate so the host SPA router re-renders (same pattern the
    // researcher panel uses for timeline navigation).
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  showBanner(`→ ${e.to}`);
}

function applyScroll(e: ScrollEvent): void {
  // Milestone events mean "the X% mark entered the viewport", not "scrollTop
  // was at X%" — sentinels visible at page load fire with zero scrolling.
  // Replaying them as scroll positions made the page jump; skip them.
  // (Legacy events without `source` keep the old behaviour.)
  if (e.source === 'milestone') return;
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  const scrollable = docHeight - window.innerHeight;
  if (scrollable <= 0) return;
  // Percent-based: self-corrects when the facilitator's page height differs.
  window.scrollTo({ top: (e.depth / 100) * scrollable, behavior: 'auto' });
}

function applyClick(e: ClickEvent): void {
  // Prefer re-anchoring to the live element via the recorded selector and
  // element-relative ratios — robust to viewport/layout differences.
  let el: Element | null = null;
  try {
    el = document.querySelector(e.selector);
  } catch {
    el = null;
  }

  if (el) {
    const rect = el.getBoundingClientRect();
    const pageX = window.scrollX + rect.left + e.elementX * rect.width;
    const pageY = window.scrollY + rect.top + e.elementY * rect.height;
    showRipple(pageX, pageY, true);
    flashTarget(el);
  } else {
    showRipple(e.pageX, e.pageY, false);
  }
}

// --- Orchestration ---

export function startReplay(events: AnyEvent[], schedulerOpts?: SchedulerOptions): ReplaySession {
  if (_active) _active.stop();

  const timeline: ReplayTimeline = prepareTimeline(events);
  if (timeline.events.length === 0) {
    throw new Error('Nothing to replay — the session has no events.');
  }

  const warnings = [...timeline.warnings];
  const pv = timeline.participantViewport;
  if (pv.width > 0 && Math.abs(window.innerWidth - pv.width) / pv.width > VIEWPORT_WARN_RATIO) {
    warnings.push(
      `Recorded at ${pv.width}×${pv.height} — you're at ${window.innerWidth}×${window.innerHeight}; positions may drift.`
    );
  }

  suppressCapture();
  initVisuals();
  // Sessions start at the top of the page; the facilitator may not be there.
  try {
    window.scrollTo({ top: 0, behavior: 'auto' });
  } catch {
    // jsdom and some embedded contexts don't implement scrollTo
  }

  const tickSubs: Array<(t: number) => void> = [];
  const endSubs: Array<() => void> = [];
  let stopped = false;

  const scheduler: Scheduler = createScheduler(timeline, {
    onEvent: (e) => {
      try {
        if (e.type === 'navigation') applyNavigation(e as NavigationEvent);
        else if (e.type === 'scroll') applyScroll(e as ScrollEvent);
        else if (e.type === 'click') applyClick(e as ClickEvent);
        // 'move' is driven per-frame in onTick; other types are skipped.
      } catch (err) {
        console.error('[Recap] Replay apply error:', err);
      }
    },
    onTick: (t) => {
      const pos = cursorPositionAt(timeline.flatMoves, t);
      if (pos) moveCursor(pos.x, pos.y);
      tickSubs.forEach((cb) => cb(t));
    },
    onSeek: (t, stateEvents) => {
      try {
        for (const e of stateEvents) {
          if (e.type === 'navigation') {
            const nav = e as NavigationEvent;
            if (nav.method !== 'pageload' && location.pathname !== nav.to) {
              history.pushState(null, '', nav.to);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          } else if (e.type === 'scroll') {
            applyScroll(e as ScrollEvent);
          }
        }
        const pos = cursorPositionAt(timeline.flatMoves, t);
        if (pos) moveCursor(pos.x, pos.y);
        else hideCursor();
      } catch (err) {
        console.error('[Recap] Replay seek error:', err);
      }
    },
    onEnd: () => {
      showBanner('Replay finished');
      endSubs.forEach((cb) => cb());
    },
  }, schedulerOpts);

  const session: ReplaySession = {
    play: () => scheduler.play(),
    pause: () => scheduler.pause(),
    seek: (t) => scheduler.seek(t),
    setSpeed: (s) => scheduler.setSpeed(s),
    getSpeed: () => scheduler.getSpeed(),
    getTime: () => scheduler.getTime(),
    getDuration: () => scheduler.getDuration(),
    isPlaying: () => scheduler.isPlaying(),
    getWarnings: () => [...warnings],
    onTick: (cb) => tickSubs.push(cb),
    onEnd: (cb) => endSubs.push(cb),
    stop: () => {
      if (stopped) return;
      stopped = true;
      scheduler.destroy();
      destroyVisuals();
      resumeCapture();
      if (_active === session) _active = null;
    },
  };

  _active = session;
  return session;
}
