import type { AnyEvent } from '../types.js';
export interface PageVisit {
    pagePath: string;
    arrivalTime: number;
    duration: number | null;
    visitNumber: number;
    isRevisit: boolean;
    tags: PageVisitTag[];
}
export type PageVisitTag = 'backtrack' | 'first task' | 'abandoned' | 'end of session' | 'long pause' | 'brief visit';
/**
 * Derive a chronological PageVisit list from a session's raw events.
 *
 * @param events      All events for the session, in any order.
 * @param isCurrentSession  True when the session is still live — the last visit
 *                    gets duration=null and no end-of-session / abandoned tag.
 */
export declare function generateTimeline(events: AnyEvent[], isCurrentSession?: boolean): PageVisit[];
