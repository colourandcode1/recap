export type EventType = 'click' | 'scroll' | 'navigation' | 'visibility' | 'resize';
export interface Viewport {
    width: number;
    height: number;
}
export interface BaseEvent {
    id?: number;
    sessionId: string;
    timestamp: number;
    type: EventType;
    url: string;
    viewport: Viewport;
}
export interface ClickEvent extends BaseEvent {
    type: 'click';
    pageX: number;
    pageY: number;
    clientX: number;
    clientY: number;
    elementX: number;
    elementY: number;
    selector: string;
    tagName: string;
    label: string | null;
    nearestHeading: string | null;
    pageRegion: PageRegion;
    dataAttributes?: Record<string, string>;
}
export interface ScrollEvent extends BaseEvent {
    type: 'scroll';
    depth: number;
    maxDepth: number;
}
export interface NavigationEvent extends BaseEvent {
    type: 'navigation';
    from: string;
    to: string;
    method: 'pushState' | 'replaceState' | 'popstate' | 'hashchange' | 'pageload';
}
export interface VisibilityEvent extends BaseEvent {
    type: 'visibility';
    state: 'hidden' | 'visible';
}
export interface ResizeEvent extends BaseEvent {
    type: 'resize';
    viewport: Viewport;
}
export type AnyEvent = ClickEvent | ScrollEvent | NavigationEvent | VisibilityEvent | ResizeEvent;
export type PageRegion = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export interface RecapConfig {
    sessionName?: string;
    showPanel?: boolean;
    endpoint?: string;
    shortcut?: string;
    stripQueryParams?: boolean;
}
export interface SessionSummary {
    meta: {
        sessionId: string;
        sessionName?: string;
        startTime: string;
        endTime: string;
        duration: number;
        viewport: Viewport;
        pagesVisited: number;
        totalClicks: number;
        totalScrollEvents: number;
    };
    timeline: TimelineEntry[];
    pages: PageSummary[];
    patterns: {
        mostClickedElements: ElementInteraction[];
        unclickedRegions: string[];
        averageTimeToFirstClick: number;
        navigationPath: string[];
        backtracking: BacktrackEvent[];
        rapidClicks: RapidClickCluster[];
        scrollDropoff: ScrollDropoff[];
    };
    promptTemplate: string;
}
export interface TimelineEntry {
    timestamp: number;
    action: string;
    type: 'click' | 'navigate' | 'scroll_milestone' | 'pause' | 'rapid_click';
    page: string;
    element?: {
        selector: string;
        tagName: string;
        role?: string;
        label: string | null;
        nearestHeading: string | null;
        pageRegion?: PageRegion;
    };
    context?: string;
}
export interface PageSummary {
    url: string;
    visits: number;
    totalTimeOnPage: number;
    timeToFirstClick: number | null;
    maxScrollDepth: number;
    scrollDropoffPoint: number;
    clicks: {
        total: number;
        byRegion: Partial<Record<PageRegion, number>>;
        byElement: ElementInteraction[];
    };
}
export interface ElementInteraction {
    selector: string;
    tagName: string;
    label: string | null;
    clickCount: number;
    averageTimeBetweenClicks?: number;
    pageRegion: PageRegion;
}
export interface BacktrackEvent {
    from: string;
    to: string;
    timestamp: number;
    timeOnPageBeforeBack: number;
}
export interface RapidClickCluster {
    selector: string;
    label: string | null;
    clickCount: number;
    durationMs: number;
    timestamp: number;
    page: string;
}
export interface ScrollDropoff {
    page: string;
    depth: number;
}
