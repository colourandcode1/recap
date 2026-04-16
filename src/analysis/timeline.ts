// Timeline analysis — builds a chronological page-visit list from raw session events.
// Pure function, no DOM dependencies.

import type { AnyEvent, NavigationEvent } from '../types.js';

export interface PageVisit {
  pagePath: string;
  arrivalTime: number;     // seconds from session start
  duration: number | null; // seconds on page; null if visit is still in progress
  visitNumber: number;     // 1 = first time on this page, 2 = second, etc.
  isRevisit: boolean;
  tags: PageVisitTag[];
}

export type PageVisitTag =
  | 'backtrack'
  | 'first task'
  | 'abandoned'
  | 'end of session'
  | 'long pause'
  | 'brief visit';

const LONG_PAUSE_S = 30;
const BRIEF_VISIT_S = 2;

/**
 * Derive a chronological PageVisit list from a session's raw events.
 *
 * @param events      All events for the session, in any order.
 * @param isCurrentSession  True when the session is still live — the last visit
 *                    gets duration=null and no end-of-session / abandoned tag.
 */
export function generateTimeline(events: AnyEvent[], isCurrentSession = false): PageVisit[] {
  if (events.length === 0) return [];

  // Work on a timestamp-sorted copy
  const sorted = events.slice().sort((a, b) => a.timestamp - b.timestamp);
  const sessionStartMs = sorted[0]!.timestamp;
  const lastEventMs = sorted[sorted.length - 1]!.timestamp;

  const navEvents = sorted.filter((e): e is NavigationEvent => e.type === 'navigation');

  // --- Single-page session (no navigation events) ---
  if (navEvents.length === 0) {
    const duration = isCurrentSession
      ? null
      : (lastEventMs - sessionStartMs) / 1000;
    const tags: PageVisitTag[] = [];
    if (!isCurrentSession) tags.push('end of session');
    return [{
      pagePath: sorted[0]!.url,
      arrivalTime: 0,
      duration: duration !== null ? Math.max(0, duration) : null,
      visitNumber: 1,
      isRevisit: false,
      tags,
    }];
  }

  // --- Build ordered list of { path, arrivalMs } ---
  const pages: Array<{ path: string; arrivalMs: number }> = [];

  const firstNav = navEvents[0]!;
  if (firstNav.method === 'pageload') {
    // pageload: the "to" field is the landing page
    pages.push({ path: firstNav.to, arrivalMs: firstNav.timestamp });
  } else {
    // Session started on `from` before any captured navigation
    pages.push({ path: firstNav.from, arrivalMs: sessionStartMs });
    pages.push({ path: firstNav.to, arrivalMs: firstNav.timestamp });
  }

  for (let i = 1; i < navEvents.length; i++) {
    pages.push({ path: navEvents[i]!.to, arrivalMs: navEvents[i]!.timestamp });
  }

  // --- Build PageVisit array ---
  const visitCounts = new Map<string, number>();

  return pages.map((page, i) => {
    const isLast = i === pages.length - 1;

    // Duration
    let duration: number | null;
    if (!isLast) {
      duration = (pages[i + 1]!.arrivalMs - page.arrivalMs) / 1000;
    } else if (isCurrentSession) {
      duration = null;
    } else {
      duration = (lastEventMs - page.arrivalMs) / 1000;
    }
    if (duration !== null) duration = Math.max(0, duration);

    // Visit tracking
    const prevCount = visitCounts.get(page.path) ?? 0;
    const visitNumber = prevCount + 1;
    visitCounts.set(page.path, visitNumber);
    const isRevisit = visitNumber > 1;

    // Tags
    const tags: PageVisitTag[] = [];
    if (i === 1) tags.push('first task');
    if (isRevisit) tags.push('backtrack');
    if (duration !== null && duration > LONG_PAUSE_S) tags.push('long pause');
    if (duration !== null && !isLast && duration < BRIEF_VISIT_S) tags.push('brief visit');
    if (isLast && !isCurrentSession) tags.push('end of session');

    return {
      pagePath: page.path,
      arrivalTime: (page.arrivalMs - sessionStartMs) / 1000,
      duration,
      visitNumber,
      isRevisit,
      tags,
    };
  });
}
