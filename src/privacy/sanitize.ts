// Privacy sanitization — URL stripping, element masking, PII guards.

/**
 * Strip query params and hash from a URL (they often contain tokens/PII).
 * Returns pathname only.
 */
export function sanitizeUrl(rawUrl: string, stripQuery = true): string {
  try {
    // Handle relative paths and full URLs
    const base = typeof location !== 'undefined' ? location.href : 'https://localhost';
    const url = new URL(rawUrl, base);
    if (stripQuery) {
      return url.pathname;
    }
    return url.pathname + url.search;
  } catch {
    // Fallback: strip query manually
    return rawUrl.split('?')[0]?.split('#')[0] ?? rawUrl;
  }
}

/**
 * Return true if an element should be completely excluded from tracking.
 * Elements with data-ut-no-track or class ut-block are excluded.
 */
export function isExcluded(el: Element): boolean {
  if (el.hasAttribute('data-ut-no-track')) return true;
  if (el.classList.contains('ut-block')) return true;
  // Check ancestors
  let parent = el.parentElement;
  while (parent) {
    if (parent.hasAttribute('data-ut-no-track')) return true;
    if (parent.classList.contains('ut-block')) return true;
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Return true if an element's text content should be masked.
 */
export function isMasked(el: Element): boolean {
  if (el.classList.contains('ut-mask')) return true;
  let parent = el.parentElement;
  while (parent) {
    if (parent.classList.contains('ut-mask')) return true;
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Extract the best human-readable label for a clicked element.
 * Priority: data-ut-label > aria-label > aria-labelledby > title > alt >
 *           innerText (50 chars) > placeholder > "Unlabelled {tagName}"
 */
export function extractLabel(el: Element): string | null {
  // 1. Explicit label
  const utLabel = el.getAttribute('data-ut-label');
  if (utLabel) return utLabel.trim();

  // 2. aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // 3. aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ref = document.getElementById(labelledBy);
    if (ref?.textContent) return ref.textContent.trim().slice(0, 80);
  }

  // 4. title
  const title = el.getAttribute('title');
  if (title) return title.trim();

  // 5. alt (images)
  const alt = el.getAttribute('alt');
  if (alt) return alt.trim();

  // 6. innerText / textContent (only if not masked, truncated to 50 chars)
  if (!isMasked(el)) {
    const htmlEl = el as HTMLElement;
    // innerText not available in all environments (e.g. jsdom); fall back to textContent
    const text = (htmlEl.innerText ?? htmlEl.textContent ?? '').trim();
    if (text.length > 0) return text.slice(0, 50);
  }

  // 7. placeholder
  const placeholder = el.getAttribute('placeholder');
  if (placeholder) return placeholder.trim();

  return null;
}

/**
 * Walk backwards from an element (via previousElementSibling + parentElement)
 * to find the nearest h1-h6, within 20 traversal steps.
 * Returns innerText (truncated to 80 chars) or null.
 */
export function nearestHeading(el: Element): string | null {
  const headings = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
  let steps = 0;
  let current: Element | null = el;

  while (current && steps < 20) {
    // Walk back through previous siblings
    let sib = current.previousElementSibling;
    while (sib && steps < 20) {
      steps++;
      if (headings.has(sib.tagName)) {
        const htmlSib = sib as HTMLElement;
        const text = (htmlSib.innerText ?? htmlSib.textContent ?? '').trim();
        return text.slice(0, 80) || null;
      }
      sib = sib.previousElementSibling;
    }
    // Move up to parent
    current = current.parentElement;
    steps++;
  }

  return null;
}
