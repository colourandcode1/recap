import type { NavigationEvent } from '../types.js';
type NavHandler = (event: NavigationEvent) => void;
export declare function pauseNavigationCapture(): void;
export declare function resumeNavigationCapture(): void;
export declare function initNavigationCapture(handler: NavHandler, stripQuery?: boolean): () => void;
export {};
