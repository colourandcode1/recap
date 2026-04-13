// Session summary generator — transforms raw events into AI-readable timeline.

import type {
  AnyEvent,
  ClickEvent,
  ScrollEvent,
  NavigationEvent,
  SessionSummary,
  TimelineEntry,
  PageSummary,
  ElementInteraction,
  BacktrackEvent,
  RapidClickCluster,
  ScrollDropoff,
  PageRegion,
} from '../types.js';

const PROMPT_TEMPLATE = `You are a UX researcher analysing a usability test session for a web application prototype.

Below is a structured session summary in JSON format. It contains:
- Session metadata (duration, viewport, pages visited)
- A chronological timeline of user actions with semantic element labels
- Per-page breakdowns of clicks, scroll depth, and time spent
- Detected patterns including frustration signals, backtracking, and accessibility gaps

Please analyse this session and provide:
1. **Task completion assessment** — did the user appear to accomplish their goal? Where did they struggle?
2. **Key friction points** — moments of hesitation, rapid clicking, backtracking, or confusion
3. **Navigation patterns** — was the user's path efficient? Where did they get lost?
4. **Accessibility observations** — unlabelled elements, missed affordances, discoverability issues
5. **Specific recommendations** — concrete UI changes ranked by likely impact

Session data:`;

const PAUSE_THRESHOLD_MS = 5000; // 5s gap between events = "pause"
const LONG_HESITATION_THRESHOLD_S = 10; // time to first click considered "long"
const RAPID_CLICK_WINDOW_MS = 2000;
const RAPID_CLICK_THRESHOLD = 3;

function msToSec(ms: number): number {
  return Math.round(ms) / 1000;
}

function formatAction(event: AnyEvent): string {
  if (event.type === 'click') {
    const c = event as ClickEvent;
    const label = c.label ? `'${c.label}'` : null;
    const tag = c.tagName.charAt(0) + c.tagName.slice(1).toLowerCase();
    return label
      ? `Clicked ${label} ${tag.toLowerCase()}`
      : `Clicked unlabelled ${tag} element`;
  }
  if (event.type === 'scroll') {
    const s = event as ScrollEvent;
    return `Scrolled to ${s.depth}% depth`;
  }
  if (event.type === 'navigation') {
    const n = event as NavigationEvent;
    if (n.method === 'pageload') return `Landed on ${n.to}`;
    return `Navigated to ${n.to}`;
  }
  return `${event.type} event`;
}

function detectRapidClicks(clicks: ClickEvent[]): RapidClickCluster[] {
  const clusters: RapidClickCluster[] = [];
  const sorted = [...clicks].sort((a, b) => a.timestamp - b.timestamp);

  let i = 0;
  while (i < sorted.length) {
    const anchor = sorted[i]!;
    let j = i + 1;
    while (
      j < sorted.length &&
      sorted[j]!.timestamp - anchor.timestamp <= RAPID_CLICK_WINDOW_MS &&
      (sorted[j]!.selector === anchor.selector ||
        Math.sqrt(
          (sorted[j]!.clientX - anchor.clientX) ** 2 +
            (sorted[j]!.clientY - anchor.clientY) ** 2
        ) <= 50)
    ) {
      j++;
    }
    const count = j - i;
    if (count >= RAPID_CLICK_THRESHOLD) {
      clusters.push({
        selector: anchor.selector,
        label: anchor.label,
        clickCount: count,
        durationMs: sorted[j - 1]!.timestamp - anchor.timestamp,
        timestamp: anchor.timestamp,
        page: anchor.url,
      });
    }
    i = j;
  }

  return clusters;
}

function detectBacktracking(navEvents: NavigationEvent[]): BacktrackEvent[] {
  const result: BacktrackEvent[] = [];
  for (let i = 1; i < navEvents.length; i++) {
    const cur = navEvents[i]!;
    const prev = navEvents[i - 1]!;
    // Check if current destination was visited before this nav
    const previousUrls = navEvents.slice(0, i - 1).map((n) => n.to);
    if (previousUrls.includes(cur.to)) {
      result.push({
        from: cur.from,
        to: cur.to,
        timestamp: cur.timestamp,
        timeOnPageBeforeBack: (cur.timestamp - prev.timestamp) / 1000,
      });
    }
  }
  return result;
}

function buildPageSummaries(
  clicks: ClickEvent[],
  scrollEvents: ScrollEvent[],
  navEvents: NavigationEvent[]
): PageSummary[] {
  const urls = [...new Set([...clicks.map((c) => c.url), ...navEvents.map((n) => n.to).filter(Boolean)])];
  const summaries: PageSummary[] = [];

  for (const url of urls) {
    if (!url) continue;

    const pageClicks = clicks.filter((c) => c.url === url);
    const pageScrolls = scrollEvents.filter((s) => s.url === url);
    const pageNavs = navEvents.filter((n) => n.to === url);

    // Calculate time on page from nav events
    let totalTime = 0;
    for (const nav of pageNavs) {
      const nextNav = navEvents.find(
        (n) => n.from === url && n.timestamp > nav.timestamp
      );
      if (nextNav) totalTime += (nextNav.timestamp - nav.timestamp) / 1000;
    }

    const maxScroll = pageScrolls.reduce((m, s) => Math.max(m, s.maxDepth), 0);
    const dropoffDepths = pageScrolls.map((s) => s.depth);
    const scrollDropoff =
      dropoffDepths.length > 0
        ? Math.round(dropoffDepths.reduce((a, b) => a + b, 0) / dropoffDepths.length)
        : 0;

    // Time to first click (from first navigation to that page)
    const firstNav = pageNavs.sort((a, b) => a.timestamp - b.timestamp)[0];
    const firstClick = pageClicks.sort((a, b) => a.timestamp - b.timestamp)[0];
    const timeToFirst =
      firstNav && firstClick
        ? (firstClick.timestamp - firstNav.timestamp) / 1000
        : null;

    // Clicks by region
    const byRegion: Partial<Record<PageRegion, number>> = {};
    for (const c of pageClicks) {
      byRegion[c.pageRegion] = (byRegion[c.pageRegion] ?? 0) + 1;
    }

    // Clicks by element
    const elementMap = new Map<string, ElementInteraction>();
    for (const c of pageClicks) {
      const existing = elementMap.get(c.selector);
      if (existing) {
        existing.clickCount++;
      } else {
        elementMap.set(c.selector, {
          selector: c.selector,
          tagName: c.tagName,
          label: c.label,
          clickCount: 1,
          pageRegion: c.pageRegion,
        });
      }
    }

    summaries.push({
      url,
      visits: pageNavs.length || 1,
      totalTimeOnPage: Math.round(totalTime * 10) / 10,
      timeToFirstClick: timeToFirst !== null ? Math.round(timeToFirst * 10) / 10 : null,
      maxScrollDepth: maxScroll,
      scrollDropoffPoint: scrollDropoff,
      clicks: {
        total: pageClicks.length,
        byRegion,
        byElement: Array.from(elementMap.values()).sort((a, b) => b.clickCount - a.clickCount),
      },
    });
  }

  return summaries;
}

function buildTimeline(
  events: AnyEvent[],
  navEvents: NavigationEvent[],
  rapidClusters: RapidClickCluster[],
  backtrackEvents: BacktrackEvent[],
  sessionStart: number
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Track context
  const firstClickPerPage = new Map<string, number>();
  const pageVisitCount = new Map<string, number>();

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]!;
    const tSec = msToSec(e.timestamp - sessionStart);

    // Check for pause before this event
    if (i > 0) {
      const prevTs = sorted[i - 1]!.timestamp;
      if (e.timestamp - prevTs >= PAUSE_THRESHOLD_MS) {
        entries.push({
          timestamp: msToSec(prevTs + (e.timestamp - prevTs) / 2 - sessionStart),
          action: `Pause — ${Math.round((e.timestamp - prevTs) / 1000)}s of inactivity`,
          type: 'pause',
          page: e.url,
        });
      }
    }

    if (e.type === 'navigation') {
      const n = e as NavigationEvent;
      if (!n.to) continue;

      const visitCount = (pageVisitCount.get(n.to) ?? 0) + 1;
      pageVisitCount.set(n.to, visitCount);

      let context: string | undefined;
      const backtrack = backtrackEvents.find(
        (b) => Math.abs(b.timestamp - n.timestamp) < 500
      );
      if (backtrack) {
        context = `Backtracking — returned to ${n.to} after ${Math.round(backtrack.timeOnPageBeforeBack)}s on ${n.from}`;
      } else if (visitCount > 1) {
        context = `${visitCount === 2 ? '2nd' : `${visitCount}th`} visit to this page`;
      }

      entries.push({
        timestamp: tSec,
        action: n.method === 'pageload' ? `Landed on ${n.to}` : `Navigated to ${n.to}`,
        type: 'navigate',
        page: n.to,
        ...(context !== undefined ? { context } : {}),
      });
    } else if (e.type === 'scroll') {
      const s = e as ScrollEvent;
      // Only emit milestone events (25, 50, 75, 100)
      if ([25, 50, 75, 100].includes(s.depth)) {
        let context: string | undefined;
        if (s.depth >= 80) {
          const pageClicks = sorted.filter(
            (ev) => ev.type === 'click' && ev.url === s.url
          );
          if (pageClicks.length === 0) {
            context = `Scrolled to ${s.depth}% depth but no clicks — content may be scan-only or unclear`;
          }
        }
        entries.push({
          timestamp: tSec,
          action: `Scrolled to ${s.depth}% depth`,
          type: 'scroll_milestone',
          page: s.url,
          ...(context !== undefined ? { context } : {}),
        });
      }
    } else if (e.type === 'click') {
      const c = e as ClickEvent;

      // Check for rapid click cluster
      const cluster = rapidClusters.find(
        (rc) =>
          rc.page === c.url &&
          rc.selector === c.selector &&
          Math.abs(rc.timestamp - c.timestamp) < 100
      );
      if (cluster) {
        const ctxParts: string[] = [
          `Potential frustration — user clicked same element repeatedly`,
        ];
        if (!c.label) ctxParts.push('Element has no accessible label');
        entries.push({
          timestamp: tSec,
          action: `Rapid clicks detected (${cluster.clickCount} clicks in ${(cluster.durationMs / 1000).toFixed(1)}s)`,
          type: 'rapid_click',
          page: c.url,
          element: {
            selector: c.selector,
            tagName: c.tagName,
            label: c.label,
            nearestHeading: c.nearestHeading,
            pageRegion: c.pageRegion,
          },
          context: ctxParts.join(' — '),
        });
        // Skip remaining clicks in cluster
        continue;
      }

      // First click on page?
      let context: string | undefined;
      const firstClick = firstClickPerPage.get(c.url);
      if (firstClick === undefined) {
        firstClickPerPage.set(c.url, c.timestamp);
        const nav = navEvents.find((n) => n.to === c.url && n.timestamp <= c.timestamp);
        if (nav) {
          const delay = (c.timestamp - nav.timestamp) / 1000;
          context =
            delay > LONG_HESITATION_THRESHOLD_S
              ? `First click on this page — ${delay.toFixed(1)}s to first interaction (long hesitation)`
              : `First click on this page — ${delay.toFixed(1)}s to first interaction`;
        }
      } else if (!c.label) {
        context = 'Element has no accessible label — possible discoverability issue';
      }

      entries.push({
        timestamp: tSec,
        action: formatAction(c),
        type: 'click',
        page: c.url,
        element: {
          selector: c.selector,
          tagName: c.tagName,
          label: c.label,
          nearestHeading: c.nearestHeading,
          pageRegion: c.pageRegion,
        },
        ...(context !== undefined ? { context } : {}),
      });
    }
  }

  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

export function summarize(events: AnyEvent[], sessionName?: string): SessionSummary {
  if (events.length === 0) {
    const now = new Date().toISOString();
    return {
      meta: {
        sessionId: '',
        ...(sessionName !== undefined ? { sessionName } : {}),
        startTime: now,
        endTime: now,
        duration: 0,
        viewport: { width: 0, height: 0 },
        pagesVisited: 0,
        totalClicks: 0,
        totalScrollEvents: 0,
      },
      timeline: [],
      pages: [],
      patterns: {
        mostClickedElements: [],
        unclickedRegions: [],
        averageTimeToFirstClick: 0,
        navigationPath: [],
        backtracking: [],
        rapidClicks: [],
        scrollDropoff: [],
      },
      promptTemplate: PROMPT_TEMPLATE,
    };
  }

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const sessionStart = sorted[0]!.timestamp;
  const sessionEnd = sorted[sorted.length - 1]!.timestamp;
  const sessionId = sorted[0]!.sessionId;

  const clicks = sorted.filter((e): e is ClickEvent => e.type === 'click');
  const scrollEvents = sorted.filter((e): e is ScrollEvent => e.type === 'scroll');
  const navEvents = sorted.filter((e): e is NavigationEvent => e.type === 'navigation');

  // Unique pages visited
  const pagesVisited = new Set(navEvents.map((n) => n.to).filter(Boolean));

  // Viewport from first event
  const viewport = sorted[0]!.viewport;

  const rapidClusters = detectRapidClicks(clicks);
  const backtrackEvents = detectBacktracking(navEvents);
  const pageSummaries = buildPageSummaries(clicks, scrollEvents, navEvents);
  const timeline = buildTimeline(sorted, navEvents, rapidClusters, backtrackEvents, sessionStart);

  // Most clicked elements
  const elementMap = new Map<string, ElementInteraction>();
  for (const c of clicks) {
    const existing = elementMap.get(c.selector);
    if (existing) {
      existing.clickCount++;
    } else {
      elementMap.set(c.selector, {
        selector: c.selector,
        tagName: c.tagName,
        label: c.label,
        clickCount: 1,
        pageRegion: c.pageRegion,
      });
    }
  }
  const mostClicked = Array.from(elementMap.values())
    .sort((a, b) => b.clickCount - a.clickCount)
    .slice(0, 10);

  // Unclicked regions (regions with zero clicks across session)
  const allRegions: PageRegion[] = [
    'top-left', 'top-center', 'top-right',
    'middle-left', 'center', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right',
  ];
  const clickedRegions = new Set(clicks.map((c) => c.pageRegion));
  const unclickedRegions = allRegions.filter((r) => !clickedRegions.has(r));

  // Average time to first click
  const firstClickTimes = pageSummaries
    .map((p) => p.timeToFirstClick)
    .filter((t): t is number => t !== null);
  const avgTimeToFirst =
    firstClickTimes.length > 0
      ? firstClickTimes.reduce((a, b) => a + b, 0) / firstClickTimes.length
      : 0;

  // Navigation path
  const navigationPath = navEvents
    .filter((n) => n.to)
    .map((n) => n.to);

  // Scroll dropoff per page
  const scrollDropoff: ScrollDropoff[] = pageSummaries
    .filter((p) => p.scrollDropoffPoint > 0)
    .map((p) => ({ page: p.url, depth: p.scrollDropoffPoint }));

  return {
    meta: {
      sessionId,
      ...(sessionName !== undefined ? { sessionName } : {}),
      startTime: new Date(Date.now() - (sessionEnd - sessionStart)).toISOString(),
      endTime: new Date().toISOString(),
      duration: Math.round((sessionEnd - sessionStart) / 1000),
      viewport,
      pagesVisited: pagesVisited.size,
      totalClicks: clicks.length,
      totalScrollEvents: scrollEvents.length,
    },
    timeline,
    pages: pageSummaries,
    patterns: {
      mostClickedElements: mostClicked,
      unclickedRegions,
      averageTimeToFirstClick: Math.round(avgTimeToFirst * 10) / 10,
      navigationPath,
      backtracking: backtrackEvents,
      rapidClicks: rapidClusters,
      scrollDropoff,
    },
    promptTemplate: PROMPT_TEMPLATE,
  };
}
