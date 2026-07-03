// Replay visuals — synthetic cursor, click ripples, navigation banner,
// viewport-mismatch warning. All elements carry data-ut-no-track so they can
// never be captured, and pointer-events: none so they never intercept input.

const PREFIX = 'recap-replay';

let _layer: HTMLDivElement | null = null;
let _cursor: HTMLDivElement | null = null;
let _banner: HTMLDivElement | null = null;
let _bannerTimer: ReturnType<typeof setTimeout> | null = null;
let _styleEl: HTMLStyleElement | null = null;

const STYLES = `
.${PREFIX}-layer {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 0;
  overflow: visible;
  pointer-events: none;
  z-index: 2147483000;
}
.${PREFIX}-cursor {
  position: absolute;
  width: 18px; height: 18px;
  margin: -3px 0 0 -3px;
  pointer-events: none;
  transition: opacity 200ms ease;
  opacity: 0;
  will-change: transform;
}
.${PREFIX}-cursor svg { display: block; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4)); }
.${PREFIX}-ripple {
  position: absolute;
  width: 36px; height: 36px;
  margin: -18px 0 0 -18px;
  border: 3px solid #4f7cff;
  border-radius: 50%;
  pointer-events: none;
  animation: ${PREFIX}-ripple 600ms ease-out forwards;
}
.${PREFIX}-ripple--missing { border-color: #e0a030; border-style: dashed; }
@keyframes ${PREFIX}-ripple {
  from { transform: scale(0.4); opacity: 1; }
  to   { transform: scale(1.6); opacity: 0; }
}
.${PREFIX}-target-outline {
  outline: 2px solid #4f7cff !important;
  outline-offset: 2px;
  transition: outline-color 400ms ease;
}
.${PREFIX}-banner {
  position: fixed;
  top: 16px; left: 50%;
  transform: translateX(-50%);
  background: #1c2333;
  color: #fff;
  font: 500 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 8px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  pointer-events: none;
  z-index: 2147483001;
  transition: opacity 250ms ease;
  opacity: 0;
}
`;

const CURSOR_SVG = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 1 L2 14 L5.5 11 L8 16.5 L10.5 15.5 L8 10 L12.5 10 Z" fill="#1c2333" stroke="#fff" stroke-width="1.2"/>
</svg>`;

function ensureLayer(): HTMLDivElement {
  if (_layer && document.body.contains(_layer)) return _layer;
  _styleEl = document.createElement('style');
  _styleEl.textContent = STYLES;
  document.head.appendChild(_styleEl);

  _layer = document.createElement('div');
  _layer.className = `${PREFIX}-layer`;
  _layer.setAttribute('data-ut-no-track', '');
  _layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_layer);
  return _layer;
}

export function initVisuals(): void {
  const layer = ensureLayer();
  _cursor = document.createElement('div');
  _cursor.className = `${PREFIX}-cursor`;
  _cursor.innerHTML = CURSOR_SVG;
  layer.appendChild(_cursor);
}

/** Position the synthetic cursor at page coordinates. */
export function moveCursor(pageX: number, pageY: number): void {
  if (!_cursor) return;
  _cursor.style.opacity = '1';
  _cursor.style.transform = `translate(${pageX}px, ${pageY}px)`;
}

export function hideCursor(): void {
  if (_cursor) _cursor.style.opacity = '0';
}

/**
 * Click ripple at page coordinates. `found` distinguishes a ripple anchored
 * to a live element from a fallback at recorded coordinates.
 */
export function showRipple(pageX: number, pageY: number, found: boolean): void {
  const layer = ensureLayer();
  const ripple = document.createElement('div');
  ripple.className = `${PREFIX}-ripple${found ? '' : ` ${PREFIX}-ripple--missing`}`;
  ripple.style.left = `${pageX}px`;
  ripple.style.top = `${pageY}px`;
  layer.appendChild(ripple);
  setTimeout(() => ripple.remove(), 700);
}

/** Briefly outline the element a replayed click resolved to. */
export function flashTarget(el: Element): void {
  el.classList.add(`${PREFIX}-target-outline`);
  setTimeout(() => el.classList.remove(`${PREFIX}-target-outline`), 800);
}

/** Transient top-center banner (navigation, reload notices). */
export function showBanner(message: string, duration = 2200): void {
  if (!_banner || !document.body.contains(_banner)) {
    _banner = document.createElement('div');
    _banner.className = `${PREFIX}-banner`;
    _banner.setAttribute('data-ut-no-track', '');
    document.body.appendChild(_banner);
  }
  _banner.textContent = message;
  // Force a reflow so repeated banners re-trigger the transition
  void _banner.offsetHeight;
  _banner.style.opacity = '1';
  if (_bannerTimer !== null) clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(() => {
    if (_banner) _banner.style.opacity = '0';
  }, duration);
}

export function destroyVisuals(): void {
  if (_bannerTimer !== null) {
    clearTimeout(_bannerTimer);
    _bannerTimer = null;
  }
  _banner?.remove();
  _banner = null;
  _cursor = null;
  _layer?.remove();
  _layer = null;
  _styleEl?.remove();
  _styleEl = null;
}
