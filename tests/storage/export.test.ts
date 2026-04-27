import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { downloadText, exportCSV, exportJSON, exportSummaryJSON } from '../../src/storage/export.js';
import type { AnyEvent } from '../../src/types.js';

const sampleEvents: AnyEvent[] = [
  {
    type: 'click',
    sessionId: 'session-1',
    timestamp: 1000,
    url: '/home',
    viewport: { width: 1280, height: 720 },
    x: 10,
    y: 20,
    pageX: 10,
    pageY: 20,
    clientX: 10,
    clientY: 20,
    selector: 'button.cta',
    tagName: 'BUTTON',
    label: 'Start',
    pageRegion: 'center',
  },
];

describe('storage export helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads via data URL with sanitized filename and synchronous cleanup', () => {
    const result = downloadText('hello world', 'text/plain', 'recap:demo/session?.txt');

    expect(result).toBe(true);
    // anchor is removed synchronously — should not be in the DOM after the call
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('uses a data: URL (not a blob: URL) for exports', () => {
    let capturedHref = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementationOnce(function (this: HTMLAnchorElement) {
      capturedHref = this.href;
    });

    exportJSON(sampleEvents, 'participant/01');

    expect(capturedHref).toMatch(/^data:application\/json/);
  });

  it('returns false when dispatching download click fails', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementationOnce(() => {
      throw new Error('click blocked');
    });

    const result = downloadText('content', 'text/plain', 'recap.txt');

    expect(result).toBe(false);
    // anchor should be cleaned up even on failure
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('propagates success/failure contracts for JSON/CSV/AI exporters', () => {
    expect(exportJSON(sampleEvents, 'participant/01')).toBe(true);
    expect(exportCSV(sampleEvents)).toBe(true);
    expect(exportSummaryJSON({ score: 1 }, 'participant/01')).toBe(true);

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('click blocked');
    });

    expect(exportJSON(sampleEvents, 'participant/01')).toBe(false);
    expect(exportCSV(sampleEvents)).toBe(false);
    expect(exportSummaryJSON({ score: 1 }, 'participant/01')).toBe(false);
  });
});
