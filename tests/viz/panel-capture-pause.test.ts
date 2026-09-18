import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Regression coverage for the bug where researcher interaction with the panel
// (e.g. clicking through pages in the Timeline tab) was captured as if it were
// real participant activity. Click capture already paused/resumed correctly;
// this asserts navigation and scroll capture now do too.

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

import { pauseClickCapture, resumeClickCapture } from '../../src/capture/clicks.js';
import { pauseNavigationCapture, resumeNavigationCapture } from '../../src/capture/navigation.js';
import { pauseScrollCapture, resumeScrollCapture } from '../../src/capture/scroll.js';
import { openPanel, closePanel, destroyPanel } from '../../src/viz/panel.js';

describe('panel pauses/resumes all capture layers, not just clicks', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => {
    destroyPanel();
    vi.restoreAllMocks();
  });

  it('pauses click, navigation, and scroll capture on first open', async () => {
    await openPanel();

    expect(pauseClickCapture).toHaveBeenCalled();
    expect(pauseNavigationCapture).toHaveBeenCalled();
    expect(pauseScrollCapture).toHaveBeenCalled();
  });

  it('resumes click, navigation, and scroll capture on close', async () => {
    await openPanel();
    closePanel();

    expect(resumeClickCapture).toHaveBeenCalled();
    expect(resumeNavigationCapture).toHaveBeenCalled();
    expect(resumeScrollCapture).toHaveBeenCalled();
  });

  it('pauses navigation and scroll capture again on re-open, not just first creation', async () => {
    await openPanel();
    closePanel();
    vi.mocked(pauseNavigationCapture).mockClear();
    vi.mocked(pauseScrollCapture).mockClear();

    await openPanel();

    expect(pauseNavigationCapture).toHaveBeenCalled();
    expect(pauseScrollCapture).toHaveBeenCalled();
  });
});
