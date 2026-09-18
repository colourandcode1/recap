// Timeline view — HTML builder for the Timeline tab.
// Returns an HTML string; row-click binding is handled by panel.ts.

import type { AnyEvent } from '../types.js';
import { generateTimeline, type PageVisit, type PageVisitTag } from '../analysis/timeline.js';
import { getSessionId } from '../capture/session.js';

const PREFIX = 'recap-panel';

// Tag display config: label text, bg colour, text colour.
// Neutral tags reuse the panel's --secondary/--muted-foreground badge look;
// backtrack/abandoned get a desaturated amber/red accent, shadcn "destructive"-style.
const TAG_CONFIG: Record<PageVisitTag, { bg: string; color: string }> = {
  backtrack:          { bg: '#451a03', color: '#fdba74' },
  'first task':       { bg: '#27272a', color: '#a1a1aa' },
  'end of session':   { bg: '#27272a', color: '#a1a1aa' },
  abandoned:          { bg: '#450a0a', color: '#fca5a5' },
  'long pause':       { bg: '#27272a', color: '#a1a1aa' },
  'brief visit':      { bg: '#27272a', color: '#a1a1aa' },
};

function formatArrival(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '(in progress)';
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function renderTag(tag: PageVisitTag): string {
  const { bg, color } = TAG_CONFIG[tag];
  return `<span style="background:${bg};color:${color};font-size:10px;font-weight:600;padding:2px 8px;border-radius:999px;margin-left:4px;white-space:nowrap">${tag}</span>`;
}

function renderRow(visit: PageVisit, index: number): string {
  const visitMeta = visit.isRevisit
    ? `<span style="color:var(--muted-foreground);font-size:11px;margin-left:6px">(visit ${visit.visitNumber})</span>`
    : '';

  const tags = visit.tags.map(renderTag).join('');

  const durationStyle = visit.duration === null
    ? 'color:var(--muted-foreground);font-style:italic'
    : 'color:var(--muted-foreground)';

  return `
    <div
      data-visit-index="${index}"
      style="
        display:flex;align-items:center;gap:8px;
        padding:7px 0;border-bottom:1px solid var(--border);
        cursor:pointer;transition:background 0.1s;
      "
      class="${PREFIX}-tl-row"
    >
      <span style="font-family:ui-monospace,monospace;font-size:11px;color:var(--muted-foreground);min-width:36px;flex-shrink:0">${formatArrival(visit.arrivalTime)}</span>
      <span style="font-size:12px;color:var(--foreground);font-family:ui-monospace,monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${visit.pagePath}</span>
      ${visitMeta}
      <span style="font-size:11px;${durationStyle};flex-shrink:0;min-width:72px;text-align:right">${formatDuration(visit.duration)}</span>
      <span style="display:flex;flex-wrap:wrap;gap:2px;flex-shrink:0">${tags}</span>
    </div>
  `;
}

export function buildTimelineHTML(events: AnyEvent[], sessionId: string): string {
  if (events.length === 0) {
    return `
      <div class="${PREFIX}-timeline-empty">
        <div class="${PREFIX}-timeline-empty-title">No timeline data yet</div>
        <div class="${PREFIX}-timeline-empty-copy">Select a session to view its page visits and navigation flow.</div>
      </div>
    `;
  }

  const isCurrentSession = sessionId === getSessionId();
  const visits = generateTimeline(events, isCurrentSession);

  if (visits.length === 0) {
    return `
      <div class="${PREFIX}-timeline-empty">
        <div class="${PREFIX}-timeline-empty-title">No navigation events recorded</div>
        <div class="${PREFIX}-timeline-empty-copy">This session has events, but none that form a page timeline.</div>
      </div>
    `;
  }

  const hasMultiplePages = visits.some(v => v.pagePath !== visits[0]!.pagePath);

  if (!hasMultiplePages) {
    const row = renderRow(visits[0]!, 0);
    return `
      <div style="color:var(--muted-foreground);font-size:11px;margin-bottom:8px">
        This session stayed on a single page. No navigation flow to show.
      </div>
      <div>${row}</div>
    `;
  }

  return `<div>${visits.map((v, i) => renderRow(v, i)).join('')}</div>`;
}

// Styles to inject into the panel style block.
// Relies on the CSS variables set on `.recap-panel-root` (see panel.ts STYLES).
export const TIMELINE_STYLES = `
  .${PREFIX}-tl-row:hover {
    background: var(--accent) !important;
  }
  .${PREFIX}-filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: var(--muted);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    font-size: 11px;
    color: var(--foreground);
    margin-bottom: 10px;
  }
  .${PREFIX}-filter-bar strong {
    color: var(--foreground);
    font-weight: 600;
  }
  .${PREFIX}-filter-clear {
    background: none;
    border: none;
    color: var(--muted-foreground);
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
    padding: 0;
    margin-left: auto;
  }
  .${PREFIX}-filter-clear:hover { color: var(--foreground); }
  .${PREFIX}-tabs {
    display: inline-flex;
    gap: 2px;
    background: var(--muted);
    border-radius: calc(var(--radius) - 2px);
    padding: 3px;
    margin-bottom: 12px;
    flex-shrink: 0;
  }
  .${PREFIX}-tab {
    background: none;
    border: none;
    border-radius: calc(var(--radius) - 4px);
    color: var(--muted-foreground);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    padding: 5px 12px;
    transition: color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .${PREFIX}-tab:hover { color: var(--foreground); }
  .${PREFIX}-tab.active {
    background: var(--background);
    color: var(--foreground);
    box-shadow: 0 1px 2px rgba(0,0,0,0.3);
  }
`;
