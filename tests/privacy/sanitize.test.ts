import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeUrl, isExcluded, isMasked, extractLabel, nearestHeading } from '../../src/privacy/sanitize.js';

describe('sanitizeUrl', () => {
  it('strips query params by default', () => {
    expect(sanitizeUrl('http://example.com/page?token=secret')).toBe('/page');
  });

  it('strips hash', () => {
    expect(sanitizeUrl('http://example.com/page#section')).toBe('/page');
  });

  it('keeps query params when stripQuery=false', () => {
    const result = sanitizeUrl('http://example.com/page?q=1', false);
    expect(result).toContain('/page');
    expect(result).toContain('q=1');
  });

  it('handles relative paths', () => {
    expect(sanitizeUrl('/dashboard')).toBe('/dashboard');
  });

  it('handles bare pathnames', () => {
    expect(sanitizeUrl('/reports/monthly')).toBe('/reports/monthly');
  });
});

describe('isExcluded', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('returns true for element with data-ut-no-track', () => {
    const el = document.createElement('div');
    el.setAttribute('data-ut-no-track', '');
    expect(isExcluded(el)).toBe(true);
  });

  it('returns true for element with class ut-block', () => {
    const el = document.createElement('div');
    el.className = 'ut-block';
    expect(isExcluded(el)).toBe(true);
  });

  it('returns true when ancestor has data-ut-no-track', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-ut-no-track', '');
    const child = document.createElement('span');
    parent.appendChild(child);
    expect(isExcluded(child)).toBe(true);
  });

  it('returns false for unexcluded element', () => {
    const el = document.createElement('button');
    expect(isExcluded(el)).toBe(false);
  });
});

describe('isMasked', () => {
  it('returns true for element with ut-mask class', () => {
    const el = document.createElement('span');
    el.className = 'ut-mask';
    expect(isMasked(el)).toBe(true);
  });

  it('returns true when ancestor has ut-mask', () => {
    const parent = document.createElement('div');
    parent.className = 'ut-mask';
    const child = document.createElement('span');
    parent.appendChild(child);
    expect(isMasked(child)).toBe(true);
  });

  it('returns false for non-masked element', () => {
    const el = document.createElement('p');
    expect(isMasked(el)).toBe(false);
  });
});

describe('extractLabel', () => {
  it('prefers data-ut-label', () => {
    const el = document.createElement('button');
    el.setAttribute('data-ut-label', 'Submit form');
    el.setAttribute('aria-label', 'aria label');
    expect(extractLabel(el)).toBe('Submit form');
  });

  it('uses aria-label second', () => {
    const el = document.createElement('button');
    el.setAttribute('aria-label', 'Close dialog');
    expect(extractLabel(el)).toBe('Close dialog');
  });

  it('uses title attribute', () => {
    const el = document.createElement('button');
    el.setAttribute('title', 'More options');
    expect(extractLabel(el)).toBe('More options');
  });

  it('uses alt for images', () => {
    const el = document.createElement('img');
    el.setAttribute('alt', 'Profile photo');
    expect(extractLabel(el)).toBe('Profile photo');
  });

  it('uses innerText truncated to 50 chars', () => {
    const el = document.createElement('button');
    el.textContent = 'Click me to do something useful';
    expect(extractLabel(el)).toBe('Click me to do something useful');
  });

  it('truncates long innerText', () => {
    const el = document.createElement('p');
    el.textContent = 'a'.repeat(60);
    const label = extractLabel(el);
    expect(label?.length).toBeLessThanOrEqual(50);
  });

  it('returns null when no label available', () => {
    const el = document.createElement('div');
    expect(extractLabel(el)).toBeNull();
  });

  it('uses placeholder for inputs', () => {
    const el = document.createElement('input');
    el.setAttribute('placeholder', 'Enter email');
    expect(extractLabel(el)).toBe('Enter email');
  });
});

describe('nearestHeading', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('finds preceding h2', () => {
    document.body.innerHTML = `
      <h2>Section Title</h2>
      <p>Some text</p>
      <button id="target">Click</button>
    `;
    const btn = document.getElementById('target')!;
    expect(nearestHeading(btn)).toBe('Section Title');
  });

  it('returns null when no heading in range', () => {
    document.body.innerHTML = `<button id="target">Click</button>`;
    const btn = document.getElementById('target')!;
    expect(nearestHeading(btn)).toBeNull();
  });

  it('truncates heading to 80 chars', () => {
    const h1 = document.createElement('h1');
    h1.textContent = 'a'.repeat(100);
    const btn = document.createElement('button');
    document.body.appendChild(h1);
    document.body.appendChild(btn);
    const result = nearestHeading(btn);
    expect(result?.length).toBeLessThanOrEqual(80);
  });
});
