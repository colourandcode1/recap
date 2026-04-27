import type { AnyEvent } from '../types.js';
export declare function downloadBlob(blob: Blob, filename: string): boolean;
export declare function downloadText(content: string, mimeType: string, filename: string): boolean;
export declare function buildFilename(prefix: string, ext: string): string;
export declare function exportJSON(events: AnyEvent[], sessionName?: string): boolean;
export declare function exportCSV(events: AnyEvent[], sessionName?: string): boolean;
export declare function copyToClipboard(events: AnyEvent[]): Promise<void>;
export declare function exportSummaryJSON(summary: object, sessionName?: string): boolean;
