import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnyEvent } from '../../src/types.js';
import { startReplay, stopReplay, isReplaying, getActiveReplay } from '../../src/playback/replay.js';
import { isCaptureSuppressed, resumeCapture } from '../../src/capture/suppress.js';
import { parseSessionImport } from '../../src/playback/import.js';

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/replay-session.json');
const fixtureEvents = ((): AnyEvent[] => {
  const parsed = parseSessionImport(readFileSync(fixturePath, 'utf8'));
  if (!parsed.ok) throw new Error('fixture failed to parse');
  return parsed.events;
})();

describe('replay orchestrator', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    stopReplay();
    resumeCapture();
    vi.restoreAllMocks();
  });

  it('suppresses capture for the replay lifetime', () => {
    expect(isCaptureSuppressed()).toBe(false);
    const session = startReplay(fixtureEvents);
    expect(isCaptureSuppressed()).toBe(true);
    expect(isReplaying()).toBe(true);
    expect(getActiveReplay()).toBe(session);
    session.stop();
    expect(isCaptureSuppressed()).toBe(false);
    expect(isReplaying()).toBe(false);
    expect(getActiveReplay()).toBeNull();
  });

  it('throws on an empty session', () => {
    expect(() => startReplay([])).toThrow(/no events/);
    expect(isCaptureSuppressed()).toBe(false);
  });

  it('injects the replay visual layer with data-ut-no-track and removes it on stop', () => {
    const session = startReplay(fixtureEvents);
    const layer = document.querySelector('.recap-replay-layer');
    expect(layer).not.toBeNull();
    expect(layer!.hasAttribute('data-ut-no-track')).toBe(true);
    session.stop();
    expect(document.querySelector('.recap-replay-layer')).toBeNull();
  });

  it('applies navigation via pushState + synthetic popstate', () => {
    const popstateSpy = vi.fn();
    window.addEventListener('popstate', popstateSpy);
    const session = startReplay(fixtureEvents);

    // seek past the pushState navigation event (relativeTs 1100)
    session.seek(1500);
    expect(location.pathname).toBe('/reports');
    expect(popstateSpy).toHaveBeenCalled();
    window.removeEventListener('popstate', popstateSpy);
    session.stop();
  });

  it('restores scroll position on seek from the last scroll event', () => {
    const scrollToSpy = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    // Give the document scrollable height
    Object.defineProperty(document.body, 'scrollHeight', { value: 3000, configurable: true });

    const session = startReplay(fixtureEvents);
    session.seek(2000); // past the depth-40 scroll on /reports
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ top: expect.any(Number), behavior: 'auto' })
    );
    session.stop();
  });

  it('anchors click ripples to the live element when the selector resolves', () => {
    const target = document.createElement('a');
    target.id = 'nav-reports';
    document.body.appendChild(target);
    target.getBoundingClientRect = () =>
      ({ left: 100, top: 50, width: 80, height: 20 } as DOMRect);

    // Deterministic timing: manual clock + rAF pump
    let time = 0;
    let pending: FrameRequestCallback | null = null;
    const session = startReplay(fixtureEvents, {
      now: () => time,
      raf: (cb) => {
        pending = cb;
        return 1;
      },
      caf: () => {
        pending = null;
      },
    });

    session.play();
    time = 1050; // past the click at relativeTs 1000
    const cb = pending!;
    pending = null;
    cb(time);

    const ripple = document.querySelector<HTMLDivElement>('.recap-replay-ripple');
    expect(ripple).not.toBeNull();
    expect(ripple!.className).not.toContain('missing');
    // Anchored at rect.left + elementX * width = 100 + 0.5*80 = 140 (scrollX 0)
    expect(ripple!.style.left).toBe('140px');
    expect(target.classList.contains('recap-replay-target-outline')).toBe(true);
    session.stop();
  });

  it('falls back to recorded coordinates when the selector is missing', () => {
    // No #nav-reports element in the DOM
    let time = 0;
    let pending: FrameRequestCallback | null = null;
    const session = startReplay(fixtureEvents, {
      now: () => time,
      raf: (cb) => {
        pending = cb;
        return 1;
      },
      caf: () => {
        pending = null;
      },
    });

    session.play();
    time = 1050;
    const cb = pending!;
    pending = null;
    cb(time);

    const ripple = document.querySelector<HTMLDivElement>('.recap-replay-ripple');
    expect(ripple).not.toBeNull();
    expect(ripple!.className).toContain('missing');
    expect(ripple!.style.left).toBe('300px'); // recorded pageX
    session.stop();
  });

  it('starting a new replay stops the previous one', () => {
    const first = startReplay(fixtureEvents);
    const second = startReplay(fixtureEvents);
    expect(getActiveReplay()).toBe(second);
    expect(first.isPlaying()).toBe(false);
    second.stop();
  });

  it('reports a viewport warning when widths differ by more than 10%', () => {
    // fixture recorded at 1280; jsdom default innerWidth is 1024 → ~20% off
    const session = startReplay(fixtureEvents);
    expect(session.getWarnings().some((w) => w.includes('positions may drift'))).toBe(true);
    session.stop();
  });
});
