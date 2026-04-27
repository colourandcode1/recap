import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/storage/idb.js', () => ({
  getAllSessions: vi.fn(async () => [
    { sessionId: 'session-12345678', startTime: 0, eventCount: 1 },
  ]),
  getSessionEvents: vi.fn(async () => [
    { type: 'click', timestamp: 10, sessionId: 'session-12345678', x: 10, y: 20, selector: 'button', label: 'CTA' },
  ]),
  clearAllSessions: vi.fn(async () => undefined),
}));

vi.mock('../../src/storage/buffer.js', () => ({
  clearBuffer: vi.fn(),
}));

vi.mock('../../src/capture/session.js', () => ({
  getSessionId: vi.fn(() => 'session-12345678'),
  getSessionName: vi.fn(() => null),
}));

vi.mock('../../src/viz/heatmap.js', () => ({
  renderHeatmap: vi.fn(),
  showHeatmap: vi.fn(),
  hideHeatmap: vi.fn(),
  isHeatmapVisible: vi.fn(() => false),
  initHeatmapCanvas: vi.fn(),
}));

vi.mock('../../src/viz/scroll-depth.js', () => ({
  showScrollDepthOverlay: vi.fn(),
  hideScrollDepthOverlay: vi.fn(),
  isScrollDepthVisible: vi.fn(() => false),
  updateScrollDepthOverlay: vi.fn(),
}));

vi.mock('../../src/viz/screenshot.js', () => ({
  enterScreenshotMode: vi.fn(),
  downloadHeatmapPNG: vi.fn(),
}));

vi.mock('../../src/viz/flow-diagram.js', () => ({
  downloadFlowDiagram: vi.fn(),
}));

vi.mock('../../src/capture/clicks.js', () => ({
  pauseClickCapture: vi.fn(),
  resumeClickCapture: vi.fn(),
}));

vi.mock('../../src/analysis/summarize.js', () => ({
  summarize: vi.fn(() => ({})),
}));

vi.mock('../../src/storage/export.js', () => ({
  exportJSON: vi.fn(),
  exportCSV: vi.fn(),
  exportSummaryJSON: vi.fn(),
}));

vi.mock('../../src/viz/timeline-view.js', () => ({
  buildTimelineHTML: vi.fn(() => '<div>timeline</div>'),
  TIMELINE_STYLES: '',
}));

vi.mock('../../src/analysis/timeline.js', () => ({
  generateTimeline: vi.fn(() => []),
}));

import { openPanel, destroyPanel } from '../../src/viz/panel.js';

describe('participant guidance in panel', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    destroyPanel();
    vi.restoreAllMocks();
  });

  it('renders session tooltip content beside the session label', async () => {
    await openPanel();

    const labelWithHelp = document.querySelector('#recap-panel-session-help-wrap');
    expect(labelWithHelp?.textContent).toContain('Session');
    expect(
      labelWithHelp?.textContent
    ).toContain('To add another participant, open this prototype in a new tab.');
  });

  it('tracks tooltip hover and open-tab clicks', async () => {
    const events: Array<{ action: string }> = [];
    window.addEventListener('recap:participant-guidance', (event) => {
      const custom = event as CustomEvent<{ action: string }>;
      events.push(custom.detail);
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => window);

    await openPanel();
    (document.querySelector('#recap-panel-session-help-wrap') as HTMLDivElement).dispatchEvent(
      new MouseEvent('mouseenter', { bubbles: true })
    );
    (document.querySelector('.recap-panel-btn-open-participant') as HTMLButtonElement).click();

    expect(openSpy).toHaveBeenCalledWith(location.href, '_blank', 'noopener,noreferrer');
    expect(events.some((e) => e.action === 'tooltip_opened')).toBe(true);
    expect(events.some((e) => e.action === 'open_tab_clicked')).toBe(true);
  });
});
