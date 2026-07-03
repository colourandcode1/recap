// Session import + timeline preparation for replay.
// Validates exported JSON, normalizes events onto a zero-based virtual
// timeline (segmenting across page reloads), and flattens move polylines
// for per-frame cursor interpolation.

import type { AnyEvent, MoveEvent, Viewport } from '../types.js';

export type TimelineEvent = AnyEvent & { relativeTs: number };

export interface FlatMovePoint {
  t: number; // virtual ms on the replay timeline
  x: number; // pageX
  y: number; // pageY
}

export interface ReplayTimeline {
  events: TimelineEvent[]; // sorted by relativeTs
  duration: number; // ms
  participantViewport: Viewport;
  warnings: string[];
  flatMoves: FlatMovePoint[]; // sorted by t
}

const SEGMENT_GAP_MS = 1000; // synthetic gap between page-load segments
const HUGE_SESSION_THRESHOLD = 50_000;
const CURSOR_GAP_SNAP_MS = 2000; // don't interpolate across gaps longer than this

// --- Import validation ---

export function parseSessionImport(
  raw: string
): { ok: true; events: AnyEvent[]; sessionName?: string } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'Import must be a JSON object.' };
  }

  const obj = parsed as Record<string, unknown>;
  const events = obj['events'];
  if (!Array.isArray(events) || events.length === 0) {
    return { ok: false, error: 'Import has no events — expected a Recap session export.' };
  }

  for (let i = 0; i < events.length; i++) {
    const e = events[i] as Record<string, unknown> | null;
    if (
      typeof e !== 'object' ||
      e === null ||
      typeof e['type'] !== 'string' ||
      typeof e['timestamp'] !== 'number' ||
      !Number.isFinite(e['timestamp']) ||
      typeof e['url'] !== 'string' ||
      typeof e['viewport'] !== 'object' ||
      e['viewport'] === null ||
      typeof (e['viewport'] as Record<string, unknown>)['width'] !== 'number' ||
      typeof (e['viewport'] as Record<string, unknown>)['height'] !== 'number'
    ) {
      return { ok: false, error: `Event ${i} is malformed — expected a Recap session export.` };
    }
  }

  const sessionName = typeof obj['sessionName'] === 'string' ? obj['sessionName'] : undefined;
  return {
    ok: true,
    events: events as AnyEvent[],
    ...(sessionName !== undefined ? { sessionName } : {}),
  };
}

// --- Timeline preparation ---

/**
 * Order events chronologically. Prefer IDB insertion order (id), then
 * wallTime (absolute), then array order. timestamp alone is unsafe across
 * page reloads because performance.now() resets.
 */
function chronologicalOrder(events: AnyEvent[]): AnyEvent[] {
  const withIndex = events.map((e, i) => ({ e, i }));
  withIndex.sort((a, b) => {
    if (a.e.id !== undefined && b.e.id !== undefined) return a.e.id - b.e.id;
    if (a.e.wallTime !== undefined && b.e.wallTime !== undefined) {
      if (a.e.wallTime !== b.e.wallTime) return a.e.wallTime - b.e.wallTime;
    }
    return a.i - b.i;
  });
  return withIndex.map((w) => w.e);
}

export function prepareTimeline(rawEvents: AnyEvent[]): ReplayTimeline {
  const warnings: string[] = [];
  const ordered = chronologicalOrder(rawEvents);

  if (ordered.length > HUGE_SESSION_THRESHOLD) {
    warnings.push(
      `Large session (${ordered.length.toLocaleString()} events) — replay may be slow.`
    );
  }

  // Split into page-load segments: a timestamp that goes backwards means
  // performance.now() reset (full page reload).
  const segments: AnyEvent[][] = [];
  let current: AnyEvent[] = [];
  let prevTs = -Infinity;
  for (const e of ordered) {
    if (e.timestamp < prevTs && current.length > 0) {
      segments.push(current);
      current = [];
    }
    prevTs = e.timestamp;
    current.push(e);
  }
  if (current.length > 0) segments.push(current);

  if (segments.length > 1) {
    warnings.push(
      `Session spans ${segments.length} page loads — gaps between them are approximate.`
    );
  }

  // Concatenate segments onto one zero-based timeline with synthetic gaps.
  const events: TimelineEvent[] = [];
  let offset = 0;
  for (const segment of segments) {
    const segStart = segment[0]!.timestamp;
    let segEnd = 0;
    for (const e of segment) {
      const relativeTs = offset + (e.timestamp - segStart);
      events.push({ ...e, relativeTs });
      const eventEnd =
        e.type === 'move' && (e as MoveEvent).points.length > 0
          ? relativeTs + (e as MoveEvent).points[(e as MoveEvent).points.length - 1]!.t
          : relativeTs;
      if (eventEnd > segEnd) segEnd = eventEnd;
    }
    offset = segEnd + SEGMENT_GAP_MS;
  }

  const duration = events.length > 0 ? offset - SEGMENT_GAP_MS : 0;

  // Flatten move polylines for cursor interpolation.
  const flatMoves: FlatMovePoint[] = [];
  for (const e of events) {
    if (e.type !== 'move') continue;
    for (const p of (e as MoveEvent & { relativeTs: number }).points) {
      flatMoves.push({ t: e.relativeTs + p.t, x: p.x, y: p.y });
    }
  }
  flatMoves.sort((a, b) => a.t - b.t);

  const participantViewport: Viewport = events[0]
    ? { ...events[0].viewport }
    : { width: 0, height: 0 };

  return { events, duration, participantViewport, warnings, flatMoves };
}

// --- Cursor interpolation ---

/**
 * Cursor position at a virtual time: binary search + linear interpolation
 * between neighbouring points. Returns null before the first point; snaps
 * (no lerp) across gaps longer than CURSOR_GAP_SNAP_MS.
 */
export function cursorPositionAt(
  flatMoves: FlatMovePoint[],
  virtualMs: number
): { x: number; y: number } | null {
  if (flatMoves.length === 0 || virtualMs < flatMoves[0]!.t) return null;

  const last = flatMoves[flatMoves.length - 1]!;
  if (virtualMs >= last.t) return { x: last.x, y: last.y };

  // Binary search: greatest index with t <= virtualMs
  let lo = 0;
  let hi = flatMoves.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (flatMoves[mid]!.t <= virtualMs) lo = mid;
    else hi = mid - 1;
  }

  const a = flatMoves[lo]!;
  const b = flatMoves[lo + 1]!;
  const gap = b.t - a.t;
  if (gap > CURSOR_GAP_SNAP_MS || gap <= 0) return { x: a.x, y: a.y };

  const f = (virtualMs - a.t) / gap;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
