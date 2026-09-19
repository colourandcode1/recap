import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ClickEvent } from '../../src/types.js';
import { initHeatmapCanvas, renderHeatmap } from '../../src/viz/heatmap.js';

// jsdom has no real canvas backend, so getContext('2d') returns null unless a
// polyfill is installed. Stub a minimal 2D context that mimics the one real
// failure mode this is regression-testing: a real browser's getImageData
// throws IndexSizeError when asked for a 0-width/height region.
function stubCanvasContext() {
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
    // initHeatmapCanvas() builds a brush + gradient strip via two off-screen
    // canvases (createCircle/createColorGradient) before renderHeatmap() ever
    // runs, so those APIs need stubs too even though this test doesn't assert on them.
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => {
      if (w === 0 || h === 0) {
        throw new DOMException("Failed to execute 'getImageData': The source width is 0.", 'IndexSizeError');
      }
      return { data: new Uint8ClampedArray(w * h * 4) };
    }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  return ctx;
}

function makeClick(url: string): ClickEvent {
  return {
    sessionId: 's1',
    timestamp: 0,
    type: 'click',
    url,
    viewport: { width: 800, height: 600 },
    pageX: 100,
    pageY: 100,
    clientX: 100,
    clientY: 100,
    elementX: 0.5,
    elementY: 0.5,
    selector: 'button',
    tagName: 'BUTTON',
    label: null,
    nearestHeading: null,
    pageRegion: 'center',
  };
}

describe('heatmap renderer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('location', { pathname: '/', href: 'http://localhost/' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // initHeatmapCanvas() is a module-level singleton (no reset export), so
  // both the zero-size and real-size behaviours are exercised in one test
  // against the same canvas/context rather than across separate tests.
  it('skips drawing on a zero-size canvas without throwing, then renders normally once sized', () => {
    const ctx = stubCanvasContext();

    vi.stubGlobal('innerWidth', 0);
    vi.stubGlobal('innerHeight', 0);
    initHeatmapCanvas();
    ctx.getImageData.mockClear(); // drop the setup-time call from createColorGradient()

    expect(() => renderHeatmap([makeClick('/')])).not.toThrow();
    expect(ctx.getImageData).not.toHaveBeenCalled();

    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 600);

    renderHeatmap([makeClick('/')]);

    expect(ctx.getImageData).toHaveBeenCalled();
    expect(ctx.putImageData).toHaveBeenCalled();
  });
});
