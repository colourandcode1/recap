import type { NavigationEvent } from '../types.js';
export declare function generateFlowSVG(navEvents: NavigationEvent[]): string;
export declare function downloadFlowDiagram(navEvents: NavigationEvent[], sessionName?: string): void;
