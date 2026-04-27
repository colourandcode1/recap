import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/storage/idb.js', () => ({
  getAllSessions: vi.fn(async () => [{ sessionId: 'session-123', startTime: 0, eventCount: 1 }]),
  getSessionEvents: vi.fn(async () => [
    {
      type: 'click',
      sessionId: 'session-123',
      timestamp: 10,
      url: '/home',
      viewport: { width: 1280, height: 720 },
      x: 10,
      y: 20,
      pageX: 10,
      pageY: 20,
      clientX: 10,
      clientY: 20,
      selector: 'button.cta',
      tagName: 'BUTTON',
      label: 'CTA',
      pageRegion: 'center',
    },
  ]),
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

import { exportJSON } from '../../src/storage/export.js';
import { downloadFlowDiagram } from '../../src/viz/flow-diagram.js';
import { openPanel, destroyPanel } from '../../src/viz/panel.js';

function getLastToastText(): string {
  const toasts = Array.from(document.querySelectorAll('.recap-panel-toast'));
  return (toasts[toasts.length - 1] as HTMLDivElement | undefined)?.textContent ?? '';
}

describe('panel export feedback', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => {
    destroyPanel();
    vi.restoreAllMocks();
  });

  it('shows error toast when JSON export reports failure', async () => {
    vi.mocked(exportJSON).mockReturnValueOnce(false);
    await openPanel();

    (document.querySelector('#recap-panel-btn-json') as HTMLButtonElement).click();

    expect(getLastToastText()).toContain('JSON export failed');
  });

  it('shows error toast when flow export reports failure', async () => {
    vi.mocked(downloadFlowDiagram).mockReturnValueOnce(false);
    await openPanel();

    (document.querySelector('#recap-panel-btn-flow') as HTMLButtonElement).click();

    expect(getLastToastText()).toContain('Flow export failed');
  });
});
