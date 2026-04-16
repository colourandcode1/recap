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
import { showScrollDepthOverlay, hideScrollDepthOverlay, isScrollDepthVisible } from './scroll-depth.js';
import { enterScreenshotMode, downloadHeatmapPNG } from './screenshot.js';
import { downloadFlowDiagram } from './flow-diagram.js';
import { getSessionId, getSessionName } from '../capture/session.js';
import { pauseClickCapture, resumeClickCapture } from '../capture/clicks.js';
import { buildTimelineHTML, TIMELINE_STYLES } from './timeline-view.js';
import { generateTimeline } from '../analysis/timeline.js';

const PREFIX = 'recap-panel';

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
    overflow-y: auto;
    padding: 12px 14px;
    flex: 1;
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
  @keyframes ${PREFIX}-fadein {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

let _panelRoot: HTMLDivElement | null = null;
let _styleEl: HTMLStyleElement | null = null;
let _currentSessionId: string = '';
let _allEvents: AnyEvent[] = [];
let _activeTab: 'heatmap' | 'timeline' = 'heatmap';
let _heatmapFilter: HeatmapFilter | null = null;

function injectStyles(): void {
  if (_styleEl) return;
  _styleEl = document.createElement('style');
  _styleEl.textContent = STYLES + TIMELINE_STYLES;
  document.head.appendChild(_styleEl);
}

function showToast(message: string, duration = 2500): void {
  const toast = document.createElement('div');
  toast.className = `${PREFIX}-toast`;
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
  const maxScroll = scrolls.reduce((m, s) => Math.max(m, s.maxDepth), 0);
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
    let sessions: Awaited<ReturnType<typeof getAllSessions>> = [];
    try { sessions = await getAllSessions(); } catch { /* ignore */ }
    _allEvents = await loadSessionData(_currentSessionId);
    if (isHeatmapVisible()) {
      renderHeatmap(getClicks(_allEvents));
    }
    render(_panelRoot, sessions);
    _panelRoot.style.display = 'flex';
    pauseClickCapture();
    return;
  }

  injectStyles();
  initHeatmapCanvas();

  // Load sessions
  let sessions: Awaited<ReturnType<typeof getAllSessions>> = [];
  try {
    sessions = await getAllSessions();
  } catch { /* ignore */ }

  // Default to current session
  _currentSessionId = getSessionId();
  _allEvents = await loadSessionData(_currentSessionId);

  // Build panel DOM
  _panelRoot = document.createElement('div');
  _panelRoot.className = `${PREFIX}-root`;
  _panelRoot.setAttribute('data-recap-panel', 'true');
  _panelRoot.setAttribute('data-ut-no-track', '');

  render(_panelRoot, sessions);
  document.body.appendChild(_panelRoot);

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
    <div class="${PREFIX}-section" style="overflow-y:auto;max-height:calc(70vh - 240px)">
      ${buildTimelineHTML(_allEvents, _currentSessionId)}
    </div>
  `;

  root.innerHTML = `
    <div class="${PREFIX}-header">
      <span class="${PREFIX}-title">⚡ Recap</span>
      <button class="${PREFIX}-close" aria-label="Close panel">×</button>
    </div>
    <div class="${PREFIX}-body">
      ${
        sessions.length > 0
          ? `<div class="${PREFIX}-section">
               <div class="${PREFIX}-label">Session</div>
               <select class="${PREFIX}-select" id="${PREFIX}-session-select">
                 ${sessionOptions}
               </select>
             </div>`
          : ''
      }

      <div class="${PREFIX}-tabs">
        <button class="${PREFIX}-tab ${_activeTab === 'heatmap' ? 'active' : ''}" data-tab="heatmap">Heatmap</button>
        <button class="${PREFIX}-tab ${_activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline">Timeline</button>
      </div>

      ${_activeTab === 'heatmap' ? heatmapTabContent : timelineTabContent}

      <div class="${PREFIX}-section">
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

  bindEvents(root, sessions);
}

function bindEvents(
  root: HTMLDivElement,
  sessions: Awaited<ReturnType<typeof getAllSessions>>
): void {
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
      _heatmapFilter = null; // clear filter when switching sessions
      if (isHeatmapVisible()) {
        renderHeatmap(getClicks(_allEvents));
      }
      render(root, sessions);
    });

  // Tab switching
  root.querySelectorAll<HTMLButtonElement>(`.${PREFIX}-tab`).forEach((btn) => {
    btn.addEventListener('click', () => {
      _activeTab = (btn.dataset['tab'] as 'heatmap' | 'timeline') ?? 'heatmap';
      render(root, sessions);
    });
  });

  // Timeline row click → switch to heatmap tab with visit filter
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

      _activeTab = 'heatmap';
      renderHeatmap(getClicks(_allEvents), _heatmapFilter);
      if (!isHeatmapVisible()) showHeatmap();
      render(root, sessions);
    });
  });

  // Clear heatmap filter
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-clear-filter`)
    ?.addEventListener('click', () => {
      _heatmapFilter = null;
      renderHeatmap(getClicks(_allEvents));
      render(root, sessions);
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
      render(root, sessions);
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
      render(root, sessions);
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
      exportSummaryJSON(summary, sessionName);
      showToast('AI summary exported!');
    });

  // Raw JSON
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-json`)
    ?.addEventListener('click', () => {
      exportJSON(_allEvents, getSessionName() ?? undefined);
      showToast('JSON exported!');
    });

  // CSV
  root
    .querySelector<HTMLButtonElement>(`#${PREFIX}-btn-csv`)
    ?.addEventListener('click', () => {
      exportCSV(_allEvents, getSessionName() ?? undefined);
      showToast('CSV exported!');
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
      downloadFlowDiagram(getNavs(_allEvents), getSessionName() ?? undefined);
      showToast('Flow diagram downloaded!');
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
        render(root, []);
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
  _panelRoot?.parentElement?.removeChild(_panelRoot);
  _styleEl?.parentElement?.removeChild(_styleEl);
  _panelRoot = null;
  _styleEl = null;
}
