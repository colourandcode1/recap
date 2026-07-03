import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnyEvent } from '../../src/types.js';
import { parseSessionImport, prepareTimeline, cursorPositionAt } from '../../src/playback/import.js';

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/replay-session.json');
const fixtureRaw = readFileSync(fixturePath, 'utf8');

function baseEvent(overrides: Partial<AnyEvent> & { type: AnyEvent['type'] }): AnyEvent {
  return {
    sessionId: 's1',
    timestamp: 0,
    url: '/',
    viewport: { width: 1280, height: 800 },
    depth: 0,
    maxDepth: 0,
    ...overrides,
  } as AnyEvent;
}

describe('parseSessionImport', () => {
  it('accepts a valid Recap export', () => {
    const result = parseSessionImport(fixtureRaw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.events).toHaveLength(5);
      expect(result.sessionName).toBe('participant-01');
    }
  });

  it('rejects invalid JSON', () => {
    const result = parseSessionImport('{nope');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not valid JSON/);
  });

  it('rejects a JSON object without events', () => {
    expect(parseSessionImport('{"foo": 1}').ok).toBe(false);
    expect(parseSessionImport('{"events": []}').ok).toBe(false);
    expect(parseSessionImport('[1,2,3]').ok).toBe(false);
  });

  it('rejects malformed events with an index in the error', () => {
    const bad = JSON.stringify({
      events: [
        { type: 'click', timestamp: 1, url: '/', viewport: { width: 1, height: 1 } },
        { type: 'click', timestamp: 'NaN', url: '/', viewport: { width: 1, height: 1 } },
      ],
    });
    const result = parseSessionImport(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Event 1');
  });

  it('tolerates unknown event types', () => {
    const raw = JSON.stringify({
      events: [{ type: 'hover', timestamp: 1, url: '/', viewport: { width: 1, height: 1 } }],
    });
    expect(parseSessionImport(raw).ok).toBe(true);
  });
});

describe('prepareTimeline', () => {
  it('zero-bases the timeline and preserves order', () => {
    const parsed = parseSessionImport(fixtureRaw);
    if (!parsed.ok) throw new Error('fixture failed to parse');
    const timeline = prepareTimeline(parsed.events);

    expect(timeline.events[0]!.relativeTs).toBe(0);
    expect(timeline.events.map((e) => e.type)).toEqual([
      'navigation',
      'move',
      'click',
      'navigation',
      'scroll',
    ]);
    expect(timeline.events[4]!.relativeTs).toBe(2000); // 2100 - 100
    expect(timeline.duration).toBe(2000);
    expect(timeline.participantViewport).toEqual({ width: 1280, height: 800 });
    expect(timeline.warnings).toHaveLength(0);
  });

  it('flattens move polylines onto the virtual timeline', () => {
    const parsed = parseSessionImport(fixtureRaw);
    if (!parsed.ok) throw new Error('fixture failed to parse');
    const timeline = prepareTimeline(parsed.events);

    // move event at relativeTs 500 with offsets 0/100/200
    expect(timeline.flatMoves).toEqual([
      { t: 500, x: 100, y: 100 },
      { t: 600, x: 200, y: 150 },
      { t: 700, x: 300, y: 200 },
    ]);
  });

  it('segments sessions across page reloads with a synthetic gap and warning', () => {
    const events: AnyEvent[] = [
      baseEvent({ type: 'scroll', timestamp: 1000, id: 1 }),
      baseEvent({ type: 'scroll', timestamp: 5000, id: 2 }),
      // full reload: performance.now() reset
      baseEvent({ type: 'scroll', timestamp: 200, id: 3 }),
      baseEvent({ type: 'scroll', timestamp: 700, id: 4 }),
    ];
    const timeline = prepareTimeline(events);

    expect(timeline.events.map((e) => e.relativeTs)).toEqual([0, 4000, 5000, 5500]);
    expect(timeline.duration).toBe(5500);
    expect(timeline.warnings.some((w) => w.includes('2 page loads'))).toBe(true);
  });

  it('orders by id when present regardless of array order', () => {
    const events: AnyEvent[] = [
      baseEvent({ type: 'scroll', timestamp: 500, id: 2 }),
      baseEvent({ type: 'scroll', timestamp: 100, id: 1 }),
    ];
    const timeline = prepareTimeline(events);
    expect(timeline.events.map((e) => e.id)).toEqual([1, 2]);
  });

  it('handles an empty event list', () => {
    const timeline = prepareTimeline([]);
    expect(timeline.duration).toBe(0);
    expect(timeline.events).toHaveLength(0);
    expect(timeline.flatMoves).toHaveLength(0);
  });
});

describe('cursorPositionAt', () => {
  const flat = [
    { t: 100, x: 0, y: 0 },
    { t: 200, x: 100, y: 50 },
    { t: 5000, x: 500, y: 500 },
  ];

  it('returns null before the first point', () => {
    expect(cursorPositionAt(flat, 50)).toBeNull();
    expect(cursorPositionAt([], 100)).toBeNull();
  });

  it('interpolates between neighbouring points', () => {
    expect(cursorPositionAt(flat, 150)).toEqual({ x: 50, y: 25 });
    expect(cursorPositionAt(flat, 100)).toEqual({ x: 0, y: 0 });
  });

  it('snaps (no lerp) across gaps longer than 2s', () => {
    // gap between t=200 and t=5000 is 4800ms > 2000ms
    expect(cursorPositionAt(flat, 2600)).toEqual({ x: 100, y: 50 });
  });

  it('clamps to the last point after the trail ends', () => {
    expect(cursorPositionAt(flat, 99999)).toEqual({ x: 500, y: 500 });
  });
});
