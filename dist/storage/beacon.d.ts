import type { AnyEvent } from '../types.js';
export declare function setEndpoint(url: string): void;
export declare function sendBeaconBatch(events: AnyEvent[]): Promise<void>;
export declare function hasEndpoint(): boolean;
