import type { NavigationEvent } from '../types.js';
type NavHandler = (event: NavigationEvent) => void;
export declare function initNavigationCapture(handler: NavHandler, stripQuery?: boolean): () => void;
export {};
