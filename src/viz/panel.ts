// Floating researcher control panel — bottom-right corner, dark theme.
// All styles are inline to avoid CSS conflicts with host app.

import type { AnyEvent, ClickEvent, ScrollEvent, NavigationEvent } from '../types.js';
import { summarize } from '../analysis/summarize.js';
import { exportJSON, exportCSV, exportSummaryJSON } from '../storage/export.js';
import { clearAllSessions, getAllSessions, getSessionEvents } from '../storage/idb.js';
import { clearBuffer } from '../storage/buffer.js';
import {
  renderHeatmap,
  showHeatmap,
  hideHeatmap,
  isHeatmapVisible,
  initHeatmapCanvas,
  type HeatmapFilter,
} from './heatmap.js';
import { showScrollDepthOverlay, hideScrollDepthOverlay, isScrollDepthVisible, updateScrollDepthOverlay } from './scroll-depth.js';
import { enterScreenshotMode, downloadHeatmapPNG } from './screenshot.js';
import { downloadFlowDiagram } from './flow-diagram.js';
import { getSessionId, getSessionName } from '../capture/session.js';
import { pauseClickCapture, resumeClickCapture } from '../capture/clicks.js';
import { buildTimelineHTML, TIMELINE_STYLES } from './timeline-view.js';
import { generateTimeline } from '../analysis/timeline.js';

const PREFIX = 'recap-panel';
const PARTICIPANT_GUIDANCE_METRICS_KEY = 'recap-participant-guidance-metrics';
const PARTICIPANT_GUIDANCE_EVENT = 'recap:participant-guidance';
const RECAP_DOCS_URL = 'https://www.recap-ux.com';

type ParticipantGuidanceAction =
  | 'tooltip_opened'
  | 'open_tab_clicked';

// Minimal line-icon set (lucide-style: 24x24 viewBox, currentColor stroke) —
// replaces emoji glyphs, which read as decorative/colourful rather than the
// flat, monochrome icon language shadcn/ui uses.
function icon(inner: string, size = 14): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${inner}</svg>`;
}

const ICONS = {
  zap: icon('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  close: icon('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>', 15),
  flame: icon(
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'
  ),
  scrollDepth: icon(
    '<line x1="12" y1="3" x2="12" y2="21"/><polyline points="7 8 12 3 17 8"/><polyline points="7 16 12 21 17 16"/>'
  ),
  camera: icon(
    '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>'
  ),
  sparkles:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"/></svg>',
  fileText: icon(
    '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><line x1="8" y1="12" x2="15" y2="12"/><line x1="8" y1="16" x2="15" y2="16"/>'
  ),
  barChart: icon(
    '<line x1="4" y1="20" x2="4" y2="4"/><line x1="4" y1="20" x2="20" y2="20"/><rect x="7" y="13" width="3" height="7"/><rect x="12" y="9" width="3" height="11"/><rect x="17" y="5" width="3" height="15"/>'
  ),
  image: icon(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'
  ),
  route: icon('<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 7c0 6 8 4 8 8"/>'),
  clock: icon('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>', 13),
  cursor:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><path d="M5 3l14 6-6 2-2 6z"/></svg>',
  layers: icon(
    '<rect x="4" y="4" width="10" height="10" rx="1.5"/><rect x="9" y="9" width="10" height="10" rx="1.5"/>',
    13
  ),
  arrowDown: icon('<line x1="12" y1="4" x2="12" y2="18"/><polyline points="7 13 12 18 17 13"/>', 13),
  chevronDown: icon('<polyline points="6 9 12 15 18 9"/>', 12),
} as const;

const STYLES = `
  .${PREFIX}-root {
    --background: #09090b;
    --foreground: #fafafa;
    --card: #18181b;
    --card-foreground: #fafafa;
    --popover: #18181b;
    --popover-foreground: #fafafa;
    --primary: #fafafa;
    --primary-hover: #e4e4e7;
    --primary-foreground: #18181b;
    --secondary: #27272a;
    --secondary-foreground: #fafafa;
    --muted: #27272a;
    --muted-foreground: #a1a1aa;
    --accent: #3f3f46;
    --accent-foreground: #fafafa;
    --destructive: #7f1d1d;
    --destructive-foreground: #fef2f2;
    --destructive-accent: #f87171;
    --success-accent: #4ade80;
    --border: #27272a;
    --input: #3f3f46;
    --ring: #71717a;
    --radius: 0.5rem;

    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    max-height: 70vh;
    background: var(--background);
    color: var(--foreground);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.4);
    z-index: 10000;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    user-select: none;
  }
  .${PREFIX}-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--card);
    border-bottom: 1px solid var(--border);
    cursor: move;
    flex-shrink: 0;
  }
  .${PREFIX}-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
    color: var(--foreground);
    letter-spacing: -0.01em;
  }
  .${PREFIX}-title-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: calc(var(--radius) - 3px);
    background: var(--secondary);
    color: var(--foreground);
  }
  .${PREFIX}-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    border-radius: calc(var(--radius) - 2px);
    color: var(--muted-foreground);
    cursor: pointer;
    padding: 0;
    transition: background 0.15s, color 0.15s;
  }
  .${PREFIX}-close:hover { background: var(--accent); color: var(--foreground); }
  .${PREFIX}-close:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--ring); }
  .${PREFIX}-body {
    padding: 14px 16px;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .${PREFIX}-content-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .${PREFIX}-tab-content {
    min-height: 170px;
  }
  .${PREFIX}-tab-content-timeline {
    min-height: 220px;
    display: flex;
    flex-direction: column;
  }
  .${PREFIX}-timeline-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .${PREFIX}-timeline-empty {
    min-height: 180px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 6px;
    color: var(--muted-foreground);
    text-align: center;
    padding: 10px 16px;
  }
  .${PREFIX}-timeline-empty-title {
    color: var(--foreground);
    font-size: 12px;
    font-weight: 600;
  }
  .${PREFIX}-timeline-empty-copy {
    font-size: 11px;
  }
  .${PREFIX}-section {
    margin-bottom: 16px;
  }
  .${PREFIX}-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted-foreground);
    margin-bottom: 8px;
  }
  .${PREFIX}-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .${PREFIX}-label-with-help {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .${PREFIX}-label-with-help .${PREFIX}-label {
    margin-bottom: 0;
  }
  .${PREFIX}-help-btn {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--secondary);
    color: var(--muted-foreground);
    font-size: 11px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .${PREFIX}-help-btn:hover,
  .${PREFIX}-help-btn:focus-visible {
    background: var(--accent);
    border-color: var(--ring);
    color: var(--foreground);
  }
  .${PREFIX}-help-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--ring); }
  .${PREFIX}-hint-tooltip {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    width: 250px;
    background: var(--popover);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    padding: 8px 10px;
    font-size: 11px;
    color: var(--popover-foreground);
    box-shadow: 0 4px 6px -4px rgba(0,0,0,0.4), 0 10px 15px -3px rgba(0,0,0,0.4);
    z-index: 2;
  }
  .${PREFIX}-label-with-help:hover .${PREFIX}-hint-tooltip,
  .${PREFIX}-label-with-help:focus-within .${PREFIX}-hint-tooltip {
    display: block;
  }
  .${PREFIX}-hint-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
  .${PREFIX}-inline-link {
    border: none;
    background: none;
    color: var(--muted-foreground);
    font-size: 11px;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    font-family: inherit;
  }
  .${PREFIX}-inline-link:hover { color: var(--foreground); }
  .${PREFIX}-docs-link-btn {
    border: 1px solid var(--input);
    border-radius: calc(var(--radius) - 2px);
    background: transparent;
    color: var(--foreground);
    font-size: 11px;
    line-height: 1;
    padding: 4px 8px;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s;
  }
  .${PREFIX}-docs-link-btn:hover,
  .${PREFIX}-docs-link-btn:focus-visible {
    background: var(--accent);
    border-color: var(--ring);
  }
  .${PREFIX}-docs-link-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--ring); }
  .${PREFIX}-select {
    width: 100%;
    appearance: none;
    -webkit-appearance: none;
    background-color: var(--background);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 14px 14px;
    color: var(--foreground);
    border: 1px solid var(--input);
    border-radius: calc(var(--radius) - 2px);
    box-shadow: 0 1px 2px rgba(0,0,0,0.3);
    padding: 6px 28px 6px 10px;
    font-size: 12px;
  }
  .${PREFIX}-select:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--ring); }
  .${PREFIX}-stats {
    display: flex;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    overflow: hidden;
  }
  .${PREFIX}-stat {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 4px;
    text-align: center;
    border-right: 1px solid var(--border);
  }
  .${PREFIX}-stat:last-child { border-right: none; }
  .${PREFIX}-stat-value {
    width: 100%;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .${PREFIX}-stat-key {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted-foreground);
  }
  .${PREFIX}-toggles {
    display: flex;
    gap: 8px;
  }
  .${PREFIX}-toggle {
    flex: 1;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 18px 8px;
    background: transparent;
    border: 1.5px solid var(--input);
    border-radius: var(--radius);
    color: var(--muted-foreground);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    text-align: center;
    transition: all 0.15s;
  }
  .${PREFIX}-toggle svg { width: 22px; height: 22px; }
  .${PREFIX}-toggle:hover { background: var(--accent); color: var(--foreground); }
  .${PREFIX}-toggle:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--ring); }
  .${PREFIX}-toggle.active {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--primary-foreground);
  }
  .${PREFIX}-export-primary {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    margin-bottom: 8px;
    background: var(--primary);
    border: none;
    border-radius: calc(var(--radius) - 2px);
    color: var(--primary-foreground);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    transition: background 0.15s;
  }
  .${PREFIX}-export-primary svg { width: 16px; height: 16px; }
  .${PREFIX}-export-primary:hover { background: var(--primary-hover); }
  .${PREFIX}-export-primary:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--ring); }
  .${PREFIX}-more-formats-wrap {
    position: relative;
    margin-top: 8px;
  }
  .${PREFIX}-more-formats {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
    background: none;
    border: none;
    color: var(--muted-foreground);
    font-size: 11px;
    font-weight: 500;
    font-family: inherit;
    padding: 2px 0;
    cursor: pointer;
  }
  .${PREFIX}-more-formats:hover { color: var(--foreground); }
  .${PREFIX}-more-formats svg { transition: transform 0.15s; }
  .${PREFIX}-more-formats.expanded svg { transform: rotate(180deg); }
  .${PREFIX}-formats-menu {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    width: 180px;
    background: var(--popover);
    color: var(--popover-foreground);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.4);
    padding: 4px;
    z-index: 5;
  }
  .${PREFIX}-formats-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 8px;
    background: none;
    border: none;
    border-radius: calc(var(--radius) - 4px);
    color: var(--popover-foreground);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }
  .${PREFIX}-formats-menu-item:hover,
  .${PREFIX}-formats-menu-item:focus-visible { background: var(--accent); outline: none; }
  .${PREFIX}-exports {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .${PREFIX}-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 8px 4px;
    background: var(--secondary);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    box-shadow: 0 1px 2px rgba(0,0,0,0.3);
    color: var(--secondary-foreground);
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    font-family: inherit;
    text-align: center;
    transition: background 0.15s, border-color 0.15s;
  }
  .${PREFIX}-btn:hover { background: var(--accent); }
  .${PREFIX}-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--ring); }
  .${PREFIX}-btn.primary {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--primary-foreground);
    box-shadow: none;
  }
  .${PREFIX}-btn.primary:hover { background: var(--primary-hover); }
  .${PREFIX}-btn.danger {
    background: var(--destructive);
    border-color: var(--destructive);
    color: var(--destructive-foreground);
    box-shadow: none;
  }
  .${PREFIX}-btn.danger:hover { background: #991b1b; }
  .${PREFIX}-footer {
    padding: 8px 14px;
    border-top: 1px solid var(--border);
    text-align: center;
    flex-shrink: 0;
  }
  .${PREFIX}-clear-link {
    background: none;
    border: none;
    color: var(--muted-foreground);
    font-size: 11px;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    font-family: inherit;
  }
  .${PREFIX}-clear-link:hover { color: var(--destructive-accent); }
  .${PREFIX}-toast {
    /* Note: rendered as a direct child of <body>, not \`.${PREFIX}-root\`,
       so it can't inherit that element's CSS variables — values here are
       literal, matching the same zinc/dark palette. */
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: #18181b;
    color: #fafafa;
    border: 1px solid #27272a;
    border-left: 3px solid #4ade80;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.4);
    z-index: 10001;
    animation: ${PREFIX}-fadein 0.2s ease;
  }
  .${PREFIX}-toast.${PREFIX}-toast-error {
    border-left-color: #f87171;
    color: #f87171;
  }
  @keyframes ${PREFIX}-fadein {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

let _panelRoot: HTMLDivElement | null = null;
let _styleEl: HTMLStyleElement | null = null;
let _currentSessionId: string = '';
let _allEvents: AnyEvent[] = [];
let _sessions: Awaited<ReturnType<typeof getAllSessions>> = [];
let _activeTab: 'heatmap' | 'timeline' = 'heatmap';
let _heatmapFilter: HeatmapFilter | null = null;
let _origPushState: typeof history.pushState | null = null;
let _hasTrackedTooltipOpened = false;
let _preferredPanelMinHeight = 0;
let _moreFormatsExpanded = false;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures in private browsing modes
  }
}

function trackParticipantGuidance(action: ParticipantGuidanceAction): void {
  const fallback = {
    tooltip_opened: 0,
    open_tab_clicked: 0,
  };
  let metrics = fallback;
  const raw = readStorage(PARTICIPANT_GUIDANCE_METRICS_KEY);
  if (raw) {
    try {
      metrics = { ...fallback, ...(JSON.parse(raw) as Partial<typeof fallback>) };
    } catch {
      metrics = fallback;
    }
  }
  metrics[action] += 1;
  writeStorage(PARTICIPANT_GUIDANCE_METRICS_KEY, JSON.stringify(metrics));

  window.dispatchEvent(
    new CustomEvent(PARTICIPANT_GUIDANCE_EVENT, {
      detail: { action, metrics, timestamp: Date.now() },
    })
  );
}

function openParticipantTab(): void {
  const tab = window.open(location.href, '_blank', 'noopener,noreferrer');
  if (tab) {
    trackParticipantGuidance('open_tab_clicked');
    showToast('Opened a participant tab.');
    return;
  }
  showToast('Unable to open a new tab. Please allow pop-ups for this site.', 2500, 'error');
}

function openDocsSite(): void {
  const tab = window.open(RECAP_DOCS_URL, '_blank', 'noopener,noreferrer');
  if (!tab) {
    showToast('Unable to open docs. Please allow pop-ups for this site.', 2500, 'error');
  }
}

function handleUrlChange(): void {
  if (!_panelRoot || _panelRoot.style.display === 'none') return;
  // Clear a visit-scoped filter if the user has navigated to a different page
  if (_heatmapFilter && _heatmapFilter.pagePath !== location.pathname) {
    _heatmapFilter = null;
  }
  if (isHeatmapVisible()) renderHeatmap(getClicks(_allEvents), _heatmapFilter ?? undefined);
  if (isScrollDepthVisible()) updateScrollDepthOverlay(getScrolls(_allEvents));
  render(_panelRoot, _sessions);
}

function handleOutsideClickForFormatsMenu(e: MouseEvent): void {
  if (!_moreFormatsExpanded || !_panelRoot) return;
  const wrap = _panelRoot.querySelector(`.${PREFIX}-more-formats-wrap`);
  if (wrap && !wrap.contains(e.target as Node)) {
    _moreFormatsExpanded = false;
    render(_panelRoot, _sessions);
  }
}

function injectStyles(): void {
  if (_styleEl) return;
  _styleEl = document.createElement('style');
  _styleEl.textContent = STYLES + TIMELINE_STYLES;
  document.head.appendChild(_styleEl);
}

function showToast(message: string, duration = 2500, tone: 'success' | 'error' = 'success'): void {
  const toast = document.createElement('div');
  toast.className = `${PREFIX}-toast ${tone === 'error' ? `${PREFIX}-toast-error` : ''}`.trim();
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.parentElement?.removeChild(toast), 300);
  }, duration);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m${Math.round(seconds % 60)}s`;
}

async function loadSessionData(sessionId: string): Promise<AnyEvent[]> {
  try {
    return await getSessionEvents(sessionId);
  } catch {
    return [];
  }
}

function getClicks(events: AnyEvent[]): ClickEvent[] {
  return events.filter((e): e is ClickEvent => e.type === 'click');
}

function getScrolls(events: AnyEvent[]): ScrollEvent[] {
  return events.filter((e): e is ScrollEvent => e.type === 'scroll');
}

function getNavs(events: AnyEvent[]): NavigationEvent[] {
  return events.filter((e): e is NavigationEvent => e.type === 'navigation');
}

function getStats(events: AnyEvent[]): {
  clicks: number;
  pages: number;
  duration: number;
  maxScroll: number;
} {
  const navs = getNavs(events);
  const scrolls = getScrolls(events);
  const pages = new Set(navs.map((n) => n.to).filter(Boolean)).size;
  const pageScrolls = scrolls.filter((s) => s.url === location.pathname);
  const maxScroll = pageScrolls.reduce((m, s) => Math.max(m, s.maxDepth), 0);
  const duration =
    events.length > 1
      ? Math.round((events[events.length - 1]!.timestamp - events[0]!.timestamp) / 1000)
      : 0;
  return {
    clicks: getClicks(events).length,
    pages,
    duration,
    maxScroll,
  };
}

export async function openPanel(): Promise<void> {
  if (_panelRoot) {
    // Refresh data each time the panel is re-opened
    try { _sessions = await getAllSessions(); } catch { /* ignore */ }
    _allEvents = await loadSessionData(_currentSessionId);
    if (isHeatmapVisible()) {
      renderHeatmap(getClicks(_allEvents), _heatmapFilter ?? undefined);
    }
    render(_panelRoot, _sessions);
    _panelRoot.style.display = 'flex';
    if (_activeTab === 'heatmap') syncPanelMinHeight(_panelRoot);
    pauseClickCapture();
    return;
  }

  injectStyles();
  initHeatmapCanvas();

  // Load sessions
  try { _sessions = await getAllSessions(); } catch { /* ignore */ }

  // Default to current session
  _currentSessionId = getSessionId();
  _allEvents = await loadSessionData(_currentSessionId);

  // Build panel DOM
  _panelRoot = document.createElement('div');
  _panelRoot.className = `${PREFIX}-root`;
  _panelRoot.setAttribute('data-recap-panel', 'true');
  _panelRoot.setAttribute('data-ut-no-track', '');

  render(_panelRoot, _sessions);
  document.body.appendChild(_panelRoot);
  if (_activeTab === 'heatmap') syncPanelMinHeight(_panelRoot);

  // Listen for SPA navigation so overlays stay in sync with the current page
  _origPushState = history.pushState.bind(history);
  history.pushState = function (state: unknown, title: string, url?: string | URL | null) {
    _origPushState!(state, title, url);
    handleUrlChange();
  };
  window.addEventListener('popstate', handleUrlChange);

  // Close the "more formats" menu on outside click
  document.addEventListener('click', handleOutsideClickForFormatsMenu);

  // Make draggable
  makeDraggable(_panelRoot);
  pauseClickCapture();
}

function render(
  root: HTMLDivElement,
  sessions: Awaited<ReturnType<typeof getAllSessions>>
): void {
  const stats = getStats(_allEvents);

  const sessionOptions = sessions
    .map(
      (s) =>
        `<option value="${s.sessionId}" ${s.sessionId === _currentSessionId ? 'selected' : ''}>
          ${s.sessionId.slice(0, 8)} (${s.eventCount} events)
        </option>`
    )
    .join('');

  const filterBar = _heatmapFilter
    ? `<div class="${PREFIX}-filter-bar">
         <span>Showing: <strong>${_heatmapFilter.pagePath}</strong>${_heatmapFilter.label ? ` — ${_heatmapFilter.label}` : ''}</span>
         <button class="${PREFIX}-filter-clear" id="${PREFIX}-btn-clear-filter">× clear</button>
       </div>`
    : '';

  const heatmapTabContent = `
    ${filterBar}
    <div class="${PREFIX}-section">
      <div class="${PREFIX}-label">View</div>
      <div class="${PREFIX}-toggles">
        <button class="${PREFIX}-toggle ${isHeatmapVisible() ? 'active' : ''}" id="${PREFIX}-toggle-heatmap">
          ${ICONS.flame}
          <span>Heatmap</span>
        </button>
        <button class="${PREFIX}-toggle ${isScrollDepthVisible() ? 'active' : ''}" id="${PREFIX}-toggle-scroll">
          ${ICONS.scrollDepth}
          <span>Scroll Depth</span>
        </button>
      </div>
    </div>

    <div class="${PREFIX}-section" style="margin-bottom:0;">
      <div class="${PREFIX}-stats">
        <div class="${PREFIX}-stat">
          <div class="${PREFIX}-stat-value">${stats.clicks}</div>
          <div class="${PREFIX}-stat-key">Clicks</div>
        </div>
        <div class="${PREFIX}-stat">
          <div class="${PREFIX}-stat-value">${stats.pages}</div>
          <div class="${PREFIX}-stat-key">Pages</div>
        </div>
        <div class="${PREFIX}-stat">
          <div class="${PREFIX}-stat-value">${formatDuration(stats.duration)}</div>
          <div class="${PREFIX}-stat-key">Duration</div>
        </div>
        <div class="${PREFIX}-stat">
          <div class="${PREFIX}-stat-value">${stats.maxScroll}%</div>
          <div class="${PREFIX}-stat-key">Scroll</div>
        </div>
      </div>
    </div>
  `;

  const timelineTabContent = `
    <div class="${PREFIX}-section ${PREFIX}-timeline-scroll">
      ${buildTimelineHTML(_allEvents, _currentSessionId)}
    </div>
  `;

  root.innerHTML = `
    <div class="${PREFIX}-header">
      <span class="${PREFIX}-title"><span class="${PREFIX}-title-icon">${ICONS.zap}</span>Recap</span>
      <button class="${PREFIX}-close" aria-label="Close panel">${ICONS.close}</button>
    </div>
    <div class="${PREFIX}-body">
      <div class="${PREFIX}-content-scroll">
        ${
          sessions.length > 0
            ? `<div class="${PREFIX}-section">
                 <div class="${PREFIX}-label-row">
                   <div class="${PREFIX}-label-with-help" id="${PREFIX}-session-help-wrap">
                     <div class="${PREFIX}-label">Session</div>
                     <button
                       class="${PREFIX}-help-btn"
                       id="${PREFIX}-session-help"
                       type="button"
                       aria-label="How to add another participant"
                     >i</button>
                     <div class="${PREFIX}-hint-tooltip" role="tooltip">
                          To add another participant, open this prototype in a new tab.
                          <div class="${PREFIX}-hint-actions">
                            <button class="${PREFIX}-inline-link ${PREFIX}-btn-open-participant" type="button">Open in new tab</button>
                          </div>
                     </div>
                   </div>
                   <button
                     class="${PREFIX}-docs-link-btn"
                     id="${PREFIX}-btn-docs-link"
                     type="button"
                     aria-label="Open Recap UX docs"
                   >Help</button>
                 </div>
                 <select class="${PREFIX}-select" id="${PREFIX}-session-select">
                   ${sessionOptions}
                 </select>
               </div>`
            : ''
        }

        <div class="${PREFIX}-tabs">
          <button class="${PREFIX}-tab ${_activeTab === 'heatmap' ? 'active' : ''}" data-tab="heatmap">Overview</button>
          <button class="${PREFIX}-tab ${_activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline">Timeline</button>
        </div>

        <div class="${PREFIX}-tab-content ${_activeTab === 'timeline' ? `${PREFIX}-tab-content-timeline` : ''}">
          ${_activeTab === 'heatmap' ? heatmapTabContent : timelineTabContent}
        </div>
      </div>

      <div class="${PREFIX}-section" style="margin-top:12px;margin-bottom:0;">
        <div class="${PREFIX}-label">Export</div>
        <button class="${PREFIX}-export-primary" id="${PREFIX}-btn-ai">${ICONS.sparkles}<span>Export for AI</span></button>
        <div class="${PREFIX}-exports">
          <button class="${PREFIX}-btn" id="${PREFIX}-btn-screenshot">Screenshot</button>
          <button class="${PREFIX}-btn" id="${PREFIX}-btn-json">Raw JSON</button>
          <button class="${PREFIX}-btn" id="${PREFIX}-btn-csv">CSV</button>
        </div>
        <div class="${PREFIX}-more-formats-wrap">
          <button class="${PREFIX}-more-formats ${_moreFormatsExpanded ? 'expanded' : ''}" id="${PREFIX}-btn-toggle-more-formats">
            <span>More formats</span>
            ${ICONS.chevronDown}
          </button>
          ${
            _moreFormatsExpanded
              ? `<div class="${PREFIX}-formats-menu" role="menu">
                   <button class="${PREFIX}-formats-menu-item" id="${PREFIX}-btn-heatmap-png" role="menuitem">${ICONS.image}<span>Heatmap PNG</span></button>
                   <button class="${PREFIX}-formats-menu-item" id="${PREFIX}-btn-flow" role="menuitem">${ICONS.route}<span>Flow SVG</span></button>
                 </div>`
              : ''
          }
        </div>
      </div>
    </div>
    <div class="${PREFIX}-footer">
      <button class="${PREFIX}-clear-link" id="${PREFIX}-btn-clear">Clear all session data</button>
    </div>
  `;

  bindEvents(root);
  syncPanelMinHeight(root);
}

function syncPanelMinHeight(root: HTMLDivElement): void {
  // Keep Timeline from collapsing when there is little/no timeline data by
  // reusing the latest "good" Overview height as a minimum panel height.
  if (_activeTab === 'heatmap') {
    root.style.minHeight = '';
    const measuredHeight = Math.round(root.getBoundingClientRect().height);
    if (measuredHeight > 0) {
      _preferredPanelMinHeight = measuredHeight;
    }
  }

  if (_preferredPanelMinHeight <= 0) return;
  const maxAllowedHeight = Math.floor(window.innerHeight * 0.7);
  root.style.minHeight = `${Math.min(_preferredPanelMinHeight, maxAllowedHeight)}px`;
}

function bindEvents(root: HTMLDivElement): void {
  // Close
  root.querySelector<HTMLButtonElement>(`.${PREFIX}-close`)?.addEventListener('click', () => {
    closePanel();
  });

  // Session select
  root
    .querySelector<HTMLSelectElement>(`#${PREFIX}-session-select`)
    ?.addEventListener('change', async (e) => {
      _currentSessionId = (e.target as HTMLSelectElement).value;
      _allEvents = await loadSessionData(_currentSessionId);
      _heatmapFilter = null;
      if (isHeatmapVisible()) {
        renderHeatmap(getClicks(_allEvents));
      }
      render(root, _sessions);
    });

  // "More formats" expand/collapse
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-toggle-more-formats`)
    ?.addEventListener('click', (e) => {
      // Stop this click from reaching the document-level outside-click
      // listener below: render() detaches this button, so by the time the
      // event bubbles to `document` its target is stale and would look like
      // an "outside" click, closing the menu the instant it opens.
      e.stopPropagation();
      _moreFormatsExpanded = !_moreFormatsExpanded;
      render(root, _sessions);
    });

  const sessionHelpWrap = root.querySelector<HTMLDivElement>(`#${PREFIX}-session-help-wrap`);
  const trackTooltipOpen = () => {
    if (!_hasTrackedTooltipOpened) {
      trackParticipantGuidance('tooltip_opened');
      _hasTrackedTooltipOpened = true;
    }
  };
  sessionHelpWrap?.addEventListener('mouseenter', trackTooltipOpen, { once: true });
  sessionHelpWrap?.addEventListener('focusin', trackTooltipOpen, { once: true });

  root.querySelectorAll<HTMLButtonElement>(`.${PREFIX}-btn-open-participant`).forEach((btn) => {
    btn.addEventListener('click', () => {
      openParticipantTab();
    });
  });

  root.querySelector<HTMLButtonElement>(`#${PREFIX}-btn-docs-link`)?.addEventListener('click', () => {
    openDocsSite();
  });

  // Tab switching
  root.querySelectorAll<HTMLButtonElement>(`.${PREFIX}-tab`).forEach((btn) => {
    btn.addEventListener('click', () => {
      _activeTab = (btn.dataset['tab'] as 'heatmap' | 'timeline') ?? 'heatmap';
      render(root, _sessions);
    });
  });

  // Timeline row click → navigate to page, switch to heatmap tab, apply visit filter
  root.querySelectorAll<HTMLDivElement>(`.${PREFIX}-tl-row`).forEach((row) => {
    row.addEventListener('click', () => {
      const visitIndex = parseInt(row.dataset['visitIndex'] ?? '0', 10);
      const timeline = generateTimeline(_allEvents);
      const visit = timeline[visitIndex];
      if (!visit) return;

      const totalVisits = timeline.filter((v) => v.pagePath === visit.pagePath).length;
      const label = totalVisits > 1 ? `visit ${visit.visitNumber} of ${totalVisits}` : '';

      _heatmapFilter = {
        pagePath: visit.pagePath,
        visitStartMs: visit.arrivalTime * 1000,
        visitEndMs: visit.duration !== null
          ? (visit.arrivalTime + visit.duration) * 1000
          : null,
        label,
      };
      // Navigate the SPA to the target page if needed.
      // Use _origPushState to avoid double-firing handleUrlChange, then dispatch
      // a synthetic popstate so the SPA router re-renders the page content.
      if (location.pathname !== visit.pagePath) {
        (_origPushState ?? history.pushState).call(history, null, '', visit.pagePath);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }

      renderHeatmap(getClicks(_allEvents), _heatmapFilter);
      if (!isHeatmapVisible()) showHeatmap();
      render(_panelRoot!, _sessions);
    });
  });

  // Clear heatmap filter
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-clear-filter`)
    ?.addEventListener('click', () => {
      _heatmapFilter = null;
      renderHeatmap(getClicks(_allEvents));
      render(root, _sessions);
    });

  // Heatmap toggle
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-toggle-heatmap`)
    ?.addEventListener('click', () => {
      if (isHeatmapVisible()) {
        hideHeatmap();
      } else {
        renderHeatmap(getClicks(_allEvents));
        showHeatmap();
      }
      render(root, _sessions);
    });

  // Scroll depth toggle
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-toggle-scroll`)
    ?.addEventListener('click', () => {
      if (isScrollDepthVisible()) {
        hideScrollDepthOverlay();
      } else {
        showScrollDepthOverlay(getScrolls(_allEvents));
      }
      render(root, _sessions);
    });

  // Screenshot mode
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-screenshot`)
    ?.addEventListener('click', () => {
      closePanel();
      renderHeatmap(getClicks(_allEvents));
      showHeatmap();
      enterScreenshotMode();
    });

  // Export AI
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-ai`)
    ?.addEventListener('click', () => {
      const sessionName = getSessionName() ?? undefined;
      const summary = summarize(_allEvents, sessionName);
      const didExport = exportSummaryJSON(summary, sessionName);
      if (didExport) {
        showToast('AI summary exported!');
      } else {
        showToast('AI summary export failed. Check browser download permissions.', 3000, 'error');
      }
    });

  // Raw JSON
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-json`)
    ?.addEventListener('click', () => {
      const didExport = exportJSON(_allEvents, getSessionName() ?? undefined);
      if (didExport) {
        showToast('JSON exported!');
      } else {
        showToast('JSON export failed. Check browser download permissions.', 3000, 'error');
      }
    });

  // CSV
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-csv`)
    ?.addEventListener('click', () => {
      const didExport = exportCSV(_allEvents, getSessionName() ?? undefined);
      if (didExport) {
        showToast('CSV exported!');
      } else {
        showToast('CSV export failed. Check browser download permissions.', 3000, 'error');
      }
    });

  // Heatmap PNG
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-heatmap-png`)
    ?.addEventListener('click', () => {
      renderHeatmap(getClicks(_allEvents));
      downloadHeatmapPNG();
      _moreFormatsExpanded = false;
      render(root, _sessions);
      showToast('Heatmap PNG downloaded!');
    });

  // Flow SVG
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-flow`)
    ?.addEventListener('click', () => {
      const didExport = downloadFlowDiagram(getNavs(_allEvents), getSessionName() ?? undefined);
      _moreFormatsExpanded = false;
      render(root, _sessions);
      if (didExport) {
        showToast('Flow diagram downloaded!');
      } else {
        showToast('Flow export failed. Check browser download permissions.', 3000, 'error');
      }
    });

  // Clear data
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-clear`)
    ?.addEventListener('click', async () => {
      if (!confirm('Clear all Recap session data? This cannot be undone.')) return;
      try {
        await clearAllSessions();
        clearBuffer();
        _allEvents = [];
        _heatmapFilter = null;
        hideHeatmap();
        hideScrollDepthOverlay();
        _sessions = [];
        render(root, _sessions);
        showToast('All session data cleared.');
      } catch (err) {
        console.error('[Recap] Clear error:', err);
      }
    });
}

function makeDraggable(el: HTMLDivElement): void {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let origRight = 20;
  let origBottom = 20;

  // Listen on the stable root element rather than the header, which gets
  // replaced on every render() call. Query the header fresh on each mousedown.
  el.addEventListener('mousedown', (e) => {
    const header = el.querySelector<HTMLDivElement>(`.${PREFIX}-header`);
    if (!header?.contains(e.target as Node)) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origRight = parseInt(el.style.right || '20', 10);
    origBottom = parseInt(el.style.bottom || '20', 10);
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.right = `${origRight - dx}px`;
    el.style.bottom = `${origBottom - dy}px`;
    el.style.left = 'auto';
    el.style.top = 'auto';
  });

  document.addEventListener('mouseup', () => { isDragging = false; });
}

export function closePanel(): void {
  if (_panelRoot) _panelRoot.style.display = 'none';
  _moreFormatsExpanded = false;
  hideHeatmap();
  hideScrollDepthOverlay();
  resumeClickCapture();
}

export function isPanelOpen(): boolean {
  return _panelRoot !== null && _panelRoot.style.display !== 'none';
}

export function destroyPanel(): void {
  if (_origPushState) {
    history.pushState = _origPushState;
    _origPushState = null;
  }
  window.removeEventListener('popstate', handleUrlChange);
  document.removeEventListener('click', handleOutsideClickForFormatsMenu);
  _panelRoot?.parentElement?.removeChild(_panelRoot);
  _styleEl?.parentElement?.removeChild(_styleEl);
  _panelRoot = null;
  _styleEl = null;
  _preferredPanelMinHeight = 0;
  _moreFormatsExpanded = false;
}
