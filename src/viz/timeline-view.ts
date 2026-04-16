// Timeline view — HTML builder for the Timeline tab.
// Returns an HTML string; row-click binding is handled by panel.ts.

import type { AnyEvent } from '../types.js';
import { generateTimeline, type PageVisit, type PageVisitTag } from '../analysis/timeline.js';
import { getSessionId } from '../capture/session.js';

const PREFIX = 'recap-panel';

// Tag display config: label text, bg colour, text colour
const TAG_CONFIG: Record<PageVisitTag, { bg: string; color: string }> = {
  backtrack:          { bg: '#7a4a1a', color: '#fbbf6a' },
  'first task':       { bg: '#3a3a4a', color: '#a0a0b8' },
  'end of session':   { bg: '#3a3a4a', color: '#a0a0b8' },
  abandoned:          { bg: '#7a1a1a', color: '#fca5a5' },
  'long pause':       { bg: '#3a3a4a', color: '#a0a0b8' },
  'brief visit':      { bg: '#3a3a4a', color: '#a0a0b8' },
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
  return `<span style="background:${bg};color:${color};font-size:10px;padding:2px 6px;border-radius:3px;margin-left:4px;white-space:nowrap">${tag}</span>`;
}

function renderRow(visit: PageVisit, index: number): string {
  const visitMeta = visit.isRevisit
    ? `<span style="color:#718096;font-size:11px;margin-left:6px">(visit ${visit.visitNumber})</span>`
    : '';

  const tags = visit.tags.map(renderTag).join('');

  const durationStyle = visit.duration === null
    ? 'color:#718096;font-style:italic'
    : 'color:#a0aec0';

  return `
    <div
      data-visit-index="${index}"
      style="
        display:flex;align-items:center;gap:8px;
        padding:7px 0;border-bottom:1px solid #2a2a3e;
        cursor:pointer;transition:background 0.1s;
      "
      class="${PREFIX}-tl-row"
    >
      <span style="font-family:monospace;font-size:11px;color:#718096;min-width:36px;flex-shrink:0">${formatArrival(visit.arrivalTime)}</span>
      <span style="font-size:12px;color:#e2e8f0;font-family:monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${visit.pagePath}</span>
      ${visitMeta}
      <span style="font-size:11px;${durationStyle};flex-shrink:0;min-width:72px;text-align:right">${formatDuration(visit.duration)}</span>
      <span style="display:flex;flex-wrap:wrap;gap:2px;flex-shrink:0">${tags}</span>
    </div>
  `;
}

export function buildTimelineHTML(events: AnyEvent[], sessionId: string): string {
  if (events.length === 0) {
    return `<div style="color:#718096;font-style:italic;padding:12px 0">Select a session to view its timeline.</div>`;
  }

  const isCurrentSession = sessionId === getSessionId();
  const visits = generateTimeline(events, isCurrentSession);

  if (visits.length === 0) {
    return `<div style="color:#718096;font-style:italic;padding:12px 0">No navigation data to display.</div>`;
  }

  const hasMultiplePages = visits.some(v => v.pagePath !== visits[0]!.pagePath);

  if (!hasMultiplePages) {
    const row = renderRow(visits[0]!, 0);
    return `
      <div style="color:#718096;font-size:11px;margin-bottom:8px">
        This session stayed on a single page. No navigation flow to show.
      </div>
      <div>${row}</div>
    `;
  }

  return `<div>${visits.map((v, i) => renderRow(v, i)).join('')}</div>`;
}

// Styles to inject into the panel style block
export const TIMELINE_STYLES = `
  .${PREFIX}-tl-row:hover {
    background: #2a2a3e !important;
  }
  .${PREFIX}-filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: #1a2a3e;
    border: 1px solid #2b6cb0;
    border-radius: 4px;
    font-size: 11px;
    color: #bee3f8;
    margin-bottom: 10px;
  }
  .${PREFIX}-filter-bar strong {
    color: #90cdf4;
  }
  .${PREFIX}-filter-clear {
    background: none;
    border: none;
    color: #90cdf4;
    cursor: pointer;
    font-size: 11px;
    font-family: system-ui, sans-serif;
    padding: 0;
    margin-left: auto;
  }
  .${PREFIX}-filter-clear:hover { color: #fff; }
  .${PREFIX}-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid #2d3748;
    margin-bottom: 12px;
    flex-shrink: 0;
  }
  .${PREFIX}-tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #718096;
    cursor: pointer;
    font-size: 12px;
    font-family: system-ui, sans-serif;
    padding: 8px 14px;
    transition: color 0.15s, border-color 0.15s;
  }
  .${PREFIX}-tab:hover { color: #e2e8f0; }
  .${PREFIX}-tab.active {
    color: #06b6d4;
    border-bottom-color: #06b6d4;
  }
`;
