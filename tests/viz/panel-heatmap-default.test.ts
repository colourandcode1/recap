import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The heatmap should be visible as soon as the panel opens (first creation and
// every re-open), rather than requiring the researcher to find and click the
// toggle — this is what makes the tool's value obvious on first use.

vi.mock('../../src/storage/idb.js', () => ({
  getAllSessions: vi.fn(async () => [{ sessionId: 'session-123', startTime: 0, eventCount: 1 }]),
  getSessionEvents: vi.fn(async () => []),
  clearAllSessions: vi.fn(async () => undefined),
}));

vi.mock('../../src/storage/buffer.js', () => ({
  clearBuffer: vi.fn(),
}));

vi.mock('../../src/capture/session.js', () => ({
  getSessionId: vi.fn(() => 'session-123'),
  getSessionName: vi.fn(() => 'participant/01'),
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
  downloadFlowDiagram: vi.fn(() => true),
}));

vi.mock('../../src/capture/clicks.js', () => ({
  pauseClickCapture: vi.fn(),
  resumeClickCapture: vi.fn(),
}));

vi.mock('../../src/capture/navigation.js', () => ({
  pauseNavigationCapture: vi.fn(),
  resumeNavigationCapture: vi.fn(),
}));

vi.mock('../../src/capture/scroll.js', () => ({
  pauseScrollCapture: vi.fn(),
  resumeScrollCapture: vi.fn(),
}));

vi.mock('../../src/analysis/summarize.js', () => ({
  summarize: vi.fn(() => ({})),
}));

vi.mock('../../src/storage/export.js', () => ({
  exportJSON: vi.fn(() => true),
  exportCSV: vi.fn(() => true),
  exportSummaryJSON: vi.fn(() => true),
}));

vi.mock('../../src/viz/timeline-view.js', () => ({
  buildTimelineHTML: vi.fn(() => '<div>timeline</div>'),
  TIMELINE_STYLES: '',
}));

vi.mock('../../src/analysis/timeline.js', () => ({
  generateTimeline: vi.fn(() => []),
}));

import { renderHeatmap, showHeatmap } from '../../src/viz/heatmap.js';
import { openPanel, closePanel, destroyPanel } from '../../src/viz/panel.js';

describe('panel defaults the heatmap to visible', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => {
    destroyPanel();
    vi.restoreAllMocks();
  });

  it('shows the heatmap on first open', async () => {
    await openPanel();

    expect(showHeatmap).toHaveBeenCalled();
    expect(renderHeatmap).toHaveBeenCalled();
  });

  it('shows the heatmap again on re-open, even if it was closed', async () => {
    await openPanel();
    closePanel();
    vi.mocked(showHeatmap).mockClear();
    vi.mocked(renderHeatmap).mockClear();

    await openPanel();

    expect(showHeatmap).toHaveBeenCalled();
    expect(renderHeatmap).toHaveBeenCalled();
  });
});
