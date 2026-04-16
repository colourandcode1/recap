import type { ClickEvent, PageRegion, Viewport } from '../types.js';
export declare function generateSelector(el: Element): string;
export declare function getPageRegion(clientX: number, clientY: number, viewport: Viewport): PageRegion;
export declare function detectRapidClick(selector: string, clientX: number, clientY: number, now: number): {
    isRapid: boolean;
    count: number;
    duration: number;
};
type ClickHandler = (event: ClickEvent) => void;
export declare function pauseClickCapture(): void;
export declare function resumeClickCapture(): void;
export declare function initClickCapture(handler: ClickHandler, stripQuery?: boolean): () => void;
export {};
