// Scroll depth overlay — gradient bar on the right edge of the viewport.

import type { ScrollEvent } from '../types.js';

let _overlay: HTMLDivElement | null = null;
let _label: HTMLDivElement | null = null;

export function initScrollDepthOverlay(): void {
  if (_overlay) return;

  _overlay = document.createElement('div');
  _overlay.setAttribute('aria-hidden', 'true');
  _overlay.style.cssText = `
    position: fixed;
    right: 0;
    top: 0;
    width: 12px;
    height: 100vh;
    z-index: 9998;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      #22c55e 0%,
      #eab308 50%,
      #ef4444 100%
    );
    opacity: 0;
    transition: opacity 0.3s;
    display: none;
  `;

  _label = document.createElement('div');
  _label.setAttribute('aria-hidden', 'true');
  _label.style.cssText = `
    position: fixed;
    right: 16px;
    z-index: 9999;
    pointer-events: none;
    font: 11px/1 system-ui, sans-serif;
    color: #fff;
    background: rgba(0,0,0,0.65);
    padding: 2px 5px;
    border-radius: 3px;
    display: none;
  `;

  document.body.appendChild(_overlay);
  document.body.appendChild(_label);
}

export function updateScrollDepthOverlay(events: ScrollEvent[]): void {
  if (!_overlay || !_label) return;

  if (events.length === 0) {
    _overlay.style.opacity = '0';
    _label.style.display = 'none';
    return;
  }

  // Group by URL, get max depth per page
  const byUrl = new Map<string, number>();
  for (const e of events) {
    const prev = byUrl.get(e.url) ?? 0;
    if (e.maxDepth > prev) byUrl.set(e.url, e.maxDepth);
  }

  // Use current page depth
  const currentUrl = location.pathname;
  const depth = byUrl.get(currentUrl) ?? Math.max(...Array.from(byUrl.values()));

  // Render a marker line at depth%
  const markerY = (depth / 100) * window.innerHeight;
  _label.style.top = `${Math.max(0, markerY - 14)}px`;
  _label.textContent = `Max scroll: ${depth}%`;
  _label.style.display = 'block';
}

export function showScrollDepthOverlay(events: ScrollEvent[]): void {
  if (!_overlay) initScrollDepthOverlay();
  if (_overlay) {
    _overlay.style.display = 'block';
    setTimeout(() => { if (_overlay) _overlay.style.opacity = '0.7'; }, 10);
  }
  if (_label) _label.style.display = 'block';
  updateScrollDepthOverlay(events);
}

export function hideScrollDepthOverlay(): void {
  if (_overlay) {
    _overlay.style.opacity = '0';
    setTimeout(() => { if (_overlay) _overlay.style.display = 'none'; }, 300);
  }
  if (_label) _label.style.display = 'none';
}

export function isScrollDepthVisible(): boolean {
  if (!_overlay) return false;
  return _overlay.style.display !== 'none';
}

export function destroyScrollDepthOverlay(): void {
  _overlay?.parentElement?.removeChild(_overlay);
  _label?.parentElement?.removeChild(_label);
  _overlay = null;
  _label = null;
}
