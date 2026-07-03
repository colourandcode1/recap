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
import { launchReplay } from '../playback/launch.js';
import { parseSessionImport } from '../playback/import.js';

const PREFIX = 'recap-panel';
const PARTICIPANT_GUIDANCE_METRICS_KEY = 'recap-participant-guidance-metrics';
const PARTICIPANT_GUIDANCE_EVENT = 'recap:participant-guidance';
const RECAP_DOCS_URL = 'https://www.recap-ux.com';

type ParticipantGuidanceAction =
  | 'tooltip_opened'
  | 'open_tab_clicked';

const STYLES = `
  .${PREFIX}-root {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    max-height: 70vh;
    background: #1a1a2e;
    color: #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
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
    padding: 10px 14px;
    background: #16213e;
    border-bottom: 1px solid #2d3748;
    cursor: move;
    flex-shrink: 0;
  }
  .${PREFIX}-title {
    font-weight: 700;
    font-size: 14px;
    color: #4299e1;
    letter-spacing: 0.05em;
  }
  .${PREFIX}-close {
    background: none;
    border: none;
    color: #a0aec0;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0 4px;
  }
  .${PREFIX}-close:hover { color: #fff; }
  .${PREFIX}-body {
    padding: 12px 14px;
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
    color: #718096;
    text-align: center;
    padding: 10px 16px;
  }
  .${PREFIX}-timeline-empty-title {
    color: #a0aec0;
    font-size: 12px;
    font-weight: 600;
  }
  .${PREFIX}-timeline-empty-copy {
    font-size: 11px;
  }
  .${PREFIX}-section {
    margin-bottom: 14px;
  }
  .${PREFIX}-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #718096;
    margin-bottom: 6px;
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
    border: 1px solid #4a5568;
    background: #2d3748;
    color: #a0aec0;
    font-size: 11px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }
  .${PREFIX}-help-btn:hover,
  .${PREFIX}-help-btn:focus-visible {
    background: #3a4a6b;
    border-color: #4299e1;
    color: #bee3f8;
  }
  .${PREFIX}-hint-tooltip {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    width: 250px;
    background: #0f172a;
    border: 1px solid #2d4a74;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 11px;
    color: #dbeafe;
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
    color: #63b3ed;
    font-size: 11px;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    font-family: system-ui, sans-serif;
  }
  .${PREFIX}-inline-link:hover { color: #90cdf4; }
  .${PREFIX}-docs-link-btn {
    border: 1px solid #4a5568;
    border-radius: 4px;
    background: #2d3748;
    color: #bee3f8;
    font-size: 11px;
    line-height: 1;
    padding: 4px 8px;
    cursor: pointer;
    font-family: system-ui, sans-serif;
    white-space: nowrap;
  }
  .${PREFIX}-docs-link-btn:hover,
  .${PREFIX}-docs-link-btn:focus-visible {
    background: #3a4a6b;
    border-color: #4299e1;
    color: #e2e8f0;
  }
  .${PREFIX}-select {
    width: 100%;
    background: #2d3748;
    color: #e2e8f0;
    border: 1px solid #4a5568;
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 12px;
  }
  .${PREFIX}-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  .${PREFIX}-stat {
    background: #2d3748;
    border-radius: 4px;
    padding: 6px 8px;
    text-align: center;
  }
  .${PREFIX}-stat-value {
    font-size: 18px;
    font-weight: 700;
    color: #4299e1;
  }
  .${PREFIX}-stat-key {
    font-size: 10px;
    color: #718096;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .${PREFIX}-toggles {
    display: flex;
    gap: 8px;
  }
  .${PREFIX}-toggle {
    flex: 1;
    padding: 7px 6px;
    background: #2d3748;
    border: 1px solid #4a5568;
    border-radius: 4px;
    color: #a0aec0;
    cursor: pointer;
    font-size: 11px;
    font-family: system-ui, sans-serif;
    text-align: center;
    transition: all 0.15s;
  }
  .${PREFIX}-toggle:hover { background: #3a4a6b; color: #e2e8f0; }
  .${PREFIX}-toggle.active {
    background: #2b6cb0;
    border-color: #4299e1;
    color: #bee3f8;
  }
  .${PREFIX}-flow {
    background: #0f0f23;
    border-radius: 4px;
    padding: 8px;
    max-height: 120px;
    overflow-y: auto;
    font-size: 11px;
    color: #a0aec0;
  }
  .${PREFIX}-flow-item {
    padding: 2px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .${PREFIX}-flow-arrow {
    color: #4299e1;
    margin: 0 4px;
  }
  .${PREFIX}-exports {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .${PREFIX}-btn {
    padding: 7px 4px;
    background: #2d3748;
    border: 1px solid #4a5568;
    border-radius: 4px;
    color: #e2e8f0;
    cursor: pointer;
    font-size: 10px;
    font-family: system-ui, sans-serif;
    text-align: center;
    transition: background 0.15s;
  }
  .${PREFIX}-btn:hover { background: #3a4a6b; }
  .${PREFIX}-btn.primary {
    background: #2b6cb0;
    border-color: #4299e1;
    color: #bee3f8;
  }
  .${PREFIX}-btn.primary:hover { background: #2c5282; }
  .${PREFIX}-btn.danger {
    background: #742a2a;
    border-color: #fc8181;
    color: #fed7d7;
  }
  .${PREFIX}-btn.danger:hover { background: #9b2c2c; }
  .${PREFIX}-footer {
    padding: 8px 14px;
    border-top: 1px solid #2d3748;
    text-align: center;
    flex-shrink: 0;
  }
  .${PREFIX}-clear-link {
    background: none;
    border: none;
    color: #718096;
    font-size: 11px;
    cursor: pointer;
    text-decoration: underline;
    font-family: system-ui, sans-serif;
  }
  .${PREFIX}-clear-link:hover { color: #fc8181; }
  .${PREFIX}-toast {
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: #276749;
    color: #c6f6d5;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-family: system-ui, sans-serif;
    z-index: 10001;
    animation: ${PREFIX}-fadein 0.2s ease;
  }
  .${PREFIX}-toast.${PREFIX}-toast-error {
    background: #742a2a;
    color: #fed7d7;
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

function buildNavFlowHTML(events: AnyEvent[]): string {
  const navs = getNavs(events).filter((n) => n.to);
  if (navs.length === 0) return '<div style="color:#718096;font-style:italic">No navigation recorded</div>';

  const path = navs.map((n) => n.to);
  let html = '';
  for (let i = 0; i < path.length; i++) {
    const url = path[i]!;
    html += `<div class="${PREFIX}-flow-item">`;
    if (i > 0) html += `<span class="${PREFIX}-flow-arrow">→</span>`;
    html += `<span title="${url}">${url}</span>`;
    html += '</div>';
  }
  return html;
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
      <div class="${PREFIX}-label">Stats</div>
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
          <div class="${PREFIX}-stat-key">Max Scroll</div>
        </div>
      </div>
    </div>

    <div class="${PREFIX}-section">
      <div class="${PREFIX}-label">Overlays</div>
      <div class="${PREFIX}-toggles">
        <button class="${PREFIX}-toggle ${isHeatmapVisible() ? 'active' : ''}" id="${PREFIX}-toggle-heatmap">
          🔥 Heatmap
        </button>
        <button class="${PREFIX}-toggle ${isScrollDepthVisible() ? 'active' : ''}" id="${PREFIX}-toggle-scroll">
          📏 Scroll Depth
        </button>
      </div>
    </div>

    <div class="${PREFIX}-section">
      <div class="${PREFIX}-label">Navigation Flow</div>
      <div class="${PREFIX}-flow">${buildNavFlowHTML(_allEvents)}</div>
    </div>
  `;

  const timelineTabContent = `
    <div class="${PREFIX}-section ${PREFIX}-timeline-scroll">
      ${buildTimelineHTML(_allEvents, _currentSessionId)}
    </div>
  `;

  root.innerHTML = `
    <div class="${PREFIX}-header">
      <span class="${PREFIX}-title">⚡ Recap</span>
      <button class="${PREFIX}-close" aria-label="Close panel">×</button>
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

        <div class="${PREFIX}-section">
          <div class="${PREFIX}-label">Replay</div>
          <div class="${PREFIX}-exports">
            ${
              sessions.length > 0
                ? `<button class="${PREFIX}-btn primary" id="${PREFIX}-btn-replay">▶ Replay session</button>`
                : ''
            }
            <button class="${PREFIX}-btn" id="${PREFIX}-btn-import-replay">📂 Import JSON…</button>
          </div>
          <input type="file" id="${PREFIX}-replay-file" accept="application/json,.json" style="display:none" />
        </div>

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
        <div class="${PREFIX}-exports">
          <button class="${PREFIX}-btn primary" id="${PREFIX}-btn-screenshot">📸 Screenshot</button>
          <button class="${PREFIX}-btn primary" id="${PREFIX}-btn-ai">🤖 Export AI</button>
          <button class="${PREFIX}-btn" id="${PREFIX}-btn-json">📄 Raw JSON</button>
          <button class="${PREFIX}-btn" id="${PREFIX}-btn-csv">📊 CSV</button>
          <button class="${PREFIX}-btn" id="${PREFIX}-btn-heatmap-png">🖼 Heatmap PNG</button>
          <button class="${PREFIX}-btn" id="${PREFIX}-btn-flow">🗺 Flow SVG</button>
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

  // Replay current session
  root.querySelector<HTMLButtonElement>(`#${PREFIX}-btn-replay`)?.addEventListener('click', () => {
    if (_allEvents.length === 0) {
      showToast('No events in this session to replay.', 2500, 'error');
      return;
    }
    try {
      closePanel();
      launchReplay(_allEvents);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Replay failed to start.', 3000, 'error');
    }
  });

  // Import a session JSON export and replay it
  const replayFileInput = root.querySelector<HTMLInputElement>(`#${PREFIX}-replay-file`);
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-import-replay`)
    ?.addEventListener('click', () => replayFileInput?.click());
  replayFileInput?.addEventListener('change', () => {
    const file = replayFileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      replayFileInput.value = ''; // allow re-importing the same file
      const result = parseSessionImport(String(reader.result ?? ''));
      if (!result.ok) {
        showToast(result.error, 3000, 'error');
        return;
      }
      try {
        closePanel();
        launchReplay(result.events);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Replay failed to start.', 3000, 'error');
      }
    };
    reader.onerror = () => showToast('Could not read the selected file.', 3000, 'error');
    reader.readAsText(file);
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
      showToast('Heatmap PNG downloaded!');
    });

  // Flow SVG
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-flow`)
    ?.addEventListener('click', () => {
      const didExport = downloadFlowDiagram(getNavs(_allEvents), getSessionName() ?? undefined);
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
  _panelRoot?.parentElement?.removeChild(_panelRoot);
  _styleEl?.parentElement?.removeChild(_styleEl);
  _panelRoot = null;
  _styleEl = null;
  _preferredPanelMinHeight = 0;
}
