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
      pageX: 10,
      pageY: 20,
      clientX: 10,
      clientY: 20,
      elementX: 0.5,
      elementY: 0.5,
      selector: 'button.cta',
      tagName: 'BUTTON',
      label: 'CTA',
      nearestHeading: null,
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

vi.mock('../../src/playback/launch.js', () => ({
  launchReplay: vi.fn(() => ({ stop: vi.fn() })),
}));

import { launchReplay } from '../../src/playback/launch.js';
import { openPanel, destroyPanel, isPanelOpen } from '../../src/viz/panel.js';

function getLastToastText(): string {
  const toasts = Array.from(document.querySelectorAll('.recap-panel-toast'));
  return (toasts[toasts.length - 1] as HTMLDivElement | undefined)?.textContent ?? '';
}

describe('panel replay entry points', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => {
    destroyPanel();
    vi.restoreAllMocks();
  });

  it('renders Replay and Import buttons', async () => {
    await openPanel();
    expect(document.querySelector('#recap-panel-btn-replay')).not.toBeNull();
    expect(document.querySelector('#recap-panel-btn-import-replay')).not.toBeNull();
    expect(document.querySelector('#recap-panel-replay-file')).not.toBeNull();
  });

  it('Replay button closes the panel and launches a replay of the loaded session', async () => {
    await openPanel();
    (document.querySelector('#recap-panel-btn-replay') as HTMLButtonElement).click();

    expect(launchReplay).toHaveBeenCalledTimes(1);
    const events = vi.mocked(launchReplay).mock.calls[0]![0];
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('click');
    expect(isPanelOpen()).toBe(false);
  });

  it('Import button opens the hidden file input', async () => {
    await openPanel();
    const input = document.querySelector('#recap-panel-replay-file') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => undefined);
    (document.querySelector('#recap-panel-btn-import-replay') as HTMLButtonElement).click();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('shows an error toast when the replay launcher throws', async () => {
    vi.mocked(launchReplay).mockImplementationOnce(() => {
      throw new Error('Nothing to replay — the session has no events.');
    });
    await openPanel();
    (document.querySelector('#recap-panel-btn-replay') as HTMLButtonElement).click();
    expect(getLastToastText()).toContain('Nothing to replay');
  });
});
