import type { AnyEvent } from '../types.js';
type FlushTarget = (events: AnyEvent[]) => Promise<void>;
export declare function push(event: AnyEvent): void;
export declare function flush(): Promise<void>;
export declare function initBuffer(target: FlushTarget): () => void;
/** Get all buffered events without clearing the buffer (for export). */
export declare function getBuffer(): AnyEvent[];
/** Clear the buffer (e.g. after a clear-session action). */
export declare function clearBuffer(): void;
export {};
