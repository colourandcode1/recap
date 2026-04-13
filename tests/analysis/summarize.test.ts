import { describe, it, expect } from 'vitest';
import { summarize } from '../../src/analysis/summarize.js';
import type { AnyEvent } from '../../src/types.js';
import simpleSession from './fixtures/simple-session.json';
import complexSession from './fixtures/complex-session.json';

const simple = simpleSession as AnyEvent[];
const complex = complexSession as AnyEvent[];

describe('summarize — empty session', () => {
  it('returns empty summary for no events', () => {
    const result = summarize([]);
    expect(result.meta.totalClicks).toBe(0);
    expect(result.timeline).toHaveLength(0);
    expect(result.pages).toHaveLength(0);
  });
});

describe('summarize — simple session', () => {
  const result = summarize(simple, 'participant-01');

  it('populates meta correctly', () => {
    expect(result.meta.sessionId).toBe('test-session-001');
    expect(result.meta.sessionName).toBe('participant-01');
    expect(result.meta.totalClicks).toBe(4); // 4 click events in fixture (1 on dashboard + 3 rapid on reports)
    expect(result.meta.pagesVisited).toBeGreaterThan(0);
  });

  it('includes timeline entries', () => {
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  it('includes a navigate entry for pageload', () => {
    const entry = result.timeline.find((t) => t.type === 'navigate' && t.page === '/dashboard');
    expect(entry).toBeDefined();
  });

  it('detects rapid clicks on the same element', () => {
    expect(result.patterns.rapidClicks.length).toBeGreaterThan(0);
    expect(result.patterns.rapidClicks[0]?.clickCount).toBeGreaterThanOrEqual(3);
  });

  it('detects backtracking', () => {
    expect(result.patterns.backtracking.length).toBeGreaterThan(0);
    const bt = result.patterns.backtracking[0]!;
    expect(bt.to).toBe('/dashboard');
  });

  it('provides navigation path', () => {
    expect(result.patterns.navigationPath).toContain('/dashboard');
    expect(result.patterns.navigationPath).toContain('/reports');
  });

  it('includes most clicked elements', () => {
    expect(result.patterns.mostClickedElements.length).toBeGreaterThan(0);
  });

  it('includes prompt template', () => {
    expect(result.promptTemplate).toContain('UX researcher');
  });

  it('includes scroll dropoff data', () => {
    expect(Array.isArray(result.patterns.scrollDropoff)).toBe(true);
  });
});

describe('summarize — complex session', () => {
  const result = summarize(complex, 'participant-02');

  it('identifies multiple pages', () => {
    expect(result.meta.pagesVisited).toBeGreaterThan(2);
  });

  it('generates page summaries', () => {
    expect(result.pages.length).toBeGreaterThan(0);
    const homePage = result.pages.find((p) => p.url === '/home');
    expect(homePage).toBeDefined();
    expect(homePage!.clicks.total).toBeGreaterThan(0);
  });

  it('detects backtracking from /settings to /home', () => {
    const bt = result.patterns.backtracking.find((b) => b.to === '/home');
    expect(bt).toBeDefined();
  });

  it('includes scroll milestone in timeline', () => {
    const scrollEntry = result.timeline.find((t) => t.type === 'scroll_milestone');
    expect(scrollEntry).toBeDefined();
  });

  it('detects long time-to-first-click (15s on /home)', () => {
    const clickEntry = result.timeline.find(
      (t) => t.type === 'click' && t.page === '/home' && t.context?.includes('hesitation')
    );
    expect(clickEntry).toBeDefined();
  });
});

describe('summarize — snapshot stability', () => {
  it('same events always produce same summary (deterministic)', () => {
    const r1 = summarize(simple, 'test');
    const r2 = summarize(simple, 'test');
    // Exclude wall-clock timestamps (startTime/endTime) which vary by call time
    const strip = (s: ReturnType<typeof summarize>) => {
      const { meta: { startTime: _s, endTime: _e, ...metaRest }, ...rest } = s;
      return { meta: metaRest, ...rest };
    };
    expect(JSON.stringify(strip(r1))).toBe(JSON.stringify(strip(r2)));
  });
});
