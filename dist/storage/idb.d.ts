import type { AnyEvent } from '../types.js';
export declare function saveEvents(events: AnyEvent[]): Promise<void>;
export declare function getSessionEvents(sessionId: string): Promise<AnyEvent[]>;
export declare function getAllSessions(): Promise<Array<{
    sessionId: string;
    sessionName?: string;
    startTime: number;
    eventCount: number;
}>>;
export declare function clearSession(sessionId: string): Promise<void>;
export declare function clearAllSessions(): Promise<void>;
/** Remove sessions older than RETENTION_DAYS. Called on init. */
export declare function purgeOldSessions(): Promise<void>;
export declare function isUsingMemoryFallback(): boolean;
