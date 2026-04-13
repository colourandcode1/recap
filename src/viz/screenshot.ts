// Screenshot mode — instructs user to use OS screenshot tool while heatmap is visible.

import { getHeatmapDataURL } from './heatmap.js';

let _screenshotOverlay: HTMLDivElement | null = null;
let _escHandler: ((e: KeyboardEvent) => void) | null = null;

function buildFilename(): string {
  return `recap-heatmap-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
}

export function enterScreenshotMode(): void {
  if (_screenshotOverlay) return;

  // Temporarily set heatmap to full opacity and white background signal
  const heatmapCanvas = document.querySelector<HTMLCanvasElement>('canvas[aria-hidden="true"]');
  const prevOpacity = heatmapCanvas?.style.opacity;
  if (heatmapCanvas) heatmapCanvas.style.opacity = '1';

  _screenshotOverlay = document.createElement('div');
  _screenshotOverlay.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.85);
    color: #fff;
    font: 14px/1.5 system-ui, sans-serif;
    padding: 14px 20px;
    border-radius: 8px;
    z-index: 10001;
    text-align: center;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    max-width: 420px;
  `;

  const isMac =
    typeof navigator !== 'undefined' &&
    (navigator.platform?.toLowerCase().includes('mac') ||
      (navigator as unknown as { userAgentData?: { platform: string } }).userAgentData?.platform
        ?.toLowerCase()
        .includes('mac'));

  const shortcut = isMac ? 'Cmd+Shift+4' : 'Win+Shift+S';
  _screenshotOverlay.innerHTML = `
    <strong>Heatmap overlay is visible</strong><br>
    Take a screenshot now.<br>
    <small>${shortcut} on ${isMac ? 'Mac' : 'Windows'} · Press <kbd style="background:#333;padding:1px 5px;border-radius:3px">Esc</kbd> to exit screenshot mode</small>
  `;
  document.body.appendChild(_screenshotOverlay);

  _escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') exitScreenshotMode(heatmapCanvas, prevOpacity);
  };
  document.addEventListener('keydown', _escHandler);

  // Auto-exit after 30 seconds
  setTimeout(() => exitScreenshotMode(heatmapCanvas, prevOpacity), 30_000);
}

function exitScreenshotMode(
  canvas: HTMLCanvasElement | null,
  prevOpacity: string | undefined
): void {
  if (canvas && prevOpacity !== undefined) canvas.style.opacity = prevOpacity;
  if (_screenshotOverlay) {
    _screenshotOverlay.parentElement?.removeChild(_screenshotOverlay);
    _screenshotOverlay = null;
  }
  if (_escHandler) {
    document.removeEventListener('keydown', _escHandler);
    _escHandler = null;
  }
}

/** Download the heatmap canvas layer as a transparent PNG. */
export function downloadHeatmapPNG(): void {
  const dataUrl = getHeatmapDataURL();
  if (!dataUrl) {
    console.warn('[Recap] Heatmap canvas not initialized');
    return;
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = buildFilename();
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
