// Scroll depth tracking — hybrid IntersectionObserver + rAF throttled listener.

import type { ScrollEvent } from '../types.js';
import { getSessionId, getTimestamp } from './session.js';
import { sanitizeUrl } from '../privacy/sanitize.js';

type ScrollHandler = (event: ScrollEvent) => void;

const MILESTONES = [25, 50, 75, 100];
const INCREMENT_THRESHOLD = 5; // log every 5% change in continuous mode

let _handler: ScrollHandler | null = null;
let _stripQuery = true;
let _maxDepth = 0;
let _lastLoggedDepth = 0;
let _sentinels: HTMLDivElement[] = [];
let _observer: IntersectionObserver | null = null;
let _rafId: number | null = null;
let _resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let _cleanupFns: Array<() => void> = [];

function getScrollDepth(): number {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight
  );
  const viewHeight = window.innerHeight;
  const scrollable = docHeight - viewHeight;
  if (scrollable <= 0) return 100;
  return Math.min(100, Math.round((scrollTop / scrollable) * 100));
}

function emitScroll(depth: number): void {
  if (!_handler) return;
  _maxDepth = Math.max(_maxDepth, depth);

  const event: ScrollEvent = {
    sessionId: getSessionId(),
    timestamp: getTimestamp(),
    type: 'scroll',
    url: sanitizeUrl(location.href, _stripQuery),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    depth,
    maxDepth: _maxDepth,
  };

  try {
    _handler(event);
  } catch (err) {
    console.error('[Recap] Scroll event error:', err);
  }
}

// --- Sentinel injection for IntersectionObserver milestones ---

function createSentinels(): void {
  removeSentinels();
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );

  _sentinels = MILESTONES.map((pct) => {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-recap-sentinel', String(pct));
    Object.assign(el.style, {
      position: 'absolute',
      height: '1px',
      width: '1px',
      opacity: '0',
      pointerEvents: 'none',
      top: `${Math.floor((docHeight * pct) / 100)}px`,
      left: '0',
    });
    document.body.appendChild(el);
    return el;
  });
}

function removeSentinels(): void {
  _sentinels.forEach((s) => s.parentElement?.removeChild(s));
  _sentinels = [];
}

function recalculateSentinelPositions(): void {
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  _sentinels.forEach((s, i) => {
    const pct = MILESTONES[i] ?? 100;
    s.style.top = `${Math.floor((docHeight * pct) / 100)}px`;
  });
}

function setupObserver(): void {
  if (_observer) {
    _observer.disconnect();
    _observer = null;
  }

  const milestonesSeen = new Set<number>();

  _observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const pct = Number(entry.target.getAttribute('data-recap-sentinel'));
        if (!milestonesSeen.has(pct)) {
          milestonesSeen.add(pct);
          emitScroll(pct);
        }
      }
    },
    { threshold: 0 }
  );

  _sentinels.forEach((s) => _observer!.observe(s));
}

// --- Continuous rAF scroll tracking ---

function startContinuousTracking(): void {
  let ticking = false;

  function onScroll(): void {
    if (!ticking) {
      _rafId = requestAnimationFrame(() => {
        try {
          const depth = getScrollDepth();
          if (depth > _maxDepth || Math.abs(depth - _lastLoggedDepth) >= INCREMENT_THRESHOLD) {
            _lastLoggedDepth = depth;
            emitScroll(depth);
          }
        } catch (err) {
          console.error('[Recap] rAF scroll error:', err);
        }
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  _cleanupFns.push(() => window.removeEventListener('scroll', onScroll));
}

// --- Resize debounce to recalculate sentinels ---

function onResize(): void {
  if (_resizeDebounceTimer !== null) clearTimeout(_resizeDebounceTimer);
  _resizeDebounceTimer = setTimeout(() => {
    try {
      recalculateSentinelPositions();
    } catch (err) {
      console.error('[Recap] Resize recalculate error:', err);
    }
  }, 500);
}

// --- Public API ---

export function initScrollCapture(handler: ScrollHandler, stripQuery = true): () => void {
  _handler = handler;
  _stripQuery = stripQuery;
  _maxDepth = 0;
  _lastLoggedDepth = 0;

  try {
    createSentinels();
    setupObserver();
  } catch (err) {
    console.error('[Recap] Scroll sentinel setup error:', err);
  }

  startContinuousTracking();

  window.addEventListener('resize', onResize, { passive: true });
  _cleanupFns.push(() => window.removeEventListener('resize', onResize));

  return () => {
    _handler = null;
    if (_observer) { _observer.disconnect(); _observer = null; }
    if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }
    if (_resizeDebounceTimer !== null) { clearTimeout(_resizeDebounceTimer); _resizeDebounceTimer = null; }
    _cleanupFns.forEach((fn) => fn());
    _cleanupFns = [];
    removeSentinels();
  };
}

export function getMaxScrollDepth(): number {
  return _maxDepth;
}

export function resetScrollState(): void {
  _maxDepth = 0;
  _lastLoggedDepth = 0;
}
