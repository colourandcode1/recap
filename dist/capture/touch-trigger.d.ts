export interface TouchTriggerOptions {
    /** Number of simultaneous touch points required. */
    fingerCount: number;
    /** Milliseconds the touch points must be held ~stationary before firing. */
    holdMs: number;
    /** Max px of movement per touch point allowed before the hold is cancelled. */
    moveTolerancePx: number;
}
export declare const DEFAULT_TOUCH_TRIGGER_OPTIONS: TouchTriggerOptions;
/**
 * Registers a document-level touch listener that fires `onTrigger()` once
 * when exactly `fingerCount` touches are held ~stationary for `holdMs`.
 * Returns a cleanup function that removes all listeners.
 */
export declare function initTouchTrigger(onTrigger: () => void, options?: Partial<TouchTriggerOptions>): () => void;
