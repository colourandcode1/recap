// Click event capture — attaches a passive listener, records structured events.

import type { ClickEvent, PageRegion, Viewport } from '../types.js';
import { getSessionId, getTimestamp } from './session.js';
import { sanitizeUrl, isExcluded, extractLabel, nearestHeading } from '../privacy/sanitize.js';

// --- CSS selector generation ---

/**
 * Generate a human-readable, stable CSS selector for a DOM element.
 * Strategy (per spec):
 *  1. #id → return immediately
 *  2. data-ut-label → [data-ut-label="value"]
 *  3. Walk up to body, building a path of tag + class/nth-of-type segments
 *  4. Stop at an ancestor with id → use #id as root
 *  5. Cap at 5 levels
 */
/** Simple CSS identifier escaper (subset of CSS.escape) */
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  // Fallback: escape leading digits and special chars
  return value.replace(/([^\w-])/g, '\\$1').replace(/^(\d)/, '\\3$1 ');
}

export function generateSelector(el: Element): string {
  // 1. ID
  if (el.id) return `#${cssEscape(el.id)}`;

  // 2. data-ut-label
  const utLabel = el.getAttribute('data-ut-label');
  if (utLabel) return `[data-ut-label="${utLabel.replace(/"/g, '\\"')}"]`;

  const segments: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body && segments.length < 5) {
    const tag = current.tagName.toLowerCase();

    // If this ancestor has an id, use it as root and stop
    if (current.id && current !== el) {
      segments.push(`#${cssEscape(current.id)}`);
      break;
    }

    // Find a unique class among siblings
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter((c) => c.tagName === current!.tagName)
      : [];

    let segment = tag;

    if (siblings.length > 1) {
      // Try to find a unique class
      const uniqueClass = findUniqueClass(current, siblings);
      if (uniqueClass) {
        segment = `${tag}.${cssEscape(uniqueClass)}`;
      } else {
        // Use nth-of-type
        const index = siblings.indexOf(current) + 1;
        segment = `${tag}:nth-of-type(${index})`;
      }
    }

    segments.push(segment);
    current = current.parentElement;
  }

  return segments.reverse().join(' > ');
}

function findUniqueClass(el: Element, siblings: Element[]): string | null {
  for (const cls of Array.from(el.classList)) {
    const hasDuplicate = siblings.some((s) => s !== el && s.classList.contains(cls));
    if (!hasDuplicate) return cls;
  }
  return null;
}

// --- Page region ---

export function getPageRegion(clientX: number, clientY: number, viewport: Viewport): PageRegion {
  const xRatio = clientX / viewport.width;
  const yRatio = clientY / viewport.height;

  const col = xRatio < 0.33 ? 'left' : xRatio < 0.67 ? 'center' : 'right';
  const row = yRatio < 0.33 ? 'top' : yRatio < 0.67 ? 'middle' : 'bottom';

  if (col === 'center' && row === 'middle') return 'center';
  return `${row}-${col}` as PageRegion;
}

// --- Rapid click detection ---

interface RecentClick {
  selector: string;
  clientX: number;
  clientY: number;
  time: number;
}

const RAPID_CLICK_WINDOW_MS = 2000;
const RAPID_CLICK_THRESHOLD = 3;
const RAPID_CLICK_RADIUS_PX = 50;

const recentClicks: RecentClick[] = [];

export function detectRapidClick(
  selector: string,
  clientX: number,
  clientY: number,
  now: number
): { isRapid: boolean; count: number; duration: number } {
  // Prune old entries
  const cutoff = now - RAPID_CLICK_WINDOW_MS;
  while (recentClicks.length > 0 && recentClicks[0]!.time < cutoff) {
    recentClicks.shift();
  }

  recentClicks.push({ selector, clientX, clientY, time: now });

  // Count clicks on same selector OR within radius
  const matching = recentClicks.filter(
    (c) =>
      c.selector === selector ||
      Math.sqrt((c.clientX - clientX) ** 2 + (c.clientY - clientY) ** 2) <= RAPID_CLICK_RADIUS_PX
  );

  const isRapid = matching.length >= RAPID_CLICK_THRESHOLD;
  const duration =
    matching.length > 1
      ? (matching[matching.length - 1]!.time - matching[0]!.time) / 1000
      : 0;

  return { isRapid, count: matching.length, duration };
}

// --- Data attributes ---

function extractDataAttributes(el: Element): Record<string, string> | undefined {
  const attrs: Record<string, string> = {};
  let found = false;
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('data-ut-')) {
      attrs[attr.name] = attr.value;
      found = true;
    }
  }
  return found ? attrs : undefined;
}

// --- Listener ---

type ClickHandler = (event: ClickEvent) => void;

let _handler: ClickHandler | null = null;
let _stripQuery = true;
let _paused = false;

export function pauseClickCapture(): void { _paused = true; }
export function resumeClickCapture(): void { _paused = false; }

function onDocumentClick(e: MouseEvent): void {
  try {
    const target = e.target as Element | null;
    if (!target || !_handler || _paused) return;

    // Privacy: skip excluded elements
    if (isExcluded(target)) return;

    // Privacy: never capture form inputs values
    const tag = target.tagName.toUpperCase();

    const viewport: Viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const rect = target.getBoundingClientRect();
    const elementX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
    const elementY = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0;

    const selector = generateSelector(target);
    const label = extractLabel(target);
    const heading = nearestHeading(target);
    const region = getPageRegion(e.clientX, e.clientY, viewport);

    const dataAttributes = extractDataAttributes(target);
    const event: ClickEvent = {
      sessionId: getSessionId(),
      timestamp: getTimestamp(),
      type: 'click',
      url: sanitizeUrl(location.href, _stripQuery),
      viewport,
      pageX: e.pageX,
      pageY: e.pageY,
      clientX: e.clientX,
      clientY: e.clientY,
      elementX: Math.max(0, Math.min(1, elementX)),
      elementY: Math.max(0, Math.min(1, elementY)),
      selector,
      tagName: tag,
      label,
      nearestHeading: heading,
      pageRegion: region,
      ...(dataAttributes !== undefined ? { dataAttributes } : {}),
    };

    _handler(event);
  } catch (err) {
    console.error('[Recap] Click capture error:', err);
  }
}

export function initClickCapture(handler: ClickHandler, stripQuery = true): () => void {
  _handler = handler;
  _stripQuery = stripQuery;
  document.addEventListener('click', onDocumentClick, { passive: true, capture: true });

  return () => {
    document.removeEventListener('click', onDocumentClick, { capture: true } as EventListenerOptions);
    _handler = null;
  };
}
