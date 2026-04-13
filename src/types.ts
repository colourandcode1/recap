// Recap UX — shared TypeScript interfaces
// All types are self-contained — no external type dependencies.

export type EventType = 'click' | 'scroll' | 'navigation' | 'visibility' | 'resize';

export interface Viewport {
  width: number;
  height: number;
}

export interface BaseEvent {
  id?: number; // assigned by IDB auto-increment
  sessionId: string;
  timestamp: number; // performance.now() ms from session start
  type: EventType;
  url: string; // pathname only, no query params
  viewport: Viewport;
}

export interface ClickEvent extends BaseEvent {
  type: 'click';
  pageX: number;
  pageY: number;
  clientX: number;
  clientY: number;
  elementX: number; // 0-1 ratio relative to element bounding box
  elementY: number; // 0-1 ratio relative to element bounding box
  selector: string; // auto-generated CSS selector
  tagName: string;
  label: string | null; // best available human-readable label
  nearestHeading: string | null; // closest preceding h1-h6 text
  pageRegion: PageRegion;
  dataAttributes?: Record<string, string>; // data-ut-* attrs
}

export interface ScrollEvent extends BaseEvent {
  type: 'scroll';
  depth: number; // 0-100 percentage
  maxDepth: number; // highest reached this page load
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

// Page region — 3x3 grid
export type PageRegion =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

// --- Config ---

export interface RecapConfig {
  sessionName?: string;
  showPanel?: boolean;
  endpoint?: string; // optional beacon endpoint
  shortcut?: string; // override keyboard shortcut
  stripQueryParams?: boolean; // default true
}

// --- Session summary (AI export) ---

export interface SessionSummary {
  meta: {
    sessionId: string;
    sessionName?: string;
    startTime: string; // ISO 8601
    endTime: string;
    duration: number; // seconds
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
  timestamp: number; // seconds from session start
  action: string; // human-readable description
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
  totalTimeOnPage: number; // seconds
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
