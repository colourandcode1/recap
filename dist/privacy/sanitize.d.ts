/**
 * Strip query params and hash from a URL (they often contain tokens/PII).
 * Returns pathname only.
 */
export declare function sanitizeUrl(rawUrl: string, stripQuery?: boolean): string;
/**
 * Return true if an element should be completely excluded from tracking.
 * Elements with data-ut-no-track or class ut-block are excluded.
 */
export declare function isExcluded(el: Element): boolean;
/**
 * Return true if an element's text content should be masked.
 */
export declare function isMasked(el: Element): boolean;
/**
 * Extract the best human-readable label for a clicked element.
 * Priority: data-ut-label > aria-label > aria-labelledby > title > alt >
 *           innerText (50 chars) > placeholder > "Unlabelled {tagName}"
 */
export declare function extractLabel(el: Element): string | null;
/**
 * Walk backwards from an element (via previousElementSibling + parentElement)
 * to find the nearest h1-h6, within 20 traversal steps.
 * Returns innerText (truncated to 80 chars) or null.
 */
export declare function nearestHeading(el: Element): string | null;
