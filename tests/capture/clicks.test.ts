import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSelector, getPageRegion, detectRapidClick } from '../../src/capture/clicks.js';
import type { Viewport } from '../../src/types.js';

// --- generateSelector ---

describe('generateSelector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns #id when element has an id', () => {
    const el = document.createElement('div');
    el.id = 'main-header';
    document.body.appendChild(el);
    expect(generateSelector(el)).toBe('#main-header');
  });

  it('returns [data-ut-label] when element has that attribute', () => {
    const el = document.createElement('button');
    el.setAttribute('data-ut-label', 'Submit assessment');
    document.body.appendChild(el);
    expect(generateSelector(el)).toBe('[data-ut-label="Submit assessment"]');
  });

  it('uses tag only for single child', () => {
    const parent = document.createElement('nav');
    const el = document.createElement('a');
    parent.appendChild(el);
    document.body.appendChild(parent);
    const sel = generateSelector(el);
    expect(sel).toContain('a');
  });

  it('uses nth-of-type when siblings share same tag and class', () => {
    const parent = document.createElement('ul');
    const li1 = document.createElement('li');
    const li2 = document.createElement('li');
    parent.appendChild(li1);
    parent.appendChild(li2);
    document.body.appendChild(parent);
    expect(generateSelector(li2)).toContain('nth-of-type(2)');
  });

  it('uses unique class when available', () => {
    const parent = document.createElement('nav');
    const a = document.createElement('a');
    a.className = 'reports-link';
    const b = document.createElement('a');
    b.className = 'home-link';
    parent.appendChild(a);
    parent.appendChild(b);
    document.body.appendChild(parent);
    expect(generateSelector(a)).toContain('reports-link');
  });

  it('stops walking at ancestor with id', () => {
    const section = document.createElement('section');
    section.id = 'main';
    const div = document.createElement('div');
    const span = document.createElement('span');
    div.appendChild(span);
    section.appendChild(div);
    document.body.appendChild(section);
    const sel = generateSelector(span);
    expect(sel).toContain('#main');
  });
});

// --- getPageRegion ---

describe('getPageRegion', () => {
  const vp: Viewport = { width: 1200, height: 800 };

  it('returns top-left for top-left quadrant', () => {
    expect(getPageRegion(100, 50, vp)).toBe('top-left');
  });

  it('returns center for center', () => {
    expect(getPageRegion(600, 400, vp)).toBe('center');
  });

  it('returns bottom-right for bottom-right', () => {
    expect(getPageRegion(1100, 750, vp)).toBe('bottom-right');
  });

  it('returns top-center', () => {
    expect(getPageRegion(600, 50, vp)).toBe('top-center');
  });

  it('returns middle-left', () => {
    expect(getPageRegion(100, 400, vp)).toBe('middle-left');
  });
});

// --- detectRapidClick ---

describe('detectRapidClick', () => {
  beforeEach(() => {
    // Reset module state by using fresh timestamps far apart
  });

  it('returns isRapid=false for a single click', () => {
    const result = detectRapidClick('button', 100, 100, 1000);
    expect(result.isRapid).toBe(false);
  });

  it('detects rapid clicks on the same selector', () => {
    const now = Date.now() + 10000; // offset to avoid state from previous tests
    detectRapidClick('button.submit', 100, 100, now);
    detectRapidClick('button.submit', 100, 100, now + 300);
    const result = detectRapidClick('button.submit', 100, 100, now + 600);
    expect(result.isRapid).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(3);
  });

  it('detects rapid clicks within radius', () => {
    const now = Date.now() + 20000;
    detectRapidClick('div.panel', 500, 500, now);
    detectRapidClick('div.other', 520, 510, now + 200);
    const result = detectRapidClick('div.yet-another', 510, 490, now + 400);
    expect(result.isRapid).toBe(true);
  });

  it('does not flag clicks spread over time', () => {
    const now = Date.now() + 30000;
    detectRapidClick('nav > a', 100, 100, now);
    detectRapidClick('nav > a', 100, 100, now + 1000);
    // Third click comes after 2-second window
    const result = detectRapidClick('nav > a', 100, 100, now + 3000);
    expect(result.isRapid).toBe(false);
  });
});
