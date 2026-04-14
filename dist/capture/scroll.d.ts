import type { ScrollEvent } from '../types.js';
type ScrollHandler = (event: ScrollEvent) => void;
export declare function initScrollCapture(handler: ScrollHandler, stripQuery?: boolean): () => void;
export declare function getMaxScrollDepth(): number;
export declare function resetScrollState(): void;
export {};
