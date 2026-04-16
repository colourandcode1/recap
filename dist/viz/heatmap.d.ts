import type { ClickEvent } from '../types.js';
export interface HeatmapFilter {
    pagePath: string;
    visitStartMs: number;
    visitEndMs: number | null;
    label: string;
}
export declare function initHeatmapCanvas(): HTMLCanvasElement;
export declare function renderHeatmap(clicks: ClickEvent[], filter?: HeatmapFilter): void;
export declare function showHeatmap(): void;
export declare function hideHeatmap(): void;
export declare function isHeatmapVisible(): boolean;
export declare function getHeatmapFilter(): HeatmapFilter | null;
export declare function getHeatmapDataURL(): string | null;
export declare function destroyHeatmap(): void;
