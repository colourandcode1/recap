import type { AnyEvent } from '../types.js';
export declare function exportJSON(events: AnyEvent[], sessionName?: string): void;
export declare function exportCSV(events: AnyEvent[], sessionName?: string): void;
export declare function copyToClipboard(events: AnyEvent[]): Promise<void>;
export declare function exportSummaryJSON(summary: object, sessionName?: string): void;
