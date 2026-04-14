import type { ClickEvent } from '../types.js';
export declare function initHeatmapCanvas(): HTMLCanvasElement;
export declare function renderHeatmap(clicks: ClickEvent[]): void;
export declare function showHeatmap(): void;
export declare function hideHeatmap(): void;
export declare function isHeatmapVisible(): boolean;
export declare function getHeatmapDataURL(): string | null;
export declare function destroyHeatmap(): void;
